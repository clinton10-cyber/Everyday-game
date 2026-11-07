/* zonedrive.js -- drive around a place's minimap zone, on the exact
   same layout the minimap draws (_zoneworld.js): same ring road, same
   buildings in the same spots.
   Compact arcade car model (not the full open-city drive.js rig --
   this is a small bounded zone) with a chase camera, building
   collision, and drive-up-to-enter on any compound gate. */
import * as THREE from "three";
import { buildZoneWorld } from "../places/_zoneworld.js";
import { State } from "../core/state.js";
import { buildGWagon3D } from "../vehicles/gwagon3d.js";
import { buildCybertruck3D } from "../vehicles/cybertruck3d.js";
import { buildNK250 } from "../vehicles/nk250.js";
import { buildHoverboard } from "../vehicles/hoverboard.js";
import { buildRangeRover3D } from "../vehicles/rangerover_compound.js";

const MAX_SPEED = 16, ACCEL = 9, BRAKE = 16, REV_SPEED = -7, DRAG = 0.992;
const STEER_RATE = 2.1;
const CAR_HALF = 1.15;

export async function zonedriveScene(params, router) {
  const { meta, children, onTap } = params || {};
  if (!meta || !children) { router.go("city"); return null; }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.6, 400);

  scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x4a4436, 1.15));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.1);
  sun.position.set(85, 130, 55);
  scene.add(sun);

  const world = buildZoneWorld(scene, meta, children, () => {});
  const colliders = world.buildingColliders;

  const model = (State.vehicle && State.vehicle.model) || "gwagon";
  const body = (State.vehicle && State.vehicle.body) || "#1b1f24";
  const rim = (State.vehicle && State.vehicle.rim) || "#c9ced6";
  let carMesh;
if (model === "cybertruck") carMesh = buildCybertruck3D(body, rim);
else if (model === "rangerover") carMesh = buildRangeRover3D(body, rim);
else if (model === "nk250") carMesh = buildNK250(body, rim);
else if (model === "hoverboard") carMesh = buildHoverboard(body, rim);
else carMesh = buildGWagon3D(body, rim);

const ZONE_FRONT_CORRECTION = {
  gwagon:     Math.PI,
  cybertruck: 0,
  rangerover: 0,
};
carMesh.rotation.y = ZONE_FRONT_CORRECTION[model] !== undefined
  ? ZONE_FRONT_CORRECTION[model]
  : 0;

