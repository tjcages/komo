import { build } from "esbuild";
import { mkdir, writeFile, readFile, rm, cp } from "node:fs/promises";
import { createRequire } from "node:module";
import { pages, escape } from "../src/content.mjs";
const require = createRequire(
  new URL("../../komo/package.json", import.meta.url)
);
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const names = {
  copy: "Copy01",
  check: "Check",
  pointer: "Cursor01",
  multiplayer: "Cursor02",
  comment: "MessageChatCircle",
  code: "Code02",
  plus: "Plus",
  menu: "Menu01",
  close: "XClose",
  arrow: "ArrowUpRight",
  pause: "PauseCircle",
  play: "PlayCircle",
  replay: "RefreshCcw01",
  dots: "DotsHorizontal",
  smile: "FaceSmile",
  terminal: "Terminal",
  cloud: "Cloud01",
  overview: "LayoutAlt01",
  install: "Download01",
  settings: "Sliders04",
  help: "HelpCircle",
};
const icons = Object.fromEntries(
  Object.entries(names).map(([key, name]) => [
    key,
    renderToStaticMarkup(
      createElement(require(`@untitledui/icons/${name}`)[name], {
        width: 18,
        height: 18,
        "aria-hidden": true,
      })
    ),
  ])
);
const decorate = (html) =>
  html.replace(
    /<span data-icon="(\w+)"><\/span>/g,
    (_, name) =>
      `<span class="glyph" data-icon="${name}">${icons[name] ?? ""}</span>`
  );
