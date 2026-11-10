import { registerWrestlingEmotes, WRESTLING_MOVES, guardLayer } from "./wrestling.js";
import { applyCarryPose } from "../core/body-attach.js";
export { WRESTLING_MOVES };
/* ════════════════════════════════════════════════════════════════════
   characters/animator.js
   Procedural animation for the low-poly rig built by lowpoly.js.

   What changed vs. the old _animate() in thirdperson.js
   ─────────────────────────────────────────────────────
   1. FOOT-PLANTED GAIT. Legs are driven by 2-bone IK from a foot path
      (stance = foot slides back at ground speed, swing = smooth Hermite arc),
      and the cycle rate is derived from the REAL ground speed. No more
      moon-walking / floating feet, and it stops when you push into a wall.
   2. POSE BLENDING. Every frame a *target* pose is built, then every joint
      is eased toward it (frame-rate independent), so state changes
      (stand→sit, walk→emote, jump→land…) flow instead of snapping.
   3. ACCURATE EMOTES. Wave / clap / flex / meditate / dance were solved
      with forward-kinematics against the real bone lengths: hands meet in the
      clap, the waving palm faces forward beside the head, the flex is a proper
      double-biceps with fists, meditation sits on the floor with knees
      down and hands on knees, dance bounces on a beat with planted feet.
   4. Hands: finger curl is part of the pose (open, fist, peace, point …).
   5. Landing squash, lean into turns / acceleration, idle breathing.
   6. BACKFLIPS. 20 physics-driven flip emotes (single, double, triple,
      layout, pike, twist, corkscrew, split, gainer, arabian, one-arm,
      x-out, straddle, kick-the-moon, sprint-double, compact-triple, …).
      Pelvis follows a real parabola (h = v₀·t − ½g·t²), body rotates
      backward around the pelvis with an eased tuck envelope, knees
      absorb the landing. A shortest-arc wrap on the hips X rotation
      stops the body from visually unspinning when the flip ends.

   This file has NO three.js import on purpose (it only touches
   joint.rotation / joint.position), so it can be unit-tested in node.
   Controller contract: see the "ctl fields used" list at animate().
   ════════════════════════════════════════════════════════════════════ */

const PI = Math.PI, TAU = PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const wrap1 = (u) => u - Math.floor(u);

/* rig measurements (must match lowpoly.js) */
export const HIP_HEIGHT = 0.935;
const L1 = 0.42, L2 = 0.40;          // thigh, shin
const PIVOT = -0.010;                // hip pivot y relative to hips group
const ANKLE_H = 0.105;               // ankle height when the foot is flat on the ground
const STAND_LEN = 0.818;             // pivot→ankle distance when standing relaxed
const CROUCH_LEN = 0.633;
const RELAX_WRIST = 1.2;             // hanging hand: thumb forward, palm toward the leg

/* heights used by the controller (kept for compatibility) */
export const HIPS_STAND = HIP_HEIGHT;
export const HIPS_MEDITATE = 0.20;

/* ── emote table (durations unchanged from the old controller) ─── */
export const EMOTES = {
  wave:     { dur: 3.0, label: "WAVING" },
  clap:     { dur: 3.0, label: "CLAPPING" },
  flex:     { dur: 3.0, label: "FLEXING" },
  meditate: { dur: 4.0, label: "MEDITATING" },
  dance:    { dur: 5.0, label: "DANCING" },
};

/* ══════════════════════════════════════════════════════════════════
   BACKFLIP EMOTES — physics-driven.

   Config fields:
     dur     total emote duration (seconds)
     spins   full backward rotations around the pelvis X axis
     twist   full Y-axis rotations (corkscrew, arabian, full twist)
     tuck    0 = layout (straight body), 1 = full tuck
     split   lateral leg spread 0..1.4 (0 = legs together)
     entry   "stand" | "run" | "crouch"  — anticipation pose
     leg     "tuck"|"pike"|"split"|"kick"|"tight"|"straight"
     arm     "hug"|"out"|"reach"|"oneArm"

   Airtime is derived from duration: airFrac = 0.55 of dur.
   Peak pelvis rise HMAX = g·airTime² / 8.
   ══════════════════════════════════════════════════════════════════ */
const FLIP_G = 9.8;

export const FLIP_EMOTES = {
  backflip:        { dur: 1.90, label: "BACKFLIP",         spins: 1, tuck: 1.0, twist: 0.0, split: 0.0, entry: "stand",  leg: "tuck",     arm: "hug"    },
  doubleBackflip:  { dur: 2.30, label: "DOUBLE BACKFLIP",  spins: 2, tuck: 1.0, twist: 0.0, split: 0.0, entry: "stand",  leg: "tuck",     arm: "hug"    },
  tripleBackflip:  { dur: 2.90, label: "TRIPLE BACKFLIP",  spins: 3, tuck: 1.0, twist: 0.0, split: 0.0, entry: "stand",  leg: "tuck",     arm: "hug"    },
  layoutFlip:      { dur: 1.90, label: "LAYOUT",           spins: 1, tuck: 0.0, twist: 0.0, split: 0.0, entry: "stand",  leg: "straight", arm: "out"    },
  pikeFlip:        { dur: 1.90, label: "PIKE",             spins: 1, tuck: 0.4, twist: 0.0, split: 0.0, entry: "stand",  leg: "pike",     arm: "reach"  },
  fullTwist:       { dur: 2.00, label: "FULL-TWIST",       spins: 1, tuck: 0.7, twist: 1.0, split: 0.0, entry: "stand",  leg: "tuck",     arm: "hug"    },
  halfTwist:       { dur: 2.00, label: "HALF-TWIST",       spins: 1, tuck: 0.8, twist: 0.5, split: 0.0, entry: "stand",  leg: "tuck",     arm: "hug"    },
  doubleFullTwist: { dur: 2.40, label: "DOUBLE-FULL",      spins: 2, tuck: 0.7, twist: 1.0, split: 0.0, entry: "stand",  leg: "tuck",     arm: "hug"    },
  corkscrew:       { dur: 2.20, label: "CORKSCREW",        spins: 1, tuck: 0.9, twist: 2.0, split: 0.0, entry: "stand",  leg: "tuck",     arm: "hug"    },
  splitLegFlip:    { dur: 1.90, label: "SPLIT-LEG",        spins: 1, tuck: 0.6, twist: 0.0, split: 1.0, entry: "stand",  leg: "split",    arm: "out"    },
  gainer:          { dur: 2.00, label: "GAINER",           spins: 1, tuck: 0.9, twist: 0.0, split: 0.0, entry: "run",    leg: "tuck",     arm: "hug"    },
  arabian:         { dur: 2.00, label: "ARABIAN",          spins: 1, tuck: 0.9, twist: 0.5, split: 0.0, entry: "stand",  leg: "tuck",     arm: "hug"    },
  oneArmFlip:      { dur: 1.90, label: "ONE-ARM",          spins: 1, tuck: 0.8, twist: 0.0, split: 0.0, entry: "stand",  leg: "tuck",     arm: "oneArm" },
  backFullDouble:  { dur: 2.40, label: "BACK-FULL DOUBLE", spins: 2, tuck: 0.7, twist: 1.0, split: 0.0, entry: "stand",  leg: "tuck",     arm: "hug"    },
  kickTheMoon:     { dur: 1.90, label: "KICK-THE-MOON",    spins: 1, tuck: 0.4, twist: 0.0, split: 0.0, entry: "stand",  leg: "kick",     arm: "out"    },
  xOut:            { dur: 2.00, label: "X-OUT",            spins: 1, tuck: 0.3, twist: 0.0, split: 1.0, entry: "stand",  leg: "split",    arm: "out"    },
  straddle:        { dur: 2.00, label: "STRADDLE",         spins: 1, tuck: 0.3, twist: 0.0, split: 1.4, entry: "stand",  leg: "split",    arm: "out"    },
  crouchEntry:     { dur: 1.90, label: "CROUCH ENTRY",     spins: 1, tuck: 1.0, twist: 0.0, split: 0.0, entry: "crouch", leg: "tuck",     arm: "hug"    },
  sprintDouble:    { dur: 2.30, label: "SPRINT DOUBLE",    spins: 2, tuck: 1.0, twist: 0.0, split: 0.0, entry: "run",    leg: "tuck",     arm: "hug"    },
  tripleCompact:   { dur: 2.90, label: "COMPACT TRIPLE",   spins: 3, tuck: 1.0, twist: 0.0, split: 0.0, entry: "stand",  leg: "tight",    arm: "hug"    },
};

/* merge flip durations + labels into the shared EMOTES lookup so the
   controller can pass any flip name through playEmote() without
   special-casing */
for (const name in FLIP_EMOTES) {
  const cfg = FLIP_EMOTES[name];
  EMOTES[name] = { dur: cfg.dur, label: cfg.label };
}

/* ── hand shapes: curl for [index, middle, ring, pinky] + thumb ─── */
export const HAND = {
  relaxed: { c: [0.16, 0.20, 0.26, 0.30], t: 0.12 },
  open:    { c: [0.02, 0.02, 0.04, 0.06], t: 0.00 },
  fist:    { c: [1, 1, 1, 1], t: 1 },
  peace:   { c: [0, 0, 1, 1], t: 0.7 },
  point:   { c: [0, 1, 1, 1], t: 0.9 },
  thumbs:  { c: [1, 1, 1, 1], t: 0 },
  mudra:   { c: [0.55, 0.12, 0.16, 0.20], t: 0.55 },
};

/* ── selfie poses (same keys / order as before, now with hand shapes) ─── */
export const SELFIE_POSES = {
  neutral: { emoji:"\uD83D\uDE10", label:"Neutral", short:"NEUTRAL", hand:"relaxed", apply:function(R){ R.head.rotation.z=0; R.head.rotation.y=0; R.spine.rotation.x=0; R.spine.rotation.z=0; } },
  smile:   { emoji:"\uD83D\uDE0A", label:"Smile",   short:"SMILE",   hand:"relaxed", apply:function(R){ R.head.rotation.z=-0.08; R.head.rotation.y=-0.05; R.spine.rotation.z=0.02; R.armL.shoulder.rotation.set(-0.35,0,-0.25); R.armL.elbow.rotation.set(-0.9,0,0); } },
  peace:   { emoji:"\u270C\uFE0F", label:"Peace",   short:"PEACE",   hand:"peace",   apply:function(R){ R.armL.shoulder.rotation.set(-2.05,-0.15,0.30); R.armL.elbow.rotation.set(-2.25,0,0); R.armL.wrist.rotation.set(0.15,0,0); R.head.rotation.z=0.10; R.head.rotation.y=-0.08; R.spine.rotation.z=-0.04; } },
  wave:    { emoji:"\uD83D\uDC4B", label:"Wave",    short:"WAVE",    hand:"open",    apply:function(R){ R.armL.shoulder.rotation.set(-2.20,0,0.55); R.armL.elbow.rotation.set(-0.45,0,0); R.armL.wrist.rotation.set(0.35,0,-0.20); R.head.rotation.y=0.15; R.spine.rotation.z=0.03; } },
  flex:    { emoji:"\uD83D\uDCAA", label:"Flex",    short:"FLEX",    hand:"fist",    apply:function(R){ R.armL.shoulder.rotation.set(-1.00,0,1.30); R.armL.elbow.rotation.set(-2.20,0,0); R.spine.rotation.x=-0.06; R.spine.rotation.z=0.02; R.head.rotation.z=0.05; } },
  kiss:    { emoji:"\uD83D\uDE18", label:"Kiss",    short:"KISS",    hand:"open",    apply:function(R){ R.armL.shoulder.rotation.set(-1.55,-0.30,0.10); R.armL.elbow.rotation.set(-2.35,0,0); R.armL.wrist.rotation.set(0.10,0.15,0); R.head.rotation.z=0.12; R.head.rotation.y=0.10; R.spine.rotation.z=0.03; } },
  thumbs:  { emoji:"\uD83D\uDC4D", label:"Thumbs",  short:"THUMBS",  hand:"thumbs",  apply:function(R){ R.armL.shoulder.rotation.set(-1.30,0,0.35); R.armL.elbow.rotation.set(-0.65,0,0); R.armL.wrist.rotation.set(-0.30,0,0); R.spine.rotation.z=0.02; R.head.rotation.z=-0.03; } },
  point:   { emoji:"\uD83D\uDC49", label:"Point",   short:"POINT",   hand:"point",   apply:function(R){ R.armL.shoulder.rotation.set(-1.60,0,0.15); R.armL.elbow.rotation.set(-0.15,0,0); R.armL.wrist.rotation.set(-0.20,0,0); R.head.rotation.y=-0.05; R.spine.rotation.z=0.02; } },
};
export const SELFIE_POSE_ORDER = ["neutral","smile","peace","wave","flex","kiss","thumbs","point"];

