/* lp-hair.js — hairstyles + beards (all use the hair colour unless a beard colour is set) */
import * as THREE from "three";
import { mk, sphere, box, cyl, torus, cone, lam, revolve } from "./lp-parts.js";
import { resolveColor, HAIR_COLORS } from "../core/wardrobe.js";

const PHI = Math.PI * 0.42;
function cap(g, M, r, y = 0.070, sx = 1.02, sy = 1.10, sz = 1.06, phi = PHI, rx = -0.14) {
  const m = mk(new THREE.SphereGeometry(r, 14, 10, 0, Math.PI * 2, 0, phi), M, g, 0, y, 0);
  m.scale.set(sx, sy, sz); m.rotation.x = rx; return m;
}
export function buildHair(cfg, mats, head) {
  const style = cfg.hairStyle;
  if (!style || style === "bald") return;
  const g = new THREE.Group(); head.add(g);
  const M = mats.hair;
  const S = (r, x, y, z, sx = 1, sy = 1, sz = 1, ws = 7, hs = 5) => { const m = mk(sphere(r, ws, hs), M, g, x, y, z); m.scale.set(sx, sy, sz); return m; };
  switch (style) {
    case "short": cap(g, M, 0.112); break;
    case "buzz": cap(g, M, 0.109, 0.068, 1.005, 1.03, 1.02, PHI * 0.92); break;
    case "curly": {
      cap(g, M, 0.120, 0.072, 1.04, 1.10, 1.06);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * 6.283, phi = 0.12 + (i % 3) * 0.11;
        S(0.027, Math.cos(a) * Math.sin(phi) * 0.11, 0.115 + Math.cos(phi) * 0.055, Math.sin(a) * Math.sin(phi) * 0.11);
      }
      break;
    }
    case "long": cap(g, M, 0.115); S(0.10, 0, -0.03, -0.055, 1.0, 1.55, 0.85, 10, 8); break;
    case "ponytail":
      cap(g, M, 0.112);
      mk(torus(0.032, 0.008, 4, 10), M, g, 0, 0.055, -0.115, Math.PI / 2, 0, 0);
      S(0.058, 0, -0.02, -0.145, 0.85, 1.55, 0.85, 8, 7); break;
    case "afro": {
      const m = mk(new THREE.SphereGeometry(0.15, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.60), M, g, 0, 0.10, -0.035); m.scale.set(1.08, 1.0, 1.0); m.rotation.x = -0.30;
      break;
    }
    case "braids": {
      cap(g, M, 0.113, 0.068);
      for (let i = 0; i < 9; i++) {         /* cornrow ridges front → back */
        const x = (i - 4) * 0.021;
        const r = mk(box(0.010, 0.010, 0.17), M, g, x, 0.172 - Math.abs(x) * 0.5, -0.02, -0.15);
      }
      for (let i = 0; i < 8; i++) {          /* hanging braids */
        const a = Math.PI * (0.25 + i * 0.07) + Math.PI;
        const x = Math.cos(a) * 0.105, z = Math.sin(a) * 0.105 - 0.01;
        mk(cyl(0.010, 0.006, 0.20, 5), M, g, x, -0.04, z);
      }
      break;
    }
    case "locs": {
      cap(g, M, 0.116, 0.072);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * 6.283, x = Math.cos(a) * 0.105, z = Math.sin(a) * 0.105;
        if (z > 0.055 && Math.abs(x) < 0.07) continue;
        const l = 0.12 + (i % 3) * 0.04;
        mk(cyl(0.011, 0.008, l, 5), M, g, x, 0.07 - l / 2 + 0.03, z * 0.95, 0, 0, 0);
      }
      break;
    }
    case "bun": cap(g, M, 0.112); S(0.052, 0, 0.19, -0.02, 1, 0.9, 1, 10, 8); mk(torus(0.045, 0.008, 4, 10), M, g, 0, 0.165, -0.02, Math.PI / 2, 0, 0); break;
    case "mohawk":
      cap(g, M, 0.106, 0.066, 1.0, 1.0, 1.0, PHI * 0.6);
      for (let i = 0; i < 7; i++) { const t = i / 6; mk(cone(0.024, 0.10 + Math.sin(t * 3.14) * 0.05, 5), M, g, 0, 0.165 + Math.sin(t * 3.14) * 0.01, 0.07 - t * 0.17, -0.2 + t * 0.4); }
      break;
    case "hightop": {
      const m = mk(cyl(0.092, 0.108, 0.095, 14), M, g, 0, 0.185, -0.005); m.scale.set(1.02, 1, 1.05);
      cap(g, M, 0.108, 0.07, 1.0, 1.0, 1.04, PHI * 0.9);
      mk(sphere(0.094, 12, 5, 0, 6.283, 0, 1.2), M, g, 0, 0.225, -0.005).scale.set(1.02, 0.35, 1.05);
      break;
    }
    case "bob": cap(g, M, 0.118, 0.07, 1.04, 1.10, 1.08); mk(new THREE.CylinderGeometry(0.118, 0.12, 0.10, 14, 1, true), M, g, 0, 0.02, -0.01).material = M; S(0.1, 0, 0.0, -0.05, 1.12, 0.9, 0.95, 10, 8); break;
    case "pigtails":
      cap(g, M, 0.112);
      for (const s of [-1, 1]) {
        mk(torus(0.022, 0.007, 4, 8), M, g, s * 0.10, 0.07, -0.03, 0, Math.PI / 2, 0);
        S(0.048, s * 0.13, 0.0, -0.03, 0.8, 1.7, 0.8, 8, 6);
      }
      break;
    case "knots": {                          /* bantu knots */
      cap(g, M, 0.110, 0.068, 1.0, 1.0, 1.0, PHI * 0.9);
      const pts = [[0, .17, .02], [.07, .15, .05], [-.07, .15, .05], [.1, .13, -.02], [-.1, .13, -.02], [.05, .15, -.07], [-.05, .15, -.07], [0, .16, -.09], [0, .16, .08]];
      for (const [x, y, z] of pts) S(0.030, x, y + 0.01, z, 1, 1.15, 1, 7, 6);
      break;
    }
    case "pompadour":
      cap(g, M, 0.110, 0.066, 1.0, 1.0, 1.04, PHI * 0.9);
      mk(new THREE.CapsuleGeometry(0.05, 0.12, 4, 8), M, g, 0, 0.17, 0.06, 0.9, 0, Math.PI / 2).scale.set(1, 1, 0.8);
      break;
  }
}

