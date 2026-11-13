/* ════════════════════════════════════════════════════════════════════
   faceted.js — procedural "faceted low-poly" characters (neutral · male · female)

   Everything is generated from a few numbers:

     • loft()        sweeps an elliptical cross-section along an axis. Every body
                     part, garment and hair piece is a loft with 5–10 sides and
                     flat (per-face) normals — that is the faceted look.
     • spline()      Catmull-Rom through a handful of control values, so torso,
                     limb and head silhouettes are smooth curves sampled into rings.
     • skirtRings()  the dress maths: radius(t) = hip + (hem − hip)·f(t) with
                     f chosen per style, plus pleat ripple  sin(n·θ)  and an
                     uneven hem  sin(m·θ).

   buildFaceted() returns { root, rig } with the SAME joint layout as the game's
   classic builder (hips › spine › neck › head, armL/armR {shoulder, elbow, wrist,
   thumb, fingers, grip}, legL/legR {hip, knee, ankle}) so the Animator, jetpack,
   phone and gait code drive it unchanged.
   ════════════════════════════════════════════════════════════════════ */
import * as THREE from "three";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

export const HIP_HEIGHT = 0.935;           /* hips joint above the ground (same as the classic rig) */
export const BODY_TYPES = ["neutral", "male", "female"];
export const DRESS_STYLES = ["aline", "skater", "maxi", "ball", "pencil", "tulip", "pleated", "handkerchief"];

/* ── maths ─────────────────────────────────────────────────────────── */

/* Catmull-Rom through equally spaced control values; t in [0,1] */
export function spline(v, t) {
  const n = v.length - 1;
  const x = clamp(t, 0, 1) * n;
  const i = Math.min(n - 1, Math.floor(x)), f = x - i;
  const p0 = v[Math.max(0, i - 1)], p1 = v[i], p2 = v[i + 1], p3 = v[Math.min(n, i + 2)];
  return 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
}

/* Sample control arrays into rings. cols: { rx:[..], rz:[..], cz:[..]? } over y0..y1 */
function ringsFrom(y0, y1, n, cols, ease = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    out.push({
      y: lerp(y0, y1, t), t,
      rx: spline(cols.rx, t) + ease,
      rz: spline(cols.rz, t) + ease,
      cx: cols.cx ? spline(cols.cx, t) : 0,
      cz: cols.cz ? spline(cols.cz, t) : 0,
    });
  }
  return out;
}

/* ── loft: elliptical sweep with flat normals ─────────────────────────
   rings: [{ y, rx, rz, cx?, cz?, t? }]  (any order; auto-sorted so y increases)
   o.seg      sides (default 8)           o.phase  start angle (default π/seg → a flat face at the front)
   o.shape    (ring, angle, i, k) → {dr,dx,dy,dz}   per-vertex displacement
   o.skip     (ring, angle) → true to drop that quad (open fronts, necklines)
   o.caps     false | "top" | "bottom" | true (default true)                         */
