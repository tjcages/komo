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
  let open = false,
    locked = false,
    disposed = false;
  let previousFocus: HTMLElement | null = null;
  let release: (() => void) | undefined;
  let motion: Animation | undefined;
  let drag:
    | { id: number; y: number; start: number; distance: number }
    | undefined;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  function settle(value: boolean, restored = false) {
    const from = sheet.hidden
      ? "translateY(105%)"
      : getComputedStyle(sheet).transform;
    motion?.cancel();
    motion = undefined;
    sheet.style.transform = value ? "translateY(0)" : "translateY(105%)";
    if (value) sheet.hidden = false;
    sheet.inert = !value;
    backdrop.hidden = !value;
    if (!reduced.matches && !restored && !sheet.hidden) {
      const next = sheet.animate(
        [
          { transform: from === "none" ? "translateY(105%)" : from },
          { transform: sheet.style.transform },
        ],
        { duration: 320, easing: "cubic-bezier(.32,.72,0,1)" },
      );
      motion = next;
      void next.finished
        .then(() => {
          if (motion !== next || disposed) return;
          motion = undefined;
          sheet.hidden = !open;
        })
        .catch(() => {});
    } else sheet.hidden = !value;
  }
  handle.addEventListener(
    "pointerdown",
    (event) => {
      if (!open || event.button !== 0) return;
      motion?.cancel();
      motion = undefined;
      drag = {
        id: event.pointerId,
        y: event.clientY,
        start: performance.now(),
        distance: 0,
      };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    { signal: abort.signal },
  );
  handle.addEventListener(
    "pointermove",
    (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      drag.distance = Math.max(0, event.clientY - drag.y);
      sheet.style.transform = `translateY(${drag.distance}px)`;
    },
    { signal: abort.signal },
  );
  const end = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    const { distance, start } = drag;
    drag = undefined;
    if (
      event.type === "pointerup" &&
      (distance > sheet.offsetHeight * 0.28 ||
        (distance > 40 &&
          distance / Math.max(1, performance.now() - start) > 0.6))
    )
      close();
    else settle(open);
  };
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    handle.addEventListener(type, end as EventListener, {
      signal: abort.signal,
    });
  sheet.style.transform = "translateY(105%)";
  sheet.hidden = backdrop.hidden = true;
  sheet.inert = true;
  return {
    update(value: boolean, restored = false, lock = value) {
      if (disposed) return;
      if (lock && !locked) {
        const body = document.body,
          html = document.documentElement;
        const overflow = body.style.overflow,
          htmlOverflow = html.style.overflow;
        body.style.overflow = html.style.overflow = "hidden";
        release = () => {
          body.style.overflow = overflow;
          html.style.overflow = htmlOverflow;
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
      motion?.cancel();
      release?.();
      content.remove();
      mount.remove();
    },
  };
}
