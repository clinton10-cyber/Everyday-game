/* lp-extras.js — hats, glasses, jewellery, wrist wear, bags, masks */
import * as THREE from "three";
import { mk, sphere, box, cyl, torus, cone, lam, glow, shade, ring } from "./lp-parts.js";
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
  switch (hat.style) {
    case "cap": dome(0.118, Math.PI * 0.46, 0.075); mk(new THREE.CylinderGeometry(0.09, 0.09, 0.008, 16, 1, false, 0, Math.PI), M, g, 0, 0.075, 0.06, -0.35); break;
    case "facecap": dome(0.118, Math.PI * 0.45, 0.075); mk(new THREE.CylinderGeometry(0.115, 0.115, 0.010, 20, 1, false, 0, Math.PI * 0.9), M, g, 0, 0.075, 0.075, -0.25); break;
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
    const c = C(n);
    const hang = (len, sc = 1) => { const t = mk(torus(0.085, 0.004 * sc, 5, 20, Math.PI * 2), c, spine, 0, 0.415 - len * 0.2, 0.01, Math.PI / 2 - 0.45, 0, 0); t.scale.set(1.05, 1.5, 1); return t; };
    if (n.style === "chain") hang(0.06);
    else if (n.style === "pendant") { hang(0.06); mk(sphere(0.013, 8, 6), c, spine, 0, 0.30, B.szT * 0.19 + 0.01); }
    else if (n.style === "choker") ring(spine, c, 0.058, 0.005, 0.436, 1, 1, 14);
    else if (n.style === "pearls" || n.style === "beads") {
      const bead = n.style === "beads" ? 0.010 : 0.0075;
      const col = n.style === "beads" ? lam("#b3261e") : lam("#f6f1e6");
      for (let i = 0; i < 26; i++) { const a = (i / 26) * 6.283, rx = 0.092, rz = 0.088, y = 0.43 - 0.09 * Math.max(0, Math.cos(a)) ** 1.5 - (n.style === "beads" ? 0.03 : 0); mk(sphere(bead, 6, 5), n.style === "pearls" ? col : (i % 5 === 0 ? c : col), spine, Math.sin(a) * rx * B.sxT, y, Math.cos(a) * (0.06 + 0.04 * Math.max(0, Math.cos(a)))); }
    }
    else if (n.style === "scarf") { ring(spine, c, 0.075, 0.020, 0.425, 1.05, 1.0, 14); mk(box(0.06, 0.20, 0.016), c, spine, 0.045, 0.31, B.szT * 0.17 + 0.01, 0, 0, 0.05); }
  }
  const e = cfg.ears;
  if (e && e.style) {
    const c = C(e);
    for (const s of [-1, 1]) {
      if (e.style === "studs") mk(sphere(0.007, 6, 5), c, head, s * 0.1, 0.040, 0.004);
      else if (e.style === "hoops") mk(torus(0.016, 0.0028, 5, 12), c, head, s * 0.103, 0.028, 0.0, 0, Math.PI / 2, 0);
      else if (e.style === "drops") { mk(cyl(0.0015, 0.0015, 0.03, 4), c, head, s * 0.103, 0.025, 0); mk(sphere(0.009, 6, 5), c, head, s * 0.103, 0.008, 0); }
      else if (e.style === "headphones") { const cup = mk(cyl(0.032, 0.032, 0.022, 14), c, head, s * 0.118, 0.055, -0.004, 0, 0, Math.PI / 2); mk(cyl(0.024, 0.024, 0.008, 12), lam("#222"), head, s * 0.131, 0.055, -0.004, 0, 0, Math.PI / 2); }
    }
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
