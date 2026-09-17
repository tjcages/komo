import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
const out = new URL(
  "../../packages/komo-site/dist/launch-assets/",
  import.meta.url,
);
await mkdir(out, { recursive: true });
await cp(
  new URL("./gallery.html", import.meta.url),
  new URL("index.html", out),
);
for (const kind of ["landscape", "vertical", "teaser"])
  for (const suffix of [".mp4", "-thumbnail.png"])
    await cp(
      new URL(`./output/komo-${kind}${suffix}`, import.meta.url),
      new URL(`komo-${kind}${suffix}`, out),
    );
for (const f of ["copy.md", "transcript.md", "captions.srt"])
  await cp(new URL("../../docs/launch/" + f, import.meta.url), new URL(f, out));
const srt = await readFile(new URL("captions.srt", out), "utf8");
await writeFile(
  new URL("captions.vtt", out),
  "WEBVTT\n\n" + srt.replace(/(\d\d:\d\d:\d\d),(\d{3})/g, "$1.$2"),
);
await writeFile(
  new URL("teaser.vtt", out),
  "WEBVTT\n\n00:00.000 --> 00:02.000\nWebsite feedback, right where it belongs.\n\n00:02.000 --> 00:05.000\nGive the headline more room to breathe.\n\n00:05.000 --> 00:07.000\nYour coding agent edits the code.\n\n00:07.000 --> 00:09.000\nVerify the changes before resolving feedback.\n\n00:09.000 --> 00:12.000\nInstall komo. komo.offbr.co\n",
);
console.log("Review gallery and actual encoded media prepared.");
