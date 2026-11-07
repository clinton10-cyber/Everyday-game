/* ════════════════════════════════════════════════════════════════
   npc-cars.js — path-following AI traffic.

   Fixes in this version:
   • Only real models from /vehicles (via vehicles/traffic.js), nose-first.
   • _aabbs guard: never spawn and never advance into a building.
   • Player-car-vs-NPC-car collisions now raise the crime alert.

   Exports: NPC_Cars
   ════════════════════════════════════════════════════════════════ */

import { buildTrafficCar } from "../vehicles/traffic.js";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/* mergeGeometries() throws if some geometries are indexed and others are not,
   or if their attribute sets differ. Normalise first. */
function safeMerge(geos) {
  const anyIdx = geos.some(g => g.index), allIdx = geos.every(g => g.index);
  const list = (anyIdx && !allIdx) ? geos.map(g => g.index ? g.toNonIndexed() : g) : geos;
  const keep = ["position", "normal", "uv"];
  list.forEach(g => { for (const n of Object.keys(g.attributes)) if (!keep.includes(n)) g.deleteAttribute(n); });
  list.forEach(g => { if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); if (!g.attributes.normal) g.computeVertexNormals(); });
  return mergeGeometries(list, false);
}
import { pointAtU, getSegs } from "./npc-paths.js";
import { Blood } from "./blood.js";

const CAR_TYPES = [
  { model: "taxi",       mass: 1200 },
  { model: "scrappy",    mass: 800  },
  { model: "mercedes",   mass: 2000 },
  { model: "bmw",        mass: 1800 },
  { model: "gwagon",     mass: 2500 },
  { model: "rangerover", mass: 2500 },
  { model: "cybertruck", mass: 3000 },
  { model: "hilux",      mass: 2200 },
];

const CAR_COLORS = [
  "#1b1f24", "#f2f4f7", "#d8c8a8", "#c0392b", "#1f3a93",
  "#1e8449", "#d4a017", "#37474f", "#c4c9d2", "#b9c3cd",
  "#f2c31a", "#6a6e74",
];

/* Orientation is handled inside vehicles/traffic.js: every car it returns
   has its nose on local +Z, so heading = atan2(dirX, dirZ) with no
   per-model correction. */

const CAR_RADIUS = 2.9;
const LANE = 3.4;

/* Simple loop roads matching the ring around the city center — used
   for traffic instead of pedestrian paths so cars follow roads, not
   market loops. */
const TRAFFIC_PATHS = [
  { closed: true, speed: 1.0, points: [
    [-350, -120], [-200, -160], [-50, -180], [100, -180],
    [230, -140], [330, -60], [350, 80], [300, 200], [180, 260],
    [40, 280], [-100, 260], [-220, 210], [-320, 120],
    [-360, 20], [-350, -120],
  ]},
  { closed: true, speed: 1.0, points: [
    [200, -100], [280, -100], [340, -20], [340, 100],
    [280, 180], [200, 220], [120, 220], [60, 180], [60, 100],
    [100, 20], [160, -40], [200, -100],
  ]},
  { closed: true, speed: 1.0, points: [
    [-280, -220], [-180, -260], [-60, -260], [60, -260],
    [140, -220], [180, -160], [180, -80], [140, -20], [60, 20],
    [-20, 20], [-120, -20], [-200, -80], [-260, -160], [-280, -220],
  ]},
  { closed: true, speed: 1.0, points: [
    [-100, 40], [-50, 20], [10, 0], [70, -10], [120, 20],
    [140, 80], [120, 140], [60, 160], [0, 150], [-60, 130],
    [-100, 90], [-100, 40],
  ]},
];

function buildCarMesh(model, body, rim) {
  return buildTrafficCar(model, body, rim);   /* real models from /vehicles */
}

/* ── module state ─────────────────────────────────────────────── */
let _scene = null;
let _aabbs = [];
let _getPlayerState = () => null;
let _hitPlayer = () => false;
let _hitPlayerCar = () => {};
let _toast = () => {};

