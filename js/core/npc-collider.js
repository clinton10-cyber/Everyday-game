/* ════════════════════════════════════════════════════════════════
   npc-collider.js — high-precision, per-body-part NPC collider.

   Replaces the single fat cylinder (r=0.55) every NPC used to have with a
   rig-driven set of capsules/spheres that follow the animated skeleton:

       head · torso · pelvis · upper-arm ×2 · forearm ×2 · thigh ×2 · shin ×2 · foot ×2

   so bullets hit what they visually hit (limbs mid-stride, a ducking head,
   a body lying down) and a car only "runs someone over" when its body really
   overlaps one of those parts.

   Capsule endpoints come from the live bone world-positions when the NPC has a
   rig (cached once per frame). If the rig isn't available (far LOD / merged
   mesh / pursuit body) it falls back to a standing proportion skeleton built
   from the NPC's ground position + yaw, so every NPC always has a collider.

   Part names match guns.js (PART_MULT): head / torso / arm / leg / foot.

   Exports: NpcCollider
   ════════════════════════════════════════════════════════════════ */

import * as THREE from "three";

const _v = new THREE.Vector3();
const _frame = { n: 0 };
let _lastStamp = -1;

/* radii (world units); chosen to hug the visible body at the default scale */
const R = { head: 0.125, torso: 0.175, pelvis: 0.165, upperArm: 0.06, foreArm: 0.05, thigh: 0.095, shin: 0.07, foot: 0.07 };

function bump() {
  /* a cheap per-frame stamp so several shots / checks in one frame share one skeleton read */
  const now = performance.now();
  if (now !== _lastStamp) { _lastStamp = now; _frame.n++; }
  return _frame.n;
}

function wp(obj, out) {
  if (!obj || !obj.getWorldPosition) return null;
  obj.getWorldPosition(out);
  return { x: out.x, y: out.y, z: out.z };
}

function cap(a, b, r, part) { return { a, b, r, part }; }

/* ── skeleton from live bones ────────────────────────────────── */
function fromRig(npc) {
  const rig = npc.rig || (npc.ctl && npc.ctl.rig);
  const g = npc.group;
  if (!rig || !rig.hips || !g) return null;
  g.updateMatrixWorld(true);

  const hips = wp(rig.hips, _v), neck = wp(rig.neck || rig.spine, _v), head = wp(rig.head, _v);
  if (!hips || !neck || !head) return null;
  const up = { x: head.x - neck.x, y: head.y - neck.y, z: head.z - neck.z };
  const ul = Math.hypot(up.x, up.y, up.z) || 1;
  /* head centre sits ~0.10 above the head joint along the neck->head axis */
  const hc = { x: head.x + (up.x / ul) * 0.10, y: head.y + (up.y / ul) * 0.10, z: head.z + (up.z / ul) * 0.10 };

  const caps = [
    cap(hc, hc, R.head, "head"),
    cap(neck, hips, R.torso, "torso"),
    cap(hips, hips, R.pelvis, "torso"),
  ];

  for (const arm of [rig.armL, rig.armR]) {
    if (!arm || !arm.shoulder || !arm.elbow) continue;
    const s = wp(arm.shoulder, _v), e = wp(arm.elbow, _v);
    if (!s || !e) continue;
    caps.push(cap(s, e, R.upperArm, "arm"));
    const w = arm.wrist ? wp(arm.wrist, _v) : null;
    caps.push(cap(e, w || { x: e.x, y: e.y - 0.26, z: e.z }, R.foreArm, "arm"));
  }
  for (const leg of [rig.legL, rig.legR]) {
    if (!leg || !leg.hip || !leg.knee) continue;
    const h = wp(leg.hip, _v), k = wp(leg.knee, _v);
    if (!h || !k) continue;
    caps.push(cap(h, k, R.thigh, "leg"));
    const a = leg.ankle ? wp(leg.ankle, _v) : null;
    const an = a || { x: k.x, y: k.y - 0.40, z: k.z };
    caps.push(cap(k, an, R.shin, "leg"));
    /* foot: from the ankle forward along the NPC's facing */
    const yaw = (npc.ctl && npc.ctl.yaw) || 0;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    caps.push(cap(an, { x: an.x + fx * 0.16, y: Math.max(an.y - 0.06, (npc.group.position.y || 0) + 0.05), z: an.z + fz * 0.16 }, R.foot, "foot"));
  }
  return caps;
}