export function loft(rings, o = {}) {
  if (rings[rings.length - 1].y < rings[0].y) rings = rings.slice().reverse();
  const seg = o.seg || 8, ph = o.phase !== undefined ? o.phase : Math.PI / seg;
  const n = rings.length, pos = [], idx = [];
  for (let i = 0; i < n; i++) {
    const r = rings[i], cx = r.cx || 0, cz = r.cz || 0;
    for (let k = 0; k < seg; k++) {
      const a = ph + (k / seg) * TAU;
      let x = cx + r.rx * Math.sin(a), z = cz + r.rz * Math.cos(a), y = r.y;
      if (o.shape) {
        const s = o.shape(r, a, i, k);
        if (s) {
          if (s.dr) { x = cx + (x - cx) * (1 + s.dr); z = cz + (z - cz) * (1 + s.dr); }
          if (s.dx) x += s.dx;
          if (s.dz) z += s.dz;
          if (s.dy) y += s.dy;
        }
      }
      pos.push(x, y, z);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < seg; k++) {
      const k1 = (k + 1) % seg;
      if (o.skip && o.skip(rings[i], ph + ((k + 0.5) / seg) * TAU, rings[i + 1])) continue;
      const a = i * seg + k, d = i * seg + k1, b = (i + 1) * seg + k, c = (i + 1) * seg + k1;
      idx.push(a, d, b, d, c, b);
    }
  }
  const caps = o.caps === undefined ? true : o.caps;
  const cap = (ri, up) => {
    const r = rings[ri], base = ri * seg, ci = pos.length / 3;
    let ax = 0, ay = 0, az = 0;
    for (let k = 0; k < seg; k++) { ax += pos[(base + k) * 3]; ay += pos[(base + k) * 3 + 1]; az += pos[(base + k) * 3 + 2]; }
    pos.push(ax / seg, ay / seg, az / seg);
    for (let k = 0; k < seg; k++) {
      const k1 = (k + 1) % seg;
      if (up) idx.push(ci, base + k, base + k1); else idx.push(ci, base + k1, base + k);
    }
  };
  if (caps === true || caps === "top") cap(n - 1, true);
  if (caps === true || caps === "bottom") cap(0, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const ng = g.toNonIndexed();            /* flat shading: every face owns its vertices */
  ng.computeVertexNormals();
  return ng;
}

/* convert to non-indexed only when the geometry actually has an index (avoids three.js warnings) */
function nonIdx(g) { return g.index ? g.toNonIndexed() : g; }

/* low-poly ball / blob (flat shaded icosahedron) */
function blobGeo(r, detail = 0) {
  /* PolyhedronGeometry (Icosahedron) is already non-indexed in three r169+; only convert when an index exists. */
  let g = new THREE.IcosahedronGeometry(r, detail);
  if (g.index) g = g.toNonIndexed();
  g.computeVertexNormals();
  return g;
}
function boxGeo(x, y, z) { const g = new THREE.BoxGeometry(x, y, z); return g; }

/* ── body types ───────────────────────────────────────────────────────
   Torso/pelvis are described by control values (spine space, y up from the
   waist joint). Everything else is a single number. "neutral" is the exact
   midpoint between male and female, so the three types morph smoothly.      */
const T_Y0 = 0.0, T_Y1 = 0.43;
const MALE = {
  scale: 1.03,
  shoulderX: 0.178,
  torsoRx: [0.140, 0.136, 0.148, 0.168, 0.182, 0.178, 0.114, 0.058],
  torsoRz: [0.094, 0.092, 0.098, 0.108, 0.108, 0.096, 0.076, 0.050],
  bust: 0.000,
  pelvRx: [0.100, 0.142, 0.150, 0.142, 0.140],
  pelvRz: [0.088, 0.110, 0.114, 0.105, 0.099],
  hipX: 0.078,
  arm: 1.00, thigh: 1.00, calf: 1.00,
  neck: 0.054,
  head: { w: 0.083, d: 0.094, jaw: 1.00, h: 1.00 },
  brow: 1.0, lips: 0.85, hand: 1.12, foot: 1.00, headScale: 1.26,
};
const FEMALE = {
  scale: 0.962,
  shoulderX: 0.150,
  torsoRx: [0.116, 0.110, 0.124, 0.144, 0.156, 0.150, 0.094, 0.050],
  torsoRz: [0.084, 0.080, 0.088, 0.098, 0.098, 0.088, 0.068, 0.042],
  bust: 0.034,
  pelvRx: [0.104, 0.150, 0.164, 0.142, 0.116],
  pelvRz: [0.088, 0.112, 0.120, 0.104, 0.090],
  hipX: 0.084,
  arm: 0.86, thigh: 1.04, calf: 0.92,
  neck: 0.043,
  head: { w: 0.076, d: 0.088, jaw: 0.84, h: 0.97 },
  brow: 0.8, lips: 1.2, hand: 1.00, foot: 0.92, headScale: 1.22,
};
function mixBody(a, b, t) {
  const o = {};
  for (const k of Object.keys(a)) {
    if (Array.isArray(a[k])) o[k] = a[k].map((v, i) => lerp(v, b[k][i], t));
    else if (typeof a[k] === "object") o[k] = mixBody(a[k], b[k], t);
    else o[k] = lerp(a[k], b[k], t);
  }
  return o;
}
export function bodySpec(type, build = 0) {
  const t = type === "male" ? 0 : type === "female" ? 1 : 0.5;
  const B = mixBody(MALE, FEMALE, t);
  const k = clamp(+build || 0, -1, 1);
  const w = 1 + 0.14 * k;                         /* build slider: width */
  const d = 1 + 0.12 * k;                         /* build slider: depth */
  B.type = type;
  B.female = type === "female";
  B.build = k;
  B.torsoRx = B.torsoRx.map((v) => v * w);  B.torsoRz = B.torsoRz.map((v) => v * d);
  B.pelvRx = B.pelvRx.map((v) => v * w);    B.pelvRz = B.pelvRz.map((v) => v * d);
  B.limb = 1 + 0.10 * k;
  B.shoulderX *= w;
  B.hipX *= w;
  B.armTop = 0.047 * B.arm * B.limb;  B.armElbow = 0.040 * B.arm * B.limb;  B.armWrist = 0.031 * B.arm * B.limb;
  B.thighTop = 0.086 * B.thigh * B.limb;  B.thighBot = 0.068 * B.thigh * B.limb;
  B.calfTop = 0.064 * B.calf * B.limb;    B.calfBot = 0.044 * B.calf * B.limb;
  return B;
}

/* ── colours / materials ───────────────────────────────────────────── */
const lam = (c, extra) => new THREE.MeshLambertMaterial(Object.assign({ color: new THREE.Color(c) }, extra || {}));
const shade = (c, dl) => new THREE.Color(c).offsetHSL(0, 0, dl);

export const DEFAULTS = {
  body: "male", build: 0,
  skin: "#e8b999", hair: "short", hairColor: "#4a3426",
  eye: "#2a2320", lip: "#b8705f",
  top: "hoodie", topColor: "#3f78c7",
  bottom: "pants", bottomColor: "#b9a974",
  shoeStyle: "sneaker", shoeColor: "#5b5230",
  dress: { style: "aline", length: null, flare: 1.0, pleats: 0, wave: null, color: null },
};

export function makeMats(o) {
  return {
    skin: lam(o.skin),
    skinD: lam(shade(o.skin, -0.06)),
    hair: lam(o.hairColor),
    top: lam(o.topColor, { side: THREE.DoubleSide }),
    topD: lam(shade(o.topColor, -0.10), { side: THREE.DoubleSide }),
    bottom: lam(o.bottomColor, { side: THREE.DoubleSide }),
    shoes: lam(o.shoeColor),
    sole: lam(shade(o.shoeColor, -0.05)),
    eyeD: new THREE.MeshBasicMaterial({ color: new THREE.Color(o.eye) }),
    eyeW: new THREE.MeshBasicMaterial({ color: 0xf2f4f8 }),
    mouth: new THREE.MeshBasicMaterial({ color: new THREE.Color(o.lip) }),
  };
}

const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
};

/* ── head ─────────────────────────────────────────────────────────────
   Origin = top of the neck. Chin at y≈-0.03, crown at y≈0.205.            */
function headRings(B) {
  const H = B.head, j = H.jaw;
  /* y: chin → crown. rx = half-width, rz = half-depth, cz = forward shift */
  const ys = [-0.030, 0.000, 0.040, 0.085, 0.130, 0.170, 0.200, 0.214];
  const rx = [0.030 * j, 0.056 * j, 0.074 * lerp(1, j, 0.5), H.w, H.w * 0.99, H.w * 0.95, H.w * 0.80, H.w * 0.52];
  const rz = [0.030, 0.064, 0.082, H.d * 0.98, H.d, H.d * 0.95, H.d * 0.82, H.d * 0.52];
  const cz = [0.030, 0.020, 0.008, 0.004, 0.000, -0.004, -0.008, -0.010];
  const n = 15, out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    out.push({ y: lerp(ys[0], ys[ys.length - 1], t) * H.h, t, rx: spline(rx, t), rz: spline(rz, t), cx: 0, cz: spline(cz, t) });
  }
  return out;
}
function headSurface(rings, y) {         /* {rx, rz, cz} at height y (linear between rings) */
  for (let i = 1; i < rings.length; i++) {
    if (y <= rings[i].y) {
      const a = rings[i - 1], b = rings[i], t = (y - a.y) / ((b.y - a.y) || 1);
      return { rx: lerp(a.rx, b.rx, t), rz: lerp(a.rz, b.rz, t), cz: lerp(a.cz, b.cz, t) };
    }
  }
  return rings[rings.length - 1];
}

