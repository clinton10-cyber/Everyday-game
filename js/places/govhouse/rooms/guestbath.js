import { furnish } from "../../../core/furnishings.js";

export default {
  id: "guestbath",
  label: "GUEST BATH",
  x: 14, z: 0, w: 4, d: 6,
  floor: 0x1c2c34,
  type: "bath",
  build(g, cx, cz, h) {
    furnish("bath", g, cx, cz, this.w, this.d, h);
  }
};

