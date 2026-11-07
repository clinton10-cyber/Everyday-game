import { furnish } from "../../../core/furnishings.js";

export default {
  id: "bath2",
  label: "ENSUITE",
  x: 8, z: 11, w: 7, d: 5,
  floor: 0x1c2c34,
  type: "bath",
  build(g, cx, cz, h) {
    furnish("bath", g, cx, cz, this.w, this.d, h);
  }
};

