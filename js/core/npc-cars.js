/* ════════════════════════════════════════════════════════════════
   npc-cars.js — path-following AI traffic.

   Fixes in this version:
   • Only real models from /vehicles (via vehicles/traffic.js), nose-first.
   • _aabbs guard: never spawn and never advance into a building.
   • Cars drive on the REAL road network (opts.roads from phworld.js), keep
     right, and pick a road at each junction — no hardcoded loops.
   • Player-car-vs-NPC-car collisions now raise the crime alert.

   Exports: NPC_Cars
   ════════════════════════════════════════════════════════════════ */

import { buildTrafficCar } from "../vehicles/traffic.js";
import * as THREE from "three";
import { addCarLights } from "./car-lights.js";
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
const CAR_HALF_W = 1.05, CAR_HALF_L = 2.6;      /* real footprint of an NPC car (used for hit tests) */

/* distance outside a car's rectangle (0 = touching / inside). yaw: car forward = (sin, cos). */
function outsideBox(cx, cz, yaw, hw, hl, px, pz) {
  const dx = px - cx, dz = pz - cz, s = Math.sin(yaw), c = Math.cos(yaw);
  const lx = Math.abs(dx * c - dz * s) - hw, lz = Math.abs(dx * s + dz * c) - hl;
  return Math.hypot(Math.max(lx, 0), Math.max(lz, 0));
}
/* two car rectangles overlapping (separating-axis test) */
function boxesOverlap(ax, az, ay, ahw, ahl, bx, bz, by, bhw, bhl) {
  const axes = [[Math.cos(ay), -Math.sin(ay)], [Math.sin(ay), Math.cos(ay)], [Math.cos(by), -Math.sin(by)], [Math.sin(by), Math.cos(by)]];
  const dx = bx - ax, dz = bz - az;
  for (const [ux, uz] of axes) {
    const ra = ahw * Math.abs(ux * Math.cos(ay) - uz * Math.sin(ay)) + ahl * Math.abs(ux * Math.sin(ay) + uz * Math.cos(ay));
    const rb = bhw * Math.abs(ux * Math.cos(by) - uz * Math.sin(by)) + bhl * Math.abs(ux * Math.sin(by) + uz * Math.cos(by));
    if (Math.abs(dx * ux + dz * uz) > ra + rb) return false;
  }
  return true;
}

/* ── road graph ────────────────────────────────────────────────────
   Built from the REAL road centre-lines that phworld.js draws (passed in
   as opts.roads), so cars can only ever drive where there is asphalt.
   Each road is an edge between two junction nodes; at a junction a car
   picks one of the other roads that meets there. Cars keep to the RIGHT
   lane of whichever road they are on (Nigerian right-hand traffic). */
let _edges = [];
let _nodes = new Map();

function nodeKey(p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }

function buildGraph(roads) {
  _edges = []; _nodes = new Map();
  for (const r of (roads || [])) {
    const pts = r.pts;
    if (!pts || pts.length < 2) continue;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    const len = cum[cum.length - 1];
    if (len < 8) continue;
    const e = { pts, cum, len, w: r.w || 9, ka: nodeKey(pts[0]), kb: nodeKey(pts[pts.length - 1]) };
    e.id = _edges.length;
    _edges.push(e);
    for (const [k, end] of [[e.ka, 0], [e.kb, 1]]) {
      if (!_nodes.has(k)) _nodes.set(k, []);
      _nodes.get(k).push({ edge: e, end });
    }
  }
}

/* centre-line point + unit tangent at distance s (0..len) along edge.pts order */
const _pt = { x: 0, z: 0, tx: 0, tz: 1 };
function edgePoint(e, s) {
  if (s < 0) s = 0; else if (s > e.len) s = e.len;
  const cum = e.cum;
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const a = e.pts[lo], b = e.pts[hi];
  const sl = cum[hi] - cum[lo] || 1;
  const f = (s - cum[lo]) / sl;
  _pt.x = a[0] + (b[0] - a[0]) * f;
  _pt.z = a[1] + (b[1] - a[1]) * f;
  const dx = b[0] - a[0], dz = b[1] - a[1], dl = Math.hypot(dx, dz) || 1;
  _pt.tx = dx / dl; _pt.tz = dz / dl;
  return _pt;
}