function buildHead(rig, B, M, o) {
  const head = rig.head;
  const rings = headRings(B);
  mesh(loft(rings, { seg: 8 }), M.skin, head);

  const eyeY = 0.108 * B.head.h, S = headSurface(rings, eyeY);
  const zf = (y) => { const s = headSurface(rings, y); return s.cz + s.rz; };

  /* eyes: dark almond + tiny white */
  for (const sd of [-1, 1]) {
    const ex = 0.036 * sd;
    const w = mesh(boxGeo(0.026, 0.013, 0.006), M.eyeW, head, ex, eyeY, zf(eyeY) - 0.001);
    w.castShadow = false;
    const p = mesh(boxGeo(0.014, 0.013, 0.007), M.eyeD, head, ex + 0.002 * sd * -1, eyeY, zf(eyeY) + 0.001);
    p.castShadow = false;
    const brY = eyeY + 0.030;
    const br = mesh(boxGeo(0.040, 0.008 * B.brow, 0.007), M.hair, head, ex, brY, zf(brY) + 0.001);
    br.rotation.z = -0.12 * sd; br.castShadow = false;
    /* ears */
    const eY = 0.078 * B.head.h, es = headSurface(rings, eY);
    const ear = mesh(boxGeo(0.014, 0.040, 0.026), M.skin, head, (es.rx + 0.004) * sd, eY, es.cz - 0.004);
    ear.rotation.z = 0.12 * sd;
  }
  /* nose: a small faceted wedge */
  const noseY = 0.078 * B.head.h;
  const nose = mesh(nonIdx(new THREE.ConeGeometry(0.0135, 0.026, 4)), M.skinD, head, 0, noseY, zf(noseY) + 0.005);
  nose.geometry.computeVertexNormals();
  nose.rotation.x = Math.PI / 2 - 0.30; nose.rotation.y = Math.PI / 4;
  /* mouth */
  const mY = 0.030 * B.head.h;
  const mo = mesh(boxGeo(0.040, 0.007 * B.lips, 0.006), M.mouth, head, 0, mY, zf(mY) + 0.001);
  mo.castShadow = false;
  rig._headRings = rings;
  return rings;
}

/* ── hair ───────────────────────────────────────────────────────────── */
export const HAIR_STYLES = ["short", "buzz", "bob", "long", "ponytail", "bun", "afro", "bald"];
function buildHair(rig, B, M, o, rings) {
  const head = rig.head, style = HAIR_STYLES.includes(o.hairStyle || o.hair) ? (o.hairStyle || o.hair) : "short";
  if (style === "bald") return;
  const off = style === "buzz" ? 0.005 : 0.012;
  const hk = B.head.h;
  const front = style === "short" ? 0.168 : 0.172, back = style === "buzz" ? 0.082 : 0.050;
  const edge = (a) => lerp(back, front, sstep((Math.cos(a) + 1) / 2)) * hk;
  const yTop = rings[rings.length - 1].y;

  if (style === "afro") {
    const g = blobGeo(0.150, 1); g.scale(1.0, 0.92, 1.02);
    mesh(g, M.hair, head, 0, 0.115 * hk, -0.012);
    return;
  }
  /* cap: rings from the lower edge up to the crown, following the head shape */
  const hr = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), y = lerp(0.060 * hk, yTop + off * 0.6, t);
    const s = headSurface(rings, y);
    hr.push({ y, t, rx: s.rx + off, rz: s.rz + off, cx: 0, cz: s.cz - 0.002 });
  }
  const capShape = (r, a) => {
    /* the lower edge rises toward the forehead and drops behind the ears; every ring is
       re-seated on the head surface at its new height so the cap never folds over the face */
    const yy = lerp(edge(a), yTop + off * 0.6, r.t);
    const sf = headSurface(rings, clamp(yy, rings[0].y, yTop));
    return { dy: yy - r.y, dx: (sf.rx + off - r.rx) * Math.sin(a), dz: (sf.rz + off - r.rz) * Math.cos(a) + (sf.cz - 0.002 - r.cz) };
  };
  const cap = loft(hr, { seg: 10, caps: "top", shape: capShape });
  mesh(cap, M.hair, head);

  /* a swept fringe */
  if (style === "short" || style === "bob" || style === "long" || style === "ponytail" || style === "bun") {
    const sideSign = o.part === "right" ? 1 : -1;
    const f = mesh(boxGeo(0.100, 0.026, 0.040), M.hair, head, 0.010 * -sideSign, 0.188 * hk, rings[9].cz + rings[9].rz * 0.90);
    f.rotation.set(0.45, 0, 0.14 * sideSign);
  }
  if (style === "bob" || style === "long") {
    const len = style === "bob" ? 0.00 : -0.20;
    const rr = [];
    const top = 0.165 * hk, bot = style === "bob" ? -0.005 : len;
    const m2 = 8;
    for (let i = 0; i < m2; i++) {
      const t = i / (m2 - 1), y = lerp(bot, top, t);
      const s = headSurface(rings, clamp(y, rings[0].y, rings[rings.length - 1].y));
      const flare = style === "long" ? 1 + 0.55 * (1 - t) * (1 - t) * (y < 0 ? 1 : 0.2) : 1.05 - 0.10 * (1 - t);
      rr.push({ y, t, rx: (s.rx + off + 0.012) * flare, rz: (s.rz + off + 0.012) * (style === "long" ? 1 + 0.25 * (1 - t) : 1), cx: 0, cz: s.cz - 0.012 });
    }
    const curtain = loft(rr, {
      seg: 12, caps: false,
      skip: (r, a) => Math.cos(a) > 0.30 && r.y < 0.160 * hk,     /* open at the face */
    });
    if (!M.hairDS) M.hairDS = new THREE.MeshLambertMaterial({ color: M.hair.color, side: THREE.DoubleSide });
    mesh(curtain, M.hairDS, head);
  }
  if (style === "ponytail") {
    const g = new THREE.Group(); g.position.set(0, 0.150 * hk, -0.092); g.rotation.x = 0.55; head.add(g);
    const rr = ringsFrom(-0.26, 0, 6, { rx: [0.010, 0.030, 0.040, 0.034, 0.024], rz: [0.010, 0.026, 0.036, 0.030, 0.022] });
    mesh(loft(rr, { seg: 6 }), M.hair, g, 0, 0, -0.01);
    mesh(boxGeo(0.040, 0.014, 0.040), M.top, g, 0, -0.01, -0.01);
  }
  if (style === "bun") mesh(blobGeo(0.050, 0), M.hair, head, 0, yTop + 0.020, -0.018);
}

/* ── skirts / dresses: the maths ─────────────────────────────────────
     t ∈ [0,1] from waist to hem
     radius  r(t) = hip + (hem − hip) · f(t)        (f differs per style)
     pleats  r *= 1 + p · sin(n·θ) · t^1.3
     hem     y += w · sin(m·θ) · t^3                                            */
