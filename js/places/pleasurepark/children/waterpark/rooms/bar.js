import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "bar",
  label: "POOLSIDE BAR",
  x: 7, z: 8, w: 8, d: 8,
  floor: 0x3a2a1a,
  type: "cafe",
  build(g, cx, cz, h) {
    furnish("cafe", g, cx, cz, this.w, this.d, h);
  }
};