const carRoot = new THREE.Group();
carRoot.add(carMesh);
scene.add(carRoot);

  const p0 = world.buildingGates[0] || { x: 0, z: -60, yaw: 0 };
  const car = {
    x: p0.x * 0.4, z: p0.z * 0.4, heading: 0, speed: 0, steer: 0,
  };
  carRoot.position.set(car.x, 0, car.z);

  const keys = Object.create(null);
  const onKD = e => { keys[e.code] = 1; };
  const onKU = e => { keys[e.code] = 0; };
  window.addEventListener("keydown", onKD);
  window.addEventListener("keyup", onKU);

  const dom = router.renderer.domElement;
  let dragId = null, lx = 0, ly = 0;
  const joy = { throttle: 0, steer: 0 };
  const onPD = e => {
    if (e.clientX < innerWidth * 0.5) { dragId = e.pointerId; lx = e.clientX; ly = e.clientY; }
  };
  const onPM = e => {
    if (e.pointerId !== dragId) return;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    joy.steer = Math.max(-1, Math.min(1, dx / 60));
    joy.throttle = Math.max(-1, Math.min(1, -dy / 60));
  };
  const onPU = e => { if (e.pointerId === dragId) { dragId = null; joy.throttle = 0; joy.steer = 0; } };
  dom.addEventListener("pointerdown", onPD);
  dom.addEventListener("pointermove", onPM);
  dom.addEventListener("pointerup", onPU);
  dom.addEventListener("pointercancel", onPU);
  dom.addEventListener("contextmenu", e => e.preventDefault());

  function resolveCar(x, z) {
    const r = CAR_HALF;
    for (const b of colliders) {
      const cx = x < b.minX ? b.minX : (x > b.maxX ? b.maxX : x);
      const cz = z < b.minZ ? b.minZ : (z > b.maxZ ? b.maxZ : z);
      const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        const d = Math.sqrt(Math.max(d2, 1e-6));
        const k = (r - d) / d;
        x += dx * k; z += dz * k;
      }
    }
    return [x, z];
  }

  /* nearest gate for the ENTER prompt */
  let nearGate = null;
  function updateNearGate() {
    let best = null, bd = 9 * 9;
    for (const g of world.buildingGates) {
      const dx = g.x - car.x, dz = g.z - car.z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = g; }
    }
    nearGate = best;
  }

  /* ENTER button */
  const enterBtn = document.createElement("button");
  enterBtn.id = "ph3d-zonedrive-enter";
  enterBtn.style.cssText =
    "position:fixed;right:18px;bottom:calc(env(safe-area-inset-bottom) + 32px);" +
    "z-index:30;padding:14px 26px;border-radius:999px;background:rgba(8,16,28,.85);" +
    "border:1px solid rgba(94,224,255,.5);color:#eaf6ff;font:800 12px Inter,system-ui,sans-serif;" +
    "letter-spacing:.14em;cursor:pointer;backdrop-filter:blur(14px);opacity:0;" +
    "transition:opacity .2s;pointer-events:none;touch-action:manipulation";
  document.body.appendChild(enterBtn);
  enterBtn.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();
    if (nearGate && typeof onTap === "function") onTap(nearGate.child);
  }, { passive: false });

  /* back-to-map */
  const backBtn = document.createElement("button");
  backBtn.textContent = "\u2190 BACK TO MAP";
  backBtn.style.cssText =
    /* Below the player-panel (safe-area+12px, ~76px tall) so it doesn't
       overlap the avatar/LV/HP/cash card. */
    "position:fixed;left:14px;top:calc(env(safe-area-inset-top) + 98px);z-index:27;" +
    "padding:11px 18px;border-radius:22px;background:rgba(8,16,28,.82);" +
    "border:1px solid rgba(94,224,255,.45);color:#eaf6ff;" +
    "font:800 11px Inter,system-ui,sans-serif;letter-spacing:.12em;" +
    "cursor:pointer;pointer-events:auto;touch-action:manipulation";
  document.body.appendChild(backBtn);
  backBtn.addEventListener("pointerdown", e => e.stopPropagation());
  backBtn.addEventListener("click", () => { router.back(); });

  let camYaw = car.heading, camPitch = 0.22;

  function update(dt) {
    dt = Math.min(dt, 0.05);
    let throttle = joy.throttle, steer = joy.steer;
    if (keys.KeyW || keys.ArrowUp) throttle = 1;
    if (keys.KeyS || keys.ArrowDown) throttle = -1;
    if (keys.KeyA || keys.ArrowLeft) steer = -1;
    if (keys.KeyD || keys.ArrowRight) steer = 1;

    if (throttle > 0) car.speed += ACCEL * dt;
    else if (throttle < 0) car.speed += (car.speed > 0.5 ? -BRAKE : REV_SPEED * 0.6) * dt;
    else car.speed *= DRAG;
    car.speed = Math.max(REV_SPEED, Math.min(MAX_SPEED, car.speed));

    if (Math.abs(car.speed) > 0.2) {
      const steerAmt = steer * STEER_RATE * (0.35 + 0.65 * Math.min(1, Math.abs(car.speed) / 6));
      car.heading += steerAmt * dt * Math.sign(car.speed);
    }

    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    let nx = car.x + fx * car.speed * dt;
    let nz = car.z + fz * car.speed * dt;
    [nx, nz] = resolveCar(nx, nz);
    car.x = nx; car.z = nz;

    carRoot.position.set(car.x, 0, car.z);
    carRoot.rotation.y = car.heading;

    updateNearGate();
    if (nearGate && Math.abs(car.speed) < 4) {
      enterBtn.textContent = "ENTER \u00B7 " + nearGate.name;
      enterBtn.style.opacity = "1"; enterBtn.style.pointerEvents = "auto";
    } else {
      enterBtn.style.opacity = "0"; enterBtn.style.pointerEvents = "none";
    }

    camYaw += (car.heading - camYaw) * Math.min(1, dt * 4);
    const camDist = 8.5, camH = 3.6;
    const cx = car.x - Math.sin(camYaw) * camDist;
    const cz = car.z - Math.cos(camYaw) * camDist;
    camera.position.lerp(new THREE.Vector3(cx, camH, cz), Math.min(1, dt * 6));
    camera.lookAt(car.x, 1.2, car.z);

    world.update(dt);
  }

  return {
    three: scene, camera, controls: { update: () => {} },
    crumb: meta.sub || "MAP", title: meta.name, subtitle: "DRIVING AROUND",
    hint: "DRAG: STEER / THROTTLE  \u00B7  DRIVE UP TO A GATE TO ENTER",
    update,
    dispose: () => {
      window.removeEventListener("keydown", onKD);
      window.removeEventListener("keyup", onKU);
      dom.removeEventListener("pointerdown", onPD);
      dom.removeEventListener("pointermove", onPM);
      dom.removeEventListener("pointerup", onPU);
      dom.removeEventListener("pointercancel", onPU);
      world.dispose();
      enterBtn.remove();
      backBtn.remove();
    },
  };
}

