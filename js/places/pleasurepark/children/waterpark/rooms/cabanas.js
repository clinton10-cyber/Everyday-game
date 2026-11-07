import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "cabanas",
  label: "CABANAS",
  x: 0, z: 8, w: 7, d: 8,
  floor: 0x3a2a1a,
  type: "lounge",
  build(g, cx, cz, h) {
    furnish("lounge", g, cx, cz, this.w, this.d, h);
  }
};

