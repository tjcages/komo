import { setTimeout as delay } from "node:timers/promises";
import { threadMarkdown } from "../../src/agent-prompt";
import type { Comment, Thread } from "../../src/types";
import { originAllowed } from "../validation";
import { activity, tombstone } from "./activity";
import type { LocalAgent, LocalKomo } from "./index";
import { alive } from "./projects";
import type { DatabaseSync } from "node:sqlite";

// Watch mode: hand each new note to exactly one agent.
// - A candidate is an open thread in one of the agent's scopes where a person
//   had the last word: a message, or an edit after the last agent message.
//   With an origin filter, the page that wrote that activity must match.
// - On the agent's own channel, a candidate is held until the person presses
//   Send: its latest human activity must be no later than the last Send. The
//   scope a stock client uses is never held.
// - Its claim key names the latest human activity, a message or an edit, so a
//   follow-up or an edit is delivered again, and nothing else is.
// - A claim is one atomic upsert. It lapses after a lease, or at once when the
//   process that holds it has ended. Until then, a new version of the thread
//   goes back to the same holder only, so no second agent redoes the work.
// - An agent never reads text that waits for Send: a thread is cut to what
//   was sent (`LocalAgent.released`).
// - The wait compares state (the scope revisions and the Send watermarks),
//   not events, so a note that lands between the drain and the wait is still
//   found.

/** How long a delivered note stays with the agent that took it. */
export const claimLease = 20 * 60000;
/** How long a session shows as watching after its last watch call. */
export const presenceIdle = 15 * 60000;
const poll = 250;
const retryBlocked = 5000;
const retryTransient = 2000;
const beat = 5000;
/**
 * How long a waiter that printed stays present, unless the watch call that
 * follows it takes over sooner.
 */
export const handOver = 60000;

/** The presence session of the waiter that `holder` runs. */
export const waiterPresence = (holder: string) => `wait:${holder}`;

/** Who holds a claim. A pid of 0 holds it by its lease only, as the CLI does. */
export type Holder = { session: string; pid: number };

type Listed = { thread: Thread; branch: string; origin?: string };
type Candidate = Listed & { key: string };

export type WatchResult = {
  scope: {
    project: string;
    repo: string;
    channel: string;
    label: string;
    branch: string;
  };
  timeout: boolean;
  count: number;
  threads: (ReturnType<typeof formatThread> & { version: string })[];
};

/**
 * Page origin patterns from a tool argument or KOMO_AGENT_ORIGINS: a list, or
 * text split on commas and spaces. Undefined when none are given.
 */
export function parseOrigins(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const list =
    typeof value === "string" ? value.split(/[\s,]+/).filter(Boolean) : value;
  if (
    !Array.isArray(list) ||
    list.length > 50 ||
    !list.every(
      (item) =>
        typeof item === "string" &&
        item.length <= 300 &&
        /^https?:\/\/[^/]+$/.test(item),
    )
  )
    throw Error(
      "origins must be a list of page origins, such as http://localhost:4321 or http://*.localhost.",
    );
  return list.length ? (list as string[]) : undefined;
}

function scopeBranches(agent: LocalAgent) {
  return [...new Set([agent.scope.channel, agent.scope.branch])];
}

const iso = (time: number) => new Date(time).toISOString();

/** A thread as the agent reads it: the target, every message, and Markdown. */
export function formatThread(agent: LocalAgent, item: Listed) {
  const { thread, branch, origin } = item;
  const comments = thread.comments.filter(
    (comment) => comment.body !== tombstone,
  );
  const anchor = thread.anchor;
  return {
    id: thread.id,
    branch,
    url: origin ? `${origin}${thread.page}` : null,
    page: thread.page,
    selector: anchor.selector,
    text: anchor.text,
    source: anchor.source ?? null,
    box: {
      x: anchor.x,
      y: anchor.y,
      width: anchor.width,
      height: anchor.height,
      pageX: Math.round(anchor.pageX),
      pageY: Math.round(anchor.pageY),
      viewportWidth: anchor.viewportWidth,
    },
    edited: !!comments.at(-1)?.editedAt,
    resolved: thread.resolved,
    comments: comments.map((comment: Comment) => ({
      id: comment.id,
      author: comment.author.name,
      you: comment.author.id === agent.userId,
      body: comment.body,
      createdAt: iso(comment.createdAt),
      editedAt: comment.editedAt ? iso(comment.editedAt) : null,
    })),
    markdown: threadMarkdown({ ...thread, comments }),
  };
}

