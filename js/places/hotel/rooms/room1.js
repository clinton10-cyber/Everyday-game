import { furnish } from "../../../core/furnishings.js";

export default {
  id: "room1",
  label: "DELUXE ROOM",
  x: 8, z: 6, w: 7, d: 5,
  floor: 0x3a2438,
  type: "bedroom",
  build(g, cx, cz, h) {
    furnish("bedroom", g, cx, cz, this.w, this.d, h);
  }
};

