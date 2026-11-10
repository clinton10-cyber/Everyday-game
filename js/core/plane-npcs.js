/* ════════════════════════════════════════════════════════════════
   plane-npcs.js — self-contained wandering passengers / crew for the
   airplane cabins.

   They use the normal character rig + animator, walk at a relaxed
   pace and turn to a new heading whenever something is in the way
   (seat blocks, galley carts, walls, other NPCs, the player).

   createPlaneNPCs({
     scene, floorY,
     colliders : [{ minX, maxX, minZ, maxZ, y0?, y1? }],
     bounds    : { minX, maxX, minZ, maxZ },
     spawn     : [{ minX, maxX, minZ, maxZ }]   // zones to place NPCs in
     count, speed, getPlayer: () => ({x,z}) | null
   }) -> { npcs, update(dt), dispose() }
   ════════════════════════════════════════════════════════════════ */
import {
  SKIN_TONES, HAIR_COLORS, SHIRT_COLORS, BOTTOM_COLORS,
  SHOE_COLORS, ACCENT_COLORS, NPC_HAIR_STYLES as HAIR_STYLES, NPC_TOP_STYLES as TOP_STYLES,
  NPC_BOTTOM_STYLES as BOTTOM_STYLES, NPC_SHOE_STYLES as SHOE_STYLES, NPC_PATTERNS as PATTERNS, GENDERS,
  NPC_HAT_STYLES as HAT_STYLES, NPC_GLASS_STYLES as GLASS_STYLES, TIE_STYLES,
} from "./wardrobe.js";
import { buildCharacter } from "../characters/lowpoly.js";
import * as Animator from "../characters/animator.js";

const TAU = Math.PI * 2;
const R_BODY = 0.26;          /* NPC body radius used for collisions   */
const PROBE = 0.55;           /* look-ahead distance past the body     */
const rnd = Math.random;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const between = (a, b) => a + rnd() * (b - a);
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function randomConfig() {
  return {
    gender: pick(GENDERS),
    skinTone: Math.floor(rnd() * SKIN_TONES.length),
    hairStyle: pick(HAIR_STYLES),
    hairColor: Math.floor(rnd() * HAIR_COLORS.length),
    topStyle: pick(TOP_STYLES),
    topColor: Math.floor(rnd() * SHIRT_COLORS.length),
    topPattern: pick(PATTERNS),
    topAccent: Math.floor(rnd() * ACCENT_COLORS.length),
    tie: pick(TIE_STYLES),
    bottomStyle: pick(BOTTOM_STYLES),
    bottomColor: Math.floor(rnd() * BOTTOM_COLORS.length),
    bottomPattern: pick(PATTERNS),
    bottomAccent: Math.floor(rnd() * ACCENT_COLORS.length),
    shoeStyle: pick(SHOE_STYLES),
    shoeColor: Math.floor(rnd() * SHOE_COLORS.length),
    hat: rnd() < 0.12 ? { style: pick(HAT_STYLES), color: Math.floor(rnd() * SHIRT_COLORS.length) } : null,
    glasses: rnd() < 0.25 ? { style: pick(GLASS_STYLES), color: 0 } : null,
  };
}

