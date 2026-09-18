import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { animate } from "motion";
import { Cursor01 } from "@untitledui/icons/Cursor01";
import { LayoutAlt01 } from "@untitledui/icons/LayoutAlt01";
import { Copy01 } from "@untitledui/icons/Copy01";
import { MorphingMenu } from "../../packages/komo/src/MorphingMenu";

// Preview-only adapter. The component owns compression, springs, blur, row
// stagger, close easing and orientation changes. No copied shell animation.
const host = document.querySelector<HTMLElement>("#drawer")!;
host.inert = true;
const root = createRoot(host);
const items = [
  { id: "point", label: "Comment", icon: <Cursor01 /> },
  { id: "all", label: "All comments", icon: <LayoutAlt01 /> },
  { id: "copy", label: "Copy for agent", icon: <Copy01 /> },
];
type Edge = "bottom" | "left" | "right";
let edge: Edge = "bottom",
  opened = false,
  key = "";
let travel: ReturnType<typeof animate> | undefined;
function mount() {
  flushSync(() =>
    root.render(<MorphingMenu items={items} edge={edge} label="komo tools" />),
  );
}
mount();
function update(nextEdge: Edge, open: boolean, visible: boolean) {
  const nextKey = `${nextEdge}/${open}/${visible}`;
  opened =
    host.querySelector<HTMLElement>(".morphing-menu")?.dataset.view !==
    "collapsed";
  if (nextKey === key && opened === open) return;
  key = nextKey;
  if (nextEdge !== edge) {
    edge = nextEdge;
    mount();
  }
  if (open !== opened) {
    const button = host.querySelector<HTMLButtonElement>(
      open ? '[data-menu-item="more"]' : '[data-menu-item="close"]',
    );
    if (button)
      flushSync(() =>
        button.dispatchEvent(
          new MouseEvent("click", { bubbles: true, detail: 1 }),
        ),
      );
    opened = open;
  }
  travel?.stop();
  // Same dock travel spring as packages/komo/src/index.ts.
  travel = animate(
    host,
    {
      x: edge === "left" ? -232 : edge === "right" ? 668 : 0,
      y: edge === "bottom" ? 225 : -218,
      scale: 3.3,
    },
    { type: "spring", stiffness: 680, damping: 32, mass: 0.55 },
  );
}
(window as any).launchDrawer = { update };
