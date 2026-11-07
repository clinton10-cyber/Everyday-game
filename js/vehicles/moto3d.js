import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/* Geometry helpers, local to this file */
function tube(mat, ax, ay, az, bx, by, bz, rA, rB, seg) {
  const a = _a.set(ax, ay, az);
  const b = _b.set(bx, by, bz);
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(rB, rA, len, seg || 6);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  return mesh;
}

function box(mat, w, h, d, x, y, z, rx, ry, rz) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
  return m;
}

/* ── Bike layout (local: forward = −Z, up = +Y) ─────────── */
const WHEEL_R      = 0.42;
const REAR_AXLE_Z  = 0.72;
const STEER_HEAD   = new THREE.Vector3(0, 0.96, -0.62);
const AXLE_LOCAL   = new THREE.Vector3(0, -0.54, -0.18);
const GRIP_R       = new THREE.Vector3(0.33, 0.16, 0.10);
const GRIP_L       = new THREE.Vector3(-0.33, 0.16, 0.10);
const PELVIS       = new THREE.Vector3(0, 0.92, 0.30);
const SHOULDER_OFF = { x: 0.20, y: 0.48, z: -0.34 };

export function buildMoto3D(bodyColor = "#d8261f", rimColor = "#b9bec8") {
  const root = new THREE.Group();

  const BODY  = new THREE.MeshLambertMaterial({ color: new THREE.Color(bodyColor), flatShading: true });
  const BODY2 = new THREE.MeshLambertMaterial({ color: 0x16171d, flatShading: true });
  const METAL = new THREE.MeshLambertMaterial({ color: 0xc3c8d0, flatShading: true });
  const GOLD  = new THREE.MeshLambertMaterial({ color: 0xd8a545, flatShading: true });
  const TIRE  = new THREE.MeshLambertMaterial({ color: 0x18181c, flatShading: true });
  const RIM   = new THREE.MeshLambertMaterial({ color: new THREE.Color(rimColor), flatShading: true });
  const HEAD  = new THREE.MeshBasicMaterial({ color: 0xfff3d0 });
  const TAIL  = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  const GLASS = new THREE.MeshBasicMaterial({ color: 0x101822 });

  /* ---------- Main body (extruded side profile) ---------- */
  const sh = new THREE.Shape();
  sh.moveTo(-0.95, 0.62);
  sh.lineTo(-1.04, 0.80);
  sh.lineTo(-1.02, 0.95);
  sh.lineTo(-0.70, 0.99);
  sh.lineTo(-0.34, 0.90);
  sh.lineTo( 0.12, 1.00);
  sh.lineTo( 0.54, 0.98);
  sh.lineTo( 0.68, 0.88);
  sh.lineTo( 0.94, 0.70);
  sh.lineTo( 0.86, 0.48);
  sh.lineTo( 0.36, 0.38);
  sh.lineTo(-0.12, 0.42);
  sh.lineTo(-0.55, 0.56);
  sh.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(sh, {
    depth: 0.34, bevelEnabled: false, curveSegments: 1,
  });
  bodyGeo.translate(0, 0, -0.17);
  bodyGeo.rotateY(Math.PI / 2);
  root.add(new THREE.Mesh(bodyGeo, BODY));

  /* ---------- Engine block / belly ---------- */
  root.add(box(BODY2, 0.36, 0.30, 0.52, 0, 0.50, -0.02));
  root.add(box(METAL, 0.30, 0.16, 0.30, 0, 0.62, -0.16));

  /* ---------- Tail unit ---------- */
  root.add(box(BODY,  0.26, 0.13, 0.36, 0, 1.00, 0.72, -0.18, 0, 0));
  root.add(box(TAIL,  0.20, 0.07, 0.06, 0, 0.99, 0.90));

  /* ---------- Seat ---------- */
  root.add(box(BODY2, 0.30, 0.09, 0.46, 0, 0.90, 0.24));

  /* ---------- Windscreen ---------- */
  root.add(box(GLASS, 0.30, 0.24, 0.04, 0, 1.06, -0.62, -0.42, 0, 0));

  /* ---------- Headlight ---------- */
  root.add(box(HEAD, 0.24, 0.13, 0.07, 0, 0.76, -0.90, 0.12, 0, 0));

  /* ---------- Exhaust ---------- */
  root.add(tube(METAL, 0.14, 0.44, 0.05, 0.19, 0.58, 0.86, 0.045, 0.055, 8));
  root.add(tube(BODY2, 0.19, 0.58, 0.86, 0.20, 0.60, 1.05, 0.075, 0.09, 8));

  /* ---------- Swingarm ---------- */
  root.add(tube(METAL, -0.13, 0.50, 0.16, -0.11, 0.42, REAR_AXLE_Z, 0.035, 0.045, 6));
  root.add(tube(METAL,  0.13, 0.50, 0.16,  0.11, 0.42, REAR_AXLE_Z, 0.035, 0.045, 6));

  /* ---------- Rear hugger + footpegs ---------- */
  root.add(box(BODY2, 0.24, 0.06, 0.42, 0, 0.86, 0.60));
  root.add(box(METAL, 0.14, 0.04, 0.05, -0.26, 0.44, 0.16));
  root.add(box(METAL, 0.14, 0.04, 0.05,  0.26, 0.44, 0.16));

  /* ---------- Steering assembly ---------- */
  const steerGroup = new THREE.Group();
  steerGroup.position.copy(STEER_HEAD);
  root.add(steerGroup);

  steerGroup.add(tube(GOLD, -0.10, 0.06, 0.02, -0.10, -0.54, -0.18, 0.042, 0.036, 6));
  steerGroup.add(tube(GOLD,  0.10, 0.06, 0.02,  0.10, -0.54, -0.18, 0.042, 0.036, 6));
  steerGroup.add(box(METAL, 0.30, 0.06, 0.14, 0, 0.06, 0.00));
  steerGroup.add(box(METAL, 0.30, 0.05, 0.12, 0, -0.14, -0.05));
  steerGroup.add(tube(METAL, -0.33, 0.16, 0.10, 0.33, 0.16, 0.10, 0.024, 0.024, 6));
  steerGroup.add(tube(BODY2, 0.24, 0.16, 0.10, 0.34, 0.16, 0.10, 0.032, 0.032, 6));
  steerGroup.add(tube(BODY2, -0.24, 0.16, 0.10, -0.34, 0.16, 0.10, 0.032, 0.032, 6));
  steerGroup.add(box(BODY, 0.24, 0.06, 0.52, 0, -0.10, -0.18, 0.10, 0, 0));

  /* ---------- Front wheel ---------- */
  const frontWheel = new THREE.Group();
  frontWheel.position.copy(AXLE_LOCAL);
  steerGroup.add(frontWheel);
  const frontTireGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.15, 14);
  frontTireGeo.rotateZ(Math.PI / 2);
  frontWheel.add(new THREE.Mesh(frontTireGeo, TIRE));
  const frontRimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.17, 10);
  frontRimGeo.rotateZ(Math.PI / 2);
  frontWheel.add(new THREE.Mesh(frontRimGeo, RIM));

  /* ---------- Rear wheel ---------- */
  const rearWheel = new THREE.Group();
  rearWheel.position.set(0, WHEEL_R, REAR_AXLE_Z);
  root.add(rearWheel);
  const rearTireGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.21, 14);
  rearTireGeo.rotateZ(Math.PI / 2);
  rearWheel.add(new THREE.Mesh(rearTireGeo, TIRE));
  const rearRimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.23, 10);
  rearRimGeo.rotateZ(Math.PI / 2);
  rearWheel.add(new THREE.Mesh(rearRimGeo, RIM));

  /* ---------- Rider ---------- */
  const JACKET  = new THREE.MeshLambertMaterial({ color: 0x1b3a6b, flatShading: true });
  const JACKET2 = new THREE.MeshLambertMaterial({ color: 0x14294d, flatShading: true });
  const PANTS   = new THREE.MeshLambertMaterial({ color: 0x22242c, flatShading: true });
  const HELMET  = new THREE.MeshLambertMaterial({ color: 0xf2f4f8, flatShading: true });
  const VISOR   = new THREE.MeshBasicMaterial({ color: 0x0a0e18 });
  const BOOT    = new THREE.MeshLambertMaterial({ color: 0x111114, flatShading: true });

  /* legs (static, in bike frame) */
  for (const s of [-1, 1]) {
    root.add(tube(PANTS, s * 0.16, 0.90, 0.26, s * 0.30, 0.66, -0.16, 0.095, 0.085, 6));
    root.add(tube(PANTS, s * 0.30, 0.66, -0.16, s * 0.27, 0.46, 0.14, 0.085, 0.065, 6));
    root.add(box(BOOT, 0.12, 0.10, 0.24, s * 0.27, 0.42, 0.16, 0.1, 0, 0));
    root.add(box(JACKET2, 0.11, 0.11, 0.13, s * 0.30, 0.67, -0.16));
  }

  /* torso pivot — animated with the bike */
  const torsoPivot = new THREE.Group();
  torsoPivot.position.copy(PELVIS);
  root.add(torsoPivot);
  torsoPivot.add(box(PANTS, 0.30, 0.18, 0.26, 0, 0.04, 0.02));

  const torsoLen = Math.hypot(SHOULDER_OFF.y, SHOULDER_OFF.z);
  const torsoGeo = new THREE.CylinderGeometry(0.185, 0.215, torsoLen + 0.10, 6);
  const torsoMesh = new THREE.Mesh(torsoGeo, JACKET);
  torsoMesh.position.set(0, SHOULDER_OFF.y * 0.5, SHOULDER_OFF.z * 0.5);
  torsoMesh.rotation.x = -Math.atan2(-SHOULDER_OFF.z, SHOULDER_OFF.y);
  torsoPivot.add(torsoMesh);
  torsoPivot.add(box(JACKET2, 0.20, 0.16, 0.14,
    0, SHOULDER_OFF.y * 0.55, SHOULDER_OFF.z * 0.55 + 0.14));
  for (const s of [-1, 1]) {
    torsoPivot.add(box(JACKET, 0.13, 0.13, 0.16,
      s * SHOULDER_OFF.x, SHOULDER_OFF.y, SHOULDER_OFF.z));
  }

  /* helmet group (child of torso) */
  const helmetGroup = new THREE.Group();
  helmetGroup.position.set(0, SHOULDER_OFF.y + 0.20, SHOULDER_OFF.z - 0.11);
  torsoPivot.add(helmetGroup);
  const helmMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.155, 1), HELMET);
  helmMesh.scale.set(0.92, 1.0, 1.06);
  helmetGroup.add(helmMesh);
  const visorGeo = new THREE.SphereGeometry(0.163, 8, 6,
    Math.PI * 0.78, Math.PI * 0.44, Math.PI * 0.30, Math.PI * 0.34);
  helmetGroup.add(new THREE.Mesh(visorGeo, VISOR));
  helmetGroup.add(box(HELMET, 0.20, 0.08, 0.10, 0, -0.08, -0.11, 0.25, 0, 0));
  helmetGroup.add(tube(JACKET2, 0, -0.06, 0.02, 0, -0.18, 0.04, 0.07, 0.09, 6));

  /* arms — recomputed every frame by updateMotoVisual */
  const armGeo = new THREE.CylinderGeometry(0.05, 0.062, 1, 6);
  armGeo.translate(0, 0.5, 0);
  const armR = new THREE.Mesh(armGeo, JACKET);
  const armL = new THREE.Mesh(armGeo, JACKET);
  root.add(armR, armL);
  const gloveR = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), BOOT);
  const gloveL = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), BOOT);
  armR.add(gloveR); armL.add(gloveL);

  /* ---------- Animation hooks (userData) ---------- */
  root.userData.isBike = true;
  root.userData.steerGroup = steerGroup;
  root.userData.torsoPivot = torsoPivot;
  root.userData.helmetGroup = helmetGroup;
  root.userData.armR = armR;
  root.userData.armL = armL;
  root.userData.pelvis = PELVIS;
  root.userData.shoulderOff = SHOULDER_OFF;
  root.userData.steerHead = STEER_HEAD;
  root.userData.gripR = GRIP_R;
  root.userData.gripL = GRIP_L;
  /* G-Wagon-compatible wheel spec so drive.js spins them for free */
  root.userData.wheels = [
    { spin: frontWheel, pivot: steerGroup, steer: true  },
    { spin: rearWheel,  pivot: null,       steer: false },
  ];

  /* bake rest-pose arms immediately so the bike looks right in showroom */
  updateMotoVisual(root, 0, { steer: 0, tuck: 0, bank: 0 });

  return root;
}

