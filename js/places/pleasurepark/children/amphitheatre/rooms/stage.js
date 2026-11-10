import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "stage",
  label: "MAIN STAGE",
  x: 0, z: 0, w: 14, d: 10,
  floor: 0x2a1e28,
  type: "stage",
  build(g, cx, cz, h) {
    furnish("stage", g, cx, cz, this.w, this.d, h);
  }
};

