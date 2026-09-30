import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import worker from "../index";
import type { Thread } from "../../src/types";
import { originAllowed } from "../validation";
import { activity, sendCounts, tombstone } from "./activity";
import { d1 } from "./d1";
import { agentOrigin, localContext, localEnv } from "./env";
import { listen, localPort, type Listener } from "./http";
import {
  projectConfigs,
  registerProject,
  type ProjectConfig,
} from "./projects";
import { resolveScope, type AgentScope } from "./scope";
import { openProbe, openStore, storePath } from "./store";
import { branches, handoffs, pending, release, stage, type StageInput } from "./staging";
import { claimLease, claimOf, formatThread, type Holder } from "./watch";

// Local agent mode: the unchanged komo Worker, run in Node over a SQLite file,
// behind a loopback-only HTTP server. Every process opens the same store, so
// agent tools work without HTTP; the HTTP server is for the browser.

export { defaultLocalOrigins, resolveScope, type AgentScope } from "./scope";
export { defaultPort, localPort } from "./http";
export { storePath } from "./store";
export {
  claimLease,
  formatThread,
  handOver,
  parseOrigins,
  Presence,
  releaseClaims,
  waitForNotes,
  waiterPresence,
  watch,
  type Holder,
  type WatchResult,
} from "./watch";

/** Presence rows older than this are not watching. */
export const presenceWindow = 15000;
const hour = 3600000;

export type WatchingAgent = {
  channel: string;
  label: string;
  state: "waiting" | "working";
  since: number;
};

/** One open local store, and the Worker over it. */
export class LocalKomo {
  readonly database: DatabaseSync;
  readonly DB: D1Database;
  private readonly pending = new Set<Promise<unknown>>();
  private readonly requests = new Set<Promise<Response>>();
  private gate?: Promise<void>;
  private probe?: DatabaseSync;
  private readonly warned = new Set<string>();

  constructor(readonly path = storePath()) {
    this.database = openStore(path);
    this.DB = d1(this.database);
  }

