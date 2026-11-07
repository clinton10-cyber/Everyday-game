/* js/core/fight-skills.js — letter skills, sequence combos, chord combos.
   ─────────────────────────────────────────────────────────────────────────
   SKILLS (the lettered buttons)
     G Grab   P Punch   K Kick   E Elbow   T Takedown   S Slam

   • One tap runs the skill's next move. Tapping the same skill repeatedly
     cycles its string (P: jab → cross → hook …).
   • In a CLINCH (after G lands) the same buttons become follow-ups:
       P knee · K stunner · E DDT · T hip toss · S suplex · G choke slam
   • SEQUENCE combos: certain 3-letter strings upgrade the last move
       (P P K → superkick …).
   • CHORDS — press 2–3 skills AT ONCE and a whole multi-move combo fires
       from a single press (e.g. P+K = jab · cross · roundhouse).
   ───────────────────────────────────────────────────────────────────────── */
import { WrestlingCombat } from "./wrestling-combat.js";
import { WRESTLING_MOVES } from "../characters/wrestling.js";

export const SKILLS = {
  G: { word: "GRAB",  key: "KeyU" },
  P: { word: "PUNCH", key: "KeyJ" },
  K: { word: "KICK",  key: "KeyK" },
  E: { word: "ELBOW", key: "KeyL" },
  T: { word: "TAKEDOWN", key: "KeyI" },
  S: { word: "SLAM",  key: "KeyO" },
};
export const SKILL_ORDER = ["G", "P", "K", "E", "T", "S"];

/* what each letter does with nobody in your grip — index = how deep into the string you are */
const STRING = {
  G: ["clinch"],
  P: ["jab", "cross", "hook"],
  K: ["lowKick", "roundhouse", "superkick"],
  E: ["elbowStrike", "clothesline", "elbowDrop"],
  T: ["singleLeg", "spear"],
  S: ["bodySlam", "chokeSlam", "suplex"],
};
/* …and while clinched */
const CLINCHED = { G: "chokeSlam", P: "clinchKnee", K: "stunner", E: "ddt", T: "hipToss", S: "suplex" };

/* 3-letter strings that upgrade the move you just pressed */
const SEQ = {
  PPK: { move: "superkick",   name: "ONE-TWO KICK" },
  PPE: { move: "clothesline", name: "BRAWLER" },
  KKP: { move: "hook",        name: "RISING FURY" },
  KKT: { move: "spear",       name: "LOW-HIGH SHOOT" },
  EEE: { move: "elbowDrop",   name: "ELBOW STORM" },
  TTS: { move: "suplex",      name: "SHOOT & SLAM" },
  PKE: { move: "elbowStrike", name: "THREE-WAY" },
  SSS: { move: "chokeSlam",   name: "POWER STACK" },
};

/* chords: letters sorted A→Z */
const CHORDS = {
  EP:  { name: "BRAWLER",         moves: ["jab", "hook", "elbowStrike"] },
  KP:  { name: "FLURRY",          moves: ["jab", "cross", "roundhouse"] },
  EK:  { name: "CUT DOWN",        moves: ["lowKick", "roundhouse", "elbowStrike"] },
  GP:  { name: "CLINCH BARRAGE",  moves: ["clinch", "clinchKnee", "clinchKnee"] },
  GK:  { name: "HEAD STUNNER",    moves: ["clinch", "stunner"] },
  GT:  { name: "HIP TOSS",        moves: ["clinch", "hipToss"] },
  GS:  { name: "SUPLEX",          moves: ["clinch", "suplex"] },
  EG:  { name: "DDT",             moves: ["clinch", "ddt"] },
  PT:  { name: "JAB & SHOOT",     moves: ["jab", "cross", "singleLeg"] },
  KT:  { name: "KICK & SPEAR",    moves: ["lowKick", "spear"] },
  ET:  { name: "SPEAR & DROP",    moves: ["spear", "elbowDrop"] },
  ST:  { name: "SLAM & DROP",     moves: ["bodySlam", "elbowDrop"] },
  KS:  { name: "KICK SLAM",       moves: ["roundhouse", "bodySlam"] },
  ES:  { name: "ELBOW SLAM",      moves: ["elbowStrike", "bodySlam"] },
  GKP: { name: "RAMPAGE",         moves: ["clinch", "clinchKnee", "clinchKnee", "stunner"] },
  GST: { name: "FINISHER",        moves: ["clinch", "chokeSlam", "elbowDrop"] },
  EKP: { name: "FURY",            moves: ["jab", "cross", "hook", "roundhouse", "superkick"] },
  EPT: { name: "TAKE DOWN",       moves: ["jab", "hook", "spear", "elbowDrop"] },
};

