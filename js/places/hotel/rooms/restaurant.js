import { furnish } from "../../../core/furnishings.js";

export default {
  id: "restaurant",
  label: "RESTAURANT",
  x: 8, z: 0, w: 6, d: 6,
  floor: 0x3a2a1a,
  type: "restaurant",
  build(g, cx, cz, h) {
    furnish("restaurant", g, cx, cz, this.w, this.d, h);
  }
};

