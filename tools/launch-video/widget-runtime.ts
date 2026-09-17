import { initComments } from "../../packages/komo/src/index";
import type { Thread } from "../../packages/komo/src/types";

// Entire product renderer is unmodified. Only its transport is a local fixture.
const endpoint = "https://komo-launch-fixture.invalid/";
const me = {
  id: "demo-designer",
  name: "Maya",
  verified: false,
  accentColor: "#bba2ee",
};
const other = {
  id: "demo-reviewer",
  name: "Alex",
  verified: false,
  accentColor: "#91b9df",
};
let threads: Thread[] = [],
  counter = 0;
const response = (data: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    }),
  );
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const u = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );
  if (u.origin !== new URL(endpoint).origin)
    throw Error("Launch fixture blocks external API requests.");
  const path = u.pathname.slice(1),
    data = init?.body ? JSON.parse(String(init.body)) : {};
  if (path === "config")
    return response({
      github: false,
      google: false,
      guests: true,
      guestResolve: true,
    });
  if (path === "me") return response({ user: me });
  if (path === "threads" && init?.method === "POST") {
    const id = `posted-${++counter}`,
      commentId = `${id}-comment`,
      now = Date.now();
    threads.push({
      id,
      page: "/",
      anchor: data.anchor,
      resolved: false,
      resolvedBy: null,
      createdAt: now,
      updatedAt: now,
      comments: [
        {
          id: commentId,
          body: data.body,
          author: me,
          createdAt: now,
          editedAt: null,
          reactions: {},
        },
      ],
    });
    return response({ id, commentId });
  }
  if (path === "threads") return response({ threads, next: null });
  if (path.endsWith("/comments")) {
    const t = threads.find((t) => t.id === path.split("/")[1]),
      id = `reply-${++counter}`;
    t?.comments.push({
      id,
      body: data.body,
      author: me,
      createdAt: Date.now(),
      editedAt: null,
      reactions: {},
    });
    return response({ id });
  }
  return response({});
}) as typeof fetch;
localStorage.setItem(
  `branch-comments:${endpoint}:launch-fixture`,
  "fixture-only-not-a-credential",
);
const controller = initComments({
  endpoint,
  project: "launch-fixture",
  repo: "komo/launch-fixture",
  branch: "demo",
  page: () => "/",
  autoHideDrawer: false,
  pageRoot: document.querySelector<HTMLElement>("#website")!,
  pollInterval: 3600000,
});
const root = () =>
  document.querySelector("[data-branch-comments]")!.shadowRoot!;
const seeds = [
  ["#headline", "Love this direction."],
  ["#hero-cta", "Can we try lavender here?"],
  ["#detail-title", "This is the bit I meant."],
  ["#detail-card", "Keep this little detail."],
  ["#bottom-title", "One more thought down here."],
];
function seed(n: number) {
  threads = seeds.slice(0, n).map(([selector, body], i) => {
    const e = document.querySelector(selector)!,
      r = e.getBoundingClientRect(),
      now = Date.now() - 60000;
    return {
      id: `demo-${i}`,
      page: "/",
      anchor: {
        selector,
        text: e.textContent ?? "",
        x: 0.6,
        y: 0.5,
        width: 0,
        height: 0,
        pageX: r.left + scrollX,
        pageY: r.top + scrollY,
        viewportWidth: 1280,
      },
      resolved: false,
      resolvedBy: null,
      createdAt: now,
      updatedAt: now,
      comments: [
        {
          id: `comment-${i}`,
          body,
          author: i % 2 ? other : me,
          createdAt: now,
          editedAt: null,
          reactions: {},
        },
      ],
    };
  });
}
let posted = false;
let count = -1,
  mode = "",
  ready = false,
  busy = false,
  desired: any;
async function apply() {
  if (busy || !desired || !ready) return;
  busy = true;
  try {
    const s = desired;
    if (s.count !== count) {
      count = s.count;
      seed(count);
      await controller.refresh();
    }
    if (s.mode !== mode) {
      if (mode === "drawer")
        root().querySelector<HTMLButtonElement>('[data-menu-item="close"]')?.click();
      mode = s.mode;
      posted = false;
      controller.close();
      if (mode === "sidebar" || mode === "sidebar-thread") {
        controller.open();
        if (mode === "sidebar-thread")
          root()
            .querySelector<HTMLButtonElement>(
              '.thread-card[data-thread="demo-2"]',
            )
            ?.click();
      }
      if (mode === "thread")
        root()
          .querySelector<HTMLButtonElement>('.pin[data-thread="demo-2"]')
          ?.click();
      if (mode === "compose")
        controller.comment(document.querySelector("#detail-card")!);
      if (mode === "drawer")
        root()
          .querySelector<HTMLButtonElement>('[data-menu-item="more"]')
          ?.click();
    }
    if (mode === "compose") {
      const input = root().querySelector<HTMLTextAreaElement>(
        'textarea[aria-label="Comment"]',
      );
      if (input) {
        input.value = "Can we make this a little bigger?".slice(
          0,
          Math.floor(33 * s.typing),
        );
        input.dispatchEvent(new Event("input", { bubbles: true }));
        if (s.submit && !posted) {
          posted = true;
          input.closest("form")?.requestSubmit();
        }
      }
    }
  } finally {
    busy = false;
  }
}
(window as any).widgetDemo = {
  update(s: any) {
    desired = s;
    const surface = document.querySelector<HTMLElement>("#website")!;
    if (surface.style.position === "fixed") surface.scrollTop = s.scroll;
    else window.scrollTo(0, s.scroll);
    void apply();
  },
  get state() {
    return { count, mode, ready };
  },
};
controller.refresh().then(() => {
  ready = true;
  void apply();
});
