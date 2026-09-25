# Current render evidence — 2026-09-25

[Worker preview](https://film-sound-komo-site.off-brand.workers.dev/promo/) · [PR #34](https://github.com/tjcages/komo/pull/34) · [OFF-736](https://linear.app/off-brand-studio/issue/OFF-736)

- Re-edit per the [video-editor skill](https://github.com/tjcages/skills/tree/main/video-editor): pin push-through into the thread, resolved thread collapse into a pull-back onto the page, faster feed, closer drawer, menu lift into a rising agent composer, 12-frame pointer approaches, original music bed, and 32 sound cues. The end CTA was removed at the owner's request; the logo ending is the approved one.
- H.264 1920×1080 30fps, 613 frames (20.43s, labelled 20.4s), AAC soundtrack. Mixed movie: 3815547 bytes. Local and deployed SHA-256 match: `452c0e5430e7d0b5ea45b165bfe20299bae1c0ff116fb6696c4bdfef55bb2916`.
- `beats.mjs`: 7/7 cuts on the 112 BPM half-beat grid. `listen.mjs`: aligned within a frame, -14.2 LUFS, -1.3 dBTP, no dead air, faded ending, all 32 cues stand out at their frames. No sound-grammar warnings.
- Transition frames inspected as stills: pin centred before the cut, thread opening at matching size, no blank frame before the page pull-back, drawer and menu fully in frame, menu/composer handoff.
- `qc.mjs` warnings: conversation/sidebar, drawer/copy, and agent/logo boundary similarity (intentional handoffs), and the empty band on the final copy frame between the lifting menu and rising composer.
- Local `pnpm build`, `pnpm typecheck`, 206 tests, and size gates pass. Remotion typecheck passes.
- Worker preview version only, alias `film-sound`; no production deployment. A person still needs to watch and listen through the final frame.

Source/render commands: [README](./README.md). Previous revision evidence remains in Git history.
