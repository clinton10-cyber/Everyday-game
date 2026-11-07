/* ═══════════════════════════════════════════════════════════
   lp-bottoms.js — trousers, shorts, skirts and shoes.
   Garments are shells built from the body measurements plus a little
   "ease" (looseness), so they always sit just outside the skin.
   ═══════════════════════════════════════════════════════════ */
import * as THREE from "three";
import { revolve, bone, rAt, mk, sphere, box, cyl, torus, lam, shade, ring, shellGeo, clamp } from "./lp-parts.js";
import { resolveColor, BOTTOM_COLORS, ACCENT_COLORS, SHOE_COLORS } from "../core/wardrobe.js";
import { TOPS } from "./lp-tops.js";

/* kind: pants (cover the whole leg) | shorts (thigh only) | skirt (rigid, on the hips) */
export const BOTTOMS = {
  jeans:     { kind: "pants",  ease: 0.004, belt: true },
  tracksuit: { kind: "pants",  ease: 0.014, cuff: true, stripe: true },
  baggy:     { kind: "pants",  ease: 0.036, belt: true },
  cargo:     { kind: "pants",  ease: 0.022, belt: true, pockets: true },
  leggings:  { kind: "pants",  ease: 0.0015 },
  palazzo:   { kind: "pants",  ease: 0.020, flare: true },
  shorts:    { kind: "shorts", ease: 0.012, len: 0.23, belt: true },
  bermuda:   { kind: "shorts", ease: 0.020, len: 0.40, belt: true, pockets: true },
  skirt:     { kind: "skirt",  ease: 0.012, hem: -0.47, hemR: 0.255 },
  miniskirt: { kind: "skirt",  ease: 0.010, hem: -0.27, hemR: 0.215 },
};
export function bottomSpec(cfg) { return BOTTOMS[cfg.bottomStyle] || BOTTOMS.jeans; }

/* Does the outfit hide the legs entirely (one-piece dress)? */
export function legsBare(cfg) { return false; }

/* ── pelvis + legs (called once per leg for the leg part) ─────────── */
export function buildPelvis(ctx) {
  const { B, cfg, M, hips } = ctx;
  const spec = legsBare(cfg) ? { kind: "skirt", ease: 0.010, hem: -0.2, hemR: 0.2, hidden: true } : bottomSpec(cfg);
  ctx.bSpec = spec;
  const e = spec.ease;
  const rows = B.prows0.map(p => ({ y: p.y, r: p.r + e }));
  const accent = resolveColor(ACCENT_COLORS, cfg.bottomAccent);
  const base = resolveColor(BOTTOM_COLORS, cfg.bottomColor);
  const trim = lam(accent);
  ctx.bTrim = trim;

  if (spec.kind === "skirt") {
    if (spec.hidden) {                       /* dress: skin hips under the skirt */
      const hipsMesh = new THREE.Mesh(revolve(rows.map(r => ({ y: r.y, r: r.r * 0.98 })), { radial: 14, capBottom: 0.4, capTop: 0.5 }), M.skin);
      hipsMesh.scale.set(B.sxP, 1, B.szP);
      hips.add(hipsMesh);
      return;
    }
    /* waist → hem, flaring: one rigid lathe shell hanging from the hips */
    const hem = spec.hem, hemR = spec.hemR * (0.9 + 0.1 * B.sxP);
    const sk = [
      { y: 0.065, r: rows[4].r },
      { y: 0.030, r: rows[3].r },
      { y: -0.010, r: rows[2].r },
      { y: -0.090, r: rows[1].r + 0.012 },
      { y: hem, r: hemR },
    ];
    const g = shellGeo(sk, 28);
    const m = new THREE.Mesh(g, M.bottom);
    m.scale.set(B.sxP, 1, B.szP); m.castShadow = true;
    hips.add(m);
    ring(hips, M.bottom, hemR, 0.007, hem, B.sxP, B.szP, 28);
    ring(hips, trim, rows[4].r + 0.004, 0.009, 0.05, B.sxP, B.szP, 18);       /* waistband */
    return;
  }

  /* trousers / shorts: tight-ish pelvis shell */
  const pelvis = new THREE.Mesh(revolve(rows, { radial: 14, capBottom: 0.22, capTop: 0.5 }), M.bottom);
  pelvis.scale.set(B.sxP, 1, B.szP);
  pelvis.castShadow = true; pelvis.receiveShadow = true;
  hips.add(pelvis);
  const shirtCovers = (TOPS[cfg.topStyle] || {}).crop === undefined && !legsBare(cfg);
  if (spec.belt && !shirtCovers) {
    const belt = lam(shade(base, -0.20));
    ring(hips, belt, rows[4].r + 0.004, 0.0085, 0.045, B.sxP, B.szP, 18);
    const buckle = mk(box(0.026, 0.020, 0.008), lam("#c9b26a"), hips, 0, 0.045, B.szP * (rows[4].r + 0.012));
    buckle.castShadow = false;
  }
  if (spec.pockets) {                                     /* cargo thigh pockets live on the leg */
    ctx.cargo = true;
  }
}