const SKIRTS = {
  /*          len   hem×   profile f(t)                              */
  aline:        { len: 0.62, hem: 1.55, f: (t) => t },
  skater:       { len: 0.30, hem: 2.05, f: (t) => Math.pow(t, 0.55) },
  maxi:         { len: 0.88, hem: 1.50, f: (t) => 0.4 * t + 0.6 * sstep(t) },
  ball:         { len: 0.90, hem: 3.00, f: (t) => Math.pow(t, 0.72) },
  pencil:       { len: 0.55, hem: 0.84, f: (t) => sstep(t) },
  tulip:        { len: 0.52, hem: 1.00, f: (t) => 0.95 * Math.sin(Math.PI * Math.min(1, t * 0.92)) },
  pleated:      { len: 0.56, hem: 1.75, f: (t) => t, pleats: 16, pAmp: 0.10 },
  handkerchief: { len: 0.50, hem: 1.60, f: (t) => t, wave: 0.12, waves: 2 },
};
export function skirtRings(style, o, B) {
  const S = SKIRTS[style] || SKIRTS.aline;
  const len = (o.length !== undefined && o.length !== null ? o.length : S.len);
  const flare = (o.flare !== undefined ? o.flare : 1) * S.hem;
  const yTop = 0.040, hipR = (B.pelvRx[2] + 0.014), hipZ = (B.pelvRz[2] + 0.014);
  const n = style === "ball" || style === "maxi" ? 8 : 6;
  const rings = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), f = S.f(t), k = lerp(1, flare, f);
    rings.push({ y: yTop - len * t, t, rx: hipR * k, rz: hipZ * lerp(1, flare * 0.94, f), cx: 0, cz: 0 });
  }
  const pleats = o.pleats || S.pleats || 0, pAmp = S.pAmp || 0.05, wave = (o.wave !== undefined && o.wave !== null ? o.wave : S.wave || 0), waves = S.waves || 3;
  const shape = (r, a) => {
    const out = {};
    if (pleats) out.dr = pAmp * Math.sin(pleats * a) * Math.pow(r.t, 1.3);
    if (wave) out.dy = wave * Math.sin(waves * a + 0.6) * Math.pow(r.t, 3);
    return out;
  };
  return { rings, shape, len, seg: pleats ? Math.max(14, pleats * 2) : (style === "ball" ? 14 : 10) };
}

/* ── clothing: torso shells, sleeves, hood ──────────────────────────── */
const TOPS = {
  /*            ease   sleeve (upper,lower lengths)  hem band   notes
     hem  = y of the lower edge (default just under the waist)   top = y of the upper edge */
  hoodie:     { ease: 0.020, up: 0.27, lo: 0.25, cuff: true, hood: true, pocket: true, hemBand: 0.018 },
  sweater:    { ease: 0.020, up: 0.27, lo: 0.25, cuff: true, collar: "crew", hemBand: 0.016 },
  longsleeve: { ease: 0.012, up: 0.27, lo: 0.25, cuff: false, collar: "crew" },
  tshirt:     { ease: 0.012, up: 0.15, lo: 0.00, cuff: false, collar: "crew" },
  vneck:      { ease: 0.010, up: 0.14, lo: 0.00, cuff: false, collar: "v" },
  tank:       { ease: 0.008, up: 0.00, lo: 0.00, cuff: false, collar: "scoop", tank: true },
  jacket:     { ease: 0.028, up: 0.27, lo: 0.25, cuff: true, collar: "crew", hemBand: 0.012, placket: true, pocket: true },
  bomber:     { ease: 0.030, up: 0.27, lo: 0.25, cuff: true, collar: "crew", hemBand: 0.024, placket: true, hem: 0.00 },
  suit:       { ease: 0.022, up: 0.27, lo: 0.25, cuff: false, collar: "v", lapel: true, hem: -0.10 },
  polo:       { ease: 0.012, up: 0.15, lo: 0.00, cuff: false, collar: "crew", placket: true },
  jersey:     { ease: 0.016, up: 0.10, lo: 0.00, cuff: false, collar: "v", hem: -0.06 },
  croptop:    { ease: 0.008, up: 0.14, lo: 0.00, cuff: false, collar: "scoop", hem: 0.16 },
  turtleneck: { ease: 0.014, up: 0.27, lo: 0.25, cuff: false, collar: "turtle" },
  singlet:    { ease: 0.008, up: 0.00, lo: 0.00, cuff: false, collar: "scoop", tank: true, hem: -0.04 },
  tube:       { ease: 0.008, up: 0.00, lo: 0.00, cuff: false, tank: true, strapless: true, topY: 0.30 },
  dashiki:    { ease: 0.026, up: 0.15, lo: 0.00, cuff: false, collar: "crew", hem: -0.16, flare: 0.6, trim: true },
  kaftan:     { ease: 0.030, up: 0.27, lo: 0.25, cuff: false, collar: "crew", hem: -0.30, flare: 0.9 },
  agbada:     { ease: 0.046, up: 0.27, lo: 0.25, cuff: false, collar: "crew", hem: -0.36, flare: 1.2, wide: 0.034, trim: true },
};
export const TOP_STYLES = [...Object.keys(TOPS), "dress", "none"];

function buildTorso(rig, B, M, o) {
  const spine = rig.spine;
  /* skin torso (always — it shows through sleeveless tops and under tops) */
  const skinRings = ringsFrom(T_Y0, T_Y1, 10, { rx: B.torsoRx, rz: B.torsoRz });
  const bust = B.bust;
  const bustShape = (r, a) => {
    if (!bust) return null;
    const front = Math.max(0, Math.cos(a));
    const bump = Math.exp(-Math.pow((r.y - 0.262) / 0.050, 2));
    const side = Math.pow(front, 3) * Math.abs(Math.sin(a)) > 0.0 ? 1 : 1;
    return { dz: bust * bump * Math.pow(front, 2.2) };
  };
  mesh(loft(skinRings, { seg: 10, shape: bustShape }), M.skin, spine);

  /* pelvis (hips space) */
  const pelv = ringsFrom(-0.115, 0.065, 6, { rx: B.pelvRx, rz: B.pelvRz });
  rig._pelvisRings = pelv;
  return { skinRings, bustShape, pelv };
}

