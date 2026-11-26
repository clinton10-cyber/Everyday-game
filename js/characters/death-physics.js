/* ════════════════════════════════════════════════════════════════
   death-physics.js — a body that dies falls the way the BULLET sends it.

   The old death was one fixed tip-over. Now the whole body is a little rigid
   body (position, velocity, tilt, spin, hop) driven by the shot, and the limbs
   are the existing Limp ragdoll, kicked joint-by-joint from the same bullet.

   • direction   the body goes where the bullet was travelling (then bent toward open space)
   • HEAD        head snaps along the bullet, body folds backwards fast, slides
   • TORSO       thrown back, arch, bigger shots (shotgun / sniper) launch the body
   • ARM         the shot side is struck off-axis -> real torque -> the body SPINS as it falls
   • LEG / FOOT  legs swept out: small hop, body collapses sideways over the injured leg and rolls
   • landing     rebounds a little, skids with friction, kicks up dust + a blood splat, jolts the screen
   • walls       slides along the free-space test npcs.js already uses; bounces off blockers

   API
     DeathPhysics.begin(npc, info, free) -> state | null
        info = { dir:{x,y,z}, point:{x,y,z}, part, dmg, type }, free(x,z) -> bool
     DeathPhysics.step(npc, dt, free, onLand) -> true when the body has come to rest
     DeathPhysics.limbs(npc, Limp)       joint-level impulses from the bullet (call once, after Limp has started)
   ════════════════════════════════════════════════════════════════ */
import * as THREE from "three";
import { LIE_LIFT, restY } from "../core/death-pose.js";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const UP = new THREE.Vector3(0, 1, 0);
const _qF = new THREE.Quaternion(), _qY = new THREE.Quaternion(), _qR = new THREE.Quaternion(), _ax = new THREE.Vector3();
const HALF_PI = Math.PI / 2;

/* clearance (m) walking along (dx,dz) from (x,z) up to `max` */
function clearance(free, x, z, dx, dz, max) {
  let t = 0;
  for (let s = 0.25; s <= max + 1e-6; s += 0.25) {
    const px = x + dx * s, pz = z + dz * s;
    if (!free(px, pz) || !free(px - dz * 0.22, pz + dx * 0.22) || !free(px + dz * 0.22, pz - dx * 0.22)) break;
    t = s;
  }
  return t;
}

/* keep the bullet's direction if the body has room, otherwise swing toward the most open way */
function openDir(free, x, z, dx, dz, need) {
  let best = [dx, dz], bestT = -1;
  for (const deg of [0, 30, -30, 60, -60, 100, -100, 150, -150, 180]) {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const rx = dx * c - dz * s, rz = dx * s + dz * c;
    const t = clearance(free, x, z, rx, rz, need);
    if (t >= need - 1e-6) return { dx: rx, dz: rz, clear: t };
    if (t > bestT) { bestT = t; best = [rx, rz]; }
  }
  return { dx: best[0], dz: best[1], clear: bestT };
}

