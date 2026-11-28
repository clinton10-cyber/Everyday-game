/* ════════════════════════════════════════════════════════════════
   Everyday-game desktop wrapper (Electron)

   One code base, three build GRADES (see electron-builder.config.cjs / WINDOWS-RELEASE.md):
     standard  Windows 10/11 64-bit, current Electron, quality auto-detected
     lite      weak PCs (2-4 GB RAM, 2 cores, old / integrated GPU): starts on the Low or Minimum quality tier
     legacy    Windows 7 / 8 / 8.1 + old 32-bit PCs: Electron 22 (the last one that runs on them) + lite settings

   Hardware safety net (every grade):
     • the game needs WebGL2. If the GPU / driver can't give it (or the GPU process keeps crashing) the app
       remembers that and restarts on software rendering (SwiftShader) — slow, but it runs anywhere.
     • weak hardware is detected (RAM / cores) and starts on a lower quality tier even in the standard build.
     • the local server uses a FIXED port when free, so the browser storage (settings, quality choice,
       caches) survives between launches — a random port made every launch look like a brand-new site.

   Command-line switches (useful from a shortcut):
     --lite            force the lite profile        --standard   force normal quality detection
     --software-render force software rendering      --gpu        forget the software fallback, try the GPU again
   ════════════════════════════════════════════════════════════════ */
const { app, BrowserWindow, shell, ipcMain, screen } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = __dirname;
const APP_ID = 'com.clintonbenjamin.everydaygame';          /* must match electron-builder appId (standard grade) */
let META = {};
try { META = require('./package.json'); } catch (e) {}

const argv = process.argv.slice(1);
const has = (f) => argv.includes(f);
const GRADE = META.ph3dGrade || 'standard';
let PROFILE = META.ph3dProfile || 'auto';                    /* 'auto' | 'lite' */
if (has('--lite')) PROFILE = 'lite';
if (has('--standard')) PROFILE = 'auto';

/* the taskbar button / notifications use this id; matching the installer's appId keeps the LIFEX icon attached to it */
if (process.platform === 'win32') app.setAppUserModelId(GRADE === 'standard' ? APP_ID : APP_ID + '.' + GRADE);

/* ── hardware tier ─────────────────────────────────────────────── */
const totalGB = os.totalmem() / (1024 ** 3);
const cores = (os.cpus() || []).length || 2;
const is64 = process.arch === 'x64' || process.arch === 'arm64';
const veryWeak = totalGB <= 2.5;
const weak = totalGB <= 4.5 || cores <= 2;
const LITE = PROFILE === 'lite' || weak;
/* quality the game should START on (the player can still change it in Settings) */
let QUALITY = 'auto';
if (veryWeak || (LITE && (totalGB <= 3.5 || cores <= 2))) QUALITY = 'potato';
else if (LITE) QUALITY = 'low';

/* ── software-render fallback (remembered across launches) ─────── */
const FLAG = path.join(app.getPath('userData'), 'software-render.flag');
if (has('--gpu')) { try { fs.unlinkSync(FLAG); } catch (e) {} }
const SOFTWARE = has('--software-render') || (() => { try { return fs.existsSync(FLAG); } catch (e) { return false; } })();

function rememberSoftwareAndRestart(reason) {
  if (SOFTWARE) return;                                       /* already on software: nothing left to try */
  console.warn('[Everyday-game] switching to software rendering:', reason);
  try { fs.mkdirSync(path.dirname(FLAG), { recursive: true }); fs.writeFileSync(FLAG, String(reason) + '\n' + new Date().toISOString()); } catch (e) {}
  app.relaunch();
  app.exit(0);
}

/* ── Chromium switches (must be set before ready) ─────────────── */
const sw = (k, v) => (v === undefined ? app.commandLine.appendSwitch(k) : app.commandLine.appendSwitch(k, v));
sw('ignore-gpu-blocklist');                                   /* old GPUs are on Chromium's blocklist; the game is light enough to try */
if (SOFTWARE) {
  sw('use-gl', 'angle'); sw('use-angle', 'swiftshader'); sw('enable-unsafe-swiftshader');
} else {
  sw('enable-gpu-rasterization');
  sw('enable-zero-copy');
}
if (LITE && is64) sw('js-flags', '--max-old-space-size=1536');   /* keep a 4 GB machine from swapping (32-bit builds already have a small heap) */
sw('disable-features', 'CalculateNativeWinOcclusion');        /* cheaper window handling on slow CPUs */

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => {
  const w = BrowserWindow.getAllWindows()[0];
  if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
});

