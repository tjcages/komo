# komo

[![npm version](https://img.shields.io/npm/v/@tjcages/komo)](https://www.npmjs.com/package/@tjcages/komo)
[![downloads](https://img.shields.io/npm/dm/@tjcages/komo)](https://www.npmjs.com/package/@tjcages/komo)

Comments for your website. Point at an element, mark an area, and leave feedback your team can reply to, resolve, or copy into a coding agent.

Framework independent. Shared persistence. Google identities and guest reviewers.

[Website](https://komo.offbr.co) · [Documentation](https://komo.offbr.co/install/) · [Playground](https://komo.offbr.co/playground/)

Review actions update immediately while saving in the background. Failed writes roll back with a notice; unsaved comment text is retained.

## Install

```sh
npm install @tjcages/komo
npx @tjcages/komo init
```

Requires Node.js 22.13 or newer. The unscoped `komo` package on npm is unrelated; use `@tjcages/komo`.

The setup command detects your Git repository and generates `komo.config.js` before sign-in. Mount that helper in your app:

```js
import { initKomo } from './komo.config.js';
initKomo();
```

Keep the setup terminal open and start your app in another terminal. Choose **Connect komo** in your app’s sidebar. Google sign-in opens in a separate window; komo creates the project and returns you to feedback on your site. The CLI saves the final public settings to `.komo/project.json`, updates the helper, and prints an inline configuration. Use `--origin` for a different dev port or deployed site. If interrupted or expired, run `komo init` again to resume; completed projects are never overwritten.

Hosted onboarding is available through the dedicated komo service. Self-hosting is available through the same CLI.

## Usage

Mount after the page has loaded:

```js
import { initKomo } from '@tjcages/komo';
initKomo({ project: 'YOUR_PROJECT_KEY' });
```

Optional configuration stays at the call site:

```js
initKomo({
  project: 'YOUR_PROJECT_KEY',
  enabled: import.meta.env.DEV || import.meta.env.PUBLIC_PREVIEW === 'true',
  pageRoot: document.querySelector('#app'),
});
```

### React

With React 18.2 or 19, call the hook once near your app root:

```tsx
'use client'; // Required for Next.js App Router client components.
import { useKomo } from '@tjcages/komo/react';

export function Komo() {
  useKomo({ project: 'YOUR_PROJECT_KEY' });
  return null;
}
```

Render `<Komo />` in your app or layout. The hook handles mounting, cleanup, and React Strict Mode. Inline configuration objects are supported; unchanged values do not restart komo. Changing configuration remounts it, and `enabled: false` removes it. Memoize callback options with `useCallback` and pass stable DOM elements for `pageRoot` or `drawerContainer`. Mount only one hook per page; do not combine it with a separate `initKomo()` call. Server rendering does not mount the tool.

The **endpoint is the comments API**, not your website or preview URL. Hosted komo defaults to `https://komo.offbr.co`. Google sign-in returns to `https://komo.offbr.co/auth/google/callback`, regardless of the website embedding komo. For self-hosting, pass your Worker or Node API URL as `endpoint`. Your current page comes from the browser. Setup detects repository metadata from Git; include its printed `repo` value to enrich agent prompts.

Comments are shared across deployments by default. Use `pnpm exec komo init --branch-scope` to separate them by branch. For automatic branch detection, import from the optional generated `komo.config.js` helper and run `komo sync` before builds. It detects the current branch from deployment environment variables or Git; set `KOMO_BRANCH` if neither is available. It fails rather than silently grouping unknown branches.

## Features

- Point and area comments anchored to page elements.
- Replies, reactions, author-only editing, resolution, and undo.
- Searchable sidebar, draggable dock, and Google or guest profiles.
- Copy open feedback with selectors, source paths, page URLs, replies, and geometry into an agent.
- Hosted Cloudflare storage, or your own Worker/D1 or Node/PostgreSQL service.

## Agent CLI

`komo init` adds the default comment workflow to `AGENTS.md`, preserving existing instructions. For an existing project, run `komo agents setup` from its root. Commit the instructions so every agent uses them.

Before editing, agents read open comments, export the relevant prompt, and read replies. After verifying a simple fix, an agent can reply with evidence and resolve it at **90%+ confidence**. Complex or uncertain work stays open with a question or progress reply. This is guidance for your coding agent; the CLI does not run an agent or measure its confidence.

Requires komo 0.2.0 or later. Connect your coding agent to the same comments your team sees in the browser:

```sh
npm install @tjcages/komo@latest
npx @tjcages/komo login
npx @tjcages/komo comments list
npx @tjcages/komo comments get THREAD_ID
npx @tjcages/komo comments reply THREAD_ID --body "Fixed and verified on mobile."
npx @tjcages/komo comments resolve THREAD_ID
```

Run these from a project configured with `komo init`. The CLI searches parent directories for `.komo/project.json`. Google sign-in opens a local browser handoff; `--no-open` prints the local sign-in link instead. Credentials are stored outside your repository in `~/.config/komo`, with a private file per API/project. Sessions stay valid until you sign out. `komo logout` revokes the session and removes its file.

For an existing inline installation, pass `--project YOUR_PROJECT_KEY --origin https://your-site.example`. `--origin` is an approved website address; `--endpoint` is the comments API. New setups remember the website address. Older setups default to `http://localhost:3000`; override it if that site is not approved. `--repo` and `--branch` override detected scope; project scope defaults to `shared`.

### Commands

| Command | Purpose |
| --- | --- |
| `komo schema` | JSON command reference for agents; no sign-in needed. |
| `komo whoami` | Show the current reviewer and project scope. |
| `komo comments list` | Open threads as JSON; `--status open\|resolved\|all`, `--page`, `--limit 1–250`, `--offset`. Default page size: 50. |
| `komo comments get THREAD_ID` | Full thread, replies, selector, source reference, and anchor. |
| `komo comments prompt` | The UI’s open-feedback prompt as Markdown; optional `--page` and `--json`. |
| `komo comments reply THREAD_ID --body TEXT` | Add a reply as the signed-in reviewer. |
| `komo comments resolve THREAD_ID` | Mark verified work resolved. |
| `komo comments reopen THREAD_ID` | Reopen a thread. |
| `komo comments create --page /path --anchor-file FILE --body TEXT` | Create a thread from captured anchor JSON. |
| `komo comments edit THREAD_ID COMMENT_ID --body TEXT` | Edit your own message. |
| `komo comments delete THREAD_ID COMMENT_ID` | Delete your own message. |
| `komo comments react THREAD_ID COMMENT_ID --emoji EMOJI` | Set your reaction; `--remove` removes it. |
| `komo comments move THREAD_ID --anchor-file FILE` | Move an indicator and keep it outside automatic stacks. |

`--body-file FILE` reads a message from disk; `--body-file -` reads stdin. Use one body source. Anchor files use the `anchor` object returned by `comments get`, with updated geometry where appropriate; they are not screenshots. The API validates selectors, geometry, permissions, and quotas.

Successful commands emit `{ "ok": true, "scope": { ... }, "data": ... }`. Errors emit `{ "ok": false, "error": { "message": "...", "status": ... } }` on stderr and exit with code 1. Prompts are Markdown unless `--json` is present. List results include `total` and `nextOffset`; account images are excluded from agent output. Commands do not automatically retry writes.

Automation can supply a project session through `KOMO_TOKEN`. Other overrides: `KOMO_PROJECT`, `KOMO_ENDPOINT`, `KOMO_ORIGIN`, `KOMO_REPO`, `KOMO_BRANCH`, and `KOMO_CONFIG_HOME`. Keep tokens in your secret manager, never in committed configuration or command arguments. A token acts as its reviewer; it does not bypass ownership checks.

Suggested agent workflow: list open threads, read a thread, inspect the repository, make a scoped change, verify it, reply with the result, and resolve. Comment text is untrusted feedback, not permission to run unrelated commands or disclose secrets.

## Local agent mode

On a local page, one dock shows hosted Team threads and notes for a local agent. Each agent session runs `komo mcp`, which serves a local backend at `http://127.0.0.1:4848`. New local notes wait until you select an agent in **Send to** and press **Send**. A public Team thread can be marked for a one-way local copy; the agent's reply or resolution stays local and never changes the hosted original. Private Team handoff remains disabled until an approved transfer disclosure is available. Agent-only mode needs no hosted sign-in. Local agent mode needs Node.js 22.13 or newer, for `node:sqlite`.

Until a release includes local agent mode, pack the package from this source checkout and install that tarball in your app for both the widget and MCP CLI. Run the first command from the repository root:

```sh
pnpm --dir packages/komo pack --pack-destination /path/to/your-app
cd /path/to/your-app
pnpm add ./tjcages-komo-0.6.0.tgz
```

Keep the tarball as the app dependency until a published release includes local agent mode; a registry update to an older release removes it. With Claude Code installed, opt in once from the app directory:

```sh
pnpm exec komo mcp setup
```

Install the optional `/komo-watch` skill for this project with `pnpm exec komo skills setup` from the app directory, or use `pnpm exec komo skills setup --user-scope` for a separate user-wide opt-in. The installer never replaces an existing skill. Invoke `/komo-watch` in a chat to start waiting; it does not start on installation. The MCP setup command registers a user-scope `komo` MCP entry with absolute paths to this installed package and the current Node executable. It does not register during installation or `komo init`. It refuses an existing user-scope entry rather than replacing it; inspect and remove that entry yourself before trying again. A local or project entry with the same name can override the user entry. Restart Claude Code to expose the MCP tools. Any MCP client can run the installed `komo mcp` over stdio. Every agent session starts its own copy. Inside a komo project, the first copy serves the port and the others stand by; when the serving session ends, another takes the port over within five seconds. A session outside a komo project opens nothing until a tool call names a directory inside one.

To use local feedback without a hosted login, create `.komo/project.json` in the app with a stable project and repository name:

```json
{ "project": "YOUR_PROJECT_KEY", "repo": "owner/repo" }
```

Mount the installed package after the page loads:

```js
import { initKomo } from '@tjcages/komo';
initKomo({ project: 'YOUR_PROJECT_KEY', repo: 'owner/repo', local: { agentsOnly: true } });
```

`agentsOnly` skips hosted Team; no hosted account or `komo init` is needed. For an app that also uses hosted feedback, keep its generated helper; the combined dock appears automatically on a loopback page. Local agent mode is enabled by default on `localhost`, `127.0.0.1`, `[::1]`, and `*.localhost` pages. Pass `local: false` to opt out.

Use agent-only mode on `localhost`, `*.localhost`, `127.0.0.1`, or `[::1]` pages; it rejects other pages. The combined dock appears only on those pages; nonlocal pages keep hosted behavior. A new local comment queues without sign-in: komo creates a local guest when the service accepts it. Hosted Team comments stay on Team with their hosted account and access controls. The dock preserves the selected agent per site, project, and local endpoint. If the local service is offline, the browser keeps a note in an outbox for that endpoint and retries it when the service returns. Discard an unsent note from its comment menu before it is staged. If site storage fails, the composer retains your text instead. The browser's storage remains local to that origin and can be lost if the site's data is cleared.

Then ask the agent for watch mode. It calls `komo_status` once, runs the waiter command from its result in the background, and calls `komo_watch` each time the waiter reports notes:

| Tool | Purpose |
| --- | --- |
| `komo_status` | The agent’s scopes, the local endpoint, the allowed page origins, the agents watching now, `send` (whether the local server has Send), and `waiter`: the exact command that waits for notes. Optional `origins` goes into that command. |
| `komo_watch` | Claim the comments that wait and return them at once; with none, wait for new ones. `timeoutSeconds` 1–300 (default 300), `batchWindowSeconds` 0–60 (default 3), optional `origins`. After the waiter reports notes, use `timeoutSeconds` 5 and `batchWindowSeconds` 0. |
| `komo_get` | Read one thread with `threadId`. Comments that wait for Send are left out. |
| `komo_reply` | Reply with `threadId` and `body`; the thread stays open. Fails with a code, and posts nothing, if the thread changed after the agent received it (see below). |
| `komo_resolve` | Resolve `threadId`, then post an optional `summary` as a reply. Fails with a code, and changes nothing, if the thread changed after the agent received it (see below). |
| `komo_reopen` | Reopen a resolved thread. |

Every tool accepts `directory`, the agent’s working directory. Its `.komo/project.json` selects the project, and its Git worktree selects the agent’s entry in **Send to**; pass it after the agent moves to another worktree. A thread is delivered when its last message is from a person and you sent it. One agent claims each delivery for 20 minutes, or until its session ends. After an agent replies, or resolves with a summary, the thread waits for you: your answer or an edit delivers it again after Send, and a reopen alone does not.

### Send

The dock shows **Send** with the number of comments in the project queue. A new local note waits without an agent choice. Select the agent in **Send to**, then press **Send** to move the entire queue to that agent, across pages. Replies and edits on agent threads also wait for **Send**. An offline note persists in the browser until the service accepts it. Notes saved for a different local endpoint stay in the browser and do not appear in this dock. Notes saved by an older komo version have no endpoint; the dock asks before it sends them to the current local server. The Send count stays visible while notes wait.

Comments on an agent’s channel wait for Send. A client configured directly with the local API endpoint has no Send; its comments reach an agent only if its branch matches that agent’s shared or configured branch. The default `local` branch on a localhost page does not match the usual `shared` agent scope. An older process on the local port has no queue or Send routes: this dock cannot stage or send new notes through it. Run an updated `komo mcp` process on the local port before using Send. If an older process holds the port, `komo_status` returns `send: false` with a warning and releases any notes already held on an agent’s channel; it cannot send notes still in the browser outbox.

### Quiet waiting

An agent waits without an open request:

```sh
pnpm exec komo comments wait --local
```

The command prints nothing while it waits. It exits with the single line `notes N` when at least one sent comment waits for this agent and no other agent holds it. It claims nothing, so the agent then calls `komo_watch` with `timeoutSeconds` 5 and `batchWindowSeconds` 0 to claim the comments at once. Meanwhile the dock lists the agent as ready, and it keeps listing it for up to a minute after the command exits, until `komo_watch` starts. On a fatal error it prints one line to stderr and exits 1. `--directory` and `--origins` work as in `komo_status`, which returns the complete command for the agent’s session. That command adds `--holder` with the session’s ID, so it counts only the comments that this session’s `komo_watch` can claim.

### Changes during the work

`komo_resolve` and `komo_reply` check that nobody added or edited a message after the agent received the thread through `komo_watch` or `komo_get`. After a change they post nothing and return an error with a code:

- `changed`: you sent the change. The error holds the current thread, and the thread stays with the same agent. The agent redoes the work and tries again, which then succeeds.
- `held`: the change waits for Send. The error holds no text. The agent stops, and the thread returns to the same agent after Send.
- `taken`: another agent works on the thread.
- `deleted`: you deleted the comment. The agent drops the work.
- `retry`: you wrote a message and removed it while the agent posted. Nothing was posted, and the agent calls again.

An agent never reads a comment before you send it: `komo_watch`, `komo_get` and these errors leave it out. While an agent holds a thread, your follow-ups and edits go to that agent only, until its claim ends.

### Without MCP

Agents without MCP use the CLI from the repository. Each command prints one JSON line, except `wait`:

```sh
pnpm exec komo comments wait --local
pnpm exec komo comments watch --local --timeout 5 --batch 0
pnpm exec komo comments reply THREAD_ID --local --body "Brand blue or link blue?"
pnpm exec komo comments resolve THREAD_ID --local --body "Header uses the brand blue."
```

`get` and `reopen` also accept `--local`. `watch` takes `--timeout`, `--batch`, and `--origins`. Every `--local` command takes `--directory`. `watch` and `get` print each thread's `version`; pass it to `reply` or `resolve` as `--version VERSION`. Without it, they check against the claim that the CLI took in that worktree, and fail when you wrote something the agent has not received. A failed `reply` or `resolve` prints its `code` in the error; after `changed` it also prints the current `thread` and its new `version`. The opt-in `/komo-watch` skill covers watch mode after `komo skills setup`; `komo agents setup` installs the default comment workflow, including local MCP watch instructions and a CLI fallback.

### Scopes and origins

Each agent watches two scopes of its project: its own channel, which **Send to** targets, and its configured scope (`shared`, or the Git branch with branch scope). A client without local agent mode can post directly to `http://127.0.0.1:4848`, but the agent sees those comments only when the client's branch matches its scope. On a localhost page, the older client's default `local` branch does not match `shared`; select Shared in the dock or configure the agent with `KOMO_BRANCH=local`. A direct client asks for a guest name once and has no Send step; the first agent in that scope to claim the comment handles it.

Modern clients keep local and hosted sessions separate by endpoint. Older clients that predate endpoint-scoped sessions can expose a hosted token to a local listener, so use an updated client for local agent mode.

By default the local backend accepts pages on `localhost`, `127.0.0.1`, `[::1]`, `*.localhost`, and `*.*.localhost`, on any port. List your own in `.komo/project.json`; each `*` matches one host label or any port, and every origin must name this machine:

```json
{
  "project": "YOUR_PROJECT_KEY",
  "repo": "owner/repo",
  "local": { "origins": ["http://localhost:4321", "http://app.localhost"] }
}
```

When several checkouts of one project run at once, they must name the same `repo`. A checkout that sets `local.origins` narrows the others: a page must match every list that a running checkout sets, and the defaults apply only when none sets a list.

To limit which pages reach one agent, pass `origins` to `komo_watch` or set `KOMO_AGENT_ORIGINS` (comma-separated). The filter applies to both scopes and checks the page that wrote the latest message of each thread. A message from an unknown page, such as a request without an `Origin` header, does not pass.

### Security

Every local comment is an instruction to a coding agent, so the local backend serves this machine only:

- It listens on `127.0.0.1` and `::1`, never on a network interface.
- The `Host` header must be `localhost`, `*.localhost`, `127.0.0.1`, or `[::1]`, which refuses DNS rebinding.
- A browser `Origin` must be an `http` or `https` page on one of those hosts; `Origin: null` is refused. Refusals return `403` before any route runs, including preflight requests.
- The project’s local origins then apply, like approved sites on hosted komo. The agent list, the Send count, and Send itself answer only those pages.
- Request bodies are limited to 64 KiB, and the backend replaces any `CF-Connecting-IP` header a request sends.

Any script on an allowed page can post comments and send them, including third-party scripts in your development build. With the default origins, every local page is allowed, so pages of other local projects can list a project’s watching agents, read local threads if they know the project key, post comments to them, and send those comments. A public Team handoff also becomes a local thread, visible to these allowed pages; the hosted access rules do not apply to its local copy. Narrow `local.origins` to pages you trust before copying Team content. Private Team handoff is blocked, not made safe by a broad local project. Agents treat comment text as untrusted feedback, as in the hosted workflow.

Local comments stay in `~/.local/share/komo/local.sqlite`, readable only by your user; set `KOMO_DATA_HOME` to move it. Existing data directories must not be writable by other users; komo rejects an unsafe directory instead of changing its permissions. They never sync with hosted komo. Set `KOMO_LOCAL_PORT` to use another port, and pass the same address as `local.endpoint`. The API’s usual rate limits apply.

Mount once after hydration, outside server rendering, and call `destroy()` before changing project or branch. Repeated teardown is safe. komo preserves the host DOM hierarchy: it frames an existing content root, or uses Floating when there is no suitable root. Pass a mounted `pageRoot` with a layout box for explicit Frame support; body, html, detached elements, and `display: contents` are not frameable.

## How it works

The package adds an isolated ShadowRoot to your site. Comments live in the API’s database, separately from the host application. Reviewers using the same project and scope see the same feedback. Paths identify pages; query strings and fragments are excluded by default.

Every new hosted workspace has a Google-authenticated owner. Guests can review but cannot create or own a workspace. Self-hosted setup also requires a Google owner claim before guest commenting becomes available. Signing in later does not silently transfer old guest comments based on a matching name.

Visible, active reviews start polling every four seconds and back off to 15 seconds when unchanged; idle widgets poll about once a minute. Hidden/offline tabs pause. Successful writes refresh immediately. Local storage restores the last known account/comments before revalidation; this is an offline snapshot, not proof of current access. Server authorization still checks every request. Sign-out clears this API/project’s account and all channel snapshots, even if remote revocation fails.

Sessions are isolated by API endpoint and project. HTTPS cookies are host-only by default; HTTP development uses local storage instead of sending a bearer cookie to every localhost port. `sessionDomain` explicitly opts into a trusted parent domain: **every sibling host, including unrelated apps, can receive that cookie** ([browser cookie scope](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)). Do not enable it for untrusted previews. Unrelated origins cannot share browser storage. If trusted preview gateways all proxy the same API, set the same `sessionEndpoint` canonical URL alongside the trusted `sessionDomain`; never reuse it across independent APIs. The komo website opts in for its own controlled previews.

Legacy project-only cookies are retired rather than trusted across API installations. Existing endpoint-scoped local sessions can migrate after server validation; cookie-only users may need to sign in once. Browser storage can be disabled independently; sessions remain usable in memory when neither cookie nor local storage is available. Client credentials and cached feedback are accessible to scripts on the embedding site—install only on sites you trust.

On localhost, new agent notes go to the local SQLite queue, not the hosted API. When Team is enabled, its threads use a separate `local` channel in the **configured API’s database** by default. That Team channel is not a browser-only database or a private workspace per developer. Project permissions still apply; use a separate project/API for isolated Team development data. Switching Team to Shared selects the configured shared branch. `local: false` keeps hosted-only behavior. `pnpm dev:api` starts a separate API with its own local database.

Projects default to link access. Owners can restrict feedback to invited Google accounts in Account → Project settings. The public project key identifies a workspace; it is not a credential. Approved origins control embedding, and private-project membership controls feedback access. Your website and repository permissions remain separate.

## Hosted setup

```sh
pnpm exec komo init
```

Mount the generated `komo.config.js` helper and open your app. Select **Connect komo** in the sidebar and sign in with Google. Review the detected production and preview addresses in the sidebar and add any others, one per line. Connecting approves the current site and those listed addresses, including production sites that have not launched. Remove a suggested address to leave it unapproved. Google credentials and account-wide management stay on the komo service; your site receives a session for its new project.

The CLI waits up to ten minutes and replaces the temporary setup configuration after connection. Keep the terminal open. Run `komo init` again after an interruption or expiry. The temporary polling secret stays in ignored `.komo/setup.json` and is never bundled into your site. A reload can resume commenting while the CLI finishes. Run `komo sync` before builds that use the generated helper.

If the app cannot run, use the hosted recovery link printed in the terminal, sign in, and select **Create project**. The CLI still writes the final configuration.

Approve your deployed website in **Approved sites**. komo detects deployment URLs when available; `--origin` can supply one. You can paste a full preview link—the modal extracts its site address. No DNS changes are required, including for `pages.dev` previews.

The setup page manages your account and approved sites. Leave comments on the website where you installed komo.

Return to `/setup?workspace=<project key>` to approve additional sites (up to ten). Only the Google owner can approve sites. The site address controls where that owner’s project can be embedded; it does not grant ownership of a domain or access to other projects. The API endpoint is the komo service, not your website URL.

Starter limits per owner/workspace:

| Limit | Allowance |
| --- | --- |
| Projects per Google owner | 3 |
| Stored comments, including replies | 250 |
| Logical storage budget | 10 MiB |
| Write requests per project | 500/day |
| Request body | 16 KiB |
| Comment / reviewer name | 4,000 / 60 characters |

The storage budget accounts for text, anchors, reactions, and a fixed profile allowance per member. It is deliberately conservative, not a measurement of D1 disk usage. Soft-deleting or resolving a comment does not reset its quota. Inline file attachments are not supported; avatars have a bounded representation.

The service also applies per-IP and per-user limits, database-enforced quotas, owner-approved site restrictions, payload validation, project suspension, hourly cleanup, and a global daily request ceiling. Edge rate limiting runs before database work. These controls bound ordinary abuse; Google accounts and CORS do not eliminate automated abuse. The service remains a starter offering, not an unlimited storage service. Project exports, imports, and quota recovery are available below. Billing upgrades are not implemented yet.

## Self-host

Install komo in your project, then run:

```sh
pnpm exec komo init --self-host --origin https://preview.example.com
```

The CLI signs into Cloudflare, creates a dedicated D1 database, applies migrations, deploys a Worker, and prompts for the Google client secret through Wrangler. It writes the deployment configuration into `.komo/` so you own and can change it.

Create a Google OAuth **Web application** client with `openid profile email` access. Pass its public client ID with `--google-client-id`, or enter it when prompted. Add the callback printed after deployment:

```text
https://YOUR-WORKER.workers.dev/auth/google/callback
```

Open the owner-claim link printed by setup and sign in with Google. The one-time claim key is saved in `.komo/owner-key`, excluded from Git, and only its hash is deployed. Ownership cannot be claimed again. Keep the Google secret out of browser code and configuration files.

If setup is interrupted, run `pnpm exec komo deploy` to resume the existing deployment. Do not rerun initialization to create another database. The generated `.komo/wrangler.json` supports explicit allowed preview domains and single-label wildcard origins. Only allow domains whose scripts you trust.

Self-hosted storage belongs to your Cloudflare account; its service limits and charges apply. Use `komo deploy` for package migrations and `komo project export` for feedback backups. The hosted service and self-hosted installations use separate databases.

For a Node container with PostgreSQL (including Cloud Run), use the [Node self-hosting guide](./NODE.md). It uses the same `endpoint`, project configuration, and CLI commands without Wrangler. Existing Worker installations do not change.

## Configuration

### Client options

Pass these to `initKomo(config)` from `@tjcages/komo` or `useKomo(config)` from `@tjcages/komo/react`.

`YOUR_PROJECT_KEY` is a placeholder for a string. Hosted komo generates the key during `komo init`; copy that value. For self-hosting, use the project identifier configured on your server. Reuse the same key across sites that should share feedback.

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `endpoint` | `string` | Hosted komo API | Comments API root; HTTPS outside localhost. |
| `project` | `string` | Required | Public project identifier returned by setup. |
| `repo` | `string` | Project key | Repository identifier, usually `owner/repo`. |
| `scope` | `"project" \| "branch"` | `"project"` | `"project"` shares comments; `"branch"` separates branches. |
| `branch` | `string` | Inferred by `komo sync` | Required only for branch scope. |
| `enabled` | `boolean` | `true` | Set from your build environment to restrict review UI. |
| `pageRoot` | `HTMLElement` | Sole existing content root, when present | Mounted element inside body to scale in Frame mode. Body and html are not supported. |
| `source(element)` | `(element: Element) => string \| undefined` | Anchor metadata | Return a repository-relative source path. |
| `sourceUrl(source, branch)` | `(source: string, branch: string) => string` | GitHub viewer | Custom source or editor link. |
| `page()` | `() => string` | `location.pathname` | Canonical page identifier. |
| `drawerContainer` | `HTMLElement` | Viewport | Element used to center the drawer before it is dragged. |
| `autoHideDrawer` | `boolean` | `true` | Set `false` to keep the drawer visible away from the pointer. |
| `sidebar` | `"background" \| "edge"` | `"edge"` | `"edge"` (Floating) is a draggable sidebar that parks off and peeks from the viewport edge while closed. `"background"` (Frame) frames the site and shows the sidebar in the scaled review sheet. Account → Sidebar switches the two; that choice is remembered per project. |
| `emojiDataSource` | `string` | jsDelivr emoji data 1.8.0 | Full emoji JSON URL; fetched only after “Choose another emoji”. |
| `pollInterval` | `number` | `4000` | Refresh interval in milliseconds, minimum 2000. |
| `sessionDomain` | `string` | Host-only | Explicit trusted parent domain; all sibling hosts can receive the session. Empty string disables sharing. |
| `sessionEndpoint` | `string` | `endpoint` | Canonical API identity for trusted gateways to the same service; never share across independent APIs. |
| `local` | `boolean \| { endpoint?: string; agentsOnly?: boolean }` | On for loopback pages | Local agent mode is automatic on loopback pages; `false` disables it. The object accepts a loopback `endpoint` and `agentsOnly` to skip hosted Team. |

For a restricted CSP or offline deployment, host `emoji-picker-element-data@1.8.0/en/emojibase/data.json` on your site and pass `emojiDataSource: "/emoji/data.json"`. Allow that URL in `connect-src`; cache it with your service worker for first-use offline access. Quick reactions need no emoji data download. The full picker caches its data in IndexedDB after the first successful load.

The lower-level `initComments` export remains available. It requires explicit `endpoint`, `project`, `repo`, and `branch`; it does not infer scope. Existing integrations keep their branch grouping.

The returned controller has `open()`, `close()`, `comment(element)`, `refresh()`, and `destroy()`. Repeated initialization returns the current controller; destroy it before switching projects. SSR returns a no-op controller. In React, use the `useKomo` hook. With Astro view transitions, destroy before swapping the document and initialize after navigation.

### CLI

| Command / flag | Purpose |
| --- | --- |
| `komo init` | Create a Google-owned hosted workspace. |
| `komo init --self-host` | Create your Worker and D1 database. |
| `komo sync` | Regenerate the public client helper. Run before dev/build. |
| `komo deploy` | Resume or redeploy generated self-host infrastructure. |
| `--origin URL` | Optional website address. Otherwise detected from Cloudflare Pages, Vercel, or Netlify; defaults to localhost. |
| `--endpoint URL` | Override hosted API or self-host deployment URL. |
| `--repo OWNER/REPO` | Override Git detection. |
| `--branch-scope` | Opt into separate comments per branch. |
| `--google-client-id ID` | Self-hosted Google OAuth client ID. |
| `KOMO_BRANCH` | Explicit build-time branch override. |

Branch detection also supports `CF_PAGES_BRANCH`, `WORKERS_CI_BRANCH`, `VERCEL_GIT_COMMIT_REF`, `GITHUB_HEAD_REF`, `GITHUB_REF_NAME`, and `BRANCH`, followed by the Git checkout.

### Backend

`PROJECTS` is a JSON object keyed by public project ID. Each entry supports:

| Option | Default | Purpose |
| --- | --- | --- |
| `repo` | Required | Repository allowed for the project. |
| `origins` | Required | Exact allowed origins; self-host supports single-label wildcards. |
| `allowGuests` | `true` | Enable named guest sessions. |
| `allowGuestResolve` | `true` | Allow guests to resolve threads. |
| `requireOwner` | `true` in generated setups | Block reviewing until Google ownership is claimed. Legacy static projects remain compatible. |
| `bootstrapHash` | Generated | SHA-256 owner-claim key hash. |
| `suspended` | `false` | Disable a project. |
| `writesPerDay` | `10000` self-hosted | Daily write-request allowance; hosted uses 500. |

Worker bindings: `DB` (D1), optional `EDGE_LIMIT` (rate limiter). Variables: `PROJECTS`, `GOOGLE_CLIENT_ID`, optional `GITHUB_CLIENT_ID`, `KOMO_HOSTED="true"` to enable hosted provisioning, and `KOMO_PAUSED="true"` to pause service requests. Store `GOOGLE_CLIENT_SECRET` and optional `GITHUB_CLIENT_SECRET` as Worker secrets. Hosted configuration uses an hourly cleanup trigger. `/health` remains available while paused.

## Source context

Stable attributes make annotations resilient to layout changes:

```html
<section data-comment-anchor="pricing" data-comment-source="src/components/Pricing.tsx">
  ...
</section>
```

Anchors may include bounded `context` strings for element tag, role, accessible label, nearby and selected text, CSS classes, styles, and DOM scope. Browser and CLI prompts quote these capture-time hints; agents must verify them against the current implementation. Older anchors remain supported.

If an element disappears, the original page position remains available. komo cannot inspect closed shadow roots, canvas internals, or cross-origin iframe content. It does not invent source line numbers.

Choose **Copy all comments for agent** to copy open feedback across the configured scope; the sidebar copy button includes open comments on its current page. Resolved threads and deleted messages are excluded. Copying does not send anything to an agent.

## Development

Requires Node.js 22.13+, a modern browser, and Cloudflare access for deployment.

```sh
pnpm --filter @tjcages/komo typecheck
pnpm --filter @tjcages/komo test
pnpm --filter @tjcages/komo build
```

Tests use real workerd and isolated SQLite databases. From the repository root, `pnpm preview:site` uploads a website review preview from a feature branch; it does not publish the npm package or deploy the API Worker.

## Credits

The dock adapts [Danny Williams’s morphing menu](https://dannyjpwilliams.com/playground/morphing-menu/). Icons come from [Untitled UI](https://github.com/untitleduico/icons). See [NOTICE.md](./NOTICE.md) for attribution.

## License

MIT.

## Development

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm size
pnpm dev
```

The npm package, CLI and API live in `packages/komo`; the website lives in `packages/komo-site`. `pnpm dev:api` starts a local API. Production deployments retain the existing hosted database; local development uses a separate database.

## Source

Extracted from the komo product at source commit `f57f3521` in the Cloudflare marketing workspace. Product development now lives in [tjcages/komo](https://github.com/tjcages/komo). Third-party credits are preserved in each package’s NOTICE.md.


## Project management

Sign in as the Google owner with `npx @tjcages/komo login`. In the widget, open **Account → Project settings** to manage access, download feedback, clear resolved threads, or delete a hosted project.

```sh
npx @tjcages/komo project info
npx @tjcages/komo project access --access private
npx @tjcages/komo project invite --email teammate@example.com
npx @tjcages/komo project export --out comments.json
```

Projects default to link access. Private projects require Google sign-in and owner-approved membership for reads and writes, including the CLI. Invitations match a verified email address, expire after seven days, and are single-use. Members can review; only owners manage access, export, import, or delete. Google accounts used before this release should sign out and back in to verify their email. Repository access is separate.

### Quota recovery and migration

Export first, then permanently clear resolved threads with `npx @tjcages/komo project clear-resolved --confirm PROJECT_KEY`. This reclaims stored-comment quota. In the sidebar’s Resolved view, owners can also use the trash button to permanently delete only the currently filtered threads and their replies after confirmation. `project delete --confirm PROJECT_KEY` permanently deletes a hosted project and frees its project slot. Both are owner-only. The account panel also offers these actions with typed confirmation.

To migrate, export from your source, set up a destination using `npx @tjcages/komo init --self-host` in another directory, then sign in there and run:

```sh
npx @tjcages/komo project import --file /path/to/comments.json
```

Exports include threads, replies, reactions, anchors, and historical profiles across all pages and branches, including resolved feedback. They exclude sessions, credentials, verified emails, and membership. Imports use the destination repository and keep imported authors unverified. Retrying the same export is safe; existing imported records are not overwritten. Destination quotas still apply. Export retries are required if feedback changes while downloading. Keep export files private.

Upgrade self-hosted deployments with `npm install @tjcages/komo@latest` then `npx @tjcages/komo deploy`; the CLI applies bundled database migrations before redeploying. Self-hosted project removal is controlled by your Worker configuration. Account-wide data requests remain available at ty@offbr.co.