  /**
   * Run one request through the Worker. `inProcess` also allows the agent's
   * internal origin, which the HTTP adapter never lets a page present.
   */
  async fetch(
    request: Request,
    inProcess = false,
    database = this.database,
  ): Promise<Response> {
    // Drain active Worker requests before an agent's private transaction. A
    // same-process HTTP write must not block the event loop on SQLite's lock.
    if (database === this.database) while (this.gate) await this.gate;
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);
    const pageOrigin =
      origin ??
      (request.headers.get("Sec-Fetch-Site") === "same-origin"
        ? url.origin
        : null);
    const project = url.searchParams.get("project");
    const groups = project
      ? projectConfigs(database, project).get(project)?.originGroups
      : undefined;
    // A union is needed for the Worker's unchanged config format. The local
    // gate keeps the intersection of the registrations, even for wildcards.
    if (
      pageOrigin &&
      !(inProcess && pageOrigin === agentOrigin) &&
      groups &&
      !groups.every((patterns) => originAllowed(pageOrigin, patterns))
    )
      return Response.json(
        {
          error: "This site is not approved for this komo project.",
          code: "site_not_approved",
        },
        {
          status: 403,
          headers: {
            ...(origin && { "Access-Control-Allow-Origin": origin }),
            Vary: "Origin",
          },
        },
      );
    const ongoing = worker.fetch(
      request as Parameters<typeof worker.fetch>[0],
      localEnv(
        database,
        inProcess && database === this.database
          ? this.DB
          : d1(
              database,
              origin ?? undefined,
              !inProcess,
              database !== this.database,
            ),
        inProcess,
      ),
      localContext(this.pending),
    );
    if (database === this.database) this.requests.add(ongoing);
    try {
      return await ongoing;
    } finally {
      this.requests.delete(ongoing);
    }
  }

  /** Pause ordinary Worker requests while a guarded action owns its connection. */
  async exclusive<T>(action: () => Promise<T>): Promise<T> {
    const previous = this.gate;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    this.gate = gate;
    try {
      if (previous) await previous;
      await Promise.allSettled([...this.requests]);
      return await action();
    } finally {
      release();
      if (this.gate === gate) this.gate = undefined;
    }
  }

  /** The Worker's hourly cleanup, plus the local tables'. */
  async scheduled() {
    await worker.scheduled(
      {} as ScheduledController,
      localEnv(this.database, this.DB),
      localContext(this.pending),
    );
    const now = Date.now();
    this.database
      .prepare("DELETE FROM local_agents WHERE last_seen<?")
      .run(now - hour);
    this.database
      .prepare("DELETE FROM local_claims WHERE expires_at<?")
      .run(now);
    this.database
      .prepare(
        "DELETE FROM local_thread_origins WHERE thread_id NOT IN (SELECT id FROM threads)",
      )
      .run();
    this.database
      .prepare(
        "DELETE FROM local_comment_origins WHERE comment_id NOT IN (SELECT id FROM comments)",
      )
      .run();
    await this.settle();
  }

  /** Wait for the Worker's waitUntil work. */
  async settle() {
    while (this.pending.size) await Promise.all(this.pending);
  }

  /**
   * A number that changes whenever any connection, this process's included,
   * commits to the store. Read on a second connection, since SQLite does not
   * count a connection's own commits.
   */
  dataVersion(): number {
    this.probe ??= openProbe(this.path);
    const row = this.probe.prepare("PRAGMA data_version").get() as {
      data_version: number;
    };
    return Number(row.data_version);
  }

  /**
   * The scope revisions and Send watermarks of some branches of a project, as
   * one comparable string. A Send changes it, so a watch lists again.
   */
  revisions(project: string, repo: string, branches: string[]): string {
    this.probe ??= openProbe(this.path);
    const list = branches.map(() => "?").join(",");
    const rows = this.probe
      .prepare(
        `SELECT branch,version FROM scope_revisions WHERE project=? AND repo=? AND branch IN (${list})
        UNION ALL SELECT 'sent:'||branch,sent_revision FROM local_sends WHERE project=? AND repo=? AND branch IN (${list})
        ORDER BY 1`,
      )
      .all(project, repo, ...branches, project, repo, ...branches) as {
      branch: string;
      version: number;
    }[];
    return rows.map((row) => `${row.branch}:${row.version}`).join(",");
  }

  /** The guest users that local agents post as in a project. */
  agentUsers(project: string): Set<string> {
    const rows = this.database
      .prepare(
        "SELECT user_id FROM local_channels WHERE project=? AND user_id IS NOT NULL",
      )
      .all(project) as { user_id: string }[];
    return new Set(rows.map((row) => row.user_id));
  }

  /** Whether a branch of a project is a local agent's channel. */
  isAgentChannel(project: string, repo: string, branch: string): boolean {
    return !!this.database
      .prepare(
        "SELECT 1 FROM local_channels WHERE channel=? AND project=? AND repo=?",
      )
      .get(branch, project, repo);
  }

  /** Notes on an agent channel that wait for Send (`held`), and sent ones still open (`sent`). */
  sendCounts(project: string, repo: string, branch: string) {
    return sendCounts(this.database, { project, repo, branch });
  }

  /** New notes wait on a reserved branch until Send moves them to an agent. */
  stageNote(input: StageInput, origin: string, token?: string) {
    return stage(this, input, origin, token);
  }

  queued(project: string, repo: string) {
    return pending(this.database, { project, repo });
  }

  branches(project: string, repo: string) {
    return branches(this.database, { project, repo });
  }

  handoffs(project: string, repo: string, endpoint: string, branch: string) {
    return handoffs(this.database, { project, repo }, endpoint, branch);
  }

  /** Transfer every queued note to a registered agent, then release atomically. */
  send(project: string, repo: string, branch: string) {
    return this.exclusive(async () => release(this.database, { project, repo }, branch));
  }

  /** A registered project's repository and allowed page origins. */
  project(project: string): ProjectConfig | undefined {
    return projectConfigs(this.database, project).get(project);
  }

  /**
   * Register this process's checkout of a project, without overwriting another
   * running checkout's registration. Logs a warning when running checkouts
   * disagree on `local.origins`.
   */
  registerProject(scope: AgentScope) {
    const warning = registerProject(this.database, scope);
    if (warning && !this.warned.has(warning)) {
      this.warned.add(warning);
      console.error(`[komo local] ${warning}`);
    }
  }

  /** The page origin each thread was created from, when known. */
  threadOrigins(ids: string[]): Map<string, string> {
    const origins = new Map<string, string>();
    if (!ids.length) return origins;
    const rows = this.database
      .prepare(
        `SELECT thread_id,origin FROM local_thread_origins WHERE thread_id IN (${ids.map(() => "?").join(",")})`,
      )
      .all(...ids) as { thread_id: string; origin: string }[];
    for (const row of rows) origins.set(row.thread_id, row.origin);
    return origins;
  }

  /** Agents that watch a project now: one row per channel. */
  watchingAgents(project: string, repo: string): WatchingAgent[] {
    return this.database
      .prepare(
        `SELECT c.channel,c.label,
          CASE WHEN SUM(a.state='waiting')>0 THEN 'waiting' ELSE 'working' END AS state,
          COALESCE(MIN(CASE WHEN a.state='waiting' THEN a.since END),MIN(a.since)) AS since
        FROM local_agents a JOIN local_channels c ON c.channel=a.channel
        WHERE c.project=? AND c.repo=? AND a.last_seen>?
        GROUP BY c.channel ORDER BY c.label,c.channel`,
      )
      .all(project, repo, Date.now() - presenceWindow)
      .map((row) => ({ ...row }) as WatchingAgent);
  }

  /** Mark an agent session present in a state. Call every 5 s while it runs. */
  heartbeat(session: string, channel: string, state: WatchingAgent["state"]) {
    const now = Date.now();
    this.database
      .prepare(
        `INSERT INTO local_agents(session,channel,pid,state,since,last_seen) VALUES(?,?,?,?,?,?)
        ON CONFLICT(session) DO UPDATE SET
          since=CASE WHEN state=excluded.state AND channel=excluded.channel THEN since ELSE excluded.since END,
          channel=excluded.channel,pid=excluded.pid,state=excluded.state,last_seen=excluded.last_seen`,
      )
      .run(session, channel, process.pid, state, now, now);
  }

  /**
   * Keep an agent session present for `ms` more without a heartbeat: the
   * waiter's hand-over to the watch call that follows it.
   */
  linger(session: string, ms: number) {
    this.database
      .prepare(
        "UPDATE local_agents SET last_seen=MAX(last_seen,?) WHERE session=?",
      )
      .run(Date.now() + ms - presenceWindow, session);
  }

  /** Remove an agent session from presence at once. */
  leave(session: string) {
    this.database
      .prepare("DELETE FROM local_agents WHERE session=?")
      .run(session);
  }

  close() {
    this.probe?.close();
    this.database.close();
  }
}

