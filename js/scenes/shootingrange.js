/* js/scenes/shootingrange.js — TACTICAL RANGE
   Third-person arena (real ThirdPersonControls: hip-fire, shouldered aim when a gun is drawn)
   against a squad of tactical enemies built from the same character rig + Animator.
   Enemies advance, take cover (hidden from YOUR line of sight), peek, fire bursts, reload,
   flank, and retreat at low health. Their bullets are blocked by cover; so are yours
   (you can't shoot someone through a crate). Waves, kill feed, hit markers, respawn.

   Death in the arena is a respawn, not the hospital: the arena keeps its own player HP and
   never calls Combat.damage (which would trigger the hospital trip). */
import * as THREE from "three";
import { ThirdPersonControls } from "../core/thirdperson.js";
import { Combat } from "../core/combat.js";
import { Sfx } from "../core/sfx.js";
import { Economy } from "../core/economy.js";
import { Multiplayer } from "../core/multiplayer.js";
import { Gun } from "../core/guns.js";
import { Limp } from "../characters/limp.js";
import { buildCharacter } from "../characters/lowpoly.js";
import { withPlayerLook } from "../core/wardrobe.js";
import * as Animator from "../characters/animator.js";
import { pickFall, poseFall, restY } from "../core/death-pose.js";

/* ── layout ─────────────────────────────────────────────────── */
const ARENA_W = 44, ARENA_D = 44, ARENA_H = 7;
const PLAYER_SPAWN = { x: 0, z: 16 };
const MAX_ALIVE = 6;                     /* enemies on the field at once */

const SOLDIER_CONFIGS = [
  { gender: "masculine", skinTone: 4, hairStyle: "buzz", hairColor: 1, topStyle: "jacket", topColor: 6, topPattern: "solid", topAccent: 9,
    bottomStyle: "cargo", bottomColor: 1, bottomPattern: "solid", bottomAccent: 0, shoeStyle: "boots", shoeColor: 0,
    hat: { style: "cap", color: 6 }, glasses: null, tie: "none" },
  { gender: "masculine", skinTone: 6, hairStyle: "short", hairColor: 1, topStyle: "longsleeve", topColor: 1, topPattern: "camo", topAccent: 2,
    bottomStyle: "cargo", bottomColor: 2, bottomPattern: "solid", bottomAccent: 0, shoeStyle: "boots", shoeColor: 0,
    hat: { style: "beanie", color: 1 }, glasses: null, tie: "none" },
  { gender: "feminine", skinTone: 3, hairStyle: "ponytail", hairColor: 2, topStyle: "jacket", topColor: 6, topPattern: "solid", topAccent: 0,
    bottomStyle: "leggings", bottomColor: 1, bottomPattern: "solid", bottomAccent: 0, shoeStyle: "boots", shoeColor: 0,
    hat: null, glasses: { style: "round", color: 0 }, tie: "none" },
];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = Math.random;

/* segment (p1 → p2) vs AABB slab test */
function segHitsAABB(x1, y1, z1, x2, y2, z2, box) {
  const d = [x2 - x1, y2 - y1, z2 - z1];
  const o = [x1, y1, z1];
  const lo = [box.minX, box.y0 != null ? box.y0 : 0, box.minZ];
  const hi = [box.maxX, box.y1 != null ? box.y1 : 3, box.maxZ];
  let tmin = 0, tmax = 1;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-8) { if (o[i] < lo[i] || o[i] > hi[i]) return false; }
    else {
      let t1 = (lo[i] - o[i]) / d[i], t2 = (hi[i] - o[i]) / d[i];
      if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return false;
    }
  }
  return tmin < 0.999 && tmax > 0.001;
}
const blocked = (cols, x1, y1, z1, x2, y2, z2) => { for (const c of cols) if (segHitsAABB(x1, y1, z1, x2, y2, z2, c)) return true; return false; };

/* the spot directly BEHIND a box as seen from the player (so the box hides the enemy) */
function coverSpotFor(box, px, pz) {
  const cx = (box.minX + box.maxX) / 2, cz = (box.minZ + box.maxZ) / 2;
  let dx = cx - px, dz = cz - pz; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
  const reach = Math.max(box.maxX - box.minX, box.maxZ - box.minZ) / 2 + 0.9;
  return { x: clamp(cx + dx * reach, -ARENA_W / 2 + 1.2, ARENA_W / 2 - 1.2), z: clamp(cz + dz * reach, -ARENA_D / 2 + 1.2, ARENA_D / 2 - 1.2) };
}

