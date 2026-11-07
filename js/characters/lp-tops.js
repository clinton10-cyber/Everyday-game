/* ═══════════════════════════════════════════════════════════
   lp-tops.js — every upper-body garment.
   A top is built from the body measurements (lp-parts.measures) as:
     • a torso shell on the spine, with real cut-outs (necklines, armholes)
     • a "tail" shell on the hips that covers the pelvis down to the hem
       (or a flared skirt for dresses / kaftans / agbada)
     • sleeves on the arms (buildSleeves)
     • collars, plackets, zips, pockets, hoods
   Everything is sized as skin + ease, so nothing floats or clips.
   ═══════════════════════════════════════════════════════════ */
import * as THREE from "three";
import {
  revolve, bone, rAt, mk, sphere, box, cyl, torus, lam, shade, ring, shellGeo,
  frontZ, lerp, clamp, glow,
} from "./lp-parts.js";
import { resolveColor, SHIRT_COLORS, ACCENT_COLORS } from "../core/wardrobe.js";

/* sl: sleeve kind · ease: looseness (m) · hem: tail hem y in hips space
   (long: flared skirt hem) · neck: neckline / collar type                */
export const TOPS = {
  tshirt:     { sl: "short", ease: 0.012, hem: -0.075, neck: "crew" },
  vneck:      { sl: "short", ease: 0.012, hem: -0.075, neck: "v" },
  polo:       { sl: "short", ease: 0.012, hem: -0.065, neck: "polo", len: 0.15 },
  jersey:     { sl: "short", ease: 0.024, hem: -0.110, neck: "vtrim", len: 0.14, cuffTrim: true },
  dashiki:    { sl: "short", ease: 0.030, hem: -0.170, neck: "dashiki", len: 0.16, bell: 0.030 },
  croptop:    { sl: "short", ease: 0.010, crop: 0.115, neck: "crew", len: 0.085 },
  longsleeve: { sl: "long",  ease: 0.012, hem: -0.075, neck: "crew" },
  sweater:    { sl: "long",  ease: 0.030, hem: -0.075, neck: "crew", rib: true },
  turtleneck: { sl: "long",  ease: 0.008, hem: -0.070, neck: "turtle" },
  hoodie:     { sl: "long",  ease: 0.040, hem: -0.095, neck: "hood", rib: true },
  bomber:     { sl: "long",  ease: 0.034, hem: -0.075, neck: "jacket", rib: true, zip: true },
  jacket:     { sl: "long",  ease: 0.028, hem: -0.125, neck: "jacket", zip: true, pockets: true },
  suit:       { sl: "long",  ease: 0.022, hem: -0.150, neck: "lapel", fitted: true },
  tank:       { sl: "none",  ease: 0.010, hem: -0.075, neck: "tank" },
  singlet:    { sl: "none",  ease: 0.008, hem: -0.065, neck: "singlet" },
  tube:       { sl: "none",  ease: 0.006, crop: -0.04, neck: "tube", topY: 0.318 },
  kaftan:     { sl: "long",  ease: 0.032, skirt: { hem: -0.50, hemR: 0.215 }, neck: "mandarin" },
  agbada:     { sl: "wide",  ease: 0.034, skirt: { hem: -0.66, hemR: 0.300 }, neck: "mandarin", agbada: true },
  dress:      { sl: "none",  ease: 0.010, skirt: { hem: -0.47, hemR: 0.275 }, neck: "scoop", fitted: true },
};
export function topSpec(cfg) { return TOPS[cfg.topStyle] || TOPS.tshirt; }

const NECK_Y = 0.430;

