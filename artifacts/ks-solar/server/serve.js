/**
 * Production server for Expo web export.
 * Serves the dist/ folder produced by `expo export --platform web`.
 * SPA-mode: all unknown paths fall back to index.html.
 * Zero external dependencies — Node.js built-ins only.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const DIST_ROOT = path.resolve(__dirname, "..", "dist");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
};

function resolveFile(pathname) {
  const safe = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const full = path.join(DIST_ROOT, safe);
  if (!full.startsWith(DIST_ROOT)) return null;
  if (fs.existsSync(full) && !fs.statSync(full).isDirectory()) return full;
  return null;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  let pathname = url.pathname;

  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  // Health check for Replit artifact readiness probe
  if (pathname === "/status") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }

  const filePath = resolveFile(pathname) || resolveFile("index.html");

  if (!filePath) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
  res.end(fs.readFileSync(filePath));
});

const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`K&S Solar web app serving on port ${port}`);
  console.log(`Serving from: ${DIST_ROOT}`);
});
