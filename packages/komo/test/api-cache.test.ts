import { afterEach, expect, it, vi } from "vitest";
import { CommentsApi } from "../src/api";

afterEach(() => vi.unstubAllGlobals());
it("reuses the revision cache and replaces it when comments change", async () => {
  vi.stubGlobal("location", { hostname: "localhost" });
  vi.stubGlobal("document", { cookie: "" });
  vi.stubGlobal("localStorage", { getItem: () => null });
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ threads: [{ id: "first" }], revision: 1 })
    )
    .mockResolvedValueOnce(Response.json({ notModified: true }))
    .mockResolvedValueOnce(
      Response.json({ threads: [{ id: "second" }], revision: 2 })
    );
  vi.stubGlobal("fetch", fetch);
  const api = new CommentsApi({
    endpoint: "https://example.com/api/",
    project: "test",
    repo: "test",
    branch: "main",
  });
  const first = await api.list();
  expect(await api.list()).toBe(first);
  expect(fetch.mock.calls[1][0].searchParams.get("revision")).toBe("1");
  const changed = await api.list();
  expect(changed).not.toBe(first);
  expect(changed).toEqual([{ id: "second" }]);
});

it("explains network and CORS failures without claiming the cause is known", async () => {
  vi.stubGlobal("location", { hostname: "localhost" });
  vi.stubGlobal("document", { cookie: "" });
  vi.stubGlobal("localStorage", { getItem: () => null });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
  );
  const api = new CommentsApi({
    endpoint: "https://example.com",
    project: "test",
    repo: "test",
    branch: "shared",
  });
  await expect(api.request("config")).rejects.toThrow(
    "Can’t connect to comments."
  );
});

it("persists the last list so a new page load reuses it", async () => {
  const store = new Map<string, string>();
  vi.stubGlobal("location", { hostname: "localhost" });
  vi.stubGlobal("document", { cookie: "" });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ threads: [{ id: "first" }], revision: 1 })
    )
    .mockResolvedValueOnce(Response.json({ notModified: true }));
  vi.stubGlobal("fetch", fetch);
  const options = {
    endpoint: "https://example.com/api/",
    project: "test",
    repo: "test",
    branch: "main",
  };
  await new CommentsApi(options).list();
  const reloaded = new CommentsApi(options);
  expect(reloaded.cached()).toEqual([{ id: "first" }]);
  expect(await reloaded.list()).toEqual([{ id: "first" }]);
  expect(fetch.mock.calls[1][0].searchParams.get("revision")).toBe("1");
  expect(new CommentsApi({ ...options, branch: "other" }).cached()).toBeNull();
  reloaded.clear();
  expect(new CommentsApi(options).cached()).toBeNull();
});