/* ── fallback standing skeleton (no rig available) ───────────── */
function fromProportions(npc) {
  const p = (npc.ctl && npc.ctl.pos) || npc.group.position;
  const gy = (npc.group && npc.group.position.y) || 0;
  const yaw = (npc.ctl && npc.ctl.yaw) || 0;
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);       /* NPC's left (+X in its frame) */
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const P = (x, y, z) => ({ x: p.x + x, y: gy + y, z: p.z + z });
  const side = (s, y, f) => P(rx * 0.19 * s + fx * (f || 0), y, rz * 0.19 * s + fz * (f || 0));

  const hips = P(0, 0.935, 0), neck = P(0, 1.42, 0), hc = P(0, 1.64, 0);
  const caps = [cap(hc, hc, R.head, "head"), cap(neck, hips, R.torso, "torso"), cap(hips, hips, R.pelvis, "torso")];
  for (const s of [1, -1]) {
    caps.push(cap(side(s, 1.38), side(s, 1.11), R.upperArm, "arm"));
    caps.push(cap(side(s, 1.11), side(s, 0.88), R.foreArm, "arm"));
    caps.push(cap(side(s * 0.5, 0.92), side(s * 0.5, 0.50), R.thigh, "leg"));
    caps.push(cap(side(s * 0.5, 0.50), side(s * 0.5, 0.10), R.shin, "leg"));
    caps.push(cap(side(s * 0.5, 0.08), side(s * 0.5, 0.06, 0.16), R.foot, "foot"));
  }
  return caps;
}

/* ── ray vs capsule (segment a-b, radius r). Returns t or -1. ── */
function rayCapsule(ox, oy, oz, dx, dy, dz, A, B, r, maxT) {
  const bax = B.x - A.x, bay = B.y - A.y, baz = B.z - A.z;
  const oax = ox - A.x, oay = oy - A.y, oaz = oz - A.z;
  const baba = bax * bax + bay * bay + baz * baz;
  const bard = bax * dx + bay * dy + baz * dz;
  const baoa = bax * oax + bay * oay + baz * oaz;
  const rdoa = dx * oax + dy * oay + dz * oaz;
  const oaoa = oax * oax + oay * oay + oaz * oaz;

  /* degenerate capsule -> sphere */
  if (baba < 1e-10) {
    const b = rdoa, c = oaoa - r * r, h = b * b - c;
    if (h < 0) return -1;
    const t = -b - Math.sqrt(h);
    return (t >= 0 && t <= maxT) ? t : (-b + Math.sqrt(h) >= 0 && -b + Math.sqrt(h) <= maxT ? 0 : -1);
  }

  const a = baba - bard * bard;
  const b = baba * rdoa - baoa * bard;
  const c = baba * oaoa - baoa * baoa - r * r * baba;
  let h = b * b - a * c;
  if (h >= 0 && a > 1e-10) {
    const t = (-b - Math.sqrt(h)) / a;
    const y = baoa + t * bard;
    if (y > 0 && y < baba) return (t >= 0 && t <= maxT) ? t : -1;      /* hit the cylinder body */
    /* else test the nearer end cap sphere */
    const ocx = (y <= 0) ? oax : ox - B.x, ocy = (y <= 0) ? oay : oy - B.y, ocz = (y <= 0) ? oaz : oz - B.z;
    const b2 = dx * ocx + dy * ocy + dz * ocz;
    const c2 = ocx * ocx + ocy * ocy + ocz * ocz - r * r;
    const h2 = b2 * b2 - c2;
    if (h2 > 0) {
      const t2 = -b2 - Math.sqrt(h2);
      return (t2 >= 0 && t2 <= maxT) ? t2 : -1;
    }
  } else if (a <= 1e-10) {
    /* ray parallel to the axis: only the end spheres can be hit */
    for (const E of [A, B]) {
      const ex = ox - E.x, ey = oy - E.y, ez = oz - E.z;
      const b2 = dx * ex + dy * ey + dz * ez, c2 = ex * ex + ey * ey + ez * ez - r * r, h2 = b2 * b2 - c2;
      if (h2 > 0) { const t2 = -b2 - Math.sqrt(h2); if (t2 >= 0 && t2 <= maxT) return t2; }
    }
  }
  return -1;
}

