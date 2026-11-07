/* market/interior.js -- Mile 1 Market. Interior shop floor in THIRD
   PERSON. Same layout as the standalone HTML reference (5 rows x 13
   stalls, flanking shops, keke/danfo, produce, sacks, tarps, market
   gate sign), but every character has been stripped out — the market
   is empty of people. Walking is handled by the shared
   ThirdPersonControls so the character is visible and collides with
   the stalls, buildings and vehicles. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import meta from "./meta.js";

/* ══════════════════════════════════════════════════════════
   0.  SEEDED RANDOM (deterministic layout)
   ══════════════════════════════════════════════════════════ */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(90210);
const R = (a, b) => a + rnd() * (b - a);
const RI = (a, b) => Math.floor(R(a, b + 1));
const pick = (a) => a[(rnd() * a.length) | 0];

/* ══════════════════════════════════════════════════════════
   1.  PALETTE
   ══════════════════════════════════════════════════════════ */
const TARP = [0xd63b2f, 0x2f7fd6, 0x2fa85f, 0xe8b100, 0xeeeee8, 0xe8761f, 0x8e44ad, 0x17a2a2, 0xd94f8a];
const WOOD = 0xa8743f, WOOD_D = 0x6d4a28, WOOD_L = 0xc79a5e;
const PRODUCE = [0xd0342c, 0xe8912a, 0x2e8b57, 0xb07a3a, 0xd4c22a, 0x8e44ad, 0xc0392b];
const SACKC = [0xd9cfb8, 0xc9bda0, 0xe0d8c4, 0xbfb59c];

/* ══════════════════════════════════════════════════════════
   2.  TEXTURES
   ══════════════════════════════════════════════════════════ */
function noiseTex(size, base, spread, repeat, tint) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d");
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = base + (Math.random() - 0.5) * spread;
    img.data[i * 4]     = v * tint[0];
    img.data[i * 4 + 1] = v * tint[1];
    img.data[i * 4 + 2] = v * tint[2];
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function windowTex() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const g = cv.getContext("2d");
  g.fillStyle = "#cfc7b6"; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      g.fillStyle = (x + y) % 3 === 0 ? "#33424f" : "#6d7c88";
      g.fillRect(5 + x * 15, 7 + y * 14, 9, 9);
    }
  }
  g.fillStyle = "rgba(0,0,0,.12)";
  for (let y = 0; y < 4; y++) g.fillRect(0, 20 + y * 14, 64, 2);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

function signTex() {
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 128;
  const g = cv.getContext("2d");
  g.fillStyle = "#12345c"; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = "#f2c94c"; g.lineWidth = 7; g.strokeRect(9, 9, 494, 110);
  g.fillStyle = "#f2c94c";
  g.font = "bold 58px system-ui, sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("MILE 1 MARKET", 256, 60);
  g.fillStyle = "#8fb8d8"; g.font = "bold 20px system-ui, sans-serif";
  g.fillText("PORTHARCOURT", 256, 100);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.x = -1;
  return t;
}

/* ══════════════════════════════════════════════════════════
   3.  PUBLIC ENTRY POINT
   ══════════════════════════════════════════════════════════ */
