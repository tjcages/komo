import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { originAllowed } from "../validation";
import type { LocalKomo } from "./index";
import { isLoopbackHostname } from "./scope";

// The loopback HTTP adapter: Node's http server in front of the unchanged
// Worker. Every comment is an instruction to a coding agent, so the server
// serves this machine only:
// - it binds 127.0.0.1 and then ::1, never a wildcard address;
// - Host must name this machine, so a DNS-rebinding page is refused;
// - Origin, when present, must be an http(s) page on this machine, and
//   `Origin: null` is refused;
// - a refusal is a 403 before any route runs, preflight included.
// The Worker's own per-project origin check is the second gate.

export const defaultPort = 4848;
const maxBody = 64 * 1024;

type Log = (line: string) => void;

/** KOMO_LOCAL_PORT, else 4848. */
export function localPort(
  env: Record<string, string | undefined> = process.env,
) {
  if (!env.KOMO_LOCAL_PORT) return defaultPort;
  const port = Number(env.KOMO_LOCAL_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Error("KOMO_LOCAL_PORT must be a port number from 1 to 65535.");
  return port;
}

/** Why a request did not come from this machine, or null when it did. */
export function refuseNonLocal(req: IncomingMessage): string | null {
  try {
    if (
      !isLoopbackHostname(new URL(`http://${req.headers.host ?? ""}`).hostname)
    )
      return "Host not allowed";
  } catch {
    return "Host not allowed";
  }
  const origin = req.headers.origin;
  if (origin === undefined) return null;
  try {
    const url = new URL(origin);
    const web = url.protocol === "http:" || url.protocol === "https:";
    return web && isLoopbackHostname(url.hostname)
      ? null
      : "Origin not allowed";
  } catch {
    return "Origin not allowed";
  }
}

function send(
  res: ServerResponse,
  status: number,
  data: unknown,
  headers: Record<string, string> = {},
) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    ...headers,
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

/** Refuse a request body over the cap, then drop the connection. */
function tooLarge(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Connection", "close");
  send(res, 413, { error: "Request too large." });
  res.once("finish", () => req.destroy());
}

/** The body, or null when it passes the cap. Reads nothing past the cap. */
function readBody(req: IncomingMessage): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const parts: Buffer[] = [];
    let length = 0,
      done = false;
    req.on("data", (chunk: Buffer) => {
      if (done) return;
      length += chunk.length;
      if (length > maxBody) {
        done = true;
        req.pause();
        return resolve(null);
      }
      parts.push(chunk);
    });
    req.on("end", () => {
      if (!done) resolve(Buffer.concat(parts));
    });
    req.on("error", reject);
  });
}

const hopHeaders = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "content-length",
  "cf-connecting-ip",
]);

/**
 * GET /local/health, GET /local/agents, and batch Send on an agent channel:
 * GET /local/pending counts the notes held for Send, and POST /local/send
 * releases them. Every route but health answers only the pages the project
 * serves.
 */
async function localRoute(
  komo: LocalKomo,
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
) {
  const origin = req.headers.origin;
  if (url.pathname === "/local/health") {
    if (req.method !== "GET")
      return send(res, 405, { error: "Method not allowed." });
    // `send` tells a standing-by process that this one holds notes for Send
    // and serves the routes that release them. An older komo omits it.
    return send(
      res,
      200,
      { ok: true, local: true, send: true },
      origin ? { "Access-Control-Allow-Origin": origin } : {},
    );
  }
  const method = {
    "/local/agents": "GET",
    "/local/pending": "GET",
    "/local/send": "POST",
  }[url.pathname];
  if (!method) return send(res, 404, { error: "Not found." });
  const cors = {
    "Access-Control-Allow-Origin": origin ?? "",
    "Access-Control-Allow-Methods": `${method}, OPTIONS`,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "600",
  };
  // A preflight names no project: the send route carries its scope in the
  // body. It reveals nothing, and the request after it meets every gate.
  if (req.method === "OPTIONS") {
    if (!origin) return send(res, 403, { error: "Origin required." });
    res.writeHead(204, cors);
    return res.end();
  }
  let fields: Record<string, unknown> = Object.fromEntries(url.searchParams);
  if (method === "POST" && req.method === "POST") {
    const bytes = await readBody(req);
    if (!bytes) return tooLarge(req, res);
    try {
      const body = JSON.parse(bytes.toString("utf8"));
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw Error();
      fields = body;
    } catch {
      return send(res, 400, {
        error: "Send a JSON object with project, repo and branch.",
      });
    }
  }
  const scope = {
    project: typeof fields.project === "string" ? fields.project : "",
    repo: typeof fields.repo === "string" ? fields.repo : "",
    branch: typeof fields.branch === "string" ? fields.branch : "",
  };
  if (!scope.project || scope.project.length > 100)
    return send(res, 400, { error: "Invalid project." });
  const config = komo.project(scope.project);
  if (!config) return send(res, 404, { error: "Unknown comments project." });
  // Presence and the Send state are visible only to the pages this project
  // serves.
  if (
    !origin ||
    !config.originGroups.every((patterns) => originAllowed(origin, patterns))
  )
    return send(res, 403, {
      error: "This site is not approved for this komo project.",
      code: "site_not_approved",
    });
  if (req.method !== method)
    return send(res, 405, { error: "Method not allowed." }, cors);
  if (scope.repo && scope.repo !== scope.project && scope.repo !== config.repo)
    return send(
      res,
      403,
      { error: "Repository does not match this project." },
      cors,
    );
  if (url.pathname === "/local/agents")
    return send(
      res,
      200,
      { agents: komo.watchingAgents(scope.project, config.repo) },
      cors,
    );
  if (!scope.branch || scope.branch.length > 200)
    return send(res, 400, { error: "Invalid branch." }, cors);
  if (url.pathname === "/local/pending")
    return send(
      res,
      200,
      komo.sendCounts(scope.project, config.repo, scope.branch),
      cors,
    );
  // Only an agent channel holds notes. A stock client's branch has no Send.
  if (!komo.isAgentChannel(scope.project, config.repo, scope.branch))
    return send(
      res,
      404,
      {
        error: "This branch is not an agent's channel.",
        code: "not_agent_channel",
      },
      cors,
    );
  return send(
    res,
    200,
    await komo.send(scope.project, config.repo, scope.branch),
    cors,
  );
}

