import { describe, expect, it, vi } from "vitest";
import worker from "../../komo-site/worker/index";

describe("branded API routing", () => {
  it.each([
    "/auth/google/callback?code=test",
    "/setup",
    "/setup-client.js",
    "/threads/123/comments",
    "/config",
    "/workspace/sites",
    "/usage",
    "/health",
  ])("forwards %s without rewriting the origin", async (path) => {
    const response = new Response("api", {
      headers: { "Set-Cookie": "test=value; Secure" },
    });
    const fetch = vi.fn().mockResolvedValue(response);
    const assets = vi.fn();
    const request = new Request(`https://komo.offbr.co${path}`, {
      method: "POST",
      headers: { Authorization: "Bearer test" },
      body: "payload",
    });
    const result = await worker.fetch(request, {
      KOMO_API: { fetch },
      ASSETS: { fetch: assets },
    } as never);
    expect(fetch).toHaveBeenCalledWith(request);
    expect(assets).not.toHaveBeenCalled();
    expect(result).toBe(response);
    expect(await request.text()).toBe("payload");
  });
  it.each([
    "/",
    "/configuration/",
    "/install/",
    "/assets/site.js",
    "/author",
    "/projects",
  ])("keeps %s on the website", async (path) => {
    const fetch = vi.fn().mockResolvedValue(new Response("site"));
    const api = vi.fn();
    const request = new Request(`https://komo.offbr.co${path}`);
    await worker.fetch(request, {
      ASSETS: { fetch },
      KOMO_API: { fetch: api },
    } as never);
    expect(fetch).toHaveBeenCalledWith(request);
    expect(api).not.toHaveBeenCalled();
  });
});
