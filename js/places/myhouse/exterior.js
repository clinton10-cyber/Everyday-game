/* My House -- exterior.
   One building everywhere: this Lagos "flat mansion" block (cream render, gold
   cornice, wrap-around glass balconies, set-back penthouse, rooftop tank,
   gated compound) is the same design used by the open-world landmark
   (world/phworld.js bMyHouse) and the map-app icon, so the house you see in the
   city is the house you walk into.
   Local units: the exterior scene scales this group x4. */
import * as THREE from "three";
import { M, EM, textLabel, windowTexture, getEnv } from "../../core/kit.js";
import meta from "./meta.js";

export function buildExterior() {
  const g = new THREE.Group();
  const add = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const B = (w, h, d, mat, x, y, z) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), x, y, z);
  const C = (rt, rb, h, mat, x, y, z, seg = 12) => add(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat), x, y, z);

  const cream = M(0xefe8d6, .9), white = M(0xfbf8f1, .85), gold = M(0xc9a64a, .35, .7);
  const glass = new THREE.MeshStandardMaterial({ color: 0x6fa4c4, roughness: .15, metalness: .3, transparent: true, opacity: .75, envMap: getEnv() });
  const paving = M(0x9a9b93, .95), lawn = M(0x5e8a44, 1), dark = M(0x2a2a2e, .8), wood = M(0x5c3a22, .85);
  const wt = windowTexture("#f3e8d6", "#5c80a0", 6, 4);
  const wm = new THREE.MeshStandardMaterial({ map: wt, roughness: .8, envMap: getEnv() });

  const FLOORS = 4, FH = .9, BW = 6.4, BD = 3.6, BH = FLOORS * FH;   // body
  // compound
  B(9, .06, 6.6, paving, 0, .03, .6);
  B(9, .07, 1.5, lawn, 0, .035, 2.8);
  // main body (window-textured sides, plain cream top/bottom)
  const body = new THREE.Mesh(new THREE.BoxGeometry(BW, BH, BD), [wm, wm, cream, cream, wm, wm]);
  add(body, 0, BH / 2, 0);
  // floor slabs + glass balcony rails across the front
  for (let f = 0; f < FLOORS; f++) {
    B(BW + .1, .07, .55, white, 0, f * FH + .04, BD / 2 + .22);
    if (f > 0) B(BW + .1, .28, .05, glass, 0, f * FH + .21, BD / 2 + .47);
    B(.05, .28, .55, glass, -BW / 2 - .02, f * FH + .21, BD / 2 + .22);
    B(.05, .28, .55, glass, BW / 2 + .02, f * FH + .21, BD / 2 + .22);
  }
  // gold cornice + parapet
  B(BW + .22, .1, BD + .22, gold, 0, BH + .04, 0);
  B(BW + .1, .14, BD + .1, white, 0, BH + .16, 0);
  // set-back penthouse + terrace
  B(BW * .62, FH * .95, BD * .7, cream, -.3, BH + FH * .5 + .1, -.1);
  B(BW * .62 + .2, .08, BD * .7 + .2, gold, -.3, BH + FH + .12, -.1);
  B(BW * .5, FH * .5, .04, glass, -.3, BH + FH * .5 + .08, BD * .35 - .08);
  // rooftop water tank on legs + lift motor room
  for (const [lx, lz] of [[-1, -.2], [1, -.2], [-1, .5], [1, .5]]) B(.05, .4, .05, M(0x6a6f75, .8), 1.7 + lx * .3, BH + .38, -.9 + lz * .3);
  C(.34, .34, .5, M(0x575b61, .7, .2), 1.7, BH + .8, -.75, 14);
  B(.8, .45, .8, white, -2.2, BH + .4, -1.1);
  // grand entrance: canopy + columns + glass door
  B(1.7, .08, 1.0, gold, 0, FH - .12, BD / 2 + .75);
  for (const sx of [-1, 1]) C(.045, .045, FH - .2, white, sx * .75, (FH - .2) / 2, BD / 2 + 1.1);
  B(.7, .62, .05, dark, 0, .31, BD / 2 + .03);
  B(.64, .56, .02, glass, 0, .32, BD / 2 + .06);
  [-1, 1].forEach(sx => B(.12, .12, .12, EM(0xffe7a0, 1.6), sx * .75, .75, BD / 2 + 1.1));
  // perimeter wall + gate pillars (front wall has a gate gap)
  for (const sx of [-1, 1]) {
    B(3.3, .22, .06, white, sx * 2.85, .11, 3.9);
    B(.1, .3, .1, gold, sx * 1.35, .15, 3.9);
  }
  B(.06, .22, 4.4, white, -4.4, .11, 1.8); B(.06, .22, 4.4, white, 4.4, .11, 1.8);
  // gate-house + generator house
  B(.5, .38, .5, white, 3.7, .19, 3.2);
  B(.7, .34, .5, M(0x8e9298, .8), 3.7, .17, -1.7);
  C(.03, .03, .3, dark, 3.9, .45, -1.7, 6);
  // palms
  for (const [px, pz] of [[-3.6, 2.9], [3.6, 2.2], [-3.9, -1.2]]) {
    C(.04, .06, .9, M(0x7a5b3c, 1), px, .45, pz, 6);
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(.5, .02, .1), M(0x3f7a44, 1));
      leaf.position.set(px + Math.cos(a) * .22, .95, pz + Math.sin(a) * .22);
      leaf.rotation.y = -a; leaf.rotation.z = -.35; leaf.castShadow = true; g.add(leaf);
    }
  }
  // parked car
  B(.55, .14, .28, M(0x2f5f8f, .5, .3), -3.0, .1, 3.0);
  B(.3, .1, .24, glass, -3.0, .22, 3.0);

  const lb = textLabel(meta.name, meta.sub); lb.position.y = BH + 1.6; g.add(lb);
  return g;
}
