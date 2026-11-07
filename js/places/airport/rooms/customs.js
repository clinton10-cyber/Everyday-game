import { furnish } from "../../../core/furnishings.js";

export default {
  id: "customs",
  label: "CUSTOMS",
  x: 20, z: 0, w: 6, d: 8,
  floor: 0x3a2a1a,
  type: "office",
  build(g, cx, cz, h) {
    furnish("office", g, cx, cz, this.w, this.d, h);
  }
};

