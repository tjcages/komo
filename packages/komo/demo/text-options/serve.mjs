// Text options demo: serves this page with komo bundled from dist/, and the
// local agent server for this directory. Build komo first (pnpm build).
//
//   KOMO_LOCAL_PORT=4858 KOMO_DATA_HOME=/tmp/komo-demo node demo/text-options/serve.mjs
//
// Then, from demo/text-options with the same environment, the agent side:
//   node ../../cli/index.mjs comments wait --local   (lists the agent in Send to)
//   node ../../cli/index.mjs options list --local    (the picks you sent)
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { LocalSession } from "../../cli/local.mjs";
import { localPort } from "../../dist/local.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const endpoint = `http://127.0.0.1:${localPort()}`;
const session = new LocalSession({ cwd: here });
if (!(await session.start()))
  throw Error("The demo's .komo/project.json was not found.");

// Bundled per request, so a rebuilt dist/ shows on reload.
const script = async () =>
  (
    await build({
      entryPoints: [`${here}demo.js`],
      bundle: true,
      format: "esm",
      write: false,
      alias: {
        "@tjcages/komo": fileURLToPath(
          new URL("../../dist/index.js", import.meta.url),
        ),
      },
      define: {
        KOMO_LOCAL_ENDPOINT: JSON.stringify(endpoint),
        "process.env.NODE_ENV": '"development"',
      },
    })
  ).outputFiles[0].text;

const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url, "http://localhost");
  if (pathname === "/demo.js")
    return response
      .writeHead(200, {
        "Content-Type": "text/javascript",
        "Cache-Control": "no-store",
      })
      .end(await script());
  if (pathname !== "/") return response.writeHead(404).end();
  response
    .writeHead(200, {
      "Content-Type": "text/html",
      "Cache-Control": "no-store",
    })
    .end(await readFile(`${here}index.html`));
});
server.listen(Number(process.env.PORT ?? 0), "127.0.0.1", () =>
  console.log(
    `Demo: http://localhost:${server.address().port}/  (komo local server: ${endpoint})`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    server.close();
    session.close().finally(() => process.exit(0));
  });
