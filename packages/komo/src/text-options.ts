import { button, el } from "./dom.js";
import type { OptionPick } from "./types.js";

// Text options. An agent offers candidate copy for a block with
// `data-komo-options`, a JSON array of HTML strings, or with
// `<template data-komo-option>` children; the block's own content is option
// 0, and `data-komo-id` names the block. Selecting text inside a block shows
// a floating pager over the selection. A pick swaps the block's content at
// once and is kept per page in this browser, so a reload shows the same picks. The dock lists every block and
// queues the picks for an agent as one note. This module loads only on pages
// that offer options, and brings its own styles.

type Block = {
  element: HTMLElement;
  id: string;
  /** HTML; option 0 is the block's own content. */
  options: string[];
  index: number;
  /** The attribute value the options were read from. */
  attribute: string;
  /** The content as komo last left it. Other content came from the page. */
  applied: string;
  /** `<template data-komo-option>` children, put back on destroy. */
  templates: HTMLTemplateElement[];
};

export type TextOptions = {
  /** The dock's summary of every block on this page. */
  panel: HTMLElement;
  scan(): void;
  destroy(): void;
};

const selector = "[data-komo-options]";
const ease = "cubic-bezier(.22,1,.36,1)";
const hidden = { opacity: 0, filter: "blur(4px)", scale: 0.96 };
const shown = { opacity: 1, filter: "blur(0px)", scale: 1 };

