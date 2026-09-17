import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
const root = resolve(import.meta.dirname, "dist"),
  output = resolve(import.meta.dirname, "output");
await mkdir(output, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const path = resolve(
      root,
      "." +
        new URL(req.url, "http://local").pathname.replace(/\/$/, "/index.html"),
    );
    if (!path.startsWith(root + "/")) throw Error();
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
      }[extname(path)] || "application/octet-stream",
    );
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0, "127.0.0.1");
await once(server, "listening");
const browser = await chromium.launch({ headless: true });
const kind = process.argv[2] || "landscape";
const inspect = process.argv.includes("--inspect");
const vertical = kind === "vertical";
const teaser = kind === "teaser";
const width = vertical ? 1080 : 1920,
  height = vertical ? 1920 : 1080;
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 1,
  colorScheme: "light",
});
page.on("pageerror", (e) => {
  console.error(e);
  process.exitCode = 1;
});
await page.goto(
  `http://127.0.0.1:${server.address().port}/?capture=1&format=${vertical ? "vertical" : "landscape"}`,
);
await page.evaluate(() => document.fonts.ready);
await page.evaluate(async () => {
  await Promise.all([...document.images].map((i) => i.decode()));
});
if (inspect) {
  for (const t of [
    0.8, 4.8, 8.8, 12.8, 17.2, 18.8, 22, 25, 28.8, 31, 33.7, 37, 41.8,
  ]) {
    await page.evaluate((t) => window.seek(t), t);
    await page.screenshot({ path: `${output}/${kind}-${t}.png` });
  }
  console.log("Inspection frames saved.");
} else {
  const duration = teaser ? 12 : 42,
    fps = 30;
  const ff = spawn(
    "ffmpeg",
    [
      "-y",
      "-f",
      "image2pipe",
      "-framerate",
      String(fps),
      "-vcodec",
      "png",
      "-i",
      "-",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      `${output}/komo-${kind}.mp4`,
    ],
    { stdio: ["pipe", "ignore", "inherit"] },
  );
  for (let frame = 0; frame < duration * fps; frame++) {
    const s = frame / fps;
    // Teaser keeps readable holds: hook → feedback → agent → improvement → CTA.
    const t = teaser
      ? s < 2
        ? s + 0.7
        : s < 5
          ? 4.5 + (s - 2)
          : s < 7
            ? 23.3 + (s - 5)
            : s < 9
              ? 30 + (s - 7)
              : 38 + (s - 9)
      : s;
    await page.evaluate((t) => window.seek(t), t);
    const png = await page.screenshot();
    if (!ff.stdin.write(png)) await once(ff.stdin, "drain");
    if (frame % 150 === 0) console.log(`${kind}: ${frame}/${duration * fps}`);
  }
  ff.stdin.end();
  const [code] = await once(ff, "exit");
  if (code !== 0) throw Error("ffmpeg failed");
  await page.evaluate(() => window.seek(38.5));
  await page.screenshot({ path: `${output}/komo-${kind}-thumbnail.png` });
  await writeFile(
    `${output}/${kind}-render.json`,
    JSON.stringify(
      {
        width,
        height,
        fps,
        duration,
        frames: duration * fps,
        source: "deterministic fixture timeline",
        audio: false,
      },
      null,
      2,
    ),
  );
}
await browser.close();
server.close();
