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
/** Select some text inside an element, as a reader would. */
const select = (element: Element) => {
  const range = document.createRange();
  range.selectNodeContents(element.firstChild!);
  getSelection()!.removeAllRanges();
  getSelection()!.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
};
const pagerButton = (shadow: ShadowRoot, label: string) =>
  shadow.querySelector<HTMLButtonElement>(
    `.text-option-pager [aria-label="${label}"]`,
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  queue.mockClear();
  notify.mockClear();
});

it("reads options from the attribute and templates, and skips blocks without alternatives", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  mount();
  const rows = ui!.panel.querySelectorAll(".text-option-row");
  expect([...rows].map((row) => row.textContent)).toEqual([
    "First1/3",
    "Lede1/2",
  ]);
  expect(document.querySelector("p template")).toBeNull();
  expect(warn).toHaveBeenCalledOnce();
});

it("shows the pager only for a selection inside one block", () => {
  vi.useFakeTimers();
  const shadow = mount();
  const pager = shadow.querySelector<HTMLElement>(".text-option-pager")!;
  select(document.querySelector("h3")!);
  vi.runAllTimers();
  expect(pager.hidden).toBe(true);
  select(document.querySelector("h1")!);
  expect(pager.hidden).toBe(false);
  getSelection()!.removeAllRanges();
  document.dispatchEvent(new Event("selectionchange"));
  expect(pager.hidden).toBe(false);
  vi.runAllTimers();
  expect(pager.hidden).toBe(true);
  vi.useRealTimers();
});

it("swaps a block in place, cycles, and keeps the pick across a reload", () => {
  const shadow = mount();
  const title = document.querySelector("h1")!;
  select(title);
  const pager = shadow.querySelector<HTMLElement>(".text-option-pager")!;
  expect(pager.hidden).toBe(false);
  expect(pager.textContent).toBe("1/3");
  pagerButton(shadow, "Next option").click();
  pagerButton(shadow, "Next option").click();
  expect(title.innerHTML).toBe("<em>Third</em>");
  // The new content stays selected, so the pager stays with it.
  expect(getSelection()!.toString()).toBe("Third");
  pagerButton(shadow, "Next option").click();
  pagerButton(shadow, "Previous option").click();
  expect(title.innerHTML).toBe("<em>Third</em>");
  expect(pager.textContent).toBe("3/3");

  ui!.destroy();
  expect(title.innerHTML).toBe("First");
  mount();
  expect(title.innerHTML).toBe("<em>Third</em>");
  expect(ui!.panel.querySelector("[data-picked]")?.textContent).toBe(
    "Third3/3",
  );
});

it("starts over when the agent changes the options under a pick", () => {
  const shadow = mount();
  const title = document.querySelector("h1")!;
  select(title);
  pagerButton(shadow, "Next option").click();
  ui!.destroy();
  title.setAttribute("data-komo-options", '["New second"]');
  mount();
  expect(title.innerHTML).toBe("First");
  expect(ui!.panel.querySelector("[data-picked]")).toBeNull();
});

it("queues the picked blocks as one note, and copies them without a local agent", async () => {
  const shadow = mount();
  select(document.querySelector("h1")!);
  pagerButton(shadow, "Next option").click();
  const action = ui!.panel.querySelector<HTMLButtonElement>(
    ".text-options-head button",
  )!;
  expect(action.textContent).toBe("Queue picks");
  action.click();
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
  expect(body).toBe("Use these text options:\n- hero: option 2 of 3: Second");
  expect(target).toBe(document.querySelector("h1"));
  await vi.waitFor(() =>
    expect(
      ui!.panel.querySelector<HTMLButtonElement>(".text-options-head button")!
        .disabled,
    ).toBe(true),
  );

  ui!.destroy();
  const writeText = vi.fn(async () => {});
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  mount(false);
  const copy = ui!.panel.querySelector<HTMLButtonElement>(
    ".text-options-head button",
  )!;
  expect(copy.textContent).toBe("Copy picks");
  copy.click();
  await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(body));
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