export function buildLeg(ctx, side) {
  const { B, cfg, M, hips } = ctx;
  const spec = ctx.bSpec;
  const e = spec.ease;
  const g = {};
  const hip = new THREE.Group();
  hip.position.set(B.hipX * side, -0.010, 0);
  hips.add(hip);
  g.hip = hip;
  const knee = new THREE.Group(); knee.position.y = -0.420; hip.add(knee); g.knee = knee;
  const ankle = new THREE.Group(); ankle.position.y = -0.400; knee.add(ankle); g.ankle = ankle;

  const skinThigh = () => mk(bone(B.thighTop, B.thighBot, 0.420, 10), M.skin, hip);
  const skinCalf  = () => mk(bone(B.calfTop, B.calfBot, 0.400, 8), M.skin, knee);
  const tTop = B.thighTop, tBot = B.thighBot, cTop = B.calfTop, cBot = B.calfBot;
  const trim = ctx.bTrim;

  if (spec.kind === "skirt") {            /* bare legs */
    skinThigh(); skinCalf();
  } else if (spec.kind === "shorts") {
    skinThigh(); skinCalf();
    const len = spec.len;
    const rT = tTop + e, rB = tTop + (tBot - tTop) * (len / 0.42) + e + (len > 0.3 ? 0.012 : 0.004);
    /* open-ended tube; a thin ring closes the hem */
    const sh = new THREE.Mesh(shellGeo([{ y: -len, r: rB }, { y: -len * 0.5, r: (rT + rB) / 2 }, { y: 0.012, r: rT + 0.004 }], 14), M.bottom);
    sh.castShadow = true; hip.add(sh);
    mk(sphere(rT + 0.004, 10, 6), M.bottom, hip, 0, 0.002, 0).scale.set(1, 0.55, 1);
    ring(hip, M.bottom, rB, 0.006, -len, 1, 1, 14);
    if (cfg.bottomStyle === "shorts" && trim) {
      /* side stripe */
      mk(box(0.012, len * 0.9, 0.05), trim, hip, side * (rT * 0.97 + 0.002), -len * 0.5, 0);
    }
  } else {                                /* pants */
    let thighBot = tBot + e, calfTop = cTop + e, calfBot = cBot + e;
    let tTopR = tTop + e;
    let capB = 1;
    if (spec.flare) { thighBot = tBot + 0.035; calfTop = cTop + 0.04; calfBot = 0.150; capB = 0.12; }
    if (cfg.bottomStyle === "baggy") { calfBot = cBot + e + 0.012; }
    if (spec.cuff) { calfBot = cBot + 0.006; }            /* joggers taper to a snug cuff */
    const thigh = new THREE.Mesh(revolve([{ y: -0.420, r: thighBot }, { y: 0, r: tTopR }], { radial: 12, capSeg: 3 }), M.bottom);
    thigh.castShadow = true; hip.add(thigh);
    const calf = new THREE.Mesh(revolve([{ y: -0.400, r: calfBot }, { y: 0, r: calfTop }], { radial: 10, capSeg: 3, capBottom: capB }), M.bottom);
    calf.castShadow = true; knee.add(calf);
    if (spec.cuff) {
      ring(knee, trim, calfBot + 0.004, 0.012, -0.385, 1, 1, 12);
      mk(box(0.010, 0.74, 0.050), trim, hip, side * (tTopR * 0.98), -0.37, 0);   /* side stripe, hip → ankle */
    }
    if (spec.pockets) {                                    /* cargo pocket on the outer thigh */
      const p = mk(box(0.030, 0.12, 0.085), M.bottom, hip, side * (tTopR + 0.008), -0.20, 0.0);
      const flap = mk(box(0.034, 0.028, 0.09), lam(shade(resolveColor(BOTTOM_COLORS, cfg.bottomColor), -0.10)), hip, side * (tTopR + 0.011), -0.145, 0);
      p.castShadow = flap.castShadow = false;
    }
    if (cfg.bottomStyle === "jeans") {                     /* stitched hem */
      ring(knee, lam(shade(resolveColor(BOTTOM_COLORS, cfg.bottomColor), 0.10)), calfBot + 0.002, 0.004, -0.385, 1, 1, 12);
    }
  }
  buildShoe(ctx, g, side);
  return g;
}