export function buildTop(ctx) {
  const { B, cfg, M, spine, hips } = ctx;
  const style = cfg.topStyle in TOPS ? cfg.topStyle : "tshirt";
  const S = TOPS[style];
  const e = S.ease;
  const bEase = ctx.bSpec ? ctx.bSpec.ease : 0.004;
  const base = resolveColor(SHIRT_COLORS, cfg.topColor);
  const accent = resolveColor(ACCENT_COLORS, cfg.topAccent);
  const trim = lam(accent);
  ctx.trim = trim;
  ctx.sleeve = { kind: S.sl, len: S.len || 0.13, ease: e, rib: !!S.rib, cuffTrim: !!S.cuffTrim, bell: S.bell || 0, agbada: !!S.agbada };

  const sx = B.sxT, sz = B.szT;
  const topY = S.topY || NECK_Y;

  /* ── skin torso (always present, ~5% inside the garment) ── */
  {
    const rows = B.rows0.filter(p => p.y <= topY + 1e-6).map(p => ({ y: p.y, r: p.r * 0.955 }));
    rows.unshift({ y: -0.03, r: rows[0].r * 0.99 });
    const skin = new THREE.Mesh(revolve(rows, { radial: 14, capBottom: 0.45, capTop: 0.35 }), M.skin);
    skin.scale.set(sx, 1, sz);
    skin.castShadow = true; skin.receiveShadow = true;
    spine.add(skin);
  }

  /* ── cut-outs ── */
  let cut = null;
  const N = S.neck;
  if (N === "v" || N === "vtrim")      cut = (x, y, z) => z > 0 && y > 0.285 + Math.abs(x) * 1.9;
  else if (N === "dashiki")            cut = (x, y, z) => z > 0 && y > 0.255 + Math.abs(x) * 2.6;
  else if (N === "scoop")              cut = (x, y, z) => (z > 0 && ((x / 0.115) ** 2 + ((y - 0.43) / 0.125) ** 2 < 1)) || (z < 0 && ((x / 0.10) ** 2 + ((y - 0.43) / 0.05) ** 2 < 1)) || (Math.abs(x) > 0.135 && y > 0.275);
  else if (N === "tank")               cut = (x, y, z) => (Math.abs(x) > 0.125 && y > 0.255) || (z > 0 && (x / 0.075) ** 2 + ((y - 0.43) / 0.07) ** 2 < 1);
  else if (N === "singlet")            cut = (x, y, z) => (Math.abs(x) > 0.088 && y > 0.255) || (z > 0 && (x / 0.085) ** 2 + ((y - 0.43) / 0.15) ** 2 < 1) || (z < 0 && (x / 0.085) ** 2 + ((y - 0.43) / 0.07) ** 2 < 1);
  else if (N === "lapel") cut = (x, y, z) => z > 0 && y > 0.19 + Math.abs(x) * 2.1;

  /* ── upper shell ── */
  const yTop = topY;
  const ys = [0.0, 0.05, 0.115, 0.19, 0.28, 0.355, 0.39, 0.412, 0.43].filter(y => y < yTop - 0.004);
  if (S.crop !== undefined) while (ys.length && ys[0] < S.crop + 0.001) ys.shift();
  const yStart = S.crop !== undefined ? S.crop : -0.012;
  ys.unshift(yStart); ys.push(yTop);
  const rows = ys.map(y => {
    let k = 1;
    if (y > 0.36) k = lerp(1, 0.35, clamp((y - 0.36) / 0.07, 0, 1));
    if (S.fitted && y < 0.12) k = 0.45 + 0.55 * clamp((y - 0.0) / 0.12, 0, 1);
    return { y, r: rAt(B.rows0, y) + e * k };
  });
  const upper = new THREE.Mesh(shellGeo(rows, cut ? 72 : 40, cut), M.top);
  upper.scale.set(sx, 1, sz);
  upper.castShadow = true; upper.receiveShadow = true;
  spine.add(upper);
  const zf = (y, x = 0, ee = e) => frontZ(B, y, ee, x);

  /* thin trim strip following the front of the shell from y0 up to y1 */
  const strip = (mat, w, y0, y1, x = 0, ee = e, thick = 0.004, depth = 0.006) => {
    const n = Math.max(1, Math.ceil((y1 - y0) / 0.07));
    for (let i = 0; i < n; i++) {
      const ya = lerp(y0, y1, i / n), yb = lerp(y0, y1, (i + 1) / n);
      const za = zf(ya, x, ee + thick), zb = zf(yb, x, ee + thick);
      const m = mk(box(w, Math.hypot(yb - ya, zb - za) + 0.002, depth), mat, spine, x, (ya + yb) / 2, (za + zb) / 2,
        Math.atan2(zb - za, yb - ya), 0, 0);
      m.castShadow = false;
    }
  };
  const button = (y, mat) => { const b = mk(sphere(0.0085, 6, 5), mat, spine, 0, y, zf(y, 0, e + 0.006)); b.scale.set(1, 1, 0.5); b.castShadow = false; };

  /* ── tail / skirt on the hips ── */
  const tailEase = Math.max(e + 0.004, bEase + 0.010);
  if (S.skirt) {
    const hem = S.skirt.hem, hemR = S.skirt.hemR * (0.9 + 0.1 * B.sxP);
    const pr = B.prows0;
    const sk = [
      { y: 0.075, r: pr[4].r + tailEase },
      { y: 0.030, r: pr[3].r + tailEase },
      { y: -0.020, r: pr[2].r + tailEase + 0.004 },
      { y: -0.100, r: pr[1].r + tailEase + 0.020 },
      { y: lerp(-0.100, hem, 0.5), r: lerp(pr[1].r + tailEase + 0.020, hemR, 0.55) },
      { y: hem, r: hemR },
    ];
    const m = new THREE.Mesh(shellGeo(sk, 36), M.top);
    m.scale.set(B.sxP, 1, B.szP); m.castShadow = true;
    hips.add(m);
    ring(hips, S.agbada || style === "kaftan" ? trim : M.top, hemR, 0.008, hem, B.sxP, B.szP, 36);
    if (style === "kaftan" || style === "agbada") {
      /* front placket down the skirt part */
      const zz = (y) => B.szP * (rAt(sk.map(s => ({ y: s.y, r: s.r })).reverse().reverse().sort((a, b) => a.y - b.y), y) + 0.004);
      const n = 5;
      for (let i = 0; i < n; i++) {
        const ya = lerp(0.06, hem, i / n), yb = lerp(0.06, hem, (i + 1) / n);
        const za = zz(ya), zb = zz(yb);
        mk(box(0.022, Math.hypot(yb - ya, zb - za) + 0.002, 0.005), trim, hips, 0, (ya + yb) / 2, (za + zb) / 2, Math.atan2(zb - za, yb - ya), 0, 0).castShadow = false;
      }
    }
  } else if (S.crop === undefined) {
    const hem = S.hem;
    const pr = B.prows0;
    const rowsT = [{ y: hem, r: rAt(pr, hem) + tailEase + 0.002 }];
    for (const p of pr) if (p.y > hem + 0.01 && p.y < 0.065) rowsT.push({ y: p.y, r: p.r + tailEase });
    rowsT.push({ y: 0.075, r: pr[4].r + tailEase });
    const t = new THREE.Mesh(shellGeo(rowsT, 28), M.top);
    t.scale.set(B.sxP, 1, B.szP); t.castShadow = true;
    hips.add(t);
    if (S.rib) ring(hips, S.neck === "jacket" ? trim : M.top, rowsT[0].r + 0.002, 0.012, hem + 0.004, B.sxP, B.szP, 28);
    else ring(hips, M.top, rowsT[0].r, 0.005, hem, B.sxP, B.szP, 28);
  } else if (S.crop > 0) {
    ring(spine, M.top, rows[0].r + 0.001, 0.005, S.crop, sx, sz, 28);
  }

  /* ── collars & front details ── */
  const neckRing = (R, tube, y, mat) => ring(spine, mat || M.top, R, tube, y, 1, 1, 16);
  switch (N) {
    case "crew":   neckRing(0.064, 0.011, 0.428); break;
    case "polo": {
      neckRing(0.066, 0.012, 0.430);
      for (const s of [-1, 1]) {
        const f = mk(box(0.052, 0.014, 0.034), M.top, spine, s * 0.034, 0.418, zf(0.40) * 0.80, 0.25, s * -0.45, s * -0.30);
        f.castShadow = false;
      }
      strip(trim, 0.020, 0.31, 0.415, 0, e, 0.004, 0.006);
      button(0.39, lam("#f4f4f4")); button(0.345, lam("#f4f4f4"));
      break;
    }
    case "turtle": {
      const col = mk(cyl(0.062, 0.070, 0.064, 14, true), M.top, spine, 0, 0.452, 0);
      ring(spine, M.top, 0.064, 0.011, 0.484, 1, 1, 14);
      ring(spine, M.top, 0.070, 0.010, 0.424, 1, 1, 14);
      break;
    }
    case "hood":   buildHood(ctx, zf, e); break;
    case "jacket": {
      /* stand collar + zip + (jacket) pockets */
      const col = mk(cyl(0.070, 0.078, 0.044, 14, true), M.top, spine, 0, 0.446, -0.004);
      ring(spine, trim, 0.072, 0.007, 0.470, 1, 1, 14);
      strip(lam("#c9ccd2"), 0.007, 0.0, 0.425, 0, e, 0.003, 0.005);
      mk(box(0.016, 0.028, 0.012), lam("#c9ccd2"), spine, 0.014, 0.26, zf(0.26, 0.014, e + 0.004)).castShadow = false;
      if (S.pockets) for (const s of [-1, 1]) {
        const x = s * 0.092, y = 0.10;
        const p = mk(box(0.066, 0.012, 0.010), shade(base, -0.16) && lam(shade(base, -0.16)), spine, x, y, zf(y, x, e + 0.004), 0, 0, s * -0.22);
        p.castShadow = false;
      }
      break;
    }
    case "lapel": {                         /* suit: white shirt, lapels, buttons, tie */
      const shirt = new THREE.Mesh(shellGeo(rows.map(r => ({ y: r.y, r: rAt(B.rows0, r.y) + 0.004 })), 28), lam("#f4f4f4"));
      shirt.scale.set(sx, 1, sz); spine.add(shirt);
      neckRing(0.060, 0.010, 0.430, lam("#f4f4f4"));
      for (const s of [-1, 1]) {                                 /* lapel flaps along the V edge */
        const x0 = s * 0.080, y0 = 0.43, x1 = s * 0.008, y1 = 0.19;
        const n = 4;
        for (let i = 0; i < n; i++) {
          const xa = lerp(x0, x1, i / n), xb = lerp(x0, x1, (i + 1) / n);
          const ya = lerp(y0, y1, i / n), yb = lerp(y0, y1, (i + 1) / n);
          const xm = (xa + xb) / 2, ym = (ya + yb) / 2;
          const len = Math.hypot(xb - xa, yb - ya) + 0.004;
          const lp = mk(box(0.034, len, 0.012), M.top, spine, xm + s * 0.012, ym, zf(ym, xm, e + 0.006),
            0, 0, Math.atan2(xb - xa, yb - ya) * -1 + Math.PI);
          lp.rotation.z = -Math.atan2(xb - xa, yb - ya);
          lp.castShadow = false;
        }
      }
      const bm = lam("#1a1a1a");
      button(0.15, bm); button(0.09, bm);
      buildTie(ctx, zf, e);
      break;
    }
    case "mandarin": {
      mk(cyl(0.062, 0.068, 0.034, 14, true), M.top, spine, 0, 0.440, -0.002);
      ring(spine, trim, 0.066, 0.006, 0.457, 1, 1, 14);
      strip(trim, 0.026, 0.20, 0.418, 0, e, 0.003, 0.005);
      if (S.agbada) { ring(spine, trim, 0.066, 0.008, 0.40, sx * 2.2, sz * 1.8, 22).visible = false; }
      for (const y of [0.37, 0.31, 0.25]) button(y, lam(shade(base, -0.2)));
      const pk = mk(box(0.052, 0.058, 0.008), lam(shade(base, -0.10)), spine, -0.09, 0.19, zf(0.19, -0.09, e + 0.004));
      pk.castShadow = false;
      break;
    }
    case "scoop": neckRing(0.0001, 0.0001, 0.2).visible = false; scoopTrim(ctx, B, e, S, trim, accent, spine); break;
    case "tank": case "singlet": case "tube": break;
    case "v": case "vtrim": {
      /* ribbed V edge */
      const n = 4;
      for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
        const xa = s * lerp(0.0, 0.076, i / n), xb = s * lerp(0.0, 0.076, (i + 1) / n);
        const ya = 0.285 + Math.abs(xa) * 1.9, yb = 0.285 + Math.abs(xb) * 1.9;
        const xm = (xa + xb) / 2, ym = (ya + yb) / 2;
        const len = Math.hypot(xb - xa, yb - ya) + 0.004;
        const m = mk(box(0.012, len, 0.008), N === "vtrim" ? trim : M.top, spine, xm, ym, zf(ym, xm, e + 0.003), 0, 0, -Math.atan2(xb - xa, yb - ya));
        m.castShadow = false;
      }
      neckRing(0.066, 0.009, 0.430, N === "vtrim" ? trim : M.top);
      break;
    }
    case "dashiki": {
      /* ribbed V + an embroidered chest band in the accent colour */
      const n = 4;
      for (const sg of [-1, 1]) for (let i = 0; i < n; i++) {
        const xa = sg * lerp(0.0, 0.07, i / n), xb = sg * lerp(0.0, 0.07, (i + 1) / n);
        const ya = 0.255 + Math.abs(xa) * 2.6, yb = 0.255 + Math.abs(xb) * 2.6;
        const xm = (xa + xb) / 2, ym = (ya + yb) / 2, len = Math.hypot(xb - xa, yb - ya) + 0.004;
        mk(box(0.012, len, 0.008), trim, spine, xm, ym, zf(ym, xm, e + 0.003), 0, 0, -Math.atan2(xb - xa, yb - ya)).castShadow = false;
      }
      neckRing(0.066, 0.009, 0.430, trim);
      for (const [y0, y1] of [[0.19, 0.205], [0.15, 0.158]]) for (let i = -4; i <= 4; i++) {
        const x = i * 0.034;
        mk(box(0.022, y1 - y0, 0.006), trim, spine, x, (y0 + y1) / 2, zf((y0 + y1) / 2, x, e + 0.003)).castShadow = false;
      }
      break;
    }
  }
  if (style === "jersey") {                 /* contrast side panels */
    for (const s of [-1, 1]) {
      const x = s * (rAt(B.rows0, 0.18) + e + 0.003) * sx;
      mk(box(0.010, 0.30, 0.060), trim, spine, x, 0.17, 0).castShadow = false;
    }
  }
  if (style === "croptop") { /* nothing extra */ }
  if (style === "dress") {
    ring(spine, trim, rAt(B.rows0, 0.04) + e + 0.003, 0.006, 0.045, sx, sz, 24);   /* waist seam */
  }
  if (style === "tube") ring(spine, M.top, rAt(B.rows0, topY) + e, 0.006, topY, sx, sz, 28);
}

