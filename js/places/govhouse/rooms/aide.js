import { furnish } from "../../../core/furnishings.js";

export default {
  id: "aide",
  label: "AIDE-DE-CAMP",
  x: 18, z: 6, w: 6, d: 5,
  floor: 0x3a2a1a,
  type: "office",
  build(g, cx, cz, h) {
    furnish("office", g, cx, cz, this.w, this.d, h);
  }
};