/* ── arena ──────────────────────────────────────────────────── */
function buildArena(three) {
  const colliders = [], coverBoxes = [];
  const mats = [], geos = [];
  const M = (c, r = 0.9) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: r }); mats.push(m); return m; };
  const G = (g) => { geos.push(g); return g; };
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(G(geo), mat); m.position.set(x, y, z); three.add(m); return m; };
  const addSolid = (w, h, d, x, z, color, isCover) => {
    add(new THREE.BoxGeometry(w, h, d), M(color), x, h / 2, z);
    const c = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, y0: 0, y1: h, level: 0 };
    colliders.push(c);
    if (isCover && h >= 1.6) coverBoxes.push(c);                  /* only boxes that hide a standing soldier */
    return c;
  };

  add(new THREE.PlaneGeometry(ARENA_W, ARENA_D), M(0x4a4640, 1), 0, 0, 0).rotation.x = -Math.PI / 2;
  add(new THREE.PlaneGeometry(0.2, ARENA_D - 2), new THREE.MeshBasicMaterial({ color: 0xc9a227 }), 0, 0.01, 0).rotation.x = -Math.PI / 2;

  const WT = 0.6;
  addSolid(ARENA_W, ARENA_H, WT, 0, -ARENA_D / 2, 0x3a3a44);
  addSolid(ARENA_W, ARENA_H, WT, 0, ARENA_D / 2, 0x3a3a44);
  addSolid(WT, ARENA_H, ARENA_D, -ARENA_W / 2, 0, 0x3a3a44);
  addSolid(WT, ARENA_H, ARENA_D, ARENA_W / 2, 0, 0x3a3a44);
  add(new THREE.PlaneGeometry(ARENA_W, ARENA_D), M(0x22222a), 0, ARENA_H, 0).rotation.x = Math.PI / 2;

  /* [x, z, w, h, d, colour, isCover] — staggered so there are real lanes and flanking routes */
  const layout = [
    [-10, -10, 2.4, 2.0, 2.2, 0x7a5a3a, true], [10, -10, 2.4, 2.0, 2.2, 0x7a5a3a, true], [0, -12, 3.4, 1.8, 1.6, 0x5a5a62, true],
    [-6, -2, 1.8, 2.2, 1.8, 0x6a4a2a, true], [6, -2, 1.8, 2.2, 1.8, 0x6a4a2a, true], [0, 2, 4.0, 0.9, 1.4, 0x5a5a62, false],
    [-12, 6, 2.2, 1.8, 1.6, 0x8a6a4a, true], [12, 6, 2.2, 1.8, 1.6, 0x8a6a4a, true], [0, 10, 2.8, 1.8, 2.0, 0x6a4a2a, true],
    [-16, -4, 1.4, 2.6, 1.4, 0x5a5a62, true], [16, -4, 1.4, 2.6, 1.4, 0x5a5a62, true],
    [-18, -14, 1.0, ARENA_H, 1.0, 0x30303a, false], [18, -14, 1.0, ARENA_H, 1.0, 0x30303a, false],
  ];
  for (const [x, z, w, h, d, color, cover] of layout) addSolid(w, h, d, x, z, color, cover);

  for (const [x, z] of [[-8, 12], [8, 12], [-14, -8], [14, -8]]) {            /* barrels: decor + low obstacles */
    add(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 12), M(0x8a3a2a), x, 0.55, z);
    colliders.push({ minX: x - 0.45, maxX: x + 0.45, minZ: z - 0.45, maxZ: z + 0.45, y0: 0, y1: 1.1, level: 0 });
  }
  /* advanced arena dressing: neon pylons, gantries, warning lights and floor lanes */
  const neonCyan = new THREE.MeshStandardMaterial({ color: 0x19d9ff, emissive: 0x00aaff, emissiveIntensity: 1.8, metalness: .25, roughness: .28 });
  const neonPink = new THREE.MeshStandardMaterial({ color: 0xff3da8, emissive: 0xc90072, emissiveIntensity: 1.45, metalness: .2, roughness: .3 });
  const darkMetal = M(0x171d2c, .42);
  for (const x of [-20, -10, 10, 20]) {
    const pylon = add(new THREE.BoxGeometry(.24, 5.8, .24), darkMetal, x, 2.9, -20);
    const strip = add(new THREE.BoxGeometry(.08, 5.5, .08), neonCyan, x + .15, 2.9, -20);
    const pylon2 = add(new THREE.BoxGeometry(.24, 5.8, .24), darkMetal, x, 2.9, 20);
    add(new THREE.BoxGeometry(.08, 5.5, .08), neonPink, x - .15, 2.9, 20);
  }
  for (const z of [-18, -6, 6, 18]) {
    add(new THREE.BoxGeometry(ARENA_W - 3, .12, .16), neonCyan, 0, .04, z);
    for (const x of [-18, 18]) {
      const lamp = add(new THREE.BoxGeometry(.7, .18, .7), neonPink, x, 5.8, z);
      lamp.material = neonPink;
    }
  }
  /* industrial overhead gantries */
  for (const z of [-15, 15]) {
    add(new THREE.BoxGeometry(ARENA_W - 5, .28, .42), darkMetal, 0, 6.1, z);
    add(new THREE.BoxGeometry(ARENA_W - 5, .08, .12), neonCyan, 0, 5.92, z);
    for (const x of [-18, 18]) add(new THREE.BoxGeometry(.32, 6, .32), darkMetal, x, 3, z);
  }
  mats.push(neonCyan, neonPink);
  return { colliders, coverBoxes, mats, geos };
}

/* ── enemy soldier ──────────────────────────────────────────── */
class TacticalEnemy {
  constructor(game, cfg, spawn, n, wave) {
    this.game = game; this.n = n;
    this.pos = { x: spawn.x, z: spawn.z };
    this.yaw = 0;
    this.maxHp = 100 + Math.min(80, (wave - 1) * 10); this.hp = this.maxHp;
    this.dead = false; this.dying = 0; this.deadT = 0; this.gone = false;
    this.state = "advance"; this.stateT = 0;
    this.burstLeft = 0; this.burstShots = 3 + Math.floor(rnd() * 3);
    this.fireCd = 0; this.reloadT = 0;
    this.coverPos = null; this.flankPos = null; this._stuckT = 0; this._hiddenT = 0;
    this.skill = clamp(0.35 + wave * 0.05 + rnd() * 0.1, 0.35, 0.8);

    const built = buildCharacter(withPlayerLook(cfg));
    this.rig = built.rig; this.group = built.root;
    this.group.position.set(spawn.x, 0, spawn.z);
    game.three.add(this.group);

    this.ctl = {
      rig: this.rig, pos: { x: spawn.x, y: 0, z: spawn.z }, yaw: 0, state: "standing", onGround: true, level: 0, vel: { y: 0 },
      _intentSpeed: 0, _ul: () => {}, _emoteTimer: 0, _emoteName: null, _emotePhase: 0, _useTimer: 0, _useBend: 0.3,
      weapons: null, held: null, phoneHold: false, sitTarget: null, aimPitch: 0, _overlay: null,
    };
    /* the same pistol + arm poses the player uses (no laser: no scene passed) */
    this.gun = new Gun({ rig: this.rig, aimPitch: 0, yaw: 0, pos: this.pos }, "pistol");
    this.gun.draw();

    const self = this;
    this.target = {                              /* what the player's gun sees */
      get x() { return self.pos.x; }, get z() { return self.pos.z; }, y: 0,
      get alive() { return !self.dead; },
      onHit(dmg, type, part) { self.takeHit(dmg, part); },
    };
  }

