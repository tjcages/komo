import { describe, expect, it } from "vitest";
import { createElement, type FunctionComponent, type SVGProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { icons } from "../src/dom";
import { staticSvg } from "../src/static-svg";

describe("static review icons", () => {
  it.each(Object.entries(icons))(
    "preserves React-rendered SVG for %s",
    (_name, component) => {
      const props = { "aria-hidden": true } as SVGProps<SVGSVGElement>;
      expect(
        staticSvg(
          (component as FunctionComponent<SVGProps<SVGSVGElement>>)(props)
        )
      ).toBe(renderToStaticMarkup(createElement(component, props)));
    }
  );
  it("escapes attribute values", () => {
    expect(staticSvg(createElement("svg", { "aria-label": '"<&' }))).toContain(
      "&quot;&lt;&amp;"
    );
  });
});
