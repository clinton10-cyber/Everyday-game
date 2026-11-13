/* ════════════════════════════════════════════════════════════════
   npcs.js — path-following pedestrians with role uniforms.

   Role NPCs (doctor, banker, police, priest, trader, mechanic,
   taxi) now dress the part. Walkers and archetype groups still
   wear random / archetype clothes.

   Exports: NPCs
   ════════════════════════════════════════════════════════════════ */

import { Limp } from "../characters/limp.js";
import {
  SKIN_TONES, HAIR_COLORS, SHIRT_COLORS, BOTTOM_COLORS,
  SHOE_COLORS, ACCENT_COLORS, NPC_HAIR_STYLES as HAIR_STYLES, NPC_TOP_STYLES as TOP_STYLES,
  NPC_BOTTOM_STYLES as BOTTOM_STYLES, NPC_SHOE_STYLES as SHOE_STYLES, NPC_PATTERNS as PATTERNS, GENDERS,
  NPC_HAT_STYLES as HAT_STYLES, NPC_GLASS_STYLES as GLASS_STYLES, TIE_STYLES,
  Wardrobe, withPlayerLook,
} from "./wardrobe.js";
import { buildCharacter } from "../characters/lowpoly.js";
import * as Animator from "../characters/animator.js";
import { Pursuit } from "./pursuit.js";
import { WRESTLING_MOVES, VICTIM_MOVES, victimEmoteName, EMOTE_SPEED } from "../characters/wrestling.js";
import { Quality } from "./quality.js";
import { NPC_PATHS, ROLE_PATHS, pointAtU, nearestU, getSegs } from "./npc-paths.js";
import { Blood } from "./blood.js";
import { Sfx } from "./sfx.js";
import { buildGroup } from "./npc-groups.js";
import { Lives } from "./npc-lives.js";
import { InteriorPoses } from "./interior-poses.js";
import { AnimationAutomation } from "./animation-automation.js";
import { pickFall, poseFall, restY } from "./death-pose.js";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

let _seed = 0x9e3779b9;
function rnd() { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
function rBetween(a, b) { return a + rnd() * (b - a); }

function randomConfig() {
  return {
    gender: pick(GENDERS),
    skinTone: Math.floor(rnd() * SKIN_TONES.length),
    hairStyle: pick(HAIR_STYLES),
    hairColor: Math.floor(rnd() * HAIR_COLORS.length),
    topStyle: pick(TOP_STYLES),
    topColor: Math.floor(rnd() * SHIRT_COLORS.length),
    topPattern: pick(PATTERNS),
    topAccent: Math.floor(rnd() * ACCENT_COLORS.length),
    tie: pick(TIE_STYLES),
    bottomStyle: pick(BOTTOM_STYLES),
    bottomColor: Math.floor(rnd() * BOTTOM_COLORS.length),
    bottomPattern: pick(PATTERNS),
    bottomAccent: Math.floor(rnd() * ACCENT_COLORS.length),
    shoeStyle: pick(SHOE_STYLES),
    shoeColor: Math.floor(rnd() * SHOE_COLORS.length),
    hat: rnd() < 0.18 ? { style: pick(HAT_STYLES), color: Math.floor(rnd() * SHIRT_COLORS.length) } : null,
    glasses: rnd() < 0.30 ? { style: pick(GLASS_STYLES), color: 0 } : null,
  };
}

/* Role uniforms — return a config or null if role has none. */
function uniformFor(role) {
  const base = randomConfig();
  switch (role) {
    case "hotel_staff":
      base.topStyle = "suit";
      base.topColor = 6;
      base.topPattern = "solid";
      base.tie = "classic";
      base.bottomStyle = "jeans";
      base.bottomColor = 1;
      base.shoeStyle = "formal";
      base.shoeColor = 0;
      base.hat = null;
      base.glasses = null;
      return base;

    case "chef":
      base.topStyle = "longsleeve";
      base.topColor = 0;
      base.topPattern = "solid";
      base.bottomStyle = "jeans";
      base.bottomColor = 1;
      base.shoeStyle = "formal";
      base.shoeColor = 0;
      base.hat = { style: "cap", color: 0 };
      base.glasses = null;
      return base;

    case "housekeeper":
      base.topStyle = "longsleeve";
      base.topColor = 5;
      base.topPattern = "solid";
      base.bottomStyle = "jeans";
      base.bottomColor = 1;
      base.shoeStyle = "formal";
      base.shoeColor = 0;
      base.hat = null;
      base.glasses = null;
      return base;

    case "doctor":
      base.topStyle = "longsleeve";
      base.topColor = 5;
      base.topPattern = "solid";
      base.bottomStyle = "jeans";
      base.bottomColor = 1;
      base.shoeStyle = "sneakers";
      base.shoeColor = 1;
      base.hat = null;
      base.glasses = rnd() < 0.3 ? { style: "square", color: 0 } : null;
      return base;

    case "banker":
      base.topStyle = "suit";
      base.topColor = 6;
      base.topPattern = "solid";
      base.tie = rnd() < 0.5 ? "classic" : "skinny";
      base.bottomStyle = "jeans";
      base.bottomColor = 1;
      base.shoeStyle = "formal";
      base.shoeColor = 0;
      base.glasses = rnd() < 0.4 ? { style: "square", color: 0 } : null;
      return base;

    case "police":
      base.topStyle = "jacket";
      base.topColor = 7;
      base.topPattern = "solid";
      base.topAccent = 0;
      base.bottomStyle = "jeans";
      base.bottomColor = 1;
      base.shoeStyle = "boots";
      base.shoeColor = 0;
      base.hat = { style: "cap", color: 7 };
      base.glasses = null;
      return base;

    case "inmate":
      base.topStyle = "longsleeve";
      base.topColor = 10;            /* orange */
      base.topPattern = "solid";
      base.bottomStyle = "jeans";
      base.bottomColor = 8;          /* jail orange */
      base.bottomPattern = "solid";
      base.shoeStyle = "sneakers";
      base.shoeColor = 1;
      base.hat = null;
      base.glasses = null;
      return base;

    case "warden":
      base.topStyle = "jacket";
      base.topColor = 6;             /* dark navy */
      base.topPattern = "solid";
      base.topAccent = 0;
      base.bottomStyle = "jeans";
      base.bottomColor = 1;
      base.shoeStyle = "boots";
      base.shoeColor = 0;
      base.hat = { style: "cap", color: 6 };
      base.glasses = null;
      return base;

    case "priest":
      base.topStyle = "longsleeve";
      base.topColor = 5;
      base.topPattern = "solid";
      base.bottomStyle = "jeans";
      base.bottomColor = 1;
      base.shoeStyle = "formal";
      base.shoeColor = 0;
      base.tie = "classic";
      base.hat = null;
      return base;

    case "trader":
      base.topStyle = "tshirt";
      base.topColor = Math.floor(rnd() * SHIRT_COLORS.length);
      base.topPattern = rnd() < 0.5 ? "checkers" : "stripes-h";
      base.bottomStyle = "shorts";
      base.bottomColor = 4;
      base.shoeStyle = "sandals";
      base.hat = rnd() < 0.3 ? { style: "cap", color: Math.floor(rnd() * SHIRT_COLORS.length) } : null;
      return base;

    case "mechanic":
      base.topStyle = "tshirt";
      base.topColor = 6;
      base.topPattern = "solid";
      base.bottomStyle = "tracksuit";
      base.bottomColor = 2;
      base.shoeStyle = "boots";
      base.shoeColor = 6;
      base.hat = null;
      return base;

    case "taxi":
      base.topStyle = "tshirt";
      base.topColor = 3;
      base.topPattern = "solid";
      base.bottomStyle = "jeans";
      base.bottomColor = 1;
      base.shoeStyle = "sneakers";
      base.hat = { style: "cap", color: 3 };
      return base;

    default:
      return null;
  }
}

/* ── Recorded voice-overs (optional) ───────────────────────────────
   Drop assets/audio/voice/lines.json next to your mp3 files:
     { "walker": [ { "text": "How far, my guy?", "file": "walker_01.mp3" },
                   { "text": "Good morning, ma.", "file": "walker_02_f.mp3", "gender": "feminine" } ],
       "police":  [ { "text": "Move along.", "file": "police_01.mp3" } ] }
   The bubble shows "text"; the game plays "file". Roles without an entry (or an
   entry without "file") keep the built-in lines, spoken by the device voice.
   Keys: walker trader banker mechanic priest doctor police taxi inmate warden
         couple suit_men yahoo_boys mamas school_kids student clerk            */
let _linesLoaded = false;
function _loadVoiceLines() {
  if (_linesLoaded) return; _linesLoaded = true;
  try {
    fetch("assets/audio/voice/lines.json", { cache: "no-cache" })
      .then(r => (r && r.ok ? r.json() : null))
      .then(j => {
        if (!j || typeof j !== "object") return;
        let n = 0;
        for (const key of Object.keys(j)) {
          const def = ROLES[key]; const list = j[key];
          if (!def || !Array.isArray(list)) continue;
          const entries = list
            .map(e => (typeof e === "string" ? { text: e } : e))
            .filter(e => e && typeof e.text === "string" && e.text.trim());
          if (!entries.length) continue;
          def._entries = entries;
          def.dialogue = entries.map(e => e.text);   /* keep everything else in sync */
          n += entries.length;
        }
        if (n) console.log("[npcs] loaded " + n + " recorded voice lines");
      })
      .catch(() => {});
  } catch (e) {}
}

const DIALOGUE = {
  walker: [
    "Good afternoon, oga.", "How far? You dey alright?",
    "This weather hot sha.", "I dey go market.",
    "You get change?", "No wahala.",
    "Make we see later.", "Ah, you again!",
    "Na so life be.", "PH no dey carry last.",
  ],
  trader: ["Come buy! Fresh from the farm!", "Oga, I get the best price.", "Plantain dey, tomato dey, everything dey.", "Buy small now, no be every day."],
  banker: ["Bank is open. Walk in.", "Your money is safe with us.", "Do you want to make a deposit?"],
  mechanic: ["Your car need servicing?", "Anything for the engine, I fit fix am.", "Bring am tomorrow, I go work on am."],
  priest: ["God bless you, my child.", "The Lord is with you.", "Come back for Sunday service."],
  doctor: ["Are you hurt? Let me have a look.", "You look pale. Take some rest.", "Health is wealth, don't forget."],
  police: ["Move along. Nothing to see here.", "Report any crime to us.", "You look suspicious. Keep moving."],
  inmate: ["You new here?", "Keep your head down.", "They dey watch us.", "I'm innocent, swear.", "Bail is a joke.", "What you dey in for?", "Chow time soon."],
  warden: ["Lights out in ten.", "No funny business.", "Cell check.", "Keep moving.", "You're not going anywhere."],
  taxi: ["Where you dey go? Enter!", "I go take you anywhere for the city.", "Fare na small money."],
};

const ROLES = {
  walker:   { label: "Pedestrian", mood: "wander", dialogue: DIALOGUE.walker },
  trader:   { label: "Trader",     mood: "work",   dialogue: DIALOGUE.trader,   action: "trader" },
  banker:   { label: "Banker",     mood: "work",   dialogue: DIALOGUE.banker,   action: "banker" },
  mechanic: { label: "Mechanic",   mood: "work",   dialogue: DIALOGUE.mechanic, action: "mechanic" },
  priest:   { label: "Priest",     mood: "work",   dialogue: DIALOGUE.priest,   action: "priest" },
  doctor:   { label: "Doctor",     mood: "work",   dialogue: DIALOGUE.doctor,   action: "doctor" },
  hotel_staff: { label: "Hotel Staff", mood: "work", dialogue: ["Welcome to Hotel Presidential. How may I assist you?", "Your comfort is our priority, sir.", "The concierge can arrange transport for you."], action: "hotel_staff" },
  chef: { label: "Hotel Chef", mood: "work", dialogue: ["The kitchen is preparing your order.", "Our chef's special is ready soon.", "Welcome. Please take a seat."], action: "chef" },
  housekeeper: { label: "Housekeeping Staff", mood: "work", dialogue: ["Good day. Housekeeping is available on request.", "Would you like fresh towels or room service?"], action: "housekeeper" },
  police:   { label: "Officer",    mood: "work",   dialogue: DIALOGUE.police,   action: "police" },
  taxi:     { label: "Taxi Driver",mood: "work",   dialogue: DIALOGUE.taxi,     action: "taxi" },
  inmate:   { label: "Inmate",     mood: "wander", dialogue: DIALOGUE.inmate,   action: "inmate" },
  warden:   { label: "Warden",     mood: "work",   dialogue: DIALOGUE.warden,   action: "warden" },
  /* group NPCs: talk() looks these up by groupTag so their lines fit their label */
  couple:      { label: "Couple",       mood: "wander", dialogue: ["We dey go chop, join us?", "Abeg, we dey enjoy small.", "This city sweet when you no dey alone.", "Oga, na our anniversary today."] },
  suit_men:    { label: "Businessmen",  mood: "wander", dialogue: ["Time is money, my friend.", "We have a meeting at three.", "Send me the figures before close of day.", "Business is booming in PH."] },
  yahoo_boys:  { label: "Yahoo Boys",   mood: "wander", dialogue: ["Guy, no dey look us like that.", "Wetin dey happen, boss?", "Hustle no get holiday.", "Too much wahala for this street."] },
  mamas:       { label: "Market Mamas", mood: "wander", dialogue: ["My pikin, come buy fresh pepper!", "Price don change, na so e be.", "You no go greet your elders?", "See as you dey thin, come chop."] },
  school_kids: { label: "School Kids",  mood: "wander", dialogue: ["Good afternoon, sir!", "We dey go school.", "Teacher go flog us if we late!", "Please sir, any change?"] },
  student:     { label: "Student",      mood: "wander", dialogue: ["Exams dey this week, I dey tire.", "Library dey full today.", "I dey find small hustle for school fees."] },
  clerk:       { label: "Clerk",        mood: "wander", dialogue: ["Please queue up, sir.", "Come back tomorrow, the system is down.", "Do you have the form?"] },
};

/* who borrows whose recordings when device speech is unavailable */
const REC_FALLBACK = {
  couple: "walker", suit_men: "walker", yahoo_boys: "walker", school_kids: "walker",
  student: "walker", clerk: "walker", mamas: "trader",
};

function makeCtl(rig, x, z, yaw) {
  return {
    rig, pos: { x, y: 0, z }, yaw: yaw || 0,
    state: "standing", onGround: true, level: 0, vel: { y: 0 },
    _intentSpeed: 0, _ul: () => {},
    _emoteTimer: 0, _emoteName: null, _emotePhase: 0,
    _useTimer: 0, _useBend: 0.30,
    weapons: null, held: null, phoneHold: false, sitTarget: null,
  };
}

let _onKillCb = null;

/* ── Smart hit reactions ──────────────────────────────────── */
function _getShooterPos() {
  try {
    const wc = window.__ph3d_walkCtrl;
    if (wc && wc.pos) return { x: wc.pos.x, z: wc.pos.z };
  } catch (e) {}
  try {
    const tp = window.__ph3d_tp;
    if (tp && tp.pos) return { x: tp.pos.x, z: tp.pos.z };
  } catch (e) {}
  try {
    const d = window.__ph3d_drive;
    if (d && d.getPos) { const p = d.getPos(); return { x: p.x, z: p.z }; }
  } catch (e) {}
  return null;
}

function _startHit(npc, opts) {
  if (!npc || npc.dead) return;
  const dur = opts.dur != null ? opts.dur : 0.4;
  npc.reaction = {
    timer: dur,
    totalDur: dur,
    next: opts.next || "flee",
    threatX: opts.threatX,
    threatZ: opts.threatZ,
    coverX: opts.coverX,
    coverZ: opts.coverZ,
    staggerX: opts.staggerX || 0,
    staggerZ: opts.staggerZ || 0,
  };
  npc.state = "react";
  npc.stateT = dur;
  npc.moveSpeed = 0;
}

function disposeTree(root) {
  if (!root) return;
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(m => m && m.dispose && m.dispose());
    }
  });
}

