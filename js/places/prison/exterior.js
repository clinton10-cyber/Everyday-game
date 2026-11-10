import * as THREE from "three";
import { M, EM, box, textLabel, windowTexture, getEnv } from "../../core/kit.js";
import meta from "./meta.js";

export function buildExterior() {
  const g = new THREE.Group();
  const ac = new THREE.Color(meta.color);
  const wt = windowTexture("#8a9099", "#30363c", 3, 3);
  const wm = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.9, envMap: getEnv() });
  const roof = M(ac.clone().multiplyScalar(0.5), 0.9);
  const stone = M(0x5a5f66, 0.95);
  const trim = M(0x3a3f44, 0.9);

  // Wide imposing main block
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.6, 3.0),
    [wm, wm, roof, roof, wm, wm]);
  base.position.y = 0.8;
  base.castShadow = base.receiveShadow = true;
  g.add(base);

  // Upper block
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.0, 2.4),
    [wm, wm, roof, roof, wm, wm]);
  top.position.y = 2.1;
  top.castShadow = top.receiveShadow = true;
  g.add(top);

  // Watchtowers at corners
  [[-1.9,-1.5],[1.9,-1.5],[-1.9,1.5],[1.9,1.5]].forEach(p => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.4, 0.55), stone);
    t.position.set(p[0], 1.2, p[1]);
    t.castShadow = true;
    g.add(t);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.5, 4), trim);
    cap.position.set(p[0], 2.65, p[1]);
    cap.rotation.y = Math.PI / 4;
    g.add(cap);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), EM(0xff5533, 2));
    beacon.position.set(p[0], 2.95, p[1]);
    g.add(beacon);
  });

  // Door
  g.add(box(0.6, 1.0, 0.08, M(0x1a1a1e, 1), 0, 0.5, 1.53));

  // Small windows (barred)
  [-1.3, -0.5, 0.5, 1.3].forEach(x => {
    g.add(box(0.35, 0.4, 0.05, M(0x1a1a20, 0.3), x, 1.7, 1.22));
    g.add(box(0.4, 0.02, 0.06, M(0x9aa0a8, 0.4, 0.7), x, 1.7, 1.24));
  });

  const lbl = textLabel(meta.name, meta.sub);
  lbl.position.y = 3.6;
  g.add(lbl);

  return g;
}

