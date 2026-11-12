/* ════════════════════════════════════════════════════════════════
   job-objectives.js — active jobs with pickup → drop-off.

   API:
     JobObjectives.init(scene, landmarks)   landmarks: [{id,name,x,z}]
     JobObjectives.startDelivery() / startTaxi() / startMechanic()
         → { ok, jobId } or { ok:false, reason }
     JobObjectives.tick(dt, px, pz, mode)   mode: "walk" | "drive"
     JobObjectives.active()                 → job | null
     JobObjectives.target()                 → { x, z, name } | null
     JobObjectives.cancel()
     JobObjectives.despawn()

   Delivery  — on foot or in a car.
   Taxi      — must be in a car to pick up and drop off.
   Mechanic  — drive there, then stay nearby while the repair bar fills.
   Reward and time limit scale with the distance of the trip.
   ════════════════════════════════════════════════════════════════ */

import * as THREE from "three";
import { Rep } from "./rep.js";
import { Sfx } from "./sfx.js";

let _scene = null;
let _job = null;
let _markerGroup = null;
let _markerMesh = null;
let _pois = [];
const _toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} };

/* Landmarks that make sense as a job address */
const JOB_PLACE_IDS = new Set([
  "market", "airport", "hotel", "boropark", "showroom", "pleasurepark",
  "university", "jobcenter", "realestate", "hospital", "church", "mosque",
  "zoo", "citypark", "myhouse",
]);

const FALLBACK_POIS = [
  { x: 215, z: 100,  name: "Mile 1 Market" },
  { x: 150, z: 220,  name: "Job Center" },
  { x: -115, z: -155, name: "Hotel Presidential" },
  { x: 400, z: 90,   name: "Omagwa Airport" },
  { x: 60, z: -215,  name: "City Zoo" },
  { x: -230, z: -10, name: "University of P.H." },
  { x: 250, z: 165,  name: "Real Estate Office" },
  { x: -190, z: 130, name: "City Hospital" },
];

const ARRIVE_R = 14;      // metres
const REPAIR_SECS = 4;

function _playerPos() {
  try {
    const p = window.__ph3d_drive && window.__ph3d_drive.getPos();
    if (p) return p;
  } catch (e) {}
  return { x: 0, z: 0 };
}

/* Pick a POI at least minDist from (x,z), as far as the map allows */
function _pickPoi(x, z, minDist) {
  const pool = _pois.length ? _pois : FALLBACK_POIS;
  const ok = pool.filter(p => {
    const dx = p.x - x, dz = p.z - z;
    return dx * dx + dz * dz >= minDist * minDist;
  });
  const src = ok.length ? ok : pool;
  return src[Math.floor(Math.random() * src.length)];
}

function _dist(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

/* ── marker beam ───────────────────────────────────────────── */
function _ensureMarker() {
  if (_markerGroup || !_scene) return;
  _markerGroup = new THREE.Group();
  _markerMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 2.2, 28, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffcc2b, transparent: true, opacity: 0.85,
      depthWrite: false, side: THREE.DoubleSide,
    })
  );
  _markerMesh.position.y = 14;
  _markerGroup.add(_markerMesh);
  _scene.add(_markerGroup);
}

function _moveMarker(x, z) {
  _ensureMarker();
  if (_markerGroup) _markerGroup.position.set(x, 0, z);
}

function _destroyMarker() {
  if (_markerGroup && _markerGroup.parent) _markerGroup.parent.remove(_markerGroup);
  if (_markerMesh) {
    _markerMesh.geometry.dispose();
    _markerMesh.material.dispose();
  }
  _markerGroup = null;
  _markerMesh = null;
}

/* ── job factory ───────────────────────────────────────────── */
function _begin(def) {
  if (!_scene) return { ok: false, reason: "not_in_world" };
  if (_job) return { ok: false, reason: "already_active" };

  const me = _playerPos();
  const from = _pickPoi(me.x, me.z, def.minLeg);
  const to = def.oneStop ? from : _pickPoi(from.x, from.z, 120);

  const approach = _dist(me.x, me.z, from.x, from.z);
  const trip = def.oneStop ? 0 : _dist(from.x, from.z, to.x, to.z);
  const total = approach + trip;

  _job = {
    id: def.type + ":" + Math.random().toString(36).slice(2, 7),
    type: def.type,
    name: def.name,
    stage: def.firstStage,
    fromX: from.x, fromZ: from.z, fromName: from.name,
    toX: to.x, toZ: to.z, toName: to.name,
    timer: Math.min(360, Math.max(100, 45 + total / def.speed)),
    reward: Math.round((def.base + trip * def.perM + approach * 10) / 500) * 500,
    repGain: def.repGain,
    needsCar: !!def.needsCar,
    hold: 0,
  };
  _moveMarker(from.x, from.z);
  let _sl = "";
  try { _sl = Sfx.voiceText("job_start"); } catch (_) {}
  _toast((_sl ? "\u201C" + _sl + "\u201D \u00b7 " : "") + def.startToast(from));
  return { ok: true, jobId: _job.id };
}

