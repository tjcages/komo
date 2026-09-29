import worker from "./index";
import type { KomoServerConfig } from "../src/server-config.js";
import { komoConfigEnvironment } from "./komo-config";

export { default } from "./index";

/** Bind backend settings at build time; database and credential bindings stay on the Worker. */
export function createKomoServer(config: KomoServerConfig) {
  const settings = komoConfigEnvironment(config);
  const environment = (env: Env): Env => ({
    ...env,
    PROJECTS: settings.PROJECTS,
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID ?? settings.GOOGLE_CLIENT_ID,
    GITHUB_CLIENT_ID: env.GITHUB_CLIENT_ID ?? settings.GITHUB_CLIENT_ID,
  });
  return {
    fetch(...[request, env, ctx]: Parameters<typeof worker.fetch>) {
      return worker.fetch(request, environment(env), ctx);
    },
    scheduled(...[event, env, ctx]: Parameters<typeof worker.scheduled>) {
      return worker.scheduled(event, environment(env), ctx);
    },
  };
}