type Json = Record<string, unknown>;

/**
 * An agent in one repository: its scopes, and its guest identity on its
 * channel. Every call goes through the Worker with the guest's session, so the
 * Worker's validation, limits and scope checks all apply.
 */
export class LocalAgent {
  private constructor(
    readonly komo: LocalKomo,
    readonly scope: AgentScope,
    readonly userId: string,
    private readonly token: string,
  ) {}

  /** Resolve the scope from a directory, register it, and sign the agent in. */
  static async open(
    komo: LocalKomo,
    directory: string,
    env: Record<string, string | undefined> = process.env,
  ) {
    const scope = await resolveScope(directory, env);
    komo.registerProject(scope);
    const { userId, token } = await channelGuest(komo, scope);
    return new LocalAgent(komo, scope, userId, token);
  }

  /** Call the Worker in process as this agent. */
  async call(
    method: string,
    path: string,
    branch: string,
    body?: Json,
    query: Record<string, string> = {},
    database?: DatabaseSync,
  ): Promise<Json> {
    return workerCall(this.komo, this.scope, method, path, {
      branch,
      body,
      query,
      token: this.token,
      database,
    });
  }

  /** One thread in one of this agent's scopes, read through the Worker. */
  async fetchThread(
    threadId: string,
    branch: string,
  ): Promise<Thread | undefined> {
    const { threads } = (await this.call("GET", "/threads", branch, undefined, {
      id: threadId,
    })) as { threads: Thread[] };
    return threads[0];
  }

