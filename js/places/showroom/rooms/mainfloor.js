import { furnish } from "../../../core/furnishings.js";

export default {
  id: "mainfloor",
  label: "MAIN FLOOR",
  x: 0, z: 0, w: 15, d: 18,
  floor: 0x22262c,
  type: "showroom",
  build(g, cx, cz, h) {
    furnish("showroom", g, cx, cz, this.w, this.d, h);
  }
};

