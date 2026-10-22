import { afterAll, beforeAll, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  formatThread,
  LocalAgent,
  LocalKomo,
  storePath,
} from "../server/local/index";
import type { OptionPick } from "../src/types";

const cli = fileURLToPath(new URL("../cli/index.mjs", import.meta.url));
const origin = "http://localhost:3000";
const pick: OptionPick = {
  block: "hero-title",
  selector: "main > h1:nth-of-type(1)",
  index: 2,
  count: 4,
  text: "Read every option in place",
  html: "Read every <em>option</em> in place",
  original: "Review copy where it lives",
};
const anchor = {
  selector: "main > h1:nth-of-type(1)",
  text: "Read every option in place",
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  pageX: 10,
  pageY: 10,
  viewportWidth: 1200,
};
let directory: string,
  env: Record<string, string>,
  komo: LocalKomo,
  agent: LocalAgent,
  token: string;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "komo-options-"));
  await mkdir(join(directory, "app/.komo"), { recursive: true });
  await writeFile(
    join(directory, "app/.komo/project.json"),
    JSON.stringify({ project: "options-test", repo: "owner/site" }),
  );
  env = { KOMO_DATA_HOME: join(directory, "data"), KOMO_LOCAL_PORT: "4999" };
  komo = new LocalKomo(storePath(env));
  agent = await LocalAgent.open(komo, join(directory, "app"), env);
  const response = await komo.fetch(
    new Request(
      "http://127.0.0.1/auth/guest?project=options-test&repo=owner/site&branch=komo-queued",
      {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "You" }),
      },
    ),
  );
  token = ((await response.json()) as { token: string }).token;
});
afterAll(async () => {
  komo.close();
  await rm(directory, { recursive: true, force: true });
});

const stage = (options: unknown) =>
  komo.stageNote(
    {
      project: "options-test",
      repo: "owner/site",
      operation: randomUUID(),
      page: "/",
      anchor,
      body: "Use these text options:\n- hero-title: option 3 of 4: Read every option in place",
      options,
    },
    origin,
    `Bearer ${token}`,
  );

it("refuses invalid picks and queues nothing", async () => {
  for (const options of [
    [],
    [{ ...pick, index: 4 }],
    [{ ...pick, block: "" }],
    [{ ...pick, html: 1 }],
    "picks",
  ])
    await expect(stage(options)).rejects.toMatchObject({ status: 400 });
  expect(komo.queued("options-test", "owner/site").held).toBe(0);
});

it("hands picks to the agent only after Send, then hides them once resolved", async () => {
  const { id } = await stage([pick]);
  expect(agent.options()).toEqual([]);
  await komo.send("options-test", "owner/site", agent.scope.channel);

  const [sent] = agent.options();
  expect(sent).toMatchObject({
    ...pick,
    threadId: id,
    resolved: false,
    page: "/",
    url: `${origin}/`,
  });
  const thread = await agent.thread(id);
  expect(
    formatThread(agent, {
      thread,
      branch: thread.branch,
      origin: thread.origin,
    }).options,
  ).toEqual([pick]);

  // A later note for the same block wins.
  const { id: next } = await stage([
    { ...pick, index: 1, text: "Pick the words" },
  ]);
  await komo.send("options-test", "owner/site", agent.scope.channel);
  expect(agent.options().map((item) => [item.threadId, item.index])).toEqual([
    [next, 1],
  ]);

  for (const threadId of [id, next])
    await agent.resolve(
      threadId,
      "Applied.",
      { session: "test", pid: 0 },
      agent.activityOf(threadId).key ?? undefined,
    );
  expect(agent.options()).toEqual([]);
  expect(agent.options(true).map((item) => item.threadId)).toEqual([next]);
});

it("reads picks from the CLI and documents them in the schema", async () => {
  const run = promisify(execFile);
  const { stdout } = await run(
    process.execPath,
    [cli, "options", "list", "--local", "--all"],
    {
      cwd: join(directory, "app"),
      env: { ...process.env, ...env },
    },
  );
  expect(JSON.parse(stdout).data.picks).toHaveLength(1);
  await expect(
    run(process.execPath, [cli, "options", "list"], {
      cwd: join(directory, "app"),
      env: { ...process.env, ...env },
    }),
  ).rejects.toMatchObject({ stderr: expect.stringContaining("Add --local") });
  const schema = JSON.parse(
    (await run(process.execPath, [cli, "schema"])).stdout,
  );
  expect(schema.options.mcp).toBe("komo_options");
  const { tools } = await import("../cli/mcp.mjs");
  expect(tools.map((tool: { name: string }) => tool.name)).toContain(
    "komo_options",
  );
});