function scoopTrim(ctx, B, e, S, trim, accent, spine) {
  /* straps on the dress: thin straps over the shoulders */
  for (const s of [-1, 1]) {
    const x = s * (0.058 + 0.0), strap = mk(box(0.030, 0.17, 0.016), ctx.M.top, spine, s * 0.105, 0.385, -0.004, 0, 0, s * -0.18);
    strap.castShadow = false;
  }
}

/* ── hoodie hood, drawstrings, kangaroo pocket ── */
function buildHood(ctx, zf, e) {
  const { B, M, spine, hips, trim } = ctx;
  ctx.hood = true;
  ring(spine, M.top, 0.076, 0.020, 0.425, 1, 1, 14);               /* neck roll */
  const hood = new THREE.Mesh(
    revolve([{ y: 0.060, r: 0.075 }, { y: -0.010, r: 0.092 }, { y: -0.090, r: 0.088 }, { y: -0.150, r: 0.056 }],
      { radial: 10, capBottom: 0.3, capTop: 0.3 }), M.top);
  hood.position.set(0, 0.385, -zf(0.36) - 0.01);
  hood.rotation.x = -0.32; hood.scale.set(1.0, 1.0, 0.75); hood.castShadow = true;
  spine.add(hood);
  const sm = lam("#e8e4da");
  for (const s of [-1, 1]) {
    mk(cyl(0.0042, 0.0042, 0.10, 5), sm, spine, s * 0.024, 0.37, zf(0.37, s * 0.024, e + 0.012)).castShadow = false;
    mk(cyl(0.0075, 0.0075, 0.016, 6), sm, spine, s * 0.024, 0.315, zf(0.315, s * 0.024, e + 0.012)).castShadow = false;
  }
  const pz = zf(0.14, 0, e + 0.010);
  const pouch = mk(box(0.20, 0.100, 0.020), M.top, spine, 0, 0.130, pz); pouch.castShadow = false;
  mk(box(0.205, 0.010, 0.024), lam(shade(new THREE.Color(0x888888), -0.2)), spine, 0, 0.182, pz + 0.002).castShadow = false;
}

