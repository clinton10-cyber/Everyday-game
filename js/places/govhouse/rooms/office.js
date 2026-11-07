import { furnish } from "../../../core/furnishings.js";

export default {
  id: "office",
  label: "GOVERNOR'S OFFICE",
  x: 0, z: 6, w: 10, d: 10,
  floor: 0x3a2a1a,
  type: "office",
  build(g, cx, cz, h) {
    furnish("office", g, cx, cz, this.w, this.d, h);
  }
};