  takeHit(dmg, part) {                           /* dmg already includes the head/limb multiplier */
    if (this.dead) return;
    this.hp -= dmg;
    this.lastPart = part;
    if (this.hp <= 0) { this.die(part); return; }
    if (this.hp < this.maxHp * 0.3) { this.state = "retreat"; this.stateT = 0; }
    else if (this.state === "advance" || this.state === "peek" || this.state === "fire") { this.state = "seek_cover"; this.stateT = 0; this.coverPos = null; }
  }

  die(part) {
    if (this.dead) return;
    this.dead = true; this.dying = 0; this.state = "dead";
    const cols = this.game.colliders;
    this.fall = pickFall(this.pos.x, this.pos.z, this.yaw, (x, z) => !cols.some((c) => c.y1 > 0.3 && x > c.minX - 0.12 && x < c.maxX + 0.12 && z > c.minZ - 0.12 && z < c.maxZ + 0.12));
    this.pos.x = this.fall.x; this.pos.z = this.fall.z;
    this.roll = rnd() < 0.5 ? -0.3 : 0.3;
    try { this.gun.holster(); } catch (e) {}
    try { Limp.kick(this.rig, -Math.sin(this.yaw) * 60, 15, -Math.cos(this.yaw) * 60, 1); } catch (e) {}
    try { Sfx.pain("death", { x: this.pos.x, z: this.pos.z, maxRange: 40 }); Sfx.play("body_fall", { x: this.pos.x, z: this.pos.z }); } catch (e) {}
    this.game.onKill(this, part);
  }

  hasLOS(px, pz) { return !blocked(this.game.colliders, this.pos.x, 1.4, this.pos.z, px, 1.2, pz); }

