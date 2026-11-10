/* ============================================================
   drive-zones.js — driveable vehicle for ONE open-world scene.
   Attach only to: university, vastcity, vatican, exterior.
   ============================================================ */
import * as THREE from "three";
import { Auth } from "./auth.js";
import { State } from "./state.js";
import { buildGWagon3D } from "../vehicles/gwagon3d.js";
import { buildCybertruck3D } from "../vehicles/cybertruck3d.js";
import { buildRangeRover3D } from "../vehicles/rangerover_compound.js";
import { buildMercedes3D } from "../vehicles/mercedes3d.js";
import { buildBMW3D } from "../vehicles/bmw3d.js";
import { buildChiron3D } from "../vehicles/chiron3d.js";
import { buildScrappy3D } from "../vehicles/scrappy3d.js";
import { addCarLights } from "./car-lights.js";

function buildCar(model, body, rim) {
  switch (model) {
    case "gwagon":     return buildGWagon3D(body, rim);
    case "cybertruck": return buildCybertruck3D(body, rim);
    case "rangerover": return buildRangeRover3D(body, rim);
    case "mercedes":   return buildMercedes3D(body, rim);
    case "bmw":        return buildBMW3D(body, rim);
    case "chiron":     return buildChiron3D(body, rim);
    case "scrappy":    return buildScrappy3D(body, rim);
    default:
      try { return buildScrappy3D(body, rim); }
      catch (e) { return buildScrappy3D(body, rim); }
  }
}
function ownedCars() {
  try {
    const list = (Auth.user && Auth.user.cars) || [];
    return list.length ? list : (State.owned || ["scrappy"]);
  } catch (e) { return ["scrappy"]; }
}

const CAR_RADIUS = 2.5;
const ENTER_RANGE = 3.4;
const SPEED = 14, REVERSE = 6, TURN = 1.6, ACCEL = 12, BRAKE = 22, DRAG = 1.6;

/* park lot placement: shift away from walls/furniture */
function findClearSpot(world, x, z, r) {
  const cols = (world && world.colliders) || [];
  const clear = (px, pz) => {
    const bd = world && world.bounds;
    if (bd && (px < bd.minX + r || px > bd.maxX - r || pz < bd.minZ + r || pz > bd.maxZ - r)) return false;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (c.level !== 0) continue;
      const y1 = c.y1 != null ? c.y1 : 60;
      if (y1 < 1.0) continue;
      if (px > c.minX - r && px < c.maxX + r && pz > c.minZ - r && pz < c.maxZ + r) return false;
    }
    return true;
  };
  if (clear(x, z)) return { x, z };
  for (let ring = 1; ring <= 8; ring++) {
    for (let a = 0; a < 12; a++) {
      const ang = a / 12 * Math.PI * 2;
      const tx = x + Math.cos(ang) * ring * 2.6;
      const tz = z + Math.sin(ang) * ring * 2.6;
      if (clear(tx, tz)) return { x: tx, z: tz };
    }
  }
  return { x, z };
}

