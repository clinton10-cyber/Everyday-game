import { furnish } from "../../../core/furnishings.js";

export default {
  id: "sales",
  label: "SALES OFFICE",
  x: 15, z: 9, w: 8, d: 9,
  floor: 0x3a2a1a,
  type: "office",
  build(g, cx, cz, h) {
    furnish("office", g, cx, cz, this.w, this.d, h);
  }
};