/* States driven by core/npc-social.js. These NPCs stop walking the
   path for a few seconds, then rejoin it. */
const STILL_STATES = new Set(["argue", "bless", "confront", "confronted"]);
const MOVE_STATES  = new Set(["investigate", "watch"]);

function rejoinPath(npc) {
  npc.pathU = nearestU(npc.path, npc.ctl.pos.x, npc.ctl.pos.z);
  const p = pointAtU(npc.path, npc.pathU);
  npc.ctl.pos.x = p.x;
  npc.ctl.pos.z = p.z;
  npc.lookX = npc.lookZ = null;
  npc.state = "idle";
  npc.stateT = rBetween(0.5, 1.5);
}

let _scene = null;
let _aabbs = [];
let _seats = [];
const HIP_H = 0.935;   /* matches animator HIP_HEIGHT */
_loadVoiceLines();
const _toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} };


/* ══ PATHFINDING ═══════════════════════════════════════════════════════════
   Grid A* over the solid boxes (_aabbs), then string-pulling so routes are
   long clean legs (no zig-zag), then curved following (see _stepToward).   */
const PF_CELL = 0.6, PF_PAD = 0.55, PF_MARGIN = 14, PF_MAX_SIDE = 110, PF_MAX_EXPAND = 9000;
let _pfFrameT = 0, _pfUsed = 0;

function _lineFree(x0, z0, x1, z1, pad) {
  if (!_aabbs || !_aabbs.length) return true;
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d / 0.35));
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    if (NPCs._insideAABB(x, z, _aabbs, pad)) return false;
  }
  return true;
}

function _heapPush(h, item) { h.push(item); let i = h.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } }
function _heapPop(h) { const top = h[0], last = h.pop(); if (h.length) { h[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < h.length && h[l][0] < h[m][0]) m = l; if (r < h.length && h[r][0] < h[m][0]) m = r; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; } } return top; }

/* returns [[x,z],…] waypoints (goal last) or null when unreachable / too far / out of budget */
function _findRoute(x0, z0, x1, z1) {
  if (_lineFree(x0, z0, x1, z1, PF_PAD - 0.05)) return [[x1, z1]];
  const now = performance.now();
  if (now - _pfFrameT > 12) { _pfFrameT = now; _pfUsed = 0; }
  if (_pfUsed >= 2) return undefined;                        /* over this frame's budget → try again next frame */
  _pfUsed++;
  const minX = Math.min(x0, x1) - PF_MARGIN, maxX = Math.max(x0, x1) + PF_MARGIN;
  const minZ = Math.min(z0, z1) - PF_MARGIN, maxZ = Math.max(z0, z1) + PF_MARGIN;
  if (maxX - minX > PF_MAX_SIDE || maxZ - minZ > PF_MAX_SIDE) return null;
  const W = Math.ceil((maxX - minX) / PF_CELL), H = Math.ceil((maxZ - minZ) / PF_CELL);
  const blocked = new Uint8Array(W * H);
  for (const b of _aabbs) {                                  /* rasterise solids once per query */
    const bx0 = b.x - b.hx - PF_PAD, bx1 = b.x + b.hx + PF_PAD, bz0 = b.z - b.hz - PF_PAD, bz1 = b.z + b.hz + PF_PAD;
    if (bx1 < minX || bx0 > maxX || bz1 < minZ || bz0 > maxZ) continue;
    const cx0 = Math.max(0, Math.floor((bx0 - minX) / PF_CELL)), cx1 = Math.min(W - 1, Math.floor((bx1 - minX) / PF_CELL));
    const cz0 = Math.max(0, Math.floor((bz0 - minZ) / PF_CELL)), cz1 = Math.min(H - 1, Math.floor((bz1 - minZ) / PF_CELL));
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) blocked[cz * W + cx] = 1;
  }
  const cellOf = (x, z) => [Math.min(W - 1, Math.max(0, Math.floor((x - minX) / PF_CELL))), Math.min(H - 1, Math.max(0, Math.floor((z - minZ) / PF_CELL)))];
  const nearestFree = (c) => {                               /* a start/goal inside a solid snaps to the closest open cell */
    if (!blocked[c[1] * W + c[0]]) return c;
    for (let r = 1; r <= 6; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const x = c[0] + dx, z = c[1] + dz;
      if (x >= 0 && z >= 0 && x < W && z < H && !blocked[z * W + x]) return [x, z];
    }
    return null;
  };
  const s = nearestFree(cellOf(x0, z0)), g = nearestFree(cellOf(x1, z1));
  if (!s || !g) return null;
  const gi = g[1] * W + g[0], si = s[1] * W + s[0];
  const gScore = new Float32Array(W * H).fill(1e9), from = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
  const heur = (i) => { const x = i % W, z = (i / W) | 0; const dx = Math.abs(x - g[0]), dz = Math.abs(z - g[1]); return (dx + dz) + (1.4142 - 2) * Math.min(dx, dz); };
  const open = []; gScore[si] = 0; _heapPush(open, [heur(si), si]);
  let expanded = 0, found = false;
  while (open.length && expanded++ < PF_MAX_EXPAND) {
    const [, i] = _heapPop(open);
    if (closed[i]) continue; closed[i] = 1;
    if (i === gi) { found = true; break; }
    const cx = i % W, cz = (i / W) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const ni = nz * W + nx;
      if (blocked[ni] || closed[ni]) continue;
      if (dx && dz && (blocked[cz * W + nx] || blocked[nz * W + cx])) continue;   /* no squeezing through diagonal gaps */
      const ng = gScore[i] + (dx && dz ? 1.4142 : 1);
      if (ng < gScore[ni]) { gScore[ni] = ng; from[ni] = i; _heapPush(open, [ng + heur(ni), ni]); }
    }
  }
  if (!found) return null;
  let pts = [], k = gi;
  while (k !== -1) { pts.push([minX + ((k % W) + 0.5) * PF_CELL, minZ + (((k / W) | 0) + 0.5) * PF_CELL]); k = from[k]; }
  pts.reverse(); pts[0] = [x0, z0];
  if (_lineFree(pts[pts.length - 1][0], pts[pts.length - 1][1], x1, z1, 0.3)) pts.push([x1, z1]);
  /* string-pull: keep only the corners that matter */
  const out = []; let a = 0;
  while (a < pts.length - 1) {
    let b = pts.length - 1;
    while (b > a + 1 && !_lineFree(pts[a][0], pts[a][1], pts[b][0], pts[b][1], PF_PAD - 0.1)) b--;
    out.push(pts[b]); a = b;
  }
  return out;
}

