import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { createRequire } from "node:module";
import { scene } from "../../packages/komo-site/src/scene.mjs";
import { promptExample } from "../../packages/komo-site/src/feature-scenes.mjs";
const require = createRequire(
  new URL("../../packages/komo/package.json", import.meta.url),
);
const { build } = require("esbuild");
const { createElement: h } = require("react");
const { renderToStaticMarkup: html } = require("react-dom/server");
const out = new URL("./dist/", import.meta.url);
await mkdir(out, { recursive: true });
const names = {
  copy: "Copy01",
  check: "Check",
  multiplayer: "Cursor02",
  comment: "MessageChatCircle",
  dots: "DotsHorizontal",
  terminal: "Terminal",
  overview: "LayoutAlt01",
  replay: "RefreshCcw01",
  pause: "PauseCircle",
  pointer: "Cursor01",
  plus: "Plus",
};
const icons = Object.fromEntries(
  Object.entries(names).map(([k, n]) => [
    k,
    html(h(require(`@untitledui/icons/${n}`)[n], { width: 24, height: 24 })),
  ]),
);
const decorate = (s) =>
  s.replace(
    /<span data-icon="(\w+)"><\/span>/g,
    (_, n) => `<span class="glyph">${icons[n] || ""}</span>`,
  );
await build({
  entryPoints: [
    new URL("../../packages/komo/src/MorphingMenu.tsx", import.meta.url)
      .pathname,
  ],
  outfile: new URL("./menu.cjs", out).pathname,
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["react", "react-dom", "motion", "motion/react"],
});
// Resolve React and motion from the product workspace for this recording-only bundle.
const menuCode = await readFile(new URL("./menu.cjs", out), "utf8");
await writeFile(
  new URL("./menu.cjs", out),
  menuCode.replace(
    /require\("(react(?:\/jsx-runtime)?|react-dom|motion|motion\/react)"\)/g,
    (_, name) => `require(${JSON.stringify(require.resolve(name))})`,
  ),
);
const { MorphingMenu } = require(new URL("./menu.cjs", out).pathname);
const menu = html(
  h(MorphingMenu, {
    label: "komo tools",
    items: [
      {
        id: "point",
        label: "Comment",
        icon: h("span", { dangerouslySetInnerHTML: { __html: icons.pointer } }),
      },
      {
        id: "all",
        label: "All comments",
        icon: h("span", {
          dangerouslySetInnerHTML: { __html: icons.overview },
        }),
      },
      {
        id: "copy",
        label: "Copy for agent",
        icon: h("span", { dangerouslySetInnerHTML: { __html: icons.copy } }),
      },
    ],
  }),
);
await build({
  entryPoints: [new URL("./widget-runtime.ts", import.meta.url).pathname],
  outfile: new URL("./widget-runtime.js", out).pathname,
  bundle: true,
  platform: "browser",
  format: "iife",
  minify: true,
  jsx: "automatic",
  nodePaths: [
    new URL("../../packages/komo/node_modules", import.meta.url).pathname,
  ],
  define: { "process.env.NODE_ENV": '"production"' },
});
const menuStyles = await readFile(
  new URL("../../packages/komo/src/morphing-menu-styles.ts", import.meta.url),
  "utf8",
);
const cssLiteral = Function(
  menuStyles.replace(
    "export const morphingMenuStyles =",
    "const morphingMenuStyles =",
  ) + ";return morphingMenuStyles;",
)();
const productStyles = await readFile(
  new URL("../../packages/komo/src/styles.ts", import.meta.url),
  "utf8",
);
const edgeStyles = productStyles.slice(
  productStyles.indexOf('.morphing-menu[data-vertical="true"]'),
  productStyles.indexOf('.emoji-choice[aria-checked="true"]'),
);
await writeFile(new URL("./menu.css", out), cssLiteral + edgeStyles);
await cp(
  new URL("../../packages/komo-site/src/site.css", import.meta.url),
  new URL("./site.css", out),
);
await cp(
  new URL("../../packages/komo-site/src/logo.css", import.meta.url),
  new URL("./logo.css", out),
);
await cp(
  new URL("../../packages/komo-site/public/favicon.svg", import.meta.url),
  new URL("./favicon.svg", out),
);
const svg = (
  await readFile(
    new URL("../../packages/komo-site/src/logo.svg", import.meta.url),
    "utf8",
  )
).replace('class="wordmark"', 'class="komo-wordmark"');
const logo = (id) =>
  `<span class="komo-logo intro" data-motion="soft"><img class="komo-symbol" src="favicon.svg">${svg.replaceAll("komo-mask", `komo-mask-${id}`)}</span>`;
const card = (who, initial, body, extra = "") =>
  `<article class="agent-card fixture-card"><div class="agent-message"><span class="agent-avatar">${initial}</span><div><div class="agent-meta"><strong>${who}</strong><span>now</span></div><p>${body}</p></div></div>${extra}</article>`;
