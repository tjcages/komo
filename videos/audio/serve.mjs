import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)),
  repo = resolve(here, "../..");
const args = process.argv.slice(2),
  options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!["--video", "--edit", "--port"].includes(args[i]) || !args[i + 1])
    throw Error(
      "Use --video /path/film.mp4 --edit /path/edit.json --port 4341",
    );
  options[args[i].slice(2)] = args[i + 1];
}
const video = resolve(
  options.video || resolve(repo, "../komo-promo/out/film.mp4"),
);
const edit = resolve(
  options.edit || resolve(repo, "tools/launch-video/remotion/edit.json"),
);
const files = new Map(
  ["index.html", "style.css", "studio.mjs", "timing.mjs"].map((name) => [
    `/${name}`,
    resolve(here, name),
  ]),
);
files.set("/", resolve(here, "index.html"));
files.set("/film.mp4", video);
files.set("/edit.json", edit);
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".mp4": "video/mp4",
};
const port = Number(options.port || 4341);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw Error("Invalid port.");
createServer((req, res) => {
  const file = files.get(new URL(req.url, "http://localhost").pathname);
  if (!["GET", "HEAD"].includes(req.method) || !file || !existsSync(file)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const { size } = statSync(file);
  const headers = {
    "Content-Type": types[extname(file)] || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  let start = 0,
    end = size - 1,
    code = 200;
  if (req.headers.range) {
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
    if (!range) {
      res.writeHead(416, { "Content-Range": `bytes */${size}` });
      res.end();
      return;
    }
    start = Number(range[1]);
    end = range[2] ? Math.min(Number(range[2]), size - 1) : end;
    if (start > end || start >= size) {
      res.writeHead(416, { "Content-Range": `bytes */${size}` });
      res.end();
      return;
    }
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
    code = 206;
  }
  headers["Content-Length"] = end - start + 1;
  res.writeHead(code, headers);
  if (req.method === "HEAD") res.end();
  else createReadStream(file, { start, end }).pipe(res);
}).listen(port, "127.0.0.1", () =>
  console.log(
    `Sound studio: http://127.0.0.1:${port}\nVideo: ${video}\nEdit: ${edit}`,
  ),
);
