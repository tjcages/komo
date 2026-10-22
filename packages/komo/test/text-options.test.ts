// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { note, textOptions, type TextOptions } from "../src/text-options";
import type { OptionPick } from "../src/types";

let ui: TextOptions | undefined;
const queue = vi.fn(async () => {});
const notify = vi.fn();
const mount = (local = true) => {
  const shadow = document.createElement("div").attachShadow({ mode: "open" });
  ui = textOptions({
    shadow,
    page: () => "/",
    enabled: () => true,
    local,
    queue,
    notify,
    selector: (element) => element.tagName.toLowerCase(),
  });
  return shadow;
};
const hover = (element: Element) =>
  element.dispatchEvent(
    new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }),
  );
const control = (shadow: ShadowRoot, label: string) =>
  shadow.querySelector<HTMLButtonElement>(
    `.text-option-float [aria-label="${label}"]`,
  )!;

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
  const rect = {
    left: 100,
    top: 100,
    right: 300,
    bottom: 140,
    width: 200,
    height: 40,
  };
  Object.assign(Range.prototype, {
    getBoundingClientRect: () => rect,
    getClientRects: () => [rect],
  });
  document.body.innerHTML = `
    <h1 data-komo-id="hero" data-komo-options='["Second", "<em>Third</em>"]'>First</h1>
    <p data-komo-options>Lede<template data-komo-option>Other lede</template></p>
    <h2 data-komo-options='not json'>Broken</h2>
    <h3 data-komo-options='["Same"]'>Same</h3>`;
});
afterEach(() => {
  ui?.destroy();
  ui = undefined;
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  queue.mockClear();
  notify.mockClear();
});

it("reads options from the attribute and templates, and marks the page with a hint", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const shadow = mount();
  expect(document.querySelector("p template")).toBeNull();
  expect(warn).toHaveBeenCalledOnce();
  expect(document.head.textContent).toContain("text-decoration-style: dotted");
  hover(document.querySelector("p")!);
  expect(shadow.querySelector(".text-option-count")!.textContent).toBe("1/2");
  // A block whose only alternative repeats its content offers nothing.
  vi.useFakeTimers();
  hover(document.querySelector("h3")!);
  vi.runAllTimers();
  expect(shadow.querySelector<HTMLElement>(".text-option-float")!.hidden).toBe(
    true,
  );
  ui!.destroy();
  expect(document.head.textContent).not.toContain("dotted");
});

it("previews on hover, keeps with ✓, and keeps the pick across a reload", () => {
  const shadow = mount();
  const title = document.querySelector("h1")!;
  hover(title);
  const float = shadow.querySelector<HTMLElement>(".text-option-float")!;
  expect(float.hidden).toBe(false);
  control(shadow, "Next option").click();
  control(shadow, "Next option").click();
  expect(title.innerHTML).toBe("<em>Third</em>");
  expect(float.textContent).toBe("3/3");
  control(shadow, "Use this option").click();
  expect(float.hidden).toBe(true);
  expect(title.innerHTML).toBe("<em>Third</em>");

  ui!.destroy();
  expect(title.innerHTML).toBe("First");
  mount();
  expect(title.innerHTML).toBe("<em>Third</em>");
});

it("puts a preview back when the reader leaves or presses ✕", () => {
  vi.useFakeTimers();
  const shadow = mount();
  const title = document.querySelector("h1")!;
  hover(title);
  control(shadow, "Next option").click();
  expect(title.innerHTML).toBe("Second");
  hover(document.querySelector("h2")!);
  vi.runAllTimers();
  expect(title.innerHTML).toBe("First");

  hover(title);
  control(shadow, "Next option").click();
  control(shadow, "Keep the current text").click();
  expect(title.innerHTML).toBe("First");
  expect(localStorage.length).toBe(0);
});

it("starts over when the agent changes the options under a pick", () => {
  const shadow = mount();
  const title = document.querySelector("h1")!;
  hover(title);
  control(shadow, "Next option").click();
  control(shadow, "Use this option").click();
  ui!.destroy();
  title.setAttribute("data-komo-options", '["New second"]');
  mount();
  expect(title.innerHTML).toBe("First");
});

it("queues each kept pick as a note in local agent mode only", async () => {
  const shadow = mount();
  hover(document.querySelector("h1")!);
  control(shadow, "Next option").click();
  control(shadow, "Use this option").click();
  await vi.waitFor(() => expect(queue).toHaveBeenCalledOnce());
  const [picks, body, target] = queue.mock.calls[0] as unknown as [
    OptionPick[],
    string,
    Element,
  ];
  expect(picks).toEqual([
    {
      block: "hero",
      selector: "h1",
      index: 1,
      count: 3,
      text: "Second",
      html: "Second",
      original: "First",
    },
  ]);
  expect(body).toBe("Use this text option:\n- hero: option 2 of 3: Second");
  expect(target).toBe(document.querySelector("h1"));
  // Keeping the same pick again sends nothing new.
  hover(document.querySelector("h1")!);
  control(shadow, "Use this option").click();
  expect(queue).toHaveBeenCalledOnce();

  ui!.destroy();
  localStorage.clear();
  const hosted = mount(false);
  hover(document.querySelector("h1")!);
  control(hosted, "Use this option").click();
  expect(queue).toHaveBeenCalledOnce();
});

it("keeps a note within 4,000 characters", () => {
  const long = "x".repeat(300);
  const picks = Array.from({ length: 40 }, (_, index) => ({
    block: `block-${index}`,
    selector: "p",
    index: 0,
    count: 2,
    text: long,
    html: long,
    original: long,
  }));
  const body = note(picks);
  expect(body.length).toBeLessThanOrEqual(4000);
  expect(body).toMatch(/- \d+ more: komo options list --local$/);
  expect(body).toContain("- block-0: option 1 of 2 (current): ");
});
