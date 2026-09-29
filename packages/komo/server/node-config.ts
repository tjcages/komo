import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { createJiti } from "jiti";
import type { KomoServerConfig } from "../src/server-config.js";
import { validateKomoServerConfig } from "./komo-config";

/** Load a trusted server config from the working directory, or an explicit KOMO_CONFIG path. */
export async function loadKomoServerConfig(
  cwd = process.cwd(),
  configPath = process.env.KOMO_CONFIG,
): Promise<KomoServerConfig | undefined> {
  const path = resolve(cwd, configPath ?? "komo.config.ts");
  try {
    await access(path);
  } catch (error) {
    if (!configPath && (error as NodeJS.ErrnoException).code === "ENOENT")
      return undefined;
    throw new Error(
      "Cannot read komo backend config. Check KOMO_CONFIG and file permissions.",
    );
  }
  const jiti = createJiti(import.meta.url, {
    fsCache: false,
    moduleCache: false,
  });
  const config = await jiti.import<unknown>(path, { default: true });
  validateKomoServerConfig(config);
  return config;
}
