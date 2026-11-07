import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "drinks",
  label: "DRINKS BAR",
  x: 0, z: 7, w: 7, d: 7,
  floor: 0x2a2a2a,
  type: "kitchen",
  build(g, cx, cz, h) {
    furnish("kitchen", g, cx, cz, this.w, this.d, h);
  }
};

