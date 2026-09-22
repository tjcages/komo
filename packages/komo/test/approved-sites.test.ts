// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { CommentsApi } from "../src/api";
import { originAllowed, sitePattern } from "../server/validation";
import { approvedSites, siteInput } from "../src/approved-sites";

const valid: Array<[string, string]> = [
  ["https://your-site.com", "https://your-site.com"],
  ["https://Your-Site.com/", "https://your-site.com"],
  ["https://*.your-site.com", "https://*.your-site.com"],
  [
    "https://*-komo-site.off-brand.workers.dev",
    "https://*-komo-site.off-brand.workers.dev",
  ],
  [
    "https://preview-*.your-site.com:8443",
    "https://preview-*.your-site.com:8443",
  ],
  ["http://localhost:4340", "http://localhost:4340"],
];
const invalid = [
  "https://*.com",
  "https://*",
  "https://a.*.your-site.com",
  "https://**.your-site.com",
  "https://*-a-*.your-site.com",
  "http://your-site.com",
  "https://your-site.com/path",
  "https://user@your-site.com",
  "https://your-site.com?x=1",
  "javascript:alert(1)",
];

describe("approved site patterns", () => {
  it("accepts exact origins, localhost, and leftmost-label wildcards", () => {
    for (const [input, site] of valid) expect(sitePattern(input)).toBe(site);
  });
  it("rejects broad, nested, or non-origin patterns", () => {
    for (const input of invalid)
      expect(() => sitePattern(input), input).toThrow();
    expect(() => sitePattern(42)).toThrow();
  });
  it("matches the saved preview wildcard against branch previews only", () => {
    const sites = [sitePattern("https://*-komo-site.off-brand.workers.dev")];
    expect(
      originAllowed(
        "https://feature-edge-sidebar-komo-site.off-brand.workers.dev",
        sites
      )
    ).toBe(true);
    expect(
      originAllowed("https://komo-site.off-brand.workers.dev", sites)
    ).toBe(false);
    expect(
      originAllowed("https://x.y-komo-site.off-brand.workers.dev", sites)
    ).toBe(false);
    expect(
      originAllowed(
        "https://evil-komo-site.off-brand.workers.dev.evil.com",
        sites
      )
    ).toBe(false);
  });
  it("normalizes typed sites the same way in the editor", () => {
    for (const [input, site] of valid) expect(siteInput(input)).toBe(site);
    expect(siteInput("your-site.com")).toBe("https://your-site.com");
    expect(siteInput("*-preview.your-site.com")).toBe(
      "https://*-preview.your-site.com"
    );
    for (const input of invalid.filter(
      (value) => value !== "http://your-site.com"
    ))
      expect(() => siteInput(input), input).toThrow();
  });
});

describe("approved sites editor", () => {
  const fakeApi = (fail = false) => {
    const calls: Array<[string, string, unknown]> = [];
    let sites = ["https://preview.example.com"];
    const api = {
      async request(path: string, method = "GET", data?: { sites: string[] }) {
        calls.push([path, method, data]);
        if (method === "PATCH") {
          if (fail) throw new Error("Only the workspace owner can do that.");
          sites = data!.sites;
        }
        return { sites, fixed: ["https://example.com"] };
      },
    } as unknown as CommentsApi;
    return { api, calls };
  };
  const flush = () => new Promise((resolve) => setTimeout(resolve));
  const labels = (root: HTMLElement) =>
    [...root.querySelectorAll(".approved-site > span")].map(
      (n) => n.textContent
    );

  it("lists config sites as fixed and saves added and removed sites", async () => {
    const { api, calls } = fakeApi();
    const editor = (await approvedSites(api, "?workspace=w1"))!;
    expect(labels(editor)).toEqual(["example.com", "preview.example.com"]);
    expect(editor.querySelectorAll(".approved-site button")).toHaveLength(1);
    editor.querySelector("input")!.value = "*-komo-site.off-brand.workers.dev";
    editor
      .querySelector<HTMLButtonElement>(".approved-site-add button")!
      .click();
    await flush();
    expect(calls.at(-1)).toEqual([
      "project/sites?workspace=w1",
      "PATCH",
      {
        sites: [
          "https://preview.example.com",
          "https://*-komo-site.off-brand.workers.dev",
        ],
      },
    ]);
    expect(labels(editor)).toContain("*-komo-site.off-brand.workers.dev");
    editor.querySelector<HTMLButtonElement>(".approved-site button")!.click();
    await flush();
    expect(calls.at(-1)![2]).toEqual({
      sites: ["https://*-komo-site.off-brand.workers.dev"],
    });
  });

  it("restores the list and the typed site when saving fails", async () => {
    const { api } = fakeApi(true);
    const editor = (await approvedSites(api))!;
    const input = editor.querySelector("input")!;
    input.value = "https://new.example.com";
    editor
      .querySelector<HTMLButtonElement>(".approved-site-add button")!
      .click();
    await flush();
    expect(labels(editor)).toEqual(["example.com", "preview.example.com"]);
    expect(input.value).toBe("https://new.example.com");
    expect(editor.querySelector("[role=status]")!.textContent).toMatch(/owner/);
  });

  it("stays hidden for viewers who cannot manage the project", async () => {
    const api = {
      request: async () => {
        throw new Error("403");
      },
    } as unknown as CommentsApi;
    expect(await approvedSites(api)).toBeNull();
  });
});