export const JobObjectives = {
  init(scene, landmarks) {
    _scene = scene;
    _pois = (landmarks || [])
      .filter(l => JOB_PLACE_IDS.has(l.id))
      .map(l => ({ x: l.x, z: l.z, name: l.name }));
  },

  active() { return _job; },

  target() {
    if (!_job) return null;
    return _job.stage === "pickup" || _job.stage === "repair"
      ? { x: _job.fromX, z: _job.fromZ, name: _job.fromName }
      : { x: _job.toX, z: _job.toZ, name: _job.toName };
  },

  startDelivery() {
    return _begin({
      type: "delivery", name: "Delivery", firstStage: "pickup",
      minLeg: 40, speed: 6, base: 4000, perM: 25, repGain: 5,
      startToast: (p) => "Pick up the parcel at " + p.name,
    });
  },

  startTaxi() {
    return _begin({
      type: "taxi", name: "Taxi", firstStage: "pickup", needsCar: true,
      minLeg: 40, speed: 8, base: 6000, perM: 35, repGain: 8,
      startToast: (p) => "Passenger waiting at " + p.name + " (drive there)",
    });
  },

  startMechanic() {
    return _begin({
      type: "mechanic", name: "Repair", firstStage: "repair", oneStop: true,
      minLeg: 60, speed: 6, base: 9000, perM: 0, repGain: 12,
      startToast: (p) => "Broken-down vehicle at " + p.name,
    });
  },

  cancel() {
    if (!_job) return;
    _toast("Job cancelled");
    _job = null;
    _destroyMarker();
  },

  _complete() {
    if (!_job) return;
    const j = _job;
    try {
      const E = window.__ph3d_economy;
      if (E && E.receive) E.receive("JOB", j.reward, j.name);
    } catch (e) {}
    Rep.add(j.repGain);
    try { window.dispatchEvent(new CustomEvent("ph3d:job-complete", { detail: { type: j.type, name: j.name, reward: j.reward, repGain: j.repGain } })); } catch (_) {}
    let _dl = "";
    try { _dl = Sfx.voiceText("job_done"); } catch (_) {}
    _toast("" + (_dl ? "\u201C" + _dl + "\u201D \u00b7 " : "") + j.name + " done · ₦" + j.reward.toLocaleString() + " · rep +" + j.repGain);
    _job = null;
    _destroyMarker();
  },

  _fail(reason) {
    if (!_job) return;
    _toast(_job.name + " failed · " + reason);
    _job = null;
    _destroyMarker();
  },

  tick(dt, px, pz, mode) {
    if (!_job) return;

    _job.timer -= dt;
    if (_job.timer <= 0) { this._fail("out of time"); return; }

    if (_markerMesh) {
      _markerMesh.material.opacity = 0.6 + 0.25 * Math.sin(performance.now() * 0.005);
      _markerMesh.rotation.y += dt * 0.8;
    }

    const t = this.target();
    const near = _dist(px, pz, t.x, t.z) < ARRIVE_R;
    const inCar = mode === "drive";

    if (!near) return;
    if (_job.needsCar && !inCar) return;      // taxi: must arrive by car

    if (_job.stage === "pickup") {
      _job.stage = "dropoff";
      _moveMarker(_job.toX, _job.toZ);
      _toast(_job.type === "taxi"
        ? "Passenger on board · to " + _job.toName
        : "Parcel collected · deliver to " + _job.toName);
    } else if (_job.stage === "dropoff") {
      this._complete();
    } else if (_job.stage === "repair") {
      _job.hold += dt;
      if (_job.hold >= REPAIR_SECS) this._complete();
    }
  },

  despawn() {
    _job = null;
    _destroyMarker();
    _scene = null;
    _pois = [];
  },
};

