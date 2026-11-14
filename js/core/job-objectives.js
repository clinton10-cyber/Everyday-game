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
import { Economy } from "./economy.js";

let _scene = null;
let _job = null;
let _markerGroup = null;
let _markerMesh = null;
let _pois = [];
let _roads = [];
let _lastPos = null;   /* last known open-city position, used when a job is accepted from anywhere else */
let _route = [];
let _routeLine = null;
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
    if (p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.z))) return p;
  } catch (e) {}
  return _lastPos || { x: 0, z: 0 };
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

function _clearRoute() {
  if (_routeLine && _routeLine.parent) _routeLine.parent.remove(_routeLine);
  if (_routeLine) { _routeLine.geometry.dispose(); _routeLine.material.dispose(); }
  _routeLine = null; _route = [];
}

function _buildRoadRoute(from, to) {
  _clearRoute();
  if (!_roads.length || !_scene) return;
  const nodes = [], edges = [];
  for (const road of _roads) {
    let prev = -1;
    for (const pt of (road.pts || [])) {
      if (!pt || !Number.isFinite(+pt[0]) || !Number.isFinite(+pt[1])) continue;
      const id = nodes.length; nodes.push({x:+pt[0],z:+pt[1]}); edges[id] = [];
      if (prev >= 0) { const d = _dist(nodes[prev].x,nodes[prev].z,nodes[id].x,nodes[id].z); edges[prev].push([id,d]); edges[id].push([prev,d]); }
      prev = id;
    }
  }
  if (nodes.length < 2) return;
  // Join road intersections/nearby road segments so the route can turn at junctions.
  for (let i=0;i<nodes.length;i++) for (let j=i+2;j<nodes.length;j++) {
    if (edges[i].some(e=>e[0]===j)) continue;
    const d=_dist(nodes[i].x,nodes[i].z,nodes[j].x,nodes[j].z);
    if (d < 9) { edges[i].push([j,d]); edges[j].push([i,d]); }
  }
  const nearest = p => { let bi=0,bd=Infinity; nodes.forEach((n,i)=>{const d=_dist(p.x,p.z,n.x,n.z);if(d<bd){bd=d;bi=i;}}); return bi; };
  const start=nearest(from), goal=nearest(to), dist=Array(nodes.length).fill(Infinity), prev=Array(nodes.length).fill(-1), used=Array(nodes.length).fill(false); dist[start]=0;
  for(let k=0;k<nodes.length;k++){ let u=-1, best=Infinity; for(let i=0;i<nodes.length;i++) if(!used[i]&&dist[i]<best){best=dist[i];u=i;} if(u<0||u===goal)break; used[u]=true; for(const [v,w] of edges[u]) if(dist[u]+w<dist[v]){dist[v]=dist[u]+w;prev[v]=u;} }
  if(start!==goal && prev[goal]===-1) return;
  const ids=[]; for(let n=goal;n!==-1;n=prev[n]){ids.push(n);if(n===start)break;} ids.reverse();
  _route=ids.map(i=>nodes[i]);
  if(_route.length>1){const pts=[new THREE.Vector3(from.x,0.28,from.z),..._route.map(n=>new THREE.Vector3(n.x,0.28,n.z)),new THREE.Vector3(to.x,0.28,to.z)];const geo=new THREE.BufferGeometry().setFromPoints(pts);_routeLine=new THREE.Line(geo,new THREE.LineDashedMaterial({color:0xffd447,dashSize:4,gapSize:2,transparent:true,opacity:.9}));_routeLine.computeLineDistances();_scene.add(_routeLine);}
}

function _destroyMarker() {
  if (_markerGroup && _markerGroup.parent) _markerGroup.parent.remove(_markerGroup);
  if (_markerMesh) {
    _markerMesh.geometry.dispose();
    _markerMesh.material.dispose();
  }
  _markerGroup = null;
  _markerMesh = null;
  _clearRoute();
}

/* ── job factory ───────────────────────────────────────────── */
function _begin(def) {
  /* Jobs can be accepted from anywhere (interiors, parks, campus, other scenes).
     Outside the open city the job is created from the last known city position and its
     marker/route appear as soon as the player is back on the street. */
  if (_job) return { ok: false, reason: "already_active" };

  const me = _scene ? _playerPos() : (_lastPos || { x: 0, z: 0 });
  const from = _pickPoi(me.x, me.z, def.minLeg);
  const to = def.oneStop ? from : _pickPoi(from.x, from.z, 120);
  // A malformed landmark must never turn the job reward/timer into NaN.
  if (![me.x, me.z, from.x, from.z, to.x, to.z].every(v => Number.isFinite(Number(v)))) {
    _job = null;
    return { ok: false, reason: "invalid_destination" };
  }

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
  _buildRoadRoute(me, from);
  let _sl = "";
  try { _sl = Sfx.voiceText("job_start"); } catch (_) {}
  _toast(_scene
    ? (_sl ? "\u201C" + _sl + "\u201D \u00b7 " : "") + def.startToast(from)
    : "Job accepted \u00b7 head out to the street to begin: " + def.startToast(from));
  return { ok: true, jobId: _job.id, deferred: !_scene };
}

export const JobObjectives = {
  init(scene, landmarks, roads) {
    _scene = scene;
    _roads = Array.isArray(roads) ? roads : [];
    _pois = (landmarks || [])
      .filter(l => JOB_PLACE_IDS.has(l.id)
        && Number.isFinite(Number(l.x))
        && Number.isFinite(Number(l.z)))
      .map(l => ({ x: Number(l.x), z: Number(l.z), name: l.name || l.id }));
    /* a job accepted while away from the street (or kept from before) is drawn now */
    if (_job) {
      const t = this.target();
      if (t) { _moveMarker(t.x, t.z); _buildRoadRoute(_playerPos(), t); _toast("Job active \u00b7 " + _job.name + " \u2192 " + t.name); }
    }
  },

  active() { return _job; },

  target() {
    if (!_job) return null;
    return _job.stage === "pickup" || _job.stage === "repair"
      ? { x: _job.fromX, z: _job.fromZ, name: _job.fromName }
      : { x: _job.toX, z: _job.toZ, name: _job.toName };
  },

  guidanceTarget(px, pz) {
    if (!_job) return null;
    if (_route.length) {
      let best=0,bd=Infinity; _route.forEach((p,i)=>{const d=_dist(px,pz,p.x,p.z);if(d<bd){bd=d;best=i;}});
      const next=_route[Math.min(_route.length-1,best+1)];
      if (next && bd > 7) return {x:next.x,z:next.z,name:"Road route"};
    }
    return this.target();
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
    const reward = Math.floor(Number(j.reward));
    if (Number.isFinite(reward) && reward > 0) Economy.receive("JOB", reward, j.name);
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
    if (Number.isFinite(px) && Number.isFinite(pz)) _lastPos = { x: px, z: pz };
    if (!_job) return;
    if (!Number.isFinite(px) || !Number.isFinite(pz)) return;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, 0.25);                         /* a long frame must not eat the timer */
    /* repair job numbers so the phone / HUD can never show NaN */
    if (!Number.isFinite(_job.timer))  _job.timer  = 120;
    if (!Number.isFinite(_job.reward)) _job.reward = 5000;
    if (!Number.isFinite(_job.hold))   _job.hold   = 0;

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
      _buildRoadRoute({x:px,z:pz}, {x:_job.toX,z:_job.toZ});
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
    /* leaving the street no longer throws the job away: it pauses (the timer only runs
       on the street) and resumes when the city scene is built again */
    _destroyMarker();
    _scene = null;
    _roads = [];
    _clearRoute();
  },
};

