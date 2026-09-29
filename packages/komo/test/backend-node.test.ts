import { expect, it } from "vitest";
import { Pool } from "pg";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { once } from "node:events";

const connection = process.env.KOMO_TEST_POSTGRES_URL;

(connection ? it : it.skip)(
  "serves file-owned project policy on Node with environment overrides and legacy fallback",
  async () => {
    const schema = `komo_config_${crypto.randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: connection });
    const dir = await mkdtemp(join(tmpdir(), "komo-node-config-"));
    const packageRoot = fileURLToPath(new URL("..", import.meta.url));
    let child: ChildProcess | undefined;
    let output = "";
    const stop = async () => {
      if (child && child.exitCode === null && child.signalCode === null) {
        const exited = once(child, "exit");
        child.kill("SIGTERM");
        await exited;
      }
    };
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      const dbUrl = new URL(connection!);
      dbUrl.searchParams.set("options", `-c search_path=${schema}`);
      const port = await new Promise<number>((resolve) => {
        const listener = createServer();
        listener.listen(0, "127.0.0.1", () => {
          const address = listener.address();
          if (!address || typeof address === "string")
            throw Error("Missing test listener address");
          listener.close(() => resolve(address.port));
        });
      });
      await mkdir(join(dir, "node_modules/@tjcages"), { recursive: true });
      await symlink(packageRoot, join(dir, "node_modules/@tjcages/komo"));
      await writeFile(join(dir, "package.json"), '{"type":"module"}');
      const projects = {
        review: {
          repo: "team/site",
          origins: ["https://site.example.com", "http://localhost:*"],
          allowGuests: false,
        },
      };
      await writeFile(
        join(dir, "projects.ts"),
        `export const projects = ${JSON.stringify(projects)};`,
      );
      await writeFile(
        join(dir, "komo.config.ts"),
        `
      import { defineKomoConfig } from '@tjcages/komo/config';
      import { projects } from './projects';
      export default defineKomoConfig({ projects, publicUrl: 'https://overridden.example.com', port: 1, googleClientId: 'file-id' });
    `,
      );
      const env = {
        ...process.env,
        DATABASE_URL: dbUrl.href,
        PUBLIC_URL: `http://127.0.0.1:${port}`,
        PORT: String(port),
        KOMO_PROXY_HOPS: "0",
        PROJECTS: JSON.stringify({
          legacy: { repo: "old/site", origins: ["https://site.example.com"] },
        }),
        GOOGLE_CLIENT_ID: "", // Explicit empty deployment value disables the provider.
        GOOGLE_CLIENT_SECRET: "fixture-only",
      };
      delete env.KOMO_CONFIG;
      const start = async () => {
        output = "";
        child = spawn(
          process.env.KOMO_TEST_NODE_BINARY ?? process.execPath,
          [join(packageRoot, "cli/index.mjs"), "serve"],
          { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"] },
        );
        child.stdout?.on("data", (data) => {
          output += data;
        });
        child.stderr?.on("data", (data) => {
          output += data;
        });
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(Error(`Node config startup timed out: ${output}`)),
            10000,
          );
          child!.once("error", reject);
          child!.once("exit", () => {
            clearTimeout(timeout);
            reject(Error(`Node config startup exited: ${output}`));
          });
          child!.stdout?.on("data", () => {
            if (output.includes("komo API listening")) {
              clearTimeout(timeout);
              resolve();
            }
          });
        });
      };
      const request = (project: string, origin = "https://site.example.com") =>
        fetch(`${env.PUBLIC_URL}/config?project=${project}`, {
          headers: { Origin: origin },
        });
      await start();
      expect((await fetch(`${env.PUBLIC_URL}/health`)).status).toBe(200);
      expect(await (await request("review")).json()).toMatchObject({
        repo: "team/site",
        guests: false,
        google: false,
      });
      expect((await request("legacy")).status).toBe(404);
      expect(
        (await request("review", "https://unapproved.example.com")).status,
      ).toBe(403);
      await stop();
      await rm(join(dir, "komo.config.ts"));
      await start();
      expect(await (await request("legacy")).json()).toMatchObject({
        repo: "old/site",
        guests: true,
      });
      expect((await request("review")).status).toBe(404);
    } finally {
      await stop();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
      await rm(dir, { recursive: true, force: true });
    }
  },
  30000,
);
