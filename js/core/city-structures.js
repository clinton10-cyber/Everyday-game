/* ================================================================
   city-structures.js  —  interactive world structures
   ================================================================
   1) Pedestrian crossing : zebra stripes + push-button signal, traffic really stops
   2) Network mast        : climb the ladder, boost the signal, climb down
   3) Basket tower        : ride the iron basket up a steel tower, lookout deck
   4) Crane               : ride the load pallet as the crane swings you across
   5) Cave                : walk in, torches, crystals, bats, treasure chest

   Placed automatically on free ground (no building, road or landmark in the way).
   One contextual button (#ph3d-struct-btn, key U) does the action for whatever is near.

   Hooks in drive.js:  Structures.init(ctx)  once,
                       Structures.update(dt, px, pz, mode)  every frame,
                       Structures.enforce()  after the walker has moved (keeps riders attached),
                       Structures.dispose()  on scene exit.
   ================================================================ */

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Economy } from "./economy.js";

const TAU = Math.PI * 2;
const sstep = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fract = (v) => v - Math.floor(v);

/* ── geometry batching: many small parts → one mesh per material ── */
const _m4 = new THREE.Matrix4(), _qq = new THREE.Quaternion(), _ee = new THREE.Euler(), _pp = new THREE.Vector3(), _ss = new THREE.Vector3();
const _UPV = new THREE.Vector3(0, 1, 0), _dv = new THREE.Vector3();

class Batch {
  constructor() { this.parts = new Map(); }
  _push(geo, mat, m) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(m);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
  }
  box(mat, x, y, z, w, h, d, ry, rx, rz) {
    _ee.set(rx || 0, ry || 0, rz || 0, "YXZ"); _qq.setFromEuler(_ee);
    _m4.compose(_pp.set(x, y, z), _qq, _ss.set(1, 1, 1));
    this._push(new THREE.BoxGeometry(w, h, d), mat, _m4);
  }
  cyl(mat, x, y, z, rt, rb, h, seg, rx, rz) {
    _ee.set(rx || 0, 0, rz || 0, "YXZ"); _qq.setFromEuler(_ee);
    _m4.compose(_pp.set(x, y, z), _qq, _ss.set(1, 1, 1));
    this._push(new THREE.CylinderGeometry(rt, rb, h, seg || 8), mat, _m4);
  }
  strut(mat, a, b, r) {
    _dv.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = _dv.length(); if (len < 1e-4) return;
    _dv.multiplyScalar(1 / len);
    _qq.setFromUnitVectors(_UPV, _dv);
    _m4.compose(_pp.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _qq, _ss.set(1, 1, 1));
    this._push(new THREE.BoxGeometry(r * 2, len, r * 2), mat, _m4);
  }
  lump(mat, x, y, z, sx, sy, sz, seed) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const k = 0.78 + 0.44 * fract(Math.sin(vx * 12.9898 + vy * 78.233 + vz * 37.719 + seed * 17.13) * 43758.5453);
      p.setXYZ(i, vx * k, vy * k, vz * k);
    }
    g.computeVertexNormals();
    _ee.set(0, seed * 1.7, 0); _qq.setFromEuler(_ee);
    _m4.compose(_pp.set(x, y, z), _qq, _ss.set(sx, sy, sz));
    this._push(g, mat, _m4);
  }
  build(parent, S) {
    const out = [];
    for (const [mat, list] of this.parts) {
      const geo = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, mat);
      parent.add(mesh); out.push(mesh);
      S.geos.push(geo);
    }
    this.parts.clear();
    return out;
  }
}

const mat = (S, color, o) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.82, metalness: 0.15 }, o || {})); S.mats.push(m); return m; };
const basic = (S, color, o) => { const m = new THREE.MeshBasicMaterial(Object.assign({ color }, o || {})); S.mats.push(m); return m; };

/* ── finding free ground ── */
function dSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
function clearAt(ctx, x, z, R, roadPad) {
  for (const b of ctx.aabbs) {
    const dx = Math.max(Math.abs(x - b.x) - b.hx, 0), dz = Math.max(Math.abs(z - b.z) - b.hz, 0);
    if (dx * dx + dz * dz < R * R) return false;
  }
  for (const r of ctx.roads) {
    const pts = r.pts, hw = (r.w || 20) / 2 + roadPad;
    for (let i = 0; i + 1 < pts.length; i++) if (dSeg(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) < hw) return false;
  }
  for (const c of ctx.compounds) if (Math.hypot(c.x - x, c.z - z) < R + 30) return false;
  return true;
}
function findSpot(ctx, R, ang0, used, rMin, roadPad) {
  for (let r = rMin; r <= 1300; r += 30) {
    for (let k = 0; k < 24; k++) {
      const a = ang0 + k * (TAU / 24);
      const x = ctx.spawn.x + Math.cos(a) * r, z = ctx.spawn.z + Math.sin(a) * r;
      if (Math.abs(x) > 1500 || Math.abs(z) > 1500) continue;
      let ok = true;
      for (const u of used) if (Math.hypot(u.x - x, u.z - z) < 70) { ok = false; break; }
      if (ok && clearAt(ctx, x, z, R, roadPad)) return { x, z };
    }
  }
  return null;
}
function findCrossing(ctx) {
  let best = null, bd = 1e9;
  const verts = [];
  for (const r of ctx.roads) for (const p of r.pts) verts.push(p);
  for (let ri = 0; ri < ctx.roads.length; ri++) {
    const r = ctx.roads[ri], pts = r.pts, W = r.w || 20;
    for (let i = 0; i + 1 < pts.length; i++) {
      const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 70) continue;
      const dx = (bx - ax) / L, dz = (bz - az) / L;
      for (let s = L * 0.3; s <= L * 0.7; s += 6) {
        const x = ax + dx * s, z = az + dz * s;
        const d = Math.hypot(x - ctx.spawn.x, z - ctx.spawn.z);
        if (d >= bd) continue;
        let ok = true;
        for (const v of verts) if (Math.hypot(v[0] - x, v[1] - z) < 28) { ok = false; break; }
        if (!ok) continue;
        for (let rj = 0; rj < ctx.roads.length && ok; rj++) {
          if (rj === ri) continue;
          const q = ctx.roads[rj].pts;
          for (let j = 0; j + 1 < q.length; j++) if (dSeg(x, z, q[j][0], q[j][1], q[j + 1][0], q[j + 1][1]) < W / 2 + 10) { ok = false; break; }
        }
        if (!ok) continue;
        for (const b of ctx.aabbs) {
          const ddx = Math.max(Math.abs(x - b.x) - b.hx, 0), ddz = Math.max(Math.abs(z - b.z) - b.hz, 0);
          if (ddx * ddx + ddz * ddz < (W / 2 + 3.5) * (W / 2 + 3.5)) { ok = false; break; }
        }
        if (ok) { bd = d; best = { x, z, dx, dz, W }; }
      }
    }
  }
  return best;
}

