/* js/ui/hud-edit.js — "Edit controls": drag any on-screen control to a new spot and resize it.
   Settings → Interface → Edit controls.

   How it works
   • Layout is stored per control (and per orientation) in localStorage as {dx, dy, s}.
   • It is applied with the CSS `translate` / `scale` properties, which are independent of `transform`,
     so it works on fixed-position buttons, flex-zone chips and anything the HUD restyles — and never fights
     the pressed-button animation.
   • Editable = the HUD groups listed below + every button the HUD put in the action / pad / item zones.
   • While editing, the game gets no touches: drag to move, use the size slider, Done to save. Reset is per
     control or all. Controls that only exist in some situations (e.g. FIRE needs a gun drawn) can be edited
     whenever they are on screen. */

const KEY = "ph3d.hudLayout.v1";
const GROUPS = ["#player-panel", "#hud-rail", "#tpill", "#ph3d-pocket-btn", "#hud-dockbtn", "#ph3d-gun-hud", "#ph3d-torch-btn",
  "#ph3d-npc-actions", "#hud-bl", "#dr-left-container", "#dr-right-container", ".rg-top", ".rg-vitals", ".rg-skills", "#ph3d-range-exit-btn", "#ph3d-wanted"];
const LEAVES = "#hud-ctx > [id], #hud-pad > [id], #hud-item > [id]";
const NAMES = {
  "#player-panel": "Player card", "#hud-rail": "Home / sound / settings", "#tpill": "Wallet", "#ph3d-pocket-btn": "Bag", "#hud-dockbtn": "Moves menu",
  "#ph3d-gun-hud": "Ammo", "#ph3d-torch-btn": "Torch", "#ph3d-npc-actions": "Talk", "#hud-bl": "Status", "#dr-left-container": "Pedals", "#dr-right-container": "Steering",
  ".rg-top": "Wave + kills", ".rg-vitals": "HP + weapons", ".rg-skills": "Skills", "#ph3d-range-exit-btn": "Exit", "#ph3d-wanted": "Wanted",
  "#ph3d-jump-btn": "Jump", "#ph3d-run-btn": "Run", "#ph3d-walk-attack": "Fight / Fire", "#ph3d-act-btn": "Fire", "#ph3d-walk-jump": "Jump", "#ph3d-walk-run": "Run",
  "#ph3d-crouch-btn": "Crouch", "#ph3d-wpn-btn": "Gun ⇄ Fists", "#ph3d-view-btn": "View", "#ph3d-aim-btn": "Aim", "#ph3d-shoulder-btn": "Shoulder", "#ph3d-city-drive": "Drive", "#ph3d-city-walk": "Walk",
  "#ph3d-walk-actions": "Actions", "#ph3d-lie-btn": "Lie", "#ph3d-walk-fly": "Jetpack", "#ph3d-outside-btn": "Go outside", "#ph3d-reload": "Reload",
};
const orient = () => (innerWidth >= innerHeight ? "L" : "P");

let data = {}, editing = false, selKey = null, bar = null, scanT = 0, drag = null;
try { data = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { data = {}; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} };
const rec = (k, create) => { const o = orient(); const m = data[o] || (create ? (data[o] = {}) : null); return m ? (m[k] || (create ? (m[k] = { dx: 0, dy: 0, s: 1 }) : null)) : null; };

const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none"; };
function allEditable() {
  const out = [], seen = new Set();
  const add = (el, key) => { if (!seen.has(el)) { seen.add(el); out.push({ el, key }); } };
  for (const sel of GROUPS) document.querySelectorAll(sel).forEach((el) => add(el, sel));
  document.querySelectorAll(LEAVES).forEach((el) => add(el, "#" + el.id));
  return out;
}

function style(el, r, key) {
  if (!r) { el.style.translate = ""; el.style.scale = ""; el.style.transformOrigin = ""; return; }
  if (!r.o) {                                                      /* scale around the edge nearest the screen edge, so it grows inward */
    const b = el.getBoundingClientRect();
    r.o = ((b.left + b.width / 2) < innerWidth / 2 ? "left" : "right") + " " + ((b.top + b.height / 2) < innerHeight / 2 ? "top" : "bottom");
  }
  el.style.transformOrigin = r.o;
  el.style.translate = r.dx || r.dy ? r.dx + "px " + r.dy + "px" : "";
  el.style.scale = r.s && r.s !== 1 ? String(r.s) : "";
}
function clampOnScreen(el, r) {
  const b = el.getBoundingClientRect();
  if (b.right < 40) r.dx += 40 - b.right; else if (b.left > innerWidth - 40) r.dx -= b.left - (innerWidth - 40);
  if (b.bottom < 40) r.dy += 40 - b.bottom; else if (b.top > innerHeight - 40) r.dy -= b.top - (innerHeight - 40);
}

