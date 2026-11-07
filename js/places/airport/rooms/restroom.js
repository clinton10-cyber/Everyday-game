import { furnish } from "../../../core/furnishings.js";

export default {
  id: "restroom",
  label: "RESTROOMS",
  x: 9, z: 8, w: 5, d: 8,
  floor: 0x1c2c34,
  type: "bath",
  build(g, cx, cz, h) {
    furnish("bath", g, cx, cz, this.w, this.d, h);
  }
};

