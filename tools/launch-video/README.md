# komo beat studio

The current deliverable is an animated webpage. No new video export. A 72-beat clock schedules cuts, scrolling, typing and camera movement. Default: 144 BPM (30 seconds). Controls include 60–240 BPM, a 1.5× acceleration ramp, optional metronome, loop, replay, pause, scrub and fullscreen. Reduced-motion users start paused.

```sh
pnpm install --frozen-lockfile
node tools/launch-video/build.mjs
python3 -m http.server 4392 --directory tools/launch-video/dist
```

Open `http://localhost:4392/`. Query options: `?bpm=180`, `?bpm=144&ramp=1`, `?capture=1` (paused).

## Actual tool, fixture website

`widget-runtime.ts` imports the full production `initComments` widget from `packages/komo/src/index.ts`. Pins, comment threads, composer, drawer and sidebar use the product's own DOM, shadow styles and motion. No recreated comment cards or sidebar are rendered. The iframe is a 1280×720 desktop; the outer camera crops and enlarges it into a 1920×1080 stage. `widget-frame.css` styles only the fixture website.

The isolated iframe fetch adapter serves in-memory fixture threads and handles the actual composer submission. Other fetch destinations are rejected. A dedicated fixture session contains no credential. No customer data or live service is used. Recording dependencies remain outside the npm package and production website runtime.

## Sequence

1. Animated komo logo. The website headline then rises/fades in before its nearby thread opens.
2. Real comment indicators appear on the website.
3. “Chat on any website.”
4. Scroll through sections as more indicators appear.
5. Open an actual comment thread from its pin.
6. Type and post through the real composer.
7. Expand the production drawer.
8. Open the actual sidebar, including its website-framing transition.
9. Two incoming fixture comments use the production list insertion/displacement animation; then select a sidebar comment and show its thread on the page.
10. “Every comment. One place.”
11. Scroll to another comment, then finish with the logo and a five-second URL hold at 144 BPM. Loop is off by default; playback rests on the ending.

The focus is commenting on a website; no code execution or website-editing outcome is shown. Product springs retain their native timing. The preview adds entrance-only WAAPI motion to newly created actual pin elements; it does not replace their markup. Scrubbing selects a state and lets its transition settle; it is not frame-exact seeking inside product animations. The optional transport metronome is the only audio.

## Deploy a review preview

```sh
pnpm build
node tools/launch-video/build.mjs
node tools/launch-video/preview.mjs
pnpm exec wrangler pages deploy packages/komo-site/dist --project-name komo --branch preview
```

Open the returned URL at `/launch-demo/?bpm=144`. A normal site build removes this preview-only route. Historical films and their source remain available through `docs/launch/README.md`; they do not represent the current sequence.
