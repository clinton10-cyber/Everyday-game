/* lp-extras.js — hats, glasses, jewellery, wrist wear, bags, masks */
import * as THREE from "three";
import { mk, sphere, box, cyl, torus, cone, lam, glow, shade, ring, frontZ } from "./lp-parts.js";
import { resolveColor, SHIRT_COLORS, GEAR_COLORS, LENS_COLORS } from "../core/wardrobe.js";

/* ── glasses (frame colour + lens tint) ── */
function rrPath(path, w, h, r) {
  const x = -w / 2, y = -h / 2;
  path.moveTo(x + r, y); path.lineTo(x + w - r, y); path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r); path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h); path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r); path.quadraticCurveTo(x, y, x + r, y); return path;
}
function rrect(w, h, r, depth, rim) {
  const sh = rrPath(new THREE.Shape(), w, h, r);
  if (rim) sh.holes.push(rrPath(new THREE.Path(), w - rim * 2, h - rim * 2, Math.max(0.002, r - rim)));
  return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 4 });
}
export function buildGlasses(glasses, mats, head) {
  if (!glasses) return;
  const style = typeof glasses === "string" ? glasses : glasses.style; if (!style) return;
  const g = new THREE.Group(); const F = mats.glasses;
  const dark = ["shades", "aviator", "sport"].includes(style);
  const li = typeof glasses === "object" && glasses.lens != null ? glasses.lens : null;
  const lc = resolveColor(LENS_COLORS, li == null ? (dark ? 1 : 0) : li);
  const clearish = li == null ? !dark : li === 0;
  const L = clearish ? lam(lc, { transparent: true, opacity: 0.22, depthWrite: false }) : lam(lc, { transparent: true, opacity: 0.85 });
  const z = 0.109, y = 0.067, ex = 0.038;
  const add = (geo, mat, x, yy, zz, rx = 0, ry = 0, rz = 0) => { const m = mk(geo, mat, g, x, yy, zz, rx, ry, rz); m.castShadow = mat !== L; return m; };
  if (style === "round") for (const s of [-1, 1]) { add(new THREE.TorusGeometry(0.0255, 0.0036, 6, 16), F, ex * s, y, z); add(new THREE.CircleGeometry(0.0255, 16), L, ex * s, y, z - 0.001); }
  else if (style === "square") for (const s of [-1, 1]) { add(rrect(0.056, 0.038, 0.009, 0.006, 0.0042), F, ex * s, y, z - 0.003); add(rrect(0.048, 0.030, 0.007, 0.001), L, ex * s, y, z + 0.001); }
  else if (style === "shades" || style === "sport") for (const s of [-1, 1]) add(rrect(style === "sport" ? 0.062 : 0.058, 0.040, 0.014, 0.008), L, ex * s, y - 0.001, z - 0.002);
  else if (style === "aviator") for (const s of [-1, 1]) { const m = add(new THREE.CircleGeometry(0.028, 18), L, ex * s, y - 0.004, z); m.scale.set(1.1, 1.0, 1); add(new THREE.TorusGeometry(0.0285, 0.003, 5, 18), F, ex * s, y - 0.004, z).scale.set(1.1, 1, 1); }
  else if (style === "cateye") for (const s of [-1, 1]) { const m = add(new THREE.CircleGeometry(0.026, 14), L, ex * s, y, z); m.scale.set(1.15, 0.8, 1); const f = add(new THREE.TorusGeometry(0.026, 0.0035, 5, 14), F, ex * s, y, z); f.scale.set(1.15, 0.8, 1); add(box(0.022, 0.009, 0.006), F, (ex + 0.026) * s, y + 0.013, z, 0, 0, s * 0.5); }
  if (style !== "round" && style !== "square") add(box(0.022, 0.005, 0.005), F, 0, y + 0.007, z);
  else add(box(0.020, 0.005, 0.005), F, 0, y + 0.007, z);
  if (style === "shades") add(box(0.140, 0.005, 0.007), F, 0, y + 0.0185, z + 0.003);
  const x0 = 0.070, z0 = z - 0.002, x1 = 0.114, z1 = 0.004;
  const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.0045, 0.0045, len), F, ((x0 + x1) / 2) * s, y + 0.002, (z0 + z1) / 2, 0, yaw * s, 0);
  head.add(g);
}

