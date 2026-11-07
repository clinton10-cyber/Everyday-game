/* ════════════════════════════════════════════════════════════════
   HUD — one on-screen layout for every scene.

   How it works
   ───────────────────────────────────────────────────────────────
   • Six fixed zones live in #hud-root (see css/hud.css for the map).
   • Scenes keep creating their buttons exactly as before. Any element
     whose id is listed in SPEC below is moved into its zone and given
     the shared look the moment it is added to <body>.
   • Scenes still own show/hide (style.display / opacity). The HUD owns
     position, size, colour and typography.
   • To add a new control: give it an id, add one line to SPEC.
   • Shared bottom sheet for menus:  HUD.sheet({ title, sections })

   Roles
     tl    player card              tr    bag + wallet
     rail  home · menu · sound      ctx   what you can do right now
     pad   jump · fight · run       state label above the joystick
   ════════════════════════════════════════════════════════════════ */

const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/* id → { zone, classes, icon, order, live, title } */
const jump = { z: "pad", cls: "h-pad h-jump", ico: "jump" };
const run  = { z: "pad", cls: "h-pad h-run",  ico: "run" };
const SPEC = {
  "player-panel":          { z: "tl",   cls: "" },
  "ph3d-home-btn":         { z: "rail", cls: "h-rail h-labelled", ico: "home", o: 0, title: "Back to city" },
  "ph3d-menu-btn":         { z: "rail", cls: "h-rail", ico: "menu", o: 1, title: "Menu" },
  "tpill":                 { z: "tr",   cls: "h-wallet", o: 1 },

  "ph3d-use-item":         { z: "item", cls: "h-ctx", ico: "use",  o: 0 },
  "ph3d-drop-item":        { z: "item", cls: "h-ctx", ico: "get",  o: 1 },
  "ph3d-act-btn":          { z: "ctx",  cls: "h-ctx h-act", ico: "hand", o: 0 },
  "ph3d-walk-enter":       { z: "ctx",  cls: "h-ctx h-always", ico: "enter", o: 1 },
  "ph3d-zonedrive-enter":  { z: "ctx",  cls: "h-ctx h-always", ico: "enter", o: 1 },
  "ph3d-walk-pick":        { z: "ctx",  cls: "h-ctx", ico: "get", o: 3, live: "obj" },
  "ph3d-walk-use":         { z: "ctx",  cls: "h-ctx", ico: "use", o: 4, live: "obj" },
  "ph3d-drive-getout":     { z: "ctx",  cls: "h-ctx h-always", ico: "car", o: 5 },
  "ph3d-car-sit":          { z: "ctx",  cls: "h-ctx h-always", ico: "sit", o: 6 },
  "ph3d-bail":             { z: "ctx",  cls: "h-ctx h-always", ico: "key", o: 1 },

  "ph3d-jump-btn":         jump,
  "ph3d-walk-jump":        jump,
  "ph3d-walk-fly":         { z: "ctx",  cls: "h-ctx h-always", ico: "jump", o: 2 },
  "ph3d-house-jump":       jump,
  "ph3d-run-btn":          run,
  "ph3d-walk-run":         run,
  "ph3d-house-run":        run,
  "ph3d-walk-fight":       { z: "pad",  cls: "h-pad h-fight", ico: "fight", live: "fight" },
  "ph3d-fire":             { z: "pad",  cls: "h-pad h-jump h-fire", ico: "aim" },
  "ph3d-reload":           { z: "pad",  cls: "h-pad h-reload", ico: "reload" },

  "ph3d-walk-talk":        { z: "ctx",  cls: "h-ctx h-always", ico: "talk", o: 2 },
  "ph3d-walk-actions":     { z: "ctx",  cls: "h-ctx h-always", ico: "menu", o: 7 },
  "ph3d-walk-attack":      { z: "pad",  cls: "h-pad h-fight", ico: "fight", live: "fight" },
  "ph3d-walk-grab":        { z: "ctx",  cls: "h-ctx h-always", ico: "hand", o: 3 },

  /* buttons previously bypassing the system with full inline styles */
  "ph3d-outside-btn":      { z: "ctx",  cls: "h-ctx h-always", ico: "exit",  o: 0 },
  "ph3d-crouch-btn":       { z: "ctx",  cls: "h-ctx",           o: 8 },
  "ph3d-lie-btn":          { z: "ctx",  cls: "h-ctx",  ico: "sit", o: 9 },
  "ph3d-drive-horn":       { z: "ctx",  cls: "h-ctx",           o: 10 },
  "ph3d-view-btn":         { z: "ctx",  cls: "h-ctx",           o: 11 },
  "ph3d-furn-btn":         { z: "ctx",  cls: "h-ctx",           o: 12 },

  "ph3d-state":            { z: "state", cls: "h-state" },
  "ph3d-house-state":      { z: "state", cls: "h-state" },
};

