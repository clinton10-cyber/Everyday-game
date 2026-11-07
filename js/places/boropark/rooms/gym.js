import { furnish } from "../../../core/furnishings.js";

export default {
  id: "gym",
  label: "OUTDOOR GYM",
  x: 20, z: 9, w: 6, d: 9,
  floor: 0x22262c,
  type: "gym",
  build(g, cx, cz, h) {
    furnish("gym", g, cx, cz, this.w, this.d, h);
  }
};

