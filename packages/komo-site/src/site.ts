import "./site.css";
import { createTryCursors } from "./try-cursors";
const check =
  document.querySelector<HTMLTemplateElement>("#check-icon")!.innerHTML;
document
  .querySelectorAll<HTMLButtonElement>("[data-copy]")
  .forEach((button) => {
    const original = button.innerHTML;
    let timer: number;
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy!);
        clearTimeout(timer);
        button.innerHTML = check;
        button.classList.add("copied");
        document.querySelector("#copy-status")!.textContent = "Copied";
        timer = window.setTimeout(() => {
          button.innerHTML = original;
          button.classList.remove("copied");
        }, 1800);
      } catch {
        document.querySelector("#copy-status")!.textContent =
          "Copy unavailable. Select the code to copy it.";
      }
    });
  });
const toggle = document.querySelector<HTMLButtonElement>(".nav-toggle");
const navigation = document.querySelector<HTMLElement>("#navigation");
const compactNav = matchMedia("(max-width: 700px)");
function setNavigation(open: boolean, restoreFocus = false) {
  if (!toggle || !navigation) return;
  if (open) {
    const rect = toggle.getBoundingClientRect();
    navigation.style.setProperty("--nav-top", `${rect.top}px`);
  }
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute(
    "aria-label",
    open ? "Close navigation" : "Open navigation",
  );
  document.body.classList.toggle("nav-open", open);
  navigation.inert = compactNav.matches && !open;
  if (open)
    navigation
      .querySelector<HTMLAnchorElement>("nav a")
      ?.focus({ preventScroll: true });
  else if (restoreFocus) toggle.focus({ preventScroll: true });
}
toggle?.addEventListener("click", () =>
  setNavigation(toggle.getAttribute("aria-expanded") !== "true"),
);
document
  .querySelector("[data-nav-close]")
  ?.addEventListener("click", () => setNavigation(false, true));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("nav-open"))
    setNavigation(false, true);
});
document.addEventListener("pointerdown", (event) => {
  if (!compactNav.matches || !document.body.classList.contains("nav-open"))
    return;
  const target = event.target as Node;
  if (!navigation?.contains(target) && !toggle?.contains(target))
    setNavigation(false);
});
document.addEventListener("focusin", (event) => {
  if (
    compactNav.matches &&
    document.body.classList.contains("nav-open") &&
    !navigation?.contains(event.target as Node) &&
    !toggle?.contains(event.target as Node)
  )
    setNavigation(false);
});
compactNav.addEventListener("change", () => setNavigation(false));
setNavigation(false);

import { initKomo } from "@tjcages/komo";
import { mountScene } from "./scene";
import { mountFeatureScenes } from "./feature-scenes";
import { mountUsageScene } from "./usage-scene";
mountScene();
mountFeatureScenes();
mountUsageScene();
const review = initKomo({
  project: "komo-landing-demo",
  repo: "tjcages/komo",
  autoHideDrawer: false,
  drawerContainer: document.querySelector<HTMLElement>("#main") ?? undefined,
  pageRoot: document.querySelector<HTMLElement>("#site-content") ?? undefined,
});
document.querySelectorAll("[data-try-komo]").forEach((button) => {
  button.addEventListener("click", () => {
    const selector = button.getAttribute("data-try-komo");
    const target = document.querySelector(selector || "#try-komo");
    if (!target) return;
    if (!selector)
      target.scrollIntoView({ block: "center", behavior: "instant" });
    review.comment(target);
  });
});

const tryBlock = document.querySelector<HTMLElement>("#try-komo");
if (tryBlock) {
  const cursors = createTryCursors(tryBlock);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let visible = false;
  const syncMotion = () => {
    cursors.setPlaying(
      visible && !document.hidden && !reduced.matches,
    );
  };
  new IntersectionObserver(([entry]) => {
    visible = !!entry?.isIntersecting;
    syncMotion();
  }).observe(tryBlock);
  document.addEventListener("visibilitychange", syncMotion);
  reduced.addEventListener("change", syncMotion);
  syncMotion();
}
