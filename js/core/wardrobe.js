import * as THREE from "three";

/* ═══════════════════════════════════════════════════════════════
   wardrobe.js — the data layer for every look in the game.

   • Palettes (colour lists). NEW colours are only ever APPENDED so that
     saved looks / NPC configs that store an index keep working.
   • Any colour slot can also hold a custom "#rrggbb" string (the Tailor's
     colour wheel) — always read colours through resolveColor().
   • Style lists. The NPC_* lists are the safe subsets random pedestrians
     draw from; the full lists are what the Tailor shows the player.
   • COSTUME_INFO describes each costume (default colours + the outfit it
     puts on the body).
   • WARDROBE_TABS is a declarative description of the Tailor / wardrobe
     UI so both screens render the same options.
   ═══════════════════════════════════════════════════════════════ */

/* ── Palettes ────────────────────────────────────────────── */
export const SKIN_TONES = [
  "#f5d5b8","#ecc0a0","#dca882","#c98d62","#a86a3a",
  "#7a4a26","#4e2e16","#2a1708"
];
export const HAIR_COLORS = [
  "#15100a","#2a1c14","#4a3022","#6a4a2a","#8a6a3a",
  "#c0a070","#d8d8d8","#e8c8a8","#5a2a5a","#2a4a6a","#8a2020",
  /* appended: ginger, platinum, fantasy */
  "#b5651d","#efe2b8","#ff5fa2","#3fa7ff","#41d6a0","#ffffff","#ff7a1a","#7c3aed"
];
export const SHIRT_COLORS = [
  "#3a7bd5","#e84a5f","#4ade80","#fbbf24","#a78bfa",
  "#f0f0f0","#1e293b","#0ea5e9","#dc2626","#16a34a",
  "#f59e0b","#7c3aed","#ec4899","#14b8a6",
  /* appended */
  "#000000","#7f1d1d","#064e3b","#1e3a8a","#92400e","#fde68a",
  "#f9a8d4","#94a3b8","#44403c","#a3e635","#c2410c","#0f766e",
  "#86198f","#d6d3d1","#fb7185","#38bdf8"
];
export const BOTTOM_COLORS = [
  "#2b3446","#1e293b","#3d3d3d","#6b5b4a",
  "#7a3a3a","#3a5a7a","#4a4a4a","#d4d4d4",
  "#f59e0b",   /* 8: jail orange */
  /* appended */
  "#111827","#f5f5f4","#0b3d2e","#7c5a3a","#c2a878","#355c9a",
  "#8b1d2c","#5b21b6","#e11d48","#fbbf24","#64748b","#2f4f2f"
];
export const SHOE_COLORS = [
  "#161a21","#f0f0f0","#e84a5f","#3a7bd5",
  "#4ade80","#fbbf24","#8a5a3a","#1e293b",
  /* appended */
  "#000000","#6b7280","#7c2d12","#fde68a","#a855f7","#f97316","#ec4899","#16a34a"
];
export const ACCENT_COLORS = [
  "#ffffff","#000000","#ffcc5e","#ff5c5c",
  "#5ee0ff","#7dff9b","#a78bfa","#ff9d5c",
  /* appended */
  "#c0c0c0","#d4af37","#1e3a8a","#7f1d1d"
];
/* jewellery, bags, frames, scarves … */
export const GEAR_COLORS = [
  "#111111","#f5f5f5","#c0c0c0","#d4af37","#e8a87c",
  "#6b4423","#c8a27a","#d62839","#2563eb","#16a34a",
  "#ec4899","#7c3aed","#f97316","#facc15","#1e3a8a",
  "#6b7280","#0f766e","#7f1d1d","#f3e9d2","#a3e635"
];
export const LENS_COLORS = [
  "#9fd0ff","#23262c","#e0a030","#e86aa8","#4aa8ff","#5ccf7a","#c9d2dc"
];
export const EYE_COLORS = [
  "#141a22","#4a2c17","#7a5a2a","#2e7d4f","#2f6fb5","#7a8a99","#8e44ad","#d4a017"
];
export const LIP_COLORS = [
  "#9b4f4a","#7a3a36","#c45a6a","#b2182b","#5a2a3a","#3a2220","#e8a0a0","#6a1b9a","#111111"
];