/* ── floating labels so the structures can be found from afar ── */
function makeLabel(S, text, y) {
  const c = document.createElement("canvas"); c.width = 320; c.height = 72;
  const tex = new THREE.CanvasTexture(c); S.texs.push(tex);
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }); S.mats.push(m);
  const sp = new THREE.Sprite(m); sp.renderOrder = 999; sp.position.y = y;
  sp.userData = { c, tex, text, last: "" };
  return sp;
}
function drawLabel(sp, dist) {
  const u = sp.userData, s = u.text + "  " + Math.round(dist) + " m";
  if (s === u.last) return; u.last = s;
  const g = u.c.getContext("2d"); g.clearRect(0, 0, 320, 72);
  g.font = "bold 30px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 7; g.strokeStyle = "rgba(0,0,0,.75)"; g.strokeText(s, 160, 36);
  g.fillStyle = "#ffd23f"; g.fillText(s, 160, 36);
  u.tex.needsUpdate = true;
}

/* ================================================================ */
export const Structures = {
  S: null,

  init(ctx) {
    this.dispose();
    const S = this.S = {
      ctx, list: [], mats: [], geos: [], texs: [], objs: [], lights: [],
      lock: null, prompt: null, mode: "walk", labelT: 0, t: 0, btn: null,
    };
    const walker = ctx.walker;
    S.walker = walker;

    /* contextual button */
    const btn = document.createElement("button");
    btn.id = "ph3d-struct-btn"; btn.textContent = "USE";
    btn.style.cssText = "display:none;cursor:pointer;pointer-events:auto;touch-action:manipulation;";
    document.body.appendChild(btn);
    S.btn = btn;
    btn.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); this._press(); }, { passive: false });
    S._key = (e) => { if (e.code === "KeyU" && !e.repeat && S.mode === "walk") this._press(); };
    window.addEventListener("keydown", S._key);

    /* traffic hold zones for the crossing */
    const cars = window.__ph3d_npc_cars;
    if (cars) cars.holdZones = [];

    const used = [];
    const tries = [
      ["mast", 0.3, 14, 70, buildMast],
      ["tower", 1.9, 14, 120, buildTower],
      ["crane", 3.4, 36, 160, buildCrane],
      ["cave", 4.9, 40, 200, buildCave],
    ];
    try {
      const cr = findCrossing(ctx);
      if (cr) { const s = buildCrossing(S, cr); if (s) S.list.push(s); }
    } catch (e) { console.warn("[structures] crossing", e); }
    for (const [id, ang, R, rMin, fn] of tries) {
      try {
        let spot = findSpot(ctx, R, ang, used, rMin, 6) || findSpot(ctx, R * 0.7, ang, used, rMin, 4);
        if (!spot) { console.warn("[structures] no free ground for", id); continue; }
        used.push(spot);
        const s = fn(S, spot);
        if (s) S.list.push(s);
      } catch (e) { console.warn("[structures]", id, e); }
    }
    for (const s of S.list) {
      if (s.label) { S.ctx.scene.add(s.label); S.objs.push(s.label); }
    }
    window.__ph3d_structures = S.list.map((s) => ({ id: s.id, x: Math.round(s.x), z: Math.round(s.z) }));
    console.log("[structures] placed", JSON.stringify(window.__ph3d_structures));
  },

  _press() {
    const S = this.S; if (!S || !S.prompt) return;
    try { S.prompt.fn(); } catch (e) { console.warn("[structures] action", e); }
  },

  toast(m) { try { this.S.ctx.toast(m); } catch (e) {} },

  update(dt, px, pz, mode) {
    const S = this.S; if (!S) return;
    dt = Math.min(dt, 0.1);
    S.t += dt; S.mode = mode;
    const w = S.walker;
    /* leaving walk mode / ragdoll while attached: put the player safely on the ground */
    if (S.lock && (mode !== "walk" || w.ragdoll)) { try { S.lock.abort(); } catch (e) {} S.lock = null; }

    for (const s of S.list) {
      const d = Math.hypot(s.x - px, s.z - pz);
      s.near = d;
      if (s.update && (d < s.range || s.busy)) s.update(dt, d);
    }

    /* labels */
    S.labelT -= dt;
    if (S.labelT <= 0) {
      S.labelT = 0.5;
      for (const s of S.list) if (s.label) {
        drawLabel(s.label, s.near);
        const k = clamp(s.near * 0.05, 9, 46);
        s.label.scale.set(k * 4.4, k, 1);
        s.label.visible = s.near > 25;
      }
    }

    /* contextual prompt */
    let pr = null;
    if (mode === "walk" && !S.lock && !w.ragdoll && !w.sitting) {
      for (const s of S.list) { if (s.near > 40 || !s.prompt) continue; pr = s.prompt(w); if (pr) break; }
    }
    if (!pr && S.lock && S.lock.prompt && mode === "walk") pr = S.lock.prompt();
    S.prompt = pr;
    if (S.btn) {
      if (pr) { S.btn.textContent = pr.text; S.btn.style.display = "flex"; } else S.btn.style.display = "none";
    }
  },

  /* called after the walker's own movement this frame: keeps a rider attached to a moving structure */
  enforce() {
    const S = this.S; if (!S) return;
    const w = S.walker, c = S.ctx.character;
    for (const s of S.list) if (s.clampWalker) s.clampWalker(w);
    const L = S.lock;
    if (L) {
      const p = L.pos();
      w.x = p.x; w.y = p.y; w.z = p.z; if (p.yaw != null) w.yaw = p.yaw;
      w.vy = 0; w.onGround = true;
      try { S.ctx.jet.on = false; } catch (e) {}
    }
    if (L || S.list.some((s) => s.clampWalker && s.clamped)) { c.position.set(w.x, w.y, w.z); c.rotation.y = w.yaw; }
  },

  dispose() {
    const S = this.S; if (!S) return;
    try { window.removeEventListener("keydown", S._key); } catch (e) {}
    try { if (S.btn) S.btn.remove(); } catch (e) {}
    for (const o of S.objs) { try { if (o.parent) o.parent.remove(o); } catch (e) {} }
    for (const l of S.lights) { try { if (l.parent) l.parent.remove(l); } catch (e) {} }
    S.geos.forEach((g) => { try { g.dispose(); } catch (e) {} });
    S.mats.forEach((m) => { try { m.dispose(); } catch (e) {} });
    S.texs.forEach((t) => { try { t.dispose(); } catch (e) {} });
    try { const cars = window.__ph3d_npc_cars; if (cars) cars.holdZones = []; } catch (e) {}
    this.S = null;
  },
};
if (typeof window !== "undefined") window.__ph3d_Structures = Structures;

/* shared bits */
function addSolid(S, x, z, hx, hz, h) {
  const b = { x, z, hx, hz, label: "struct", y1: h };
  S.ctx.aabbs.push(b);
  return b;
}
function addPlatform(S, x, z, hx, hz, top) {
  S.ctx.platforms.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, top });
}
function lockWalker(S, posFn, abort, prompt) { S.lock = { pos: posFn, abort: abort || (() => {}), prompt: prompt || null }; try { S.ctx.jet.on = false; } catch (e) {} }

