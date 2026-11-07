import { furnish } from "../../../core/furnishings.js";

export default {
  id: "stage",
  label: "OPEN-AIR STAGE",
  x: 14, z: 9, w: 6, d: 9,
  floor: 0x2a1e28,
  type: "stage",
  build(g, cx, cz, h) {
    furnish("stage", g, cx, cz, this.w, this.d, h);
  }
};

