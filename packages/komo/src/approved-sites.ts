import type { CommentsApi } from "./api.js";
import { button, el, icon } from "./dom.js";

type SiteList = { sites: string[]; fixed: string[] };

/** Normalize a typed site into an origin, keeping a `*` host wildcard. */
export function siteInput(value: string): string {
  const site = value.trim().replace(/\/$/, "").toLowerCase();
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(site)) return site;
  const match = /^https:\/\/([^/?#@\s]+)$/.exec(
    site.includes("://") ? site : `https://${site}`
  );
  const [first = "", ...rest] = (match?.[1] ?? "").split(".");
  if (
    !match ||
    rest.length < 1 ||
    rest.join(".").includes("*") ||
    first.split("*").length > 2 ||
    (first.includes("*") && rest.length < 2)
  )
    throw new Error(
      "Use a site like https://your-site.com, or a wildcard like https://*-preview.your-site.com."
    );
  return `https://${match[1]}`;
}

/**
 * Owner-only editor for the sites allowed to load this project's comments.
 * Resolves to null when the viewer cannot manage the project.
 */
export async function approvedSites(
  api: CommentsApi,
  suffix = ""
): Promise<HTMLElement | null> {
  let list: SiteList;
  try {
    list = await api.request<SiteList>(`project/sites${suffix}`);
  } catch {
    return null;
  }
  const section = el("div", "approved-sites-editor");
  const heading = el("div", "account-usage-label");
  const count = el("span");
  heading.append(el("span", "", "Approved sites"), count);
  const rows = el("ul", "approved-site-list");
  const status = el("p", "account-usage-status");
  status.setAttribute("role", "status");
  const form = el("div", "approved-site-add");
  const input = el("input");
  input.type = "text";
  input.inputMode = "url";
  input.spellcheck = false;
  input.placeholder = "https://*-preview.your-site.com";
  input.setAttribute("aria-label", "Site to approve");
  input.setAttribute("autocomplete", "off");
  const note = el("div", "account-usage-note account-sites-note");
  note.append(
    icon("info"),
    el(
      "span",
      "",
      "Approved sites can show and share comments. Use * in the first part of the address to match preview URLs."
    )
  );
  const save = async (next: string[]) => {
    const previous = list.sites;
    list = { ...list, sites: next };
    render();
    status.textContent = "";
    try {
      list = await api.request<SiteList>(`project/sites${suffix}`, "PATCH", {
        sites: next,
      });
      render();
      return true;
    } catch (error) {
      list = { ...list, sites: previous };
      render();
      status.textContent =
        error instanceof Error ? error.message : "Try again.";
      return false;
    }
  };
  const add = button(
    "Add",
    async () => {
      let site: string;
      try {
        site = siteInput(input.value);
      } catch (error) {
        status.textContent = (error as Error).message;
        return;
      }
      if (list.fixed.includes(site) || list.sites.includes(site)) {
        input.value = "";
        status.textContent = "That site is already approved.";
        return;
      }
      const typed = input.value;
      input.value = "";
      add.disabled = true;
      if (!(await save([...list.sites, site]))) input.value ||= typed;
      add.disabled = false;
      input.focus();
    },
    "secondary"
  );
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      add.click();
    }
  });
  form.append(input, add);
  const row = (site: string, removable: boolean) => {
    const item = el("li", "approved-site");
    const label = el("span", "", site.replace(/^https:\/\//, ""));
    label.title = site;
    item.append(label);
    if (removable)
      item.append(
        button(
          `Remove ${site}`,
          () => void save(list.sites.filter((value) => value !== site)),
          "icon",
          "close"
        )
      );
    else item.title = "Set in the project config";
    return item;
  };
  const render = () => {
    count.textContent = String(list.fixed.length + list.sites.length);
    rows.replaceChildren(
      ...list.fixed.map((site) => row(site, false)),
      ...list.sites.map((site) => row(site, true))
    );
  };
  render();
  section.append(heading, rows, form, note, status);
  return section;
}
