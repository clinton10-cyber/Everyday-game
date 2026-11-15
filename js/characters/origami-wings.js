/* origami-wings.js — the three folded-ribbon wing designs worn on the character's back.
     angel_wings  → Origami Angel (folded paper, ink creases)
     neon_wings   → Cyber Origami (dark chrome, magenta→cyan neon edges, energy conduit + core)
     shadow_wings → Shadow Raven (obsidian plumage, violet/teal iridescent edges, six feather tiers)
   Geometry is built once per design (lazy) and shared by every avatar; materials are shared too,
   so attaching/removing wings never allocates GPU memory twice.
   buildOrigamiWings(kind) → THREE.Group { children: left wing, right wing, + decor }.
   Wing children carry userData { isWing, side, baseZ }. group.userData.tick(time) animates decor. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const UP = new THREE.Vector3(0, 1, 0);
const DEG = THREE.MathUtils.degToRad;
const clamp = THREE.MathUtils.clamp;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hdr = (r, g, b) => new THREE.Color(r, g, b);
const mkRng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; };

/* ── folded ribbon: a spine with two vanes falling away (triangles + neon/ink line segments) ── */
function buildRibbon(o) {
  const { spineFn, widthFn, up = UP, fold = 0.55, segs = 5, panelRidgeFn, panelEdgeFn, ridgeFn, edgeFn, ribFn, lineLift = 0.0024 } = o;
  const P = [], C = [], LP = [], LC = [], EPS = 0.0025, rings = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, p = spineFn(t), a = spineFn(Math.max(0, t - EPS)), b = spineFn(Math.min(1, t + EPS));
    const tan = new THREE.Vector3().subVectors(b, a); if (tan.lengthSq() < 1e-12) tan.set(1, 0, 0); tan.normalize();
    const u = up.clone().addScaledVector(tan, -up.dot(tan)); if (u.lengthSq() < 1e-10) u.set(0, 1, 0); u.normalize();
    const side = new THREE.Vector3().crossVectors(tan, u).normalize(), w = widthFn(t);
    rings.push({ c: p.clone(), l: p.clone().addScaledVector(side, w).addScaledVector(u, -w * fold), r: p.clone().addScaledVector(side, -w).addScaledVector(u, -w * fold), u, t });
  }
  const ridgeP = rings.map((r) => panelRidgeFn(r.t)), edgeP = rings.map((r) => panelEdgeFn(r.t));
  const tri = (a, b, c, ca, cb, cc) => { P.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); C.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b); };
  for (let i = 0; i < segs; i++) {
    const A = rings[i], B = rings[i + 1], aR = ridgeP[i], bR = ridgeP[i + 1], aE = edgeP[i], bE = edgeP[i + 1];
    tri(A.l, B.l, B.c, aE, bE, bR); tri(A.l, B.c, A.c, aE, bR, aR);
    tri(A.c, B.c, B.r, aR, bR, bE); tri(A.c, B.r, A.r, aR, bE, aE);
  }
  const lift = (p, u) => new THREE.Vector3(p.x + u.x * lineLift, p.y + u.y * lineLift, p.z + u.z * lineLift);
  const seg = (a, b, ca, cb) => { LP.push(a.x, a.y, a.z, b.x, b.y, b.z); LC.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b); };
  for (let i = 0; i < segs; i++) {
    const A = rings[i], B = rings[i + 1], tc = (A.t + B.t) * 0.5, cr = ridgeFn(tc), ce = edgeFn(tc);
    seg(lift(A.c, A.u), lift(B.c, B.u), cr, cr); seg(lift(A.l, A.u), lift(B.l, B.u), ce, ce); seg(lift(A.r, A.u), lift(B.r, B.u), ce, ce);
  }
  for (let i = 1; i < segs; i++) {
    const A = rings[i], cr = ribFn(A.t);
    seg(lift(A.l, A.u), lift(A.c, A.u), cr, cr); seg(lift(A.c, A.u), lift(A.r, A.u), cr, cr);
  }
  return { P, C, LP, LC };
}

function Collector() {
  const panelGeos = [], lineGeos = [];
  return {
    add(o) {
      const r = buildRibbon(o);
      if (r.P.length) { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(r.P, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(r.C, 3)); panelGeos.push(g); }
      if (r.LP.length) { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(r.LP, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(r.LC, 3)); lineGeos.push(g); }
    },
    finish() {
      const panels = mergeGeometries(panelGeos, false); panels.computeVertexNormals();
      const lines = mergeGeometries(lineGeos, false);
      panelGeos.forEach((g) => g.dispose()); lineGeos.forEach((g) => g.dispose());
      return { panels, lines };
    },
  };
}

