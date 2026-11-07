import { furnish } from "../../../core/furnishings.js";

export default {
  id: "clounge",
  label: "CUSTOMER LOUNGE",
  x: 23, z: 9, w: 7, d: 9,
  floor: 0x3a2a1a,
  type: "lounge",
  build(g, cx, cz, h) {
    furnish("lounge", g, cx, cz, this.w, this.d, h);
  }
};

