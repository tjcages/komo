import { readdirSync, readFileSync } from "node:fs";

// The Worker's D1 migrations, in order. Read from server/migrations when this
// runs from source; scripts/build.mjs replaces this module with the same list
// inlined, so dist/local.mjs needs no files beside it.
export function workerMigrations(): { name: string; sql: string }[] {
  const directory = new URL("../migrations/", import.meta.url);
  return readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({
      name,
      sql: readFileSync(new URL(name, directory), "utf8"),
    }));
}