/* the preload asks which quality to start on (sync, runs before the game boots) */
ipcMain.on('ph3d:profile', (e) => {
  e.returnValue = { grade: GRADE, profile: PROFILE, quality: QUALITY, software: SOFTWARE };
});

/* ── local static server ──────────────────────────────────────── */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.wasm': 'application/wasm', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8'
};
const FIXED_PORT = 38417;                                     /* same origin every launch -> settings / saves persist */

function makeServer() {
  return http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
    catch (e) { res.writeHead(400).end('Bad request'); return; }
    if (pathname === '/') pathname = '/index.html';
    const target = path.resolve(ROOT, '.' + pathname);
    if (target !== ROOT && !target.startsWith(ROOT + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
    fs.stat(target, (err, stat) => {
      const file = !err && stat.isFile() ? target : path.join(ROOT, '404.html');
      fs.readFile(file, (readErr, data) => {
        if (readErr) { res.writeHead(404).end('Not found'); return; }
        const ext = path.extname(file).toLowerCase();
        res.writeHead(file.endsWith('404.html') ? 404 : 200, {
          'Content-Type': MIME[ext] || 'application/octet-stream',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        });
        res.end(data);
      });
    });
  });
}

function startLocalServer() {
  return new Promise((resolve, reject) => {
    const listen = (port, fallback) => {
      const server = makeServer();
      server.once('error', (err) => {
        if (fallback && err && err.code === 'EADDRINUSE') listen(0, false);   /* port taken: any free port */
        else reject(err);
      });
      server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    };
    listen(FIXED_PORT, true);
  });
}

/* ── window ───────────────────────────────────────────────────── */
async function createWindow() {
  const { server, port } = await startLocalServer();
  const wa = screen.getPrimaryDisplay().workAreaSize;
  const W = Math.min(LITE ? 1280 : 1440, wa.width), H = Math.min(LITE ? 720 : 900, wa.height);
  const win = new BrowserWindow({
    width: W, height: H, minWidth: Math.min(900, wa.width), minHeight: Math.min(600, wa.height),
    backgroundColor: '#080d0b', autoHideMenuBar: true, show: false,
    icon: path.join(__dirname, 'assets', 'icon-512.png'),      /* window + taskbar icon (also when run with `npm run desktop`) */
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'desktop-preload.cjs'),
      spellcheck: false,
      v8CacheOptions: 'bypassHeatCheck'
    }
  });
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => server.close());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://127.0.0.1:' + port + '/')) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });
  /* F11 = full screen (the menu bar is hidden, so there is no other way to toggle it) */
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); event.preventDefault(); }
  });

  /* an interrupted navigation (ERR_ABORTED, e.g. a reload / redirect while loading) must not take the whole app down */
  try { await win.loadURL('http://127.0.0.1:' + port + '/index.html'); }
  catch (e) { if (!(e && (e.errno === -3 || e.code === 'ERR_ABORTED'))) throw e; }

  /* the game needs WebGL2; if this GPU / driver can't give it, restart on software rendering */
  try {
    const ok = await win.webContents.executeJavaScript(
      '(function(){try{var c=document.createElement("canvas");return !!c.getContext("webgl2");}catch(e){return false;}})()', true);
    if (!ok) rememberSoftwareAndRestart('no WebGL2 on this GPU / driver');
  } catch (e) { /* page still booting; the GPU-crash watcher below still protects us */ }
}

let gpuCrashes = 0;
app.on('child-process-gone', (event, details) => {
  if (details && details.type === 'GPU' && details.reason !== 'clean-exit') {
    gpuCrashes++;
    if (gpuCrashes >= 2) rememberSoftwareAndRestart('GPU process crashed ' + gpuCrashes + 'x (' + details.reason + ')');
  }
});

app.whenReady().then(createWindow).catch((err) => {
  console.error('[Everyday-game] desktop startup failed:', err);
  app.quit();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