/* Apply a finger shape to one arm of the rig (side: +1 = left, -1 = right).
   Same curl convention as lowpoly.js setGrip(). Rig finger order is fixed in
   x, so the index finger is f0 on the left hand and f3 on the right. */
export function setHand(arm, side, shape) {
  if (!arm || !arm.fingers) return;
  const s = typeof shape === "string" ? HAND[shape] : shape;
  for (let f = 0; f < 4; f++) {
    const c = s.c[side > 0 ? f : 3 - f];
    arm.fingers[f].group.rotation.x = c * PI * 0.55;
    arm.fingers[f].midJoint.rotation.x = c * PI * 0.60;
  }
  if (arm.thumb) {
    arm.thumb.rotation.x = -s.t * 0.40;
    arm.thumb.rotation.z = -side * s.t * 0.70;
  }
}
/* helper for the controller's selfie overlay */
export function applySelfieHand(R, poseName) {
  const p = SELFIE_POSES[poseName];
  if (p && p.hand) setHand(R.armL, +1, p.hand);
}

/* ═══════════════ 2-bone leg IK (sagittal plane) ═══════════════
   Input : ankle position relative to the hip pivot (ty ≤ 0 is below, tz forward)
   Output: thigh / knee rotation.x (knee ≥ 0 bends the shin backward)       */
export function legIK(ty, tz, out) {
  out = out || {};
  let d = Math.hypot(ty, tz);
  const dmax = (L1 + L2) * 0.9995;
  if (d > dmax) { const k = dmax / d; ty *= k; tz *= k; d = dmax; }
  // FIX #180s — avoid the degenerate 0.14 / 1e-6 = 140000 fallback that
  // produced 1e5-magnitude ty / tz (survives into the read-back blend as
  // denormal drift). If we're already below the minimum leg length,
  // snap the ankle to a legal position instead of scaling up by 140000×.
  if (d < 0.14) {
    if (d < 1e-4) { ty = 0; tz = 0.14; d = 0.14; }
    else { const k = 0.14 / d; ty *= k; tz *= k; d = 0.14; }
  }
  const psi = Math.atan2(-tz, -ty);
  const knee = PI - Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
  const beta = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  out.thigh = psi - beta;
  out.knee = knee;
  return out;
}

/* Seated leg: the thigh may never slope DOWN into the cushion. If plain IK wants that
   (tall seat, short leg) the thigh is held just above level and the shin hangs / reaches
   the floor instead. drop = vertical distance hip→floor target, tz = how far forward the foot goes. */
const _sl = {};
export function sitLeg(drop, tz, out) {
  out = out || {};
  legIK(-drop, tz, _sl);
  let th = _sl.thigh, kn = _sl.knee;
  const LEVEL = -PI / 2 - 0.035;
  if (th > LEVEL) {
    th = LEVEL;
    for (let i = 0; i < 14; i++) {                       /* raise the thigh just enough that the shin can't overshoot the floor */
      const ky = -Math.cos(th) * L1, kz = -Math.sin(th) * L1;
      const vy = -drop - ky, vz = tz - kz;
      if (Math.hypot(vy, vz) >= L2 * 0.999 || th < _sl.thigh - 0.7) break;
      th -= 0.035;
    }
    const ky = -Math.cos(th) * L1, kz = -Math.sin(th) * L1;
    const vy = -drop - ky, vz = tz - kz;
    const sa = Math.atan2(-vz, -vy);
    kn = clamp(sa - th, 0.05, 2.4);
  }
  out.thigh = th; out.knee = kn;
  return out;
}

/* ═══════════════ pose container ═══════════════ */
function newPose() {
  return {
    hips: [0, 0, 0], hipsPos: [0, HIP_HEIGHT, 0],
    spine: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0],
    aL: { sh: [0, 0, 0], el: [0, 0, 0], wr: [0, RELAX_WRIST, 0] },
    aR: { sh: [0, 0, 0], el: [0, 0, 0], wr: [0, -RELAX_WRIST, 0] },
    lL: { hip: [0, 0, 0], knee: [0, 0, 0], ank: [0, 0, 0] },
    lR: { hip: [0, 0, 0], knee: [0, 0, 0], ank: [0, 0, 0] },
    hL: HAND.relaxed, hR: HAND.relaxed,
  };
}
/* Reset a pooled pose to defaults (avoids ~800k allocations/sec with many NPCs) */
function resetPose(P) {
  const z3 = (v) => { v[0] = 0; v[1] = 0; v[2] = 0; };
  /* emotes/arms() may have swapped in external arrays; restore our own first
     so we never zero someone else's data */
  const own = P._own || (P._own = {
    aLsh: P.aL.sh, aLel: P.aL.el, aLwr: P.aL.wr, aRsh: P.aR.sh, aRel: P.aR.el, aRwr: P.aR.wr,
  });
  P.aL.sh = own.aLsh; P.aL.el = own.aLel; P.aL.wr = own.aLwr;
  P.aR.sh = own.aRsh; P.aR.el = own.aRel; P.aR.wr = own.aRwr;
  z3(P.hips); z3(P.spine); z3(P.neck); z3(P.head);
  P.hipsPos[0] = 0; P.hipsPos[1] = HIP_HEIGHT; P.hipsPos[2] = 0;
  for (const arm of [P.aL, P.aR]) { z3(arm.sh); z3(arm.el); z3(arm.wr); }
  P.aL.wr[1] = RELAX_WRIST; P.aR.wr[1] = -RELAX_WRIST;
  for (const leg of [P.lL, P.lR]) { z3(leg.hip); z3(leg.knee); z3(leg.ank); }
  P.hL = HAND.relaxed; P.hR = HAND.relaxed;
  return P;
}
const set3 = (a, x, y, z) => { a[0] = x; a[1] = y; a[2] = z; };

/* Plant both feet with IK for a given pelvis height (flat feet, optional lift/forward offsets) */
const _ik = {};
function plantLeg(leg, hipsY, footZ, lift, extraAnkle) {
  const ty = (ANKLE_H + (lift || 0)) - (hipsY + PIVOT);
  legIK(ty, footZ || 0, _ik);
  set3(leg.hip, _ik.thigh, 0, 0);
  set3(leg.knee, _ik.knee, 0, 0);
  set3(leg.ank, -(_ik.thigh + _ik.knee) + (extraAnkle || 0), 0, 0);
}

/* ═══════════════ persistent animation state ═══════════════ */
function newState() {
  return {
    rig: null, init: false,
    px: 0, pz: 0, havePos: false, speed: 0, acc: 0, lastSpeed: 0,
    yaw: 0, yawRate: 0, haveYaw: false,
    u: 0, moveAmt: 0, runAmt: 0,
    airborne: false, lastVy: 0, land: 0,
    key: "", bs: 1,
    useTotal: 1.2, lastUse: 0,
    idleT: 0, breathT: 0,
    S: null, SH: [0, HIP_HEIGHT, 0], joints: null,
    _P: newPose(), _Pn: newPose(),
  };
}

/* all joints that get blended (cached per rig) */
function collectJoints(R) {
  const J = [R.hips, R.spine, R.neck, R.head];
  for (const arm of [R.armL, R.armR]) {
    J.push(arm.shoulder, arm.elbow, arm.wrist);
    if (arm.thumb) J.push(arm.thumb);
    if (arm.fingers) for (const f of arm.fingers) J.push(f.group, f.midJoint);
  }
  for (const leg of [R.legL, R.legR]) J.push(leg.hip, leg.knee, leg.ank || leg.ankle);
  return J.filter(Boolean);
}

/* ═══════════════ locomotion (IK gait) ═══════════════ */
const _fp = { z: 0, lift: 0, ank: 0, w: 0, len: 0 };
/* foot path for one leg. u in [0,1): 0 = heel strike. Returns into _fp */
function footPath(u, d, S, vrel, f, hc, lenBase) {
  if (u < d) {                                   /* ── stance ── */
    const s = u / d;
    _fp.z = lerp(S / 2, -S / 2, s);
    const pfS = sstep((s - 0.72) / 0.28);        /* heel rises late in stance */
    const pf = 0.5 * pfS;
    _fp.lift = 0.16 * Math.sin(pf);
    _fp.ank = -0.20 * (1 - sstep(s / 0.25)) + pf;
    _fp.w = sstep(s / 0.10) * (1 - sstep((s - 0.88) / 0.12));
    _fp.len = lenBase + 0.025 * Math.cos(PI * s);
  } else {                                       /* ── swing ── */
    const s = (u - d) / (1 - d);
    const Tsw = (1 - d) / Math.max(f, 1e-3);
    const m = -vrel * Tsw * 0.42;                /* partially match stance speed at both ends */
    const s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    _fp.z = h00 * (-S / 2) + h10 * m + h01 * (S / 2) + h11 * m;
    const pfDecay = 0.5 * (1 - sstep(s / 0.35));
    _fp.lift = 0.16 * Math.sin(pfDecay) * (1 - sstep(s / 0.35)) + hc * Math.pow(Math.sin(PI * s), 1.2);
    _fp.ank = lerp(pfDecay, -0.20, sstep(s)) - 0.12 * Math.sin(PI * s);
    _fp.w = 0;
    _fp.len = lenBase;
  }
  return _fp;
}

/* cycle parameters derived from ground speed (shared by phase accumulation + pose) */
function gaitParams(v, runAmt, crouching) {
  const d = lerp(0.62, 0.38, runAmt);                          /* duty factor */
  const S = clamp(0.40 + 0.17 * v, 0.40, 1.05) * (crouching ? 0.85 : 1);   /* ankle travel (m) */
  const rock = lerp(0.22, 0.10, runAmt);                       /* extra ankle travel over the ground */
  const f = (v * d) / (S + rock);                              /* cycle frequency, Hz */
  return { d, S, rock, f, vrel: (S * f) / d };
}