  /** The scope branch of a thread, when it lies in one of this agent's scopes. */
  branchOf(
    threadId: string,
    database: DatabaseSync = this.komo.database,
  ): string {
    const row = database
      .prepare("SELECT project,repo,branch FROM threads WHERE id=?")
      .get(threadId) as
      | { project: string; repo: string; branch: string }
      | undefined;
    if (
      !row ||
      row.project !== this.scope.project ||
      row.repo !== this.scope.repo ||
      (row.branch !== this.scope.channel && row.branch !== this.scope.branch)
    )
      throw Error(`Thread ${threadId} is not in this agent's scope.`);
    return row.branch;
  }

  /** One thread, with the page origin it came from when known. */
  async thread(threadId: string) {
    const branch = this.branchOf(threadId);
    const thread = await this.fetchThread(threadId, branch);
    if (!thread) throw Error(`Thread ${threadId} was not found.`);
    const origin = this.komo.threadOrigins([threadId]).get(threadId);
    return {
      ...thread,
      branch,
      origin,
      url: origin ? `${origin}${thread.page}` : undefined,
    };
  }

  /** The thread's latest human activity, as a claim key; null with none. */
  activityOf(threadId: string, database: DatabaseSync = this.komo.database) {
    const [row] = activity(database, {
      project: this.scope.project,
      repo: this.scope.repo,
      branches: [this.branchOf(threadId, database)],
      threadId,
    });
    return { key: row?.key ?? null, held: !!row?.held };
  }

  /**
   * The thread without text that waits for Send: on an agent channel, drop
   * each human message whose newest write is after the channel's last Send.
   * An agent never reads a note before the person sends it.
   */
  released<T extends Thread | undefined>(thread: T): T {
    if (!thread) return thread;
    const [row] = activity(this.komo.database, {
      project: this.scope.project,
      repo: this.scope.repo,
      branches: [this.branchOf(thread.id)],
      threadId: thread.id,
    });
    const sentRevision = row?.sentRevision;
    if (
      sentRevision === null ||
      sentRevision === undefined ||
      !thread.comments.length
    )
      return thread;
    const agents = this.komo.agentUsers(this.scope.project);
    const revisions = new Map(
      (
        this.komo.database
          .prepare(
            `SELECT comment_id,revision FROM local_comment_revisions WHERE comment_id IN (${thread.comments.map(() => "?").join(",")})`,
          )
          .all(...thread.comments.map((comment) => comment.id)) as {
          comment_id: string;
          revision: number;
        }[]
      ).map(({ comment_id, revision }) => [comment_id, revision]),
    );
    return {
      ...thread,
      comments: thread.comments.filter(
        (comment) =>
          agents.has(comment.author.id) ||
          (revisions.get(comment.id) ?? Infinity) <= sentRevision,
      ),
    };
  }

