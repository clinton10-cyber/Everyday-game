/* airplane/exterior.js -- a Boeing-787 parked on the apron. This is
   the token that lives inside the "LANDED AIRCRAFT" compound on the
   city map, so it must fit inside a 40x40 tap plane (base is ~26x26
   with wings, fuselage stretches x -14..+14). It's the same visual
   language as the giant 60-unit plane that drive.js renders. */
import * as THREE from "three";
import { M, EM, textLabel } from "../../core/kit.js";
import meta from "./meta.js";

export function buildExterior() {
  const g = new THREE.Group();

  // Apron paving
  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(30, 0.1, 30),
    M(0x3a3f46, 1)
  );
  apron.position.y = 0.05;
  g.add(apron);

  // Runway stripes
  for (let i = -6; i <= 6; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(2, 0.02, 0.8), M(0xf4f4ec, 1));
    s.position.set(i * 2.1, 0.12, 0);
    g.add(s);
  }

  // Runway edge lights
  for (let i = -6; i <= 6; i++) {
    for (const z of [-12.8, 12.8]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), EM(0xffe8a0, 2.0));
      l.position.set(i * 2.1, 0.35, z);
      g.add(l);
    }
  }

  const whiteMat = M(0xeef2f6, .6);
  const darkMat  = M(0x1a1c22, .85);
  const tailMat  = M(0x2a5f9e, .8);
  const engMat   = M(0xc8cdd2, .7);
  const glassMat = EM(0xa8d4e8, 1.0, 0x0a1a2a);

  // Fuselage
  const fus = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 22, 14, 1),
    whiteMat
  );
  fus.rotation.z = Math.PI / 2;
  fus.position.y = 3.4;
  g.add(fus);

  // Nose cone
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(2.4, 3.4, 14),
    whiteMat
  );
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(12.7, 3.4, 0);
  g.add(nose);

  // Tail cone
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(1.3, 4.0, 12),
    whiteMat
  );
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-13.0, 3.4, 0);
  g.add(tail);

  // Wings
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 13), whiteMat);
    wing.position.set(-1.5, 3.2, side * 7.5);
    g.add(wing);
    // Winglet
    const wl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 2.4), tailMat);
    wl.position.set(-1.5, 4.4, side * 12.8);
    g.add(wl);
    // Engine nacelle
    const eng = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.3, 3.4, 10),
      engMat
    );
    eng.rotation.x = Math.PI / 2;
    eng.position.set(-1.0, 2.1, side * 5.6);
    g.add(eng);
    const intake = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.3, 0.3, 10),
      darkMat
    );
    intake.rotation.x = Math.PI / 2;
    intake.position.set(-1.0, 2.1, side * 5.6 + 1.7);
    g.add(intake);
  }

  // Vertical fin
  const vfin = new THREE.Mesh(new THREE.BoxGeometry(4.0, 5.6, 0.4), whiteMat);
  vfin.position.set(-10.5, 7.2, 0);
  g.add(vfin);
  const vstripe = new THREE.Mesh(new THREE.BoxGeometry(4.02, 0.5, 0.42), tailMat);
  vstripe.position.set(-10.5, 8.5, 0);
  g.add(vstripe);

  // Horizontal stabilisers
  for (const side of [-1, 1]) {
    const hs = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 4.5), whiteMat);
    hs.position.set(-10.5, 4.0, side * 3.0);
    g.add(hs);
  }

  // Window strip on both sides
  for (const side of [-1, 1]) {
    for (let i = -8; i <= 8; i++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.42), glassMat);
      w.position.set(i * 1.0, 4.1, side * 2.4);
      w.rotation.y = side > 0 ? 0 : Math.PI;
      g.add(w);
    }
  }

  // Cockpit window
  const cw = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), glassMat);
  cw.position.set(11.8, 4.3, 0);
  cw.rotation.y = Math.PI / 2;
  g.add(cw);

  // Landing gear (3 struts + wheels)
  const gearStops = [
    { x: 8, z: 0 },
    { x: -1.5, z: 2.8 },
    { x: -1.5, z: -2.8 },
  ];
  for (const gg of gearStops) {
    const strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 3.0, 6),
      darkMat
    );
    strut.position.set(gg.x, 1.7, gg.z);
    g.add(strut);
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.3, 10),
      darkMat
    );
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(gg.x, 0.55, gg.z);
    g.add(wheel);
  }

  const lbl = textLabel(meta.name, meta.sub);
  lbl.position.y = 11.5;
  g.add(lbl);
  return g;
}
