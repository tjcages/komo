import type { AccountUsage } from "./types.js";
import type { CommentsApi } from "./api.js";
import { el, button } from "./dom.js";
import { approvedSites } from "./approved-sites.js";

export function accountUsage(api: CommentsApi, path = "usage", sites = true) {
  const usagePanel = el("section", "account-usage");
  usagePanel.setAttribute("aria-label", "Account usage");
  const skeleton = (className = "") => {
    const item = el("span", `usage-skeleton ${className}`);
    item.setAttribute("aria-hidden", "true");
    return item;
  };
  const showSkeleton = () => {
    const heading = el("div", "usage-skeleton-heading");
    heading.append(skeleton("usage-skeleton-title"));
    const comments = el("div", "account-usage-label account-comments");
    const count = el("span", "account-comment-count");
    count.append(
      skeleton("usage-skeleton-count"),
      skeleton("usage-skeleton-ring")
    );
    comments.append(skeleton("usage-skeleton-label"), count);
    const projects = el("div", "account-projects");
    const projectHeading = el("div", "account-usage-label");
    projectHeading.append(
      skeleton("usage-skeleton-label"),
      skeleton("usage-skeleton-count")
    );
    const slots = el("div", "account-project-slots");
    slots.setAttribute("aria-hidden", "true");
    slots.append(el("span"), el("span"), el("span"));
    projects.append(projectHeading, slots);
    const announcement = el("span", "sr-only", "Loading account usage");
    announcement.setAttribute("role", "status");
    usagePanel.setAttribute("aria-busy", "true");
    usagePanel.replaceChildren(heading, comments, projects, announcement);
  };
  const usageUser = api.user?.id;
  // Owners get the approved-sites editor below their usage.
  const showSites = async () => {
    const query = path.includes("?") ? path.slice(path.indexOf("?")) : "";
    const editor = await approvedSites(api, query);
    if (editor && usagePanel.isConnected && api.user?.id === usageUser)
      usagePanel.append(editor);
  };
  const loadUsage = async () => {
    showSkeleton();
    try {
      const usage = await api.request<AccountUsage>(path);
      if (!usagePanel.isConnected || api.user?.id !== usageUser) return;
      if (sites && api.user?.verified) void showSites().catch(() => {});
      usagePanel.setAttribute("aria-busy", "false");
      usagePanel.replaceChildren(
        el("h3", "", usage.hosted ? "Starter plan" : "Self-hosted")
      );
      const { used, limit } = usage.comments;
      const comments = el("div", "account-usage-label account-comments");
      const commentUsage = el("span", "account-comment-count");
      commentUsage.append(
        el(
          "span",
          "",
          limit === null
            ? `${used.toLocaleString()} / Unlimited`
            : `${used.toLocaleString()} / ${limit.toLocaleString()}`
        )
      );
      comments.title = "Includes replies and deleted comments.";
      if (limit !== null) {
        const ring = el("span", "account-usage-ring");
        ring.setAttribute("role", "meter");
        ring.setAttribute("aria-label", "Project comments");
        ring.setAttribute("aria-valuemin", "0");
        ring.setAttribute("aria-valuemax", String(limit));
        ring.setAttribute("aria-valuenow", String(Math.min(used, limit)));
        ring.setAttribute(
          "aria-valuetext",
          `${used} of ${limit} comments used, including replies and deleted comments`
        );
        ring.style.setProperty(
          "--usage",
          `${limit > 0 ? Math.min(used / limit, 1) * 100 : 0}%`
        );
        ring.dataset.full = String(used >= limit);
        commentUsage.append(ring);
      }
      comments.append(el("span", "", "Project comments"), commentUsage);
      usagePanel.append(comments);
      if (usage.projects) {
        const { used, limit } = usage.projects;
        if (limit === null) {
          const row = el("div", "account-usage-label");
          row.append(
            el("span", "", "Projects"),
            el("span", "", `${used.toLocaleString()} / Unlimited`)
          );
          usagePanel.append(row);
          return;
        }
        const projects = el("div", "account-projects");
        const heading = el("div", "account-usage-label");
        const count = el("span", "account-project-count");
        count.append(
          el("strong", "", String(used)),
          el("span", "", `of ${limit}`)
        );
        heading.append(el("span", "", "Projects"), count);
        const slots = el("div", "account-project-slots");
        slots.setAttribute("role", "meter");
        slots.setAttribute("aria-label", "Projects");
        slots.setAttribute("aria-valuemin", "0");
        slots.setAttribute("aria-valuemax", String(limit));
        slots.setAttribute("aria-valuenow", String(used));
        slots.setAttribute(
          "aria-valuetext",
          `${used} of ${limit} projects used`
        );
        for (let i = 0; i < limit; i++) {
          const slot = el("span");
          slot.dataset.used = String(i < used);
          slots.append(slot);
        }
        projects.append(heading, slots);
        usagePanel.append(projects);
      }
    } catch {
      if (!usagePanel.isConnected || api.user?.id !== usageUser) return;
      usagePanel.setAttribute("aria-busy", "false");
      usagePanel.replaceChildren(
        el("span", "account-usage-status", "Usage unavailable"),
        button("Retry", () => void loadUsage(), "secondary")
      );
    }
  };
  void loadUsage();
  return usagePanel;
}