/* ── tie ── */
function buildTie(ctx, zf, e) {
  const { cfg, M, spine } = ctx;
  if (!cfg.tie || cfg.tie === "none") return;
  const jacketCol = new THREE.Color(resolveColor(SHIRT_COLORS, cfg.topColor));
  let tieCol;
  if (cfg.tieColor != null) tieCol = new THREE.Color(resolveColor(SHIRT_COLORS, cfg.tieColor));
  else {
    const h = { h: 0, s: 0, l: 0 }; jacketCol.getHSL(h);
    tieCol = new THREE.Color().setHSL((h.h + 0.5) % 1, Math.max(0.35, h.s), Math.min(0.28, Math.max(0.16, h.l * 0.6)));
  }
  const tieMat = lam(tieCol), stripeMat = lam(tieCol.clone().offsetHSL(0, 0, 0.14));
  const z0 = (y) => zf(y, 0, 0.006);
  if (cfg.tie === "bow") {
    mk(box(0.030, 0.035, 0.025), tieMat, spine, 0, 0.405, z0(0.405) + 0.006);
    for (const s of [-1, 1]) {
      mk(box(0.055, 0.045, 0.020), tieMat, spine, s * 0.045, 0.405, z0(0.405) + 0.003, 0, 0, s * 0.45);
    }
    return;
  }
  const skinny = cfg.tie === "skinny";
  const kw = skinny ? 0.030 : 0.048, bw = skinny ? 0.032 : 0.055, len = skinny ? 0.26 : 0.30;
  const yTop = 0.385;
  mk(box(kw, 0.044, 0.026), tieMat, spine, 0, 0.395, z0(0.395) + 0.008);
  const n = 4;
  for (let i = 0; i < n; i++) {
    const ya = yTop - len * (i / n), yb = yTop - len * ((i + 1) / n);
    const w = lerp(skinny ? 0.026 : 0.040, bw, i / n);
    const za = z0(ya) + 0.006, zb = z0(yb) + 0.006;
    mk(box(w, Math.hypot(yb - ya, zb - za) + 0.002, 0.014), tieMat, spine, 0, (ya + yb) / 2, (za + zb) / 2, Math.atan2(zb - za, yb - ya), 0, 0).castShadow = false;
  }
  mk(box(kw * 0.3, len * 0.9, 0.004), stripeMat, spine, 0, yTop - len * 0.5, z0(yTop - len * 0.5) + 0.014).castShadow = false;
}