  /**
   * The edit guard's verdict, read and applied in one store transaction:
   * - `taken`: another holder has a live claim on the thread;
   * - `held`: the newest human activity waits for Send. The claim stays, so
   *   the thread returns to this holder after Send;
   * - `deleted`: the person deleted the note the caller received. Its claim
   *   is released;
   * - `changed`: human activity the caller has not received. The claim moves
   *   to this holder at the current version, which counts as received;
   * - `pass`: the caller received the current version, or there is no human
   *   activity at all.
   * The caller's version is `received`, else the version of its own claim.
   */
  private verdict(
    threadId: string,
    holder: Holder,
    received?: string,
    db = this.komo.database,
  ) {
    const ownsTransaction = db === this.komo.database;
    if (ownsTransaction) db.exec("BEGIN IMMEDIATE");
    try {
      const { key, held } = this.activityOf(threadId, db);
      const { row, live } = claimOf(this.komo, threadId, db);
      const mine = row?.holder_session === holder.session;
      const known = received ?? (mine ? row!.claim_key : undefined);
      let code: "pass" | "taken" | "held" | "deleted" | "changed";
      if (live && !mine) code = "taken";
      else if (held) code = "held";
      else if (key === null) code = known === undefined ? "pass" : "deleted";
      else code = known === key ? "pass" : "changed";
      if (
        code === "changed" &&
        key !== null &&
        known?.startsWith(`${threadId}:`)
      ) {
        const commentId = known.slice(threadId.length + 1).split(":")[0];
        const previous = db
          .prepare(
            `SELECT c.body,r.revision FROM comments c
          JOIN local_comment_revisions r ON r.comment_id=c.id
          WHERE c.id=? AND c.thread_id=?`,
          )
          .get(commentId, threadId) as
          | { body: string; revision: number }
          | undefined;
        // A removed follow-up cannot make an older human note look new. A
        // later human write has a greater revision and still reports changed.
        if (
          previous?.body === tombstone &&
          Number(key.slice(key.lastIndexOf(":") + 1)) < previous.revision
        )
          code = "deleted";
      }
      if (code === "deleted" && mine)
        db.prepare(
          "DELETE FROM local_claims WHERE thread_id=? AND holder_session=?",
        ).run(threadId, holder.session);
      if (code === "changed")
        db.prepare(
          "INSERT OR REPLACE INTO local_claims(thread_id,claim_key,holder_session,holder_pid,expires_at) VALUES(?,?,?,?,?)",
        ).run(
          threadId,
          key,
          holder.session,
          holder.pid,
          Date.now() + claimLease,
        );
      if (ownsTransaction) db.exec("COMMIT");
      return { code, key };
    } catch (error) {
      if (ownsTransaction) {
        try {
          db.exec("ROLLBACK");
        } catch {}
      }
      throw error;
    }
  }

  /**
   * The edit guard. A reply or a resolve ends a thread's wait for an agent,
   * so it must not pass over a human message the caller has not received.
   * Returns the version it checked. Otherwise throws a 409 with a `code`; only
   * `changed` carries the thread (all of it sent) and its `version`.
   */
  async checkCurrent(threadId: string, holder: Holder, received?: string) {
    const { code, key } = this.verdict(threadId, holder, received);
    if (code === "pass") return key;
    const messages = {
      taken: `Another agent now works on thread ${threadId}. Nothing was posted. Stop work on it.`,
      held: `Thread ${threadId} has a message or edit that the person has not sent yet. Nothing was posted and the thread is unchanged. Stop work on it and keep your claim: the watch returns it to you after the person presses Send.`,
      deleted: `The person deleted the note in thread ${threadId}. Nothing was posted, and your claim is released. Drop the work on it; do not resolve or reply.`,
      changed: `Thread ${threadId} has a message or edit from a person that you have not received. Nothing was posted and the thread is unchanged. The thread stays yours: read the current thread below, redo the work against it, then resolve or reply again.`,
    };
    const error = Object.assign(Error(messages[code]), { status: 409, code });
    if (code !== "changed") throw error;
    const thread = await this.thread(threadId);
    throw Object.assign(error, {
      version: key,
      thread: formatThread(this, {
        thread: this.released(thread),
        branch: thread.branch,
        origin: thread.origin,
      }),
    });
  }

