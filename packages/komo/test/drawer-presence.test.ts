// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { drawerPresence } from "../src/drawer-presence";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
it("peeks the top half from the viewport bottom, without slicing the dock", () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const toolbar = document.createElement("div");
  toolbar.innerHTML = '<div class="morphing-menu" data-view="collapsed"></div>';
  document.body.append(toolbar);
  vi.spyOn(toolbar, "getBoundingClientRect").mockReturnValue({
    left: 300,
    right: 700,
    top: 680,
    bottom: 736,
    width: 400,
    height: 56,
  } as DOMRect);
  const abort = new AbortController();
  const presence = drawerPresence(toolbar, () => false, abort.signal);
  window.dispatchEvent(new Event("load"));
  vi.advanceTimersByTime(700);
  expect(toolbar.dataset.peek).toBe("true");
  // At 768px viewport height: top + translation = 768 - height / 2.
  expect(
    680 + parseFloat(toolbar.style.getPropertyValue("--drawer-peek-y")),
  ).toBe(740);
  expect(toolbar.style.getPropertyValue("--drawer-peek-x")).toBe("0px");
  expect(toolbar.style.getPropertyValue("--drawer-peek-clip")).toBe("");
  presence.show();
  expect(toolbar.dataset.intro).toBeUndefined();
  expect(toolbar.dataset.away).toBeUndefined();
  abort.abort();
});
it("peeks from the edge the dock was moved to", () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const toolbar = document.createElement("div");
  toolbar.innerHTML = '<div class="morphing-menu" data-view="collapsed"></div>';
  document.body.append(toolbar);
  // A vertical dock 16px from the left edge.
  vi.spyOn(toolbar, "getBoundingClientRect").mockReturnValue({
    left: 16,
    right: 68,
    top: 200,
    bottom: 500,
    width: 52,
    height: 300,
  } as DOMRect);
  const abort = new AbortController();
  drawerPresence(toolbar, () => false, abort.signal);
  window.dispatchEvent(new Event("load"));
  vi.advanceTimersByTime(700);
  const value = (name: string) => toolbar.style.getPropertyValue(name);
  expect([value("--drawer-intro-x"), value("--drawer-intro-y")]).toEqual([
    "-76px",
    "0px",
  ]);
  // Half the dock shows past the left edge.
  expect([value("--drawer-peek-x"), value("--drawer-peek-y")]).toEqual([
    "-42px",
    "0px",
  ]);
  expect(value("--drawer-away-x")).toBe("-24px");
  abort.abort();
});