const CHORD_MS = 120;          /* second/third button inside this window = one chord */
const SEQ_MS = 1100;           /* max gap between taps of a string */

let hist = [];                 /* [{ L, at }] recent resolved taps */
let chordGroup = null;         /* { letters:Set, at, started } */
let walkerRef = null;
const subs = new Set();
const emit = (e) => subs.forEach((fn) => { try { fn(e); } catch (x) {} });

function depth(L) {            /* how many consecutive taps of this letter just happened */
  const now = performance.now();
  let n = 0;
  for (let i = hist.length - 1; i >= 0; i--) {
    if (now - hist[i].at > SEQ_MS || hist[i].L !== L) break;
    n++;
  }
  return n;
}
function recent(L) {
  const now = performance.now();
  const h = hist.filter((x) => now - x.at <= SEQ_MS * 2).map((x) => x.L);
  return h.slice(-2).join("") + L;
}

/* what would this letter do right now? (used for button sub-labels too) */
function resolve(L) {
  if (WrestlingCombat.clinched()) return { move: CLINCHED[L], clinch: true };
  const seq = SEQ[recent(L)];
  if (seq) return { move: seq.move, seq: seq.name };
  const s = STRING[L], n = depth(L);
  return { move: s[n % s.length] };
}

export const FightSkills = {
  mount(walker) { walkerRef = walker; hist = []; chordGroup = null; },
  unmount() { walkerRef = null; hist = []; chordGroup = null; WrestlingCombat.cancelAll(); },
  on(fn) { subs.add(fn); return () => subs.delete(fn); },

  /* label shown under a button: the move it will run next */
  preview(L) {
    const r = resolve(L);
    const m = WRESTLING_MOVES[r.move];
    return { label: m ? m.label : "", clinch: !!r.clinch, seq: r.seq || null };
  },

  press(L) {
    if (!walkerRef || !SKILLS[L]) return false;
    const now = performance.now();

    /* ── chord? a 2nd/3rd different button right after the 1st ── */
    if (chordGroup && now - chordGroup.at <= CHORD_MS && !chordGroup.letters.has(L)) {
      chordGroup.letters.add(L);
      const key = [...chordGroup.letters].sort().join("");
      const ch = CHORDS[key];
      if (ch) {
        if (chordGroup.started && WrestlingCombat.elapsed() < 0.3) WrestlingCombat.abortCurrent();
        hist = hist.filter((x) => now - x.at > CHORD_MS * 2);
        const ok = WrestlingCombat.runChain(walkerRef, ch.moves);
        if (ok) { emit({ type: "combo", name: ch.name, chord: key, moves: ch.moves }); hist.push({ L, at: now }); }
        return ok;
      }
    } else {
      chordGroup = { letters: new Set([L]), at: now, started: false };
    }

    /* ── ordinary tap ── */
    const r = resolve(L);
    if (!r.move) return false;
    const ok = WrestlingCombat.press(walkerRef, r.move);
    if (ok) {
      chordGroup.started = true;
      hist.push({ L, at: now }); if (hist.length > 8) hist.shift();
      if (r.seq) emit({ type: "combo", name: r.seq, seq: recent(L) });
      emit({ type: "press", L, move: r.move });
    }
    return ok;
  },
};