  _stepToward(tx, tz, speed, dt) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z, dist = Math.hypot(dx, dz);
    if (dist < 0.3) return false;
    const step = Math.min(dist, speed * dt), nx = dx / dist, nz = dz / dist;
    const B = this.game.bounds, cols = this.game.colliders;
    const ok = (x, z) => {
      if (x < B.minX || x > B.maxX || z < B.minZ || z > B.maxZ) return false;
      for (const c of cols) if (c.y1 > 0.3 && x > c.minX - 0.4 && x < c.maxX + 0.4 && z > c.minZ - 0.4 && z < c.maxZ + 0.4) return false;
      return true;
    };
    const mx = this.pos.x + nx * step, mz = this.pos.z + nz * step;
    if (ok(mx, mz)) { this.pos.x = mx; this.pos.z = mz; }
    else if (ok(mx, this.pos.z)) this.pos.x = mx;
    else if (ok(this.pos.x, mz)) this.pos.z = mz;
    else return false;
    this.yaw = Math.atan2(dx, dz);
    return true;
  }

  _findCover(px, pz) {
    let best = null, bd = 1e9;
    for (const b of this.game.coverBoxes) {
      const s = coverSpotFor(b, px, pz);
      const d = Math.hypot(s.x - this.pos.x, s.z - this.pos.z);
      if (d > 26 || d >= bd) continue;
      if (Math.hypot(s.x - px, s.z - pz) < 5) continue;                       /* not right on top of the player */
      if (!blocked([b], px, 1.2, pz, s.x, 1.4, s.z)) continue;                /* the box must actually hide the spot */
      best = s; bd = d;
    }
    return best || { x: clamp(this.pos.x + (rnd() - 0.5) * 8, this.game.bounds.minX, this.game.bounds.maxX), z: clamp(this.pos.z - 3, this.game.bounds.minZ, this.game.bounds.maxZ) };
  }

  tick(dt, P) {
    if (this.dead) {
      this.deadT += dt; this.dying += dt;
      const p = Math.min(1, this.dying / 0.75), ef = p * p;
      const bounce = p > 0.8 ? Math.sin((p - 0.8) / 0.2 * Math.PI) * 0.06 : 0;
      poseFall(this.group, this.fall, this.yaw, ef, this.roll);
      this.group.position.set(this.pos.x, restY(0, ef) + 0.10 * Math.sin(Math.PI * Math.min(1, p * 1.2)) * (1 - ef) + bounce, this.pos.z);
      try { Limp.step(this.rig, this.group, dt); } catch (e) {}
      return;
    }
    this.stateT += dt;
    this.fireCd = Math.max(0, this.fireCd - dt);
    const px = P.x, pz = P.z, d = Math.hypot(px - this.pos.x, pz - this.pos.z), los = P.alive && this.hasLOS(px, pz);
    this._hiddenT = los ? 0 : this._hiddenT + dt;

    switch (this.state) {
      case "advance":
        if (los && d < 15) { this.state = "peek"; this.stateT = 0; }
        else if (!los && d < 20) { this.state = "seek_cover"; this.stateT = 0; this.coverPos = null; }
        else if (d > 24) { this.state = "seek_cover"; this.stateT = 0; this.coverPos = null; }
        break;
      case "seek_cover":
        if (this.coverPos && Math.hypot(this.coverPos.x - this.pos.x, this.coverPos.z - this.pos.z) < 0.7) {
          /* in cover: if the player can't see us for a while, sometimes flank instead of waiting */
          if (this._hiddenT > 5 && rnd() < 0.5) {
            const side = this.pos.x < px ? 1 : -1;
            this.flankPos = { x: clamp(px + side * (9 + rnd() * 5), this.game.bounds.minX + 1, this.game.bounds.maxX - 1), z: clamp(pz - 4 - rnd() * 4, this.game.bounds.minZ + 1, this.game.bounds.maxZ - 1) };
            this.state = "flank"; this.stateT = 0;
          } else { this.state = "peek"; this.stateT = 0; }
        }
        break;
      case "flank":
        if (!this.flankPos || Math.hypot(this.flankPos.x - this.pos.x, this.flankPos.z - this.pos.z) < 0.8 || this.stateT > 8) { this.state = los ? "peek" : "seek_cover"; this.stateT = 0; this.coverPos = null; }
        else if (los && d < 14) { this.state = "peek"; this.stateT = 0; }
        break;
      case "peek":
        if (this.stateT > 0.45 + (1 - this.skill) * 0.4) { this.state = "fire"; this.stateT = 0; this.burstLeft = this.burstShots; }
        break;
      case "fire":
        if (this.fireCd <= 0 && this.burstLeft > 0 && los) {
          if (this.gun.fire()) { this.game.enemyShot(this, d); this.burstLeft--; this.fireCd = 0.28 + rnd() * 0.12; }
        }
        if (this.burstLeft <= 0 || !los) { this.state = "reload"; this.stateT = 0; this.reloadT = 1.1 + rnd() * 0.6; }
        break;
      case "reload":
        if (this.stateT > this.reloadT) { this.state = los ? "peek" : "seek_cover"; this.stateT = 0; this.coverPos = null; this.burstShots = 3 + Math.floor(rnd() * 3); }
        break;
      case "retreat":
        if (this.stateT > 3) { this.state = "seek_cover"; this.stateT = 0; this.coverPos = null; }
        break;
    }

    let moved = false, sp = 0;
    if (this.state === "advance") { moved = this._stepToward(px, pz, 3.2, dt); sp = 3.2; }
    else if (this.state === "seek_cover") {
      if (!this.coverPos) this.coverPos = this._findCover(px, pz);
      moved = this._stepToward(this.coverPos.x, this.coverPos.z, 4.2, dt); sp = 4.2;
    } else if (this.state === "flank" && this.flankPos) { moved = this._stepToward(this.flankPos.x, this.flankPos.z, 4.0, dt); sp = 4.0; }
    else if (this.state === "retreat") { moved = this._stepToward(clamp(this.pos.x + (this.pos.x - px), this.game.bounds.minX, this.game.bounds.maxX), clamp(this.pos.z + (this.pos.z - pz), this.game.bounds.minZ, this.game.bounds.maxZ), 4.6, dt); sp = 4.6; }
    else this.yaw = Math.atan2(px - this.pos.x, pz - this.pos.z);       /* peek / fire / reload: face the player */

    if (moved) this._stuckT = 0;
    else if (sp > 0) { this._stuckT += dt; if (this._stuckT > 2) { this._stuckT = 0; this.coverPos = null; this.flankPos = null; this.state = "advance"; } }

    /* soft separation so squads don't stack */
    for (const o of this.game.enemies) {
      if (o === this || o.dead) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, dd = Math.hypot(dx, dz);
      if (dd > 1e-3 && dd < 0.8) { const k = (0.8 - dd) * 0.5 / dd; this.pos.x += dx * k; this.pos.z += dz * k; }
    }

    const aiming = this.state === "peek" || this.state === "fire" || this.state === "reload";
    this.ctl.pos.x = this.pos.x; this.ctl.pos.z = this.pos.z; this.ctl.yaw = this.yaw;
    this.ctl._intentSpeed = moved ? sp : 0;
    this.ctl._overlay = aiming ? (R) => { try { this.gun.applyArmPose(R); } catch (e) {} } : null;
    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.group.rotation.y = this.yaw;
    try { this.gun.update(dt, []); } catch (e) {}
    try { Animator.animate(this.ctl, dt); } catch (e) {}
  }

  dispose() {
    try { this.gun.dispose(); } catch (e) {}
    if (this.group.parent) this.group.parent.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m && m.dispose && m.dispose());
    });
  }
}

