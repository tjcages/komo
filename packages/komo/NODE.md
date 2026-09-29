# Run the komo API in a Node container

The browser widget and CLI use the same API protocol on Cloudflare and Node. This option uses PostgreSQL and does not change an existing Worker/D1 deployment. It starts one API service for your preview sites; each project key maps to one repository and an allowlist of site origins.

## Configure

1. In your website repository, install komo and generate the Node project:

   ```sh
   pnpm add @tjcages/komo
   pnpm exec komo init --node \
     --endpoint https://comments.example.com \
     --origin https://pr-42.preview.example.com \
     --preview-origin 'https://pr-*.preview.example.com' \
     --repo your-org/your-repo \
     --branch-scope \
     --google-client-id YOUR_GOOGLE_CLIENT_ID
   ```

   This writes an editable `komo.config.ts`, a generated `.komo/client.js` browser helper, and private `.komo/node.env` / `.komo/owner-key` files. Commit the backend config; the helper and private files are ignored. The preview wildcard matches one hostname label under a domain you control. The endpoint is the **public API origin**, not a preview URL. For local development it may use HTTP localhost. Keep the generated owner key private.

2. Provide a PostgreSQL database with a dedicated user allowed to create tables and triggers. Replace the `DATABASE_URL` and `GOOGLE_CLIENT_SECRET` placeholders in `.komo/node.env`. Add the printed `https://comments.example.com/auth/google/callback` URL to the Google OAuth client's authorized redirect URIs. In Cloud Run, supply the same variables through service configuration and a secret store. Do not commit the environment file. The Node runtime does not enable hosted provisioning (`KOMO_HOSTED`).

3. Run the installed package with the generated environment file:

   ```sh
   node --env-file=.komo/node.env node_modules/@tjcages/komo/cli/index.mjs serve
   ```

   With variables supplied by your deployment platform, use `pnpm exec komo serve`. Node loads `komo.config.ts` from the working directory; `KOMO_CONFIG=/absolute/path/komo.config.ts` selects an explicit file. TypeScript and relative imports work on Node 22.12 and later. A missing default file keeps the existing environment-only setup; a missing explicit file or invalid config fails startup.

   For a container, install the package in your own deployment directory and copy the backend config into the image. No fork is required:

   ```dockerfile
   FROM node:22-slim
   WORKDIR /app
   RUN corepack enable && corepack prepare pnpm@10.33.3 --activate
   COPY package.json pnpm-lock.yaml ./
   RUN pnpm install --prod --frozen-lockfile
   COPY komo.config.ts ./
   USER node
   EXPOSE 8080
   CMD ["node", "node_modules/@tjcages/komo/cli/index.mjs", "serve"]
   ```

   Include any modules imported by your config. Run with `docker run --env-file .komo/node.env -p 8080:8080 YOUR_IMAGE` and HTTPS in front. For Cloud Run, set the container port to 8080 and supply secrets through service configuration. The repository's existing `Dockerfile.node` also works; mount your config into it and set `KOMO_CONFIG` to the mounted path. Cloud SQL or another reachable PostgreSQL service can be used through `DATABASE_URL`. Startup applies the bundled schema under a database lock. `/health` returns `{"ok":true}` after migrations succeed.

4. Open the owner-claim URL printed by `komo init --node` and sign in with Google. The setup page claims ownership once; the owner can then manage approved sites and private access. The generated widget config contains your project key. Use the same project key and branch in the bot CLI.

For a guest-only project, you can skip the generator and set `DATABASE_URL`, `PUBLIC_URL`, and `PROJECTS` directly. For example, `PROJECTS={"review":{"repo":"your-org/your-repo","origins":["https://pr-*.preview.example.com"],"allowGuests":true}}`. Anyone on an approved site can then comment; do not use guest-only mode for confidential reviews. `PROJECTS` must remain on one line in an env file. Google sign-in requires both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## Connect a preview and bot

Use the existing widget options; only its API endpoint changes:

```js
initKomo({
  endpoint: "https://comments.example.com",
  project: "YOUR_GENERATED_PROJECT_KEY",
  repo: "your-org/your-repo",
  scope: "branch",
  branch: "pr-42",
});
```

Point the existing CLI at the same endpoint, project, repository, and branch. `komo login` uses Google when configured; `KOMO_TOKEN` accepts a previously issued session token for a non-interactive bot. Store that token as a secret. It has the same permissions as its user. For example:

```sh
komo comments list --endpoint https://comments.example.com --project YOUR_GENERATED_PROJECT_KEY --repo your-org/your-repo --branch pr-42 --origin https://pr-42.preview.example.com
komo comments reply THREAD_ID --body "Fixed and verified" --endpoint https://comments.example.com --project YOUR_GENERATED_PROJECT_KEY --repo your-org/your-repo --branch pr-42 --origin https://pr-42.preview.example.com
komo comments resolve THREAD_ID --endpoint https://comments.example.com --project YOUR_GENERATED_PROJECT_KEY --repo your-org/your-repo --branch pr-42 --origin https://pr-42.preview.example.com
```

The `--origin` value must be one approved preview origin. Each PR needs the same branch value in widget and bot to isolate its feedback. On the same project, an owner can edit approved sites after Google sign-in. Wildcard origins match one hostname label only, so `pr-*.preview.example.com` does not allow arbitrary subdomains of `example.com`.

## Database boundary

The API's storage contract is `prepare().bind().first()/all()/run()` plus atomic `batch()`. `server/postgres.ts` implements it with a PostgreSQL pool, parameterized statements, and one transaction per batch. `server/postgres/001_initial.sql` mirrors the current SQLite schema and its quota, revision, retention, and deletion triggers. Add a numbered PostgreSQL migration whenever the D1 schema changes. Existing D1 migrations and the Worker entry point stay separate. The Node server runs the same request handler; transport and storage are the only new adapters.

The Node process runs retention cleanup after requests, as the self-hosted Worker does. It handles `SIGTERM` by closing its HTTP listener and database pool. Database connection failures prevent startup; request errors return the existing API error format. Rate limits use the direct socket IP by default. Behind a trusted reverse proxy, set `KOMO_PROXY_HOPS` to the number of proxy-added `X-Forwarded-For` entries before the app; check your load balancer’s forwarding behavior for the correct value. Only enable this when requests cannot bypass that proxy. Client-supplied `CF-Connecting-IP` is ignored.