/* ================================================================
   1) PEDESTRIAN CROSSING
   ================================================================ */
function buildCrossing(S, sp) {
  const { x, z, dx, dz, W } = sp;
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(dx, dz);
  S.ctx.scene.add(g); S.objs.push(g);
  const white = mat(S, 0xf2f2ee, { roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const steel = mat(S, 0x4a4f55, { metalness: 0.5, roughness: 0.5 });
  const dark = mat(S, 0x1a1c1f);
  const yellow = mat(S, 0xffc928, { roughness: 0.5 });
  const B = new Batch();
  for (let lx = -W / 2 + 0.7; lx <= W / 2 - 0.5; lx += 1.2) B.box(white, lx, 0.09, 0, 0.62, 0.02, 3.6);
  B.box(white, 0, 0.09, 3.7, W - 0.4, 0.02, 0.35);
  B.box(white, 0, 0.09, -3.7, W - 0.4, 0.02, 0.35);
  const poles = [];
  const lamps = [];
  for (const sx of [-1, 1]) {
    const lx = sx * (W / 2 + 1.4), lz = 2.6;
    B.cyl(steel, lx, 1.6, lz, 0.07, 0.09, 3.2, 8);
    B.box(dark, lx, 3.35, lz, 0.5, 0.95, 0.28);
    B.box(yellow, lx, 1.3, lz, 0.2, 0.28, 0.2);        /* push button box */
    const redM = basic(S, 0x551111), grnM = basic(S, 0x103a18);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.06), redM), grn = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.06), grnM);
    S.geos.push(red.geometry, grn.geometry);
    red.position.set(lx, 3.58, lz - 0.16); grn.position.set(lx, 3.14, lz - 0.16);
    red.rotation.y = grn.rotation.y = 0;
    g.add(red, grn);
    lamps.push({ redM, grnM });
    const wpos = new THREE.Vector3(lx, 0, lz); g.updateMatrixWorld(true); g.localToWorld(wpos);
    poles.push(wpos);
    addSolid(S, wpos.x, wpos.z, 0.25, 0.25, 3.4);
  }
  B.build(g, S);
  const zone = { x, z, r: 18, active: false };
  try { const cars = window.__ph3d_npc_cars; if (cars) (cars.holdZones = cars.holdZones || []).push(zone); } catch (e) {}
  const st = { id: "crossing", x, z, range: 150, busy: false, state: "idle", tt: 0, zone, label: makeLabel(S, "CROSSING", 7) };
  st.label.position.set(x, 7, z);
  const setLamps = (red, green) => {
    for (const l of lamps) { l.redM.color.setHex(red ? 0xff2a2a : 0x551111); l.grnM.color.setHex(green ? 0x33ff66 : 0x103a18); }
  };
  setLamps(true, false);
  st.update = (dt) => {
    st.tt += dt;
    if (st.state === "wait") { if (st.tt > 2) { st.state = "walk"; st.tt = 0; zone.active = true; setLamps(false, true); Structures.toast("\u{1F6B6} Cars are stopping \u00B7 cross now"); } }
    else if (st.state === "walk") { if (st.tt > 14) { st.state = "flash"; st.tt = 0; } }
    else if (st.state === "flash") {
      setLamps(false, Math.floor(st.tt * 3) % 2 === 0);
      if (st.tt > 4) { st.state = "idle"; st.tt = 0; zone.active = false; st.busy = false; setLamps(true, false); }
    }
  };
  st.prompt = (w) => {
    if (st.state !== "idle") return null;
    for (const p of poles) if (Math.hypot(w.x - p.x, w.z - p.z) < 3.2) return { text: "PRESS TO CROSS", fn: () => { st.state = "wait"; st.tt = 0; st.busy = true; Structures.toast("Wait for the green man\u2026"); } };
    return null;
  };
  return st;
}

/* ================================================================
   2) NETWORK MAST
   ================================================================ */
