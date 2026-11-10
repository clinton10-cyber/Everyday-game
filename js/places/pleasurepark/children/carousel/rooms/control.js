import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "control",
  label: "CONTROL",
  x: 10, z: 0, w: 8, d: 8,
  floor: 0x1e2430,
  type: "control",
  build(g, cx, cz, h) {
    furnish("control", g, cx, cz, this.w, this.d, h);
  }
};

