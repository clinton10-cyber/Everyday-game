import * as THREE from "three";
import { M, EM, box, textLabel, windowTexture, getEnv } from "../../core/kit.js";
import meta from "./meta.js";

export function buildExterior() {
  const g = new THREE.Group();
  const ac = new THREE.Color(0xffd76b);
  const wt = windowTexture("#eae4d6", "#3a4654", 5, 3);
  const wm = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.85, envMap: getEnv() });
  const roof = M(0x8a8478, 0.85);
  const trim = M(0xf0ece2, 0.9);
  const gold = M(0xd4af37, 0.35, 0.7);

  /* Wide symmetric mansion */
  const base = new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.5, 2.8), [wm, wm, roof, roof, wm, wm]);
  base.position.y = 0.75;
  base.castShadow = base.receiveShadow = true;
  g.add(base);

  const mid = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 2.2), [wm, wm, roof, roof, wm, wm]);
  mid.position.y = 1.85;
  mid.castShadow = true;
  g.add(mid);

  /* Central dome + flag */
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold);
  dome.position.y = 2.2;
  g.add(dome);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6), trim);
  pole.position.y = 3.0;
  g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.22), EM(0x4ade80, 1.2, 0x0a2a10));
  flag.position.set(0.19, 3.2, 0);
  g.add(flag);

  /* Portico columns */
  [-1.4, -0.7, 0, 0.7, 1.4].forEach(x => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.4, 8), trim);
    c.position.set(x, 0.75, 1.6);
    g.add(c);
  });
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 0.9), roof);
  canopy.position.set(0, 1.52, 1.6);
  g.add(canopy);

  /* Gold railings on either side */
  [-2.1, 2.1].forEach(x => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.08), gold);
    r.position.set(x, 0.9, 1.45);
    g.add(r);
  });

  /* Tiny lights */
  for (let i = -2; i <= 2; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), EM(0xffe8a0, 2));
    l.position.set(i * 0.8, 0.5, 1.75);
    g.add(l);
  }

  /* Gardens */
  for (let i = 0; i < 10; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.28, 0.35), M(0x2f6b34, 1));
    b.position.set(-2.5 + i * 0.55, 0.14, -1.8);
    g.add(b);
  }

  /* Driveway */
  const drive = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.06, 2.0), M(0x2a2a2e, 1));
  drive.position.set(0, 0.03, 2.8);
  g.add(drive);

  /* Two flag cars parked */
  [-1.4, 1.4].forEach(x => {
    const c = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 1.4), M(0x1a1c1e, 0.3, 0.7));
    b.position.y = 0.28; c.add(b);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.7), M(0x0a0c10, 0.4, 0.6));
    t.position.set(0, 0.55, -0.15); c.add(t);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.1), EM(0xff3b30, 1.6));
    bar.position.set(0, 0.48, 0.7); c.add(bar);
    c.position.set(x, 0, 2.5);
    c.rotation.y = Math.PI;
    g.add(c);
  });

  const lbl = textLabel(meta.name, meta.sub);
  lbl.position.y = 3.8;
  g.add(lbl);
  const crown = textLabel("\uD83D\uDC51", "");
  crown.position.y = 4.4;
  crown.scale.multiplyScalar(0.6);
  g.add(crown);

  return g;
}