function buildMast(S, sp) {
  const cx = sp.x, cz = sp.z, TOPY = 30, H = 48;
  const g = new THREE.Group(); g.position.set(cx, 0, cz);
  S.ctx.scene.add(g); S.objs.push(g);
  const steel = mat(S, 0xc9ced4, { metalness: 0.55, roughness: 0.45 });
  const paintR = mat(S, 0xd9342b, { metalness: 0.3 });
  const grate = mat(S, 0x555b61, { metalness: 0.6, roughness: 0.6 });
  const conc = mat(S, 0x8d8d88, { metalness: 0 });
  const dark = mat(S, 0x23272b);
  const B = new Batch();
  const rho = (y) => 3.2 - 1.6 * (y / H);
  const ang = [Math.PI / 2, Math.PI / 2 + TAU / 3, Math.PI / 2 + 2 * TAU / 3];
  const pt = (i, y) => [Math.cos(ang[i % 3]) * rho(y), y, Math.sin(ang[i % 3]) * rho(y)];
  const STEP = 4;
  for (let y = 0; y < H; y += STEP) {
    const y2 = y + STEP, paint = (Math.floor(y / STEP) % 2 === 0) ? paintR : steel;
    for (let i = 0; i < 3; i++) {
      B.strut(paint, pt(i, y), pt(i, y2), 0.09);
      B.strut(steel, pt(i, y), pt(i + 1, y2), 0.045);
    }
    for (let i = 0; i < 3; i++) B.strut(steel, pt(i, y2), pt(i + 1, y2), 0.045);
  }
  for (let i = 0; i < 3; i++) B.strut(steel, pt(i, 0), pt(i + 1, 0), 0.05);
  /* ladder on the south face */
  const LZ = -4.1;
  B.box(grate, -0.27, TOPY / 2 + 0.6, LZ, 0.06, TOPY + 1.2, 0.06); B.box(grate, 0.27, TOPY / 2 + 0.6, LZ, 0.06, TOPY + 1.2, 0.06);
  for (let y = 0.4; y < TOPY + 1; y += 0.36) B.box(grate, 0, y, LZ, 0.54, 0.035, 0.035);
  for (let y = 4; y < TOPY; y += 5) B.strut(grate, [0, y, LZ], [0, y, -rho(y) * 0.5], 0.03);
  /* platform */
  B.box(grate, 0, TOPY - 0.12, 0, 8, 0.24, 8);
  const rail = (x0, z0, x1, z1) => {
    B.strut(grate, [x0, TOPY + 1.1, z0], [x1, TOPY + 1.1, z1], 0.035);
    B.strut(grate, [x0, TOPY + 0.55, z0], [x1, TOPY + 0.55, z1], 0.03);
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.5));
    for (let k = 0; k <= n; k++) { const t = k / n; B.strut(grate, [x0 + (x1 - x0) * t, TOPY, z0 + (z1 - z0) * t], [x0 + (x1 - x0) * t, TOPY + 1.1, z0 + (z1 - z0) * t], 0.03); }
  };
  rail(-4, 4, 4, 4); rail(-4, -4, 4, -4 + 0); rail(-4, -4, -4, 4); rail(4, -4, 4, 4);
  /* antennas + dishes */
  for (let i = 0; i < 3; i++) {
    const a = ang[i] + 0.5;
    B.box(steel, Math.cos(a) * 1.1, 44, Math.sin(a) * 1.1, 0.55, 2.4, 0.16, -a + Math.PI / 2);
    B.box(steel, Math.cos(a) * 1.3, 40.5, Math.sin(a) * 1.3, 0.55, 2.4, 0.16, -a + Math.PI / 2);
  }
  B.cyl(steel, 0, 47, 0, 0.05, 0.12, 2.6, 6);
  for (const [dy, da] of [[37, 0.4], [34, 2.6]]) {
    const dx = Math.cos(da) * (rho(dy) + 0.9), dz = Math.sin(da) * (rho(dy) + 0.9);
    B.cyl(steel, dx, dy, dz, 0.9, 0.9, 0.15, 14, Math.PI / 2, 0);
  }
  /* base cabin + fence post */
  B.box(conc, 7, 1.3, 2, 4, 2.6, 3); B.box(dark, 7, 1.0, 0.45, 1.0, 1.8, 0.05);
  B.box(grate, 0, 0.15, 0, 7.6, 0.3, 7.6);
  B.build(g, S);
  /* control cabinet on the deck */
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.3, 0.6), mat(S, 0x2d6cdf)); S.geos.push(cab.geometry);
  cab.position.set(0, TOPY + 0.65, 3.4); g.add(cab);
  const ledM = basic(S, 0x33ff66);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.05), ledM); S.geos.push(led.geometry); led.position.set(0.4, TOPY + 0.95, 3.08); g.add(led);
  const beaconM = basic(S, 0xff2200);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), beaconM); S.geos.push(beacon.geometry); beacon.position.set(0, 48.7, 0); g.add(beacon);
  const beacon2 = new THREE.Mesh(beacon.geometry, beaconM); beacon2.position.set(0, 24, -rho(24) * 0.5 - 0.15); g.add(beacon2);

  addSolid(S, cx + 7, cz + 2, 2.1, 1.6, 2.6);
  for (let i = 0; i < 3; i++) addSolid(S, cx + Math.cos(ang[i]) * 3.2, cz + Math.sin(ang[i]) * 3.2, 0.3, 0.3, TOPY - 0.3);
  addPlatform(S, cx, cz, 4, 4, TOPY);

  const st = { id: "mast", x: cx, z: cz, range: 300, busy: false, state: "ground", boosted: false, clamped: false, label: makeLabel(S, "NETWORK MAST", TOPY + 22) };
  st.label.position.set(cx, TOPY + 22, cz);
  const ladderBase = { x: cx, z: cz + LZ - 0.9 };
  const climb = (dir) => {
    const w = S.walker; let y = dir > 0 ? 0 : TOPY;
    st.state = dir > 0 ? "up" : "down"; st.busy = true;
    lockWalker(S, () => ({ x: cx, y, z: cz + LZ + 0.55, yaw: 0 }), () => { w.x = ladderBase.x; w.z = ladderBase.z; w.y = 0; st.state = "ground"; st.busy = false; });
    st._climb = { dir, get y() { return y; }, set y(v) { y = v; } };
  };
  st.update = (dt) => {
    beaconM.color.setHex(Math.floor(S.t * 1.2) % 2 === 0 ? 0xff2200 : 0x330800);
    ledM.color.setHex(st.boosted ? 0x33ff66 : (Math.floor(S.t * 2) % 2 ? 0xffaa22 : 0x553300));
    const c = st._climb;
    if ((st.state === "up" || st.state === "down") && c && S.lock) {
      c.y += c.dir * 2.6 * dt;
      if (c.dir > 0 && c.y >= TOPY) {
        const w = S.walker; S.lock = null; st._climb = null;
        w.x = cx; w.z = cz + LZ + 0.9; w.y = TOPY; w.yaw = 0; w.vy = 0; w.onGround = true;
        st.state = "top"; st.busy = false; Structures.toast("You are on top of the mast");
      } else if (c.dir < 0 && c.y <= 0) {
        const w = S.walker; S.lock = null; st._climb = null;
        w.x = ladderBase.x; w.z = ladderBase.z; w.y = 0; w.vy = 0; w.onGround = true;
        st.state = "ground"; st.busy = false;
      }
    }
  };
  st.clampWalker = (w) => {
    st.clamped = false;
    if (st.state !== "top" || S.lock) return;
    let dx = w.x - cx, dz = w.z - cz;
    if (Math.abs(dx) > 3.6) { dx = Math.sign(dx) * 3.6; st.clamped = true; }
    if (Math.abs(dz) > 3.6) { dz = Math.sign(dz) * 3.6; st.clamped = true; }
    const d = Math.hypot(dx, dz);
    if (d < 2.7) { const k = 2.7 / (d || 1e-6); if (d < 1e-4) { dz = -2.7; dx = 0; } else { dx *= k; dz *= k; } st.clamped = true; }
    w.x = cx + dx; w.z = cz + dz;
    if (w.y < TOPY - 1) st.state = "ground";
  };
  st.prompt = (w) => {
    if (st.state === "ground" && Math.hypot(w.x - ladderBase.x, w.z - ladderBase.z) < 2.6 && Math.abs(w.y) < 1) return { text: "CLIMB MAST", fn: () => climb(1) };
    if (st.state === "top" && w.y > TOPY - 0.5) {
      if (Math.hypot(w.x - cx, w.z - (cz + LZ + 0.9)) < 1.8) return { text: "CLIMB DOWN", fn: () => climb(-1) };
      if (!st.boosted && Math.hypot(w.x - cx, w.z - (cz + 3.0)) < 2.0) return { text: "BOOST SIGNAL", fn: () => {
        st.boosted = true; Structures.toast("\u{1F4F6} Network boosted \u00B7 full bars across the city");
        try { Economy.receive("Network Co.", 2000, "Mast maintenance"); Structures.toast("\u20A62,000 maintenance fee paid to you"); } catch (e) {}
      } };
    }
    return null;
  };
  return st;
}

/* ================================================================
   3) BASKET TOWER
   ================================================================ */
