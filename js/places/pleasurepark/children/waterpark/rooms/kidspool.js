import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "kidspool",
  label: "KIDS POOL",
  x: 11, z: 0, w: 11, d: 8,
  floor: 0x0f3a4e,
  type: "pool",
  build(g, cx, cz, h) {
    furnish("pool", g, cx, cz, this.w, this.d, h);
  }
};