function locomotion(a, ctl, P, crouching) {
  const v = a.speed, runAmt = a.runAmt, mv = a.moveAmt;
  const baseLen = crouching ? CROUCH_LEN : STAND_LEN;

  /* idle / loco blend of pelvis height */
  let gaitLen = crouching ? CROUCH_LEN + 0.01 : lerp(0.800, 0.765, runAmt);
  const landDip = 0.17 * a.land;

  /* cycle parameters from speed */
  const { d, S, f, vrel } = gaitParams(v, runAmt, crouching);
  const hc = lerp(0.05, 0.16, runAmt) * (crouching ? 0.6 : 1);

  const uL = a.u, uR = wrap1(a.u + 0.5);
  const snap = (p) => ({ z: p.z, lift: p.lift, ank: p.ank, w: p.w, len: p.len });
  const pl = [snap(footPath(uL, d, S, vrel, f, hc, gaitLen)), snap(footPath(uR, d, S, vrel, f, hc, gaitLen))];

  /* pelvis height: follows the stance leg(s); in flight rises to an apex */
  let wsum = 0, hsum = 0;
  for (const p of pl) {
    const l = Math.min(p.len, 0.8198);
    const hreq = ANKLE_H + p.lift + Math.sqrt(Math.max(l * l - p.z * p.z, 0.04));
    wsum += p.w; hsum += p.w * hreq;
  }
  const apex = ANKLE_H + gaitLen * 0.995 + 0.025 * runAmt;
  const ff = 1 - Math.min(1, wsum);
  const pivotGait = wsum > 1e-4 ? lerp(hsum / wsum, apex, ff) : apex;
  const pivotStand = ANKLE_H + baseLen - landDip;
  const pivot = lerp(pivotStand, pivotGait - landDip * mv, mv);
  const hipsY = pivot - PIVOT;
  P.hipsPos[1] = hipsY;

  /* legs: blend standing IK and gait IK */
  const sides = [[P.lL, pl[0]], [P.lR, pl[1]]];
  for (const [leg, p] of sides) {
    plantLeg(leg, hipsY, 0, 0, 0);                      /* standing */
    const sx = [leg.hip[0], leg.knee[0], leg.ank[0]];
    const ty = (ANKLE_H + p.lift) - (hipsY + PIVOT);
    legIK(ty, p.z, _ik);
    const gx = [_ik.thigh, _ik.knee, -(_ik.thigh + _ik.knee) + p.ank];
    leg.hip[0] = lerp(sx[0], gx[0], mv);
    leg.knee[0] = lerp(sx[1], gx[1], mv);
    leg.ank[0] = lerp(sx[2], gx[2], mv);
  }

  /* arms swing opposite to the same-side leg */
  const cL = Math.cos(TAU * uL), cR = Math.cos(TAU * uR);
  const armAmp = lerp(0.28, 0.95, sstep((v - 0.6) / 4.2)) * mv;
  const flexB = lerp(0.22, 1.20, runAmt);
  for (const [arm, c, side] of [[P.aL, cL, 1], [P.aR, cR, -1]]) {
    arm.sh[0] = c * armAmp;
    arm.sh[2] = side * (0.07 + 0.05 * runAmt);
    arm.el[0] = -(0.12 + (flexB - 0.12) * mv + 0.35 * runAmt * Math.max(0, -c) * mv);
  }

  /* torso: counter-rotation, forward lean, bob */
  const lean = (0.03 + 0.17 * runAmt) * mv + clamp(a.acc * 0.012, -0.06, 0.10) + 0.55 * a.land;
  const twist = cL * mv;
  P.hips[1] = -0.08 * twist;
  P.spine[0] = lean;
  P.spine[1] = 0.17 * twist;
  P.spine[2] = -clamp(a.yawRate * 0.045, -0.18, 0.18) * (0.35 + 0.65 * runAmt) * Math.max(mv, 0.25);
  P.head[0] = -lean * 0.75;
  P.head[1] = -(P.hips[1] + P.spine[1]) * 0.9 + clamp(a.yawRate * 0.05, -0.25, 0.25);
  if (crouching) { P.spine[0] += 0.22; P.head[0] -= 0.12; }
  P.hips[2] = 0.025 * Math.sin(TAU * uL) * mv;           /* gentle pelvis roll */
}

/* idle micro-motion (breathing, weight settle, head look) added on top of the standing pose */
function idleLayer(a, P, amt) {
  const b = Math.sin(a.breathT * 1.7);
  P.spine[0] += b * 0.014 * amt;
  P.aL.sh[2] += b * 0.012 * amt; P.aR.sh[2] -= b * 0.012 * amt;
  P.head[1] += Math.sin(a.idleT * 0.45) * 0.14 * amt;
  P.head[0] += Math.sin(a.idleT * 0.31 + 1.0) * 0.03 * amt;
  P.hips[2] += Math.sin(a.idleT * 0.35) * 0.012 * amt;
}

/* ═══════════════ airborne ═══════════════ */
function airPose(a, ctl, P) {
  const vy = ctl.vel ? ctl.vel.y : 0;
  const j = (clamp(vy / 4.0, -1, 1) + 1) * 0.5;       /* 1 = rising, 0 = falling */
  const th = [-0.30 + (-0.88 + 0.30) * j, -0.30 + (-0.88 + 0.30) * j];
  const kn = [0.35 + (1.30 - 0.35) * j, 0.35 + (1.30 - 0.35) * j];
  th[0] += -0.18; th[1] += 0.24; kn[0] += 0.28; kn[1] += -0.16;
  const an = -0.16 + (0.46 + 0.16) * j;
  set3(P.lL.hip, th[0], 0, 0); set3(P.lL.knee, kn[0], 0, 0); set3(P.lL.ank, an, 0, 0);
  set3(P.lR.hip, th[1], 0, 0); set3(P.lR.knee, kn[1], 0, 0); set3(P.lR.ank, an, 0, 0);
  const sw = -0.50 + (-2.10 + 0.50) * j, el = -0.90 + (-0.35 + 0.90) * j, sp = 0.55 + (0.25 - 0.55) * j;
  set3(P.aL.sh, sw, 0, sp); set3(P.aR.sh, sw * 0.92, 0, -sp);
  set3(P.aL.el, el, 0, 0); set3(P.aR.el, el, 0, 0);
  P.hipsPos[1] = HIP_HEIGHT;
  P.spine[0] = 0.08 - 0.10 * j; P.head[0] = -0.05;
  P.hL = HAND.open; P.hR = HAND.open;
}

/* ═══════════════ seated / lying / bath ═══════════════ */
function seatedPose(a, ctl, P) {
  const st = ctl.state;
  if (st === "sitting" || st === "seated") {
    P.hipsPos[1] = HIP_HEIGHT;
    let H = 0.47;
    try {
      if (ctl.sitTarget) {
        const g = ctl._groundInfo ? ctl._groundInfo(ctl.sitTarget.x, ctl.sitTarget.z, ctl.level) : { y: 0 };
        H = ctl.sitTarget.h - g.y;
      }
    } catch (e) { /* keep default */ }
    const tz = H > 0.38 ? 0.30 : lerp(0.55, 0.30, clamp((H - 0.20) / 0.18, 0, 1));
    for (const leg of [P.lL, P.lR]) {
      sitLeg(H - 0.015, tz, _ik);
      set3(leg.hip, _ik.thigh, 0, 0); set3(leg.knee, _ik.knee, 0, 0);
      set3(leg.ank, -(_ik.thigh + _ik.knee), 0, 0);
    }
    set3(P.aL.sh, -0.15, 0, 0.12); set3(P.aR.sh, -0.15, 0, -0.12);
    P.aL.sh[2] = -0.10; P.aR.sh[2] = 0.10;
    set3(P.aL.el, -1.45, 0, 0); set3(P.aR.el, -1.45, 0, 0);
    P.spine[0] = 0.06;
    P.hL = HAND.relaxed; P.hR = HAND.relaxed;
    idleLayer(a, P, 0.7);
  } else if (st === "kneel") {
    /* kneeling prayer: shins on the carpet, torso upright and bowed slightly, hands raised */
    P.hipsPos[1] = 0.50;
    for (const leg of [P.lL, P.lR]) { set3(leg.hip, -0.15, 0, 0); set3(leg.knee, 1.55, 0, 0); set3(leg.ank, 0.6, 0, 0); }
    P.spine[0] = 0.25;
    set3(P.aL.sh, -0.9, 0.2, 0.15); set3(P.aR.sh, -0.9, -0.2, -0.15);
    set3(P.aL.el, -1.3, 0, 0); set3(P.aR.el, -1.3, 0, 0);
    P.hL = HAND.open || HAND.relaxed; P.hR = HAND.open || HAND.relaxed;
    idleLayer(a, P, 0.4);
  } else if (st === "lying") {
    set3(P.hips, -PI / 2, 0, 0);
    set3(P.spine, 0, 0, 0);   /* torso flat: no counter-rotation */
    set3(P.head, 0.10, 0, 0);
    P.hipsPos[1] = 0.16;
    let roll = 0, armLX = -0.04, armRX = -0.04, armLz = 0.14, armRz = -0.14;
    let elL = -0.08, elR = -0.08, hipLX = 0.02, hipRX = 0.02, kneeLX = 0.05, kneeRX = 0.05;
    switch (ctl.liePose) {
      case "side": roll = PI / 2; armLX = -0.45; armRX = -0.45; armLz = 0.05; armRz = -0.05; elL = -0.55; elR = -0.55; kneeLX = 0.55; kneeRX = 0.55; break;
      case "hand_pillow": armLX = -2.3; armLz = 0.55; elL = -1.5; armRX = -0.35; armRz = -0.05; elR = -0.9; break;
      case "hands_behind": armLX = -2.3; armLz = 0.55; elL = -1.5; armRX = -2.3; armRz = -0.55; elR = -1.5; break;
      case "curled": roll = PI / 2; hipLX = 0.85; hipRX = 0.85; kneeLX = 1.85; kneeRX = 1.85; armLX = -0.9; elL = -1.35; break;
    }
    let extra = ctl.lieRoll || 0;
    extra = Math.atan2(Math.sin(extra), Math.cos(extra));
    P.hips[1] = roll + extra;
    P.lL.hip[0] = hipLX; P.lR.hip[0] = hipRX; P.lL.knee[0] = kneeLX; P.lR.knee[0] = kneeRX;
    P.aL.sh[0] = armLX; P.aR.sh[0] = armRX; P.aL.sh[2] = armLz; P.aR.sh[2] = armRz;
    P.aL.el[0] = elL; P.aR.el[0] = elR;
    P.spine[0] += Math.sin(a.breathT * 1.3) * 0.012;
  } else if (st === "bathing") {
    P.hipsPos[1] = HIP_HEIGHT * 0.38;
    P.spine[0] = -0.35;
    P.lL.hip[0] = P.lR.hip[0] = -1.1; P.lL.knee[0] = P.lR.knee[0] = 1.6;
    P.aL.sh[0] = P.aR.sh[0] = -0.2;
    idleLayer(a, P, 0.5);
  }
}

/* ═══════════════ emotes ═══════════════ */
function mirror(v) { return [v[0], -v[1], -v[2]]; }
function arms(P, shL, elL, wrL, shR, elR, wrR) {
  P.aL.sh = shL; P.aL.el = elL; P.aL.wr = wrL;
  P.aR.sh = shR || mirror(shL); P.aR.el = elR || mirror(elL); P.aR.wr = wrR || mirror(wrL);
}

function standAt(P, ell, liftL, liftR, zL, zR) {
  const hipsY = ANKLE_H + ell - PIVOT;
  P.hipsPos[1] = hipsY;
  plantLeg(P.lL, hipsY, zL || 0, liftL || 0, 0);
  plantLeg(P.lR, hipsY, zR || 0, liftR || 0, 0);
}

