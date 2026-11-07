import { furnish } from "../../../core/furnishings.js";

export default {
  id: "stall7",
  label: "SHOES & BAGS",
  x: 13, z: 9, w: 6, d: 9,
  floor: 0x382a1c,
  type: "stall",
  build(g, cx, cz, h) {
    furnish("stall", g, cx, cz, this.w, this.d, h);
  }
};

