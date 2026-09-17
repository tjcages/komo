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
