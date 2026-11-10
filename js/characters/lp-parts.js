/* ═══════════════════════════════════════════════════════════
   lp-parts.js — small geometry / material helpers shared by the
   low-poly character builders (lowpoly.js + lp-*.js).
   ═══════════════════════════════════════════════════════════ */
import * as THREE from "three";

export const V2 = (x, y) => new THREE.Vector2(x, y);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/* Lathe through a profile with rounded caps (profile = [{y, r}] bottom→top). */
export function revolve(profile, { radial = 10, capSeg = 4, capBottom = 1, capTop = 1 } = {}) {
  const pts = [];
  const lo = profile[0];
  for (let i = 0; i <= capSeg; i++) {
    const a = -Math.PI / 2 + (i / capSeg) * (Math.PI / 2);
    pts.push(V2(Math.max(0, Math.cos(a)) * lo.r, lo.y + Math.sin(a) * lo.r * capBottom));
  }
  for (let i = 1; i < profile.length; i++) pts.push(V2(profile[i].r, profile[i].y));
  const hi = profile[profile.length - 1];
  for (let i = 1; i <= capSeg; i++) {
    const a = (i / capSeg) * (Math.PI / 2);
    pts.push(V2(Math.max(0, Math.cos(a)) * hi.r, hi.y + Math.sin(a) * hi.r * capTop));
  }
  return new THREE.LatheGeometry(pts, radial);
}

/* A capsule-ish limb segment hanging DOWN from y = 0 to y = -length. */
export function bone(rTop, rBot, length, radial = 8) {
  return revolve(
    [{ y: -length, r: rBot }, { y: 0, r: rTop }],
    { radial, capSeg: 3, capBottom: 1, capTop: 1 }
  );
}

/* Linear interpolation of a [{y, r}] profile. */
export function rAt(rows, y) {
  if (y <= rows[0].y) return rows[0].r;
  for (let i = 1; i < rows.length; i++) {
    if (y <= rows[i].y) {
      const t = (y - rows[i - 1].y) / ((rows[i].y - rows[i - 1].y) || 1);
      return lerp(rows[i - 1].r, rows[i].r, t);
    }
  }
  return rows[rows.length - 1].r;
}

/* Open lathe "shell" (cloth). Unlike LatheGeometry it can have a hole cut
   into it — `cut(x, y, z)` returns true for the part of the surface to omit
   (neckline, armhole …). a = 0 faces +Z (front). Normals are analytic so the
   seam at the back stays smooth. */
export function shellGeo(rows, aSeg = 32, cut = null) {
  const nR = rows.length;
  const pos = [], nor = [], uv = [], idx = [];
  const y0 = rows[0].y, span = (rows[nR - 1].y - y0) || 1;
  for (let j = 0; j < nR; j++) {
    const { y, r } = rows[j];
    const j0 = Math.max(0, j - 1), j1 = Math.min(nR - 1, j + 1);
    const dr = rows[j1].r - rows[j0].r;
    const dy = (rows[j1].y - rows[j0].y) || 1e-6;
    let nrad = dy, ny = -dr;
    const l = Math.hypot(nrad, ny) || 1; nrad /= l; ny /= l;
    for (let i = 0; i <= aSeg; i++) {
      const a = (i / aSeg) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
      pos.push(r * s, y, r * c);
      nor.push(nrad * s, ny, nrad * c);
      uv.push(i / aSeg, (y - y0) / span);
    }
  }
  for (let j = 0; j < nR - 1; j++) {
    for (let i = 0; i < aSeg; i++) {
      if (cut) {
        const rm = (rows[j].r + rows[j + 1].r) / 2, ym = (rows[j].y + rows[j + 1].y) / 2;
        const am = ((i + 0.5) / aSeg) * Math.PI * 2;
        if (cut(rm * Math.sin(am), ym, rm * Math.cos(am))) continue;
      }
      const a = j * (aSeg + 1) + i, b = a + 1, c = a + (aSeg + 1), d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/* ── materials (cached per colour so a crowd shares them) ── */
const _lam = new Map();
export function lam(color, opts) {
  const hex = new THREE.Color(color).getHexString();
  const key = hex + (opts ? JSON.stringify(opts) : "");
  let m = _lam.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial(Object.assign({ color: new THREE.Color(color) }, opts || {}));
    _lam.set(key, m);
  }
  return m;
}
const _basic = new Map();
export function glow(color) {
  const hex = new THREE.Color(color).getHexString();
  let m = _basic.get(hex);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) }); _basic.set(hex, m); }
  return m;
}
/* double-sided cloth (open shells) */
export function cloth(color) { return lam(color, { side: THREE.DoubleSide }); }