const EMOTE_FN = {
  wave(t, P, a) {
    const k = sstep(t / 0.35);
    const w = Math.sin(t * 9.5) * 0.38 * k;
    standAt(P, 0.812);
    P.aR.sh = [lerp(0, 0.20, k), 0, lerp(-0.07, -1.315, k)];
    P.aR.el = [0, 0, lerp(-0.12, -1.814, k) + w];
    P.aR.wr = [0, lerp(-RELAX_WRIST, 3.0, k), Math.sin(t * 9.5 + 0.8) * 0.20 * k];
    P.aL.sh = [0.04, 0, 0.09 + Math.sin(t * 1.9) * 0.01]; P.aL.el = [-0.18, 0, 0];
    P.hR = HAND.open;
    P.spine[2] = -0.03 * k + Math.sin(t * 2.0) * 0.012; P.spine[1] = 0.06 * k;
    P.head[1] = -0.18 * k; P.head[2] = 0.07 * k;
    P.hips[2] = 0.02 * k;
  },

  clap(t, P, a) {
    const f = 2.4, ph = wrap1(t * f);
    const cl = ph < 0.30 ? Math.pow(ph / 0.30, 1.6) : ph < 0.40 ? 1 : 1 - sstep((ph - 0.40) / 0.60);
    const open = [-0.383, 0.231, -0.102], shut = [-0.355, -0.145, -0.433];
    const elO = -1.78, elC = -1.605, wrO = 1.25, wrC = 1.25;
    const sh = [0, 1, 2].map(i => lerp(open[i], shut[i], cl));
    const raise = sstep(t / 0.3);
    const L = { sh: [lerp(-0.1, sh[0], raise), lerp(0, sh[1], raise), lerp(0.09, sh[2], raise)], el: [lerp(-0.2, lerp(elO, elC, cl), raise), 0, 0], wr: [0, lerp(RELAX_WRIST, lerp(wrO, wrC, cl), raise), 0] };
    arms(P, L.sh, L.el, L.wr);
    const hit = cl > 0.92 ? 1 : 0;
    standAt(P, 0.806 - 0.012 * hit);
    P.spine[0] = 0.04 + 0.03 * hit; P.head[0] = -0.04 - 0.03 * hit;
    P.hips[2] = Math.sin(t * f * PI) * 0.015;
    P.hL = HAND.open; P.hR = HAND.open;
  },

  flex(t, P, a) {
    const k = sstep(t / 0.4);
    const pulse = 0.5 + 0.5 * Math.sin(t * 6.0 - 1.2);
    const sh = [lerp(0, -0.10, k) - 0.03 * pulse * k, 0, lerp(0.09, 1.50, k) + 0.04 * pulse * k];
    const el = [0, 0, lerp(0.1, 2.15, k) + 0.10 * pulse * k];
    const wr = [0, lerp(RELAX_WRIST, -1.4, k), 0];
    arms(P, sh, el, wr);
    standAt(P, 0.795);
    P.lL.hip[2] = 0.15 * k; P.lR.hip[2] = -0.15 * k;
    P.spine[0] = -0.09 * k - 0.03 * pulse * k; P.head[0] = 0.06 * k;
    P.spine[1] = Math.sin(t * 1.5) * 0.06 * k;
    P.head[2] = Math.sin(t * 1.5) * 0.05 * k;
    P.hL = HAND.fist; P.hR = HAND.fist;
  },

  meditate(t, P, a) {
    const k = sstep(t / 0.9);
    const breath = Math.sin(t * 1.7);
    P.hipsPos[1] = lerp(HIP_HEIGHT, HIPS_MEDITATE, k);
    const hipL = [-2.4, 0.855, 1.255], kn = 2.543;
    P.lL.hip = [lerp(0, hipL[0], k), lerp(0, hipL[1], k), lerp(0, hipL[2], k)];
    P.lR.hip = [P.lL.hip[0], -P.lL.hip[1], -P.lL.hip[2]];
    P.lL.knee = [lerp(0, kn, k), 0, 0]; P.lR.knee = [P.lL.knee[0], 0, 0];
    P.lL.ank = [lerp(0, 0.35, k), 0, 0]; P.lR.ank = [P.lL.ank[0], 0, 0];
    const sh = [-0.313, 0.487, 0.126], el = [-0.81, 0, 0], wr = [0, PI, 0];
    arms(P,
      [lerp(0, sh[0], k), lerp(0, sh[1], k), lerp(0.09, sh[2], k)],
      [lerp(-0.1, el[0], k), 0, 0],
      [0, lerp(RELAX_WRIST, PI, k), 0],
      [lerp(0, sh[0], k), -lerp(0, sh[1], k), -lerp(0.09, sh[2], k)],
      [lerp(-0.1, el[0], k), 0, 0],
      [0, -lerp(RELAX_WRIST, PI, k), 0]);
    P.spine[0] = 0.05 * k + breath * 0.016 * k;
    P.head[0] = 0.07 * k + breath * 0.01; P.head[1] = Math.sin(t * 0.6) * 0.03;
    P.aL.sh[2] += breath * 0.01; P.aR.sh[2] -= breath * 0.01;
    P.hL = HAND.mudra; P.hR = HAND.mudra;
  },

  dance(t, P, a) {
    const k = sstep(t / 0.4);
    const b = t * 2.0;
    const down = 0.5 + 0.5 * Math.cos(TAU * b);
    const sway = Math.sin(PI * b);
    const ell = 0.806 - 0.055 * down * k;
    const liftL = Math.max(0, sway) * 0.045 * k, liftR = Math.max(0, -sway) * 0.045 * k;
    standAt(P, ell, liftL, liftR, 0.02 * Math.max(0, sway) * k, 0.02 * Math.max(0, -sway) * k);
    P.hipsPos[0] = sway * 0.035 * k;
    P.hips[1] = -sway * 0.20 * k; P.hips[2] = sway * 0.05 * k;
    P.spine[1] = sway * 0.32 * k; P.spine[0] = 0.05 * k + 0.04 * down * k; P.spine[2] = -sway * 0.05 * k;
    P.head[0] = -0.04 + 0.07 * (1 - down) * k; P.head[1] = -(P.hips[1] + P.spine[1]) * 0.8; P.head[2] = sway * 0.07 * k;
    const phrase = Math.floor(t / 2) % 2;
    if (phrase === 0) {
      const pumpL = Math.sin(PI * b), pumpR = -pumpL;
      arms(P,
        [-0.85 + pumpL * 0.55, 0, 0.18], [-1.35 - pumpL * 0.35, 0, 0], [0, RELAX_WRIST, 0],
        [-0.85 + pumpR * 0.55, 0, -0.18], [-1.35 - pumpR * 0.35, 0, 0], [0, -RELAX_WRIST, 0]);
      P.hL = HAND.fist; P.hR = HAND.fist;
    } else {
      const up = 0.5 + 0.5 * Math.cos(TAU * b);
      arms(P,
        [-2.35 + up * 0.25, 0.35, 0.28], [-0.55 - up * 0.25, 0, 0], [0, 0, 0],
        [-2.35 + up * 0.25, -0.35, -0.28], [-0.55 - up * 0.25, 0, 0], [0, 0, 0]);
      P.hL = HAND.open; P.hR = HAND.open;
    }
    if (k < 1) {
      P.aL.sh = P.aL.sh.map((x, i) => lerp(i === 2 ? 0.09 : 0, x, k));
      P.aR.sh = P.aR.sh.map((x, i) => lerp(i === 2 ? -0.09 : 0, x, k));
    }
  },
};

/* ═══════════════ BACKFLIP SOLVERS ═══════════════ */

/* Lateral leg spread for split-flips (hip Z rotation ±ab). */
function applyFlipLegs(P, tuck, style, split) {
  if (style === "straight") {
    P.lL.hip = [-0.10, 0, 0];  P.lR.hip = [-0.10, 0, 0];
    P.lL.knee = [0.10, 0, 0];  P.lR.knee = [0.10, 0, 0];
    P.lL.ank = [0, 0, 0];      P.lR.ank = [0, 0, 0];
  } else if (style === "pike") {
    P.lL.hip = [-1.30 * tuck, 0, 0]; P.lR.hip = [-1.30 * tuck, 0, 0];
    P.lL.knee = [0.15 * tuck, 0, 0]; P.lR.knee = [0.15 * tuck, 0, 0];
    P.lL.ank = [0.10 * tuck, 0, 0];  P.lR.ank = [0.10 * tuck, 0, 0];
  } else if (style === "split") {
    const ab = split * 0.55 * (tuck + 0.30);
    P.lL.hip = [-0.35 * tuck, 0,  ab];  P.lR.hip = [-0.35 * tuck, 0, -ab];
    P.lL.knee = [0.40 * tuck, 0, 0];    P.lR.knee = [0.40 * tuck, 0, 0];
    P.lL.ank = [0.15 * tuck, 0, 0];     P.lR.ank = [0.15 * tuck, 0, 0];
  } else if (style === "kick") {
    P.lL.hip = [-1.60 * tuck, 0, 0.15]; P.lL.knee = [1.90 * tuck, 0, 0];
    P.lL.ank = [0.30 * tuck, 0, 0];
    P.lR.hip = [-0.60 * tuck, 0, -0.10]; P.lR.knee = [0.10, 0, 0];
    P.lR.ank = [0.15, 0, 0];
  } else if (style === "tight") {
    P.lL.hip = [-1.85 * tuck, 0, 0.10]; P.lR.hip = [-1.85 * tuck, 0, -0.10];
    P.lL.knee = [2.20 * tuck, 0, 0];    P.lR.knee = [2.20 * tuck, 0, 0];
    P.lL.ank = [0.40 * tuck, 0, 0];     P.lR.ank = [0.40 * tuck, 0, 0];
  } else {
    /* default: full tuck */
    P.lL.hip = [-1.70 * tuck, 0, 0];  P.lR.hip = [-1.70 * tuck, 0, 0];
    P.lL.knee = [2.05 * tuck, 0, 0];  P.lR.knee = [2.05 * tuck, 0, 0];
    P.lL.ank = [0.35 * tuck, 0, 0];   P.lR.ank = [0.35 * tuck, 0, 0];
  }
}

/* Arms: hug the knees, reach overhead, splay out wide, or single-arm. */
function applyFlipArms(P, armUp, armOut, tuck, style) {
  if (style === "oneArm") {
    P.aL.sh = [-1.30 * tuck - 0.15 * (1 - tuck), 0,  0.20 * tuck];
    P.aL.el = [-1.65 * tuck, 0, 0];
    P.aL.wr = [0, RELAX_WRIST * (1 - tuck) + PI * 0.5 * tuck, 0];
    P.aR.sh = [-0.15 - armUp * 1.80, 0, -0.55 - armOut * 0.50];
    P.aR.el = [-0.25 - armUp * 0.40, 0, 0];
    P.aR.wr = [0, -RELAX_WRIST * (1 - armUp), 0];
    P.hL = HAND.fist; P.hR = HAND.open;
    return;
  }
  if (style === "hug" && tuck > 0.15) {
    const h = tuck;
    const shX = -1.40 * h - 0.10 * (1 - h);
    const shZ =  0.22 * h + 0.10 * (1 - h);
    const elX = -1.70 * h - 0.15 * (1 - h);
    P.aL.sh = [shX, 0,  shZ];  P.aR.sh = [shX, 0, -shZ];
    P.aL.el = [elX, 0, 0];     P.aR.el = [elX, 0, 0];
    P.aL.wr = [0,  RELAX_WRIST * (1 - h), 0];
    P.aR.wr = [0, -RELAX_WRIST * (1 - h), 0];
    P.hL = P.hR = HAND.fist;
  } else if (style === "reach") {
    const shX = -0.15 - armUp * 2.40;
    const shZ =  0.10 + armOut * 0.35;
    P.aL.sh = [shX, 0,  shZ];  P.aR.sh = [shX, 0, -shZ];
    P.aL.el = [-0.20 - armUp * 0.30, 0, 0];
    P.aR.el = [-0.20 - armUp * 0.30, 0, 0];
    P.aL.wr = [0,  RELAX_WRIST, 0];
    P.aR.wr = [0, -RELAX_WRIST, 0];
    P.hL = P.hR = HAND.open;
  } else {
    /* out: arms wide for balance (layout, x-out, straddle) */
    const shX = -0.15 - armUp * 1.80;
    const shZ =  0.10 + armOut * 0.70;
    P.aL.sh = [shX, 0,  shZ];  P.aR.sh = [shX, 0, -shZ];
    P.aL.el = [-0.15 - armUp * 0.30, 0, 0];
    P.aR.el = [-0.15 - armUp * 0.30, 0, 0];
    P.aL.wr = [0,  RELAX_WRIST, 0];
    P.aR.wr = [0, -RELAX_WRIST, 0];
    P.hL = P.hR = HAND.open;
  }
}

