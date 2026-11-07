import { furnish } from "../../../core/furnishings.js";

export default {
  id: "bath",
  label: "PUBLIC RESTROOM",
  x: 8, z: 9, w: 6, d: 9,
  floor: 0x1c2c34,
  type: "bath",
  build(g, cx, cz, h) {
    furnish("bath", g, cx, cz, this.w, this.d, h);
  }
};

