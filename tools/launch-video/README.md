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
2. Point, pin, comment
3. Area selection, second comment
4. “Right. There.”
5. Reaction and reply
6. Resolve and advance
7. “Keep it moving.”
8. Dock movement
9. Sidebar and copy confirmation
10. “Your agent. Your code.”
11. Feedback arrives in agent window
12. Website spacing and button improve
13. “A little better.”
14. Verify and resolve
15. Animated komo logo
16. “komo.offbr.co”

The existing website and product components supply the geometry, icons, windows, cards and logo. Fixture text becomes abstract bars; standalone titles contain at most four words. No customer data or live API calls. The coding agent is responsible for the website change.

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
