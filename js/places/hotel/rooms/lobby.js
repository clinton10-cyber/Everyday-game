import { furnish } from "../../../core/furnishings.js";

export default {
  id: "lobby",
  label: "LOBBY",
  x: 0, z: 0, w: 8, d: 6,
  floor: 0x4a3820,
  type: "lobby",
  build(g, cx, cz, h) {
    furnish("lobby", g, cx, cz, this.w, this.d, h);
  }
};

