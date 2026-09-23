// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { mobileDrawer } from "../src/mobile-drawer";

let drawer: ReturnType<typeof mobileDrawer> | undefined;
afterEach(() => {
  drawer?.destroy();
  document.body.replaceChildren();
  document.head.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.remove());
  document.body.removeAttribute("style");
  document.documentElement.removeAttribute("style");
  vi.unstubAllGlobals();
});
function setup() {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const page = document.createElement("main"),
    host = document.createElement("div");
  document.body.append(page, host);
  const shadow = host.attachShadow({ mode: "open" });
  const mount = document.createElement("div"),
    content = document.createElement("aside");
  shadow.append(mount);
  drawer = mobileDrawer(mount, content, () => drawer!.update(false));
  return { page, shadow, content };
}
it("contains comments and restores host scrolling on repeated close or destroy", () => {
  const { page, shadow, content } = setup();
  const theme = document.createElement("meta");
  theme.name = "theme-color";
  theme.content = "#ffffff";
  document.head.append(theme);
  document.documentElement.style.backgroundColor = "white";
  document.body.style.pointerEvents = "none";
  document.body.style.overflow = "clip";
  document.documentElement.style.overflow = "scroll";
  for (let i = 0; i < 2; i++) {
    drawer!.update(true);
    expect(shadow.querySelector(".mobile-drawer-slot")?.contains(content)).toBe(
      true,
    );
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("scroll");
    expect(theme.content).toBe("#ffffff");
    expect(document.body.style.pointerEvents).toBe("none");
    expect(page.hasAttribute("aria-hidden")).toBe(false);
    drawer!.update(false);
    expect(document.body.style.overflow).toBe("clip");
    expect(theme.content).toBe("#ffffff");
    expect(document.documentElement.style.backgroundColor).toBe("white");
    expect(document.documentElement.style.overflow).toBe("scroll");
    expect(document.body.style.pointerEvents).toBe("none");
  }
  drawer!.update(true);
  drawer!.destroy();
  expect(document.body.style.overflow).toBe("clip");
  expect(document.documentElement.style.overflow).toBe("scroll");
});
it("restores an open sheet without moving focus and keeps the lock during account handoff", () => {
  const { shadow } = setup();
  const input = document.createElement("input");
  shadow.append(input);
  input.focus();
  drawer!.update(true, true);
  drawer!.update(true);
  expect(shadow.activeElement).toBe(input);
  drawer!.update(false, false, true);
  expect(document.body.style.overflow).toBe("hidden");
  expect((shadow.querySelector(".mobile-drawer") as HTMLElement).hidden).toBe(
    true,
  );
  drawer!.update(false);
  expect(document.body.style.overflow).toBe("");
});
it("drags the handle and list top without stealing a scrolled list", () => {
  const { shadow, content } = setup();
  const list = document.createElement("div");
  list.className = "list";
  const card = document.createElement("button");
  card.className = "thread-card";
  list.append(card);
  content.append(list);
  const sheet = shadow.querySelector(".mobile-drawer") as HTMLElement;
  const head = shadow.querySelector(".mobile-drawer-head") as HTMLElement;
  drawer!.position(-40);
  expect(sheet.style.bottom).toBe("40px");
  Object.defineProperty(sheet, "getBoundingClientRect", { value: () => ({ height: 600 }) });
  Object.defineProperty(list, "scrollHeight", { value: 1000 });
  Object.defineProperty(list, "clientHeight", { value: 500 });
  const pointer = (target: Element, type: string, y: number) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId: 1, pageY: y, button: 0, pointerType: "touch" });
    target.dispatchEvent(event);
    return event;
  };
  drawer!.update(true);
  list.scrollTop = 20;
  pointer(card, "pointerdown", 300);
  pointer(card, "pointermove", 500);
  pointer(card, "pointerup", 500);
  expect(sheet.hidden).toBe(false);
  expect(sheet.style.transform).toBe("translate3d(0,0,0)");
  list.scrollTop = 0;
  pointer(card, "pointerdown", 300);
  pointer(card, "pointermove", 350);
  expect(sheet.style.transition).toBe("none");
  pointer(card, "pointermove", 500);
  expect(sheet.style.transform).toBe("translate3d(0,200px,0)");
  pointer(card, "pointercancel", 500);
  expect(sheet.hidden).toBe(false);
  expect(sheet.style.transform).toBe("translate3d(0,0,0)");
  pointer(head, "pointerdown", 300);
  pointer(head, "pointermove", 350);
  expect(sheet.style.transform).toBe("translate3d(0,50px,0)");
  pointer(head, "pointercancel", 350);
  pointer(card, "pointerdown", 300);
  pointer(card, "pointermove", 500);
  pointer(card, "pointerup", 500);
  expect(sheet.hidden).toBe(true);
  expect(document.body.style.overflow).toBe("");
  expect(document.querySelector('meta[name="theme-color"]')).toBeNull();
});
