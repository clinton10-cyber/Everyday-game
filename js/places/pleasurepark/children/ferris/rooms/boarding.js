import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "boarding",
  label: "BOARDING DECK",
  x: 0, z: 0, w: 9, d: 7,
  floor: 0x35302a,
  type: "boarding",
  build(g, cx, cz, h) {
    furnish("boarding", g, cx, cz, this.w, this.d, h);
  }
};

