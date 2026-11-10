import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "abath",
  label: "RESTROOMS",
  x: 16, z: 10, w: 8, d: 8,
  floor: 0x1c2c34,
  type: "bath",
  build(g, cx, cz, h) {
    furnish("bath", g, cx, cz, this.w, this.d, h);
  }
};

