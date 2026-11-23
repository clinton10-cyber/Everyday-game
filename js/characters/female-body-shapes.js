/* js/characters/female-body-shapes.js
   Body-shape variety for ADULT feminine characters (slim, average, curvy, athletic, soft, petite).
   - Only active when the player has given 18+ consent (Settings → Content & consent).
   - The player picks a shape in the wardrobe (Body tab); ambient adult female NPCs get a random one.
   - Never applied to children, teens or students.
   Also provides addAdultBodyDetails() for breasts (blobs + areola + nipples) and genitals. */
import * as THREE from "three";
import { adultOK } from "../core/adult-gate.js";
import { mk, sphere, lam } from "./lp-parts.js";

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

/* ── Adult body details (18+ consent only) ─────────────────────────────
   Adds two breast "blobs", areola, nipples and simple low-poly genitals
   when the character is adult feminine and clothing is off / underwear.
   Never applied to children, teens or when consent is off. */
export function addAdultBodyDetails(ctx) {
  const { B, cfg, M, spine, hips } = ctx || {};
  if (!cfg || cfg.gender !== "feminine" || !adultOK() || isShapeBlocked(cfg)) return;

  const FS = shapeFor(cfg);
  const bust = FS ? FS.bust : 1.0;
  const topBare = cfg.topStyle === "offcloth" || cfg.topStyle === "underwear";
  const botBare = cfg.bottomStyle === "offcloth" || cfg.bottomStyle === "underwear";

  // ── Breasts: two blobs + areola + nipples ──
  if (topBare && spine && M && M.skin) {
    const skin = M.skin;
    const areolaMat = lam(new THREE.Color(skin.color).offsetHSL(0.02, 0.18, -0.20));
    const nippleMat = lam(new THREE.Color(skin.color).offsetHSL(0.04, 0.28, -0.32));

    const baseR = 0.078 * Math.max(0.75, Math.min(1.45, bust));
    const y = 0.285;
    const z = 0.092 * (B ? B.szT : 1);
    const xOff = 0.068 * (B ? B.sxT : 1);

    for (const s of [-1, 1]) {
      // main breast volume (the two blobs)
      const breast = mk(sphere(baseR, 12, 10), skin, spine, xOff * s, y, z);
      breast.scale.set(1.08, 0.90, 0.86);
      breast.castShadow = true;
      breast.userData.adultDetail = true;

      // areola
      const areola = mk(sphere(baseR * 0.36, 8, 6), areolaMat, spine, xOff * s, y - 0.005, z + baseR * 0.58);
      areola.scale.set(1.05, 0.65, 0.32);
      areola.userData.adultDetail = true;

      // nipple
      const nip = mk(sphere(baseR * 0.105, 6, 5), nippleMat, spine, xOff * s, y - 0.007, z + baseR * 0.74);
      nip.scale.set(1, 0.8, 0.65);
      nip.userData.adultDetail = true;
    }
  }

  // ── Genitals (simple low-poly feminine) ──
  if (botBare && hips && M && M.skin) {
    const skin = M.skin;
    const dark = lam(new THREE.Color(skin.color).offsetHSL(0.02, 0.12, -0.24));

    // soft mound
    const mound = mk(sphere(0.055, 10, 8), skin, hips, 0, -0.055, 0.078 * (B ? B.szP : 1));
    mound.scale.set(1.18, 0.52, 0.88);
    mound.userData.adultDetail = true;

    // central cleft
    const cleft = mk(sphere(0.017, 6, 5), dark, hips, 0, -0.070, 0.098 * (B ? B.szP : 1));
    cleft.scale.set(0.32, 1.45, 0.50);
    cleft.userData.adultDetail = true;
  }
}
