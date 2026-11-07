/* js/houses/_enhancements.js
   Shared upgrades for flat interiors: baseboards, crowns, windows,
   doors, wall art, curtains, ceiling fixtures, and a lighting rig. */

import * as THREE from "three";

/* ── Wall trims ─────────────────────────────────────────────── */

/* Baseboard: a 6 cm lip along the bottom of a wall. */
export function baseboard(B, x1, z1, x2, z2, color) {
  color = color || 0xf5f0e6;
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  if (len < 0.1) return;
  const angle = Math.atan2(dx, dz);
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  B.box(len, 0.09, 0.05, color, cx, 0.045, cz, angle, false);
}

/* Crown molding: a 5 cm lip along the top of a wall. */
export function crown(B, x1, z1, x2, z2, ceilingH, color) {
  color = color || 0xfaf5ec;
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  if (len < 0.1) return;
  const angle = Math.atan2(dx, dz);
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  B.box(len, 0.07, 0.07, color, cx, (ceilingH || 8.0) - 0.035, cz, angle, false);
}

/* ── Windows ───────────────────────────────────────────────── */

/* A window with frame, glass, and sill.
   x, y, z is the center; ry rotates it to sit against a wall. */
export function windowFrame(B, x, y, z, ry, width, height, opts) {
  opts = opts || {};
  const frameColor = opts.frameColor || 0xf0ebe0;
  const glassColor = opts.glassColor || 0xc8e4f4;
  const w = width || 1.5;
  const h = height || 1.2;

  /* Glass panel (emissive so it reads as bright daylight) */
  B.glowBox(w - 0.12, h - 0.12, 0.02, glassColor, x, y, z);
  /* Frame: 4 pieces */
  B.box(w, 0.06, 0.06, frameColor, x, y + h / 2, z, ry, false);
  B.box(w, 0.06, 0.06, frameColor, x, y - h / 2, z, ry, false);
  B.box(0.06, h, 0.06, frameColor, x - w / 2 * Math.cos(ry), y, z + w / 2 * Math.sin(ry), ry, false);
  B.box(0.06, h, 0.06, frameColor, x + w / 2 * Math.cos(ry), y, z - w / 2 * Math.sin(ry), ry, false);
  /* Mullions (cross) */
  B.box(w - 0.1, 0.04, 0.04, frameColor, x, y, z, ry, false);
  B.box(0.04, h - 0.1, 0.04, frameColor, x, y, z, ry, false);
  /* Sill */
  B.box(w + 0.16, 0.06, 0.16, frameColor, x, y - h / 2 - 0.06, z + Math.cos(ry) * 0.10, ry, false);
}

/* ── Doors ─────────────────────────────────────────────────── */

/* Door frame around a doorway. */
export function doorFrame(B, x, z, yaw, width, height, opts) {
  opts = opts || {};
  const frameColor = opts.frameColor || 0x8a5a3a;
  const w = width || 1.0;
  const h = height || 2.15;
  const t = 0.08;

  /* Side jambs */
  B.box(t, h, t, frameColor, x - w / 2 * Math.cos(yaw), h / 2, z + w / 2 * Math.sin(yaw), yaw, false);
  B.box(t, h, t, frameColor, x + w / 2 * Math.cos(yaw), h / 2, z - w / 2 * Math.sin(yaw), yaw, false);
  /* Head jamb */
  B.box(w + t, t, t, frameColor, x, h + t / 2, z, yaw, false);
  /* Threshold */
  B.box(w, 0.03, 0.18, 0x3a2a1a, x, 0.015, z, yaw, false);
}

/* ── Wall art ──────────────────────────────────────────────── */

/* Framed art. color is the canvas fill. */
export function wallArt(B, x, y, z, ry, w, h, color) {
  w = w || 1.0;
  h = h || 0.7;
  color = color || 0x4a8ae0;
  /* Outer frame */
  B.box(w + 0.10, h + 0.10, 0.04, 0x2a1a10, x, y, z, ry, false);
  /* Gold inner trim */
  B.box(w + 0.04, h + 0.04, 0.05, 0xc9a850, x, y, z, ry, false);
  /* Canvas */
  B.box(w, h, 0.03, color, x, y, z, ry, false);
  /* Corner highlight */
  B.glowBox(w * 0.24, h * 0.24, 0.02, 0xffffff,
    x - w * 0.28 * Math.cos(ry), y + h * 0.28, z + w * 0.28 * Math.sin(ry));
}

/* ── Curtains ──────────────────────────────────────────────── */

/* Two curtain panels flanking a window. drop is the height. */
export function curtains(B, x, y, z, ry, width, drop, color) {
  color = color || 0xe8dcc0;
  const w = width || 2.0;
  const d = drop || 1.8;
  B.box(w * 0.22, d, 0.05, color,
    x - (w / 2 - w * 0.11) * Math.cos(ry), y,
    z + (w / 2 - w * 0.11) * Math.sin(ry), ry, false);
  B.box(w * 0.22, d, 0.05, color,
    x + (w / 2 - w * 0.11) * Math.cos(ry), y,
    z - (w / 2 - w * 0.11) * Math.sin(ry), ry, false);
  /* Curtain rod */
  B.box(w + 0.20, 0.03, 0.03, 0x8a6a3a, x, y + d / 2 + 0.06, z, ry, false);
}

/* ── Ceiling fixtures ──────────────────────────────────────── */

/* A flush ceiling light panel. */
export function ceilingLight(B, x, z, y, color, size) {
  color = color || 0xfff2d0;
  size = size || 0.6;
  B.glowBox(size, 0.04, size, color, x, y - 0.05, z);
}

/* A pendant light: cord + bulb + shade. */
export function pendant(B, x, z, y, cordLen, color) {
  color = color || 0xfff2d0;
  cordLen = cordLen || 0.6;
  B.box(0.02, cordLen, 0.02, 0x2a2a2a, x, y - cordLen / 2, z, 0, false);
  B.glowBox(0.32, 0.14, 0.32, color, x, y - cordLen - 0.07, z);
}

/* ── Baseboards + crowns for a rectangular room ─────────────── */

export function trimRoom(B, x0, z0, x1, z1, ceilingH, color) {
  baseboard(B, x0, z0, x1, z0, color);
  baseboard(B, x1, z0, x1, z1, color);
  baseboard(B, x1, z1, x0, z1, color);
  baseboard(B, x0, z1, x0, z0, color);
  crown(B, x0, z0, x1, z0, ceilingH, color);
  crown(B, x1, z0, x1, z1, ceilingH, color);
  crown(B, x1, z1, x0, z1, ceilingH, color);
  crown(B, x0, z1, x0, z0, ceilingH, color);
}

/* ── Lighting rig ──────────────────────────────────────────── */

/* Build an array of PointLights for a list of rooms.
   Rooms are in local (un-offset) coordinates; B.ox/B.oz is added.
   Returns the lights array — caller attaches them to the scene. */
export function lightRooms(B, rooms, ceilingH) {
  ceilingH = ceilingH || 8.0;
  const ox = (B && B.ox) || 0;
  const oz = (B && B.oz) || 0;
  const lights = [];
  for (const r of rooms) {
    const cx = r.x + r.w / 2 + ox;
    const cz = r.z + r.d / 2 + oz;
    const pl = new THREE.PointLight(0xfff0d8, 0.55, Math.max(r.w, r.d) * 1.6, 2);
    pl.position.set(cx, ceilingH - 1.2, cz);
    pl.castShadow = false;
    lights.push(pl);
  }
  return lights;
}
