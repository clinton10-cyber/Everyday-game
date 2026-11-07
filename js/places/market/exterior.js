import * as THREE from "three";
import { M, EM, textLabel } from "../../core/kit.js";
import meta from "./meta.js";

export function buildExterior() {
  const g = new THREE.Group();
  const ac = new THREE.Color(meta.color);
  
  // Main warehouse structure
  const base = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 6), M(0x8a6a4a, 0.9));
  base.position.y = 1.5;
  base.castShadow = true;
  g.add(base);

  // Corrugated roof
  for (let i = -3.5; i <= 3.5; i += 1) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 6.5), M(0x9a9a9a, 0.7));
    panel.position.set(i, 3.1, 0);
    panel.rotation.z = 0.15;
    g.add(panel);
  }

  // Colorful Awnings over the entrance
  const colors = [0xd0392b, 0x2f8f5b, 0xe0a41c, 0x2b6fd0, 0xc0392b, 0x8a4a8a];
  for (let i = -2; i <= 2; i += 1) {
    const awning = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 1.5), M(colors[i + 2]));
    awning.position.set(i * 1.2, 2.5, 3.2);
    awning.rotation.x = 0.2;
    g.add(awning);
  }

  // Crates outside
  for (let i = 0; i < 5; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), M(0xa8743f));
    crate.position.set(-3 + i * 1.5, 0.3, 3.5);
    g.add(crate);
  }

  const lbl = textLabel(meta.name, meta.sub);
  lbl.position.y = 4.5;
  g.add(lbl);

  return g;
}
