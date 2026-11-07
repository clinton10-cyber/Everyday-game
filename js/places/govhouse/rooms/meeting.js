import { furnish } from "../../../core/furnishings.js";

export default {
  id: "meeting",
  label: "EXECUTIVE COUNCIL",
  x: 10, z: 6, w: 8, d: 10,
  floor: 0x352619,
  type: "meeting",
  build(g, cx, cz, h) {
    furnish("meeting", g, cx, cz, this.w, this.d, h);
  }
};

