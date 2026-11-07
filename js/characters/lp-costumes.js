/* lp-costumes.js — costume props (colourable: P = main, S = accent).
   Clothing changes come from wardrobe.js COSTUME_INFO.outfit; this adds hats,
   capes, masks, wings, tails and so on. */
import * as THREE from "three";
import { COSTUME_STYLES } from "../core/wardrobe.js";
import { mk, sphere, box, cyl, torus, cone, lam, glow } from "./lp-parts.js";

export const COSTUMES = COSTUME_STYLES;

export function buildCostume(cfg, M, head, spine, hips, B) {
  const info = cfg._costume; if (!info) return;
  const { name, P, S } = info;
  const mat = (c, o) => lam(c, o), p = mat(P), s = mat(S);
  const DS = { side: THREE.DoubleSide };
  const m = (geo, mt, x, y, z, a, b, c) => typeof a === "number" ? mk(geo, mt, head, x, y, z, a, b, c) : mk(geo, mt, a || head, x, y, z);
  const SP = sphere, CY = cyl, CO = cone, BX = box;
  const back = (B ? B.szT * 0.19 : 0.135) + 0.02;
  const front = (B ? B.szT * 0.20 : 0.14) + 0.02;
  const cape = (w, h, mt, y = 0.10, rx = 0.10) => { const c = m(BX(w, h, 0.025), mt, 0, y, -back, spine); c.rotation.x = rx; return c; };
  const eyes = (c, y = 0.095, z = 0.108, x = 0.05, r = 0.03) => { for (const sx of [-x, x]) { const e = m(SP(r, 8, 6), glow(c), sx, y, z); e.scale.set(1, 1.2, 0.5); } };

  switch (name) {
    case "pumpkin": {
      const b = m(SP(0.17, 14, 10), p, 0, 0.085, 0); b.scale.set(1.1, 0.95, 1.05);
      for (const x of [-0.07, 0.07]) m(SP(0.12, 10, 8), p, x, 0.085, 0).scale.set(0.55, 0.95, 1);
      m(CY(0.018, 0.026, 0.07, 6), s, 0, 0.27, 0);
      const g = glow(0xffc23a);
      for (const x of [-0.065, 0.065]) m(CO(0.035, 0.06, 3), g, x, 0.13, 0.165).rotation.set(Math.PI / 2, 0, Math.PI);
      m(BX(0.14, 0.035, 0.02), g, 0, 0.035, 0.168);
      break;
    }
    case "witch": {
      m(CY(0.20, 0.20, 0.012, 20), p, 0, 0.09, 0);
      m(CO(0.12, 0.34, 14), p, 0.01, 0.27, 0).rotation.z = -0.15;
      m(CY(0.122, 0.122, 0.04, 14, true), s, 0, 0.12, 0).material = lam(S, DS);
      m(BX(0.04, 0.04, 0.012), mat("#e0b020"), 0, 0.12, 0.123);
      cape(0.40, 0.62, mat(S), 0.10); break;
    }
    case "vampire": {
      cape(0.46, 0.78, p, 0.02); m(BX(0.44, 0.76, 0.01), s, 0, 0.02, -back + 0.014, spine).rotation.x = 0.10;
      for (const x of [-0.13, 0.13]) { const c = m(BX(0.14, 0.20, 0.03), p, x, 0.46, -0.08, spine); c.rotation.z = x > 0 ? -0.35 : 0.35; }
      for (const x of [-0.016, 0.016]) m(CO(0.009, 0.03, 6), mat("#fff"), x, 0.0085, 0.095).rotation.x = Math.PI;
      m(new THREE.SphereGeometry(0.12, 10, 6, 0, 6.283, 0, 1.5), p, 0, 0.085, -0.01).scale.set(1.02, 0.9, 1.02); break;
    }
    case "devil": {
      for (const x of [-1, 1]) m(CO(0.028, 0.14, 8), p, x * 0.065, 0.20, 0).rotation.z = -x * 0.35;
      const t = new THREE.Group(); t.position.set(0, -0.02, -0.10); hips.add(t);
      m(CY(0.011, 0.011, 0.34, 6), p, 0, -0.10, -0.12, t).rotation.x = 0.9;
      m(CO(0.045, 0.09, 3), p, 0, -0.26, -0.28, t).rotation.x = -2.3;
      cape(0.34, 0.45, s, 0.12); break;
    }
    case "ghost": {
      const w = mat(P, { transparent: true, opacity: 0.94, side: THREE.DoubleSide });
      m(CY(0.20, 0.34, 0.95, 16, 1, true), w, 0, -0.12, 0, spine);
      m(new THREE.SphereGeometry(0.2, 14, 8, 0, 6.283, 0, 1.57), w, 0, 0.35, 0, spine).scale.set(1, 0.8, 1);
      m(SP(0.165, 14, 10), w, 0, 0.085, 0); eyes(S, 0.10, 0.152, 0.055, 0.025);
      m(SP(0.03, 8, 6), glow(S), 0, 0.03, 0.155).scale.set(1, 1.4, 0.5); break;
    }
    case "skeleton": {
      const sk = m(SP(0.128, 14, 10), p, 0, 0.075, 0.005); sk.scale.set(0.95, 1.05, 1);
      eyes(S, 0.095, 0.108, 0.05, 0.034);
      for (let i = -2; i <= 2; i++) m(BX(0.012, 0.03, 0.01), glow(S), i * 0.025, -0.01, 0.12);
      for (let i = 0; i < 5; i++) m(BX(0.30 - i * 0.03, 0.022, 0.01), p, 0, 0.30 - i * 0.065, front, spine);
      m(BX(0.026, 0.36, 0.01), p, 0, 0.17, front, spine); break;
    }
    case "mummy": {
      for (let i = 0; i < 4; i++) { const r = m(CY(0.12, 0.12, 0.035, 14, true), lam(i % 2 ? S : P, DS), 0, i * 0.045, 0); r.rotation.z = (i - 1.5) * 0.08; }
      m(BX(0.12, 0.035, 0.01), glow(0x0a0a0a), 0, 0.075, 0.12);
      for (let i = 0; i < 7; i++) { const b = m(CY(0.19, 0.19, 0.035, 14, true), lam(i % 2 ? S : P, DS), 0, 0.02 + i * 0.058, 0, spine); b.rotation.z = (i % 3 - 1) * 0.07; b.scale.set(1.0, 1.0, 0.72); }
      break;
    }
    case "zombie": {
      m(BX(0.06, 0.035, 0.01), s, 0.05, 0.09, 0.10).rotation.z = 0.5; m(BX(0.05, 0.03, 0.01), s, -0.04, 0.03, 0.10);
      eyes(0xd8e46a, 0.095, 0.1, 0.05, 0.03);
      m(BX(0.26, 0.10, 0.012), p, 0, 0.12, front, spine).rotation.z = 0.2; m(BX(0.10, 0.08, 0.012), s, -0.06, 0.28, front, spine); break;
    }
    case "superhero": {
      cape(0.36, 0.7, s, 0.05, 0.12);
      m(BX(0.12, 0.07, 0.012), s, 0, 0.22, front + 0.002, spine);
      const mk2 = m(new THREE.SphereGeometry(0.108, 12, 8, 0, 6.283, 0.95, 0.5), s, 0, 0.055, 0.004); mk2.scale.set(1.01, 1.1, 1.05);
      for (const x of [-0.04, 0.04]) m(SP(0.02, 6, 5), mat("#fff"), x, 0.07, 0.105).scale.set(1.3, 0.7, 0.4);
      m(BX(0.30, 0.02, 0.01), s, 0, 0.03, front, spine); break;
    }
    case "ninja": {
      m(new THREE.SphereGeometry(0.113, 12, 9, 0, 6.283, 0, 1.45), p, 0, 0.065, 0).scale.set(1.02, 1.1, 1.06);
      const wrap = m(new THREE.SphereGeometry(0.109, 12, 8, 0, 6.283, 1.55, 1.1), p, 0, 0.055, 0.004); wrap.scale.set(1.02, 1.1, 1.06);
      m(torus(0.11, 0.01, 4, 14), s, 0, 0.085, 0, Math.PI / 2, 0, 0).scale.set(1, 1.05, 1);
      m(BX(0.03, 0.02, 0.12), s, -0.03, 0.08, -0.14, 0, 0, 0.2); break;
    }
    case "pirate": {
      m(new THREE.SphereGeometry(0.114, 12, 8, 0, 6.283, 0, 1.2), s, 0, 0.08, 0).scale.set(1.04, 0.8, 1.06);
      const h = m(CO(0.2, 0.09, 3), p, 0, 0.17, 0); h.scale.set(1.4, 1, 0.6); h.rotation.set(0, Math.PI / 2, 0);
      m(SP(0.015, 6, 5), mat("#eee"), 0, 0.17, 0.065);
      m(SP(0.03, 8, 6), mat("#111"), 0.04, 0.07, 0.105).scale.set(1, 1, 0.4); m(BX(0.01, 0.01, 0.22), mat("#111"), 0, 0.09, 0.0).rotation.z = 0.3;
      m(BX(0.34, 0.03, 0.18), s, 0, 0.06, 0, spine).visible = false; break;
    }
    case "clown": {
      m(SP(0.028, 8, 6), p, 0, 0.04, 0.118);
      for (const x of [-1, 1]) m(SP(0.075, 8, 6), mat(x > 0 ? S : "#facc15"), x * 0.11, 0.12, -0.0).scale.set(1, 1, 1);
      m(BX(0.16, 0.02, 0.006), p, 0, 0.018, 0.1).rotation.z = 0;
      m(torus(0.035, 0.008, 4, 8, Math.PI), p, 0, 0.02, 0.1, 0, 0, Math.PI);
      ring2(m, spine, S, 0.43); break;
    }
    case "astronaut": {
      const hm = m(SP(0.17, 16, 12), lam("#fff", { transparent: true, opacity: 0.28, depthWrite: false }), 0, 0.06, 0.0);
      m(torus(0.14, 0.03, 8, 16), p, 0, -0.04, 0, Math.PI / 2, 0, 0);
      m(BX(0.26, 0.34, 0.12), p, 0, 0.22, -back - 0.03, spine); m(BX(0.1, 0.1, 0.02), s, 0, 0.14, front, spine); break;
    }
    case "knight": {
      const hl = m(new THREE.SphereGeometry(0.125, 14, 10, 0, 6.283, 0, 2.0), p, 0, 0.06, 0); hl.scale.set(1.0, 1.1, 1.05);
      m(BX(0.15, 0.012, 0.02), glow(0x0a0a0c), 0, 0.075, 0.12);
      m(BX(0.02, 0.1, 0.02), s, 0, 0.21, 0).scale.set(1, 1, 3);
      for (const x of [-1, 1]) m(SP(0.085, 10, 8), p, x * (B ? B.shoulderX : 0.185), 0.40, 0, spine).scale.set(1, 0.7, 1);
      m(BX(0.34, 0.4, 0.02), p, 0, 0.2, front, spine).visible = false;
      m(BX(0.28, 0.3, 0.012), mat(S), 0, 0.2, front + 0.004, spine); cape(0.34, 0.6, s, 0.0, 0.1); break;
    }
    case "king": {
      const cr = lam(S);
      m(CY(0.10, 0.10, 0.07, 14, true), lam(S, DS), 0, 0.15, 0);
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; m(CO(0.02, 0.055, 4), cr, Math.cos(a) * 0.1, 0.205, Math.sin(a) * 0.1); m(SP(0.01, 5, 4), mat("#d62839"), Math.cos(a) * 0.1, 0.15, Math.sin(a) * 0.1); }
      m(BX(0.40, 0.06, 0.03), mat("#f3f3f3"), 0, 0.45, -0.02, spine).rotation.x = 0.05; break;
    }
    case "angel": {
      for (const x of [-1, 1]) { const w = m(SP(0.16, 10, 8), mat(P, { transparent: true, opacity: 0.95 }), x * 0.2, 0.28, -back - 0.04, spine); w.scale.set(0.5, 2.0, 0.18); w.rotation.z = -x * 0.4; }
      m(torus(0.085, 0.012, 6, 18), mat(S), 0, 0.27, 0, Math.PI / 2, 0, 0); break;
    }
    case "robot": {
      m(BX(0.20, 0.17, 0.19), p, 0, 0.07, 0).visible = true;
      eyes(S, 0.08, 0.097, 0.045, 0.026); m(BX(0.10, 0.015, 0.01), glow(S), 0, 0.01, 0.097);
      m(CY(0.006, 0.006, 0.08, 5), p, 0, 0.21, 0); m(SP(0.016, 6, 5), glow(S), 0, 0.26, 0);
      m(BX(0.1, 0.08, 0.01), glow(S), 0, 0.2, front, spine).scale.set(1, 1, 1); break;
    }
    case "bunny": case "cat": {
      for (const x of [-1, 1]) { const e = m(SP(0.05, 8, 6), p, x * 0.05, 0.25, -0.01); e.scale.set(0.45, 2.4, 0.35); e.rotation.z = -x * 0.15; m(SP(0.03, 6, 5), s, x * 0.05, 0.25, 0.005).scale.set(0.35, 1.9, 0.2); }
      m(SP(0.05, 8, 6), p, 0, -0.02, -0.17, hips).visible = true; break;
    }
    case "police": {
      m(CY(0.11, 0.12, 0.06, 16), p, 0, 0.14, 0); m(CY(0.12, 0.12, 0.012, 16), p, 0, 0.115, 0.03).scale.set(1, 1, 1.3);
      m(SP(0.016, 6, 5), mat(S), 0, 0.14, 0.12); m(BX(0.04, 0.04, 0.012), mat(S), -0.09, 0.26, front, spine); break;
    }
    case "doctor": {
      m(BX(0.16, 0.012, 0.02), mat(S), 0.1, 0.12, 0.09, spine).visible = false;
      m(torus(0.09, 0.008, 5, 16, Math.PI * 1.4), mat("#222"), 0, 0.33, front - 0.02, spine, ).rotation.x = Math.PI / 2;
      m(SP(0.016, 6, 5), mat(S), 0.05, 0.12, front, spine);
      m(BX(0.07, 0.07, 0.01), lam("#fff"), 0, 0.02, 0.1).visible = false; break;
    }
  }
}
function ring2(m, spine, c, y) { mk(torus(0.09, 0.025, 5, 12), lam(c), spine, 0, y, 0, Math.PI / 2, 0, 0); }
