#!/usr/bin/env node
import { mkdir, readFile, writeFile, access, cp } from "node:fs/promises";
import { resolve, dirname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { branchName, clientModule, gitValue, repository } from "./config.mjs";

import { agentCommands, agentHelp, runAgent } from "./agent.mjs";

const cwd = process.cwd();
const args = process.argv.slice(2);
const command = args[0];
const flag = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};
const settingsPath = resolve(cwd, ".komo/project.json");
const generatedPath = resolve(cwd, "komo.config.js");
const run = (program, argv, options = {}) =>
  new Promise((resolveRun, reject) => {
    const child = spawn(program, argv, {
      cwd,
      stdio: ["inherit", "pipe", "inherit"],
      shell: false,
      ...options,
    });
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += String(chunk);
      process.stdout.write(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolveRun(output)
        : reject(Error(`${program} exited with ${code}`))
    );
  });
async function request(endpoint, path, data) {
  const response = await fetch(new URL(path, endpoint), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok)
    throw Error(result.error || `Request failed (${response.status}).`);
  return result;
}
async function sync() {
  const settings = JSON.parse(await readFile(settingsPath, "utf8"));
  const config = { ...settings };
  delete config.origin;
  if (config.scope === "branch") {
    config.branch = branchName(process.env, cwd);
    if (!config.branch)
      throw Error("Cannot detect the branch. Set KOMO_BRANCH for this build.");
  }
  await writeFile(generatedPath, clientModule(config));
  console.log("Updated komo.config.js");
}
async function protectLocalFiles() {
  const path = resolve(cwd, ".gitignore");
  const existing = (await exists(path)) ? await readFile(path, "utf8") : "";
  const additions = [
    ".komo/owner-key",
    ".komo/.dev.vars",
    ".komo/.wrangler/",
    "komo.config.js",
  ].filter((line) => !existing.split("\n").includes(line));
  if (additions.length)
    await writeFile(path, `${existing}\n# komo\n${additions.join("\n")}\n`);
}
async function deploy() {
  const dir = resolve(cwd, ".komo"),
    path = join(dir, "wrangler.json");
  const statePath = join(dir, "deployment.json");
  const state = JSON.parse(await readFile(statePath, "utf8"));
  const wr = (...argv) =>
    run("npx", ["--yes", "wrangler@4", ...argv, "--config", path]);
  await wr("login");
  let config = JSON.parse(await readFile(path, "utf8"));
  if (!config.d1_databases?.length) {
    await wr("d1", "create", config.name, "--binding", "DB", "--update-config");
    config = JSON.parse(await readFile(path, "utf8"));
  }
  config.d1_databases[0].migrations_dir = "migrations";
  await writeFile(path, JSON.stringify(config, null, 2));
  await wr("d1", "migrations", "apply", "DB", "--remote");
  const output = await wr("deploy");
  const endpoint =
    flag("--endpoint") ||
    state.endpoint ||
    output.match(/https:\/\/[a-z0-9.-]+\.workers\.dev\b/)?.[0];
  if (!endpoint)
    throw Error(
      "No API URL returned. Run komo deploy --endpoint YOUR_WORKER_URL."
    );
  await writeFile(statePath, JSON.stringify({ ...state, endpoint }, null, 2));
  console.log("Store the Google OAuth client secret:");
  await wr("secret", "put", "GOOGLE_CLIENT_SECRET");
  await writeFile(
    settingsPath,
    `${JSON.stringify(
      {
        endpoint,
        project: state.project,
        repo: state.repo,
        scope: state.scope,
        origin: state.origin,
      },
      null,
      2
    )}\n`
  );
  await sync();
  const key = await readFile(join(dir, "owner-key"), "utf8");
  console.log(
    `Register ${endpoint}/auth/google/callback in Google Console.\nOpen ${endpoint}/setup?project=${state.project}#${key} to claim ownership with Google.`
  );
}
async function init() {
  if (await exists(resolve(cwd, ".komo/deployment.json")))
    throw Error("Self-host setup exists. Run komo deploy to resume.");
  if ((await exists(settingsPath)) || (await exists(generatedPath)))
    throw Error(
      "komo is already configured. Edit .komo/project.json, then run komo sync."
    );
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (text, fallback = "") => {
    if (!process.stdin.isTTY) {
      if (fallback) return fallback;
      throw Error(
        `${text} Supply the corresponding CLI flag in non-interactive mode.`
      );
    }
    return (
      (
        await rl.question(`${text}${fallback ? ` [${fallback}]` : ""}: `)
      ).trim() || fallback
    );
  };
  try {
    const selfHosted = args.includes("--self-host");
    const detected = repository(gitValue(["remote", "get-url", "origin"], cwd));
    const project = `komo_${randomUUID().replaceAll("-", "")}`;
    const repo = flag("--repo") || detected || project;
    const origin =
      flag("--origin") ||
      process.env.CF_PAGES_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
      process.env.DEPLOY_PRIME_URL ||
      "http://localhost:3000";
    const parsed = new URL(origin);
    if (
      parsed.origin !== origin ||
      !["https:", "http:"].includes(parsed.protocol) ||
      (parsed.protocol === "http:" &&
        !["localhost", "127.0.0.1"].includes(parsed.hostname))
    )
      throw Error("Use an exact HTTPS origin, or localhost.");
    const origins = [
      ...new Set([
        origin,
        "http://localhost:3000",
        "http://localhost:4321",
        "http://localhost:5173",
      ]),
    ];
    const scope = args.includes("--branch-scope") ? "branch" : "project";
    let config;
    if (!selfHosted) {
      const endpoint =
        flag("--endpoint") || "https://komo-api.off-brand.workers.dev";
      const api = new URL(endpoint);
      if (
        api.protocol !== "https:" &&
        !["localhost", "127.0.0.1"].includes(api.hostname)
      )
        throw Error("The API endpoint must use HTTPS.");
      const setup = await request(endpoint, "/setup/start", { repo, origins });
      console.log(
        `\nSign in with Google to own this workspace:\n${setup.url}\n`
      );
      console.log("Waiting for sign-in…");
      const end = Date.now() + 600000;
      while (Date.now() < end) {
        await new Promise((resolveWait) => setTimeout(resolveWait, 3000));
        const result = await request(endpoint, "/setup/poll", {
          id: setup.id,
          secret: setup.secret,
        });
        if (!result.pending) {
          config = {
            endpoint: result.endpoint,
            project: result.project,
            repo: result.repo,
            scope,
            origin,
          };
          break;
        }
      }
      if (!config) throw Error("Sign-in timed out. Run komo init again.");
    } else {
      if (
        !(await exists(resolve(cwd, "node_modules/@tjcages/komo/package.json")))
      )
        throw Error(
          "Install komo in this project before self-hosting: npm install @tjcages/komo (or install the preview tarball before publication)."
        );
      await protectLocalFiles();
      const name = `komo-${basename(cwd)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .slice(0, 32)}-${project.slice(-6)}`;
      const googleClient =
        flag("--google-client-id") || (await ask("Google OAuth client ID"));
      const key = randomBytes(32).toString("hex");
      const dir = resolve(cwd, ".komo");
      await mkdir(dir, { recursive: true });
      const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
      await cp(
        join(packageRoot, "server/migrations"),
        join(dir, "migrations"),
        { recursive: true }
      );
      await writeFile(
        join(dir, "index.ts"),
        'export { default } from "@tjcages/komo/server";\n'
      );
      const wrangler = {
        name,
        main: "index.ts",
        compatibility_date: "2026-07-02",
        compatibility_flags: ["nodejs_compat"],
        observability: { enabled: true },
        vars: {
          PROJECTS: JSON.stringify({
            [project]: {
              repo,
              origins,
              requireOwner: true,
              bootstrapHash: createHash("sha256").update(key).digest("hex"),
            },
          }),
          GOOGLE_CLIENT_ID: googleClient,
          GITHUB_CLIENT_ID: "",
          GITHUB_CLIENT_SECRET: "",
        },
      };
      const path = join(dir, "wrangler.json");
      await writeFile(path, JSON.stringify(wrangler, null, 2));
      await writeFile(join(dir, "owner-key"), key, { mode: 0o600 });
      await writeFile(
        join(dir, "deployment.json"),
        JSON.stringify({ project, repo, scope, origin }, null, 2)
      );
      await deploy();
      return;
    }
    await mkdir(dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, `${JSON.stringify(config, null, 2)}\n`);
    await protectLocalFiles();
    await sync();
    console.log(
      `\nMount after the page loads:\n\nimport { initKomo } from '@tjcages/komo';\ninitKomo(${JSON.stringify({ ...config, origin: undefined, ...(config.scope === "branch" ? { branch: branchName(process.env, cwd) } : {}) }, null, 2)});\n\nFor automatic branch detection, use the generated komo.config.js helper and run komo sync before your build.\n`
    );
  } finally {
    rl.close();
  }
}
try {
  if (args.includes("--help") || !command)
    console.log(
      `komo\n\n  komo init          Create a Google-owned hosted workspace\n  komo init --self-host  Deploy your own Worker and D1 database\n  komo deploy        Resume self-hosted deployment\n  komo sync          Regenerate client settings; detect the current branch\n\nOptions: --origin URL --endpoint API_URL --repo OWNER/REPO --branch-scope\nSelf-host: --google-client-id ID\n\nComments are shared across deployments unless --branch-scope is set.${
        agentHelp
      }`
    );
  else if (agentCommands.includes(command)) await runAgent(args);
  else if (command === "init") await init();
  else if (command === "deploy") await deploy();
  else if (command === "sync") await sync();
  else throw Error(`Unknown command: ${command}`);
} catch (error) {
  console.error(
    agentCommands.includes(command)
      ? JSON.stringify({
          ok: false,
          error: { message: error.message, status: error.status ?? null },
        })
      : error.message
  );
  process.exitCode = 1;
}
