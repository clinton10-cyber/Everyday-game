import { furnish } from "../../../core/furnishings.js";

export default {
  id: "pbath",
  label: "PRIVATE BATH",
  x: 18, z: 11, w: 6, d: 5,
  floor: 0x1c2c34,
  type: "bath",
  build(g, cx, cz, h) {
    furnish("bath", g, cx, cz, this.w, this.d, h);
  }
};

