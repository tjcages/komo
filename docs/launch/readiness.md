# Public beta readiness

Verification date: 2026-09-17. This is evidence, not a launch approval.

## Product

komo keeps website feedback attached to elements or areas, with discussions and an explicit handoff to a coding agent. The README is the product overview and source for setup guidance. Product name stays lowercase. Preserve the existing visual system, customer data, project boundaries, and authentication behavior.

- [Website](https://komo.offbr.co/)
- [Repository](https://github.com/tjcages/komo)
- [npm](https://www.npmjs.com/package/@tjcages/komo)
- [Install](https://komo.offbr.co/install/), [configuration](https://komo.offbr.co/configuration/), [hosting](https://komo.offbr.co/hosting/), [agent workflow](https://komo.offbr.co/agent-prompts/)

## Verified implementation milestones

- [PR #9](https://github.com/tjcages/komo/pull/9) merged as `0758e6a`: React hook, peer declarations, option types, and public project-key guidance. Publication is a separate milestone.
- [PR #6](https://github.com/tjcages/komo/pull/6): same-domain hosted API and OAuth routing. Website Worker retains the `KOMO_API` service binding.
- [PR #8](https://github.com/tjcages/komo/pull/8): final navigation logo sizing. This launch work leaves that production geometry unchanged.
- Private projects, invitations, export/import, cleanup, optimistic writes, and CLI have implementation and test evidence in `docs/release-0.3.md`. Do not confuse that historical evidence with new device testing.

## Release verification

Initial registry version was 0.3.2. The selected release is 0.4.0 because the React entry point and peer requirements expand the package surface during the pre-1.0 beta.

- Build and typecheck pass; 111 tests across 18 files pass.
- Initial browser JavaScript: 93,609 bytes gzip; all features: 186,726 bytes gzip. These pass the repository budgets.
- Packed artifact installs in an empty directory. Main and React exports load; server rendering returns `<p>SSR works</p>` without mounting the widget. CLI help and schema execute.
- Publication and production documentation status must be read from the release evidence below, not inferred from the version field.

## External review

Google Verification Center was refreshed on 2026-09-17 and still says “Your branding is currently under review.” No branding edits or resubmission occurred. Data access says verification is not required because no sensitive or restricted scopes are requested. Check the existing appeal for a decision; do not submit a duplicate.

## Linear setup pending authentication

Official Linear MCP `list_teams` returned `UNAUTHORIZED` (`oauth_token_invalid_grant`) before and after the user reconnected. No project inventory or writes succeeded. Do not invent a project, team, issue URL, or completed setup. Resume through official MCP after the connection refreshes.

Use the README as the overview. Search `komo`, `Komo`, and the repository URL across projects, issues, and documents. Preserve existing work. If a project exists, inventory it and obtain the specific extension approvals required by `linear-setup`. If absent, bootstrap is authorized; ask for a team only if ambiguous.

## Proposed tracked work

| Track             | Issue                            | Acceptance                                                                  | Dependency                   |
| ----------------- | -------------------------------- | --------------------------------------------------------------------------- | ---------------------------- |
| Release readiness | Publish React hook release       | Clean 0.4.0 install from registry; exports and CLI pass                     | npm publication verification |
| Release readiness | Deploy matching documentation    | Production hook/type docs available; API routing healthy                    | Published package            |
| Release readiness | Verify beta setup journeys       | Hosted customer handoff and self-host artifact checks recorded accurately   | Published package            |
| Release readiness | Follow Google branding appeal    | Record actual decision or requested follow-up                               | External review              |
| Launch assets     | Prepare announcement copy        | Three posts, thread, replies, counts, owner review                          | Verified claims              |
| Launch assets     | Render launch demo assets        | Landscape, portrait, teaser, poster, captions, render source; visual review | Timeline implementation      |
| Launch assets     | Review launch assets             | Owner approves copy and video                                               | Rendered assets              |
| Beta rollout      | Approve public beta announcement | Owner go/no-go with remaining QA limits visible                             | Release and asset review     |
| Beta rollout      | Publish launch announcement      | Only after explicit posting approval                                        | Approved announcement        |
| Beta rollout      | Collect first beta feedback      | Triage real feedback and choose next fixes                                  | Public rollout               |

No dates, assignees, or traction claims have been invented. Backfill only useful completed milestones with source links. Add actual Linear IDs and URLs to AGENTS.md and this index only after authenticated discovery and authorized writes.

## QA limits

Physical-phone testing is excluded by user instruction. Prior simulator evidence is documented in `docs/release-0.3.md`; this session does not claim new iOS Google-owner coverage. Android and screen-reader usability remain open. Automated tests and the launch fixture do not establish those results.

## Published release evidence

- npm publication succeeded for `@tjcages/komo@0.4.0`; `latest` resolves to 0.4.0. Registry integrity: `sha512-IE7Ne4Ir+XpXZB8eoespu7XhwaikpH+SRkq/i6Jis08ztOp1Bg1pu7lrgD8UV6ndjWVtWVnTNrHY3nF87fPO6A==`.
- Production website Worker version: `67849e9a-40fc-4819-9597-abf1d6a41979`. Live install HTML includes `useKomo` and `@tjcages/komo/react`; configuration HTML includes the Type column. `/health` returns `{"ok":true}`. The `KOMO_API` service binding remains intact; no API or database deployment was needed.
- A second empty-directory install fetched 0.4.0 from npm, loaded both exports, rendered the hook on the server, and executed CLI schema.
- Browser fixture built from that registry install: React Strict Mode mounts one tool; disabling removes it; re-enabling remounts one tool. The fixture uses isolated data, not public demo comments.
- Real hosted setup: the registry CLI completed `init`, opened the hosted account, created a temporary QA project through the existing Google owner, and wrote the project key/configuration and agent instructions. A separate CLI Google OAuth flow completed through the same-domain callback. `project info` and `comments list` returned successful scoped responses with zero threads.
- Self-hosted server export builds with the normal Wrangler dry run and `nodejs_compat`. This verifies the shipped Worker artifact; a new paid infrastructure deployment was not performed.
- The temporary QA project contained zero threads and was deleted after the read checks. Project deletion revoked its server sessions. The now-invalid local QA credential file was removed without reading its contents. Existing projects and customer comments were preserved.

## Follow-up found during cleanup

`komo logout` returns 404 after its project has already been deleted, leaving the local credential file. Server-side sessions are removed by project deletion, so this is a local cleanup/UX issue. Reproduce with a disposable project; accept 404 during logout and remove its local session file, with a regression test. Queue this in Linear after authentication is restored.
