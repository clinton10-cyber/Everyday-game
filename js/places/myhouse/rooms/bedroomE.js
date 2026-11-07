import * as THREE from "three";
import { M, EM } from "../../../core/kit.js";
import { kit, buildBath } from "./_kit.js";
const PI = Math.PI;

export default {
  /* BEDROOM 5  6 x 13 */
  build(g, cx, cz, h) {
    const k = kit(g, cx, cz);
    k.rug(3.4, 3.0, 0, -3.0, 0x5c3a5c);
    k.bed(0, -5.3, 0, { w: 1.3, len: 2.0, frame: 0x5c3a22, blanket: 0x3f5a6b });
    k.nightstand(-1.15, -6.15, 0);
    k.wardrobe(2.6, -1.0, -PI / 2, 1.8, 2.1, .6);
    k.desk(-2.6, -.2, PI / 2, 1.4, 0x5c3a22);
    k.chair(-1.85, -.2, -PI / 2, 0x2a2a2e);
    k.bookshelf(2.7, 3.6, -PI / 2, 2.0, 2.2);
    k.plant(-2.3, 5.7);
  }
};