/* world position + heading of a car on its edge, in its own right-hand lane.
   car.s is distance travelled from the car's start end of the edge. */
const _out = { x: 0, z: 0, tx: 0, tz: 1 };
function carPose(car, lat) {
  const e = car.edge;
  const s = car.fwd ? car.s : e.len - car.s;
  const p = edgePoint(e, s);
  const sg = car.fwd ? 1 : -1;
  const tx = p.tx * sg, tz = p.tz * sg;          /* direction of travel */
  /* right-hand side of travel direction (three.js, +Z nose, +Y up) = (-tz, tx) */
  _out.x = p.x - tz * lat;
  _out.z = p.z + tx * lat;
  _out.tx = tx; _out.tz = tz;
  return _out;
}

function laneOffsetFor(edge, bias) { return Math.min(edge.w * 0.25, 3.6) + bias; }

/* pick the road a car continues onto at the end of its current one */
function chooseNext(car) {
  const key = car.fwd ? car.edge.kb : car.edge.ka;
  const opts = (_nodes.get(key) || []).filter(o => o.edge !== car.edge);
  if (!opts.length) {                      /* dead end → turn around */
    car.fwd = !car.fwd; car.s = 0;
    return;
  }
  /* prefer roads that keep roughly straight, but allow turns */
  const cur = carPose(car, 0);
  const ctx = cur.tx, ctz = cur.tz;
  let total = 0;
  const weighted = opts.map(o => {
    const pa = o.edge.pts[o.end === 0 ? 0 : o.edge.pts.length - 1];
    const pb = o.edge.pts[o.end === 0 ? 1 : o.edge.pts.length - 2];
    let dx = pb[0] - pa[0], dz = pb[1] - pa[1]; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    const dot = dx * ctx + dz * ctz;
    const w = dot < -0.8 ? 0.15 : 0.6 + Math.max(0, dot) * 1.4;   /* U-turns rare */
    total += w;
    return { o, w };
  });
  let r = Math.random() * total, pick = weighted[0];
  for (const w of weighted) { r -= w.w; if (r <= 0) { pick = w; break; } }
  car.edge = pick.o.edge;
  car.fwd = pick.o.end === 0;
  car.s = 0;
  car.lane = laneOffsetFor(car.edge, car.laneBias);
}

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

    buildGraph(opts.roads);
    if (!_edges.length) {
      console.warn("[npc-cars] no road data supplied — no AI cars spawned");
      return;
    }

    const count = opts.count || 12;
    let spawned = 0;
    for (let i = 0; i < count * 8 && spawned < count; i++) {
      if (this._spawnOne()) spawned++;
    }

    console.log(
      "%c[npc-cars]",
      "background:#ff9d5c;color:#2a1400;font-weight:bold;padding:2px 6px;border-radius:4px",
      spawned + " AI cars on " + _edges.length + " roads"
    );
  },

  /* weighted random edge: longer roads get more cars */
  _randomEdge() {
    let total = 0;
    for (const e of _edges) total += e.len;
    let r = Math.random() * total;
    for (const e of _edges) { r -= e.len; if (r <= 0) return e; }
    return _edges[_edges.length - 1];
  },

  /* place a car on a random road at a spot that is clear of buildings
     and other cars. Returns { edge, fwd, s } or null. */
  _findSlot(minGap, nearPlayer) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const edge = this._randomEdge();
      const fwd = Math.random() < 0.5;
      const s = 6 + Math.random() * Math.max(1, edge.len - 12);
      const bias = (Math.random() - 0.5) * 0.7;
      const car = { edge, fwd, s };
      const p = carPose(car, laneOffsetFor(edge, bias));
      if (this._insideAABB(p.x, p.z, _aabbs, 2.0)) continue;
      let ok = true;
      for (const o of this.list) {
        const dx = o.mesh.position.x - p.x, dz = o.mesh.position.z - p.z;
        if (dx * dx + dz * dz < minGap * minGap) { ok = false; break; }
      }
      if (!ok) continue;
      if (nearPlayer) {
        const d = Math.hypot(p.x - nearPlayer.x, p.z - nearPlayer.z);
        if (d < 100 || d > 220) continue;
      }
      return { edge, fwd, s, bias };
    }
    return null;
  },

  _spawnOne() {
    const type  = CAR_TYPES[Math.floor(Math.random() * CAR_TYPES.length)];
    const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];

    const slot = this._findSlot(22, null);
    if (!slot) return false;

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

    const car = {
      id: "npccar_" + Math.random().toString(36).slice(2, 7),
      model: type.model,
      mass:  type.mass,
      mesh,
      edge: slot.edge, fwd: slot.fwd, s: slot.s,
      laneBias: slot.bias,
      lane: laneOffsetFor(slot.edge, slot.bias),
      baseSpeed: 8 + Math.random() * 4,
      speed: 0,
      vx: 0, vz: 0,
      radius: CAR_RADIUS,
      hitCd: 0,
      blocked: 0,
      bob: Math.random() * Math.PI * 2,
    };
    this._place(car);
    mesh.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    _scene.add(mesh);
    try { car._lights = addCarLights(mesh); } catch (e) { car._lights = null; }
    this.list.push(car);
    return true;
  },

  /* snap a car straight onto its road position + heading */
  _place(car) {
    const p = carPose(car, car.lane);
    car.mesh.position.set(p.x, 0.02, p.z);
    car.mesh.rotation.y = Math.atan2(p.tx, p.tz);
    car.speed = car.baseSpeed;
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
    dt = Math.min(dt, 0.1);
    const player = _getPlayerState();

    /* ── advance every car along its road ──────────────────── */
    for (const car of this.list) {
      car.hitCd = Math.max(0, car.hitCd - dt);
      car.bob += dt;
      try {
        const night = (window.__ph3d_daynight && window.__ph3d_daynight.nightAmount) ? window.__ph3d_daynight.nightAmount() : 0;
        car._lights && car._lights.setNight(night);
      } catch (e) {}

      /* target speed: slow into junctions, keep distance to the car ahead */
      let target = car.baseSpeed;
      const toEnd = car.edge.len - car.s;
      if (toEnd < 14) target *= 0.55 + 0.45 * (toEnd / 14);
      if (car.s < 8) target = Math.min(target, car.baseSpeed * (0.6 + 0.05 * car.s));

      const cur = carPose(car, car.lane);
      const fx = cur.tx, fz = cur.tz;
      for (const o of this.list) {
        if (o === car) continue;
        const dx = o.mesh.position.x - car.mesh.position.x;
        const dz = o.mesh.position.z - car.mesh.position.z;
        const ahead = dx * fx + dz * fz;
        if (ahead <= 0 || ahead > 16) continue;
        const side = Math.abs(dx * fz - dz * fx);
        if (side > 2.6) continue;
        const gap = Math.max(0, ahead - CAR_RADIUS * 1.6);
        target = Math.min(target, Math.max(0, o.speed * 0.9 + gap * 0.8));
      }

      /* stop for the player's car / walker directly ahead on the road */
      if (player) {
        const dx = player.x - car.mesh.position.x, dz = player.z - car.mesh.position.z;
        const ahead = dx * fx + dz * fz;
        if (ahead > 0 && ahead < 14 && Math.abs(dx * fz - dz * fx) < 2.4) {
          target = Math.min(target, Math.max(0, (ahead - 5) * 0.9));
        }
      }

      const accel = target > car.speed ? 5 : 12;
      car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), accel * dt);

      /* building in the way of the next few metres? wait; if stuck, relocate */
      const probe = carPose({ edge: car.edge, fwd: car.fwd, s: Math.min(car.edge.len, car.s + 4) }, car.lane);
      if (this._insideAABB(probe.x, probe.z, _aabbs, 1.2)) {
        car.blocked += dt;
        car.speed = 0;
        if (car.blocked > 4) {
          const slot = this._findSlot(15, player);
          if (slot) { car.edge = slot.edge; car.fwd = slot.fwd; car.s = slot.s; car.laneBias = slot.bias; car.lane = laneOffsetFor(slot.edge, slot.bias); this._place(car); }
          car.blocked = 0;
        }
      } else {
        car.blocked = 0;
        car.s += car.speed * dt;
        if (car.s >= car.edge.len) {
          const over = car.s - car.edge.len;
          chooseNext(car);
          car.s = Math.min(over, car.edge.len);
        }
      }

      /* ease the lane offset toward the new road's lane */
      const wantLane = laneOffsetFor(car.edge, car.laneBias);
      car.lane += (wantLane - car.lane) * Math.min(1, dt * 2);

      const p = carPose(car, car.lane);
      const px0 = car.mesh.position.x;
      const pz0 = car.mesh.position.z;
      /* glide onto the lane point, but never faster than a car can really
         move sideways — turns at junctions become smooth arcs, not snaps */
      let ex = p.x - px0, ez = p.z - pz0;
      const el = Math.hypot(ex, ez);
      const maxMove = (car.speed * 1.5 + 2.5) * dt;
      const want = Math.min(el, Math.max(el * Math.min(1, dt * 8), 0));
      const mv = Math.min(maxMove, want > 0 ? Math.max(want, Math.min(el, car.speed * dt * 1.2)) : 0);
      if (el > 1e-6) {
        car.mesh.position.x += ex / el * mv;
        car.mesh.position.z += ez / el * mv;
      }
      car.vx = (car.mesh.position.x - px0) / Math.max(dt, 0.001);
      car.vz = (car.mesh.position.z - pz0) / Math.max(dt, 0.001);

      /* face the way the car is really travelling (road tangent when slow) */
      const vmag = Math.hypot(car.vx, car.vz);
      const targetYaw = vmag > 2.0 ? Math.atan2(car.vx, car.vz) : Math.atan2(p.tx, p.tz);
      let dy = targetYaw - car.mesh.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      car.mesh.rotation.y += dy * Math.min(1, dt * 7);

      car.mesh.position.y = Math.sin(car.bob * 8) * 0.015 + 0.02;

      /* ── recycle far cars so roads never go empty ─────────── */
      if (player && !car._recycleCd) {
        const dxp = car.mesh.position.x - player.x;
        const dzp = car.mesh.position.z - player.z;
        if (dxp * dxp + dzp * dzp > 400 * 400) {
          car._recycleCd = true;
          const slot = this._findSlot(15, player);
          if (slot) {
            car.edge = slot.edge; car.fwd = slot.fwd; car.s = slot.s;
            car.laneBias = slot.bias; car.lane = laneOffsetFor(slot.edge, slot.bias);
            this._place(car);
          }
          setTimeout(() => { car._recycleCd = false; }, 1000);
        }
      }

      /* ── hit the player ───────────────────────────────────── */
      if (!player || car.hitCd > 0) continue;

      const dx = player.x - car.mesh.position.x;
      const dz = player.z - car.mesh.position.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const speed = Math.hypot(car.vx, car.vz);

      const cyaw = car.mesh.rotation.y;
      if (player.mode === "walk" && !player.ragdoll && speed > 3.0 &&
          outsideBox(car.mesh.position.x, car.mesh.position.z, cyaw, CAR_HALF_W, CAR_HALF_L, player.x, player.z) < 0.25) {

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
      } else if (player.mode === "drive" && speed > 4.0 &&
                 boxesOverlap(car.mesh.position.x, car.mesh.position.z, cyaw, CAR_HALF_W, CAR_HALF_L,
                              player.x, player.z, player.heading || 0, (player.halfW || 1.0), (player.halfL || 2.4))) {

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
    }

    /* ── car ↔ car bounce (only on real overlap — following logic keeps
          cars apart, this is the safety net at junctions) ─────────── */
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
    _edges = []; _nodes = new Map();
  },
};

if (typeof window !== "undefined") window.__ph3d_npc_cars = NPC_Cars;
