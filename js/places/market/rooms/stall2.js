import { furnish } from "../../../core/furnishings.js";

export default {
  id: "stall2",
  label: "FABRICS",
  x: 7, z: 0, w: 6, d: 9,
  floor: 0x382a1c,
  type: "stall",
  build(g, cx, cz, h) {
    furnish("stall", g, cx, cz, this.w, this.d, h);
  }
};

