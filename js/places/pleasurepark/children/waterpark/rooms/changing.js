import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "changing",
  label: "CHANGING ROOMS",
  x: 15, z: 8, w: 7, d: 8,
  floor: 0x1c2c34,
  type: "changing",
  build(g, cx, cz, h) {
    furnish("changing", g, cx, cz, this.w, this.d, h);
  }
};

