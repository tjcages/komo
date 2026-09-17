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
  ["#headline-right", "Love this direction."],
  ["#headline-left", "Can we try lavender here?"],
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
        x: i === 0 ? 1 : i === 1 ? 0 : 0.6,
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
// Preview-only entrances on actual product pins; no replacement markup/styles.
const seenPins = new Map<string, number>();
const animatedPinNodes = new WeakSet<HTMLElement>();
new MutationObserver(() => {
  for (const pin of root().querySelectorAll<HTMLElement>(".pin[data-thread]")) {
    const id = pin.dataset.thread!;
    if (animatedPinNodes.has(pin)) continue;
    animatedPinNodes.add(pin);
    pin.style.scale = "2";
    const started = seenPins.get(id) ?? performance.now();
    seenPins.set(id, started);
    const elapsed = performance.now() - started;
    if (elapsed >= 360) continue;
    const entrance = pin.animate([
      { opacity: 0, scale: "1.1" },
      { opacity: 1, scale: "2.16", offset: 0.72 },
      { opacity: 1, scale: "2" },
    ], { duration: 360, easing: "cubic-bezier(.22,1,.36,1)" });
    entrance.currentTime = elapsed;
  }
}).observe(root(), { childList: true, subtree: true });
let copied = "", didCopy = false;
// Capture the real generated prompt locally without touching the user's clipboard.
Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
  writeText: async (text: string) => { copied = text; }
}});
let incoming = 0, replyCount = 0, reactionCount = 0, lastBeat = -1;
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
      if (s.count < count) seenPins.clear();
      count = s.count;
      incoming = 0;
      const existing = threads;
      seed(count);
      if (count > 2) for (const t of threads) {
        const old = existing.find(item => item.id === t.id);
        if (old) t.comments = old.comments;
      }
      if (count === 0) { replyCount = 0; reactionCount = 0; didCopy = false; copied = ""; }
      await controller.refresh();
    }
    if (s.incoming > incoming) {
      while (incoming < s.incoming) {
        incoming++;
        const template = threads.find(t => t.id === "demo-2")!;
        const now = Date.now();
        threads.push({ ...template, id: `incoming-${incoming}`, createdAt: now, updatedAt: now,
          comments: [{ ...template.comments[0], id: `incoming-comment-${incoming}`,
            author: incoming % 2 ? other : me, createdAt: now,
            body: ["This feels really good.", "One tiny thought here…", "Yes. Keep this detail.", "Love the spacing here.", "This is the one.", "A little more contrast?", "Nice touch.", "Ready for another look."][incoming - 1] }] });
      }
      await controller.refresh(); // The product animates new rows and moves existing rows.
    }
    if (s.replies > replyCount) {
      const t = threads.find(t => t.id === "demo-0")!;
      while (replyCount < s.replies) {
        const n = ++replyCount;
        t.comments.push({ id: `quick-reply-${n}`, body: n === 1 ? "Same. The type feels right." : "Agreed. Let's keep it.",
          author: n === 1 ? other : { ...me, id: "demo-jamie", name: "Jamie", accentColor: "#efb695" },
          createdAt: Date.now(), editedAt: null, reactions: {} });
      }
      await controller.refresh();
    }
    if (s.reaction > reactionCount) {
      reactionCount = s.reaction;
      const t = threads.find(t => t.id === "demo-2");
      if (t) t.comments[0].reactions = { "💜": Array.from({length: reactionCount}, (_, i) => `fixture-${i}`) };
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
      if (mode === "hero-thread")
        root().querySelector<HTMLButtonElement>('.pin[data-thread="demo-0"]')?.click();
      if (mode === "thread")
        root()
          .querySelector<HTMLButtonElement>('.pin[data-thread="demo-2"]')
          ?.click();
      if (mode === "thread-two")
        root().querySelector<HTMLButtonElement>('.pin[data-thread="demo-3"]')?.click();
      if (mode === "compose")
        controller.comment(document.querySelector("#detail-card")!);
      if (mode === "drawer")
        root()
          .querySelector<HTMLButtonElement>('[data-menu-item="more"]')
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    }
    if (s.copy && !didCopy) {
      const button = root().querySelector<HTMLButtonElement>('[data-menu-item="copy-prompts"]');
      if (button) { didCopy = true; button.click(); }
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
function rectObject(el: HTMLElement) {
  const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
}
(window as any).widgetDemo = {
  update(s: any) {
    if (s.beat < lastBeat) {
      count = -1; mode = ""; incoming = 0; replyCount = 0; reactionCount = 0; threads = [];
      seenPins.clear(); didCopy = false; copied = "";
      root().querySelector<HTMLButtonElement>('[data-menu-item="close"]')?.click();
      controller.close();
    }
    lastBeat = s.beat;
    desired = s;
    const hero = document.querySelector<HTMLElement>(".website-hero")!;
    hero.style.opacity = "1";
    hero.style.transform = "none";
    document.querySelectorAll<HTMLElement>(".hero-word").forEach((word, i) => {
      const p = Math.max(0, Math.min(1, (s.beat - i * 0.16) / 0.5));
      word.style.opacity = String(1 - (1 - p) ** 3);
    });

    document.body.dataset.scene = s.mode;
    const surface = document.querySelector<HTMLElement>("#website")!;
    surface.style.opacity = s.isolated ? "0" : String(s.surfaceOpacity ?? 1);
    surface.style.transition = "opacity 160ms ease-out";
    const nav = root().querySelector<HTMLElement>(".morphing-menu");
    if (nav) nav.style.opacity = s.beat < 16 || (s.isolated && s.mode !== "drawer") ? "0" : "1";
    const pins = root().querySelector<HTMLElement>(".pins");
    if (pins) pins.style.visibility = s.isolated ? "hidden" : "visible";
    if (surface.style.position === "fixed") surface.scrollTop = s.scroll;
    else window.scrollTo(0, s.scroll);
    void apply();
  },
  get copied() { return copied; },
  pinRect(id: string) { return root().querySelector<HTMLElement>(`.pin[data-thread="${id}"]`)?.getBoundingClientRect(); },
  focusRect(kind: string) {
    const el = root().querySelector<HTMLElement>(kind === "drawer" ? ".morphing-menu__shell" : ".dialog");
    if (!el) return null;
    if (kind === "drawer") return el.getBoundingClientRect();
    // Layout bounds exclude the dialog's entrance scale/translation, so the camera
    // does not counter-animate against komo's own spring.
    return { x: el.offsetLeft, y: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
  },
  menuRects() {
    return [...root().querySelectorAll<HTMLElement>(".morphing-menu__panel [data-menu-item]")].map(el => ({ id: el.dataset.menuItem, ...rectObject(el) }));
  },
  hoverAt(y: number) {
    for (const el of root().querySelectorAll<HTMLElement>(".morphing-menu__panel [data-menu-item]")) {
      const r = el.getBoundingClientRect();
      el.style.background = y >= r.top && y <= r.bottom ? "var(--mm-hover)" : "";
    }
  },
  get state() {
    return { count, mode, ready };
  },
};
controller.refresh().then(() => {
  ready = true;
  void apply();
});