/* ── Style lists ─────────────────────────────────────────── */
export const HAIR_STYLES = [
  "short","buzz","curly","long","ponytail","bald",
  "afro","braids","locs","bun","mohawk","hightop","bob","pigtails","knots","pompadour"
];
export const TOP_STYLES = [
  "tshirt","longsleeve","hoodie","tank","jacket","singlet","suit","polo","croptop",
  "vneck","sweater","turtleneck","bomber","jersey","dashiki","kaftan","agbada","dress","tube"
];
export const BOTTOM_STYLES = [
  "jeans","shorts","tracksuit","baggy",
  "cargo","bermuda","leggings","skirt","miniskirt","palazzo"
];
export const SHOE_STYLES = [
  "sneakers","boots","sandals","formal","slippers",
  "hightops","heels","flipflops","wellies","cleats","loafers","barefoot"
];
export const PATTERNS      = ["solid","stripes-h","stripes-v","checkers","dots","gradient","plaid","camo","ankara","kente"];
export const GENDERS       = ["neutral","masculine","feminine"];
export const HAT_STYLES    = ["cap","beanie","barret","facecap","bucket","fila","gele","headband","durag","hardhat","tophat","cowboy","crown","headscarf"];
export const GLASS_STYLES  = ["round","square","shades","aviator","cateye","sport"];
export const TIE_STYLES    = ["none","classic","skinny","bow"];
export const BEARD_STYLES  = ["stubble","moustache","goatee","chinstrap","full","long"];
export const NECK_STYLES   = ["chain","pendant","pearls","choker","beads","scarf"];
export const EAR_STYLES    = ["studs","hoops","drops","headphones"];
export const WRIST_STYLES  = ["watch","band","bangles","bracelet"];
export const BAG_STYLES    = ["backpack","satchel","sling"];
export const MASK_STYLES   = ["surgical","bandana"];
export const DRESS_SHAPES  = ["auto","aline","skater","maxi","ball","pencil","tulip","pleated","handkerchief"];

/* Costumes. P / S = default primary / secondary colour (the player can
   recolour both). outfit = clothing the costume puts on the body ("P" / "S"
   are replaced by the resolved colours). skin = recolours the skin.      */