export const HudEdit = {
  /* apply saved layout to whatever is on screen now (cheap: only touches saved keys) */
  apply() {
    const m = data[orient()]; if (!m) return;
    for (const k in m) document.querySelectorAll(k).forEach((el) => {
      if (k.startsWith("#") && !GROUPS.includes(k) && !el.matches(LEAVES)) return;
      style(el, m[k], k);
    });
  },
  init() {
    this.apply();
    let q = 0;
    new MutationObserver(() => { if (q) return; q = requestAnimationFrame(() => { q = 0; this.apply(); }); }).observe(document.body, { childList: true, subtree: true });
    addEventListener("resize", () => this.apply());
    /* opened from settings.html → index.html?edit=1 : start once the HUD is on screen */
    try {
      if (new URLSearchParams(location.search).get("edit") === "1") {
        history.replaceState(null, "", location.pathname);
        let tries = 0;
        const t = setInterval(() => {
          if (document.querySelector("#hud-rail, #player-panel") || ++tries > 80) { clearInterval(t); if (tries <= 80) setTimeout(() => HudEdit.start(), 400); }
        }, 500);
      }
    } catch (e) {}
  },
  hasLayout() { return !!(data.L && Object.keys(data.L).length) || !!(data.P && Object.keys(data.P).length); },
  resetAll() { data = {}; save(); document.querySelectorAll("[style*='translate'],[style*='scale']").forEach((el) => { el.style.translate = ""; el.style.scale = ""; el.style.transformOrigin = ""; }); },

  start() {
    if (editing) return; editing = true; selKey = null;
    try { window.__ph3d_hud && window.__ph3d_hud.closeSheet(); } catch (e) {}
    document.body.classList.add("hud-editing");
    this._mountBar();
    const scan = () => { allEditable().forEach(({ el }) => el.classList.add("hud-edit-target")); scanT = setTimeout(scan, 400); };
    scan();
    addEventListener("pointerdown", this._down, true); addEventListener("pointermove", this._move, true);
    addEventListener("pointerup", this._up, true); addEventListener("pointercancel", this._up, true);
    addEventListener("click", this._swallow, true); addEventListener("keydown", this._key, true);
  },
  stop() {
    if (!editing) return; editing = false; clearTimeout(scanT);
    document.body.classList.remove("hud-editing");
    document.querySelectorAll(".hud-edit-target,.hud-edit-sel").forEach((e) => e.classList.remove("hud-edit-target", "hud-edit-sel"));
    removeEventListener("pointerdown", this._down, true); removeEventListener("pointermove", this._move, true);
    removeEventListener("pointerup", this._up, true); removeEventListener("pointercancel", this._up, true);
    removeEventListener("click", this._swallow, true); removeEventListener("keydown", this._key, true);
    if (bar) { bar.remove(); bar = null; }
    save();
  },

  _swallow(e) { if (bar && bar.contains(e.target)) return; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); },
  _key(e) { if (e.code === "Escape") HudEdit.stop(); },
  _hit(x, y) {                                                    /* smallest editable control under the finger */
    let best = null, ba = 1e12;
    for (const c of allEditable()) {
      if (!visible(c.el)) continue;
      const r = c.el.getBoundingClientRect(); if (x < r.left - 6 || x > r.right + 6 || y < r.top - 6 || y > r.bottom + 6) continue;
      const a = r.width * r.height; if (a < ba) { ba = a; best = c; }
    }
    return best;
  },
  _down(e) {
    if (bar && bar.contains(e.target)) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const c = HudEdit._hit(e.clientX, e.clientY);
    if (!c) { HudEdit._select(null); return; }
    HudEdit._select(c);
    const r = rec(c.key, true); style(c.el, r, c.key);
    drag = { c, sx: e.clientX, sy: e.clientY, dx: r.dx, dy: r.dy, id: e.pointerId };
  },
  _move(e) {
    if (!drag) return;
    if (bar && bar.contains(e.target) && e.pointerId !== drag.id) return;
    e.preventDefault(); e.stopPropagation();
    const r = rec(drag.c.key, true);
    r.dx = Math.round(drag.dx + e.clientX - drag.sx); r.dy = Math.round(drag.dy + e.clientY - drag.sy);
    style(drag.c.el, r, drag.c.key); clampOnScreen(drag.c.el, r); style(drag.c.el, r, drag.c.key);
  },
  _up(e) { if (drag) { e.stopPropagation(); drag = null; save(); } },

  _select(c) {
    document.querySelectorAll(".hud-edit-sel").forEach((n) => n.classList.remove("hud-edit-sel"));
    selKey = c ? c.key : null; this._selEl = c ? c.el : null;
    if (c) c.el.classList.add("hud-edit-sel");
    if (!bar) return;
    const name = bar.querySelector("#he-name"), sl = bar.querySelector("#he-size"), val = bar.querySelector("#he-val");
    if (!c) { name.textContent = "Tap a control, then drag it"; sl.disabled = true; bar.querySelector("#he-one").disabled = true; val.textContent = ""; return; }
    const r = rec(c.key, false) || { s: 1 };
    name.textContent = NAMES[c.key] || c.key.replace(/^[#.]/, "").replace(/^ph3d-/, "").replace(/-/g, " ");
    sl.disabled = false; sl.value = r.s || 1; val.textContent = Math.round((r.s || 1) * 100) + "%"; bar.querySelector("#he-one").disabled = false;
  },
  _mountBar() {
    if (!document.getElementById("he-style")) {
      const st = document.createElement("style"); st.id = "he-style";
      st.textContent = `
        /* no browser panning / zooming while editing: otherwise a finger drag is taken over by the browser
           after a few pixels (pointercancel) and the control only moves a tiny bit */
        body.hud-editing, body.hud-editing *{touch-action:none!important;-webkit-user-select:none;user-select:none}
        body.hud-editing .hud-edit-target{outline:2px dashed rgba(255,198,43,.85)!important;outline-offset:2px;cursor:grab}
        body.hud-editing .hud-edit-sel{outline:3px solid #ffc62b!important;box-shadow:0 0 0 4px rgba(255,198,43,.25)!important}
        #hud-edit-bar{position:fixed;left:0;right:0;top:0;z-index:100000;display:flex;align-items:center;gap:8px;
          padding:calc(env(safe-area-inset-top,0px) + 6px) 10px 7px;background:rgba(7,11,18,.96);backdrop-filter:blur(10px);
          border-bottom:2px solid #ffc62b;color:#f4f6f8;font:700 11px/1.1 Inter,system-ui,sans-serif;
          box-shadow:0 8px 24px rgba(0,0,0,.5);flex-wrap:wrap;justify-content:center;touch-action:manipulation}
        #hud-edit-bar b{color:#ffc62b;letter-spacing:.12em;font-size:10px}
        #hud-edit-bar #he-name{min-width:104px;text-align:center}
        #hud-edit-bar input[type=range]{width:120px;accent-color:#ffc62b}
        #hud-edit-bar button{height:28px;padding:0 11px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;font:800 10px Inter,system-ui,sans-serif;letter-spacing:.05em}
        #hud-edit-bar button:disabled{opacity:.4}
        #hud-edit-bar #he-done{background:#ffc62b;color:#241800;border-color:transparent}`;
      document.head.appendChild(st);
    }
    bar = document.createElement("div"); bar.id = "hud-edit-bar";
    bar.innerHTML = `<b>EDIT CONTROLS</b><span id="he-name"></span><input id="he-size" type="range" min="0.5" max="2.2" step="0.05"><span id="he-val" style="min-width:34px"></span>
      <button id="he-one">Reset this</button><button id="he-all">Reset all</button><button id="he-done">Done</button>`;
    document.body.appendChild(bar);
    const sl = bar.querySelector("#he-size");
    sl.addEventListener("input", () => {
      if (!selKey || !this._selEl) return;
      const r = rec(selKey, true); r.s = +sl.value; style(this._selEl, r, selKey); clampOnScreen(this._selEl, r); style(this._selEl, r, selKey);
      bar.querySelector("#he-val").textContent = Math.round(r.s * 100) + "%"; save();
    });
    bar.querySelector("#he-one").addEventListener("click", () => {
      if (!selKey) return; const m = data[orient()]; if (m) delete m[selKey];
      document.querySelectorAll(selKey).forEach((el) => style(el, null)); save(); this._select(this._selEl ? { key: selKey, el: this._selEl } : null);
    });
    bar.querySelector("#he-all").addEventListener("click", () => { this.resetAll(); this._select(null); });
    bar.querySelector("#he-done").addEventListener("click", () => this.stop());
    this._select(null);
  },
};
window.__ph3d_hudedit = HudEdit;
HudEdit.init();
