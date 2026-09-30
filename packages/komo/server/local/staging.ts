import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { LocalKomo } from "./index";
import { openProbe } from "./store";
import { sendChannel, sendCounts } from "./activity";

export const queuedBranch = "komo-queued";
const operationPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const channelPattern = /^agent-[0-9a-f]{12}$/;

type Scope = { project: string; repo: string };
type Handoff = { endpoint: string; branch: string; thread: string };
export type StageInput = Scope & {
  operation: string;
  page: string;
  anchor: unknown;
  body: string;
  handoff?: Handoff;
};

export function validateStage(input: StageInput) {
  if (!operationPattern.test(input.operation) || typeof input.page !== "string" ||
      typeof input.body !== "string" || !input.body.trim() || input.body.length > 4000)
    throw Object.assign(Error("A note is too large or incomplete. Shorten it and try again."), { status: 400 });
  if (input.handoff) {
    const { endpoint, branch, thread } = input.handoff;
    let url: URL;
    try { url = new URL(endpoint); } catch { throw Object.assign(Error("Invalid Team thread source."), { status: 400 }); }
    if ((url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) ||
        url.username || url.password || url.search || url.hash || url.href.length > 500 ||
        !branch || branch.length > 200 || !thread || thread.length > 200)
      throw Object.assign(Error("Invalid Team thread source."), { status: 400 });
    input.handoff.endpoint = url.href.replace(/\/$/, "");
  }
}

function count(db: DatabaseSync, scope: Scope) {
  const staged = sendCounts(db, { ...scope, branch: queuedBranch }).held;
  const stagedRows = db.prepare(
    "SELECT COUNT(*) AS count FROM threads WHERE project=? AND repo=? AND branch=? AND resolved=0"
  ).get(scope.project, scope.repo, queuedBranch) as { count: number };
  return Math.max(staged, Number(stagedRows.count));
}

export function pending(db: DatabaseSync, scope: Scope) {
  return { held: count(db, scope) };
}

export function branches(db: DatabaseSync, scope: Scope) {
  const rows = db.prepare("SELECT channel FROM local_channels WHERE project=? AND repo=?").all(scope.project, scope.repo) as { channel: string }[];
  return { branches: [queuedBranch, ...rows.map((row) => row.channel)] };
}

export function handoffs(db: DatabaseSync, scope: Scope, endpoint: string, branch: string) {
  const rows = db.prepare(
    "SELECT hosted_thread AS hostedThread,local_thread AS localThread FROM local_handoffs WHERE project=? AND repo=? AND endpoint=? AND branch=?"
  ).all(scope.project, scope.repo, endpoint, branch) as { hostedThread: string; localThread: string }[];
  return { handoffs: rows };
}

export async function stage(komo: LocalKomo, input: StageInput, origin: string, token: string | undefined) {
  validateStage(input);
  if (!token?.startsWith("Bearer "))
    throw Object.assign(Error("Sign in to the local service and try again."), { status: 401 });
  const hash = createHash("sha256").update(JSON.stringify([input, origin])).digest("hex");
  return komo.exclusive(async () => {
    const db = openProbe(komo.path);
    let transaction = false;
    try {
      db.exec("PRAGMA foreign_keys=ON");
      db.exec("BEGIN IMMEDIATE");
      transaction = true;
      const existing = db.prepare("SELECT project,repo,origin,payload_hash,thread_id FROM local_operations WHERE operation=?").get(input.operation) as
        | { project: string; repo: string; origin: string; payload_hash: string; thread_id: string } | undefined;
      if (existing) {
        if (existing.project !== input.project || existing.repo !== input.repo || existing.origin !== origin || existing.payload_hash !== hash)
          throw Object.assign(Error("This note ID belongs to another note."), { status: 409 });
        db.exec("COMMIT"); transaction = false;
        return { id: existing.thread_id, duplicate: true };
      }
      if (input.handoff) {
        const { endpoint, branch, thread } = input.handoff;
        const linked = db.prepare(
          "SELECT local_thread FROM local_handoffs WHERE endpoint=? AND project=? AND repo=? AND branch=? AND hosted_thread=?"
        ).get(endpoint, input.project, input.repo, branch, thread) as { local_thread: string } | undefined;
        if (linked) {
          db.exec("COMMIT"); transaction = false;
          return { id: linked.local_thread, duplicate: true };
        }
      }
      const url = new URL("/threads", "http://127.0.0.1");
      url.searchParams.set("project", input.project);
      url.searchParams.set("repo", input.repo);
      url.searchParams.set("branch", queuedBranch);
      const response = await komo.fetch(new Request(url, {
        method: "POST",
        headers: { Origin: origin, Authorization: token, "Content-Type": "application/json", "CF-Connecting-IP": `loopback:${origin}` },
        body: JSON.stringify({ page: input.page, anchor: input.anchor, body: input.body }),
      }), false, db);
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || !result.id)
        throw Object.assign(Error(result.error || "Could not queue the note. Try again."), { status: response.status });
      db.prepare("INSERT INTO local_operations(operation,project,repo,origin,payload_hash,thread_id) VALUES(?,?,?,?,?,?)")
        .run(input.operation, input.project, input.repo, origin, hash, result.id);
      if (input.handoff)
        db.prepare("INSERT INTO local_handoffs(endpoint,project,repo,branch,hosted_thread,operation,local_thread) VALUES(?,?,?,?,?,?,?)")
          .run(input.handoff.endpoint, input.project, input.repo, input.handoff.branch, input.handoff.thread, input.operation, result.id);
      db.exec("COMMIT"); transaction = false;
      return { id: result.id, duplicate: false };
    } catch (error) {
      if (transaction) try { db.exec("ROLLBACK"); } catch {}
      throw error;
    } finally { db.close(); }
  });
}

export function release(db: DatabaseSync, scope: Scope, target: string) {
  if (!channelPattern.test(target) || !db.prepare("SELECT 1 FROM local_channels WHERE channel=? AND project=? AND repo=?").get(target, scope.project, scope.repo))
    throw Object.assign(Error("Choose a local agent before sending notes."), { status: 404 });
  db.exec("BEGIN IMMEDIATE");
  try {
    const moved = db.prepare("UPDATE threads SET branch=?,updated_at=? WHERE project=? AND repo=? AND branch=? AND resolved=0")
      .run(target, Date.now(), scope.project, scope.repo, queuedBranch);
    if (moved.changes)
      for (const branch of [queuedBranch, target])
        db.prepare("INSERT INTO scope_revisions(project,repo,branch,version) VALUES(?,?,?,1) ON CONFLICT(project,repo,branch) DO UPDATE SET version=version+1")
          .run(scope.project, scope.repo, branch);
    const result = sendChannel(db, { ...scope, branch: target }, true);
    const held = count(db, scope);
    db.exec("COMMIT");
    return { ...result, released: Math.max(result.released, Number(moved.changes)), held };
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    throw error;
  }
}