/* ── 1. ORIGAMI ANGEL (paper) ─────────────────────────────────────── */
function buildPaper() {
  const PAPER_ROOT = new THREE.Color("#d8c9ad"), PAPER_TIP = new THREE.Color("#fffdf6"), COOL = new THREE.Color("#b6c8e4"), WARM = new THREE.Color("#f0d7a8"), INK = new THREE.Color("#2b3549");
  const rnd = mkRng(20240607), col = Collector();
  const armPoint = (t) => new THREE.Vector3(0.040 + 1.160 * t, 0.460 * Math.sin(t * Math.PI * 0.58), -0.260 * Math.sin(t * Math.PI * 0.88));
  const flat = (fn) => ({ panelRidgeFn: fn, panelEdgeFn: fn, ridgeFn: () => INK, edgeFn: () => INK, ribFn: () => INK, lineLift: 0.0018 });
  col.add({ spineFn: (t) => armPoint(t).add(new THREE.Vector3(0, 0.012, 0.005)),
    widthFn: (t) => 0.030 + 0.040 * Math.sin(Math.PI * clamp(t * 1.05, 0, 1)) ** 0.6, fold: 0.72, segs: 14,
    ...flat((t) => PAPER_ROOT.clone().lerp(new THREE.Color("#efe6d4"), smoothstep(0.1, 0.9, t))) });
  const LAYERS = [
    { count: 34, tMin: 0, tMax: 1.00, lenMul: 1.00, thetaOff: 0, yOff: 0.000, wMul: 1.00, fold: 0.46, segs: 6 },
    { count: 26, tMin: 0, tMax: 0.92, lenMul: 0.52, thetaOff: -4, yOff: 0.034, wMul: 0.80, fold: 0.52, segs: 4 },
    { count: 20, tMin: 0, tMax: 0.72, lenMul: 0.30, thetaOff: -8, yOff: 0.060, wMul: 0.62, fold: 0.58, segs: 4 },
    { count: 16, tMin: 0, tMax: 0.50, lenMul: 0.17, thetaOff: -13, yOff: 0.082, wMul: 0.50, fold: 0.64, segs: 3 },
  ];
  LAYERS.forEach((layer, L) => {
    for (let i = 0; i < layer.count; i++) {
      const s = layer.tMin + (layer.tMax - layer.tMin) * (i / (layer.count - 1));
      const base = armPoint(s); base.z += 0.028 + 0.010 * L; base.y += layer.yOff - 0.006;
      const theta = DEG(99 - 88 * Math.pow(s, 0.80)) + DEG(layer.thetaOff) + DEG((rnd() - 0.5) * 2.4);
      const dir = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
      const baseLen = 0.360 + 1.040 * Math.pow(s, 1.18), length = baseLen * layer.lenMul * (0.955 + rnd() * 0.09);
      const halfW = (0.040 + 0.034 * baseLen) * layer.wMul * (0.90 + rnd() * 0.20);
      const spineFn = (t) => { const p = base.clone().addScaledVector(dir, length * t); p.y += length * (0.055 * Math.sin(Math.PI * t) - 0.075 * t * t); return p; };
      const widthFn = (t) => halfW * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.58)), 0.85);
      const tint = rnd(), rootCol = PAPER_ROOT.clone().lerp(tint > 0.5 ? COOL : WARM, Math.abs(tint - 0.5) * 1.5);
      col.add({ spineFn, widthFn, fold: layer.fold + (rnd() - 0.5) * 0.10, segs: layer.segs, ...flat((t) => rootCol.clone().lerp(PAPER_TIP, smoothstep(0.02, 1.0, Math.pow(t, 0.85)))) });
    }
  });
  return { ...col.finish(), armPoint };
}

