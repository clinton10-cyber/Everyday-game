/* hotel/exterior.js — Hotel Presidential. 5-star curved glass tower on
   Woji Road: rounded drum + flanking wings, gold crown, porte-cochère,
   pool deck and palm-lined driveway. */
import * as THREE from "three";
import { M, EM, textLabel, windowTexture, getEnv } from "../../core/kit.js";
import meta from "./meta.js";

export function buildExterior() {
  const g = new THREE.Group();

  const glassMat = new THREE.MeshStandardMaterial({
    map: windowTexture("#e6eef5", "#ffd76b", 6, 12),
    roughness: 0.22, metalness: 0.65, envMap: getEnv(),
  });
  const goldMat = M(0xd4af37, 0.35, 0.85);
  const stoneMat = M(0xe8e0d0, 0.9);
  const roofMat = M(0x1a1a1e, 0.8);
  const poolMat = new THREE.MeshStandardMaterial({ color: 0x2a9ac4, roughness: 0.05, metalness: 0.35, transparent: true, opacity: 0.85 });
  const palmTrunk = M(0x6b5340, 0.9);
  const palmLeaf = M(0x2f8a4a, 1);

  const add = (geo, mat, x, y, z, shadow) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (shadow) { m.castShadow = true; m.receiveShadow = true; }
    g.add(m);
    return m;
  };

  /* Curved drum (open arc facing +Z so the front reads as glass sweep) */
  add(new THREE.CylinderGeometry(8, 8, 22, 28, 1, false), glassMat, 0, 11, 0, true);
  const crown = add(new THREE.TorusGeometry(8.15, 0.28, 8, 32), goldMat, 0, 22, 0);
  crown.rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(3.2, 3.4, 3.2, 20), glassMat, 0, 23.6, 0);
  add(new THREE.ConeGeometry(3.8, 1.8, 20), roofMat, 0, 26.1, 0);
  add(new THREE.SphereGeometry(0.22, 10, 8), EM(0xff3030, 2.4), 0, 27.2, 0);

  /* Wings */
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(6, 15, 10), glassMat, s * 10.5, 7.5, -1, true);
    add(new THREE.BoxGeometry(6.3, 0.32, 10.3), goldMat, s * 10.5, 15.16, -1);
    for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(0.14, 15, 0.3), goldMat, s * 10.5 + i * 1.2, 7.5, 4.1);
  }

  /* Porte-cochère */
  add(new THREE.BoxGeometry(16, 0.5, 6), stoneMat, 0, 4.5, 8, true);
  add(new THREE.BoxGeometry(16.2, 0.14, 6.2), goldMat, 0, 4.78, 8);
  for (const x of [-6, -2, 2, 6]) {
    add(new THREE.CylinderGeometry(0.32, 0.36, 4.2, 10), stoneMat, x, 2.1, 10.4, true);
    add(new THREE.CylinderGeometry(0.42, 0.32, 0.22, 10), goldMat, x, 4.42, 10.4);
  }

  /* Revolving door */
  const ring = add(new THREE.TorusGeometry(1.6, 0.16, 8, 24), goldMat, 0, 1.8, 7.4);
  ring.rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(1.4, 1.4, 3.2, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xbcd8f0, transparent: true, opacity: 0.35, side: THREE.DoubleSide }), 0, 1.6, 7.4);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const mu = add(new THREE.BoxGeometry(0.06, 3.2, 0.06), goldMat, Math.cos(a) * 1.4, 1.6, 7.4 + Math.sin(a) * 1.4);
    mu.rotation.y = -a;
  }

  /* Pool deck */
  add(new THREE.BoxGeometry(10, 0.18, 8), stoneMat, 15, 0.09, 6).receiveShadow = true;
  add(new THREE.BoxGeometry(7.6, 0.06, 5.6), poolMat, 15, 0.22, 6);
  for (const [x, z, w, d] of [[15, 3.1, 7.8, 0.2], [15, 8.9, 7.8, 0.2], [11.1, 6, 0.2, 5.8], [18.9, 6, 0.2, 5.8]])
    add(new THREE.BoxGeometry(w, 0.24, d), goldMat, x, 0.22, z);
  for (const x of [12, 15, 18]) {
    add(new THREE.BoxGeometry(0.8, 0.16, 2.0), M(0xfff0d0, 0.9), x, 0.4, 3.8);
    const back = add(new THREE.BoxGeometry(0.8, 0.5, 0.12), M(0xe0d0b0, 0.9), x, 0.62, 2.9);
    back.rotation.x = -0.35;
  }

  /* Palm-lined driveway (deterministic heights, no Math.random) */
  for (let i = 0; i < 6; i++) {
    for (const s of [-1, 1]) {
      const px = s * 12, pz = 12 + i * 4;
      const th = 5.5 + ((i * 7 + (s > 0 ? 3 : 0)) % 6) * 0.2;
      add(new THREE.CylinderGeometry(0.18, 0.24, th, 6), palmTrunk, px, th / 2, pz, true);
      for (let f = 0; f < 6; f++) {
        const a = (f / 6) * Math.PI * 2;
        const leaf = add(new THREE.ConeGeometry(0.55, 3.0, 4), palmLeaf, px + Math.cos(a) * 0.9, th + 0.4, pz + Math.sin(a) * 0.9);
        leaf.rotation.set(Math.cos(a) * 1.15, 0, -Math.sin(a) * 1.15);
      }
    }
  }

  /* Apron */
  add(new THREE.BoxGeometry(44, 0.12, 34), M(0xb8b0a4, 0.9), 0, 0.06, 6).receiveShadow = true;

  /* Sign + 5 stars */
  const lbl = textLabel(meta.name, meta.sub);
  lbl.position.y = 6.4;
  lbl.scale.multiplyScalar(1.3);
  g.add(lbl);
  for (let i = 0; i < 5; i++) add(new THREE.OctahedronGeometry(0.32, 0), EM(0xffd76b, 1.8), -2.4 + i * 1.2, 5.6, 6.4);

  /* The old tower was ~12m; scale so the landmark stays in proportion
     with the other exteriors on the map. */
  g.scale.setScalar(0.55);
  return g;
}
