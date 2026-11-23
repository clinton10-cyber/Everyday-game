/* js/core/adult-gate.js
   One place that answers "has the player confirmed they are 18+ and opted in?" (Settings → Content & consent).
   Everything mature in the wardrobe / NPC shapes must go through here. No imports, so it can be used anywhere. */

export const ADULT_TOP_STYLES    = ["underwear", "offcloth"];
export const ADULT_BOTTOM_STYLES = ["underwear", "offcloth"];

export function adultOK() {
  try { return !!(window.__ph3d_adultAllowed && window.__ph3d_adultAllowed()); } catch (e) { return false; }
}

/* Returns cfg itself, or a shallow copy with consent-only styles swapped for plain ones when consent is off.
   The saved wardrobe choice is kept, so it comes back if the player turns consent on again. */
export function sanitizeAdult(cfg) {
  if (!cfg || adultOK()) return cfg;
  const t = ADULT_TOP_STYLES.includes(cfg.topStyle), b = ADULT_BOTTOM_STYLES.includes(cfg.bottomStyle);
  if (!t && !b) return cfg;
  const c = Object.assign({}, cfg);
  if (t) c.topStyle = "tshirt";
  if (b) c.bottomStyle = "jeans";
  return c;
}