export function shade(color, dl) {
  return new THREE.Color(color).offsetHSL(0, 0, dl);
}

/* add a mesh to a parent with position (+ optional rotation / scale) */
export function mk(geo, mat, parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}

export function sphere(r, ws = 8, hs = 6) { return new THREE.SphereGeometry(r, ws, hs); }
export function box(x, y, z) { return new THREE.BoxGeometry(x, y, z); }
export function cyl(rt, rb, h, seg = 10, open = false) { return new THREE.CylinderGeometry(rt, rb, h, seg, 1, open); }
export function torus(R, r, rs = 6, ts = 14, arc = Math.PI * 2) { return new THREE.TorusGeometry(R, r, rs, ts, arc); }
export function cone(r, h, seg = 8) { return new THREE.ConeGeometry(r, h, seg); }

/* a thin ring lying flat around the Y axis (belts, cuffs, hems, collars) */
export function ring(parent, mat, R, thick, y, sx = 1, sz = 1, seg = 16) {
  const m = mk(torus(R, thick, 5, seg), mat, parent, 0, y, 0, Math.PI / 2, 0, 0);
  m.scale.set(sx, sz, 1);          /* after the X-rotation, local Y → world Z */
  return m;
}

/* ═══════════════════════════════════════════════════════════
   Body measurements — ONE place decides how wide / deep the body is, and
   every garment is built from these numbers so clothes always sit on the
   body (shoulders, hips, legs follow gender + the Build slider).
   Torso rows are in spine space (y up from the waist join); pelvis rows in
   hips space. Radii are "tight garment" radii: skin sits ~5% inside them.
   ═══════════════════════════════════════════════════════════ */
export const HIP_HEIGHT = 0.935;

export function measures(cfg) {
  const female = cfg.gender === "feminine";
  const male   = cfg.gender === "masculine";
  const b = clamp(+cfg.build || 0, -1, 1);
  const sxT = (female ? 0.93 : male ? 1.06 : 1.00) * (1 + 0.16 * b);   /* torso width  */
  const szT = (female ? 0.68 : male ? 0.72 : 0.70) * (1 + 0.14 * b);   /* torso depth  */
  const sxP = (female ? 1.08 : male ? 0.98 : 1.00) * (1 + 0.13 * b);   /* pelvis width */
  const szP = (female ? 0.78 : 0.74)               * (1 + 0.11 * b);   /* pelvis depth */
  const limb = 1 + 0.10 * b;                                            /* limb thickness */
  const waistK = female ? 0.90 : male ? 0.97 : 0.94;

  /* world half-width where torso meets pelvis (the narrower of the two) */
  const joinW = Math.min(0.142 * sxT, 0.146 * sxP);
  const joinT = joinW / sxT;
  const joinP = joinW / sxP;

  const rows0 = [                                       /* torso, tight */
    { y: 0.000, r: joinT },
    { y: 0.050, r: Math.max(0.140 * waistK, joinT * 0.96) },
    { y: 0.115, r: 0.150 },
    { y: 0.190, r: 0.172 },
    { y: 0.280, r: 0.196 },
    { y: 0.355, r: 0.190 },
    { y: 0.390, r: 0.164 },
    { y: 0.412, r: 0.112 },
    { y: 0.430, r: 0.068 },
  ];
  const prows0 = [                                      /* pelvis, tight */
    { y: -0.110, r: 0.130 },
    { y: -0.060, r: 0.158 },
    { y: -0.010, r: 0.152 },
    { y:  0.030, r: (0.152 + joinP) * 0.5 },
    { y:  0.060, r: joinP },
  ];
  return {
    female, male, build: b, sxT, szT, sxP, szP, limb, waistK, joinW, joinT, joinP,
    rows0, prows0,
    shoulderX: 0.166 * sxT + 0.008,
    hipX: 0.081 * sxP,
    armTop: 0.056 * limb, armElbow: 0.046 * limb, armWrist: 0.036 * limb,
    thighTop: 0.084 * limb, thighBot: 0.069 * limb, calfTop: 0.066 * limb, calfBot: 0.046 * limb,
  };
}

/* world-space Z of the front of a torso shell at height y (spine space) */
export function frontZ(B, y, ease = 0, x = 0) {
  const r = rAt(B.rows0, y) + ease;
  const xx = x / B.sxT;
  return B.szT * Math.sqrt(Math.max(0, r * r - xx * xx));
}
