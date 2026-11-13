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

  /* Grand arrival court: broad forecourt, ceremonial steps, fountain and valet island. */
  add(new THREE.BoxGeometry(54, 0.16, 42), M(0xb8b0a4, 0.9), 0, 0.08, 7).receiveShadow = true;
  add(new THREE.BoxGeometry(18, 0.28, 5), stoneMat, 0, 0.14, 13.2, true);
  for (let i = 0; i < 7; i++) {
    const step = add(new THREE.BoxGeometry(18 - i * 0.35, 0.18, 0.72), M(0xd6cbb8, 0.95), 0, 0.18 + i * 0.18, 10.4 - i * 0.72, true);
    step.receiveShadow = true;
  }
  /* Circular reflecting fountain in the arrival court. */
  add(new THREE.CylinderGeometry(3.4, 3.7, 0.55, 32), stoneMat, -17, 0.28, 9, true);
  add(new THREE.CylinderGeometry(2.9, 2.9, 0.08, 32), poolMat, -17, 0.58, 9);
  add(new THREE.CylinderGeometry(0.35, 0.55, 1.35, 12), goldMat, -17, 1.25, 9);
  add(new THREE.SphereGeometry(0.45, 16, 12), EM(0x9feaff, 1.4), -17, 2.05, 9);
  /* Valet/security pavilion and bollards. */
  add(new THREE.BoxGeometry(4.8, 2.8, 3.8), stoneMat, 19, 1.4, 13, true);
  add(new THREE.BoxGeometry(5.0, 0.18, 4.0), goldMat, 19, 2.86, 13);
  add(new THREE.BoxGeometry(3.6, 1.1, 0.12), glassMat, 19, 1.55, 11.05);
  for (let i = 0; i < 8; i++) add(new THREE.CylinderGeometry(0.12, 0.14, 0.8, 8), goldMat, -8 + i * 2.3, 0.4, 16.5);
  /* Apron */

  /* Arrival boulevard dressing: colourful tropical beds, canopy lights,
     valet lane, decorative palms and a second garden water feature. */
  const tropical = [M(0x267a43, 1), M(0x4b9b50, 1), M(0xf0a34a, .8), M(0xe7d26a, .8), M(0xd96b83, .8)];
  for (let i = 0; i < 10; i++) {
    const x = -24 + i * 5.3;
    add(new THREE.BoxGeometry(4.2, .42, 2.6), M(0x806044, .95), x, .22, 20, true);
    add(new THREE.BoxGeometry(4.0, .18, 2.4), M(0x327b42, 1), x, .5, 20);
    for (let j = 0; j < 5; j++) {
      const flower = add(new THREE.SphereGeometry(.24, 8, 6), tropical[(i + j) % tropical.length], x - 1.5 + j * .72, .78, 19.7 + (j % 2) * .5);
    }
  }
  // Covered valet lane and illuminated bollards.
  add(new THREE.BoxGeometry(26, .22, 5), M(0x34343a, .6), 0, .14, 25);
  for (let i = 0; i < 12; i++) {
    const x = -15 + i * 2.7;
    add(new THREE.CylinderGeometry(.11, .14, .9, 8), goldMat, x, .45, 27);
    add(new THREE.SphereGeometry(.16, 8, 6), EM(0xffd88a, 1.2), x, .96, 27);
  }
  // Tropical ornamental trees and low hedges around the arrival court.
  for (const x of [-23, -18, 23, 28]) {
    for (const z of [-2, 7, 16]) {
      add(new THREE.CylinderGeometry(.22, .3, 4.2, 8), palmTrunk, x, 2.1, z, true);
      for (let f = 0; f < 7; f++) {
        const a = f * Math.PI * 2 / 7;
        const frond = add(new THREE.ConeGeometry(.42, 2.6, 5), palmLeaf, x + Math.cos(a) * .9, 4.5, z + Math.sin(a) * .9);
        frond.rotation.set(Math.cos(a) * 1.1, 0, -Math.sin(a) * 1.1);
      }
    }
  }
  // Separate garden reflecting pool with a tiled border.
  add(new THREE.BoxGeometry(9, .22, 5), stoneMat, -20, .12, 26);
  add(new THREE.BoxGeometry(8.4, .08, 4.4), poolMat, -20, .27, 26);
  for (let i = 0; i < 4; i++) add(new THREE.SphereGeometry(.18, 8, 6), EM(0x9deaff, 1.5), -22.5 + i * 1.65, .9, 26);

  /* Sign + 5 stars */
  const lbl = textLabel(meta.name, meta.sub);
  lbl.position.y = 6.4;
  lbl.scale.multiplyScalar(1.3);
  g.add(lbl);
  for (let i = 0; i < 5; i++) add(new THREE.OctahedronGeometry(0.32, 0), EM(0xffd76b, 1.8), -2.4 + i * 1.2, 5.6, 6.4);

  /* The old tower was ~12m; scale so the landmark stays in proportion
     with the other exteriors on the map. */
  g.scale.setScalar(0.70);
  return g;
}
