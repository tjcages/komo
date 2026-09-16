import { describe, expect, it } from "vitest";
import { constrain, settle } from "../src/floating-drag";

describe("floating placement", () => {
  it("snaps to a corner with a 16px clearance", () => {
    expect(settle({ x: 30, y: 500 }, 320, 180, 1000, 720)).toEqual({
      x: 16,
      y: 524,
      edgeX: "left",
      edgeY: "bottom",
    });
  });
  it("keeps a free placement away from the edges", () => {
    expect(settle({ x: 300, y: 200 }, 320, 180, 1000, 720)).toEqual({
      x: 300,
      y: 200,
    });
  });
  it("keeps a docked card against the edge after resizing", () => {
    expect(
      constrain(
        { x: 664, y: 524, edgeX: "right", edgeY: "bottom" },
        320,
        250,
        600,
        600
      )
    ).toEqual({ x: 264, y: 334, edgeX: "right", edgeY: "bottom" });
  });
  it("keeps an oversized surface's controls reachable", () => {
    expect(constrain({ x: -100, y: -100 }, 500, 900, 400, 700)).toEqual({
      x: 16,
      y: 16,
    });
  });
});
