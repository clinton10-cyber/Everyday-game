import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "snack",
  label: "SNACK COUNTER",
  x: 0, z: 7, w: 7, d: 7,
  floor: 0x3a2a1a,
  type: "cafe",
  build(g, cx, cz, h) {
    furnish("cafe", g, cx, cz, this.w, this.d, h);
  }
};

