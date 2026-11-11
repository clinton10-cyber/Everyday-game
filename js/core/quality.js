/**
 * Quality - device capability detection.
 *
 * Public API:
 *   Quality.detect()   - run once at boot, picks the tier
 *   Quality.current    - active settings object
 *   Quality.isLow      - boolean shortcut
 *   Quality.isHigh     - boolean shortcut
 */

/* pixelRatio is the sharpest render scale a tier starts at (capped to the screen's own
   devicePixelRatio); the router's dynamic resolution only lowers it when frames run long and
   never below minPixelRatio. Old values (0.85-1.5) made most phones render under 1:1 and
   upscale, which looked blurry. */
const TIERS = {
  /* potato: lowest setting, picked for 2 GB devices or a score of -3 and below.
     Its tier name stays "low" so every existing `tier === "low"` check keeps working;
     Quality.potato is the flag for the extra cuts. */
  potato: { pixelRatio:1.25, minPixelRatio:0.8, antialias:false, shadows:false, shadowMapSize:256,
            shadowType:"Basic", useLambert:true, lightsPerRoom:1,
            waterAnimated:false, fogNear:25, fogFar:80, frameCap:30,
            skySegments:8, treeCount:20, envMap:false, tier:"low", potato:true },
  low:    { pixelRatio:1.5, minPixelRatio:0.9, antialias:false, shadows:false, shadowMapSize:512,
            shadowType:"Basic", useLambert:true, lightsPerRoom:1,
            waterAnimated:false, fogNear:30, fogFar:90, frameCap:30,
            skySegments:12, treeCount:40, envMap:false },
  medium: { pixelRatio:2, minPixelRatio:1, antialias:false, shadows:false, shadowMapSize:1024,
            shadowType:"PCF", useLambert:true, lightsPerRoom:1,
            waterAnimated:true, fogNear:50, fogFar:150, frameCap:60,
            skySegments:20, treeCount:80, envMap:false },
  high:   { pixelRatio:2, minPixelRatio:1.25, antialias:true, shadows:true, shadowMapSize:2048,
            shadowType:"PCFSoft", useLambert:false, lightsPerRoom:1,
            waterAnimated:true, fogNear:70, fogFar:220, frameCap:60,
            skySegments:32, treeCount:130, envMap:true },
};

const SETTINGS_KEY = "ph3d.settings.v1";

function savedOverride() {
  try {
    const q = (JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") || {}).quality;
    return (q && TIERS[q]) ? q : null;
  } catch (e) { return null; }
}

export const Quality = {
  TIERS,
  tier: "medium",       // "low" | "medium" | "high" (potato reports "low")
  level: "medium",      // "potato" | "low" | "medium" | "high"
  potato: false,
  score: 0,
  signals: {},
  override: undefined,  // undefined = read saved setting, null = auto, string = forced level
  current: Object.assign({ tier: "medium", potato: false }, TIERS.medium),

  /* Switch level in place. `current` is mutated, never replaced, because
     scenes and the renderer hold a reference to it. */
  setLevel(name) {
    const base = TIERS[name] || TIERS.medium;
    const cfg = Object.assign({ tier: name, potato: false }, base);
    cfg.pixelRatio = Math.min(cfg.pixelRatio, window.devicePixelRatio || 1);
    cfg.minPixelRatio = Math.min(cfg.minPixelRatio, cfg.pixelRatio);
    this.level = name;
    this.tier = cfg.tier;
    this.potato = !!cfg.potato;
    Object.assign(this.current, cfg);
    return this;
  },

  /* Pass "auto" (or nothing) for hardware detection, or a level name to force it. */
  detect(force) {
    if (force !== undefined) this.override = (force === "auto" || !TIERS[force]) ? null : force;
    else if (this.override === undefined) this.override = savedOverride();

    const s = this.signals;
    s.dpr = window.devicePixelRatio || 1;
    s.cores = navigator.hardwareConcurrency || 2;
    s.mem = (typeof navigator.deviceMemory === "number") ? navigator.deviceMemory : null;
    s.touch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
    s.mobile = s.touch && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    s.gpu = "unknown";
    try {
      const gl = document.createElement("canvas").getContext("webgl");
      if (gl) {
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        if (ext) s.gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "unknown");
        const lose = gl.getExtension("WEBGL_lose_context");
        if (lose) lose.loseContext();   // free the probe context right away
      }
    } catch (e) {}

    let score = 0;
    if (s.mem !== null) {
      if      (s.mem <= 1) score -= 3;
      else if (s.mem <= 2) score -= 2;
      else if (s.mem <= 3) score -= 1;
      else if (s.mem <= 6) score += 1;
      else                 score += 2;
    }
    if      (s.cores <= 2) score -= 1;
    else if (s.cores >= 8) score += 2;
    else if (s.cores >= 6) score += 1;
    if      (s.dpr >= 3)   score -= 1;
    else if (s.dpr <= 1.5) score += 0.5;

    const g = s.gpu.toLowerCase();
    if (/adreno.*\b[345]\d\d\b|mali-[t4]\d{2}|powervr|mali-400|mali-450|videocore/.test(g)) score -= 2;
    else if (/adreno.*\b[78]\d\d\b|mali-g[78]\d|apple gpu|apple m[0-9]/.test(g)) score += 1;
    else if (/nvidia|geforce|radeon|intel iris|apple m1|apple m2|apple m3/.test(g)) score += 2;

    this.score = score;

    let level;
    if (this.override) level = this.override;
    else if (score <= -3 || (s.mem !== null && s.mem <= 2)) level = "potato";   // 2 GB or weaker
    else if (score <= -1) level = "low";
    else if (score >=  3) level = "high";
    else                  level = "medium";
    this.setLevel(level);

    console.log("%c[ph3d quality]",
      "background:#5ee0ff;color:#04121c;font-weight:bold;padding:2px 6px;border-radius:4px",
      "level=" + this.level, "score=" + score, this.override ? "(forced)" : "(auto)", s);
    return this;
  },

  get isLow()  { return this.tier === "low"; },     // includes potato
  get isHigh() { return this.tier === "high"; },
  get isPotato() { return this.potato; },
};

try { window.__ph3d_quality = Quality; } catch (e) {}
