/* ════════════════════════════════════════════════════════════════
   block-world.js — "Block World": a Minecraft-style build-and-paint sandbox.

   Open it from the phone's GAMES app. Full-screen, phone-first controls:
     • left joystick = move          • drag the world = look
     • TAP the world = use the selected tool where you tapped
     • ▲ / ▼ buttons = fly up / down (or jump when walking)
   Tools: Place · Break · Paint · Fill box · Clear box · Pick colour.
   Any colour (colour picker) + Solid / Glass / Glow materials.
   Undo / redo, 3 save slots, autosave, export / import world files.

   Voxels are Uint32: 0 = air, otherwise  1<<24 | kind<<25 | 0xRRGGBB
   (kind 0 solid, 1 glass, 2 glow).  The world is chunked (16×16 columns) and
   only the chunks you edit are re-meshed.  Vertex-colour ambient occlusion
   gives it depth without textures.

   Exports: BlockWorld.open()
   ════════════════════════════════════════════════════════════════ */

import * as THREE from "three";

const W = 96, H = 48, D = 96, CS = 16;
const NCX = W / CS, NCZ = D / CS;
const SOLID = 0x1000000;
const KIND_SOLID = 0, KIND_GLASS = 1, KIND_GLOW = 2;
const idx = (x, y, z) => (x * D + z) * H + y;                  /* y fastest → long vertical runs compress well */
const mkVal = (rgb, kind) => (SOLID | (kind << 25) | (rgb & 0xffffff)) >>> 0;
const kindOf = (v) => (v >>> 25) & 3;

const SLOTS = 3;
const KEY_DATA = (n) => "ph3d_bw_data_" + n;
const KEY_META = (n) => "ph3d_bw_meta_" + n;
const KEY_HELP = "ph3d_bw_help_seen";

const PRESETS = [
  0xffffff, 0xd0d4da, 0x8a8d93, 0x44474d, 0x15171c,
  0xe53935, 0xff7043, 0xffb300, 0xfdd835, 0xc0ca33, 0x43a047, 0x00897b,
  0x00acc1, 0x1e88e5, 0x3949ab, 0x8e24aa, 0xd81b60, 0xf8bbd0,
  0x6d4c41, 0x8d6e63, 0xd7b98e, 0xe3d18a, 0x7a5230, 0x5da83a, 0x3c8d2f, 0x9ccc65,
  0xb0392f, 0x2d5f9e,
];

const TOOLS = [
  { id: "place", ic: "▣", name: "Place", hint: "Tap to place a block" },
  { id: "break", ic: "⛏", name: "Break", hint: "Tap a block to remove it" },
  { id: "paint", ic: "🎨", name: "Paint", hint: "Tap a block to recolour it" },
  { id: "box",   ic: "⬚", name: "Fill",  hint: "Tap two corners to fill a box" },
  { id: "clear", ic: "▨", name: "Clear", hint: "Tap two corners to erase a box" },
  { id: "pick",  ic: "💧", name: "Pick",  hint: "Tap a block to copy its colour" },
];

/* ───────────────────────── tiny helpers ───────────────────────── */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, z, seed) { let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 2147483647)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed), c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, seed) { return vnoise(x, z, seed) * 0.56 + vnoise(x * 2.1, z * 2.1, seed + 7) * 0.30 + vnoise(x * 4.3, z * 4.3, seed + 13) * 0.14; }

function u8ToB64(u8) { let s = ""; const CH = 0x8000; for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s); }
function b64ToU8(b64) { const s = atob(b64), u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i); return u8; }

function rleEncode(data) {
  const out = []; let run = 1, prev = data[0];
  for (let i = 1; i < data.length; i++) { const v = data[i]; if (v === prev) run++; else { out.push(run, prev); run = 1; prev = v; } }
  out.push(run, prev);
  const i32 = new Int32Array(out.length); for (let i = 0; i < out.length; i++) i32[i] = out[i] | 0;
  return u8ToB64(new Uint8Array(i32.buffer));
}
function rleDecode(b64, data) {
  const u8 = b64ToU8(b64); const i32 = new Int32Array(u8.buffer, u8.byteOffset, u8.byteLength >> 2);
  let p = 0; for (let i = 0; i < i32.length; i += 2) { const n = i32[i], v = i32[i + 1] >>> 0; data.fill(v, p, p + n); p += n; }
  return p === data.length;
}

/* ───────────────────────── world generation ───────────────────────── */
function generate(data, type, seed) {
  data.fill(0);
  const BED = mkVal(0x3a3a40, 0), STONE = mkVal(0x8a8d93, 0), DIRT = mkVal(0x7a5230, 0), GRASS = mkVal(0x5da83a, 0), SAND = mkVal(0xe3d18a, 0);
  const rnd = mulberry32(seed);
  const top = new Int16Array(W * D);
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    data[idx(x, 0, z)] = BED;
    if (type === "blank") {
      data[idx(x, 1, z)] = mkVal(((x >> 1) + (z >> 1)) & 1 ? 0xc6cad1 : 0xdadde2, 0);
      top[x * D + z] = 1; continue;
    }
    let h = 8;
    if (type === "hills") h = Math.floor(7 + fbm(x / 22, z / 22, seed) * 17);
    top[x * D + z] = h;
    const beach = type === "hills" && h <= 8;
    for (let y = 1; y <= h; y++) {
      let v;
      if (y === h) v = beach ? SAND : GRASS;
      else if (y >= h - 3) v = beach ? SAND : DIRT;
      else v = STONE;
      data[idx(x, y, z)] = v;
    }
  }
  if (type === "hills") {                                       /* a few trees */
    const LOG = mkVal(0x6b4423, 0), LEAF = mkVal(0x3c8d2f, 0), LEAF2 = mkVal(0x4aa23a, 0);
    for (let n = 0; n < 70; n++) {
      const x = 4 + Math.floor(rnd() * (W - 8)), z = 4 + Math.floor(rnd() * (D - 8)), h = top[x * D + z];
      if (h <= 9 || data[idx(x, h, z)] !== GRASS) continue;
      const th = 4 + Math.floor(rnd() * 2);
      for (let y = 1; y <= th; y++) data[idx(x, h + y, z)] = LOG;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = th - 1; dy <= th + 2; dy++) {
        const r = Math.abs(dx) + Math.abs(dz) + Math.max(0, dy - th) * 1.4;
        if (r > 3.2 || (dx === 0 && dz === 0 && dy <= th)) continue;
        const X = x + dx, Z = z + dz, Y = h + dy; if (Y >= H) continue;
        if (!data[idx(X, Y, Z)]) data[idx(X, Y, Z)] = rnd() < 0.5 ? LEAF : LEAF2;
      }
    }
  }
}

