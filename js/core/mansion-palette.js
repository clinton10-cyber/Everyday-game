/* ============================================================
   MansionPalette - admin can pick from 5 themes for the mansion.
   Applied at build time by modifying wall + furniture colours.
   ============================================================ */
const KEY = "ph3d.mansion.theme";

export const MansionPalette = {
  current: "warm",

  themes: {
    warm: {
      label: "Warm",
      wallTint: 0xfff2dc,
      floorBoost: 1.00,
      sofa: 0xd94f8a, sofaCush: 0xee7aa8,
      rug: 0xc0303a, rugIn: 0xffd98a,
      accent: 0xffcc5e,
    },
    cool: {
      label: "Cool",
      wallTint: 0xeaf2ff,
      floorBoost: 0.92,
      sofa: 0x3a7ac0, sofaCush: 0x5a9ae0,
      rug: 0x2a4a6a, rugIn: 0xa8e0f8,
      accent: 0x5ee0ff,
    },
    classic: {
      label: "Classic",
      wallTint: 0xfaf3e0,
      floorBoost: 0.95,
      sofa: 0x8a5a2a, sofaCush: 0xb88a58,
      rug: 0x6a3a1a, rugIn: 0xffd9a0,
      accent: 0xc9a34a,
    },
    dark: {
      label: "Dark",
      wallTint: 0x404850,
      floorBoost: 0.55,
      sofa: 0x1a1a1e, sofaCush: 0x2a2a30,
      rug: 0x0a0a0a, rugIn: 0x5a5a60,
      accent: 0x8a8a90,
    },
    garden: {
      label: "Garden",
      wallTint: 0xf0ffe4,
      floorBoost: 1.05,
      sofa: 0x4ac860, sofaCush: 0x7ad888,
      rug: 0x2a6a3a, rugIn: 0xd8f0a0,
      accent: 0x7dff9b,
    },
  },

  load() {
    try {
      const t = localStorage.getItem(KEY);
      if (t && this.themes[t]) this.current = t;
    } catch (e) {}
    return this.current;
  },

  set(name) {
    if (!this.themes[name]) return false;
    this.current = name;
    try { localStorage.setItem(KEY, name); } catch (e) {}
    return true;
  },

  get() {
    return this.themes[this.current] || this.themes.warm;
  },

  cycle() {
    const keys = Object.keys(this.themes);
    const i = keys.indexOf(this.current);
    this.set(keys[(i + 1) % keys.length]);
    return this.current;
  },
};

