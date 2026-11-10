import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "tickets",
  label: "TICKET & SNACKS",
  x: 0, z: 8, w: 18, d: 6,
  floor: 0x3a2a1a,
  type: "cafe",
  build(g, cx, cz, h) {
    furnish("cafe", g, cx, cz, this.w, this.d, h);
  }
};

