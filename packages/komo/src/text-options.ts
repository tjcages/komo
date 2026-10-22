import { button, el } from "./dom.js";
import type { OptionPick } from "./types.js";

// Text options. An agent offers candidate copy for a block with
// `data-komo-options`, a JSON array of HTML strings, or with
// `<template data-komo-option>` children; the block's own content is option
// 0, and `data-komo-id` names the block. A faint dotted underline marks such
// blocks. Hovering one highlights its text and floats a switcher below it:
// the arrows preview each option in place, ✓ keeps the one shown and ✕ goes
// back. A kept pick is saved per page in this browser, so a reload shows it,
// and in local agent mode it is queued for Send as a note. This module loads
// only on pages that offer options, and brings its own styles.

type Block = {
  element: HTMLElement;
  id: string;
  /** HTML; option 0 is the block's own content. */
  options: string[];
  /** The kept option. */
  index: number;
  /** The option on the page now: the kept one, or one being previewed. */
  shown: number;
  /** The attribute value the options were read from. */
  attribute: string;
  /** The content as komo last left it. Other content came from the page. */
  applied: string;
  /** `<template data-komo-option>` children, put back on destroy. */
  templates: HTMLTemplateElement[];
};

export type TextOptions = { scan(): void; destroy(): void };

const selector = "[data-komo-options]";
const ease = "cubic-bezier(.22,1,.36,1)";
const hidden = { opacity: 0, filter: "blur(4px)", scale: 0.96 };
const shown = { opacity: 1, filter: "blur(0px)", scale: 1 };

