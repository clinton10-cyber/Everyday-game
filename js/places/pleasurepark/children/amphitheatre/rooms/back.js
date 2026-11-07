import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "back",
  label: "BACKSTAGE",
  x: 14, z: 0, w: 10, d: 10,
  floor: 0x3a2a1a,
  type: "lounge",
  build(g, cx, cz, h) {
    furnish("lounge", g, cx, cz, this.w, this.d, h);
  }
};

