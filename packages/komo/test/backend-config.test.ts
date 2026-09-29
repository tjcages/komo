import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { defineKomoConfig } from "../src/server-config";
import {
  komoConfigEnvironment,
  validateKomoServerConfig,
} from "../server/komo-config";
import { loadKomoServerConfig } from "../server/node-config";

const project = {
  repo: "team/site",
  origins: [
    "https://site.example.com",
    "https://pr-*.example.com",
    "http://localhost:3000",
  ],
};
const cli = fileURLToPath(new URL("../cli/index.mjs", import.meta.url));
const exec = promisify(execFile);

describe("backend config", () => {
  it("preserves existing project policies and public provider settings", () => {
    const config = defineKomoConfig({
      projects: {
        review: {
          ...project,
          allowGuests: false,
          allowGuestResolve: false,
          requireOwner: true,
          bootstrapHash: "a".repeat(64),
          suspended: true,
          writesPerDay: 0,
          retainedCommentsPerUser: 3,
        },
      },
      googleClientId: "google-public",
      githubClientId: "github-public",
      publicUrl: "https://comments.example.com",
      port: 8081,
      proxyHops: 1,
    });
    const env = komoConfigEnvironment(config);
    expect(JSON.parse(env.PROJECTS)).toEqual(config.projects);
    expect(env.GOOGLE_CLIENT_ID).toBe("google-public");
    expect(env).not.toHaveProperty("GOOGLE_CLIENT_SECRET");
  });

  it.each([
    { projects: { review: { ...project, allowGuests: "false" } } },
    { projects: { review: { ...project, writesPerDay: -1 } } },
    {
      projects: {
        review: { ...project, origins: ["https://example.com/path"] },
      },
    },
    { projects: { review: { ...project, origins: ["https://*.com"] } } },
    { projects: { review: { ...project, bootstrapHash: "raw-owner-secret" } } },
    { projects: { _komo: project } },
    {
      projects: { review: project },
      googleClientSecret: "never-print-this-secret",
    },
    { projects: { review: project }, publicUrl: "https://example.com/path" },
    { projects: { review: project }, port: 0 },
    { projects: { review: project }, proxyHops: 9 },
    { projects: [] },
  ])("rejects invalid policy without exposing values: %j", (config) => {
    expect(() => validateKomoServerConfig(config)).toThrow(
      "Invalid komo backend config:",
    );
    try {
      validateKomoServerConfig(config);
    } catch (error) {
      expect(String(error)).not.toContain("never-print-this-secret");
      expect(String(error)).not.toContain("raw-owner-secret");
    }
  });

  it("loads TypeScript imports, respects explicit paths, and fails on invalid or missing explicit config", async () => {
    const dir = await mkdtemp(join(tmpdir(), "komo-backend-config-"));
    try {
      expect(await loadKomoServerConfig(dir, undefined)).toBeUndefined();
      await writeFile(
        join(dir, "projects.ts"),
        `export const projects: Record<string, unknown> = ${JSON.stringify({ review: project })};`,
      );
      await writeFile(
        join(dir, "komo.config.ts"),
        "import { projects } from './projects'; export default { projects, port: 8082 };",
      );
      expect(await loadKomoServerConfig(dir)).toMatchObject({
        projects: { review: project },
        port: 8082,
      });
      await writeFile(
        join(dir, "custom.ts"),
        "export default { projects: {}, port: 9090 };",
      );
      expect(await loadKomoServerConfig(dir, "custom.ts")).toMatchObject({
        port: 9090,
      });
      await expect(loadKomoServerConfig(dir, "missing.ts")).rejects.toThrow(
        "Cannot read komo backend config",
      );
      await writeFile(
        join(dir, "custom.ts"),
        "export default { projects: {}, port: -1 };",
      );
      await expect(loadKomoServerConfig(dir, "custom.ts")).rejects.toThrow(
        "port must",
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("generates editable Node config and a public-only helper, then preserves backend edits during sync", async () => {
    const dir = await mkdtemp(join(tmpdir(), "komo-node-init-"));
    try {
      await exec(
        process.execPath,
        [
          cli,
          "init",
          "--node",
          "--endpoint",
          "https://comments.example.com",
          "--origin",
          "https://site.example.com",
          "--repo",
          "team/site",
          "--google-client-id",
          "public-client",
        ],
        { cwd: dir },
      );
      const path = join(dir, "komo.config.ts");
      const backend = await readFile(path, "utf8");
      expect(backend).toContain("defineKomoConfig");
      expect(backend).toContain('"requireOwner": true');
      const key = await readFile(join(dir, ".komo/owner-key"), "utf8");
      expect(backend).not.toContain(key);
      const client = await readFile(join(dir, ".komo/client.js"), "utf8");
      expect(client).not.toMatch(
        /bootstrapHash|public-client|GOOGLE_CLIENT_SECRET/,
      );
      const secrets = await readFile(join(dir, ".komo/node.env"), "utf8");
      expect(secrets).toContain("DATABASE_URL=");
      expect(secrets).not.toContain("PROJECTS=");
      expect(await readFile(join(dir, ".gitignore"), "utf8")).not.toContain(
        "komo.config.ts",
      );
      await writeFile(path, `${backend}\n// operator edit\n`);
      await exec(process.execPath, [cli, "sync"], { cwd: dir });
      expect(await readFile(path, "utf8")).toBe(
        `${backend}\n// operator edit\n`,
      );
      await expect(
        readFile(join(dir, "komo.config.js"), "utf8"),
      ).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