export const COSTUME_INFO = {
  pumpkin:   { icon: "🎃", P: "#f07a12", S: "#3b6b22", outfit: {} },
  witch:     { icon: "🧙", P: "#15101c", S: "#6a2a9a", outfit: {} },
  vampire:   { icon: "🧛", P: "#14090c", S: "#8a0f1c", outfit: {}, skin: "#e9e2e0" },
  devil:     { icon: "😈", P: "#c4121a", S: "#7a0a10", outfit: {} },
  ghost:     { icon: "👻", P: "#f4f4f8", S: "#0a0a10", outfit: {} },
  skeleton:  { icon: "💀", P: "#ece6d0", S: "#0a0a0c", outfit: {} },
  mummy:     { icon: "🩹", P: "#d9ceb0", S: "#b8ab88", outfit: {} },
  zombie:    { icon: "🧟", P: "#2d2a22", S: "#5a0f12", outfit: {}, skin: "#86a878" },
  superhero: { icon: "🦸", P: "#d62839", S: "#1d4ed8",
               outfit: { topStyle: "longsleeve", topColor: "P", topPattern: "solid",
                         bottomStyle: "leggings", bottomColor: "P", bottomPattern: "solid",
                         shoeStyle: "boots", shoeColor: "S" } },
  ninja:     { icon: "🥷", P: "#15161c", S: "#b3261e",
               outfit: { topStyle: "longsleeve", topColor: "P", topPattern: "solid",
                         bottomStyle: "tracksuit", bottomColor: "P", bottomPattern: "solid", bottomAccent: 1,
                         shoeStyle: "boots", shoeColor: "P" } },
  pirate:    { icon: "🏴‍☠️", P: "#7a1f1f", S: "#2a1d14",
               outfit: { topStyle: "longsleeve", topColor: "#efe6cf", topPattern: "stripes-h", topAccent: "P",
                         bottomStyle: "baggy", bottomColor: "S", bottomPattern: "solid",
                         shoeStyle: "boots", shoeColor: "S" } },
  clown:     { icon: "🤡", P: "#e11d48", S: "#2563eb",
               outfit: { topStyle: "dashiki", topColor: "P", topPattern: "dots", topAccent: "#ffffff",
                         bottomStyle: "baggy", bottomColor: "S", bottomPattern: "stripes-v", bottomAccent: "#ffffff",
                         shoeStyle: "formal", shoeColor: "#facc15" } },
  astronaut: { icon: "🧑‍🚀", P: "#eceff4", S: "#e2711d",
               outfit: { topStyle: "bomber", topColor: "P", topPattern: "solid", topAccent: "S",
                         bottomStyle: "cargo", bottomColor: "P", bottomPattern: "solid",
                         shoeStyle: "boots", shoeColor: "#6b7280" } },
  knight:    { icon: "🛡️", P: "#aab4c0", S: "#b3261e",
               outfit: { topStyle: "longsleeve", topColor: "P", topPattern: "solid",
                         bottomStyle: "leggings", bottomColor: "#4b5563", bottomPattern: "solid",
                         shoeStyle: "boots", shoeColor: "P" } },
  king:      { icon: "👑", P: "#7a1fa2", S: "#d4af37",
               outfit: { topStyle: "agbada", topColor: "P", topPattern: "solid", topAccent: "S",
                         bottomStyle: "palazzo", bottomColor: "#f3e9d2", bottomPattern: "solid",
                         shoeStyle: "loafers", shoeColor: "S" } },
  angel:     { icon: "😇", P: "#fbfbff", S: "#f5c542",
               outfit: { topStyle: "dress", topColor: "P", topPattern: "solid", topAccent: "S",
                         shoeStyle: "barefoot" } },
  robot:     { icon: "🤖", P: "#9aa7b4", S: "#38bdf8",
               outfit: { topStyle: "longsleeve", topColor: "P", topPattern: "solid",
                         bottomStyle: "leggings", bottomColor: "P", bottomPattern: "solid",
                         shoeStyle: "boots", shoeColor: "#4b5563" }, skin: "#9aa7b4" },
  cat:       { icon: "🐱", P: "#2b2b30", S: "#f9a8d4", outfit: {} },
  bunny:     { icon: "🐰", P: "#f4f4f6", S: "#f9a8d4",
               outfit: { topStyle: "hoodie", topColor: "P", topPattern: "solid", topAccent: "S",
                         bottomStyle: "tracksuit", bottomColor: "P", bottomPattern: "solid", bottomAccent: "S",
                         shoeStyle: "slippers", shoeColor: "S" } },
  police:    { icon: "👮", P: "#1e3a8a", S: "#d4af37",
               outfit: { topStyle: "polo", topColor: "P", topPattern: "solid", topAccent: "S",
                         bottomStyle: "cargo", bottomColor: "#111827", bottomPattern: "solid",
                         shoeStyle: "boots", shoeColor: "#000000" } },
  doctor:    { icon: "🧑‍⚕️", P: "#f5f5f4", S: "#0ea5e9",
               outfit: { topStyle: "suit", topColor: "P", topPattern: "solid", tie: "none",
                         bottomStyle: "jeans", bottomColor: "#cbd5e1", bottomPattern: "solid",
                         shoeStyle: "loafers", shoeColor: "#f0f0f0" } },
};
export const COSTUME_STYLES = Object.keys(COSTUME_INFO);

