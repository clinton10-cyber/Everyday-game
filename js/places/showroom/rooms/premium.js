import { furnish } from "../../../core/furnishings.js";

export default {
  id: "premium",
  label: "PREMIUM WING",
  x: 15, z: 0, w: 15, d: 9,
  floor: 0x22262c,
  type: "showroom",
  build(g, cx, cz, h) {
    furnish("showroom", g, cx, cz, this.w, this.d, h);
  }
};

