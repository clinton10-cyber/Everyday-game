import { furnish } from "../../../core/furnishings.js";

export default {
  id: "lounge",
  label: "WAITING LOUNGE",
  x: 8, z: 0, w: 6, d: 6,
  floor: 0x3a2a1a,
  type: "lounge",
  build(g, cx, cz, h) {
    furnish("lounge", g, cx, cz, this.w, this.d, h);
  }
};

