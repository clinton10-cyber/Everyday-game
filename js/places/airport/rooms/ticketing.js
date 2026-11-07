import { furnish } from "../../../core/furnishings.js";

export default {
  id: "ticketing",
  label: "TICKETING",
  x: 9, z: 0, w: 5, d: 8,
  floor: 0x3a2a1a,
  type: "office",
  build(g, cx, cz, h) {
    furnish("office", g, cx, cz, this.w, this.d, h);
  }
};