/* ── sleeves ─────────────────────────────────────────────────
   shoulder / elbow are the arm's joint groups.  The skin arm already exists;
   the sleeve is a slightly larger shell so skin can never poke through.     */
export function buildSleeves(ctx, shoulder, elbow, side) {
  const { B, M } = ctx;
  const sp = ctx.sleeve;
  if (!sp || sp.kind === "none") return;
  const e = sp.ease;
  const rS = B.armTop + e + 0.002, rE = B.armElbow + e + 0.002, rW = B.armWrist + e * 0.7 + 0.004;
  const trim = ctx.trim;

  if (sp.kind === "short") {
    const len = sp.len;
    const rEnd = lerp(rS, rE, len / 0.27) + 0.002 + sp.bell;
    const pts = [new THREE.Vector2(rEnd, -len), new THREE.Vector2(rS, 0)];
    for (let i = 1; i <= 4; i++) {
      const a = (i / 4) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.cos(a) * rS, Math.sin(a) * rS * 0.92));
    }
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), M.top);
    m.castShadow = true;
    shoulder.add(m);
    ring(shoulder, sp.cuffTrim ? trim : M.top, rEnd + 0.001, sp.cuffTrim ? 0.007 : 0.005, -len + 0.003, 1, 1, 14);
    return;
  }
  /* long / wide: upper sleeve + forearm sleeve, ball joint at the elbow */
  const wide = sp.kind === "wide";
  const rE2 = wide ? rE + 0.050 : rE;
  const rW2 = wide ? rW + 0.095 : rW;
  const upper = new THREE.Mesh(revolve([{ y: -0.270, r: rE2 }, { y: 0, r: rS }], { radial: 14, capSeg: 4 }), M.top);
  upper.castShadow = true; shoulder.add(upper);
  const fore = new THREE.Mesh(revolve([{ y: -0.250, r: rW2 }, { y: 0, r: rE2 }], { radial: 14, capSeg: 4, capBottom: wide ? 0.15 : 1 }), M.top);
  fore.castShadow = true; elbow.add(fore);
  if (sp.rib) ring(elbow, ctx.trim, rW2 + 0.002, 0.012, -0.232, 1, 1, 14);
  else if (wide) ring(elbow, ctx.trim, rW2 + 0.002, 0.008, -0.242, 1, 1, 18);
}