/* ── 2. CYBER ORIGAMI (neon) ──────────────────────────────────────── */
function buildNeon() {
  const rnd = mkRng(0xC0FFEE), col = Collector();
  const armPoint = (t) => new THREE.Vector3(0.045 + 1.230 * t, 0.470 * Math.sin(t * Math.PI * 0.58), -0.285 * Math.sin(t * Math.PI * 0.88));
  const CYAN = hdr(0.35, 1.85, 2.30), MAG = hdr(2.10, 0.30, 1.70);
  col.add({ spineFn: (t) => armPoint(t).add(new THREE.Vector3(0, 0.012, 0.004)),
    widthFn: (t) => 0.030 + 0.038 * Math.pow(Math.sin(Math.PI * clamp(t * 1.04, 0, 1)), 0.55), fold: 0.80, segs: 18,
    panelRidgeFn: () => new THREE.Color(0.010, 0.020, 0.035),
    panelEdgeFn: (t) => new THREE.Color(0.02, 0.05, 0.09).lerp(new THREE.Color(0.10, 0.30, 0.45), t),
    ridgeFn: () => CYAN, edgeFn: (t) => MAG.clone().lerp(CYAN, smoothstep(0, 1, t)), ribFn: () => hdr(0.10, 0.55, 0.90) });
  const LAYERS = [
    { count: 40, tMin: 0, tMax: 1.00, lenMul: 1.00, thetaOff: 0, yOff: 0.000, wMul: 1.00, fold: 0.55, segs: 6 },
    { count: 30, tMin: 0, tMax: 0.94, lenMul: 0.56, thetaOff: -5, yOff: 0.036, wMul: 0.78, fold: 0.61, segs: 5 },
    { count: 22, tMin: 0, tMax: 0.74, lenMul: 0.33, thetaOff: -10, yOff: 0.066, wMul: 0.60, fold: 0.67, segs: 4 },
    { count: 16, tMin: 0, tMax: 0.50, lenMul: 0.18, thetaOff: -16, yOff: 0.092, wMul: 0.46, fold: 0.74, segs: 3 },
  ];
  LAYERS.forEach((layer, L) => {
    for (let i = 0; i < layer.count; i++) {
      const s = layer.tMin + (layer.tMax - layer.tMin) * (i / (layer.count - 1));
      const base = armPoint(s); base.z += 0.030 + 0.011 * L; base.y += layer.yOff - 0.006;
      const theta = DEG(99 - 88 * Math.pow(s, 0.80)) + DEG(layer.thetaOff) + DEG((rnd() - 0.5) * 2.2);
      const dir = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
      const baseLen = 0.370 + 1.060 * Math.pow(s, 1.16), length = baseLen * layer.lenMul * (0.955 + rnd() * 0.09);
      const halfW = (0.040 + 0.033 * baseLen) * layer.wMul * (0.90 + rnd() * 0.20);
      const spineFn = (t) => { const p = base.clone().addScaledVector(dir, length * t); p.y += length * (0.052 * Math.sin(Math.PI * t) - 0.078 * t * t); return p; };
      const widthFn = (t) => halfW * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.56)), 0.82);
      const hue = (0.87 - 0.37 * s + (rnd() - 0.5) * 0.05 + 1) % 1, neon = new THREE.Color().setHSL(hue, 1.0, 0.55);
      const neonHDR = neon.clone().multiplyScalar(2.15), neonDim = neon.clone().multiplyScalar(0.75);
      const panelRoot = new THREE.Color(0.006, 0.010, 0.020).lerp(neon, 0.07), panelTip = new THREE.Color(0.018, 0.048, 0.078).lerp(neon, 0.26);
      col.add({ spineFn, widthFn, fold: layer.fold + (rnd() - 0.5) * 0.10, segs: layer.segs,
        panelRidgeFn: (t) => panelRoot.clone().lerp(panelTip, smoothstep(0, 1, t)),
        panelEdgeFn: (t) => panelRoot.clone().lerp(panelTip, smoothstep(0, 1, t)).lerp(neon, 0.10 * t),
        ridgeFn: (t) => neonHDR.clone().multiplyScalar(0.55 + 0.75 * t), edgeFn: (t) => neonHDR.clone().multiplyScalar(0.45 + 1.00 * t), ribFn: () => neonDim });
    }
  });
  const pts = []; for (let i = 0; i <= 24; i++) pts.push(armPoint(i / 24));
  const conduitGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.0125, 6, false);
  const nodePts = []; for (let i = 1; i <= 9; i++) nodePts.push(armPoint(i / 10).add(new THREE.Vector3(0, 0.012, 0.004)));
  return { ...col.finish(), armPoint, conduitGeo, nodePts };
}