export const DeathPhysics = {
  begin(npc, info, free) {
    if (!npc || !npc.group || !npc.ctl) return null;
    free = free || (() => true);
    info = info || {};
    const yaw = npc.ctl.yaw || 0;
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const fwd = { x: sy, z: cy }, left = { x: cy, z: -sy };
    const px = npc.ctl.pos.x, pz = npc.ctl.pos.z;

    /* bullet direction (horizontal); no info -> topple backwards */
    let bx = info.dir ? info.dir.x : -sy, bz = info.dir ? info.dir.z : -cy;
    let bl = Math.hypot(bx, bz);
    if (bl < 1e-3) { bx = -sy; bz = -cy; bl = 1; }
    bx /= bl; bz /= bl;

    const part = info.part || "torso", type = info.type || "pistol";
    const maxHp = npc.maxHp || 220;
    const power = clamp((info.dmg || 40) / 90, 0.3, 2.2);
    const heavy = type === "shotgun" ? 1.5 : type === "sniper" ? 1.45 : type === "rifle" || type === "lmg" ? 1.1 : 1;

    /* where on the body, which side: lateral offset of the impact from the body axis */
    let lat = 0;
    if (info.point) lat = (info.point.x - px) * left.x + (info.point.z - pz) * left.z;
    const sgn = lat >= 0 ? 1 : -1;
    /* torque about the vertical axis: (r x F).y with r = impact offset from the body axis, F = bullet direction */
    const rx = info.point ? info.point.x - px : left.x * lat, rz = info.point ? info.point.z - pz : left.z * lat;
    const torque = rz * bx - rx * bz;

    let v0, w0, hop, spin, rollT, fx = bx, fz = bz;
    switch (part) {
      case "head":
        v0 = (1.8 + 2.2 * power) * heavy; w0 = 6.5; hop = 0.9 * heavy; spin = torque * 10 * power; rollT = 0.15 * sgn; break;
      case "arm":
        v0 = (1.2 + 2.0 * power) * heavy; w0 = 3.0; hop = 0.5 * heavy; spin = clamp(torque * 30 * power * heavy, -9, 9) + sgn * 1.2; rollT = 0.45 * sgn; break;
      case "leg": case "foot": {
        /* legs are swept: the body collapses sideways over the shot leg, carried a little by the bullet */
        fx = left.x * sgn * 0.8 + bx * 0.45; fz = left.z * sgn * 0.8 + bz * 0.45;
        v0 = (0.9 + 1.4 * power) * heavy; w0 = 2.2; hop = (1.2 + 0.6 * power) * heavy; spin = clamp(torque * 14 * power, -5, 5);
        rollT = 0.95 * sgn; break;
      }
      default:                                                   /* torso */
        v0 = (1.6 + 2.6 * power) * heavy; w0 = 4.2; hop = (heavy > 1.3 ? 1.7 : 0.7); spin = clamp(torque * 18 * power, -6, 6);
        rollT = 0.2 * sgn;
    }
    const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
    v0 = clamp(v0, 1.0, 7.5);

    /* bend toward open ground; if it is tight, lose speed */
    const need = 1.9 + Math.min(1.5, v0 * 0.22);
    const od = openDir(free, px, pz, fx, fz, need);
    if (od.clear < need) v0 *= clamp(od.clear / need, 0.25, 1);
    const fall = { dx: od.dx, dz: od.dz };

    const st = {
      fall, yaw, yawOff: 0, spin, theta: 0.04, omega: w0, roll: 0, rollT,
      vh: v0, vy: hop * 1.9, yo: 0, t: 0, landed: false, settle: 0, bounces: 0, grounded: false,
      part, dmg: info.dmg || 40, type, bx, bz, fb: bx * fwd.x + bz * fwd.z, lt: bx * left.x + bz * left.z, sgn,
      power, heavy, hx: px, hz: pz,
    };
    npc._dp = st;
    npc._fall = fall;                                           /* keep the old field meaningful for anything that reads it */
    npc._deathYaw = yaw;
    return st;
  },

  step(npc, dt, free, onLand) {
    const st = npc._dp, g = npc.group;
    if (!st || !g) return true;
    dt = clamp(dt || 1 / 60, 0.001, 0.05);
    free = free || (() => true);
    const sub = dt > 0.025 ? 2 : 1, h = dt / sub;
    for (let s = 0; s < sub; s++) {
      st.t += h;
      /* ── tilt: an inverted pendulum falling over, with a small rebound on the floor ── */
      st.omega += (14 * Math.sin(st.theta) + 1.2) * h;
      st.theta += st.omega * h;
      if (st.theta >= HALF_PI) {
        const impact = st.omega;
        st.theta = HALF_PI;
        if (impact > 1.6 && st.bounces < 2) { st.omega = -impact * 0.2; st.bounces++; } else st.omega = 0;
        if (!st.landed && st.yo <= 0.06) {
          st.landed = true;
          try { onLand && onLand({ x: g.position.x, z: g.position.z, strength: clamp(impact / 8 + st.vh / 8, 0.15, 1.2) }); } catch (e) {}
        }
      } else if (st.theta < 0.02) { st.theta = 0.02; if (st.omega < 0) st.omega = 0; }

      /* ── hop (legs swept / launched) ── */
      if (st.yo > 0 || st.vy > 0) {
        st.vy -= 12 * h; st.yo += st.vy * h;
        if (st.yo <= 0) {
          st.yo = 0;
          if (st.vy < -2.2) st.vy = -st.vy * 0.18; else st.vy = 0;
        }
      }
      st.grounded = st.yo <= 0.02;

      /* ── slide: gentle in the air, friction once on the floor ── */
      if (st.vh > 0) {
        const nx = g.position.x + st.fall.dx * st.vh * h, nz = g.position.z + st.fall.dz * st.vh * h;
        if (free(nx, nz)) { g.position.x = nx; g.position.z = nz; }
        else st.vh *= 0.2;                                       /* hit something: dead stop-ish */
        const lie = st.theta / HALF_PI;
        const decel = st.grounded ? (1.5 + 6 * lie * lie) : 0.5;
        st.vh = Math.max(0, st.vh - decel * h);
      }
      st.yawOff += st.spin * h;
      st.spin *= Math.exp(-(st.grounded ? 3.2 : 1.1) * h);
    }

    /* ── pose ── */
    const ef = st.theta / HALF_PI;
    _ax.set(st.fall.dz, 0, -st.fall.dx);
    _qF.setFromAxisAngle(_ax, st.theta);
    _qY.setFromAxisAngle(UP, st.yaw + st.yawOff);
    st.roll += (st.rollT * ef - st.roll) * Math.min(1, dt * 7);
    _ax.set(st.fall.dx, 0, st.fall.dz);
    _qR.setFromAxisAngle(_ax, st.roll);
    g.quaternion.copy(_qR).multiply(_qF).multiply(_qY);
    g.position.y = restY(npc._deathY || 0, ef) + st.yo;
    npc.ctl.pos.x = g.position.x; npc.ctl.pos.z = g.position.z;

    const resting = st.landed && st.vh < 0.06 && Math.abs(st.omega) < 0.05 && st.yo <= 0.001 && Math.abs(st.spin) < 0.1;
    st.settle = resting ? st.settle + dt : 0;
    return st.settle > 0.3 || st.t > 4.5;
  },

  /* joint-level impulses so each limb reacts to the bullet (Limp conventions:
     hanging limb  x<0 swings forward, z>0 swings to the character's left;
     head / spine  x>0 pitches forward, z<0 leans left). */
  limbs(npc, Limp) {
    const st = npc._dp, R = npc.rig; if (!st || !R) return;
    const k = clamp(st.power * st.heavy, 0.5, 2.6);
    const fb = st.fb, lt = st.lt;
    const hang = (joint, m) => Limp.impulse(R, joint, -fb * m, 0, lt * m);          /* limb thrown along the bullet */
    const lag = (joint, m) => Limp.impulse(R, joint, fb * m, 0, -lt * m);           /* limb left behind by the body */
    const hitL = st.sgn > 0, side = (a, b) => [a + (hitL ? "L" : "R"), a + (hitL ? "R" : "L")][b];

    /* everything trails the body a little */
    for (const j of ["shL", "shR", "hpL", "hpR"]) lag(j, 3 * k);
    Limp.impulse(R, "sp", fb * 5 * k, 0, -lt * 4 * k);

    switch (st.part) {
      case "head":
        Limp.impulse(R, "hd", fb * 15 * k, 0, -lt * 15 * k);
        Limp.impulse(R, "nk", fb * 8 * k, 0, -lt * 8 * k);
        Limp.impulse(R, "sp", -fb * 7 * k, 0, lt * 6 * k);           /* chest folds the other way */
        for (const j of ["shL", "shR"]) Limp.impulse(R, j, 0, 0, j === "shL" ? 9 * k : -9 * k);   /* arms fly out */
        for (const j of ["elL", "elR"]) Limp.impulse(R, j, -6 * k, 0, 0);
        break;
      case "arm": {
        const sh = side("sh", 0), el = side("el", 0), wr = side("wr", 0);
        hang(sh, 16 * k); Limp.impulse(R, el, -10 * k, 0, 0); Limp.impulse(R, wr, 0, 0, 10 * st.sgn);
        Limp.impulse(R, "sp", 0, 0, -st.sgn * 8 * k);
        Limp.impulse(R, "hd", fb * 6 * k, 0, -lt * 6 * k);
        break;
      }
      case "leg": case "foot": {
        const hp = side("hp", 0), kn = side("kn", 0), an = side("an", 0);
        hang(hp, 15 * k); Limp.impulse(R, kn, 8 * k, 0, 0); Limp.impulse(R, an, 6 * k, 0, 0);
        lag(side("hp", 1), 6 * k);
        for (const j of ["shL", "shR"]) Limp.impulse(R, j, 0, 0, j === "shL" ? 7 * k : -7 * k);   /* arms windmill */
        Limp.impulse(R, "hd", -fb * 5 * k, 0, lt * 5 * k);
        break;
      }
      default:                                                        /* torso */
        Limp.impulse(R, "sp", fb * 11 * k, 0, -lt * 9 * k);
        Limp.impulse(R, "hd", -fb * 12 * k, 0, lt * 9 * k);          /* head whips back as the chest goes */
        for (const j of ["shL", "shR"]) { Limp.impulse(R, j, 0, 0, j === "shL" ? 8 * k : -8 * k); lag(j, 5 * k); }
        for (const j of ["elL", "elR"]) Limp.impulse(R, j, -7 * k, 0, 0);
    }
    Limp.kick(R, st.bx * 40 * k, 8 + 5 * k, st.bz * 40 * k, 1);      /* whole-body acceleration for the d'Alembert gravity */
  },
};

if (typeof window !== "undefined") window.__ph3d_deathPhysics = DeathPhysics;
