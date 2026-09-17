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
    const root = new URL(request.url).pathname.split("/")[1];
    // Preserve the public origin for OAuth callbacks and setup links.
    return apiRoots.has(root)
      ? env.KOMO_API.fetch(request)
      : env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
