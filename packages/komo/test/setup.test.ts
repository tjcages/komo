import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const cli = fileURLToPath(new URL("../cli/index.mjs", import.meta.url));
const config = { endpoint: "https://api.example.com", project: "project-id" };
describe("simple komo setup", () => {
  it("defaults to project scope and requires a branch only when requested", () => {
    expect(resolveConfig({ project: "project-id" }).endpoint).toBe(
      "https://komo-api.off-brand.workers.dev"
    );
    expect(resolveConfig(config)).toMatchObject({
      repo: "project-id",
      branch: "shared",
    });
    expect(
      resolveConfig({ ...config, repo: "owner/site", branch: "ignored" }).branch
    ).toBe("shared");
    expect(
      resolveConfig({ ...config, scope: "branch", branch: "feature/menu" })
        .branch
    ).toBe("feature/menu");
    expect(() => resolveConfig({ ...config, scope: "branch" })).toThrow(
      "build-time branch"
    );
  });
  it("generates a secret-free two-line integration and refreshes branch metadata", async () => {
    const dir = await mkdtemp(join(tmpdir(), "komo-cli-"));
    const server = createServer((req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify(
          req.url === "/setup/start"
            ? {
                id: "setup",
                secret: "fixture-poll-secret",
                url: "https://example.com/setup",
              }
            : {
                endpoint: "https://api.example.com",
                project: "generated",
                repo: "owner/site",
              }
        )
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw Error("Missing test port");
    try {
      const initialized = await promisify(execFile)(
        process.execPath,
        [
          cli,
          "init",
          "--endpoint",
          `http://127.0.0.1:${address.port}`,
          "--branch-scope",
        ],
        {
          cwd: dir,
          env: {
            ...process.env,
            CF_PAGES_URL: "https://site.example.com",
            KOMO_BRANCH: "preview/one",
          },
          timeout: 10000,
        }
      );
      expect(initialized.stdout).toContain("from '@tjcages/komo'");
      expect(initialized.stdout).not.toContain("fixture-poll-secret");
      const generated = await readFile(join(dir, "komo.config.js"), "utf8");
      expect(generated).toContain("from '@tjcages/komo/setup'");
      expect(generated).toContain("preview/one");
      expect(generated).not.toContain("fixture-poll-secret");
      await promisify(execFile)(process.execPath, [cli, "sync"], {
        cwd: dir,
        env: { ...process.env, KOMO_BRANCH: "preview/two" },
      });
      expect(await readFile(join(dir, "komo.config.js"), "utf8")).toContain(
        "preview/two"
      );
      await expect(
        promisify(execFile)(process.execPath, [cli, "init"], { cwd: dir })
      ).rejects.toThrow();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(dir, { recursive: true, force: true });
    }
  });
});