const comments = ["Make the button lavender.", "Loosen the headline spacing."];
const reply = `<div class="fixture-reply"><span class="agent-avatar reply-avatar">E</span><div><strong>Engineer</strong><p>On it. Sending to my agent.</p></div></div>`;
const main = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>komo launch film · fixture demonstration</title><link rel="stylesheet" href="site.css"><link rel="stylesheet" href="logo.css"><link rel="stylesheet" href="menu.css"><link rel="stylesheet" href="film.css"></head><body class="home"><main id="film"><header><a class="brand">${logo("small")}</a><span>Comments, where they belong.</span><span class="beta">public beta</span></header><section id="intro"><div class="intro-logo brand">${logo("intro")}</div><h1>Less “which button?”<br><span>More “that one.”</span></h1><p>Website feedback, right where it belongs.</p></section><section id="story"><div class="chapter"><span id="chapter-number">01 / POINT</span><h1 id="headline">Point. Comment. Keep the context.</h1></div><div id="review">${decorate(scene)}<div id="drawer">${menu}</div><div id="card-one">${card("Designer", "D", comments[0], `<div id="reaction"><span aria-label="thumbs up">👍</span><span>1</span></div>${reply}`)}</div><div id="card-two">${card("Reviewer", "R", comments[1])}</div><aside id="sidebar"><div class="side-top"><strong>All comments</strong><span id="open-count">2 open</span></div><div class="side-page">Studio /</div>${card("Designer", "D", comments[0])}${card("Reviewer", "R", comments[1])}<div class="side-copy">${icons.copy}<span>Copy all comments for agent</span></div></aside><div id="resolved">${icons.check} Both changes verified. Resolved.</div></div><div id="workflow">${decorate(promptExample)}</div><div id="cursor">${icons.multiplayer}<span>Designer</span></div></section><section id="outro"><div class="outro-logo brand">${logo("outro")}</div><h1>A little feedback.<br><span>A better website.</span></h1><div class="install"><code>npm install @tjcages/komo</code>${icons.copy}</div><pre><span>import</span> { useKomo } <span>from</span> '@tjcages/komo/react';\n<span>// Inside your React component</span>\nuseKomo({ project: 'YOUR_PROJECT_KEY' });</pre><p class="key-note">Get your project key with komo init.</p><a class="cta">komo.offbr.co <span>↗</span></a></section><footer><span id="caption"></span><span id="disclosure">Choreographed demo · fixture feedback</span></footer><div id="progress"></div></main><script src="timeline.js"></script></body></html>`;
let beatPage = main
  .replace("<html>", '<html lang="en">')
  .replace("komo launch film · fixture demonstration", "komo · beat studio")
  .replace(
    '<link rel="stylesheet" href="film.css">',
    '<link rel="stylesheet" href="film.css"><link rel="stylesheet" href="beat.css">',
  )
  .replace('<body class="home">', '<body class="home beat-studio">')
  .replace('<main id="film">', '<div id="screen"><main id="film">')
  .replace(
    '<div id="progress"></div></main><script src="timeline.js"></script>',
    `<section id="title-hit" aria-hidden="true"><h1></h1></section><div id="beat-rings" aria-hidden="true"><i></i><i></i><i></i></div><div id="progress"></div></main></div>
  <div class="transport" aria-label="Animation playback controls">
    <button id="play" aria-label="Pause animation">Pause</button><button id="replay" aria-label="Replay animation">↺</button>
    <label class="tempo">BPM <input id="bpm" type="number" min="60" max="240" value="144" inputmode="numeric"></label>
    <input id="tempo-range" type="range" min="60" max="240" value="144" aria-label="Tempo">
    <label><input id="ramp" type="checkbox">Ramp</label><label><input id="click-track" type="checkbox">Click</label><label><input id="loop" type="checkbox">Loop</label>
    <span id="meter" aria-hidden="true"><i></i><i></i><i></i><i></i></span><output id="beat-readout" aria-label="Current beat">01 / 72</output>
    <button id="fullscreen" aria-label="Fullscreen animation">⛶</button>
    <input id="scrub" type="range" min="0" max="72" step="0.01" value="0" aria-label="Scrub beats">
  </div><script src="beat.js"></script>`,
  );
beatPage = beatPage.replace(
  /<section id="story">[\s\S]*?(?=<section id="outro">)/,
  '<section id="story"><iframe id="product-frame" title="Live komo on a fixture website" src="widget-frame.html"></iframe></section>',
);
await writeFile(
  new URL("./widget-frame.html", out),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="widget-frame.css"></head><body><main id="website"><nav class="site-nav"><strong>studio</strong><span>Work &nbsp; About &nbsp; Contact</span></nav><section class="website-hero"><div class="eyebrow">A LITTLE STUDIO</div><h1 id="headline">Good things.<br>Made together.</h1><p>A thoughtful place for your next idea.</p><button id="hero-cta">Let's talk</button><div class="site-art"><img src="favicon.svg" alt=""></div></section><section class="detail"><div class="eyebrow">THE DETAILS</div><h2 id="detail-title">Small things.<br>Big difference.</h2><div class="detail-grid"><div class="detail-card" id="detail-card">Room for a new perspective.</div><div class="detail-card">A little more personality.</div></div></section><section class="detail bottom"><div class="eyebrow">WHAT'S NEXT</div><h2 id="bottom-title">Something worth<br>talking about.</h2><div class="detail-card">It starts with a conversation.</div></section></main><script src="widget-runtime.js"></script></body></html>`,
);
await cp(
  new URL("./widget-frame.css", import.meta.url),
  new URL("./widget-frame.css", out),
);
await writeFile(new URL("./index.html", out), beatPage);
for (const f of ["film.css", "timeline.js", "beat.css", "beat.js"])
  await cp(new URL(f, import.meta.url), new URL(f, out));
console.log(
  "Built beat studio with the full production komo widget and fixture website.",
);
