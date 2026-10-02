import type { DatabaseSync } from "node:sqlite";
import { defaultLocalOrigins, type AgentScope } from "./scope";

// Local project registrations. Each process that opens a checkout of a komo
// project registers it in its own row, so no session overwrites another's
// settings.
// - While any registering process runs, only running processes count. When
//   none runs, the remaining rows count, so pages can still leave notes.
// - Running checkouts of a project must name the same repository.
// - Explicit `local.origins` lists narrow each other: a page must match every
//   list. The defaults apply only when no running checkout names a list.

export type ProjectConfig = {
  repo: string;
  origins: string[];
  originGroups: string[][];
};

type Registration = {
  project: string;
  repo: string;
  origins: string | null;
  pid: number;
};

/** Whether a process runs. EPERM means it runs as another user. */
export function alive(pid: number) {
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Rows newest first. */
function effective(rows: Registration[]): ProjectConfig {
  const running = rows.filter((row) => alive(row.pid));
  const current = running.length ? running : rows;
  const lists = current.flatMap((row) =>
    row.origins ? [JSON.parse(row.origins) as string[]] : [],
  );
  const originGroups = lists.length ? lists : [defaultLocalOrigins];
  return {
    repo: current[0].repo,
    origins: [...new Set(originGroups.flat())],
    originGroups,
  };
}

/** The config of every registered project, or of one. */
export function projectConfigs(
  database: DatabaseSync,
  project?: string,
): Map<string, ProjectConfig> {
  const rows = database
    .prepare(
      `SELECT project,repo,origins,pid FROM local_registrations${project === undefined ? "" : " WHERE project=?"} ORDER BY updated_at DESC,pid DESC`,
    )
    .all(...(project === undefined ? [] : [project])) as Registration[];
  const grouped = new Map<string, Registration[]>();
  for (const row of rows)
    grouped.set(row.project, [...(grouped.get(row.project) ?? []), row]);
  return new Map(
    [...grouped].map(([name, group]) => [name, effective(group)] as const),
  );
}

/**
 * Register this process's checkout of a project. Refuses a repository that
 * differs from a running checkout's. Returns a warning when running
 * checkouts disagree on `local.origins`.
 */
export function registerProject(
  database: DatabaseSync,
  scope: AgentScope,
): string | undefined {
  const own = scope.configuredOrigins
    ? JSON.stringify(scope.configuredOrigins)
    : null;
  database.exec("BEGIN IMMEDIATE");
  try {
    const rows = database
      .prepare(
        "SELECT channel,repo,origins,pid FROM local_registrations WHERE project=?",
      )
      .all(scope.project) as (Registration & { channel: string })[];
    const others = rows.filter(
      (row) =>
        alive(row.pid) &&
        !(row.pid === process.pid && row.channel === scope.channel),
    );
    const clash = others.find((row) => row.repo !== scope.repo);
    if (clash)
      throw Error(
        `A running komo session uses project ${scope.project} for repository ${clash.repo}, not ${scope.repo}. Stop that session, or give this repository its own project key.`,
      );
    // Rows of ended processes no longer count; this row stands for them.
    const drop = database.prepare(
      "DELETE FROM local_registrations WHERE project=? AND channel=? AND pid=?",
    );
    for (const row of rows)
      if (!alive(row.pid)) drop.run(scope.project, row.channel, row.pid);
    database
      .prepare(
        `INSERT INTO local_registrations(project,channel,repo,origins,pid,updated_at) VALUES(?,?,?,?,?,?)
        ON CONFLICT(project,channel,pid) DO UPDATE SET repo=excluded.repo,origins=excluded.origins,updated_at=excluded.updated_at`,
      )
      .run(
        scope.project,
        scope.channel,
        scope.repo,
        own,
        process.pid,
        Date.now(),
      );
    database.exec("COMMIT");
    if (others.some((row) => row.origins !== own))
      return `Running checkouts of project ${scope.project} set different local.origins in .komo/project.json. A page must match every list; the defaults apply only when no checkout sets one.`;
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {}
    throw error;
  }
}
