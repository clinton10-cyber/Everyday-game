/* js/characters/female-body-shapes.js
   Body-shape variety for ADULT feminine characters (slim, average, curvy, athletic, soft, petite).
   - Only active when the player has given 18+ consent (Settings → Content & consent).
   - The player picks a shape in the wardrobe (Body tab); ambient adult female NPCs get a random one.
   - Never applied to children, teens or students. */
import { adultOK } from "../core/adult-gate.js";

export const FEMALE_SHAPES = {
  slim:     { label: "Slim",        bust: 0.88, waist: 0.82, hip: 0.92, thigh: 0.90, buildBias: -0.35 },
  average:  { label: "Average",     bust: 1.00, waist: 0.90, hip: 1.05, thigh: 1.00, buildBias:  0.00 },
  curvy:    { label: "Curvy",       bust: 1.18, waist: 0.85, hip: 1.28, thigh: 1.15, buildBias:  0.25 },
  athletic: { label: "Athletic",    bust: 1.05, waist: 0.88, hip: 1.08, thigh: 1.12, buildBias:  0.15 },
  soft:     { label: "Soft / Full", bust: 1.22, waist: 1.05, hip: 1.32, thigh: 1.22, buildBias:  0.45 },
  petite:   { label: "Petite",      bust: 0.92, waist: 0.86, hip: 0.98, thigh: 0.92, buildBias: -0.25 },
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

/* The shape that applies to this config right now, or null (no consent, not feminine, young, or "default"). */
export function shapeFor(cfg) {
  if (!cfg || cfg.gender !== "feminine" || !adultOK() || isShapeBlocked(cfg)) return null;
  return FEMALE_SHAPES[cfg.bodyShape] || null;
}

/* Ambient NPCs: pick a random shape for adult feminine NPCs, only when consent is on. */
export function applyFemaleShape(cfg, shapeKey = null, tag = null) {
  if (!cfg || cfg.gender !== "feminine" || !adultOK() || isShapeBlocked(cfg, tag)) return cfg;
  if (!cfg.bodyShape || cfg.bodyShape === "default") cfg.bodyShape = shapeKey || randomFemaleShape();
  return cfg;
}