/* ── hats ── */
export function buildHat(hat, mats, head, cfg) {
  if (!hat) return;
  const g = new THREE.Group(); head.add(g);
  const M = mats.hat;
  const col = resolveColor(SHIRT_COLORS, hat.color || 0);
  M.color.set(new THREE.Color(col));
  const dk = lam(shade(col, -0.15)), accent = lam("#d4af37");
  const dome = (r, phi, y, sx = 1, sy = 1, sz = 1, mat = M) => { const m = mk(new THREE.SphereGeometry(r, 14, 9, 0, 6.283, 0, phi), mat, g, 0, y, 0); m.scale.set(sx, sy, sz); return m; };
  const brimDisc = (r, y, rx = 0, h = 0.008, mat = M) => mk(cyl(r, r, h, 20), mat, g, 0, y, 0, rx);
  /* front-half peak (z >= 0): three's cylinder theta 0 is +z, so start at -PI/2 to cover the front only */
  const peak = (r, y, z0, tilt, yaw = 0) => {
    const m = mk(new THREE.CylinderGeometry(r, r, 0.012, 22, 1, false, -Math.PI / 2, Math.PI), M, g, 0, y, z0);
    m.rotation.set(tilt, yaw, 0); m.scale.set(1.12, 1, 1.0); return m;
  };
  const cloth = lam(col, { side: THREE.DoubleSide }), white = lam("#f8fafc"), black = lam("#111827");
  switch (hat.style) {
    case "cap": {                                  /* baseball cap: crown, band, button, curved front peak */
      const c = dome(0.128, Math.PI * 0.5, 0.086, 1.03, 1.0, 1.08);
      ring(g, dk, 0.127, 0.006, 0.088, 1.03, 1.08, 18);
      mk(sphere(0.011, 6, 5), dk, g, 0, 0.086 + 0.128, 0);
      peak(0.108, 0.100, 0.085, 0.20);
      break;
    }
    case "facecap": {                              /* flat-peak snapback */
      dome(0.128, Math.PI * 0.46, 0.086, 1.03, 0.95, 1.08);
      ring(g, dk, 0.127, 0.006, 0.088, 1.03, 1.08, 18);
      mk(sphere(0.010, 6, 5), dk, g, 0, 0.086 + 0.12, 0);
      peak(0.122, 0.094, 0.085, 0.04);
      break;
    }
    case "beanie": dome(0.121, Math.PI * 0.5, 0.070, 1.04, 1.08, 1.04); ring(g, M, 0.114, 0.013, 0.075); break;
    case "barret": { const c = dome(0.124, Math.PI * 0.36, 0.075, 1.06, 0.55, 1.06); c.position.set(0.02, 0.075, 0.01); c.rotation.z = -0.28; mk(cyl(0.008, 0.012, 0.03, 6), M, g, 0.06, 0.11, 0); break; }
    case "bucket": dome(0.118, Math.PI * 0.5, 0.08, 1, 0.9, 1); { const b = mk(new THREE.CylinderGeometry(0.15, 0.12, 0.012, 20), M, g, 0, 0.082, 0); b.rotation.x = 0.08; } break;
    case "fila": { const c = dome(0.12, Math.PI * 0.5, 0.08, 1.0, 0.8, 1.06); c.rotation.x = -0.12; mk(cyl(0.118, 0.118, 0.045, 18, 1, true), M, g, 0, 0.08, 0).material = M; ring(g, dk, 0.118, 0.007, 0.062); break; }
    case "gele": {                           /* tall folded head-tie */
      for (let i = 0; i < 4; i++) { const t = mk(torus(0.085 - i * 0.012, 0.035, 8, 16), M, g, 0.0 + i * 0.012, 0.115 + i * 0.045, -0.01, Math.PI / 2.4, 0, 0.1 * i); t.scale.set(1.2, 1, 1.0); }
      const f = mk(sphere(0.07, 10, 8), M, g, 0.09, 0.21, 0.02); f.scale.set(1.2, 0.8, 0.8); break;
    }
    case "headband": ring(g, M, 0.108, 0.011, 0.105, 1.02, 1.07); break;
    case "durag": dome(0.114, Math.PI * 0.52, 0.068, 1.02, 1.05, 1.06); mk(new THREE.BoxGeometry(0.03, 0.2, 0.01), M, g, 0.04, -0.02, -0.12, 0.1, 0, 0.1); mk(new THREE.BoxGeometry(0.03, 0.18, 0.01), M, g, -0.04, -0.02, -0.12, 0.1, 0, -0.1); break;
    case "hardhat": dome(0.122, Math.PI * 0.5, 0.074, 1.0, 1.0, 1.05); brimDisc(0.15, 0.078, -0.05, 0.010); mk(box(0.03, 0.01, 0.2), dk, g, 0, 0.19, 0); break;
    case "tophat": brimDisc(0.15, 0.10, 0, 0.012); mk(cyl(0.095, 0.1, 0.20, 18), M, g, 0, 0.20, 0); ring(g, accent, 0.099, 0.012, 0.15); break;
    case "cowboy": { const b = brimDisc(0.20, 0.10, 0, 0.012); b.scale.set(1, 1, 0.9); mk(cyl(0.085, 0.105, 0.11, 16), M, g, 0, 0.16, 0); ring(g, dk, 0.103, 0.008, 0.125); break; }
    case "crown": { mk(cyl(0.10, 0.1, 0.06, 14, 1, true), accent, g, 0, 0.14, 0).material = lam("#d4af37", { side: THREE.DoubleSide }); for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; mk(cone(0.016, 0.05, 4), accent, g, Math.cos(a) * 0.1, 0.195, Math.sin(a) * 0.1); mk(sphere(0.008, 5, 4), lam(i % 2 ? "#d62839" : "#2563eb"), g, Math.cos(a) * 0.103, 0.14, Math.sin(a) * 0.103); } break; }
    case "headscarf": dome(0.123, Math.PI * 0.62, 0.06, 1.05, 1.1, 1.08); mk(new THREE.CylinderGeometry(0.115, 0.14, 0.15, 14, 1, true), M, g, 0, -0.02, -0.02).material = lam(col, { side: THREE.DoubleSide }); break;
    case "backcap": {                              /* cap worn back-to-front */
      dome(0.128, Math.PI * 0.5, 0.086, 1.03, 1.0, 1.08);
      ring(g, dk, 0.127, 0.006, 0.088, 1.03, 1.08, 18);
      mk(sphere(0.011, 6, 5), dk, g, 0, 0.214, 0);
      peak(0.108, 0.100, -0.085, -0.20, Math.PI);
      break;
    }
    case "visor": ring(g, M, 0.118, 0.011, 0.098, 1.03, 1.08, 18); peak(0.112, 0.104, 0.085, 0.16); break;
    case "sunhat": {
      mk(cyl(0.255, 0.255, 0.008, 30), M, g, 0, 0.092, 0).rotation.x = 0.05;
      mk(cyl(0.098, 0.118, 0.10, 20), M, g, 0, 0.14, 0);
      mk(cyl(0.098, 0.098, 0.006, 20), M, g, 0, 0.19, 0);
      ring(g, lam("#b91c1c"), 0.119, 0.009, 0.112, 1.0, 1.05, 18);
      break;
    }
    case "kufi": dome(0.126, Math.PI * 0.44, 0.080, 1.02, 1.04, 1.06); ring(g, accent, 0.121, 0.005, 0.1085, 1.02, 1.06, 18); ring(g, accent, 0.100, 0.004, 0.130, 1.02, 1.06, 16); break;
    case "fez": {
      mk(cyl(0.092, 0.118, 0.135, 22), M, g, 0, 0.152, 0);
      mk(cyl(0.092, 0.092, 0.006, 22), dk, g, 0, 0.222, 0);
      mk(cyl(0.003, 0.003, 0.10, 4), accent, g, 0.05, 0.215, 0, 0, 0, -1.05);
      mk(sphere(0.012, 6, 5), accent, g, 0.098, 0.17, 0);
      break;
    }
    case "turban": {
      for (let i = 0; i < 3; i++) { const t = mk(torus(0.100 - i * 0.012, 0.030, 8, 18), M, g, 0, 0.108 + i * 0.030, 0, Math.PI / 2, 0, 0.35 * i); t.scale.set(1.08, 1.1, 1); }
      mk(sphere(0.08, 10, 7), M, g, 0, 0.19, 0).scale.set(1, 0.65, 1.05);
      mk(sphere(0.012, 6, 5), accent, g, 0, 0.14, 0.128);
      break;
    }
    case "hijab": {
      dome(0.132, Math.PI * 0.5, 0.104, 1.04, 1.0, 1.08);
      mk(new THREE.CylinderGeometry(0.135, 0.175, 0.40, 22, 1, true, 1.0, Math.PI * 2 - 2.0), cloth, g, 0, -0.10, -0.012);
      mk(new THREE.CylinderGeometry(0.166, 0.178, 0.05, 20, 1, true, 1.0, Math.PI * 2 - 2.0), cloth, g, 0, -0.32, -0.012);
      break;
    }
    case "bandana": {
      dome(0.126, Math.PI * 0.44, 0.080, 1.02, 1.04, 1.06);
      ring(g, dk, 0.121, 0.006, 0.1085, 1.02, 1.06, 18);
      mk(box(0.045, 0.034, 0.018), M, g, 0, 0.098, -0.13);
      mk(box(0.022, 0.07, 0.008), M, g, 0.02, 0.04, -0.135, 0, 0, 0.35);
      mk(box(0.022, 0.07, 0.008), M, g, -0.02, 0.04, -0.135, 0, 0, -0.35);
      break;
    }
    case "santa": {
      mk(cone(0.118, 0.30, 14), M, g, 0, 0.23, -0.02, -0.35);
      ring(g, white, 0.122, 0.022, 0.090, 1.02, 1.08, 16);
      mk(sphere(0.03, 8, 6), white, g, 0, 0.372, -0.072);
      break;
    }
    case "wizard": {
      mk(cone(0.115, 0.36, 16), M, g, 0, 0.27, -0.01, -0.10);
      mk(cyl(0.205, 0.205, 0.010, 28), M, g, 0, 0.088, 0);
      ring(g, accent, 0.118, 0.010, 0.106, 1.0, 1.05, 18);
      mk(sphere(0.013, 5, 4), accent, g, 0, 0.15, 0.094);
      break;
    }
    case "chef": {
      mk(cyl(0.118, 0.118, 0.07, 20), M, g, 0, 0.13, 0);
      mk(sphere(0.145, 12, 8), M, g, 0, 0.25, 0).scale.set(1, 0.78, 1);
      break;
    }
    case "graduation": {
      mk(cyl(0.114, 0.12, 0.05, 18), black, g, 0, 0.12, 0);
      mk(box(0.30, 0.012, 0.30), black, g, 0, 0.153, 0, 0, Math.PI / 4, 0);
      mk(sphere(0.011, 6, 5), accent, g, 0, 0.163, 0);
      mk(cyl(0.0025, 0.0025, 0.09, 4), accent, g, 0.19, 0.105, 0);
      mk(sphere(0.011, 6, 5), accent, g, 0.19, 0.057, 0);
      break;
    }
    case "police": {
      dome(0.128, Math.PI * 0.5, 0.096, 1.03, 0.8, 1.08);
      mk(cyl(0.142, 0.128, 0.026, 22), M, g, 0, 0.17, 0.004);
      peak(0.100, 0.108, 0.090, 0.14);
      ring(g, black, 0.128, 0.008, 0.108, 1.03, 1.08, 18);
      mk(box(0.028, 0.034, 0.006), accent, g, 0, 0.145, 0.121, -0.1);
      break;
    }
    case "flowercrown": {
      ring(g, lam("#3f8f3a"), 0.114, 0.008, 0.108, 1.03, 1.08, 18);
      const cols = ["#f472b6", "#fde047", "#ffffff", "#fb923c", "#a78bfa"];
      for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283; mk(sphere(0.019, 6, 5), lam(cols[i % cols.length]), g, Math.sin(a) * 0.118, 0.11 + 0.008 * Math.sin(i * 2), Math.cos(a) * 0.124); }
      break;
    }
    case "tiara": {
      ring(g, accent, 0.113, 0.004, 0.118, 1.02, 1.08, 20);
      for (let i = 0; i < 7; i++) { const a = (i - 3) / 3 * 1.05, h = 0.026 + 0.034 * (1 - Math.abs(i - 3) / 3); mk(cone(0.0085, h, 4), accent, g, Math.sin(a) * 0.116, 0.118 + h / 2, Math.cos(a) * 0.124); }
      mk(sphere(0.0095, 6, 5), lam("#d62839"), g, 0, 0.138, 0.127);
      break;
    }
    case "catears": {
      ring(g, M, 0.117, 0.008, 0.108, 1.03, 1.08, 18);
      for (const sd of [-1, 1]) { mk(cone(0.042, 0.085, 3), M, g, sd * 0.078, 0.19, 0.005, 0, 0, -sd * 0.32); mk(cone(0.026, 0.06, 3), lam("#f9a8d4"), g, sd * 0.078, 0.183, 0.012, 0, 0, -sd * 0.32); }
      break;
    }
    case "bunnyears": {
      ring(g, M, 0.117, 0.008, 0.108, 1.03, 1.08, 18);
      for (const sd of [-1, 1]) { mk(sphere(0.032, 8, 6), M, g, sd * 0.05, 0.27, -0.01, 0, 0, -sd * 0.16).scale.set(0.7, 3.0, 0.4); mk(sphere(0.022, 8, 6), lam("#f9a8d4"), g, sd * 0.05, 0.268, 0.002, 0, 0, -sd * 0.16).scale.set(0.6, 2.7, 0.3); }
      break;
    }
    case "halo": mk(torus(0.088, 0.008, 6, 26), glow("#fff2a8"), g, 0, 0.30, -0.01, Math.PI / 2, 0, 0); break;
    case "helmet": {
      dome(0.132, Math.PI * 0.6, 0.076, 1.04, 1.0, 1.1);
      mk(box(0.15, 0.046, 0.03), lam("#1f2937"), g, 0, 0.104, 0.122, -0.08);
      ring(g, black, 0.131, 0.005, 0.152, 1.04, 1.1, 16);
      break;
    }
  }
}

