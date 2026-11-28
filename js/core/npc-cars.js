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
import { disposeObject3D } from "./disposer.js";
import { CrashFX } from "./crash-fx.js";
import { CarDent } from "./car-dent.js";

const _rnd = (a, b) => a + Math.random() * (b - a);
const _clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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

function laneOffsetFor(edge, bias) { return Math.min(edge.w * 0.28, 5.8) + bias; }

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

    /* Every AI car is a full vehicle model built from scratch, so 36 of them at once is a big part of the
       walk/drive loading freeze. Build a few now and the rest in the background. */
    const count = opts.count || 18;
    const maxTries = count * 8;
    let spawned = 0, tries = 0;
    const batch = (n) => {
      let made = 0;
      while (made < n && spawned < count && tries < maxTries) {
        tries++;
        if (this._spawnOne()) { spawned++; made++; }
      }
    };
    const report = () => console.log(
      "%c[npc-cars]",
      "background:#ff9d5c;color:#2a1400;font-weight:bold;padding:2px 6px;border-radius:4px",
      spawned + " AI cars on " + _edges.length + " roads"
    );
    batch(Math.min(count, 6));
    if (spawned >= count || tries >= maxTries) { report(); return; }
    const token = this._spawnToken = {};
    const pump = () => {
      if (this._spawnToken !== token || _scene !== scene) return;   /* scene was left */
      batch(2);
      if (spawned < count && tries < maxTries) setTimeout(pump, 120); else report();
    };
    setTimeout(pump, 400);
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
      const bias = (Math.random() - 0.5) * 2.0;  /* spread across wider carriageway */
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

    /* real footprint from the model itself (not a fixed guess) */
    let _hw = CAR_HALF_W, _hl = CAR_HALF_L;
    try {
      const _ry = mesh.rotation.y; mesh.rotation.y = 0; mesh.updateMatrixWorld(true);
      const _sz = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
      mesh.rotation.y = _ry;
      if (_sz.x > 0.5 && _sz.z > 1) { _hw = Math.min(_sz.x, _sz.z) * 0.5; _hl = Math.max(_sz.x, _sz.z) * 0.5; }
    } catch (e) {}

    const car = {
      halfW: _hw, halfL: _hl,
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
      colorHex: new THREE.Color(color).getHex(),
      hp: 70 + type.mass / 30, maxHp: 70 + type.mass / 30,     /* heavier cars take more punishment */
      dead: false,
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

  /* top of the tallest collider under (x,z) that the given height clears (a roof to land on), else the ground (0) */
  _surfaceY(x, z, bottomY) {
    let y = 0;
    if (!_aabbs) return y;
    for (const b of _aabbs) {
      if (b.y1 === undefined || b.y1 <= y || b.y1 > bottomY + 0.6) continue;
      if (x > b.x - b.hx && x < b.x + b.hx && z > b.z - b.hz && z < b.z + b.hz) y = b.y1;
    }
    return y;
  },

  /* clearY (optional): colliders whose top is below this height do not count (the thing is flying over them) */
  _insideAABB(x, z, aabbs, pad, clearY) {
    if (!aabbs) return false;
    pad = pad || 0;
    for (const b of aabbs) {
      if (clearY !== undefined && b.y1 !== undefined && b.y1 <= clearY) continue;
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
    for (const car of this.list.slice()) {
      if (car.dead) { this._tickWreck(car, dt); continue; }
      car.hitCd = Math.max(0, car.hitCd - dt);
      car._cc = Math.max(0, (car._cc || 0) - dt);
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
        if (o.dead && !(o.wreck && o.wreck.landed)) continue;      /* a wreck still in the air is no obstacle */
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
      if (car.speed > 3) this._runOverPeds(car);

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
          outsideBox(car.mesh.position.x, car.mesh.position.z, cyaw, car.halfW, car.halfL, player.x, player.z) < 0.25) {

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
          try {
            CrashFX.impact(player.x, 1.0, player.z, { power: _clamp(0.6 + speed / 30, 0.6, 1.2), dust: true });
            CrashFX.hurt(0.8);
            CrashFX.slowmo(0.3, 0.55);
            CrashFX.shake(0.9, 0.7);
          } catch (e) {}
          car.hitCd = 2.5;
        }
      } else if (player.mode === "drive" && speed > 4.0 &&
                 /* closing speed: touching a car that moves the same way you do is not a crash */
                 Math.hypot(car.vx - Math.sin(player.heading || 0) * (player.speed || 0),
                            car.vz - Math.cos(player.heading || 0) * (player.speed || 0)) > 6.0 &&
                 boxesOverlap(car.mesh.position.x, car.mesh.position.z, cyaw, car.halfW, car.halfL,
                              player.x, player.z, player.heading || 0, (player.halfW || 1.0), (player.halfL || 2.4))) {

        const rel = Math.hypot(car.vx - Math.sin(player.heading || 0) * (player.speed || 0),
                               car.vz - Math.cos(player.heading || 0) * (player.speed || 0));
        _hitPlayerCar(car.vx, car.vz, car.mass, rel);

        const cx = (player.x + car.mesh.position.x) * 0.5, cz = (player.z + car.mesh.position.z) * 0.5;
        Blood.spray(_scene, cx, 0.8, cz, { count: 10, spread: 3, color: 0xffcc5e, gravity: -18 });
        /* the crash itself: sparks, glass, smoke, camera shake, hit-stop … and the NPC car is hurt too */
        try {
          const power = _clamp(rel / 26, 0.25, 1.25);
          CrashFX.impact(cx, 0.9, cz, { power, color: car.colorHex, dir: { x: car.vx, z: car.vz } });
          this.hurt(car, rel * 2.6, {
            power,
            dir: { x: car.mesh.position.x - player.x + Math.sin(player.heading || 0) * (player.speed || 0) * 0.4,
                   z: car.mesh.position.z - player.z + Math.cos(player.heading || 0) * (player.speed || 0) * 0.4 },
          });
        } catch (e) { console.warn("[npc-cars] crash fx", e); }

        /* Crime: player rammed an NPC car */
        try {
          const Cr = window.__ph3d_crime;
          if (Cr && Cr.addEvent && speed > 6 && Math.abs(player.speed || 0) > 9 && rel > 12) {   /* only a real ram by the player */
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
        if (a.dead || b.dead) continue;
        const dx = b.mesh.position.x - a.mesh.position.x;
        const dz = b.mesh.position.z - a.mesh.position.z;
        const d2 = dx * dx + dz * dz;
        const rSum = a.radius + b.radius;
        if (d2 > rSum * rSum) continue;
        if (!boxesOverlap(a.mesh.position.x, a.mesh.position.z, a.mesh.rotation.y, a.halfW, a.halfL,
                          b.mesh.position.x, b.mesh.position.z, b.mesh.rotation.y, b.halfW, b.halfL)) continue;

        const d = Math.sqrt(d2) || 0.001;
        const nx = dx / d, nz = dz / d;
        const overlap = Math.min(0.5, Math.max(0.05, rSum - d));
        const totalMass = a.mass + b.mass;
        const closing = Math.abs((b.vx - a.vx) * nx + (b.vz - a.vz) * nz);
        if (closing > 4 && !(a._cc > 0)) {
          a._cc = b._cc = 1.2;
          try {
            CrashFX.impact((a.mesh.position.x + b.mesh.position.x) * 0.5, 0.9, (a.mesh.position.z + b.mesh.position.z) * 0.5, { power: _clamp(closing / 26, 0.2, 0.9), color: a.colorHex, shakeScale: 0.35 });
            this.hurt(a, closing * 2, { power: 0.5, dir: { x: -nx, z: -nz } });
            this.hurt(b, closing * 2, { power: 0.5, dir: { x: nx, z: nz } });
          } catch (e) {}
        }

        a.mesh.position.x -= nx * overlap * (b.mass / totalMass);
        a.mesh.position.z -= nz * overlap * (b.mass / totalMass);
        b.mesh.position.x += nx * overlap * (a.mass / totalMass);
        b.mesh.position.z += nz * overlap * (a.mass / totalMass);
      }
    }
  },

  /* ── Damage, wrecks and explosions ─────────────────────────────── */

  /* dent the body a little more each hit */
  _crumple(car, f, dir) {
    /* the body metal is pressed in at the point the force reached it */
    CarDent.hit(car.mesh, dir || null, f);
  },

  /* returns true if this hit destroyed the car. o: { dir:{x,z}, power } */
  hurt(car, dmg, o) {
    if (!car || car.dead || !(dmg > 0)) return false;
    o = o || {};
    car.hp -= dmg;
    this._crumple(car, dmg / car.maxHp, o.dir);
    if (car.hp <= 0) { this.wreck(car, o); return true; }
    if (dmg > 18 && o.dir) {                                    /* a hard knock slews the car sideways */
      const l = Math.hypot(o.dir.x, o.dir.z) || 1;
      car.mesh.position.x += o.dir.x / l * Math.min(1.6, dmg * 0.03);
      car.mesh.position.z += o.dir.z / l * Math.min(1.6, dmg * 0.03);
      car.mesh.rotation.y += _rnd(-0.4, 0.4);
      car.speed *= 0.4;
    }
    if (car.hp < car.maxHp * 0.55 && !car._smoke) {
      car._smoke = CrashFX.fire(car.mesh.position.x, 1, car.mesh.position.z, { follow: car.mesh, smokeOnly: true, life: 90, scale: 0.7, offsetY: 1.1 });
    }
    return false;
  },

  /* the car blows up: fireball, flying wheels, thrown into the air, then burns */
  wreck(car, o) {
    if (!car || car.dead) return;
    o = o || {};
    car.dead = true; car.speed = 0; car.hitCd = 99;
    const m = car.mesh, p = m.position;
    if (car._smoke) { CrashFX.stopFire(car._smoke); car._smoke = null; }
    const dir = o.dir || { x: car.vx, z: car.vz };
    const dl = Math.hypot(dir.x, dir.z) || 1;
    const pw = o.power == null ? 1 : _clamp(o.power, 0.3, 1.3);
    try { CarDent.crush(m, dir, pw); } catch (e) {}                /* caved-in, crumpled body (before measuring, so the box matches it) */
    const _bx = CrashFX.measureBody(m);                              /* this model's real size, so no part can sink into the road */
    car.wreck = {
      t: 0, landed: false,
      body: CrashFX.makeWreckBody(m, _bx.size, {
        center: _bx.center,
        vx: dir.x / dl * (8 + 14 * pw), vz: dir.z / dl * (8 + 14 * pw), vy: 9 + 9 * pw,
        wx: _rnd(-4, 4) * pw, wy: _rnd(-3, 3), wz: _rnd(-4, 4) * pw, color: car.colorHex,
        onBounce: (bn) => {                                          /* every hard landing dents the body where it touched down */
          try {
            CarDent.dentAt(m, new THREE.Vector3(bn.x, bn.y + 0.2, bn.z), new THREE.Vector3(0, 1, 0), { depth: 0.12 + 0.2 * Math.min(1, bn.vn / 14), radius: 0.8 });
            CrashFX.refreshWreckBody(car.wreck.body);                 /* keep the collision box hugging the dented body */
          } catch (e) {}
        },
      }),
    };
    CrashFX.explosion(p.x, 0.9, p.z, { scale: 1.15, color: car.colorHex, wheels: 2 });
    try { car._restore = CrashFX.charCar(m); } catch (e) {}
    car._fire = CrashFX.fire(p.x, p.y, p.z, { follow: m, life: 16, scale: 1.1, offsetY: 0.8 });
    try { car._lights && car._lights.setNight(0); } catch (e) {}
    /* the blast hurts whatever is next to it: cars smoke, people are thrown */
    try { CrashFX.blast({ x: p.x, y: 0.8, z: p.z }, { radius: 6.5, damage: 95, power: 0.7, source: "wreck", skip: car }); } catch (e) {}
    try {
      const pl = _getPlayerState();
      if (pl && Math.hypot(pl.x - p.x, pl.z - p.z) < 60) _toast("\uD83D\uDCA5 Car exploded!");
    } catch (e) {}
  },

  /* something exploded at pos: hurt and throw every car in range. o: { radius, damage, power, skip } */
  blast(pos, o) {
    o = o || {};
    const R = o.radius || 9;
    for (const car of this.list.slice()) {
      if (car.dead || car === o.skip) continue;
      const dx = car.mesh.position.x - pos.x, dz = car.mesh.position.z - pos.z;
      const dy = car.mesh.position.y + 0.8 - pos.y;
      const d = Math.max(0, Math.hypot(dx, dz, dy) - 1.6);          /* measured from the car's side, not its middle */
      if (d > R) continue;
      const k = 1 - d / R;
      const dmg = (o.damage || 100) * k;
      const died = this.hurt(car, dmg, { dir: { x: dx, z: dz }, power: (o.power || 1) * (0.5 + k) });
      if (!died) {
        car.speed = 0;
        const l = Math.hypot(dx, dz) || 1;
        car.mesh.position.x += dx / l * 1.5 * k; car.mesh.position.z += dz / l * 1.5 * k;
      }
    }
  },

  /* a point (x,y,z) inside a live car? (rockets use this to detonate on contact) */
  hitTest(x, y, z) {
    if (y < 0.05 || y > 2.4) return null;
    for (const car of this.list) {
      if (car.dead) continue;
      if (outsideBox(car.mesh.position.x, car.mesh.position.z, car.mesh.rotation.y, car.halfW, car.halfL, x, z) < 0.15) return car;
    }
    return null;
  },

  _tickWreck(car, dt) {
    const w = car.wreck, m = car.mesh;
    if (!w) return;
    w.t += dt;
    const bd = w.body;
    if (!bd.done) {
      /* a wreck in the air flies OVER buildings and lands anywhere (road, grass, pavement, a rooftop);
         it is only stopped by a wall it is still lower than */
      const bot = bd.c.y - bd.size.y * 0.5;
      const nx = bd.c.x + bd.vx * dt, nz = bd.c.z + bd.vz * dt;
      if (this._insideAABB(nx, nz, _aabbs, 1.2, bot + 0.25)) { bd.vx *= -0.2; bd.vz *= -0.2; }
      const gy = this._surfaceY(bd.c.x, bd.c.z, bot) + 0.02;
      CrashFX.stepWreckBody(bd, dt, gy);
      w.landed = bd.landed;
    }
    /* burnt out: remove it and put a fresh car back on the road */
    if (w.t > 16) {
      const i = this.list.indexOf(car);
      if (i >= 0) this.list.splice(i, 1);
      try { CrashFX.stopFire(car._fire); CrashFX.stopFire(car._smoke); } catch (e) {}
      try { CarDent.release(m); if (m.parent) m.parent.remove(m); disposeObject3D(m); } catch (e) {}
      setTimeout(() => { try { if (_scene) this._spawnOne(); } catch (e) {} }, 600);
    }
  },

  /* a moving car that meets a pedestrian throws them */
  _runOverPeds(car) {
    const list = window.__ph3d_npcsList && window.__ph3d_npcsList();
    const NP = window.__ph3d_NPCs, Col = window.__ph3d_npcCollider;
    if (!list || !NP || !Col) return;
    const cx = car.mesh.position.x, cz = car.mesh.position.z, yaw = car.mesh.rotation.y;
    for (const npc of list) {
      if (!npc.ctl || npc.dead || npc._fly || npc.state === "sitting" || npc.state === "downed" || npc.state === "dying" || npc.hitCd > 0) continue;
      const dx = npc.ctl.pos.x - cx, dz = npc.ctl.pos.z - cz;
      if (dx * dx + dz * dz > 36) continue;
      const hit = Col.hitByCar(npc, { x: cx, z: cz, heading: yaw, halfW: car.halfW || CAR_HALF_W, halfL: car.halfL || CAR_HALF_L, height: 1.5, groundY: 0 });
      if (!hit) continue;
      const sp = Math.hypot(car.vx, car.vz);
      npc.hitCd = 3;
      NP.launch(npc, { vx: car.vx * 0.95 + hit.nx * 3, vy: 4 + sp * 0.35, vz: car.vz * 0.95 + hit.nz * 3 }, { damage: sp > 9 ? 220 : 25 + sp * 4, type: "car" });
      car.speed *= 0.5;
      try {
        CrashFX.impact(npc.ctl.pos.x, 1.0, npc.ctl.pos.z, { power: _clamp(sp / 24, 0.3, 0.9), dust: true });
        const pl = _getPlayerState();
      } catch (e) {}
    }
  },

  despawn() {
    this._spawnToken = null;          /* stops any still-queued car building */
    for (const car of this.list) {
      if (car.mesh && car.mesh.parent) car.mesh.parent.remove(car.mesh);
      /* frees geometry, materials AND their canvas textures (the plates/lights textures leaked before) */
      try { disposeObject3D(car.mesh); } catch (e) {}
    }
    this.list.length = 0;
    _scene = null;
    _aabbs = [];
    _edges = []; _nodes = new Map();
  },
};

if (typeof window !== "undefined") window.__ph3d_npc_cars = NPC_Cars;
