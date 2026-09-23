import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { validateMix } from "./timing.mjs";
const args = process.argv.slice(2),
  options = {};
for (let i = 0; i < args.length; i += 2) {
  if (
    !["--video", "--song", "--mix", "--out"].includes(args[i]) ||
    !args[i + 1] ||
    args[i + 1].startsWith("--")
  )
    throw Error(
      "Usage: node videos/audio/mix.mjs --video film.mp4 --song song.wav --mix komo-mix.json --out film-with-music.mp4",
    );
  options[args[i].slice(2)] = resolve(args[i + 1]);
}
if (!["video", "song", "mix", "out"].every((key) => options[key]))
  throw Error("Provide --video, --song, --mix and --out.");
if (existsSync(options.out))
  throw Error("Output already exists. Choose a new output path.");
function probe(file) {
  return JSON.parse(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-show_format", "-show_streams", "-of", "json", file],
      { encoding: "utf8" },
    ),
  );
}
const video = probe(options.video),
  song = probe(options.song);
const picture = video.streams.find((s) => s.codec_type === "video");
const sound = song.streams.find((s) => s.codec_type === "audio");
if (!picture || !sound)
  throw Error("Expected a video stream and an audio stream.");
const duration = Number(picture.duration || video.format.duration);
const mix = validateMix(
  JSON.parse(readFileSync(options.mix, "utf8")),
  duration,
  Number(sound.duration || song.format.duration),
);
const filters = [
  `atrim=start=${mix.start}:duration=${mix.duration}`,
  "asetpts=PTS-STARTPTS",
  `volume=${mix.volume}`,
];
if (mix.fadeIn) filters.push(`afade=t=in:st=0:d=${mix.fadeIn}`);
if (mix.fadeOut)
  filters.push(`afade=t=out:st=${mix.duration - mix.fadeOut}:d=${mix.fadeOut}`);
// No shell interpolation, no picture re-encode, no overwrite. Original film audio is replaced.
execFileSync(
  "ffmpeg",
  [
    "-hide_banner",
    "-v",
    "warning",
    "-n",
    "-i",
    options.video,
    "-i",
    options.song,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-af",
    filters.join(","),
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-t",
    String(duration),
    "-movflags",
    "+faststart",
    options.out,
  ],
  { stdio: "inherit" },
);
console.log(
  `Exported ${options.out} (${duration.toFixed(3)} seconds). Picture stream copied; selected music replaces original audio.`,
);
