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

1. The title uses quick, staggered word fades with no slide. Actual pins appear at 2× size, then the unnamed cursor clicks. The fullscreen conversation uses stable layout bounds so camera motion does not fight the native card entrance.
2. A large centered native drawer opens. The page scrolls behind it while the drawer moves down and collapses into its bottom position. A comment close-up leads to a wider desktop framing.
3. The actual sidebar opens before a quick camera zoom. Eight fixture comments arrive every half beat; six editorial emoji pops appear on the right of the text.
4. The centered drawer returns. A cursor hovers from the top row down to the bottom, then returns to the real copy action. There is no extra copy headline. The fixture clipboard captures the real generated prompt without changing the user's clipboard.
5. A centered abstract prompt bar fades in. A cursor clicks it and the full captured comments prompt is pasted, then scrolls through the feedback. It fades to the animated komo logo and loops. No completed edits are claimed.

76 beats (31.67 seconds at 144 BPM). Loop is on by default. The user's latest direction replaces the previous held URL ending.

Actual widget markup and drawer/sidebar springs remain in use. Preview-only effects handle doubled pin size/entrances, cursor, hover highlighting using the product hover token, camera, fades and six emoji pops. Emoji particles are editorial demonstration, not live activity. Scene changes use a short background-colored matte to cover camera and component resets. The drawer camera uses stable panel layout bounds, never its animated shell height. Views remain hidden until their native UI is ready. Native animations settle independently of pause/scrub. This is fixture choreography, not a customer session. No real agent is invoked.

## Deploy a review preview

```sh
pnpm build
node tools/launch-video/build.mjs
node tools/launch-video/preview.mjs
pnpm exec wrangler pages deploy packages/komo-site/dist --project-name komo --branch preview
```

Open the returned URL at `/launch-demo/?bpm=144`. A normal site build removes this preview-only route. Historical films and their source remain available through `docs/launch/README.md`; they do not represent the current sequence.

Drawer visibility is gated on the fixture shadow host before lazy toolbar mount. It appears only at beats 16–24 (centered native reveal, then docking) and 52–60 (centered copy action); it is absent from the opening, comment, sidebar and agent scenes.
