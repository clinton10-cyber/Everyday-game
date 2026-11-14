/* Service Worker — Everyday in PH
   install  : precache every local file listed in precache.json (+ three.js from
              unpkg) so the game really works offline. Regenerate the list with
              `python3 tools/build_precache.py` when files are added/removed.
   fetch    : code (html/js/css/json) = NETWORK-FIRST (so a new patch always shows
              up when online) with cache fallback; images/audio/fonts/CDN =
              cache-first with background refresh.
   Bump CACHE_VERSION on every release to discard old caches. */

const CACHE_VERSION = "v151";
const SHELL_CACHE   = "ph3d-shell-"   + CACHE_VERSION;
const RUNTIME_CACHE = "ph3d-runtime-" + CACHE_VERSION;

const CDN_FILES = [];   /* three.js + shims are now self-hosted in /vendor (see precache.json) */
const CORE = ["./", "./index.html", "./offline.html", "./manifest.webmanifest"];
const NET_TIMEOUT = 5000;

async function addAll(cache, urls, opts) {
  const queue = urls.slice();
  async function worker() {
    while (queue.length) {
      const u = queue.shift();
      try {
        const res = await fetch(new Request(u, opts));
        if (res && res.status === 200) await cache.put(u, res);
      } catch (e) { /* offline or missing: skip, runtime cache will pick it up */ }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await addAll(cache, CORE, { cache: "reload" });
    let files = [];
    try {
      const r = await fetch("./precache.json", { cache: "reload" });
      if (r.ok) files = (await r.json()).files || [];
    } catch (e) {}
    await addAll(cache, files.map((f) => "./" + f), { cache: "reload" });
    await addAll(cache, CDN_FILES, { mode: "cors" });
    // On updates, wait for the player's mandatory UPDATE NOW action.
    // First install still activates normally because there is no old worker.
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === SHELL_CACHE || k === RUNTIME_CACHE ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

function cacheable(res) {
  return res && res.status === 200 && res.type !== "opaque" && res.type !== "error";
}

function isCode(url, req) {
  if (req.mode === "navigate") return true;
  if (url.origin !== self.location.origin) return false;
  return /\.(html|js|mjs|css|json|webmanifest)$/i.test(url.pathname) || url.pathname.endsWith("/");
}

async function networkFirst(event, req) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), NET_TIMEOUT);
    const fresh = await fetch(req, { signal: ctl.signal });
    clearTimeout(t);
    if (cacheable(fresh)) event.waitUntil(cache.put(req, fresh.clone()));
    return fresh;
  } catch (e) {
    const hit = (await caches.match(req, { ignoreSearch: req.mode === "navigate" })) ||
                (req.mode === "navigate" && ((await caches.match("./index.html")) || (await caches.match("./offline.html"))));
    return hit || new Response("Offline", { status: 503 });
  }
}

async function cacheFirst(event, req) {
  const cached = await caches.match(req);
  const refresh = fetch(req).then((res) => {
    if (cacheable(res)) caches.open(RUNTIME_CACHE).then((c) => c.put(req, res.clone()));
    return res;
  }).catch(() => null);
  if (cached) { event.waitUntil(refresh); return cached; }
  return (await refresh) || new Response("", { status: 504 });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.headers.has("range")) return;                 /* audio/video seeking: let the network handle it */
  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.pathname.includes("/api/")) return;           /* never cache backend calls */
  event.respondWith(isCode(url, req) ? networkFirst(event, req) : cacheFirst(event, req));
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