export function textOptions(host: {
  shadow: ShadowRoot;
  page(): string;
  /** False while the dock places a comment. */
  enabled(): boolean;
  /** Local agent mode queues each kept pick as a note. */
  local: boolean;
  queue(picks: OptionPick[], body: string, target: Element): Promise<void>;
  notify(text: string): void;
  /** The anchors module's selector, passed in so that module stays in the main chunk. */
  selector(element: Element): string;
}): TextOptions {
  const blocks = new Map<HTMLElement, Block>();
  const warned = new WeakSet<Element>();
  const abort = new AbortController();
  const signal = abort.signal;
  const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  let picks: Record<string, unknown> = {},
    picksKey = "";
  let active: Block | null = null,
    pinned: { left: number; top: number } | null = null,
    hideTimer = 0,
    scanTimer = 0,
    frame = 0;

  // The hint lives in the page, since it underlines the page's own text.
  const hint = el("style");
  hint.textContent = `${selector} { text-decoration-line: underline; text-decoration-style: dotted; text-decoration-color: color-mix(in srgb, currentColor 35%, transparent); text-decoration-thickness: 1px; text-underline-offset: .2em; }`;
  document.head.append(hint);
  const style = el("style");
  style.textContent = css;
  const highlight = el("div", "text-option-highlight");
  highlight.hidden = true;
  const float = el("div", "text-option-float");
  float.hidden = true;
  float.setAttribute("role", "group");
  float.setAttribute("aria-label", "Text options");
  const count = el("span", "text-option-count");
  const pager = el("div", "text-option-group");
  pager.append(
    button(
      "Previous option",
      () => flip(-1),
      "icon text-option-previous",
      "chevron",
    ),
    count,
    button("Next option", () => flip(1), "icon text-option-next", "chevron"),
  );
  const actions = el("div", "text-option-group");
  actions.append(
    button("Keep the current text", () => close(), "icon", "close"),
    button("Use this option", keep, "icon text-option-keep", "check"),
  );
  float.append(pager, actions);
  // While the pointer is on the switcher it stays put, even when a longer or
  // shorter option reflows the block above it.
  float.addEventListener("pointerenter", () => {
    clearTimeout(hideTimer);
    const box = float.getBoundingClientRect();
    pinned = { left: box.left, top: box.top + scrollY };
  });
  float.addEventListener("pointerleave", () => {
    pinned = null;
    closeSoon();
  });
  host.shadow.append(style, highlight, float);

  // Hover opens the switcher at once. The pointer crosses a gap on its way
  // down to the switcher, so leaving waits briefly; the dock never closes it.
  document.addEventListener(
    "pointerover",
    (event) => {
      if (event.pointerType !== "mouse") return;
      if (!host.enabled()) return close(true);
      const target = event.target as Element;
      if (target.closest?.("[data-branch-comments]")) return;
      const block = blockAt(target);
      if (block) open(block);
      else closeSoon();
    },
    { capture: true, passive: true, signal },
  );
  // Touch has no hover: a tap on a block opens its switcher, a tap elsewhere
  // closes it. The tap still reaches the page.
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType === "mouse") return;
      const target = event.target as Element;
      if (target.closest?.("[data-branch-comments]")) return;
      const block = host.enabled() && blockAt(target);
      if (block) open(block);
      else close();
    },
    { capture: true, passive: true, signal },
  );
  const observer = new MutationObserver(() => {
    if (!scanTimer)
      scanTimer = window.setTimeout(() => {
        scanTimer = 0;
        scan();
      }, 100);
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["data-komo-options", "data-komo-id"],
  });
  scan();

  return {
    scan,
    destroy() {
      abort.abort();
      observer.disconnect();
      clearTimeout(hideTimer);
      clearTimeout(scanTimer);
      cancelAnimationFrame(frame);
      for (const block of blocks.values()) {
        if (block.shown) block.element.innerHTML = block.options[0];
        block.element.append(...block.templates);
      }
      blocks.clear();
      for (const node of [hint, style, highlight, float]) node.remove();
    },
  };

  /** Read every block on the page and apply the saved picks. */
  function scan() {
    const key = `komo:text-options:${location.origin}${host.page()}`;
    if (key !== picksKey) {
      picksKey = key;
      picks = load(key);
    }
    const seen = new Set<HTMLElement>();
    for (const element of document.querySelectorAll<HTMLElement>(selector))
      if (read(element)) seen.add(element);
    for (const element of blocks.keys())
      if (!seen.has(element)) blocks.delete(element);
    if (active) active = blocks.get(active.element) ?? null;
    if (active)
      count.textContent = `${active.shown + 1}/${active.options.length}`;
    else close(true);
  }

  function read(element: HTMLElement): Block | undefined {
    const previous = blocks.get(element);
    const attribute = element.getAttribute("data-komo-options") ?? "";
    const templates = [...element.children].filter(
      (child): child is HTMLTemplateElement =>
        child instanceof HTMLTemplateElement &&
        child.hasAttribute("data-komo-option"),
    );
    for (const template of templates) template.remove();
    const html = element.innerHTML;
    // Content komo did not write is the page's own: a reload, or a framework
    // render. It becomes option 0, and the saved pick applies again.
    const changed = !previous || html !== previous.applied;
    const original = changed ? html : previous.options[0];
    const alternatives =
      !previous || attribute !== previous.attribute || templates.length
        ? [
            ...parse(attribute, element),
            ...templates.map((template) => template.innerHTML),
          ].map(normal)
        : previous.options.slice(1);
    const options = [...new Set([original, ...alternatives])];
    if (options.length < 2) {
      blocks.delete(element);
      return;
    }
    const block: Block = {
      element,
      id: element.dataset.komoId?.trim() || host.selector(element),
      options,
      index: 0,
      shown: 0,
      attribute,
      applied: html,
      templates: [...(previous?.templates ?? []), ...templates],
    };
    const chosen = picks[block.id];
    if (typeof chosen === "string") {
      block.index = options.indexOf(chosen);
      // The agent changed the options since this pick: start over.
      if (block.index < 0) {
        block.index = 0;
        delete picks[block.id];
        save();
      }
    }
    // A preview survives the rescan its own swap causes.
    block.shown =
      !changed && previous.shown < options.length
        ? previous.shown
        : block.index;
    blocks.set(element, block);
    // Writing only on a change keeps the scan from feeding itself: the
    // browser may serialize what komo wrote differently from the option.
    if (changed || options[block.shown] !== previous.options[previous.shown])
      apply(block, block.shown, false);
    return block;
  }

  function parse(attribute: string, element: Element): string[] {
    if (!attribute.trim()) return [];
    try {
      const list: unknown = JSON.parse(attribute);
      if (Array.isArray(list) && list.every((item) => typeof item === "string"))
        return list;
    } catch {
      /* Reported below. */
    }
    if (!warned.has(element)) {
      warned.add(element);
      console.warn(
        "komo: data-komo-options must be a JSON array of HTML strings.",
        element,
      );
    }
    return [];
  }

  function apply(block: Block, option: number, animate: boolean) {
    const { element } = block;
    block.shown = option;
    const html = block.options[option];
    if (element.innerHTML !== html) {
      element.innerHTML = html;
      if (animate && !still())
        element.animate(
          [
            { opacity: 0, filter: "blur(4px)" },
            { opacity: 1, filter: "blur(0px)" },
          ],
          { duration: 200, easing: ease },
        );
    }
    block.applied = element.innerHTML;
  }

  /** Preview the next or previous option in place. */
  function flip(step: number) {
    if (!active) return;
    const total = active.options.length;
    apply(active, (active.shown + step + total) % total, true);
    count.textContent = `${active.shown + 1}/${total}`;
    place();
  }

  /** Keep the option shown: save it, and queue it for the agent. */
  function keep() {
    const block = active;
    if (!block) return;
    const unchanged =
      Object.hasOwn(picks, block.id) && block.shown === block.index;
    block.index = block.shown;
    picks[block.id] = block.options[block.index];
    save();
    close();
    if (unchanged || !host.local) return;
    const pick = pickOf(block);
    host
      .queue([pick], note([pick]), block.element)
      .catch((reason) =>
        host.notify(reason instanceof Error ? reason.message : "Try again."),
      );
  }

  function blockAt(target: Element | null) {
    const element = target?.closest?.<HTMLElement>(selector);
    return element ? blocks.get(element) : undefined;
  }

  function open(block: Block) {
    clearTimeout(hideTimer);
    const opening = float.hidden || float.dataset.leaving !== undefined;
    if (!opening && active === block) return;
    // Another block's preview ends when the pointer moves on.
    if (active && active !== block) apply(active, active.index, true);
    active = block;
    pinned = null;
    count.textContent = `${block.shown + 1}/${block.options.length}`;
    for (const animation of float.getAnimations()) animation.cancel();
    delete float.dataset.leaving;
    float.hidden = highlight.hidden = false;
    place();
    if (opening && !still())
      float.animate([hidden, shown], { duration: 150, easing: ease });
    follow();
  }

  function closeSoon() {
    clearTimeout(hideTimer);
    if (!float.hidden) hideTimer = window.setTimeout(() => close(), 250);
  }

  /** Close the switcher. A preview that was not kept goes back. */
  function close(immediate = false) {
    clearTimeout(hideTimer);
    cancelAnimationFrame(frame);
    if (active && active.shown !== active.index)
      apply(active, active.index, !immediate);
    active = pinned = null;
    highlight.hidden = true;
    if (float.hidden) return;
    if (immediate || still()) {
      for (const animation of float.getAnimations()) animation.cancel();
      delete float.dataset.leaving;
      float.hidden = true;
      return;
    }
    if (float.dataset.leaving !== undefined) return;
    float.dataset.leaving = "";
    const exit = float.animate([shown, hidden], {
      duration: 120,
      easing: ease,
      fill: "forwards",
    });
    void exit.finished
      .then(() => {
        if (float.dataset.leaving === undefined) return;
        delete float.dataset.leaving;
        float.hidden = true;
        exit.cancel();
      })
      .catch(() => {});
  }

  /** Keep the highlight and switcher on the block while it scrolls or reflows. */
  function follow() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!active) return;
      place();
      follow();
    });
  }

  /**
   * Highlight each line of the block's text and set the switcher below it,
   * aligned as the text is.
   */
  function place() {
    if (!active) return;
    const range = document.createRange();
    range.selectNodeContents(active.element);
    const rows = lines(range);
    const text = range.getBoundingClientRect();
    const box =
      text.width || text.height ? text : active.element.getBoundingClientRect();
    while (highlight.childElementCount > rows.length)
      highlight.lastElementChild!.remove();
    while (highlight.childElementCount < rows.length)
      highlight.append(el("div"));
    rows.forEach((row, index) =>
      Object.assign((highlight.children[index] as HTMLElement).style, {
        left: `${row.left - 2}px`,
        top: `${row.top}px`,
        width: `${row.right - row.left + 4}px`,
        height: `${row.bottom - row.top}px`,
      }),
    );
    const width = float.offsetWidth,
      height = float.offsetHeight;
    const align = getComputedStyle(active.element).textAlign;
    const [left, origin] =
      align === "center"
        ? [box.left + box.width / 2 - width / 2, "50% 0%"]
        : align === "right" || align === "end"
          ? [box.right - width, "100% 0%"]
          : [box.left - 2, "0% 0%"];
    float.style.left = `${pinned?.left ?? Math.max(8, Math.min(innerWidth - width - 8, left))}px`;
    float.style.top = `${pinned ? pinned.top - scrollY : Math.min(innerHeight - height - 8, box.bottom + 8)}px`;
    float.style.transformOrigin = origin;
  }

  function pickOf(block: Block): OptionPick {
    const html = block.options[block.index];
    return {
      block: block.id,
      selector: host.selector(block.element),
      index: block.index,
      count: block.options.length,
      text: plain(html).slice(0, 4000),
      html: html.slice(0, 8000),
      original: plain(block.options[0]).slice(0, 8000),
    };
  }

  function load(key: string): Record<string, unknown> {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
      return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  function save() {
    try {
      if (Object.keys(picks).length)
        localStorage.setItem(picksKey, JSON.stringify(picks));
      else localStorage.removeItem(picksKey);
    } catch {
      /* Picks last for this page view when storage is blocked. */
    }
  }
}

