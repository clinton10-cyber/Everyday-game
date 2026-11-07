/* _minimapbuilder.js -- living city minimap (orbit overview).
   Geometry now comes from the shared _zoneworld.js builder, so this
   view is guaranteed to look exactly like the walkable/driveable
   version of the same place. Adds the camera, OrbitControls, and two
   buttons -- WALK HERE / DRIVE HERE -- that hand the player off to
   that walkable version without leaving this file's own behaviour
   (tap-a-building-to-travel) untouched. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildZoneWorld } from "./_zoneworld.js";

export async function buildMinimap(router, meta, children, onTap) {
  console.log("[minimap] " + meta.id + " \u00B7 " + children.length + " children");

  const SKY = 0xa9c9e8;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 180, 520);

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 1400);
  camera.position.set(-100, 120, 175);

  const controls = new OrbitControls(camera, router.renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = 1.46;
  controls.minDistance = 40;
  controls.maxDistance = 500;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.35;
  controls.addEventListener("start", () => { controls.autoRotate = false; });

  const world = buildZoneWorld(scene, meta, children, onTap);

  /* ---- WALK HERE / DRIVE HERE ---- */
  const wrap = document.createElement("div");
  wrap.id = "ph3d-zone-actions";
  wrap.style.cssText =
    "position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 26px);" +
    "transform:translateX(-50%);z-index:26;display:flex;gap:10px;";
  wrap.innerHTML =
    '<button data-go="zonewalk" style="padding:13px 22px;border-radius:999px;' +
    'background:rgba(8,16,28,.85);border:1px solid rgba(125,255,155,.5);color:#eaffef;' +
    'font:800 11px Inter,system-ui,sans-serif;letter-spacing:.14em;cursor:pointer;' +
    'backdrop-filter:blur(12px);box-shadow:0 8px 24px rgba(0,0,0,.4)">\uD83D\uDEB6 WALK HERE</button>' +
    '<button data-go="zonedrive" style="padding:13px 22px;border-radius:999px;' +
    'background:rgba(8,16,28,.85);border:1px solid rgba(94,224,255,.5);color:#eaf6ff;' +
    'font:800 11px Inter,system-ui,sans-serif;letter-spacing:.14em;cursor:pointer;' +
    'backdrop-filter:blur(12px);box-shadow:0 8px 24px rgba(0,0,0,.4)">\uD83D\uDE97 DRIVE HERE</button>';
  document.body.appendChild(wrap);
  wrap.querySelectorAll("button").forEach(b => {
    b.addEventListener("pointerdown", e => e.stopPropagation());
    b.addEventListener("click", () => {
      router.go(b.dataset.go, { meta, children, onTap });
    });
  });

  return {
    three: scene,
    camera,
    controls,
    crumb: meta.sub || "MAP",
    title: meta.name || "MAP",
    subtitle: "TAP A BUILDING",
    hint: "TAP A BUILDING TO ENTER \u00B7 OR WALK / DRIVE THE AREA",
    dispose: () => {
      world.dispose();
      wrap.remove();
    },
    update: (dt) => { world.update(dt); },
  };
}

