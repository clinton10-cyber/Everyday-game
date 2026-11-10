import * as THREE from "three";
import { M, EM } from "../../../core/kit.js";
import { kit, buildBath } from "./_kit.js";
const PI = Math.PI;

export default {
  /* BEDROOM 3  8 x 13 */
  build(g, cx, cz, h) {
    const k = kit(g, cx, cz), { B, C, G } = k;
    k.rug(4.6, 3.6, 0, -3.2, 0x6b4a7a);
    k.bed(0, -5.3, 0, { w: 1.6, len: 2.1, frame: 0x3b2415, blanket: 0x6b4a7a });
    [-1.2, 1.2].forEach(x => k.nightstand(x, -6.15, 0, 0x3b2415));
    k.wallArt(0, 1.95, -6.38, 0, 1.2, .8, 0x6a4b7a);
    k.wardrobe(-3.6, -.5, PI / 2, 1.4, 2.2, .6, 0x3b2415);
    k.desk(3.6, -.4, -PI / 2, 1.4);
    k.chair(2.85, -.4, PI / 2, 0x2a2a2e);
    k.armchair(-3.0, 5.0, PI * .75);
    k.floorLamp(-1.8, 5.9);
    k.plant(3.3, 5.6);
  }
};