/* ── jewellery / wrist / bag / mask ──
   phase "arms" is called again after arms exist (wrist wear). */
export function buildAccessories(cfg, mats, p, phase) {
  const { head, neck, spine, B } = p;
  const C = (it) => lam(resolveColor(GEAR_COLORS, it.color || 0));
  if (phase === "arms") {
    const w = cfg.wrist; if (!w || !p.rig) return; const c = C(w);
    const arms = w.style === "watch" ? [p.rig.armL] : [p.rig.armL, p.rig.armR];
    for (const arm of arms) {
      const wr = arm.elbow;
      if (w.style === "watch") { ring(wr, lam("#222"), 0.040, 0.007, -0.225, 1, 1, 12); mk(cyl(0.022, 0.022, 0.008, 14), c, wr, 0, -0.225, 0.041, Math.PI / 2); mk(cyl(0.017, 0.017, 0.009, 14), glow("#7fd0ff"), wr, 0, -0.225, 0.042, Math.PI / 2); }
      else if (w.style === "band") ring(wr, c, 0.040, 0.012, -0.222, 1, 1, 12);
      else if (w.style === "bracelet") ring(wr, c, 0.039, 0.0045, -0.225, 1, 1, 12);
      else for (let i = 0; i < 4; i++) ring(wr, c, 0.039, 0.004, -0.205 - i * 0.011, 1, 1, 12);
    }
    return;
  }
  const n = cfg.neck;
  if (n && n.style) {
    const c = C(n), gold = lam("#d4af37"), steel = lam("#9ca3af");
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    /* chest-surface depth (spine space) measured by ray-casting the real torso shells, so jewellery rests on
       the cloth instead of floating (the old formula overshot by up to 4 cm near the collar) */
    const CHEST = B.female
      ? [[0.42, 0.062], [0.40, 0.055], [0.38, 0.063], [0.35, 0.075], [0.32, 0.090], [0.28, 0.114], [0.24, 0.128], [0.20, 0.111]]
      : B.male
        ? [[0.42, 0.070], [0.40, 0.078], [0.38, 0.085], [0.35, 0.096], [0.32, 0.104], [0.28, 0.113], [0.24, 0.118], [0.20, 0.118]]
        : [[0.42, 0.058], [0.40, 0.066], [0.38, 0.074], [0.35, 0.086], [0.32, 0.099], [0.28, 0.115], [0.24, 0.121], [0.20, 0.113]];
    const fz = (y, x = 0, ease = 0.006) => {
      let z;
      if (y >= CHEST[0][0]) z = CHEST[0][1];
      else if (y <= CHEST[CHEST.length - 1][0]) z = CHEST[CHEST.length - 1][1];
      else for (let i = 1; i < CHEST.length; i++) if (y >= CHEST[i][0]) { const t = (y - CHEST[i][0]) / (CHEST[i - 1][0] - CHEST[i][0]); z = CHEST[i][1] + (CHEST[i - 1][1] - CHEST[i][1]) * t; break; }
      const hw = 0.15 * B.sxT, k = Math.sqrt(Math.max(0.2, 1 - (x * x) / (hw * hw)));
      return z * k + ease;
    };
    const sstep = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
    /* closed loop round the neck that sags onto the chest (a real necklace shape, not a floating arc) */
    const loopPts = (drop, spread, yN = 0.428, N = 44, pw = 1.5) => {
      const pts = [];
      for (let i = 0; i < N; i++) {
        const a = i / N * Math.PI * 2, cf = Math.cos(a), sf = Math.sin(a), d = Math.max(0, cf) ** pw;
        const y = yN - drop * d, x = sf * (0.064 + spread * d);
        const z = cf > 0 ? fz(y, x) * sstep(cf / 0.35) : cf * 0.068;
        pts.push(V3(x, y, z));
      }
      return pts;
    };
    const tube = (pts, r, mat) => { const m = mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), pts.length * 2, r, 5, true), mat, spine); m.castShadow = false; return m; };
    const chain = (drop, spread, r, mat = c, yN = 0.428) => { const pts = loopPts(drop, spread, yN); tube(pts, r, mat); return { y: yN - drop, z: fz(yN - drop) }; };
    const strand = (drop, spread, rad, matFn, N = 34, yN = 0.428) => { const pts = loopPts(drop, spread, yN, N); pts.forEach((q, i) => mk(sphere(rad, 6, 5), matFn(i), spine, q.x, q.y, q.z)); return { y: yN - drop, z: fz(yN - drop) }; };
    const hangAt = (low, geo, mat, scl = 1, rx = -0.18) => { const m = mk(geo, mat, spine, 0, low.y - 0.012, low.z + 0.008, rx); m.scale.setScalar(scl); return m; };
    const st = n.style;
    if (st === "chain") chain(0.07, 0.035, 0.0036);
    else if (st === "pendant") { const l = chain(0.09, 0.04, 0.0032); mk(sphere(0.013, 8, 6), c, spine, 0, l.y - 0.012, l.z + 0.006); }
    else if (st === "choker") { ring(spine, c, 0.061, 0.0075, 0.446, 1, 1, 18); mk(sphere(0.0105, 6, 5), c, spine, 0, 0.446, 0.064); }
    else if (st === "pearls") strand(0.10, 0.05, 0.0085, () => lam("#f6f1e6"), 38);
    else if (st === "beads") strand(0.085, 0.045, 0.0105, (i) => (i % 5 === 0 ? c : lam("#b3261e")), 30);
    else if (st === "scarf") { ring(spine, c, 0.070, 0.017, 0.436, 1.05, 1.0, 14); mk(box(0.05, 0.19, 0.012), c, spine, 0.04, 0.325, fz(0.325, 0.04) + 0.008, -0.16, 0, 0.05); mk(box(0.05, 0.15, 0.012), lam(shade(resolveColor(GEAR_COLORS, n.color || 0), -0.12)), spine, 0.075, 0.345, fz(0.345, 0.075) + 0.012, -0.16, 0, -0.08); }
    else if (st === "cross") { const l = chain(0.11, 0.045, 0.0032); const g2 = new THREE.Group(); mk(box(0.011, 0.048, 0.005), gold, g2); mk(box(0.032, 0.011, 0.005), gold, g2, 0, 0.011, 0); g2.position.set(0, l.y - 0.026, l.z + 0.007); g2.rotation.x = -0.18; spine.add(g2); }
    else if (st === "heart") { const l = chain(0.095, 0.042, 0.0032); const g2 = new THREE.Group(); const hm = lam("#d62839"); for (const sd of [-1, 1]) mk(sphere(0.011, 8, 6), hm, g2, sd * 0.0085, 0.006, 0); mk(cone(0.0195, 0.03, 4), hm, g2, 0, -0.008, 0, 0, Math.PI / 4, Math.PI); g2.scale.z = 0.5; g2.position.set(0, l.y - 0.014, l.z + 0.007); g2.rotation.x = -0.18; spine.add(g2); }
    else if (st === "locket") { const l = chain(0.13, 0.05, 0.0032); mk(sphere(0.02, 10, 8), gold, spine, 0, l.y - 0.022, l.z + 0.012, -0.18).scale.set(0.82, 1.0, 0.32); mk(sphere(0.007, 6, 5), lam("#fff"), spine, 0, l.y - 0.022, l.z + 0.021); }
    else if (st === "layered") { chain(0.05, 0.03, 0.0028); chain(0.095, 0.045, 0.0032, c); const l = chain(0.145, 0.058, 0.0036, gold); mk(sphere(0.011, 8, 6), gold, spine, 0, l.y - 0.012, l.z + 0.006); }
    else if (st === "dogtag") { const l = strand(0.15, 0.055, 0.0045, () => steel, 40); for (let k = 0; k < 2; k++) mk(box(0.03, 0.052, 0.003), steel, spine, 0.002 * k, l.y - 0.03 - k * 0.004, l.z + 0.008 + k * 0.004, -0.18); }
    else if (st === "chunky") { chain(0.075, 0.042, 0.0085, gold); chain(0.075, 0.042, 0.0085, c); }
    else if (st === "lei") { const cols = ["#f472b6", "#fde047", "#fb923c", "#ffffff", "#a78bfa"]; strand(0.13, 0.07, 0.0125, (i) => lam(cols[i % cols.length]), 30); }
    else if (st === "shell") { const l = chain(0.095, 0.04, 0.0028, lam("#7c5a3a")); const sh = mk(sphere(0.022, 10, 7), lam("#fde7cf"), spine, 0, l.y - 0.02, l.z + 0.012, -0.18); sh.scale.set(1.0, 0.85, 0.4); }
    else if (st === "bandana") { ring(spine, c, 0.066, 0.013, 0.432, 1.04, 1.0, 16); mk(box(0.072, 0.072, 0.008), c, spine, 0, 0.402, fz(0.385) + 0.004, -0.2, 0, Math.PI / 4); }
    else if (st === "medal") { const l = chain(0.12, 0.05, 0.005, lam("#2563eb")); mk(cyl(0.026, 0.026, 0.005, 16), gold, spine, 0, l.y - 0.026, l.z + 0.008, Math.PI / 2 - 0.18); mk(cyl(0.015, 0.015, 0.006, 12), lam("#b8860b"), spine, 0, l.y - 0.026, l.z + 0.0105, Math.PI / 2 - 0.18); }
    else if (st === "stethoscope") { const l = chain(0.15, 0.075, 0.0055, black0()); mk(cyl(0.022, 0.022, 0.008, 14), steel, spine, 0, l.y - 0.01, l.z + 0.008, Math.PI / 2 - 0.18); }
    function black0() { return lam("#1f2937"); }
  }
  const e = cfg.ears;
  if (e && e.style) {
    const c = C(e);
    for (const s of [-1, 1]) {
      if (e.style === "studs") mk(sphere(0.007, 6, 5), c, head, s * 0.1, 0.040, 0.004);
      else if (e.style === "hoops") mk(torus(0.016, 0.0028, 5, 12), c, head, s * 0.103, 0.028, 0.0, 0, Math.PI / 2, 0);
      else if (e.style === "drops") { mk(cyl(0.0015, 0.0015, 0.03, 4), c, head, s * 0.103, 0.025, 0); mk(sphere(0.009, 6, 5), c, head, s * 0.103, 0.008, 0); }
      else if (e.style === "cuffs") { mk(torus(0.011, 0.0025, 5, 12), c, head, s * 0.104, 0.074, 0.0, 0, Math.PI / 2, 0); mk(sphere(0.005, 5, 4), c, head, s * 0.104, 0.060, 0.004); }
      else if (e.style === "pearls") { mk(sphere(0.011, 8, 6), lam("#f6f1e6"), head, s * 0.103, 0.036, 0.004); mk(cyl(0.0012, 0.0012, 0.02, 4), c, head, s * 0.103, 0.022, 0.004); mk(sphere(0.0085, 8, 6), lam("#f6f1e6"), head, s * 0.103, 0.010, 0.004); }
      else if (e.style === "earmuffs") mk(sphere(0.04, 10, 8), c, head, s * 0.118, 0.055, -0.004).scale.set(0.55, 1.05, 1.0);
      else if (e.style === "headphones") { const cup = mk(cyl(0.032, 0.032, 0.022, 14), c, head, s * 0.118, 0.055, -0.004, 0, 0, Math.PI / 2); mk(cyl(0.024, 0.024, 0.008, 12), lam("#222"), head, s * 0.131, 0.055, -0.004, 0, 0, Math.PI / 2); }
    }
    if (e.style === "earmuffs") { const b = mk(torus(0.118, 0.006, 5, 16, Math.PI), lam("#374151"), head, 0, 0.055, -0.004, 0, 0, 0); b.scale.set(1, 1.18, 1.0); }
    if (e.style === "headphones") { const b = mk(torus(0.118, 0.006, 5, 16, Math.PI), c, head, 0, 0.055, -0.004, 0, 0, 0); b.scale.set(1, 1.18, 1.0); }
  }
  const m = cfg.mask;
  if (m && m.style) {
    const c = C(m);
    if (m.style === "surgical") { const f = mk(new THREE.SphereGeometry(0.085, 12, 8, -1.0, 2.0, 1.15, 0.9), m.color == null ? lam("#cfe8f2", { side: THREE.DoubleSide }) : lam(resolveColor(GEAR_COLORS, m.color), { side: THREE.DoubleSide }), head, 0, 0.022, 0.026); f.scale.set(1.13, 0.95, 1.18); for (const s of [-1, 1]) mk(box(0.003, 0.004, 0.09), lam("#eee"), head, s * 0.098, 0.035, -0.02, 0, s * 0.3, 0); }
    else { const f = mk(new THREE.SphereGeometry(0.085, 12, 8, -1.2, 2.4, 1.15, 0.95), lam(resolveColor(GEAR_COLORS, m.color || 0), { side: THREE.DoubleSide }), head, 0, 0.026, 0.022); f.scale.set(1.15, 0.95, 1.18); mk(torus(0.1, 0.006, 4, 16), c, head, 0, 0.05, -0.0, Math.PI / 2, 0, 0); }
  }
  const b = cfg.bag;
  if (b && b.style) {
    const c = C(b), dk = lam(shade(resolveColor(GEAR_COLORS, b.color || 0), -0.2));
    const zb = -B.szT * 0.19 - 0.01;
    if (b.style === "backpack") { mk(box(0.24, 0.32, 0.11), c, spine, 0, 0.22, zb - 0.05); mk(box(0.20, 0.14, 0.03), dk, spine, 0, 0.14, zb - 0.12); for (const s of [-1, 1]) mk(box(0.03, 0.30, 0.012), dk, spine, s * 0.09, 0.26, B.szT * 0.19 + 0.012); }
    else if (b.style === "satchel") { mk(box(0.26, 0.17, 0.07), c, p.hips, 0.19 * B.sxP, -0.10, 0); mk(box(0.012, 0.50, 0.012), dk, spine, -0.04, 0.2, B.szT * 0.19 + 0.012, 0, 0, 0.6).castShadow = false; }
    else { mk(box(0.20, 0.13, 0.08), c, spine, 0, 0.04, B.szT * 0.17 + 0.05); mk(box(0.012, 0.5, 0.012), dk, spine, 0.02, 0.2, B.szT * 0.19 + 0.01, 0, 0, -0.55).castShadow = false; }
  }
}
