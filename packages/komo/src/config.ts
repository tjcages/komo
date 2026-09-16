import type { CommentsOptions } from "./types.js";

export type KomoConfig = Omit<
  CommentsOptions,
  "repo" | "branch" | "endpoint"
> & {
  /** Defaults to the hosted komo service. */
  endpoint?: string;
  repo?: string;
  /** Shared feedback across deployments by default. */
  scope?: "project" | "branch";
  /** Required only for branch scope; normally injected by the setup command. */
  branch?: string;
};

export function resolveConfig(config: KomoConfig): CommentsOptions {
  const { scope = "project", ...options } = config;
  if (scope === "branch" && !config.branch?.trim())
    throw new Error(
      "Branch scope needs a build-time branch. Run komo sync before your build or set branch explicitly."
    );
  return {
    ...options,
    endpoint: options.endpoint || "https://komo-api.off-brand.workers.dev",
    repo: config.repo || config.project,
    branch: scope === "branch" ? config.branch! : "shared",
  };
}
