import type { DatabaseSync } from "node:sqlite";
import type { Project } from "../workspaces";
import { projectConfigs } from "./projects";

// The Worker's Env and ExecutionContext, synthesized for Node.

/**
 * An Origin that only in-process calls use. The HTTP adapter refuses it,
 * because its hostname is not loopback, so no page can present it.
 */
export const agentOrigin = "http://komo-agent.invalid";

/**
 * Build the Worker's Env over the local store. PROJECTS comes from the
 * registrations on every call, so a project an agent registers is live at
 * once. Local projects allow guests and guest resolve, and have no owner:
 * there is no Google sign-in on this machine.
 */
export function localEnv(
  database: DatabaseSync,
  DB: D1Database,
  inProcess = false,
): Env {
  const projects: Record<string, Project> = {};
  for (const [project, config] of projectConfigs(database))
    projects[project] = {
      repo: config.repo,
      origins: [...config.origins, ...(inProcess ? [agentOrigin] : [])],
      allowGuests: true,
      allowGuestResolve: true,
    };
  // KOMO_HOSTED, KOMO_PAUSED and EDGE_LIMIT stay unset: the Worker checks each
  // before use. Empty OAuth settings hide Google and GitHub sign-in.
  return {
    DB,
    PROJECTS: JSON.stringify(projects),
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    GITHUB_CLIENT_ID: "",
    GITHUB_CLIENT_SECRET: "",
  } as unknown as Env;
}

/** An ExecutionContext whose waitUntil work is logged, never thrown. */
export function localContext(pending: Set<Promise<unknown>>): ExecutionContext {
  return {
    waitUntil(promise: Promise<unknown>) {
      const tracked = promise
        .catch((error) =>
          console.error(
            "[komo local] Background task failed:",
            (error as Error)?.message ?? error,
          ),
        )
        .finally(() => pending.delete(tracked));
      pending.add(tracked);
    },
    passThroughOnException() {},
    props: {},
  } as unknown as ExecutionContext;
}
