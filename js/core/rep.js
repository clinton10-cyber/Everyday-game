/* ════════════════════════════════════════════════════════════════
   rep.js — one place to change the player's reputation.

   Profile only exposes a getter, so every system that wants to
   award or take rep goes through here.  Clamped to 0..200.
   ════════════════════════════════════════════════════════════════ */

import { Auth } from "./auth.js";

export const Rep = {
  get() {
    const r = Auth.user && Auth.user.reputation;
    return typeof r === "number" ? r : 100;
  },

  add(delta) {
    const next = Math.max(0, Math.min(200, this.get() + delta));
    /* Update locally so the next read is right even if the save is
       slow or the player is a guest with no token. */
    if (Auth.user) Auth.user.reputation = next;
    try {
      const p = Auth.save({ reputation: next });
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
    return next;
  },
};