  /**
   * Check and write under one SQLite lock. The private connection avoids
   * interleaving a Worker batch with requests on the serving connection.
   * Every Worker route still checks auth, scope, validation and rate limits.
   */
  private async guardedAction<T>(
    threadId: string,
    holder: Holder,
    received: string | undefined,
    action: (database: DatabaseSync) => Promise<T>,
  ): Promise<T> {
    const key = await this.checkCurrent(threadId, holder, received);
    const outcome = await this.komo.exclusive(async () => {
      const database = openProbe(this.komo.path);
      let conflict = false;
      let result: T | undefined;
      let began = false;
      try {
        database.exec("PRAGMA foreign_keys=ON");
        database.exec("BEGIN IMMEDIATE");
        began = true;
        const verdict = this.verdict(
          threadId,
          holder,
          key ?? received,
          database,
        );
        if (verdict.code === "pass") result = await action(database);
        else conflict = true;
        database.exec("COMMIT");
        began = false;
      } catch (error) {
        if (began) {
          try {
            database.exec("ROLLBACK");
          } catch {}
        }
        throw error;
      } finally {
        database.close();
      }
      return { conflict, result };
    });
    if (outcome.conflict) {
      await this.checkCurrent(threadId, holder, key ?? received);
      throw Object.assign(
        Error(`Thread ${threadId} changed. Nothing was posted. Call again.`),
        {
          status: 409,
          code: "retry",
        },
      );
    }
    return outcome.result as T;
  }

  /** Reply without leaving a deleted-comment marker after a failed guard. */
  async reply(
    threadId: string,
    body: string,
    holder: Holder,
    received?: string,
  ) {
    const branch = this.branchOf(threadId);
    return this.guardedAction(threadId, holder, received, async (database) => {
      const { id } = (await this.call(
        "POST",
        `/threads/${threadId}/comments`,
        branch,
        { body },
        {},
        database,
      )) as { id: string };
      return { id };
    });
  }

  /** Resolve, post the optional summary and release the claim as one action. */
  async resolve(
    threadId: string,
    summary: string | undefined,
    holder: Holder,
    received?: string,
  ) {
    const branch = this.branchOf(threadId);
    return this.guardedAction(threadId, holder, received, async (database) => {
      await this.call(
        "PATCH",
        `/threads/${threadId}`,
        branch,
        { resolved: true },
        {},
        database,
      );
      if (summary?.trim())
        await this.call(
          "POST",
          `/threads/${threadId}/comments`,
          branch,
          { body: summary },
          {},
          database,
        );
      database
        .prepare("DELETE FROM local_claims WHERE thread_id=?")
        .run(threadId);
      return { ok: true };
    });
  }

  async reopen(threadId: string) {
    return this.call("PATCH", `/threads/${threadId}`, this.branchOf(threadId), {
      resolved: false,
    });
  }
}

async function workerCall(
  komo: LocalKomo,
  scope: AgentScope,
  method: string,
  path: string,
  options: {
    branch?: string;
    body?: Json;
    query?: Record<string, string>;
    token?: string;
    database?: DatabaseSync;
  },
): Promise<Json> {
  const url = new URL(path, "http://127.0.0.1");
  url.searchParams.set("project", scope.project);
  url.searchParams.set("repo", scope.repo);
  if (options.branch) url.searchParams.set("branch", options.branch);
  for (const [key, value] of Object.entries(options.query ?? {}))
    url.searchParams.set(key, value);
  const headers = new Headers({
    Origin: agentOrigin,
    // Each agent channel gets its own rate-limit bucket.
    "CF-Connecting-IP": `agent:${scope.channel}`,
  });
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  if (options.body) headers.set("Content-Type", "application/json");
  const response = await komo.fetch(
    new Request(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    }),
    true,
    options.database,
  );
  const data = (await response.json().catch(() => ({}))) as Json;
  if (!response.ok)
    throw Object.assign(
      Error(
        typeof data.error === "string"
          ? data.error
          : `komo answered ${response.status}.`,
      ),
      { status: response.status },
    );
  return data;
}

