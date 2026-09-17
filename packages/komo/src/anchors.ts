import type { Anchor } from "./types.js";

function selectorFor(element: Element): string {
  const parts: string[] = [];
  let node: Element | null = element;
  while (node && node !== document.body && parts.length < 12) {
    if (node.id) {
      parts.unshift(`#${CSS.escape(node.id)}`);
      break;
    }
    const stable = node.getAttribute("data-comment-anchor");
    if (stable) {
      parts.unshift(`[data-comment-anchor="${CSS.escape(stable)}"]`);
      break;
    }
    const siblings = node.parentElement
      ? [...node.parentElement.children].filter(
          (sibling) => sibling.tagName === node!.tagName
        )
      : [];
    parts.unshift(
      `${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`
    );
    node = node.parentElement;
  }
  return parts.join(" > ");
}
export function captureAnchor(
  element: Element,
  start: { x: number; y: number },
  end: { x: number; y: number },
  source?: string
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
    text: (target.textContent ?? "").trim().slice(0, 160),
    x,
    y,
    width: area ? Math.min(1 - x, (right - left) / (rect.width || 1)) : 0,
    height: area ? Math.min(1 - y, (bottom - top) / (rect.height || 1)) : 0,
    pageX: left + window.scrollX,
    pageY: top + window.scrollY,
    viewportWidth: window.innerWidth,
    source:
      source ??
      target
        .closest("[data-comment-source]")
        ?.getAttribute("data-comment-source") ??
      undefined,
  };
}
export function locateAnchor(
  anchor: Anchor,
  target?: Element | null
): {
  x: number;
  y: number;
  width: number;
  height: number;
  attached: boolean;
  component?: { left: number; top: number; right: number; bottom: number };
} {
  let element: Element | null = null;
  try {
    element =
      target !== undefined
        ? target
        : anchor.selector
          ? document.querySelector(anchor.selector)
          : document.body;
  } catch {
    /* A previous version may have used a selector no longer supported. */
  }
  // An explicit ID/anchor survives copy edits. Positional selectors also verify text.
  if (
    element &&
    anchor.text &&
    !anchor.selector.startsWith("#") &&
    !anchor.selector.startsWith("[data-comment-anchor=") &&
    !(element.textContent ?? "").trim().startsWith(anchor.text)
  )
    element = null;
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
