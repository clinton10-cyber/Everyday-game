import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import http from "http"; import fs from "fs"; import path from "path"; import { spawn } from "child_process";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");   // usage: node tools/fx_lab_video.mjs out.mp4 [maxFrames] [w] [h]  (needs: npm i @sparticuz/chromium puppeteer-core)
const OUT = process.argv[2] || "/tmp/out/reel.mp4";
const LIMIT = +(process.argv[3] || 1e9), W = +(process.argv[4] || 768), H = +(process.argv[5] || 432);
const SKIP_TO = +(process.argv[6] || 0), STILLS = process.argv[7] || "";
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg" };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { "content-type": MIME[path.extname(p)] || "application/octet-stream" }); res.end(d); } });
}).listen(0);
const port = srv.address().port;
chromium.setGraphicsMode = true;
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: "shell", defaultViewport: { width: W, height: H },
  args: [...chromium.args, "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"] });
const pg = await b.newPage();
pg.on("pageerror", (e) => console.log("PAGEERR", e.message));
pg.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 200)); });
await pg.goto(`http://127.0.0.1:${port}/tools/fx-lab.html?w=${W}&h=${H}`);
await pg.waitForFunction("window.__ready===true", { timeout: 60000 });
await pg.evaluate("window.__fx.begin()");
const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", "30", "-c:v", "mjpeg", "-i", "-", "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium", OUT], { stdio: ["pipe", "inherit", "inherit"] });
const stills = STILLS ? new Set(STILLS.split(",").map(Number)) : new Set();
let n = 0, t0 = Date.now();
while (n < LIMIT) {
  const more = await pg.evaluate("window.__fx.frame()");
  if (n >= SKIP_TO || stills.has(n)) {
    const jpg = await pg.screenshot({ type: "jpeg", quality: 92 });
    if (n >= SKIP_TO) ff.stdin.write(jpg);
    if (stills.has(n)) fs.writeFileSync(`/tmp/out/still_${String(n).padStart(5, "0")}.jpg`, jpg);
  }
  n++;
  if (n % 100 === 0) console.log("frame", n, "seg", await pg.evaluate("window.__fx.segIndex()"), ((Date.now() - t0) / 1000).toFixed(0) + "s");
  if (!more) break;
}
ff.stdin.end(); await new Promise((r) => ff.on("close", r));
await b.close(); srv.close();
console.log("done", n, "frames", ((Date.now() - t0) / 1000).toFixed(0) + "s");
