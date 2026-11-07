import { furnish } from "../../../core/furnishings.js";

export default {
  id: "garden",
  label: "MEMORIAL GARDEN",
  x: 0, z: 0, w: 10, d: 9,
  floor: 0x1c3a1e,
  type: "garden",
  build(g, cx, cz, h) {
    furnish("garden", g, cx, cz, this.w, this.d, h);
  }
};

