import { createServer } from "node:http";
import { spawn, execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";

it("keeps login credentials private and rejects a foreign callback origin", async () => {
  const directory = await mkdtemp(join(tmpdir(), "komo-login-test-"));
  let returnOrigin = "",
    revoked = false;
  const user = { id: "google:test", name: "CLI reviewer", verified: true };
  const api = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url?.startsWith("/auth/google/start")) {
      let body = "";
      for await (const chunk of req) body += chunk;
      returnOrigin = JSON.parse(body).returnOrigin;
      res.end(
        JSON.stringify({
          url: `http://127.0.0.1:${(api.address() as { port: number }).port}/auth/google/authorize?state=fixture`,
        })
      );
    } else if (req.url?.startsWith("/config"))
      res.end(JSON.stringify({ repo: "owner/site" }));
    else if (req.headers.authorization === "Bearer test-session-secret") {
      if (req.method === "DELETE") revoked = true;
      res.end(JSON.stringify({ user }));
    } else {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: "Invalid token" }));
    }
  });
  await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
  const endpoint = `http://127.0.0.1:${(api.address() as { port: number }).port}`;
  const entry = fileURLToPath(new URL("../cli/index.mjs", import.meta.url));
  const env = {
    ...process.env,
    KOMO_CONFIG_HOME: directory,
    KOMO_PROJECT: "fixture",
    KOMO_ENDPOINT: endpoint,
    KOMO_ORIGIN: "http://localhost:3000",
    KOMO_TOKEN: "",
  };
  const child = spawn(process.execPath, [entry, "login", "--no-open"], {
    env,
    cwd: directory,
  });
  let stdout = "",
    stderr = "";
  child.stdout.on("data", (data) => {
    stdout += data;
  });
  const exited = new Promise<number | null>((resolve) =>
    child.once("exit", resolve)
  );
  try {
    const url = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(Error("Login did not start")),
        5000
      );
      child.stderr.on("data", (data) => {
        stderr += data;
        const match = stderr.match(/http:\/\/127\.0\.0\.1:\d+\/[a-f0-9]{64}/);
        if (match) {
          clearTimeout(timeout);
          resolve(match[0]);
        }
      });
    });
    expect(new URL(url).origin).toBe(returnOrigin);
    const page = await fetch(url);
    expect(page.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'"
    );
    expect(await page.text()).toContain("Continue with Google");
    const post = (origin: string, token: string) =>
      fetch(url, {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
    expect(
      (await post("https://evil.example", "test-session-secret")).status
    ).toBe(403);
    expect((await post(returnOrigin, "wrong-token")).status).toBe(400);
    expect((await readdir(directory)).length).toBe(0);
    expect((await post(returnOrigin, "test-session-secret")).status).toBe(200);
    expect(await exited).toBe(0);
    expect(JSON.parse(stdout).data.user).toEqual(user);
    expect(stdout + stderr).not.toContain("test-session-secret");
    const [file] = await readdir(directory);
    expect(
      JSON.parse(await readFile(join(directory, file), "utf8")).token
    ).toBe("test-session-secret");
    expect((await stat(join(directory, file))).mode & 0o777).toBe(0o600);
    await promisify(execFile)(process.execPath, [entry, "logout"], {
      env,
      cwd: directory,
    });
    expect(revoked).toBe(true);
    expect(await readdir(directory)).toHaveLength(0);
  } finally {
    child.kill();
    api.close();
    api.closeAllConnections();
    await rm(directory, { recursive: true, force: true });
  }
});
