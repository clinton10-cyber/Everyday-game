/* js/characters/female-body-shapes.js
   Random body-shape variety for ADULT feminine NPCs (slim, average, curvy, athletic, soft, petite).
   Shapes only change silhouette proportions. They are never applied to children, teens or students:
   applyFemaleShape() refuses any config flagged as young, and npcs.js skips the kid / student groups and roles. */

export const FEMALE_SHAPES = {
  slim:     { label: "Slim",         bust: 0.88, waist: 0.82, hip: 0.92, thigh: 0.90, buildBias: -0.35 },
  average:  { label: "Average",      bust: 1.00, waist: 0.90, hip: 1.05, thigh: 1.00, buildBias:  0.00 },
  curvy:    { label: "Curvy",        bust: 1.18, waist: 0.85, hip: 1.28, thigh: 1.15, buildBias:  0.25 },
  athletic: { label: "Athletic",     bust: 1.05, waist: 0.88, hip: 1.08, thigh: 1.12, buildBias:  0.15 },
  soft:     { label: "Soft / Full",  bust: 1.22, waist: 1.05, hip: 1.32, thigh: 1.22, buildBias:  0.45 },
  petite:   { label: "Petite",       bust: 0.92, waist: 0.86, hip: 0.98, thigh: 0.92, buildBias: -0.25 },
};

export const FEMALE_SHAPE_KEYS = Object.keys(FEMALE_SHAPES);

/* groups and roles that are never shaped (young characters) */
export const SHAPE_BLOCKED = new Set(["school_kids", "student", "kid", "kids", "child", "teen"]);

export function isShapeBlocked(cfg, tag) {
  if (tag && SHAPE_BLOCKED.has(tag)) return true;
  if (!cfg) return true;
  if (cfg.child || cfg.minor || cfg.isKid || cfg.isChild || cfg.isTeen) return true;
  if (typeof cfg.age === "number" && cfg.age < 18) return true;
  if (cfg.ageGroup && cfg.ageGroup !== "adult" && cfg.ageGroup !== "elder") return true;
  if (typeof cfg.height === "number" && cfg.height < 0.95) return true;
  return false;
}

export function randomFemaleShape(weights = null) {
  let total = 0;
  for (const k of FEMALE_SHAPE_KEYS) total += (weights && weights[k]) || 1;
  let r = Math.random() * total;
  for (const k of FEMALE_SHAPE_KEYS) { r -= (weights && weights[k]) || 1; if (r <= 0) return k; }
  return "average";
}

/* Call BEFORE building the character. Returns cfg unchanged for non-feminine or young configs. */
export function applyFemaleShape(cfg, shapeKey = null, tag = null) {
  if (!cfg || cfg.gender !== "feminine" || cfg._femaleShape || isShapeBlocked(cfg, tag)) return cfg;
  const key = shapeKey || cfg.bodyShape || randomFemaleShape();
  const s = FEMALE_SHAPES[key] || FEMALE_SHAPES.average;
  cfg.bodyShape = key;
  cfg.build = Math.max(-1, Math.min(1, (+cfg.build || 0) + s.buildBias));
  cfg._femaleShape = { bust: s.bust, waist: s.waist, hip: s.hip, thigh: s.thigh };
  return cfg;
}
