const { app, BrowserWindow, shell } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
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

function startLocalServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let pathname;
      try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
      catch { res.writeHead(400).end('Bad request'); return; }
      if (pathname === '/') pathname = '/index.html';
      const target = path.resolve(ROOT, '.' + pathname);
      if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
        res.writeHead(403).end('Forbidden'); return;
      }
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
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function createWindow() {
  const { server, port } = await startLocalServer();
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600,
    backgroundColor: '#080d0b', autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.on('closed', () => server.close());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${port}/`)) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });
  await win.loadURL(`http://127.0.0.1:${port}/index.html`);
}

app.whenReady().then(createWindow).catch((err) => {
  console.error('[Everyday-game] desktop startup failed:', err);
  app.quit();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
