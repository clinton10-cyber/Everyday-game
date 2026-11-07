import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "vr",
  label: "VR ZONE",
  x: 10, z: 0, w: 10, d: 7,
  floor: 0x1c1a34,
  type: "arcade",
  build(g, cx, cz, h) {
    furnish("arcade", g, cx, cz, this.w, this.d, h);
  }
};

