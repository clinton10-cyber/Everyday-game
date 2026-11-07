/* ============================================================
   Identity - who am I, and am I the Governor?
   Provides the suit config used when rendering the character.
   ============================================================ */
export const Identity = {
  isAdmin() {
    try {
      const u = window.__ph3d_auth && window.__ph3d_auth.user;
      if (!u) return false;
      const name = (u.username || "").toLowerCase();
      return name === "clintont" || u.role === "governor";
    } catch (e) { return false; }
  },

  /* Returns the wardobe config to use when building
     the character in the house interior scene. */
  characterConfig(base) {
    const cfg = Object.assign({}, base || {});
    if (this.isAdmin()) {
      /* Suit — navy blazer, dark trousers, white shirt collar
         (accent), formal black shoes. */
      cfg.gender        = "masculine";
      cfg.topStyle      = "jacket";
      cfg.topColor      = 6;      /* dark slate navy */
      cfg.topPattern    = "solid";
      cfg.topAccent     = 0;      /* white hint */
      cfg.bottomStyle   = "jeans";
      cfg.bottomColor   = 1;      /* dark navy */
      cfg.bottomPattern = "solid";
      cfg.shoeStyle     = "formal";
      cfg.shoeColor     = 0;      /* near black */
      cfg.hat           = null;
      cfg.glasses       = null;
    }
    return cfg;
  },
};

