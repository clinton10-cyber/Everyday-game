import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "control",
  label: "CONTROL ROOM",
  x: 9, z: 0, w: 9, d: 7,
  floor: 0x1e2430,
  type: "control",
  build(g, cx, cz, h) {
    furnish("control", g, cx, cz, this.w, this.d, h);
  }
};

