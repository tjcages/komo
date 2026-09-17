# Render evidence — 2026-09-17

[Review preview](https://08394749.komo-wb5.pages.dev/promo/) · [PR #10](https://github.com/tjcages/komo/pull/10) · [OFF-672](https://linear.app/off-brand-studio/issue/OFF-672)

- MP4: H.264, 1920×1080, 30 fps, 420 frames, exactly 14.000000 seconds, 2,563,181 bytes. Silent.
- SHA-256: `d9acc0d2c35580a7c62137f9028fd516d46e58653603522a5a73a6a84099951d`.
- Seven scene clips rendered independently and concatenated without re-encoding.
- Edit validation, feature coverage, opening-title reading hold, and TypeScript checks pass.
- Final QC script checks all 14 cut boundary frames with no warnings. Flat-canvas exemptions match component-vignette staging; macro copy intentionally fills most of the height.
- Inspected at least one still for every scene, including settled logo, native conversation, sidebar, drawer, copy confirmation, and prompt. Read an extracted contact sheet from the final MP4.
- Fixed issues caught in still QC: missing dark review background, clipping sidebar row metadata, and inherited demo toolbar visibility.
- Re-rendered drawer frame 40 independently: PNG bytes match exactly.
- Original UI scan identifies 78 wall-clock dependencies in 11 files. None run in the film. The film scan only flags the explicit `animation:none` override; it has no active CSS animations or timers.
- Hosted preview loads and visibly plays the rendered conversation scene. Media metadata confirmed locally with ffprobe.
- Repository build, typecheck, 18 test files / 111 tests, and size checks pass. Production gzip budgets unchanged: 93,609 bytes initial / 186,726 bytes all features.

The source fixture comes from the real widget, with fixed sample feedback. Motion is an explicit frame-driven port. No customer data, real agent execution, social post, merge, or production deployment occurs.

Local files: `tools/launch-video/output/remotion/komo-promo-14s.mp4`, `thumbnail.png`, and `contact-sheet.png` (ignored). The standalone runtime is `../komo-promo`.
