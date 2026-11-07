import { furnish } from "../../../core/furnishings.js";

export default {
  id: "reception",
  label: "RECEPTION",
  x: 0, z: 0, w: 8, d: 6,
  floor: 0x4a3820,
  type: "reception",
  build(g, cx, cz, h) {
    furnish("reception", g, cx, cz, this.w, this.d, h);
  }
};

