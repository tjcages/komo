import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LocalAgent,
  LocalKomo,
  Presence,
  formatThread,
  handOver,
  localPort,
  parseOrigins,
  resolveScope,
  startLocal,
  storePath,
  waitForNotes,
  waiterPresence,
  watch,
} from "../dist/local.mjs";

export { handOver };

/** How long a reading of the serving process's Send support holds. */
const probeEvery = 5000;

// Local agent mode for one agent process: `komo mcp` keeps one for its life,
// and `komo comments ... --local` uses one per command. Every call works on
// the shared store in process, so no tool depends on the process that holds
// the loopback port.

function number(value, fallback, min, max, name) {
  if (value === undefined || value === null) return fallback;
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed))
    throw Error(`${name} must be a number from ${min} to ${max}.`);
  if (parsed < min || parsed > max)
    throw Error(`${name} must be from ${min} to ${max}.`);
  return parsed;
}
function threadId(value) {
  if (typeof value !== "string" || !/^[\w-]{1,100}$/.test(value))
    throw Error("Supply a valid threadId.");
  return value;
}
function text(value, name, optional = false) {
  if (optional && (value === undefined || value === null || value === ""))
    return undefined;
  if (typeof value !== "string" || !value.trim() || value.length > 4000)
    throw Error(`Supply a nonempty ${name} of at most 4,000 characters.`);
  return value.trim();
}
/** One shell word, quoted only when it needs to be. */
function shellWord(value) {
  return /^[\w@%+=:,./-]+$/.test(value)
    ? value
    : `'${value.replaceAll("'", "'\\''")}'`;
}

/**
 * Environment that decides an agent's store, port and scope, passed on to the
 * waiter. The port names the process whose Send support the waiter checks.
 */
const scopeEnv = [
  "KOMO_DATA_HOME",
  "KOMO_LOCAL_PORT",
  "KOMO_PROJECT",
  "KOMO_REPO",
  "KOMO_BRANCH",
];

/** A version from `get` or `watch` output: `thread:comment:time`. */
function versionValue(value) {
  if (value === undefined || value === null) return undefined;
  if (
    typeof value !== "string" ||
    !/^[\w-]{1,100}:[\w-]{1,100}:\d{1,16}$/.test(value)
  )
    throw Error("version must be the version that get or watch printed.");
  return value;
}
/** The holder a waiter counts notes for: the MCP session that runs it. */
function holderValue(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !/^(mcp|cli):[\w-]{1,100}$/.test(value))
    throw Error("holder must be the holder that komo_status printed.");
  return value;
}

function directoryValue(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !value || value.length > 4096)
    throw Error("directory must be a path.");
  return value;
}

export class LocalSession {
  #komo;
  #server;
  #presence;
  #directory;
  #scope;
  /** The version of each thread this session last read, for the edit guard. */
  #received = new Map();
  #kind;
  /** The last reading of whether the process on the port can Send. */
  #probe;

  /**
   * @param {{cwd?: string, env?: Record<string, string|undefined>, pid?: number, log?: (line: string) => void}} options
   * `pid` 0 holds claims by their lease only: a CLI process ends after one
   * command, and its claims must outlive it. `kind` names the session in the
   * store. Every `cli` command in one worktree holds claims as one holder,
   * `cli:<channel>`, so a later command resolves what an earlier one claimed.
   */
  constructor({
    cwd = process.cwd(),
    env = process.env,
    pid = process.pid,
    kind = pid ? "mcp" : "cli",
    log = (line) => process.stderr.write(`${line}\n`),
  } = {}) {
    this.cwd = cwd;
    this.env = env;
    this.log = log;
    this.#kind = kind;
    this.holder = { session: `${kind}:${randomUUID()}`, pid };
  }

