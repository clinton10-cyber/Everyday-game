/* ============================================================
   night-glow.js — makes every streetlight visibly LIGHT UP at night.
   For each lamp spot it adds, in three instanced meshes:
     - a bright bulb disc under the hood,
     - a soft halo around the bulb (visible from any angle),
     - a warm light pool on the ground (additive), so roads and
       pavements look illuminated even from the overhead city map
       where the few real PointLights cannot reach.
   The group is tagged  userData.__nightGlow  and StreetLights.tick()
   drives it (visible + strength) from the day/night clock.
   ============================================================ */
import * as THREE from "three";

let _poolTex = null;
function poolTexture() {
  if (_poolTex) return _poolTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0.0, "rgba(255,226,160,1)");
  grd.addColorStop(0.35, "rgba(255,204,120,0.55)");
  grd.addColorStop(0.7, "rgba(255,180,90,0.16)");
  grd.addColorStop(1.0, "rgba(255,170,80,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  _poolTex = new THREE.CanvasTexture(c);
  _poolTex.colorSpace = THREE.SRGBColorSpace;
  return _poolTex;
}

/**
 * Add the glow for `spots` ([{x,y,z}]) to `scene`. Returns the group.
 * opts.poolRadius (default 15) - radius of the ground light pool, metres.
 */
export function addNightGlow(scene, spots, opts = {}) {
  if (!scene || !spots || !spots.length) return null;
  const poolR = opts.poolRadius || 15;
  const n = spots.length;
  const group = new THREE.Group();
  group.name = "night-glow";
  group.userData.__nightGlow = true;
  group.visible = false;

  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff2cc, fog: false });
  const bulbs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 12), bulbMat, n);

  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xffd488, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false,
  });
  const halos = new THREE.InstancedMesh(new THREE.SphereGeometry(1.1, 10, 8), haloMat, n);

  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTexture(), color: 0xffffff, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8,
  });
  const poolGeo = new THREE.PlaneGeometry(poolR * 2, poolR * 2);
  poolGeo.rotateX(-Math.PI / 2);
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, n);

  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const s = spots[i];
    m.makeTranslation(s.x, s.y - 0.05, s.z); bulbs.setMatrixAt(i, m);
    m.makeTranslation(s.x, s.y - 0.1, s.z);  halos.setMatrixAt(i, m);
    m.makeTranslation(s.x, 0.17, s.z);       pools.setMatrixAt(i, m);
  }
  for (const im of [bulbs, halos, pools]) {
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false;
    im.matrixAutoUpdate = false;
    im.renderOrder = 6;
    group.add(im);
  }

  /* called by StreetLights.tick() with 0 (day) .. 1 (night) */
  group.userData.setNight = (a) => {
    group.visible = a > 0.01;
    haloMat.opacity = 0.16 * a;
    poolMat.opacity = 0.85 * a;
    bulbMat.color.setRGB(1, 0.95 * (0.35 + 0.65 * a), 0.8 * (0.3 + 0.7 * a));
  };
  scene.add(group);
  return group;
}
