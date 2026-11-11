/* zonewalk.js -- walk around a place's minimap zone on foot, in third
   person, using the EXACT same procedural layout the minimap draws
   (_zoneworld.js). Walk up to a building and press ENTER to go inside
   -- it calls the same onTap(child) the minimap uses, so arrival
   (the travel cutscene / direct entry) behaves identically either way. */
import * as THREE from "three";
import { buildZoneWorld } from "../places/_zoneworld.js";
import { ThirdPersonControls } from "../core/thirdperson.js";

export async function zonewalkScene(params, router) {
  const { meta, children, onTap } = params || {};
  if (!meta || !children) { router.go("city"); return null; }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.4, 400);
  camera.rotation.order = "YXZ";

  scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x4a4436, 1.15));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.1);
  sun.position.set(85, 130, 55);
  scene.add(sun);

  const world = buildZoneWorld(scene, meta, children, () => {});

  const uses = world.buildingGates.map(g => ({
    kind: "enter", label: "ENTER " + g.name, x: g.x, z: g.z,
    y: 0, level: 0, r: 3.2, gate: g,
  }));

  const navWorld = {
    colliders: world.buildingColliders.map(c => Object.assign({}, c, { level: 0 })),
    seats: [], uses, platforms: [],
    bounds: { minX: -180, maxX: 180, minZ: -180, maxZ: 180 },
  };

  /* spawn just outside the first building's gate, or at ring centre */
  const spawn = world.buildingGates[0]
    ? { x: world.buildingGates[0].x * 0.4, z: world.buildingGates[0].z * 0.4 }
    : { x: 0, z: -60 };

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, navWorld, {
    scene, x: spawn.x, z: spawn.z, yaw: 0, level: 0, driveFeel: false,
    onUse: (use) => {
      if (use.kind === "enter" && use.gate && typeof onTap === "function") {
        onTap(use.gate.child);
      }
    },
  });

  /* back-to-map button */
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

  return {
    three: scene, camera, controls: { update: () => {} },
    crumb: meta.sub || "MAP", title: meta.name, subtitle: "WALKING AROUND",
    hint: "LEFT: MOVE  \u00B7  RIGHT: LOOK  \u00B7  E: ENTER BUILDING",
    update: (dt) => { ctl.update(dt); world.update(dt); },
    dispose: () => { ctl.dispose(); world.dispose(); backBtn.remove(); },
  };
}

