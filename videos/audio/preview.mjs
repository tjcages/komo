// Stage only in an already-built site's output. Never included in normal site builds.
import { copyFileSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { cutTimeline } from "./timing.mjs";
const here = dirname(fileURLToPath(import.meta.url)),
  repo = resolve(here, "../..");
const [video, edit = resolve(repo, "tools/launch-video/remotion/edit.json")] =
  process.argv.slice(2);
if (!video)
  throw Error(
    "Usage: node videos/audio/preview.mjs /path/film.mp4 [/path/edit.json]",
  );
const timeline = cutTimeline(JSON.parse(readFileSync(edit, "utf8")));
const metadata = JSON.parse(
  execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=duration",
      "-of",
      "json",
      resolve(video),
    ],
    { encoding: "utf8" },
  ),
);
const actual = Number(metadata.streams?.[0]?.duration);
if (!Number.isFinite(actual) || Math.abs(actual - timeline.duration) > 0.08)
  throw Error("Preview film and cut map do not match.");
const out = resolve(repo, "packages/komo-site/dist/audio");
mkdirSync(out, { recursive: true });
for (const name of ["index.html", "style.css", "studio.mjs", "timing.mjs"])
  copyFileSync(resolve(here, name), resolve(out, name));
copyFileSync(resolve(video), resolve(out, "film.mp4"));
copyFileSync(resolve(edit), resolve(out, "edit.json"));
const headerPath = resolve(out, "../_headers");
const baseHeaders = readFileSync(headerPath, "utf8").replace(
  /\n\/audio\/\*\n(?:[ \t].*\n)*/g,
  "",
);
writeFileSync(
  headerPath,
  baseHeaders +
    "\n/audio/*\n  ! Content-Security-Policy\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; media-src 'self' blob:; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'\n  X-Robots-Tag: noindex\n",
);
console.log("Preview-only /audio/ staged with a matching film and cut map.");
