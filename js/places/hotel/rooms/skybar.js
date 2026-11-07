import { furnish } from "../../../core/furnishings.js";

export default {
  id: "skybar",
  label: "SKY BAR",
  x: 15, z: 11, w: 7, d: 5,
  floor: 0x3a2a1a,
  type: "lounge",
  build(g, cx, cz, h) {
    furnish("lounge", g, cx, cz, this.w, this.d, h);
  }
};

