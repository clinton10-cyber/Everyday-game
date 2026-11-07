import { furnish } from "../../../core/furnishings.js";

export default {
  id: "kitchen",
  label: "KITCHEN",
  x: 18, z: 0, w: 4, d: 6,
  floor: 0x2a2a2a,
  type: "kitchen",
  build(g, cx, cz, h) {
    furnish("kitchen", g, cx, cz, this.w, this.d, h);
  }
};