/* ── shoes ──────────────────────────────────────────────────
   Ankle group origin sits 0.105 above the ground, so a sole's underside is
   at y = -0.105.  Toe points +Z. */
const SOLE_Y = -0.105;
function footSkin(M, ankle, scale = 1) {
  const f = mk(sphere(1, 9, 6), M.skin, ankle, 0, -0.072, 0.040);
  f.scale.set(0.044 * scale, 0.034, 0.112 * scale);
  const heel = mk(sphere(0.04, 7, 5), M.skin, ankle, 0, -0.068, -0.020);
  heel.scale.set(1, 0.9, 1);
  return f;
}
function soleFor(cfg) {
  const c = new THREE.Color(resolveColorShoe(cfg));
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return lam(lum > 0.45 ? "#2b2b30" : "#f4f4f4");
}
function resolveColorShoe(cfg) { return resolveColor(SHOE_COLORS, cfg.shoeColor); }

function buildShoe(ctx, g, side) {
  const { cfg, M } = ctx;
  const a = g.ankle;
  const style = cfg.shoeStyle || "sneakers";
  const Z = 0.035;
  const sole = soleFor(cfg);
  const body = (sx, sy, sz, y, z, mat) => { const m = mk(sphere(1, 10, 7), mat || M.shoes, a, 0, y, z); m.scale.set(sx, sy, sz); return m; };
  const slab = (w, h, l, y, z, mat) => mk(box(w, h, l), mat || sole, a, 0, y, z);

  if (style === "barefoot") { footSkin(M, a); return; }

  if (style === "sandals") {
    footSkin(M, a);
    const s = body(0.060, 0.016, 0.125, SOLE_Y + 0.016, Z); s.material = M.shoes;
    mk(box(0.092, 0.014, 0.034), M.shoes, a, 0, -0.054, Z + 0.025);
    mk(box(0.088, 0.012, 0.022), M.shoes, a, 0, -0.058, Z - 0.035);
    return;
  }
  if (style === "flipflops") {
    footSkin(M, a);
    slab(0.098, 0.014, 0.250, SOLE_Y + 0.008, Z + 0.02, M.shoes);
    const v1 = mk(box(0.010, 0.010, 0.07), sole, a, 0.022 * side, -0.066, Z + 0.07, 0, -0.28 * side, 0);
    const v2 = mk(box(0.010, 0.010, 0.07), sole, a, -0.022 * side, -0.066, Z + 0.07, 0, 0.28 * side, 0);
    return;
  }
  if (style === "slippers") {
    footSkin(M, a);
    slab(0.14, 0.020, 0.30, SOLE_Y + 0.012, Z + 0.02, M.shoes);
    mk(box(0.14, 0.024, 0.075), M.shoes, a, 0, -0.050, Z + 0.07);
    return;
  }
  if (style === "heels") {
    footSkin(M, a, 0.9);
    const s = body(0.050, 0.020, 0.108, -0.058, Z + 0.016, M.shoes); s.rotation.x = 0.30;   /* toe tips down */
    body(0.049, 0.036, 0.062, -0.052, Z + 0.062, M.shoes).rotation.x = 0.30;                 /* toe box */
    const strap = mk(box(0.088, 0.010, 0.020), M.shoes, a, 0, -0.052, Z - 0.034);
    mk(cyl(0.012, 0.006, 0.060, 8), M.shoes, a, 0, -0.078, -0.036);                         /* stiletto */
    mk(cyl(0.009, 0.009, 0.014, 8), sole, a, 0, SOLE_Y + 0.007, -0.036);
    return;
  }
  if (style === "formal" || style === "loafers") {
    const s = body(0.056, 0.042, 0.140, -0.062, Z, M.shoes);
    mk(box(0.066, 0.014, 0.17), sole, a, 0, SOLE_Y + 0.007, Z + 0.004);
    mk(box(0.060, 0.012, 0.030), M.shoes, a, 0, -0.092, -0.030).scale.set(1, 1.4, 1);   /* heel block */
    if (style === "loafers") mk(box(0.050, 0.008, 0.030), lam("#c9b26a"), a, 0, -0.040, Z + 0.065);   /* buckle bar */
    return;
  }
  if (style === "boots" || style === "wellies") {
    const tall = style === "wellies";
    body(0.064, 0.056, 0.138, -0.052, Z, M.shoes);
    mk(box(0.080, 0.018, 0.200), sole, a, 0, SOLE_Y + 0.009, Z + 0.004);
    const h = tall ? 0.30 : 0.15, rT = tall ? 0.070 : 0.074, rB = tall ? 0.062 : 0.068;
    const shaft = mk(cyl(rT, rB, h, 12), M.shoes, a, 0, -0.045 + h / 2, -0.004);
    if (!tall) ring(a, M.shoes, 0.078, 0.008, -0.045 + h, 1, 1, 12);
    return;
  }
  /* sneakers · hightops · cleats */
  const hi = style === "hightops";
  body(0.062, 0.050, 0.125, -0.055, Z, M.shoes);
  const heel = body(0.058, 0.055, 0.062, -0.050, -0.026, M.shoes);
  mk(box(0.070, 0.014, 0.205), sole, a, 0, SOLE_Y + 0.007, Z + 0.004);
  body(0.050, 0.030, 0.062, -0.060, Z + 0.075, sole).scale.set(0.055, 0.032, 0.064);    /* rubber toe cap */
  if (style === "cleats") {
    for (const zz of [-0.045, 0.05, 0.125]) for (const xx of [-0.022, 0.022])
      mk(cone(0.008, 0.016, 6), sole, a, xx, SOLE_Y - 0.004, zz).rotation.x = Math.PI;
  }
  if (hi) {
    const shaft = mk(cyl(0.064, 0.068, 0.10, 12), M.shoes, a, 0, 0.0, -0.004);
    ring(a, sole, 0.066, 0.008, 0.045, 1, 1, 12);
  }
  /* laces */
  for (let i = 0; i < 3; i++) mk(box(0.050, 0.004, 0.006), lam("#f4f4f4"), a, 0, -0.022 - i * 0.003, Z + 0.015 + i * 0.020).rotation.x = -0.35;
}
function cone(r, h, seg) { return new THREE.ConeGeometry(r, h, seg); }
