import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "fbath",
  label: "RESTROOM",
  x: 15, z: 7, w: 7, d: 7,
  floor: 0x1c2c34,
  type: "bath",
  build(g, cx, cz, h) {
    furnish("bath", g, cx, cz, this.w, this.d, h);
  }
};

