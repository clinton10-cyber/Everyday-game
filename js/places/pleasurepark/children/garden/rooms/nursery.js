import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "nursery",
  label: "NURSERY",
  x: 16, z: 8, w: 8, d: 8,
  floor: 0x2a3a20,
  type: "nursery",
  build(g, cx, cz, h) {
    furnish("nursery", g, cx, cz, this.w, this.d, h);
  }
};