export const ZoneDrive = {
  _state: null,

  attach({ scene, camera, renderer, world, spawn }) {
    if (this._state) this.dispose();

    const S = {
      scene, camera, renderer, world,
      mode: "walk",
      lot: [], activeLot: null, pendingLot: null,
      car: null, carVel: 0, carYaw: 0,
      carPos: new THREE.Vector3(),
      keys: Object.create(null),
      joy: { on: false, id: null, dx: 0, dy: 0, ox: 0, oy: 0 },
      btn: null, exitBtn: null, hud: null,
      _lights: null,
    };
    this._state = S;

    /* park one car per owned vehicle near the spawn */
    const owned = ownedCars();
    const body = (Auth.user && Auth.user.vehicle && Auth.user.vehicle.body) || "#4d6b74";
    const rim  = (Auth.user && Auth.user.vehicle && Auth.user.rim)  || "#8d9298";
    owned.forEach((model, i) => {
      let g;
      try { g = buildCar(model, body, rim); }
      catch (e) { console.warn("[zone-drive] car failed:", model, e); return; }
      const spot = findClearSpot(world, spawn.x + 3 + (i % 3) * 4.0, spawn.z + 5 + Math.floor(i / 3) * 4.0, CAR_RADIUS);
      g.position.set(spot.x, (spawn.y || 0) + 0.02, spot.z);
      g.rotation.y = -Math.PI / 2;
      g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(g);
      S.lot.push({ group: g, model, body, rim });
    });

    /* DRIVE button */
    const b = document.createElement("button");
    b.id = "ph3d-zone-drive";
    b.type = "button";
    b.textContent = "DRIVE";
    b.style.cssText =
      "position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px)+100px);" +
      "transform:translateX(-50%);z-index:31;padding:14px 26px;border-radius:999px;" +
      "border:none;background:linear-gradient(135deg,#7dff9b,#4ade80);color:#031a0d;" +
      "font:900 12px Inter,system-ui,sans-serif;letter-spacing:.14em;" +
      "box-shadow:0 10px 26px rgba(0,0,0,.55);display:none;cursor:pointer;" +
      "touch-action:manipulation;pointer-events:auto;";
    b.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); this._enter(); }, { passive: false });
    document.body.appendChild(b);
    S.btn = b;

    /* EXIT button */
    const x = document.createElement("button");
    x.id = "ph3d-zone-exit";
    x.type = "button";
    x.textContent = "EXIT CAR";
    x.style.cssText =
      "position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px)+100px);" +
      "transform:translateX(-50%);z-index:31;padding:14px 26px;border-radius:999px;" +
      "border:none;background:linear-gradient(135deg,#ff7a55,#e5482a);color:#fff;" +
      "font:900 12px Inter,system-ui,sans-serif;letter-spacing:.14em;" +
      "box-shadow:0 10px 26px rgba(0,0,0,.55);display:none;cursor:pointer;" +
      "touch-action:manipulation;pointer-events:auto;";
    x.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); this._exit(); }, { passive: false });
    document.body.appendChild(x);
    S.exitBtn = x;

    /* keys */
    S._kd = (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      S.keys[e.code] = true;
      if (S.mode === "drive" && (e.code === "KeyE" || e.code === "KeyF")) { e.preventDefault(); this._exit(); }
    };
    S._ku = (e) => { S.keys[e.code] = false; };
    window.addEventListener("keydown", S._kd);
    window.addEventListener("keyup", S._ku);

    /* steering via left-side drag on the canvas */
    S._pd = (e) => {
      if (S.mode !== "drive") return;
      const w = renderer.domElement.clientWidth;
      if (e.clientX < w * 0.5 && !S.joy.on) {
        S.joy.on = true; S.joy.id = e.pointerId;
        S.joy.dx = S.joy.dy = 0; S.joy.ox = e.clientX; S.joy.oy = e.clientY;
      }
    };
    S._pm = (e) => {
      if (S.mode !== "drive" || !S.joy.on || e.pointerId !== S.joy.id) return;
      const dx = e.clientX - S.joy.ox, dy = e.clientY - S.joy.oy;
      const m = Math.min(80, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
      S.joy.dx = Math.cos(a) * m / 80; S.joy.dy = Math.sin(a) * m / 80;
    };
    S._pu = (e) => { if (e.pointerId === S.joy.id) { S.joy.on = false; S.joy.id = null; S.joy.dx = S.joy.dy = 0; } };
    renderer.domElement.addEventListener("pointerdown", S._pd);
    renderer.domElement.addEventListener("pointermove", S._pm);
    renderer.domElement.addEventListener("pointerup", S._pu);
    renderer.domElement.addEventListener("pointercancel", S._pu);

    /* speed HUD */
    const hud = document.createElement("div");
    hud.id = "ph3d-zone-speedo";
    hud.textContent = "0 km/h";
    hud.style.cssText =
      "position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px)+74px);" +
      "transform:translateX(-50%);z-index:28;padding:8px 16px;border-radius:12px;" +
      "background:rgba(8,16,28,.82);border:1px solid rgba(94,224,255,.5);" +
      "color:#7dff9b;font:800 13px Inter,system-ui,sans-serif;letter-spacing:.06em;" +
      "font-variant-numeric:tabular-nums;display:none;pointer-events:none;";
    document.body.appendChild(hud);
    S.hud = hud;

    return this;
  },

  isDriving() { return !!(this._state && this._state.mode === "drive"); },

  _playerPos() {
    const c = window.__ph3d_walkCtrl || window.__ph3d_tp;
    return c && c.pos ? { x: c.pos.x, z: c.pos.z } : { x: 0, z: 0 };
  },
  _nearestLotCar() {
    const p = this._playerPos();
    let best = null, bestD = ENTER_RANGE;
    for (const entry of this._state.lot) {
      if (!entry.group.visible) continue;
      const d = Math.hypot(entry.group.position.x - p.x, entry.group.position.z - p.z);
      if (d < bestD) { bestD = d; best = entry; }
    }
    return best;
  },

  _enter() {
    const S = this._state; if (!S || S.mode === "drive") return;
    const target = S.pendingLot; if (!target) return;

    /* hide the walking avatar */
    const walker = window.__ph3d_walkCtrl || window.__ph3d_tp;
    if (walker && walker.avatar) walker.avatar.visible = false;

    /* build or reuse the drivable car */
    if (!S.car) {
      S.car = buildCar(target.model, target.body, target.rim);
      S.car.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      S.scene.add(S.car);
      try { S._lights = addCarLights(S.car); } catch (e) { S._lights = null; }
    }
    S.car.visible = true;
    S.car.position.copy(target.group.position);
    S.car.rotation.y = target.group.rotation.y;
    S.carYaw = target.group.rotation.y;
    S.carPos.copy(target.group.position);
    S.carVel = 0;

    /* hide the parked ghost; remember which lot we came from */
    target.group.visible = false;
    S.activeLot = target;

    S.mode = "drive";
    S.btn.style.display = "none";
    S.exitBtn.style.display = "block";
    S.hud.style.display = "block";
  },

  _exit() {
    const S = this._state; if (!S || S.mode !== "drive") return;

    /* hide driving car, drop the ghost back in its place */
    S.car.visible = false;
    if (S.activeLot) {
      S.activeLot.group.position.copy(S.car.position);
      S.activeLot.group.rotation.y = S.car.rotation.y;
      S.activeLot.group.visible = true;
      S.activeLot = null;
    }

    /* teleport walker beside the car */
    const walker = window.__ph3d_walkCtrl || window.__ph3d_tp;
    if (walker) {
      if (walker.avatar) walker.avatar.visible = true;
      const dx = Math.sin(S.carYaw + Math.PI / 2) * 2.6;
      const dz = Math.cos(S.carYaw + Math.PI / 2) * 2.6;
      walker.pos.x = S.car.position.x + dx;
      walker.pos.z = S.car.position.z + dz;
      walker.yaw = S.carYaw;
      try {
        if (S.world && S.world.groundAt) walker.floorY = S.world.groundAt(walker.pos.x, walker.pos.z);
      } catch (e) {}
    }

    S.mode = "walk";
    S.exitBtn.style.display = "none";
    S.hud.style.display = "none";
  },

  update(dt) {
    const S = this._state; if (!S) return;
    dt = Math.min(dt, 0.05);

    if (S.mode === "walk") {
      const near = this._nearestLotCar();
      S.pendingLot = near;
      S.btn.style.display = near ? "block" : "none";
      return;
    }

    /* drive physics */
    let throttle = 0, steer = 0, brake = 0;
    const k = S.keys;
    if (k.KeyW || k.ArrowUp)    throttle += 1;
    if (k.KeyS || k.ArrowDown)  throttle -= 1;
    if (k.KeyA || k.ArrowLeft)  steer -= 1;
    if (k.KeyD || k.ArrowRight) steer += 1;
    throttle += -S.joy.dy;
    steer    +=  S.joy.dx;
    if (S.joy.on && Math.hypot(S.joy.dx, S.joy.dy) < 0.15) throttle = 0;
    if (k.Space) brake = 1;
    throttle = Math.max(-1, Math.min(1, throttle));
    steer    = Math.max(-1, Math.min(1, steer));

    if (throttle !== 0) S.carVel += ACCEL * throttle * dt;
    if (brake) S.carVel -= BRAKE * dt * Math.sign(S.carVel || 1);
    S.carVel -= S.carVel * DRAG * dt;
    S.carVel = Math.max(-REVERSE, Math.min(SPEED, S.carVel));
    if (Math.abs(S.carVel) < 0.05) S.carVel = 0;

    const sf = Math.min(1, Math.abs(S.carVel) / 6);
    S.carYaw += steer * TURN * dt * sf * (S.carVel >= 0 ? 1 : -1);

    const nx = S.carPos.x + Math.sin(S.carYaw) * S.carVel * dt;
    const nz = S.carPos.z + Math.cos(S.carYaw) * S.carVel * dt;
    if (!this._blocked(nx, nz)) { S.carPos.x = nx; S.carPos.z = nz; }
    else if (!this._blocked(nx, S.carPos.z)) { S.carPos.x = nx; S.carVel *= 0.85; }
    else if (!this._blocked(S.carPos.x, nz)) { S.carPos.z = nz; S.carVel *= 0.85; }
    else S.carVel = 0;

    let gy = 0;
    try {
      if (S.world && S.world.groundAt) gy = S.world.groundAt(S.carPos.x, S.carPos.z);
    } catch (e) {}
    S.car.position.set(S.carPos.x, gy + 0.02, S.carPos.z);
    S.car.rotation.y = S.carYaw;

    /* headlights + brake lights */
    try {
      const night = (window.__ph3d_daynight && window.__ph3d_daynight.nightAmount) ? window.__ph3d_daynight.nightAmount() : 0;
      S._lights && S._lights.setNight(night);
      S._lights && S._lights.setBrake(!!brake || k.KeyS || k.ArrowDown);
    } catch (e) {}

    /* chase camera */
    const cam = S.camera;
    if (cam) {
      const back = 8.5, up = 4.2;
      const tx = S.carPos.x - Math.sin(S.carYaw) * back;
      const tz = S.carPos.z - Math.cos(S.carYaw) * back;
      const ty = gy + up;
      cam.position.x += (tx - cam.position.x) * Math.min(1, dt * 5);
      cam.position.z += (tz - cam.position.z) * Math.min(1, dt * 5);
      cam.position.y += (ty - cam.position.y) * Math.min(1, dt * 5);
      cam.lookAt(S.carPos.x + Math.sin(S.carYaw) * 3, gy + 1.4, S.carPos.z + Math.cos(S.carYaw) * 3);
    }

    S.hud.textContent = Math.round(Math.abs(S.carVel) * 3.6) + " km/h";
  },

  _blocked(x, z) {
    const S = this._state; if (!S || !S.world) return false;
    const cols = S.world.colliders;
    if (cols) {
      const r = CAR_RADIUS;
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i];
        if (c.level !== 0) continue;
        const y1 = c.y1 != null ? c.y1 : 60;
        if (y1 < 1.0) continue;
        if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true;
      }
    }
    const bd = S.world.bounds;
    if (bd && (x < bd.minX + CAR_RADIUS || x > bd.maxX - CAR_RADIUS ||
               z < bd.minZ + CAR_RADIUS || z > bd.maxZ - CAR_RADIUS)) return true;
    return false;
  },

  dispose() {
    const S = this._state; if (!S) return;
    if (S._kd) window.removeEventListener("keydown", S._kd);
    if (S._ku) window.removeEventListener("keyup", S._ku);
    if (S.renderer) {
      S.renderer.domElement.removeEventListener("pointerdown", S._pd);
      S.renderer.domElement.removeEventListener("pointermove", S._pm);
      S.renderer.domElement.removeEventListener("pointerup", S._pu);
      S.renderer.domElement.removeEventListener("pointercancel", S._pu);
    }
    try { S.btn && S.btn.remove(); } catch (e) {}
    try { S.exitBtn && S.exitBtn.remove(); } catch (e) {}
    try { S.hud && S.hud.remove(); } catch (e) {}
    try { S._lights && S._lights.dispose(); } catch (e) {}
    for (const entry of S.lot) {
      if (entry.group && entry.group.parent) entry.group.parent.remove(entry.group);
    }
    if (S.car && S.car.parent) S.car.parent.remove(S.car);
    this._state = null;
  },
};
