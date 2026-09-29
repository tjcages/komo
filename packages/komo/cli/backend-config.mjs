import { writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Create editable backend settings once; deployment never overwrites this file. */
export async function writeKomoBackendConfig(cwd, config) {
  await writeFile(
    join(cwd, "komo.config.ts"),
    `import { defineKomoConfig } from '@tjcages/komo/config';\n\nexport default defineKomoConfig(${JSON.stringify(config, null, 2)});\n`,
    { flag: "wx" },
  );
}
