import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "sound",
  label: "SOUND BOOTH",
  x: 8, z: 10, w: 8, d: 8,
  floor: 0x3a2a1a,
  type: "office",
  build(g, cx, cz, h) {
    furnish("office", g, cx, cz, this.w, this.d, h);
  }
};

