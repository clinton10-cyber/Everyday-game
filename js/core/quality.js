/**
 * Quality - device capability detection.
 *
 * Public API:
 *   Quality.detect()   - run once at boot, picks the tier
 *   Quality.current    - active settings object
 *   Quality.isLow      - boolean shortcut
 *   Quality.isHigh     - boolean shortcut
 */

const TIERS = {
  low:    { pixelRatio:1, antialias:false, shadows:false, shadowMapSize:512,
            shadowType:"Basic", useLambert:true, lightsPerRoom:1,
            waterAnimated:false, fogNear:30, fogFar:90, frameCap:30,
            skySegments:12, treeCount:40, envMap:false },
  medium: { pixelRatio:1, antialias:false, shadows:false, shadowMapSize:1024,
            shadowType:"PCF", useLambert:true, lightsPerRoom:1,
            waterAnimated:true, fogNear:50, fogFar:150, frameCap:45,
            skySegments:20, treeCount:80, envMap:false },
  high:   { pixelRatio:1.5, antialias:true, shadows:true, shadowMapSize:2048,
            shadowType:"PCFSoft", useLambert:false, lightsPerRoom:1,
            waterAnimated:true, fogNear:70, fogFar:220, frameCap:60,
            skySegments:32, treeCount:130, envMap:true },
};

export const Quality = {
  tier: "medium",
  score: 0,
  signals: {},
  current: Object.assign({}, TIERS.medium),

  detect() {
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
    /* Lowered thresholds: budget/mid Android phones that previously landed in
       medium now get low, which cuts geometry build cost by ~75% in the interior. */
    if      (score <= -1) this.tier = "low";
    else if (score >=  3) this.tier = "high";
    else                  this.tier = "medium";

    const cfg = Object.assign({}, TIERS[this.tier]);
    cfg.pixelRatio = Math.min(cfg.pixelRatio, window.devicePixelRatio || 1);
    this.current = cfg;

    console.log("%c[ph3d quality]",
      "background:#5ee0ff;color:#04121c;font-weight:bold;padding:2px 6px;border-radius:4px",
      "tier=" + this.tier, "score=" + score, s);
    return this;
  },

  get isLow()  { return this.tier === "low"; },
  get isHigh() { return this.tier === "high"; },
};

