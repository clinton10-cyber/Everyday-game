import * as THREE from "three";
import { M, EM, box, cyl, textLabel, windowTexture, getEnv } from "../../core/kit.js";
import meta from "./meta.js";

export function buildExterior() {
  const g = new THREE.Group();
  const accent = new THREE.Color(meta.color);
  const body = new THREE.MeshStandardMaterial({
    map: windowTexture("#e8e4da", "#4d6f8f", 5, 7),
    roughness: 0.72, envMap: getEnv()
  });
  const top = M(accent.clone().multiplyScalar(0.75), 0.9);

  const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 2.6),
    [body, body, top, top, body, body]);
  base.position.y = 0.2; base.castShadow = true; base.receiveShadow = true;
  g.add(base);

  const tw = 2.0, th = 2.4, td = 2.0;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(tw, th, td),
    [body, body, top, top, body, body]);
  tower.position.y = 0.4 + th/2; tower.castShadow = true; tower.receiveShadow = true;
  g.add(tower);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(tw*0.9, 0.25, td*0.9),
    M(accent.clone().multiplyScalar(0.55), 0.6)
  );
  roof.position.y = 0.4 + th + 0.125; roof.castShadow = true;
  g.add(roof);

  const bc = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), EM(accent, 2.6));
  bc.position.y = 0.4 + th + 0.42;
  g.add(bc);

  const lbl = textLabel(meta.name, meta.sub);
  lbl.position.y = 0.4 + th + 1.6;
  g.add(lbl);

  return g;
}

