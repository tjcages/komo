import { ApiError } from "./api.js";

export type ConnectionIssue = {
  kind: "site" | "offline" | "unreachable" | "server";
  title: string;
  detail: string;
};

/** Describe why comments failed to load, with a next step for the viewer. */
export function connectionIssue(
  reason: unknown,
  host = globalThis.location?.host || "this site"
): ConnectionIssue {
  const code = reason instanceof ApiError ? reason.code : undefined;
  if (code === "site_not_approved")
    return {
      kind: "site",
      title: "This site isn’t approved",
      detail: `${host} can’t load comments for this project. Ask the project owner to add it under Account → Approved sites. A wildcard like https://*-preview.your-site.com covers preview URLs.`,
    };
  if (code === "offline")
    return {
      kind: "offline",
      title: "You’re offline",
      detail: "Comments will load again when your connection is back.",
    };
  if (code === "unreachable")
    return {
      kind: "unreachable",
      title: "Can’t reach komo",
      detail: `Check your connection and try again. If this keeps happening, ${host} may not be approved yet. The project owner can add it under Account → Approved sites.`,
    };
  return {
    kind: "server",
    title: "Comments didn’t load",
    detail: reason instanceof Error ? reason.message : "Something went wrong.",
  };
}
