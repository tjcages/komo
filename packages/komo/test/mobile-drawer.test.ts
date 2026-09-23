// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { mobileDrawer } from "../src/mobile-drawer";

let drawer: ReturnType<typeof mobileDrawer> | undefined;
afterEach(() => {
  drawer?.destroy();
  document.body.replaceChildren();
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
  document.body.style.pointerEvents = "none";
  document.body.style.overflow = "clip";
  document.documentElement.style.overflow = "scroll";
  for (let i = 0; i < 2; i++) {
    drawer!.update(true);
    expect(shadow.querySelector(".mobile-drawer-slot")?.contains(content)).toBe(
      true,
    );
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.pointerEvents).toBe("none");
    expect(page.hasAttribute("aria-hidden")).toBe(false);
    drawer!.update(false);
    expect(document.body.style.overflow).toBe("clip");
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
