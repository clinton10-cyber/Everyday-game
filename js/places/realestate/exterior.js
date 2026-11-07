/* realestate/exterior.js -- a proper 3-storey real-estate office in
   the same visual language as the city-map landmark models. Small
   footprint (fits inside the 40×40 tap plane in city.js) and uses
   shared kit.js helpers. */
import * as THREE from "three";
import { M, EM, textLabel } from "../../core/kit.js";
import meta from "./meta.js";

export function buildExterior() {
  const g = new THREE.Group();

  // Compound paving
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(8.5, 9.0, 0.3, 24),
    M(0xb8b0a4, 1)
  );
  plaza.position.y = 0.15;
  g.add(plaza);

  // Main 3-storey block
  const wallMat = M(0xe8e0d0, .9);
  const roofMat = M(0x3a3d44, .85);
  const trimMat = M(0xfff2d0, .9);
  const winMat  = EM(0xffe8a8, 1.6, 0x2a2010);
  const doorMat = M(0x2a4a6a, .9);

  const body = new THREE.Mesh(new THREE.BoxGeometry(9, 9, 7), wallMat);
  body.position.y = 4.5;
  body.castShadow = body.receiveShadow = true;
  g.add(body);

  // Roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.5, 7.6), roofMat);
  roof.position.y = 9.25;
  g.add(roof);

  // Rooftop signboard
  const board = new THREE.Mesh(new THREE.BoxGeometry(6, 1.4, 0.2), M(0x7a2020, .8));
  board.position.set(0, 10.2, 3.6);
  g.add(board);
  const boardGlow = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.1), EM(0xffd76a, 1.9, 0x2a1800));
  boardGlow.position.set(0, 10.2, 3.72);
  g.add(boardGlow);

  // Window grid — three floors × five bays
  for (let floor = 0; floor < 3; floor++) {
    const y = 1.8 + floor * 2.6;
    for (let bay = -2; bay <= 2; bay++) {
      const x = bay * 1.6;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.8), winMat);
      w.position.set(x, y, 3.51);
      g.add(w);
      // frame
      const f = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.06), trimMat);
      f.position.set(x, y - 1.0, 3.53); g.add(f);
      const f2 = f.clone(); f2.position.y = y + 1.0; g.add(f2);
    }
  }

  // Side windows (east & west)
  for (const side of [-1, 1]) {
    for (let floor = 0; floor < 3; floor++) {
      for (let bay = -1; bay <= 1; bay++) {
        const y = 1.8 + floor * 2.6;
        const z = bay * 2.0;
        const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6), winMat);
        w.position.set(side * 4.51, y, z);
        w.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        g.add(w);
      }
    }
  }

  // Entry portico (columns + canopy)
  for (const x of [-2.2, -0.7, 0.7, 2.2]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 4, 8), trimMat);
    c.position.set(x, 2, 4.2);
    g.add(c);
  }
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.3, 1.6), roofMat);
  canopy.position.set(0, 4.2, 4.2);
  g.add(canopy);

  // Front door
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.1), doorMat);
  door.position.set(0, 1.3, 3.55);
  g.add(door);
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.2), EM(0x9fd8ff, 1.2, 0x0a2a3a));
  doorGlass.position.set(0, 1.3, 3.61);
  g.add(doorGlass);

  // Little plants flanking the door
  for (const side of [-1, 1]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.32, 0.5, 10), M(0x8a5a3a, .9));
    pot.position.set(side * 1.8, 0.55, 4.6);
    g.add(pot);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), M(0x3f7a44, 1));
    bush.position.set(side * 1.8, 1.15, 4.6);
    g.add(bush);
  }

  const lbl = textLabel(meta.name, meta.sub);
  lbl.position.y = 12.2;
  g.add(lbl);
  return g;
}
