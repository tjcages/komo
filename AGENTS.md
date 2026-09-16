# komo

- Product and brand name: **komo**, always lowercase. Preserve public API names such as `initKomo`.
- Package, CLI, API and tests: `packages/komo/`. Marketing website: `packages/komo-site/`.
- Use pnpm with Node 22.12 or later. Run `pnpm build`, `pnpm typecheck`, `pnpm test`, and `pnpm size` before delivery.
- Keep browser bundle costs within the existing measured budgets. CLI-only code must not enter browser bundles.
- Never commit credentials, local databases, generated bundles, or npm tarballs.
- Preserve API authentication, project boundaries, quotas, and data compatibility.
- Deliver changes on a feature branch with a pull request and a verified deployed preview. Never merge without approval. Validate locally; hosted CI is not a delivery gate.
- Keep user-facing copy concise and use the existing components and motion conventions.
