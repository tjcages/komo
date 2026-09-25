# Current render evidence — 2026-09-25

[Worker preview](https://film-sound-komo-site.off-brand.workers.dev/promo/) · [PR #34](https://github.com/tjcages/komo/pull/34) · [OFF-672](https://linear.app/off-brand-studio/issue/OFF-672)

- Revision applies the [video-editor skill](https://github.com/tjcages/skills/tree/main/video-editor): komo.offbr.co call to action, original music bed, 31 interface sound cues, and beat-aligned cuts. Opening wording and scene choreography are unchanged.
- H.264 1920×1080 30fps, 641 frames (21.37s, labelled 21.4s), AAC soundtrack. Mixed movie: 3,538,774 bytes. Local and deployed SHA-256 match: `2b062402574dc1a7b98f9d8fb389635e563e6f3c09af6d6bc7e7e3c63eb27be8`.
- `beats.mjs`: 7/7 cuts on the 112 BPM half-beat grid. `listen.mjs`: audio aligned within a frame, -14.2 LUFS, -1.2 dBTP true peak, no dead air, faded ending, all 31 cues stand out at their frames. Spectrogram inspected; no masked cues.
- The URL passes its reading-hold validation (62 frames against 60 required). CTA frame and the trimmed feed/drawer, drawer/copy, and agent/logo boundaries were inspected as stills.
- `qc.mjs` keeps the three intentional warnings: conversation/sidebar and agent/logo meet on the canvas color; drawer/copy share the settled menu camera.
- Local `pnpm build`, `pnpm typecheck`, 206 tests across 32 files, and size gates pass. Remotion typecheck passes.
- Worker preview version only, alias `film-sound`; no production deployment. A person still needs to listen through the final frame before release.

Source/render commands: [README](./README.md). Previous revision evidence remains in Git history.
