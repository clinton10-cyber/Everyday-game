/* phone-home.js
   Home screen, App Library / App Drawer, lock screen content and the display
   settings for the in-game phone.

   Two layout families, picked from the active device skin (or the player's
   own choice in Settings):
     ios      Apple handsets. Widgets, icon grid, dock, App Library page.
     android  Everything else. Info widget, pinned icons, search pill, dock,
              navigation bar, all-apps drawer with A-Z index.

   The original .tapp-ic elements built by phone.js stay the real home icons
   (their click handlers keep working). Dock, library, drawer and sheets use
   wired copies. */

import { Weather } from "./weather.js";
import { Economy } from "./economy.js";
import { PhoneLife } from "./phone-life.js";

const KEY_FULL = "ph3d.phoneFull";
const KEY_LAYOUT = "ph3d.phoneLayout";
const KEY_RECENT = "ph3d.recentApps";

const IOS_DOCK = ["social", "map", "camera", "music"];
const AND_DOCK = ["social", "map", "camera", "gallery"];
const AND_PINNED = ["bank", "health", "jobs", "shop", "weather", "music", "games", "inv", "settings", "mp", "homeinfo", "police"];

const FOLDERS = [
  { id: "suggest", name: "Suggestions", apps: null },
  { id: "recent", name: "Recently Used", apps: null },
  { id: "money", name: "Money", apps: ["bank", "shop", "business", "property"] },
  { id: "life", name: "Life and Work", apps: ["homeinfo", "inv", "jobs", "career", "education"] },
  { id: "social", name: "Social", apps: ["social", "camera", "gallery", "music"] },
  { id: "play", name: "Play", apps: ["games", "comics", "story", "hunt"] },
  { id: "services", name: "Services", apps: ["police", "justice", "health", "mp"] },
  { id: "utils", name: "Utilities", apps: ["weather", "map", "settings", "about"] },
];

const CITY = "Port Harcourt";

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