function buildTopShell(rig, B, M, o, T) {
  const spine = rig.spine, style = o.top;
  if (style === "none" || style === "dress") return;
  const S = TOPS[style] || TOPS.tshirt;
  const e = S.ease;
  const y0 = S.hem !== undefined ? S.hem : (S.tank ? 0.00 : -0.02);
  const y1 = S.topY !== undefined ? S.topY : (S.tank ? 0.33 : T_Y1);
  const rr = [];
  const n = y0 < -0.05 ? 14 : 11;
  const hipW = B.pelvRx[2] + 0.016, hipD = B.pelvRz[2] + 0.016;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), y = lerp(y0, y1, t), tt = (y - T_Y0) / (T_Y1 - T_Y0);
    let w = spline(B.torsoRx, tt) + e, d = spline(B.torsoRz, tt) + e;
    if (y < -0.02) {                       /* below the waist: cover the hips, optionally flare */
      const k = clamp((-0.02 - y) / 0.34, 0, 1);
      w = Math.max(w, hipW * lerp(0.94, 1, k)) * (1 + 0.20 * (S.flare || 0) * k);
      d = Math.max(d, hipD * lerp(0.94, 1, k)) * (1 + 0.14 * (S.flare || 0) * k);
    }
    if (i === 0 && S.hemBand) { w += S.hemBand; d += S.hemBand; }
    if (i === 1 && S.hemBand) { w += S.hemBand * 0.4; d += S.hemBand * 0.4; }
    rr.push({ y, t, rx: w, rz: d, cx: 0, cz: 0 });
  }
  const bustShape = T.bustShape;
  const shell = loft(rr, { seg: 10, caps: false, shape: bustShape,
    skip: S.tank ? null : null });
  mesh(shell, M.top, spine);
  /* closed top for tanks: straps */
  if (S.tank && !S.strapless) {
    for (const sd of [-1, 1]) {
      const st = mesh(boxGeo(0.040, 0.090, 0.020), M.top, spine, (B.shoulderX - 0.070) * sd, 0.352, 0.0);
      st.rotation.z = 0.10 * sd;
    }
  }
  /* collar */
  const neckR = B.neck;
  if (S.hood) {
    /* hood: a collar ring + the pouch hanging behind the neck */
    const ring = mesh(nonIdx(new THREE.TorusGeometry(neckR + 0.036, 0.026, 5, 10)), M.top, spine, 0, 0.424, 0.006);
    ring.geometry.computeVertexNormals(); ring.rotation.x = Math.PI / 2 - 0.42;
    const pouch = loft([
      { y: 0.318, t: 0, rx: 0.100, rz: 0.040, cx: 0, cz: -0.070 },
      { y: 0.372, t: .35, rx: 0.098, rz: 0.058, cx: 0, cz: -0.082 },
      { y: 0.424, t: .7, rx: 0.074, rz: 0.058, cx: 0, cz: -0.088 },
      { y: 0.462, t: 1, rx: 0.030, rz: 0.030, cx: 0, cz: -0.090 },
    ], { seg: 8, caps: "top" });
    mesh(pouch, M.top, spine);
  } else if (S.collar === "crew") {
    const ring = mesh(nonIdx(new THREE.TorusGeometry(neckR + 0.014, 0.012, 5, 9)), M.topD, spine, 0, 0.432, 0.004);
    ring.geometry.computeVertexNormals(); ring.rotation.x = Math.PI / 2 - 0.22;
  } else if (S.collar === "turtle") {
    mesh(loft([
      { y: 0.405, t: 0, rx: neckR + 0.026, rz: neckR + 0.026, cx: 0, cz: 0.004 },
      { y: 0.470, t: 1, rx: neckR + 0.020, rz: neckR + 0.020, cx: 0, cz: 0.004 },
    ], { seg: 8, caps: false }), M.topD, spine);
  }
  if (S.lapel) {
    for (const sd of [-1, 1]) {
      const lp = mesh(boxGeo(0.044, 0.150, 0.012), M.topD, spine, 0.050 * sd, 0.330, spline(B.torsoRz, 0.78) + 0.014);
      lp.rotation.z = -0.38 * sd; lp.rotation.x = -0.10;
    }
  }
  if (S.placket) {
    mesh(boxGeo(0.016, 0.300, 0.010), M.topD, spine, 0, 0.250, spline(B.torsoRz, 0.58) + 0.010);
  }
  if (S.trim) {
    const zb = spline(B.torsoRz, 0.62) + 0.012;
    mesh(boxGeo(0.090, 0.200, 0.008), M.topD, spine, 0, 0.300, zb);
  }
  if (S.pocket) {
    const p = mesh(boxGeo(0.170, 0.070, 0.020), M.topD, spine, 0, 0.075, spline(B.torsoRz, 0.17) + 0.016);
    p.rotation.x = -0.08;
  }
}

function buildSleeve(group, B, M, o, side, which, S) {
  /* which: "up" (in shoulder group, y 0 → -0.27)  | "lo" (in elbow group, y 0 → -0.25) */
  const e = S.ease * 0.55 + 0.004 + (S.wide || 0) * (which === "lo" ? 1.2 : 0.7);
  if (which === "up") {
    const len = Math.min(0.27, S.up);
    if (len <= 0) return;
    const rr = [];
    for (let i = 0; i < 5; i++) {
      const t = i / 4, y = lerp(0.012, -len, t), tt = Math.min(1, -y / 0.27);
      rr.push({ y, t, rx: lerp(B.armTop + 0.004, B.armElbow, Math.max(0, tt)) + e, rz: lerp(B.armTop + 0.004, B.armElbow, Math.max(0, tt)) * 0.96 + e, cx: 0, cz: 0 });
    }
    mesh(loft(rr, { seg: 7, caps: len >= 0.27 ? false : "bottom" }), M.top, group);
    mesh(blobGeo(B.armTop + e + 0.002, 0), M.top, group, 0, 0.0, 0);      /* shoulder cap */
  } else {
    const len = S.lo;
    if (len <= 0) return;
    const rr = [];
    for (let i = 0; i < 5; i++) {
      const t = i / 4, y = lerp(0.045, -len, t);
      const tt = Math.max(0, -y / 0.25);
      rr.push({ y, t, rx: lerp(B.armElbow, B.armWrist, tt) + e + (S.cuff && i === 4 ? 0.004 : 0), rz: lerp(B.armElbow, B.armWrist, tt) * 0.96 + e + (S.cuff && i === 4 ? 0.004 : 0), cx: 0, cz: 0 });
    }
    mesh(loft(rr, { seg: 7, caps: false }), M.top, group);
    mesh(blobGeo(B.armElbow + e + 0.004, 0), M.top, group, 0, 0.0, 0);   /* elbow ball hides the bend */
    if (S.cuff) mesh(loft([{ y: -len, rx: B.armWrist + e + 0.012, rz: B.armWrist + e + 0.012, t: 0 }, { y: -len + 0.030, rx: B.armWrist + e + 0.010, rz: B.armWrist + e + 0.010, t: 1 }], { seg: 7, caps: false }), M.topD, group);
  }
}

