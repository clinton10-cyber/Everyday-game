/* ════════════════════════════════════════════════════════════════
   npc-groups.js — pedestrian archetypes.

   Exports: GROUPS, buildGroup(type)
   ════════════════════════════════════════════════════════════════ */

import {
  SKIN_TONES, HAIR_COLORS, SHIRT_COLORS, BOTTOM_COLORS,
  SHOE_COLORS, ACCENT_COLORS, NPC_HAIR_STYLES as HAIR_STYLES, NPC_TOP_STYLES as TOP_STYLES,
  NPC_BOTTOM_STYLES as BOTTOM_STYLES, NPC_SHOE_STYLES as SHOE_STYLES, NPC_PATTERNS as PATTERNS, GENDERS,
  NPC_HAT_STYLES as HAT_STYLES, NPC_GLASS_STYLES as GLASS_STYLES, TIE_STYLES,
} from "./wardrobe.js";

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rInt = (n) => Math.floor(Math.random() * n);
const chance = (p) => Math.random() < p;

function base() {
  return {
    gender: pick(GENDERS),
    skinTone: rInt(SKIN_TONES.length),
    hairStyle: pick(HAIR_STYLES),
    hairColor: rInt(HAIR_COLORS.length),
    topStyle: pick(TOP_STYLES),
    topColor: rInt(SHIRT_COLORS.length),
    topPattern: "solid",
    topAccent: rInt(ACCENT_COLORS.length),
    tie: "none",
    bottomStyle: pick(BOTTOM_STYLES),
    bottomColor: rInt(BOTTOM_COLORS.length),
    bottomPattern: "solid",
    bottomAccent: rInt(ACCENT_COLORS.length),
    shoeStyle: pick(SHOE_STYLES),
    shoeColor: rInt(SHOE_COLORS.length),
    hat: null,
    glasses: null,
  };
}

function girlConfig() {
  const c = base();
  c.gender = "feminine";
  c.hairStyle = pick(["long", "ponytail", "curly"]);
  c.topStyle = pick(["croptop", "tshirt", "tank"]);
  c.topColor = pick([1, 4, 9, 10, 12]);
  c.topPattern = pick(["solid", "dots", "stripes-h"]);
  c.bottomStyle = "jeans";
  c.bottomColor = pick([0, 1, 6]);
  c.shoeStyle = pick(["sneakers", "sandals"]);
  c.hat = chance(0.10) ? { style: "beanie", color: rInt(SHIRT_COLORS.length) } : null;
  return c;
}

function boyConfig() {
  const c = base();
  c.gender = "masculine";
  c.hairStyle = pick(["short", "buzz", "curly"]);
  c.topStyle = pick(["tshirt", "longsleeve", "polo"]);
  c.topColor = pick([0, 1, 3, 6, 8, 13]);
  c.topPattern = pick(["solid", "gradient"]);
  c.bottomStyle = pick(["jeans", "shorts", "tracksuit"]);
  c.bottomColor = pick([0, 1, 2, 3]);
  c.shoeStyle = pick(["sneakers", "boots"]);
  return c;
}

function suitConfig(variant) {
  const c = base();
  c.gender = "masculine";
  c.hairStyle = pick(["short", "buzz"]);
  c.skinTone = pick([2, 3, 4, 5]);
  c.topStyle = "suit";
  c.topColor = pick([6, 1, 0]);
  c.topPattern = "solid";
  c.tie = pick(["classic", "skinny", "bow"]);
  c.bottomStyle = "jeans";
  c.bottomColor = 1;
  c.shoeStyle = "formal";
  c.shoeColor = 0;
  c.glasses = Math.random() < 0.5 ? { style: "square", color: 0 } : null;
  return c;
}

function yahooConfig() {
  const c = base();
  c.gender = "masculine";
  c.hairStyle = pick(["short", "curly", "buzz"]);
  c.skinTone = pick([2, 3, 4]);
  c.topStyle = pick(["hoodie", "polo", "longsleeve"]);
  c.topColor = pick([0, 3, 8, 13]);
  c.topPattern = "solid";
  c.bottomStyle = "tracksuit";
  c.bottomColor = 1;
  c.shoeStyle = "sneakers";
  c.shoeColor = pick([1, 2, 4]);
  c.glasses = Math.random() < 0.7 ? { style: "shades", color: 0 } : null;
  c.hat = Math.random() < 0.4 ? { style: "cap", color: 0 } : null;
  return c;
}

