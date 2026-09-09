import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = 4173;
const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
]);

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const requested = url.pathname === "/" ? "/examples/gallery/index.html" : url.pathname;
  const path = join(root, normalize(requested).replace(/^[/\\]+/, ""));
  if (!path.startsWith(root) || !(await stat(path).catch(() => undefined))?.isFile()) {
    response.writeHead(404).end("not found");
    return;
  }
  response.writeHead(200, {
    "content-type": types.get(extname(path)) ?? "application/octet-stream",
  });
  createReadStream(path).pipe(response);
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`gallery server listening on ${port}\n`);
});
