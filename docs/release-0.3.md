# komo 0.3 release checks

## Features

- Owner-managed private projects with verified-email Google invitations, expiry, revocation, and member/owner separation.
- Project exports from the account panel or CLI. Exports cover all branches/pages and omit credentials, verified emails, and memberships. Revision checks reject inconsistent downloads.
- Idempotent CLI imports into a hosted or self-hosted destination; imported profiles remain unverified and destination quotas apply.
- Typed-confirmation cleanup of resolved threads and deletion of hosted projects. Usage refreshes after cleanup.
- Updated hosting, migration, privacy, and retention documentation. The public demo still keeps three comments per reviewer.

## Measured performance

Production consumer bundle, minified and gzipped:

| Measurement | Before | After |
| --- | ---: | ---: |
| Initial JavaScript | 161,809 bytes | about 93,000 bytes |
| All optional features | 180,423 bytes | about 186,000 bytes |
| Installed icon dependency | 19 MB | removed |

The compact drawer is immediately functional; its expanded React UI loads on intent. The install bundles only the Untitled icons used by komo, retaining their license. The initial bundle budget is now 100 KB gzip. All-feature size rises slightly for project management.

The local browser stress fixture has 5,000 elements, 250 comments, and changes 100 text nodes per frame for 180 frames. At the same desktop viewport:

| Measurement | Host only | Before mutation batching | After |
| --- | ---: | ---: | ---: |
| Mean frame interval | 8.28 ms | 9.70 ms | 8.80 ms |
| Layout reads | 0 | 22,250 | 4,500 |
| Selector queries | 0 | 0 | 0 |
| Hit tests | 0 | 2,047 | 414 |

These are local synthetic measurements, not guarantees across devices. Background DOM mutations coalesce within 80 ms; active selection, open cards, resize, and scroll keep their existing response. Hidden tabs suspend geometry observation and polling. Destroy removes the widget and cancels its timers.

## Verification

- `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm size`.
- Workerd/D1 integration checks: project authorization, wrong-email and reused invitations, member revocation, credential-free export, import retries, project isolation, export-change detection, quota recovery, and confirmed deletion.
- CLI export/import tests: private file permissions, bounded batches, revision continuity, no partial export on failure, and wrong-project deletion rejection.
- Clean tarball installation, public exports, CLI schema, and self-host Worker bundling.
- Browser checks: first-use lazy drawer, signed-out account, Google-owner account, custom access menu, invitation creation, keyboard disclosure, and mobile account geometry. Mobile editable fields use 16 px to avoid iOS focus zoom.
- Existing failure tests cover optimistic rollback, serialized writes, draft recovery, and API revision caching.

iPhone 17 Pro Simulator, iOS 26.5 Safari: the deployed preview loads; the account opens centered; the new-comment composer sits above the software keyboard without focus zoom. A typed draft remains visible after scrolling, and dismissing it restores the page. No test comment was posted to the public demo.

Remaining simulator issue: Safari’s keyboard accessory/address controls overlap the account Continue row while the name field is focused. Dismissing the keyboard restores access. Owner cleanup and Google sign-in have not been exercised in the simulator.

Physical iPhone Safari, Android Chrome, and assistive-technology testing remain outstanding. Simulator checks validate iOS browser behavior, not physical-device performance.

## Rollout

Apply migration `0011_project_management.sql` before deploying the API. Existing projects retain link access. Existing Google users must sign in again to provide a verified email before accepting an invitation.

Self-hosted customers update the package and run `komo deploy`; it copies and applies new packaged migrations before deployment. Roll back Worker code if necessary; the additive tables can remain. Do not reverse schema or restore a database over new customer writes without a separate recovery plan.
