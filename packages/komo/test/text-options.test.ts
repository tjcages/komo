// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { note, textOptions, type TextOptions } from "../src/text-options";
import type { OptionPick } from "../src/types";

let ui: TextOptions | undefined;
let queued = 0;
const queue = vi.fn(async () => `note-${++queued}`);
const unqueue = vi.fn(async () => {});
const notify = vi.fn();
const mount = (local = true) => {
  const shadow = document.createElement("div").attachShadow({ mode: "open" });
  ui = textOptions({
    shadow,
    page: () => "/",
    enabled: () => true,
    local,
    queue,
    unqueue,
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
  unqueue.mockClear();
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
  const toggle = shadow.querySelector<HTMLElement>(".text-option-verdict")!;
  expect(float.hidden).toBe(false);
  expect(toggle.dataset.verdict).toBeUndefined();
  control(shadow, "Next option").click();
  control(shadow, "Next option").click();
  expect(title.innerHTML).toBe("<em>Third</em>");
  expect(float.textContent).toBe("3/3");
  control(shadow, "Use this option").click();
  // The switcher stays open and the toggle shows the verdict.
  expect(float.hidden).toBe(false);
  expect(toggle.dataset.verdict).toBe("keep");
  expect(control(shadow, "Use this option").getAttribute("aria-pressed")).toBe(
    "true",
  );
  control(shadow, "Previous option").click();
  expect(toggle.dataset.verdict).toBeUndefined();

  ui!.destroy();
  expect(title.innerHTML).toBe("First");
  mount();
  expect(title.innerHTML).toBe("<em>Third</em>");
});

it("puts an undecided preview back when the reader leaves", () => {
  vi.useFakeTimers();
  const shadow = mount();
  const title = document.querySelector("h1")!;
  hover(title);
  control(shadow, "Next option").click();
  expect(title.innerHTML).toBe("Second");
  hover(document.querySelector("h2")!);
  vi.runAllTimers();
  expect(title.innerHTML).toBe("First");
});

it("declines with ✕, un-keeps a declined pick, and reports when none fit", async () => {
  const shadow = mount();
  const lede = document.querySelector("p")!;
  const toggle = shadow.querySelector<HTMLElement>(".text-option-verdict")!;
  hover(lede);
  control(shadow, "Next option").click();
  control(shadow, "Use this option").click();
  await vi.waitFor(() => expect(queue).toHaveBeenCalledOnce());
  control(shadow, "Decline this option").click();
  expect(toggle.dataset.verdict).toBe("decline");
  expect(
    control(shadow, "Decline this option").getAttribute("aria-pressed"),
  ).toBe("true");
  // Un-keeping took back the note that ✓ queued.
  await vi.waitFor(() => expect(unqueue).toHaveBeenCalledOnce());
  expect(
    JSON.parse(
      localStorage.getItem("komo:text-options:http://localhost:3000/")!,
    ),
  ).toEqual({ p: { decline: ["Other lede"] } });
  const first = await queue.mock.results[0].value;
  expect(unqueue).toHaveBeenCalledWith(first);
  control(shadow, "Previous option").click();
  expect(toggle.dataset.verdict).toBeUndefined();
  control(shadow, "Decline this option").click();
  await vi.waitFor(() => expect(queue).toHaveBeenCalledTimes(2));
  const [picks, body] = queue.mock.calls[1] as unknown as [
    OptionPick[],
    string,
  ];
  expect(picks).toEqual([]);
  expect(body).toBe(
    "None of the text options fit. Write new copy:\n- p: all 2 options declined. Current copy: Lede",
  );
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
  // A changed mind replaces the queued note with one for the new pick.
  control(shadow, "Next option").click();
  control(shadow, "Use this option").click();
  await vi.waitFor(() => expect(queue).toHaveBeenCalledTimes(2));
  expect(unqueue).toHaveBeenCalledWith(await queue.mock.results[0].value);
  expect((queue.mock.calls[1] as unknown as [OptionPick[]])[0][0].index).toBe(
    2,
  );
  expect(
    JSON.parse(
      localStorage.getItem("komo:text-options:http://localhost:3000/")!,
    ).hero.note,
  ).toBe(await queue.mock.results[1].value);

  ui!.destroy();
  localStorage.clear();
  const hosted = mount(false);
  hover(document.querySelector("h1")!);
  control(hosted, "Use this option").click();
  expect(queue).toHaveBeenCalledTimes(2);
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