/* Full flip: hips follow a real parabola in Y, body rotates backward
   around the pelvis X axis, then plants the feet with IK on landing.

   Timeline (fractions of cfg.dur):
     0.00–0.10   anticipation crouch (entry pose)
     0.10–0.20   explosive leg extension (knee spring)
     0.20–0.75   airborne — parabolic pelvis + rotation + tuck
     0.75–0.90   landing — IK feet back on ground, absorb impact
     0.90–1.00   recover to neutral
*/
function flipPose(t, P, a, cfg) {
  const T = cfg.dur;
  const p = clamp(t / T, 0, 1);

  const T_ANTIC  = 0.10;
  const T_LAUNCH = 0.20;
  const T_AIR    = 0.75;
  const T_LAND   = 0.90;

  const SPINS  = cfg.spins || 1;
  const TWIST  = cfg.twist || 0;
  const TUCK   = cfg.tuck != null ? cfg.tuck : 1;
  const SPLIT  = cfg.split || 0;
  const ENTRY  = cfg.entry || "stand";
  const LEG    = cfg.leg || "tuck";
  const ARM    = cfg.arm || "hug";

  /* derive v0 + peak height from the airtime the config asks for */
  const airFrac = T_AIR - T_LAUNCH;
  const airTime = T * airFrac;
  const HMAX    = FLIP_G * airTime * airTime / 8;

  let hipsY = HIP_HEIGHT;
  let hipsRot = 0, twistRot = 0;
  let crouch = 0, tuck = 0;
  let armUp = 0.20, armOut = 0.35;
  let spineX = 0;
  let airborne = false;

  if (p < T_ANTIC) {
    /* ── anticipation crouch ─────────────────────────────────── */
    const k = sstep(p / T_ANTIC);
    const depth = ENTRY === "crouch" ? 0.55 : ENTRY === "run" ? 0.15 : 0.35;
    crouch = depth * k;
    armUp = 0.10 * k;
    armOut = 0.35 + 0.50 * k;
    spineX = (ENTRY === "run" ? 0.20 : 0.10) * k;
  } else if (p < T_LAUNCH) {
    /* ── explosive extension (knee spring) ───────────────────── */
    const k = (p - T_ANTIC) / (T_LAUNCH - T_ANTIC);
    const kk = k * k;                  /* quadratic ramp = accelerating push */
    const depth = ENTRY === "crouch" ? 0.55 : ENTRY === "run" ? 0.15 : 0.35;
    crouch = depth * (1 - kk);
    armUp = 0.10 + 0.70 * kk;
    armOut = 0.85 - 0.50 * k;
    spineX = (ENTRY === "run" ? 0.20 : 0.10) * (1 - k);
  } else if (p < T_AIR) {
    /* ── airborne ────────────────────────────────────────────── */
    airborne = true;
    const tau = (p - T_LAUNCH) / airFrac;
    hipsY = HIP_HEIGHT + 4 * HMAX * tau * (1 - tau);   /* real parabola */
    hipsRot = -TAU * SPINS * tau;                      /* backward */
    twistRot = TAU * TWIST * tau;
    tuck = Math.sin(PI * tau) * TUCK;                  /* 0 → 1 → 0 */
    armUp = 0.60 * tuck + 0.20;
    armOut = 0.85 - 0.60 * tuck;
    spineX = 0.70 * tuck;
  } else if (p < T_LAND) {
    /* ── landing absorb (feet back on ground, IK) ────────────── */
    const k = sstep((p - T_AIR) / (T_LAND - T_AIR));
    crouch = 0.45 * k;
    hipsRot = -TAU * SPINS;          /* visually identical to 0 */
    twistRot = lerp(TAU * TWIST, Math.round(TWIST) * TAU, k);
    armUp = 0.20 * (1 - k);
    armOut = 0.85 * (1 - k) + 0.15 * k;
    spineX = 0.20 * k;
  } else {
    /* ── recover to neutral ──────────────────────────────────── */
    const k = sstep((p - T_LAND) / (1 - T_LAND));
    crouch = 0.45 * (1 - k);
    hipsRot = -TAU * SPINS;
    twistRot = Math.round(TWIST) * TAU;
    armUp = 0;
    armOut = 0.35;
    spineX = 0;
  }

  /* pelvis + torso */
  P.hipsPos[1] = airborne ? hipsY : (HIP_HEIGHT - crouch);
  P.hips[0] = hipsRot;
  P.hips[1] = twistRot;
  P.spine[0] = spineX;
  P.head[0] = -spineX * 0.5 + 0.05;

  /* legs */
  if (airborne) {
    applyFlipLegs(P, tuck, LEG, SPLIT);
  } else {
    plantLeg(P.lL, P.hipsPos[1], 0, 0, 0);
    plantLeg(P.lR, P.hipsPos[1], 0, 0, 0);
  }

  /* arms */
  applyFlipArms(P, armUp, armOut, tuck, ARM);
}

/* register every flip into EMOTE_FN so the state machine can run them */
for (const name in FLIP_EMOTES) {
  const cfg = FLIP_EMOTES[name];
  EMOTE_FN[name] = function (t, P, a) { flipPose(t, P, a, cfg); };
}

registerWrestlingEmotes(EMOTES, EMOTE_FN);

/* ═══════════════ EVERYDAY-LIFE POSES (interior NPCs + player) ═══════════════
   sit_ground · pray (bless food) · eat · hug · handshake · lean_table
   Long ones (sit_ground / lean_table) hold until the character moves. */
EMOTES.sit_ground = { dur: 60, label: "SITTING" };
EMOTES.pray       = { dur: 4.5, label: "PRAYING" };
EMOTES.eat        = { dur: 7.0, label: "EATING" };
EMOTES.hug        = { dur: 4.0, label: "HUGGING" };
EMOTES.handshake  = { dur: 3.0, label: "HANDSHAKE" };
EMOTES.lean_table = { dur: 60, label: "LEANING" };

Object.assign(EMOTE_FN, {
  /* sitting on the floor, knees up, arms resting on the knees */
  sit_ground(t, P, a) {
    const k = sstep(t / 0.8), br = Math.sin(t * 1.6);
    P.hipsPos[1] = lerp(HIP_HEIGHT, 0.17, k);
    for (const leg of [P.lL, P.lR]) {
      set3(leg.hip, lerp(0, -2.35, k), 0, 0);
      set3(leg.knee, lerp(0, 1.95, k), 0, 0);
      set3(leg.ank, lerp(0, 0.40, k), 0, 0);
    }
    P.lL.hip[1] = 0.10 * k; P.lR.hip[1] = -0.10 * k;
    arms(P, [lerp(0, -0.85, k), 0.15 * k, 0.12 * k], [lerp(0, -1.15, k), 0, 0], [0, RELAX_WRIST, 0]);
    P.spine[0] = 0.10 * k + br * 0.012;
    P.head[0] = -0.05 * k; P.head[1] = Math.sin(t * 0.5) * 0.10 * k;
    P.hL = HAND.relaxed; P.hR = HAND.relaxed;
  },

  /* palms pressed together at the chest, head bowed — blessing the food */
  pray(t, P, a) {
    const k = sstep(t / 0.5);
    standAt(P, 0.812);
    const sh = [-0.36, -0.15, -0.43], el = -1.62;
    arms(P,
      [lerp(0, sh[0], k), lerp(0, sh[1], k), lerp(0.09, sh[2], k)],
      [lerp(-0.2, el, k), 0, 0],
      [0, lerp(RELAX_WRIST, 1.25, k), 0]);
    P.spine[0] = 0.12 * k; P.head[0] = 0.42 * k + Math.sin(t * 1.3) * 0.015;
    P.hL = HAND.open; P.hR = HAND.open;
  },

  /* right hand carries food to the mouth, left hand holds the plate */
  eat(t, P, a) {
    const k = sstep(t / 0.4);
    const m = 0.5 + 0.5 * Math.sin(t * 3.2);          /* 0 plate → 1 mouth */
    standAt(P, 0.812);
    P.aL.sh = [lerp(0, -0.95, k), 0.10 * k, 0.18 * k]; P.aL.el = [lerp(-0.18, -1.35, k), 0, 0];
    P.aR.sh = [lerp(0, lerp(-0.75, -1.45, m), k), -0.25 * k, -0.10 * k];
    P.aR.el = [lerp(-0.12, lerp(-1.25, -2.30, m), k), 0, 0];
    P.aR.wr = [0, -RELAX_WRIST, 0];
    P.spine[0] = 0.07 * k; P.head[0] = (0.10 + 0.14 * (1 - m)) * k;
    P.hL = HAND.open; P.hR = HAND.relaxed;
  },

  /* embrace: torsos close, both arms wrap around the partner's back, heads turn to
     the same side (cheek by cheek, never face to face), a slow squeeze and gentle sway */
  hug(t, P, a) {
    const k = sstep(t / 0.7), sway = Math.sin(t * 1.6) * 0.025;
    const sq = 0.5 + 0.5 * Math.sin(Math.max(0, t - 0.7) * 2.2);       /* slow squeeze */
    standAt(P, 0.805);
    /* arms come up and round: upper arm forward + across, forearm folded onto the back */
    P.aL.sh = [lerp(0, -1.05, k), lerp(0, 0.85, k), lerp(0.09, 0.28, k)];
    P.aR.sh = [lerp(0, -1.05, k), lerp(0, -0.85, k), lerp(-0.09, -0.28, k)];
    P.aL.el = [lerp(-0.2, -1.05 - 0.10 * sq, k), 0, 0];
    P.aR.el = [lerp(-0.2, -1.05 - 0.10 * sq, k), 0, 0];
    P.aL.wr = [0, lerp(RELAX_WRIST, 0.2, k), 0];
    P.aR.wr = [0, lerp(-RELAX_WRIST, -0.2, k), 0];
    P.spine[0] = 0.16 * k + 0.02 * sq * k;                              /* lean in */
    P.spine[1] = -0.05 * k;
    P.head[0] = 0.05 * k;
    P.head[1] = -0.42 * k;                                              /* look past partner's shoulder */
    P.head[2] = 0.10 * k + sway;
    P.hips[2] = sway * 0.4;
    P.hL = HAND.relaxed; P.hR = HAND.relaxed;
  },

  /* handshake: right hand comes up to waist/chest height with the forearm level,
     open palm, 3 firm pumps from the elbow, eye contact and a small nod */
  handshake(t, P, a) {
    const k = sstep(t / 0.45);
    const grip = sstep((t - 0.45) / 0.15);
    const pump = (t > 0.6 && t < 2.4) ? Math.sin((t - 0.6) * 8.0) * 0.11 * k : 0;
    standAt(P, 0.812);
    P.aR.sh = [lerp(0, -0.80, k), lerp(0, 0.28, k), lerp(-0.09, -0.10, k)];
    P.aR.el = [lerp(-0.12, -0.95, k) + pump, 0, 0];
    P.aR.wr = [0, lerp(-RELAX_WRIST, -0.35, k), 0];
    P.aL.sh = [0.04, 0, 0.09]; P.aL.el = [-0.18, 0, 0];                 /* free arm stays relaxed */
    P.spine[0] = 0.06 * k;                                              /* slight lean toward them */
    P.spine[1] = lerp(0, -0.10, k);
    P.head[0] = 0.05 * k + 0.07 * k * Math.max(0, Math.sin(t * 2.6));   /* small nods */
    P.head[1] = lerp(0, 0.04, k);
    P.hR = grip > 0.5 ? HAND.relaxed : HAND.open;
  },

  /* leaning on a table: weight on the forearms, one foot crossed behind */
  lean_table(t, P, a) {
    const k = sstep(t / 0.6), br = Math.sin(t * 1.5) * 0.01;
    standAt(P, 0.80);
    P.lL.hip[0] += 0.18 * k; P.lL.knee[0] += 0.10 * k;
    P.lR.hip[1] = -0.05 * k;
    P.aL.sh = [lerp(0, -0.95, k), 0.12 * k, 0.16 * k]; P.aL.el = [lerp(-0.2, -1.05, k), 0, 0];
    P.aR.sh = [lerp(0, -0.95, k), -0.12 * k, -0.16 * k]; P.aR.el = [lerp(-0.2, -1.05, k), 0, 0];
    P.spine[0] = 0.50 * k + br; P.hips[0] = 0.10 * k; P.head[0] = -0.28 * k;
    P.hL = HAND.open; P.hR = HAND.open;
  },
});

