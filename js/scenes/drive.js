/* drive.js -- Port Harcourt future-city open world.
   v12 — adds NPCs (path-following pedestrians), NPC cars (real
   physics + blood), blood particle system, and ragdoll-impulse
   helpers. Everything else is unchanged from v11. */

import { Weather } from "../core/weather.js";
import * as THREE from "three";
import { State } from "../core/state.js";
import { Quality } from "../core/quality.js";
import { Sfx } from "../core/sfx.js";
import { buildGWagon3D } from "../vehicles/gwagon3d.js";
import { buildCybertruck3D } from "../vehicles/cybertruck3d.js";
import { buildRangeRover3D } from "../vehicles/rangerover_compound.js";
import { buildMercedes3D } from "../vehicles/mercedes3d.js";
import { buildBMW3D } from "../vehicles/bmw3d.js";
import { buildChiron3D } from "../vehicles/chiron3d.js";
import { buildVehicle as buildVehicleSimple } from "../vehicles/models.js";
import { buildScrappy3D } from "../vehicles/scrappy3d.js";
import { buildCharacter, HIP_HEIGHT, attachPhone, liveApplyConfig } from "../characters/lowpoly.js";
import { Wardrobe } from "../core/wardrobe.js";
import { Combat } from "../core/combat.js";
import { Weapons } from "../core/guns.js";
import { createJetpack } from "../core/jetpack.js";
import * as Animator from "../characters/animator.js";
import { Limp } from "../characters/limp.js";
import { LocationMarkers } from "../core/location-markers.js";
import { WorldObjects } from "../core/world-objects.js";
import { buildPHWorld } from "../world/phworld.js";
import { addNightGlow } from "../core/night-glow.js";
import { NPCs } from "../core/npcs.js";
import { Pursuit } from "../core/pursuit.js";
import { NPC_Cars } from "../core/npc-cars.js";
import { ArrestWatch } from "../core/arrest-watch.js";
import { Economy } from "../core/economy.js";
import { Blood } from "../core/blood.js";
import { Social } from "../core/npc-social.js";
import { WorldEvents } from "../core/world-events.js";
import { JobObjectives } from "../core/job-objectives.js";
import { ObjectiveHUD } from "../ui/objective-hud.js";
import { WalkActions } from "../core/walk-actions.js";
import { askAndRoute } from "../core/landmark-routing.js";
import { Kidnap } from "../core/kidnap.js";

/* ================================================================
   CONSTANTS
   ================================================================ */
const CAR_SURFACES = {
  gwagon:     { hood: 0.575, trunk: 0.575, roof: 1.00 },
  cybertruck: { hood: 0.560, trunk: 0.820, roof: 1.00 },
  rangerover: { hood: 0.750, trunk: 0.750, roof: 1.00 },
  mercedes:   { hood: 0.650, trunk: 0.650, roof: 1.00 },
  bmw:        { hood: 0.667, trunk: 0.667, roof: 1.00 },
  chiron:     { hood: 0.640, trunk: 0.640, roof: 1.00 },
  hilux:      { hood: 0.690, trunk: 0.490, roof: 1.00 },
  taxi:       { hood: 0.570, trunk: 0.570, roof: 1.00 },
  scrappy:    { hood: 0.585, trunk: 0.585, roof: 1.00 },
  hoverboard: { hood: 0.600, trunk: 0.600, roof: 1.00 },
  nk250:      { hood: 0.600, trunk: 0.600, roof: 1.00 },
  default:    { hood: 0.600, trunk: 0.600, roof: 1.00 },
};

const STAND_ON_MIN_ROOF = 1.35;
const RAGDOLL_GRAVITY   = 22;
const RAGDOLL_DURATION  = 2.2;
const RAGDOLL_GROUND_Y  = 0;

const WORLD_HALF = 2000;
const WORLD_OCEAN_EDGE = 1800;
const GRID_RADIUS = 3, BLOCK_SIZE = 50, ROAD_W = 14;

const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

/* ================================================================
   TERRAIN (flat city plain; sea beyond the edge)
   ================================================================ */
function getTerrainHeight(x, z) {
  const maxDist = Math.max(Math.abs(x), Math.abs(z));
  if (maxDist > WORLD_OCEAN_EDGE) return -80;
  return 0;
}

function sampleTerrainMeshHeight(wx, wz) {
  return getTerrainHeight(wx, wz);
}

/* ================================================================
   SHARED REFERENCE WORLD
   ================================================================ */
function buildCity() {
  const { baseGeometry, detailGeometry, baseChunks, detailChunks, colliders, landmarks, roads, lampSpots, poles } = buildPHWorld();

  const aabbs = [];
  for (const c of colliders) {
    if (c.circle) {
      aabbs.push({ x: c.x, z: c.z, hx: c.r, hz: c.r, label: "circle", y1: c.h });
    } else {
      const cos = Math.abs(c.cos), sin = Math.abs(c.sin);
      const hx = c.hw * cos + c.hd * sin;
      const hz = c.hw * sin + c.hd * cos;
      aabbs.push({ x: c.x, z: c.z, hx, hz, label: "box", y1: c.h });
    }
  }

  const compounds = landmarks.map((lm) => ({
    lm: {
      id: lm.id,
      name: lm.name,
      sub: "",
      kind: (lm.id === "university" || lm.id === "pleasurepark") ? "parent" : "place",
    },
    x: lm.x, z: lm.z, ry: 0,
  }));

  return {
    RING_R: 450, RING_RZ: 400, ROAD_W: 14, SW: 4,
    baseGeometry,
    detailGeometry,
    baseChunks,
    detailChunks,
    lampSpots,
    poles,
    aabbs,
    roads,
    platforms: [],
    compounds,
  };
}

/* ================================================================
   AABB RESOLVER
   ================================================================ */
function resolveAABBs(x, z, radius, aabbs, walkerY) {
  if (walkerY === undefined) walkerY = -Infinity;
  for (let iter = 0; iter < 2; iter++) {
    for (let i = 0; i < aabbs.length; i++) {
      const b = aabbs[i];
      if (b.y1 !== undefined && walkerY >= b.y1 - 0.05) continue;
      const dx = x - b.x; const dz = z - b.z;
      if (dx * dx + dz * dz > (b.hx + radius + 5) * (b.hx + radius + 5)) continue;
      const cx = x < b.x - b.hx ? b.x - b.hx : (x > b.x + b.hx ? b.x + b.hx : x);
      const cz = z < b.z - b.hz ? b.z - b.hz : (z > b.z + b.hz ? b.z + b.hz : z);
      const ddx = x - cx, ddz = z - cz, d2 = ddx * ddx + ddz * ddz;
      if (d2 < radius * radius) {
        if (d2 > 1e-7) {
          const d = Math.sqrt(d2); const k = (radius - d) / d;
          x += ddx * k; z += ddz * k;
        } else {
          const dl = x - (b.x - b.hx); const dr = (b.x + b.hx) - x;
          const db = z - (b.z - b.hz); const dt = (b.z + b.hz) - z;
          const m = Math.min(dl, dr, db, dt);
          if (m === dl) x = b.x - b.hx - radius;
          else if (m === dr) x = b.x + b.hx + radius;
          else if (m === db) z = b.z - b.hz - radius;
          else z = b.z + b.hz + radius;
        }
      }
    }
  }
  return [x, z];
}

/* ================================================================
   MAIN SCENE ENTRY
   ================================================================ */
export async function driveScene(params, router) {
  try { return await _driveInner(params, router); }
  catch (e) {
    console.error("[drive] FATAL:", e && e.stack ? e.stack : e);
    throw e;
  }
}