  get komo() {
    return (this.#komo ??= new LocalKomo(storePath(this.env)));
  }

  /** The scopes of the last agent this session opened. */
  get scope() {
    return this.#scope;
  }

  /** Serve the store on the loopback port, or stand by to take it over. */
  async serve() {
    this.#server ??= startLocal({
      komo: this.komo,
      port: localPort(this.env),
      log: this.log,
    });
    await this.#server.listener.settled;
    return this.#server.listener;
  }

  /**
   * At launch: when the directory lies in a komo project, register it and
   * serve, so pages can leave notes before any agent watches. Elsewhere, stay
   * idle and open nothing.
   */
  async start() {
    try {
      const scope = await resolveScope(this.cwd, this.env);
      this.komo.registerProject(scope);
    } catch (error) {
      if (!error.message.startsWith("No .komo/project.json"))
        this.log(`[komo local] ${error.message}`);
      return false;
    }
    await this.serve();
    return true;
  }

  /** The agent for a directory: the given one, else the last used, else the launch directory. */
  async agent(directory) {
    const target = resolve(
      this.cwd,
      directoryValue(directory) ?? this.#directory ?? this.cwd,
    );
    const agent = await LocalAgent.open(this.komo, target, this.env);
    if (this.#kind === "cli")
      this.holder.session = `cli:${agent.scope.channel}`;
    this.#directory = target;
    this.#scope = {
      project: agent.scope.project,
      repo: agent.scope.repo,
      channel: agent.scope.channel,
      label: agent.scope.label,
      branch: agent.scope.branch,
    };
    return agent;
  }

  /**
   * The exact command that waits for this agent's notes without claiming
   * them: this Node.js, this CLI, the agent's directory, and the store, scope
   * and origin settings of this session, so it and komo_watch agree.
   */
  waiterCommand(origins, directory) {
    const words = [
      process.execPath,
      fileURLToPath(new URL("./index.mjs", import.meta.url)),
      "comments",
      "wait",
      "--local",
      "--directory",
      directory,
      "--holder",
      this.holder.session,
    ];
    if (origins) words.push("--origins", origins.join(","));
    const env = scopeEnv
      .filter((name) => this.env[name])
      .map((name) => `${name}=${shellWord(this.env[name])}`);
    return [
      ...(env.length ? ["env", ...env] : []),
      ...words.map(shellWord),
    ].join(" ");
  }

  async status(args = {}) {
    const agent = await this.agent(args.directory);
    const origins = parseOrigins(args.origins ?? this.env.KOMO_AGENT_ORIGINS);
    const scope = this.#scope;
    const directory = this.#directory;
    const listener = await this.serve();
    const endpoint = `http://127.0.0.1:${listener.port}`;
    const send = await this.#releaseUnsendable(agent);
    const groups = this.komo.project(agent.scope.project)?.originGroups;
    return {
      scope,
      name: `Agent · ${agent.scope.label}`,
      endpoint,
      serving: listener.serving,
      send,
      ...(send === false && {
        warning: `The process on port ${listener.port} runs an older komo without Send. Notes to "${agent.scope.label}" reach this agent without Send until a newer komo serves the port.`,
      }),
      pages:
        groups?.length === 1 ? groups[0] : (groups ?? [agent.scope.origins]),
      origins: origins ?? null,
      watching: this.komo.watchingAgents(agent.scope.project, agent.scope.repo),
      hint: `Leave notes on a page whose origin matches pages, then pick "${agent.scope.label}" in the komo dock's Send to menu. Notes to "${agent.scope.label}" wait until the person presses Send in the dock. A komo client whose endpoint is ${endpoint} reaches this agent on branch "${agent.scope.branch}", where notes need no Send.`,
      waiter: this.waiterCommand(origins, directory),
    };
  }

  async watch(args = {}, signal) {
    const agent = await this.agent(args.directory);
    const origins = parseOrigins(args.origins ?? this.env.KOMO_AGENT_ORIGINS);
    const timeout = number(args.timeoutSeconds, 300, 1, 300, "timeoutSeconds");
    const batch = number(
      args.batchWindowSeconds,
      3,
      0,
      60,
      "batchWindowSeconds",
    );
    await this.serve();
    this.#presence ??= new Presence(this.komo, this.holder.session, this.log);
    this.#presence.begin(agent.scope.channel);
    const releasing = this.#releasing(agent);
    try {
      await releasing.first;
      return await watch(agent, {
        holder: this.holder,
        timeoutMs: timeout * 1000,
        batchMs: batch * 1000,
        origins,
        signal,
        received: this.#received,
      });
    } finally {
      releasing.stop();
      this.#presence.end();
    }
  }

  /**
   * Block, without claiming, until a note waits for this agent, and return
   * the count. It counts the notes that `holder` may take: the MCP session
   * that runs it, else this worktree's CLI commands. The agent shows as
   * waiting in the dock meanwhile.
   */
  async wait(args = {}, signal) {
    const agent = await this.agent(args.directory);
    const origins = parseOrigins(args.origins ?? this.env.KOMO_AGENT_ORIGINS);
    const holder = {
      session: holderValue(args.holder) ?? `cli:${agent.scope.channel}`,
      pid: 0,
    };
    // The waiter's presence is named after its holder, so the holder's next
    // watch call takes it over.
    this.#presence ??= new Presence(
      this.komo,
      waiterPresence(holder.session),
      this.log,
    );
    this.#presence.begin(agent.scope.channel);
    const releasing = this.#releasing(agent);
    try {
      await releasing.first;
      return await waitForNotes(agent, { holder, origins, signal });
    } finally {
      releasing.stop();
    }
  }

  /**
   * Whether the process that serves the port holds notes for Send and can
   * release them: this process when it serves; else the `send` flag of the
   * serving process's health, which an older komo lacks. Null when no komo
   * answers. Never binds the port, so a waiter stays a waiter.
   */
  async #sendable() {
    if (this.#server?.listener.serving) return true;
    const now = Date.now();
    if (this.#probe && now - this.#probe.at < probeEvery)
      return this.#probe.value;
    let value = null;
    try {
      const response = await fetch(
        `http://127.0.0.1:${localPort(this.env)}/local/health`,
        {
          signal: AbortSignal.timeout(1000),
        },
      );
      const body = response.ok ? await response.json() : undefined;
      if (body?.local === true) value = body.send === true;
    } catch {}
    this.#probe = { at: now, value };
    return value;
  }

  /**
   * An older komo on the port has no Send, so the dock cannot release notes
   * held on this agent's channel. Treat them as sent: move the channel's
   * Send watermark forward. Returns what #sendable read.
   */
  async #releaseUnsendable(agent) {
    const sendable = await this.#sendable();
    if (sendable !== false) return sendable;
    const { project, repo, channel } = agent.scope;
    if (this.komo.sendCounts(project, repo, channel).held)
      await this.komo.releaseHeld(project, repo, channel);
    return sendable;
  }

  /** Run #releaseUnsendable now and every second until stopped. */
  #releasing(agent) {
    let busy = false,
      failed = "";
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        await this.#releaseUnsendable(agent);
      } catch (error) {
        // A busy store passes; the next tick tries again.
        if (
          error.message !== failed &&
          !/SQLITE_BUSY|database is locked/i.test(error.message)
        )
          this.log(
            `[komo local] Could not check Send support: ${error.message}`,
          );
        failed = error.message;
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(tick, 1000);
    timer.unref?.();
    return { first: tick(), stop: () => clearInterval(timer) };
  }

  /**
   * A thread as it is now, without text that waits for Send. Reading a sent
   * version counts as receiving it, and moves this session's claim to it.
   * `version` is null while the thread waits for Send.
   */
  async get(args = {}) {
    const agent = await this.agent(args.directory);
    const id = threadId(args.threadId);
    await this.#releaseUnsendable(agent);
    // Read the version first: an edit that lands during the read fails the
    // guard, rather than passing unread.
    const { key, held } = agent.activityOf(id);
    const thread = await agent.thread(id);
    if (key && !held) {
      this.#received.set(id, key);
      this.komo.database
        .prepare(
          "UPDATE local_claims SET claim_key=? WHERE thread_id=? AND holder_session=?",
        )
        .run(key, id, this.holder.session);
    }
    return {
      ...formatThread(agent, {
        thread: agent.released(thread),
        branch: thread.branch,
        origin: thread.origin,
      }),
      version: held ? null : key,
      held,
    };
  }

  /**
   * Run the edit guard's action with the version the caller received: the
   * `version` argument, else the last one this session read. A thread that
   * changed comes back in the error, which counts as receiving it, so the
   * redone work passes.
   */
  async #guarded(id, version, action) {
    try {
      return await action(versionValue(version) ?? this.#received.get(id));
    } catch (error) {
      if (error.code === "changed" && error.version)
        this.#received.set(id, error.version);
      else if (error.code === "deleted" || error.code === "taken")
        this.#received.delete(id);
      throw error;
    }
  }

  async reply(args = {}) {
    const agent = await this.agent(args.directory);
    const id = threadId(args.threadId);
    const body = text(args.body, "body");
    await this.#releaseUnsendable(agent);
    await this.#guarded(id, args.version, (received) =>
      agent.reply(id, body, this.holder, received),
    );
    return { threadId: id, replied: true, resolved: false };
  }

  async resolve(args = {}) {
    const agent = await this.agent(args.directory);
    const id = threadId(args.threadId);
    const summary = text(args.summary, "summary", true);
    await this.#releaseUnsendable(agent);
    await this.#guarded(id, args.version, (received) =>
      agent.resolve(id, summary, this.holder, received),
    );
    this.#received.delete(id);
    return { threadId: id, resolved: true };
  }

  async reopen(args = {}) {
    const agent = await this.agent(args.directory);
    const id = threadId(args.threadId);
    await agent.reopen(id);
    return { threadId: id, resolved: false };
  }

  /**
   * Stop presence, give up the port, and close the store. Without `leave`,
   * presence shows for the presence window, or for `linger` ms.
   */
  async close({ leave = true, linger = 0 } = {}) {
    this.#presence?.stop(leave, linger);
    await this.#server?.close();
    this.#komo?.close();
  }
}