let root, zones = {};

function buildZones() {
  if (root) return;
  root = el("div"); root.id = "hud-root";
  const mk = (id, key) => { const d = el("div"); d.id = id; root.appendChild(d); zones[key] = d; return d; };
  const tl = mk("hud-tl", "tl");
  zones.rail = el("div"); zones.rail.id = "hud-rail"; tl.appendChild(zones.rail);
  mk("hud-tr", "tr"); mk("hud-ctx", "ctx"); mk("hud-item", "item"); mk("hud-pad", "pad"); mk("hud-bl", "state");
  document.body.appendChild(root);
}

/* ── Label hygiene ───────────────────────────────────────────
   Old buttons say "👊 FIGHT" / "GET IN CAR". Strip the emoji (the HUD
   draws a proper icon) and turn ALL CAPS into Title Case. */
function tidyLabel(node) {
  if (node.children.length) return;
  const raw = node.textContent;
  let s = raw.replace(/^[^A-Za-z0-9\u20A6]+/, "").trim();
  if (s && /[A-Z]/.test(s) && s === s.toUpperCase()) {
    s = s.toLowerCase().replace(/(^|[\s\u00B7-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  }
  if (s !== raw) node.textContent = s;
}

const adopted = new Set();

function adopt(node) {
  if (!node || node.nodeType !== 1) return;
  const spec = SPEC[node.id];
  if (!spec || node.dataset.hud) return;
  buildZones();
  node.dataset.hud = spec.z;
  if (spec.cls) spec.cls.split(" ").forEach((c) => c && node.classList.add(c));
  if (spec.ico) node.style.setProperty("--ico", "var(--i-" + spec.ico + ")");
  if (spec.ico && spec.z === "ctx") node.classList.add("h-lead");
  if (spec.o != null) node.style.order = String(spec.o);
  if (spec.title) { node.title = spec.title; node.setAttribute("aria-label", spec.title); }
  if (spec.z === "pad" && !/h-jump|h-fire/.test(spec.cls || "")) routeDock(node);
  else zones[spec.z].appendChild(node);
  if (spec.z === "ctx" || spec.z === "pad" || spec.z === "state" || spec.z === "rail") {
    tidyLabel(node);
    new MutationObserver(() => tidyLabel(node)).observe(node, { childList: true, characterData: true, subtree: true });
  }
  adopted.add(node);
}

function adoptExisting() {
  Object.keys(SPEC).forEach((id) => { const n = $(id); if (n) adopt(n); });
}

/* ── Shared bottom sheet ────────────────────────────────────── */
let openSheet = null;

function closeSheet() {
  if (!openSheet) return;
  const s = openSheet; openSheet = null;
  s.scrim.classList.remove("on");
  setTimeout(() => s.scrim.remove(), 220);
  if (s.def.onClose) { try { s.def.onClose(); } catch (e) {} }
}

function makeTile(it, group) {
  const b = el("button", "h-tile" + (it.tone ? " tone-" + it.tone : "") + (it.active ? " is-on" : ""));
  b.type = "button";
  if (it.glyph) b.appendChild(el("span", "h-glyph", it.glyph));
  else if (it.icon) { const i = el("i", "h-ico"); i.style.setProperty("--ico", "var(--i-" + it.icon + ")"); b.appendChild(i); }
  b.appendChild(el("span", "h-tile-l", it.label));
  if (it.sub) b.appendChild(el("span", "h-tile-s", it.sub));
  b.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (group && group.radio) {
      group.tiles.forEach((t) => t.classList.remove("is-on"));
      b.classList.add("is-on");
    }
    if (!it.keep) closeSheet();
    if (it.onClick) { try { it.onClick(ev, b); } catch (e) { console.warn("[hud] tile failed", e); } }
  });
  return b;
}

/* def: { title, sub?, sections:[{label?, cols?, radio?, items:[{icon|glyph,label,sub?,tone?,active?,keep?,onClick(ev,tile)}]}],
          render?(bodyEl)  — custom content appended after sections, onClose? } */
function sheet(def) {
  closeSheet();
  buildZones();
  const scrim = el("div", "h-scrim");
  const sh = el("div", "h-sheet");
  sh.appendChild(el("div", "h-grab"));
  const head = el("div", "h-head");
  const hl = el("div");
  hl.appendChild(el("div", "h-title", def.title || "Menu"));
  if (def.sub) hl.appendChild(el("div", "h-sub", def.sub));
  const x = el("button", "h-x"); x.type = "button"; x.setAttribute("aria-label", "Close");
  x.addEventListener("click", (ev) => { ev.stopPropagation(); closeSheet(); });
  head.appendChild(hl); head.appendChild(x); sh.appendChild(head);

  (def.sections || []).forEach((sec) => {
    const s = el("div", "h-sec");
    if (sec.label) s.appendChild(el("div", "h-sec-l", sec.label));
    const g = el("div", "h-grid c" + (sec.cols || 1));
    const group = { radio: !!sec.radio, tiles: [] };
    (sec.items || []).forEach((it) => { const t = makeTile(it, group); group.tiles.push(t); g.appendChild(t); });
    s.appendChild(g); sh.appendChild(s);
  });
  let body = null;
  if (def.render) { body = el("div", "h-body"); sh.appendChild(body); def.render(body); }

  scrim.appendChild(sh);
  scrim.addEventListener("pointerdown", (e) => { if (e.target === scrim) { e.preventDefault(); closeSheet(); } });
  document.body.appendChild(scrim);
  requestAnimationFrame(() => scrim.classList.add("on"));
  openSheet = { scrim, def, body };
  return { close: closeSheet, body };
}

/* ── Sound toggle (rail) ────────────────────────────────────── */
function buildSound() {
  buildZones();
  if ($("hud-sound")) return;
  const b = el("button", "h-rail"); b.id = "hud-sound"; b.type = "button";
  b.dataset.hud = "rail"; b.style.order = "2";
  b.style.setProperty("--ico", "var(--i-sound)");
  b.title = "Sound"; b.setAttribute("aria-label", "Sound");
  b.addEventListener("click", async (ev) => {
    ev.stopPropagation();
    try {
      const { AudioSystem } = await import("../core/audio.js");
      const muted = AudioSystem.toggleMute();
      b.style.setProperty("--ico", "var(--i-" + (muted ? "mute" : "sound") + ")");
      b.classList.toggle("is-off", !!muted);
      if (!muted) AudioSystem.startAmbient && AudioSystem.startAmbient();
    } catch (e) { console.warn("[hud] sound toggle failed", e); }
  });
  zones.rail.appendChild(b);
}

/* ── Bag chip + sheet ───────────────────────────────────────── */
function buildBag() {
  buildZones();
  if ($("ph3d-pocket-btn")) return;
  const wrap = el("div"); wrap.id = "ph3d-pocket"; wrap.style.order = "0";
  const btn = el("button"); btn.id = "ph3d-pocket-btn"; btn.type = "button"; btn.setAttribute("aria-label", "Open bag");
  const ic = el("i", "h-ico"); ic.style.setProperty("--ico", "var(--i-bag)");
  const cnt = el("span"); cnt.id = "ph3d-pocket-count"; cnt.textContent = "0";
  const cap = el("em", null, "/8");
  btn.append(ic, cnt, cap); wrap.appendChild(btn); zones.tr.appendChild(wrap);

  let P = null, ITEMS = null, body = null;
  const toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} };

  function paint() {
    if (!P) return;
    const n = P.count();
    cnt.textContent = String(n);
    btn.classList.toggle("is-full", n >= 8);
    if (!body || !body.isConnected) return;
    body.textContent = "";
    let total = 0; const rows = [];
    P.slots.forEach((s, i) => {
      const spec = s && ITEMS[s.id];
      if (spec) { rows.push({ s, i, spec }); total += (spec.value || 0) * (s.qty || 1); }
    });
    const tot = el("div", "h-bagtotal");
    tot.append(el("span", null, "Total value"), el("b", null, "\u20A6" + total.toLocaleString()));
    body.appendChild(tot);
    if (!rows.length) {
      body.appendChild(el("div", "h-empty", "Your bag is empty. Pick up small items around the city to fill it."));
      return;
    }
    rows.forEach(({ s, i, spec }) => {
      const r = el("div", "h-row");
      r.appendChild(el("div", "h-row-i", spec.icon));
      const m = el("div", "h-row-m");
      m.appendChild(el("div", "h-row-n", spec.name.charAt(0) + spec.name.slice(1).toLowerCase() + ((s.qty || 1) > 1 ? " \u00D7" + s.qty : "")));
      m.appendChild(el("div", "h-row-v", spec.value ? "\u20A6" + (spec.value * (s.qty || 1)).toLocaleString() : "No resale value"));
      r.appendChild(m);
      if (spec.value > 0) {
        const sell = el("button", "h-mini sell", "Sell"); sell.type = "button";
        sell.addEventListener("click", () => {
          const gain = P.sellSlot(i);
          if (gain > 0) {
            const E = window.__ph3d_economy;
            if (E && E.receive) E.receive("SELL " + s.id, gain);
            toast("Sold " + spec.name.toLowerCase() + " for \u20A6" + gain.toLocaleString());
          }
        });
        r.appendChild(sell);
      }
      const drop = el("button", "h-mini", "Drop"); drop.type = "button";
      drop.addEventListener("click", () => { P.remove(i, s.qty || 1); toast("Dropped " + spec.name.toLowerCase()); });
      r.appendChild(drop);
      body.appendChild(r);
    });
  }

  import("../core/pocket.js").then((m) => {
    P = m.Pocket; ITEMS = m.POCKET_ITEMS;
    P.onChange(paint); paint();
  }).catch((e) => console.warn("[hud] bag unavailable", e));

  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (!P) return;
    sheet({ title: "Bag", sub: "Pocket space is limited to 8 slots", render: (b) => { body = b; }, onClose: () => { body = null; } });
    paint();
  });
}


