import { build, transform } from "esbuild";
import { minify } from "terser";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));
const styleModule = await build({
  entryPoints: ["src/styles.ts"],
  bundle: true,
  format: "esm",
  write: false,
});
const { styles } = await import(
  `data:text/javascript;base64,${Buffer.from(styleModule.outputFiles[0].text).toString("base64")}`
);
const css = (
  await transform(styles, { loader: "css", minify: true, target: "es2022" })
).code;
const iconModule = await build({
  entryPoints: ["src/icon-markup.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  metafile: true,
});
const { iconMarkup } = await import(
  `data:text/javascript;base64,${Buffer.from(iconModule.outputFiles[0].text).toString("base64")}`
);
await rm("dist", { recursive: true, force: true });
execFileSync("tsc", ["-p", "tsconfig.json", "--emitDeclarationOnly"], {
  stdio: "inherit",
});
const result = await build({
  entryPoints: [
    "src/index.ts",
    "src/setup.ts",
    "src/agent-prompt.ts",
    "src/react.ts",
  ],
  outdir: "dist",
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  metafile: true,
  legalComments: "linked",
  plugins: [
    {
      name: "static-icon-markup",
      setup(build) {
        build.onLoad({ filter: /[\\/]src[\\/]icon-markup\.ts$/ }, () => ({
          contents: `export const iconMarkup = ${JSON.stringify(iconMarkup)}`,
          loader: "js",
        }));
      },
    },
    {
      name: "compact-shadow-styles",
      setup(build) {
        build.onLoad({ filter: /[\\/]src[\\/]styles\.ts$/ }, () => ({
          contents: `export const styles = ${JSON.stringify(css)}`,
          loader: "js",
        }));
      },
    },
  ],
  external: ["react", "react-dom", "emoji-regex"],
});
// Compress the emitted modules without changing their split boundaries or exports.
// Preserve framework directives ("use client") and linked license notices.
await Promise.all(
  Object.keys(result.metafile.outputs)
    .filter((path) => path.endsWith(".js"))
    .map(async (path) => {
      const { code } = await minify(await readFile(path, "utf8"), {
        module: true,
        compress: { passes: 1, directives: false },
        mangle: true,
        format: { comments: "some" },
      });
      await writeFile(path, code);
    }),
);
const packages = new Set();
const notices = [];
for (const input of Object.keys({
  ...iconModule.metafile.inputs,
  ...result.metafile.inputs,
})) {
  if (!input.includes("node_modules")) continue;
  let dir = dirname(resolve(input));
  while (dir !== dirname(dir)) {
    let files;
    try {
      files = await readdir(dir);
    } catch {
      break;
    }
    if (files.includes("package.json")) {
      if (packages.has(dir)) break;
      packages.add(dir);
      const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
      const licenses = files.filter((file) =>
        /^licen[cs]e(?:\.|$)/i.test(file),
      );
      if (!licenses.length)
        throw new Error(`Missing license for bundled dependency ${pkg.name}`);
      notices.push(
        `${pkg.name}@${pkg.version}\n\n${(await Promise.all(licenses.map((file) => readFile(join(dir, file), "utf8")))).join("\n")}`,
      );
      break;
    }
    dir = dirname(dir);
  }
}
await writeFile("dist/THIRD_PARTY_NOTICES.txt", notices.join("\n\n---\n\n"));

// The local agent mode runner: the Worker, run in Node over SQLite. It is a
// separate Node bundle, so none of it reaches the browser bundles above.
const migrations = (await readdir("server/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const inlineMigrations = `export function workerMigrations() { return ${JSON.stringify(
  await Promise.all(
    migrations.map(async (name) => ({
      name,
      sql: await readFile(join("server/migrations", name), "utf8"),
    })),
  ),
)}; }`;
await build({
  entryPoints: ["server/local/index.ts"],
  outfile: "dist/local.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  loader: { ".txt": "text" },
  external: ["emoji-regex"],
  logLevel: "warning",
  plugins: [
    {
      name: "inline-migrations",
      setup(build) {
        build.onLoad(
          { filter: /[\\/]server[\\/]local[\\/]migrations\.ts$/ },
          () => ({
            contents: inlineMigrations,
            loader: "js",
          }),
        );
        // The hosted setup page needs Google sign-in, which local mode does
        // not have, so its 600 KB client stays out of the local bundle.
        build.onLoad({ filter: /[\\/]server[\\/]setup-client\.txt$/ }, () => ({
          contents: "",
          loader: "text",
        }));
      },
    },
  ],
});
