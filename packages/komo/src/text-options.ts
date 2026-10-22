import { button, el } from "./dom.js";
import type { OptionPick } from "./types.js";

// Text options. An agent offers candidate copy for a block with
// `data-komo-options`, a JSON array of HTML strings, or with
// `<template data-komo-option>` children; the block's own content is option
// 0, and `data-komo-id` names the block. A faint dotted underline marks such
// blocks. Hovering one highlights its text and floats a switcher below it:
// the arrows swap each option in place, and the one shown stays until the
// reader flips again, across reloads too. A ✕ / ✓ toggle records the
// reader's verdict on the option shown: ✓ keeps it, ✕ declines it. Both are
// saved per page in this browser. In local agent mode a kept option, or
// declining every option, is queued for Send as a note. This module loads only on pages that offer
// options, and brings its own styles.

type Verdict = "keep" | "decline" | null;

/** A block's saved state: verdicts as the options' HTML, and its unsent note. */
type Saved = {
  keep?: string;
  decline?: string[];
  /** The option on the page, when it is not the kept one or option 0. */
  show?: string;
  /** The queued note's operation ID, and the body it carries. */
  note?: string;
  noted?: string;
};

type Block = {
  element: HTMLElement;
  id: string;
  /** HTML; option 0 is the block's own content. */
  options: string[];
  /** The kept option, if any. */
  keep: number | null;
  /** The options the reader declined. */
  declined: Set<number>;
  /** The option on the page. */
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
  /** Queue a note for Send; resolves to its operation ID. */
  queue(picks: OptionPick[], body: string, target: Element): Promise<string>;
  /** Take back a queued note, unless Send already delivered it. */
  unqueue(operation: string): Promise<void>;
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
  let posting = Promise.resolve();
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
  const actions = el("div", "text-option-group text-option-verdict");
  const thumb = el("span", "text-option-thumb");
  const declineButton = button("Decline this option", decline, "icon", "close");
  const keepButton = button("Use this option", keep, "icon", "check");
  actions.append(thumb, declineButton, keepButton);
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
  // While the switcher is open, ← and → flip options, unless the reader is
  // typing; the real target may sit inside the dock's shadow root.
  document.addEventListener(
    "keydown",
    (event) => {
      const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (
        !step ||
        !active ||
        float.hidden ||
        float.dataset.leaving !== undefined
      )
        return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
        return;
      const target = event.composedPath()[0];
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.matches("input, textarea, select"))
      )
        return;
      event.preventDefault();
      flip(step);
    },
    { capture: true, signal },
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
    const id = element.dataset.komoId?.trim() || host.selector(element);
    // Verdicts are saved as the options' HTML, so an option the agent
    // changed or removed loses its verdict.
    const saved = entry(id);
    const keep = options.indexOf(saved.keep as string);
    const block: Block = {
      element,
      id,
      options,
      keep: keep < 0 ? null : keep,
      declined: new Set(
        (Array.isArray(saved.decline) ? saved.decline : [])
          .map((html) => options.indexOf(html))
          .filter((index) => index >= 0),
      ),
      shown: 0,
      attribute,
      applied: html,
      templates: [...(previous?.templates ?? []), ...templates],
    };
    // A swap survives the rescan it causes; a reload shows the saved option.
    const saw = options.indexOf(saved.show as string);
    block.shown =
      !changed && previous.shown < options.length
        ? previous.shown
        : saw >= 0
          ? saw
          : Math.max(keep, 0);
    // Drop saved HTML that no longer matches an option.
    const { note: _note, noted: _noted, ...verdicts } = saved;
    if (JSON.stringify(record(block)) !== JSON.stringify(verdicts))
      remember(block);
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
    remember(active);
    count.textContent = `${active.shown + 1}/${total}`;
    show(verdictOf(active), true);
    place();
  }

  /** ✓: keep the option shown, and queue it for the agent. */
  function keep() {
    const block = active;
    if (!block || block.keep === block.shown) return;
    block.keep = block.shown;
    block.declined.delete(block.shown);
    remember(block);
    show("keep", true);
    post(block);
  }

  /**
   * ✕: decline the option shown. Declining the kept option un-keeps it.
   * Declining the last undeclined option tells the agent that none fit.
   */
  function decline() {
    const block = active;
    if (!block || block.declined.has(block.shown)) return;
    block.declined.add(block.shown);
    if (block.keep === block.shown) block.keep = null;
    remember(block);
    show("decline", true);
    post(block);
  }

  /** What the agent should hear about a block now, if anything. */
  function message(block: Block) {
    if (block.keep !== null) {
      const pick = pickOf(block);
      return { picks: [pick], body: note([pick]) };
    }
    if (block.declined.size < block.options.length) return null;
    return {
      picks: [],
      body: `None of the text options fit. Write new copy:\n- ${block.id}: all ${block.options.length} options declined. Current copy: ${clip(plain(block.options[0]))}`,
    };
  }

  /**
   * Keep one unsent note per block in step with its verdicts. A changed mind
   * takes back the note queued before, unless Send already delivered it, and
   * queues the new one. Runs one at a time and reads the block when it runs,
   * so quick changes settle on the last verdict.
   */
  function post(block: Block) {
    if (!host.local) return;
    const { id, element } = block;
    posting = posting
      .then(async () => {
        const current = blocks.get(element);
        const next = current ? message(current) : null;
        const saved = entry(id);
        if ((saved.noted ?? null) === (next?.body ?? null)) return;
        if (typeof saved.note === "string") {
          await host.unqueue(saved.note);
          const { note: _note, noted: _noted, ...rest } = entry(id);
          write(id, rest);
        }
        if (!next) return;
        const operation = await host.queue(next.picks, next.body, element);
        write(id, { ...entry(id), note: operation, noted: next.body });
      })
      .catch((reason) =>
        host.notify(reason instanceof Error ? reason.message : "Try again."),
      );
  }

  function verdictOf(block: Block): Verdict {
    if (block.keep === block.shown) return "keep";
    return block.declined.has(block.shown) ? "decline" : null;
  }

  /**
   * Set the toggle. Between ✕ and ✓ the thumb stretches toward the new side,
   * then its trailing edge catches up; from no verdict it blurs in.
   */
  function show(verdict: Verdict, animate: boolean) {
    const previous = (actions.dataset.verdict ?? null) as Verdict;
    if (!animate) thumb.style.transition = "none";
    // With no verdict the thumb fades out where it is.
    if (verdict) {
      actions.dataset.verdict = verdict;
      thumb.style.left = verdict === "keep" ? "26px" : "2px";
    } else delete actions.dataset.verdict;
    declineButton.setAttribute("aria-pressed", String(verdict === "decline"));
    keepButton.setAttribute("aria-pressed", String(verdict === "keep"));
    if (!animate) {
      void thumb.offsetWidth;
      thumb.style.transition = "";
      return;
    }
    if (still() || !verdict || !previous || previous === verdict) return;
    const [from, to] = verdict === "keep" ? [2, 26] : [26, 2];
    thumb.animate(
      [
        { left: `${from}px`, width: "24px", easing: "cubic-bezier(.4,0,.2,1)" },
        {
          left: `${Math.min(from, to)}px`,
          width: "48px",
          offset: 0.45,
          easing: ease,
        },
        { left: `${to}px`, width: "24px" },
      ],
      { duration: 320 },
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
    active = block;
    pinned = null;
    count.textContent = `${block.shown + 1}/${block.options.length}`;
    show(verdictOf(block), false);
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

  /** Close the switcher. The option shown stays on the page. */
  function close(immediate = false) {
    clearTimeout(hideTimer);
    cancelAnimationFrame(frame);
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
    const index = block.keep ?? 0;
    const html = block.options[index];
    return {
      block: block.id,
      selector: host.selector(block.element),
      index,
      count: block.options.length,
      text: plain(html).slice(0, 4000),
      html: html.slice(0, 8000),
      original: plain(block.options[0]).slice(0, 8000),
    };
  }

  /** A block's verdicts and the option on the page, as saved: the options' HTML. */
  function record(block: Block) {
    return {
      ...(block.keep !== null && { keep: block.options[block.keep] }),
      ...(block.declined.size && {
        decline: [...block.declined]
          .sort((a, b) => a - b)
          .map((index) => block.options[index]),
      }),
      ...(block.shown !== (block.keep ?? 0) && {
        show: block.options[block.shown],
      }),
    };
  }

  function remember(block: Block) {
    const { note, noted } = entry(block.id);
    write(block.id, { ...record(block), ...(note && { note, noted }) });
  }

  function entry(id: string): Saved {
    const value = picks[id];
    return value && typeof value === "object" ? { ...(value as Saved) } : {};
  }

  function write(id: string, value: Saved) {
    if (Object.keys(value).length) picks[id] = value;
    else delete picks[id];
    save();
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

const clip = (text: string) =>
  text.length > 200 ? `${text.slice(0, 199)}…` : text;

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
    const line = `- ${pick.block}: option ${pick.index + 1} of ${pick.count}${pick.index ? "" : " (current)"}: ${clip(pick.text)}`;
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
.text-option-verdict { position: relative; isolation: isolate; }
.text-option-verdict button { color: #fff; }
.text-option-verdict button[aria-pressed="true"] { background: none; }
.text-option-verdict svg { mix-blend-mode: difference; }
.text-option-thumb { position: absolute; z-index: -1; top: 2px; left: 2px; width: 24px; height: 24px; border-radius: 999px; background: #fff; opacity: 0; scale: .6; filter: blur(2px); transition: opacity 150ms cubic-bezier(.22,1,.36,1), scale 150ms cubic-bezier(.22,1,.36,1), filter 150ms cubic-bezier(.22,1,.36,1); }
.text-option-verdict[data-verdict] .text-option-thumb { opacity: 1; scale: 1; filter: blur(0px); }
.text-option-group button:active { scale: .92; transition: scale 100ms cubic-bezier(.22,1,.36,1); }
.text-option-group svg { width: 14px; height: 14px; }
.text-option-previous svg { rotate: 90deg; }
.text-option-next svg { rotate: -90deg; }
.text-option-count { min-width: 28px; text-align: center; font-variant-numeric: tabular-nums; }
.text-option-highlight { position: fixed; inset: 0; z-index: 1; pointer-events: none; }
.text-option-highlight > div { position: absolute; border-radius: 3px; background: rgb(67 136 255 / 12%); }
@media (prefers-reduced-motion: reduce) { .text-option-group button:active { scale: 1; } .text-option-thumb { transition: none; } }
`;
