# komo

- Product and brand name: **komo**, always lowercase. Preserve public API names such as `initKomo`.
- Package, CLI, API and tests: `packages/komo/`. Marketing website: `packages/komo-site/`.
- Use pnpm with Node 22.12 or later. Run `pnpm build`, `pnpm typecheck`, `pnpm test`, and `pnpm size` before delivery.
- Keep browser bundle costs within the existing measured budgets. CLI-only code must not enter browser bundles.
- Never commit credentials, local databases, generated bundles, or npm tarballs.
- Preserve API authentication, project boundaries, quotas, and data compatibility.
- Deliver changes on a feature branch with a pull request and a verified deployed preview. Never merge without approval. Validate locally; hosted CI is not a delivery gate.
- Keep user-facing copy concise and use the existing components and motion conventions.

## Linear tracking

- Linear is the source of truth for project work. Follow `linear-discipline` and `linear-setup`; authenticate with official Linear MCP before reads or writes.
- Search for `komo`, `Komo`, and `https://github.com/tjcages/komo` before creating a project or issue. Preserve existing work and obtain the skill's required approvals before extending an existing project.
- Setup is pending: the official connector returned `UNAUTHORIZED` on 2026-09-17, including after reconnection. Team and project IDs are not yet known; do not invent them or treat this protocol as completed setup.
- Resume from `docs/launch/readiness.md`. Install the verified team/project IDs, milestone names, and issue links here after authenticated discovery.
- Track release readiness, launch assets, and beta rollout separately. Use real dependencies and evidence-backed Done states. Merged code, published packages, deployed docs, and approved announcements are distinct milestones.
- Move active issues to In Progress; close the loop with evidence or an explicit blocker before ending work. Never post social content or merge a pull request without the owner's approval.

## Launch film

- Render source lives in `tools/launch-video`, a private project outside the package workspace. Keep recording dependencies out of the npm package and production browser runtime.
- Use fixture feedback and the existing site/product components. The agent edits code; komo carries feedback. Keep that distinction visible.
- Rendered media stays in ignored `tools/launch-video/output/`. Follow its README for exact rendering and preview commands.