function buildTower(S, sp) {
  const cx = sp.x, cz = sp.z, TOPY = 30, BX = 5.4;
  const g = new THREE.Group(); g.position.set(cx, 0, cz);
  S.ctx.scene.add(g); S.objs.push(g);
  const steel = mat(S, 0x6f7b86, { metalness: 0.6, roughness: 0.5 });
  const paint = mat(S, 0x2f6fb3, { metalness: 0.3 });
  const iron = mat(S, 0x4a3226, { metalness: 0.5, roughness: 0.7 });
  const deck = mat(S, 0x3a3f44, { metalness: 0.5 });
  const B = new Batch();
  const h = 2.2;
  const corner = (i, y) => [(i & 1 ? h : -h), y, (i & 2 ? h : -h)];
  for (let y = 0; y < TOPY; y += 3) {
    for (let i = 0; i < 4; i++) B.strut(paint, corner(i, y), corner(i, y + 3), 0.12);
    const faces = [[0, 1], [1, 3], [3, 2], [2, 0]];
    for (const [a, b] of faces) {
      B.strut(steel, corner(a, y + 3), corner(b, y + 3), 0.05);
      B.strut(steel, corner(a, y), corner(b, y + 3), 0.04);
    }
  }
  B.box(deck, 0, TOPY - 0.12, 0, 8, 0.24, 8);
  const rail = (x0, z0, x1, z1) => {
    B.strut(steel, [x0, TOPY + 1.1, z0], [x1, TOPY + 1.1, z1], 0.04);
    B.strut(steel, [x0, TOPY + 0.55, z0], [x1, TOPY + 0.55, z1], 0.03);
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.4));
    for (let k = 0; k <= n; k++) { const t = k / n; B.strut(steel, [x0 + (x1 - x0) * t, TOPY, z0 + (z1 - z0) * t], [x0 + (x1 - x0) * t, TOPY + 1.1, z0 + (z1 - z0) * t], 0.03); }
  };
  rail(-4, 4, 4, 4); rail(-4, -4, 4, -4); rail(-4, -4, -4, 4); rail(4, -4, 4, -1.6); rail(4, 1.6, 4, 4);
  /* guide frame for the basket */
  for (const sz of [-1.55, 1.55]) {
    B.box(iron, BX, (TOPY + 4) / 2, sz, 0.22, TOPY + 4, 0.22);
    for (const y of [8, 16, 24]) B.strut(steel, [h, y, sz * 0.5], [BX, y, sz], 0.05);
  }
  B.box(iron, BX, TOPY + 4.1, 0, 0.3, 0.3, 3.4);
  B.box(steel, BX - 1.5, TOPY + 4.1, 0, 3.2, 0.2, 0.3);
  B.cyl(steel, BX, TOPY + 3.7, 0, 0.35, 0.35, 0.3, 14, Math.PI / 2, 0);
  /* little roof cabin on the deck */
  B.build(g, S);
  /* basket */
  const bask = new THREE.Group(); g.add(bask); bask.position.set(BX, 0, 0);
  const BB = new Batch();
  BB.box(deck, 0, -0.06, 0, 2.5, 0.12, 2.5);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) BB.box(iron, sx * 1.2, 1.1, sz * 1.2, 0.1, 2.2, 0.1);
  for (const y of [0.55, 1.1, 2.2]) { BB.box(iron, 0, y, 1.2, 2.4, 0.06, 0.06); BB.box(iron, 0, y, -1.2, 2.4, 0.06, 0.06); BB.box(iron, 1.2, y, 0, 0.06, 0.06, 2.4); BB.box(iron, -1.2, y, 0, 0.06, 0.06, 2.4); }
  for (let k = -0.9; k <= 0.95; k += 0.45) { BB.box(iron, k, 1.1, 1.2, 0.04, 2.2, 0.04); BB.box(iron, k, 1.1, -1.2, 0.04, 2.2, 0.04); BB.box(iron, 1.2, 1.1, k, 0.04, 2.2, 0.04); BB.box(iron, -1.2, 1.1, k, 0.04, 2.2, 0.04); }
  BB.strut(iron, [-1.2, 2.2, -1.2], [0, 2.9, 0], 0.03); BB.strut(iron, [1.2, 2.2, -1.2], [0, 2.9, 0], 0.03);
  BB.strut(iron, [-1.2, 2.2, 1.2], [0, 2.9, 0], 0.03); BB.strut(iron, [1.2, 2.2, 1.2], [0, 2.9, 0], 0.03);
  BB.build(bask, S);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), iron); S.geos.push(cable.geometry); g.add(cable);

  addSolid(S, cx, cz, 2.4, 2.4, TOPY + 1);
  for (const sz of [-1.55, 1.55]) addSolid(S, cx + BX, cz + sz, 0.2, 0.2, TOPY);
  addPlatform(S, cx, cz, 4, 4, TOPY);

  const st = { id: "tower", x: cx, z: cz, range: 300, busy: false, state: "ground", y: 0, clamped: false, label: makeLabel(S, "BASKET TOWER", TOPY + 12) };
  st.label.position.set(cx, TOPY + 12, cz);
  const place = () => {
    bask.position.y = st.y;
    const len = (TOPY + 3.7) - (st.y + 2.9);
    cable.scale.set(1, Math.max(0.01, len), 1); cable.position.set(BX, st.y + 2.9 + len / 2, 0);
  };
  place();
  const ride = (dir) => {
    st.state = dir > 0 ? "up" : "down"; st.busy = true;
    const w = S.walker;
    lockWalker(S, () => ({ x: cx + BX, y: st.y, z: cz, yaw: -Math.PI / 2 }), () => { w.x = cx + BX; w.z = cz + 3.4; w.y = 0; st.y = 0; place(); st.state = "ground"; st.busy = false; }, () => st.topPrompt());
    st._dir = dir;
  };
  st.update = (dt) => {
    if ((st.state === "up" || st.state === "down") && S.lock) {
      const speed = 3.0 * (0.35 + 0.65 * Math.min(1, Math.min(st.y, TOPY - st.y) / 4 + 0.1));
      st.y += st._dir * speed * dt;
      if (st._dir > 0 && st.y >= TOPY) { st.y = TOPY; st.state = "attop"; Structures.toast("Top of the tower"); }
      if (st._dir < 0 && st.y <= 0) {
        st.y = 0; const w = S.walker; S.lock = null; w.x = cx + BX; w.z = cz + 3.4; w.y = 0; w.vy = 0; w.onGround = true;
        st.state = "ground"; st.busy = false;
      }
      place();
    }
  };
  st.clampWalker = (w) => {
    st.clamped = false;
    if (st.state !== "deck" || S.lock) return;
    let dx = w.x - cx, dz = w.z - cz;
    dx = clamp(dx, -3.7, 3.95); dz = clamp(dz, -3.7, 3.7);
    if (Math.abs(dx) < 2.6 && Math.abs(dz) < 2.6) { if (Math.abs(dx) > Math.abs(dz)) dx = (dx >= 0 ? 1 : -1) * 2.6; else dz = (dz >= 0 ? 1 : -1) * 2.6; }
    if (dx !== w.x - cx || dz !== w.z - cz) st.clamped = true;
    w.x = cx + dx; w.z = cz + dz;
    if (w.y < TOPY - 1) st.state = "ground";
  };
  st.prompt = (w) => {
    if (st.state === "ground" && st.y < 0.5 && Math.hypot(w.x - (cx + BX), w.z - cz) < 3.2 && Math.abs(w.y) < 1) return { text: "ENTER BASKET", fn: () => ride(1) };
    if (st.state === "deck" && w.y > TOPY - 0.5 && Math.hypot(w.x - (cx + 3.5), w.z - cz) < 1.9) return { text: "RIDE DOWN", fn: () => { st.y = TOPY; place(); ride(-1); } };
    return null;
  };
  /* "get out" at the top uses a second prompt while still locked: handled by an extra hook */
  st.topPrompt = () => (st.state === "attop" ? { text: "GET OUT", fn: () => {
    const w = S.walker; S.lock = null; st.busy = false;
    w.x = cx + 3.2; w.z = cz; w.y = TOPY; w.vy = 0; w.onGround = true; w.yaw = Math.PI / 2;
    st.state = "deck";
  } } : null);
  return st;
}

