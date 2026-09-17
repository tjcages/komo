# Launch asset QA

Verified 2026-09-17.

- Master: 1920×1080, 42.000 seconds, 1,260 frames, H.264, 30fps.
- Portrait: 1080×1920, 42.000 seconds, 1,260 frames, H.264, 30fps. Website and agent windows stack; comment cards move below the website.
- Teaser: 1920×1080, 12.000 seconds, 360 frames, H.264, 30fps.
- All streams fully decode with ffmpeg without errors. The films are silent, with readable on-screen captions and separate SRT/VTT captions. The ending holds the install and URL without looping.
- Inspection frames cover the intro, first comment, second comment, reaction/reply, sidebar, copied state, pasted prompt, agent response, matching improvement, verification, resolution, and final URL. Final encoded frames were also extracted for review.
- Corrected the landscape target to enclose the headline, switched the second target to the actual button, retained visible reviewer names, and clarified that the hook call belongs inside a React component.
- The text and matching page improvement stay consistent: headline line height increases, and the primary button gains the lavender fill. The agent explicitly says it updates the code. Resolution follows verification.
- No live API calls or customer comments enter the film. The source reuses existing hero/window/card/logo styling and the actual drawer component; the fixture sidebar is arranged for recording.
- Post counts range from 161 to 231 weighted characters, below 280. Three standalone options, four thread posts, and four replies are prepared. Nothing has been posted to a social account.

`render-evidence.json` records exact media properties and SHA-256 hashes. Full media stays in the ignored output directory and the deployed review gallery.

Remaining: owner review of the creative assets and public launch decision. Linear reconciliation remains blocked by the official connector's authorization error. Google branding review is still pending.

Browser playback on the deployed gallery reached the clean ending for all three files: master 42s, portrait 42s, teaser 12s; all reported `ended: true` with no media error. The final immutable review gallery is linked from this folder's README.

## Beat studio revision — 2026-09-17

The current deliverable is the [animated webpage](https://483be0f8.komo-wb5.pages.dev/launch-demo/?bpm=144). No new video render. Previous media checks above apply only to the earlier film.

- Visually inspected logo, comment/reaction/reply, sidebar/copy, jumbo title, agent/website improvement and held ending in Chrome.
- Scrub pauses exactly; changing BPM synchronizes numeric and range controls without resetting the beat; ramp toggles; non-loop playback stops at beat 64 with the URL held.
- Clock inverse checks pass at 60, 144, 180 and 240 BPM with both steady and ramp timing. Loop carries elapsed remainder to avoid cumulative frame drift.
- Browser console showed no errors. Deployed route loaded and autoplayed at 144 BPM.
- Local build, typecheck, 111 tests and bundle budgets pass. Initial/all-feature gzip remains 93,609 / 186,726 bytes.
- Audio click is optional, off by default; music selection/mixing and final video exports are deferred. No new mobile-device or screen-reader coverage claimed.

## Close-up revision — 2026-09-17

[Current preview](https://dfbbdb3b.komo-wb5.pages.dev/launch-demo/?bpm=144). One large primary element per shot replaces the wider compositions. Inspected readable comment/reply, drawer expansion, left-edge snap, sidebar, agent handoff and cropped desktop improvement. The desktop is 1920×1080, viewed at 1.55–1.65×. Fixture request “Make the button lavender” precedes agent action and the matching button change. BPM controls and 64-beat timing remain intact. No new video export.

Local build, typecheck, all 111 tests and size budgets pass again. Production browser/package code is unchanged.

## Production motion revision — 2026-09-17

[Current preview](https://8f2edb35.komo-wb5.pages.dev/launch-demo/?bpm=144). The preview imports and mounts the unmodified production MorphingMenu component, rather than recreating shell/row motion. Production edge CSS is copied at build time. Dock travel uses the product's 680/32/0.55 spring. The global animation seek now targets only the logo, so it cannot pause native drawer springs.

Visually inspected typed partial comment and caret, native drawer expansion/settling, right-edge orientation, and simplified title. The inert fixture preserves transport focus. Deployed route loads and plays with no console errors. Build, typecheck, 111 tests and size budgets pass; browser package gzip remains unchanged. Native drawer transitions settle after narrative pause/scrub: exact intermediate drawer frames are not promised by seekBeat. No new video files.
