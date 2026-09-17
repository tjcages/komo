# komo beat studio

The current deliverable is an animated webpage. No new video export. A 76-beat clock schedules cuts, scrolling, typing and camera movement. Default: 144 BPM (31.67 seconds). Controls include 60–240 BPM, a 1.5× acceleration ramp, optional metronome, loop, replay, pause, scrub and fullscreen. Reduced-motion users start paused.

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

1. Title alone; real pins pop on the right and left. The site's cursor icon flies in without a name badge and pulses on a pin.
2. The website fades away; the actual comment is centered, then Alex and Jamie reply. A quick scroll reveals more pins and opens two comments in sequence.
3. The native sidebar opens, three new fixture comments push the existing rows down, and a choreographed emoji burst celebrates the activity.
4. “Every comment. One place.” leads into the isolated, centered production drawer. Its actual copy action generates the prompt; a fixture clipboard adapter captures it without changing the user's clipboard.
5. The existing site agent window receives an excerpt of the captured prompt. No agent execution or completed edits are depicted. The logo and URL close the sequence, with a five-second final hold at 144 BPM; looping defaults off.

Actual widget markup, styles, comment transitions and drawer/sidebar springs remain in use. Preview-only effects animate pin entrances, the cursor, camera, isolation fades and emoji particles. The particles are editorial motion, not a claimed production sidebar feature. Native animations settle independently of pause/scrub. This is fixture choreography, not a live customer session.

## Deploy a review preview

```sh
pnpm build
node tools/launch-video/build.mjs
node tools/launch-video/preview.mjs
pnpm exec wrangler pages deploy packages/komo-site/dist --project-name komo --branch preview
```

Open the returned URL at `/launch-demo/?bpm=144`. A normal site build removes this preview-only route. Historical films and their source remain available through `docs/launch/README.md`; they do not represent the current sequence.
