import { cp, mkdir } from "node:fs/promises";
const out = new URL(
  "../../packages/komo-site/dist/launch-demo/",
  import.meta.url,
);
await mkdir(out, { recursive: true });
for (const f of [
  "index.html",
  "film.css",
  "beat.css",
  "beat.js",
  "widget-runtime.js",
  "widget-frame.html",
  "widget-frame.css",
  "site.css",
  "logo.css",
  "menu.css",
  "timeline.js",
  "favicon.svg",
])
  await cp(new URL("./dist/" + f, import.meta.url), new URL(f, out));
console.log(
  "Preview-only launch-demo route added. Production build does not include this route.",
);
