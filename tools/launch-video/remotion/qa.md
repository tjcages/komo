# Opening copy and Worker preview — 2026-09-22

[Current Worker preview](https://80047cc4-komo-site.off-brand.workers.dev/promo/) · [PR #28](https://github.com/tjcages/komo/pull/28)

- Opening: “Anyone can comment. Anywhere.” One line at 96px, with clear side margins through the final zoom. Same stagger and shared pin/cursor camera.
- Reading-time validator passes at 69 title frames. Copy contributes three frames while retaining its half-second confirmation. Logo motion and full settled hold are unchanged. Total is still 618 frames / 20.6 seconds.
- Render source `2cae5e1`; H.264 1920×1080 at 30fps, silent, 2,975,955 bytes. SHA-256 `3d1f3802be828b78d886b99eccff371142e179a7d0d2389dc483a0d1f52cb863`.
- Re-rendered affected context and copy clips, assembled all eight, checked opening middle/final stills and extracted final MP4 opening. Full boundary QC reports the same three deliberate fade/match warnings described below. Remotion typecheck and reading-time gate pass.
- Repeated local build, typecheck, 146 tests in 24 files, and size gates: all pass.
- Uploaded preview version `80047cc4-408d-44df-8959-534109e747c0` of the existing `komo-site` Worker. It replaces the earlier Pages review link; no production deployment.
- `preview:deploy` now delegates to the existing Worker preview command. The explicit film upload command still runs after inserting `/promo/`, so no second build erases the movie.

## Earlier polish evidence (superseded preview)

# Render evidence — 2026-09-22 polish

[Preview](https://ecb27a70.komo-wb5.pages.dev/promo/) · [PR #28](https://github.com/tjcages/komo/pull/28) · [OFF-680](https://linear.app/off-brand-studio/issue/OFF-680)

- Render source: `616c551`. H.264, 1920×1080, 30 fps, 618 frames, exactly 20.6 seconds, silent. 2,952,408 bytes; SHA-256 `0b999abccb7666b0fd2222de184f6a6fdaea42bea2236be38b29a5bbbf7d5e78`.
- Conversation has fixed message slots, so the card no longer changes its bounds as replies type. Resolve clicks at frame 78, rebounds, holds accent feedback, and exits at frame 84. The final-video frame at 4.9 seconds shows the pointer on the resolved control with unclipped copy.
- Paste and Send now use frame-driven press/release curves instead of one-frame flashes. The eight-scene story, existing drawer and logo choreography, search, and eleven-open-thread continuity remain unchanged.
- Viewed one middle still for all eight scenes, boundary QC stills, and the extracted final-video resolve still. The three QC warnings are intentional same-picture boundaries: conversation/sidebar and agent/logo meet on the background color; drawer/copy shares the settled menu camera. No other automated frame warnings.
- Wall-clock scan has one inert finding: `animation:none!important` in the native reset stylesheet. Remotion TypeScript passes.
- Local `pnpm build`, `pnpm typecheck`, `pnpm test` (146 tests / 24 files), and `pnpm size` pass. The all-feature gzip bundle is 194,779 bytes. No recording dependencies enter the package workspace.
- Preview returns HTTP 200. Chrome playback verified the deployed movie advancing from conversation to incoming sidebar feedback, with the source link pointing to PR #28. Preview is on the `film-polish` branch; production was not deployed.
- The retired webpage film was removed. Licensed helpers and generated video remain outside Git. Prior rendered assets were preserved.

## Previous render evidence (historical)

# Render evidence — 2026-09-17, camera and resolution pass

[Review preview](https://efa70964.komo-wb5.pages.dev/promo/) · [PR #10](https://github.com/tjcages/komo/pull/10) · [OFF-672](https://linear.app/off-brand-studio/issue/OFF-672)

- H.264 MP4: 1920×1080, 30 fps, 618 frames, exactly 20.6 seconds. Silent. Eight deterministic scene clips concatenated without re-encoding.
- Menu hold frames 28 and 38 are byte-identical: SHA-256 `ba7e22405ff07d433ae2b1594931cd456c0349ec2c88c82d405c4ee45a18704c`. No text movement during the hold. Panel center stays fixed during shell expansion; zoom starts after the spring settles.
- First and last source PNGs are byte-identical: SHA-256 `4db304ac8a74dc130af5979239d93168fc4aa2163449573452443e4ca05d703c`.
- Native drawer row selection background, inset outline, ink and first-row corners restored. Cursor traverses actual row hover states before Copy. Label and icon confirmation use the product’s 200ms blur/translation/scale swap, including the check icon and actual “Copied prompt” label.
- Last streamed row settles 17.5 frames before Search clicks. Completed “lavender” query holds 15 frames. Copy holds 18 frames before click and 18 afterward. Settled logo holds approximately 31 frames before fading.
- Pin click compresses then rebounds. Last conversation reaction is 🎉. Drawer scales in, pauses 15 frames, collapses internally to one pointer and opens horizontally before menu expansion.
- Prompt excerpt uses the exact title and first paragraph from the real formatter, enlarged with an ellipsis for additional content. Send uses the native arrow. Sent bubble rises while composer fades downward; lower bubble edge fades before its corners.
- Inspected native menu hover, confirmation mid-swap, prompt and sent-message stills, plus extracted final-video contact sheet. QC boundary warnings are intentional continuous camera/state matches (sidebar/feed, drawer/copy) and blank fade bridges (conversation/sidebar, agent/logo).
- Local build, typecheck, 111 tests in 18 files and size gates pass. Recording dependencies remain outside the package workspace.

Source and render commands: README.md. Ignored output: `tools/launch-video/output/remotion/komo-promo-20.6s.mp4`. Creative acceptance remains In Review; no merge or social publication.

- Opening pins share the title’s exact slow scale curve. All three reactions have settled by conversation frame 69; the card holds until its exit starts at frame 84.
- Search result verified visually: “Can we try lavender here?” by Alex.
- Cursor moves upward into the first menu row before traversing the remaining rows. Composer and bubble use identical width, padding, border allocation, font sizes and explicit heading line-height; text never resizes or reflows on send.

- Final MP4: 2,992,245 bytes; SHA-256 `516e38a107468c1348e3df2a419102c1010fe694edfb2eb769a5d4419387a27e`.

- Opening uses one shared parent transform: title, pin positions/sizes and cursor all zoom together.
- Inspected frame 84: cursor tip aligns with the native Resolve check mark; the card exits immediately afterward.
- Page pins enter left-to-right at frames 3/6/9 before sidebar motion begins at frame 15.
- Resolved fixture is absent from the subsequent open list and actual generated prompt; verified prompt reports 11 open threads, matching drawer count.