/* ── 3. SHADOW RAVEN ──────────────────────────────────────────────── */
function buildRaven() {
  const rnd = mkRng(0x5AD0C0DE), col = Collector();
  const armPoint = (t) => new THREE.Vector3(0.045 + 1.310 * t, 0.500 * Math.sin(t * Math.PI * 0.60), -0.310 * Math.sin(t * Math.PI * 0.86));
  const DARK = new THREE.Color(0.006, 0.005, 0.010), TINT = new THREE.Color(0.020, 0.017, 0.032);
  const featherColor = (s, tint) => {
    const hue = 0.78 + (0.52 - 0.78) * smoothstep(0, 1, s) + (rnd() - 0.5) * 0.05;
    return new THREE.Color().setHSL((hue + 1) % 1, 0.82, 0.55).multiplyScalar(tint);
  };
  const addFeather = (s, layer) => {
    const { thetaOff = 0, yOff = 0, zOff = 0, lengthMul = 1, widthMul = 1, foldAdj = 0, segs = 5, sheen = 1, tint = 1 } = layer;
    const base = armPoint(s); base.z += 0.028 + zOff; base.y += yOff;
    const theta = DEG(96 - 88 * Math.pow(s, 0.78)) + DEG(thetaOff) + DEG((rnd() - 0.5) * 2.0);
    const dir = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
    const baseLen = 0.400 + 1.180 * Math.pow(s, 1.16), length = baseLen * lengthMul * (0.955 + rnd() * 0.09);
    const halfW = (0.038 + 0.032 * baseLen) * widthMul * (0.88 + rnd() * 0.22);
    const spineFn = (t) => { const p = base.clone().addScaledVector(dir, length * t); p.y += length * (0.052 * Math.sin(Math.PI * t) - 0.086 * t * t); return p; };
    const widthFn = (t) => halfW * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.54)), 0.80);
    const irid = featherColor(s, tint), ridgeHDR = irid.clone().multiplyScalar(1.55 * sheen), edgeHDR = irid.clone().multiplyScalar(1.95 * sheen), ribHDR = irid.clone().multiplyScalar(0.55 * sheen);
    col.add({ spineFn, widthFn, fold: 0.58 + foldAdj + (rnd() - 0.5) * 0.10, segs,
      panelRidgeFn: (t) => DARK.clone().lerp(TINT, smoothstep(0, 1, t)),
      panelEdgeFn: (t) => DARK.clone().lerp(TINT, smoothstep(0, 1, t)).lerp(irid, 0.055 * t),
      ridgeFn: (t) => ridgeHDR.clone().multiplyScalar(0.50 + 0.62 * t), edgeFn: (t) => edgeHDR.clone().multiplyScalar(0.42 + 0.90 * t), ribFn: () => ribHDR });
  };
  col.add({ spineFn: (t) => armPoint(t * 0.22).add(new THREE.Vector3(0, 0.006, 0.020)), widthFn: (t) => 0.085 + 0.030 * Math.sin(Math.PI * t), fold: 0.72, segs: 6,
    panelRidgeFn: () => DARK, panelEdgeFn: (t) => TINT.clone().lerp(new THREE.Color(0.030, 0.024, 0.048), t),
    ridgeFn: () => hdr(0.35, 0.24, 0.65), edgeFn: () => hdr(0.45, 0.30, 0.85), ribFn: () => hdr(0.18, 0.12, 0.40) });
  const run = (n, f0, f1, layerFn) => { for (let i = 0; i < n; i++) addFeather(f0 + (f1 - f0) * (i / (n - 1)), layerFn(i / (n - 1))); };
  run(16, 0.00, 0.62, () => ({ thetaOff: 4, segs: 6 }));                                                                                   /* secondaries */
  run(12, 0.60, 1.00, (u) => ({ thetaOff: -4, yOff: 0.002, zOff: 0.002, lengthMul: 1.10 + 0.16 * u, widthMul: 0.92 - 0.20 * u, foldAdj: 0.02, segs: 7, sheen: 1.15, tint: 1.05 })); /* primaries */
  run(22, 0.00, 0.86, () => ({ thetaOff: -6, yOff: 0.036, zOff: 0.004, lengthMul: 0.54, widthMul: 0.78, foldAdj: 0.05, segs: 5, sheen: 0.85, tint: 0.92 }));
  run(20, 0.00, 0.72, () => ({ thetaOff: -13, yOff: 0.068, zOff: 0.008, lengthMul: 0.34, widthMul: 0.60, foldAdj: 0.10, segs: 4, sheen: 0.65, tint: 0.82 }));
  run(18, 0.00, 0.52, () => ({ thetaOff: -20, yOff: 0.098, zOff: 0.012, lengthMul: 0.19, widthMul: 0.46, foldAdj: 0.14, segs: 3, sheen: 0.48, tint: 0.72 }));
  run(14, 0.00, 0.36, () => ({ thetaOff: -26, yOff: 0.124, zOff: 0.016, lengthMul: 0.11, widthMul: 0.36, foldAdj: 0.18, segs: 3, sheen: 0.35, tint: 0.62 }));
  return { ...col.finish(), armPoint };
}