/* Subsets random pedestrians pick from (kept sensible / era-appropriate). */
export const NPC_HAIR_STYLES   = ["short","buzz","curly","long","ponytail","bald","afro","braids","hightop","bun","bob","knots"];
export const NPC_TOP_STYLES    = ["tshirt","longsleeve","hoodie","tank","jacket","singlet","suit","polo","croptop","vneck","sweater","jersey","dashiki","kaftan","bomber"];
export const NPC_BOTTOM_STYLES = ["jeans","shorts","tracksuit","baggy","cargo","bermuda","leggings"];
export const NPC_SHOE_STYLES   = ["sneakers","boots","sandals","formal","slippers","hightops","flipflops","loafers"];
export const NPC_PATTERNS      = ["solid","stripes-h","stripes-v","checkers","dots","gradient","plaid","ankara"];
export const NPC_HAT_STYLES    = ["cap","beanie","barret","facecap","bucket","fila","headband"];
export const NPC_GLASS_STYLES  = ["round","square","shades","aviator"];

/* tops that replace the bottoms (legs are bare below the hem) */
export const ONE_PIECE_TOPS = [];

/* ── Colour helper ───────────────────────────────────────────
   A colour slot is either an index into a palette or a custom hex string. */
export function resolveColor(palette, v, fallback) {
  if (typeof v === "string" && v.charAt(0) === "#") return v;
  if (typeof v === "number" && palette && palette[v] !== undefined) return palette[v];
  if (fallback !== undefined) return fallback;
  return palette ? palette[0] : "#888888";
}

const DEFAULT = {
  look: "classic",
  gender: "neutral",
  build: 0,
  skinTone: 3,
  eyeColor: 0,
  lipColor: 0,
  hairStyle: "short",
  hairColor: 1,
  beard: null,
  topStyle: "tshirt",
  dressStyle: "auto",
  topColor: 0,
  topPattern: "solid",
  topAccent: 0,
  tie: "none",
  tieColor: null,
  bottomStyle: "jeans",
  bottomColor: 0,
  bottomPattern: "solid",
  bottomAccent: 0,
  shoeStyle: "sneakers",
  shoeColor: 0,
  hat: null,
  glasses: null,
  neck: null,
  ears: null,
  wrist: null,
  bag: null,
  mask: null,
  costume: null,
  costumeColor: null,
  costumeColor2: null,
};

const STORE_KEY = "ph3d.wardrobe.v1";

