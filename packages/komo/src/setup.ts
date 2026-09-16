import { initComments } from "./index.js";
import { resolveConfig, type KomoConfig } from "./config.js";
export type { KomoConfig } from "./config.js";

/** Bind generated public settings once; mount with optional per-site overrides. */
export function defineKomo(config: KomoConfig) {
  return (overrides: Partial<KomoConfig> = {}) =>
    initComments(resolveConfig({ ...config, ...overrides }));
}
