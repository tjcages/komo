# Render evidence — 2026-09-17, detail pass

[Review preview](https://5d101c14.komo-wb5.pages.dev/promo/) · [PR #10](https://github.com/tjcages/komo/pull/10) · [OFF-672](https://linear.app/off-brand-studio/issue/OFF-672)

- H.264 MP4: 1920×1080, 30 fps, 600 frames, exactly 20 seconds. Silent. Eight deterministic scene clips concatenated without re-encoding.
- MP4 SHA-256: `792558b8449744d169e9288031a1719319ec6dfd98fae17334a851ebdd9e9fff`; 3,140,445 bytes.
- Menu hold frames 28 and 38 are byte-identical: SHA-256 `f920c2e47aee213efee69603752e86e5a5e47168a58034abd69544243bf6572b`. No text movement during the hold. Panel center stays fixed during shell expansion; zoom starts after the spring settles.
- First and last source PNGs are byte-identical: SHA-256 `4db304ac8a74dc130af5979239d93168fc4aa2163449573452443e4ca05d703c`.
- Native drawer row selection background, inset outline, ink and first-row corners restored. Cursor traverses actual row hover states before Copy. Label and icon confirmation use the product’s 200ms blur/translation/scale swap, including the check icon and actual “Copied prompt” label.
- Last streamed row settles 17.5 frames before Search clicks. Completed “contrast” query holds 15 frames. Copy holds 18 frames before click and 18 afterward. Settled logo holds approximately 31 frames before fading.
- Pin click compresses then rebounds. Last conversation reaction is 🎉. Drawer scales in, pauses 15 frames, contracts to zero and opens horizontally before menu expansion.
- Prompt excerpt uses the exact title and first paragraph from the real formatter, enlarged with an ellipsis for additional content. Send uses the native arrow. Sent bubble rises while composer fades downward; lower bubble edge fades before its corners.
- Inspected native menu hover, confirmation mid-swap, prompt and sent-message stills, plus extracted final-video contact sheet. QC boundary warnings are intentional continuous camera/state matches (sidebar/feed, drawer/copy) and blank fade bridges (conversation/sidebar, agent/logo).
- Local build, typecheck, 111 tests in 18 files and size gates pass. Recording dependencies remain outside the package workspace.

Source and render commands: README.md. Ignored output: `tools/launch-video/output/remotion/komo-promo-20s.mp4`. Creative acceptance remains In Review; no merge or social publication.
