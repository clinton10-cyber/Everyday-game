import { furnish } from "../../../core/furnishings.js";

export default {
  id: "food",
  label: "FOOD COURT",
  x: 0, z: 8, w: 9, d: 8,
  floor: 0x3a2a1a,
  type: "dining",
  build(g, cx, cz, h) {
    furnish("dining", g, cx, cz, this.w, this.d, h);
  }
};

