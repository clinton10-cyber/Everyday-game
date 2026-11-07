import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "abath",
  label: "RESTROOM",
  x: 7, z: 7, w: 6, d: 7,
  floor: 0x1c2c34,
  type: "bath",
  build(g, cx, cz, h) {
    furnish("bath", g, cx, cz, this.w, this.d, h);
  }
};