const sessionDays = 30;

/**
 * The channel's guest: `Agent · <label>`, created once through the Worker and
 * kept in local_channels. Its session is renewed here, so the agent keeps one
 * identity and its own notes stay recognisable as its own.
 */
async function channelGuest(komo: LocalKomo, scope: AgentScope) {
  const db = komo.database,
    now = Date.now();
  db.prepare(
    "INSERT INTO local_channels(channel,project,repo,label,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(channel) DO UPDATE SET label=excluded.label,updated_at=excluded.updated_at",
  ).run(scope.channel, scope.project, scope.repo, scope.label, now);
  const read = () =>
    db
      .prepare("SELECT user_id,token FROM local_channels WHERE channel=?")
      .get(scope.channel) as { user_id: string | null; token: string | null };
  let channel = read();
  if (channel.user_id && channel.token) {
    const user = db
      .prepare("SELECT 1 FROM users WHERE id=?")
      .get(channel.user_id);
    if (user) {
      db.prepare(
        "INSERT INTO sessions(token_hash,user_id,project,expires_at) VALUES(?,?,?,?) ON CONFLICT(token_hash) DO UPDATE SET expires_at=excluded.expires_at",
      ).run(
        createHash("sha256").update(channel.token).digest("hex"),
        channel.user_id,
        scope.project,
        now + sessionDays * 86400000,
      );
      return { userId: channel.user_id, token: channel.token };
    }
  }
  const name = `Agent · ${scope.label}`.slice(0, 60);
  const guest = (await workerCall(komo, scope, "POST", "/auth/guest", {
    body: { name },
  })) as { token: string; user: { id: string } };
  // Two sessions in one worktree may race here: replace only the token this
  // process read, so the first new guest stays.
  db.prepare(
    "UPDATE local_channels SET user_id=?,token=? WHERE channel=? AND token IS ?",
  ).run(guest.user.id, guest.token, scope.channel, channel.token);
  channel = read();
  return { userId: channel.user_id!, token: channel.token! };
}

export type LocalServer = {
  komo: LocalKomo;
  listener: Listener;
  close(): Promise<void>;
};

/**
 * Open the store and serve it on the loopback port. A process that finds the
 * port taken stands by and takes it over when the owner exits. The owner runs
 * the Worker's cleanup every hour.
 */
export function startLocal(
  options: {
    komo?: LocalKomo;
    port?: number;
    log?: (line: string) => void;
  } = {},
): LocalServer {
  const komo = options.komo ?? new LocalKomo();
  const log = options.log ?? ((line: string) => console.error(line));
  const cleanup = () =>
    komo
      .scheduled()
      .catch((error) =>
        log(`[komo local] Cleanup failed: ${(error as Error).message}`),
      );
  const listener = listen(komo, options.port ?? localPort(), log, cleanup);
  const timer = setInterval(() => {
    if (listener.serving) cleanup();
  }, hour);
  return {
    komo,
    listener,
    async close() {
      clearInterval(timer);
      await listener.close();
      await komo.settle();
    },
  };
}

function ranDirectly() {
  try {
    return (
      !!process.argv[1] &&
      import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
    );
  } catch {
    return false;
  }
}

// `node dist/local.mjs` runs the local server in the foreground.
if (ranDirectly()) {
  const server = startLocal();
  console.error(`[komo local] Store: ${server.komo.path}`);
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      server.close().finally(() => {
        server.komo.close();
        process.exit(0);
      });
    });
}