async function _driveInner(params, router) {
  const TIER = (Quality.current && Quality.current.tier) || "medium";
  const LOW = TIER === "low";

  const SKY = 0xa6c8e6;
  const three = new THREE.Scene();
  three.background = new THREE.Color(SKY);
  three.fog = new THREE.Fog(SKY, LOW ? 260 : 550, LOW ? 900 : 1600);

  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 1.2, 1600);

  /* Lights */
  const ambL = new THREE.AmbientLight(0xffffff, 0.18);
  three.add(ambL);
  const hemiL = new THREE.HemisphereLight(0xbfe0ff, 0x4a6b38, 0.55);
  three.add(hemiL);
  const _skyMats = [];
  const sun = new THREE.DirectionalLight(0xfff2d6, LOW ? 1.4 : 2.4);
  sun.position.set(120, 180, 90);
  sun.castShadow = false;   // shadows off globally — saves ~30% per frame
  if (!LOW) {
    sun.shadow.mapSize.set(1024, 1024);
    const S = 110;
    sun.shadow.camera.left   = -S;
    sun.shadow.camera.right  =  S;
    sun.shadow.camera.top    =  S;
    sun.shadow.camera.bottom = -S;
    sun.shadow.camera.near   = 1;
    sun.shadow.camera.far    = 420;
    sun.shadow.bias          = -0.0008;
    sun.shadow.normalBias    = 0.04;
    sun.shadow.camera.updateProjectionMatrix();
  }
  three.add(sun);

  /* Sky dome */
  {
    const R = 2400;
    const g = new THREE.SphereGeometry(R, LOW ? 12 : 24, LOW ? 8 : 16);
    const pos = g.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const top = new THREE.Color(0x2a6dbf);
    const mid = new THREE.Color(0x8ec2ee);
    const bot = new THREE.Color(0xdcecf7);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / R;
      if (y > 0) c.copy(mid).lerp(top, Math.min(1, y / 0.62));
      else c.copy(mid).lerp(bot, Math.min(1, -y / 0.35));
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    const _domeMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
    _skyMats.push(_domeMat);
    three.add(new THREE.Mesh(g, _domeMat));
  }

  const startMode = (params && params.startMode === "walk") ? "walk" : "drive";
  const AuthMod = window.__ph3d_auth;
  const userCars = (AuthMod && AuthMod.user && Array.isArray(AuthMod.user.cars)) ? AuthMod.user.cars : [];

  let userCarsSafe = userCars;
  if (userCarsSafe.length === 0) {
    userCarsSafe = ["scrappy"];
    if (AuthMod && AuthMod.user) {
      AuthMod.user.cars = ["scrappy"];
      if (!AuthMod.user.vehicle) AuthMod.user.vehicle = { model: "scrappy", body: "#4d6b74", rim: "#8d9298" };
    }
    if (State) {
      State.owned = State.owned && State.owned.indexOf("scrappy") >= 0 ? State.owned : ["scrappy"];
      if (State.vehicle && !State.vehicle.model) State.vehicle.model = "scrappy";
    }
    if (AuthMod && AuthMod.save) { try { AuthMod.save({ cars: ["scrappy"] }); } catch (e) {} }
  }

  let mode = startMode;
  if (mode === "drive" && userCarsSafe.length === 0) mode = "walk";

  /* -------- city (two meshes: base + detail) -------- */
  const city = buildCity();
  const RING_R = city.RING_R;
  const RING_RZ = city.RING_RZ;
  const worldAABBs = city.aabbs.slice();
  const walkablePlatforms = city.platforms.slice();
  const compounds = city.compounds;

  /* Distant sky dome to hide terrain edge */
  {
    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(1800, 24, 16),
      new THREE.MeshBasicMaterial({
        color: 0xa6c8e6,
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
      })
    );
    skyDome.renderOrder = -1000;
    three.add(skyDome);
    _skyMats.push(skyDome.material);
  }
  /* Seasons + live weather (summer / harmattan / rainy) */
  try { Weather.mount(three, camera, { sun, hemi: hemiL, amb: ambL, skyMats: _skyMats }); } catch (e) { console.warn("[weather]", e); }
  window.__ph3d_three = three;

  const baseMat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });
  const detailMat = new THREE.MeshPhongMaterial({
    vertexColors: true,
    shininess: 16,
    specular: new THREE.Color(0x303840),
    flatShading: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  for (const g of city.baseChunks) {
    const m = new THREE.Mesh(g, baseMat);
    m.matrixAutoUpdate = false; m.renderOrder = 0;
    three.add(m);
  }
  for (const g of city.detailChunks) {
    const m = new THREE.Mesh(g, detailMat);
    m.matrixAutoUpdate = false; m.renderOrder = 1;
    three.add(m);
  }

  /* -------- night: streetlights light up (glow + ground pools, plus the
     real PointLight pool that follows the player through __lampSpots) -------- */
  try {
    addNightGlow(three, city.lampSpots, { poolRadius: LOW ? 11 : 15 });
    three.userData.__lampSpots = city.lampSpots;
  } catch (e) { console.warn("[drive] night glow failed:", e); }

  /* -------- landmark tap planes + compound markers -------- */
  const buildings = [];

  for (let i = 0; i < compounds.length; i++) {
    const c = compounds[i];
    const group = new THREE.Group();
    group.position.set(c.x, 0, c.z);
    group.rotation.y = c.ry;
    three.add(group);

    const hit = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 70),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hit.rotation.x = -Math.PI / 2;
    hit.position.set(c.x, 12, c.z);
    hit.userData.tap = () => routeToLandmark(c.lm, router);
    three.add(hit);

    buildings.push({ group, x: c.x, z: c.z, r: 22 });
  }

  function routeToLandmark(lm, router) {
    askAndRoute(lm, router);
  }

  /* -------- airplane gate -------- */
  const planeGates = [];
  {
    const planeComp = compounds.find((c) => c.lm.id === "airplane");
    if (planeComp) {
      planeGates.push({
        id: "airplane_0",
        x: planeComp.x,
        z: planeComp.z + 10,
        name: "AIRPLANE",
      });
    }
  }

  window.__ph3d_world_aabbs = worldAABBs;

  /* Location markers */
  try { LocationMarkers.build(three, compounds, camera); } catch (e) { console.warn("[drive] LocationMarkers:", e); }

  /* World objects */
  try {
    WorldObjects.init(three);
    WorldObjects.seedCity(three, LOW ? 80 : 200, GRID_RADIUS, BLOCK_SIZE, ROAD_W);
    window.__ph3d_world_objects = WorldObjects;
  } catch (e) { console.warn("[drive] WorldObjects:", e); }

/* -------- Police pursuit (up to 3 cars) -------- */
const policeCars = [];
const MAX_POLICE = 2;           /* was 3 */
let _policeAccum = 0;           /* 30 Hz throttle */
let _policeCarTemplate = null;  /* built once, cloned per spawn */
const POLICE_MODEL_CORRECTION = -Math.PI / 2;

  ArrestWatch.init({
    getPlayer: () => (window.__ph3d_drive && window.__ph3d_drive.getPos()) || null,
    getPoliceCars: () => policeCars,
    onArrest: () => {
      /* Stop the car, charge the fine, then use the normal arrest flow
         (Police.arrive → Prison.sentence → jail clothes → prisonScene). */
      try { input.throttle = 0; input.brake = 0; speed = 0; } catch (e) {}
      try {
        const fine = Math.min(Economy.balance, 250000);
        if (fine > 0) { Economy.withdraw(fine); window.__ph3d_lastFine = fine; }
      } catch (e) {}
      try {
        const P = window.__ph3d_police;
        if (P) { P.target = "You"; P.arrive(); }
      } catch (e) { console.warn("[arrest] failed:", e); }
    },
  });

  const _WILDERNESS = !!(params && params.wilderness);
  const SPAWN_X = _WILDERNESS ? (params.startX || 0) : 0;
  const SPAWN_Z = _WILDERNESS ? (params.startZ || 350) : 240;
  const SPAWN_YAW = _WILDERNESS ? 0 : Math.PI;

  function _spawnPoliceCar(playerX, playerZ) {
    if (!_policeCarTemplate) {
      _policeCarTemplate = buildMercedes3D("#1976d2", "#ffffff");
      _policeCarTemplate.rotation.y = POLICE_MODEL_CORRECTION;
    }
    const car = _policeCarTemplate.clone();   /* shares geometry + materials */
    three.add(car);
    const useYaw = (mode === "walk") ? (walker && walker.yaw != null ? walker.yaw : heading) : heading;
    const ang = useYaw + Math.PI + (Math.random() - 0.5) * 0.7;
    const dist = 55 + Math.random() * 25;
    car.position.set(playerX + Math.sin(ang) * dist, 0.02, playerZ + Math.cos(ang) * dist);
    return { mesh: car, speed: 0, id: Math.random().toString(36).slice(2, 7),
             stuckTimer: 0, hitCd: 0, didHit: false };
  }

  let _sirenOn = false;
  function tickPolice(dt, t, playerX, playerZ) {
    try { ArrestWatch.tick(dt); } catch (e) {}
    const active = !!(window.__ph3d_police && window.__ph3d_police.dispatched);
    if (!active) {
      if (_sirenOn) { try { Sfx.stop("police_siren"); } catch (_) {} _sirenOn = false; }
      if (!policeCars.length) return;
      /* Clones share the template's geometry/materials, so only detach them. */
      for (const car of policeCars) {
        if (car.mesh && car.mesh.parent) car.mesh.parent.remove(car.mesh);
      }
      policeCars.length = 0;
      _policeAccum = 0;
      return;
    }
    if (!_sirenOn) { try { Sfx.loop("police_siren"); } catch (_) {} _sirenOn = true; }

    _policeAccum += dt;
    if (_policeAccum < 0.033) return;
    const step = _policeAccum;
    _policeAccum = 0;

    while (policeCars.length < MAX_POLICE) policeCars.push(_spawnPoliceCar(playerX, playerZ));

    for (let i = policeCars.length - 1; i >= 0; i--) {
      const pc = policeCars[i];
      if (pc.parked) continue;                       /* parked: the officer is on foot now */
      const dx = playerX - pc.mesh.position.x;
      const dz = playerZ - pc.mesh.position.z;
      const dist = Math.hypot(dx, dz);

      /* never ram: brake early and stop ~10m away */
      let targetSpeed;
      if (dist < 10)      targetSpeed = 0;
      else if (dist < 24) targetSpeed = (dist - 10) * 1.2;
      else                targetSpeed = Math.min(34, 14 + dist * 0.55);

      /* keep police cars from overlapping each other */
      for (const o of policeCars) {
        if (o === pc || !o.mesh) continue;
        const ox = pc.mesh.position.x - o.mesh.position.x, oz = pc.mesh.position.z - o.mesh.position.z;
        const od = Math.hypot(ox, oz);
        if (od < 5 && od > 0.01) { pc.mesh.position.x += (ox / od) * (5 - od) * 0.5; pc.mesh.position.z += (oz / od) * (5 - od) * 0.5; }
      }

      if (dist < 16 && pc.speed < 1.5 && !pc.parked) {
        pc.parked = true; pc.speed = 0;
        try {
          const a = pc.mesh.rotation.y - POLICE_MODEL_CORRECTION + Math.PI / 2;
          const cop = NPCs._spawnRole(pc.mesh.position.x + Math.sin(a) * 2.2, pc.mesh.position.z + Math.cos(a) * 2.2, "police");
          /* police ARREST, they don't fight: officer steps out, then the arrest triggers */
          if (cop) {
            cop.state = "walk"; cop.stateT = 4;
            setTimeout(() => {
              try {
                const P = window.__ph3d_police;
                if (P && P.dispatched) { P.target = "You"; P.arrive(); }
              } catch (e) { console.warn("[arrest] failed:", e); }
            }, 3000);
          }
        } catch (e) { console.warn("[police] cop exit failed", e); }
        continue;
      }

      pc.speed += (targetSpeed - pc.speed) * Math.min(1, step * 2.4);
      if (pc.speed < 0.2) pc.speed = 0;

      if (pc.speed > 0.4) {
        const desiredYaw = Math.atan2(dx, dz) + POLICE_MODEL_CORRECTION;
        let dyaw = desiredYaw - pc.mesh.rotation.y;
        dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
        pc.mesh.rotation.y += dyaw * Math.min(1, step * 3.0);

        const fx = Math.sin(pc.mesh.rotation.y - POLICE_MODEL_CORRECTION);
        const fz = Math.cos(pc.mesh.rotation.y - POLICE_MODEL_CORRECTION);
        pc.mesh.position.x += fx * pc.speed * step;
        pc.mesh.position.z += fz * pc.speed * step;

        const rr = resolveAABBs(pc.mesh.position.x, pc.mesh.position.z, 1.9, worldAABBs);
        if (rr[0] !== pc.mesh.position.x || rr[1] !== pc.mesh.position.z) {
          pc.mesh.position.x = rr[0]; pc.mesh.position.z = rr[1];
          pc.speed *= 0.35;
          pc.stuckTimer += step;
          if (pc.stuckTimer > 12) {
            if (pc.mesh && pc.mesh.parent) pc.mesh.parent.remove(pc.mesh);
            policeCars.splice(i, 1);
            continue;
          }
        } else {
          pc.stuckTimer = Math.max(0, pc.stuckTimer - step * 0.5);
        }
      }


    }
  }

  /* -------- car selection -------- */
  const FRONT_CORRECTION = { nk250: 0, hoverboard: 0, gwagon: Math.PI, cybertruck: 0, rangerover: 0, mercedes: -Math.PI / 2, chiron: -Math.PI / 2, scrappy: 0 };
  const MODELS_JS_CORRECTION = -Math.PI / 2;
  const model = (State.vehicle && State.vehicle.model) || "scrappy";
  let carMesh, frontCorrection;
  if (model === "scrappy") { carMesh = buildScrappy3D(State.vehicle.body, State.vehicle.rim); frontCorrection = FRONT_CORRECTION.scrappy; }
  else if (model === "taxi") { carMesh = buildTaxi(); frontCorrection = MODELS_JS_CORRECTION; }
  else if (model === "cybertruck") { carMesh = buildCybertruck3D(State.vehicle.body, State.vehicle.rim); frontCorrection = FRONT_CORRECTION.cybertruck; }
  else if (model === "rangerover") { carMesh = buildRangeRover3D(State.vehicle.body, State.vehicle.rim); frontCorrection = FRONT_CORRECTION.rangerover; }
  else if (model === "gwagon") { carMesh = buildGWagon3D(State.vehicle.body, State.vehicle.rim); frontCorrection = FRONT_CORRECTION.gwagon; }
  else if (model === "mercedes") { carMesh = buildMercedes3D(State.vehicle.body, State.vehicle.rim); frontCorrection = FRONT_CORRECTION.mercedes; }
  else if (model === "bmw") { carMesh = buildBMW3D(State.vehicle.body, State.vehicle.rim); frontCorrection = MODELS_JS_CORRECTION; }
  else if (model === "chiron") { carMesh = buildChiron3D(State.vehicle.body, State.vehicle.rim); frontCorrection = FRONT_CORRECTION.chiron; }
  else { carMesh = buildVehicleSimple(model, State.vehicle.body, State.vehicle.rim, { riderless: true }) || buildTaxi(); frontCorrection = FRONT_CORRECTION[model] !== undefined ? FRONT_CORRECTION[model] : MODELS_JS_CORRECTION; }

  const carRoot = new THREE.Group();
  carRoot.rotation.order = "YXZ";
  carMesh.rotation.y = frontCorrection;
  carRoot.add(carMesh);
  three.add(carRoot);

  carMesh.updateMatrixWorld(true);
  const hiddenForBox = [];
  carMesh.traverse(n => { if (n.isMesh && n.material && n.material.transparent) { hiddenForBox.push(n); n.visible = false; } });
  const carBox = new THREE.Box3().setFromObject(carMesh);
  const carSize = new THREE.Vector3(); carBox.getSize(carSize);
  for (const n of hiddenForBox) n.visible = true;

  const carWing = (carMesh.userData && carMesh.userData.wing) || null;
  const carWingLight = (carMesh.userData && carMesh.userData.wingLight) || null;
  const surf = CAR_SURFACES[model] || CAR_SURFACES.default;
  const roofHeight = carSize.y * surf.roof;
  const CAN_STAND_ON = roofHeight > STAND_ON_MIN_ROOF;

  const charBuilt = buildCharacter(Wardrobe && Wardrobe.config ? Wardrobe.config : null);
  let character = charBuilt.root;
  let charRig = charBuilt.rig;
  character.visible = false;
  three.add(character);
  try { attachPhone(charRig); } catch (e) {}

  /* Wardrobe changes show on your character right away (no scene change needed). */
  let _wdRaf = 0;
  const _unWardrobe = Wardrobe.onChange((cfg) => {
    if (_wdRaf) return;
    _wdRaf = requestAnimationFrame(() => {
      _wdRaf = 0;
      try { if (liveApplyConfig(character, charRig, cfg)) attachPhone(charRig); } catch (e) { console.warn("[drive] wardrobe", e); }
    });
  });

  /* ── Bike / hoverboard: the PLAYER'S own avatar rides it; the vehicle itself is empty ── */
  const RIDE = (model === "nk250" || model === "hoverboard") ? model : null;
  function mountRider() {
    if (!RIDE) return;
    const parent = RIDE === "hoverboard" ? ((carMesh.userData && carMesh.userData.hoverBoard) || carMesh) : carMesh;
    if (character.parent !== parent) parent.add(character);
    if (RIDE === "nk250") { character.position.set(0, 0.93 - HIP_HEIGHT, -0.3); character.rotation.set(0, 0, 0); }
    else { character.position.set(0, 0.04 - 0.035, 0); character.rotation.set(0, -Math.PI / 2, 0); }
    character.visible = true;
  }
  function poseRider(dt) {
    if (!RIDE || !charRig) return;
    const r = charRig, k = Math.min(1, (dt || 0.016) * 10);
    const set = (j, x, y, z) => { if (!j) return; j.rotation.x += (x - j.rotation.x) * k; j.rotation.y += (y - j.rotation.y) * k; j.rotation.z += (z - j.rotation.z) * k; };
    if (r.hips) { r.hips.position.y = HIP_HEIGHT; set(r.hips, 0, 0, 0); }
    if (RIDE === "nk250") {
      const tuck = Math.min(1, Math.abs(speed) / 25);
      set(r.spine, 0.35 + tuck * 0.35, 0, 0); set(r.neck, -0.25 - tuck * 0.2, 0, 0); set(r.head, 0, 0, 0);
      for (const leg of [r.legL, r.legR]) if (leg) { set(leg.hip, -0.98, 0, 0); set(leg.knee, 1.64, 0, 0); set(leg.ankle, -0.66, 0, 0); }
      const sh = -(0.92 + 0.35 + tuck * 0.35);
      if (r.armL) { set(r.armL.shoulder, sh, 0, 0.12); set(r.armL.elbow, -0.15, 0, 0); }
      if (r.armR) { set(r.armR.shoulder, sh, 0, -0.12); set(r.armR.elbow, -0.15, 0, 0); }
    } else {
      set(r.spine, 0.08, 0, 0); set(r.neck, 0, 0, 0); set(r.head, 0, 0, 0);
      for (const [leg, s] of [[r.legL, 1], [r.legR, -1]]) if (leg) { set(leg.hip, -0.12, 0, s * 0.28); set(leg.knee, 0.24, 0, 0); set(leg.ankle, -0.12, 0, 0); }
      if (r.armL) { set(r.armL.shoulder, -0.1, 0, 0.55); set(r.armL.elbow, -0.25, 0, 0); }
      if (r.armR) { set(r.armR.shoulder, -0.1, 0, -0.55); set(r.armR.elbow, -0.25, 0, 0); }
    }
  }

  const carPos = new THREE.Vector3();
  let heading = Math.PI;
  let speed = 0, steer = 0, wheelRot = 0;
  let cameraYaw = 0, cameraPitch = 0.15;

  carPos.set(SPAWN_X, 0, SPAWN_Z);
  heading = SPAWN_YAW;

  const input = { throttle: 0, brake: 0, steerL: 0, steerR: 0, joyX: 0, joyY: 0 };
  const keys = Object.create(null);

  const walker = {
    x: SPAWN_X + (_WILDERNESS ? 4 : 2.5), z: SPAWN_Z + (_WILDERNESS ? 4 : 0),
    y: 0, yaw: SPAWN_YAW, pitch: 0, vy: 0, onGround: true, sitting: null, nearSeat: null, ragdoll: null,
  };
  walker.pos = walker;
  walker.rig = charRig;
  walker.scene = three;

  /* Weapons expect a controller whose forward is -(sin yaw, cos yaw);
     this walker faces +(sin yaw, cos yaw), so aim through a proxy
     that adds π to the yaw. */
  const weaponCtl = {
    get pos()    { return walker; },
    get yaw()    { return walker.yaw + Math.PI; },
    get rig()    { return walker.rig; },
    get scene()  { return three; },
    get floorY() { return walker.y; },
    get opts()   { return walker.opts; },
    get aimPitch() { return walker.pitch || 0; },
    getAim() {
      const cp = Math.cos(walker.pitch || 0), sp = Math.sin(walker.pitch || 0);
      return {
        origin: new THREE.Vector3(walker.x, walker.y + 1.4, walker.z),
        dir: new THREE.Vector3(Math.sin(walker.yaw) * cp, sp, Math.cos(walker.yaw) * cp).normalize(),
      };
    },
  };
  const jet = { on: false, thrust: false, fuel: 1, tilt: 0 };
  const jetVis = createJetpack();
  const walkerWeapons = new Weapons(weaponCtl);
  walker.weapons = walkerWeapons;
  window.__ph3d_weapons = walkerWeapons;

  try { jetVis.attach(character); } catch (e) {}
  walker.y = sampleTerrainMeshHeight(walker.x, walker.z);
  character.position.set(walker.x, walker.y, walker.z);
  character.rotation.y = walker.yaw;

  let prevLocalX = 2.5, prevLocalZ = 0;
  const WALK_SPEED = 4.6;
  const WALK_RADIUS = 0.45;

  if (mode === "walk") { character.position.set(walker.x, walker.y, walker.z); character.rotation.y = walker.yaw; character.visible = true; }
  else if (RIDE) mountRider();

  const dom = router.renderer.domElement;
  const onKD = e => {
    keys[e.code] = 1;
    if (e.code === "KeyH" && mode === "drive") {
      try { Sfx.play("car_horn", { x: carPos.x, z: carPos.z }); } catch (_) {}
    }
  };
  const onKU = e => { keys[e.code] = 0; };
  window.addEventListener("keydown", onKD);
  window.addEventListener("keyup", onKU);

  /* Start outdoor ambience */
  /* ambience beds are handled by AudioSystem (js/core/audio.js) */

  /* Handle a nearby world event (crash, fire, wallet…). Works on foot
     and in a car.  Returns true if something was handled. */
  function tryWorldEvent() {
    try {
      const px = (mode === "walk") ? walker.x : carPos.x;
      const pz = (mode === "walk") ? walker.z : carPos.z;
      const ev = WorldEvents.nearestInteractable(px, pz);
      if (ev) { WorldEvents.interact(ev); return true; }
    } catch (err) {}
    return false;
  }

  let _eWasDown = false;
  const onKeyE = e => {
    if (e.code !== "KeyE") return;
    const down = e.type === "keydown";
    if (mode !== "walk") {
      if (down && !e.repeat) tryWorldEvent();
      return;
    }
    if (down && !_eWasDown) {
      /* 0. Kidnap — grab a downed NPC nearby */
      if (!Kidnap.isHolding()) {
        try {
          const target = Kidnap.nearestTarget(walker.x, walker.z, 2.6);
          if (target) {
            Kidnap.grab(target);
            _eWasDown = down;
            return;
          }
        } catch (err) {}
      }

      /* 1. Try to talk to an NPC first */
      let talked = false;
      try {
        const npc = NPCs.nearest(walker.x, walker.z, 2.5);
        if (npc) { NPCs.talk(npc); talked = true; }
      } catch (err) {}
      if (talked) { _eWasDown = down; return; }

      /* 1b. World event in reach (crash / fire / wallet / …) */
      if (tryWorldEvent()) { _eWasDown = down; return; }

      /* 2. Existing pickup / throw / use logic */
      const item = window.__ph3d_nearObj;
      if (e.shiftKey) {
        try {
          const pkt = window.__ph3d_pocket;
          const slot = pkt && pkt.slots ? pkt.slots.findIndex(Boolean) : -1;
          if (slot >= 0) {
            const held = pkt.slots[slot];
            const tx = walker.x + Math.sin(walker.yaw) * 4;
            const tz = walker.z + Math.cos(walker.yaw) * 4;
            WorldObjects.throw({ type: held.id, label: held.id, icon: "✋", mesh: null }, tx, tz, walker);
            pkt.remove(slot, 1);
            window.__ph3d_phone?._toast(`Threw ${held.id}`);
          }
        } catch (err) {}
      } else if (item) {
        try {
          if (window.__ph3d_playerActions && !window.__ph3d_playerActions.isBusy()) {
            window.__ph3d_playerActions.pickup(walker, item);
          } else {
            WorldObjects.pickup(item, walker);
          }
        } catch (err) {}
      } else {
        try {
          const pkt = window.__ph3d_pocket;
          const slot = pkt && pkt.slots ? pkt.slots.find(Boolean) : null;
          if (slot) {
            window.__ph3d_phone?._toast(`✋ Used ${slot.id}`);
            WorldObjects.use({ type: slot.id, label: slot.id, icon: "✋", use: "" }, walker);
          }
        } catch (err) {}
      }
    }
    _eWasDown = down;
  };
  window.addEventListener("keydown", onKeyE);
  window.addEventListener("keyup", onKeyE);
  dom.addEventListener("contextmenu", e => e.preventDefault());

  const joyBaseEl = document.createElement("div");
  joyBaseEl.id = "ph3d-walk-joy-base";
  joyBaseEl.style.cssText = "position:fixed;left:calc(env(safe-area-inset-left) + 22px);bottom:calc(env(safe-area-inset-bottom) + 30px);width:130px;height:130px;border-radius:50%;background:radial-gradient(circle,rgba(94,224,255,0.10) 0%,rgba(94,224,255,0.04) 55%,rgba(94,224,255,0.00) 100%);border:2px solid rgba(94,224,255,0.55);box-shadow:0 0 24px rgba(94,224,255,0.22),inset 0 0 12px rgba(94,224,255,0.10);backdrop-filter:blur(3px);pointer-events:none;z-index:9998;display:none;opacity:0.85;transition:opacity .18s";
  document.body.appendChild(joyBaseEl);

  const joyKnobEl = document.createElement("div");
  joyKnobEl.id = "ph3d-walk-joy-knob";
  joyKnobEl.style.cssText = "position:absolute;left:50%;top:50%;width:54px;height:54px;border-radius:50%;background:radial-gradient(circle at 40% 35%,rgba(180,240,255,0.95),rgba(94,224,255,0.75));border:2px solid rgba(255,255,255,0.85);box-shadow:0 4px 14px rgba(0,0,0,0.45),0 0 18px rgba(94,224,255,0.4);transform:translate(-50%,-50%);pointer-events:none;transition:transform .05s";
  joyBaseEl.appendChild(joyKnobEl);

  const walkJoyCenter = { x: 0, y: 0 };
  let walkJoyId = null;
  const JOY_RADIUS = 50;
  const JOY_VIS_RADIUS = 35;

  function applyJoyFromTouch(cx, cy) {
    const dx = cx - walkJoyCenter.x, dy = cy - walkJoyCenter.y;
    const mag = Math.hypot(dx, dy);
    let jx = dx, jy = dy;
    if (mag > JOY_RADIUS) { jx = dx / mag * JOY_RADIUS; jy = dy / mag * JOY_RADIUS; }
    input.joyX = jx / JOY_RADIUS;
    input.joyY = jy / JOY_RADIUS;
    joyKnobEl.style.transform = "translate(calc(-50% + " + ((jx / JOY_RADIUS) * JOY_VIS_RADIUS) + "px),calc(-50% + " + ((jy / JOY_RADIUS) * JOY_VIS_RADIUS) + "px))";
  }

  let dragId = null, lx = 0, ly = 0;
  let walkCameraYaw = heading;

  const onPD = function (e) {
    if (walker.ragdoll) return;
    const isLeftHalf = e.clientX < innerWidth * 0.5;
    if (mode === "walk" && isLeftHalf && walkJoyId === null) {
      const r = joyBaseEl.getBoundingClientRect();
      walkJoyCenter.x = r.left + r.width / 2;
      walkJoyCenter.y = r.top + r.height / 2;
      walkJoyId = e.pointerId;
      joyBaseEl.style.opacity = "1";
      applyJoyFromTouch(e.clientX, e.clientY);
      try { dom.setPointerCapture(e.pointerId); } catch (err) {}
      return;
    }
    dragId = e.pointerId; lx = e.clientX; ly = e.clientY;
    try { dom.setPointerCapture(e.pointerId); } catch (err) {}
  };

  const onPM = function (e) {
    if (e.pointerId === walkJoyId) { applyJoyFromTouch(e.clientX, e.clientY); return; }
    if (e.pointerId !== dragId) return;
    const _ls = window.__ph3d_lookSens || 1;
    const dx = (e.clientX - lx) * _ls, dy = (e.clientY - ly) * _ls;
    lx = e.clientX; ly = e.clientY;
    if (mode === "drive") { cameraYaw -= dx * 0.0055; cameraPitch = Math.max(-0.55, Math.min(1.05, cameraPitch + dy * 0.004)); }
    else { walkCameraYaw -= dx * 0.0055; walker.pitch = Math.max(-1.15, Math.min(1.15, walker.pitch - dy * 0.0045)); }
  };

  const onPU = function (e) {
    if (e.pointerId === walkJoyId) {
      walkJoyId = null;
      input.joyX = 0; input.joyY = 0;
      joyKnobEl.style.transform = "translate(-50%, -50%)";
      joyBaseEl.style.opacity = "0.85";
      try { dom.releasePointerCapture(e.pointerId); } catch (err) {}
      return;
    }
    if (e.pointerId === dragId) dragId = null;
  };
  dom.addEventListener("pointerdown", onPD);
  dom.addEventListener("pointermove", onPM);
  dom.addEventListener("pointerup", onPU);
  dom.addEventListener("pointercancel", onPU);

  const enterBtn = document.getElementById("drive-enter");
  const hudEl = document.getElementById("drive-hud");
  let nearGate = null;
  let nearPlaneGate = null;

  const getOutBtn = document.createElement("button");
  getOutBtn.id = "ph3d-drive-getout";
  getOutBtn.textContent = (mode === "walk") ? "GET IN CAR" : "GET OUT";
  /* HUD handles all colour/position */
  getOutBtn.style.cssText = "cursor:pointer;pointer-events:auto;touch-action:manipulation;user-select:none;-webkit-user-select:none;";
  document.body.appendChild(getOutBtn);

  const carSitBtn = document.createElement("button");
  carSitBtn.id = "ph3d-car-sit";
  carSitBtn.textContent = "SIT ON CAR";
  /* HUD handles all colour/position */
  carSitBtn.style.cssText = "cursor:pointer;pointer-events:none;opacity:0;transition:opacity .2s;touch-action:manipulation;";
  document.body.appendChild(carSitBtn);
  /* Sit button: stand up if seated; else sit on the nearest car seat; else
     sit right here on any flat ground (road, pavement, grass). */
  function sitOnGroundHere() {
    if (walker.ragdoll || !walker.onGround || walker.vy > 0.01) return false;
    const gy = sampleTerrainMeshHeight(walker.x, walker.z);
    const R = 0.7;
    const hs = [sampleTerrainMeshHeight(walker.x + R, walker.z), sampleTerrainMeshHeight(walker.x - R, walker.z),
                sampleTerrainMeshHeight(walker.x, walker.z + R), sampleTerrainMeshHeight(walker.x, walker.z - R)];
    for (const h of hs) {
      if (Math.abs(h - gy) > 0.3) {
        if (window.__ph3d_phone) window.__ph3d_phone._toast("Ground is too uneven to sit here");
        return false;
      }
    }
    walker.sitting = { ground: true, x: walker.x, z: walker.z, y: gy + 0.15, yaw: walker.yaw };
    return true;
  }
  carSitBtn.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();
    if (walker.ragdoll) return;
    if (walker.sitting) walker.sitting = null;
    else if (walker.nearSeat) walker.sitting = walker.nearSeat;
    else sitOnGroundHere();
  }, { passive: false });

  const aftermath = document.createElement("div");
  aftermath.id = "ph3d-aftermath";
  aftermath.style.cssText = "position:fixed;inset:0;z-index:120;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.78);backdrop-filter:blur(6px);opacity:0;transition:opacity .5s";
  aftermath.innerHTML = `
    <div style="max-width:340px;width:88vw;text-align:center;font-family:Inter,system-ui,sans-serif;color:#fff">
      <div style="font-size:11px;letter-spacing:.32em;color:#ff8080;font-weight:900" id="aftermath-title">ACCIDENT</div>
      <div style="font-size:24px;font-weight:900;margin-top:8px;letter-spacing:-.3px" id="aftermath-sub">You got hit.</div>
      <div style="font-size:13px;color:rgba(255,255,255,.65);margin-top:10px;line-height:1.5" id="aftermath-hp"></div>
      <div style="margin-top:22px;display:flex;flex-direction:column;gap:10px" id="aftermath-actions">
        <button id="aftermath-car" style="width:100%;padding:15px;border-radius:16px;border:none;cursor:pointer;background:linear-gradient(135deg,#5ee0ff,#4ab6ff);color:#04121c;font:900 12px Inter,system-ui,sans-serif;letter-spacing:.14em">GO TO CAR</button>
        <button id="aftermath-home" style="width:100%;padding:15px;border-radius:16px;border:none;cursor:pointer;background:linear-gradient(135deg,#a78bfa,#c4b5fd);color:#0b0620;font:900 12px Inter,system-ui,sans-serif;letter-spacing:.14em">GO HOME</button>
      </div>
    </div>`;
  document.body.appendChild(aftermath);

  function showAftermath() {
    const hp = (Combat && typeof Combat.hp === "number") ? Math.max(0, Math.round(Combat.hp)) : 0;
    const isDead = hp <= 0;
    const sub = document.getElementById("aftermath-sub");
    const hpEl = document.getElementById("aftermath-hp");
    const carBtn = document.getElementById("aftermath-car");
    if (isDead) {
      document.getElementById("aftermath-title").textContent = "YOU DIED";
      sub.textContent = "The car took you out.";
      hpEl.textContent = "You blacked out on the road. Time to head home.";
      carBtn.style.display = "none";
    } else {
      document.getElementById("aftermath-title").textContent = "ACCIDENT";
      sub.textContent = "You got hit by a car.";
      hpEl.textContent = "HP: " + hp + " / " + (Combat.maxHp || 100) + " · You can still walk back to your car.";
      carBtn.style.display = "block";
    }
    aftermath.style.display = "flex";
    requestAnimationFrame(() => { aftermath.style.opacity = "1"; });
  }
  function hideAftermath() {
    aftermath.style.opacity = "0";
    setTimeout(() => { aftermath.style.display = "none"; }, 450);
  }

  document.getElementById("aftermath-car").onclick = () => {
    hideAftermath();
    walker.ragdoll = null; try { Limp.release(charRig); } catch (e) {} walker.y = 0; walker.vy = 0; walker.onGround = true;
    walker.x = carPos.x; walker.z = carPos.z;
    character.rotation.set(0, heading, 0);
    character.position.set(walker.x, walker.y, walker.z);
    enterCar(true);
  };

  document.getElementById("aftermath-home").onclick = () => {
    hideAftermath(); walker.ragdoll = null; try { Limp.release(charRig); } catch (e) {}
    if (Combat && Combat.hp <= 0) { try { Combat.heal(Combat.maxHp || 100); } catch (e) {} }
    if (window.__ph3d_goHome) window.__ph3d_goHome(router, false);
    else router.go("interior", { id: "myhouse" });
  };

  function enterCar(force) {
    if (mode === "walk") {
      const dx = walker.x - carPos.x, dz = walker.z - carPos.z;
      if (!force && (dx * dx + dz * dz > 6 * 6)) { if (window.__ph3d_phone) window.__ph3d_phone._toast("Too far from the car"); return; }
      mode = "drive"; speed = 0;
      try { Sfx.play("car_engine_start"); } catch (_) {}
      getOutBtn.textContent = "GET OUT";
      if (RIDE) mountRider(); else character.visible = false;
      joyBaseEl.style.display = "none";
      input.joyX = 0; input.joyY = 0;
      carSitBtn.style.opacity = "0"; carSitBtn.style.pointerEvents = "none";
    }
  }

  function exitCar() {
    if (mode === "drive") {
      mode = "walk";
      try { Sfx.play("car_engine_stop"); } catch (_) {}
      const cH = Math.cos(heading), sH = Math.sin(heading);
      const exW = carSize.x * 0.5 + 0.9, exL = carSize.z * 0.5 + 0.9;
      const cands = [[exW, 0], [-exW, 0], [0, exL], [0, -exL]];
      let exX = null, exZ = null;
      for (const [lx_, lz_] of cands) {
        const wx = carPos.x + lx_ * cH + lz_ * sH;
        const wz = carPos.z - lx_ * sH + lz_ * cH;
        const rr_ = resolveAABBs(wx, wz, WALK_RADIUS, worldAABBs);
        if (Math.abs(rr_[0] - wx) < 0.05 && Math.abs(rr_[1] - wz) < 0.05) { exX = wx; exZ = wz; break; }
      }
      if (exX === null) { exX = carPos.x + exW * cH; exZ = carPos.z - exW * sH; }
      walker.x = exX; walker.z = exZ;
      walker.y = sampleTerrainMeshHeight(walker.x, walker.z);
      walker.yaw = heading; walker.pitch = 0; walker.vy = 0; walker.onGround = true;
      speed = 0;
      getOutBtn.textContent = "GET IN CAR";
      if (RIDE && character.parent !== three) { three.add(character); try { charRig.hips.rotation.set(0, 0, 0); charRig.spine.rotation.set(0, 0, 0); } catch (e) {} }
      character.position.set(walker.x, walker.y, walker.z);
      character.rotation.y = walker.yaw;
      character.visible = true;
      joyBaseEl.style.display = "block";
    } else { enterCar(); }
  }

  getOutBtn.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); exitCar(); }, { passive: false });

  let walkRunHold = false;
  const walkRunBtn = document.createElement("button");
  walkRunBtn.id = "ph3d-walk-run"; walkRunBtn.textContent = "RUN";
  /* HUD handles all colour/position */
  walkRunBtn.style.cssText = "display:none;cursor:pointer;pointer-events:auto;touch-action:manipulation;";
  document.body.appendChild(walkRunBtn);
  walkRunBtn.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();
    walkRunHold = !walkRunHold;
    walkRunBtn.classList.toggle("is-on", walkRunHold);
  }, { passive: false });

  const walkJumpBtn = document.createElement("button");
  walkJumpBtn.id = "ph3d-walk-jump"; walkJumpBtn.textContent = "JUMP";
  /* HUD handles all colour/position */
  walkJumpBtn.style.cssText = "display:none;cursor:pointer;pointer-events:auto;touch-action:manipulation;";
  document.body.appendChild(walkJumpBtn);
  walkJumpBtn.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();
    if (walker.ragdoll) return;
    if (jet.on) { jet.thrust = true; walkJumpBtn.classList.add("h-flash"); return; }
    if (walker.onGround && !walker.sitting) { walker.vy = 6.5; walker.onGround = false; walker.y += 0.001; }
    walkJumpBtn.classList.add("h-flash");
    setTimeout(() => walkJumpBtn.classList.remove("h-flash"), 180);
  }, { passive: false });
  const _jetRelease = () => { jet.thrust = false; if (jet.on) walkJumpBtn.classList.remove("h-flash"); };
  ["pointerup", "pointercancel", "pointerleave"].forEach(k => walkJumpBtn.addEventListener(k, _jetRelease));

  /* Jetpack: FLY toggles it; then hold JUMP (or Space) to thrust. Joystick + look drag steer as normal. */
  const walkFlyBtn = document.createElement("button");
  walkFlyBtn.id = "ph3d-walk-fly"; walkFlyBtn.textContent = "JETPACK";
  walkFlyBtn.style.cssText = "display:none;cursor:pointer;pointer-events:auto;touch-action:manipulation;";
  document.body.appendChild(walkFlyBtn);
  const toggleJet = () => {
    if (walker.ragdoll || walker.sitting) return;
    jet.on = !jet.on; jet.thrust = false;
    walkFlyBtn.classList.toggle("is-on", jet.on);
    walkFlyBtn.textContent = jet.on ? "JETPACK ON" : "JETPACK";
    try { window.__ph3d_phone && window.__ph3d_phone._toast(jet.on ? "Jetpack on. Hold JUMP to fly" : "Jetpack off"); } catch (e) {}
  };
  walkFlyBtn.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); toggleJet(); }, { passive: false });
  const _onKeyFly = e => { if (e.code === "KeyF" && !e.repeat && mode === "walk") toggleJet(); };
  window.addEventListener("keydown", _onKeyFly);

  const walkEnterBtn = document.createElement("button");
  walkEnterBtn.id = "ph3d-walk-enter"; walkEnterBtn.textContent = "ENTER";
  /* HUD handles all colour/position */
  walkEnterBtn.style.cssText = "display:none;cursor:pointer;pointer-events:auto;touch-action:manipulation;";
  document.body.appendChild(walkEnterBtn);
  walkEnterBtn.addEventListener("click", e => {
    e.stopPropagation();
    if (nearPlaneGate) { router.go("airplane"); return; }
    if (!nearGate) return;
    routeToLandmark(nearGate.lm, router);
  });

  const walkTalkBtn = document.createElement("button");
  walkTalkBtn.id = "ph3d-walk-talk";
  walkTalkBtn.textContent = "TALK";
  /* HUD handles all colour/position — only keep the display state */
  walkTalkBtn.style.cssText = "display:none;cursor:pointer;pointer-events:auto;touch-action:manipulation;";
  document.body.appendChild(walkTalkBtn);
  walkTalkBtn.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();
    if (walkTalkBtn._npc) NPCs.talk(walkTalkBtn._npc);
  }, { passive: false });

  /* ── GRAB button (kidnap a downed NPC) ─────────────────── */
  const grabBtn = document.createElement("button");
  grabBtn.id = "ph3d-walk-grab";
  grabBtn.textContent = "GRAB";
  /* HUD handles all colour/position */
  grabBtn.style.cssText = "display:none;cursor:pointer;pointer-events:auto;touch-action:manipulation;";
  document.body.appendChild(grabBtn);
  grabBtn.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();
    if (grabBtn._target) Kidnap.grab(grabBtn._target);
  }, { passive: false });

  const pickBtn = document.createElement("button");
  pickBtn.id = "ph3d-walk-pick";
  pickBtn.textContent = "PICK UP";
  /* HUD handles all colour/position */
  pickBtn.style.cssText = "display:none;cursor:pointer;pointer-events:auto;touch-action:manipulation;";
  document.body.appendChild(pickBtn);
  pickBtn.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();
    const item = window.__ph3d_nearObj;
    if (item) try { WorldObjects.pickup(item, walker); } catch (err) {}
  }, { passive: false });

  const useBtn = document.createElement("button");
  useBtn.id = "ph3d-walk-use";
  useBtn.textContent = "USE";
  /* HUD handles all colour/position */
  useBtn.style.cssText = "display:none;cursor:pointer;pointer-events:auto;touch-action:manipulation;";
  document.body.appendChild(useBtn);
  useBtn.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();
    const item = window.__ph3d_nearObj;
    if (item) {
      try { WorldObjects.use(item, walker); } catch (err) {}
    } else {
      try {
        const pkt = window.__ph3d_pocket;
        if (pkt) {
          const slot = pkt.slots ? pkt.slots.find(Boolean) : null;
          if (slot) {
            window.__ph3d_phone?._toast(`✋ Used ${slot.id}`);
            WorldObjects.use({ type: slot.id, label: slot.id, icon: "✋", use: "" }, walker);
          }
        }
      } catch (err) {}
    }
  }, { passive: false });

  if (mode === "walk") {
    walkRunBtn.style.display = "block"; walkJumpBtn.style.display = "block";
    joyBaseEl.style.display = "block";
  }

  /* ── HORN touch button (drive mode only) ─────────────── */
  const hornBtn = document.createElement("button");
  hornBtn.id = "ph3d-drive-horn"; hornBtn.textContent = "HORN";
  /* HUD handles colour/position */
  hornBtn.style.cssText = "cursor:pointer;pointer-events:auto;touch-action:manipulation;user-select:none;-webkit-user-select:none;display:" + (mode === "drive" ? "block" : "none") + ";";
  document.body.appendChild(hornBtn);
  hornBtn.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();
    if (mode !== "drive") return;
    try { Sfx.play("car_horn", { x: carPos.x, z: carPos.z }); } catch (_) {}
    hornBtn.classList.add("h-flash");
    setTimeout(() => hornBtn.classList.remove("h-flash"), 300);
  }, { passive: false });
  ["pointerup", "pointermove", "click"].forEach(k => hornBtn.addEventListener(k, e => e.stopPropagation()));

  const hoodLocalZ = carSize.z * 0.32, roofLocalZ = -carSize.z * 0.05;
  const hoodHeight = carSize.y * surf.hood, roofSeatHeight = carSize.y * surf.roof;

  const carSeats = [
    { type: "sit", label: "SIT ON BONNET", localX: 0, localZ: hoodLocalZ, seatH: hoodHeight + 0.10, x: 0, z: 0, y: 0, yaw: 0 },
    { type: "sit", label: "SIT ON ROOF",   localX: 0, localZ: roofLocalZ, seatH: roofSeatHeight + 0.10, x: 0, z: 0, y: 0, yaw: 0 },
  ];

  function refreshCarSeats() {
    const c = Math.cos(heading), s = Math.sin(heading);
    for (const seat of carSeats) {
      seat.x = carPos.x + seat.localX * c + seat.localZ * s;
      seat.z = carPos.z - seat.localX * s + seat.localZ * c;
      seat.y = seat.seatH;
      seat.yaw = heading + Math.PI;
    }
  }

  function flingRagdoll(fromX, fromZ, impulseX, impulseZ, upward, spinScale) {
    upward    = upward    != null ? upward    : 9.5;
    spinScale = spinScale != null ? spinScale : 15;
    walker.ragdoll = {
      vx: impulseX, vy: upward, vz: impulseZ,
      spinX: (Math.random() - 0.5) * spinScale * 2,
      spinY: (Math.random() - 0.5) * spinScale * 2,
      spinZ: (Math.random() - 0.5) * spinScale * 2,
      t: 0, landed: false,
    };
    walker.sitting = null;
    walker.onGround = false;
    character.rotation.set(0, walker.yaw, 0);
    try { Limp.release(charRig); Limp.step(charRig, character, 1 / 60); Limp.kick(charRig, impulseX * 3, upward * 2, impulseZ * 3, 1.5); } catch (e) {}
  }

  function hitPlayerByCar(impulseX, impulseZ, upward, spinScale) {
    if (walker.ragdoll) return false;
    flingRagdoll(walker.x, walker.z, impulseX, impulseZ, upward, spinScale);
    return true;
  }

  function hitPlayerCarByCar(impulseX, impulseZ, npcMass) {
    const playerMass = 2200;
    const fac = npcMass / (npcMass + playerMass);
    const dvx = impulseX * fac;
    const dvz = impulseZ * fac;
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const forward = dvx * fx + dvz * fz;
    const lateral = dvx * -fz + dvz * fx;

    speed = Math.max(-10, speed + forward * 0.4);
    carPos.x += dvx * 0.15;
    carPos.z += dvz * 0.15;
    heading += Math.max(-0.45, Math.min(0.45, lateral * 0.05));

    const dmg = Math.min(80, 8 + Math.abs(forward) * 1.1 + Math.abs(lateral) * 0.7);
    try { Combat.damage(dmg, "car-accident"); } catch (e) {}
    try { Combat.flash && Combat.flash(0.7); } catch (e) {}
    try { Sfx.play(dmg > 35 ? "car_crash_heavy" : "car_crash_light", { x: carPos.x, z: carPos.z }); } catch (_) {}
    if (window.__ph3d_phone) {
      window.__ph3d_phone._toast("\uD83D\uDCA5 Car accident \u00B7 -" + Math.round(dmg) + " HP");
    }
    try { Social.onAccident(carPos.x, carPos.z); } catch (e) {}
  }

  window.__ph3d_drive = {
    enter: function () {
      if (nearPlaneGate) { router.go("airplane"); return; }
      if (!nearGate) return;
      routeToLandmark(nearGate.lm, router);
    },
    setInput: function (k, v) { input[k] = v; },
    getPos: function () {
      return (mode === "walk") ? { x: walker.x, z: walker.z, yaw: walker.yaw } : { x: carPos.x, z: carPos.z, yaw: heading };
    },
    exit: exitCar,
    getMode: function () { return mode; },
    getWalkState: function () { if (mode !== "walk") return null; return { walker, character, charRig }; },
    hitPlayer: hitPlayerByCar,
    hitPlayerCar: hitPlayerCarByCar,
    getPlayerState: function () {
      if (mode === "walk") {
        return {
          mode: "walk",
          x: walker.x, z: walker.z,
          carX: carPos.x, carZ: carPos.z,
          ragdoll: !!walker.ragdoll,
        };
      }
      return {
        mode: "drive",
        x: carPos.x, z: carPos.z,
        carX: carPos.x, carZ: carPos.z,
        heading, speed,
      };
    },
  };

  const _cf = new THREE.Vector3(); const _cr = new THREE.Vector3();
  const _camP = new THREE.Vector3(); const _camL = new THREE.Vector3();

  /* Reuse the historic buildTaxi helper */
  function buildTaxi() {
    const g = new THREE.Group();
    const yellow = new THREE.MeshLambertMaterial({ color: 0xf2c31a });
    const black  = new THREE.MeshLambertMaterial({ color: 0x141414 });
    const glass  = new THREE.MeshLambertMaterial({ color: 0x8fb8d8, transparent: true, opacity: 0.55 });
    const chrome = new THREE.MeshLambertMaterial({ color: 0xa9b6c6 });
    const lower = new THREE.Mesh(new THREE.BoxGeometry(2.10, 0.92, 5.55), yellow);
    lower.position.y = 0.96; g.add(lower);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.22, 5.62), black);
    stripe.position.y = 1.24; g.add(stripe);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.13, 5.62), black);
    skirt.position.y = 0.56; g.add(skirt);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.12, 5.55), yellow);
    roof.position.y = 2.48; g.add(roof);
    for (const sx of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.96, 5.50), glass);
      win.position.set(sx * 1.00, 1.95, 0); g.add(win);
      const frontWin = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.96, 0.06), glass);
      frontWin.position.set(0, 1.95, sx * 2.74); g.add(frontWin);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.20, 0.08), chrome);
      l.position.set(sx * 0.72, 0.98, 2.84); g.add(l);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.06), black);
      t.position.set(sx * 0.80, 1.02, -2.84); g.add(t);
    }
    const bump1 = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.26, 0.20), black);
    bump1.position.set(0, 0.62, 2.86); g.add(bump1);
    const bump2 = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.26, 0.20), black);
    bump2.position.set(0, 0.62, -2.86); g.add(bump2);
    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.07, 4.20), black);
    rack.position.set(0, 2.58, -0.20); g.add(rack);
    const wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.30, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    for (const wz of [-1.85, 1.85]) {
      for (const sx of [-1, 1]) {
        const w = new THREE.Mesh(wheelGeo, black);
        w.position.set(sx * 0.98, 0.46, wz);
        g.add(w);
        wheels.push({ mesh: w, isSimple: true });
      }
    }
    g.userData.wheels = wheels;
    return g;
  }

  /* ── NPCs ─────────────────────────────────────────────────── */
  try {
    NPCs.spawn(three, {
      count: LOW ? 18 : 30,       // was 36 / 60 — cuts ~1200 draw calls
      aabbs: worldAABBs,
      roleSpots: compounds,
    });
    console.log("[drive] pedestrian groups:", NPCs.list.length);
  } catch (e) { console.warn("[drive] NPCs failed:", e); }

  /* ── NPC cars ─────────────────────────────────────────────── */
  try {
    NPC_Cars.spawn(three, {
      count: LOW ? 18 : 36,
      aabbs: worldAABBs,
      roads: city.roads,
      getPlayerState: () => window.__ph3d_drive.getPlayerState(),
      hitPlayer:      (ix, iz, up, spins) => window.__ph3d_drive.hitPlayer(ix, iz, up, spins),
      hitPlayerCar:   (ix, iz, mass)      => window.__ph3d_drive.hitPlayerCar(ix, iz, mass),
      toast:          (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} },
    });
    console.log("[drive] AI cars:", NPC_Cars.list.length);
  } catch (e) { console.warn("[drive] NPC cars failed:", e); }

  /* Walk mode courtesy: spawn 4 extra "local" pedestrian groups right
     around the walk spawn so the first minute isn't empty. */
  try {
    const walkSpawnX = SPAWN_X + 2.5;
    const walkSpawnZ = SPAWN_Z;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const wx = walkSpawnX + Math.cos(a) * 25;
      const wz = walkSpawnZ + Math.sin(a) * 25;
      const npc = NPCs._spawnRole(wx, wz, "walker");
      if (npc) npc.stateT = 8; // let them loiter
    }
  } catch (e) {}

  /* Wire weapon hooks to scare NPCs */
  walker.opts = walker.opts || {};
  walker.opts.onGunFire   = () => {
    try { NPCs.scare(walker.x, walker.z, 15); } catch (e) {}
    try { Social.onCrime(walker.x, walker.z, "gun"); } catch (e) {}
  };
  walker.opts.onKnifeStab = () => {
    try { NPCs.scare(walker.x, walker.z, 10); } catch (e) {}
    try { Social.onCrime(walker.x, walker.z, "knife"); } catch (e) {}
  };

  /* ── Weapons + emotes on foot (menu, keys, buttons) ────────── */
  try {
    WalkActions.mount({ walker, weapons: walkerWeapons, getMode: () => mode });
  } catch (e) { console.warn("[drive] WalkActions:", e); }

  /* ── Single-player kidnap flow ──────────────────────────────── */
  try {
    Kidnap.mount({
      getWalker:  () => ({ x: walker.x, z: walker.z, yaw: walker.yaw }),
      getVehicle: () => ({ model, x: carPos.x, z: carPos.z, yaw: heading, root: carMesh }),
      getScene:   () => three,
      onGrabIntoCar: () => {
        if (mode !== "drive") {
          walker.x = carPos.x;
          walker.z = carPos.z;
          enterCar(true);
        }
      },
    });
  } catch (e) { console.warn("[drive] Kidnap mount:", e); }

  /* ── Social reactions, world events, job objectives ─────────── */
  window.__ph3d_social = Social;
  try { WorldEvents.init(three); } catch (e) { console.warn("[drive] WorldEvents:", e); }
  try { JobObjectives.init(three, compounds.map((c) => c.lm)); } catch (e) { console.warn("[drive] JobObjectives:", e); }
  try { ObjectiveHUD.mount(); } catch (e) { console.warn("[drive] ObjectiveHUD:", e); }

  /* Any new crime event (not the periodic decay ping) draws a reaction.
     Wrapped once per scene and restored on dispose. */
  let _restoreCrimeHook = null;
  try {
    const Cr = window.__ph3d_crime;
    if (Cr) {
      const orig = Cr.onAlertChange;
      Cr.onAlertChange = function (level, entry) {
        if (orig) orig.call(Cr, level, entry);
        if (level === 0) {
          try { ArrestWatch.cancel(); } catch (e) {}
        }
        if (!entry || level <= 30) return;
        try {
          const pos = window.__ph3d_drive.getPos();
          Social.onCrime(pos.x, pos.z, entry.kind);
        } catch (e) {}
      };
      const mine = Cr.onAlertChange;
      _restoreCrimeHook = () => { if (Cr.onAlertChange === mine) Cr.onAlertChange = orig || null; };
    }
  } catch (e) {}

  return {
    three, camera, controls: { update: function () {} },
    crumb: "OPEN WORLD", title: "PORT HARCOURT",
    subtitle: (mode === "walk") ? "ON FOOT" :
              (model === "cybertruck" ? "CYBERTRUCK" :
               model === "rangerover" ? "RANGE ROVER" :
               model === "mercedes" ? "S-CLASS" :
               model === "bmw" ? "M4" :
               model === "chiron" ? "CHIRON" :
               model === "nk250" ? "QLINK NK250" :
               model === "hoverboard" ? "HOVERBOARD X-1" : "G-WAGON"),
    hint: "",
    dispose: function () {
      try { _unWardrobe(); if (_wdRaf) cancelAnimationFrame(_wdRaf); } catch (_) {}
      try { Sfx.stopAll(); } catch (_) {}
      window.__ph3d_world_aabbs = null;
      window.removeEventListener("keydown", onKD);
      window.removeEventListener("keydown", _onKeyFly); try { walkFlyBtn.remove(); jetVis.dispose(); } catch (e) {}
      window.removeEventListener("keyup", onKU);
      window.removeEventListener("keydown", onKeyE);
      window.removeEventListener("keyup", onKeyE);
      dom.removeEventListener("pointerdown", onPD);
      dom.removeEventListener("pointermove", onPM);
      dom.removeEventListener("pointerup", onPU);
      dom.removeEventListener("pointercancel", onPU);
      try { getOutBtn.remove(); } catch (e) {}
      try { walkRunBtn.remove(); } catch (e) {}
      try { walkJumpBtn.remove(); } catch (e) {}
      try { walkEnterBtn.remove(); } catch (e) {}
      try { walkTalkBtn.remove(); } catch (e) {}
      try { pickBtn.remove(); } catch (e) {}
      try { useBtn.remove(); } catch (e) {}
      try { joyBaseEl.remove(); } catch (e) {}
      try { carSitBtn.remove(); } catch (e) {}
      try { aftermath.remove(); } catch (e) {}
      try { if (character && character.parent) character.parent.remove(character); } catch (e) {}
      try { walkerWeapons.dispose(); } catch (e) {}
      try { WorldObjects.clear(); } catch (e) {}
      try { LocationMarkers.clear(); } catch (e) {}
      try { NPCs.despawn(); } catch (e) {}
      try { NPC_Cars.despawn(); } catch (e) {}
      try { Blood.clear(); } catch (e) {}
      try { WalkActions.unmount(); } catch (e) {}
      try { Kidnap.unmount(); } catch (e) {}
      try { grabBtn.remove(); } catch (e) {}
      try { hornBtn.remove(); } catch (e) {}
      try { Weather.unmount(); } catch (e) {}
      try { if (window.__ph3d_three === three) window.__ph3d_three = null; } catch (e) {}
      try { WorldEvents.despawn(); } catch (e) {}
      try { JobObjectives.despawn(); } catch (e) {}
      try { ObjectiveHUD.unmount(); } catch (e) {}
      try { if (_restoreCrimeHook) _restoreCrimeHook(); } catch (e) {}
      try { if (window.__ph3d_social === Social) window.__ph3d_social = null; } catch (e) {}
    try { document.getElementById("ph3d-pickup-prompt")?.remove(); } catch (e) {}
try {
  for (const car of policeCars) {
    if (car.mesh && car.mesh.parent) car.mesh.parent.remove(car.mesh);
    car.mesh.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(m => m && m.dispose && m.dispose());
      }
    });
  }
  policeCars.length = 0;
} catch (e) {}
      try { three.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m && m.dispose && m.dispose()); } }); } catch (e) {}
      try { const d = document.getElementById("drive-ui"); if (d) d.style.display = "none"; } catch (e) {}
      try { ArrestWatch.destroy(); } catch (e) {}
      delete window.__ph3d_drive;
    },
    update: function (dt, t) {
      try { Weather.tick(dt); } catch (e) {}
      const driveUIEl = document.getElementById("drive-ui");
      if (driveUIEl) driveUIEl.style.display = mode === "drive" ? "block" : "none";

      if (mode === "walk" && walker && window.__ph3d_playerActions) {
        try { window.__ph3d_playerActions.tick(walker, dt); } catch (e) {}
      }
      walkRunBtn.style.display = (mode === "walk") ? "block" : "none";
      walkJumpBtn.style.display = (mode === "walk") ? "block" : "none";
      walkFlyBtn.style.display = (mode === "walk") ? "block" : "none";
      if (mode !== "walk" && jet.on) { jet.on = false; jet.thrust = false; walkFlyBtn.classList.remove("is-on"); walkFlyBtn.textContent = "JETPACK"; }
      hornBtn.style.display = (mode === "drive") ? "block" : "none";

      pickBtn.style.display = (mode === "walk" && window.__ph3d_nearObj) ? "block" : "none";
      useBtn.style.display = (mode === "walk" && window.__ph3d_nearObj) ? "block" : "none";

      if (mode === "walk" && !walker.ragdoll) joyBaseEl.style.display = "block";
      else { joyBaseEl.style.display = "none"; if (walkJoyId !== null) { walkJoyId = null; input.joyX = 0; input.joyY = 0; } }

      if (walker.ragdoll) {
        const rd = walker.ragdoll;
        rd.t += dt;
        if (!rd.landed) {
          rd.vy -= RAGDOLL_GRAVITY * dt;
          walker.x += rd.vx * dt; walker.z += rd.vz * dt; walker.y += rd.vy * dt;
          character.rotation.x += rd.spinX * dt; character.rotation.y += rd.spinY * dt; character.rotation.z += rd.spinZ * dt;
          const groundHere = sampleTerrainMeshHeight(walker.x, walker.z);
          if (walker.y <= groundHere + 0.3 && rd.vy < 0) {
            rd.landed = true; walker.y = groundHere + 0.3;
            rd.vx *= 0.2; rd.vz *= 0.2;
            character.rotation.x = -Math.PI / 2; character.rotation.z = 0; character.rotation.y = walker.yaw;
            setTimeout(showAftermath, 600);
          }
        } else { walker.x += rd.vx * dt; walker.z += rd.vz * dt; }
        character.position.set(walker.x, walker.y, walker.z);
        if (charRig) Limp.step(charRig, character, dt);   /* thrown / run over: joints are dead weight */
        const camBack = 6.0; const camH = Math.max(2.0, walker.y + 3.0);
        const camX = walker.x - Math.sin(walkCameraYaw) * camBack;
        const camZ = walker.z - Math.cos(walkCameraYaw) * camBack;
        camera.position.lerp(new THREE.Vector3(camX, camH, camZ), Math.min(1, dt * 10));
        camera.lookAt(walker.x, walker.y + 0.5, walker.z);
        tickPolice(dt, t, walker.x, walker.z);
        return;
      }

      const px = (mode === "walk") ? walker.x : carPos.x;
      const pz = (mode === "walk") ? walker.z : carPos.z;

      if (sun.castShadow) {
        const dx = px - (sun.target.position.x || 0);
        const dz = pz - (sun.target.position.z || 0);
        if (dx * dx + dz * dz > 40 * 40) {
          sun.position.set(px + 120, 180, pz + 90);
          sun.target.position.set(px, 0, pz);
          sun.target.updateMatrixWorld();
        }
      }

      tickPolice(dt, t, px, pz);

      try { WorldObjects.tick(dt, px, pz); } catch (e) {}
      try { LocationMarkers.tick(dt, camera, px, pz); } catch (e) {}
      try { NPCs.tick(dt, px, pz); } catch (e) {}
      try { NPC_Cars.tick(dt); } catch (e) {}
      try { Blood.tick(dt); } catch (e) {}
      try { Social.tick(dt, px, pz); } catch (e) {}
      try { WorldEvents.tick(dt, px, pz); } catch (e) {}
      try { Kidnap.tick(dt); } catch (e) {}
      try { JobObjectives.tick(dt, px, pz, mode); } catch (e) {}
      try { ObjectiveHUD.tick(px, pz); } catch (e) {}
      try { WalkActions.tick(dt, walker._intentSpeed || 0); } catch (e) {}

      window.__ph3d_player = walker;

      if (mode === "drive") {
        if (RIDE) poseRider(dt); else character.visible = false;
        carSitBtn.style.opacity = "0"; carSitBtn.style.pointerEvents = "none";

        const th = (input.throttle || keys.KeyW || keys.ArrowUp) ? 1 : 0;
        const br = (input.brake || keys.KeyS || keys.ArrowDown) ? 1 : 0;
        const sL = (input.steerL || keys.KeyA || keys.ArrowLeft) ? 1 : 0;
        const sR = (input.steerR || keys.KeyD || keys.ArrowRight) ? 1 : 0;

        const MAX_SPEED = 55, MAX_REV = -10, ACCEL = 28, BRAKE = 36;
        let a = 0;
        if (th) a += ACCEL;
        if (br) a -= (speed > 0.6 ? BRAKE : ACCEL * 0.55);
        speed += a * dt;
        speed -= speed * 0.5 * dt;
        if (!th && !br) speed -= Math.sign(speed) * Math.min(Math.abs(speed), 2.5 * dt);
        const _arrestMul = ArrestWatch.speedMultiplier();   /* 1 normally, 0.2 during arrest countdown */
        speed = Math.max(MAX_REV * _arrestMul, Math.min(MAX_SPEED * _arrestMul, speed));

        const steerInput = sL - sR;
        steer += (steerInput * 0.55 - steer) * Math.min(1, dt * 8);
        heading += steer * 0.55 * (speed / 8) * dt;

        let nx = carPos.x + Math.sin(heading) * speed * dt;
        let nz = carPos.z + Math.cos(heading) * speed * dt;
        const carRadius = 2.4;
        const res = resolveAABBs(nx, nz, carRadius, worldAABBs);
        if (res[0] !== nx || res[1] !== nz) speed *= 0.4;
        carPos.x = res[0]; carPos.z = res[1];

        carPos.x = Math.max(-1900, Math.min(1900, carPos.x));
        carPos.z = Math.max(-1900, Math.min(1900, carPos.z));

        const fx = Math.sin(heading), fz = Math.cos(heading);
        const rx = Math.cos(heading), rz = -Math.sin(heading);
        const halfLen = carSize.z * 0.5, halfWid = carSize.x * 0.5;
        const hFront = sampleTerrainMeshHeight(carPos.x + fx * halfLen, carPos.z + fz * halfLen);
        const hBack  = sampleTerrainMeshHeight(carPos.x - fx * halfLen, carPos.z - fz * halfLen);
        const hRight = sampleTerrainMeshHeight(carPos.x + rx * halfWid, carPos.z + rz * halfWid);
        const hLeft  = sampleTerrainMeshHeight(carPos.x - rx * halfWid, carPos.z - rz * halfWid);
        const carY = (hFront + hBack + hLeft + hRight) * 0.25 + 0.02;
        const pitch = Math.atan2(hBack - hFront, carSize.z);
        const roll  = Math.atan2(hRight - hLeft, carSize.x);

        carRoot.position.set(carPos.x, carY, carPos.z);
        carRoot.rotation.set(pitch, heading, -roll, "YXZ");

        wheelRot += (speed * dt / 0.44) * 0.42;
        if (wheelRot > Math.PI * 2) wheelRot -= Math.PI * 2;
        if (carMesh.userData && carMesh.userData.isNK250) {
          const sf = Math.min(1, Math.abs(speed) / 20);
          const targetLean = -steer * 0.8 * sf;   /* steer>0 = left → lean left */
          carMesh.rotation.z += (targetLean - carMesh.rotation.z) * Math.min(1, dt * 6);
        }
        if (carMesh.userData && carMesh.userData.isHoverboard) {
          const u = carMesh.userData, sf = Math.min(1, Math.abs(speed) / 15);
          carMesh.rotation.z += (-steer * 0.7 * sf - carMesh.rotation.z) * Math.min(1, dt * 6);
          const hb = u.hoverBoard;
          if (hb) hb.position.y = 0.34 + Math.sin(t * 1.5) * 0.03 + Math.sin(t * 3.1) * 0.006;
          u.spinners[0].rotation.y += dt * 15; u.spinners[1].rotation.y -= dt * 15;
        }
        const ws = carMesh.userData && carMesh.userData.wheels;
        if (ws) {
          for (const w of ws) {
            if (w.spin && w.pivot) { if (w.spinZ) w.spin.rotation.z = -wheelRot; else w.spin.rotation.x = wheelRot; if (w.steer) w.pivot.rotation.y = steer; }
            else if (w.mesh) { if (w.spinZ) w.mesh.rotation.z = -wheelRot; else w.mesh.rotation.x = wheelRot; }
          }
        }

        if (carWing) {
          const rise = Math.min(Math.abs(speed) / 95, 1) * 0.18;
          carWing.position.y = 1.00 + rise;
          carWing.rotation.z = -0.14 - rise * 1.2;
          if (carWingLight) carWingLight.material.emissiveIntensity = 0.3 + Math.min(Math.abs(speed) / 95, 1) * 0.9;
        }

        if (model === "scrappy") {
          const dp = carMesh.userData && carMesh.userData.doorPivot;
          if (dp) {
            dp.rotation.y = -0.035 + Math.sin(t * 13.0) * 0.024 + Math.sin(t * 27.7) * 0.010;
            dp.rotation.x = Math.sin(t * 19.3) * 0.006;
            dp.position.y = 0.72 + Math.abs(Math.sin(t * 19.0)) * 0.008;
          }
          const ws2 = carMesh.userData && carMesh.userData.wheels;
          if (ws2 && ws2[0] && ws2[0].shaky) {
            ws2[0].pivot.rotation.z = Math.sin(t * 22.0) * 0.105;
            ws2[0].pivot.rotation.y = Math.sin(t * 15.5) * 0.075;
            ws2[0].pivot.position.y = 0.36 + Math.abs(Math.sin(t * 11.0)) * 0.022;
          }
        }

        const camHeading = heading + cameraYaw;
        _cf.set(Math.sin(camHeading), 0, Math.cos(camHeading));
        _cr.set(Math.cos(camHeading), 0, -Math.sin(camHeading));
        const dist = 9.5 + Math.abs(speed) * 0.12;
        const h = 3.6 + cameraPitch * 5.5;
        _camP.set(carPos.x - _cf.x * dist + _cr.x * 0.8, carY + h, carPos.z - _cf.z * dist + _cr.z * 0.8);
        camera.position.lerp(_camP, Math.min(1, dt * 6));
        _camL.set(carPos.x + _cf.x * 7, carY + 1.5, carPos.z + _cf.z * 7);
        camera.up.set(0, 1, 0);
        camera.lookAt(_camL);

        if (hudEl) {
          let hud = Math.round(Math.abs(speed) * 3.6) + " km/h";
          if (model === "chiron") {
            const rpm = (1.0 + Math.min(Math.abs(speed) / 95, 1) * 7.5).toFixed(1);
            hud += "  ·  " + rpm + "k rpm";
          }
          hudEl.textContent = hud;
        }
      } else {
        character.visible = true;
        let horizSpeed = 0;
        refreshCarSeats();
        /* nearest car seat (bonnet / roof) within reach, else ground-sit */
        walker.nearSeat = null;
        if (!walker.sitting && !walker.ragdoll) {
          let bd = 1.9 * 1.9;
          for (const seat of carSeats) {
            const sx = seat.x - walker.x, sz = seat.z - walker.z, d2 = sx * sx + sz * sz;
            if (d2 < bd) { bd = d2; walker.nearSeat = seat; }
          }
        }
        if (walker.ragdoll) {
          carSitBtn.style.opacity = "0"; carSitBtn.style.pointerEvents = "none";
        } else {
          carSitBtn.textContent = walker.sitting ? "STAND UP"
            : (walker.nearSeat ? walker.nearSeat.label : "SIT HERE");
          carSitBtn.style.opacity = "1"; carSitBtn.style.pointerEvents = "auto";
        }
        /* walking input while sitting on the ground stands you back up */
        if (walker.sitting && walker.sitting.ground) {
          const _jx = input.joyX || 0, _jy = input.joyY || 0;
          const _k = (keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight);
          if (Math.hypot(_jx, _jy) > 0.35 || _k) walker.sitting = null;
        }
        try {
          const H = window.__ph3d_hunt;
          if (H && H.active && walkerWeapons.current !== "fists" && walkerWeapons.current !== "knife") walkerWeapons.select("knife");
        } catch (e) {}

        if (walker.sitting) {
          const dx = Math.abs(walker.x - walker.sitting.x);
          const dz = Math.abs(walker.z - walker.sitting.z);
          if (dx * dx + dz * dz > 1.2 * 1.2) walker.sitting = null;
        }

        if (walker.sitting) {
          walker.x = walker.sitting.x; walker.z = walker.sitting.z;
          walker.y = walker.sitting.y - HIP_HEIGHT + 0.10;
          walker.yaw = walker.sitting.yaw;
          walker.vy = 0; walker.onGround = true;
          /* pose the avatar: same seat maths as ThirdPersonControls */
          walker.state = "sitting";
          walker.sitTarget = { x: walker.sitting.x, z: walker.sitting.z, h: walker.sitting.y, yaw: walker.sitting.yaw };
          walker.level = 0;
          walker._groundInfo = (gx, gz) => ({ y: sampleTerrainMeshHeight(gx, gz) });
          walker._ul = () => {};
          walker.rig = charRig;
          walker._intentSpeed = 0;
          character.position.set(walker.x, walker.y, walker.z);
          character.rotation.y = walker.yaw;
          try { Animator.animate(walker, dt); } catch (err) { console.error("[sit animate]", err); }
        } else {
          walker.sitTarget = null;
          if (charRig.hips) { charRig.hips.rotation.set(0, 0, 0); charRig.hips.position.y = HIP_HEIGHT; }
          if (charRig.spine) charRig.spine.rotation.set(0, 0, 0);
          if (charRig.legL && charRig.legL.hip) charRig.legL.hip.rotation.z = 0;
          if (charRig.legR && charRig.legR.hip) charRig.legR.hip.rotation.z = 0;
          if (charRig.legL && charRig.legL.ankle) charRig.legL.ankle.rotation.x = 0;
          if (charRig.legR && charRig.legR.ankle) charRig.legR.ankle.rotation.x = 0;
          if (charRig.armL && charRig.armL.shoulder) charRig.armL.shoulder.rotation.z = 0;
          if (charRig.armR && charRig.armR.shoulder) charRig.armR.shoulder.rotation.z = 0;

          let mx = input.joyX, mz = input.joyY;
          if (keys.KeyW || keys.ArrowUp) mz -= 1;
          if (keys.KeyS || keys.ArrowDown) mz += 1;
          if (keys.KeyA || keys.ArrowLeft) mx -= 1;
          if (keys.KeyD || keys.ArrowRight) mx += 1;
          const jm = Math.sqrt(mx * mx + mz * mz);
          if (jm > 1) { mx /= jm; mz /= jm; }

          const run = walkRunHold || !!(keys.ShiftLeft || keys.ShiftRight);
          const sp = (run ? WALK_SPEED * 1.7 : WALK_SPEED) * (window.__ph3d_moveSpeed || 1) * (jet.on && !walker.onGround ? 1.8 : 1) * (walker._carryMul || 1) * (Weather.walkMul || 1);

          const camFx = Math.sin(walkCameraYaw), camFz = Math.cos(walkCameraYaw);
          const camRx = Math.cos(walkCameraYaw), camRz = -Math.sin(walkCameraYaw);
          const worldDirX = camFx * (-mz) - camRx * mx;
          const worldDirZ = camFz * (-mz) - camRz * mx;

          try { Sfx.stepTick(dt, jm > 0.15 && walker.onGround && !jet.on, run); } catch (_) {}
          if (jm > 0.15) {
            const targetYaw = Math.atan2(worldDirX, worldDirZ);
            let dYaw = targetYaw - walker.yaw;
            while (dYaw > Math.PI) dYaw -= TAU;
            while (dYaw < -Math.PI) dYaw += TAU;
            const turnRate = run ? 14 : 10;
            walker.yaw += dYaw * Math.min(1, dt * turnRate);
          }

          const _arrestMul = ArrestWatch.speedMultiplier();
          const moveX = worldDirX * sp * _arrestMul * dt;
          const moveZ = worldDirZ * sp * _arrestMul * dt;
          const _dtSafe = Math.max(1e-4, Math.min(dt, 0.05));
          horizSpeed = Math.hypot(moveX, moveZ) / _dtSafe;

          let nx = walker.x + moveX;
          let nz = walker.z + moveZ;

          const res = resolveAABBs(nx, nz, WALK_RADIUS, worldAABBs, walker.y);
          walker.x = res[0]; walker.z = res[1];

          try {
            const npcCars = window.__ph3d_npc_cars;
            if (npcCars && npcCars.list) {
              for (const npcCar of npcCars.list) {
                const dx = walker.x - npcCar.mesh.position.x;
                const dz = walker.z - npcCar.mesh.position.z;
                const r = npcCar.radius + WALK_RADIUS;
                const d2 = dx*dx + dz*dz;
                if (d2 < r*r && d2 > 1e-6) {
                  const d = Math.sqrt(d2);
                  walker.x = npcCar.mesh.position.x + (dx/d)*r;
                  walker.z = npcCar.mesh.position.z + (dz/d)*r;
                }
              }
            }
          } catch (e) {}

          const dxC = walker.x - carPos.x;
          const dzC = walker.z - carPos.z;
          const cH = Math.cos(heading), sH = Math.sin(heading);
          const localX = dxC * cH - dzC * sH;
          const localZ = dxC * sH + dzC * cH;
          const halfW = carSize.x * 0.5, halfL = carSize.z * 0.5;
          const TOUCH_SKIN = 0.25;
          const reachW = halfW + Math.max(0.05, WALK_RADIUS - TOUCH_SKIN);
          const reachL = halfL + Math.max(0.05, WALK_RADIUS - TOUCH_SKIN);
          const insideX = Math.abs(localX) < reachW;
          const insideZ = Math.abs(localZ) < reachL;
          let groundLevel = sampleTerrainMeshHeight(walker.x, walker.z);

          for (const p of walkablePlatforms) {
            if (walker.x > p.minX && walker.x < p.maxX && walker.z > p.minZ && walker.z < p.maxZ) {
              if (walker.y >= p.top - 0.15) groundLevel = Math.max(groundLevel, p.top);
            }
          }

          if (insideX && insideZ) {
            if (CAN_STAND_ON && walker.y >= roofHeight - 0.30 + groundLevel - getTerrainHeight(carPos.x, carPos.z)) {
              const relZ = localZ / carSize.z;
              if (relZ > 0.30) groundLevel = Math.max(groundLevel, getTerrainHeight(carPos.x, carPos.z) + carSize.y * surf.hood);
              else if (relZ < -0.30) groundLevel = Math.max(groundLevel, getTerrainHeight(carPos.x, carPos.z) + carSize.y * surf.trunk);
              else groundLevel = Math.max(groundLevel, getTerrainHeight(carPos.x, carPos.z) + carSize.y * surf.roof);
            } else {
              const overlapX = reachW - Math.abs(localX);
              const overlapZ = reachL - Math.abs(localZ);
              let lxW = localX, lzW = localZ;
              if (overlapX < overlapZ) { const sgn = (Math.abs(prevLocalX) > 1e-4) ? Math.sign(prevLocalX) : Math.sign(lxW || 1); lxW = sgn * reachW; }
              else { const sgn = (Math.abs(prevLocalZ) > 1e-4) ? Math.sign(prevLocalZ) : Math.sign(lzW || 1); lzW = sgn * reachL; }
              walker.x = carPos.x + lxW * cH + lzW * sH;
              walker.z = carPos.z - lxW * sH + lzW * cH;
            }
          }
          prevLocalX = localX; prevLocalZ = localZ;

          if (!walker.ragdoll) {
            if (jet.on) {
              const want = (jet.thrust || keys.Space) && jet.fuel > 0;
              if (want) {
                if (walker.onGround) { walker.onGround = false; walker.y += 0.05; walker.vy = Math.max(walker.vy, 2); }
                walker.vy = Math.min(9, walker.vy + 38 * dt);
                jet.fuel = Math.max(0, jet.fuel - dt * 0.2);
              } else if (!walker.onGround) {
                walker.vy = Math.max(-7, walker.vy - 14 * dt);
              }
              if (walker.onGround || !want) jet.fuel = Math.min(1, jet.fuel + dt * (walker.onGround ? 0.5 : 0.04));
              walkFlyBtn.textContent = "JETPACK " + Math.round(jet.fuel * 100) + "%";
            }
            jetVis.update(dt, jet.on, jet.on && (jet.thrust || keys.Space) && jet.fuel > 0);
            if (!walker.onGround) {
              walker.vy -= (jet.on ? 0 : 20) * dt;
              walker.y += walker.vy * dt;
              if (walker.vy <= 0 && walker.y <= groundLevel) { walker.y = groundLevel; walker.vy = 0; walker.onGround = true; }
            } else { walker.y = groundLevel; }

            character.position.set(walker.x, walker.y, walker.z);
            character.rotation.y = walker.yaw;

            walker._intentSpeed = horizSpeed;
            walker.rig = charRig;
            walker.vel = { y: walker.vy };
            walker.state = walker.sitting ? "sitting" : "standing";
            walker.running = walkRunHold;
            walker._ul = () => {};

            try {
              walkerWeapons.update(dt, walkerWeapons.isArmed() ? WalkActions.targets() : []);
              Animator.animate(walker, dt);
              if (window.__ph3d_playerActions) {
                try { window.__ph3d_playerActions.tick(walker, dt); } catch (e) {}
              }
            } catch (err) { console.error("[walk update] Animator crashed:", err); }

            /* jetpack flight pose: lean/lie forward into the air, pivoting about the hips */
            {
              const flying = jet.on && !walker.onGround;
              const want = flying ? Math.min(1.3, 0.22 + Math.min(1, horizSpeed / 9) * 1.1) : 0;
              jet.tilt += (want - jet.tilt) * Math.min(1, dt * 6);
              if (jet.tilt < 0.002 && !flying) jet.tilt = 0;
              character.rotation.order = "YXZ";
              character.rotation.x = jet.tilt;
              const HP = 1.0, c = Math.cos(jet.tilt), sn = Math.sin(jet.tilt);
              character.position.y = walker.y + HP * (1 - c);
              character.position.x = walker.x - Math.sin(walker.yaw) * HP * sn;
              character.position.z = walker.z - Math.cos(walker.yaw) * HP * sn;
              if (flying && charRig.legL && charRig.legL.hip && charRig.legR && charRig.legR.hip) {
                charRig.legL.hip.rotation.x = 0.15; charRig.legR.hip.rotation.x = 0.15;
              }
            }
          }
        }

        if (walker.y < -5 && !walker.ragdoll) {
          if (window.__ph3d_phone) window.__ph3d_phone._toast("You fell in the water!");
          walker.x = SPAWN_X; walker.z = SPAWN_Z;
          walker.y = sampleTerrainMeshHeight(SPAWN_X, SPAWN_Z);
          walker.vy = 0;
        }

        const camBack = 5.0;
        const camH = Math.max(1.4, walker.y + 2.6 + walker.pitch * 1.8);
        const camX = walker.x - Math.sin(walkCameraYaw) * camBack;
        const camZ = walker.z - Math.cos(walkCameraYaw) * camBack;
        const targetY = walker.y + 0.9;
        camera.position.lerp(new THREE.Vector3(camX, camH, camZ), Math.min(1, dt * 8));
        camera.lookAt(walker.x, targetY, walker.z);

        if (hudEl) hudEl.textContent = Math.round(horizSpeed * 3.6) + " km/h";

        /* Hunt: out-of-bounds forfeits the prize */
        try {
          const H = window.__ph3d_hunt;
          if (H && H.active && (Math.abs(walker.x) > 800 || Math.abs(walker.z) > 800)) {
            H._end("out_of_bounds");
            window.__ph3d_phone?._toast("❌ You left the zone. Prize forfeited.");
          }
        } catch (e) {}
      }

      let planeBest = null;
      let planeBd = 22 * 22;
      for (const g of planeGates) {
        const _rp = (mode === "walk") ? walker : carPos;
        const dx = g.x - _rp.x, dz = g.z - _rp.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < planeBd) { planeBd = d2; planeBest = g; }
      }
      nearPlaneGate = planeBest;

      if (mode === "drive") {
        if (walkEnterBtn) walkEnterBtn.style.display = "none";
        if (walkTalkBtn) walkTalkBtn.style.display = "none";
        if (grabBtn) grabBtn.style.display = "none";
        let best = null, bd = 22 * 22;
        for (const c of compounds) {
          const dx = c.x - carPos.x, dz = c.z - carPos.z;
          const d = dx * dx + dz * dz;
          if (d < bd) { bd = d; best = c; }
        }
        nearGate = best;
        if (enterBtn) {
          if (nearPlaneGate) { enterBtn.style.display = "flex"; enterBtn.textContent = "ENTER · AIRPLANE"; }
          else if (nearGate) { enterBtn.style.display = "flex"; enterBtn.textContent = "ENTER \u00B7 " + nearGate.lm.name; }
          else { enterBtn.style.display = "none"; }
        }
      } else {
        if (enterBtn) enterBtn.style.display = "none";

        /* Kidnap grab button — show above talk btn when downed NPC nearby */
        if (!Kidnap.isHolding()) {
          try {
            const grabTarget = Kidnap.nearestTarget(walker.x, walker.z, 2.6);
            if (grabTarget) {
              grabBtn._target = grabTarget;
              grabBtn.textContent = "GRAB · " + ((grabTarget.roleDef && grabTarget.roleDef.label) || "PEDESTRIAN").toUpperCase();
              grabBtn.style.display = "block";
            } else {
              grabBtn._target = null;
              grabBtn.style.display = "none";
            }
          } catch (e) { grabBtn.style.display = "none"; }
        } else {
          grabBtn.style.display = "none";
        }

        let npcNear = null;
        try { npcNear = NPCs.nearest(walker.x, walker.z, 2.5); } catch (e) {}

        if (npcNear) {
          walkTalkBtn._npc = npcNear;
          walkTalkBtn.style.display = "block";
          if (walkEnterBtn) walkEnterBtn.style.display = "none";
          nearGate = null;
        } else {
          walkTalkBtn._npc = null;
          walkTalkBtn.style.display = "none";

          let wbest = null, wbd = 28 * 28;
          for (const c of compounds) {
            const dx = c.x - walker.x, dz = c.z - walker.z;
            const d = dx * dx + dz * dz;
            if (d < wbd) { wbd = d; wbest = c; }
          }
          nearGate = wbest;
          if (walkEnterBtn) {
            if (nearPlaneGate) { walkEnterBtn.style.display = "block"; walkEnterBtn.textContent = "ENTER \u00B7 AIRPLANE"; }
            else if (wbest) { walkEnterBtn.style.display = "block"; walkEnterBtn.textContent = "ENTER \u00B7 " + wbest.lm.name; }
            else walkEnterBtn.style.display = "none";
          }
        }
      }
    },
  };
}
