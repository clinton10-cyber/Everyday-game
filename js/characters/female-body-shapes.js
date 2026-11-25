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
   Feminine: two breast blobs + areola + nipples + genitals
   Masculine: simple low-poly genitals
   Only when clothing is off / underwear and the character is adult.
   Never applied to children, teens or when consent is off. */
export function addAdultBodyDetails(ctx) {
  const { B, cfg, M, spine, hips } = ctx || {};
  if (!cfg || !adultOK() || isShapeBlocked(cfg)) return;

  /* Breast volume under bra/underwear/offcloth; full areola+nipples only when fully bare */
  const topVol  = ["offcloth", "underwear", "bra"].includes(cfg.topStyle);
  const topNude = cfg.topStyle === "offcloth";
  const botBare = ["offcloth", "underwear", "panties"].includes(cfg.bottomStyle);
  const female = cfg.gender === "feminine";
  const male   = cfg.gender === "masculine";

  // ── Feminine breasts: two clearly separated blobs (+ areola/nipples when bare) ──
  if (female && topVol && spine && M && M.skin) {
    const FS = shapeFor(cfg);
    const bust = FS ? FS.bust : 1.0;
    const skin = M.skin;
    const areolaMat = lam(new THREE.Color(skin.color).offsetHSL(0.02, 0.18, -0.20));
    const nippleMat = lam(new THREE.Color(skin.color).offsetHSL(0.04, 0.28, -0.32));

    /* Smaller radius + wider X offset so the two breasts stay distinct (no single mound) */
    const k = Math.max(0.75, Math.min(1.45, bust));
    const baseR = 0.062 * k;
    const y = 0.278;
    const z = 0.108 * (B ? B.szT : 1);          /* sit further forward of the torso shell */
    const xOff = 0.095 * (B ? Math.max(B.sxT, 0.95) : 1);  /* clear cleavage gap */

    for (const s of [-1, 1]) {
      // main breast volume — teardrop-ish, angled slightly outward and down
      const breast = mk(sphere(baseR, 14, 12), skin, spine, xOff * s, y, z);
      breast.scale.set(1.15, 0.95, 1.05);        /* wider, a bit deeper front */
      breast.rotation.set(0.18, s * 0.22, s * 0.08);
      breast.castShadow = true;
      breast.userData.adultDetail = true;

      if (topNude) {
        // areola + nipple on the front face of each breast
        const az = z + baseR * 0.72;
        const areola = mk(sphere(baseR * 0.32, 8, 6), areolaMat, spine, xOff * s, y - 0.008, az);
        areola.scale.set(1.1, 0.7, 0.28);
        areola.userData.adultDetail = true;

        const nip = mk(sphere(baseR * 0.10, 6, 5), nippleMat, spine, xOff * s, y - 0.010, az + baseR * 0.18);
        nip.scale.set(1, 0.85, 0.7);
        nip.userData.adultDetail = true;
      }
    }
  }

  // ── Genitals ──
  if (botBare && hips && M && M.skin) {
    const skin = M.skin;
    const dark = lam(new THREE.Color(skin.color).offsetHSL(0.02, 0.12, -0.24));

    if (female) {
      // soft mound + cleft
      const mound = mk(sphere(0.055, 10, 8), skin, hips, 0, -0.055, 0.078 * (B ? B.szP : 1));
      mound.scale.set(1.18, 0.52, 0.88);
      mound.userData.adultDetail = true;

      const cleft = mk(sphere(0.017, 6, 5), dark, hips, 0, -0.070, 0.098 * (B ? B.szP : 1));
      cleft.scale.set(0.32, 1.45, 0.50);
      cleft.userData.adultDetail = true;
    } else if (male) {
      // simple low-poly male genitals (shaft + glans + scrotum)
      const shaft = mk(sphere(0.028, 8, 6), skin, hips, 0, -0.095, 0.055 * (B ? B.szP : 1));
      shaft.scale.set(0.75, 1.55, 0.85);
      shaft.userData.adultDetail = true;

      const glans = mk(sphere(0.022, 7, 5), dark, hips, 0, -0.125, 0.068 * (B ? B.szP : 1));
      glans.scale.set(0.95, 0.75, 0.9);
      glans.userData.adultDetail = true;

      // scrotum (two lobes)
      for (const s of [-1, 1]) {
        const lobe = mk(sphere(0.026, 7, 5), skin, hips, 0.022 * s, -0.088, 0.035 * (B ? B.szP : 1));
        lobe.scale.set(0.9, 1.05, 0.95);
        lobe.userData.adultDetail = true;
      }
    }
  }
}
