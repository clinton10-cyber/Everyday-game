/* ════════════════════════════════════════════════════════════════
   death-pose.js — a body that falls must not sink into the floor or into a wall.

   Two fixes, shared by NPCs (npcs.js) and the player (main.js):

   1. WALLS  — pickFall() tests the space the body will occupy (feet → head, ~1.9 m)
      in several directions and falls toward open space. If every direction is
      blocked it slides the body away from the obstacle first.
   2. FLOOR  — a character's pivot is at the feet, on the centre line of the body.
      Laid flat, half of the body's thickness would be BELOW the floor. restY()
      lifts the pivot by that half-thickness, measured from the real floor height
      (not y = 0, which was wrong on upper floors, platforms and stairs).

   The fall is a rotation about a HORIZONTAL axis chosen from the fall direction
   (the old code tipped about the world X axis, so the body always dropped toward
   world ±Z no matter where it faced — straight into whatever wall was there).
   ════════════════════════════════════════════════════════════════ */
import * as THREE from "three";

export const BODY_LEN = 1.9;        /* feet to fingertips of a body lying flat (+ margin) */
export const LIE_LIFT = 0.15;       /* half body thickness: keeps the back off the floor */

const UP = new THREE.Vector3(0, 1, 0);
const _qFall = new THREE.Quaternion(), _qYaw = new THREE.Quaternion(), _qRoll = new THREE.Quaternion();
const _ax = new THREE.Vector3();

/* clearance (m) along (dx,dz) from (x,z), up to BODY_LEN */
function clearance(free, x, z, dx, dz) {
  let t = 0;
  for (let s = 0.2; s <= BODY_LEN + 1e-6; s += 0.2) {
    /* centre line plus a point to each side, so the shoulders clear too */
    const px = x + dx * s, pz = z + dz * s;
    if (!free(px, pz) || !free(px - dz * 0.22, pz + dx * 0.22) || !free(px + dz * 0.22, pz - dx * 0.22)) break;
    t = s;
  }
  return t;
}

/* Returns { dx, dz, x, z } — the direction the body falls toward and the (possibly nudged) pivot.
   free(x, z) → true when that floor point is open. yaw = the way the character is facing. */
export function pickFall(x, z, yaw, free) {
  if (!free) free = () => true;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const side = Math.random() < 0.5 ? 1 : -1;
  /* preference order: fall forward / backward (natural), then sideways, then diagonals */
  const cands = [
    [fx, fz], [-fx, -fz], [fz * side, -fx * side], [-fz * side, fx * side],
    [(fx + fz * side) * 0.7071, (fz - fx * side) * 0.7071], [(fx - fz * side) * 0.7071, (fz + fx * side) * 0.7071],
    [(-fx + fz * side) * 0.7071, (-fz - fx * side) * 0.7071], [(-fx - fz * side) * 0.7071, (-fz + fx * side) * 0.7071],
  ];
  let best = null, bestT = -1;
  for (const [dx, dz] of cands) {
    const t = clearance(free, x, z, dx, dz);
    if (t >= BODY_LEN - 1e-6) return { dx, dz, x, z };      /* first fully open direction wins */
    if (t > bestT) { bestT = t; best = [dx, dz]; }
  }
  /* boxed in: slide the pivot away from the obstacle (opposite the fall) until the body fits */
  const [dx, dz] = best;
  for (let s = 0.1; s <= 1.2; s += 0.1) {
    const nx = x - dx * s, nz = z - dz * s;
    if (!free(nx, nz)) break;
    if (clearance(free, nx, nz, dx, dz) >= BODY_LEN - 1e-6) return { dx, dz, x: nx, z: nz };
  }
  return { dx, dz, x, z };
}

/* Orientation of a body at fall progress ef (0 upright → 1 flat) and its pivot height above the floor. */
export function poseFall(group, fall, yaw, ef, roll) {
  _ax.set(fall.dz, 0, -fall.dx);                       /* UP × dir: tips the head toward dir */
  _qFall.setFromAxisAngle(_ax, (Math.PI / 2) * ef);
  _qYaw.setFromAxisAngle(UP, yaw);
  /* roll about the body's long axis (= the fall direction once it is lying down),
     so the body settles onto a side without the head lifting off the floor */
  _ax.set(fall.dx, 0, fall.dz);
  _qRoll.setFromAxisAngle(_ax, (roll || 0) * ef);
  group.quaternion.copy(_qRoll).multiply(_qFall).multiply(_qYaw);
}

/* Pivot height above floor while falling/lying: lifts by half-thickness as the body goes flat. */
export function restY(floorY, ef) { return (floorY || 0) + LIE_LIFT * ef; }

/* Free-space tester for the player, from the scene colliders (same shape thirdperson.js uses). */
export function playerFree(tp) {
  const cols = tp && tp.world && tp.world.colliders;
  if (!cols || !cols.length) return () => true;
  const fy = tp.floorY || 0;
  return (x, z) => {
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (c.level !== tp.level) continue;
      const y0 = c.y0 != null ? c.y0 : 0, y1 = c.y1 != null ? c.y1 : 3;
      if (y1 < fy + 0.15 || y0 > fy + 1.2) continue;     /* below the floor / above the body */
      if (x > c.minX - 0.12 && x < c.maxX + 0.12 && z > c.minZ - 0.12 && z < c.maxZ + 0.12) return false;
    }
    return true;
  };
}
