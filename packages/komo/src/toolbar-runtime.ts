import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { createElement } from "react";
import { MorphingMenu, type MorphingMenuProps } from "./MorphingMenu.js";
export function mountToolbar(element: HTMLElement, props: MorphingMenuProps) {
  element.replaceChildren();
  const root = createRoot(element);
  flushSync(() => root.render(createElement(MorphingMenu, props)));
  return {
    render: (next: MorphingMenuProps) =>
      root.render(createElement(MorphingMenu, next)),
    unmount: () => root.unmount(),
  };
}