/* ── arms ───────────────────────────────────────────────────────────── */
function buildArm(rig, ctx, side) {
  const { B, M, o, spine, S } = ctx;
  const g = {};
  const shoulder = new THREE.Group();
  shoulder.position.set(B.shoulderX * side, 0.350, 0);
  spine.add(shoulder); g.shoulder = shoulder;

  const upper = ringsFrom(-0.27, 0.0, 4, { rx: [B.armElbow, B.armElbow * 1.12, B.armTop * 0.98, B.armTop], rz: [B.armElbow * 0.96, B.armElbow * 1.08, B.armTop * 0.94, B.armTop * 0.96] });
  mesh(loft(upper, { seg: 7, caps: false }), M.skin, shoulder);
  mesh(blobGeo(B.armTop * 1.04, 0), M.skin, shoulder, 0, 0.004, 0);

  const elbow = new THREE.Group(); elbow.position.y = -0.270; shoulder.add(elbow); g.elbow = elbow;
  const lower = ringsFrom(-0.25, 0.0, 4, { rx: [B.armWrist, B.armWrist * 1.1, B.armElbow * 1.06, B.armElbow], rz: [B.armWrist * 0.92, B.armWrist * 1.0, B.armElbow * 1.0, B.armElbow * 0.96] });
  mesh(loft(lower, { seg: 7, caps: false }), M.skin, elbow);
  mesh(blobGeo(B.armElbow * 1.02, 0), M.skin, elbow, 0, 0, 0);

  if (S && o.top !== "none" && o.top !== "dress") {
    buildSleeve(shoulder, B, M, o, side, "up", S);
    buildSleeve(elbow, B, M, o, side, "lo", S);
  }

  const wrist = new THREE.Group(); wrist.position.y = -0.250; elbow.add(wrist); g.wrist = wrist;
  const hs = B.hand;
  /* palm: a flattened faceted block */
  const palm = mesh(loft([
    { y: -0.095 * hs, rx: 0.026 * hs, rz: 0.011 * hs, t: 0 },
    { y: -0.050 * hs, rx: 0.033 * hs, rz: 0.014 * hs, t: .5 },
    { y: 0.000, rx: B.armWrist * 0.95, rz: B.armWrist * 0.80, t: 1 },
  ], { seg: 6 }), M.skin, wrist);
  /* thumb */
  const thumb = new THREE.Group(); thumb.position.set(-0.030 * side * hs, -0.030 * hs, 0.006); wrist.add(thumb); g.thumb = thumb;
  mesh(loft([
    { y: -0.040 * hs, rx: 0.0085 * hs, rz: 0.0085 * hs, t: 0 },
    { y: 0.000, rx: 0.013 * hs, rz: 0.012 * hs, t: 1 },
  ], { seg: 5 }), M.skin, thumb, 0, 0, 0);
  /* fingers: four short faceted bars, two joints each (same grip rig as the classic body) */
  const fingers = [];
  for (let f = 0; f < 4; f++) {
    const fg = new THREE.Group(); fg.position.set((f - 1.5) * 0.0165 * hs, -0.088 * hs, 0.006); wrist.add(fg);
    mesh(boxGeo(0.0145 * hs, 0.030 * hs, 0.0135 * hs), M.skin, fg, 0, -0.014 * hs, 0);
    const mid = new THREE.Group(); mid.position.y = -0.028 * hs; fg.add(mid);
    mesh(boxGeo(0.0128 * hs, 0.024 * hs, 0.0120 * hs), M.skin, mid, 0, -0.011 * hs, 0);
    fingers.push({ group: fg, midJoint: mid });
  }
  g.fingers = fingers;
  const grip = new THREE.Group(); grip.position.set(0, -0.075, 0.005); wrist.add(grip); g.grip = grip;
  return g;
}

/* ── legs, trousers, shoes ──────────────────────────────────────────── */
const BOTTOMS = {
  pants:    { kind: "pants",  ease: 0.020, hem: 0.000, taper: 1.00 },
  jeans:    { kind: "pants",  ease: 0.018, hem: 0.000, taper: 0.96 },
  baggy:    { kind: "pants",  ease: 0.034, hem: 0.000, taper: 1.30 },
  tracksuit:{ kind: "pants",  ease: 0.022, hem: 0.000, taper: 1.02 },
  cargo:    { kind: "pants",  ease: 0.028, hem: 0.000, taper: 1.10 },
  palazzo:  { kind: "pants",  ease: 0.046, hem: 0.000, taper: 1.62 },
  leggings: { kind: "pants",  ease: 0.004, hem: 0.000, taper: 0.94 },
  shorts:   { kind: "shorts", ease: 0.016, len: 0.24 },
  bermuda:  { kind: "shorts", ease: 0.020, len: 0.38 },
  skirt:    { kind: "skirt" },
  none:     { kind: "none" },
};
export const BOTTOM_STYLES = Object.keys(BOTTOMS);

function buildLeg(rig, ctx, side) {
  const { B, M, o, hips, BT, dressMode } = ctx;
  const g = {};
  const hip = new THREE.Group(); hip.position.set(B.hipX * side, -0.010, 0); hips.add(hip); g.hip = hip;
  const knee = new THREE.Group(); knee.position.y = -0.420; hip.add(knee); g.knee = knee;
  const ankle = new THREE.Group(); ankle.position.y = -0.400; knee.add(ankle); g.ankle = ankle;

  const thigh = ringsFrom(-0.42, 0, 5, { rx: [B.thighBot, B.thighBot * 1.06, B.thighTop * 0.96, B.thighTop * 1.04, B.thighTop * 0.98], rz: [B.thighBot, B.thighBot * 1.08, B.thighTop * 0.98, B.thighTop * 1.08, B.thighTop * 1.0] });
  mesh(loft(thigh, { seg: 7, caps: false }), M.skin, hip);
  const calf = ringsFrom(-0.40, 0, 5, { rx: [B.calfBot, B.calfBot * 1.2, B.calfTop * 1.0, B.calfTop * 1.02, B.thighBot * 0.98], rz: [B.calfBot, B.calfBot * 1.25, B.calfTop * 1.08, B.calfTop * 1.04, B.thighBot] });
  mesh(loft(calf, { seg: 7, caps: false }), M.skin, knee);
  mesh(blobGeo(B.thighBot * 1.0, 0), M.skin, knee, 0, 0, 0);

  const kind = dressMode ? "none" : BT.kind;
  if (kind === "pants" || kind === "shorts") {
    const e = BT.ease;
    const tp = BT.taper || 1;
    const rt = (v) => v * tp;
    const thLen = kind === "shorts" ? BT.len : 0.42;
    const tr = [];
    for (let i = 0; i < 5; i++) {
      const t = i / 4, y = lerp(0.012, -thLen, t), tt = Math.min(1, -y / 0.42);
      const r = lerp(B.thighTop, B.thighBot, tt);
      tr.push({ y, t, rx: rt(r) + e, rz: rt(r) * 1.06 + e, cx: 0, cz: 0 });
    }
    mesh(loft(tr, { seg: 7, caps: false }), M.bottom, hip);
    if (kind === "pants") {
      const cr = [];
      for (let i = 0; i < 5; i++) {
        const t = i / 4, y = lerp(0.012, -0.385, t), r = lerp(B.calfTop * 0.98, B.calfBot * 1.02, t);
        cr.push({ y, t, rx: rt(r) + e + (i === 4 ? 0.008 : 0), rz: rt(r) * 1.04 + e + (i === 4 ? 0.008 : 0), cx: 0, cz: 0 });
      }
      mesh(loft(cr, { seg: 7, caps: false }), M.bottom, knee);
    }
  }
  buildShoe(g, ctx, side);
  return g;
}

