import { describe, expect, it } from "vitest";
import { mobileComposerPosition, reviewLayout } from "../src/review-layout";

describe("review viewport layout", () => {
  it.each([
    [320, 568],
    [390, 844],
    [760, 600],
    [844, 390],
  ])(
    "reserves a bottom sheet without horizontal overflow at %i × %i",
    (width, height) => {
      const layout = reviewLayout(width, height, true);
      expect(layout.mobile).toBe(true);
      expect(height - layout.sheetTop).toBeGreaterThanOrEqual(height / 2);
      expect(layout.top + layout.height).toBeLessThan(layout.sheetTop);
      expect(layout.left).toBeGreaterThanOrEqual(0);
      expect(layout.left + layout.visibleWidth).toBeLessThanOrEqual(width);
      expect(layout.scale).toBeLessThan(1);
      expect(layout.height / layout.scale).toBeCloseTo(height);
      expect(layout.top).toBeLessThan(0);
      expect(layout.visibleTop).toBe(0);
      expect(layout.visibleHeight).toBeCloseTo(layout.sheetTop - 12);
    }
  );
  it("keeps the frame full-height when the keyboard reduces visible space", () => {
    const layout = reviewLayout(390, 450, true, 844);
    expect(layout.height / layout.scale).toBeCloseTo(844);
    expect(layout.top + layout.height).toBeCloseTo(layout.sheetTop - 12);
  });
  it.each([844, 450])(
    "gives mobile accounts the visible viewport at height %i",
    (height) => {
      const layout = reviewLayout(390, height, true, 844, true);
      expect(layout.sheetTop).toBe(0);
      expect(layout.visibleHeight).toBe(0);
      expect(layout.top + layout.height).toBe(-12);
      expect(reviewLayout(1280, 800, true, 800, true).right).toBe(404);
    }
  );
  it("restores the full page when closed", () => {
    const layout = reviewLayout(390, 844, false);
    expect(layout.framed).toBe(false);
    expect(layout.scale).toBe(1);
    expect(layout.height).toBe(844);
    expect(layout.left).toBe(0);
  });
  it("keeps the desktop comment column", () => {
    const layout = reviewLayout(1280, 800, true);
    expect(layout.desktop).toBe(true);
    expect(layout.right).toBe(404);
    expect(layout.dockCenter).toBe(1090);
  });
});

describe("mobile composer", () => {
  it.each([
    [844, 0],
    [420, 0],
    [420, 180],
  ])(
    "docks above the visible bottom at height %i and offset %i",
    (height, top) => {
      const position = mobileComposerPosition(390, height, top, 354, 120);
      expect(position.x).toBe(18);
      expect(position.y + 120).toBe(top + height - 12);
      expect(position.y).toBeGreaterThanOrEqual(top + 12);
    }
  );
});