/* ================================================================
   4) CRANE
   ================================================================ */
function buildCrane(S, sp) {
  const cx = sp.x, cz = sp.z, MH = 36, JL = 34, CJ = 12;
  const g = new THREE.Group(); g.position.set(cx, 0, cz);
  S.ctx.scene.add(g); S.objs.push(g);
  const yel = mat(S, 0xf0b811, { metalness: 0.35, roughness: 0.55 });
  const steel = mat(S, 0x777d83, { metalness: 0.6, roughness: 0.5 });
  const conc = mat(S, 0x9a9a95, { metalness: 0 });
  const glass = mat(S, 0x23323f, { metalness: 0.7, roughness: 0.2 });
  const wood = mat(S, 0x8b5e3c, { metalness: 0, roughness: 0.9 });
  const rope = mat(S, 0x222222, { metalness: 0.3 });
  const B = new Batch();
  const h = 1.3;
  const cor = (i, y) => [(i & 1 ? h : -h), y, (i & 2 ? h : -h)];
  for (let y = 0; y < MH; y += 3) {
    for (let i = 0; i < 4; i++) B.strut(yel, cor(i, y), cor(i, y + 3), 0.07);
    for (const [a, b] of [[0, 1], [1, 3], [3, 2], [2, 0]]) { B.strut(yel, cor(a, y + 3), cor(b, y + 3), 0.04); B.strut(yel, cor(a, y), cor(b, y + 3), 0.035); }
  }
  B.box(conc, 0, 0.5, 0, 6, 1, 6);
  B.build(g, S);
  const slew = new THREE.Group(); slew.position.set(0, MH, 0); g.add(slew);
  const J = new Batch();
  J.cyl(steel, 0, 0.3, 0, 1.5, 1.7, 0.6, 16);
  const topY = 2.3, botY = 0.25;
  J.strut(yel, [-CJ, botY, 0.8], [JL, botY, 0.8], 0.06); J.strut(yel, [-CJ, botY, -0.8], [JL, botY, -0.8], 0.06); J.strut(yel, [-CJ, topY, 0], [JL, topY, 0], 0.07);
  for (let x = -CJ; x < JL; x += 2) {
    J.strut(yel, [x, botY, 0.8], [x + 1, topY, 0], 0.03); J.strut(yel, [x + 1, topY, 0], [x + 2, botY, 0.8], 0.03);
    J.strut(yel, [x, botY, -0.8], [x + 1, topY, 0], 0.03); J.strut(yel, [x + 1, topY, 0], [x + 2, botY, -0.8], 0.03);
    J.strut(yel, [x, botY, 0.8], [x, botY, -0.8], 0.03);
  }
  J.strut(yel, [0, topY, 0], [0, 8.5, 0], 0.09);
  J.strut(steel, [0, 8.5, 0], [24, topY, 0], 0.03); J.strut(steel, [0, 8.5, 0], [-9, topY, 0], 0.03);
  for (let i = 0; i < 4; i++) J.box(conc, -CJ + 2 + i * 1.9, 1.1, 0, 1.7, 1.6, 2.2);
  J.box(yel, 2.4, 1.2, 1.9, 2.2, 2.2, 2.2); J.box(glass, 3.55, 1.5, 1.9, 0.05, 1.1, 1.7);
  J.build(slew, S);
  const tipM = basic(S, 0xff3300);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), tipM); S.geos.push(tip.geometry); tip.position.set(JL, 2.6, 0); slew.add(tip);
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.4), steel); S.geos.push(trolley.geometry); slew.add(trolley);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6), rope); S.geos.push(cable.geometry); slew.add(cable);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), steel); S.geos.push(hook.geometry); slew.add(hook);
  /* pallet (child of the slewing group, so it swings with the jib) */
  const pal = new THREE.Group(); slew.add(pal);
  const P = new Batch();
  P.box(wood, 0, 0.1, 0, 3.2, 0.2, 3.2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.strut(steel, [sx * 1.5, 0.2, sz * 1.5], [0, 4.2, 0], 0.025);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(wood, sx * 1.35, 0.5, sz * 1.35, 0.1, 0.6, 0.1);
  P.build(pal, S);
  addSolid(S, cx, cz, 3, 3, MH);

  const A = { th: 0.0, r: 13 }, Bp = { th: 1.9, r: 26 };
  const st = { id: "crane", x: cx, z: cz, range: 300, busy: false, at: "A", th: A.th, r: A.r, loadY: 0, trip: null, idleT: 0, label: makeLabel(S, "CRANE", MH + 14) };
  st.label.position.set(cx, MH + 14, cz);
  const tmp = new THREE.Vector3();
  const apply = () => {
    slew.rotation.y = st.th;
    trolley.position.set(st.r, -0.3, 0);
    const hy = st.loadY + 4.5 - MH;
    hook.position.set(st.r, hy, 0);
    const top = -0.3, len = top - (hy + 0.3);
    cable.scale.set(1, Math.max(0.01, len), 1); cable.position.set(st.r, top - len / 2, 0);
    pal.position.set(st.r, st.loadY - MH, 0);
    pal.rotation.y = 0;
    slew.updateMatrixWorld(true);
  };
  apply();
  const palWorld = () => { tmp.set(st.r, 0, 0); slew.localToWorld(tmp); return { x: tmp.x, z: tmp.z }; };
  const startTrip = (from, withPlayer) => {
    const a = from === "A" ? A : Bp, b = from === "A" ? Bp : A;
    st.trip = { a, b, t: 0, from, rider: withPlayer }; st.busy = true; st.at = "moving";
    if (withPlayer) {
      const w = S.walker;
      lockWalker(S, () => { const p = palWorld(); return { x: p.x, y: st.loadY + 0.2, z: p.z, yaw: st.th }; },
        () => { const p = palWorld(); w.x = p.x + 2.4; w.z = p.z; w.y = 0; st.trip = null; st.busy = false; st.at = from === "A" ? "A" : "B"; st.loadY = 0; apply(); });
    }
  };
  st.update = (dt) => {
    tipM.color.setHex(Math.floor(S.t * 1.5) % 2 === 0 ? 0xff3300 : 0x330a00);
    const T = st.trip;
    if (T) {
      T.t += dt;
      const t = T.t, tl = 4.5, ts = 9, td = 4.5;
      if (t < tl) st.loadY = 20 * sstep(t / tl);
      else if (t < tl + ts) { const k = sstep((t - tl) / ts); st.loadY = 20; st.th = T.a.th + (T.b.th - T.a.th) * k; st.r = T.a.r + (T.b.r - T.a.r) * k; }
      else if (t < tl + ts + td) { st.loadY = 20 * (1 - sstep((t - tl - ts) / td)); st.th = T.b.th; st.r = T.b.r; }
      else {
        st.loadY = 0; st.th = T.b.th; st.r = T.b.r;
        st.at = T.from === "A" ? "B" : "A"; st.trip = null; st.idleT = 0;
        if (T.rider && S.lock) {
          const w = S.walker, p = palWorld(); S.lock = null;
          w.x = p.x; w.z = p.z; w.y = 0.2; w.vy = 0; w.onGround = true;
          Structures.toast("Ground level \u00B7 step off");
        }
        st.busy = false;
      }
      apply();
    } else if (st.at === "B") {
      /* nobody riding: the empty load goes back by itself after a while */
      const p = palWorld(), w = S.walker;
      if (Math.hypot(w.x - p.x, w.z - p.z) > 6) { st.idleT += dt; if (st.idleT > 12) startTrip("B", false); } else st.idleT = 0;
    }
  };
  st.prompt = (w) => {
    if (st.trip || (st.at !== "A" && st.at !== "B")) return null;
    const p = palWorld();
    if (Math.hypot(w.x - p.x, w.z - p.z) < 2.9 && Math.abs(w.y) < 1) return { text: st.at === "A" ? "RIDE CRANE" : "RIDE BACK", fn: () => startTrip(st.at, true) };
    return null;
  };
  return st;
}

