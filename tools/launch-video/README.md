# komo launch film

A deterministic 42-second fixture demonstration, plus a separately composed portrait version and a 12-second teaser. Silent-first; no licensed audio or customer data.

## Render

From the repository root, using Node 22.12+ and ffmpeg with libx264:

```sh
pnpm install --frozen-lockfile
npm ci --prefix tools/launch-video
cd tools/launch-video
npx playwright install chromium
node build.mjs
node render.mjs landscape --inspect
node render.mjs vertical --inspect
node render.mjs landscape
node render.mjs vertical
node render.mjs teaser
node captions.mjs
node copy.mjs
```

Outputs live in the ignored `tools/launch-video/output/` directory. Each full film contains 1,260 frames at 30fps. The teaser contains 360. H.264, CRF 18, yuv420p, faststart, no audio track. Thumbnails and render metadata sit beside the MP4s. Helvetica uses the existing site's system-font stack; identical pixels require the same OS/font environment and pinned Chromium.

`timeline.js` exposes `window.seek(seconds)` and disables autonomous playback when `?capture=1` is present. Frames have no network dependencies beyond the local render server, no live customer data, no random paths, and no wall-clock state. `?format=vertical` selects the portrait composition. The website's logo CSS keyframes are paused and sought explicitly.

## Reuse

- Hero markup and website surface: `packages/komo-site/src/scene.mjs`.
- Copy-to-agent windows: `packages/komo-site/src/feature-scenes.mjs`.
- Comment cards, cursors, windows, typography and lavender: `site.css`, with recording-specific sizing and readable fixture copy.
- Actual product drawer: server-rendered `MorphingMenu.tsx` and its own stylesheet.
- Existing animated symbol and wordmark: `logo.svg`, `logo.css`, `favicon.svg`.

The fixture sidebar arranges the site's comment cards; it does not contact the product API. This is a choreographed workflow illustration, not an end-to-end recording or a claim that komo edits code. The film explicitly shows the coding agent making changes, followed by verification and resolution.

Recording dependencies are a separate private npm project outside the pnpm workspace. No recording code enters the npm tarball or production browser bundle.

## Review preview

```sh
pnpm build
node tools/launch-video/build.mjs
node tools/launch-video/preview.mjs
pnpm exec wrangler pages deploy packages/komo-site/dist --project-name komo --branch preview
```

Open the returned deployment URL at `/launch-demo/`. Append `?format=vertical` for portrait playback. The preview route is assembled only by the explicit command above. A normal website build removes it. Build production docs afresh before deploying the website Worker.

## Timeline

| Seconds | Beat |
| --- | --- |
| 0–3 | Existing animated logo and the “which button?” hook |
| 3–10 | Headline comment, then primary-button comment |
| 10–15 | Reaction and engineer reply |
| 15–20 | Drawer movement, all-comments panel, copied state |
| 20–26 | Context pasted into the agent; explicit code-edit response |
| 26–30 | Matching spacing and button improvements |
| 30–35 | Engineer verification reply, then resolution |
| 35–42 | Install, React entry point, setup key, and held URL |

The portrait version stacks the website and agent windows and moves comments below the website. It is not a center crop. The teaser follows the same causal order with selected readable holds.

After rendering, run `node tools/launch-video/assets.mjs` from the repository root before preview deployment to add `/launch-assets/`. This gallery includes playable MP4s, posters, captions, transcript, and launch copy. It is preview-only and is removed by a normal site build.
