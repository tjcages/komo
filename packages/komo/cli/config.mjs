import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export function gitValue(args, cwd) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}
/**
 * Find the nearest .komo/project.json at or above `cwd`. Returns the directory
 * that holds it and its settings, or the filesystem root and no settings.
 */
export async function findSettings(cwd) {
  let directory = cwd;
  while (true) {
    try {
      return {
        directory,
        settings: JSON.parse(
          await readFile(join(directory, ".komo/project.json"), "utf8")
        ),
      };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (dirname(directory) === directory) return { directory };
    directory = dirname(directory);
  }
}
export function repository(remote) {
  const match = remote.match(
    /^(?:https?:\/\/[^/]+\/|ssh:\/\/(?:[^@/]+@)?[^/]+\/|(?:[^@/]+@)?[^:/]+:)(.+?)(?:\.git)?\/?$/
  );
  return match?.[1] || "";
}
export function branchName(env, cwd) {
  return (
    env.KOMO_BRANCH ||
    env.CF_PAGES_BRANCH ||
    env.WORKERS_CI_BRANCH ||
    env.VERCEL_GIT_COMMIT_REF ||
    env.GITHUB_HEAD_REF ||
    env.GITHUB_REF_NAME ||
    env.BRANCH ||
    gitValue(["symbolic-ref", "--short", "HEAD"], cwd)
  );
}
export function clientModule(config) {
  return `import { defineKomo } from '@tjcages/komo/setup';\n\nexport const initKomo = defineKomo(${JSON.stringify(config, null, 2)});\n`;
}