export const PhoneHome = {
  phone: null, root: null, shell: null, pool: null,
  family: null, meta: {}, order: [],

  init(phone) {
    this.phone = phone;
    this.root = document.getElementById("app-home");
    this.shell = document.getElementById("tphone");
    if (!this.root || !this.shell) return;

    const grid = this.root.querySelector(".tgrid");
    this.pool = document.createElement("div");
    this.pool.id = "ph-pool";
    this.pool.hidden = true;
    this.root.appendChild(this.pool);

    const icons = grid ? [...grid.querySelectorAll(".tapp-ic")] : [];
    icons.forEach((el) => {
      const a = el.dataset.a;
      this.order.push(a);
      this.meta[a] = {
        el,
        name: (el.querySelector(".tnm")?.textContent || a).trim(),
        icon: el.querySelector(".tico")?.innerHTML || "",
      };
      this.pool.appendChild(el);
    });
    if (grid) grid.remove();

    this.root.addEventListener("click", (e) => {
      const ic = e.target.closest(".tapp-ic[data-a]");
      if (ic && !ic.classList.contains("ph-mini")) this.remember(ic.dataset.a);
    }, true);

    const bar = this.shell.querySelector(".thomebar");
    if (bar) bar.onclick = () => {
      if (this.phone.app === "home") { if (!this.closeOverlays()) this.phone.hide(); }
      else this.phone.showApp("home");
    };

    this.applyPrefs();
    this.apply();
    this.refresh();
    this.wireLock();
  },

  /* ── preferences ─────────────────────────────────────── */
  get fullscreen() { return store.get(KEY_FULL, "0") === "1"; },
  get layoutPref() { return store.get(KEY_LAYOUT, "auto"); },

  applyPrefs() {
    if (!this.shell) return;
    this.shell.classList.toggle("phone-full", this.fullscreen);
  },

  resolveFamily() {
    const p = this.layoutPref;
    if (p === "ios" || p === "android") return p;
    return this.shell.classList.contains("skin-ios") ? "ios" : "android";
  },

  /* Called whenever the device skin or the layout preference may have changed. */
  apply() {
    if (!this.root) return;
    const fam = this.resolveFamily();
    this.shell.dataset.ui = fam;
    if (fam === this.family && this.root.querySelector(".ph-home")) return;
    this.family = fam;
    this.build(fam);
    this.refresh();
    this.refreshLock();
  },

  /* ── building ────────────────────────────────────────── */
  icon(a, mini) {
    const m = this.meta[a]; if (!m) return null;
    const d = document.createElement("div");
    d.className = "tapp-ic" + (mini ? " ph-mini" : "");
    d.dataset.a = a;
    d.innerHTML = `<div class="tico">${m.icon}</div>` + (mini ? "" : `<div class="tnm">${m.name}</div>`);
    if (!mini) d.onclick = () => this.open(a);
    return d;
  },

  fill(box, ids, mini) {
    ids.forEach((a) => { const el = this.icon(a, mini); if (el) box.appendChild(el); });
  },

  build(fam) {
    this.pool.append(...Object.values(this.meta).map((m) => m.el));
    this.root.querySelectorAll(".ph-home").forEach((n) => n.remove());

    const home = document.createElement("div");
    home.className = "ph-home";
    home.dataset.ui = fam;
    this.root.insertBefore(home, this.pool);

    const dockIds = fam === "ios" ? IOS_DOCK : AND_DOCK;
    const all = this.order.filter((a) => this.meta[a]);
    const gridIds = fam === "ios"
      ? all.filter((a) => !dockIds.includes(a))
      : AND_PINNED.filter((a) => this.meta[a] && !dockIds.includes(a));

    home.innerHTML = `
      <button class="ph-x" type="button" aria-label="Close phone"><i class="fa-solid fa-xmark"></i></button>
      <div class="ph-pages">
        <section class="ph-page ph-page-home">
          <div class="ph-widgets">${fam === "ios" ? this.iosWidgets() : this.androidWidget()}</div>
          <div class="tgrid"></div>
        </section>
        ${fam === "ios" ? `<section class="ph-page ph-page-lib">
          <label class="ph-search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" placeholder="App Library" autocomplete="off" aria-label="Search apps"></label>
          <div class="ph-folders"></div>
          <div class="ph-results"></div>
        </section>` : ""}
      </div>
      ${fam === "ios" ? `<div class="ph-dots"><i class="on"></i><i></i></div>
        <button class="ph-pillsearch" type="button"><i class="fa-solid fa-magnifying-glass"></i> Search</button>`
        : `<button class="ph-gsearch" type="button"><i class="fa-solid fa-magnifying-glass"></i><span>Search apps</span><i class="fa-solid fa-microphone"></i></button>`}
      <div class="ph-dock"></div>
      ${fam === "android" ? `<div class="ph-nav">
        <button type="button" data-nav="back" aria-label="Back"><i class="fa-solid fa-caret-left"></i></button>
        <button type="button" data-nav="home" aria-label="Home"><i class="fa-regular fa-circle"></i></button>
        <button type="button" data-nav="recent" aria-label="Recent apps"><i class="fa-regular fa-square"></i></button>
      </div>` : ""}
      <div class="ph-sheet"><div class="ph-sheet-card"><div class="ph-sheet-title"></div><div class="ph-sheet-grid"></div></div></div>
      ${fam === "android" ? `<div class="ph-drawer" aria-hidden="true">
        <div class="ph-handle"></div>
        <label class="ph-dsearch"><i class="fa-solid fa-magnifying-glass"></i><input type="search" placeholder="Search apps" autocomplete="off" aria-label="Search apps"></label>
        <div class="ph-dwrap"><div class="ph-dgrid"></div><div class="ph-index"></div></div>
      </div>` : ""}`;

    /* real icons go into the home grid */
    const grid = home.querySelector(".tgrid");
    gridIds.forEach((a) => grid.appendChild(this.meta[a].el));
    this.fill(home.querySelector(".ph-dock"), dockIds, false);

    home.querySelector(".ph-x").onclick = () => this.phone.hide();
    home.querySelector(".ph-sheet").onclick = (e) => { if (e.target.classList.contains("ph-sheet")) this.closeOverlays(); };

    const w = home.querySelector(".ph-w-weather");
    if (w) w.onclick = () => this.open("weather");

    if (fam === "ios") this.wireIos(home); else this.wireAndroid(home);
  },

  iosWidgets() {
    return `
      <div class="ph-w ph-w-weather" role="button" tabindex="0">
        <div class="ph-w-city">${CITY}</div>
        <div class="ph-w-big" data-wx="temp">--</div>
        <div class="ph-w-cond" data-wx="cond"></div>
        <div class="ph-w-name">Weather</div>
      </div>
      <div class="ph-w ph-w-date">
        <div class="ph-w-dow" data-dt="dow"></div>
        <div class="ph-w-day" data-dt="day"></div>
        <div class="ph-w-line"><span class="ph-w-bar"></span><span data-bal></span></div>
        <div class="ph-w-name">Wallet</div>
      </div>`;
  },

  androidWidget() {
    return `
      <div class="ph-wa">
        <div class="ph-wa-row"><b data-dt="short"></b><span data-wx="tempc"></span></div>
        <div class="ph-wa-line" data-wx="cond"></div>
        <div class="ph-wa-line" data-wx="place"></div>
        <div class="ph-wa-line dim" data-bal2></div>
      </div>`;
  },

  /* ── iOS wiring ──────────────────────────────────────── */
  wireIos(home) {
    const pages = home.querySelector(".ph-pages");
    const dots = [...home.querySelectorAll(".ph-dots i")];
    const input = home.querySelector(".ph-search input");
    const box = home.querySelector(".ph-folders");
    const results = home.querySelector(".ph-results");

    const goPage = (i) => pages.scrollTo({ left: i * pages.clientWidth, behavior: "smooth" });
    dots.forEach((d, i) => d.onclick = () => goPage(i));
    pages.addEventListener("scroll", () => {
      const i = Math.round(pages.scrollLeft / Math.max(1, pages.clientWidth));
      dots.forEach((d, k) => d.classList.toggle("on", k === i));
    }, { passive: true });
    home.querySelector(".ph-pillsearch").onclick = () => { goPage(1); setTimeout(() => input.focus(), 260); };

    this.buildFolders(box);
    input.oninput = () => {
      const q = input.value.trim().toLowerCase();
      results.innerHTML = "";
      box.hidden = !!q; results.hidden = !q;
      if (!q) return;
      const hit = this.order.filter((a) => this.meta[a] && this.meta[a].name.toLowerCase().includes(q));
      if (!hit.length) { results.innerHTML = `<div class="ph-none">No apps match.</div>`; return; }
      const g = document.createElement("div"); g.className = "ph-sheet-grid"; this.fill(g, hit, false); results.appendChild(g);
    };
  },

  folderApps(f) {
    if (f.id === "suggest") return IOS_DOCK.filter((a) => this.meta[a]);
    if (f.id === "recent") {
      const r = this.recentList().filter((a) => this.meta[a]);
      const fallback = ["jobs", "bank", "shop", "weather"].filter((a) => this.meta[a] && !r.includes(a));
      return r.concat(fallback).slice(0, 8);
    }
    return f.apps.filter((a) => this.meta[a]);
  },

  buildFolders(box) {
    box.innerHTML = "";
    FOLDERS.forEach((f) => {
      const apps = this.folderApps(f);
      const t = document.createElement("div");
      t.className = "ph-folder-wrap";
      t.innerHTML = `<button class="ph-folder-tile" type="button" aria-label="${f.name}"></button><div class="ph-folder-name">${f.name}</div>`;
      const tile = t.querySelector(".ph-folder-tile");
      this.fill(tile, apps.slice(0, 4), true);
      tile.onclick = () => this.openSheet(f.name, apps);
      box.appendChild(t);
    });
  },

  /* ── Android wiring ──────────────────────────────────── */
  wireAndroid(home) {
    const drawer = home.querySelector(".ph-drawer");
    const grid = home.querySelector(".ph-dgrid");
    const index = home.querySelector(".ph-index");
    const input = home.querySelector(".ph-dsearch input");

    const list = this.order.filter((a) => this.meta[a])
      .sort((a, b) => this.meta[a].name.localeCompare(this.meta[b].name));
    const renderList = (q) => {
      grid.innerHTML = "";
      const hit = q ? list.filter((a) => this.meta[a].name.toLowerCase().includes(q)) : list;
      hit.forEach((a) => {
        const el = this.icon(a, false);
        el.dataset.letter = this.meta[a].name[0].toUpperCase();
        grid.appendChild(el);
      });
      if (!hit.length) grid.innerHTML = `<div class="ph-none">No apps match.</div>`;
      index.innerHTML = "";
      if (q) return;
      [...new Set(hit.map((a) => this.meta[a].name[0].toUpperCase()))].forEach((L) => {
        const s = document.createElement("span"); s.textContent = L;
        s.onclick = () => {
          const t = grid.querySelector(`[data-letter="${L}"]`);
          if (t) grid.scrollTo({ top: t.offsetTop - grid.offsetTop, behavior: "smooth" });
        };
        index.appendChild(s);
      });
    };
    renderList("");
    input.oninput = () => renderList(input.value.trim().toLowerCase());

    const openDrawer = () => { drawer.classList.add("on"); drawer.setAttribute("aria-hidden", "false"); };
    home.querySelector(".ph-gsearch").onclick = () => { openDrawer(); setTimeout(() => input.focus(), 320); };

    home.querySelectorAll("[data-nav]").forEach((b) => b.onclick = () => {
      const n = b.dataset.nav;
      if (n === "recent") {
        if (home.querySelector(".ph-sheet").classList.contains("on")) { this.closeOverlays(); return; }
        const r = this.recentList().filter((a) => this.meta[a]).slice(0, 8);
        this.closeOverlays();
        this.openSheet("Recent apps", r, "Nothing opened yet.");
      } else if (!this.closeOverlays() && n === "home") {
        this.phone.hide();
      }
    });

    /* swipe up on the home area opens the drawer, swipe down on the drawer closes it */
    let y0 = null, x0 = 0;
    const down = (e) => { y0 = e.clientY; x0 = e.clientX; };
    home.querySelector(".ph-pages").addEventListener("pointerdown", down);
    home.querySelector(".ph-pages").addEventListener("pointerup", (e) => {
      if (y0 !== null && y0 - e.clientY > 70 && Math.abs(e.clientX - x0) < 60) openDrawer();
      y0 = null;
    });
    drawer.addEventListener("pointerdown", down);
    drawer.addEventListener("pointerup", (e) => {
      const onHandle = e.target.closest(".ph-handle, .ph-dsearch");
      if (y0 !== null && e.clientY - y0 > 80 && (onHandle || grid.scrollTop === 0)) this.closeOverlays();
      y0 = null;
    });
    this._drawerInput = input; this._renderDrawer = renderList;
  },

  /* ── overlays ────────────────────────────────────────── */
  openSheet(title, ids, emptyText) {
    const sheet = this.root.querySelector(".ph-sheet"); if (!sheet) return;
    sheet.querySelector(".ph-sheet-title").textContent = title;
    const g = sheet.querySelector(".ph-sheet-grid"); g.innerHTML = "";
    if (!ids.length) g.innerHTML = `<div class="ph-none">${emptyText || "Empty."}</div>`;
    else this.fill(g, ids, false);
    sheet.classList.add("on");
  },

  /* returns true when something was open */
  closeOverlays() {
    if (!this.root) return false;
    let was = false;
    const sheet = this.root.querySelector(".ph-sheet");
    if (sheet && sheet.classList.contains("on")) { sheet.classList.remove("on"); was = true; }
    const dr = this.root.querySelector(".ph-drawer");
    if (dr && dr.classList.contains("on")) {
      dr.classList.remove("on"); dr.setAttribute("aria-hidden", "true"); was = true;
      if (this._drawerInput) { this._drawerInput.value = ""; this._renderDrawer(""); }
    }
    return was;
  },

  /* phone.showApp hook */
  onApp(n) {
    if (n !== "home") this.closeOverlays();
    if (n === "home" && this.family === "ios") {
      const box = this.root.querySelector(".ph-folders");
      if (box) this.buildFolders(box);
    }
  },

  open(a) {
    this.closeOverlays();
    this.phone.showApp(a);
    this.remember(a);
  },

  /* ── recents ─────────────────────────────────────────── */
  recentList() {
    try { return JSON.parse(store.get(KEY_RECENT, "[]")) || []; } catch (e) { return []; }
  },
  remember(a) {
    if (!a || a === "home" || !this.meta[a]) return;
    const r = this.recentList().filter((x) => x !== a);
    r.unshift(a);
    store.set(KEY_RECENT, JSON.stringify(r.slice(0, 8)));
  },

  /* ── live content ────────────────────────────────────── */
  wx() {
    try { const i = Weather.info(); return { t: i.temp, cond: i.cond || "" }; }
    catch (e) { return { t: 28, cond: "" }; }
  },
  bal() {
    try { return this.phone._compact(Economy.balance); } catch (e) { return ""; }
  },

  refresh() {
    if (!this.root) return;
    const now = new Date(), w = this.wx(), bal = this.bal();
    const set = (sel, v) => this.root.querySelectorAll(sel).forEach((n) => n.textContent = v);
    set('[data-wx="temp"]', w.t + "\u00b0");
    set('[data-wx="tempc"]', w.t + "\u00b0C");
    set('[data-wx="cond"]', w.cond);
    set('[data-wx="place"]', CITY);
    set('[data-dt="dow"]', now.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ", " + now.toLocaleDateString(undefined, { weekday: "short" }));
    set('[data-dt="day"]', String(now.getDate()));
    set('[data-dt="short"]', now.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }));
    set("[data-bal]", "Balance " + bal);
    set("[data-bal2]", "Balance " + bal);
    this.refreshLock();
  },

  /* ── lock screen ─────────────────────────────────────── */
  wireLock() {
    const lock = document.getElementById("phone-lockscreen"); if (!lock) return;
    const torch = document.getElementById("phone-lock-torch");
    if (torch) torch.onclick = (e) => { e.stopPropagation(); lock.classList.toggle("torch"); torch.classList.toggle("on"); };
    const cam = document.getElementById("phone-lock-cam");
    if (cam) cam.onclick = (e) => { e.stopPropagation(); this.phone.unlock(); this.phone.showApp("camera"); };
  },

  refreshLock() {
    const lock = document.getElementById("phone-lockscreen"); if (!lock) return;
    const fam = this.family || this.resolveFamily();
    const now = new Date(), w = this.wx(), bal = this.bal();
    let batt = 100;
    try { batt = Math.round(PhoneLife.snapshot().battery); } catch (e) {}

    const date = document.getElementById("phone-lock-date");
    if (date) {
      date.textContent = fam === "ios"
        ? now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }).toUpperCase()
        : now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    }

    const sub = document.getElementById("phone-lock-sub");
    if (sub) {
      sub.innerHTML = `<div><b>${w.t}\u00b0C</b><span>${w.cond}</span></div><div><b>${CITY}</b><span>${now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span></div>`;
    }

    const wid = document.getElementById("phone-lock-widgets");
    if (wid) {
      wid.innerHTML = `
        <div class="lw lw-ring" style="--p:${batt}"><span>${batt}%</span></div>
        <div class="lw"><span>${w.t}\u00b0C</span></div>
        <div class="lw"><span>${bal}</span></div>
        <div class="lw lw-ring" style="--p:${Math.round((now.getHours() * 60 + now.getMinutes()) / 14.4)}"><span>${now.getDate()}</span></div>`;
    }

    const notes = document.getElementById("phone-lock-notes");
    if (notes) {
      notes.innerHTML = `
        <div class="lock-note"><div class="lock-note-top"><b>Everyday</b><span>now</span></div>
          <div class="lock-note-title">Welcome back</div>
          <div class="lock-note-text">Your day in ${CITY} is waiting.</div></div>
        <div class="lock-note"><div class="lock-note-top"><b>Bank</b><span>balance</span></div>
          <div class="lock-note-title">${Economy.format ? Economy.format(Economy.balance) : bal}</div>
          <div class="lock-note-text">Available to spend.</div></div>`;
    }
  },

  /* ── settings (called from phone.js) ─────────────────── */
  settingsHtml() {
    const full = this.fullscreen, lp = this.layoutPref;
    const seg = (v, t) => `<button type="button" data-l="${v}" class="${lp === v ? "on" : ""}">${t}</button>`;
    return `<h3 class="ph-set-h">DISPLAY</h3>
      <div class="ph-set">
        <label class="ph-set-row">
          <span><b>Full screen on mobile</b><small>The phone fills the whole screen on phones and tablets.</small></span>
          <input type="checkbox" id="ph-set-full" ${full ? "checked" : ""}>
        </label>
        <div class="ph-set-row stack">
          <span><b>Home screen style</b><small>Auto follows the phone you are using.</small></span>
          <div class="ph-seg" id="ph-set-layout">${seg("auto", "Auto")}${seg("ios", "iPhone")}${seg("android", "Android")}</div>
        </div>
      </div>`;
  },

  bindSettings(root) {
    const full = root.querySelector("#ph-set-full");
    if (full) full.onchange = () => { store.set(KEY_FULL, full.checked ? "1" : "0"); this.applyPrefs(); };
    root.querySelectorAll("#ph-set-layout [data-l]").forEach((b) => b.onclick = () => {
      store.set(KEY_LAYOUT, b.dataset.l);
      root.querySelectorAll("#ph-set-layout [data-l]").forEach((x) => x.classList.toggle("on", x === b));
      this.apply();
      this.phone._applyDeviceSkin && this.phone._applyDeviceSkin();
    });
  },
};
