import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "seating",
  label: "SEATING HALL",
  x: 7, z: 0, w: 8, d: 7,
  floor: 0x3a2a1a,
  type: "dining",
  build(g, cx, cz, h) {
    furnish("dining", g, cx, cz, this.w, this.d, h);
  }
};