type Pending = { id: string; branch: string; key: string; origin?: string };

/**
 * Open threads in the agent's scopes where a person had the last word and
 * that are not held for Send, read from the store. Reading here costs no
 * Worker request, so a listing does not grow with resolved history or spend
 * the agent's rate limit; the Worker serves only the threads the agent claims.
 *
 * With an origin filter, a thread passes only when the page that wrote its
 * latest human activity matches, in both scopes. An unknown origin does not
 * pass.
 */
function pending(agent: LocalAgent, origins: string[] | undefined): Pending[] {
  const { komo, scope } = agent;
  const found: Pending[] = [];
  for (const row of activity(komo.database, {
    project: scope.project,
    repo: scope.repo,
    branches: scopeBranches(agent),
    open: true,
  })) {
    // The last word is an agent's: it waits for a person, not for an agent.
    if (!row.waiting || !row.key || row.held) continue;
    if (
      origins &&
      !(row.humanOrigin && originAllowed(row.humanOrigin, origins))
    )
      continue;
    found.push({
      id: row.id,
      branch: row.branch,
      key: row.key,
      origin: row.threadOrigin ?? row.humanOrigin,
    });
  }
  return found;
}

type ClaimRow = {
  claim_key: string;
  holder_session: string;
  holder_pid: number;
  expires_at: number;
};

/** The claim on a thread, and whether its holder still has it. */
export function claimOf(
  komo: LocalKomo,
  threadId: string,
  database: DatabaseSync = komo.database,
) {
  const row = database
    .prepare(
      "SELECT claim_key,holder_session,holder_pid,expires_at FROM local_claims WHERE thread_id=?",
    )
    .get(threadId) as ClaimRow | undefined;
  // A pid of 0 holds by the lease only. This process is alive by definition.
  const ended =
    !!row &&
    row.holder_pid > 0 &&
    row.holder_pid !== process.pid &&
    !alive(row.holder_pid);
  return { row, live: !!row && row.expires_at > Date.now() && !ended, ended };
}

/**
 * Whether a holder may take this version of a note. A live claim stays with
 * its holder: a follow-up or an edit goes back to the agent that works on the
 * thread, and to no other, until its lease lapses or its process ends.
 */
function takeable(komo: LocalKomo, candidate: Pending, holder: Holder) {
  const { row, live, ended } = claimOf(komo, candidate.id);
  const ok =
    !row ||
    !live ||
    (row.holder_session === holder.session && row.claim_key !== candidate.key);
  return { ok, row, ended };
}

/**
 * Take a note, atomically. True only when this call wrote the claim: a new
 * note; a new message or edit since this holder's claim; a lapsed lease; or
 * a holder process that has ended.
 */
function claim(komo: LocalKomo, candidate: Pending, holder: Holder): boolean {
  const now = Date.now(),
    id = candidate.id;
  const { ok, ended, row } = takeable(komo, candidate, holder);
  if (!ok) return false;
  // The upsert repeats the rule, so a claim that a live process took in the
  // meantime stays with it. `ended` names the one pid it may replace.
  const result = komo.database
    .prepare(
      `INSERT INTO local_claims(thread_id,claim_key,holder_session,holder_pid,expires_at) VALUES(?,?,?,?,?)
      ON CONFLICT(thread_id) DO UPDATE SET claim_key=excluded.claim_key,holder_session=excluded.holder_session,
        holder_pid=excluded.holder_pid,expires_at=excluded.expires_at
      WHERE (local_claims.holder_session=excluded.holder_session AND local_claims.claim_key<>excluded.claim_key)
        OR local_claims.expires_at<=? OR local_claims.holder_pid=?`,
    )
    .run(
      id,
      candidate.key,
      holder.session,
      holder.pid,
      now + claimLease,
      now,
      ended && row ? row.holder_pid : -1,
    );
  return Number(result.changes) === 1;
}

/**
 * Whether a claim by this holder would take this note now. The same rule as
 * the upsert in `claim`, read without writing.
 */
function claimable(
  komo: LocalKomo,
  candidate: Pending,
  holder: Holder,
): boolean {
  return takeable(komo, candidate, holder).ok;
}