/* ================================================================
   5) CAVE
   ================================================================ */
function buildCave(S, sp) {
  const cx = sp.x, cz = sp.z;
  const k = Math.floor(fract(Math.sin(cx * 0.013 + cz * 0.007) * 9731.7) * 4);
  const cg = new THREE.Group(); cg.position.set(cx, 0, cz); cg.rotation.y = k * Math.PI / 2;
  S.ctx.scene.add(cg); S.objs.push(cg); cg.updateMatrixWorld(true);
  const rock = mat(S, 0x6a625a, { flatShading: true, roughness: 0.95, metalness: 0 });
  const rockD = mat(S, 0x3d3833, { flatShading: true, roughness: 0.95, metalness: 0 });
  const floorM = mat(S, 0x2c2824, { roughness: 1, metalness: 0 });
  const wood = mat(S, 0x7a4f2c, { metalness: 0.1 });
  const gold = mat(S, 0xffc928, { metalness: 0.8, roughness: 0.3, emissive: 0x553300 });
  const crysC = basic(S, 0x62f0ff), crysV = basic(S, 0xb577ff);
  const flameM = basic(S, 0xffaa33);
  const waterM = basic(S, 0x1b5a8a, { transparent: true, opacity: 0.7 });
  const B = new Batch();
  let seed = 1; const rnd = () => fract(Math.sin(seed++ * 91.345 + cx * 0.1) * 43758.5453);
  /* floors + slabs */
  B.box(floorM, 0, 0.02, 12.5, 6, 0.06, 27); B.box(floorM, 0, 0.02, 36.5, 18, 0.06, 22);
  B.box(rockD, 0, 5.75, 12.5, 18, 1.5, 27); B.box(rockD, 0, 8.75, 40, 32, 1.5, 28);
  /* thick walls (visual) */
  B.box(rockD, -6, 3, 12, 6, 6, 27); B.box(rockD, 6, 3, 12, 6, 6, 27);
  B.box(rockD, -12.5, 4.5, 39, 7, 9, 30); B.box(rockD, 12.5, 4.5, 39, 7, 9, 30); B.box(rockD, 0, 4.5, 50.5, 32, 9, 7);
  /* rough interior + exterior lumps */
  for (let z = 0; z < 26; z += 2.3) for (const s of [-1, 1]) {
    B.lump(rock, s * (3.1 + rnd() * 0.5), 1.4 + rnd() * 2.8, z + rnd(), 1.1 + rnd() * 0.9, 1.3 + rnd() * 1.3, 1.4 + rnd() * 0.8, seed);
    B.lump(rock, s * (6 + rnd() * 2), 2 + rnd() * 4, z + rnd(), 2.6 + rnd() * 1.4, 2.4 + rnd() * 2, 2.4 + rnd(), seed);
  }
  for (let z = 26; z < 49; z += 2.6) for (const s of [-1, 1]) {
    B.lump(rock, s * (8.7 - rnd() * 0.5), 1.8 + rnd() * 4.5, z + rnd(), 1.2 + rnd(), 1.6 + rnd() * 1.6, 1.6 + rnd(), seed);
    B.lump(rock, s * (13 + rnd() * 2), 2 + rnd() * 5, z + rnd(), 3 + rnd() * 1.5, 3 + rnd() * 2.2, 3 + rnd(), seed);
  }
  for (let x = -8; x <= 8; x += 2.6) B.lump(rock, x, 3.8 + rnd() * 1.2, 47 + rnd(), 1.6 + rnd(), 3 + rnd() * 1.5, 1.6 + rnd(), seed);
  for (let z = 1; z < 26; z += 2.8) for (let x = -3; x <= 3; x += 3) B.lump(rockD, x + rnd(), 5.2 + rnd() * 0.7, z, 1.8 + rnd(), 0.9 + rnd() * 0.6, 1.8 + rnd(), seed);
  for (let z = 27; z < 48; z += 3.6) for (let x = -8; x <= 8; x += 4) B.lump(rockD, x + rnd() * 1.5, 8 + rnd() * 0.7, z, 2.4 + rnd(), 1.2 + rnd() * 0.7, 2.4 + rnd(), seed);
  /* the mound on top */
  for (let z = -1; z < 26; z += 4) B.lump(rock, (rnd() - 0.5) * 6, 7 + rnd() * 2, z + 1, 5 + rnd() * 2, 2.6 + rnd() * 1.6, 3.6 + rnd() * 1.4, seed);
  for (let z = 26; z < 52; z += 5) for (let x = -11; x <= 11; x += 7) B.lump(rock, x + (rnd() - 0.5) * 3, 9.5 + rnd() * 2.4, z + rnd() * 2, 5.5 + rnd() * 2, 3.2 + rnd() * 2, 4.5 + rnd() * 2, seed);
  /* entrance arch */
  B.lump(rock, -4.4, 2.6, -0.4, 2.2, 3.1, 2.4, 7); B.lump(rock, 4.4, 2.6, -0.4, 2.2, 3.1, 2.4, 8); B.lump(rock, 0, 5.4, -0.2, 4.4, 1.5, 2.2, 9);
  B.lump(rock, -7.5, 1.4, -2.6, 2.4, 1.6, 2, 11); B.lump(rock, 7.8, 1.2, -3, 2.2, 1.4, 2.2, 12); B.lump(rock, 3, 0.8, -4.2, 1.3, 0.9, 1.2, 13);
  /* stalactites + stalagmites */
  for (let i = 0; i < 26; i++) {
    const inCh = i % 3 !== 0, x = inCh ? (rnd() - 0.5) * 15 : (rnd() - 0.5) * 4.4, z = inCh ? 27 + rnd() * 19 : 2 + rnd() * 22, top = inCh ? 8 : 5, len = 0.8 + rnd() * 1.6;
    B.cyl(rock, x, top - len / 2, z, 0.34 + rnd() * 0.2, 0.02, len, 5);
  }
  for (let i = 0; i < 12; i++) { const x = (rnd() - 0.5) * 15, z = 28 + rnd() * 17, len = 0.5 + rnd() * 1.2; B.cyl(rock, x, len / 2, z, 0.02, 0.3 + rnd() * 0.2, len, 5); }
  /* crystals */
  for (let i = 0; i < 16; i++) {
    const m = i % 2 ? crysC : crysV, side = i % 4 < 2 ? -1 : 1;
    const x = side * (8.3 + rnd() * 0.3), z = 28 + rnd() * 18, y = 0.5 + rnd() * 2.2;
    B.cyl(m, x, y, z, 0.0, 0.2 + rnd() * 0.12, 0.9 + rnd() * 0.8, 5, 0, side * 0.5);
  }
  for (let i = 0; i < 6; i++) B.cyl(i % 2 ? crysC : crysV, (rnd() - 0.5) * 3, 0.5, 42 + rnd() * 4, 0, 0.22, 1.0 + rnd() * 0.6, 5, 0, (rnd() - 0.5) * 0.5);
  /* torches along the corridor */
  const flames = [];
  for (const [tx, tz] of [[-2.7, 6], [2.7, 11], [-2.7, 17], [2.7, 22]]) {
    B.cyl(wood, tx, 1.7, tz, 0.05, 0.07, 1.0, 6);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), flameM); S.geos.push(f.geometry); f.position.set(tx, 2.3, tz); cg.add(f); flames.push(f);
  }
  /* wet patch */
  const pool = new THREE.Mesh(new THREE.CircleGeometry(2.4, 20), waterM); S.geos.push(pool.geometry);
  pool.rotation.x = -Math.PI / 2; pool.position.set(-4.2, 0.07, 38); cg.add(pool);
  B.build(cg, S);

  /* chest */
  const chest = new THREE.Group(); chest.position.set(0, 0, 44.6); cg.add(chest);
  const CB = new Batch();
  CB.box(wood, 0, 0.4, 0, 1.4, 0.8, 0.9); CB.box(gold, 0, 0.5, 0.46, 1.42, 0.12, 0.05); CB.box(gold, 0.0, 0.62, 0.46, 0.16, 0.2, 0.06);
  CB.build(chest, S);
  const lid = new THREE.Group(); lid.position.set(0, 0.8, -0.45); chest.add(lid);
  const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.9), wood); S.geos.push(lidMesh.geometry);
  lidMesh.position.set(0, 0.11, 0.45); lid.add(lidMesh);
  const coins = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.7), gold); S.geos.push(coins.geometry); coins.position.set(0, 0.78, 0); coins.visible = false; chest.add(coins);

  /* bats */
  const batM = mat(S, 0x15110f, { roughness: 1, metalness: 0 });
  const bats = [];
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Group();
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 0.2), batM); S.geos.push(wing.geometry);
    const wl = wing.clone(), wr = wing.clone(); wl.position.x = -0.28; wr.position.x = 0.28; b.add(wl, wr);
    b.userData = { a: rnd() * TAU, r: 2.5 + rnd() * 5, y: 6.2 + rnd() * 1.3, sp: 0.8 + rnd() * 0.9, wl, wr };
    cg.add(b); bats.push(b);
  }
  /* lights: only two, and only on when you are close */
  const lc = new THREE.PointLight(0x66e6ff, 0, 26, 2); lc.position.set(0, 6, 38); cg.add(lc);
  const lt = new THREE.PointLight(0xffa03a, 0, 20, 2); lt.position.set(0, 3.2, 11); cg.add(lt);
  S.lights.push(lc, lt);

  /* collision: thick solid rock around the passage (axis-aligned in world space) */
  const rect = (x0, x1, z0, z1) => {
    const ps = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([a, b]) => cg.localToWorld(new THREE.Vector3(a, 0, b)));
    const minX = Math.min(...ps.map((p) => p.x)), maxX = Math.max(...ps.map((p) => p.x)), minZ = Math.min(...ps.map((p) => p.z)), maxZ = Math.max(...ps.map((p) => p.z));
    addSolid(S, (minX + maxX) / 2, (minZ + maxZ) / 2, (maxX - minX) / 2, (maxZ - minZ) / 2, 14);
  };
  rect(-9, -3, -1, 26); rect(3, 9, -1, 26);
  rect(-16, -9, 24, 54); rect(9, 16, 24, 54); rect(-16, 16, 47, 54);

  const st = { id: "cave", x: cx, z: cz, range: 220, busy: false, opened: false, lidT: 0, entered: false, label: makeLabel(S, "CAVE", 20) };
  const entr = cg.localToWorld(new THREE.Vector3(0, 0, -4));
  st.label.position.set(entr.x, 14, entr.z);
  st.x = entr.x; st.z = entr.z;
  const chestW = cg.localToWorld(new THREE.Vector3(0, 0, 43.2));
  const loc = new THREE.Vector3();
  st.update = (dt, d) => {
    const w = S.walker; loc.set(w.x, w.y, w.z); cg.worldToLocal(loc);
    const inside = loc.z > 1 && loc.z < 48 && Math.abs(loc.x) < 10;
    if (inside && !st.entered) { st.entered = true; Structures.toast("\u{1F987} The cave is dark and damp\u2026 watch your step"); }
    if (!inside && loc.z < -3) st.entered = false;
    const near = Math.hypot(w.x - cx, w.z - cz) < 90;
    lc.intensity = near ? 2.6 + Math.sin(S.t * 1.7) * 0.4 : 0; lt.intensity = near ? 2.2 + Math.sin(S.t * 9) * 0.35 : 0;
    for (let i = 0; i < flames.length; i++) { const f = flames[i], s = 0.85 + 0.3 * Math.sin(S.t * 11 + i * 2.1); f.scale.set(s, 1.1 * s, s); }
    for (const b of bats) {
      const u = b.userData; u.a += dt * u.sp;
      b.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(u.a * 2) * 0.25, 38 + Math.sin(u.a) * u.r * 0.9);
      b.rotation.y = -u.a + Math.PI / 2;
      const fl = Math.sin(S.t * 18 + u.a * 3) * 0.7; u.wl.rotation.z = fl; u.wr.rotation.z = -fl;
    }
    if (st.opened && st.lidT < 1) { st.lidT = Math.min(1, st.lidT + dt * 1.4); lid.rotation.x = -sstep(st.lidT) * 1.9; }
  };
  st.prompt = (w) => {
    if (st.opened) return null;
    if (Math.hypot(w.x - chestW.x, w.z - chestW.z) < 2.6 && Math.abs(w.y) < 1) return { text: "OPEN CHEST", fn: () => {
      st.opened = true; coins.visible = true;
      try { Economy.receive("Cave treasure", 5000, "Found in the cave"); } catch (e) {}
      Structures.toast("\u{1F4B0} Treasure! \u20A65,000 added to your wallet");
    } };
    return null;
  };
  return st;
}