export const NPC_Cars = {
  list: [],

  spawn(scene, opts) {
    opts = opts || {};
    _scene = scene;
    _aabbs = opts.aabbs || [];
    _getPlayerState = opts.getPlayerState || (() => null);
    _hitPlayer      = opts.hitPlayer      || (() => false);
    _hitPlayerCar   = opts.hitPlayerCar   || (() => {});
    _toast          = opts.toast          || ((m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} });

    const count = opts.count || 12;
    const paths = TRAFFIC_PATHS;

    let spawned = 0;
    for (let i = 0; i < count * 6 && spawned < count; i++) {
      const path = paths[i % paths.length];
      const dir = (i % 2 === 0) ? 1 : -1;
      if (this._spawnOne(path, dir)) spawned++;
    }

    console.log(
      "%c[npc-cars]",
      "background:#ff9d5c;color:#2a1400;font-weight:bold;padding:2px 6px;border-radius:4px",
      spawned + " AI cars"
    );
  },

  _spawnOne(path, dirSign) {
    const type  = CAR_TYPES[Math.floor(Math.random() * CAR_TYPES.length)];
    const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];

    /* find a u that isn't sitting inside a building */
    /* per-car lane bias so cars on one road never share the exact same ribbon */
    const laneBias = (Math.random() - 0.5) * 1.6;   // ±0.8 m
    const laneOff = dirSign * LANE + laneBias;

    let u = 0, p = null, safe = false;
    for (let attempt = 0; attempt < 6; attempt++) {
      u = Math.random();
      p = pointAtU(path, u);
      const rx = p.tz * laneOff, rz = -p.tx * laneOff;
      const tx = p.x + rx, tz = p.z + rz;
      if (!this._insideAABB(tx, tz, _aabbs, 2.5)) { safe = true; break; }
    }
    if (!safe) return false;

    /* spacing: reject a spot within LANE_GAP metres (along the path) of
       another car on the same path */
    const LANE_GAP = 20;
    const { total: pathLen } = getSegs(path);
    for (const other of this.list) {
      if (other.path !== path) continue;
      const du = Math.abs(other.u - u);
      const along = (path.closed ? Math.min(du, 1 - du) : du) * pathLen;
      if (along < LANE_GAP) return false;
    }

    let mesh;
    try { mesh = buildCarMesh(type.model, color, "#8d9298"); }
    catch (e) { console.warn("[npc-cars] build failed:", type.model, e); return false; }

    /* Merge per-material — cuts ~30 draw calls per car down to ~5. */
    try {
      const byMat = new Map();
      const toRemove = [];
      mesh.updateMatrixWorld(true);
      mesh.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!m) return;
        const key = m.uuid;
        if (!byMat.has(key)) byMat.set(key, { mat: m, geos: [] });
        const g = o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        byMat.get(key).geos.push(g);
        toRemove.push(o);
      });
      for (const o of toRemove) if (o.parent) o.parent.remove(o);
      for (const { mat, geos } of byMat.values()) {
        if (!geos.length) continue;
        const merged = safeMerge(geos);
        geos.forEach((g) => g.dispose());
        if (!merged) continue;
        const mm = new THREE.Mesh(merged, mat);
        mm.frustumCulled = true;
        mm.castShadow = false;
        mm.receiveShadow = false;
        mesh.add(mm);
      }
    } catch (e) {
      console.warn("[npc-cars] merge failed:", type.model, e);
    }

    const rx = p.tz * laneOff, rz = -p.tx * laneOff;

    const wheelLift = 0.02;
    mesh.position.set(p.x + rx, wheelLift, p.z + rz);
    mesh.rotation.y = Math.atan2(p.tx * dirSign, p.tz * dirSign)