/* ── Action dock: right-hand actions in a collapsible panel ───── */
let dockBtn, dockEl, dockGrid, dockOpen = false, dockPinned = false, dockTimer = 0;

function buildDock() {
  if (dockEl) return;
  buildZones();
  dockBtn = el("button"); dockBtn.id = "hud-dockbtn"; dockBtn.type = "button";
  dockBtn.setAttribute("aria-label", "Moves");
  dockBtn.appendChild(el("i")); dockBtn.appendChild(el("b", "", "0"));

  dockEl = el("div"); dockEl.id = "hud-dock";
  const head = el("div", "hd-head");
  head.appendChild(el("span", "hd-title", "Moves"));
  const pin = el("button", "hd-btn"); pin.type = "button"; pin.setAttribute("aria-label", "Keep open");
  const pi = el("i"); pi.style.setProperty("--m", "var(--i-pin)"); pin.appendChild(pi);
  const x = el("button", "hd-btn"); x.type = "button"; x.setAttribute("aria-label", "Close");
  const xi = el("i"); xi.style.setProperty("--m", "var(--i-close)"); x.appendChild(xi);
  head.appendChild(pin); head.appendChild(x);
  dockGrid = el("div", "hd-grid");
  dockEl.appendChild(head); dockEl.appendChild(dockGrid);
  dockEl.appendChild(el("div", "hd-hint", "Auto-hides · pin to keep open"));
  root.appendChild(dockBtn); root.appendChild(dockEl);

  dockBtn.addEventListener("click", (e) => { e.stopPropagation(); setDock(!dockOpen); });
  x.addEventListener("click", (e) => { e.stopPropagation(); setDock(false); });
  pin.addEventListener("click", (e) => {
    e.stopPropagation(); dockPinned = !dockPinned;
    pin.classList.toggle("is-on", dockPinned); touchDock();
  });
  document.addEventListener("pointerdown", (e) => {
    if (!dockOpen) return;
    if (dockEl.contains(e.target)) { touchDock(); return; }
    if (dockBtn.contains(e.target)) return;
    if (!dockPinned) setDock(false);
  }, true);
  window.addEventListener("keydown", (e) => { if (e.code === "Escape" && dockOpen) setDock(false); });
}

