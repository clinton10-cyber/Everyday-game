import * as THREE from "three";
import { M, EM } from "../../../core/kit.js";
import { kit, buildBath } from "./_kit.js";
const PI = Math.PI;

export default {
  /* BEDROOM 2  5 x 7.5 -- doors in the middle of every wall, furniture in corners */
  build(g, cx, cz, h) {
    const k = kit(g, cx, cz);
    k.rug(2.6, 2.4, -.2, .7, 0x3f5a6b);
    k.bed(-1.55, -2.6, 0, { w: 1.1, len: 2.0, frame: 0x5c3a22, blanket: 0x3f5a6b });
    k.wardrobe(1.7, -3.33, 0, 1.3, 2.0, .6, 0x8a6a3a);
    k.desk(-1.7, 3.33, PI, 1.2);
    k.chair(-1.7, 2.65, 0, 0x2a2a2e);
    k.plant(2.0, 3.0);
  }
};

