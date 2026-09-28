import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { agentWorkflow } from "../dist/agent-prompt.js";

// Local agent mode. It stays out of src/agent-prompt.ts, whose module the
// browser bundle shares; only AGENTS.md and the CLI help carry it.
export const agentWatchWorkflow = `Watch mode (local agent mode): when the user asks for watch mode and the komo_watch tool from komo mcp is available, call komo_status once and tell the user once to pick this agent in the komo dock's Send to menu and press Send when the notes are ready. Notes to this agent wait for Send. Then loop: run the waiter command from komo_status in the background; it prints nothing until notes are sent, then prints notes N and exits. Call komo_watch with your working directory as directory, timeoutSeconds 5 and batchWindowSeconds 0, handle every thread it returns, and run the waiter again. For each thread, locate the target from its source reference, selector, and text, and make the smallest change that satisfies it. After verification, resolve it with komo_resolve and a one-line summary under the rules above; otherwise ask one focused question with komo_reply, which keeps the thread open until a person answers. If komo_resolve or komo_reply fails because a person changed the thread, read the current thread in the error, redo the work against it, and try again. Without MCP tools, komo comments wait --local waits without claiming and prints notes N, and komo comments watch --local waits once and prints the batch as JSON; answer with komo comments reply THREAD_ID --local or komo comments resolve THREAD_ID --local, each with --body.`;

const start = "<!-- komo:workflow:start -->";
const end = "<!-- komo:workflow:end -->";

export async function installAgentWorkflow(cwd) {
  const path = join(cwd, "AGENTS.md");
  let existing = "";
  try {
    existing = await readFile(path, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const block = `${start}
## komo comment workflow

Use the project-local komo CLI (for example, npx --no-install komo). Run komo login if a session is needed.

${agentWorkflow}

${agentWatchWorkflow}
${end}`;
  const first = existing.indexOf(start);
  const last = existing.indexOf(end);
  if (
    (first === -1) !== (last === -1) ||
    (first !== -1 &&
      (last < first ||
        existing.indexOf(start, first + start.length) !== -1 ||
        existing.indexOf(end, last + end.length) !== -1))
  )
    throw Error(
      "AGENTS.md has an incomplete or duplicate komo workflow block. Repair its markers before retrying."
    );
  const content =
    first === -1
      ? `${existing}${existing && !existing.endsWith("\n") ? "\n" : ""}${existing ? "\n" : ""}${block}
`
      : existing.slice(0, first) + block + existing.slice(last + end.length);
  if (content !== existing) await writeFile(path, content);
  return { path, changed: content !== existing };
}
