# Package optimization — September 22, 2026

Follow-up to OFF-713, implemented under OFF-715 in PR #29. The changes extend the existing cached-review/context work instead of creating competing review branches. npm publication and production API rollout remain separate steps.

## Implemented

- [x] Fix self-host CLI package-root scope and include every current server import in the npm file list.
- [x] Add `pnpm --filter @tjcages/komo test:package`: install an actual tarball in a fresh consumer; check imports, SSR, types, stubbed init/resume, migration copying and server bundling.
- [x] Reject invalid benchmark workloads before timing, count selector-all calls, and support both sidebar layouts.
- [x] Poll closed/idle widgets at approximately 60 seconds with jitter; active unchanged reads back off to 15 seconds. Pause hidden/offline polling and refresh on reopening/focus/reconnect. Preserve configured slower intervals.
- [x] Resolve targets and measure geometry once per render pass; share semantic candidate indexes within that pass. Invalidate by discarding the pass before later DOM changes.
- [x] Skip hidden Floating list reconstruction and reuse unchanged comment rows while updating selection, permissions and ages.
- [x] Cancel obsolete GET requests on teardown, account changes and channel replacement; keep intentional writes independent.
- [x] Coalesce cache writes, compact repeated identities and bound thread snapshots to approximately 250,000 characters. Prioritize the current page; partial snapshots carry no revision, and wholly omitted oversized threads do not appear as an empty project. Stop repeated writes after quota failures.
- [x] Add opt-in `authors=1` responses while retaining legacy inline identities. New clients hydrate either representation.
- [x] Group response rows once, add matching thread-order/expiry indexes, throttle self-host cleanup and retain hosted scheduled cleanup. Retention considers only the reviewer's candidate threads while preserving other authors and retained comments.
- [x] Pre-render DOM icon markup at package build time and create React toolbar nodes only inside the lazy runtime. Preserve the existing SVG geometry and animations.
- [x] Remove 24 superseded style declarations. Pin emoji data to 1.8.0, allow `emojiDataSource` for self-hosting/CSP, and show a recoverable data-load failure.
- [x] Route the website preview through its matching API; keep OAuth on the registered canonical callback and validate popup messages against the API-returned authorization origin and popup window.

## Measurements and checks

| Measurement | Reviewed baseline | Current |
| --- | ---: | ---: |
| Initial browser gzip | 99,894 bytes | 96,520 bytes |
| All features gzip | 195,983 bytes | 195,599 bytes |
| Budget headroom (initial / all) | 106 / 17 bytes | 3,480 / 401 bytes |
| Idle polls per visible tab/hour | 900 | about 60 |
| Scoped anchor text walks, 40-card synthetic pass | 10,080 | 240 |
| Same jsdom diagnostic time | 160 ms | 13 ms |

Poll savings are calculated cadence reductions (~93% while idle), not production billing. Anchor timings are synthetic diagnostics, not real-user latency. React remains required by the full lazy menu/color-picker runtime; its peers were not falsely marked optional. No budget was raised.

Local build, typecheck, full suite (179 tests before the additional preview-routing case), subsequent focused routing/cache tests, size gate, and packed-consumer gate passed. Browser checks cover valid 0/40-comment benchmark loads and cleanup, cached account/comments/open-sidebar reload, repeated Floating/Frame switching, lazy toolbar/color controls, and the configurable emoji data failure UI. No public feedback was posted or modified.

## Release steps and remaining architecture

- Migration `0015_query_efficiency.sql` is additive and verified locally. Apply it during the separately approved production rollout; this preview does not change production database schema. The preview API also works without the new indexes.
- Production receives 100% of its previous API version. The review API receives 0% of ordinary traffic and is selected explicitly by the website preview.
- Exact SQL rate-limit counters remain: an edge limiter is not an equivalent replacement for global/day and project/day guarantees. Adaptive polling reduces their use without weakening enforcement. Redesigning these counters needs a separate shared-quota architecture.
- 15–20% bundle headroom is still a target, not achieved. Both tested Motion import substitutions increased total size or lost required layout behavior. Larger savings require restructuring the React UI islands and interleaved account/management code/styles with interaction parity checks.
- Cross-tab polling leadership, cursor pagination and viewport-rendered long lists remain follow-ups after measuring this pass. They are not represented as completed work.