/* ── Per-frame animation (call from the drive scene) ────── */
const UP2 = new THREE.Vector3(0, 1, 0);
const _e = new THREE.Vector3();
const _f = new THREE.Vector3();
const _g = new THREE.Vector3();

export function updateMotoVisual(root, dt, opts) {
  if (!root || !root.userData.isBike) return;
  const u = root.userData;
  const steer = opts.steer || 0;
  const tuck  = opts.tuck  || 0;
  const bank  = opts.bank  || 0;

  /* steering angle */
  const targetSteer = -steer * 0.6;
  u.steerGroup.rotation.y += (targetSteer - u.steerGroup.rotation.y) * Math.min(1, dt * 12);

  /* rider tuck */
  u.torsoPivot.rotation.x += (-tuck - u.torsoPivot.rotation.x) * Math.min(1, dt * 5);
  u.helmetGroup.rotation.z += (-bank * 0.25 - u.helmetGroup.rotation.z) * Math.min(1, dt * 8);

  /* arms — solve for each shoulder→grip line */
  const ca = Math.cos(u.torsoPivot.rotation.x);
  const sa = Math.sin(u.torsoPivot.rotation.x);
  const sy = u.shoulderOff.y, sz = u.shoulderOff.z;
  const shY = u.pelvis.y + sy * ca + sz * sa;
  const shZ = u.pelvis.z - sy * sa + sz * ca;

  const sc = Math.cos(u.steerGroup.rotation.y);
  const ss = Math.sin(u.steerGroup.rotation.y);

  for (let i = 0; i < 2; i++) {
    const sign = i === 0 ? 1 : -1;
    const grip = i === 0 ? u.gripR : u.gripL;
    const arm  = i === 0 ? u.armR  : u.armL;

    const gx = grip.x * sc + grip.z * ss;
    const gz = -grip.x * ss + grip.z * sc;
    _e.set(u.steerHead.x + gx, u.steerHead.y + grip.y, u.steerHead.z + gz);
    _f.set(sign * u.shoulderOff.x, shY, shZ);
    _g.subVectors(_e, _f);

    const len = _g.length();
    arm.position.copy(_f);
    arm.quaternion.setFromUnitVectors(UP2, _g.normalize());
    arm.scale.set(1, len, 1);

    const glove = arm.children[0];
    if (glove) glove.scale.set(1, 1 / len, 1);
  }
}

