import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "audience",
  label: "AUDIENCE SEATING",
  x: 0, z: 10, w: 8, d: 8,
  floor: 0x3a2a1a,
  type: "dining",
  build(g, cx, cz, h) {
    furnish("dining", g, cx, cz, this.w, this.d, h);
  }
};

