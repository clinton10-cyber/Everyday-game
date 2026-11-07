/* jobcenter/exterior.js -- an economic employment hub. Glass-fronted
   office tower with a "briefcase" sign, a public notice board, and a
   covered walkway. Same 40x40 footprint constraint as realestate. */
import * as THREE from "three";
import { M, EM, textLabel } from "../../core/kit.js";
import meta from "./meta.js";

export function buildExterior() {
  const g = new THREE.Group();

  // Ground plaza
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9.5, 0.3, 28),
    M(0xc8c8c2, 1)
  );
  plaza.position.y = 0.15; g.add(plaza);

  // Main tower
  const towerMat = M(0x4a6a8e, .85);
  const glassMat = EM(0x88c8ff, 1.0, 0x0a2540);
  const trimMat  = M(0xf4f8ff, .9);
  const accent   = M(0x4aa0ff, .9);

  const tower = new THREE.Mesh(new THREE.BoxGeometry(7, 14, 7), towerMat);
  tower.position.y = 7;
  tower.castShadow = tower.receiveShadow = true;
  g.add(tower);

  // Side wings
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 5), towerMat);
    w.position.set(side * 5, 4, 0);
    w.castShadow = w.receiveShadow = true;
    g.add(w);
  }

  // Roof trim + antenna
  const roof = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.4, 7.4), trimMat);
  roof.position.y = 14.2;
  g.add(roof);

  // Antenna
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), M(0xcccccc, .8));
  pole.position.y = 16.3;
  g.add(pole);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), EM(0xff3333, 2.2));
  beacon.position.y = 18.3;
  g.add(beacon);

  // Glass curtain wall — grid on all four sides
  const winSize = { w: 1.1, h: 2.2 };
  for (let row = 0; row < 5; row++) {
    for (let col = -2; col <= 2; col++) {
      const y = 2.0 + row * 2.6;
      const x = col * 1.3;
      const frontWin = new THREE.Mesh(
        new THREE.PlaneGeometry(winSize.w, winSize.h), glassMat);
      frontWin.position.set(x, y, 3.51);
      g.add(frontWin);
      const backWin = frontWin.clone();
      backWin.position.z = -3.51; backWin.rotation.y = Math.PI;
      g.add(backWin);
      const leftWin = frontWin.clone();
      leftWin.position.set(-3.51, y, x); leftWin.rotation.y = -Math.PI / 2;
      g.add(leftWin);
      const rightWin = frontWin.clone();
      rightWin.position.set(3.51, y, x); rightWin.rotation.y = Math.PI / 2;
      g.add(rightWin);
    }
  }

  // Big blue "briefcase" sign on the front
  const briefcase = new THREE.Group();
  const bcBody = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.0, 0.3), accent);
  briefcase.add(bcBody);
  const bcHandle = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 0.2), accent);
  bcHandle.position.y = 1.2;
  briefcase.add(bcHandle);
  const bcStripe = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.15, 0.31), M(0xffd700, .8));
  bcStripe.position.y = -0.2;
  briefcase.add(bcStripe);
  briefcase.position.set(0, 10.5, 3.6);
  g.add(briefcase);

  // Front entrance — glass doors + lintel
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.4, 0.15), M(0x141c26, .7));
  door.position.set(0, 1.7, 3.58);
  g.add(door);
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 3.0), EM(0x6aaeff, 1.2, 0x0a2540));
  doorGlass.position.set(0, 1.7, 3.65);
  g.add(doorGlass);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.4, 1.0), trimMat);
  lintel.position.set(0, 3.7, 3.9);
  g.add(lintel);

  // Public notice board outside
  const boardBase = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 0.15), M(0x5a3a1a, .9));
  boardBase.position.set(-5.5, 1.0, 3.2);
  g.add(boardBase);
  const boardGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.3), EM(0xffe8a8, 1.4, 0x2a1a00));
  boardGlow.position.set(-5.5, 1.0, 3.3);
  g.add(boardGlow);
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2, 6), M(0x2a2a2a, .8));
    p.position.set(-5.5 + sx * 1.1, 1.0, 3.2);
    g.add(p);
  }

  // Side wing signs
  for (const side of [-1, 1]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.6), EM(0x4aa0ff, 1.4, 0x0a2030));
    sign.position.set(side * 5, 6.5, 2.55);
    g.add(sign);
  }

  const lbl = textLabel(meta.name, meta.sub);
  lbl.position.y = 19.6;
  g.add(lbl);
  return g;
}
