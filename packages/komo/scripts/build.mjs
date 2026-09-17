import { build, transform } from "esbuild";
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
await rm("dist", { recursive: true, force: true });
execFileSync("tsc", ["-p", "tsconfig.json", "--emitDeclarationOnly"], {
  stdio: "inherit",
});
const result = await build({
  entryPoints: ["src/index.ts", "src/setup.ts", "src/agent-prompt.ts"],
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
const packages = new Set();
const notices = [];
for (const input of Object.keys(result.metafile.inputs)) {
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
        /^licen[cs]e(?:\.|$)/i.test(file)
      );
      if (!licenses.length)
        throw new Error(`Missing license for bundled dependency ${pkg.name}`);
      notices.push(
        `${pkg.name}@${pkg.version}\n\n${(await Promise.all(licenses.map((file) => readFile(join(dir, file), "utf8")))).join("\n")}`
      );
      break;
    }
    dir = dirname(dir);
  }
}
await writeFile("dist/THIRD_PARTY_NOTICES.txt", notices.join("\n\n---\n\n"));
