import { furnish } from "../../../core/furnishings.js";

export default {
  id: "cafe",
  label: "PARK CAFE",
  x: 0, z: 9, w: 8, d: 9,
  floor: 0x3a2a1a,
  type: "cafe",
  build(g, cx, cz, h) {
    furnish("cafe", g, cx, cz, this.w, this.d, h);
  }
};

