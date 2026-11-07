import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "platform",
  label: "RIDE PLATFORM",
  x: 0, z: 0, w: 10, d: 8,
  floor: 0x35302a,
  type: "plaza",
  build(g, cx, cz, h) {
    furnish("plaza", g, cx, cz, this.w, this.d, h);
  }
};

