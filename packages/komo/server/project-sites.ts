import { check, sitePattern } from "./validation";
import type { Project } from "./workspaces";

const MAX_SITES = 10;

/**
 * Owner-editable approved sites. Hosted workspaces store them in
 * workspace_domains; projects configured in PROJECTS store extras in
 * project_sites on top of their fixed config origins.
 */
export async function projectSites(env: Env, project: string) {
  const configured = (JSON.parse(env.PROJECTS) as Record<string, Project>)[
    project
  ];
  const table = configured ? "project_sites" : "workspace_domains";
  const rows = await env.DB.prepare(
    `SELECT origin FROM ${table} WHERE project=? ORDER BY origin`
  )
    .bind(project)
    .all<{ origin: string }>();
  return {
    table,
    sites: rows.results.map((row) => row.origin),
    fixed: configured?.origins ?? [],
  };
}

export async function saveProjectSites(
  env: Env,
  project: string,
  value: unknown
) {
  check(Array.isArray(value), 400, "Send a list of sites.");
  const sites = [...new Set(value.map(sitePattern))];
  check(sites.length <= MAX_SITES, 400, `Approve up to ${MAX_SITES} sites.`);
  const { table, fixed } = await projectSites(env, project);
  const added = sites.filter((site) => !fixed.includes(site));
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM ${table} WHERE project=?`).bind(project),
    ...added.map((site) =>
      env.DB.prepare(
        `INSERT INTO ${table}(project,origin,${table === "project_sites" ? "added_at" : "verified_at"}) VALUES(?,?,?)`
      ).bind(project, site, now)
    ),
  ]);
  return { sites: added.sort(), fixed };
}
