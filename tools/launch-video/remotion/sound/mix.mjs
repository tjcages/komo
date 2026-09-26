// Mix the rendered film with the komo sound palette and an original music bed.
// Uses the MIT video-editor sound tools from https://github.com/tjcages/skills
// (video-editor/skills/video-editor/assets/editor), installed with `npm ci`.
//
//   node tools/launch-video/remotion/sound/mix.mjs --editor /path/to/editor
//
// Reads ../komo-promo/out/film.mp4 and writes ../komo-promo/out/film-sound.mp4.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const runtime = resolve(here, "../../../../../komo-promo");
const at = process.argv.indexOf("--editor");
if (at < 0)
  throw Error("Pass --editor with the video-editor sound tools directory.");
const editor = resolve(process.argv[at + 1]);
const work = resolve(runtime, "out/sound");
mkdirSync(work, { recursive: true });
const run = (script, args) =>
  execFileSync("node", [script, ...args], { cwd: editor, stdio: "inherit" });

// 112 BPM bed; its groove enters as the conversation opens (film 2.567 s).
// The excerpt starts 1.719 s into the song, so every cut lands on the half-beat grid.
run("sfx.mjs", [
  resolve(here, "sounds.json"),
  "--out",
  resolve(work, "sounds"),
]);
run("bed.mjs", [
  "--film",
  "23.5",
  "--drop",
  "4.286",
  "--bpm",
  "112",
  "--out",
  resolve(work, "bed.wav"),
]);
const common = [
  "--edit",
  resolve(runtime, "src/edit.json"),
  "--sounds",
  resolve(work, "sounds"),
];
const film = resolve(runtime, "out/film-sound.mp4");
run("render-mix.mjs", [
  "--video",
  resolve(runtime, "out/film.mp4"),
  "--cues",
  resolve(here, "cues.json"),
  "--song",
  resolve(work, "bed.wav"),
  "--start",
  "1.719",
  "--out",
  film,
  ...common,
]);
run("listen.mjs", [
  "--video",
  film,
  "--recipe",
  resolve(runtime, "out/film-sound.mix.json"),
  "--drop",
  "2.567",
  "--out",
  resolve(runtime, "out/listen.png"),
  ...common,
]);
