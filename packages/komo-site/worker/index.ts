const apiRoots = new Set([
  "auth",
  "config",
  "health",
  "setup",
  "setup-client.js",
  "usage",
  "me",
  "threads",
  "project",
  "owner",
  "workspace",
]);

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    const root = url.pathname.split("/")[1];
    if (!apiRoots.has(root)) return env.ASSETS.fetch(request);
    // A preview can exercise its matching API version without moving live traffic.
    const header = "Cloudflare-Workers-Version-Overrides";
    const version = env.KOMO_API_PREVIEW_VERSION;
    if (request.headers.has(header) || version) {
      request = new Request(request);
      request.headers.delete(header);
      if (
        version &&
        /^[a-z0-9-]+-komo-site\.off-brand\.workers\.dev$/.test(url.hostname)
      )
        request.headers.set(header, `komo-api="${version}"`);
    }
    // Preserve the public origin for OAuth callbacks and setup links.
    return env.KOMO_API.fetch(request);
  },
} satisfies ExportedHandler<Env & { KOMO_API_PREVIEW_VERSION?: string }>;
