// Panels-inspired edge reveal; see NOTICE.md.
export function drawerPresence(
  toolbar: HTMLElement,
  keepOpen: () => boolean,
  signal: AbortSignal,
  autoHide = true
) {
  if (!autoHide) return { show() {}, update() {} };
  let timer = 0;
  let pointerFrame = 0;
  let peekTimer = 0;
  let peekEndTimer = 0;
  let pointer: { x: number; y: number } | undefined;
  const canHide = matchMedia("(hover: hover) and (pointer: fine)");
  if (canHide.matches) toolbar.dataset.away = "true";
  const setDirection = () => {
    const rect = toolbar.getBoundingClientRect();
    const gaps = [
      rect.left,
      window.innerWidth - rect.right,
      rect.top,
      window.innerHeight - rect.bottom,
    ];
    const side = gaps.indexOf(Math.min(...gaps));
    toolbar.style.setProperty(
      "--drawer-away-x",
      `${side === 0 ? -24 : side === 1 ? 24 : 0}px`
    );
    toolbar.style.setProperty(
      "--drawer-away-y",
      `${side === 2 ? -24 : side === 3 ? 24 : 0}px`
    );
  };
  const show = () => {
    clearTimeout(peekTimer);
    clearTimeout(peekEndTimer);
    delete toolbar.dataset.peek;
    clearTimeout(timer);
    timer = 0;
    delete toolbar.dataset.away;
  };
  const update = () => {
    if (!canHide.matches || keepOpen()) {
      show();
      return;
    }
    const rect = toolbar.getBoundingClientRect();
    const near =
      pointer &&
      pointer.x >= rect.left - 72 &&
      pointer.x <= rect.right + 72 &&
      pointer.y >= rect.top - 72 &&
      pointer.y <= rect.bottom + 72;
    const menu = toolbar.querySelector(".morphing-menu");
    const focused =
      toolbar.getRootNode() instanceof ShadowRoot &&
      toolbar.contains((toolbar.getRootNode() as ShadowRoot).activeElement);
    if (
      !canHide.matches ||
      keepOpen() ||
      near ||
      focused ||
      toolbar.dataset.dragging ||
      (menu && menu.getAttribute("data-view") !== "collapsed")
    ) {
      show();
      return;
    }
    if (timer || toolbar.dataset.away) return;
    timer = window.setTimeout(() => {
      timer = 0;
      setDirection();
      toolbar.dataset.away = "true";
    }, 450);
  };
  const schedulePeek = () => {
    if (!canHide.matches || signal.aborted) return;
    peekTimer = window.setTimeout(() => {
      if (!toolbar.dataset.away || keepOpen()) return;
      setDirection();
      toolbar.dataset.peek = "true";
      peekEndTimer = window.setTimeout(() => {
        delete toolbar.dataset.peek;
      }, 900);
    }, 700);
  };
  if (document.readyState === "complete") schedulePeek();
  else window.addEventListener("load", schedulePeek, { once: true, signal });
  document.addEventListener(
    "pointermove",
    (event) => {
      pointer = { x: event.clientX, y: event.clientY };
      if (!pointerFrame)
        pointerFrame = requestAnimationFrame(() => {
          pointerFrame = 0;
          update();
        });
    },
    { passive: true, signal }
  );
  toolbar.addEventListener("focusin", show, { signal });
  toolbar.addEventListener("focusout", () => queueMicrotask(update), {
    signal,
  });
  const observer = new MutationObserver(update);
  observer.observe(toolbar, {
    subtree: true,
    attributes: true,
    attributeFilter: ["data-view", "data-dragging"],
  });
  signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timer);
      cancelAnimationFrame(pointerFrame);
      clearTimeout(peekTimer);
      clearTimeout(peekEndTimer);
      observer.disconnect();
    },
    { once: true }
  );
  return { show, update };
}