/* ═══════════════ HOLD LAYER — hand in hand / arm in arm ═══════════════
   ctl._holdArms = [{ kind, arm: "L"|"R", up }]  (set by core/family.js on BOTH people)
     hand    arm out to the side, a little forward, hand open to be held
             (up > 0: a small child reaching UP and out to the grown-up's hand)
     linker  forearm folded forward and inward, hand resting in the partner's elbow crook
     linked  the partner's arm crooked outward so the other hand can slip through
   The held arm stops swinging; the other arm and the legs keep walking normally. */
function holdLayer(P, arms) {
  for (const h of arms) {
    const left = h.arm === "L", sg = left ? 1 : -1, A = left ? P.aL : P.aR;
    if (h.kind === "hand") {
      const up = h.up || 0;
      A.sh = [-0.14 - 0.10 * up, 0, sg * (0.30 + 0.85 * up)];
      A.el = [-0.22 - 0.25 * up, 0, 0];
      A.wr = [0, 0, 0];
    } else if (h.kind === "linker") {
      A.sh = [-0.62, sg * 0.55, sg * 0.06];
      A.el = [-1.30, 0, 0];
      A.wr = [0, 0, 0];
    } else if (h.kind === "linked") {
      A.sh = [-0.20, 0, sg * 0.20];
      A.el = [-0.85, 0, 0];
      A.wr = [0, 0, 0];
    } else continue;
    if (left) P.hL = HAND.relaxed; else P.hR = HAND.relaxed;
  }
}

/* ═══════════════ MICRO-IDLE EMOTES (AnimationAutomation) ═══════════════
   Short fidgets a person does while waiting. Feet stay planted via standAt(). */
EMOTES.stretch      = { dur: 2.8, label: "STRETCHING" };
EMOTES.yawn         = { dur: 2.2, label: "YAWNING" };
EMOTES.look_around  = { dur: 3.2, label: "LOOKING AROUND" };
EMOTES.scratch_head = { dur: 2.0, label: "SCRATCHING HEAD" };
EMOTES.check_phone  = { dur: 3.4, label: "CHECKING PHONE" };
EMOTES.tie_shoe     = { dur: 2.6, label: "TIE SHOE" };
EMOTES.drink        = { dur: 2.4, label: "DRINKING" };
EMOTES.selfie_pose  = { dur: 3.4, label: "TAKING SELFIE" };
EMOTES.warm_hands   = { dur: 2.4, label: "WARMING HANDS" };
EMOTES.fan_self     = { dur: 2.6, label: "FANNING" };
EMOTES.shield_eyes  = { dur: 2.8, label: "SHADING EYES" };
EMOTES.look_up      = { dur: 2.4, label: "LOOKING UP" };
EMOTES.kick_pebble  = { dur: 1.8, label: "KICKING PEBBLE" };
EMOTES.hum          = { dur: 3.4, label: "HUMMING" };
EMOTES.adjust_hat   = { dur: 1.8, label: "ADJUSTING" };
EMOTES.cross_arms   = { dur: 3.2, label: "CROSSING ARMS" };
EMOTES.slump        = { dur: 3.6, label: "SLUMPING" };