/* ── Pattern textures ──────────────────────────────────────── */
function makePatternTex(base, accent, pattern) {
  const S = 128;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d");
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  g.fillStyle = accent;
  if (pattern === "stripes-h") {
    for (let i = 0; i < 6; i++) g.fillRect(0, i * 22, S, 10);
  } else if (pattern === "stripes-v") {
    for (let i = 0; i < 6; i++) g.fillRect(i * 22, 0, 10, S);
  } else if (pattern === "checkers") {
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        if ((x + y) % 2 === 0) g.fillRect(x * 16, y * 16, 16, 16);
  } else if (pattern === "dots") {
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 6; x++) {
        g.beginPath();
        g.arc(x * 24 + 12, y * 24 + 12, 3.5, 0, Math.PI * 2);
        g.fill();
      }
  } else if (pattern === "gradient") {
    const gr = g.createLinearGradient(0, 0, 0, S);
    gr.addColorStop(0, base);
    gr.addColorStop(1, accent);
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
  } else if (pattern === "plaid") {
    g.globalAlpha = 0.55;
    for (let i = 0; i < 4; i++) { g.fillRect(i * 32 + 6, 0, 12, S); g.fillRect(0, i * 32 + 6, S, 12); }
    g.globalAlpha = 0.9;
    for (let i = 0; i < 4; i++) { g.fillRect(i * 32 + 11, 0, 2, S); g.fillRect(0, i * 32 + 11, S, 2); }
    g.globalAlpha = 1;
  } else if (pattern === "camo") {
    const cols = [accent, "#00000055", "#ffffff22"];
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) {
      g.fillStyle = cols[i % 3];
      g.beginPath();
      const x = rnd() * S, y = rnd() * S, rx = 8 + rnd() * 16, ry = 6 + rnd() * 12;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        g.moveTo(x + ox + rx, y + oy);
        g.ellipse(x + ox, y + oy, rx, ry, rnd() * 3, 0, Math.PI * 2);
      }
      g.fill();
    }
  } else if (pattern === "ankara") {
    /* African wax print: concentric medallions + leaves in base/accent/cream */
    const cream = "#f6e7c1";
    for (let gy = 0; gy < 2; gy++) for (let gx = 0; gx < 2; gx++) {
      const cx = gx * 64 + 32, cy = gy * 64 + 32, flip = (gx + gy) % 2;
      g.fillStyle = flip ? accent : cream; g.beginPath(); g.arc(cx, cy, 27, 0, 7); g.fill();
      g.fillStyle = base; g.beginPath(); g.arc(cx, cy, 20, 0, 7); g.fill();
      g.fillStyle = flip ? cream : accent; g.beginPath(); g.arc(cx, cy, 13, 0, 7); g.fill();
      g.fillStyle = base; g.beginPath(); g.arc(cx, cy, 6, 0, 7); g.fill();
      g.fillStyle = flip ? accent : cream;
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4 + (flip ? 0.39 : 0);
        g.beginPath(); g.ellipse(cx + Math.cos(a) * 31, cy + Math.sin(a) * 31, 3.5, 7, a, 0, 7); g.fill();
      }
    }
  } else if (pattern === "kente") {
    /* woven strips: gold / accent / green / red bands over the base */
    const bands = ["#d4af37", accent, "#1f8a3d", "#c0262d", "#111111"];
    for (let i = 0; i < 8; i++) {
      g.fillStyle = bands[i % bands.length];
      g.fillRect(0, i * 16, S, 7);
      g.fillStyle = bands[(i + 2) % bands.length];
      for (let x = 0; x < 8; x++) if ((x + i) % 2 === 0) g.fillRect(x * 16, i * 16 + 8, 8, 6);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  return t;
}

function applyPattern(mat, base, accent, pattern) {
  if (mat.map) { mat.map.dispose(); mat.map = null; }
  if (pattern === "solid" || !pattern) {
    mat.color.set(new THREE.Color(base));
  } else {
    mat.map = makePatternTex(base, accent, pattern);
    mat.color.set(0xffffff);
  }
  mat.needsUpdate = true;
}

export const Wardrobe = {
  config: Object.assign({}, DEFAULT),
  _subs: new Set(),

  load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) Object.assign(this.config, JSON.parse(raw));
    } catch (e) {}
    return this;
  },
  save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this.config)); } catch (e) {}
  },
  /* set("hat.color", 3) also creates the parent object when it is null */
  set(path, value) {
    if (path === "gender" && value !== this.config.gender) {
      try { const g = window.__ph3d_genderGuard; if (g && g(value) === false) return false; } catch (e) {}
    }
    const parts = path.split(".");
    let obj = this.config;
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj[parts[i]] == null || typeof obj[parts[i]] !== "object") obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    this.save();
    this._emit();
  },
  /* optional item (hat, glasses, beard …): style "none" removes it, any other
     style creates / updates it and keeps the colour the player already chose */
  setItem(key, style, defaults) {
    if (!style || style === "none") { this.set(key, null); return; }
    const cur = this.config[key];
    const next = Object.assign({ color: 0 }, defaults || {}, cur && typeof cur === "object" ? cur : {}, { style });
    this.set(key, next);
  },
  reset() {
    Object.assign(this.config, DEFAULT);
    this.save();
    this._emit();
  },
  randomize() {
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const ri = n => Math.floor(Math.random() * n);
    const cfg = this.config;
    cfg.gender = pick(GENDERS);
    cfg.skinTone = ri(SKIN_TONES.length);
    cfg.eyeColor = ri(EYE_COLORS.length);
    cfg.hairStyle = pick(HAIR_STYLES);
    cfg.hairColor = ri(HAIR_COLORS.length);
    cfg.topStyle = pick(TOP_STYLES);
    cfg.topColor = ri(SHIRT_COLORS.length);
    cfg.topPattern = pick(PATTERNS);
    cfg.topAccent = ri(ACCENT_COLORS.length);
    cfg.tie = pick(TIE_STYLES);
    cfg.bottomStyle = pick(BOTTOM_STYLES);
    cfg.bottomColor = ri(BOTTOM_COLORS.length);
    cfg.bottomPattern = pick(PATTERNS);
    cfg.bottomAccent = ri(ACCENT_COLORS.length);
    cfg.shoeStyle = pick(SHOE_STYLES);
    cfg.shoeColor = ri(SHOE_COLORS.length);
    cfg.hat = Math.random() < 0.30 ? { style: pick(HAT_STYLES), color: ri(SHIRT_COLORS.length) } : null;
    cfg.glasses = Math.random() < 0.40 ? { style: pick(GLASS_STYLES), color: 0 } : null;
    cfg.beard = (cfg.gender !== "feminine" && Math.random() < 0.30) ? { style: pick(BEARD_STYLES), color: null } : null;
    cfg.neck = Math.random() < 0.25 ? { style: pick(NECK_STYLES), color: ri(GEAR_COLORS.length) } : null;
    cfg.ears = Math.random() < 0.25 ? { style: pick(EAR_STYLES), color: ri(GEAR_COLORS.length) } : null;
    cfg.wrist = Math.random() < 0.25 ? { style: pick(WRIST_STYLES), color: ri(GEAR_COLORS.length) } : null;
    cfg.bag = Math.random() < 0.15 ? { style: pick(BAG_STYLES), color: ri(GEAR_COLORS.length) } : null;
    cfg.mask = null;
    cfg.costume = null;
    this.save();
    this._emit();
  },
  /* Signature of everything that changes the SHAPE of the character (not just its
     colours). Same signature = a colour-only change = no rebuild needed. */
  structSig(config) {
    const o = JSON.parse(JSON.stringify(this.effective(config || this.config)));
    for (const k of ["skinTone","hairColor","shoeColor","eyeColor","lipColor","topColor","topAccent","topPattern",
                     "bottomColor","bottomAccent","bottomPattern","_skin"]) delete o[k];
    if (o.hat) delete o.hat.color;
    if (o.glasses) delete o.glasses.color;
    return JSON.stringify(o);
  },
  onChange(fn) { this._subs.add(fn); return () => this._subs.delete(fn); },
  _emit() {
    for (const fn of this._subs) {
      try { fn(this.config); } catch (e) { console.warn("[wardrobe]", e); }
    }
  },

  /* The look that is actually drawn: the saved config + whatever outfit the
     costume puts on. Costume colours are resolved to plain hex strings. */
  effective(config) {
    config = config || this.config;
    const info = config.costume && COSTUME_INFO[config.costume];
    if (!info) return config;
    const P = resolveColor(SHIRT_COLORS, config.costumeColor,  info.P);
    const S = resolveColor(SHIRT_COLORS, config.costumeColor2, info.S);
    const out = Object.assign({}, config);
    for (const [k, v] of Object.entries(info.outfit || {})) out[k] = v === "P" ? P : v === "S" ? S : v;
    out._costume = { name: config.costume, P, S };
    if (info.skin) out._skin = info.skin;
    return out;
  },

  makeMaterials(config) {
    const mats = {
      skin:    new THREE.MeshLambertMaterial({ color: 0xffffff }),
      hair:    new THREE.MeshLambertMaterial({ color: 0xffffff }),
      top:     new THREE.MeshLambertMaterial({ color: 0xffffff }),
      bottom:  new THREE.MeshLambertMaterial({ color: 0xffffff }),
      shoes:   new THREE.MeshLambertMaterial({ color: 0xffffff }),
      hat:     new THREE.MeshLambertMaterial({ color: 0x444444 }),
      glasses: new THREE.MeshLambertMaterial({ color: 0x111111 }),
      eyeW:    new THREE.MeshBasicMaterial({ color: 0xf2f4f8 }),
      eyeD:    new THREE.MeshBasicMaterial({ color: 0x141a22 }),
      mouth:   new THREE.MeshBasicMaterial({ color: 0x9b4f4a }),
    };
    this.updateMaterials(mats, config);
    return mats;
  },

  updateMaterials(mats, config) {
    mats.skin.color.set(new THREE.Color(config._skin || resolveColor(SKIN_TONES, config.skinTone)));
    mats.hair.color.set(new THREE.Color(resolveColor(HAIR_COLORS, config.hairColor)));
    mats.shoes.color.set(new THREE.Color(resolveColor(SHOE_COLORS, config.shoeColor)));
    mats.eyeD.color.set(new THREE.Color(resolveColor(EYE_COLORS, config.eyeColor)));
    mats.mouth.color.set(new THREE.Color(resolveColor(LIP_COLORS, config.lipColor)));
    applyPattern(mats.top,    resolveColor(SHIRT_COLORS, config.topColor),
                              resolveColor(ACCENT_COLORS, config.topAccent), config.topPattern);
    applyPattern(mats.bottom, resolveColor(BOTTOM_COLORS, config.bottomColor),
                              resolveColor(ACCENT_COLORS, config.bottomAccent), config.bottomPattern);
    if (config.hat) mats.hat.color.set(new THREE.Color(resolveColor(SHIRT_COLORS, config.hat.color || 0)));
    if (config.glasses) mats.glasses.color.set(new THREE.Color(resolveColor(GEAR_COLORS, config.glasses.color || 0)));
  },
};

