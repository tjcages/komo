import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { createElement } from "react";
import { MorphingMenu } from "./MorphingMenu.js";
import type { ToolbarProps, ToolbarIcon } from "./lazy-toolbar.js";
import { icons, initials } from "./dom.js";

function glyph(value: ToolbarIcon): ReturnType<typeof createElement> {
  if ("glyph" in value)
    return createElement(
      "span",
      {
        className: value.badge ? "send-glyph" : undefined,
        style: value.badge ? undefined : { display: "contents" },
      },
      createElement("span", {
        style: { display: "contents" },
        dangerouslySetInnerHTML: { __html: icons[value.glyph] },
      }),
      value.badge
        ? createElement("span", { className: "send-count" }, value.badge)
        : null,
    );
  return createElement(
    "span",
    { className: "review-avatar" },
    value.user?.avatarUrl
      ? createElement("img", {
          src: value.user.avatarUrl,
          alt: "",
          referrerPolicy: "no-referrer",
        })
      : value.user
        ? initials(value.user.name)
        : glyph({ glyph: "person" }),
  );
}
const view = (props: ToolbarProps) =>
  createElement(MorphingMenu, {
    ...props,
    items: props.items.map((item) => ({
      ...item,
      icon: glyph(item.icon),
      activeIcon: item.activeIcon && glyph(item.activeIcon),
      children: item.children?.map((child) => ({
        ...child,
        icon: glyph(child.icon),
        activeIcon: child.activeIcon && glyph(child.activeIcon),
      })),
    })),
  });
export function mountToolbar(element: HTMLElement, props: ToolbarProps) {
  element.replaceChildren();
  const root = createRoot(element);
  flushSync(() => root.render(view(props)));
  return {
    render: (next: ToolbarProps) => root.render(view(next)),
    unmount: () => root.unmount(),
  };
}