Object.assign(EMOTE_FN, {
  stretch(t, P, a) {
    const k = t < 0.6 ? sstep(t / 0.6) : t < 2.0 ? 1 : 1 - sstep((t - 2.0) / 0.8);
    arms(P, [-2.30 * k, 0, 0.40 * k], [-0.10 - 0.15 * k, 0, 0],
         [0, lerp(RELAX_WRIST, 0.20, k), 0]);
    standAt(P, lerp(0.806, 0.792, k), 0, 0, 0, 0);
    P.spine[0] = -0.16 * k;
    P.head[0] = lerp(-0.04, 0.22, k);
    P.hL = HAND.open; P.hR = HAND.open;
  },
  yawn(t, P, a) {
    const k = t < 0.5 ? sstep(t / 0.5) : t < 1.4 ? 1 : 1 - sstep((t - 1.4) / 0.8);
    P.aR.sh = [lerp(0, -1.55, k), 0, lerp(-0.09, -0.15, k)];
    P.aR.el = [lerp(-0.1, -2.10, k), 0, 0];
    P.aR.wr = [0, lerp(-RELAX_WRIST, 0.30, k), 0];
    P.aL.sh = [0.04, 0, 0.09]; P.aL.el = [-0.18, 0, 0];
    standAt(P, 0.806);
    P.spine[0] = -0.08 * k;
    P.head[0]  = 0.28 * k;
    P.hR = HAND.open;
  },
  look_around(t, P, a) {
    const k = sstep(Math.min(t / 0.4, (3.2 - t) / 0.4, 1));
    const ry = Math.sin((t / 3.2) * Math.PI * 2) * 0.55 * k;
    P.head[1]  = ry;
    P.head[0]  = -0.03 * k;
    P.spine[1] = ry * 0.25;
    arms(P, [0.04, 0, 0.09], [-0.18, 0, 0], [0, RELAX_WRIST, 0]);
    standAt(P, 0.806);
    P.hL = HAND.relaxed; P.hR = HAND.relaxed;
  },
  scratch_head(t, P, a) {
    const k = t < 0.4 ? sstep(t / 0.4) : t < 1.6 ? 1 : 1 - sstep((t - 1.6) / 0.4);
    const rub = Math.sin(t * 18) * 0.08 * k;
    P.aR.sh = [lerp(0, -2.05, k), lerp(0, 0.30, k), lerp(-0.09, -0.20, k) + rub];
    P.aR.el = [lerp(-0.1, -2.10, k), 0, 0];
    P.aR.wr = [0, lerp(-RELAX_WRIST, 0.20, k), 0];
    P.aL.sh = [0.04, 0, 0.09]; P.aL.el = [-0.18, 0, 0];
    standAt(P, 0.806);
    P.head[2] = 0.08 * k + rub;
    P.head[1] = 0.10 * k;
    P.hR = HAND.relaxed;
  },
  check_phone(t, P, a) {
    const k = t < 0.4 ? sstep(t / 0.4) : t < 2.8 ? 1 : 1 - sstep((t - 2.8) / 0.6);
    P.aR.sh = [lerp(0, -1.35, k), lerp(0, -0.10, k), lerp(-0.09, -0.20, k)];
    P.aR.el = [lerp(-0.1, -1.85, k), 0, 0];
    P.aR.wr = [0, lerp(-RELAX_WRIST, -0.15, k), 0];
    P.aL.sh = [lerp(0, -1.35, k), lerp(0, 0.10, k), lerp(0.09, 0.20, k)];
    P.aL.el = [lerp(-0.1, -1.85, k), 0, 0];
    P.aL.wr = [0, lerp(RELAX_WRIST, 0.15, k), 0];
    standAt(P, 0.806);
    P.head[0]  = 0.16 * k;
    P.spine[0] = 0.03 * k;
    P.hL = HAND.relaxed; P.hR = HAND.relaxed;
  },
  tie_shoe(t, P, a) {
    const k = t < 0.6 ? sstep(t / 0.6) : t < 1.8 ? 1 : 1 - sstep((t - 1.8) / 0.8);
    standAt(P, lerp(0.806, 0.58, k), 0.02, 0, 0.10, 0);
    P.spine[0] = 0.55 * k;
    P.head[0]  = 0.15 * k;
    P.aL.sh = [lerp(0, -0.9, k), 0, lerp(0.09, 0.30, k)];
    P.aL.el = [lerp(-0.1, -1.8, k), 0, 0];
    P.aR.sh = [lerp(0, -0.9, k), 0, lerp(-0.09, -0.30, k)];
    P.aR.el = [lerp(-0.1, -1.8, k), 0, 0];
    P.hL = HAND.relaxed; P.hR = HAND.relaxed;
  },
  drink(t, P, a) {
    const k = t < 0.3 ? sstep(t / 0.3) : t < 1.9 ? 1 : 1 - sstep((t - 1.9) / 0.5);
    P.aR.sh = [lerp(0, -1.55, k), 0, lerp(-0.09, -0.15, k)];
    P.aR.el = [lerp(-0.1, -2.20, k), 0, 0];
    P.aR.wr = [lerp(0, 0.45, k), 0, 0];
    P.aL.sh = [0.04, 0, 0.09]; P.aL.el = [-0.18, 0, 0];
    standAt(P, 0.806);
    P.head[0] = 0.22 * k;
    P.hR = HAND.relaxed;
  },
  selfie_pose(t, P, a) {
    const k = t < 0.4 ? sstep(t / 0.4) : t < 2.8 ? 1 : 1 - sstep((t - 2.8) / 0.6);
    P.aR.sh = [lerp(0, -2.20, k), 0, lerp(-0.09, -0.35, k)];
    P.aR.el = [lerp(-0.1, -0.55, k), 0, 0];
    P.aR.wr = [0, 0, 0];
    P.aL.sh = [lerp(0, -0.40, k), 0, lerp(0.09, 0.40, k)];
    P.aL.el = [lerp(-0.1, -1.20, k), 0, 0];
    standAt(P, 0.806);
    P.spine[0] = -0.05 * k;
    P.head[1]  = -0.15 * k;
    P.head[2]  = 0.12 * k;
    P.hR = HAND.relaxed; P.hL = HAND.relaxed;
  },
  warm_hands(t, P, a) {
    const k = t < 0.4 ? sstep(t / 0.4) : t < 1.9 ? 1 : 1 - sstep((t - 1.9) / 0.5);
    const breath = Math.sin(t * 4) * 0.04;
    P.aR.sh = [lerp(0, -1.55, k), lerp(0, -0.20, k), lerp(-0.09, -0.10, k)];
    P.aR.el = [lerp(-0.1, -2.20, k) + breath, 0, 0];
    P.aR.wr = [0, lerp(-RELAX_WRIST, 0.30, k), 0];
    P.aL.sh = [lerp(0, -1.55, k), lerp(0, 0.20, k), lerp(0.09, 0.10, k)];
    P.aL.el = [lerp(-0.1, -2.20, k) + breath, 0, 0];
    P.aL.wr = [0, lerp(RELAX_WRIST, -0.30, k), 0];
    standAt(P, 0.806);
    P.spine[0] = 0.08 * k;
    P.head[0]  = 0.15 * k;
    P.hL = HAND.relaxed; P.hR = HAND.relaxed;
  },
  fan_self(t, P, a) {
    const k = t < 0.4 ? sstep(t / 0.4) : t < 2.2 ? 1 : 1 - sstep((t - 2.2) / 0.4);
    const fan = Math.sin(t * 9) * 0.35;
    P.aR.sh = [lerp(0, -1.65, k), 0, lerp(-0.09, -0.30, k) + fan * 0.15];
    P.aR.el = [lerp(-0.1, -1.60, k), 0, 0];
    P.aR.wr = [0, lerp(-RELAX_WRIST, 0, k), fan];
    P.aL.sh = [0.04, 0, 0.09]; P.aL.el = [-0.18, 0, 0];
    standAt(P, 0.806);
    P.head[0] = -0.08 * k;
    P.head[2] = fan * 0.05;
    P.hR = HAND.open;
  },
  shield_eyes(t, P, a) {
    const k = t < 0.4 ? sstep(t / 0.4) : t < 2.4 ? 1 : 1 - sstep((t - 2.4) / 0.4);
    P.aR.sh = [lerp(0, -2.15, k), 0, lerp(-0.09, -0.30, k)];
    P.aR.el = [lerp(-0.1, -2.20, k), 0, 0];
    P.aR.wr = [0, 0, 0];
    P.aL.sh = [0.04, 0, 0.09]; P.aL.el = [-0.18, 0, 0];
    standAt(P, 0.806);
    P.head[0] = 0.04 * k;
    P.head[1] = 0.20 * k;
    P.hR = HAND.open;
  },
  look_up(t, P, a) {
    const k = t < 0.4 ? sstep(t / 0.4) : t < 2.0 ? 1 : 1 - sstep((t - 2.0) / 0.4);
    P.head[0]  = lerp(-0.04, 0.55, k);
    P.spine[0] = -0.08 * k;
    arms(P, [0.04, 0, 0.09], [-0.18, 0, 0], [0, RELAX_WRIST, 0]);
    standAt(P, 0.806);
    P.hL = HAND.relaxed; P.hR = HAND.relaxed;
  },
  kick_pebble(t, P, a) {
    const k = t < 0.6 ? sstep(t / 0.6) : t < 1.0 ? 1 : 1 - sstep((t - 1.0) / 0.8);
    const kick = Math.sin(t * 8) * 0.35 * k;
    standAt(P, 0.80, 0, 0, 0.04, 0);
    P.lR.hip[0]  += -kick;
    P.lR.knee[0] +=  kick * 0.4;
    P.lR.ank[0]  += -0.10 * k;
    P.spine[0] = 0.05 * k;
    P.head[0]  = 0.06 * k;
    P.aL.sh = [0.05, 0, 0.09];  P.aL.el = [-0.20, 0, 0];
    P.aR.sh = [-0.10, 0, -0.09]; P.aR.el = [-0.25, 0, 0];
    P.hL = HAND.relaxed; P.hR = HAND.relaxed;
  },
  hum(t, P, a) {
    const k = t < 0.4 ? sstep(t / 0.4) : t < 3.0 ? 1 : 1 - sstep((t - 3.0) / 0.4);
    const bob = Math.sin(t * 5.5) * 0.04 * k;
    const tap = Math.max(0, Math.sin(t * 5.5)) * 0.10 * k;
    standAt(P, 0.80);
    P.lR.hip[0]  += -tap * 0.4;
    P.lR.knee[0] +=  tap;
    P.lR.ank[0]  += -tap * 0.5;
    P.head[1]  = Math.sin(t * 1.7) * 0.08 * k;
    P.head[2]  = bob;
    P.spine[2] = bob * 0.3;
    P.aL.sh = [0.04, 0, 0.09];  P.aL.el = [-0.18, 0, 0];
    P.aR.sh = [-0.05, 0, -0.09]; P.aR.el = [-0.20, 0, 0];
    P.hL = HAND.relaxed; P.hR = HAND.relaxed;
  },
  adjust_hat(t, P, a) {
    const k = t < 0.3 ? sstep(t / 0.3) : t < 1.4 ? 1 : 1 - sstep((t - 1.4) / 0.4);
    const pull = Math.sin(t * 5) * 0.04 * k;
    P.aR.sh = [lerp(0, -2.05, k), lerp(0, 0.20, k), lerp(-0.09, -0.25, k)];
    P.aR.el = [lerp(-0.1, -2.30, k) + pull, 0, 0];
    P.aR.wr = [0, 0, 0];
    P.aL.sh = [0.04, 0, 0.09]; P.aL.el = [-0.18, 0, 0];
    standAt(P, 0.806);
    P.head[0] = 0.08 * k;
    P.hR = HAND.relaxed;
  },
  cross_arms(t, P, a) {
    const k = t < 0.4 ? sstep(t / 0.4) : t < 2.8 ? 1 : 1 - sstep((t - 2.8) / 0.4);
    P.aR.sh = [lerp(0, -1.35, k), lerp(0, -0.25, k), lerp(-0.09, -0.30, k)];
    P.aR.el = [lerp(-0.1, -1.75, k), 0, 0];
    P.aR.wr = [0, lerp(-RELAX_WRIST, 0.10, k), 0];
    P.aL.sh = [lerp(0, -1.30, k), lerp(0, 0.25, k), lerp(0.09, 0.30, k)];
    P.aL.el = [lerp(-0.1, -1.70, k), 0, 0];
    P.aL.wr = [0, lerp(RELAX_WRIST, -0.10, k), 0];
    standAt(P, 0.806);
    P.spine[0] = -0.03 * k;
    P.hL = HAND.relaxed; P.hR = HAND.relaxed;
  },
  slump(t, P, a) {
    const k = t < 0.6 ? sstep(t / 0.6) : t < 3.0 ? 1 : 1 - sstep((t - 3.0) / 0.6);
    const sway = Math.sin(t * 1.4) * 0.02 * k;
    P.spine[0] = 0.18 * k;
    P.spine[2] = sway;
    P.head[0]  = 0.35 * k;
    P.head[2]  = sway * 1.5;
    P.aL.sh = [lerp(0, 0.10, k), 0, lerp(0.09, 0.06, k)];
    P.aR.sh = [lerp(0, 0.10, k), 0, lerp(-0.09, -0.06, k)];
    P.aL.el = [lerp(-0.1, -0.05, k), 0, 0];
    P.aR.el = [lerp(-0.1, -0.05, k), 0, 0];
    standAt(P, lerp(0.806, 0.795, k));
    P.hL = HAND.relaxed; P.hR = HAND.relaxed;
  },
});

/* ═══════════════ main entry ═══════════════ */
/* ═══════════════ GROUND CONTACT — nothing sinks, nothing floats ═══════════════
   After the pose is written, the lowest point of the body (joint capsules: pelvis, torso,
   head, arms, hands, thighs, shins, heels, toes) is measured in the character's own frame
   (y = 0 is the floor / bed top / tub bottom the group stands on). Poses that rest on a surface
   (lying, kneeling, bath, sitting on the ground, meditating) are placed exactly flush; every
   other emote is only pushed UP if it would dip below the floor (flip landings, crouch hits…). */
const FLUSH_EMOTES = new Set(["sit_ground", "meditate"]);
const _CAP = [
  ["hips", 0, 0, 0, 0.125], ["hips", 0, -0.09, 0, 0.11], ["spine", 0, 0.12, 0, 0.14], ["spine", 0, 0.30, 0, 0.15], ["head", 0, 0.10, 0, 0.105],
  ["sh", 0, 0, 0, 0.055], ["sh", 0, -0.13, 0, 0.05], ["el", 0, 0, 0, 0.05], ["el", 0, -0.13, 0, 0.045], ["wr", 0, 0, 0, 0.04], ["wr", 0, -0.09, 0, 0.05],
  ["hp", 0, 0, 0, 0.08], ["hp", 0, -0.14, 0, 0.08], ["hp", 0, -0.28, 0, 0.07], ["kn", 0, 0, 0, 0.07], ["kn", 0, -0.14, 0, 0.065], ["kn", 0, -0.28, 0, 0.055],
  ["an", 0, 0, 0, 0.06], ["an", 0, -0.04, 0.11, 0.045], ["an", 0, -0.05, -0.04, 0.05],
];
function lowestLocal(R) {
  const g = R.hips.parent; if (!g) return null;
  const V3 = R.hips.position.constructor, v = new V3();
  const J = (k, side) => {
    const arm = side > 0 ? R.armL : R.armR, leg = side > 0 ? R.legL : R.legR;
    switch (k) {
      case "sh": return arm && arm.shoulder; case "el": return arm && arm.elbow; case "wr": return arm && arm.wrist;
      case "hp": return leg && leg.hip; case "kn": return leg && leg.knee; case "an": return leg && (leg.ankle || leg.ank);
      default: return R[k];
    }
  };
  let lo = 1e9;
  for (const [k, x, y, z, r] of _CAP) {
    for (const side of (k.length === 2 ? [1, -1] : [0])) {
      const j = J(k, side); if (!j) continue;
      j.updateWorldMatrix(true, false);
      v.set(side < 0 ? -x : x, y, z); j.localToWorld(v); g.worldToLocal(v);
      if (v.y - r < lo) lo = v.y - r;
    }
  }
  return lo;
}
function groundFix(R, ctl, emoteName) {
  let flush = false, want = 0;
  const st = ctl.state;
  if (st === "lying") { flush = true; want = 0.012; }                      /* settles 1 cm into the mattress */
  else if (st === "kneel") { flush = true; want = 0.016; }               /* capsule estimate vs real mesh bias */
  else if (st === "bathing") { flush = true; want = 0.034; }
  else if (emoteName) { flush = FLUSH_EMOTES.has(emoteName); want = flush ? 0.012 : 0; }
  else return;
  const lo = lowestLocal(R); if (lo == null || !isFinite(lo)) return;
  const d = want - lo;
  if (flush ? Math.abs(d) > 0.002 : d > 0.002) R.hips.position.y += d;
}