/* squared distance from point to segment, plus the closest point */
function pointSeg(px, py, pz, A, B) {
  const abx = B.x - A.x, aby = B.y - A.y, abz = B.z - A.z;
  const l2 = abx * abx + aby * aby + abz * abz;
  let t = l2 > 1e-10 ? ((px - A.x) * abx + (py - A.y) * aby + (pz - A.z) * abz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = A.x + abx * t, cy = A.y + aby * t, cz = A.z + abz * t;
  return { d2: (px - cx) ** 2 + (py - cy) ** 2 + (pz - cz) ** 2, x: cx, y: cy, z: cz };
}

export const NpcCollider = {
  R,

  /* the NPC's capsules this frame (cached on the NPC) */
  capsules(npc) {
    if (!npc || !npc.group) return [];
    const stamp = bump();
    if (npc._colCaps && npc._colStamp === stamp) return npc._colCaps;
    let caps = null;
    try { caps = fromRig(npc); } catch (e) { caps = null; }
    if (!caps || !caps.length) caps = fromProportions(npc);
    npc._colCaps = caps; npc._colStamp = stamp;
    return caps;
  },

  /* Precise ray test. pad inflates every radius (aim assist). → {t, part} | null */
  raycast(npc, ox, oy, oz, dx, dy, dz, maxT, pad) {
    const caps = this.capsules(npc);
    const grow = pad || 0;
    let best = null;
    for (const c of caps) {
      const t = rayCapsule(ox, oy, oz, dx, dy, dz, c.a, c.b, c.r + grow, maxT);
      if (t >= 0 && (!best || t < best.t)) best = { t, part: c.part };
    }
    return best;
  },

  /* Does a car body overlap this NPC? car = { x, z, heading, halfW, halfL, height, clearance }.
     The car is an oriented box; each capsule is tested at 7 points along its axis against that
     box (inflated by the capsule radius) AND its vertical span.  → { part, depth, nx, nz } | null */
  hitByCar(npc, car) {
    const caps = this.capsules(npc);
    const sH = Math.sin(car.heading), cH = Math.cos(car.heading);
    const top = (car.groundY || 0) + (car.height || 1.5);
    const bottom = (car.groundY || 0) + (car.clearance != null ? car.clearance : 0.22);
    let best = null;
    for (const c of caps) {
      const N = c.a === c.b ? 1 : 7;
      for (let i = 0; i < N; i++) {
        const u = N === 1 ? 0 : i / (N - 1);
        const x = c.a.x + (c.b.x - c.a.x) * u, y = c.a.y + (c.b.y - c.a.y) * u, z = c.a.z + (c.b.z - c.a.z) * u;
        if (y + c.r < bottom || y - c.r > top) continue;            /* above the roof or under the chassis */
        const dx = x - car.x, dz = z - car.z;
        const lx = dx * cH - dz * sH, lz = dx * sH + dz * cH;       /* point in the car frame */
        const ex = Math.abs(lx) - car.halfW, ez = Math.abs(lz) - car.halfL;
        const dist = Math.hypot(Math.max(ex, 0), Math.max(ez, 0)) + Math.min(Math.max(ex, ez), 0);
        const depth = c.r - dist;
        if (depth > 0 && (!best || depth > best.depth)) {
          /* push direction: from the car's centre line out through the contact side */
          const out = Math.abs(ex) > Math.abs(ez) ? { lx: Math.sign(lx || 1), lz: 0 } : { lx: 0, lz: Math.sign(lz || 1) };
          best = { part: c.part, depth, nx: out.lx * cH + out.lz * sH, nz: -out.lx * sH + out.lz * cH };
        }
      }
    }
    return best;
  },
};

window.__ph3d_npcCollider = NpcCollider;