/* shoes: lofts swept along Z (built along Y then rotated) */
export const SHOE_STYLES = ["sneaker", "boot", "formal", "heels", "barefoot"];
function buildShoe(g, ctx) {
  const { B, M, o } = ctx;
  const ankle = g.ankle, fs = B.foot;
  let style = o.shoeStyle || "sneaker";
  if (!SHOE_STYLES.includes(style)) style = "sneaker";
  /* rings: z (toe forward), half-width, half-height, centre height */
  const P = {
    sneaker: [[-0.070, .029, .038, -.064], [-0.030, .038, .041, -.062], [0.060, .046, .034, -.070], [0.130, .036, .026, -.078], [0.172, .016, .016, -.086]],
    boot:    [[-0.070, .032, .046, -.058], [-0.030, .040, .050, -.056], [0.060, .047, .036, -.068], [0.130, .037, .028, -.077], [0.168, .020, .018, -.085]],
    formal:  [[-0.068, .028, .036, -.066], [-0.030, .036, .038, -.064], [0.060, .042, .028, -.075], [0.140, .030, .022, -.082], [0.190, .010, .012, -.090]],
    heels:   [[-0.066, .026, .034, -.048], [-0.030, .033, .034, -.046], [0.050, .040, .026, -.058], [0.120, .030, .020, -.070], [0.160, .012, .014, -.080]],
    barefoot:[[-0.066, .026, .030, -.074], [-0.030, .034, .031, -.072], [0.060, .040, .024, -.080], [0.125, .032, .018, -.086], [0.160, .014, .012, -.090]],
  }[style];
  const mat = style === "barefoot" ? M.skin : M.shoes;
  const rings = P.map(([z, w, h, cy]) => ({ y: z * fs, rx: w * fs, rz: h, cx: 0, cz: -cy }));
  const geo = loft(rings, { seg: 6, caps: true, phase: 0 });
  geo.rotateX(Math.PI / 2);            /* sweep axis Y → Z, vertical = old -Z */
  geo.computeVertexNormals();
  mesh(geo, mat, ankle);
  if (style !== "barefoot") {
    const soleRings = P.map(([z, w, h, cy], i) => ({ y: z * fs, rx: (w + 0.004) * fs, rz: 0.0115, cz: (style === "heels" && i < 2) ? 0.084 : 0.0985 }));
    const sg = loft(soleRings, { seg: 6, caps: true, phase: 0 });
    sg.rotateX(Math.PI / 2); sg.computeVertexNormals();
    mesh(sg, M.sole, ankle);
  }
  if (style === "boot") {
    const sh = ringsFrom(-0.100, 0.010, 4, { rx: [0.050, 0.047, 0.045, 0.047], rz: [0.052, 0.048, 0.046, 0.048] });
    sh.forEach((r) => { r.y += 0; });
    mesh(loft(sh, { seg: 7, caps: false }), M.shoes, ankle, 0, 0.060, 0);
  } else if (style !== "barefoot") {
    /* shoe collar/ankle: short cuff so the leg disappears into the shoe */
    const sh = ringsFrom(-0.070, 0.004, 3, { rx: [0.046, 0.044, 0.044], rz: [0.048, 0.045, 0.045] });
    mesh(loft(sh, { seg: 7, caps: false }), M.shoes, ankle, 0, 0.0, -0.004);
  }
}

/* ── pelvis + skirt ─────────────────────────────────────────────────── */
function buildPelvis(rig, ctx) {
  const { B, M, o, hips, BT, T, dressMode } = ctx;
  const pelv = T.pelv;
  const kind = dressMode ? "dress" : BT.kind;
  /* skin underneath */
  mesh(loft(pelv, { seg: 10, caps: "bottom" }), M.skin, hips);
  if (kind === "pants" || kind === "shorts") {
    const e = BT.ease + 0.004;
    const pr = pelv.map((r) => ({ ...r, rx: r.rx + e, rz: r.rz + e }));
    mesh(loft(pr, { seg: 10, caps: "bottom" }), M.bottom, hips);
    /* belt line */
    const belt = loft([{ y: 0.052, rx: pelv[5].rx + e + 0.008, rz: pelv[5].rz + e + 0.008, t: 0 }, { y: 0.075, rx: pelv[5].rx + e + 0.008, rz: pelv[5].rz + e + 0.008, t: 1 }], { seg: 10, caps: false });
    if (o.top === "none" || o.top === "tank") mesh(belt, M.bottom, hips);
  }
}

function buildSkirt(rig, ctx, kindDress) {
  const { B, hips, M, o } = ctx;
  const d = o.dress || DEFAULTS.dress;
  const sk = skirtRings(d.style || "aline", d, B);
  const sm = kindDress ? M.top : M.bottom;
  const geo = loft(sk.rings, { seg: sk.seg, caps: false, shape: sk.shape });
  mesh(geo, sm, hips);
  /* waist band */
  const w = sk.rings[0];
  mesh(loft([{ y: 0.062, rx: w.rx * 0.93, rz: w.rz * 0.93, t: 0 }, { y: 0.036, rx: w.rx, rz: w.rz, t: 1 }], { seg: sk.seg, caps: false }), kindDress ? M.top : M.bottom, hips);
}

function buildDressBodice(rig, ctx, T) {
  const { B, M, spine } = ctx;
  const rr = [];
  const n = 9, y0 = -0.02, y1 = 0.335;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), y = lerp(y0, y1, t), tt = (y - T_Y0) / (T_Y1 - T_Y0);
    rr.push({ y, t, rx: spline(B.torsoRx, tt) + 0.007, rz: spline(B.torsoRz, tt) + 0.007, cx: 0, cz: 0 });
  }
  mesh(loft(rr, { seg: 10, caps: false, shape: T.bustShape }), M.top, spine);
  for (const sd of [-1, 1]) {
    const st = mesh(boxGeo(0.034, 0.085, 0.018), M.top, spine, (B.shoulderX - 0.080) * sd, 0.350, 0.0);
    st.rotation.z = 0.10 * sd;
  }
}

/* ══ public API ═════════════════════════════════════════════════════════ */
export function buildFaceted(options) {
  const o = Object.assign({}, DEFAULTS, options || {});
  o.dress = Object.assign({}, DEFAULTS.dress, (options && options.dress) || {});
  const root = new THREE.Group();
  const rig = {};
  buildInto(root, rig, o);
  return { root, rig, options: o };
}