function mamaConfig() {
  const c = base();
  c.gender = "feminine";
  c.hairStyle = pick(["long", "ponytail"]);
  c.skinTone = pick([4, 5, 6, 7]);
  c.topStyle = pick(["tshirt", "longsleeve"]);
  c.topColor = pick([3, 9, 10, 12]);
  c.topPattern = pick(["stripes-h", "checkers"]);
  c.bottomStyle = "jeans";
  c.bottomColor = pick([4, 3]);
  c.shoeStyle = "sandals";
  return c;
}

function kidConfig() {
  const c = base();
  c.gender = pick(["feminine", "masculine"]);
  c.hairStyle = pick(["short", "ponytail", "curly"]);
  c.skinTone = pick([1, 2, 3, 4]);
  c.topStyle = pick(["tshirt", "polo"]);
  c.topColor = pick([1, 3, 8, 10]);
  c.topPattern = "solid";
  c.bottomStyle = "shorts";
  c.bottomColor = pick([0, 1, 2]);
  c.shoeStyle = "sneakers";
  c.shoeColor = pick([0, 1]);
  return c;
}

export const GROUPS = {
  solo: {
    label: "Pedestrian",
    build: () => [{
      config: base(),
      offset: [0, 0],
      yawOffset: 0,
    }],
  },

  couple: {
    label: "Couple",
    build: () => [
      { config: girlConfig(), offset: [-0.85, 0.0], yawOffset: 0.0 },
      { config: boyConfig(),  offset: [ 0.85, 0.0], yawOffset: 0.0 },
    ],
  },

  suit_men: {
    label: "Businessmen",
    build: (n) => {
      const count = Math.min(3, Math.max(2, n || 2));
      const arr = [];
      for (let i = 0; i < count; i++) {
        const side = i === 0 ? -1 : i === 1 ? 1 : 0;
        arr.push({
          config: suitConfig(i),
          offset: [side * 0.95, i === 2 ? -0.9 : 0],
          yawOffset: 0,
        });
      }
      return arr;
    },
  },

  yahoo_boys: {
    label: "Yahoo Boys",
    build: (n) => {
      const count = Math.min(3, Math.max(2, n || 2));
      const offsets = [
        [-0.85, 0.15],
        [ 0.85, 0.15],
        [ 0.00, -0.90],
      ];
      const arr = [];
      for (let i = 0; i < count; i++) {
        arr.push({
          config: yahooConfig(),
          offset: offsets[i],
          yawOffset: (Math.random() - 0.5) * 0.15,
        });
      }
      return arr;
    },
  },

  mamas: {
    label: "Market Mamas",
    build: () => [
      { config: mamaConfig(), offset: [-0.90, 0.05], yawOffset: 0.0 },
      { config: mamaConfig(), offset: [ 0.90, 0.05], yawOffset: 0.0 },
    ],
  },

  school_kids: {
    label: "School Kids",
    build: (n) => {
      const count = Math.min(3, Math.max(2, n || 3));
      const arr = [];
      for (let i = 0; i < count; i++) {
        const side = i - (count - 1) / 2;
        arr.push({
          config: kidConfig(),
          offset: [side * 0.75, (i % 2) * 0.3],
          yawOffset: (Math.random() - 0.5) * 0.20,
        });
      }
      return arr;
    },
  },

  student: {
    label: "Student",
    build: () => [
      { config: kidConfig(), offset: [0, 0], yawOffset: 0 },
    ],
  },

  clerk: {
    label: "Clerk",
    build: () => [
      { config: suitConfig(0), offset: [0, 0], yawOffset: 0 },
    ],
  },
};

export function buildGroup(type) {
  const def = GROUPS[type] || GROUPS.solo;
  const members = def.build();
  return { label: def.label, members };
}