const out = new URL("../dist/", import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const nav = pages.filter((p) => !["/privacy/", "/terms/"].includes(p.path));
const navIcons = {
  "/": "overview",
  "/install/": "install",
  "/configuration/": "settings",
  "/hosting/": "cloud",
  "/agent-prompts/": "code",
  "/faq/": "help",
};
const logoSvg = await readFile(new URL("../src/logo.svg", import.meta.url), "utf8");
const logo = (id) => `<span class="komo-logo" data-motion="soft" aria-hidden="true"><img class="komo-symbol" src="/favicon.svg" width="24" height="24" alt="">${logoSvg.replaceAll("komo-mask", `komo-mask-${id}`).replace('class="wordmark"', 'class="komo-wordmark"').replace('role="img" aria-label="komo"', 'aria-hidden="true"')}</span>`;
const head = (title, description, path) =>
  `<meta charset="utf-8"><meta name="color-scheme" content="light dark"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${escape(title)} — komo</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="https://komo.offbr.co${path}"><meta property="og:title" content="${escape(title)} — komo"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="website"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/app-icon.png"><link rel="stylesheet" href="/assets/site.css"><script type="module" src="/assets/site.js"></script>`;
for (const page of pages) {
  const html = `<!doctype html><html lang="en"><head>${head(page.title, page.description, page.path)}</head><body class="${page.path === "/" ? "home" : "docs"}"><a class="skip" href="#main">Skip to content</a><div id="site-content"><header class="mobile-header"><a class="brand" href="/" aria-label="komo home">${logo("mobile")}</a><button class="nav-toggle" aria-label="Open navigation" aria-expanded="false" aria-controls="navigation"><span class="nav-menu-icon">${icons.menu}</span></button></header><header class="home-header"><a class="home-brand" href="/" aria-label="komo home">${logo("header")} <span>by Off brand</span></a><nav aria-label="Resources"><a href="/install/">Docs</a><a href="https://www.npmjs.com/package/@tjcages/komo">npm ${icons.arrow}</a></nav></header><div class="layout"><aside id="navigation" class="navigation"><a class="brand" href="/" aria-label="komo home">${logo("navigation")}</a><nav aria-label="Main navigation">${nav.map((p) => `<a href="${p.path}" ${p.path === page.path ? 'aria-current="page"' : ""}>${icons[navIcons[p.path]]}<span>${p.label}</span></a>`).join("")}</nav><a class="offbrand-link" href="https://offbr.co"><strong>Off brand</strong></a><a class="version" href="https://www.npmjs.com/package/@tjcages/komo">npm · @tjcages/komo</a><button class="mobile-nav-close" data-nav-close>${icons.close}<span>Close menu</span></button></aside><main id="main" class="document ${page.path === "/" ? "overview" : ""}">${decorate(page.body)}<footer><span>© ${new Date().getFullYear()} Off brand</span><div><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="mailto:ty@offbr.co">Contact</a></div></footer></main></div></div><template id="play-icon">${icons.play}</template><template id="check-icon">${icons.check}</template><div id="copy-status" class="sr-only" role="status"></div></body></html>`;
  const dir = new URL(`.${page.path}`, out);
  await mkdir(dir, { recursive: true });
  await writeFile(new URL("index.html", dir), html);
}
await cp(new URL("../public/", import.meta.url), out, { recursive: true });
await mkdir(new URL("playground/", out), { recursive: true });
await writeFile(
  new URL("playground/index.html", out),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/"><title>komo live demo</title></head><body><a href="/">Try komo</a></body></html>`
);
await writeFile(
  new URL("404.html", out),
  `<!doctype html><html lang="en"><head>${head("Page not found", "Return to komo.", "/")}</head><body><main class="not-found"><a class="brand" href="/" aria-label="komo home">${logo("mobile")}</a><h1>Nothing here yet.</h1><a href="/">Back to komo ${icons.arrow}</a></main></body></html>`
);
await writeFile(
  new URL("_headers", out),
  `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://cdn.jsdelivr.net https://komo.offbr.co; frame-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'\n/assets/*\n  Cache-Control: public, max-age=3600\n`
);
await writeFile(
  new URL("robots.txt", out),
  "User-agent: *\nAllow: /\nSitemap: https://komo.offbr.co/sitemap.xml\n"
);
await writeFile(
  new URL("sitemap.xml", out),
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map((p) => `<url><loc>https://komo.offbr.co${p.path}</loc></url>`).join("")}</urlset>`
);
const bundle = await build({
  metafile: true,
  entryNames: "[name]-[hash]",
  entryPoints: {
    site: new URL("../src/site.ts", import.meta.url).pathname,
  },
  outdir: new URL("assets/", out).pathname,
  bundle: true,
  splitting: true,
  format: "esm",
  minify: true,
  target: "es2022",
  define: { "process.env.NODE_ENV": '"production"' },
});
const [scriptPath, scriptOutput] = Object.entries(bundle.metafile.outputs).find(
  ([path, output]) =>
    path.endsWith(".js") && output.entryPoint?.endsWith("src/site.ts")
);
const assetUrl = (path) => `/assets/${path.split("/").pop()}`;
for (const path of [
  ...pages.map((page) => `.${page.path}index.html`),
  "404.html",
]) {
  const file = new URL(path, out);
  const html = await readFile(file, "utf8");
  await writeFile(
    file,
    html
      .replaceAll("/assets/site.js", assetUrl(scriptPath))
      .replaceAll("/assets/site.css", assetUrl(scriptOutput.cssBundle))
  );
}
await mkdir(new URL("drawer-lab/", out), { recursive: true });
await cp(new URL("../node_modules/vaul/style.css", import.meta.url), new URL("assets/vaul.css", out));
await cp(new URL("../node_modules/vaul/LICENSE.md", import.meta.url), new URL("drawer-lab/LICENSE.txt", out));
await build({
  entryPoints: [new URL("../src/drawer-lab.ts", import.meta.url).pathname],
  outfile: new URL("assets/drawer-lab.js", out).pathname,
  bundle: true,
  format: "esm",
  minify: true,
  target: "es2022",
  define: { "process.env.NODE_ENV": '"production"' },
});
await writeFile(new URL("drawer-lab/index.html", out), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Drawer comparison — komo</title><link rel="stylesheet" href="/assets/vaul.css"><style id="drawer-lab-style">
body { margin:0; background:#f7f7f9; color:#1d1d1f; font:16px/1.5 system-ui,sans-serif; }
main { max-width:560px; margin:auto; padding:48px 24px; }
h1 { font-size:24px; line-height:1.2; }
.lab-trigger { display:block; width:100%; margin:14px 0; padding:16px; border:0; border-radius:12px; background:#27272a; color:#fff; font:inherit; text-align:left; touch-action:manipulation; }
.lab-overlay { position:fixed; inset:0; background:#0005; pointer-events:auto; }
.lab-sheet { position:fixed; inset:auto 0 0; height:min(82vh,820px); padding:12px 16px 0; display:flex; flex-direction:column; background:#0d0d0d; color:#e9e6e1; border-radius:24px 24px 0 0; pointer-events:auto; }
.lab-handle { margin:8px auto 20px; }
.lab-title { font-size:18px; margin:0 0 8px; }
.lab-description { font-size:13px; color:#aaa; margin:0 0 12px; }
.lab-list { min-height:0; flex:1; overflow-y:auto; overscroll-behavior:contain; touch-action:pan-y; }
.lab-list p { padding:14px 0; margin:0; border-bottom:1px solid #ffffff16; }
</style><script type="module" src="/assets/drawer-lab.js"></script></head><body><main><h1>Drawer motion comparison</h1><p>Both buttons use the actual Vaul package and the same 40 comment rows. The second places Vaul inside a fixed Shadow DOM overlay like komo.</p><div id="lab"></div></main></body></html>`);
console.log(`Built ${pages.length} pages with the shared komo demo.`);
