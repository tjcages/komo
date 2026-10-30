// Mounts komo in local agent-only mode against the demo's local server.
import { initKomo } from "@tjcages/komo";

initKomo({
  project: "komo-text-options-demo",
  repo: "tjcages/komo-text-options-demo",
  local: { agentsOnly: true, endpoint: KOMO_LOCAL_ENDPOINT },
});
