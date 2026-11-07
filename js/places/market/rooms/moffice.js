import { furnish } from "../../../core/furnishings.js";

export default {
  id: "moffice",
  label: "MARKET OFFICE",
  x: 19, z: 9, w: 7, d: 9,
  floor: 0x3a2a1a,
  type: "office",
  build(g, cx, cz, h) {
    furnish("office", g, cx, cz, this.w, this.d, h);
  }
};

