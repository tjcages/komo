import type { Anchor } from "./types.js";

const privateText =
  "input,textarea,select,script,style,[contenteditable],[hidden],[aria-hidden=true]";
const trim = (text: string, limit = 160) =>
  text.replace(/\s+/g, " ").trim().slice(0, limit);
function textFor(element: Element): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let text = "",
    node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.parentElement?.closest(privateText))
      text += node.textContent + " ";
    if (text.length > 320) break;
  }
  return trim(text);
}
function unique(selector: string): Element | null {
  const matches = document.querySelectorAll(selector);
  return matches.length === 1 ? matches[0] : null;
}
function stableFor(element: Element): string | undefined {
  for (const attr of [
    "data-comment-anchor",
    "id",
    "data-testid",
    "data-test",
    "data-cy",
  ]) {
    const value = element.getAttribute(attr);
    if (!value || value.length > 500) continue;
    const selector =
      attr === "id"
        ? `#${CSS.escape(value)}`
        : `[${attr}="${CSS.escape(value)}"]`;
    if (selector.length <= 2000 && unique(selector) === element)
      return selector;
  }
}
function selectorFor(element: Element): string {
  const parts: string[] = [];
  let node: Element | null = element;
  while (node && node !== document.body && parts.length < 12) {
    const stable = stableFor(node);
    if (stable) {
      parts.unshift(stable);
      break;
    }
    const siblings = node.parentElement
      ? [...node.parentElement.children].filter(
          (sibling) => sibling.tagName === node!.tagName,
        )
      : [];
    parts.unshift(
      `${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`,
    );
    node = node.parentElement;
  }
  return parts.join(" > ");
}
function labelFor(element: Element): string {
  return trim(
    element.getAttribute("aria-label") ||
      (element.getAttribute("aria-labelledby") || "")
        .split(/\s+/)
        .map((id) => {
          const label = id && document.getElementById(id);
          return label ? textFor(label) : "";
        })
        .join(" ") ||
      element.getAttribute("alt") ||
      ((element as HTMLInputElement).labels &&
        [...(element as HTMLInputElement).labels!].map(textFor).join(" ")) ||
      "",
  );
}
function nearbyFor(element: Element): string {
  const parent =
    element.parentElement?.closest("li,article,tr,[data-comment-anchor]") ||
    element.parentElement;
  return parent &&
    parent !== document.body &&
    parent !== document.documentElement
    ? textFor(parent)
    : "";
}
function contextFor(element: Element): NonNullable<Anchor["context"]> {
  let parent = element.parentElement,
    scope: string | undefined;
  while (parent && parent !== document.body && !(scope = stableFor(parent)))
    parent = parent.parentElement;
  const selection = window.getSelection();
  const selected = selection?.rangeCount ? selection.getRangeAt(0) : null;
  return {
    tag:
      element.tagName.length <= 32 ? element.tagName.toLowerCase() : undefined,
    role: trim(element.getAttribute("role") || "", 80) || undefined,
    label: labelFor(element) || undefined,
    nearby: nearbyFor(element) || undefined,
    classes: trim(element.getAttribute("class") || "", 200) || undefined,
    selectedText:
      selected &&
      element.contains(selected.commonAncestorContainer) &&
      !element.closest(privateText) &&
      !element.querySelector(privateText)
        ? trim(selection!.toString(), 200) || undefined
        : undefined,
    scope,
  };
}
function matches(element: Element, anchor: Anchor): boolean {
  const context = anchor.context;
  if (!anchor.text && !context?.label && !context?.nearby) return false;
  return (
    (!anchor.text || textFor(element) === trim(anchor.text)) &&
    (!context ||
      ((!context.tag || element.tagName.toLowerCase() === context.tag) &&
        (!context.role || element.getAttribute("role") === context.role) &&
        (!context.label || labelFor(element) === context.label) &&
        (!context.nearby || nearbyFor(element) === context.nearby)))
  );
}
export function captureAnchor(
  element: Element,
  start: { x: number; y: number },
  end: { x: number; y: number },
  source?: string | ((element: Element) => string | undefined),
): Anchor {
  let target = element;
  const left = Math.min(start.x, end.x),
    top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x),
    bottom = Math.max(start.y, end.y);
  while (target.parentElement && target !== document.body) {
    const r = target.getBoundingClientRect();
    if (
      left >= r.left &&
      right <= r.right &&
      top >= r.top &&
      bottom <= r.bottom &&
      r.width &&
      r.height
    )
      break;
    target = target.parentElement;
  }
  const rect = target.getBoundingClientRect();
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const area = right - left > 6 || bottom - top > 6;
  const x = clamp((left - rect.left) / (rect.width || 1));
  const y = clamp((top - rect.top) / (rect.height || 1));
  return {
    selector: selectorFor(target),
    text: textFor(target),
    context: contextFor(target),
    x,
    y,
    width: area ? Math.min(1 - x, (right - left) / (rect.width || 1)) : 0,
    height: area ? Math.min(1 - y, (bottom - top) / (rect.height || 1)) : 0,
    pageX: left + window.scrollX,
    pageY: top + window.scrollY,
    viewportWidth: window.innerWidth,
    source:
      (typeof source === "function" ? source(target) : source) ??
      target
        .closest("[data-comment-source]")
        ?.getAttribute("data-comment-source") ??
      undefined,
  };
}
export function resolveAnchor(
  anchor: Anchor,
  target?: Element | null,
): Element | null {
  let element: Element | null = null;
  try {
    const found = anchor.selector ? unique(anchor.selector) : document.body;
    element = target?.isConnected && target === found ? target : found;
    if (
      element &&
      stableFor(element) !== anchor.selector &&
      !matches(element, anchor)
    )
      element = null;
    const context = anchor.context;
    if (
      !element &&
      context?.scope &&
      context.tag &&
      (anchor.text || context.label || context.nearby)
    ) {
      const scope = unique(context.scope);
      const candidates = scope
        ? [...scope.querySelectorAll(context.tag)].filter((candidate) =>
            matches(candidate, anchor),
          )
        : [];
      if (candidates.length === 1) element = candidates[0];
    }
  } catch {
    // Invalid legacy selectors or ambiguous/missing targets retain their fallback position.
  }
  return element;
}
export function locateAnchor(
  anchor: Anchor,
  target?: Element | null,
): {
  x: number;
  y: number;
  width: number;
  height: number;
  attached: boolean;
  component?: { left: number; top: number; right: number; bottom: number };
} {
  const element = resolveAnchor(anchor, target);
  if (element) {
    const rect = element.getBoundingClientRect();
    if (rect.width && rect.height)
      return {
        x: rect.left + rect.width * anchor.x,
        y: rect.top + rect.height * anchor.y,
        width: rect.width * anchor.width,
        height: rect.height * anchor.height,
        attached: true,
        component: {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        },
      };
  }
  return {
    x:
      (anchor.pageX * window.innerWidth) / anchor.viewportWidth -
      window.scrollX,
    y: anchor.pageY - window.scrollY,
    width: 0,
    height: 0,
    attached: false,
  };
}
