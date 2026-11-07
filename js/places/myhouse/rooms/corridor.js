import * as THREE from "three";
import { M, EM } from "../../../core/kit.js";
import { kit } from "./_kit.js";
const PI = Math.PI;

export default {
  /* ENTRY HALL 36 x 4 */
  build(g, cx, cz, h) {
    const k = kit(g, cx, cz), { B, C, G } = k;
    k.rug(22, 1.2, 0, 0, 0x8a3a3a);
    // wall sconces along the north wall (clear of doorways)
    [-15, -8, 0, 6.3, 12.5].forEach(x => {
      B(.15, .15, .05, M(0x2a1f16, 1), x, 2.4, -1.86);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 8), EM(0xffcc88, 1.8));
      glow.position.set(cx + x, 2.4, cz - 1.8); g.add(glow);
    });
    // console table + mirror (north wall, between the two bedroom doors)
    const ct = G(6.3, -1.58, 0);
    B(1.4, .06, .45, M(0x5c3a22, 1), 0, .78, 0, ct);
    [[-.6, -.15], [.6, -.15], [-.6, .15], [.6, .15]].forEach(p => B(.06, .78, .06, M(0x3a2a1a, 1), p[0], .39, p[1], ct));
    k.mirror(6.3, 1.85, -1.87, 0, 1.2, .9);
    // bench + coat hooks at the west end
    const bn = G(-16.4, -1.5, 0);
    B(1.4, .08, .42, M(0x5c3a22, 1), 0, .46, 0, bn);
    [[-.6, -.14], [.6, -.14], [-.6, .14], [.6, .14]].forEach(p => B(.06, .46, .06, M(0x3a2a1a, 1), p[0], .23, p[1], bn));
    for (let i = 0; i < 4; i++) C(.02, .02, .12, M(0xc9ced6, .3, .9), -17.2 + i * .45, 1.75, -1.82, 6);
    // paintings on the south wall (between doorways) + corner plants
    k.wallArt(-6, 1.9, 1.87, PI, .9, .7, 0x8a7a4b);
    k.wallArt(6, 1.9, 1.87, PI, .9, .7, 0x4b7a6a);
    k.plant(-17.0, 1.35); k.plant(17.0, 1.35); k.plant(17.0, -1.35);
  }
};

