/* app-update.js — tells the Android APK when a newer GitHub Release exists and prompts the
   player to download/install it. Web/PWA keeps using the service-worker update gate (pwa.js).

   How it knows its own build: the APK workflow writes app-version.json into the app
   ({appVersion, runNumber, tag}). Releases come in two kinds:
     - official  "v1.3.3"      → newer when its semver is higher than appVersion
     - automatic "build-123"   → newer when 123 is higher than this app's runNumber */
const REPO = "clinton10-cyber/Everyday-game";
const API = `https://api.github.com/repos/${REPO}/releases?per_page=8`;
const SNOOZE_KEY = "ph3d_app_update_snooze";
const SNOOZE_MS = 6 * 3600 * 1000;       /* "Later" hides the same release for 6 hours */
const CHECK_MS = 30 * 60 * 1000;

const isNative = () => {
  try { if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return true; } catch (e) {}
  return false;
};
const semver = (s) => { const m = /(\d+)\.(\d+)\.(\d+)/.exec(String(s || "")); return m ? [+m[1], +m[2], +m[3]] : null; };
const cmp = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

let _me = null;
async function ownBuild() {
  if (_me) return _me;
  try {
    const r = await fetch("app-version.json", { cache: "no-store" });
    if (r.ok) _me = await r.json();
  } catch (e) {}
  return _me;
}

function isNewer(rel, me) {
  const tag = String(rel.tag_name || "");
  const v = /^v(\d+\.\d+\.\d+)/.exec(tag);
  if (v) { const mine = semver(me.appVersion), theirs = semver(v[1]); return !!(mine && theirs && cmp(theirs, mine) > 0); }
  const b = /^build-(\d+)$/.exec(tag);
  if (b) return Number.isFinite(+me.runNumber) && +b[1] > +me.runNumber;
  return false;
}
function pickApk(rel) {
  const apks = (rel.assets || []).filter(a => /\.apk$/i.test(a.name));
  /* the signed release APK updates in place; the debug one is only a fallback */
  return apks.find(a => !/debug/i.test(a.name)) || apks[0] || null;
}

export async function checkForAppUpdate(opts) {
  opts = opts || {};
  if (!isNative() && !opts.force) return null;
  const me = await ownBuild();
  if (!me) return null;
  let list;
  try { const r = await fetch(API, { headers: { Accept: "application/vnd.github+json" } }); if (!r.ok) return null; list = await r.json(); }
  catch (e) { return null; }           /* offline: try again next time */
  if (!Array.isArray(list)) return null;
  const rel = list.find(r => !r.draft && pickApk(r) && isNewer(r, me));
  if (!rel) return null;
  if (!opts.force) {
    try { const s = JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}"); if (s.tag === rel.tag_name && Date.now() - s.at < SNOOZE_MS) return rel; } catch (e) {}
  }
  showPrompt(rel, me);
  return rel;
}

function showPrompt(rel, me) {
  if (document.getElementById("ph3d-app-update")) return;
  const apk = pickApk(rel);
  const wrap = document.createElement("section");
  wrap.id = "ph3d-app-update";
  wrap.setAttribute("role", "dialog"); wrap.setAttribute("aria-modal", "true");
  wrap.style.cssText = "position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);padding:16px;font-family:Inter,system-ui,sans-serif";
  const notes = String(rel.body || "").replace(/[#*`>_]/g, "").split("\n").map(s => s.trim()).filter(Boolean).slice(0, 4).join(" · ").slice(0, 220);
  const card = document.createElement("div");
  card.style.cssText = "width:min(92vw,420px);max-height:90vh;overflow:auto;background:#0e1713;color:#eaf6ff;border:1px solid rgba(94,224,255,.5);border-radius:18px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.7);text-align:center";
  const h = document.createElement("div"); h.textContent = "⬆️ NEW UPDATE AVAILABLE"; h.style.cssText = "font-weight:900;letter-spacing:.08em;font-size:15px;margin-bottom:8px";
  const p = document.createElement("div"); p.style.cssText = "font-size:13px;line-height:1.45;opacity:.9";
  p.textContent = `${rel.name || rel.tag_name} is ready. You have ${me.appVersion || "an older build"}. Tap UPDATE NOW to download it, then open the downloaded file to install (allow "install unknown apps" if Android asks). Your saved game stays.`;
  card.append(h, p);
  if (notes) { const n = document.createElement("div"); n.textContent = notes; n.style.cssText = "margin-top:8px;font-size:11.5px;opacity:.65"; card.appendChild(n); }
  const row = document.createElement("div"); row.style.cssText = "display:flex;gap:10px;margin-top:16px";
  const mk = (txt, bg, fg) => { const b = document.createElement("button"); b.type = "button"; b.textContent = txt; b.style.cssText = `flex:1;padding:12px 10px;border-radius:12px;border:0;font:800 13px Inter,system-ui,sans-serif;letter-spacing:.04em;background:${bg};color:${fg};cursor:pointer`; return b; };
  const later = mk("LATER", "#26332d", "#cfe3da"), go = mk("UPDATE NOW", "#25D366", "#04110a");
  later.onclick = () => { try { localStorage.setItem(SNOOZE_KEY, JSON.stringify({ tag: rel.tag_name, at: Date.now() })); } catch (e) {} wrap.remove(); };
  go.onclick = () => { go.textContent = "OPENING…"; window.location.href = apk.browser_download_url; setTimeout(() => { go.textContent = "UPDATE NOW"; }, 4000); };
  row.append(later, go); card.appendChild(row);
  const a = document.createElement("a"); a.href = rel.html_url; a.target = "_blank"; a.rel = "noopener"; a.textContent = "View release notes";
  a.style.cssText = "display:inline-block;margin-top:12px;font-size:11.5px;color:#5ee0ff"; card.appendChild(a);
  wrap.appendChild(card); document.body.appendChild(wrap);
}

function start() {
  if (!isNative()) { window.__ph3d_checkAppUpdate = (o) => checkForAppUpdate(Object.assign({ force: true }, o)); return; }
  window.__ph3d_checkAppUpdate = (o) => checkForAppUpdate(o);
  setTimeout(() => checkForAppUpdate(), 4000);
  setInterval(() => checkForAppUpdate(), CHECK_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkForAppUpdate(); });
  window.addEventListener("online", () => checkForAppUpdate());
}
start();