/* ═══════════════════════════════════════════════════════════════
   WARDROBE_TABS — what the Tailor / wardrobe sheet shows.
   group.kind:
     pills   : plain choice list              (key, options)
     color   : swatches + custom colour       (key, palette, auto?)
     slider  : numeric                        (key, min, max, step, lo, hi)
     item    : optional item "none | style…"  (key, options, colors:[{sub,label,palette,auto?}])
   group.when(cfg) hides a group; group.note(cfg) shows a hint line.
   ═══════════════════════════════════════════════════════════════ */
export const WARDROBE_TABS = [
  { id: "body", label: "Body", groups: [
    { label: "Look",        kind: "pills",  key: "look", options: ["classic", "faceted"] },
    { label: "Gender",      kind: "pills",  key: "gender", options: GENDERS },
    { label: "Skin tone",   kind: "color",  key: "skinTone", palette: SKIN_TONES },
    { label: "Build",       kind: "slider", key: "build", min: -1, max: 1, step: 0.05, lo: "Slim", hi: "Full" },
    { label: "Eye colour",  kind: "color",  key: "eyeColor", palette: EYE_COLORS },
    { label: "Lip colour",  kind: "color",  key: "lipColor", palette: LIP_COLORS },
  ]},
  { id: "hair", label: "Hair", groups: [
    { label: "Style",       kind: "pills",  key: "hairStyle", options: HAIR_STYLES },
    { label: "Colour",      kind: "color",  key: "hairColor", palette: HAIR_COLORS },
    { label: "Beard",       kind: "item",   key: "beard", options: BEARD_STYLES,
      colors: [{ sub: "color", label: "Beard colour", palette: HAIR_COLORS, auto: "Match hair" }] },
  ]},
  { id: "top", label: "Top", groups: [
    { label: "Style",       kind: "pills",  key: "topStyle", options: TOP_STYLES },
    { label: "Colour",      kind: "color",  key: "topColor", palette: SHIRT_COLORS },
    { label: "Pattern",     kind: "pills",  key: "topPattern", options: PATTERNS },
    { label: "Accent / trim", kind: "color", key: "topAccent", palette: ACCENT_COLORS },
    { label: "Dress shape", kind: "pills",  key: "dressStyle", options: DRESS_SHAPES,
      when: c => c.look === "faceted" && c.topStyle === "dress" },
    { label: "Tie",         kind: "pills",  key: "tie", options: TIE_STYLES, when: c => c.topStyle === "suit" },
    { label: "Tie colour",  kind: "color",  key: "tieColor", palette: SHIRT_COLORS, auto: "Auto",
      when: c => c.topStyle === "suit" && c.tie && c.tie !== "none" },
  ]},
  { id: "bottom", label: "Bottom", groups: [
    { label: "Style",       kind: "pills",  key: "bottomStyle", options: BOTTOM_STYLES,
      note: c => ONE_PIECE_TOPS.includes(c.topStyle) ? "Your dress covers the bottoms — pick another top to show them." : "" },
    { label: "Skirt shape", kind: "pills",  key: "dressStyle", options: DRESS_SHAPES,
      when: c => c.look === "faceted" && (c.bottomStyle === "skirt" || c.bottomStyle === "miniskirt") && c.topStyle !== "dress" },
    { label: "Colour",      kind: "color",  key: "bottomColor", palette: BOTTOM_COLORS },
    { label: "Pattern",     kind: "pills",  key: "bottomPattern", options: PATTERNS },
    { label: "Accent / trim", kind: "color", key: "bottomAccent", palette: ACCENT_COLORS },
  ]},
  { id: "shoes", label: "Shoes", groups: [
    { label: "Style",       kind: "pills",  key: "shoeStyle", options: SHOE_STYLES },
    { label: "Colour",      kind: "color",  key: "shoeColor", palette: SHOE_COLORS },
  ]},
  { id: "extra", label: "Extras", groups: [
    { label: "Hat",         kind: "item",   key: "hat", options: HAT_STYLES,
      colors: [{ sub: "color", label: "Hat colour", palette: SHIRT_COLORS }] },
    { label: "Glasses",     kind: "item",   key: "glasses", options: GLASS_STYLES,
      colors: [{ sub: "color", label: "Frame colour", palette: GEAR_COLORS },
               { sub: "lens",  label: "Lens tint", palette: LENS_COLORS, auto: "Default" }] },
    { label: "Necklace",    kind: "item",   key: "neck", options: NECK_STYLES,
      colors: [{ sub: "color", label: "Necklace colour", palette: GEAR_COLORS }] },
    { label: "Ears",        kind: "item",   key: "ears", options: EAR_STYLES,
      colors: [{ sub: "color", label: "Ear colour", palette: GEAR_COLORS }] },
    { label: "Wrist",       kind: "item",   key: "wrist", options: WRIST_STYLES,
      colors: [{ sub: "color", label: "Wrist colour", palette: GEAR_COLORS }] },
    { label: "Bag",         kind: "item",   key: "bag", options: BAG_STYLES,
      colors: [{ sub: "color", label: "Bag colour", palette: GEAR_COLORS }] },
    { label: "Face mask",   kind: "item",   key: "mask", options: MASK_STYLES,
      colors: [{ sub: "color", label: "Mask colour", palette: GEAR_COLORS }] },
  ]},
  { id: "costume", label: "Costume", groups: [
    { label: "Costume",     kind: "costume", key: "costume", options: COSTUME_STYLES },
    { label: "Main colour", kind: "color",  key: "costumeColor",  palette: SHIRT_COLORS, auto: "Default",
      when: c => !!c.costume },
    { label: "Accent colour", kind: "color", key: "costumeColor2", palette: SHIRT_COLORS, auto: "Default",
      when: c => !!c.costume },
  ]},
];

/* NPCs wear whatever look (classic / faceted) the player has chosen, so the whole
   world matches. Their own outfits, colours and accessories stay random. */
export function withPlayerLook(cfg) {
  if (cfg && typeof cfg === "object") cfg.look = (Wardrobe.config && Wardrobe.config.look) || "classic";
  return cfg;
}
