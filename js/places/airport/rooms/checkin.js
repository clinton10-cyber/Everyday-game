import { furnish } from "../../../core/furnishings.js";

export default {
  id: "checkin",
  label: "CHECK-IN HALL",
  x: 0, z: 0, w: 9, d: 8,
  floor: 0x4a3820,
  type: "reception",
  build(g, cx, cz, h) {
    furnish("reception", g, cx, cz, this.w, this.d, h);
  }
};

