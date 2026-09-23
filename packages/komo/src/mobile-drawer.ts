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
  let motion: Animation | undefined;
  let shade: Animation | undefined;
  let drag:
    | { id: number; y: number; start: number; distance: number }
    | undefined;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  function settle(value: boolean, restored = false) {
    const dim = backdrop.hidden ? "0" : getComputedStyle(backdrop).opacity;
    const from = sheet.hidden
      ? "translateY(105%)"
      : getComputedStyle(sheet).transform;
    motion?.cancel();
    shade?.cancel();
    motion = undefined;
    sheet.style.transform = value ? "translateY(0)" : "translateY(105%)";
    if (value) sheet.hidden = false;
    sheet.inert = !value;
    backdrop.hidden = false;
    backdrop.style.opacity = value ? "1" : "0";
    if (!reduced.matches && !restored && !sheet.hidden) {
      const next = sheet.animate(
        [
          { transform: from === "none" ? "translateY(105%)" : from },
          { transform: sheet.style.transform },
        ],
        { duration: 260, easing: "cubic-bezier(.22,1,.36,1)" },
      );
      motion = next;
      shade = backdrop.animate(
        [{ opacity: dim }, { opacity: value ? "1" : "0" }],
        { duration: 180, easing: "ease-out" },
      );
      void shade.finished.catch(() => {});
      void next.finished
        .then(() => {
          if (motion !== next || disposed) return;
          motion = undefined;
          shade = undefined;
          sheet.hidden = !open;
          backdrop.hidden = !open;
          backdrop.style.opacity = "";
        })
        .catch(() => {});
    } else {
      sheet.hidden = backdrop.hidden = !value;
      backdrop.style.opacity = "";
    }
  }
  head.addEventListener(
    "pointerdown",
    (event) => {
      if (!open || event.button !== 0 || (event.target as Element).closest("button")) return;
      const transform = getComputedStyle(sheet).transform;
      const offset = new DOMMatrix(transform).m42;
      motion?.cancel();
      shade?.cancel();
      sheet.style.transform = transform;
      motion = undefined;
      drag = {
        id: event.pointerId,
        y: event.clientY - offset,
        start: performance.now(),
        distance: 0,
      };
      head.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    { signal: abort.signal },
  );
  const move = (distance: number) => {
    if (!drag) return;
    drag.distance = Math.max(0, distance);
    sheet.style.transform = `translateY(${drag.distance}px)`;
    backdrop.style.opacity = String(1 - Math.min(1, drag.distance / sheet.offsetHeight));
  };
  head.addEventListener("pointermove", event => {
    if (drag?.id === event.pointerId) move(event.clientY - drag.y);
  }, { signal: abort.signal });
  const end = (cancelled: boolean) => {
    if (!drag) return;
    const { distance, start } = drag;
    drag = undefined;
    if (
      !cancelled &&
      (distance > sheet.offsetHeight * 0.28 ||
        (distance > 40 &&
          distance / Math.max(1, performance.now() - start) > 0.6))
    )
      close();
    else settle(open);
  };
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    head.addEventListener(type, event => {
      if (drag?.id === (event as PointerEvent).pointerId) end(type !== "pointerup");
    }, {
      signal: abort.signal,
    });
  // Let the list scroll natively; a downward pull at its top dismisses.
  let touchY: number | undefined;
  slot.addEventListener("touchstart", (event) => {
    const target = event.target as Element;
    touchY = event.touches.length === 1 &&
      !target.closest("button:not(.thread-card),input,textarea,select") &&
      !(content.querySelector(".list")?.scrollTop)
      ? event.touches[0].clientY : undefined;
  }, { passive: true, signal: abort.signal });
  slot.addEventListener("touchmove", (event) => {
    if (touchY === undefined) return;
    const distance = event.touches[0].clientY - touchY;
    if (distance < 0 && !drag) { touchY = undefined; return; }
    if (!event.cancelable) return;
    event.preventDefault();
    motion?.cancel();
    shade?.cancel();
    drag ??= { id: -1, y: touchY, start: performance.now(), distance: 0 };
    move(distance);
  }, { passive: false, signal: abort.signal });
  for (const type of ["touchend", "touchcancel"])
    slot.addEventListener(type, () => {
      touchY = undefined;
      if (drag?.id === -1) end(type !== "touchend");
    }, { signal: abort.signal });
  sheet.style.transform = "translateY(105%)";
  sheet.hidden = backdrop.hidden = true;
  sheet.inert = true;
  return {
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
      motion?.cancel();
      shade?.cancel();
      release?.();
      content.remove();
      mount.remove();
    },
  };
}
