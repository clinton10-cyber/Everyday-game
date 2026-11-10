/* ============================================================
   scene-lamps.js — drop-in streetlamp posts for open-world scenes.
   Each lamp is a small standalone mesh (pole + glowing head) and
   registers its head position into scene.userData.__lampSpots, the
   array StreetLights.tick() already reads every frame (driven by
   DayNight) to light the world at night via a pooled set of
   PointLights. Call addStreetLamp() once per post; it is cheap
   (a handful of triangles) and does not need to be batched.
   ============================================================ */
import * as THREE from "three";

const _poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 5.0, 8);
const _armGeo = new THREE.CylinderGeometry(0.05, 0.06, 1.3, 6);
const _hoodGeo = new THREE.CylinderGeometry(0.12, 0.34, 0.26, 8);
const _lensGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.03, 14);
const _poleMat = new THREE.MeshLambertMaterial({ color: 0x1c1c20 });
const _hoodMat = new THREE.MeshLambertMaterial({ color: 0x15151a });
const _lensMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });

/**
 * Add one streetlamp post to `scene` at (x, groundY, z), and register its
 * lit head as a lamp spot that StreetLights turns on at dusk. Returns the
 * lamp head's world position so callers can keep a list if they want it.
 */
export function addStreetLamp(scene, x, groundY, z, armYaw = 0) {
  const pole = new THREE.Mesh(_poleGeo, _poleMat);
  pole.position.set(x, groundY + 2.5, z);
  scene.add(pole);

  const arm = new THREE.Mesh(_armGeo, _poleMat);
  arm.position.set(
    x + Math.sin(armYaw) * 0.6,
    groundY + 4.85,
    z + Math.cos(armYaw) * 0.6
  );
  arm.rotation.z = Math.PI / 2.3;
  arm.rotation.y = armYaw;
  scene.add(arm);

  const hx = x + Math.sin(armYaw) * 1.15, hz = z + Math.cos(armYaw) * 1.15;
  const hy = groundY + 5.1;

  const hood = new THREE.Mesh(_hoodGeo, _hoodMat);
  hood.position.set(hx, hy, hz);
  scene.add(hood);

  const lens = new THREE.Mesh(_lensGeo, _lensMat);
  lens.position.set(hx, hy - 0.1, hz);
  scene.add(lens);

  (scene.userData.__lampSpots || (scene.userData.__lampSpots = [])).push({ x: hx, y: hy, z: hz });
  return { x: hx, y: hy, z: hz };
}

/** Convenience: add lamps at every [x, z] pair in `points`, ground at y=groundY. */
export function addStreetLamps(scene, points, groundY = 0) {
  for (const p of points) addStreetLamp(scene, p[0], groundY, p[1], p[2] || 0);
}