function setDock(open) {
  buildDock();
  dockOpen = !!open;
  dockEl.classList.toggle("on", dockOpen);
  dockBtn.classList.toggle("is-open", dockOpen);
  touchDock();
}
function touchDock() {
  clearTimeout(dockTimer);
  if (dockOpen && !dockPinned) dockTimer = setTimeout(() => setDock(false), 4500);
}
function routeDock(n) {
  buildDock();
  if (n.parentNode !== dockGrid) dockGrid.appendChild(n);
}
function dockTick() {
  if (!dockGrid) return;
  ["ph3d-atk", "ph3d-blk"].forEach((id) => {
    const n = $(id);
    if (n && n.parentNode !== dockGrid) {
      n.dataset.hud = "pad";
      n.style.setProperty("--ico", id === "ph3d-atk" ? "var(--i-fight)" : "var(--i-lock)");
      routeDock(n);
    }
  });
  let vis = 0, alert = false;
  for (const c of dockGrid.children) {
    const cs = getComputedStyle(c);
    if (cs.display === "none") continue;
    if (c.style.opacity === "0" || c.hidden) continue;
    vis++;
    if (c.classList.contains("is-live")) alert = true;
  }
  dockBtn.classList.toggle("has", vis > 0);
  dockBtn.classList.toggle("alert", alert && !dockOpen);
  dockBtn.lastChild.textContent = String(vis);
  if (!vis && dockOpen) setDock(false);
}