/* ───────────────────────── mesher ───────────────────────── */
const FACES = [
  { d: [-1, 0, 0], c: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]], s: 0.80 },
  { d: [ 1, 0, 0], c: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]], s: 0.80 },
  { d: [0, -1, 0], c: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]], s: 0.52 },
  { d: [0,  1, 0], c: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]], s: 1.00 },
  { d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]], s: 0.68 },
  { d: [0, 0,  1], c: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], s: 0.68 },
];
for (const f of FACES) {
  f.a = f.d[0] ? 0 : f.d[1] ? 1 : 2;
  const t = [0, 1, 2].filter((i) => i !== f.a); f.t1 = t[0]; f.t2 = t[1];
}
const AO = [0.50, 0.68, 0.84, 1.0];
const _col = new THREE.Color();
const colCache = new Map();
function lin(rgb) { let c = colCache.get(rgb); if (!c) { _col.setHex(rgb); c = [_col.r, _col.g, _col.b]; colCache.set(rgb, c); } return c; }

class Buf { constructor() { this.p = []; this.n = []; this.c = []; this.i = []; } get empty() { return !this.i.length; } }

/* ═════════════════════════ the game ═════════════════════════ */
let _open = null;

export const BlockWorld = {
  open() { if (_open) return; _open = new Game(); },
  close() { if (_open) _open.exit(); },
  get isOpen() { return !!_open; },
  get _game() { return _open; },                              /* debug / tests */
};

class Game {
  constructor() {
    this.data = new Uint32Array(W * H * D);
    this.chunks = new Array(NCX * NCZ).fill(null);
    this.dirty = new Set();
    this.slot = -1; this.meta = null;
    this.undo = []; this.redo = []; this.batch = null;
    this.st = { tool: "place", color: PRESETS[5], kind: KIND_SOLID, recent: [], fly: true };
    this.p = { x: W / 2, y: 20, z: D / 2, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: -0.25, ground: false };
    this.in = { jx: 0, jy: 0, up: false, down: false, keys: {} };
    this.boxA = null; this.hover = null; this.saveState = "saved"; this.saveTimer = 0;
    this.running = false; this.alive = true; this.raf = 0; this.last = 0; this.loading = 0;
    this.listeners = [];
    window.__ph3d_blockworld_open = true;
    this.buildDom();
    this.initGL();
    this.bindInput();
    this.showSlots();
  }

  /* ───────────── DOM ───────────── */
  buildDom() {
    if (!document.getElementById("bw-style")) {
      const s = document.createElement("style"); s.id = "bw-style"; s.textContent = CSS; document.head.appendChild(s);
    }
    const r = this.root = document.createElement("div");
    r.className = "bw-root";
    r.innerHTML = `
      <canvas class="bw-cv"></canvas>
      <div class="bw-load" hidden>Building world…</div>
      <div class="bw-top" hidden>
        <button class="bw-pill bw-ib" data-a="exit" aria-label="Exit">‹</button>
        <div class="bw-pill bw-name"><b data-r="name">World</b><span data-r="save" class="bw-save">Saved ✓</span></div>
        <button class="bw-pill bw-ib" data-a="undo" aria-label="Undo">↶</button>
        <button class="bw-pill bw-ib" data-a="redo" aria-label="Redo">↷</button>
        <button class="bw-pill bw-ib" data-a="fly" aria-label="Toggle flying">✈</button>
        <button class="bw-pill bw-ib" data-a="menu" aria-label="Menu">☰</button>
      </div>
      <div class="bw-toast" hidden></div>
      <div class="bw-joy" hidden><div class="bw-knob"></div></div>
      <div class="bw-ud" hidden>
        <button class="bw-round" data-h="up" aria-label="Up">▲</button>
        <button class="bw-round" data-h="down" aria-label="Down">▼</button>
      </div>
      <div class="bw-bottom" hidden>
        <div class="bw-tools"></div>
        <div class="bw-pal"></div>
      </div>
      <div class="bw-modal" hidden></div>`;
    document.body.appendChild(r);
    this.$ = (q) => r.querySelector(q);
    this.cv = this.$(".bw-cv");
    const tools = this.$(".bw-tools");
    for (const t of TOOLS) {
      const b = document.createElement("button"); b.className = "bw-tool"; b.dataset.tool = t.id;
      b.innerHTML = `<i>${t.ic}</i><small>${t.name}</small>`; tools.appendChild(b);
    }
    this.renderPalette();
    this.setTool("place", true);
  }

  renderPalette() {
    const pal = this.$(".bw-pal"); pal.innerHTML = "";
    const custom = document.createElement("label"); custom.className = "bw-sw bw-custom"; custom.title = "Custom colour";
    custom.innerHTML = `<span>＋</span><input type="color" value="#${this.st.color.toString(16).padStart(6, "0")}">`;
    const ci = custom.querySelector("input");
    ci.addEventListener("input", (e) => this.setColor(parseInt(e.target.value.slice(1), 16), false));
    ci.addEventListener("change", (e) => this.setColor(parseInt(e.target.value.slice(1), 16), true));
    pal.appendChild(custom);
    const mat = document.createElement("button"); mat.className = "bw-mat"; mat.dataset.a = "mat";
    pal.appendChild(mat); this.updateMat();
    const list = [...this.st.recent, ...PRESETS.filter((c) => !this.st.recent.includes(c))];
    for (const c of list) {
      const b = document.createElement("button"); b.className = "bw-sw"; b.dataset.c = c;
      b.style.background = "#" + c.toString(16).padStart(6, "0"); b.setAttribute("aria-label", "colour");
      if (c === this.st.color) b.classList.add("on");
      pal.appendChild(b);
    }
  }
  updateMat() { const m = this.$(".bw-mat"); if (m) m.textContent = ["◼ Solid", "◻ Glass", "✦ Glow"][this.st.kind]; }

  setColor(c, remember) {
    this.st.color = c;
    if (remember) { this.st.recent = [c, ...this.st.recent.filter((x) => x !== c)].slice(0, 8); }
    this.$$(".bw-sw[data-c]").forEach((b) => b.classList.toggle("on", +b.dataset.c === c));
    if (remember) this.renderPalette();
  }
  $$(q) { return this.root.querySelectorAll(q); }

  setTool(id, silent) {
    this.st.tool = id; this.boxA = null; this.updateHighlight();
    this.$$(".bw-tool").forEach((b) => b.classList.toggle("on", b.dataset.tool === id));
    if (!silent) this.toast(TOOLS.find((t) => t.id === id).hint);
  }

  toast(msg, ms = 1800) {
    const t = this.$(".bw-toast"); t.textContent = msg; t.hidden = false; clearTimeout(this._tt);
    this._tt = setTimeout(() => { t.hidden = true; }, ms);
  }

