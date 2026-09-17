# komo beat studio

The current deliverable is an animated webpage, not a video render. One 64-beat clock drives all cuts, gestures, logo keyframes and jumbo titles. Default: 144 BPM (26.67 seconds). Controls: 60–240 BPM, optional 1.5× acceleration ramp, optional metronome click, loop, replay, pause, scrub and fullscreen. Reduced-motion users start paused. Click audio starts only after opt-in.

```sh
pnpm install --frozen-lockfile
node tools/launch-video/build.mjs
python3 -m http.server 4392 --directory tools/launch-video/dist
```

Open `http://localhost:4392/`. Query options: `?bpm=180`, `?bpm=144&ramp=1`, `?capture=1` (paused). The pure beat renderer exposes `window.seekBeat(beat)` for future export tooling. The previous seconds-based renderer deliberately refuses this new page; no new MP4 is produced in this revision.

## Choreography

Each entry occupies four beats. Gestures inside each entry land on individual beats.

1. Animated komo logo
2. Large centered comment: “Make the button lavender.”
3. Reaction and expanding reply
4. “Right. There.”
5. Drawer expands with staggered rows
6. Drawer snaps into a vertical left-edge dock
7. Drawer snaps into a vertical right-edge dock
8. “Make yourself at home.”
9. Large sidebar with readable fixture comments
10. Copy confirmation
11. “Your agent. Your code.”
12. Agent receives feedback and updates styles
13. Cropped desktop: spacing and lavender button improve
14. Comment resolves into a checkmark
15. Animated komo logo
16. “komo.offbr.co”

One primary element occupies each shot. The 1920×1080 desktop surface is camera-cropped at 1.55–1.65×; the entire desktop never appears. Comment, drawer and sidebar shots use large standalone product components. Titles remain at most four words; fixture comments intentionally contain readable text.

The existing website and product components supply geometry, icons, windows, cards and logo. Drawer geometry and row reveals are sought by the beat clock against the server-rendered MorphingMenu markup. This is a choreographed illustration, not a live interactive product session. No customer data or live API calls. The coding agent is responsible for the website change.

## Deploy a review preview

```sh
pnpm build
node tools/launch-video/build.mjs
node tools/launch-video/preview.mjs
pnpm exec wrangler pages deploy packages/komo-site/dist --project-name komo --branch preview
```

Open the returned URL at `/launch-demo/?bpm=144`. A normal site build removes the preview route. Recording dependencies remain isolated from the npm package and production browser runtime.

## Previous film pass

The earlier 42-second landscape/portrait and 12-second teaser are historical review assets, not exports of the current beat sequence. Their immutable gallery is linked in `docs/launch/README.md`. Source remains in `timeline.js`, with previous render evidence in `docs/launch/render-evidence.json`. Revisit video composition only after this webpage is approved.
