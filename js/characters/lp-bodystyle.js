/* lp-bodystyle.js — gives every purchasable BODY STYLE its own silhouette AND its own
   geometry. Works on both looks (classic + faceted) because both expose the same rig joints
   (hips › spine › neck › head, armL/armR {shoulder, elbow, wrist}, legL/legR {hip, knee, ankle}).

   Before this, styles only multiplied torso width by ±10%, so Heroic/Sleek/Angular/Refined/
   Elite/Classic all looked like the same body. Now each one has:
     • proportions: chest width/depth, head size, arm and leg thickness
     • signature parts: pauldrons + emblem + belt (Heroic), neon racing stripes (Sleek),
       spikes + ridges + fins (Angular), gold collar/belt/cuffs (Refined), glowing crystal
       facets (Faceted Elite), puffed round shoulders + soft belly (Classic).
   The default "faceted" style is untouched. */
import * as THREE from "three";

/* spine = [width, height, depth]; head = scale; arm/leg = thickness */
export const STYLE_PROPORTIONS = {
  classic:      { spine: [1.00, 1.00, 1.12], head: 1.08, arm: 1.08, leg: 1.06 },
  faceted_plus: { spine: [1.04, 1.02, 0.95], head: 1.00, arm: 0.98, leg: 0.98 },
  heroic:       { spine: [1.20, 1.06, 1.10], head: 0.97, arm: 1.16, leg: 1.08 },
  sleek:        { spine: [0.88, 1.03, 0.84], head: 0.94, arm: 0.84, leg: 0.86 },
  angular:      { spine: [1.08, 1.00, 0.92], head: 1.00, arm: 0.96, leg: 0.96 },
  refined:      { spine: [0.97, 1.01, 0.96], head: 0.98, arm: 0.94, leg: 0.95 },
};

