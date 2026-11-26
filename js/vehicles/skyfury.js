/* skyfury.js — SKYFURY fighter jet (procedural).
   Forward = +Z (matches game vehicles after optional yaw correction).
   userData.isSkyfury / isAircraft for drive-scene flight physics.
   Cockpit seat marker at userData.seatLocal for rider mount. */
import * as THREE from "three";

function plateGeo(pts, depth) {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
  geo.translate(0, 0, -depth * 0.5);
  return geo;
}

export function buildSkyfury(body = "#9aa7b4", rim = "#27313d", opts = {}) {
  const cfg = {
    body: new THREE.Color(body).getHex(),
    accent: new THREE.Color(rim).getHex(),
    glow: 0x5fd0ff,
  };

  const root = new THREE.Group();
  root.name = "skyfury";

  const matBody = new THREE.MeshLambertMaterial({ color: cfg.body });
  const matWing = new THREE.MeshLambertMaterial({ color: cfg.body, side: THREE.DoubleSide });
  const matDark = new THREE.MeshLambertMaterial({ color: cfg.accent });
  const matGlass = new THREE.MeshLambertMaterial({
    color: 0x0a1a2c, transparent: true, opacity: 0.88,
  });
  const matGlow = new THREE.MeshBasicMaterial({
    color: cfg.glow, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });

  /* Original SKYFURY model points nose to -Z; rotate group so nose = +Z for the game */
  const bodyG = new THREE.Group();
  bodyG.rotation.y = Math.PI;
  root.add(bodyG);

  /* nose */
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.7, 12), matBody);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.75;
  bodyG.add(nose);

  const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6), matDark);
  pitot.rotation.x = Math.PI / 2;
  pitot.position.z = -5.4;
  bodyG.add(pitot);

  /* fuselage */
  const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.82, 5.2, 12), matBody);
  mid.rotation.x = -Math.PI / 2;
  mid.position.z = 0.05;
  bodyG.add(mid);

  const rear = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.62, 1.35, 12), matBody);
  rear.rotation.x = -Math.PI / 2;
  rear.position.z = 3.3;
  bodyG.add(rear);

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 3.5), matDark);
  spine.position.set(0, 0.58, 0.45);
  bodyG.add(spine);

  /* cockpit */
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
    matGlass
  );
  canopy.scale.set(0.45, 0.62, 1.28);
  canopy.position.set(0, 0.5, -1.55);
  bodyG.add(canopy);

  /* intakes */
  for (const s of [-1, 1]) {
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.58, 2.7), matDark);
    intake.position.set(s * 0.7, -0.09, 0.4);
    bodyG.add(intake);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.62, 0.18), matBody);
    lip.position.set(s * 0.7, -0.09, -0.95);
    bodyG.add(lip);
  }

  /* main wings */
  const wingPts = [[0.62, -2.05], [3.9, 0.85], [3.9, 1.95], [0.62, 2.30]];
  const wingGeoR = plateGeo(wingPts, 0.19);
  wingGeoR.rotateX(Math.PI / 2);
  const wingGeoL = wingGeoR.clone();
  wingGeoL.scale(-1, 1, 1);
  const wingR = new THREE.Mesh(wingGeoR, matWing);
  wingR.position.y = -0.06;
  bodyG.add(wingR);
  const wingL = new THREE.Mesh(wingGeoL, matWing);
  wingL.position.y = -0.06;
  bodyG.add(wingL);

  /* wingtip rails */
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.55, 8), matDark);
    m.rotation.x = Math.PI / 2;
    m.position.set(s * 3.76, -0.02, 1.2);
    bodyG.add(m);
    const n = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 8), matDark);
    n.rotation.x = -Math.PI / 2;
    n.position.set(s * 3.76, -0.02, 0.26);
    bodyG.add(n);
  }

  /* underwing stores */
  for (const s of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      const px = s * (1.72 + k * 0.86);
      const pz = 0.55 + k * 0.52;
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.72), matDark);
      pylon.position.set(px, -0.25, pz);
      bodyG.add(pylon);
      const store = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 8), matDark);
      store.rotation.x = Math.PI / 2;
      store.position.set(px, -0.46, pz);
      bodyG.add(store);
    }
  }

  /* horizontal stabilisers */
  const stabPts = [[0.5, 1.55], [1.98, 2.45], [1.98, 3.05], [0.5, 3.15]];
  const stabR = plateGeo(stabPts, 0.13);
  stabR.rotateX(Math.PI / 2);
  const stabL = stabR.clone();
  stabL.scale(-1, 1, 1);
  bodyG.add(new THREE.Mesh(stabR, matWing));
  bodyG.add(new THREE.Mesh(stabL, matWing));

  /* twin fins */
  const finPts = [[-0.95, 0.0], [-2.3, 1.7], [-2.9, 1.7], [-3.15, 0.1]];
  const finGeo = plateGeo(finPts, 0.12);
  finGeo.rotateY(Math.PI / 2);
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(finGeo, matWing);
    fin.position.set(s * 0.53, 0.44, 0);
    fin.rotation.z = -s * 0.25;
    bodyG.add(fin);
  }

  /* engines / afterburner */
  const flames = [];
  const nozzleGeo = new THREE.CylinderGeometry(0.29, 0.34, 1.0, 12, 1, true);
  for (const s of [-1, 1]) {
    const nozzle = new THREE.Mesh(nozzleGeo, matDark);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(s * 0.32, 0, 3.8);
    bodyG.add(nozzle);

    const inner = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), matGlow);
    inner.position.set(s * 0.32, 0, 4.25);
    inner.rotation.y = Math.PI;
    bodyG.add(inner);

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.27, 2.5, 10, 1, true),
      matGlow.clone()
    );
    flame.material.opacity = 0.85;
    flame.rotation.x = Math.PI / 2;
    flame.position.set(s * 0.32, 0, 4.25 + 1.25);
    bodyG.add(flame);
    flames.push(flame);
  }

  /* Pilot seat in cockpit (local space of root after nose=+Z flip).
     Original cockpit at z~-1.55 in bodyG (-Z nose); after bodyG rotY=PI that becomes +Z. */
  root.userData.isSkyfury = true;
  root.userData.isAircraft = true;
  root.userData.flames = flames;
  root.userData.seatLocal = { x: 0, y: 0.95, z: 1.35 }; /* roughly under canopy */

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });

  return root;
}

/** Pulse afterburner visuals from throttle 0..1 */
export function updateSkyfuryThrottle(mesh, throttle) {
  if (!mesh || !mesh.userData || !mesh.userData.flames) return;
  const thr = Math.max(0, Math.min(1, throttle));
  const flicker = 0.9 + Math.sin(performance.now() * 0.03) * 0.1;
  for (const f of mesh.userData.flames) {
    if (!f || !f.material) continue;
    f.scale.set(1, (0.25 + thr * 1.6) * flicker, 1);
    f.material.opacity = 0.12 + thr * 0.88;
  }
}