  /* ───────────── GL ───────────── */
  initGL() {
    const dpr = window.devicePixelRatio || 1;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.cv, antialias: dpr < 2, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(1.6, dpr));
    this.scene = new THREE.Scene();
    const SKY = 0x8fd0f5;
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 45, 120);
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.08, 260);
    this.camera.rotation.order = "YXZ";
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a93a0, 1.9));
    const sun = new THREE.DirectionalLight(0xfff4dd, 1.1); sun.position.set(0.5, 1, 0.35); this.scene.add(sun);
    this.world = new THREE.Group(); this.scene.add(this.world);
    this.mats = {
      lit: new THREE.MeshLambertMaterial({ vertexColors: true }),
      glass: new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false }),
      glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
    };
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    this.hl = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x111111, depthTest: false, transparent: true, opacity: 0.9 }));
    this.hl.renderOrder = 999; this.hl.visible = false; this.scene.add(this.hl);
    this.hlA = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff2d55, depthTest: false }));
    this.hlA.renderOrder = 999; this.hlA.visible = false; this.scene.add(this.hlA);
    this.resize();
    this.on(window, "resize", () => this.resize());
    this.on(window, "orientationchange", () => setTimeout(() => this.resize(), 200));
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  on(t, ev, fn, opt) { t.addEventListener(ev, fn, opt); this.listeners.push([t, ev, fn, opt]); }

  /* ───────────── voxel access ───────────── */
  get(x, y, z) { if (x < 0 || x >= W || y < 0 || y >= H || z < 0 || z >= D) return 0; return this.data[idx(x, y, z)]; }
  solidAt(x, y, z) {                                             /* for the player's collision */
    if (x < 0 || x >= W || z < 0 || z >= D || y < 0) return true;
    if (y >= H) return false; return this.data[idx(x, y, z)] !== 0;
  }
  markDirty(x, z) {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const cx = Math.floor((x + dx) / CS), cz = Math.floor((z + dz) / CS);
      if (cx >= 0 && cx < NCX && cz >= 0 && cz < NCZ) this.dirty.add(cx * NCZ + cz);
    }
  }
  setVox(x, y, z, nv) {
    if (x < 0 || x >= W || y < 1 || y >= H || z < 0 || z >= D) return false;
    const i = idx(x, y, z), old = this.data[i];
    if (old === nv) return false;
    this.data[i] = nv;
    if (this.batch) this.batch.push(i, old, nv);
    this.markDirty(x, z);
    return true;
  }
  beginBatch() { this.batch = []; }
  endBatch() {
    const b = this.batch; this.batch = null;
    if (b && b.length) { this.undo.push(b); if (this.undo.length > 120) this.undo.shift(); this.redo.length = 0; this.touchSave(); }
    this.syncUndoBtns();
  }
  applyBatch(b, forward) {
    for (let k = 0; k < b.length; k += 3) {
      const i = b[k], v = forward ? b[k + 2] : b[k + 1]; this.data[i] = v;
      const y = i % H, xz = (i - y) / H, z = xz % D, x = (xz - z) / D; this.markDirty(x, z);
    }
    this.touchSave();
  }
  doUndo() { const b = this.undo.pop(); if (!b) return this.toast("Nothing to undo"); this.applyBatch(b, false); this.redo.push(b); this.syncUndoBtns(); }
  doRedo() { const b = this.redo.pop(); if (!b) return this.toast("Nothing to redo"); this.applyBatch(b, true); this.undo.push(b); this.syncUndoBtns(); }
  syncUndoBtns() {
    this.$('[data-a="undo"]').style.opacity = this.undo.length ? 1 : 0.4;
    this.$('[data-a="redo"]').style.opacity = this.redo.length ? 1 : 0.4;
  }

  /* ───────────── meshing ───────────── */
  buildChunk(cx, cz) {
    const bufs = [new Buf(), new Buf(), new Buf()];
    const x0 = cx * CS, z0 = cz * CS, data = this.data;
    const cull = (x, y, z) => { if (x < 0 || x >= W || z < 0 || z >= D || y < 0) return 2; if (y >= H) return 0; return data[idx(x, y, z)]; };
    const occ = (x, y, z) => { if (x < 0 || x >= W || z < 0 || z >= D || y < 0 || y >= H) return 0; const v = data[idx(x, y, z)]; return v && kindOf(v) !== KIND_GLASS ? 1 : 0; };
    const ao4 = [0, 0, 0, 0];
    for (let x = x0; x < x0 + CS; x++) for (let z = z0; z < z0 + CS; z++) for (let y = 0; y < H; y++) {
      const v = data[idx(x, y, z)]; if (!v) continue;
      const kind = kindOf(v), buf = bufs[kind === KIND_SOLID ? 0 : kind === KIND_GLASS ? 1 : 2];
      const base = lin(v & 0xffffff);
      const hv = ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) >>> 8) & 255;
      const vary = kind === KIND_GLOW ? 1 : 0.955 + 0.06 * (hv / 255);
      for (const f of FACES) {
        const fx = x + f.d[0], fy = y + f.d[1], fz = z + f.d[2];
        const nv = cull(fx, fy, fz);
        if (nv === 2) continue;
        if (nv !== 0) { const nk = kindOf(nv); if (!(nk === KIND_GLASS && kind !== KIND_GLASS)) continue; }
        const shade = (kind === KIND_GLOW ? 1 : f.s) * vary;
        for (let k = 0; k < 4; k++) {
          const c = f.c[k]; let a = 3;
          if (kind !== KIND_GLASS && kind !== KIND_GLOW) {
            const s1 = c[f.t1] * 2 - 1, s2 = c[f.t2] * 2 - 1;
            const e1 = [0, 0, 0], e2 = [0, 0, 0]; e1[f.t1] = s1; e2[f.t2] = s2;
            const side1 = occ(fx + e1[0], fy + e1[1], fz + e1[2]), side2 = occ(fx + e2[0], fy + e2[1], fz + e2[2]);
            const corner = occ(fx + e1[0] + e2[0], fy + e1[1] + e2[1], fz + e1[2] + e2[2]);
            a = side1 && side2 ? 0 : 3 - (side1 + side2 + corner);
          }
          ao4[k] = a;
          const m = shade * AO[a];
          buf.p.push(x - x0 + c[0], y + c[1], z - z0 + c[2]);
          buf.n.push(f.d[0], f.d[1], f.d[2]);
          buf.c.push(base[0] * m, base[1] * m, base[2] * m);
        }
        const n = buf.p.length / 3 - 4;
        if (ao4[0] + ao4[3] > ao4[1] + ao4[2]) buf.i.push(n, n + 1, n + 3, n, n + 3, n + 2);
        else buf.i.push(n, n + 1, n + 2, n + 2, n + 1, n + 3);
      }
    }
    const key = cx * NCZ + cz; let ch = this.chunks[key];
    if (!ch) { ch = this.chunks[key] = { meshes: [null, null, null] }; }
    const mats = [this.mats.lit, this.mats.glass, this.mats.glow];
    for (let m = 0; m < 3; m++) {
      const old = ch.meshes[m];
      if (old) { this.world.remove(old); old.geometry.dispose(); ch.meshes[m] = null; }
      const b = bufs[m]; if (b.empty) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(b.p, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(b.n, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(b.c, 3));
      g.setIndex(b.i); g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mats[m]); mesh.position.set(x0, 0, z0);
      if (m === 1) mesh.renderOrder = 2;
      this.world.add(mesh); ch.meshes[m] = mesh;
    }
  }
  flushDirty(budget) {
    let n = 0;
    for (const k of this.dirty) { this.dirty.delete(k); this.buildChunk(Math.floor(k / NCZ), k % NCZ); if (++n >= budget) break; }
  }

  /* ───────────── slots / save / load ───────────── */
  readMeta(n) { try { return JSON.parse(localStorage.getItem(KEY_META(n)) || "null"); } catch (e) { return null; } }

  showSlots() {
    this.running = false;
    this.$(".bw-top").hidden = this.$(".bw-joy").hidden = this.$(".bw-ud").hidden = this.$(".bw-bottom").hidden = true;
    const m = this.$(".bw-modal"); m.hidden = false; m.className = "bw-modal bw-slots";
    let html = `<div class="bw-card"><h2>BLOCK WORLD</h2><p class="bw-sub">Build anything. Paint everything. Your world saves automatically.</p>`;
    for (let n = 0; n < SLOTS; n++) {
      const meta = this.readMeta(n);
      html += meta
        ? `<div class="bw-slot" data-slot="${n}"><div class="bw-th" style="background-image:url(${meta.thumb || ""})"></div><div class="bw-si"><b>${esc(meta.name)}</b><small>${esc(meta.type)} · ${new Date(meta.updated).toLocaleDateString()}</small></div><button class="bw-del" data-del="${n}" aria-label="Delete world">🗑</button></div>`
        : `<div class="bw-slot empty" data-new="${n}"><div class="bw-th">＋</div><div class="bw-si"><b>New world</b><small>Empty slot ${n + 1}</small></div></div>`;
    }
    html += `<button class="bw-btn ghost" data-a="exit">Close</button></div>`;
    m.innerHTML = html;
  }

  showNew(n) {
    const m = this.$(".bw-modal");
    m.innerHTML = `<div class="bw-card"><h2>New world</h2>
      <input class="bw-input" maxlength="24" value="World ${n + 1}" aria-label="World name">
      <p class="bw-sub">Pick a starting terrain</p>
      <button class="bw-btn" data-type="hills" data-n="${n}">⛰ Rolling hills</button>
      <button class="bw-btn" data-type="flat" data-n="${n}">▭ Flat grass</button>
      <button class="bw-btn" data-type="blank" data-n="${n}">⬜ Blank floor</button>
      <button class="bw-btn ghost" data-a="slots">Back</button></div>`;
  }

  startWorld(n, type, name) {
    this.slot = n;
    this.meta = { name: name || "World", type, created: Date.now(), updated: Date.now() };
    generate(this.data, type, (Math.random() * 1e9) | 0);
    this.undo = []; this.redo = [];
    let sy = H - 1; while (sy > 0 && !this.data[idx(W >> 1, sy, D >> 1)]) sy--;
    Object.assign(this.p, { x: W / 2 + 0.5, y: sy + 3, z: D / 2 + 0.5, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: -0.3 });
    this.beginPlay(true);
  }

  continueWorld(n) {
    let raw = null; try { raw = JSON.parse(localStorage.getItem(KEY_DATA(n)) || "null"); } catch (e) {}
    if (!raw || !rleDecode(raw.rle, this.data)) { this.toast("Couldn't load that world"); return; }
    this.slot = n; this.meta = this.readMeta(n) || { name: raw.name || "World", type: "hills", created: Date.now() };
    Object.assign(this.p, { x: raw.px, y: raw.py, z: raw.pz, yaw: raw.yaw || 0, pitch: raw.pitch || 0, vx: 0, vy: 0, vz: 0 });
    this.st.fly = raw.fly !== false; this.st.color = raw.color != null ? raw.color : this.st.color;
    this.st.kind = raw.kind || 0; this.st.recent = raw.recent || [];
    this.undo = []; this.redo = [];
    this.beginPlay(false);
  }

  beginPlay(fresh) {
    this.$(".bw-modal").hidden = true; this.modalEl = this.$(".bw-modal");
    for (const ch of this.chunks) if (ch) for (const m of ch.meshes) if (m) { this.world.remove(m); m.geometry.dispose(); }
    this.chunks.fill(null); this.dirty.clear();
    for (let i = 0; i < NCX * NCZ; i++) this.dirty.add(i);
    this.loading = this.dirty.size;
    this.$(".bw-load").hidden = false;
    this.$('[data-r="name"]').textContent = this.meta.name;
    this.renderPalette(); this.setTool("place", true); this.syncUndoBtns(); this.updateFlyBtn();
    this.setSaveState("saved");
    if (!this.running) { this.running = true; this.last = performance.now(); this.raf = requestAnimationFrame((t) => this.loop(t)); }
    this._fresh = fresh;
  }

  setSaveState(s) {
    this.saveState = s; const el = this.$('[data-r="save"]');
    el.textContent = s === "saved" ? "Saved ✓" : s === "dirty" ? "Unsaved…" : "Save failed!";
    el.className = "bw-save " + s;
  }
  touchSave() { this.setSaveState("dirty"); clearTimeout(this.saveTimer); this.saveTimer = setTimeout(() => this.saveNow(), 2500); }

  thumb() {
    try {
      this.renderer.render(this.scene, this.camera);
      const c = document.createElement("canvas"); c.width = 192; c.height = 108;
      c.getContext("2d").drawImage(this.cv, 0, 0, 192, 108);
      return c.toDataURL("image/jpeg", 0.6);
    } catch (e) { return ""; }
  }
  payload() {
    return {
      v: 1, name: this.meta.name, W, H, D, rle: rleEncode(this.data),
      px: this.p.x, py: this.p.y, pz: this.p.z, yaw: this.p.yaw, pitch: this.p.pitch,
      fly: this.st.fly, color: this.st.color, kind: this.st.kind, recent: this.st.recent,
    };
  }
  saveNow(withThumb) {
    if (this.slot < 0 || !this.meta) return true;
    clearTimeout(this.saveTimer);
    try {
      this.meta.updated = Date.now();
      localStorage.setItem(KEY_DATA(this.slot), JSON.stringify(this.payload()));
      if (withThumb || !this.meta.thumb || Date.now() - (this._thumbAt || 0) > 20000) { this.meta.thumb = this.thumb(); this._thumbAt = Date.now(); }
      localStorage.setItem(KEY_META(this.slot), JSON.stringify(this.meta));
      this.setSaveState("saved"); return true;
    } catch (e) {
      console.warn("[block-world] save failed", e); this.setSaveState("failed");
      this.toast("Storage is full — use Menu → Export to keep your world", 4000); return false;
    }
  }

  exportWorld() {
    try {
      const blob = new Blob([JSON.stringify({ meta: this.meta, data: this.payload() })], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = (this.meta.name || "world").replace(/[^\w\- ]+/g, "_") + ".blockworld.json";
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    } catch (e) { this.toast("Export failed"); }
  }
  importWorld() {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,application/json";
    inp.onchange = () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const o = JSON.parse(rd.result), d = o.data || o;
          if (d.W !== W || d.H !== H || d.D !== D || !rleDecode(d.rle, this.data)) throw new Error("bad");
          this.meta.name = (o.meta && o.meta.name) || d.name || this.meta.name;
          Object.assign(this.p, { x: d.px, y: d.py, z: d.pz, yaw: d.yaw || 0, pitch: d.pitch || 0 });
          this.undo = []; this.redo = []; this.beginPlay(false); this.touchSave(); this.toast("World imported");
        } catch (e) { this.toast("That file isn't a Block World save"); }
      };
      rd.readAsText(f);
    };
    inp.click();
  }

  showMenu() {
    const m = this.$(".bw-modal"); m.hidden = false; m.className = "bw-modal";
    m.innerHTML = `<div class="bw-card"><h2>Menu</h2>
      <button class="bw-btn" data-a="resume">▶ Resume</button>
      <button class="bw-btn" data-a="save">💾 Save now</button>
      <button class="bw-btn" data-a="help">❓ How to play</button>
      <button class="bw-btn" data-a="export">⤓ Export world file</button>
      <button class="bw-btn" data-a="import">⤒ Import world file</button>
      <button class="bw-btn" data-a="regen">♻ Reset terrain (clears your build)</button>
      <button class="bw-btn" data-a="slots">⇄ Switch world</button>
      <button class="bw-btn ghost" data-a="exit">Close Block World</button></div>`;
  }
  showHelp() {
    const m = this.$(".bw-modal"); m.hidden = false; m.className = "bw-modal";
    m.innerHTML = `<div class="bw-card"><h2>How to play</h2><div class="bw-help">
      <p><b>Move</b> — left joystick (or W A S D)</p>
      <p><b>Look</b> — drag anywhere on the world (or drag with the mouse)</p>
      <p><b>Build</b> — pick a tool, then <b>tap</b> where you want it. Right-click breaks on desktop.</p>
      <p><b>Fly up / down</b> — ▲ ▼ buttons (Space / Shift). ✈ switches flying ↔ walking.</p>
      <p><b>Fill / Clear</b> — tap one corner, then the opposite corner to build or erase whole walls, floors and rooms in one go.</p>
      <p><b>Colours</b> — tap a swatch, or ＋ for any colour. <b>Solid / Glass / Glow</b> changes the material.</p>
      <p><b>Undo / Redo</b> — ↶ ↷ (Ctrl+Z / Ctrl+Y). Everything autosaves.</p></div>
      <button class="bw-btn" data-a="resume">Got it</button></div>`;
    try { localStorage.setItem(KEY_HELP, "1"); } catch (e) {}
  }

  /* ───────────── input ───────────── */
  bindInput() {
    const r = this.root;
    /* clicks on UI */
    r.addEventListener("click", (e) => {
      const t = e.target.closest("button, .bw-slot, [data-type]"); if (!t || !r.contains(t)) return;
      this.blip(520, 0.04);
      if (t.dataset.del != null) { e.stopPropagation(); const n = +t.dataset.del; if (confirm("Delete this world forever?")) { try { localStorage.removeItem(KEY_DATA(n)); localStorage.removeItem(KEY_META(n)); } catch (x) {} this.showSlots(); } return; }
      if (t.dataset.type) { const nm = (this.$(".bw-input").value || "World").trim().slice(0, 24); this.startWorld(+t.dataset.n, t.dataset.type, nm); return; }
      if (t.dataset.slot != null) { this.continueWorld(+t.dataset.slot); return; }
      if (t.dataset.new != null) { this.showNew(+t.dataset.new); return; }
      if (t.dataset.tool) { this.setTool(t.dataset.tool); return; }
      if (t.dataset.c) { this.setColor(+t.dataset.c, false); return; }
      switch (t.dataset.a) {
        case "exit": this.exit(); break;
        case "undo": this.doUndo(); break;
        case "redo": this.doRedo(); break;
        case "fly": this.st.fly = !this.st.fly; this.updateFlyBtn(); this.p.vy = 0; this.toast(this.st.fly ? "Flying on" : "Walking (gravity on)"); this.touchSave(); break;
        case "menu": this.showMenu(); break;
        case "resume": this.$(".bw-modal").hidden = true; break;
        case "save": this.saveNow(true); this.toast("Saved ✓"); break;
        case "help": this.showHelp(); break;
        case "export": this.exportWorld(); break;
        case "import": this.importWorld(); break;
        case "slots": this.saveNow(true); this.showSlots(); break;
        case "regen": if (confirm("Reset the terrain? Your build will be erased.")) { generate(this.data, (this.meta && this.meta.type) || "hills", (Math.random() * 1e9) | 0); this.undo = []; this.redo = []; this.beginPlay(false); this.saveNow(true); } break;
        case "mat": this.st.kind = (this.st.kind + 1) % 3; this.updateMat(); this.toast(["Solid blocks", "Glass (see-through)", "Glowing blocks"][this.st.kind]); break;
      }
    });

    /* hold buttons (fly up / down) */
    const hold = (el, key) => {
      const set = (v) => (e) => { e.preventDefault(); this.in[key] = v; el.classList.toggle("on", v); };
      el.addEventListener("pointerdown", (e) => { set(true)(e); try { el.setPointerCapture(e.pointerId); } catch (x) {} });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => el.addEventListener(ev, set(false)));
    };
    hold(this.$('[data-h="up"]'), "up"); hold(this.$('[data-h="down"]'), "down");

    /* joystick */
    const joy = this.$(".bw-joy"), knob = this.$(".bw-knob"); let jid = null;
    const jmove = (e) => {
      const b = joy.getBoundingClientRect(), R = b.width / 2;
      let dx = e.clientX - (b.left + R), dy = e.clientY - (b.top + R); const L = Math.hypot(dx, dy), M = R * 0.8;
      if (L > M) { dx *= M / L; dy *= M / L; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      const nx = dx / M, ny = dy / M, mag = Math.hypot(nx, ny);
      if (mag < 0.12) { this.in.jx = 0; this.in.jy = 0; } else { this.in.jx = nx; this.in.jy = -ny; }
    };
    joy.addEventListener("pointerdown", (e) => { e.preventDefault(); jid = e.pointerId; joy.setPointerCapture(jid); jmove(e); });
    joy.addEventListener("pointermove", (e) => { if (e.pointerId === jid) jmove(e); });
    const jend = (e) => { if (e.pointerId !== jid) return; jid = null; knob.style.transform = ""; this.in.jx = this.in.jy = 0; };
    joy.addEventListener("pointerup", jend); joy.addEventListener("pointercancel", jend);

    /* look + tap on the world */
    const cv = this.cv; let pid = null, sx = 0, sy = 0, lx = 0, ly = 0, moved = false, btn = 0;
    cv.addEventListener("contextmenu", (e) => e.preventDefault());
    cv.addEventListener("pointerdown", (e) => {
      if (pid !== null || !this.running) return;
      pid = e.pointerId; cv.setPointerCapture(pid); sx = lx = e.clientX; sy = ly = e.clientY; moved = false; btn = e.button;
    });
    cv.addEventListener("pointermove", (e) => {
      if (e.pointerId === pid) {
        if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) > 9) moved = true;
        if (moved) {
          const k = e.pointerType === "mouse" ? 0.0042 : 0.0058;
          this.p.yaw -= (e.clientX - lx) * k; this.p.pitch = Math.max(-1.5, Math.min(1.5, this.p.pitch - (e.clientY - ly) * k));
        }
        lx = e.clientX; ly = e.clientY;
      } else if (e.pointerType === "mouse" && pid === null) { this.hoverAt(e.clientX, e.clientY); }
    });
    const up = (e) => {
      if (e.pointerId !== pid) return; pid = null;
      if (e.type === "pointerup" && !moved) { this.act(e.clientX, e.clientY, btn === 2); if (e.pointerType !== "mouse") { this.hover = null; this.updateHighlight(); } }
    };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", (e) => {
      e.preventDefault();
      const list = [...this.$$(".bw-sw[data-c]")]; let i = list.findIndex((b) => b.classList.contains("on"));
      i = (i + (e.deltaY > 0 ? 1 : -1) + list.length) % list.length; this.setColor(+list[i].dataset.c, false);
    }, { passive: false });

    /* keyboard — captured so the main game never sees it while Block World is open */
    const kd = (e) => {
      if (!this.alive) return;
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" && e.target.type === "text") { e.stopPropagation(); return; }
      e.stopPropagation();
      if (e.type === "keyup") { delete this.in.keys[e.code]; return; }
      this.in.keys[e.code] = true;
      if (!this.running) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.code === "KeyZ") { e.preventDefault(); e.shiftKey ? this.doRedo() : this.doUndo(); }
      else if (mod && e.code === "KeyY") { e.preventDefault(); this.doRedo(); }
      else if (e.code === "KeyF") { this.st.fly = !this.st.fly; this.updateFlyBtn(); }
      else if (e.code === "KeyQ") { const i = TOOLS.findIndex((t) => t.id === this.st.tool); this.setTool(TOOLS[(i + 1) % TOOLS.length].id); }
      else if (e.code === "Escape") { if (!this.modalEl.hidden) this.modalEl.hidden = true; else if (this.boxA) { this.boxA = null; this.updateHighlight(); } else this.showMenu(); }
      else if (/^Digit[1-9]$/.test(e.code)) { const b = this.$$(".bw-sw[data-c]")[+e.code.slice(5) - 1]; if (b) this.setColor(+b.dataset.c, false); }
      if (["Space", "ArrowUp", "ArrowDown", "Tab"].includes(e.code)) e.preventDefault();
    };
    this.on(window, "keydown", kd, true); this.on(window, "keyup", kd, true);
    this.on(window, "pagehide", () => this.saveNow());
    this.on(document, "visibilitychange", () => { if (document.hidden) this.saveNow(); });
  }
  updateFlyBtn() { const b = this.$('[data-a="fly"]'); b.classList.toggle("active", this.st.fly); }

  /* ───────────── picking / acting ───────────── */
  pickRay(cx, cy) {
    const r = this.cv.getBoundingClientRect();
    const nx = ((cx - r.left) / r.width) * 2 - 1, ny = -(((cy - r.top) / r.height) * 2 - 1);
    const v = new THREE.Vector3(nx, ny, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    return this.raycast(this.camera.position.x, this.camera.position.y, this.camera.position.z, v.x, v.y, v.z, 28);
  }
  raycast(ox, oy, oz, dx, dy, dz, maxD) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity, tdz = dz ? Math.abs(1 / dz) : Infinity;
    let tx = dx ? (dx > 0 ? x + 1 - ox : ox - x) * tdx : Infinity;
    let ty = dy ? (dy > 0 ? y + 1 - oy : oy - y) * tdy : Infinity;
    let tz = dz ? (dz > 0 ? z + 1 - oz : oz - z) * tdz : Infinity;
    let nx = 0, ny = 0, nz = 0, first = true;
    for (let i = 0; i < 200; i++) {
      if (!first && this.get(x, y, z)) return { x, y, z, nx, ny, nz };
      first = false;
      if (tx < ty && tx < tz) { if (tx > maxD) break; x += sx; tx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (ty < tz) { if (ty > maxD) break; y += sy; ty += tdy; nx = 0; ny = -sy; nz = 0; }
      else { if (tz > maxD) break; z += sz; tz += tdz; nx = 0; ny = 0; nz = -sz; }
    }
    return null;
  }
  /* the cell a tool would act on */
  targetFor(tool, hit) {
    if (!hit) return null;
    const placing = tool === "place" || tool === "box";
    return placing ? { x: hit.x + hit.nx, y: hit.y + hit.ny, z: hit.z + hit.nz } : { x: hit.x, y: hit.y, z: hit.z };
  }
  hoverAt(cx, cy) { this.hover = this.targetFor(this.st.tool, this.pickRay(cx, cy)); this.updateHighlight(); }
  updateHighlight() {
    if (!this.hl) return;
    const h = this.hover;
    if (h && h.y >= 0 && h.y < H) {
      if (this.boxA && (this.st.tool === "box" || this.st.tool === "clear")) {
        const a = this.boxA; this.hl.position.set((a.x + h.x) / 2 + 0.5, (a.y + h.y) / 2 + 0.5, (a.z + h.z) / 2 + 0.5);
        this.hl.scale.set(Math.abs(a.x - h.x) + 1.01, Math.abs(a.y - h.y) + 1.01, Math.abs(a.z - h.z) + 1.01);
      } else { this.hl.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5); this.hl.scale.setScalar(1.01); }
      this.hl.visible = true;
    } else this.hl.visible = false;
    if (this.boxA) { this.hlA.position.set(this.boxA.x + 0.5, this.boxA.y + 0.5, this.boxA.z + 0.5); this.hlA.scale.setScalar(1.04); this.hlA.visible = true; }
    else this.hlA.visible = false;
  }

  hitsPlayer(x, y, z) {
    const p = this.p;
    return x + 1 > p.x - 0.3 && x < p.x + 0.3 && y + 1 > p.y && y < p.y + 1.8 && z + 1 > p.z - 0.3 && z < p.z + 0.3;
  }

  act(cx, cy, rightClick) {
    const tool = rightClick ? "break" : this.st.tool;
    const hit = this.pickRay(cx, cy);
    if (!hit) { if (tool === "box" || tool === "clear") this.toast("Tap a block or the ground"); return; }
    const t = this.targetFor(tool, hit), val = mkVal(this.st.color, this.st.kind);
    this.hover = t;
    switch (tool) {
      case "place": {
        if (t.y < 1 || t.y >= H) return this.toast("That's the edge of the world");
        if (this.hitsPlayer(t.x, t.y, t.z)) return this.toast("Move first — you're in the way");
        this.beginBatch(); const ok = this.setVox(t.x, t.y, t.z, val); this.endBatch(); if (ok) { this.blip(300, 0.05); this.buzz(); }
        break;
      }
      case "break": {
        if (t.y < 1) return this.toast("That's the unbreakable floor");
        this.beginBatch(); const ok = this.setVox(t.x, t.y, t.z, 0); this.endBatch(); if (ok) { this.blip(170, 0.07); this.buzz(); }
        break;
      }
      case "paint": {
        if (t.y < 1) return;
        this.beginBatch(); const ok = this.setVox(t.x, t.y, t.z, val); this.endBatch(); if (ok) { this.blip(660, 0.05); this.buzz(); }
        break;
      }
      case "pick": {
        const v = this.get(t.x, t.y, t.z); if (!v) return;
        this.st.kind = kindOf(v); this.updateMat(); const c = v & 0xffffff; this.setColor(c, true); this.setTool("place", true);
        this.toast("Colour picked"); break;
      }
      case "box": case "clear": {
        if (!this.boxA) { this.boxA = { ...t }; this.updateHighlight(); this.toast("Now tap the opposite corner"); return; }
        const a = this.boxA, b = t; this.boxA = null;
        const x0 = Math.max(0, Math.min(a.x, b.x)), x1 = Math.min(W - 1, Math.max(a.x, b.x));
        const y0 = Math.max(1, Math.min(a.y, b.y)), y1 = Math.min(H - 1, Math.max(a.y, b.y));
        const z0 = Math.max(0, Math.min(a.z, b.z)), z1 = Math.min(D - 1, Math.max(a.z, b.z));
        const total = (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1);
        if (total > 70000) { this.updateHighlight(); return this.toast("That box is too big — try a smaller one"); }
        const nv = tool === "box" ? val : 0; let n = 0;
        this.beginBatch();
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
          if (tool === "box" && this.hitsPlayer(x, y, z)) continue;
          if (this.setVox(x, y, z, nv)) n++;
        }
        this.endBatch(); this.updateHighlight();
        this.toast(n ? (tool === "box" ? "Filled " : "Cleared ") + n + " blocks" : "Nothing changed"); if (n) { this.blip(tool === "box" ? 360 : 200, 0.1); this.buzz(); }
        break;
      }
    }
    this.updateHighlight();
  }
  buzz() { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} }
  blip(f, d) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ac = this.ac || (this.ac = new AC()); if (ac.state === "suspended") ac.resume();
      const o = ac.createOscillator(), g = ac.createGain(); o.type = "square"; o.frequency.value = f;
      g.gain.setValueAtTime(0.035, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d);
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + d + 0.02);
    } catch (e) {}
  }

  /* ───────────── player physics ───────────── */
  blocked(px, py, pz) {
    const x0 = Math.floor(px - 0.3), x1 = Math.floor(px + 0.3), y0 = Math.floor(py), y1 = Math.floor(py + 1.79), z0 = Math.floor(pz - 0.3), z1 = Math.floor(pz + 0.3);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (this.solidAt(x, y, z)) return true;
    return false;
  }
  step(dt) {
    const p = this.p, I = this.in, K = I.keys, fly = this.st.fly;
    let fw = I.jy + ((K.KeyW || K.ArrowUp) ? 1 : 0) - ((K.KeyS || K.ArrowDown) ? 1 : 0);
    let rt = I.jx + ((K.KeyD || K.ArrowRight) ? 1 : 0) - ((K.KeyA || K.ArrowLeft) ? 1 : 0);
    const m = Math.hypot(fw, rt); if (m > 1) { fw /= m; rt /= m; }
    const sp = fly ? 10 : 4.6, sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
    const tvx = (-sy * fw + cy * rt) * sp, tvz = (-cy * fw - sy * rt) * sp;
    const k = Math.min(1, dt * (fly ? 9 : 14));
    p.vx += (tvx - p.vx) * k; p.vz += (tvz - p.vz) * k;
    const upKey = I.up || K.Space, downKey = I.down || K.ShiftLeft || K.ShiftRight;
    if (fly) { const tv = (upKey ? 7 : 0) - (downKey ? 7 : 0); p.vy += (tv - p.vy) * Math.min(1, dt * 10); }
    else { p.vy -= 28 * dt; if (p.vy < -40) p.vy = -40; if (upKey && p.ground) { p.vy = 8.6; p.ground = false; } }
    const n = Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy), Math.abs(p.vz)) * dt / 0.3) || 1, h = dt / n;
    for (let i = 0; i < n; i++) {
      let nx = p.x + p.vx * h; if (!this.blocked(nx, p.y, p.z)) p.x = nx; else p.vx = 0;
      let nz = p.z + p.vz * h; if (!this.blocked(p.x, p.y, nz)) p.z = nz; else p.vz = 0;
      let ny = p.y + p.vy * h;
      if (!this.blocked(p.x, ny, p.z)) { p.y = ny; if (!fly) p.ground = false; } else { if (p.vy < 0) { p.ground = true; p.y = Math.floor(p.y + 1e-4); } p.vy = 0; }
    }
    p.x = Math.max(0.4, Math.min(W - 0.4, p.x)); p.z = Math.max(0.4, Math.min(D - 0.4, p.z)); p.y = Math.max(0, Math.min(H + 10, p.y));
    if (this.blocked(p.x, p.y, p.z)) p.y += 0.2;                  /* un-stick if a block lands on you */
  }

  /* ───────────── loop ───────────── */
  loop(t) {
    if (!this.alive) return;
    this.raf = requestAnimationFrame((tt) => this.loop(tt));
    const dt = Math.min(0.05, (t - this.last) / 1000 || 0.016); this.last = t;
    if (this.dirty.size) {
      this.flushDirty(this.loading ? 3 : 6);
      if (this.loading && !this.dirty.size) { this.loading = 0; this.$(".bw-load").hidden = true; this.revealUI(); }
    }
    if (!this.loading && this.modalEl.hidden) this.step(dt);
    const p = this.p, c = this.camera;
    c.position.set(p.x, p.y + 1.62, p.z); c.rotation.set(p.pitch, p.yaw, 0);
    this.renderer.render(this.scene, this.camera);
  }
  revealUI() {
    if (this._fresh) { this._fresh = false; setTimeout(() => { if (this.alive) this.saveNow(true); }, 60); }
    this.$(".bw-top").hidden = this.$(".bw-joy").hidden = this.$(".bw-ud").hidden = this.$(".bw-bottom").hidden = false;
    let seen = false; try { seen = !!localStorage.getItem(KEY_HELP); } catch (e) {}
    if (!seen) this.showHelp();
  }

  /* ───────────── teardown ───────────── */
  exit() {
    if (!this.alive) return;
    if (this.slot >= 0 && this.meta && this.running) this.saveNow(true);
    this.alive = false; cancelAnimationFrame(this.raf); clearTimeout(this.saveTimer);
    for (const [t, ev, fn, opt] of this.listeners) t.removeEventListener(ev, fn, opt);
    for (const ch of this.chunks) if (ch) for (const m of ch.meshes) if (m) m.geometry.dispose();
    Object.values(this.mats).forEach((m) => m.dispose());
    try { this.renderer.dispose(); this.renderer.forceContextLoss(); } catch (e) {}
    try { this.ac && this.ac.close(); } catch (e) {}
    this.root.remove(); window.__ph3d_blockworld_open = false; _open = null;
  }
}

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* ───────────────────────── styles ───────────────────────── */
const CSS = `
.bw-root{position:fixed;inset:0;z-index:2147483000;background:#8fd0f5;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#fff;overscroll-behavior:none}
.bw-root *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.bw-cv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.bw-root button{font:inherit;color:inherit;cursor:pointer;touch-action:manipulation}
.bw-top{position:absolute;top:max(env(safe-area-inset-top),8px);left:8px;right:8px;display:flex;gap:6px;align-items:center;pointer-events:none}
.bw-top>*{pointer-events:auto}
.bw-pill{background:rgba(12,16,24,.66);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.14);border-radius:12px;height:42px;display:flex;align-items:center;padding:0 10px;font-size:13px}
.bw-ib{width:44px;justify-content:center;font-size:19px;padding:0}
.bw-ib.active{background:rgba(52,152,255,.85)}
.bw-name{flex:1;min-width:0;gap:8px;overflow:hidden}.bw-name b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bw-save{font-size:11px;opacity:.75;white-space:nowrap}.bw-save.dirty{color:#ffd54f}.bw-save.failed{color:#ff6b6b;opacity:1}
.bw-toast{position:absolute;top:calc(max(env(safe-area-inset-top),8px) + 52px);left:50%;transform:translateX(-50%);background:rgba(12,16,24,.82);padding:8px 14px;border-radius:12px;font-size:13px;max-width:88%;text-align:center;pointer-events:none}
.bw-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(12,16,24,.55);font-size:18px;font-weight:600;z-index:3}
.bw-joy{position:absolute;left:16px;bottom:calc(132px + env(safe-area-inset-bottom));width:124px;height:124px;border-radius:50%;background:rgba(255,255,255,.14);border:2px solid rgba(255,255,255,.35);touch-action:none;display:flex;align-items:center;justify-content:center}
.bw-knob{width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,.7);box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none}
.bw-ud{position:absolute;right:14px;bottom:calc(132px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:12px}
.bw-round{width:60px;height:60px;border-radius:50%;border:2px solid rgba(255,255,255,.4);background:rgba(12,16,24,.55);font-size:22px;touch-action:none}
.bw-round.on{background:rgba(52,152,255,.85)}
.bw-bottom{position:absolute;left:0;right:0;bottom:0;padding:8px 8px max(env(safe-area-inset-bottom),8px);display:flex;flex-direction:column;gap:7px;background:linear-gradient(transparent,rgba(8,12,18,.55) 35%)}
.bw-bottom{pointer-events:none}.bw-pal{pointer-events:auto}.bw-tools{display:flex;gap:6px;justify-content:center;pointer-events:none}.bw-tool{pointer-events:auto}
.bw-tool{flex:1 1 0;max-width:68px;height:50px;border-radius:13px;background:rgba(12,16,24,.7);border:2px solid rgba(255,255,255,.16);display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;padding:0}
.bw-tool i{font-style:normal;font-size:19px}.bw-tool small{font-size:10px;margin-top:3px;opacity:.85}
.bw-tool.on{background:rgba(52,152,255,.9);border-color:#fff}
.bw-pal{display:flex;gap:6px;overflow-x:auto;padding:2px 2px 4px;scrollbar-width:none;touch-action:pan-x;align-items:center}
.bw-pal::-webkit-scrollbar{display:none}
.bw-sw{flex:0 0 34px;height:34px;border-radius:9px;border:2px solid rgba(255,255,255,.4);padding:0}
.bw-sw.on{border-color:#fff;box-shadow:0 0 0 2px #111,0 0 0 4px #fff;transform:scale(1.06)}
.bw-custom{position:relative;display:flex;align-items:center;justify-content:center;background:conic-gradient(#f44,#fb3,#4d4,#3cf,#a4f,#f44);font-weight:700;font-size:18px}
.bw-custom input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}
.bw-mat{flex:0 0 auto;height:34px;border-radius:9px;background:rgba(12,16,24,.75);border:2px solid rgba(255,255,255,.35);padding:0 10px;font-size:12px;white-space:nowrap}
.bw-modal{position:absolute;inset:0;background:rgba(10,14,20,.72);display:flex;padding:16px;z-index:5;overflow:auto}
.bw-modal[hidden],.bw-top[hidden],.bw-joy[hidden],.bw-ud[hidden],.bw-bottom[hidden],.bw-load[hidden],.bw-toast[hidden]{display:none}
.bw-slots{background:linear-gradient(#8fd0f5,#5da83a 88%)}
.bw-card{width:min(420px,100%);margin:auto;flex:none;background:rgba(18,24,34,.94);border:1px solid rgba(255,255,255,.14);border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:10px;box-shadow:0 18px 50px rgba(0,0,0,.5)}
.bw-card h2{margin:0;font-size:22px;letter-spacing:.06em;text-align:center}
.bw-sub{margin:0;text-align:center;font-size:13px;opacity:.75}
.bw-slot{display:flex;gap:12px;align-items:center;background:rgba(255,255,255,.08);border-radius:14px;padding:8px;cursor:pointer;position:relative}
.bw-slot:active{background:rgba(255,255,255,.16)}
.bw-th{width:96px;height:54px;border-radius:9px;background:#2a3444 center/cover;display:flex;align-items:center;justify-content:center;font-size:26px;flex:none}
.bw-si{flex:1;min-width:0}.bw-si b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bw-si small{opacity:.65}
.bw-slot.empty{border:2px dashed rgba(255,255,255,.25);background:none}
.bw-del{background:none;border:none;font-size:20px;padding:8px}
.bw-btn{height:48px;border-radius:13px;border:none;background:#2f7de1;font-size:15px;font-weight:600}
.bw-btn:active{filter:brightness(1.2)}.bw-btn.ghost{background:rgba(255,255,255,.12)}
.bw-input{height:46px;border-radius:12px;border:2px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;font-size:16px;padding:0 12px;width:100%}
.bw-help p{margin:0 0 9px;font-size:14px;line-height:1.4}
@media (orientation:landscape) and (max-height:520px){
  .bw-bottom{left:156px;right:200px;padding-bottom:6px;background:none}
  .bw-tools{position:fixed;right:8px;top:calc(max(env(safe-area-inset-top),8px) + 50px);flex-direction:column;gap:4px;pointer-events:auto}
  .bw-tool{flex:none;width:54px;max-width:none;height:40px}.bw-tool small{display:none}
  .bw-joy{bottom:14px;width:116px;height:116px}
  .bw-ud{bottom:14px;right:74px;flex-direction:row}.bw-round{width:54px;height:54px}
  .bw-th{width:80px;height:45px}
}
`;