const matCache = new Map();
function M(color, emissive = 0x000000, ei = 0) {
  const key = color + ":" + emissive + ":" + ei;
  let m = matCache.get(key);
  if (!m) { m = new THREE.MeshLambertMaterial({ color, flatShading: true, emissive, emissiveIntensity: ei }); matCache.set(key, m); }
  return m;
}
function add(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz);
  m.castShadow = false; m.receiveShadow = false; m.userData.bodyStyle = true;
  parent.add(m); return m;
}
const G = {
  sph: (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h),
  dome: (r) => new THREE.SphereGeometry(r, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
  box: (x, y, z) => new THREE.BoxGeometry(x, y, z),
  cyl: (r, h, s = 10) => new THREE.CylinderGeometry(r, r, h, s),
  cone: (r, h, s = 4) => new THREE.ConeGeometry(r, h, s),
  oct: (r) => new THREE.OctahedronGeometry(r, 0),
  ico: (r) => new THREE.IcosahedronGeometry(r, 0),
  tet: (r) => new THREE.TetrahedronGeometry(r, 0),
  tor: (r, t, rs = 5, ts = 14) => new THREE.TorusGeometry(r, t, rs, ts),
};

const BUILDERS = {
  /* soft, rounded, friendly: puffed shoulder caps in the top colour + a gentle belly */
  classic(rig, mats) {
    const top = mats.top || M(0x6aa7ff);
    for (const s of [-1, 1]) {
      const sh = (s > 0 ? rig.armL : rig.armR).shoulder;
      add(sh, G.sph(0.066, 10, 8), top, 0, 0.012, 0, 0, 0, 0, 1.05, 0.9, 1.05);
    }
    add(rig.spine, G.sph(0.115, 10, 8), top, 0, 0.115, 0.045, 0, 0, 0, 1.15, 0.85, 0.78);
  },

  /* crystal facets that glow: chest gem, shoulder shards, back fin */
  faceted_plus(rig) {
    const cy = M(0x35d6ff, 0x35d6ff, 0.9), vi = M(0x8a6bff, 0x7a5cff, 0.7);
    add(rig.spine, G.ico(0.046), cy, 0, 0.285, 0.152);
    add(rig.spine, G.oct(0.03), vi, 0, 0.215, 0.145, 0, 0, 0, 0.8, 1.5, 0.7);
    add(rig.spine, G.oct(0.05), vi, 0, 0.30, -0.150, 0, 0, 0, 0.55, 2.3, 0.35);
    for (const s of [-1, 1]) {
      const sh = (s > 0 ? rig.armL : rig.armR).shoulder;
      add(sh, G.oct(0.04), cy, 0.012 * s, 0.07, 0, 0, 0, -0.35 * s, 0.7, 1.9, 0.7);
      add(sh, G.tet(0.03), vi, 0.03 * s, 0.045, 0.035, 0.4, 0, 0, 1, 1.4, 1);
    }
    for (const s of [-1, 1]) {
      const leg = s > 0 ? rig.legL : rig.legR;
      add(leg.knee, G.oct(0.028), cy, 0, 0, 0.062, 0, 0, 0, 0.9, 1.3, 0.8);
    }
  },

  /* broad hero: gold pauldrons, red emblem, belt, bracers */
  heroic(rig) {
    const gold = M(0xd9ad3c, 0x4a3400, 0.25), red = M(0xc92a2a, 0x3a0000, 0.2), dark = M(0x2a2118);
    for (const s of [-1, 1]) {
      const arm = s > 0 ? rig.armL : rig.armR;
      add(arm.shoulder, G.dome(0.098), gold, 0.015 * s, 0.025, 0, 0, 0, -0.25 * s, 1.1, 0.9, 1.0);
      add(arm.shoulder, G.tor(0.088, 0.012, 5, 12), dark, 0.012 * s, 0.02, 0, Math.PI / 2, 0, -0.2 * s);
      add(arm.elbow, G.cyl(0.050, 0.095, 8), gold, 0, -0.12, 0, 0, 0, 0, 1, 1, 1.05);
    }
    add(rig.spine, G.cyl(0.050, 0.014, 12), red, 0, 0.285, 0.172, Math.PI / 2, 0, 0, 1.0, 1, 1.0);
    add(rig.spine, G.tor(0.052, 0.009, 5, 14), gold, 0, 0.285, 0.176, 0, 0, 0);
    add(rig.spine, G.tor(0.150, 0.016, 5, 20), gold, 0, 0.045, 0, Math.PI / 2, 0, 0, 1.12, 0.86, 1);
    add(rig.spine, G.box(0.065, 0.045, 0.02), gold, 0, 0.045, 0.125);
  },

  /* streamlined: glowing racing stripes + thin collar */
  sleek(rig) {
    const neon = M(0x2cf0ff, 0x2cf0ff, 1.0), dark = M(0x15212b);
    for (const s of [-1, 1]) {
      const arm = s > 0 ? rig.armL : rig.armR, leg = s > 0 ? rig.legL : rig.legR;
      add(rig.spine, G.box(0.010, 0.31, 0.048), neon, 0.172 * s, 0.215, 0.0);
      add(arm.shoulder, G.box(0.009, 0.46, 0.030), neon, 0.052 * s, -0.20, 0.0);
      add(leg.hip, G.box(0.010, 0.84, 0.040), neon, 0.071 * s, -0.40, 0.0);
      add(arm.wrist, G.tor(0.036, 0.007, 4, 12), dark, 0, -0.01, 0, Math.PI / 2, 0, 0);
    }
    add(rig.spine, G.tor(0.082, 0.008, 4, 14), neon, 0, 0.385, 0, Math.PI / 2, 0, 0);
    add(rig.spine, G.box(0.012, 0.36, 0.012), neon, 0, 0.21, 0.150);
  },

  /* sharp: shoulder spikes, chest ridge, forearm fins, knee wedges */
  angular(rig) {
    const steel = M(0x2b2e38), red = M(0xe0243c, 0x7a0010, 0.7);
    for (const s of [-1, 1]) {
      const arm = s > 0 ? rig.armL : rig.armR, leg = s > 0 ? rig.legL : rig.legR;
      add(arm.shoulder, G.cone(0.034, 0.17, 4), steel, 0.05 * s, 0.07, 0, 0, 0, -1.05 * s);
      add(arm.shoulder, G.cone(0.020, 0.10, 4), red, 0.04 * s, 0.10, -0.03, 0, 0, -0.55 * s);
      add(arm.elbow, G.cone(0.030, 0.16, 3), steel, 0, -0.10, -0.045, -2.9, 0, 0, 1.0, 1, 0.5);
      add(leg.knee, G.oct(0.043), steel, 0, 0.0, 0.058, 0, 0, 0, 1.0, 1.3, 0.8);
    }
    add(rig.spine, G.oct(0.05), red, 0, 0.27, 0.150, 0, 0, 0, 0.55, 2.4, 0.5);
    add(rig.spine, G.tet(0.06), steel, 0, 0.33, -0.150, 0, 0.8, 0, 1.4, 1.8, 1.0);
    add(rig.spine, G.cone(0.05, 0.12, 3), steel, 0, 0.19, -0.170, Math.PI, 0, 0, 1.2, 1, 0.6);
  },

  /* premium: gold collar, belt, cuffs, ankle rings, brooch */
  refined(rig) {
    const gold = M(0xe0b84e, 0x5a3f00, 0.3), cream = M(0xf3eadb), jewel = M(0x8fd0ff, 0x2a6a9a, 0.5);
    add(rig.spine, G.tor(0.085, 0.013, 5, 18), gold, 0, 0.392, 0, Math.PI / 2, 0, 0, 1.1, 1.0, 1);
    add(rig.spine, G.tor(0.142, 0.010, 4, 22), gold, 0, 0.060, 0, Math.PI / 2, 0, 0, 1.08, 0.88, 1);
    add(rig.spine, G.oct(0.030), jewel, 0, 0.060, 0.128, 0, 0, 0, 1, 1.3, 0.6);
    add(rig.spine, G.oct(0.021), gold, 0.075, 0.300, 0.158, 0, 0, 0, 1, 1.3, 0.6);
    for (const s of [-1, 1]) {
      const arm = s > 0 ? rig.armL : rig.armR, leg = s > 0 ? rig.legL : rig.legR;
      add(arm.wrist, G.tor(0.041, 0.008, 4, 12), gold, 0, 0.0, 0, Math.PI / 2, 0, 0);
      add(arm.wrist, G.tor(0.043, 0.005, 4, 12), cream, 0, 0.022, 0, Math.PI / 2, 0, 0);
      add(leg.ankle, G.tor(0.047, 0.008, 4, 12), gold, 0, 0.02, 0, Math.PI / 2, 0, 0);
    }
  },
};

export function applyBodyStyle(rig, cfg, mats) {
  const id = cfg && cfg.bodyStyle;
  const P = STYLE_PROPORTIONS[id];
  if (!P || !rig || !rig.spine) return;               /* "faceted" default stays as-is */
  const [sx, sy, sz] = P.spine;
  rig.spine.scale.set(sx, sy, sz);
  if (rig.neck) rig.neck.scale.set(1 / sx, 1 / sy, 1 / sz);      /* keep the neck/head undistorted */
  if (rig.head) rig.head.scale.multiplyScalar(P.head);
  for (const arm of [rig.armL, rig.armR]) if (arm && arm.shoulder) arm.shoulder.scale.set(P.arm / sx, 1 / sy, P.arm / sz);
  for (const leg of [rig.legL, rig.legR]) if (leg && leg.hip) leg.hip.scale.set(P.leg, 1, P.leg);
  try { BUILDERS[id] && rig.armL && rig.legL && BUILDERS[id](rig, mats || {}); }
  catch (e) { console.warn("[bodystyle]", id, e); }
}