export function animate(ctl, dt) {
  const R = ctl.rig;
  if (!R || !R.hips) return;
  const a = ctl._anim || (ctl._anim = newState());
  if (a.rig !== R) {
    a.rig = R; a.init = false;
    a.joints = collectJoints(R);
    a.S = new Float32Array(a.joints.length * 3);
    const lj = new Set([R.legL.hip, R.legL.knee, R.legL.ankle || R.legL.ank, R.legR.hip, R.legR.knee, R.legR.ankle || R.legR.ank]);
    a.leg = a.joints.map(j => lj.has(j));
  }
  dt = clamp(dt || 0, 0, 0.1);
  if (dt <= 0) dt = 1 / 60;

  /* ── measure real ground speed / acceleration / turn rate ── */
  const px = ctl.pos.x, pz = ctl.pos.z;
  if (a.havePos) {
    const dist = Math.hypot(px - a.px, pz - a.pz);
    const vi = (ctl._intentSpeed !== undefined) ? ctl._intentSpeed : (dist > 2.5 ? 0 : dist / dt);
    const ls = a.speed;
    a.speed += (vi - a.speed) * (1 - Math.exp(-dt * 14));
    a.acc += (((a.speed - ls) / dt) - a.acc) * (1 - Math.exp(-dt * 8));
  }
  a.px = px; a.pz = pz; a.havePos = true;
  if (ctl.yaw !== undefined) {
    if (a.haveYaw) {
      let dy = ctl.yaw - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      a.yawRate += (dy / dt - a.yawRate) * (1 - Math.exp(-dt * 10));
    }
    a.yaw = ctl.yaw; a.haveYaw = true;
  }

  const seated = ctl.state !== "standing" && ctl.state !== "crouching";
  const crouching = ctl.state === "crouching";
  a.moveAmt = seated ? 0 : sstep(a.speed / 0.45);
  a.runAmt = sstep((a.speed - 1.8) / 1.5);
  a.idleT += dt; a.breathT += dt;

  /* ── gait phase from speed (feet stay planted) ── */
  if (!seated && ctl.onGround !== false && a.moveAmt > 0.01) {
    a.u = wrap1(a.u + gaitParams(a.speed, a.runAmt, crouching).f * dt);
  }

  /* ── landing detection ── */
  const grounded = ctl.onGround !== false;
  if (!grounded) { a.airborne = true; a.lastVy = ctl.vel ? ctl.vel.y : 0; }
  else if (ctl._lastVy !== undefined) { a.lastVy = ctl._lastVy; }
  else if (a.airborne) { a.airborne = false; a.land = clamp(-a.lastVy / 9, 0, 1); }
  a.land *= Math.exp(-dt * 7);

  /* ── emote timers ── */
  let emoting = false;
  if (ctl._emoteTimer > 0 && ctl._emoteName && !seated) {
    const emoteSpeed = 1.4;
    ctl._emoteTimer -= dt * emoteSpeed;
    ctl._emotePhase = (ctl._emotePhase || 0) + dt * emoteSpeed;
    if (ctl._emoteTimer <= 0) { ctl._emoteTimer = 0; ctl._emoteName = null; if (ctl._ul) ctl._ul(); }
    else emoting = true;
  }

  /* ── build the TARGET pose ── */
  const P = resetPose(a._P);
  if (seated) {
    seatedPose(a, ctl, P);
  } else if (emoting) {
    EMOTE_FN[ctl._emoteName](ctl._emotePhase, P, a);
    if (ctl._emoteTimer < 0.45) {
      /* flips end holding hips.x = -2π·spins (and whole twist turns).
         Fold those to their equivalent small angle BEFORE lerping toward
         locomotion, otherwise the lerp visibly unwinds every spin. */
      if (FLIP_EMOTES[ctl._emoteName]) {
        P.hips[0] -= TAU * Math.round(P.hips[0] / TAU);
        P.hips[1] -= TAU * Math.round(P.hips[1] / TAU);
      }
      const Pn = resetPose(a._Pn); locomotion(a, ctl, Pn, false);
      blendPose(P, Pn, 1 - sstep(ctl._emoteTimer / 0.45));
    }
  } else if (!grounded) {
    airPose(a, ctl, P);
  } else {
    locomotion(a, ctl, P, crouching);
    idleLayer(a, P, (1 - a.moveAmt) * (crouching ? 0.5 : 1));
    if (ctl._guard && !ctl.held && !crouching) guardLayer(P, 1 - a.moveAmt);   /* FIGHT mode: fists up */

    if (ctl.held) {
      set3(P.aL.sh, -1.3, 0, 0); set3(P.aR.sh, -1.3, 0, 0);
      set3(P.aL.el, -1.6, 0, 0); set3(P.aR.el, -1.6, 0, 0);
      P.hL = HAND.open; P.hR = HAND.open;
    }
    if (ctl._holdArms && !crouching && !ctl.held) holdLayer(P, ctl._holdArms);   /* holding hands / arm in arm */
    if (ctl._useTimer > 0) {
      if (ctl._useTimer > a.lastUse + 1e-4) a.useTotal = ctl._useTimer;
      a.lastUse = ctl._useTimer;
      ctl._useTimer -= dt;
      const p = 1 - Math.max(0, ctl._useTimer) / Math.max(a.useTotal, 0.1);
      const wv = Math.sin(clamp(p, 0, 1) * PI);
      if (wv > 0.01) {
        P.spine[0] += wv * (ctl._useBend != null ? ctl._useBend : 0.3);
        set3(P.aL.sh, -wv * 1.1, 0, 0.08); set3(P.aR.sh, -wv * 1.1, 0, -0.08);
        set3(P.aL.el, -0.4 - wv * 0.6, 0, 0); set3(P.aR.el, -0.4 - wv * 0.6, 0, 0);
      }
    } else a.lastUse = 0;
  }

  /* weapons / phone keep the wrist un-rolled so held meshes stay oriented */
  const noRelax = ctl.phoneHold || ctl._selfieHold || (ctl.weapons && ctl.weapons.isArmed && ctl.weapons.isArmed());
  if (noRelax && !emoting) { P.aL.wr[1] = 0; P.aR.wr[1] = 0; }

  /* ── write target onto the rig, then let overlays modify it ── */
  writePose(R, P);
  if (seated) { if (ctl.state === "lying" || ctl.state === "kneel" || ctl.state === "bathing") groundFix(R, ctl, null); }
  else if (emoting) groundFix(R, ctl, ctl._emoteName);

  // Let guns/knives override the arm poses if we are aiming or attacking
  if (ctl.weapons && ctl.weapons.isArmed && ctl.weapons.isArmed() && !emoting) {
    try { ctl.weapons.applyArmPose(R); } catch (e) {}
  }

  if (ctl._overlay) ctl._overlay(R, emoting);
  /* infant carried at the front: arms cradle the baby (see core/body-attach.js) */
  if (R._carryPose === "front" && !emoting && !ctl._selfieHold) { try { applyCarryPose(R); } catch (e) {} }

  /* FIX #180t — Snap any joint an overlay pushed outside its valid arc
     before the read-back blend below locks it in for the next frame.
     This is a belt-and-braces safety net for any future layer that
     mutates the rig after writePose() and before the blend.

     Backflips deliberately sweep hips.rotation.x past 2π (up to −6π
     for a triple). Relax the X upper limit for the hips ONLY while a
     flip is running, so a legitimate multi-turn rotation is not snapped
     back to 0 before the blend reads it. */
  const flipRunning = emoting && FLIP_EMOTES[ctl._emoteName] !== undefined;
  const hipsJoint = R.hips;
  for (const j of a.joints) {
    const r = j.rotation;
    const isHipsX = flipRunning && j === hipsJoint;
    if (!isFinite(r.x) || (!isHipsX && Math.abs(r.x) > PI * 1.5)) r.x = 0;
    if (!isFinite(r.y) || (!isHipsX && Math.abs(r.y) > PI * 1.5)) r.y = 0;
    if (!isFinite(r.z) || Math.abs(r.z) > PI * 1.5) r.z = 0;
  }

  /* ── blend: read target back from the rig, ease the displayed pose toward it ── */
  const key = ctl.state + "|" + (emoting ? ctl._emoteName : "") + "|" + (grounded ? "g" : "a") + "|" + (ctl.held ? "h" : "") + (ctl._holdArms ? "w" : "");
  if (key !== a.key) { a.key = key; a.bs = 0.55; }
  a.bs += (1 - a.bs) * Math.min(1, dt * 3.2);
  const rate = emoting ? 90 : lerp(11, 26, a.moveAmt) * a.bs;
  const k = a.init ? 1 - Math.exp(-dt * rate) : 1;
  const kLeg = a.init ? 1 - Math.exp(-dt * (emoting ? 90 : lerp(rate, 110, a.moveAmt))) : 1;
  const J = a.joints, S = a.S;
  for (let i = 0; i < J.length; i++) {
    const r = J[i].rotation, kk = a.leg[i] ? kLeg : k;
    /* flip is over: drop the whole turns the smoothed value accumulated
       (-2π, -4π, -6π…) BEFORE computing the delta, so nothing unwinds on
       screen — 2πn is visually identical to 0. */
    if (J[i] === hipsJoint && !flipRunning) {
      S[i * 3]     -= TAU * Math.round(S[i * 3] / TAU);
      S[i * 3 + 1] -= TAU * Math.round(S[i * 3 + 1] / TAU);
    }
    let dx = r.x - S[i * 3];
    /* Backflips sweep hips.rotation.x past 2π; wrap the delta so the
       blend takes the shortest arc and the body doesn't visually
       unspin when the flip ends and normal locomotion takes over. */
    if (J[i] === hipsJoint && flipRunning) {
      while (dx >  PI) dx -= TAU;
      while (dx < -PI) dx += TAU;
    }
    let dy = r.y - S[i * 3 + 1];
    if (J[i] === hipsJoint && flipRunning) {
      while (dy >  PI) dy -= TAU;
      while (dy < -PI) dy += TAU;
    }
    S[i * 3]     += dx * kk;
    S[i * 3 + 1] += dy * kk;
    S[i * 3 + 2] += (r.z - S[i * 3 + 2]) * kk;
    r.x = S[i * 3]; r.y = S[i * 3 + 1]; r.z = S[i * 3 + 2];
  }
  const hp = R.hips.position, SH = a.SH;
  if (!a.init) { SH[0] = hp.x; SH[1] = hp.y; SH[2] = hp.z; }
  const kh = a.init ? 1 - Math.exp(-dt * rate * 0.9) : 1;
  SH[0] += (hp.x - SH[0]) * kh; SH[2] += (hp.z - SH[2]) * kh;
  SH[1] += (hp.y - SH[1]) * kLeg;
  hp.x = SH[0]; hp.y = SH[1]; hp.z = SH[2];
  a.init = true;
  ctl._hipsY = SH[1];
}

function blendPose(A, B, t) {
  for (const k in A) {
    const x = A[k], y = B[k];
    if (Array.isArray(x)) { for (let i = 0; i < x.length; i++) x[i] = lerp(x[i], y[i], t); }
    else if (k === "hL" || k === "hR") { if (t > 0.5) A[k] = y; }
    else if (x && typeof x === "object") blendPose(x, y, t);
  }
}

function writePose(R, P) {
  R.hips.rotation.set(P.hips[0], P.hips[1], P.hips[2]);
  R.hips.position.set(P.hipsPos[0], P.hipsPos[1], P.hipsPos[2]);
  R.spine.rotation.set(P.spine[0], P.spine[1], P.spine[2]);
  if (R.neck) R.neck.rotation.set(P.neck[0], P.neck[1], P.neck[2]);
  R.head.rotation.set(P.head[0], P.head[1], P.head[2]);
  const put = (j, v) => j && j.rotation.set(v[0], v[1], v[2]);
  put(R.armL.shoulder, P.aL.sh); put(R.armL.elbow, P.aL.el); put(R.armL.wrist, P.aL.wr);
  put(R.armR.shoulder, P.aR.sh); put(R.armR.elbow, P.aR.el); put(R.armR.wrist, P.aR.wr);
  const an = (l) => l.ank || l.ankle;
  put(R.legL.hip, P.lL.hip); put(R.legL.knee, P.lL.knee); put(an(R.legL), P.lL.ank);
  put(R.legR.hip, P.lR.hip); put(R.legR.knee, P.lR.knee); put(an(R.legR), P.lR.ank);
  setHand(R.armL, +1, P.hL); setHand(R.armR, -1, P.hR);
}