async function forward(
  komo: LocalKomo,
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
) {
  const method = req.method ?? "GET";
  let body: Buffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const read = await readBody(req);
    if (!read) return tooLarge(req, res);
    body = read.length ? read : undefined;
  }
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined || hopHeaders.has(name)) continue;
    for (const item of Array.isArray(value) ? value : [value])
      headers.append(name, item);
  }
  // The Worker keys rate limits by this header. Set it here so a page cannot
  // choose its own bucket; each page origin gets one.
  const origin = req.headers.origin;
  headers.set("CF-Connecting-IP", `loopback:${origin ?? "none"}`);
  const response = await komo.fetch(
    new Request(url, { method, headers, body: body && new Uint8Array(body) }),
  );
  const bytes = Buffer.from(await response.arrayBuffer());
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.setHeader("Content-Length", bytes.length);
  res.writeHead(response.status);
  res.end(method === "HEAD" ? undefined : bytes);
}

/** The request handler, with every gate in front of the Worker. */
export function handler(komo: LocalKomo, log: Log) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      res.setHeader("Vary", "Origin");
      // Refuse anything from off this machine before any route runs, and
      // before the path is parsed.
      const refusal = refuseNonLocal(req);
      if (refusal) {
        log(
          `[komo local] Refused ${req.method} ${req.url}: ${refusal} (host ${req.headers.host}, origin ${req.headers.origin ?? "none"})`,
        );
        return send(res, 403, { error: refusal });
      }
      const length = Number(req.headers["content-length"] ?? 0);
      if (length > maxBody) return tooLarge(req, res);
      let url: URL;
      try {
        if (!req.url?.startsWith("/") || req.url.startsWith("//"))
          throw Error();
        url = new URL(req.url, `http://${req.headers.host}`);
      } catch {
        return send(res, 400, { error: "Bad request." });
      }
      if (url.pathname.startsWith("/local/"))
        return await localRoute(komo, req, res, url);
      await forward(komo, req, res, url);
    } catch (error) {
      log(
        `[komo local] ${req.method} ${req.url} failed: ${(error as Error)?.message ?? error}`,
      );
      if (res.headersSent) return res.destroy();
      send(res, 500, {
        error: "Comments are temporarily unavailable. Try again.",
      });
    }
  };
}

export type Listener = {
  readonly port: number;
  /** Whether this process holds the port. */
  readonly serving: boolean;
  /** Settles once the first attempt has served or stood by. */
  readonly settled: Promise<void>;
  close(): Promise<void>;
};

/**
 * Serve on 127.0.0.1 and ::1. When another process holds the port, stand by
 * and try again every 5 s, so the next process takes over when the owner
 * exits. Never falls back to another port.
 */
export function listen(
  komo: LocalKomo,
  port: number,
  log: Log,
  onServe: () => void = () => {},
): Listener {
  const serve = handler(komo, log);
  const servers: Server[] = [];
  let timer: NodeJS.Timeout | undefined,
    closed = false,
    serving = false,
    waiting = "",
    settle = () => {};
  const settled = new Promise<void>((resolve) => (settle = resolve));
  const server = () => {
    const created = createServer(serve);
    created.on("clientError", (_error, socket) => {
      if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
      else socket.destroy();
    });
    return created;
  };
  const attempt = () => {
    if (closed) return;
    const ipv4 = server();
    ipv4.once("error", (error: NodeJS.ErrnoException) => {
      const reason = error.code ?? error.message;
      if (reason !== waiting)
        log(
          reason === "EADDRINUSE"
            ? `[komo local] Port ${port} is in use. Standing by to take it over.`
            : `[komo local] Cannot serve on 127.0.0.1:${port} (${reason}). Trying again.`,
        );
      waiting = reason;
      settle();
      timer = setTimeout(attempt, 5000);
    });
    ipv4.listen(port, "127.0.0.1", () => {
      settle();
      if (closed) return void ipv4.close();
      ipv4.on("error", (error) =>
        log(`[komo local] Server error: ${error.message}`),
      );
      servers.push(ipv4);
      serving = true;
      log(`[komo local] Serving http://127.0.0.1:${port} (loopback only)`);
      // IPv6 joins only once IPv4 is bound, so two processes never split the
      // port between them.
      const ipv6 = server();
      ipv6.once("error", (error: NodeJS.ErrnoException) =>
        log(
          `[komo local] ::1 unavailable (${error.code ?? error.message}). Serving 127.0.0.1 only.`,
        ),
      );
      ipv6.listen(port, "::1", () => {
        if (closed) return void ipv6.close();
        servers.push(ipv6);
      });
      onServe();
    });
  };
  attempt();
  return {
    port,
    get serving() {
      return serving;
    },
    settled,
    async close() {
      settle();
      closed = true;
      serving = false;
      clearTimeout(timer);
      await Promise.all(
        servers.splice(0).map(
          (item) =>
            new Promise<void>((resolve) => {
              item.close(() => resolve());
              item.closeAllConnections();
            }),
        ),
      );
    },
  };
}
