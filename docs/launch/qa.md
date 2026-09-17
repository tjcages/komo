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