/* ── Live state: highlight what you can do right now ────────── */
function tick() {
  try { dockTick(); } catch (e) {}
  try {
    const obj = !!window.__ph3d_nearObj;
    adopted.forEach((n) => {
      if (!n.isConnected) { adopted.delete(n); return; }
      const live = (SPEC[n.id] || {}).live;
      if (live === "obj") n.classList.toggle("is-live", obj);
    });
  } catch (e) { /* HUD must never break a scene */ }
}

/* ── Boot ───────────────────────────────────────────────────── */
function buildSettings() {
  buildZones();
  if (document.getElementById("hud-settings")) return;
  const b = el("button", "h-rail"); b.id = "hud-settings"; b.type = "button";
  b.dataset.hud = "rail"; b.style.order = "3";
  b.style.setProperty("--ico", "var(--i-gear)");
  b.title = "Settings"; b.setAttribute("aria-label", "Settings");
  b.addEventListener("click", async (ev) => {
    ev.stopPropagation();
    try {
      const { SettingsUI } = await import("./settings.js");
      SettingsUI.open();
    } catch (e) { console.warn("[hud] settings open failed:", e); }
  });
  zones.rail.appendChild(b);
}

function boot() {
  buildZones();
  adoptExisting();
  buildSound();
  buildBag();
  buildSettings();
  new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        adopt(n);
        if (n.childElementCount && n.querySelectorAll) n.querySelectorAll("[id]").forEach(adopt);
      });
    }
  }).observe(document.body, { childList: true, subtree: true });
  setInterval(tick, 200);
}

export const HUD = {
  sheet, closeSheet, adopt,
  zone: (name) => { buildZones(); return zones[name]; },
  isSheetOpen: () => !!openSheet,
};
window.__ph3d_hud = HUD;

/* haptic tick + pressed class on right-hand buttons (all scenes) */
(function () {
  const sel = ".h-pad,#ph3d-atk,#ph3d-blk,.h-ctx,.dr-btn,#hud-dockbtn,.hd-btn";
  const down = (e) => {
    const b = e.target.closest && e.target.closest(sel);
    if (!b) return;
    b.classList.add("is-pressed");
    try { if (navigator.vibrate) navigator.vibrate(b.classList.contains("h-fight") || b.id === "ph3d-atk" ? 14 : 8); } catch (_) {}
  };
  const up = () => document.querySelectorAll(".is-pressed").forEach((n) => n.classList.remove("is-pressed"));
  document.addEventListener("pointerdown", down, true);
  document.addEventListener("pointerup", up, true);
  document.addEventListener("pointercancel", up, true);
})();


if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();

