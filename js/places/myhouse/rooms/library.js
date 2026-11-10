import * as THREE from "three";
import { M, EM } from "../../../core/kit.js";
import { kit, buildBath } from "./_kit.js";
const PI = Math.PI;

export default {
  /* LIBRARY 13 x 13: shelves on E/N/W walls, big reading table, lounge corner. */
  build(g, cx, cz, h) {
    const k = kit(g, cx, cz), { B, C, G } = k;
    k.rug(6.2, 4.2, .5, -1.6, 0x6b6350);
    [-3.9, -1.3, 1.3, 3.9].forEach(z => k.bookshelf(6.2, z, -PI / 2));
    [-3.6, 3.6].forEach(x => k.bookshelf(x, -6.18, 0));
    [-3.9, 3.9].forEach(z => k.bookshelf(-6.18, z, PI / 2));
    // reading table + chairs
    k.table(.5, -1.6, 0, 3.2, 1.2, .75, 0x7a5a38);
    [-1, 0, 1].forEach(dx => {
      k.chair(.5 + dx, -2.45, 0, 0x6b4a2f);
      k.chair(.5 + dx, -.75, PI, 0x6b4a2f);
    });
    C(.1, .14, .24, M(0xfff2d6, .9), .5, .9, -1.6, 10);
    // lounge corner: two armchairs facing each other over a round table
    k.rug(4.4, 3.2, 2.6, 3.9, 0x5a3c3c);
    k.armchair(4.4, 3.9, -PI / 2);
    k.armchair(.9, 3.9, PI / 2);
    C(.5, .5, .05, M(0x3b2415, 1), 2.65, .5, 3.9, 20);
    C(.05, .05, .5, M(0x3b2415, 1), 2.65, .25, 3.9, 8);
    k.floorLamp(5.7, 5.5); k.floorLamp(-.9, 5.5);
    k.plant(-5.7, 5.7); k.plant(-5.7, -5.7); k.plant(5.6, -5.7 + 0);
  }
};

