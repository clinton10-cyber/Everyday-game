import { furnish } from "../../../../../core/furnishings.js";

export default {
  id: "vet",
  label: "VET CLINIC",
  x: 8, z: 8, w: 8, d: 8,
  floor: 0x3a2a1a,
  type: "office",
  build(g, cx, cz, h) {
    furnish("office", g, cx, cz, this.w, this.d, h);
  }
};

