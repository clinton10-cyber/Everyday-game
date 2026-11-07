import * as THREE from "three";
import { M, EM } from "../../../core/kit.js";
import { kit } from "./_kit.js";
const PI = Math.PI;

export default {
  /* LIVING ROOM 13 x 13. TV on west wall, sofa faces it. */
  build(g, cx, cz, h) {
    const k = kit(g, cx, cz), { B, C, G } = k;
    k.rug(6.4, 4.6, -3.2, 0, 0x8a4f4f);
    // TV unit centred on west wall
    const tv = G(-6.1, 0, PI / 2);
    B(1.9, .5, .5, M(0x3b2415, 1), 0, .25, 0, tv);
    B(1.6, .9, .06, M(0x141414, .6, .3), 0, 1.15, -.05, tv);
    B(1.5, .78, .02, M(0x1a3040, .2), 0, 1.15, -.01, tv);
    // sofa faces the TV; two armchairs flank the coffee table
    k.sofa(-1.7, 0, -PI / 2, 3.8);
    k.armchair(-3.6, -2.7, 0);
    k.armchair(-3.6, 2.7, PI);
    const tt = G(-3.6, 0, PI / 2);
    B(1.5, .07, .8, M(0x3b2415, 1), 0, .42, 0, tt);
    [[-.65, -.28], [.65, -.28], [-.65, .28], [.65, .28]].forEach(p => B(.06, .42, .06, M(0x3b2415, 1), p[0], .21, p[1], tt));
    C(.06, .08, .14, M(0xf7f6f3, 1), 0.4, .5, 0, 10, tt);
    B(.35, .06, .25, M(0x8c3b3b, 1), -.4, .46, 0, tt);
    // side table + lamp beside sofa, floor lamp, plants
    const st = G(-1.7, -2.5, 0);
    B(.5, .06, .5, M(0x3b2415, 1), 0, .5, 0, st); C(.05, .05, .5, M(0x3b2415, 1), 0, .25, 0, 8, st);
    C(.1, .14, .24, M(0xfff2d6, .9), 0, .72, 0, 10, st);
    k.floorLamp(-1.7, 2.5);
    k.plant(-6.0, -6.0); k.plant(-6.0, 6.0); k.plant(5.8, 5.8);
    // work / reading nook in the south-east, well away from the sofa
    k.desk(3.2, 6.05, PI, 1.6);
    k.chair(3.2, 5.2, 0, 0x2a2a2e);
    // wall art
    k.wallArt(-3.5, 1.9, -6.38, 0, 1.4, .9, 0x4b6a8a);
    k.wallArt(3.5, 1.9, -6.38, 0, 1.4, .9, 0x7a5a4b);
  }
};