export function buildBeard(cfg, mats, head) {
  const b = cfg.beard; if (!b || !b.style) return;
  const col = b.color == null ? mats.hair : lam(resolveColor(HAIR_COLORS, b.color));
  const g = new THREE.Group(); head.add(g);
  const S = (r, x, y, z, sx, sy, sz) => { const m = mk(sphere(r, 8, 6), col, g, x, y, z); m.scale.set(sx, sy, sz); return m; };
  const jawShell = (sc, y0, a, thick) => {   /* hair on the lower face, shaped to the jaw */
    const m = mk(new THREE.SphereGeometry(0.078 + thick, 12, 8, 0, Math.PI * 2, Math.PI * a, Math.PI * 0.5), col, g, 0, 0.016, 0.012);
    m.scale.set(0.90, 0.80, 0.97); m.position.y = y0; return m;
  };
  const st = b.style;
  if (st === "stubble") jawShell(0, 0.022, 0.40, 0.003);
  if (st === "moustache" || st === "full" || st === "long" || st === "goatee") { S(0.016, 0.014, 0.0305, 0.104, 1.35, 0.5, 0.55).rotation.z = 0.2; S(0.016, -0.014, 0.0305, 0.104, 1.35, 0.5, 0.55).rotation.z = -0.2; }
  if (st === "goatee") S(0.020, 0, -0.012, 0.098, 1, 1.2, 0.7);
  if (st === "chinstrap" || st === "full" || st === "long") { const m = jawShell(0, 0.018, 0.40, 0.006); }
  if (st === "full") { S(0.05, 0, -0.025, 0.07, 1.2, 0.9, 0.9); }
  if (st === "long") { S(0.05, 0, -0.05, 0.075, 1.1, 2.4, 0.8); S(0.03, 0, -0.12, 0.07, 1, 2.2, 0.8); }
}
