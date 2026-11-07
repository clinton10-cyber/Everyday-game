import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "herbiv",
  label: "HERBIVORES",
  x: 0, z: 8, w: 8, d: 8,
  floor: 0x1c3a1e,
  type: "garden",
  build(g, cx, cz, h) {
    furnish("garden", g, cx, cz, this.w, this.d, h);
  }
};