/* ── main scene ─────────────────────────────────────────────── */
export async function shootingRangeScene(params, router) {
  const three = new THREE.Scene();
  three.background = new THREE.Color(0x0e1018);
  three.fog = new THREE.Fog(0x0e1018, 30, 100);
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 200);

  three.add(new THREE.HemisphereLight(0x9fb8e0, 0x30302e, 1.2));
  three.add(new THREE.AmbientLight(0xffffff, 0.4));
  const sun = new THREE.DirectionalLight(0xfff2d6, 1.1); sun.position.set(15, 22, 10); three.add(sun);
  const stripGeo = new THREE.BoxGeometry(30, 0.15, 0.5), stripMat = new THREE.MeshBasicMaterial({ color: 0xd8e8ff });
  for (const z of [-12, 0, 12]) { const s = new THREE.Mesh(stripGeo, stripMat); s.position.set(0, ARENA_H - 0.2, z); three.add(s); }

  const arena = buildArena(three);
  const bounds = { minX: -ARENA_W / 2 + 0.8, maxX: ARENA_W / 2 - 0.8, minZ: -ARENA_D / 2 + 0.8, maxZ: ARENA_D / 2 - 0.8 };
  const world = { colliders: arena.colliders, seats: [], uses: [], platforms: [], levelHeight: () => 0, ceilingHeight: ARENA_H,
    bounds: { minX: bounds.minX - 0.4, maxX: bounds.maxX + 0.4, minZ: bounds.minZ - 0.4, maxZ: bounds.maxZ + 0.4 } };

  /* ── HUD ── */
  const hud = document.createElement("div");
  hud.id = "ph3d-range-hud";
  hud.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:26;font-family:Inter,system-ui,sans-serif;color:#fff";
  hud.innerHTML = `
    <div style="position:absolute;left:14px;top:calc(env(safe-area-inset-top) + 14px);width:150px">
      <div style="font:800 11px Inter;letter-spacing:.14em;opacity:.8;margin-bottom:4px">HP <span id="rg-hp">100</span></div>
      <div style="height:8px;border-radius:5px;background:rgba(0,0,0,.55);overflow:hidden"><div id="rg-hpbar" style="height:100%;width:100%;background:linear-gradient(90deg,#ff5a4d,#ffd23a 50%,#7dff9a)"></div></div>
    </div>
    <div id="rg-wave" style="position:absolute;left:50%;top:calc(env(safe-area-inset-top) + 16px);transform:translateX(-50%);padding:8px 18px;border-radius:999px;background:rgba(0,0,0,.6);border:1px solid rgba(255,80,80,.55);font:800 11px Inter;letter-spacing:.2em;color:#ff9999;white-space:nowrap">WAVE 1</div>
    <div id="rg-score" style="position:absolute;left:14px;top:calc(env(safe-area-inset-top) + 56px);font:800 11px Inter;letter-spacing:.12em;text-shadow:0 1px 4px #000">KILLS 0 · HEADSHOTS 0</div>
    <div id="rg-feed" style="position:absolute;right:14px;top:calc(env(safe-area-inset-top) + 60px);text-align:right;font:700 12px Inter;text-shadow:0 1px 4px #000"></div>
    <div id="rg-hit" style="position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;opacity:0;transition:opacity .12s">
      <div style="position:absolute;left:3px;top:11px;width:20px;height:3px;background:#fff;transform:rotate(45deg);box-shadow:0 0 4px #000"></div>
      <div style="position:absolute;left:3px;top:11px;width:20px;height:3px;background:#fff;transform:rotate(-45deg);box-shadow:0 0 4px #000"></div></div>
    <div id="rg-banner" style="position:absolute;left:0;right:0;top:32%;text-align:center;font:900 26px Inter;letter-spacing:.14em;text-shadow:0 2px 10px #000;opacity:0;transition:opacity .3s"></div>
    <div id="rg-dead" style="position:absolute;inset:0;background:rgba(120,0,0,.55);display:flex;align-items:center;justify-content:center;font:900 28px Inter;letter-spacing:.2em;opacity:0;transition:opacity .25s">DOWN</div>
    <div class="rg-weaponbar"><button id="rg-pistol">PISTOL · 3</button><button id="rg-sniper">SNIPER · 4</button></div>
    <div class="rg-skills"><button id="rg-shield"><b>▰</b><span>GLOW WALL</span><small id="rg-shield-cd">READY</small></button><button id="rg-dash"><b>➤</b><span>BLINK DASH</span><small id="rg-dash-cd">READY</small></button><button id="rg-heal"><b>✚</b><span>MED KIT</span><small id="rg-heal-cd">READY</small></button></div>
    <div id="rg-skill-msg" class="rg-skill-msg"></div>`;
  const rangeStyle = document.createElement("style");
  rangeStyle.textContent = `
    .rg-weaponbar{position:absolute;right:14px;bottom:112px;display:flex;gap:7px;pointer-events:auto}
    .rg-weaponbar button,.rg-skills button{color:#eafaff;background:linear-gradient(145deg,rgba(10,22,45,.94),rgba(25,14,52,.92));border:1px solid rgba(38,218,255,.65);box-shadow:0 0 16px rgba(0,190,255,.18),inset 0 0 12px rgba(0,180,255,.08);border-radius:12px;font:800 10px Inter,system-ui;letter-spacing:.08em;padding:10px 12px;pointer-events:auto;touch-action:manipulation}
    .rg-skills{position:absolute;right:14px;bottom:18px;display:flex;gap:8px;pointer-events:auto}
    .rg-skills button{min-width:76px;display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 7px;border-color:rgba(255,69,181,.7);box-shadow:0 0 16px rgba(255,30,160,.2)}
    .rg-skills b{font-size:19px;color:#62eaff;text-shadow:0 0 12px #00cfff}.rg-skills span{font-size:9px}.rg-skills small{font-size:9px;color:#8dffcc}
    .rg-skills button:disabled{opacity:.48;filter:grayscale(.6)}.rg-skill-msg{position:absolute;left:50%;bottom:100px;transform:translateX(-50%);font:900 13px Inter;color:#8ffaff;text-shadow:0 0 14px #00cfff;opacity:0;transition:opacity .2s;white-space:nowrap}
    @media(max-width:600px){.rg-weaponbar{right:8px;bottom:128px}.rg-skills{right:8px;bottom:14px;gap:5px}.rg-skills button{min-width:67px;padding:8px 5px}.rg-skills span{font-size:8px}}
  `;
  document.head.appendChild(rangeStyle);
  document.body.appendChild(hud);
  const $h = (id) => hud.querySelector("#" + id);
  const elHp = $h("rg-hp"), elBar = $h("rg-hpbar"), elWave = $h("rg-wave"), elScore = $h("rg-score"), elFeed = $h("rg-feed"), elHit = $h("rg-hit"), elBanner = $h("rg-banner"), elDead = $h("rg-dead");

  const exitBtn = document.createElement("button");
  exitBtn.textContent = "\u25C0 EXIT";
  exitBtn.style.cssText = "position:fixed;right:14px;top:calc(env(safe-area-inset-top) + 14px);z-index:27;padding:10px 16px;border-radius:22px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.4);color:#fff;font:800 11px Inter,system-ui,sans-serif;letter-spacing:.14em;pointer-events:auto;cursor:pointer";
  exitBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); router.go("city"); }, { passive: false });
  document.body.appendChild(exitBtn);

  /* ── game state ── */
  const G = {
    three, colliders: arena.colliders, coverBoxes: arena.coverBoxes, bounds, enemies: [],
    hp: 100, alive: true, hurtT: 0, deadT: 0,
    wave: 0, waveLeft: 0, spawned: 0, breakT: 2.5, kills: 0, heads: 0, nextId: 1, bannerT: 0, hitT: 0,
    tracers: [],
  };
  const player = { x: PLAYER_SPAWN.x, z: PLAYER_SPAWN.z, alive: true };
  const skills = { shield: 0, dash: 0, heal: 0, wall: null, wallCollider: null, wallLife: 0, dashGlow: 0 };
  const skillMsg = $h("rg-skill-msg");
  function skillToast(message) { skillMsg.textContent = message; skillMsg.style.opacity = "1"; clearTimeout(skillToast._t); skillToast._t = setTimeout(() => skillMsg.style.opacity = "0", 1200); }
  function cooldownLabel(id, value) { const el = $h(id); if (el) el.textContent = value > 0 ? value.toFixed(1) + "s" : "READY"; }
  function useGlowWall() {
    if (!G.alive || skills.shield > 0 || skills.wall) return;
    const dir = new THREE.Vector3(Math.sin(ctl.yaw), 0, Math.cos(ctl.yaw));
    const pos = new THREE.Vector3(ctl.pos.x, 0, ctl.pos.z).addScaledVector(dir, 3.0);
    const geo = new THREE.BoxGeometry(5.2, 3.2, .28);
    const mat = new THREE.MeshStandardMaterial({ color: 0x16cfff, emissive: 0x008cff, emissiveIntensity: 2.2, transparent: true, opacity: .34, metalness: .3, roughness: .2, side: THREE.DoubleSide });
    const wall = new THREE.Mesh(geo, mat); wall.position.set(pos.x, 1.6, pos.z); wall.rotation.y = ctl.yaw; three.add(wall);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x8ffaff, transparent: true, opacity: .95 })); wall.add(edge);
    skills.wall = wall; skills.wallLife = 6; skills.shield = 18;
    skills.wallCollider = { minX: pos.x - 2.6, maxX: pos.x + 2.6, minZ: pos.z - .22, maxZ: pos.z + .22, y0: 0, y1: 3.2, level: 0, _glowWall: true };
    /* oriented wall collision approximation, adequate for the arena's near-axis tactical cover */
    if (Math.abs(Math.sin(ctl.yaw)) > .7) { const c = skills.wallCollider; c.minX = pos.x - .22; c.maxX = pos.x + .22; c.minZ = pos.z - 2.6; c.maxZ = pos.z + 2.6; }
    G.colliders.push(skills.wallCollider); G.coverBoxes.push(skills.wallCollider);
    skillToast("GLOW WALL DEPLOYED");
  }
  function useDash() {
    if (!G.alive || skills.dash > 0) return;
    const dir = new THREE.Vector3(Math.sin(ctl.yaw), 0, Math.cos(ctl.yaw));
    const target = new THREE.Vector3(ctl.pos.x, 0, ctl.pos.z).addScaledVector(dir, 5.5);
    target.x = clamp(target.x, bounds.minX, bounds.maxX); target.z = clamp(target.z, bounds.minZ, bounds.maxZ);
    const hit = arena.colliders.some(c => !c._glowWall && target.x > c.minX - .45 && target.x < c.maxX + .45 && target.z > c.minZ - .45 && target.z < c.maxZ + .45);
    if (!hit) { ctl.pos.set(target.x, 0, target.z); player.x = target.x; player.z = target.z; }
    skills.dash = 12; skills.dashGlow = .45; skillToast("BLINK DASH");
  }
  function useMedkit() {
    if (!G.alive || skills.heal > 0 || G.hp >= 100) return;
    G.hp = Math.min(100, G.hp + 38); G.hurtT = 0; skills.heal = 24; skillToast("+38 HP · MED KIT");
  }
  $h("rg-shield").addEventListener("pointerdown", e => { e.preventDefault(); useGlowWall(); });
  $h("rg-dash").addEventListener("pointerdown", e => { e.preventDefault(); useDash(); });
  $h("rg-heal").addEventListener("pointerdown", e => { e.preventDefault(); useMedkit(); });

  function banner(txt, secs = 2) { elBanner.textContent = txt; elBanner.style.opacity = "1"; G.bannerT = secs; }
  function feed(txt, color) {
    const d = document.createElement("div"); d.textContent = txt; d.style.cssText = "margin-bottom:3px;color:" + (color || "#fff"); elFeed.prepend(d);
    while (elFeed.children.length > 5) elFeed.lastChild.remove();
    setTimeout(() => { try { d.remove(); } catch (e) {} }, 5000);
  }
  const updScore = () => { elScore.textContent = "KILLS " + G.kills + " · HEADSHOTS " + G.heads; };

  G.onKill = (enemy, part) => {
    G.kills++; if (part === "head") G.heads++;
    G.waveLeft--; updScore();
    feed("\u2713 SOLDIER " + enemy.n + (part === "head" ? " · HEADSHOT" : ""), part === "head" ? "#ffd23a" : "#9dffb0");
    elHit.style.opacity = "1"; G.hitT = 0.25;
  };

  function tracer(x1, y1, z1, x2, y2, z2) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat); three.add(line); G.tracers.push({ line, geo, mat, t: 0.12 });
  }

  /* cheap muzzle flash (a lit mesh, not a light — several shooters must not trigger shader recompiles) */
  const flashGeo = new THREE.SphereGeometry(0.11, 8, 6);
  function flash(x, y, z) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95 });
    const m = new THREE.Mesh(flashGeo, mat); m.position.set(x, y, z); three.add(m);
    G.tracers.push({ line: m, geo: null, mat, t: 0.07 });
  }

  /* an enemy fired: roll to hit based on skill, distance and whether you're moving */
  G.enemyShot = (en, dist) => {
    const mz = new THREE.Vector3();
    if (en.gun.mesh.userData.muzzleLocal) { mz.copy(en.gun.mesh.userData.muzzleLocal); en.gun.mesh.localToWorld(mz); } else mz.set(en.pos.x, 1.3, en.pos.z);
    const moving = ctl.moving ? 0.7 : 1;
    const chance = clamp(en.skill * (1.1 - dist / 30), 0.08, 0.7) * moving * (ctl.state === "crouching" ? 0.75 : 1);
    const hit = player.alive && Math.random() < chance;
    const jx = hit ? 0 : (rnd() - 0.5) * 1.6, jz = hit ? 0 : (rnd() - 0.5) * 1.6;
    tracer(mz.x, mz.y, mz.z, player.x + jx, 1.2 + (hit ? 0 : (rnd() - 0.5)), player.z + jz);
    flash(mz.x, mz.y, mz.z);
    if (hit) hurt(5 + Math.round(G.wave * 0.8) + Math.floor(rnd() * 4), en);
  };

  function hurt(dmg, from) {
    if (!G.alive) return;
    G.hp = Math.max(0, G.hp - dmg); G.hurtT = 0;
    try { Combat.flash && Combat.flash(0.5); Sfx.pain(dmg >= 10 ? "medium" : "light", { vol: 0.6 }); } catch (e) {}
    if (G.hp <= 0) {                                                  /* arena death = respawn, never the hospital */
      G.alive = false; player.alive = false; G.deadT = 2.6;
      try { Sfx.pain("death", { vol: 0.9 }); } catch (e) {}
      elDead.style.opacity = "1";
      feed("\u2717 You were taken out", "#ff8a80");
    }
  }

  const waveSize = (n) => Math.min(14, 2 + n * 2);

  function respawn() {
    G.hp = 100; G.alive = true; player.alive = true;
    ctl.pos.set(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z); ctl.vel.set(0, 0, 0); ctl.yaw = Math.PI; ctl.camYaw = Math.PI * 2;
    elDead.style.opacity = "0";
    for (const e of G.enemies) e.dispose();                          /* restart the current wave */
    G.enemies.length = 0; G.spawned = 0; G.waveLeft = waveSize(G.wave); G.breakT = 2.0;
    banner("WAVE " + G.wave + " — AGAIN", 1.8);
  }

  function startWave() {
    G.wave++; G.waveLeft = waveSize(G.wave); G.spawned = 0;
    elWave.textContent = "WAVE " + G.wave; banner("WAVE " + G.wave, 2);
    try { Sfx.play("bell", { vol: 0.5 }); } catch (e) {}
  }
  function spawnOne() {
    const x = clamp((rnd() - 0.5) * 30, -16, 16), z = -17 - rnd() * 2;
    const cfg = SOLDIER_CONFIGS[Math.floor(rnd() * SOLDIER_CONFIGS.length)];
    G.enemies.push(new TacticalEnemy(G, cfg, { x, z }, G.nextId++, G.wave));
    G.spawned++;
  }

  /* ── the player: real third-person controls, gun drawn ── */
  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, world, {
    scene: three, x: PLAYER_SPAWN.x, z: PLAYER_SPAWN.z, yaw: Math.PI, level: 0, speedMult: 1.15,
    /* only enemies you could actually hit: cover blocks your shots too */
    getTargets: () => {
      const aim = ctl.getAim && ctl.getAim();
      const ox = aim ? aim.origin.x : ctl.pos.x, oy = aim ? aim.origin.y : 1.35, oz = aim ? aim.origin.z : ctl.pos.z;
      const out = [];
      for (const e of G.enemies) {
        if (e.dead) continue;
        if (!blocked(arena.colliders, ox, oy, oz, e.pos.x, 1.2, e.pos.z)) out.push(e.target);
      }
      return out;
    },
    onGunFire: (info) => { if (info && info.hit) { elHit.style.opacity = "1"; G.hitT = 0.12; } },
  });
  try { ctl.weapons.select("pistol"); } catch (e) {}
  $h("rg-pistol").addEventListener("pointerdown", e => { e.preventDefault(); try { ctl.weapons.select("pistol"); skillToast("PISTOL EQUIPPED"); } catch (_) {} });
  $h("rg-sniper").addEventListener("pointerdown", e => { e.preventDefault(); try { ctl.weapons.select("sniper"); skillToast("SNIPER EQUIPPED"); } catch (_) {} });
  banner("TACTICAL RANGE", 1.8);

  return {
    three, camera,
    controls: { update: () => {} },
    crumb: "TACTICAL RANGE", title: "WARFARE", subtitle: "SQUAD COMBAT",
    hint: "LEFT: MOVE · RIGHT: AIM · FIRE: SHOOT · Q: WEAPONS",
    isInterior: true, sceneId: "shootingrange",
    dispose: () => {
      for (const e of G.enemies) e.dispose();
      G.enemies.length = 0;
      for (const t of G.tracers) { three.remove(t.line); if (t.geo) t.geo.dispose(); t.mat.dispose(); }
      flashGeo.dispose();
      try { ctl.dispose(); } catch (e) {}
      if (skills.wall) { three.remove(skills.wall); skills.wall.geometry.dispose(); skills.wall.material.dispose(); }
      [hud, exitBtn, rangeStyle].forEach((el) => { try { el.remove(); } catch (e) {} });
      arena.geos.forEach((g) => g.dispose()); arena.mats.forEach((m) => m.dispose()); stripGeo.dispose(); stripMat.dispose();
    },
    update: (dt) => {
      dt = Math.min(dt, 0.05);
      ctl.update(dt);
      player.x = ctl.pos.x; player.z = ctl.pos.z;
      skills.shield = Math.max(0, skills.shield - dt); skills.dash = Math.max(0, skills.dash - dt); skills.heal = Math.max(0, skills.heal - dt);
      cooldownLabel("rg-shield-cd", skills.shield); cooldownLabel("rg-dash-cd", skills.dash); cooldownLabel("rg-heal-cd", skills.heal);
      $h("rg-shield").disabled = skills.shield > 0 || !!skills.wall || !G.alive;
      $h("rg-dash").disabled = skills.dash > 0 || !G.alive; $h("rg-heal").disabled = skills.heal > 0 || G.hp >= 100 || !G.alive;
      if (skills.wall) { skills.wallLife -= dt; skills.wall.material.opacity = .25 + Math.sin(performance.now() * .006) * .08; if (skills.wallLife <= 0) { three.remove(skills.wall); skills.wall.geometry.dispose(); skills.wall.material.dispose(); skills.wall.traverse(o => { if (o.material && o.material.dispose) o.material.dispose(); }); G.colliders = G.colliders.filter(c => c !== skills.wallCollider); G.coverBoxes = G.coverBoxes.filter(c => c !== skills.wallCollider); arena.colliders.splice(arena.colliders.indexOf(skills.wallCollider), 1); skills.wall = null; skills.wallCollider = null; } }
      if (skills.dashGlow > 0) skills.dashGlow = Math.max(0, skills.dashGlow - dt);

      /* waves */
      if (G.alive) {
        if (G.wave === 0 || (G.waveLeft <= 0 && G.enemies.every((e) => e.dead || e.gone))) {
          G.breakT -= dt;
          if (G.breakT <= 0) {
            if (G.wave > 0) {                                           /* wave cleared: small capped reward */
              const bonus = Math.min(1500, 300 * G.wave);
              try { Economy.receive("Tactical Range", bonus, "Wave " + G.wave + " cleared"); } catch (e) {}
              feed("WAVE " + G.wave + " CLEARED +\u20A6" + bonus, "#ffd23a");
              G.hp = Math.min(100, G.hp + 25);
            }
            startWave(); G.breakT = 3;
          }
        } else if (G.spawned < waveSize(G.wave)) {
          G.breakT -= dt;
          const alive = G.enemies.filter((e) => !e.dead).length;
          if (alive < MAX_ALIVE && G.breakT <= 0) { spawnOne(); G.breakT = 0.8; }
        }
      } else {
        G.deadT -= dt; if (G.deadT <= 0) respawn();
      }

      for (const e of G.enemies) e.tick(dt, player);
      /* remove corpses after a while */
      for (let i = G.enemies.length - 1; i >= 0; i--) {
        const e = G.enemies[i];
        if (e.dead && e.deadT > 7) { e.gone = true; e.dispose(); G.enemies.splice(i, 1); }
      }

      /* regen out of combat */
      if (G.alive) { G.hurtT += dt; if (G.hurtT > 6 && G.hp < 100) G.hp = Math.min(100, G.hp + 8 * dt); }

      /* tracers + hit marker + banner */
      for (let i = G.tracers.length - 1; i >= 0; i--) {
        const t = G.tracers[i]; t.t -= dt; t.mat.opacity = Math.max(0, t.t / (t.geo ? 0.12 : 0.07)) * 0.9;
        if (t.t <= 0) { three.remove(t.line); if (t.geo) t.geo.dispose(); t.mat.dispose(); G.tracers.splice(i, 1); }
      }
      if (G.hitT > 0) { G.hitT -= dt; if (G.hitT <= 0) elHit.style.opacity = "0"; }
      if (G.bannerT > 0) { G.bannerT -= dt; if (G.bannerT <= 0) elBanner.style.opacity = "0"; }
      elHp.textContent = Math.round(G.hp); elBar.style.width = G.hp + "%";

      if (Multiplayer.ready) { try { Multiplayer.updatePos(ctl.pos.x, ctl.pos.z, ctl.yaw, "idle"); } catch (e) {} }
    },
  };
}