export const NPCs = {
  list: [],

  setScene(scene) {
    _scene = scene;
  },

  aabbs() { return _aabbs; },

  setAABBs(aabbs) {
    _aabbs = aabbs || [];
  },
  setTerrain(groundAt, bounds) { this._groundAt = groundAt || null; this._bounds = bounds || null; },

  /* Seat list from the interior world ({type:'sit', x, z, yaw, h, level, taken}). */
  setSeats(seats) { _seats = seats || []; },

  onKill(fn) { _onKillCb = fn; },

  /* Public entry point used by interior-npcs.js.
     Sets _scene (and optionally _aabbs) then delegates to _spawnRole. */
  spawnRole(scene, role, x, z, opts) {
    opts = opts || {};
    if (scene) _scene = scene;
    if (opts.aabbs) _aabbs = opts.aabbs;
    try { Lives.setHost(this); } catch (e) {}      /* people have lives inside buildings too (dating works anywhere) */
    return this._spawnRole(x, z, role, opts);
  },

  spawn(scene, opts) {
    opts = opts || {};
    _scene = scene;
    try { Lives.setHost(this); Lives.city(true); } catch (e) { console.warn("[lives]", e); }
    _aabbs = opts.aabbs || [];

    const quality = Quality.isPotato ? 0.3 : Quality.isLow ? 0.45 : Quality.isHigh ? 1.0 : 0.72;

    for (const path of NPC_PATHS) {
      const groupsList = path.groups || [{ type: "solo", count: 1, weight: 1 }];
      const pool = [];
      for (const g of groupsList) {
        for (let w = 0; w < (g.weight || 1); w++) pool.push(g);
      }
      const basePerPath = Quality.isPotato ? 2 : Quality.isLow ? 3 : 7;
      const groupCount = Math.max(1, Math.round(basePerPath * quality));

      for (let i = 0; i < groupCount; i++) {
        const chosen = pool[Math.floor(rnd() * pool.length)];
        this._spawnGroupOnPath(path, chosen.type, chosen.count);
      }
      /* kids are part of every street, not only the school routes */
      if (!Quality.isPotato) this._spawnGroupOnPath(path, "school_kids", Quality.isLow ? 1 : 2);
    }

    if (opts.roleSpots) {
      const SPOTS = [
        { id: "market",       roles: ["trader", "trader"] },
        { id: "hospital",     roles: ["doctor"] },
        { id: "church",       roles: ["priest"] },
        { id: "mosque",       roles: ["priest"] },
        { id: "jobcenter",    roles: ["banker"] },
        { id: "pleasurepark", roles: ["taxi"] },
        { id: "university",   roles: ["banker"] },
        { id: "showroom",     roles: ["mechanic"] },
        { id: "govhouse",     roles: ["police"] },
      ];
      for (const spot of SPOTS) {
        const c = opts.roleSpots.find(p => (p.lm && p.lm.id === spot.id) || p.id === spot.id);
        if (!c) continue;
        for (const role of spot.roles) {
          const free = this._freeSpot(c.x, c.z, 20, 40);
          if (free) this._spawnRole(free.x, free.z, role);
        }
      }
    }

    console.log(
      "%c[npcs]",
      "background:#9dffb0;color:#0a2010;font-weight:bold;padding:2px 6px;border-radius:4px",
      this.list.length + " NPCs (" + this.list.filter(n => n.groupTag).length + " grouped, " +
      this.list.filter(n => !n.groupTag).length + " solo/role)"
    );
  },

  _spawnGroupOnPath(path, groupType, wantedCount) {
    const group = buildGroup(groupType);
    const members = group.members.slice(0, Math.max(1, wantedCount || group.members.length));

    /* Spread pedestrian groups along the full street network instead of
       repeatedly choosing nearby points. Sample several positions on this
       route and use the one farthest from already-spawned NPCs. This keeps
       each district populated without creating one dense crowd hotspot. */
    let startU = rnd();
    let bestSpacing = -1;
    for (let sample = 0; sample < 28; sample++) {
      const candidateU = rnd();
      const candidate = pointAtU(path, candidateU);
      let nearest = Infinity;
      for (const other of this.list) {
        if (!other || other.dead || !other.ctl || !other.ctl.pos) continue;
        const dx = other.ctl.pos.x - candidate.x;
        const dz = other.ctl.pos.z - candidate.z;
        const d = Math.hypot(dx, dz);
        if (d < nearest) nearest = d;
      }
      /* The first group has no neighbours, so retain its random route point. */
      const spacing = Number.isFinite(nearest) ? nearest : 1e6;
      if (spacing > bestSpacing) {
        bestSpacing = spacing;
        startU = candidateU;
      }
      if (spacing >= 24) break;
    }
    const tangentRef = pointAtU(path, startU);
    const baseYaw = Math.atan2(tangentRef.tx, tangentRef.tz);

    for (const m of members) {
      const c = Math.cos(baseYaw), s = Math.sin(baseYaw);
      const ox = m.offset[0] * c + m.offset[1] * s;
      const oz = -m.offset[0] * s + m.offset[1] * c;

      const anchor = pointAtU(path, startU);
      let x = anchor.x + ox;
      let z = anchor.z + oz;

      if (this._insideAABB(x, z, _aabbs, 1.0)) {
        const pushed = this._pushOut(x, z, _aabbs, 1.0);
        x = pushed[0]; z = pushed[1];
        if (this._insideAABB(x, z, _aabbs, 0.6)) {
          console.warn("[npcs] dropped " + groupType + " member buried in a wall");
          continue;
        }
      }

      if (this.list.length > 0) {
        let tooClose = false;
        for (const other of this.list) {
          const dxo = other.ctl.pos.x - x;
          const dzo = other.ctl.pos.z - z;
          /* Allow members of a single group to stand together, but prevent
             separate groups/archetypes from occupying the same pavement. */
          const sameGroup = other.groupTag === groupType &&
            Math.hypot(other.ctl.pos.x - tangentRef.x, other.ctl.pos.z - tangentRef.z) < 5;
          const minGap = sameGroup ? 1.8 : 3.8;
          if (dxo * dxo + dzo * dzo < minGap * minGap) { tooClose = true; break; }
        }
        if (tooClose) continue;
      }

      const jitter = (Math.random() - 0.5) * 0.4;

      const npc = this._build(x, z, "walker", path, startU + jitter / 100, m.config);
      if (!npc) continue;

      npc.groupTag = groupType;
      npc.groupLabel = group.label;
      npc.yawTarget = baseYaw + m.yawOffset;
      npc.ctl.yaw = npc.yawTarget;
      npc.pathU = startU + jitter / 100;

      this.list.push(npc);
    }
  },

  _spawnRole(x, z, role, opts) {
    opts = opts || {};
    if (!_scene) {
      console.warn("[npcs] _spawnRole: no _scene set — call setScene() or spawn() first");
      return null;
    }
    const yOff = opts.yOffset || 0;
    const def = ROLE_PATHS[role] || ROLE_PATHS.walker;
    const worldPoints = def.points.map(pt => [x + pt[0], z + pt[1]]);
    const path = {
      id: "role:" + role + ":" + Math.random().toString(36).slice(2, 6),
      closed: def.closed,
      speed: def.speed,
      points: worldPoints,
    };
    const u = rnd();
    const p = pointAtU(path, u);
    const npc = this._build(p.x, p.z, role, path, u, opts.forcedConfig);
    if (npc) {
      npc.stationary = true;
      npc.homeX = x;
      npc.homeZ = z;
      npc.state  = "idle";
      npc.stateT = rBetween(0.3, 2.5);   /* short first idle -> they start strolling quickly */
      npc.ctl.pos.x = x;
      npc.ctl.pos.z = z;
      npc.ctl.pos.y = yOff;
      npc.group.position.set(x, yOff, z);
      this.list.push(npc);
    }
    return npc;
  },

  /* ── Push a point out of every AABB it's currently inside. ─────
     Returns [x, z, ok]. ok=false only if a corner-trap defeated
     all 8 iterations — the point is still moved as far as possible. */
  _pushOut(x, z, aabbs, pad) {
    if (!aabbs || !aabbs.length) return [x, z, true];
    pad = pad == null ? 0.4 : pad;
    for (let iter = 0; iter < 8; iter++) {
      let anyCollision = false;
      for (const b of aabbs) {
        if (x <= b.x - b.hx - pad || x >= b.x + b.hx + pad ||
            z <= b.z - b.hz - pad || z >= b.z + b.hz + pad) continue;
        anyCollision = true;
        const dl = x - (b.x - b.hx - pad);
        const dr = (b.x + b.hx + pad) - x;
        const db = z - (b.z - b.hz - pad);
        const dtop = (b.z + b.hz + pad) - z;
        const m = Math.min(dl, dr, db, dtop);
        if      (m === dl) x = b.x - b.hx - pad;
        else if (m === dr) x = b.x + b.hx + pad;
        else if (m === db) z = b.z - b.hz - pad;
        else               z = b.z + b.hz + pad;
      }
      if (!anyCollision) return [x, z, true];
    }
    return [x, z, false];
  },

  /* ── Safety net called once per frame from interior.js ──────── */
  unstickAll(aabbs) {
    if (!aabbs || !aabbs.length) return;
    for (let i = 0; i < this.list.length; i++) {
      const npc = this.list[i];
      if (npc.dead) continue;
      if (npc.state === "downed" || npc.state === "sitting") continue; // on the floor / on a seat
      const pos = npc.ctl.pos;
      const [nx, nz] = this._pushOut(pos.x, pos.z, aabbs, 0.45);
      if (nx !== pos.x || nz !== pos.z) {
        pos.x = nx;
        pos.z = nz;
        npc.group.position.x = nx;
        npc.group.position.z = nz;
      }
    }
  },

  _build(x, z, role, path, startU, forcedConfig) {
    if (!_scene) return null;

    /* Push out of any AABB first — the base spot or the "random free
       spot" may both overlap walls / furniture after the denser spawn. */
    {
      const pushed = this._pushOut(x, z, _aabbs, 0.45);
      x = pushed[0]; z = pushed[1];
    }

    const cfg = withPlayerLook(forcedConfig || uniformFor(role) || randomConfig());
    const built = buildCharacter(cfg);
    const group = built.root;
    const rig = built.rig;
    const yaw = Math.atan2(0, 1);
    group.position.set(x, 0, z);
    group.rotation.y = yaw;
    _scene.add(group);

    const ctl = makeCtl(rig, x, z, yaw);

    const npc = {
      id: "npc_" + Math.random().toString(36).slice(2, 8),
      group, rig, ctl,
      role,
      roleDef: ROLES[role] || ROLES.walker,
      path,
      pathU: startU,
      pathDir: rnd() < 0.5 ? 1 : -1,
      speedMult: rBetween(0.85, 1.15),
      state: "walk",
      stateT: rBetween(3, 8),
      moveSpeed: 0,
      yawTarget: yaw,
      talkCd: 0,
      hitCd: 0,
      age: 0,
      hp: 60,
      dead: false,
      deadT: 0,
      maxDist: 32,
      groupTag: null,
      groupLabel: null,
      _cfg: cfg,
    };

    try { Animator.animate(ctl, 0.016); } catch (e) {}
    return npc;
  },

  /* ── lives helpers ── */
  _reskin(npc, cfg) {
    if (!_scene || !cfg || !npc.group) return;
    withPlayerLook(cfg);
    const old = npc.group, built = buildCharacter(cfg), g = built.root;
    g.position.copy(old.position); g.rotation.copy(old.rotation); g.visible = old.visible;
    _scene.add(g);
    if (old.parent) old.parent.remove(old);
    disposeTree(old);
    npc.group = g; npc.rig = built.rig; npc.ctl.rig = built.rig; npc._cfg = cfg; npc._tag = null;
    try { Animator.animate(npc.ctl, 0.016); } catch (e) {}
  },
  _lifeShow(npc, px, pz) {
    let x = npc.ctl.pos.x, z = npc.ctl.pos.z;
    if (npc.stationary && npc.homeX != null) { x = npc.homeX; z = npc.homeZ; }
    else if (npc.path) {
      let bd = 1e9;
      for (let k = 0; k < 14; k++) {
        const u = rnd(), pp = pointAtU(npc.path, u), d = Math.hypot(pp.x - px, pp.z - pz);
        if (d > 22 && d < 150 && d < bd) { bd = d; npc.pathU = u; x = pp.x; z = pp.z; }
      }
    }
    npc.ctl.pos.x = x; npc.ctl.pos.z = z; npc.group.position.set(x, npc._baseY || 0, z); npc.group.visible = true;
  },
  _despawnOne(n) {
    const i = this.list.indexOf(n); if (i < 0) return;
    try { Lives.unbind(n); } catch (e) {}
    if (n.group && n.group.parent) n.group.parent.remove(n.group);
    disposeTree(n.group); this.list.splice(i, 1);
  },

  _freeSpot(cx, cz, minR, maxR) {
    for (let i = 0; i < 40; i++) {
      const a = rnd() * TAU;
      const r = minR + rnd() * (maxR - minR);
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      if (!this._insideAABB(x, z, _aabbs, 1.0)) return { x, z };
    }
    return null;
  },

  /* ── WALL-AWARE STEERING ─────────────────────────────────────
     NPCs look AHEAD (about 1 m) before every step, so they turn away from a
     wall long before touching it, instead of walking in and being pushed out. */
  _free(x, z, pad) { return !(_aabbs && _aabbs.length && this._insideAABB(x, z, _aabbs, pad)); },

  /* Smart walking: A* route around solids + curved pure-pursuit steering.
     Returns true while making progress, false when boxed in / unreachable. */
  _stepToward(npc, dx, dz, sp, dt) {
    const dist = Math.hypot(dx, dz);
    if (dist < 1e-4) return false;
    const px = npc.ctl.pos.x, pz = npc.ctl.pos.z;
    const k = dist < 1.01 ? 10 : 1;                           /* unit vectors (flee) = "somewhere 10 m that way" */
    const tx = px + dx * k, tz = pz + dz * k;
    const rt = npc._rt;
    const now = performance.now();
    if (!rt || Math.hypot(rt.tx - tx, rt.tz - tz) > 1.5 || now > rt.until) {
      const pts = _findRoute(px, pz, tx, tz);
      if (pts === undefined) { if (!rt) return false; }       /* path budget used: keep old route this frame */
      else if (pts === null) {
        /* unreachable: slide along whatever is open instead of freezing against the wall */
        npc._rt = { tx, tz, pts: [[tx, tz]], i: 0, until: now + 1500, lastD: 1e9, stuck: 0, direct: true };
      } else npc._rt = { tx, tz, pts, i: 0, until: now + 6000, lastD: 1e9, stuck: 0 };
    }
    const r = npc._rt; if (!r) return false;
    while (r.i < r.pts.length - 1 && Math.hypot(r.pts[r.i][0] - px, r.pts[r.i][1] - pz) < 0.9) r.i++;
    /* aim a little past the current corner so turns are arcs, not pivots */
    const w = r.pts[r.i], w2 = r.pts[Math.min(r.i + 1, r.pts.length - 1)];
    const dw = Math.hypot(w[0] - px, w[1] - pz);
    const bl = r.i < r.pts.length - 1 ? Math.max(0, 1 - dw / 2.2) * 0.55 : 0;
    const ax = w[0] + (w2[0] - w[0]) * bl - px, az = w[1] + (w2[1] - w[1]) * bl - pz;
    const want = Math.atan2(ax, az);
    if (npc._hd === undefined) npc._hd = want;
    let da = Math.atan2(Math.sin(want - npc._hd), Math.cos(want - npc._hd));
    const maxTurn = 3.6 * dt;                                 /* smooth turning rate → curvy paths */
    npc._hd += Math.max(-maxTurn, Math.min(maxTurn, da));
    const base = npc._hd;
    const offs = [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4];
    if (npc._steerSide) offs.sort((a, b) => (Math.sign(b) === npc._steerSide) - (Math.sign(a) === npc._steerSide));
    for (const o of offs) {
      const a = base + o, fx = Math.sin(a), fz = Math.cos(a);
      if (!this._free(px + fx * 0.6, pz + fz * 0.6, 0.5)) continue;
      if (!this._free(px + fx * 1.1, pz + fz * 1.1, 0.5)) continue;
      const nx = px + fx * sp * dt, nz = pz + fz * sp * dt;
      if (!this._free(nx, nz, 0.42)) continue;
      npc.ctl.pos.x = nx; npc.ctl.pos.z = nz;
      npc.yawTarget = a; npc.moveSpeed = sp;
      npc._steerSide = o !== 0 ? Math.sign(o) : 0;
      /* progress watchdog: no real progress for ~1.5 s → throw the route away and replan */
      const dGoal = Math.hypot(tx - nx, tz - nz);
      if (dGoal < r.lastD - 0.3) { r.lastD = dGoal; r.stuck = 0; r.t0 = now; }
      else if (!r.t0) r.t0 = now;
      else if (now - r.t0 > 1500) { npc._rt = null; npc._hd = undefined; }
      return true;
    }
    npc.moveSpeed = 0;                                        /* boxed in: wait, never push into the wall */
    if (!r.boxT) r.boxT = now; else if (now - r.boxT > 700) { npc._rt = null; npc._hd = undefined; }
    return false;
  },

  _insideAABB(x, z, aabbs, pad) {
    if (!aabbs) return false;
    pad = pad || 0;
    for (const b of aabbs) {
      if (x > b.x - b.hx - pad && x < b.x + b.hx + pad &&
          z > b.z - b.hz - pad && z < b.z + b.hz + pad) return true;
    }
    return false;
  },

  /* A performer (flip, trick…) at (x,z): nearby calm NPCs come over, ring them and applaud. */
  audience(x, z, radius, secs) {
    radius = radius || 20; secs = secs || 8;
    const calm = new Set(["idle", "walk", "stroll", "talk"]);
    const cands = this.list.filter((n) => !n.dead && calm.has(n.state) && !n.stationaryInterior &&
      Math.hypot(n.ctl.pos.x - x, n.ctl.pos.z - z) < radius)
      .sort((p, q) => Math.hypot(p.ctl.pos.x - x, p.ctl.pos.z - z) - Math.hypot(q.ctl.pos.x - x, q.ctl.pos.z - z))
      .slice(0, 10);
    const n = cands.length;
    cands.forEach((npc, i) => {
      const ang = (i / Math.max(n, 1)) * Math.PI * 2 + 0.4, r = 2.6 + (i % 2) * 0.9;
      let tx = x + Math.cos(ang) * r, tz = z + Math.sin(ang) * r;
      if (_aabbs && this._insideAABB(tx, tz, _aabbs, 0.6)) { tx = x + Math.cos(ang) * 2.0; tz = z + Math.sin(ang) * 2.0; }
      npc.cheerX = tx; npc.cheerZ = tz; npc.cheerCX = x; npc.cheerCZ = z;
      npc.state = "cheer"; npc.stateT = secs + i * 0.15; npc._rt = null; npc.reaction = null;
    });
    return n;
  },

  nearest(x, z, maxDist) {
    let best = null, bestD = maxDist * maxDist;
    for (const npc of this.list) {
      if (npc.dead || npc._lifeHidden) continue;
      const dx = npc.ctl.pos.x - x;
      const dz = npc.ctl.pos.z - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = npc; }
    }
    return best;
  },

  talk(npc) {
    if (!npc || npc.talkCd > 0) return;
    npc.talkCd = 1.5;
    npc.state = "talk";
    npc.stateT = 4.0;
    npc.moveSpeed = 0;

    const wc = window.__ph3d_walkCtrl;
    const px = wc ? wc.pos.x : npc.ctl.pos.x + 1;
    const pz = wc ? wc.pos.z : npc.ctl.pos.z;
    const dx = px - npc.ctl.pos.x;
    const dz = pz - npc.ctl.pos.z;
    if (dx * dx + dz * dz > 0.01) npc.yawTarget = Math.atan2(dx, dz);

    const def = npc.groupTag && ROLES[npc.groupTag] ? ROLES[npc.groupTag] : npc.roleDef;
    /* pick a line (and its recording, if you supplied one) that suits this NPC */
    const all = def._entries || def.dialogue.map(text => ({ text }));
    const g = npc._cfg && npc._cfg.gender;
    let pool = all.filter(e => !e.gender || !g || g === "neutral" || e.gender === g);
    if (!pool.length) pool = all;
    /* If the phone can't speak text aloud, only show lines that HAVE a recording,
       so every bubble you see is a bubble you can hear. Roles with no recordings
       borrow a fitting role's recorded lines (REC_FALLBACK). */
    if (!Sfx.canSpeak()) {
      const rk0 = npc.groupTag && ROLES[npc.groupTag] ? npc.groupTag : npc.role;
      let rec = pool.filter(e => e.file);
      if (!rec.length) {
        const fb = ROLES[REC_FALLBACK[rk0]];
        rec = fb && fb._entries ? fb._entries.filter(e => e.file && (!e.gender || !g || g === "neutral" || e.gender === g)) : [];
      }
      if (rec.length) pool = rec;
    }
    const entry = pick(pool);
    const line = entry.text;
    const label = npc.groupLabel || def.label;
    const showLine = () => {
      const plain = () => _toast(label + ": \u201C" + line + "\u201D");
      if (!npc._life) return plain();
      import("../ui/talk-chat.js").then((m) => m.TalkChat.receive(npc, line, { silent: true })).catch(plain);
    };
    /* Speak EXACTLY the line shown in the bubble, in this NPC's own voice. */
    try {
      const rk = npc.groupTag && ROLES[npc.groupTag] ? npc.groupTag : npc.role;
      Sfx.say(line, {
        file: entry.file,
        /* no distance fade: you pressed TALK, so the line must always be heard */
        who: npc.id, role: rk, gender: npc._cfg && npc._cfg.gender,
      });
    } catch (e) {}

    const act = def.action;
    if (act === "banker") setTimeout(() => { try { window.__ph3d_phone?.showApp("bank"); } catch (e) {} }, 600);
    else if (act === "trader") setTimeout(() => { try { window.__ph3d_phone?.showApp("shop"); } catch (e) {} }, 600);
    else if (act === "doctor") setTimeout(() => { try { const C = window.__ph3d_combat; if (C && C.heal) { C.heal(25); _toast("Doctor patched you up \u00b7 +25 HP"); } } catch (e) {} }, 700);
    else if (act === "mechanic") setTimeout(() => { try { const C = window.__ph3d_combat; if (C && C.heal) { C.heal(15); _toast("Mechanic tuned you up \u00b7 +15 HP"); } } catch (e) {} }, 700);
    else if (act === "priest") setTimeout(() => { try { const C = window.__ph3d_combat; if (C && C.heal) { C.heal(10); _toast("Blessing \u00b7 +10 HP"); } } catch (e) {} }, 800);
    else if (act === "police") { /* decay is driven by the router loop */ }
    try { Lives.onTalk(npc); } catch (e) { console.warn("[lives]", e); }      /* claims the NPC + opens the chat */
    showLine();   /* greeting bubble (or a toast if the NPC has no life record) */
    return npc;
  },

  scare(x, z, radius) {
    radius = radius || 15;
    let anyScared = false;
    let _fled = 0;
    for (const npc of this.list) {
      if (npc.dead) continue;
      const dx = npc.ctl.pos.x - x;
      const dz = npc.ctl.pos.z - z;
      if (dx * dx + dz * dz < radius * radius && npc.state !== "talk" && npc.state !== "wrestled") {
        npc.state = "flee";
        npc.stateT = rBetween(2, 3.5);
        anyScared = true;
        _fled++;
        if (npc.role !== "police" && Math.random() < 0.25) {
          try { Sfx.voice("scream_short", { x: npc.ctl.pos.x, z: npc.ctl.pos.z, maxRange: 25, gender: npc._cfg && npc._cfg.gender }); } catch (e) {}
        }
      }
    }
    if (anyScared && _fled >= 3) {
      try { Sfx.voice("crowd", { x, z, maxRange: 30 }); } catch (e) {}   /* a crowd reacts together */
    }
    if (anyScared) {
      try {
        const Cr = window.__ph3d_crime;
        if (Cr && Cr.addEvent) Cr.addEvent("attack", 25, "You");
      } catch (e) {}
    }
  },

  /* ── Weapons support ───────────────────────────────────────
     Weapons (guns.js / knife.js) hit objects shaped like
     { x, z, alive, hp, onHit(dmg, type) }.  Each NPC gets one
     cached, live-position target. */
  targets(px, pz, range) {
    range = range || 80;
    const out = [];
    for (const npc of this.list) {
      if (npc.dead || npc._lifeHidden) continue;
      const dx = npc.ctl.pos.x - px, dz = npc.ctl.pos.z - pz;
      if (dx * dx + dz * dz > range * range) continue;
      if (!npc._tgt) {
        const self = this;
        npc._tgt = {
          get x() { return npc.ctl.pos.x; },
          get z() { return npc.ctl.pos.z; },
          get y() { return npc.group.position.y || 0; },
          get alive() { return !npc.dead; },
          hp: npc.hp,
          _npc: npc,
          onHit(dmg, type, part) { self._onHit(npc, dmg, type, { part }); },
        };
      }
      out.push(npc._tgt);
    }
    return out;
  },

  /* ── Wrestling: the NPC's "opposite action" ──────────────────
     wrestleHold   – grab the NPC, pull it in front of the attacker and
                     start the matching victim animation (vic_<move>)
     wrestleFinish – called at the impact moment, after damage; puts the
                     NPC on the ground unless it already died            */
  wrestleHold(tgt, move, ax, az) {
    const npc = tgt && tgt._npc;
    const em = Animator.EMOTES[victimEmoteName(move)];
    if (!npc || npc.dead || !em || !VICTIM_MOVES[move]) return false;
    if (npc.state === "downed" || npc.state === "dying" || npc.state === "dead") return false;
    try {
      const yaw = Math.atan2(ax - npc.ctl.pos.x, az - npc.ctl.pos.z);
      const reach = (WRESTLING_MOVES[move] && WRESTLING_MOVES[move].reach) || 1.2;
      npc.ctl.pos.x = ax - Math.sin(yaw) * reach * 0.5;
      npc.ctl.pos.z = az - Math.cos(yaw) * reach * 0.5;
      npc.ctl.yaw = yaw + Math.PI;
    } catch (e) {}
    npc.reaction = null;
    npc.wrestle = { move, ax, az };
    npc.state = "wrestled";
    npc.stateT = em.dur / EMOTE_SPEED + 1.0;      /* failsafe */
    npc.moveSpeed = 0;
    npc.ctl._emoteName = victimEmoteName(move);
    npc.ctl._emoteTimer = em.dur;
    npc.ctl._emotePhase = 0;
    return true;
  },

  /* let go of a held NPC without knocking it down (clinch ended / shoved off) */
  wrestleRelease(tgt) {
    const npc = tgt && tgt._npc;
    if (!npc || npc.dead || npc.state === "dying" || npc.state === "dead") return;
    npc.wrestle = null; npc.reaction = null;
    npc.ctl._emoteTimer = 0; npc.ctl._emoteName = null;
    npc.state = "flee"; npc.stateT = 2.5;
  },

  wrestleFinish(tgt, move) {
    const npc = tgt && tgt._npc;
    if (!npc) return;
    if (npc.dead || npc.state === "dying" || npc.state === "dead") {
      npc.ctl._emoteTimer = 0; npc.ctl._emoteName = null; return;
    }
    npc.wrestle = null;
    npc.reaction = null;
    npc.state = "downed";                         /* knocked to the ground */
    npc.stateT = 3.5;
    npc.moveSpeed = 0;
    /* …and it gets back up to fight: pursuit.js takes the body over */
    try { if (Pursuit.canFightBack(npc)) Pursuit.start(npc); } catch (e) { console.warn("[pursuit]", e); }
  },

  _onHit(npc, dmg, type, opts) {
    if (!npc || npc.dead) return;
    if (!(opts && opts.by === "companion")) npc._hitAt = performance.now();     /* family joins fights you start */
    const tgt = npc._tgt;
    npc.hp = tgt ? tgt.hp : npc.hp - dmg;
    npc.hitCount = (npc.hitCount || 0) + 1;
    npc.wounded = npc.hp < (npc.maxHp || 60) * 0.4;

    let shooter = (opts && opts.shooter) || _getShooterPos();
    const shooterX = shooter ? shooter.x : null;
    const shooterZ = shooter ? shooter.z : null;

    const px = npc.ctl.pos.x, pz = npc.ctl.pos.z;
    try { Blood.spray(_scene, px, 1.2, pz, { count: 18, spread: 3 }); } catch (e) {}

    const part = (opts && opts.part) || "torso";
    try {
      const gen = npc._cfg && npc._cfg.gender;
      if (npc.hp > 0) Sfx.pain(dmg >= 25 || part === "head" ? "heavy" : dmg >= 10 ? "medium" : "light", { x: px, z: pz, gender: gen, who: npc.id || "", maxRange: 25 });
    } catch (e) {}
    if (part === "leg" || part === "foot") npc.crippled = true;
    if (part === "arm") npc.disarmed = true;
    const headSurvivor = (part === "head" && npc.hp > 0);

    const Cr = window.__ph3d_crime;

    if (npc.hp <= 0) {
      this._kill(npc);
      try { if (Cr && Cr.addEvent) Cr.addEvent("kill", 100, "You"); } catch (e) {}
      this._scareNearby(px, pz, shooterX, shooterZ, 10);
      return;
    }

    if (Cr && Cr.addEvent) {
      try { Cr.addEvent("attack", type === "knife" ? 22 : 30, "You"); } catch (e) {}
    }

    try {
      const So = window.__ph3d_social;
      if (So) So.onCrime(px, pz, type === "knife" ? "knife" : "gun");
    } catch (e) {}

    if (npc.state === "downed") { this._scareNearby(px, pz, shooterX, shooterZ, 10); return; }

    const awayRawX = px - (shooterX != null ? shooterX : px);
    const awayRawZ = pz - (shooterZ != null ? shooterZ : pz);
    const awLen = Math.hypot(awayRawX, awayRawZ) || 1;
    const nAx = awayRawX / awLen;
    const nAz = awayRawZ / awLen;

    const hpFrac      = npc.hp / (npc.maxHp || 60);
    const isSniper    = (opts && opts.sniper) || dmg >= 55;
    const nearDeath   = npc.hp < 12;
    const isPolice    = npc.role === "police";

    /* provoked civilians don't hesitate: they fight back immediately */
    if (!isPolice && !isSniper && !headSurvivor) {
      let fought = false;
      try { if (Pursuit.canFightBack(npc)) fought = Pursuit.start(npc, { instant: true }); } catch (e) { console.warn("[pursuit]", e); }
      if (fought) { this._scareNearby(px, pz, shooterX, shooterZ, 10); return; }
    }

    if (headSurvivor || isSniper || nearDeath) {
      _startHit(npc, {
        next: "downed", dur: headSurvivor ? 0.75 : 0.55,
        threatX: shooterX, threatZ: shooterZ,
        staggerX: nAx * (headSurvivor ? 1.2 : 1.0),
        staggerZ: nAz * (headSurvivor ? 1.2 : 1.0),
      });
    } else if (isPolice) {
      _startHit(npc, {
        next: "investigate", dur: 0.30,
        threatX: shooterX, threatZ: shooterZ,
        staggerX: nAx * 0.4, staggerZ: nAz * 0.4,
      });
    } else if (hpFrac < 0.5 || npc.crippled) {
      const cover = this._findCoverSpot(npc, shooterX, shooterZ);
      if (cover) {
        _startHit(npc, {
          next: "cover", dur: 0.4,
          threatX: shooterX, threatZ: shooterZ,
          coverX: cover.x, coverZ: cover.z,
          staggerX: nAx, staggerZ: nAz,
        });
      } else {
        _startHit(npc, {
          next: "flee", dur: 0.4,
          threatX: shooterX, threatZ: shooterZ,
          staggerX: nAx, staggerZ: nAz,
        });
      }
    } else {
      const roll = Math.random();
      if (roll < 0.40) {
        _startHit(npc, { next: "flee", dur: 0.35,
          threatX: shooterX, threatZ: shooterZ,
          staggerX: nAx, staggerZ: nAz });
      } else if (roll < 0.85) {
        const cover = this._findCoverSpot(npc, shooterX, shooterZ);
        if (cover) {
          _startHit(npc, { next: "cover", dur: 0.4,
            threatX: shooterX, threatZ: shooterZ,
            coverX: cover.x, coverZ: cover.z,
            staggerX: nAx, staggerZ: nAz });
        } else {
          _startHit(npc, { next: "cower", dur: 0.5,
            threatX: shooterX, threatZ: shooterZ,
            staggerX: nAx * 0.5, staggerZ: nAz * 0.5 });
        }
      } else {
        _startHit(npc, { next: "cower", dur: 0.5,
          threatX: shooterX, threatZ: shooterZ,
          staggerX: nAx * 0.5, staggerZ: nAz * 0.5 });
      }
    }

    this._scareNearby(px, pz, shooterX, shooterZ, 10);
  },

  _findCoverSpot(npc, shooterX, shooterZ) {
    if (!_aabbs || _aabbs.length === 0) return null;
    if (shooterX == null || shooterZ == null) return null;

    const dx = npc.ctl.pos.x - shooterX;
    const dz = npc.ctl.pos.z - shooterZ;
    const len = Math.hypot(dx, dz) || 1;
    const awayX = dx / len, awayZ = dz / len;

    let best = null, bestDist = 25;
    for (const b of _aabbs) {
      if (!b || !b.hx || !b.hz) continue;
      const cx = b.x - shooterX, cz = b.z - shooterZ;
      const cl = Math.hypot(cx, cz);
      if (cl < 2 || cl > 30) continue;
      const dot = (cx / cl) * awayX + (cz / cl) * awayZ;
      if (dot < 0.45) continue;
      const px = b.x - npc.ctl.pos.x, pz = b.z - npc.ctl.pos.z;
      const d = Math.hypot(px, pz);
      if (d < 1.2 || d > bestDist) continue;
      const halfExt = Math.max(b.hx || 0.5, b.hz || 0.5);
      const standX = b.x + awayX * (halfExt + 0.9);
      const standZ = b.z + awayZ * (halfExt + 0.9);
      if (this._insideAABB(standX, standZ, _aabbs, 0.4)) continue;
      best = { x: standX, z: standZ };
      bestDist = d;
    }
    return best;
  },

  _scareNearby(x, z, shooterX, shooterZ, radius) {
    const r2 = radius * radius;
    const shooterOk = shooterX != null && shooterZ != null;
    for (const npc of this.list) {
      if (npc.dead) continue;
      const st = npc.state;
      if (st === "react" || st === "downed" || st === "cover" || st === "cower" || st === "wrestled") continue;
      const dx = npc.ctl.pos.x - x, dz = npc.ctl.pos.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2 || d2 < 0.01) continue;

      if (npc.role === "police") {
        npc.state = "investigate";
        npc.investigateX = shooterOk ? shooterX : x;
        npc.investigateZ = shooterOk ? shooterZ : z;
        npc.lookX = npc.investigateX;
        npc.lookZ = npc.investigateZ;
        npc.stateT = 10;
        continue;
      }
      if (st === "flee") continue;

      const sdx = npc.ctl.pos.x - (shooterOk ? shooterX : x);
      const sdz = npc.ctl.pos.z - (shooterOk ? shooterZ : z);
      const sl = Math.hypot(sdx, sdz) || 1;
      _startHit(npc, {
        next: "flee", dur: 0.25,
        threatX: shooterOk ? shooterX : x,
        threatZ: shooterOk ? shooterZ : z,
        staggerX: (sdx / sl) * 0.6,
        staggerZ: (sdz / sl) * 0.6,
      });
    }
  },

  _kill(npc) {
    if (!npc || npc.dead) return;
    if (npc.seatTarget) { npc.seatTarget.taken = false; npc.seatTarget = null; }
    npc.dead = true;
    npc.deadT = 0;
    npc.hp = 0;
    npc.state = "dying";          /* animated fall, then "dead" */
    npc.dyingPhase = 0;
    npc._deathDir = Math.random() < 0.5 ? -1 : 1;
    /* fall toward open space (never into a wall) and remember the real floor height (never into the floor) */
    try {
      const yaw = npc.ctl.yaw || 0;
      const f = pickFall(npc.ctl.pos.x, npc.ctl.pos.z, yaw, (x, z) => this._free(x, z, 0.12));
      npc._fall = f; npc._deathYaw = yaw;
      npc.ctl.pos.x = f.x; npc.ctl.pos.z = f.z;
      npc.group.position.x = f.x; npc.group.position.z = f.z;
    } catch (e) { npc._fall = null; }
    npc._deathY = npc.ctl.pos.y || npc._baseY || 0;
    npc.moveSpeed = 0;
    npc.wrestle = null;
    try { Lives.onDeath(npc); } catch (e) {}
    if (npc.ctl) { npc.ctl._emoteTimer = 0; npc.ctl._emoteName = null; }
    try { Blood.splat(_scene, npc.ctl.pos.x, npc.ctl.pos.z); } catch (e) {}
    try { Sfx.pain("death", { x: npc.ctl.pos.x, z: npc.ctl.pos.z, maxRange: 25, gender: npc._cfg && npc._cfg.gender }); Sfx.play("body_fall", { x: npc.ctl.pos.x, z: npc.ctl.pos.z }); } catch (e) {}
    if (_onKillCb) { try { _onKillCb(npc); } catch (e) {} }
  },

  /* Make civilians run without raising the player's crime meter
     (scare() does that). Police never panic. */
  panic(x, z, radius) {
    radius = radius || 14;
    for (const npc of this.list) {
      if (npc.dead || npc.role === "police" || npc.state === "talk") continue;
      const dx = npc.ctl.pos.x - x;
      const dz = npc.ctl.pos.z - z;
      if (dx * dx + dz * dz < radius * radius) {
        npc.state = "flee";
        npc.stateT = rBetween(2, 3.5);
      }
    }
  },

  despawn() {
    try { Lives.onDespawn(); } catch (e) {}
    for (const npc of this.list) {
      if (npc.seatTarget) { npc.seatTarget.taken = false; npc.seatTarget = null; }
      if (npc.group && npc.group.parent) npc.group.parent.remove(npc.group);
      disposeTree(npc.group);
    }
    this.list.length = 0;
    _scene = null;
    _aabbs = [];
    this._groundAt = null; this._bounds = null;
    _seats = [];
  },

  tick(dt, playerX, playerZ) {
    this._tickStamp = performance.now();
    if (!this.list.length) return;
    try { Lives.tick(dt, playerX || 0, playerZ || 0); } catch (e) { console.warn('[lives]', e); }
    try { InteriorPoses.tick(dt, playerX || 0, playerZ || 0, this); } catch (e) { console.warn('[poses]', e); }
    try { AnimationAutomation.tick(dt, this.list, playerX || 0, playerZ || 0); } catch (e) { console.warn('[autoanim]', e); }
    const px = playerX || 0;
    const pz = playerZ || 0;
    const crimeHigh = !!(window.__ph3d_crime && window.__ph3d_crime.alert > 40);

    let driveState = null;
    try {
      driveState = window.__ph3d_drive && window.__ph3d_drive.getPlayerState
        ? window.__ph3d_drive.getPlayerState() : null;
    } catch (e) {}

    for (let i = this.list.length - 1; i >= 0; i--) {
      const npc = this.list[i];

      if (npc.dead && npc.seatTarget) { npc.seatTarget.taken = false; npc.seatTarget = null; }

      if (npc.dead && npc.state === "dying") {
        npc.dyingPhase += dt;
        const p = Math.min(1, npc.dyingPhase / 0.75);
        const g = npc.group, rig = npc.rig;
        /* a body falls under gravity: slow start, accelerating, then a small bounce off the floor */
        const fall = Math.min(1, p / 0.8), ef = fall * fall;
        const bounce = p > 0.8 ? Math.sin((p - 0.8) / 0.2 * Math.PI) * 0.06 : 0;
        const fy = npc._deathY || 0;
        if (npc._fall) poseFall(g, npc._fall, npc._deathYaw || 0, ef, npc._deathDir * 0.3);
        else { g.rotation.x = -Math.PI / 2 * ef; g.rotation.z = npc._deathDir * 0.3 * ef; }
        g.position.y = restY(fy, ef) + 0.10 * Math.sin(Math.PI * Math.min(1, p * 1.2)) * (1 - ef) + bounce;
        if (rig) {
          Limp.step(rig, g, dt);
          if (!npc._limpKicked) { npc._limpKicked = true; const sx = Math.sin(npc.ctl.yaw || 0), sz = Math.cos(npc.ctl.yaw || 0); Limp.kick(rig, -sx * 60, 15, -sz * 60, 1); }
        }
        if (p >= 1) { npc.state = "dead"; g.position.y = restY(npc._deathY || 0, 1); }
        continue;
      }
      if (npc.dead) {                       // bodies lie there, then vanish
        npc.deadT += dt;
        if (npc.rig && !Limp.asleep(npc.rig)) Limp.step(npc.rig, npc.group, dt);
        if (npc.deadT > 20) {
          if (npc.group.parent) npc.group.parent.remove(npc.group);
          disposeTree(npc.group);
          this.list.splice(i, 1);
        }
        continue;
      }

      if (npc._lifeHidden) { npc.group.visible = false; continue; }   /* indoors / asleep / at school */
      npc.age += dt;
      if (npc.talkCd > 0) npc.talkCd -= dt;
      if (npc.hitCd  > 0) npc.hitCd  -= dt;
      npc.stateT -= dt;
      npc.moveSpeed = 0;
      const _prevX = npc.ctl.pos.x, _prevZ = npc.ctl.pos.z;
      if (npc._baseY == null) npc._baseY = npc.ctl.pos.y || 0;
      if (npc.seatTarget && npc.state !== "goSeat" && npc.state !== "sitting") {
        npc.seatTarget.taken = false; npc.seatTarget = null;   /* interrupted (flee, talk...) */
      }

      const dxP = npc.ctl.pos.x - px;
      const dzP = npc.ctl.pos.z - pz;
      const dP = Math.sqrt(dxP * dxP + dzP * dzP);
      const isClose = dP < npc.maxDist;

      /* Street-life voices (recorded clips, no bubble): hawkers call out, kids laugh,
         groups chatter - only when you're near, and only now and then. */
      {
        const _k = npc.role === "trader" || npc.groupTag === "mamas" ? "hawker_call"
                 : npc.groupTag === "school_kids" ? "child_laugh"
                 : null;
        if (_k && npc.state !== "talk" && npc.state !== "flee") {
          if (npc._ambT == null) npc._ambT = 5 + Math.random() * 25;
          npc._ambT -= dt;
          if (npc._ambT <= 0 && dP < 14) {
            npc._ambT = 25 + Math.random() * 35;
            try { Sfx.voice(_k, { x: npc.ctl.pos.x, z: npc.ctl.pos.z, maxRange: 14 }); } catch (e) {}
          }
        }
      }

      if (npc._isHunter) {
        const H = window.__ph3d_hunt;
        const pinged = !!(H && H.active && H.isPinged && H.isPinged());
        if (pinged) {
          // exposed: hunters know exactly where you are and close in
          npc.state = "investigate";
          npc.investigateX = px; npc.investigateZ = pz;
          npc.lookX = px; npc.lookZ = pz;
          npc.stateT = 2;
        } else if (npc.state === "investigate" && npc.stateT <= 0) {
          // ping window lapsed: fall back to ordinary wandering (line-of-sight only)
          npc.state = "walk";
          npc.stateT = rBetween(3, 8);
        }
      }

      if (crimeHigh && npc.role !== "police" && npc.role !== "priest" && npc.role !== "warden" && npc.state !== "wrestled" && npc.state !== "flee" && npc.state !== "talk" && !MOVE_STATES.has(npc.state) && dP < 18) {
        npc.state = "flee";
        npc.stateT = rBetween(2, 3);
      }

      if (typeof npc.state === "string" && npc.state.startsWith("life_")) {
        Lives.drive(npc, dt);                                         /* chatting, walking with family… */
      } else if (npc.state === "pose" || npc.state === "meet") {
        try { InteriorPoses.update(npc, dt, this); } catch (e) { npc.state = "idle"; npc.stateT = 1; npc._pose = null; }
      } else if (npc.state === "talk") {
        if (dxP * dxP + dzP * dzP > 0.01) npc.yawTarget = Math.atan2(-dxP, -dzP);
        if (npc.stateT <= 0) { npc.state = "walk"; npc.stateT = rBetween(3, 8); }
      } else if (npc.state === "wrestled") {
        const w = npc.wrestle;
        if (!w) { npc.state = "idle"; npc.stateT = 0.5; }
        else {
          npc.moveSpeed = 0;
          if (!w.driven) {                       /* fight engine carries driven victims itself */
            const ddx = npc.ctl.pos.x - w.ax, ddz = npc.ctl.pos.z - w.az;
            const dd = Math.hypot(ddx, ddz) || 1;
            const k = Math.min(1, dt * 8);
            const nx = npc.ctl.pos.x + (w.ax + ddx / dd * 1.0 - npc.ctl.pos.x) * k;
            const nz = npc.ctl.pos.z + (w.az + ddz / dd * 1.0 - npc.ctl.pos.z) * k;
            if (!(_aabbs && this._insideAABB(nx, nz, _aabbs, 0.4))) { npc.ctl.pos.x = nx; npc.ctl.pos.z = nz; }
          }
          npc.yawTarget = Math.atan2(w.ax - npc.ctl.pos.x, w.az - npc.ctl.pos.z);
          if (npc.stateT <= 0) { npc.wrestle = null; npc.state = "flee"; npc.stateT = 2.5; }
        }
      } else if (npc.state === "react") {
        const r = npc.reaction;
        if (!r) { npc.state = "idle"; npc.stateT = 0.5; }
        else {
          r.timer -= dt;
          if (r.timer > 0) {
            const k = 1 - r.timer / r.totalDur;
            if (r.staggerX || r.staggerZ) {
              const push = 5 * (1 - k);
              const nx = npc.ctl.pos.x + r.staggerX * push * dt;
              const nz = npc.ctl.pos.z + r.staggerZ * push * dt;
              if (!(_aabbs && this._insideAABB(nx, nz, _aabbs, 0.4))) {
                npc.ctl.pos.x = nx;
                npc.ctl.pos.z = nz;
              }
            }
            if (r.threatX != null && r.threatZ != null) {
              npc.yawTarget = Math.atan2(r.threatX - npc.ctl.pos.x, r.threatZ - npc.ctl.pos.z);
            }
          } else {
            npc.state = r.next;
            npc.threatX = r.threatX;
            npc.threatZ = r.threatZ;
            npc.stateT = 3.5;
            if (r.next === "cover")       { npc.coverX = r.coverX; npc.coverZ = r.coverZ; npc.stateT = 4; }
            else if (r.next === "downed") { npc.stateT = 4; }
            else if (r.next === "investigate") {
              npc.investigateX = r.threatX; npc.investigateZ = r.threatZ;
              npc.lookX = r.threatX; npc.lookZ = r.threatZ;
              npc.stateT = 12;
            } else if (r.next === "cower") { npc.stateT = 3; }
            npc.reaction = null;
          }
        }
      } else if (npc.state === "cover") {
        const dx = npc.coverX - npc.ctl.pos.x;
        const dz = npc.coverZ - npc.ctl.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.9) {
          const sp = (npc.crippled || npc.wounded) ? 2.6 : 4.6;
          const nx = npc.ctl.pos.x + (dx / d) * sp * dt;
          const nz = npc.ctl.pos.z + (dz / d) * sp * dt;
          if (!(_aabbs && this._insideAABB(nx, nz, _aabbs, 0.4))) {
            npc.ctl.pos.x = nx; npc.ctl.pos.z = nz;
          }
          npc.yawTarget = Math.atan2(dx, dz);
          npc.moveSpeed = sp;
        } else {
          npc.state = "cower"; npc.stateT = 4; npc.moveSpeed = 0;
        }
      } else if (npc.state === "cower") {
        npc.moveSpeed = 0;
        if (npc.threatX != null && npc.threatZ != null) {
          npc.yawTarget = Math.atan2(npc.threatX - npc.ctl.pos.x, npc.threatZ - npc.ctl.pos.z);
        }
        if (npc.stateT <= 0) { npc.state = "flee"; npc.stateT = 2.5; }
      } else if (npc.state === "downed") {
        npc.moveSpeed = 0;
        if (npc.stateT <= 0) {
          if (npc.hp <= 0) this._kill(npc);
          else {
            npc.state = npc.stationary ? "returnHome" : "flee";
            npc.stateT = npc.stationary ? 30 : 2;
          }
        }
      } else if (npc.state === "returnHome") {
        const dx = npc.homeX - npc.ctl.pos.x;
        const dz = npc.homeZ - npc.ctl.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.5 || npc.stateT <= 0) {
          npc.state = "idle";
          npc.stateT = rBetween(1, 2.5);
        } else {
          const sp = npc.crippled ? 1.8 : 2.5;
          this._stepToward(npc, dx, dz, sp, dt);
          npc.stateT -= dt;
        }
      } else if (npc.state === "flee") {
        let fleeX, fleeZ;
        if (npc.threatX != null && npc.threatZ != null) {
          fleeX = npc.ctl.pos.x - npc.threatX;
          fleeZ = npc.ctl.pos.z - npc.threatZ;
        } else { fleeX = dxP; fleeZ = dzP; }
        const d = Math.hypot(fleeX, fleeZ) || 1;
        const sp = (npc.crippled || npc.wounded) ? 2.8 : 4.5;
        if (!this._stepToward(npc, fleeX / d, fleeZ / d, sp, dt) && npc.stateT > 0.8) {
          npc.state = "cower"; npc.stateT = 1.5;    /* cornered: crouch instead of grinding into the wall */
        }
        if (npc.stateT <= 0) {
          if (npc.stationary) {
            npc.state = "returnHome";
            npc.stateT = 30;
          } else {
            npc.pathU = nearestU(npc.path, npc.ctl.pos.x, npc.ctl.pos.z);
            const p = pointAtU(npc.path, npc.pathU);
            npc.ctl.pos.x = p.x; npc.ctl.pos.z = p.z;
            npc.state = "idle"; npc.stateT = rBetween(1, 2.5);
          }
        }
      } else if (MOVE_STATES.has(npc.state)) {
        const tx = npc.investigateX, tz = npc.investigateZ;
        const dx = tx - npc.ctl.pos.x, dz = tz - npc.ctl.pos.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > 1.0) {
          const sp = npc.state === "investigate" ? 2.8 : 2.0;
          this._stepToward(npc, dx, dz, sp, dt);
        } else if (npc.lookX != null) {
          npc.yawTarget = Math.atan2(npc.lookX - npc.ctl.pos.x, npc.lookZ - npc.ctl.pos.z);
        }
        if (npc.stateT <= 0) rejoinPath(npc);
      } else if (npc.state === "cheer") {
        /* crowd gathers around a performer, forms a ring, faces them and claps */
        const dx = npc.cheerX - npc.ctl.pos.x, dz = npc.cheerZ - npc.ctl.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.9 && npc.stateT > 1) {
          if (npc.ctl._emoteName === "clap") { npc.ctl._emoteTimer = 0; npc.ctl._emoteName = null; }
          this._stepToward(npc, dx, dz, 2.4, dt);
        } else {
          npc.moveSpeed = 0;
          npc.yawTarget = Math.atan2(npc.cheerCX - npc.ctl.pos.x, npc.cheerCZ - npc.ctl.pos.z);
          if (!(npc.ctl._emoteTimer > 0) && npc.stateT > 0.5) {
            npc.ctl._emoteName = "clap"; npc.ctl._emoteTimer = 3.0; npc.ctl._emotePhase = rnd() * 1.5;
          }
        }
        if (npc.stateT <= 0) {
          if (npc.ctl._emoteName === "clap") { npc.ctl._emoteTimer = 0; npc.ctl._emoteName = null; }
          npc.state = "idle"; npc.stateT = rBetween(1, 3); npc._rt = null;
        }
      } else if (STILL_STATES.has(npc.state)) {
        if (npc.stateT <= 0) { npc.state = "walk"; npc.stateT = rBetween(3, 8); }
      } else if (npc.state === "goSeat") {
        const tgt = npc.seatTarget;
        if (!tgt) { npc.state = "idle"; npc.stateT = 1; }
        else {
          const dx = tgt.x - npc.ctl.pos.x, dz = tgt.z - npc.ctl.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.9) {
            npc.ctl.pos.x = tgt.x; npc.ctl.pos.z = tgt.z;
            npc.yawTarget = tgt.yaw || 0;
            npc.ctl.yaw = tgt.yaw || 0;
            npc.state = "sitting";
            npc.stateT = 20 + rnd() * 25;
          } else if (d > 2.0 && this._stepToward(npc, dx, dz, 1.4, dt)) {
            /* routed around furniture and walls */
          } else {
            const sp = 1.4;
            const nx = npc.ctl.pos.x + (dx / d) * sp * dt;
            const nz = npc.ctl.pos.z + (dz / d) * sp * dt;
            if (!(_aabbs && this._insideAABB(nx, nz, _aabbs, 0.4))) {
              npc.ctl.pos.x = nx; npc.ctl.pos.z = nz; npc.moveSpeed = sp;
            } else if (!this._insideAABB(nx, npc.ctl.pos.z, _aabbs, 0.4)) {
              npc.ctl.pos.x = nx; npc.moveSpeed = sp * 0.6;
            } else if (!this._insideAABB(npc.ctl.pos.x, nz, _aabbs, 0.4)) {
              npc.ctl.pos.z = nz; npc.moveSpeed = sp * 0.6;
            }
            npc.yawTarget = Math.atan2(dx, dz);
          }
          if (npc.stateT <= 0 && npc.state === "goSeat") {   /* never got there */
            tgt.taken = false; npc.seatTarget = null;
            npc.state = "idle"; npc.stateT = rBetween(2, 5);
          }
        }
      } else if (npc.state === "sitting") {
        npc.moveSpeed = 0;
        if (npc.seatTarget) npc.yawTarget = npc.seatTarget.yaw || 0;
        if (npc.stateT <= 0) {
          const st = npc.seatTarget;
          if (st) {
            st.taken = false;
            /* step out in front of the seat so we don't pop into the furniture */
            const fy = st.yaw || 0;
            npc.ctl.pos.x += Math.sin(fy) * 0.7;
            npc.ctl.pos.z += Math.cos(fy) * 0.7;
          }
          npc.seatTarget = null;
          npc.state = "idle"; npc.stateT = rBetween(1, 3);
        }
      } else if (npc.state === "stroll") {
        const dx = npc.strollX - npc.ctl.pos.x, dz = npc.strollZ - npc.ctl.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.4 || npc.stateT <= 0) {
          npc.state = "idle"; npc.stateT = rBetween(2, 6); npc.moveSpeed = 0;
        } else {
          const sp = npc.strollSp || 1.3;
          if (!this._stepToward(npc, dx, dz, sp, dt)) {
            npc._strollBlock = (npc._strollBlock || 0) + dt;
            if (npc._strollBlock > 2.5) { npc.state = "idle"; npc.stateT = rBetween(1, 3); npc._strollBlock = 0; npc._rt = null; }
          } else npc._strollBlock = 0;
        }
      } else if (npc.state === "idle") {
        if (npc.stateT <= 0) {
          if (npc.stationary) {
            /* Ambient life: wander a few metres around home, then idle again */
            let picked = false;
            /* Interior life: sometimes walk to a nearby free seat and sit. */
            if (npc._interiorPlace && _seats.length && npc.role !== "police" && rnd() < 0.3) {
              let best = null, bd = 20 * 20;
              for (const s of _seats) {
                if (s.taken || (s.type && s.type !== "sit") || s.level) continue;
                const sdx = s.x - npc.ctl.pos.x, sdz = s.z - npc.ctl.pos.z;
                const d2 = sdx * sdx + sdz * sdz;
                if (d2 < bd) { bd = d2; best = s; }
              }
              if (best) {
                best.taken = true; npc.seatTarget = best;
                npc.state = "goSeat"; npc.stateT = 25; picked = true;
              }
            }
            if (!picked && rnd() < 0.8 && npc.role !== "police") {
              const wantLong = rnd() < 0.35;                      /* sometimes a real trip, usually a short wander */
              for (let k = 0; k < 8 && !picked; k++) {
                const a = rnd() * Math.PI * 2, r = wantLong ? rBetween(9, 26) : rBetween(1.5, 5);
                const tx = npc.homeX + Math.cos(a) * r, tz = npc.homeZ + Math.sin(a) * r;
                if (_aabbs && this._insideAABB(tx, tz, _aabbs, 0.6)) continue;
                if (wantLong) {                                  /* only go where a route really exists */
                  const rt = _findRoute(npc.ctl.pos.x, npc.ctl.pos.z, tx, tz);
                  if (!rt) continue;
                  let len = 0, lx = npc.ctl.pos.x, lz = npc.ctl.pos.z;
                  for (const p of rt) { len += Math.hypot(p[0] - lx, p[1] - lz); lx = p[0]; lz = p[1]; }
                  if (len > 45) continue;
                  npc.strollSp = 1.5; npc.stateT = len / 1.5 + 5;
                } else { npc.strollSp = 1.2; npc.stateT = 8; }
                npc.strollX = tx; npc.strollZ = tz; npc._rt = null;
                npc.state = "stroll"; picked = true;
              }
            }
            if (!picked) {
              npc.stateT = rBetween(2, 5);
              if (dP > 0.1 && dP < 8) npc.yawTarget = Math.atan2(-dxP, -dzP);
            }
          } else {
            npc.state = "walk"; npc.stateT = rBetween(3, 8);
          }
        }
      } else {
        /* walk branch — must not fire for stationary NPCs */
        if (npc.stationary) {
          npc.state = "idle";
          npc.stateT = rBetween(3, 8);
        } else {
          const speed = 1.6 * npc.speedMult * (npc.path.speed || 1);
          const { total } = getSegs(npc.path);
          const du = (speed * dt) / total;
          npc.pathU += du * npc.pathDir;

          if (npc.path.closed) {
            if (npc.pathU > 1) npc.pathU -= 1;
            else if (npc.pathU < 0) npc.pathU += 1;
          } else {
            if (npc.pathU >= 1) { npc.pathU = 1; npc.pathDir = -1; }
            else if (npc.pathU <= 0) { npc.pathU = 0; npc.pathDir = 1; }
          }

          const p = pointAtU(npc.path, npc.pathU);

          /* ── Obstacle check: look ~1 m ahead, turn BEFORE touching the wall ── */
          const _look = 1.2 / total;
          let _ua = npc.pathU + _look * npc.pathDir;
          if (npc.path.closed) _ua = ((_ua % 1) + 1) % 1; else _ua = Math.max(0, Math.min(1, _ua));
          const pA = pointAtU(npc.path, _ua);
          if (_aabbs.length && (!this._free(p.x, p.z, 0.5) || !this._free(pA.x, pA.z, 0.55))) {
            /* undo this step, hold position and head back the other way */
            npc.pathU -= du * npc.pathDir;
            if (npc.path.closed) npc.pathU = ((npc.pathU % 1) + 1) % 1;
            npc.pathDir *= -1;
            npc.stuckTimer = (npc.stuckTimer || 0) + 0.6;
            if (npc.stuckTimer > 2.4) {          /* blocked both ways: jump to the nearest clear spot on the path */
              let bu = null, bd = Infinity;
              for (let k = 0; k < 40; k++) {
                const u = Math.random(), q = pointAtU(npc.path, u);
                if (!this._free(q.x, q.z, 0.6)) continue;
                const d2 = (q.x - npc.ctl.pos.x) ** 2 + (q.z - npc.ctl.pos.z) ** 2;
                if (d2 < bd) { bd = d2; bu = u; }
              }
              if (bu != null) npc.pathU = bu;
              npc.stuckTimer = 0;
            }
            npc.state = "idle"; npc.stateT = 0.5; npc.moveSpeed = 0;
            continue;
          } else {
            npc.ctl.pos.x = p.x;
            npc.ctl.pos.z = p.z;
            npc.stuckTimer = Math.max(0, (npc.stuckTimer || 0) - dt * 2);
          }

          npc.yawTarget = Math.atan2(p.tx * npc.pathDir, p.tz * npc.pathDir);
          npc.moveSpeed = speed;

          /* ── Sit intent (interior NPCs) ── */
          if (npc._interiorPlace && _seats.length) {
            npc.sitIntentTimer = (npc.sitIntentTimer || rBetween(15, 35)) - dt;
            if (npc.sitIntentTimer <= 0) {
              let best = null, bd = 25 * 25;
              for (const s of _seats) {
                if (s.taken || (s.type && s.type !== "sit")) continue;
                const sdx = s.x - npc.ctl.pos.x, sdz = s.z - npc.ctl.pos.z;
                const d2 = sdx * sdx + sdz * sdz;
                if (d2 < bd) { bd = d2; best = s; }
              }
              if (best) {
                best.taken = true; npc.seatTarget = best;
                npc.state = "goSeat"; npc.stateT = 25; npc.moveSpeed = 0;
                npc.sitIntentTimer = rBetween(20, 45);
                continue;
              }
              npc.sitIntentTimer = 6;
            }
          }

          /* ── Occasional path swap for variety ── */
          if (npc.groupTag) {
            npc.repathTimer = (npc.repathTimer || rBetween(25, 50)) - dt;
            if (npc.repathTimer <= 0) {
              const pool = NPC_PATHS.filter(pp => pp.id !== npc.path.id);
              if (pool.length) {
                const next = pool[Math.floor(rnd() * pool.length)];
                npc.path = next;
                npc.pathU = rnd();
                npc.pathDir = rnd() < 0.5 ? 1 : -1;
                const np = pointAtU(npc.path, npc.pathU);
                npc.ctl.pos.x = np.x; npc.ctl.pos.z = np.z;
                npc.group.position.set(np.x, 0, np.z);
              }
              npc.repathTimer = rBetween(25, 50);
            }
          }

          if (npc.stateT <= 0) { npc.state = "idle"; npc.stateT = rBetween(1.5, 4); npc.moveSpeed = 0; }
        }
      }

      if (driveState && driveState.mode === "drive" && npc.hitCd <= 0) {
        const dxC = npc.ctl.pos.x - driveState.x;
        const dzC = npc.ctl.pos.z - driveState.z;
        const hy = driveState.heading || 0, hs = Math.sin(hy), hc = Math.cos(hy);
        const lxC = Math.abs(dxC * hc - dzC * hs) - (driveState.halfW || 1.0), lzC = Math.abs(dxC * hs + dzC * hc) - (driveState.halfL || 2.4);
        const dC = Math.hypot(Math.max(lxC, 0), Math.max(lzC, 0));      /* distance outside your car's body */

        if (dC < 0.3 && Math.abs(driveState.speed || 0) > 2) {
          npc.hitCd = 3.0;
          npc.state = "flee";
          npc.stateT = 3.5;

          try {
            Blood.spray(_scene, npc.ctl.pos.x, 1.0, npc.ctl.pos.z, { count: 40, spread: 6 });
            Blood.splat(_scene, npc.ctl.pos.x, npc.ctl.pos.z);
          } catch (e) {}

          try {
            const Cr = window.__ph3d_crime;
            if (Cr && Cr.addEvent) Cr.addEvent("kill", 100, "You");
          } catch (e) {}

          /* running into a pedestrian never hurts YOU — only an NPC car touching you does */

          try {
            const So = window.__ph3d_social;
            if (So) { So.onCrime(npc.ctl.pos.x, npc.ctl.pos.z, "kill"); So.onAccident(npc.ctl.pos.x, npc.ctl.pos.z); }
          } catch (e) {}

          _toast("\uD83D\uDCA5 You ran someone over \u00B7 crime +100");
        }
      }

      let dy = npc.yawTarget - npc.ctl.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      npc.ctl.yaw += dy * Math.min(1, dt * 6);

      /* Safety net: no NPC is ever left inside a wall, even for one frame. */
      if (_aabbs.length && npc.state !== "goSeat" && npc.state !== "sitting" && npc.state !== "downed"
          && !this._free(npc.ctl.pos.x, npc.ctl.pos.z, 0.3)) {
        const cx = npc.ctl.pos.x, cz = npc.ctl.pos.z;
        if (this._free(cx, _prevZ, 0.3)) npc.ctl.pos.z = _prevZ;
        else if (this._free(_prevX, cz, 0.3)) npc.ctl.pos.x = _prevX;
        else if (this._free(_prevX, _prevZ, 0.3)) { npc.ctl.pos.x = _prevX; npc.ctl.pos.z = _prevZ; }
        else { const pu = this._pushOut(cx, cz, _aabbs, 0.45); npc.ctl.pos.x = pu[0]; npc.ctl.pos.z = pu[1]; }
        npc.moveSpeed = 0;
        if (npc.path && !npc.stationary && npc.state === "walk") {
          npc.pathU = nearestU(npc.path, npc.ctl.pos.x, npc.ctl.pos.z);
          npc.pathDir *= -1; npc.state = "idle"; npc.stateT = 0.5;
        }
      }
      npc.ctl._intentSpeed = npc.moveSpeed;
      npc.ctl.onGround = true;
      const _sit = npc.state === "sitting" && npc.seatTarget;
      npc.ctl.state = _sit ? "sitting" : "standing";
      npc.ctl.sitTarget = _sit ? npc.seatTarget : null;
      /* Always rebuild Y from the fixed floor height. Reading it back from the
         group each frame made the downed offset accumulate (floating NPCs). */
      if (this._bounds) {
        const bd = this._bounds;
        npc.ctl.pos.x = Math.min(bd.maxX - 0.5, Math.max(bd.minX + 0.5, npc.ctl.pos.x));
        npc.ctl.pos.z = Math.min(bd.maxZ - 0.5, Math.max(bd.minZ + 0.5, npc.ctl.pos.z));
      }
      const _gy = this._groundAt ? this._groundAt(npc.ctl.pos.x, npc.ctl.pos.z) : 0;
      npc.ctl.pos.y = npc._baseY + _gy;
      const _seatDrop = _sit ? ((npc.seatTarget.h || 0.5) - HIP_H + 0.10) : 0;
      npc.group.position.set(npc.ctl.pos.x, npc._baseY + _gy + _seatDrop, npc.ctl.pos.z);
      npc.group.rotation.y = npc.ctl.yaw;

      const targetDown = (npc.state === "downed") ? 1 : 0;
      npc._downVisual = (npc._downVisual || 0) + (targetDown - (npc._downVisual || 0)) * Math.min(1, dt * 6);
      if (npc._downVisual > 0.005) {
        npc.group.rotation.x = -Math.PI / 2 * npc._downVisual;
        npc.group.position.y += 0.22 * npc._downVisual;
      } else if (npc.group.rotation.x !== 0 && !npc.dead) {
        npc.group.rotation.x = 0;
      }

      /* Recycle: far, path-following NPCs that are already invisible
         get teleported to a fresh spot on their own path within
         visible range of the player, so the world stays populated
         without ever growing the live actor count. */
      if (!npc.stationary && npc.groupTag && npc.group.visible === false) {
        if (dP > 320) {
          let bestU = npc.pathU;
          let bestD = Infinity;
          for (let k = 0; k < 12; k++) {
            const u = Math.random();
            const pp = pointAtU(npc.path, u);
            const d = Math.hypot(pp.x - px, pp.z - pz);
            if (d > 60 && d < 140 && d < bestD) { bestU = u; bestD = d; }
          }
          if (bestD < Infinity) {
            npc.pathU = bestU;
            const pp = pointAtU(npc.path, bestU);
            npc.ctl.pos.x = pp.x;
            npc.ctl.pos.z = pp.z;
            npc.ctl.pos.y = 0;
            npc.group.position.set(pp.x, 0, pp.z);
            npc.group.visible = true;
          }
        }
      }

      /* Distance-tiered animation: never freeze a visible NPC (they slid along
         in a stiff pose when farther than maxDist). Near = full rate, far = slower
         rate. The accumulated dt is passed so walk cycles stay in sync. */
      if (isClose) npc.group.visible = true;
      else npc.group.visible = dP < 220;
      if (npc.group.visible) {
        const _animStep = isClose && dP < 40 ? 0.033 : dP < 90 ? 0.066 : 0.12;
        npc._animAcc = (npc._animAcc || 0) + dt;
        if (npc._animAcc >= _animStep) {
          try { Animator.animate(npc.ctl, npc._animAcc); } catch (e) {}
          npc._animAcc = 0;
        }
      }
    }

    /* ── Soft NPC-to-NPC separation (O(n²), negligible for n <= 80) ── */
    const SEP_R = 0.85, SEP_R2 = SEP_R * SEP_R;
    for (let a = 0; a < this.list.length - 1; a++) {
      const A = this.list[a];
      if (A.dead || A._lifeHidden || A.state === "sitting" || A.state === "goSeat" || A.state === "pose" || A.state === "meet") continue;
      for (let b = a + 1; b < this.list.length; b++) {
        const Bn = this.list[b];
        if (Bn.dead || Bn._lifeHidden || Bn.state === "sitting" || Bn.state === "goSeat" || Bn.state === "pose" || Bn.state === "meet") continue;
        const ddx = A.ctl.pos.x - Bn.ctl.pos.x;
        const ddz = A.ctl.pos.z - Bn.ctl.pos.z;
        const d2 = ddx * ddx + ddz * ddz;
        if (d2 < SEP_R2 && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (SEP_R - d) * 0.5 / d;
          A.ctl.pos.x += ddx * push; A.ctl.pos.z += ddz * push;
          Bn.ctl.pos.x -= ddx * push; Bn.ctl.pos.z -= ddz * push;
        }
      }
    }

    /* Re-sync group world positions after separation adjustments */
    for (const npc of this.list) {
      if (npc.dead || npc.state === "sitting") continue;
      npc.group.position.x = npc.ctl.pos.x;
      npc.group.position.z = npc.ctl.pos.z;
    }
  },
};
window.__ph3d_npcsList = () => NPCs.list;

/* When the player switches look (classic <-> faceted) in the wardrobe, re-skin the NPCs that
   already exist, a few at a time so there is no hitch. New NPCs pick the look up in _build. */
try {
  let _lastLook = Wardrobe.config.look || "classic", _reskinQ = null;
  Wardrobe.onChange((cfg) => {
    const l = cfg.look || "classic";
    if (l === _lastLook) return;
    _lastLook = l;
    _reskinQ = NPCs.list.filter(n => n && !n.dead && n._cfg && n.group);
    const step = () => {
      let k = 0;
      while (_reskinQ && _reskinQ.length && k++ < 2) {
        const n = _reskinQ.shift();
        if (n.dead || n.state === "downed" || !n.group || !n.group.parent) continue;
        try { NPCs._reskin(n, n._cfg); } catch (e) {}
      }
      if (_reskinQ && _reskinQ.length) setTimeout(step, 60);
    };
    step();
  });
} catch (e) {}
