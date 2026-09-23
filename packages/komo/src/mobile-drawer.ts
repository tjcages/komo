import { button, el } from "./dom.js";

/** An isolated bottom sheet: dragging the handle never steals a list scroll. */
export function mobileDrawer(
  mount: HTMLElement,
  content: HTMLElement,
  close: () => void,
) {
  const abort = new AbortController();
  const backdrop = button("Close comments", close, "mobile-drawer-backdrop");
  backdrop.tabIndex = -1;
  const sheet = el("section", "mobile-drawer");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", "Comments");
  sheet.setAttribute("aria-modal", "true");
  const head = el("div", "mobile-drawer-head");
  const handle = el("div", "mobile-drawer-handle");
  handle.setAttribute("aria-hidden", "true");
  const dismiss = button("Close comments", close, "icon");
  dismiss.textContent = "×";
  head.append(handle, dismiss);
  const slot = el("div", "mobile-drawer-slot");
  slot.append(content);
  sheet.append(head, slot);
  mount.append(backdrop, sheet);
  backdrop.addEventListener("wheel", event => event.preventDefault(),
    { passive: false, signal: abort.signal });
  let open = false,
    locked = false,
    disposed = false;
  let previousFocus: HTMLElement | null = null;
  let release: (() => void) | undefined;
  let settleTimer = 0;
  let openedAt = 0;
  let drag:
    | { id: number; y: number; start: number; distance: number; height: number; active: boolean }
    | undefined;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const transition = "transform .5s cubic-bezier(.32,.72,0,1)";
  const fade = "opacity .5s cubic-bezier(.32,.72,0,1)";
  const closed = "translate3d(0,105%,0)";
  const opened = "translate3d(0,0,0)";
  function hideClosed() {
    if (open || disposed) return;
    sheet.hidden = backdrop.hidden = true;
    backdrop.style.opacity = "";
  }
  function settle(value: boolean, restored = false) {
    const dim = backdrop.hidden ? "0" : getComputedStyle(backdrop).opacity;
    const from = sheet.hidden ? closed : getComputedStyle(sheet).transform;
    clearTimeout(settleTimer);
    sheet.style.transition = backdrop.style.transition = "none";
    sheet.style.transform = from === "none" ? opened : from;
    backdrop.style.opacity = dim;
    sheet.hidden = backdrop.hidden = false;
    sheet.inert = !value;
    if (reduced.matches || restored) {
      sheet.style.transform = value ? opened : closed;
      backdrop.style.opacity = value ? "1" : "0";
      sheet.hidden = backdrop.hidden = !value;
      openedAt = 0;
      return;
    }
    // Commit the starting transform once; movement itself never reads layout.
    void sheet.offsetHeight;
    sheet.style.transition = transition;
    backdrop.style.transition = fade;
    sheet.style.transform = value ? opened : closed;
    backdrop.style.opacity = value ? "1" : "0";
    if (value) openedAt = performance.now();
    else settleTimer = window.setTimeout(hideClosed, 500);
  }
  sheet.addEventListener("transitionend", event => {
    if (event.target === sheet && event.propertyName === "transform") hideClosed();
  }, { signal: abort.signal });
  function canDrag(target: Element) {
    if (getSelection()?.toString()) return false;
    for (let node: Element | null = target; node && node !== sheet; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight && node.scrollTop > 0) return false;
    }
    return true;
  }
  sheet.addEventListener("pointerdown", event => {
    if (!open || event.button !== 0 ||
      (event.target as Element).closest("button:not(.thread-card),input,textarea,select")) return;
    drag = {
      id: event.pointerId,
      y: event.pageY,
      start: performance.now(),
      distance: 0,
      height: sheet.getBoundingClientRect().height,
      active: false,
    };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }, { signal: abort.signal });
  sheet.addEventListener("pointermove", event => {
    if (drag?.id !== event.pointerId || !open) return;
    const distance = event.pageY - drag.y;
    if (!drag.active) {
      if (openedAt && performance.now() - openedAt < 500) return;
      const threshold = event.pointerType === "touch" ? 10 : 2;
      if (distance < -threshold) { drag = undefined; return; }
      if (distance <= threshold || !canDrag(event.target as Element)) return;
      drag.active = true;
      sheet.style.transition = backdrop.style.transition = "none";
    }
    drag.distance = Math.max(0, distance);
    sheet.style.transform = `translate3d(0,${drag.distance}px,0)`;
  }, { signal: abort.signal });
  const end = (event: PointerEvent, cancelled: boolean) => {
    if (drag?.id !== event.pointerId) return;
    const { active, distance, start, height } = drag;
    drag = undefined;
    if (!active) return;
    if (!cancelled &&
      (distance >= height * .25 || distance / Math.max(1, performance.now() - start) > .4))
      close();
    else settle(open);
  };
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    sheet.addEventListener(type, event => end(event as PointerEvent, type !== "pointerup"),
      { signal: abort.signal });
  sheet.style.transform = closed;
  sheet.hidden = backdrop.hidden = true;
  sheet.inert = true;
  return {
    position(bottom: number) {
      sheet.style.translate = `0 ${bottom}px`;
    },
    update(value: boolean, restored = false, lock = value) {
      if (disposed) return;
      if (lock && !locked) {
        const body = document.body;
        const overflow = body.style.overflow;
        body.style.overflow = "hidden";
        release = () => {
          body.style.overflow = overflow;
        };
      } else if (!lock && locked) {
        release?.();
        release = undefined;
      }
      locked = lock;
      if (open === value) return;
      open = value;
      drag = undefined;
      if (value)
        previousFocus = (mount.getRootNode() as ShadowRoot)
          .activeElement as HTMLElement | null;
      settle(value, restored);
      if (value && !restored) dismiss.focus({ preventScroll: true });
      else if (!value && previousFocus?.isConnected) {
        previousFocus.focus({ preventScroll: true });
        previousFocus = null;
      }
    },
    destroy() {
      disposed = true;
      abort.abort();
      clearTimeout(settleTimer);
      release?.();
      content.remove();
      mount.remove();
    },
  };
}
