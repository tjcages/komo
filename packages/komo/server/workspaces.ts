import { check, string, originAllowed } from "./validation";
import type { Identity } from "../src/types";
export type Project = {
  repo: string;
  origins: string[];
  allowGuests?: boolean;
  allowGuestResolve?: boolean;
  requireOwner?: boolean;
  bootstrapHash?: string;
  suspended?: boolean;
  writesPerDay?: number;
  retainedCommentsPerUser?: number;
};

export function retainReviewerComments(
  db: D1Database,
  project: string,
  user: string,
  limit: number | undefined
): D1PreparedStatement[] {
  if (!limit || !Number.isInteger(limit) || limit < 1) return [];
  return [
    db
      .prepare(
        `DELETE FROM comments WHERE user_id=?
      AND thread_id IN (SELECT id FROM threads WHERE project=?)
      AND id NOT IN (SELECT c.id FROM comments c JOIN threads t ON t.id=c.thread_id
        WHERE c.user_id=? AND t.project=? ORDER BY c.created_at DESC,c.rowid DESC LIMIT ?)`
      )
      .bind(user, project, user, project, limit),
    db
      .prepare(
        `DELETE FROM threads WHERE project=?
      AND NOT EXISTS (SELECT 1 FROM comments WHERE thread_id=threads.id)`
      )
      .bind(project),
  ];
}
export async function projectConfig(
  env: Env,
  project: string
): Promise<Project | undefined> {
  const staticConfig = (JSON.parse(env.PROJECTS) as Record<string, Project>)[
    project
  ];
  if (staticConfig) return staticConfig;
  const row = await env.DB.prepare(
    "SELECT repo,origins,suspended FROM workspaces WHERE id=?"
  )
    .bind(project)
    .first<{ repo: string; origins: string; suspended: number }>();
  if (!row) return undefined;
  const verified = await env.DB.prepare(
    "SELECT origin FROM workspace_domains WHERE project=?"
  )
    .bind(project)
    .all<{ origin: string }>();
  const local = (JSON.parse(row.origins) as string[]).filter((origin) =>
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  );
  return {
    repo: row.repo,
    origins: [...local, ...verified.results.map((item) => item.origin)],
    requireOwner: true,
    suspended: !!row.suspended,
    writesPerDay: 500,
  };
}
export async function googleOwner(env: Env, project: string, user: Identity) {
  check(
    user.verified && user.id.startsWith("google:"),
    403,
    "Sign in with Google to manage this workspace."
  );
  const owner = await env.DB.prepare(
    "SELECT user_id FROM project_owners WHERE project=?"
  )
    .bind(project)
    .first<{ user_id: string }>();
  check(
    owner?.user_id === user.id,
    403,
    "Only the workspace owner can do that."
  );
}
export async function provision(
  env: Env,
  user: Identity,
  config: Record<string, unknown>
) {
  check(
    user.verified && user.id.startsWith("google:"),
    403,
    "A Google account is required to create a workspace."
  );
  const repo = string(config.repo, 200, "repository");
  const origins = config.origins;
  check(
    Array.isArray(origins) &&
      origins.length > 0 &&
      origins.length <= 10 &&
      origins.every(
        (origin) =>
          typeof origin === "string" &&
          origin.length <= 300 &&
          originAllowed(origin, [origin]) &&
          (origin.startsWith("https://") ||
            /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
      ),
    400,
    "Use exact HTTPS site origins or localhost."
  );
  const id = `komo_${crypto.randomUUID().replaceAll("-", "")}`;
  const results = await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO workspaces(id,owner_id,repo,origins,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM workspaces WHERE owner_id=?)<3"
    ).bind(id, user.id, repo, JSON.stringify(origins), Date.now(), user.id),
    env.DB.prepare(
      "INSERT INTO project_owners(project,user_id) SELECT id,owner_id FROM workspaces WHERE id=?"
    ).bind(id),
    env.DB.prepare(
      "INSERT INTO project_quotas(project,max_comments,max_bytes) SELECT id,250,10485760 FROM workspaces WHERE id=?"
    ).bind(id),
  ]);
  check(
    results[0].meta.changes,
    409,
    "Your account has reached three hosted projects."
  );
  return { project: id, repo };
}