/* rebuild in place (keeps the same root + rig objects, like the classic applyConfig) */
export function applyFaceted(character, options) {
  const { root, rig } = character;
  for (const c of root.children.slice()) {
    if (c.userData && c.userData.keepOnRebuild) continue;
    root.remove(c);
    c.traverse((n) => { if (n.geometry) n.geometry.dispose(); });
  }
  for (const k of Object.keys(rig)) delete rig[k];
  const o = Object.assign({}, DEFAULTS, options || {});
  o.dress = Object.assign({}, DEFAULTS.dress, (options && options.dress) || {});
  buildInto(root, rig, o);
  character.options = o;
  return character;
}

function buildInto(root, rig, o, ext) {
  const B = bodySpec(o.body, o.build);
  let M;
  if (ext) {
    /* the game's own Wardrobe materials: reuse them so live recolouring keeps working */
    ext.hair.side = THREE.DoubleSide;
    M = { skin: ext.skin, skinD: ext.skin, hair: ext.hair, hairDS: ext.hair, top: ext.top, topD: ext.top, bottom: ext.bottom,
          shoes: ext.shoes, sole: ext.shoes, eyeD: ext.eyeD, eyeW: ext.eyeW, mouth: ext.mouth };
  } else M = makeMats(o);
  const dressMode = o.top === "dress";
  if (!ext && dressMode && o.dress && o.dress.color) { M.dress = lam(o.dress.color, { side: THREE.DoubleSide }); M.top = M.dress; }
  if (!ext) rig.mats = M;
  rig.measures = B;

  const sc = new THREE.Group(); sc.scale.setScalar(B.scale * (o.height || 1)); root.add(sc); rig.scaleGroup = sc;

  const hips = new THREE.Group(); hips.position.y = HIP_HEIGHT; sc.add(hips); rig.hips = hips;
  const spine = new THREE.Group(); spine.position.y = 0.06; hips.add(spine); rig.spine = spine;

  const BT = BOTTOMS[o.bottom] || BOTTOMS.pants;
  const S = dressMode ? null : (TOPS[o.top] || null);
  const ctx = { B, M, o, hips, spine, BT, S, dressMode };

  const T = buildTorso(rig, B, M, o);
  ctx.T = T;
  buildPelvis(rig, ctx);
  if (dressMode) { buildDressBodice(rig, ctx, T); buildSkirt(rig, ctx, true); }
  else {
    buildTopShell(rig, B, M, o, T);
    if (BT.kind === "skirt") buildSkirt(rig, ctx, false);
  }

  /* neck + head */
  const neck = new THREE.Group(); neck.position.y = 0.40; spine.add(neck); rig.neck = neck;
  mesh(loft(ringsFrom(-0.03, 0.115, 3, { rx: [B.neck * 1.1, B.neck, B.neck * 0.94], rz: [B.neck * 1.1, B.neck, B.neck * 0.94] }), { seg: 6, caps: false }), M.skin, neck);
  const head = new THREE.Group(); head.position.y = 0.118; head.scale.setScalar(B.headScale); neck.add(head); rig.head = head;
  const rings = buildHead(rig, B, M, o);
  buildHair(rig, B, M, o, rings);

  rig.armL = buildArm(rig, { B, M, o, spine, S }, +1);
  rig.armR = buildArm(rig, { B, M, o, spine, S }, -1);
  rig.legL = buildLeg(rig, ctx, +1);
  rig.legR = buildLeg(rig, ctx, -1);
  root.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = false; } });
}

/* convenience: map the game's Wardrobe config onto faceted options (used by the
   optional "Faceted" look in lowpoly.js). Unknown styles fall back to the nearest. */
const TOP_MAP = { tshirt: "tshirt", longsleeve: "longsleeve", hoodie: "hoodie", tank: "tank", singlet: "singlet", vneck: "vneck",
  sweater: "sweater", turtleneck: "turtleneck", polo: "polo", jersey: "jersey", croptop: "croptop", tube: "tube", jacket: "jacket",
  bomber: "bomber", suit: "suit", dashiki: "dashiki", kaftan: "kaftan", agbada: "agbada", dress: "dress" };
const BOTTOM_MAP = { jeans: "jeans", shorts: "shorts", tracksuit: "tracksuit", baggy: "baggy", cargo: "cargo", bermuda: "bermuda",
  leggings: "leggings", skirt: "skirt", miniskirt: "skirt", palazzo: "palazzo" };
const SHOE_MAP = { sneakers: "sneaker", hightops: "sneaker", cleats: "sneaker", boots: "boot", wellies: "boot", formal: "formal",
  loafers: "formal", heels: "heels", barefoot: "barefoot", sandals: "barefoot", slippers: "barefoot", flipflops: "barefoot" };
const HAIR_MAP = { short: "short", buzz: "buzz", curly: "afro", long: "long", ponytail: "ponytail", bald: "bald", afro: "afro", bun: "bun",
  bob: "bob", braids: "long", locs: "long", mohawk: "buzz", hightop: "short", pigtails: "ponytail", knots: "bun", pompadour: "short" };
export function facetedOptionsFromConfig(cfg, colors) {
  const c = colors || {};
  const body = cfg.gender === "masculine" ? "male" : cfg.gender === "feminine" ? "female" : "neutral";
  const top = TOP_MAP[cfg.topStyle] || "tshirt";
  const bs = cfg.bottomStyle;
  const ds = cfg.dressStyle && cfg.dressStyle !== "auto" && DRESS_STYLES.includes(cfg.dressStyle) ? cfg.dressStyle : null;
  const skirtStyle = ds ? { style: ds }
    : bs === "miniskirt" ? { style: "skater", length: 0.28 }
    : bs === "skirt" ? { style: "aline", length: 0.50 }
    : { style: "aline" };
  return Object.assign({
    body, build: cfg.build || 0,
    hair: HAIR_MAP[cfg.hairStyle] || "short",
    top, bottom: BOTTOM_MAP[bs] || "jeans",
    shoeStyle: SHOE_MAP[cfg.shoeStyle] || "sneaker",
    dress: Object.assign({}, DEFAULTS.dress, skirtStyle),
  }, c);
}

/* Entry point used by lowpoly.js when config.look === "faceted": same Wardrobe config and
   materials as the classic builder, faceted geometry. */
export function buildFacetedInto(root, rig, config, mats) {
  const hex = (m) => "#" + m.color.getHexString();
  const o = facetedOptionsFromConfig(config, {
    skin: hex(mats.skin), hairColor: hex(mats.hair), topColor: hex(mats.top),
    bottomColor: hex(mats.bottom), shoeColor: hex(mats.shoes),
  });
  const full = Object.assign({}, DEFAULTS, o);
  full.dress = Object.assign({}, DEFAULTS.dress, o.dress || {});
  buildInto(root, rig, full, mats);
}