;
    mesh.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    _scene.add(mesh);

    this.list.push({
      id: "npccar_" + Math.random().toString(36).slice(2, 7),
      model: type.model,
      mass:  type.mass,
      mesh,
      path, u, dir: dirSign,
      laneOff,
      speed: 8 + Math.random() * 4,
      vx: 0, vz: 0,
      radius: CAR_RADIUS,
      hitCd: 0,
      bob: Math.random() * Math.PI * 2,
    });
    return true;
  },

  _insideAABB(x, z, aabbs, pad) {
    if (!aabbs) return false;
    pad = pad || 0;
    for (const b of aabbs) {
      if (x > b.x - b.hx - pad && x < b.x + b.hx + pad &&
          z > b.z - b.hz - pad && z < b.z + b.hz + pad) return true;
    }
    return false;
  },

  tick(dt) {
    if (!this.list.length) return;
    const player = _getPlayerState();

    /* ── advance every car ─────────────────────────────────── */
    for (const car of this.list) {
      car.hitCd = Math.max(0, car.hitCd - dt);
      car.bob += dt;

      const { total } = getSegs(car.path);
      const du = ((car.speed * dt) / total) * car.dir;

      /* Save previous u so we can roll back if the next spot is dirty */
      const prevU = car.u;
      let nextU = car.u + du;
      if (car.path.closed) {
        if (nextU > 1) nextU -= 1;
        else if (nextU < 0) nextU += 1;
      } else {
        if (nextU >= 1) { nextU = 1; car.dir = -1; }
        else if (nextU <= 0) { nextU = 0; car.dir = 1; }
      }

      const p = pointAtU(car.path, nextU);
      const rx = p.tz * car.laneOff, rz = -p.tx * car.laneOff;
      const targetX = p.x + rx, targetZ = p.z + rz;

      if (this._insideAABB(targetX, targetZ, _aabbs, 1.5)) {
        /* Path itself crosses a building — freeze this frame */
        car.u = prevU;
      } else {
        car.u = nextU;
      }

      const px0 = car.mesh.position.x;
      const pz0 = car.mesh.position.z;
      car.mesh.position.x += (targetX - car.mesh.position.x) * Math.min(1, dt * 6);
      car.mesh.position.z += (targetZ - car.mesh.position.z) * Math.min(1, dt * 6);
      car.vx = (car.mesh.position.x - px0) / Math.max(dt, 0.001);
      car.vz = (car.mesh.position.z - pz0) / Math.max(dt, 0.001);

      const targetYaw = Math.atan2(p.tx * car.dir, p.tz * car.dir)
;
      let dy = targetYaw - car.mesh.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      car.mesh.rotation.y += dy * Math.min(1, dt * 5);

      car.mesh.position.y = Math.sin(car.bob * 8) * 0.015 + 0.02;

      /* ── hit the player ───────────────────────────────────── */
      if (!player || car.hitCd > 0) continue;

      const dx = player.x - car.mesh.position.x;
      const dz = player.z - car.mesh.position.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const speed = Math.hypot(car.vx, car.vz);

      if (player.mode === "walk" && !player.ragdoll &&
          d < car.radius + 0.5 && speed > 3.0) {

        const nx = dx / d, nz = dz / d;
        const impX = car.vx * 0.9 + nx * 4;
        const impZ = car.vz * 0.9 + nz * 4;
        const up    = Math.max(6, Math.min(14, speed * 0.9));
        const spins = Math.max(15, Math.min(25, speed * 2));

        if (_hitPlayer(impX, impZ, up, spins)) {
          Blood.spray(_scene, player.x, 1.0, player.z, {
            count: Math.min(60, 20 + Math.round(speed * 3)),
            spread: 6,
          });
          Blood.splat(_scene, player.x, player.z);

          const C = window.__ph3d_combat;
          const dmg = Math.min(100, 20 + speed * 6);
          try { C && C.damage && C.damage(dmg, "npc-car"); } catch (e) {}
          try { C && C.flash  && C.flash(0.8); } catch (e) {}
          _toast("\uD83D\uDCA5 Hit by " + (car.model === "taxi" ? "taxi" : "car"));
          car.hitCd = 2.5;
        }
      } else if (player.mode === "drive" &&
                 d < car.radius + 2.0 && speed > 4.0) {

        _hitPlayerCar(car.vx, car.vz, car.mass);

        Blood.spray(_scene,
          (player.x + car.mesh.position.x) * 0.5,
          0.8,
          (player.z + car.mesh.position.z) * 0.5,
          { count: 10, spread: 3, color: 0xffcc5e, gravity: -18 }
        );

        /* Crime: player rammed an NPC car */
        try {
          const Cr = window.__ph3d_crime;
          if (Cr && Cr.addEvent && speed > 6) {
            Cr.addEvent("attack", 15, "You");
          }
        } catch (e) {}

        car.hitCd = 2.0;
      }

      /* ── recycle far cars so roads never go empty ─────────── */
      if (player) {
        const dxp = car.mesh.position.x - player.x;
        const dzp = car.mesh.position.z - player.z;
        if (dxp * dxp + dzp * dzp > 400 * 400 && !car._recycleCd) {
          car._recycleCd = true;
          for (let ri = 0; ri < 16; ri++) {
            const u = Math.random();
            const rp = pointAtU(car.path, u);
            const rx = rp.tz * car.laneOff, rz = -rp.tx * car.laneOff;
            const tx = rp.x + rx, tz = rp.z + rz;
            const d = Math.hypot(tx - player.x, tz - player.z);
            if (d > 100 && d < 200) {
              car.u = u;
              car.mesh.position.set(tx, 0.02, tz);
              car.mesh.rotation.y = Math.atan2(rp.tx * car.dir, rp.tz * car.dir)
            ;
              break;
            }
          }
          setTimeout(() => { car._recycleCd = false; }, 1000);
        }
      }
    }

    /* ── car ↔ car bounce ─────────────────────────────────── */
    for (let i = 0; i < this.list.length; i++) {
      for (let j = i + 1; j < this.list.length; j++) {
        const a = this.list[i], b = this.list[j];
        const dx = b.mesh.position.x - a.mesh.position.x;
        const dz = b.mesh.position.z - a.mesh.position.z;
        const d2 = dx * dx + dz * dz;
        const rSum = a.radius + b.radius;
        if (d2 > rSum * rSum) continue;

        const d = Math.sqrt(d2) || 0.001;
        const nx = dx / d, nz = dz / d;
        const overlap = rSum - d;
        const totalMass = a.mass + b.mass;

        a.mesh.position.x -= nx * overlap * (b.mass / totalMass);
        a.mesh.position.z -= nz * overlap * (b.mass / totalMass);
        b.mesh.position.x += nx * overlap * (a.mass / totalMass);
        b.mesh.position.z += nz * overlap * (a.mass / totalMass);

        a.hitCd = Math.max(a.hitCd, 0.6);
        b.hitCd = Math.max(b.hitCd, 0.6);

        Blood.spray(_scene,
          (a.mesh.position.x + b.mesh.position.x) * 0.5,
          0.8,
          (a.mesh.position.z + b.mesh.position.z) * 0.5,
          { count: 8, spread: 3, color: 0xffcc5e, gravity: -18 }
        );
      }
    }
  },

  despawn() {
    for (const car of this.list) {
      if (car.mesh && car.mesh.parent) car.mesh.parent.remove(car.mesh);
      car.mesh.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach(m => m && m.dispose && m.dispose());
        }
      });
    }
    this.list.length = 0;
    _scene = null;
    _aabbs = [];
  },
};

if (typeof window !== "undefined") window.__ph3d_npc_cars = NPC_Cars;