export async function buildInterior(router) {
  const SKY = 0xa8c4d8;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 46, 150);

  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 300);
  camera.rotation.order = "YXZ";

  scene.add(new THREE.HemisphereLight(0xdcecff, 0x9a8055, 1.75));
  const sun = new THREE.DirectionalLight(0xfff2d5, 2.10);
  sun.position.set(55, 85, 45);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x9fc0e8, 0.60);
  fill.position.set(-50, 35, -60);
  scene.add(fill);

  /* ── Instanced batch system ─────────────────────────────── */
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(),
        _e = new THREE.Euler(), _v = new THREE.Vector3(),
        _s = new THREE.Vector3(), _c = new THREE.Color();

  class Batch {
    constructor(geo, mat) { this.geo = geo; this.mat = mat; this.M = []; this.C = []; }
    add(x, y, z, w, h, d, color, rx, ry, rz) {
      rx = rx || 0; ry = ry || 0; rz = rz || 0;
      _e.set(rx, ry, rz, "YXZ"); _q.setFromEuler(_e);
      _v.set(x, y, z); _s.set(w, h, d);
      _m.compose(_v, _q, _s);
      const el = _m.elements;
      for (let i = 0; i < 16; i++) this.M.push(el[i]);
      _c.set(color);
      this.C.push(_c.r, _c.g, _c.b);
    }
    finish() {
      const n = this.C.length / 3;
      if (!n) return null;
      const im = new THREE.InstancedMesh(this.geo, this.mat, n);
      im.instanceMatrix.array.set(this.M);
      im.instanceMatrix.needsUpdate = true;
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.C), 3);
      im.instanceColor.needsUpdate = true;
      im.frustumCulled = false;
      im.matrixAutoUpdate = false;
      scene.add(im);
      return im;
    }
  }

  const GEO = {
    box:  new THREE.BoxGeometry(1, 1, 1),
    cyl:  new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1),
    cone: new THREE.ConeGeometry(0.5, 1, 8, 1),
    sph:  new THREE.SphereGeometry(0.5, 6, 4),
  };
  const MAT = new THREE.MeshLambertMaterial({ color: 0xffffff });

  const BX = new Batch(GEO.box, MAT);
  const CY = new Batch(GEO.cyl, MAT);
  const CN = new Batch(GEO.cone, MAT);
  const SP = new Batch(GEO.sph, MAT);

  const box  = (x, y, z, w, h, d, c, rx, ry, rz) => BX.add(x, y, z, w, h, d, c, rx, ry, rz);
  const cyl  = (x, y, z, r, h, c, rx, ry, rz) => CY.add(x, y, z, r * 2, h, r * 2, c, rx, ry, rz);
  const cone = (x, y, z, r, h, c, rx, ry, rz) => CN.add(x, y, z, r * 2, h, r * 2, c, rx, ry, rz);
  const sph  = (x, y, z, r, c) => SP.add(x, y, z, r * 2, r * 2, r * 2, c, 0, 0, 0);

  function placer(cx, cz, ry) {
    const c = Math.cos(ry), s = Math.sin(ry);
    const P = (lx, lz) => [cx + lx * c - lz * s, cz + lx * s + lz * c];
    return {
      box(lx, ly, lz, w, h, d, col, rx, rz) { const p = P(lx, lz); box(p[0], ly, p[1], w, h, d, col, rx, ry, rz); },
      cyl(lx, ly, lz, r, h, col, rx, rz) { const p = P(lx, lz); cyl(p[0], ly, p[1], r, h, col, rx, ry, rz); },
      cone(lx, ly, lz, r, h, col, rx, rz) { const p = P(lx, lz); cone(p[0], ly, p[1], r, h, col, rx, ry, rz); },
      sph(lx, ly, lz, r, col) { const p = P(lx, lz); sph(p[0], ly, p[1], r, col); },
    };
  }

  /* ── Ground, road, sidewalk ─────────────────────────────── */
  function plane(w, h, mat, x, y, z, rx) {
    if (rx === undefined) rx = -Math.PI / 2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.rotation.x = rx; m.position.set(x, y, z);
    scene.add(m); return m;
  }

  const groundMat = new THREE.MeshLambertMaterial({ map: noiseTex(32, 152, 46, 70, [1, 0.93, 0.79]) });
  plane(600, 600, groundMat, 0, 0, 0);

  const floorMat = new THREE.MeshLambertMaterial({
    map: noiseTex(32, 160, 34, 26, [1, 0.94, 0.84]),
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  plane(132, 64, floorMat, 0, 0.02, 16);

  const roadMat = new THREE.MeshLambertMaterial({
    map: noiseTex(32, 62, 22, 55, [1, 1, 1.08]),
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  plane(600, 18, roadMat, 0, 0.03, -23);

  for (let x = -140; x <= 140; x += 9) box(x, 0.05, -23, 2.4, 0.02, 0.20, 0xd9d9bc);
  for (let i = 0; i < 14; i++) {
    const px = R(-70, 70), pz = R(-30, -16);
    box(px, 0.045, pz, R(1.5, 4), 0.02, R(1, 2.4), 0x515966);
  }
  box(0, 0.14, -13.4, 600, 0.28, 0.7, 0xb3a998);
  box(0, 0.05, -14.1, 600, 0.06, 0.9, 0x2b2b2b);

  /* ── Collision registry ─────────────────────────────────── */
  const colliders = [];
  function addCollider(cx, cz, r) {
    colliders.push({
      minX: cx - r, maxX: cx + r,
      minZ: cz - r, maxZ: cz + r,
      y0: 0, y1: 3, level: 0,
    });
  }

  /* ── Buildings ──────────────────────────────────────────── */
  const BD = new Batch(GEO.box, new THREE.MeshLambertMaterial({ map: windowTex() }));
  const BCOLS = [0xd8cec0, 0xcbbba4, 0xbfae96, 0xe2dacb, 0xb9a992, 0xd2c3ae];

  function addBuilding(x, z, w, d, h) {
    BD.add(x, h / 2, z, w, h, d, pick(BCOLS), 0, 0, 0);
    addCollider(x, z, Math.max(w, d) * 0.52);
    box(x, h + 0.2, z, w + 0.5, 0.4, d + 0.5, 0x8a7f70);
    box(x, 2.6, z + d / 2 + 0.4, w * 0.9, 0.12, 1.2, pick(TARP));
  }

  for (let x = -62; x <= 62; x += R(11, 16)) {
    addBuilding(x + R(-1, 1), 54 + R(-3, 6), R(9, 15), R(8, 12), R(7, 15));
  }
  for (let x = -70; x <= 70; x += R(12, 17)) {
    addBuilding(x + R(-1, 1), -46 + R(-4, 4), R(9, 16), R(9, 13), R(6, 14));
  }
  for (let z = -12; z <= 46; z += R(12, 16)) {
    addBuilding(-58 + R(-3, 3), z, R(10, 14), R(9, 13), R(6, 13));
    addBuilding( 58 + R(-3, 3), z, R(10, 14), R(9, 13), R(6, 13));
  }

  /* ── Stalls (no people) ─────────────────────────────────── */
  function goodsOnTable(p, topY, count) {
    for (let i = 0; i < count; i++) {
      const lx = (i - (count - 1) / 2) * 0.62;
      const pc = pick(PRODUCE);
      p.box(lx, topY + 0.10, 0, 0.52, 0.18, 0.44, WOOD_L);
      p.sph(lx - 0.11, topY + 0.26, 0.03, 0.11, pc);
      p.sph(lx + 0.11, topY + 0.26, -0.04, 0.11, pick(PRODUCE));
      p.sph(lx, topY + 0.28, 0.06, 0.10, pick(PRODUCE));
    }
  }

  function stallTable(cx, cz, ry) {
    const p = placer(cx, cz, ry);
    const W = 2.6, D = 1.6, TH = 0.85;
    const tarp = pick(TARP);

    p.box(-W / 2 + 0.12, TH / 2, -D / 2 + 0.12, 0.12, TH, 0.12, WOOD_D);
    p.box( W / 2 - 0.12, TH / 2, -D / 2 + 0.12, 0.12, TH, 0.12, WOOD_D);
    p.box(-W / 2 + 0.12, TH / 2,  D / 2 - 0.12, 0.12, TH, 0.12, WOOD_D);
    p.box( W / 2 - 0.12, TH / 2,  D / 2 - 0.12, 0.12, TH, 0.12, WOOD_D);
    p.box(0, TH + 0.06, 0, W, 0.12, D, WOOD);
    p.box(0, TH - 0.28, D / 2 - 0.02, W, 0.52, 0.06, tarp);
    p.box(-W / 2 + 0.06, 1.42, -D / 2 + 0.06, 0.08, 2.84, 0.08, WOOD_D);
    p.box( W / 2 - 0.06, 1.42, -D / 2 + 0.06, 0.08, 2.84, 0.08, WOOD_D);
    p.box(-W / 2 + 0.06, 1.42,  D / 2 - 0.06, 0.08, 2.84, 0.08, WOOD_D);
    p.box( W / 2 - 0.06, 1.42,  D / 2 - 0.06, 0.08, 2.84, 0.08, WOOD_D);
    p.box(0, 2.88, 0, W + 0.9, 0.07, D + 0.9, tarp, 0.07, 0);

    goodsOnTable(p, TH + 0.12, 3);
    addCollider(cx, cz, 1.55);
  }

  function stallUmbrella(cx, cz, ry) {
    const p = placer(cx, cz, ry);
    const tarp = pick(TARP);
    p.cyl(0, 1.25, 0, 0.045, 2.5, 0x9aa0a6);
    p.cone(0, 2.48, 0, 1.45, 0.62, tarp);
    p.box(0, 0.42, 0, 1.5, 0.10, 1.0, WOOD);
    p.box(-0.62, 0.21, 0, 0.08, 0.42, 0.08, WOOD_D);
    p.box( 0.62, 0.21, 0, 0.08, 0.42, 0.08, WOOD_D);
    goodsOnTable(p, 0.47, 2);

    for (let i = 0; i < 2; i++) {
      const bx = R(-1.1, 1.1), bz = R(0.9, 1.6);
      p.cyl(bx, 0.18, bz, 0.32, 0.36, 0xb08a5a);
      p.sph(bx, 0.40, bz, 0.26, pick(PRODUCE));
    }
    addCollider(cx, cz, 1.35);
  }

  function stallKiosk(cx, cz, ry) {
    const p = placer(cx, cz, ry);
    const W = 2.4, D = 2.0, H = 2.1;
    const tarp = pick(TARP);
    p.box(0, H / 2, 0, W, H, D, WOOD);
    p.box(0, H + 0.12, 0, W + 0.55, 0.16, D + 0.55, tarp, 0.05, 0);
    p.box(0, H * 0.63, D / 2 + 0.02, 1.45, 0.92, 0.06, 0x1c1c1c);
    p.box(0, 1.12, D / 2 + 0.08, 1.65, 0.09, 0.38, WOOD_L);
    for (let i = 0; i < 3; i++) {
      const lx = -0.55 + i * 0.55;
      p.box(lx, 1.26, D / 2 + 0.08, 0.4, 0.22, 0.3, pick([0xd0342c, 0x2e8b57, 0xe8912a, 0x2980b9]));
    }
    p.box(0, H + 0.30, D / 2, W + 0.55, 0.10, 0.12, WOOD_D);
    addCollider(cx, cz, 1.7);
  }

  function stallGround(cx, cz, ry) {
    const p = placer(cx, cz, ry);
    const tarp = pick(TARP);
    p.box(0, 0.035, 0, 2.6, 0.06, 1.9, tarp);
    for (let i = 0; i < 4; i++) {
      const lx = (i % 2 ? 0.65 : -0.65);
      const lz = (i < 2 ? -0.45 : 0.45);
      p.cyl(lx, 0.20, lz, 0.30, 0.34, 0xb08a5a);
      p.sph(lx, 0.42, lz, 0.25, pick(PRODUCE));
    }
    addCollider(cx, cz, 1.4);
  }

  const ROWS = [-6, 4, 14, 24, 34];
  for (let r = 0; r < ROWS.length; r++) {
    for (let c = 0; c < 13; c++) {
      const cx = -36 + c * 6;
      const cz = ROWS[r];
      const ry = (rnd() < 0.5 ? 0 : Math.PI) + R(-0.09, 0.09);
      const t = rnd();
      if (t < 0.05) continue;
      else if (t < 0.50) stallTable(cx, cz, ry);
      else if (t < 0.70) stallUmbrella(cx, cz, ry);
      else if (t < 0.86) stallKiosk(cx, cz, ry);
      else stallGround(cx, cz, ry);
    }
  }

  /* ── Props ──────────────────────────────────────────────── */
  for (let i = 0; i < 30; i++) {
    const a = RI(0, ROWS.length - 1);
    const px = R(-38, 38);
    const pz = ROWS[a] + R(1.9, 2.6) * (rnd() < 0.5 ? 1 : -1);
    const n = RI(2, 4);
    for (let j = 0; j < n; j++) cyl(px + R(-0.5, 0.5), 0.4, pz + R(-0.4, 0.4), 0.30, 0.8, pick(SACKC));
  }
  for (let i = 0; i < 20; i++) {
    const x = R(-40, 40), z = R(-10, 40);
    if (rnd() < 0.5) cyl(x, 0.45, z, 0.30, 0.9, pick([0x2980b9, 0xc0392b, 0x27ae60, 0x7f8c8d]));
    else box(x, 0.25, z, 0.4, 0.5, 0.28, pick([0xf1c40f, 0x2980b9, 0xc0392b]));
  }
  for (let i = 0; i < 26; i++) {
    const x = R(-40, 40), z = R(-10, 40);
    cyl(x, 0.10, z, 0.36, 0.20, pick([0x2e86c1, 0xc0392b, 0xf1c40f, 0xecf0f1]));
  }
  for (let i = 0; i < 16; i++) {
    const x = R(-36, 36), z = R(-4, 38);
    box(x, 3.05, z, R(5, 9), 0.06, R(2.5, 4), pick(TARP), 0, R(0, 3), 0);
  }
  for (let i = 0; i < 40; i++) {
    const x = R(-40, 40), z = R(-10, 42);
    box(x, 0.22, z, R(0.4, 0.7), R(0.35, 0.5), R(0.3, 0.55),
      pick([WOOD_L, WOOD, 0x9c7a4a, 0x2f7fd6]), 0, R(0, 3), 0);
  }

  /* ── Vehicles ───────────────────────────────────────────── */
  function addKeke(x, z, ry) {
    const p = placer(x, z, ry);
    p.box(0, 0.72, 0, 1.25, 0.95, 2.30, 0xf1c40f);
    p.box(0, 1.40, -0.15, 1.15, 0.50, 1.70, 0xf1c40f);
    p.box(0, 1.42, 0.72, 1.05, 0.42, 0.08, 0x22303c);
    p.box(0, 1.42, -1.00, 1.05, 0.42, 0.08, 0x22303c);
    p.box(-0.63, 1.40, -0.15, 0.06, 0.40, 1.60, 0x22303c);
    p.box( 0.63, 1.40, -0.15, 0.06, 0.40, 1.60, 0x22303c);
    p.box(0, 1.02, 1.16, 1.20, 0.22, 0.10, 0x2c3e50);
    p.cyl(-0.66, 0.34, 0.78, 0.30, 0.22, 0x1a1a1a, 0, Math.PI / 2);
    p.cyl( 0.66, 0.34, 0.78, 0.30, 0.22, 0x1a1a1a, 0, Math.PI / 2);
    p.cyl( 0.00, 0.34, -0.85, 0.30, 0.22, 0x1a1a1a, 0, Math.PI / 2);
    addCollider(x, z, 1.5);
  }

  function addDanfo(x, z, ry) {
    const p = placer(x, z, ry);
    p.box(0, 1.10, 0, 2.10, 1.60, 5.20, 0xf1c40f);
    p.box(0, 1.95, 0.10, 2.02, 0.55, 4.30, 0x2c3e50);
    p.box(0, 1.90, 2.55, 1.95, 0.70, 0.12, 0x22303c);
    p.box(0, 0.55, 2.62, 2.10, 0.35, 0.14, 0x2c3e50);
    p.box(0, 1.10, 0, 2.14, 0.16, 5.24, 0x1a1a1a);
    for (const wz of [1.7, -1.7]) {
      p.cyl(-1.02, 0.42, wz, 0.42, 0.26, 0x1a1a1a, 0, Math.PI / 2);
      p.cyl( 1.02, 0.42, wz, 0.42, 0.26, 0x1a1a1a, 0, Math.PI / 2);
    }
    addCollider(x, z, 2.6);
  }

  addKeke(-14, -18.5, 0.15);
  addKeke(  9, -18.5, -0.10);
  addKeke( 26, -27.0, Math.PI + 0.08);
  addDanfo(-30, -27.5, 0.02);
  addDanfo( 34, -18.0, Math.PI - 0.05);

  /* ── Gate sign ──────────────────────────────────────────── */
  {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 2.5),
      new THREE.MeshLambertMaterial({ map: signTex(), side: THREE.DoubleSide })
    );
    sign.position.set(0, 5.2, -12.4);
    sign.rotation.y = Math.PI;
    scene.add(sign);
    cyl(-3.9, 2.6, -12.4, 0.11, 5.2, 0x7f8c8d);
    cyl( 3.9, 2.6, -12.4, 0.11, 5.2, 0x7f8c8d);
    box(0, 6.55, -12.4, 10.6, 0.22, 0.22, 0x7f8c8d);
  }

  /* ── Finalize batches ───────────────────────────────────── */
  BX.finish();
  CY.finish();
  CN.finish();
  SP.finish();
  BD.finish();

  /* ── Third person ───────────────────────────────────────── */
  const world = {
    colliders: colliders,
    seats: [],
    uses: [],
    platforms: [],
    levelHeight: function () { return 0; },
    bounds: {
      minX: -68, maxX: 68,
      minZ: -38, maxZ: 52,
    },
  };

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, world, {
    scene: scene,
    x: 0, z: -30, yaw: Math.PI, level: 0,
    speedMult: 1.0,
    onUse: function (use) {
      if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE");
    },
  });

  return {
  three: scene,
  camera: camera,
  controls: { update: function () {} },
  crumb: meta.name,
  title: "MILE 1 MARKET",
  subtitle: "INTERIOR",
  hint: "",
  isInterior: true,
  sceneId: "market",
  update: function (dt) { ctl.update(dt); },
  dispose: function () { ctl.dispose(); },
};
}

