import { furnish } from "../../../core/furnishings.js";

export default {
  id: "plaza",
  label: "CENTRAL PLAZA",
  x: 10, z: 0, w: 8, d: 9,
  floor: 0x35302a,
  type: "plaza",
  build(g, cx, cz, h) {
    furnish("plaza", g, cx, cz, this.w, this.d, h);
  }
};

