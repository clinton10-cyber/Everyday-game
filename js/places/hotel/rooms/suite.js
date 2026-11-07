import { furnish } from "../../../core/furnishings.js";

export default {
  id: "suite",
  label: "PRESIDENTIAL SUITE",
  x: 0, z: 6, w: 8, d: 10,
  floor: 0x3a2438,
  type: "bedroom",
  build(g, cx, cz, h) {
    furnish("bedroom", g, cx, cz, this.w, this.d, h);
  }
};

