import { ApiError } from "./api.js";

export type ConnectionIssue = {
  kind: "site" | "offline" | "unreachable" | "server";
  title: string;
  detail: string;
};

/** Say why comments didn't load, in words a visitor can act on. */
export function connectionIssue(
  reason: unknown,
  local = false
): ConnectionIssue {
  const code = reason instanceof ApiError ? reason.code : undefined;
  // A local agent server serves only this machine; the fix is in the repo.
  if (local && code === "site_not_approved")
    return {
      kind: "site",
      title: "Local agents don’t accept this site",
      detail: "Add this origin to local.origins in .komo/project.json.",
    };
  if (local && code === "unreachable")
    return {
      kind: "unreachable",
      title: "Can’t connect to local agents",
      detail: "Start watch mode in an agent session for this repo.",
    };
  if (code === "site_not_approved")
    return {
      kind: "site",
      title: "Comments aren’t on for this site",
      detail: "Own this site? Turn comments on. Otherwise, send this link to the owner.",
    };
  if (code === "offline")
    return {
      kind: "offline",
      title: "You’re offline",
      detail: "Comments will come back when you do.",
    };
  if (code === "unreachable")
    return {
      kind: "unreachable",
      title: "Can’t connect",
      detail:
        "You might be offline, or this site isn’t set up for comments yet.",
    };
  return {
    kind: "server",
    title: "Comments didn’t load",
    detail: reason instanceof Error ? reason.message : "Something went wrong.",
  };
}
