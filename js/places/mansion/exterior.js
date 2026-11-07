import * as THREE from "three";
import { M, EM, box, textLabel, windowTexture, getEnv } from "../../core/kit.js";
import meta from "./meta.js";

export function buildExterior() {
  const g = new THREE.Group();
  const ac = new THREE.Color(meta.color);
  const wt = windowTexture("#e7e1d7", "#3a4654", 5, 3);
  const wm = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.88, envMap: getEnv() });
  const roof = M(0xb5afa4, 0.9);
  const trim = M(0xcdc6ba, 0.9);
  const glass = new THREE.MeshBasicMaterial({ color: 0x1b2a36, transparent: true, opacity: 0.6 });

  // Wide flat mansion block
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.3, 2.4), [wm, wm, roof, roof, wm, wm]);
  base.position.y = 0.65;
  base.castShadow = base.receiveShadow = true;
  g.add(base);

  const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.22, 2.6), roof);
  roofSlab.position.y = 1.42;
  g.add(roofSlab);

  // Fully glazed front
  const facade = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.1, 0.05), glass);
  facade.position.set(0, 0.75, 1.22);
  g.add(facade);

  // Portico posts
  [-1.6, -0.5, 0.6, 1.7].forEach(x => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.10, 1.2, 8), trim);
    p.position.set(x, 0.6, 1.5);
    g.add(p);
  });
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 1.0), roof);
  canopy.position.set(0, 1.26, 1.5);
  g.add(canopy);

  // Small hedges
  for (let i = 0; i < 8; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), M(0x2f6b34, 1));
    b.position.set(-2.0 + i * 0.55, 0.18, -1.6);
    g.add(b);
  }

  // Driveway
  const drive = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.06, 1.6), M(0x3b3b3f, 1));
  drive.position.set(0, 0.03, 2.4);
  g.add(drive);

  // Tiny parked car
  const tiny = new THREE.Group();
  const tb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 1.2), M(0x47525e, 0.4, 0.6));
  tb.position.y = 0.25; tiny.add(tb);
  const tc = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.6), M(0x1a1e24, 0.4, 0.6));
  tc.position.set(0, 0.48, -0.1); tiny.add(tc);
  tiny.position.set(-1.6, 0, 2.4);
  g.add(tiny);

  const lbl = textLabel(meta.name, meta.sub);
  lbl.position.y = 3.0;
  g.add(lbl);

  return g;
}

