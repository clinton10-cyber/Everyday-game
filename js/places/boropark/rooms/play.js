import { furnish } from "../../../core/furnishings.js";

export default {
  id: "play",
  label: "KIDS PLAYGROUND",
  x: 18, z: 0, w: 8, d: 9,
  floor: 0x2a2a1c,
  type: "playground",
  build(g, cx, cz, h) {
    furnish("playground", g, cx, cz, this.w, this.d, h);
  }
};

