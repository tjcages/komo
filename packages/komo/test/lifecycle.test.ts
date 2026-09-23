// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { initComments } from "../src/index";
import type { CommentsController, CommentsOptions } from "../src/types";

let controller: CommentsController | undefined;
const options: CommentsOptions = {
  endpoint: "https://example.test",
  project: "fixture",
  repo: "fixture",
  branch: "main",
  onboarding: { inProject: true },
};
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  controller?.destroy();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
it("rejects another scope and keeps a replacement safe from stale teardown", () => {
  const first = initComments(options);
  controller = first;
  expect(initComments({ ...options })).toBe(first);
  for (const change of [
    { project: "other" },
    { branch: "other" },
    { endpoint: "https://other.test" },
  ])
    expect(() => initComments({ ...options, ...change })).toThrow(
      "Destroy the current",
    );
  first.destroy();
  controller = initComments({ ...options, branch: "next" });
  const host = [...document.body.children].find((node) => node.shadowRoot)!;
  document.body.style.background = "red";
  first.destroy();
  first.open();
  first.close();
  expect(host.isConnected).toBe(true);
  expect(document.body.style.background).toBe("red");
  expect(initComments({ ...options, branch: "next" })).toBe(controller);
});

it("rejects unsafe endpoint schemes and embedded credentials before mounting", () => {
  for (const endpoint of ["ftp://localhost", "http://public.example.test", "https://user:password@example.test"])
    expect(() => initComments({ ...options, endpoint })).toThrow("HTTPS API endpoint");
  expect(document.body.children).toHaveLength(0);
});
