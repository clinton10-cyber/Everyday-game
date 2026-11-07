import * as THREE from "three";
import { M, EM } from "../../../core/kit.js";
import { kit, buildBath } from "./_kit.js";
const PI = Math.PI;

export default {
  /* MASTER BEDROOM 12 x 13 */
  build(g, cx, cz, h) {
    const k = kit(g, cx, cz), { B, C, G } = k;
    k.rug(5.8, 4.4, 0, -3.3, 0x8a3a4a);
    k.bed(0, -5.2, 0, { w: 1.9, len: 2.2 });
    [-1.5, 1.5].forEach(x => k.nightstand(x, -6.15, 0));
    k.wallArt(0, 2.0, -6.38, 0, 1.6, .9, 0x6a4b7a);
    // bench at foot of bed
    const bn = G(0, -3.45, 0);
    B(1.7, .08, .5, M(0x5c3a22, 1), 0, .46, 0, bn);
    B(1.64, .16, .44, M(0x8a5a7a, 1), 0, .56, 0, bn);
    [[-.75, -.15], [.75, -.15], [-.75, .15], [.75, .15]].forEach(p => B(.06, .46, .06, M(0x3a2a1a, 1), p[0], .23, p[1], bn));
    // wardrobes on west wall
    k.wardrobe(-5.58, -1.0, PI / 2, 1.9);
    k.wardrobe(-5.58, 1.0, PI / 2, 1.9);
    // vanity on east wall between the doors
    k.desk(5.6, -.6, -PI / 2, 1.3);
    k.chair(4.85, -.6, PI / 2, 0x8a5a7a);
    k.mirror(5.87, 1.7, -.6, -PI / 2, 1.0, .9);
    // reading corner (south-west) + plants
    k.armchair(-3.6, 4.6, PI * .75);
    k.floorLamp(-2.2, 5.8);
    k.plant(5.6, 5.7); k.plant(-5.5, -5.8); k.plant(5.5, -5.8);
  }
};