export function createPlaneNPCs(opts) {
  const scene = opts.scene;
  const floorY = opts.floorY || 0;
  const speed = opts.speed || 1.5;
  const bounds = opts.bounds;
  /* Only obstacles that reach body height matter (skip overhead bins). */
  const boxes = (opts.colliders || []).filter(c =>
    !(c.y0 !== undefined && c.y0 > 1.2) && !(c.y1 !== undefined && c.y1 < 0.15));
  const npcs = [];

  /* Is a circle at (x,z) blocked by walls / furniture / (optionally) others? */
  function blocked(x, z, r, self) {
    if (bounds && (x < bounds.minX + r || x > bounds.maxX - r ||
                   z < bounds.minZ + r || z > bounds.maxZ - r)) return true;
    for (const b of boxes) {
      if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return true;
    }
    for (const o of npcs) {
      if (o === self) continue;
      const dx = o.x - x, dz = o.z - z;
      const rr = r + R_BODY * 0.9;
      if (dx * dx + dz * dz < rr * rr) return true;
    }
    const p = opts.getPlayer ? opts.getPlayer() : null;
    if (p) {
      const dx = p.x - x, dz = p.z - z, rr = r + 0.3;
      if (dx * dx + dz * dz < rr * rr) return true;
    }
    return false;
  }

  /* Static-only check (used to validate spawn points). */
  function staticBlocked(x, z, r) {
    if (bounds && (x < bounds.minX + r || x > bounds.maxX - r ||
                   z < bounds.minZ + r || z > bounds.maxZ - r)) return true;
    for (const b of boxes) {
      if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return true;
    }
    return false;
  }

  function clearAhead(n, heading, dist) {
    const sx = Math.sin(heading), sz = Math.cos(heading);
    /* sample along the path so thin obstacles are not skipped */
    for (let d = 0.25; d <= dist + 1e-6; d += 0.25) {
      if (blocked(n.x + sx * d, n.z + sz * d, R_BODY, n)) return false;
    }
    return true;
  }

  /* Choose a new heading: prefer ones with the longest clear run,
     with a bias to follow the cabin axis (±Z) so they use the aisles. */
  function chooseHeading(n) {
    let best = null, bestScore = -1;
    for (let i = 0; i < 16; i++) {
      const h = (i < 4)
        ? (i % 2 ? 0 : Math.PI) + between(-0.25, 0.25)    /* along the aisle */
        : rnd() * TAU;
      /* don't pick almost the same direction we were just blocked in */
      if (Math.abs(wrapPi(h - n.heading)) < 0.5 && n.state !== "idle") continue;
      let run = 0;
      for (let d = 0.3; d <= 3.0; d += 0.3) {
        if (blocked(n.x + Math.sin(h) * d, n.z + Math.cos(h) * d, R_BODY, n)) break;
        run = d;
      }
      const score = run + rnd() * 0.6 + (i < 4 ? 0.4 : 0);
      if (run >= 0.6 && score > bestScore) { bestScore = score; best = h; }
    }
    /* boxed in: turn around */
    return best === null ? wrapPi(n.heading + Math.PI) : best;
  }

  function startTurn(n) {
    n.target = chooseHeading(n);
    n.state = "turn";
    n.stateT = 2.5;               /* safety timeout */
  }

  function spawnOne() {
    const zones = opts.spawn && opts.spawn.length ? opts.spawn
      : [{ minX: bounds.minX, maxX: bounds.maxX, minZ: bounds.minZ, maxZ: bounds.maxZ }];
    for (let tries = 0; tries < 80; tries++) {
      const z = pick(zones);
      const x = between(z.minX, z.maxX), zz = between(z.minZ, z.maxZ);
      if (staticBlocked(x, zz, R_BODY + 0.1)) continue;
      let ok = true;
      for (const o of npcs) {
        if (Math.hypot(o.x - x, o.z - zz) < 1.2) { ok = false; break; }
      }
      if (!ok) continue;
      return { x, z: zz };
    }
    return null;
  }

  const count = opts.count != null ? opts.count : 8;
  for (let i = 0; i < count; i++) {
    const p = spawnOne();
    if (!p) continue;
    const built = buildCharacter(randomConfig());
    const group = built.root, rig = built.rig;
    const heading = rnd() < 0.5 ? 0 : Math.PI;
    group.position.set(p.x, floorY, p.z);
    group.rotation.y = heading;
    scene.add(group);
    const ctl = {
      rig, pos: { x: p.x, y: floorY, z: p.z }, yaw: heading,
      state: "standing", onGround: true, level: 0, vel: { y: 0 },
      _intentSpeed: 0, _ul: () => {},
      _emoteTimer: 0, _emoteName: null, _emotePhase: 0,
      _useTimer: 0, _useBend: 0.30,
      weapons: null, held: null, phoneHold: false, sitTarget: null,
    };
    try { Animator.animate(ctl, 0.016); } catch (e) {}
    npcs.push({
      group, rig, ctl, x: p.x, z: p.z, heading,
      target: heading, state: "walk",
      stateT: between(3, 8),       /* time until next wander decision */
      speedMul: between(0.85, 1.15),
      acc: 0,
    });
  }

  function update(dt) {
    dt = Math.min(dt || 0, 0.1);
    if (dt <= 0) return;
    for (const n of npcs) {
      n.stateT -= dt;
      let moving = 0;

      if (n.state === "walk") {
        /* Look ahead: if something is in the way, turn to a new heading. */
        if (!clearAhead(n, n.heading, PROBE)) {
          startTurn(n);
        } else {
          const step = speed * n.speedMul * dt;
          const nx = n.x + Math.sin(n.heading) * step;
          const nz = n.z + Math.cos(n.heading) * step;
          if (blocked(nx, nz, R_BODY, n)) startTurn(n);
          else { n.x = nx; n.z = nz; moving = speed * n.speedMul; }
        }
        if (n.state === "walk" && n.stateT <= 0) {
          /* wander: sometimes stop and look around, otherwise re-aim */
          if (rnd() < 0.35) { n.state = "idle"; n.stateT = between(1.2, 3.5); }
          else { n.state = "turn"; n.target = chooseHeading(n); n.stateT = 2.5; }
        }
      } else if (n.state === "turn") {
        const d = wrapPi(n.target - n.heading);
        const maxStep = 4.0 * dt;
        if (Math.abs(d) <= maxStep) {
          n.heading = n.target;
          if (clearAhead(n, n.heading, PROBE)) { n.state = "walk"; n.stateT = between(4, 9); }
          else if (n.stateT <= 0) { n.target = wrapPi(n.heading + Math.PI); n.stateT = 2.5; }
          else n.target = chooseHeading(n);   /* still blocked -> pick again */
        } else n.heading = wrapPi(n.heading + Math.sign(d) * maxStep);
      } else {                                /* idle */
        if (n.stateT <= 0) startTurn(n);
      }

      /* Someone (the player / another NPC) walked into us: nudge out. */
      if (blocked(n.x, n.z, R_BODY * 0.6, n) && n.state !== "turn") startTurn(n);

      n.ctl.pos.x = n.x; n.ctl.pos.z = n.z; n.ctl.pos.y = floorY;
      n.ctl.yaw = n.heading;
      n.ctl._intentSpeed = moving;
      n.group.position.set(n.x, floorY, n.z);
      n.group.rotation.y = n.heading;

      n.acc += dt;
      if (n.acc >= 0.033) {
        try { Animator.animate(n.ctl, n.acc); } catch (e) {}
        n.acc = 0;
      }
    }
  }

  function dispose() {
    for (const n of npcs) {
      if (n.group.parent) n.group.parent.remove(n.group);
      n.group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach(m => m && m.dispose && m.dispose());
        }
      });
    }
    npcs.length = 0;
  }

  return { npcs, update, dispose };
}