/** Give back claims this holder took, when their notes were not delivered. */
export function releaseClaims(
  komo: LocalKomo,
  holder: Holder,
  claims: { id: string; key: string }[],
) {
  const release = komo.database.prepare(
    "DELETE FROM local_claims WHERE thread_id=? AND claim_key=? AND holder_session=?",
  );
  for (const { id, key } of claims) release.run(id, key, holder.session);
}

/** A Worker answer that passes: a rate limit, or a busy store. */
function transient(error: unknown) {
  const status = (error as { status?: number }).status;
  return (
    status === 429 ||
    status === 503 ||
    /SQLITE_BUSY|database is locked/i.test((error as Error)?.message ?? "")
  );
}

/**
 * Return the notes that wait for this agent, claimed, at once. With none,
 * block until one arrives, collect more for `batchMs`, and return the batch;
 * or return a timeout. An abort gives back every claim this call took.
 * `received` gets the claim key of each returned note: the version of the
 * thread the agent works from, which the edit guard checks.
 */
export async function watch(
  agent: LocalAgent,
  options: {
    holder: Holder;
    timeoutMs: number;
    batchMs: number;
    origins?: string[];
    signal?: AbortSignal;
    received?: Map<string, string>;
  },
): Promise<WatchResult> {
  const { komo, scope } = agent;
  const branches = scopeBranches(agent);
  const deadline = Date.now() + options.timeoutMs;
  const claimed = new Map<string, Candidate>();
  let version: number | undefined,
    revision: string | undefined,
    blocked: Pending[] = [],
    retryAt = 0,
    listAt = 0,
    batchEnd = 0,
    drain = true;
  const release = (claims: { id: string; key: string }[]) =>
    releaseClaims(komo, options.holder, claims);
  try {
    for (;;) {
      options.signal?.throwIfAborted();
      // Read the revision before listing: a note written during the listing
      // changes it, so the next pass lists again.
      let fresh: Pending[] | undefined;
      const nextVersion = komo.dataVersion();
      if (nextVersion !== version && Date.now() >= listAt) {
        version = nextVersion;
        const nextRevision = komo.revisions(
          scope.project,
          scope.repo,
          branches,
        );
        if (nextRevision !== revision) {
          revision = nextRevision;
          fresh = pending(agent, options.origins);
        }
      }
      const now = Date.now();
      // Notes another holder has are tried again, for a lapsed lease or an
      // ended process; neither changes a revision.
      if (fresh || (blocked.length && now >= retryAt)) {
        const list = fresh ?? blocked;
        blocked = [];
        for (const item of list) {
          if (claimed.get(item.id)?.key === item.key) continue;
          if (!claim(komo, item, options.holder)) {
            blocked.push(item);
            continue;
          }
          let thread: Thread | undefined;
          try {
            // A write that lands after the listing may wait for Send: cut it.
            thread = agent.released(
              await agent.fetchThread(item.id, item.branch),
            );
          } catch (error) {
            release([item]);
            if (!transient(error)) throw error;
            // A rate limit or a busy store: list again after a pause.
            version = revision = undefined;
            listAt = Date.now() + retryTransient;
            break;
          }
          if (!thread || thread.resolved) {
            release([item]);
            continue;
          }
          claimed.set(item.id, {
            thread,
            branch: item.branch,
            origin: item.origin,
            key: item.key,
          });
        }
        retryAt = now + retryBlocked;
        // Notes that already waited return at once. The batch window opens
        // only when the first note arrives while the call waits.
        if (claimed.size && !batchEnd)
          batchEnd = drain ? now : now + options.batchMs;
      }
      // A listing that a rate limit cut short does not end the drain.
      if (version !== undefined) drain = false;
      if (Date.now() >= (batchEnd || deadline)) break;
      await delay(poll, undefined, { signal: options.signal });
    }
    // A cancel that lands while a listing runs still gives the claims back.
    options.signal?.throwIfAborted();
  } catch (error) {
    release(
      [...claimed.values()].map(({ thread, key }) => ({ id: thread.id, key })),
    );
    throw error;
  }
  for (const { thread, key } of claimed.values())
    options.received?.set(thread.id, key);
  const threads = [...claimed.values()]
    .sort(
      (a, b) =>
        a.thread.createdAt - b.thread.createdAt ||
        a.thread.id.localeCompare(b.thread.id),
    )
    .map((candidate) => ({
      ...formatThread(agent, candidate),
      // The version the agent works from; `resolve --local --version` takes it.
      version: candidate.key,
    }));
  return {
    scope: {
      project: scope.project,
      repo: scope.repo,
      channel: scope.channel,
      label: scope.label,
      branch: scope.branch,
    },
    timeout: !threads.length,
    count: threads.length,
    threads,
  };
}

