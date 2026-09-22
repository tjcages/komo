import { Copy01 } from "@untitledui/icons/Copy01";
import { applyAccent } from "./accent.js";
import { ChevronSelectorVertical } from "@untitledui/icons/ChevronSelectorVertical";
import { ChevronDown } from "@untitledui/icons/ChevronDown";
import { Edit05 } from "@untitledui/icons/Edit05";
import { Trash01 } from "@untitledui/icons/Trash01";
import { type ComponentType, type SVGProps, type ReactNode } from "react";
import { staticSvg } from "./static-svg.js";
import { InfoCircle } from "@untitledui/icons/InfoCircle";
import type { Identity } from "./types.js";
import { DotsHorizontal } from "@untitledui/icons/DotsHorizontal";
import { User01 } from "@untitledui/icons/User01";
import { SearchLg } from "@untitledui/icons/SearchLg";
import { Plus } from "@untitledui/icons/Plus";
import { MessageChatCircle } from "@untitledui/icons/MessageChatCircle";
import { PointerIcon } from "./PointerIcon.js";
import { LayoutRight } from "@untitledui/icons/LayoutRight";
import { XClose } from "@untitledui/icons/XClose";
import { Check } from "@untitledui/icons/Check";
import { ArrowUp } from "@untitledui/icons/ArrowUp";
import { Link01 } from "@untitledui/icons/Link01";
import { Code02 } from "@untitledui/icons/Code02";
import { SmileIcon } from "./SmileIcon.js";
import { GitBranch01 } from "@untitledui/icons/GitBranch01";
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
// Icon components are shared by the DOM and React surfaces.
type IconName =
  | "chevron"
  | "drawer"
  | "edit"
  | "trash"
  | "info"
  | "more"
  | "person"
  | "search"
  | "plus"
  | "comment"
  | "copy"
  | "pointer"
  | "expand"
  | "close"
  | "check"
  | "arrow"
  | "link"
  | "code"
  | "smile"
  | "branch";
export const icons: Record<IconName, ComponentType<SVGProps<SVGSVGElement>>> = {
  chevron: ChevronDown,
  drawer: ChevronSelectorVertical,
  edit: Edit05,
  trash: Trash01,
  info: InfoCircle,
  more: DotsHorizontal,
  person: User01,
  search: SearchLg,
  plus: Plus,
  comment: MessageChatCircle,
  copy: Copy01,
  pointer: PointerIcon,
  expand: LayoutRight,
  close: XClose,
  check: Check,
  arrow: ArrowUp,
  link: Link01,
  code: Code02,
  smile: SmileIcon,
  branch: GitBranch01,
};
const iconTemplates = new Map<keyof typeof icons, SVGSVGElement>();
export function icon(name: keyof typeof icons): SVGSVGElement {
  let template = iconTemplates.get(name);
  if (!template) {
    const container = document.createElement("div");
    const component = icons[name] as (
      props: SVGProps<SVGSVGElement>
    ) => ReactNode;
    container.innerHTML = staticSvg(component({ "aria-hidden": true }));
    template = container.querySelector("svg")!;
    iconTemplates.set(name, template);
  }
  return template.cloneNode(true) as SVGSVGElement;
}
export function button(
  label: string,
  action: () => void,
  className = "icon",
  glyph?: keyof typeof icons
) {
  const node = el("button", className);
  node.type = "button";
  node.title = label;
  node.setAttribute("aria-label", label);
  if (glyph) node.append(icon(glyph));
  else node.textContent = label;
  node.addEventListener("click", action);
  return node;
}
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
export function age(time: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (!minutes) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

export function avatar(user: Identity) {
  const node = el("span", "avatar", initials(user.name));
  applyAccent(node, user.accentColor);
  if (
    user.avatarUrl &&
    /^(https:\/\/|data:image\/jpeg;base64,)/.test(user.avatarUrl)
  ) {
    const image = el("img");
    image.src = user.avatarUrl;
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => image.remove(), { once: true });
    node.append(image);
  }
  return node;
}

// Google Identity branding asset: https://developers.google.com/identity/branding-guidelines
export function googleLogo() {
  const image = el("img", "google-logo");
  image.src =
    "data:image/png;base64,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";
  image.alt = "";
  image.width = image.height = 18;
  return image;
}
