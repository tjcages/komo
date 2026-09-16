import { initComments } from "./index.js";

const url = new URL(location.href);
const project = url.searchParams.get("project") || "_komo";
const claimKey = url.hash.slice(1) || undefined;
history.replaceState(null, "", url.pathname + url.search);
initComments({
  endpoint: location.origin,
  project,
  repo: project,
  branch: "shared",
  pageRoot: document.querySelector("main")!,
  onboarding: {
    code: url.searchParams.get("code") || undefined,
    workspace: url.searchParams.get("workspace") || undefined,
    site: url.searchParams.get("site") || undefined,
    claimKey,
  },
});