/**
 * Block until at least one note waits for this agent that `holder` may
 * take, and return how many. Claims nothing. It lists again when a scope
 * revision or a Send watermark changes, and every 5 s for a released claim,
 * a lapsed lease or an ended holder, which change neither.
 */
export async function waitForNotes(
  agent: LocalAgent,
  options: { holder: Holder; origins?: string[]; signal?: AbortSignal },
): Promise<number> {
  const { komo, scope } = agent;
  const branches = scopeBranches(agent);
  let version: number | undefined,
    revision: string | undefined,
    listAt = 0;
  for (;;) {
    options.signal?.throwIfAborted();
    try {
      // Read the revision before listing: a note written during the listing
      // changes it, so the next pass lists again.
      const nextVersion = komo.dataVersion();
      let list = Date.now() >= listAt;
      if (nextVersion !== version) {
        version = nextVersion;
        const nextRevision = komo.revisions(
          scope.project,
          scope.repo,
          branches,
        );
        if (nextRevision !== revision) {
          revision = nextRevision;
          list = true;
        }
      }
      if (list) {
        listAt = Date.now() + retryBlocked;
        const count = pending(agent, options.origins).filter((item) =>
          claimable(komo, item, options.holder),
        ).length;
        if (count) return count;
      }
    } catch (error) {
      if (!transient(error)) throw error;
      // A busy store: list again after a pause.
      listAt = Date.now() + retryTransient;
    }
    await delay(poll, undefined, { signal: options.signal });
  }
}

/**
 * One session's presence on its channel: `waiting` while a watch call blocks,
 * `working` between calls. It beats every 5 s, and stops after 15 min
 * without a watch call.
 */
export class Presence {
  private timer?: NodeJS.Timeout;
  private channel?: string;
  private watching = 0;
  private last = 0;

  constructor(
    private readonly komo: LocalKomo,
    readonly session: string,
    private readonly log: (line: string) => void = (line) =>
      console.error(line),
  ) {}

  /** A watch call starts on a channel. */
  begin(channel: string) {
    if (this.channel && this.channel !== channel)
      try {
        this.komo.leave(this.session);
      } catch {}
    this.channel = channel;
    // A watch call takes over from this holder's waiter, which lingers after
    // it printed.
    if (!this.session.startsWith("wait:"))
      try {
        this.komo.leave(waiterPresence(this.session));
      } catch {}
    this.watching++;
    this.last = Date.now();
    this.tryBeat();
    if (!this.timer) {
      this.timer = setInterval(() => this.tick(), beat);
      this.timer.unref();
    }
  }

  /** A watch call returned. */
  end() {
    this.watching = Math.max(0, this.watching - 1);
    this.last = Date.now();
    this.tryBeat();
  }

  /** A presence write never replaces a watch result. */
  private tryBeat() {
    try {
      this.beat();
    } catch (error) {
      this.log(
        `[komo local] Presence update failed: ${(error as Error).message}`,
      );
    }
  }

  private beat() {
    if (this.channel)
      this.komo.heartbeat(
        this.session,
        this.channel,
        this.watching ? "waiting" : "working",
      );
  }

  private tick() {
    if (!this.watching && Date.now() - this.last > presenceIdle)
      return this.stop();
    this.tryBeat();
  }

  /**
   * Stop beating. With `leave`, drop out of presence at once; without it,
   * the last state shows until the 15 s presence window passes, or for
   * `linger` ms when that is longer.
   */
  stop(leave = true, linger = 0) {
    clearInterval(this.timer);
    this.timer = undefined;
    if (!this.channel) return;
    try {
      if (leave) this.komo.leave(this.session);
      else if (linger) this.komo.linger(this.session, linger);
    } catch {}
    this.channel = undefined;
  }
}