/** One box per line of text: inline fragments on a line merge. */
function lines(range: Range) {
  const rows: { left: number; right: number; top: number; bottom: number }[] =
    [];
  for (const rect of range.getClientRects()) {
    if (!rect.width || !rect.height) continue;
    const row = rows.find(
      (item) => rect.top < item.bottom - 1 && rect.bottom > item.top + 1,
    );
    if (!row)
      rows.push({
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      });
    else {
      row.left = Math.min(row.left, rect.left);
      row.right = Math.max(row.right, rect.right);
      row.top = Math.min(row.top, rect.top);
      row.bottom = Math.max(row.bottom, rect.bottom);
    }
  }
  return rows;
}

/** HTML as the browser writes it back, so options compare with content. */
function normal(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.innerHTML;
}

function plain(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;
  return (template.content.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** The note that carries picks: one line per block, within a note's 4,000 characters. */
export function note(picks: OptionPick[]) {
  const lines = [
    picks.length === 1 ? "Use this text option:" : "Use these text options:",
  ];
  for (const [index, pick] of picks.entries()) {
    const text =
      pick.text.length > 200 ? `${pick.text.slice(0, 199)}…` : pick.text;
    const line = `- ${pick.block}: option ${pick.index + 1} of ${pick.count}${pick.index ? "" : " (current)"}: ${text}`;
    const rest = `- ${picks.length - index} more: komo options list --local`;
    if ([...lines, line].join("\n").length + rest.length + 1 > 4000) {
      lines.push(rest);
      break;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

const css = `
.text-option-float { position: fixed; z-index: 6; display: flex; gap: 6px; pointer-events: auto; font-size: 12px; font-weight: 500; line-height: 1; }
.text-option-float[hidden], .text-option-highlight[hidden] { display: none; }
.text-option-float[data-leaving] { pointer-events: none; }
.text-option-group { display: flex; align-items: center; padding: 2px; border-radius: 999px; background: #0d0d0d; color: rgb(255 255 255 / 90%); box-shadow: inset 0 1px 1px rgb(255 255 255 / 8%), inset 0 -1px 2px rgb(0 0 0 / 50%), 0 1px 2px rgb(0 0 0 / 12%), 0 4px 12px rgb(0 0 0 / 10%); }
.text-option-group button { width: 24px; height: 24px; border-radius: 50%; color: inherit; }
.text-option-group button:hover { background: rgb(255 255 255 / 10%); }
.text-option-group .text-option-keep { background: #fff; color: #0d0d0d; }
.text-option-group .text-option-keep:hover { background: #e6e6e6; }
.text-option-group button:active { scale: .92; transition: scale 100ms cubic-bezier(.22,1,.36,1); }
.text-option-group svg { width: 14px; height: 14px; }
.text-option-previous svg { rotate: 90deg; }
.text-option-next svg { rotate: -90deg; }
.text-option-count { min-width: 28px; text-align: center; font-variant-numeric: tabular-nums; }
.text-option-highlight { position: fixed; inset: 0; z-index: 1; pointer-events: none; }
.text-option-highlight > div { position: absolute; border-radius: 3px; background: rgb(67 136 255 / 12%); }
@media (prefers-reduced-motion: reduce) { .text-option-group button:active { scale: 1; } }
`;