/* ── shared materials + cache ─────────────────────────────────────── */
const CACHE = {};
function make(kind) {
  if (kind === "angel_wings") {
    const d = buildPaper();
    return { d, panelMat: new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true, roughness: 0.62, metalness: 0.02, emissive: 0x4a4438, emissiveIntensity: 1, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
      lineMat: new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false }) };
  }
  const additive = { vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false };
  if (kind === "neon_wings") {
    return { d: buildNeon(), panelMat: new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true, metalness: 0.45, roughness: 0.34, emissive: 0x06131f, emissiveIntensity: 1.4, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
      lineMat: new THREE.LineBasicMaterial({ ...additive, opacity: 0.95 }),
      conduitMat: new THREE.MeshBasicMaterial({ color: hdr(0.30, 1.70, 2.20), transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      nodeMat: new THREE.MeshBasicMaterial({ color: hdr(2.20, 0.35, 1.60), toneMapped: false }) };
  }
  return { d: buildRaven(), panelMat: new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true, metalness: 0.5, roughness: 0.32, emissive: 0x160a30, emissiveIntensity: 1.5, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
    lineMat: new THREE.LineBasicMaterial({ ...additive, opacity: 0.85 }) };
}

export const WING_SCALE = 0.42;   /* demo wings are ~2.7 units across; this fits the avatar's back */

export function buildOrigamiWings(kind) {
  const K = CACHE[kind] || (CACHE[kind] = make(kind));
  const { d, panelMat, lineMat } = K;
  const group = new THREE.Group();
  /* The demo wings fan out flat (feathers sweep +Z). Worn on the back they must hang like angel wings:
     demo (x,y,z) → avatar (-x, -z, -y): feathers fan DOWN, the arm arches away from the back, wrist up. */
  group.rotation.order = "YXZ"; group.rotation.set(Math.PI / 2, Math.PI, 0);
  group.scale.setScalar(WING_SCALE);
  for (const side of [-1, 1]) {                    /* child 0 = left (mirrored), child 1 = right */
    const wing = new THREE.Group(); wing.name = side < 0 ? "left-wing" : "right-wing";
    wing.userData = { isWing: true, side, base: side * 0.10 };
    wing.add(new THREE.Mesh(d.panels, panelMat));
    wing.add(new THREE.LineSegments(d.lines, lineMat));
    if (kind === "neon_wings") {
      wing.add(new THREE.Mesh(d.conduitGeo, K.conduitMat));
      const nodeGeo = K.nodeGeo || (K.nodeGeo = new THREE.OctahedronGeometry(0.030, 0));
      d.nodePts.forEach((p, i) => { const n = new THREE.Mesh(nodeGeo, K.nodeMat); n.position.copy(p); n.rotation.set(i * 1.3, i * 0.7, i * 2.1); n.scale.setScalar(0.8 + (i % 3) * 0.3); wing.add(n); });
    }
    if (side < 0) wing.scale.x = -1;
    wing.rotation.y = side * 0.10;                  /* flap axis = avatar front-back axis */
    group.add(wing);
  }
  /* back-piece core */
  const coreCol = kind === "neon_wings" ? 0x2fe8ff : kind === "shadow_wings" ? 0x8a5cff : 0xff9b3d;
  const coreMat = K.coreMat || (K.coreMat = new THREE.MeshStandardMaterial({ color: 0x0a1c28, emissive: coreCol, emissiveIntensity: 1.6, metalness: 0.5, roughness: 0.3, flatShading: true }));
  const core = new THREE.Mesh(K.coreGeo || (K.coreGeo = new THREE.OctahedronGeometry(0.15, 0)), coreMat);
  core.scale.set(1, 1.5, 1); group.add(core);
  group.userData.tick = (t) => { core.rotation.y = t * 0.6; coreMat.emissiveIntensity = 1.3 + Math.sin(t * 2.6) * 0.45; };
  return group;
}
