import * as THREE from "three";
import { M, EM } from "../../../core/kit.js";
import { kit } from "./_kit.js";
const PI = Math.PI;

export default {
  /* KITCHEN 10 x 13. Counters on N + W walls, fridge by the hall door,
     dining set in the middle. Front-door gap stays clear on the south wall. */
  build(g, cx, cz, h) {
    const k = kit(g, cx, cz), { B, C, G } = k;
    const bm = M(0xf7f6f3, 1), tm = M(0x3b2415, 1);
    // north counter run (west of hall door) -- stove is a separate interactive
    B(2.9, .9, .65, bm, -3.35, .45, -6.05);
    B(2.96, .06, .72, tm, -3.35, .92, -6.03);
    // west counter run
    B(.65, .9, 4.6, bm, -4.56, .45, -3.4);
    B(.72, .06, 4.66, tm, -4.52, .92, -3.4);
    // sink (north run, west end)
    B(.6, .06, .42, M(0xc6cbd0, .2, .9), -4.0, .95, -6.05);
    B(.52, .12, .36, M(0x8a8a8a, .3, .7), -4.0, .88, -6.05);
    C(.02, .02, .28, M(0xc6cbd0, .2, .95), -4.0, 1.1, -6.3, 8);
    // upper cabinets along north wall and west wall
    for (let i = 0; i < 5; i++) {
      const ux = -4.4 + i * .72;
      B(.68, .6, .35, M(0xe8e4d8, 1), ux, 2.15, -6.22);
    }
    for (let i = 0; i < 5; i++) B(.35, .6, .68, M(0xe8e4d8, 1), -4.72, 2.15, -5.2 + i * .78 + 0.3);
    // fridge + pantry on the north wall east of the hall door
    B(.9, 2.05, .75, M(0xc6cbd0, .4, .4), 1.55, 1.02, -6.0);
    B(.88, .02, .76, M(0x8a8a8a, .5), 1.55, 1.3, -6.0);
    C(.03, .03, .45, M(0xc9ced6, .2, .9), 1.18, 1.5, -5.6, 6);
    B(.8, .9, .65, bm, 2.55, .45, -6.05);
    B(.86, .06, .72, tm, 2.55, .92, -6.03);
    B(1.0, 2.1, .6, M(0xe8e4d8, 1), 3.55, 1.05, -6.05);
    // pantry on east wall + dining set
    B(.6, 2.0, 1.1, M(0xe8e4d8, 1), 4.6, 1.0, -4.95);
    k.rug(3.4, 2.4, .5, 2.9, 0x8a6a4a);
    k.table(.5, 2.9, 0, 2.5, 1.2, .75);
    [-.8, 0, .8].forEach(dx => {
      k.chair(.5 + dx, 1.85, 0);        // north side, facing south
      k.chair(.5 + dx, 3.95, PI);       // south side, facing north
    });
    // pendant over table
    C(.04, .04, .6, M(0x2a2a2a, 1), .5, 3.1, 2.9, 6);
    C(.3, .4, .24, M(0x1a1a1a, .7), .5, 2.7, 2.9, 12);
    k.plant(-4.3, 5.9); k.plant(4.3, 5.9);
  }
};