export function textOptions(host: {
  shadow: ShadowRoot;
  page(): string;
  /** False while the dock places a comment. */
  enabled(): boolean;
  /** Local agent mode queues picks as a note; elsewhere they are copied. */
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
    picksKey = "",
    sent = "",
    drawn = "";
  let active: Block | null = null,
    selecting = false,
    hideTimer = 0,
    scanTimer = 0,
    frame = 0;

  const style = el("style");
  style.textContent = css;
  const ring = el("div", "text-option-ring");
  ring.hidden = true;
  const pager = el("div", "text-option-pager");
  pager.hidden = true;
  pager.setAttribute("role", "group");
  pager.setAttribute("aria-label", "Text options");
  const count = el("span", "text-option-count");
  pager.append(
    button(
      "Previous option",
      () => active && choose(active, active.index - 1),
      "icon text-option-previous",
      "chevron",
    ),
    count,
    button(
      "Next option",
      () => active && choose(active, active.index + 1),
      "icon text-option-next",
      "chevron",
    ),
  );
  // Pressing a pager button must not clear the page selection it belongs to.
  pager.addEventListener("mousedown", (event) => event.preventDefault());
  const panel = el("section", "text-options");
  panel.setAttribute("aria-label", "Text options");
  panel.hidden = true;
  host.shadow.append(style, ring, pager);

  // The pager follows the page selection. A pointer selection shows it once
  // the pointer lifts; a keyboard selection shows it at once.
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!(event.target as Element).closest?.("[data-branch-comments]"))
        selecting = true;
    },
    { capture: true, passive: true, signal },
  );
  for (const type of ["pointerup", "pointercancel"])
    document.addEventListener(
      type,
      () => {
        if (!selecting) return;
        selecting = false;
        sync();
      },
      { capture: true, passive: true, signal },
    );
  document.addEventListener("selectionchange", () => selecting || sync(), {
    signal,
  });
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
    panel,
    scan,
    destroy() {
      abort.abort();
      observer.disconnect();
      clearTimeout(hideTimer);
      clearTimeout(scanTimer);
      cancelAnimationFrame(frame);
      for (const block of blocks.values()) {
        if (block.index) block.element.innerHTML = block.options[0];
        block.element.append(...block.templates);
      }
      blocks.clear();
      for (const node of [style, ring, pager, panel]) node.remove();
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
    if (!active) hide(true);
    else count.textContent = `${active.index + 1}/${active.options.length}`;
    render();
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
    blocks.set(element, block);
    // Writing only on a change keeps the scan from feeding itself: the
    // browser may serialize what komo wrote differently from the option.
    if (
      changed ||
      block.options[block.index] !== previous.options[previous.index]
    )
      apply(block, false);
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

  function apply(block: Block, animate: boolean) {
    const { element } = block;
    const html = block.options[block.index];
    if (element.innerHTML !== html) {
      element.innerHTML = html;
      if (animate && !still())
        element.animate(
          [
            { opacity: 0, filter: "blur(4px)" },
            { opacity: 1, filter: "blur(0px)" },
          ],
          {
            duration: 200,
            easing: ease,
          },
        );
    }
    block.applied = element.innerHTML;
  }

  function choose(block: Block, next: number) {
    const total = block.options.length;
    block.index = (next + total) % total;
    picks[block.id] = block.options[block.index];
    save();
    apply(block, true);
    // The swap removed the selected text: select the new content, so the
    // pager stays and the reader sees what changed.
    select(block);
    count.textContent = `${block.index + 1}/${total}`;
    render();
    place();
  }

  function blockAt(target: Element | null) {
    const element = target?.closest?.<HTMLElement>(selector);
    return element ? blocks.get(element) : undefined;
  }

  /** The selection's range, when it holds text inside one block. */
  function selected() {
    const selection = getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const block = blockAt(node instanceof Element ? node : node.parentElement);
    return block && { block, range };
  }

  /** Show the pager for the selected block, or hide it. */
  function sync() {
    const current = host.enabled() && selected();
    if (current) show(current.block);
    else hideSoon();
  }

  /** Select a block's whole content, which shows its pager. */
  function select(block: Block) {
    const range = document.createRange();
    range.selectNodeContents(block.element);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function show(block: Block) {
    clearTimeout(hideTimer);
    const opening = pager.hidden || pager.dataset.leaving !== undefined;
    if (!opening && active === block) return;
    active = block;
    count.textContent = `${block.index + 1}/${block.options.length}`;
    for (const animation of pager.getAnimations()) animation.cancel();
    delete pager.dataset.leaving;
    pager.hidden = ring.hidden = false;
    place();
    if (opening && !still())
      pager.animate([hidden, shown], { duration: 150, easing: ease });
    follow();
  }

  // A tap on the pager can clear the selection first; the short delay lets
  // its click land and select the block again.
  function hideSoon() {
    clearTimeout(hideTimer);
    if (!pager.hidden) hideTimer = window.setTimeout(() => hide(), 150);
  }

  function hide(immediate = false) {
    clearTimeout(hideTimer);
    cancelAnimationFrame(frame);
    active = null;
    ring.hidden = true;
    if (pager.hidden) return;
    if (immediate || still()) {
      for (const animation of pager.getAnimations()) animation.cancel();
      delete pager.dataset.leaving;
      pager.hidden = true;
      return;
    }
    if (pager.dataset.leaving !== undefined) return;
    pager.dataset.leaving = "";
    const exit = pager.animate([shown, hidden], {
      duration: 120,
      easing: ease,
      fill: "forwards",
    });
    void exit.finished
      .then(() => {
        if (pager.dataset.leaving === undefined) return;
        delete pager.dataset.leaving;
        pager.hidden = true;
        exit.cancel();
      })
      .catch(() => {});
  }

  /** Keep the ring and pager on the block while it scrolls or reflows. */
  function follow() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!active) return;
      place();
      follow();
    });
  }

  /**
   * Ring the block's text and float the pager centred above the selection,
   * or below it at the top of the viewport.
   */
  function place() {
    if (!active) return;
    const range = document.createRange();
    range.selectNodeContents(active.element);
    const text = range.getBoundingClientRect();
    const box =
      text.width || text.height ? text : active.element.getBoundingClientRect();
    const current = selected();
    const target =
      current?.block === active ? current.range.getBoundingClientRect() : box;
    const inset = 4,
      gap = 8;
    Object.assign(ring.style, {
      left: `${box.left - inset}px`,
      top: `${box.top - inset}px`,
      width: `${box.width + inset * 2}px`,
      height: `${box.height + inset * 2}px`,
    });
    const width = pager.offsetWidth,
      height = pager.offsetHeight;
    const above = target.top - gap - height >= 8;
    const left = target.left + target.width / 2 - width / 2;
    pager.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, left))}px`;
    pager.style.top = `${above ? target.top - gap - height : target.bottom + gap}px`;
    pager.style.transformOrigin = above ? "50% 100%" : "50% 0%";
  }

  function ordered() {
    return [...blocks.values()].sort((a, b) =>
      a.element.compareDocumentPosition(b.element) &
      Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1,
    );
  }

  function picked(block: Block) {
    return Object.hasOwn(picks, block.id);
  }

  /** The dock's summary: one row per block, and the action that sends picks. */
  function render() {
    const list = ordered();
    const chosen = list.filter(picked).map(pickOf);
    const signature = JSON.stringify([
      list.map((block) => [
        block.id,
        block.index,
        block.options.length,
        picked(block),
      ]),
      sent,
    ]);
    if (signature === drawn) return;
    drawn = signature;
    panel.hidden = !list.length;
    const action = button(
      host.local ? "Queue picks" : "Copy picks",
      () =>
        void send(chosen).catch((reason) =>
          host.notify(reason instanceof Error ? reason.message : "Try again."),
        ),
      "secondary",
    );
    action.disabled = !chosen.length || sent === key(chosen);
    const head = el("div", "text-options-head");
    head.append(el("span", "", "Text options"), action);
    panel.replaceChildren(
      head,
      ...list.map((block) => {
        const label = plain(block.options[block.index]);
        const row = button(
          label || block.id,
          () => reveal(block),
          "text-option-row",
        );
        row.replaceChildren(
          el("span", "text-option-text", label || block.id),
          el(
            "span",
            "text-option-count",
            `${block.index + 1}/${block.options.length}`,
          ),
        );
        if (picked(block)) row.dataset.picked = "";
        return row;
      }),
    );
  }

  function reveal(block: Block) {
    block.element.scrollIntoView({
      block: "center",
      behavior: still() ? "auto" : "smooth",
    });
    select(block);
  }

  async function send(chosen: OptionPick[]) {
    if (!chosen.length) return;
    const body = note(chosen);
    if (host.local) {
      const target = ordered().find(
        (block) => block.id === chosen[0].block,
      )?.element;
      if (!target) return;
      await host.queue(chosen, body, target);
      host.notify("Picks queued. Press Send to deliver them.");
    } else {
      await navigator.clipboard.writeText(body);
      host.notify("Picks copied");
    }
    sent = key(chosen);
    render();
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

const key = (picks: OptionPick[]) =>
  JSON.stringify(picks.map((pick) => [pick.block, pick.index]));

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
  const lines = ["Use these text options:"];
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
.text-option-pager { position: fixed; z-index: 6; display: flex; align-items: center; padding: 2px; border-radius: 999px; background: #0d0d0d; color: rgb(255 255 255 / 90%); box-shadow: inset 0 1px 1px rgb(255 255 255 / 8%), inset 0 -1px 2px rgb(0 0 0 / 50%), 0 1px 2px rgb(0 0 0 / 12%), 0 4px 12px rgb(0 0 0 / 10%); pointer-events: auto; font-size: 12px; font-weight: 500; line-height: 1; }
.text-option-pager[hidden], .text-option-ring[hidden], .text-options[hidden] { display: none; }
.text-option-pager[data-leaving] { pointer-events: none; }
.text-option-pager button { width: 24px; height: 24px; border-radius: 50%; color: inherit; }
.text-option-pager button:hover { background: rgb(255 255 255 / 10%); }
.text-option-pager button:active { scale: .92; transition: scale 100ms cubic-bezier(.22,1,.36,1); }
.text-option-pager svg { width: 14px; height: 14px; }
.text-option-previous svg { rotate: 90deg; }
.text-option-next svg { rotate: -90deg; }
.text-option-pager .text-option-count { min-width: 28px; text-align: center; font-variant-numeric: tabular-nums; }
.text-option-ring { position: fixed; z-index: 1; pointer-events: none; border-radius: 6px; box-shadow: 0 0 0 1.5px #4388ff; }
.text-options { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; margin: 0 0 8px; padding: 4px 0 12px; border-bottom: 1px solid #ffffff12; }
.text-options-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 12px 6px; font-size: 12px; font-weight: 500; color: #888; }
.text-options-head .secondary { min-height: 28px; padding: 6px 10px; background: #262626; color: #eee; }
.text-options-head .secondary:hover { background: #303030; }
.text-options-head .secondary:disabled { cursor: default; }
.text-option-row { display: flex; justify-content: space-between; gap: 12px; width: 100%; padding: 8px 12px; border-radius: 10px; color: #888; text-align: left; }
.text-option-row[data-picked] { color: #eee; }
.text-option-row:hover { background: #161616; }
.text-option-row:active, .text-options-head .secondary:active:not(:disabled) { scale: .98; transition: scale 100ms cubic-bezier(.22,1,.36,1); }
.text-option-text { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.text-option-row .text-option-count { flex: none; color: #888; font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) { .text-option-pager button:active, .text-option-row:active, .text-options-head .secondary:active { scale: 1; } }
`;
