import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { Drawer } from "vaul";

const shadowHost = document.createElement("div");
Object.assign(shadowHost.style, {
  position: "fixed",
  inset: "0",
  zIndex: "2147483647",
  pointerEvents: "none",
  isolation: "isolate",
});
document.body.append(shadowHost);
const shadow = shadowHost.attachShadow({ mode: "open" });
const portal = document.createElement("div");
const vendorStyle = document.createElement("link");
vendorStyle.rel = "stylesheet";
vendorStyle.href = "/assets/vaul.css";
const localStyle = document.querySelector("#drawer-lab-style")!.cloneNode(true);
shadow.append(vendorStyle, localStyle, portal);

function example(label: string, container?: HTMLElement) {
  return h(
    Drawer.Root,
    { key: label },
    h(Drawer.Trigger, { className: "lab-trigger" }, label),
    h(
      Drawer.Portal,
      { container },
      h(Drawer.Overlay, { className: "lab-overlay" }),
      h(
        Drawer.Content,
        { className: "lab-sheet" },
        h(Drawer.Handle, { className: "lab-handle" }),
        h(Drawer.Title, { className: "lab-title" }, label),
        h(Drawer.Description, { className: "lab-description" }, "Pull the handle or the first row slowly."),
        h(
          "div",
          { className: "lab-list" },
          Array.from({ length: 40 }, (_, i) => h("p", { key: i }, `Comment ${i + 1}: Make this section clearer and easy to use on mobile.`)),
        ),
      ),
    ),
  );
}

createRoot(document.querySelector("#lab")!).render([
  example("Vaul on the page"),
  example("Vaul in komo’s overlay", portal),
]);
