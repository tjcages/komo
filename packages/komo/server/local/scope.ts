import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { basename, resolve } from "node:path";
import { branchName, findSettings, gitValue } from "../../cli/config.mjs";

// Where an agent's notes live. Each agent has two scopes in its komo project:
// - its own channel, branch `agent-<hash>`, which the "Send to" switch targets;
// - the scope a stock komo client uses for the repository ("shared", or the git
//   branch for branch scope), so a stock client pointed at the local server
//   reaches the agent without any change.

/** Page origins a local project allows when .komo/project.json names none. */
export const defaultLocalOrigins = [
  "http://localhost",
  "http://localhost:*",
  "http://127.0.0.1",
  "http://127.0.0.1:*",
  "http://[::1]",
  "http://[::1]:*",
  // Worker patterns match one host label per `*`, so two-label dev hosts such
  // as http://task.repo.localhost need their own entries.
  "http://*.localhost",
  "http://*.localhost:*",
  "http://*.*.localhost",
  "http://*.*.localhost:*",
];

export type AgentScope = {
  project: string;
  repo: string;
  /** The agent's own branch, `agent-` and 12 hex characters. */
  channel: string;
  /** The basename of the git toplevel, for the switch and the guest name. */
  label: string;
  /** The branch a stock client uses for this repository. */
  branch: string;
  /** Page origin patterns this checkout allows: its own list, else the defaults. */
  origins: string[];
  /** The `local.origins` list of this checkout, when it sets one. */
  configuredOrigins?: string[];
  /** The real path of the git toplevel, or of the .komo directory's parent. */
  root: string;
};

/** A URL hostname that names this machine. */
export function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

function localOrigins(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > 50 ||
    !value.every((item) => typeof item === "string")
  )
    throw Error(
      ".komo/project.json local.origins must be a list of page origins.",
    );
  for (const pattern of value) {
    // A sample origin the pattern matches: `*` is one host label or a port.
    const sample = pattern.replace(/:\*$/, ":1").replaceAll("*", "x");
    let url: URL | undefined;
    try {
      url = new URL(sample);
    } catch {}
    if (
      !url ||
      !["http:", "https:"].includes(url.protocol) ||
      url.origin !== sample ||
      !isLoopbackHostname(url.hostname)
    )
      throw Error(
        `.komo/project.json local.origins: ${pattern} is not a page origin on this machine.`,
      );
  }
  return value;
}

/**
 * Resolve the agent's scopes from a directory inside the repository. Reads
 * .komo/project.json upward like the komo CLI, and honours the same
 * KOMO_PROJECT, KOMO_REPO and KOMO_BRANCH overrides.
 */
export async function resolveScope(
  directory: string,
  env: Record<string, string | undefined> = process.env,
): Promise<AgentScope> {
  const start = resolve(directory);
  const found = await findSettings(start);
  const settings = (found.settings ?? {}) as {
    project?: unknown;
    repo?: unknown;
    scope?: unknown;
    local?: { origins?: unknown };
  };
  if (!found.settings && !env.KOMO_PROJECT)
    throw Error(`No .komo/project.json above ${start}.`);
  const project = env.KOMO_PROJECT || settings.project;
  if (typeof project !== "string" || !project)
    throw Error(".komo/project.json has no project key.");
  const repo = env.KOMO_REPO || settings.repo || project;
  if (typeof repo !== "string")
    throw Error(".komo/project.json repo is invalid.");
  const configDirectory = found.settings ? found.directory : start;
  const branch =
    env.KOMO_BRANCH ||
    (settings.scope === "branch" ? branchName(env, configDirectory) : "shared");
  if (!branch) throw Error("Cannot detect the git branch. Set KOMO_BRANCH.");
  const root = realpathSync(
    gitValue(["rev-parse", "--show-toplevel"], start) || configDirectory,
  );
  const configuredOrigins = localOrigins(settings.local?.origins);
  const hash = createHash("sha256")
    .update(`${project}\n${repo}\n${root}`)
    .digest("hex")
    .slice(0, 12);
  return {
    project,
    repo,
    channel: `agent-${hash}`,
    label: basename(root) || "agent",
    branch,
    origins: configuredOrigins ?? defaultLocalOrigins,
    configuredOrigins,
    root,
  };
}
