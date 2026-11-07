import { furnish } from "../../../core/furnishings.js";

export default {
  id: "departure",
  label: "DEPARTURE LOUNGE",
  x: 14, z: 0, w: 6, d: 8,
  floor: 0x3a2a1a,
  type: "lounge",
  build(g, cx, cz, h) {
    furnish("lounge", g, cx, cz, this.w, this.d, h);
  }
};

