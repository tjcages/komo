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
  Object.defineProperty(document, "elementsFromPoint", {
    configurable: true,
    value: () => [],
  });
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

it("clears private cached feedback and identity immediately on another tab's logout", async () => {
  const { CommentsApi } = await import("../src/api");
  const config = { ...options, onboarding: undefined };
  const api = new CommentsApi(config);
  api.save({
    token: "private-session",
    user: { id: "reviewer", name: "Private Reviewer", verified: true },
  });
  localStorage.setItem(
    `${api.sessionKey}:${JSON.stringify([config.repo, "local"])}:threads`,
    JSON.stringify({
      token: api.token,
      threads: [
        {
          id: "private",
          page: "/",
          resolved: false,
          resolvedBy: null,
          createdAt: 1,
          updatedAt: 1,
          anchor: {
            selector: "body",
            text: "",
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            pageX: 0,
            pageY: 0,
            viewportWidth: 1200,
          },
          comments: [
            {
              id: "comment",
              body: "Private feedback",
              author: api.user,
              createdAt: 1,
              editedAt: null,
              reactions: {},
            },
          ],
        },
      ],
    }),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  controller = initComments(config);
  controller.open();
  const shadow = [...document.body.children].find(
    (node) => node.shadowRoot,
  )!.shadowRoot!;
  expect(shadow.textContent).toContain("Private feedback");
  expect(
    shadow.querySelector('[aria-label="Private Reviewer · Account"]'),
  ).not.toBeNull();
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: "another-project",
      storageArea: localStorage,
    }),
  );
  expect(shadow.textContent).toContain("Private feedback");
  localStorage.removeItem(api.sessionKey);
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: api.sessionKey,
      newValue: null,
      storageArea: localStorage,
    }),
  );
  expect(shadow.textContent).not.toContain("Private feedback");
  expect(
    shadow.querySelector('[aria-label="Private Reviewer · Account"]'),
  ).toBeNull();
  expect(shadow.querySelector('[aria-label="Enter your name"]')).not.toBeNull();
  localStorage.clear();
});
