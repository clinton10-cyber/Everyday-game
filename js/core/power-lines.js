/* ============================================================
   power-lines.js — utility poles + sagging overhead wires for
   open-world scenes. Purely decorative (no colliders), cheap to
   build: poles are instanced-friendly simple meshes, wires are
   thin tube geometry following a sagging quadratic curve.
   ============================================================ */
import * as THREE from "three";

const _poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 7.2, 7);
const _armGeo = new THREE.BoxGeometry(1.6, 0.1, 0.1);
const _insGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6);
const _poleMat = new THREE.MeshLambertMaterial({ color: 0x5a4328 });
const _armMat = new THREE.MeshLambertMaterial({ color: 0x3a2d1a });
const _insMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
const _wireMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });

/** One utility pole with a crossarm, at (x, groundY, z), arm aligned to `yaw`. */
export function addPole(scene, x, groundY, z, yaw = 0) {
  const pole = new THREE.Mesh(_poleGeo, _poleMat);
  pole.position.set(x, groundY + 3.6, z);
  scene.add(pole);

  const arm = new THREE.Mesh(_armGeo, _armMat);
  arm.position.set(x, groundY + 6.9, z);
  arm.rotation.y = yaw;
  scene.add(arm);

  const insulators = [];
  for (const off of [-0.65, 0, 0.65]) {
    const ix = x + Math.cos(yaw) * off, iz = z - Math.sin(yaw) * off;
    const ins = new THREE.Mesh(_insGeo, _insMat);
    ins.position.set(ix, groundY + 7.0, iz);
    scene.add(ins);
    insulators.push({ x: ix, y: groundY + 7.05, z: iz });
  }
  return { x, y: groundY + 6.9, z, insulators };
}

/** A sagging wire between two world points. */
function addWire(scene, a, b) {
  const mid = new THREE.Vector3((a.x + b.x) / 2, Math.min(a.y, b.y) - 0.5, (a.z + b.z) / 2);
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(a.x, a.y, a.z), mid, new THREE.Vector3(b.x, b.y, b.z)
  );
  const geo = new THREE.TubeGeometry(curve, 8, 0.02, 4, false);
  const wire = new THREE.Mesh(geo, _wireMat);
  scene.add(wire);
  return wire;
}

/**
 * Add a run of poles + wires along a straight line from (x0,z0) to (x1,z1).
 * `spacing` controls pole gaps; `offset` shifts the whole row sideways
 * (perpendicular to the run) so poles sit beside the road, not on it.
 */
export function addPoleLine(scene, x0, z0, x1, z1, groundY = 0, spacing = 22, offset = 0) {
  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  if (len < 1) return;
  const ux = dx / len, uz = dz / len;
  const nx = -uz, nz = ux; /* perpendicular */
  const yaw = Math.atan2(ux, uz);
  const count = Math.max(2, Math.round(len / spacing) + 1);
  const poles = [];
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * len;
    const px = x0 + ux * t + nx * offset;
    const pz = z0 + uz * t + nz * offset;
    poles.push(addPole(scene, px, groundY, pz, yaw));
  }
  for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i], b = poles[i + 1];
    for (let k = 0; k < a.insulators.length; k++) {
      addWire(scene, a.insulators[k], b.insulators[k]);
    }
  }
  return poles;
}
