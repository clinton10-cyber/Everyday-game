import { furnish } from "../../../core/furnishings.js";

export default {
  id: "stall1",
  label: "FOOD STUFF",
  x: 0, z: 0, w: 7, d: 9,
  floor: 0x382a1c,
  type: "stall",
  build(g, cx, cz, h) {
    furnish("stall", g, cx, cz, this.w, this.d, h);
  }
};

