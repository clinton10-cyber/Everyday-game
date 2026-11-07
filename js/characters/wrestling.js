/* js/characters/wrestling.js — procedural fight moves (REWRITE)
   ─────────────────────────────────────────────────────────────────────────
   Every move is a keyframe TRACK TABLE (normalised time 0..1, smooth-stepped
   between keys) layered on a boxing guard, so every move starts and ends in
   the same stance and any move can flow straight into any other.

   Each move carries:
     attacker tracks   – body, arms, kicking leg, weight shift, foot steps
     victim tracks     – the matching reaction (flinch / lifted / folded / thrown)
     contact data      – reach, impact + knock-down frames, cancel window,
                         the path the victim is carried along relative to the
                         attacker (forward f / side s, metres), hit-stop, push,
                         body part, sounds

   Families
     strikes   jab · cross · hook · elbowStrike · lowKick · roundhouse
               superkick · clothesline
     clinch    clinch → clinchHold → clinchKnee · stunner · ddt · hipToss
               suplex · chokeSlam
     lifts     bodySlam
     takedown  singleLeg · spear
     aerial    elbowDrop
   ───────────────────────────────────────────────────────────────────────── */
const PI = Math.PI;
const HIP_HEIGHT = 0.935, ANKLE_H = 0.105, PIVOT = -0.010;
const STAND_LEN = 0.818;
const L1 = 0.42, L2 = 0.40;
const RELAX_WRIST = 1.2;

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const set3 = (a, x, y, z) => { a[0] = x; a[1] = y; a[2] = z; };

const HAND_FIST = { c: [1, 1, 1, 1], t: 1 };
const HAND_OPEN = { c: [0.02, 0.02, 0.04, 0.06], t: 0.00 };

/* ── leg IK (same maths the animator uses) ─────────────────────────────── */
function legIK(ty, tz) {
  let d = Math.hypot(ty, tz);
  const dmax = (L1 + L2) * 0.9995;
  if (d > dmax) { const k = dmax / d; ty *= k; tz *= k; d = dmax; }
  if (d < 0.14) {
    if (d < 1e-4) { ty = 0; tz = 0.14; d = 0.14; }
    else { const k = 0.14 / d; ty *= k; tz *= k; d = 0.14; }
  }
  const psi = Math.atan2(-tz, -ty);
  const knee = PI - Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
  const beta = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  return { thigh: psi - beta, knee };
}
function plantLeg(leg, hipsY, footZ) {
  const ty = ANKLE_H - (hipsY + PIVOT);
  const ik = legIK(ty, footZ || 0);
  set3(leg.hip, ik.thigh, 0, 0);
  set3(leg.knee, ik.knee, 0, 0);
  set3(leg.ank, -(ik.thigh + ik.knee), 0, 0);
}
function standAt(P, ell, zL, zR) {
  const hipsY = ANKLE_H + ell - PIVOT;
  P.hipsPos[1] = hipsY;
  plantLeg(P.lL, hipsY, zL || 0);
  plantLeg(P.lR, hipsY, zR || 0);
}

/* ── keyframe tracks ───────────────────────────────────────────────────── */
function K(t, k) {
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i][0]) {
      const p = k[i - 1], q = k[i], d = q[0] - p[0];
      if (d < 1e-6) return q[1];
      const u = (t - p[0]) / d, u2 = u * u, u3 = u2 * u;
      /* cubic Hermite: velocity is continuous through the keys (momentum), tangents in k[i][3] */
      return (2 * u3 - 3 * u2 + 1) * p[1] + (u3 - 2 * u2 + u) * d * p[3]
           + (-2 * u3 + 3 * u2) * q[1] + (u3 - u2) * d * q[3];
    }
  }
  return k[k.length - 1][1];
}
/* tangents: monotone (no ghost overshoot), zero on holds / turning points, and 's' keys keep the
   incoming speed so a punch arrives at full velocity and carries through instead of stopping dead */
function tangents(k) {
  const n = k.length, m = new Array(n).fill(0), sl = [];
  for (let i = 0; i < n - 1; i++) sl.push((k[i + 1][1] - k[i][1]) / Math.max(k[i + 1][0] - k[i][0], 1e-5));
  for (let i = 1; i < n - 1; i++) {
    if (sl[i - 1] * sl[i] <= 0) m[i] = 0;
    else m[i] = 2 * sl[i - 1] * sl[i] / (sl[i - 1] + sl[i]);
    if (k[i][2] === "s") m[i] = sl[i - 1] * 0.9;
  }
  if (n > 1) { m[0] = 0; m[n - 1] = 0; if (k[n - 1][2] === "s") m[n - 1] = sl[n - 2]; }
  for (let i = 0; i < n; i++) k[i][3] = m[i];
  return k;
}

/* default value of every track = the boxing guard (attackers) */
const GUARD = {
  ell: STAND_LEN - 0.05, zL: 0.17, zR: -0.15,
  sp: 0.10, spy: 0, spz: 0, hd: -0.05, hdy: 0, hrx: 0, hry: 0, hpy: 0,
  Lx: -0.78, Ly: 0, Lz: 0.14, Le: -2.0,
  Rx: -0.78, Ry: 0, Rz: -0.14, Re: -2.0,
};
/* clinch hold: both hands locked behind the opponent's head */
const CLINCH = { ...GUARD, ell: 0.74, zL: 0.12, zR: -0.10, sp: 0.24, hd: 0.12,
  Lx: -1.25, Lz: -0.02, Le: -1.75, Rx: -1.25, Rz: 0.02, Re: -1.75 };
/* victim default = relaxed standing */
const VSTAND = { ell: STAND_LEN, zL: 0, zR: 0, sp: 0, spy: 0, spz: 0, hd: 0, hdy: 0, hrx: 0, hry: 0, hpy: 0,
  Lx: 0, Ly: 0, Lz: 0.06, Le: -0.10, Rx: 0, Ry: 0, Rz: -0.06, Re: -0.10 };
/* victim held in a clinch: hunched, hands up on attacker's shoulders */
const VCLINCH = { ...VSTAND, ell: 0.76, sp: 0.45, hd: 0.30, Lx: -0.55, Lz: 0.30, Le: -0.80, Rx: -0.55, Rz: -0.30, Re: -0.80 };

function compile(T, base) {
  const out = {};
  for (const n in T) {
    const b = base[n] !== undefined ? base[n] : 0;
    const k = T[n].map(([t, v, e]) => [clamp(t, 0, 1), v, e]).sort((p, q) => p[0] - q[0]);
    if (k[0][0] > 0) k.unshift([0, b]);
    if (k[k.length - 1][0] < 1) k.push([1, b]);
    out[n] = tangents(k);
  }
  out._base = base;
  return out;
}
const tv = (t, tr, n) => (tr[n] ? K(t, tr[n]) : (tr._base[n] || 0));

function applyTracks(t, P, tr, hand) {
  const v = (n) => tv(t, tr, n);
  standAt(P, v("ell"), v("zL"), v("zR"));
  P.hipsPos[1] += v("hpy");
  P.hips[0] = v("hrx"); P.hips[1] = v("hry");
  P.spine[0] = v("sp"); P.spine[1] = v("spy"); P.spine[2] = v("spz");
  P.head[0] = v("hd"); P.head[1] = v("hdy");
  set3(P.aL.sh, v("Lx"), v("Ly"), v("Lz")); set3(P.aL.el, v("Le"), 0, 0);
  set3(P.aR.sh, v("Rx"), v("Ry"), v("Rz")); set3(P.aR.el, v("Re"), 0, 0);
  /* additive leg offsets (kicks, knee drives, splayed landings) */
  P.lL.hip[0] += v("Lhip"); P.lL.knee[0] += v("Lknee"); P.lL.hip[2] += v("Lhz");
  P.lR.hip[0] += v("Rhip"); P.lR.knee[0] += v("Rknee"); P.lR.hip[2] += v("Rhz");
  P.lL.ank[0] += v("Lank"); P.lR.ank[0] += v("Rank");
  P.hL = hand; P.hR = hand;
}
function mk(T, base, hand, extra, lean) {
  const tr = compile(T, base);
  return (t, P, a) => {
    applyTracks(t, P, tr, hand);
    if (lean != null && a && a.wrDist) {
      /* contact: step + lean through the target so the fist/shoulder really arrives where the victim is */
      const f = clamp((a.wrDist - 0.80) / 1.1, 0, 1), w = sstep(1 - Math.abs(t - lean) / 0.20);
      P.hipsPos[2] += 0.30 * f * w; P.spine[0] += 0.20 * f * w; P.head[0] -= 0.08 * f * w;
    }
    if (extra) extra(t, P, a);
  };
}

/* ── guard stance for the animator (idle + walking while in fight mode) ── */
export function guardLayer(P, still) {
  const k = 1;
  set3(P.aL.sh, GUARD.Lx * k, 0, GUARD.Lz); set3(P.aL.el, GUARD.Le * k, 0, 0);
  set3(P.aR.sh, GUARD.Rx * k, 0, GUARD.Rz); set3(P.aR.el, GUARD.Re * k, 0, 0);
  P.spine[0] += GUARD.sp; P.head[0] += GUARD.hd;
  P.hL = HAND_FIST; P.hR = HAND_FIST;
  if (still > 0.5) {                       /* planted fighting stance when standing still */
    standAt(P, GUARD.ell, GUARD.zL, GUARD.zR);
    P.hips[1] = 0.10;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   ATTACKER TRACKS
   ══════════════════════════════════════════════════════════════════════════ */
const A = {};

/* ── strikes ── */
A.jab = mk({
  Lx: [[.06,-.70],[.14,-.52],[.30,-1.55,'s'],[.40,-1.55],[.72,-.78]],
  Le: [[.10,-2.1],[.28,-.08],[.40,-.08],[.72,-2.0]],
  Lz: [[.28,.04],[.40,.04],[.72,.14]],
  spy: [[.28,-.18],[.42,-.18],[.75,0]], hry: [[.28,-.08],[.42,-.08],[.75,0]],
  zL: [[.28,.30],[.42,.30],[.78,.17]], sp: [[.28,.16],[.42,.16],[.75,.10]],
}, GUARD, HAND_FIST, null, 0.3);

A.cross = mk({
  Rx: [[.08,-.70],[.16,-.50],[.34,-1.56,'s'],[.44,-1.56],[.86,-.78]],
  Re: [[.12,-2.1],[.32,-.06],[.44,-.06],[.86,-2.0]],
  Rz: [[.32,-.03],[.44,-.03],[.86,-.14]],
  spy: [[.12,-.10],[.32,.45],[.46,.45],[.88,0]], hry: [[.12,-.06],[.32,.25],[.46,.25],[.88,0]],
  hdy: [[.32,-.22],[.46,-.22],[.88,0]], sp: [[.32,.20],[.46,.20],[.88,.10]],
  zL: [[.32,.26],[.46,.26],[.88,.17]], ell: [[.32,.72],[.46,.72],[.88,.768]],
  Rhip: [[.32,.10],[.46,.10],[.88,0]],
}, GUARD, HAND_FIST, null, 0.34);

A.hook = mk({
  Rx: [[.14,-.55],[.36,-.45],[.50,-.45],[.90,-.78]],
  Rz: [[.10,-.14],[.18,-.05],[.38,-1.42,'s'],[.50,-1.42],[.92,-.14]],
  Re: [[.14,-2.2],[.36,-1.55],[.50,-1.55],[.92,-2.0]],
  spy: [[.14,-.30],[.36,.70],[.52,.70],[.92,0]], hry: [[.14,-.15],[.36,.35],[.52,.35],[.92,0]],
  hdy: [[.36,-.30],[.52,-.30],[.92,0]], zL: [[.36,.24],[.50,.24],[.92,.17]],
  ell: [[.36,.73],[.50,.73],[.92,.768]],
}, GUARD, HAND_FIST, null, 0.38);

A.elbowStrike = mk({
  Rx: [[.10,-.90],[.36,-1.20,'s'],[.48,-1.20],[.90,-.78]],
  Rz: [[.34,-.62],[.48,-.62],[.90,-.14]],
  Re: [[.10,-2.3],[.34,-2.55],[.48,-2.55],[.90,-2.0]],
  spy: [[.12,-.20],[.34,.62],[.50,.62],[.92,0]], hry: [[.34,.30],[.50,.30],[.92,0]],
  sp: [[.34,.26],[.50,.26],[.92,.10]], zL: [[.34,.30],[.50,.30],[.92,.17]],
  zR: [[.34,-.10],[.50,-.10],[.92,-.15]], ell: [[.34,.70],[.50,.70],[.92,.768]],
}, GUARD, HAND_FIST, null, 0.36);

A.lowKick = mk({
  Rhip: [[.10,-.40],[.30,-.55],[.42,-1.15,'s'],[.54,-1.15],[.88,-.10]],
  Rknee: [[.10,.90],[.30,1.10],[.44,.15],[.54,.15],[.88,0]],
  Rank: [[.44,-.20],[.54,-.20],[.88,0]],
  Rhz: [[.30,-.20],[.44,-.45],[.54,-.45],[.88,0]],
  spy: [[.30,-.20],[.44,.45],[.56,.45],[.90,0]], hry: [[.44,.30],[.56,.30],[.90,0]],
  sp: [[.44,.06],[.56,.06],[.90,.10]], ell: [[.30,.74],[.90,.768]],
  Rx: [[.30,-.78],[.44,-.20],[.56,-.20],[.90,-.78]],
}, GUARD, HAND_FIST, null, 0.4);

A.roundhouse = mk({
  Rhip: [[.10,-.55],[.30,-.80],[.45,-1.75,'s'],[.58,-1.75],[.92,0]],
  Rknee: [[.10,1.20],[.30,1.55],[.46,.12],[.58,.12],[.92,0]],
  Rhz: [[.30,-.35],[.46,-.85],[.58,-.85],[.92,0]],
  Rank: [[.46,-.25],[.58,-.25],[.92,0]],
  hry: [[.30,-.10],[.46,.65],[.60,.65],[.94,0]], spy: [[.30,-.20],[.46,.42],[.60,.42],[.94,0]],
  sp: [[.46,-.30],[.60,-.30],[.94,.10]], hd: [[.46,.10],[.60,.10],[.94,-.05]],
  Lz: [[.30,.30],[.46,.95],[.60,.95],[.94,.14]], Lx: [[.46,-.40],[.60,-.40],[.94,-.78]],
  Rx: [[.46,-.20],[.60,-.20],[.94,-.78]], ell: [[.30,.74],[.46,.72],[.60,.72],[.94,.768]],
}, GUARD, HAND_FIST, null, 0.44);

A.superkick = mk({
  Rhip: [[.12,-.40],[.30,-.90],[.43,-2.10,'s'],[.58,-2.20],[.64,-2.20],[.92,0]],
  Rknee: [[.12,1.00],[.30,1.30],[.42,.10],[.64,.10],[.92,0]],
  Rhz: [[.30,-.20],[.42,-.55],[.64,-.55],[.92,0]],
  Rank: [[.42,-.30],[.64,-.30],[.92,0]],
  sp: [[.42,-.40],[.64,-.40],[.92,.10]], hry: [[.42,.40],[.64,.40],[.92,0]],
  spy: [[.42,.25],[.64,.25],[.92,0]], hd: [[.42,.15],[.64,.15],[.92,-.05]],
  Lz: [[.42,.80],[.64,.80],[.92,.14]], Rx: [[.42,-.20],[.64,-.20],[.92,-.78]],
}, GUARD, HAND_OPEN, null, 0.44);

A.clothesline = mk({
  Rx: [[.06,-.78],[.20,.45],[.30,.45],[.48,-.15,'s'],[.64,-.15],[.94,-.78]],
  Rz: [[.10,-1.35],[.30,-1.45],[.64,-1.45],[.94,-.14]],
  Re: [[.10,-.30],[.64,-.12],[.94,-2.0]],
  spy: [[.10,-.20],[.28,-.65],[.50,.75],[.66,.75],[.94,0]], hry: [[.28,-.30],[.50,.35],[.66,.35],[.94,0]],
  sp: [[.28,.18],[.50,.30],[.66,.30],[.94,.10]], zL: [[.28,.20],[.50,.40],[.66,.40],[.94,.17]],
  ell: [[.28,.72],[.50,.70],[.66,.70],[.94,.768]], Lz: [[.28,.50],[.50,.50],[.94,.14]],
  Lx: [[.28,-.40],[.50,-.40],[.94,-.78]],
}, GUARD, HAND_OPEN, null, 0.48);

/* ── clinch family ── */
A.clinch = mk({
  Lx: [[.30,-1.65],[.60,-1.25],[1,-1.25]], Le: [[.30,-.45],[.60,-1.75],[1,-1.75]], Lz: [[.30,.22],[.60,-.02],[1,-.02]],
  Rx: [[.30,-1.65],[.60,-1.25],[1,-1.25]], Re: [[.30,-.45],[.60,-1.75],[1,-1.75]], Rz: [[.30,-.22],[.60,.02],[1,.02]],
  sp: [[.30,.20],[.60,.24],[1,.24]], hd: [[.60,.12],[1,.12]],
  zL: [[.30,.26],[.60,.12],[1,.12]], zR: [[.30,-.12],[1,-.10]], ell: [[.30,.72],[.60,.74],[1,.74]],
}, GUARD, HAND_OPEN);

A.clinchHold = mk({}, CLINCH, HAND_FIST,
  (t, P) => { const s = Math.sin(t * PI * 10); P.spine[0] += 0.012 * s; P.hips[1] += 0.03 * Math.sin(t * PI * 7); });

A.clinchKnee = mk({
  Rhip: [[.14,-.20],[.36,-1.55],[.50,-1.55],[.82,0]], Rknee: [[.14,.30],[.36,1.30],[.50,1.20],[.82,0]],
  sp: [[.36,.40],[.50,.40],[.84,.24]], Lx: [[.20,-1.25],[.36,-1.00],[.50,-1.00],[.84,-1.25]],
  Rx: [[.20,-1.25],[.36,-1.00],[.50,-1.00],[.84,-1.25]],
  Le: [[.36,-2.10],[.50,-2.10],[.84,-1.75]], Re: [[.36,-2.10],[.50,-2.10],[.84,-1.75]],
  hd: [[.36,.25],[.50,.25],[.84,.12]], ell: [[.36,.70],[.50,.70],[.84,.74]],
}, CLINCH, HAND_FIST);

A.suplex = mk({
  ell: [[.20,.54],[.36,.62],[.46,.82],[.58,.80],[.66,.50],[.76,.54],[.96,.768]],
  sp: [[.20,.48],[.36,.30],[.46,-.65],[.58,-.75],[.66,-.45],[.80,.0],[.96,.10]],
  hd: [[.20,.22],[.46,.35],[.58,.30],[.66,-.1],[.96,-.05]],
  Lx: [[.20,-1.15],[.46,-2.05],[.58,-2.55],[.68,-1.0],[.96,-.78]],
  Rx: [[.20,-1.15],[.46,-2.05],[.58,-2.55],[.68,-1.0],[.96,-.78]],
  Le: [[.20,-.55],[.46,-.25],[.96,-2.0]], Re: [[.20,-.55],[.46,-.25],[.96,-2.0]],
  Lz: [[.20,.10],[.58,.25],[.96,.14]], Rz: [[.20,-.10],[.58,-.25],[.96,-.14]],
  Rhip: [[.36,0],[.50,.65],[.66,.30],[.90,0]], Rknee: [[.36,0],[.50,.60],[.66,.4],[.90,0]],
  zL: [[.20,.06],[.66,.06],[.96,.17]], zR: [[.20,-.10],[.66,-.10],[.96,-.15]],
}, CLINCH, HAND_FIST);

A.hipToss = mk({
  hry: [[.16,0],[.30,1.30],[.44,1.30],[.54,.40],[.66,.40],[.94,0]],
  spy: [[.30,.35],[.44,.35],[.54,-.30],[.94,0]],
  sp: [[.16,.20],[.30,.30],[.44,.30],[.54,.95],[.66,.95],[.94,.10]],
  ell: [[.16,.70],[.30,.56],[.44,.56],[.54,.60],[.94,.768]],
  Lx: [[.16,-1.40],[.30,-1.20],[.44,-1.20],[.54,-.30],[.94,-.78]], Le: [[.16,-1.0],[.44,-1.0],[.54,-.40],[.94,-2.0]],
  Rx: [[.16,-1.20],[.30,-1.00],[.44,-1.00],[.54,-.40],[.94,-.78]], Re: [[.44,-1.4],[.54,-.6],[.94,-2.0]],
  zL: [[.30,.05],[.44,.05],[.94,.17]], zR: [[.30,-.20],[.44,-.20],[.94,-.15]],
}, CLINCH, HAND_FIST);

A.ddt = mk({
  ell: [[.20,.72],[.42,.46],[.60,.42],[.70,.46],[.94,.768]],
  sp: [[.20,.30],[.42,-.45],[.60,-.50],[.70,-.20],[.94,.10]], hd: [[.42,.40],[.60,.40],[.94,-.05]],
  Lx: [[.20,-1.70],[.42,-1.90],[.60,-1.90],[.94,-.78]], Le: [[.20,-.80],[.42,-1.20],[.94,-2.0]],
  Rx: [[.20,-1.50],[.42,-1.60],[.60,-1.00],[.94,-.78]], Re: [[.20,-1.2],[.60,-1.2],[.94,-2.0]],
  Lhz: [[.42,.20],[.60,.20],[.94,0]], Rhz: [[.42,-.20],[.60,-.20],[.94,0]],
  Lknee: [[.42,.30],[.60,.30],[.94,0]], Rknee: [[.42,.30],[.60,.30],[.94,0]],
}, CLINCH, HAND_FIST);

A.chokeSlam = mk({
  Rx: [[.12,-1.50],[.30,-1.60],[.46,-2.80],[.58,-2.80],[.66,-.10],[.74,-.10],[.96,-.78]],
  Re: [[.12,-.50],[.46,-.20],[.66,-.20],[.96,-2.0]], Rz: [[.12,-.10],[.46,-.18],[.96,-.14]],
  Lx: [[.12,-.90],[.46,-1.40],[.58,-1.40],[.66,-.50],[.96,-.78]], Le: [[.46,-.80],[.96,-2.0]],
  sp: [[.12,.14],[.46,-.18],[.58,-.18],[.66,.55],[.74,.55],[.96,.10]], hd: [[.46,.10],[.58,.10],[.66,-.20],[.96,-.05]],
  ell: [[.12,.70],[.46,.80],[.58,.80],[.66,.58],[.74,.62],[.96,.768]],
}, CLINCH, HAND_FIST);

A.stunner = mk({
  Rhip: [[.10,-.50],[.24,-1.20],[.34,-1.20],[.46,0]], Rknee: [[.10,1.00],[.24,.15],[.34,.15],[.46,0]],
  Lx: [[.34,-1.75],[.46,-1.80],[.58,-1.50],[.70,-1.00],[.94,-.78]], Le: [[.46,-.90],[.58,-.70],[.94,-2.0]],
  Rx: [[.34,-1.60],[.46,-1.70],[.58,-1.40],[.70,-1.00],[.94,-.78]], Re: [[.46,-1.2],[.94,-2.0]],
  sp: [[.46,.05],[.58,-.50],[.66,-.55],[.94,.10]], hd: [[.58,.40],[.66,.40],[.94,-.05]],
  ell: [[.46,.74],[.58,.56],[.66,.56],[.94,.768]],
}, CLINCH, HAND_FIST);

/* ── lifts / takedowns / aerial ── */
A.bodySlam = mk({
  ell: [[.14,.55],[.30,.50],[.46,.80],[.58,.78],[.66,.58],[.72,.62],[.94,.768]],
  sp: [[.14,.65],[.30,.80],[.46,-.15],[.58,-.15],[.66,.70],[.72,.65],[.94,.10]],
  Lx: [[.14,-.90],[.30,-1.00],[.46,-2.30],[.58,-2.30],[.66,-.50],[.72,-.40],[.94,-.78]],
  Rx: [[.14,-.90],[.30,-1.00],[.46,-2.30],[.58,-2.30],[.66,-.50],[.72,-.40],[.94,-.78]],
  Le: [[.14,-.50],[.30,-.40],[.46,-.50],[.58,-.50],[.66,-.10],[.94,-2.0]], Re: [[.14,-.50],[.30,-.40],[.46,-.50],[.58,-.50],[.66,-.10],[.94,-2.0]],
  Lz: [[.14,.20],[.30,.10],[.46,.15],[.94,.14]], Rz: [[.14,-.20],[.30,-.10],[.46,-.15],[.94,-.14]],
  zL: [[.30,.30],[.66,.30],[.94,.17]],
}, GUARD, HAND_FIST);

A.singleLeg = mk({
  ell: [[.18,.54],[.34,.50],[.50,.54],[.66,.66],[.92,.768]],
  sp: [[.18,.75],[.34,1.05],[.50,.90],[.68,.35],[.92,.10]], hd: [[.34,-.50],[.68,-.20],[.92,-.05]],
  zL: [[.34,.55],[.50,.55],[.92,.17]],
  Lx: [[.18,-.90],[.34,-2.00],[.50,-1.70],[.68,-1.00],[.92,-.78]], Le: [[.34,-.60],[.50,-.90],[.92,-2.0]],
  Rx: [[.18,-.90],[.34,-2.00],[.50,-1.70],[.68,-1.00],[.92,-.78]], Re: [[.34,-.60],[.50,-.90],[.92,-2.0]],
  Lz: [[.34,.15],[.92,.14]], Rz: [[.34,-.15],[.92,-.14]],
  Rhip: [[.34,.50],[.50,.55],[.92,0]], Rknee: [[.34,.50],[.50,.50],[.92,0]],
}, GUARD, HAND_FIST, null, 0.5);

A.spear = mk({
  ell: [[.14,.58],[.30,.66],[.46,.66],[.64,.62],[.92,.768]],
  zL: [[.30,.50],[.46,.50],[.92,.17]], zR: [[.30,-.35],[.46,-.35],[.92,-.15]],
  sp: [[.14,.45],[.30,.95],[.46,.95],[.66,.70],[.92,.10]], hd: [[.30,-.55],[.66,-.55],[.92,-.05]],
  Lx: [[.14,-1.00],[.30,-1.70],[.46,-1.70],[.66,-1.30],[.92,-.78]], Le: [[.30,-.50],[.46,-.70],[.92,-2.0]],
  Rx: [[.14,-1.00],[.30,-1.70],[.46,-1.70],[.66,-1.30],[.92,-.78]], Re: [[.30,-.50],[.46,-.70],[.92,-2.0]],
  Lz: [[.30,.30],[.92,.14]], Rz: [[.30,-.30],[.92,-.14]],
  Rhip: [[.30,.60],[.46,.70],[.92,0]], Rknee: [[.30,.30],[.46,.25],[.92,0]],
}, GUARD, HAND_FIST, null, 0.46);

A.elbowDrop = mk({
  hpy: [[.14,.05],[.30,.40],[.46,.40],[.56,0],[.64,-.10],[.90,0]],
  Rx: [[.20,-1.90],[.40,-2.20],[.52,-.60],[.66,-.30],[.94,-.78]], Re: [[.20,-1.0],[.40,-2.55],[.56,-2.55],[.94,-2.0]],
  Lx: [[.20,-1.40],[.40,-1.90],[.52,-1.00],[.94,-.78]],
  sp: [[.14,-.20],[.30,.10],[.46,.45],[.58,.70],[.70,.50],[.94,.10]],
  Lhip: [[.20,-.35],[.46,-.35],[.60,-.60],[.90,0]], Rhip: [[.20,-.35],[.46,-.35],[.60,-.60],[.90,0]],
  Lknee: [[.20,.55],[.46,.55],[.60,.90],[.90,0]], Rknee: [[.20,.55],[.46,.55],[.60,.90],[.90,0]],
}, GUARD, HAND_FIST);

/* ══════════════════════════════════════════════════════════════════════════
   VICTIM TRACKS — the "equal and opposite" reaction, same normalised clock
   ══════════════════════════════════════════════════════════════════════════ */
const sway = (amt) => (t, P) => { P.spine[0] += amt * Math.sin(t * PI * 14); P.hips[1] += amt * 1.6 * Math.sin(t * PI * 9); };

/* light reactions are PHYSICS, not poses: the strike delivers an impulse and every body segment
   answers as a damped spring  x(τ) = A·e^(−ζωτ)·sin(ωτ)  — the head whips first, the torso follows,
   the arms lag behind the torso, the knees buckle and recover. Sampled into keyframes. */
function vLight(o) {
  return (ti) => {
    const W = 11, Z = 0.55;                                   /* natural frequency / damping */
    const peak = Math.exp(-Z * Math.atan(Math.sqrt(1 - Z * Z) / Z) / Math.sqrt(1 - Z * Z)) * Math.sin(Math.atan(Math.sqrt(1 - Z * Z) / Z)) || 0.6;
    const R = (tau) => (tau <= 0 ? 0 : Math.exp(-Z * W * tau) * Math.sin(W * Math.sqrt(1 - Z * Z) * tau) / peak);
    const ch = (amp, lag, pre) => {
      const k = [[Math.max(0, ti - .22), 0]];
      if (pre) k.push([ti - .02, pre]);                        /* flinch before contact */
      for (let i = 0; i <= 16; i++) { const tau = i * 0.035; k.push([ti + lag + tau, amp * R(tau)]); }
      return k;
    };
    const dk = [[Math.max(0, ti - .05), STAND_LEN]];
    for (let i = 0; i <= 14; i++) { const tau = i * 0.035; dk.push([ti + 0.02 + tau, STAND_LEN - (o.drop || .04) * Math.abs(R(tau)) * 1.1]); }
    return {
      hd:  ch(o.hd, 0.035), hdy: ch(o.hdy || 0, 0.035),               /* head lags the torso → whiplash */
      sp:  ch(o.sp, 0), spy: ch(o.spy || 0, 0), hry: ch(o.hry || 0, 0.01),
      ell: dk,
      Lx:  ch(.7, 0.05, -.25), Rx: ch(.7, 0.05, -.25),                 /* arms trail the body */
      Lz:  ch(.5, 0.07), Rz: ch(-.5, 0.07),
      Lknee: ch(o.knee || 0.12, 0.02), Rknee: ch(o.knee || 0.12, 0.02),
    };
  };
}
/* heavy reactions get (ti = impact, fin = knocked down) */
const V = {
  jab:         vLight({ hd: -.40, sp: -.12, drop: .03 }),
  cross:       vLight({ hd: -.60, sp: -.22, spy: -.2, drop: .05 }),
  hook:        vLight({ hd: -.25, hdy: .80, sp: -.10, spy: -.45, hry: -.3, drop: .05 }),
  elbowStrike: vLight({ hd: -.35, hdy: -.65, sp: -.15, spy: .30, drop: .05 }),
  lowKick:     vLight({ hd: .10, sp: .15, drop: .12, knee: .65 }),
  roundhouse:  vLight({ hd: -.45, hdy: .85, sp: -.20, spy: -.60, hry: -.5, drop: .08, knee: .3 }),

  superkick: (ti, fin) => ({
    hd: [[ti-.04,0],[ti+.06,-.85],[fin,-.50]], hdy: [[ti,0],[ti+.06,.50],[fin,.30]],
    sp: [[ti-.04,0],[ti+.08,-.35],[fin,-.60]], hry: [[ti,0],[ti+.10,.50],[fin,.90]],
    ell: [[ti,STAND_LEN],[ti+.10,.76],[fin,.62]],
    Lx: [[ti-.10,-.30],[ti,-.50],[ti+.08,.50]], Rx: [[ti-.10,-.30],[ti,-.50],[ti+.08,.50]],
    Lz: [[ti,.20],[ti+.10,.70]], Rz: [[ti,-.20],[ti+.10,-.70]],
  }),
  clothesline: (ti, fin) => ({
    hrx: [[ti,0],[ti+.08,-.50],[fin,-1.20]], hpy: [[ti,0],[ti+.07,.12],[fin,.05]],
    sp: [[ti,0],[ti+.07,-.45],[fin,-.80]], hd: [[ti,0],[ti+.07,-.60],[fin,-.70]],
    Lx: [[ti-.1,-.30],[ti,-.30],[ti+.08,.90]], Rx: [[ti-.1,-.30],[ti,-.30],[ti+.08,.90]],
    Lz: [[ti,.20],[ti+.10,1.10]], Rz: [[ti,-.20],[ti+.10,-1.10]],
    Lhip: [[ti,0],[ti+.08,-.50],[fin,-.40]], Rhip: [[ti,0],[ti+.08,-.30],[fin,-.30]],
  }),
  spear: (ti, fin) => ({
    ell: [[.10,.80],[ti-.04,.78],[ti+.06,.70],[fin,.62],[1,.50]], hpy: [[ti,0],[ti+.08,.10],[fin,0]],
    sp: [[.12,.10],[ti-.04,.10],[ti+.06,.95],[ti+.16,.90],[fin,-.50]], hd: [[ti,0],[ti+.10,.40],[fin,-.50]],
    Lx: [[.10,-.40],[ti,-.50],[ti+.10,.70],[fin,1.0]], Rx: [[.10,-.40],[ti,-.50],[ti+.10,.70],[fin,1.0]],
    Lz: [[ti,.30],[ti+.10,.90],[fin,1.10]], Rz: [[ti,-.30],[ti+.10,-.90],[fin,-1.10]],
    Lknee: [[ti,0],[ti+.10,.50],[fin,.80]], Rknee: [[ti,0],[ti+.10,.50],[fin,.80]],
    Lhip: [[ti,0],[ti+.12,-.50],[fin,-.20]], Rhip: [[ti,0],[ti+.12,-.40],[fin,-.20]],
  }),
  singleLeg: (ti, fin) => ({
    Lhip: [[.18,0],[.34,-.90],[ti,-.90],[fin,-.40]], hrx: [[.34,0],[ti,-.60],[fin,-1.30]],
    hpy: [[.34,0],[ti,.10],[fin,0]], sp: [[.34,.10],[ti,-.20],[fin,-.50]],
    Lx: [[.34,-.50],[ti,.40]], Rx: [[.34,-.50],[ti,.40]], Lz: [[.34,.30],[ti,1.0]], Rz: [[.34,-.30],[ti,-1.0]],
    Lknee: [[.34,0],[ti,.4]], 
  }),
  suplex: (ti, fin) => ({
    hpy: [[.20,0],[.44,.55],[.52,.75],[.60,.15],[fin,0]],
    hrx: [[.20,0],[.40,1.60],[.52,3.14],[.60,4.30],[fin,4.35]],
    Lx: [[.10,-.60],[.20,-.90],[.44,-1.40],[.60,.5]], Rx: [[.10,-.60],[.20,-.90],[.44,-1.40],[.60,.5]],
    Lz: [[.20,.50],[.50,.90]], Rz: [[.20,-.50],[.50,-.90]],
    sp: [[.20,.20],[.44,.10],[.60,0]], ell: [[.20,.80],[.60,.70]],
    Lknee: [[.30,0],[.52,.6]], Rknee: [[.30,0],[.52,.7]],
  }),
  hipToss: (ti, fin) => ({
    sp: [[.18,.45],[.30,.60],[.44,.65],[ti,1.0],[fin,.50]],
    hpy: [[.30,0],[.44,.25],[.52,.35],[.60,.10],[fin,0]],
    hrx: [[.30,0],[.44,.90],[ti,2.2],[.62,3.3],[fin,3.6]],
    Lx: [[.30,-.60],[.50,-1.30],[.60,.40]], Rx: [[.30,-.60],[.50,-1.30],[.60,.40]],
    Lknee: [[.50,0],[.62,.9]], Rknee: [[.50,0],[.62,.9]],
  }),
  ddt: (ti, fin) => ({
    sp: [[.18,0],[.30,.95],[.52,.95],[ti,1.10],[fin,1.20]], hd: [[.30,.50],[ti,.70],[fin,.90]],
    ell: [[.18,STAND_LEN],[.30,.70],[.52,.56],[.60,.46],[fin,.44]],
    Lx: [[.20,-.20],[.50,.40]], Rx: [[.20,-.20],[.50,.40]],
    Lknee: [[.30,.20],[ti,.50],[fin,.50]], Rknee: [[.30,.20],[ti,.50],[fin,.50]],
    hrx: [[.50,0],[.60,.60],[fin,.90]],
  }),
  chokeSlam: (ti, fin) => ({
    hpy: [[.12,0],[.30,.32],[.46,.48],[.58,.48],[.66,.05],[fin,0]],
    sp: [[.12,0],[.30,-.20],[.58,-.25],[.66,.55]], hd: [[.30,-.45],[.58,-.50],[.66,.20]],
    Lx: [[.20,-1.20],[.46,-1.60],[.60,-1.60],[.68,.60]], Rx: [[.20,-1.20],[.46,-1.60],[.60,-1.60],[.68,.60]],
    Le: [[.20,-1.90],[.60,-1.90]], Re: [[.20,-1.90],[.60,-1.90]],
    Lhip: [[.30,.15],[.58,.10]], Rhip: [[.30,.10],[.58,.08]],
    Lknee: [[.30,.30],[.60,.40],[.68,.90]], Rknee: [[.30,.20],[.60,.30],[.68,.80]],
    hrx: [[.56,-.20],[.66,-1.30]],
  }),
  stunner: (ti, fin) => ({
    sp: [[.10,.30],[.24,.85],[.46,.60],[ti,.95],[fin,1.10]], hd: [[.46,.30],[ti,.80],[fin,1.0]],
    ell: [[.10,.76],[.24,.68],[.46,.70],[ti,.52],[fin,.44]],
    Lx: [[.2,-.5],[.46,-.9],[ti,.4]], Rx: [[.2,-.5],[.46,-.9],[ti,.4]], Lz: [[.46,.3],[ti,.9]], Rz: [[.46,-.3],[ti,-.9]],
  }),
  bodySlam: (ti, fin) => ({
    hrx: [[.14,0],[.30,-1.50],[.46,-1.55],[.58,-1.55],[fin,-1.20]],
    hpy: [[.14,0],[.30,.35],[.46,.60],[.58,.60],[.66,.10],[fin,0]],
    Lx: [[.14,-.4],[.46,-.8],[.66,.5]], Rx: [[.14,-.4],[.46,-.8],[.66,.5]],
    Lz: [[.30,.3],[.66,.9]], Rz: [[.30,-.3],[.66,-.9]],
    Lknee: [[.30,.2],[.58,.2]], Rknee: [[.30,.2],[.58,.2]],
  }),
  elbowDrop: (ti, fin) => ({
    sp: [[.50,.10],[ti+.04,.80],[fin,1.0]], hd: [[.50,0],[ti+.04,.60],[fin,.80]],
    ell: [[ti,.80],[fin,.50]], Lx: [[.50,-.30],[ti+.02,-1.60]], Rx: [[.50,-.30],[ti+.02,-1.60]],
    Le: [[ti+.02,-1.90]], Re: [[ti+.02,-1.90]], Lknee: [[ti,0],[fin,.8]], Rknee: [[ti,0],[fin,.8]],
  }),
};
const VC = {   /* victims held in a clinch (base = hunched hold pose) */
  clinch: () => ({   /* starts standing, ends hunched in the hold */
    sp: [[0,0],[.30,0],[.55,.45],[1,.45]], hd: [[0,0],[.30,0],[.55,.30],[1,.30]],
    ell: [[0,STAND_LEN],[.30,STAND_LEN],[.55,.76],[1,.76]],
    Lx: [[0,0],[.30,-.20],[.55,-.55],[1,-.55]], Rx: [[0,0],[.30,-.20],[.55,-.55],[1,-.55]],
    Lz: [[0,.06],[.30,.06],[.55,.30],[1,.30]], Rz: [[0,-.06],[.30,-.06],[.55,-.30],[1,-.30]],
    Le: [[0,-.10],[.30,-.10],[.55,-.80],[1,-.80]], Re: [[0,-.10],[.30,-.10],[.55,-.80],[1,-.80]],
  }),
  clinchHold: () => ({}),
  clinchKnee: (ti) => ({
    sp: [[ti-.05,.45],[ti+.06,.95],[ti+.30,.60],[.85,.45]], hd: [[ti-.05,.30],[ti+.06,.75],[.85,.30]],
    ell: [[ti-.05,.76],[ti+.08,.66],[.85,.76]], Lknee: [[ti,0],[ti+.08,.5],[.85,0]], Rknee: [[ti,0],[ti+.08,.5],[.85,0]],
  }),
};

/* ══════════════════════════════════════════════════════════════════════════
   MOVE TABLE
   dur     emote length (animator units; real seconds = dur / EMOTE_SPEED)
   impact  normalised time of the main hit
   fin     normalised time the victim is put on the ground (knock moves)
   cancel  normalised time the NEXT move may take over (combo window)
   path    [t, forward m, side m] keys — where the carried victim is, relative
           to the attacker (+side = attacker's left)
   push    metres a light strike shoves the victim along the attacker's facing
   stop    hit-stop seconds on contact (weight!)
   npc     false ⇒ pursuers/NPCs never pick it
   ══════════════════════════════════════════════════════════════════════════ */
export const EMOTE_SPEED = 1.4;
export const IMPACT_AT = 0.5;

const M = (o) => o;
const RAW = {
  /* strikes */
  jab:         M({ dur: .70, label: "JAB",          kind: "strike", damage: 7,  reach: 1.7, impact: .30, cancel: .54, push: .10, stop: .03, part: "head",  sfx: ["punch_impact", null], hand: "L" }),
  cross:       M({ dur: .85, label: "CROSS",        kind: "strike", damage: 11, reach: 1.8, impact: .34, cancel: .58, push: .16, stop: .05, part: "head",  sfx: ["punch_impact", null] }),
  hook:        M({ dur: .95, label: "HOOK",         kind: "strike", damage: 13, reach: 1.6, impact: .38, cancel: .60, push: .20, stop: .06, part: "head",  sfx: ["punch_impact", null] }),
  elbowStrike: M({ dur: .90, label: "ELBOW",        kind: "strike", damage: 14, reach: 1.3, impact: .36, cancel: .60, push: .14, stop: .06, part: "head",  sfx: ["flesh_hit", null] }),
  lowKick:     M({ dur: 1.0, label: "LOW KICK",     kind: "strike", damage: 10, reach: 1.9, impact: .40, cancel: .62, push: .12, stop: .05, part: "leg",   sfx: ["flesh_hit", null] }),
  roundhouse:  M({ dur: 1.2, label: "ROUNDHOUSE",   kind: "strike", damage: 18, reach: 2.0, impact: .44, cancel: .66, push: .30, stop: .07, part: "head",  sfx: ["punch_impact", null] }),
  superkick:   M({ dur: 1.2, label: "SUPERKICK",    kind: "heavy",  damage: 26, reach: 2.2, impact: .44, fin: .56, cancel: .80, stop: .09, part: "head", knock: true, sfx: ["punch_impact", "body_fall"],
                   path: [[.08,1.15,0],[.44,1.15,0],[.58,1.95,0]] }),
  clothesline: M({ dur: 1.1, label: "CLOTHESLINE",  kind: "heavy",  damage: 22, reach: 2.0, impact: .48, fin: .60, cancel: .78, stop: .08, part: "head", knock: true, sfx: ["punch_impact", "body_fall"],
                   path: [[.10,.98,0],[.48,.98,0],[.62,1.35,0]] }),
  /* clinch family */
  clinch:      M({ dur: .75, label: "CLINCH",       kind: "grab",   damage: 0,  reach: 1.7, impact: .45, cancel: .98, npc: false, hold: true, sfx: ["flesh_hit", null],
                   path: [[.30,.66,0],[.60,.58,0],[1,.58,0]] }),
  clinchHold:  M({ dur: 3.1, label: "CLINCH HOLD",  kind: "hold",   damage: 0,  reach: 1.7, impact: .99, cancel: .02, npc: false, hidden: true,
                   path: [[0,.58,0],[1,.58,0]] }),
  clinchKnee:  M({ dur: .85, label: "CLINCH KNEE",  kind: "clinchStrike", damage: 14, reach: 1.7, impact: .38, cancel: .62, push: 0, stop: .06, part: "torso", npc: false, sfx: ["flesh_hit", null], needs: "clinch",
                   path: [[0,.58,0],[1,.58,0]] }),
  stunner:     M({ dur: 1.4, label: "STUNNER",      kind: "heavy",  damage: 30, reach: 1.7, impact: .58, fin: .66, cancel: .84, stop: .08, part: "head", knock: true, needs: "clinch", sfx: ["punch_impact", "body_fall"],
                   hits: [{ t: .26, w: .3, part: "torso" }], path: [[.14,.62,0],[.46,.55,0],[.58,.50,0],[.66,.55,0]] }),
  ddt:         M({ dur: 1.3, label: "DDT",          kind: "heavy",  damage: 28, reach: 1.6, impact: .58, fin: .66, cancel: .84, stop: .08, part: "head", knock: true, needs: "clinch", sfx: ["flesh_hit", "body_fall"],
                   path: [[.20,.55,0],[.42,.40,0],[.58,.30,0]] }),
  hipToss:     M({ dur: 1.3, label: "HIP TOSS",     kind: "heavy",  damage: 24, reach: 1.6, impact: .54, fin: .64, cancel: .82, stop: .07, part: "torso", knock: true, needs: "clinch", sfx: ["flesh_hit", "body_fall"],
                   path: [[.18,.58,0],[.30,.52,.05],[.44,.50,.20],[.56,.55,.65],[.64,.60,.95]] }),
  suplex:      M({ dur: 1.7, label: "SUPLEX",       kind: "heavy",  damage: 32, reach: 1.8, impact: .60, fin: .66, cancel: .86, stop: .10, part: "torso", knock: true, needs: "clinch", sfx: ["flesh_hit", "body_fall"],
                   path: [[.20,.60,0],[.44,.50,0],[.56,-.10,0],[.64,-.95,0]] }),
  chokeSlam:   M({ dur: 1.6, label: "CHOKE SLAM",   kind: "heavy",  damage: 34, reach: 1.7, impact: .62, fin: .70, cancel: .88, stop: .11, part: "torso", knock: true, needs: "clinch", sfx: ["flesh_hit", "body_fall"],
                   path: [[.12,.72,0],[.46,.72,0],[.62,.72,0],[.70,.85,0]] }),
  /* lifts / takedowns / aerial */
  bodySlam:    M({ dur: 1.5, label: "BODY SLAM",    kind: "heavy",  damage: 26, reach: 1.5, impact: .60, fin: .68, cancel: .84, stop: .09, part: "torso", knock: true, sfx: ["flesh_hit", "body_fall"],
                   path: [[.14,.48,0],[.30,.38,0],[.46,.20,0],[.58,.25,0],[.68,.85,0]] }),
  singleLeg:   M({ dur: 1.3, label: "SINGLE LEG",   kind: "heavy",  damage: 18, reach: 2.0, impact: .50, fin: .64, cancel: .82, stop: .06, part: "leg",   knock: true, sfx: ["flesh_hit", "body_fall"],
                   path: [[.18,.75,0],[.50,.65,0],[.64,1.15,0]] }),
  spear:       M({ dur: 1.2, label: "SPEAR",        kind: "heavy",  damage: 30, reach: 2.4, impact: .46, fin: .64, cancel: .82, stop: .08, part: "torso", knock: true, sfx: ["punch_impact", "body_fall"],
                   path: [[.10,.95,0],[.46,.85,0],[.64,1.75,0]] }),
  elbowDrop:   M({ dur: 1.3, label: "ELBOW DROP",   kind: "heavy",  damage: 24, reach: 1.5, impact: .56, fin: .64, cancel: .82, stop: .08, part: "head",  knock: true, sfx: ["flesh_hit", "body_fall"],
                   path: [[.14,.90,0],[.56,.90,0],[.64,.95,0]] }),
};

/* ── build the exported tables ── */
export const WRESTLING_MOVES = {};
export const VICTIM_MOVES = {};
const _victimSolve = {};

for (const name in RAW) {
  const m = RAW[name];
  const ti = m.impact, fin = m.fin != null ? m.fin : Math.min(0.95, ti + 0.12);
  m.fin = fin;
  if (!m.hits) m.hits = [];
  m.hits = [{ t: ti, w: 1, part: m.part }].concat(m.hits.map((h) => ({ part: m.part, ...h })));
  m.hits.sort((p, q) => p.t - q.t);
  if (m.npc === undefined) m.npc = true;
  m.solve = A[name];
  WRESTLING_MOVES[name] = m;

  const clinchVictim = !!VC[name];
  const spec = clinchVictim ? VC[name](ti, fin) : V[name] && V[name](ti, fin);
  if (spec) {
    const base = (clinchVictim && name !== "clinch") || m.needs === "clinch" ? VCLINCH : VSTAND;
    const hasKeys = Object.keys(spec).length > 0;
    const body = hasKeys ? mk(spec, base, HAND_OPEN, null)
      : mk({}, base, HAND_OPEN, sway(0.02));
    _victimSolve[name] = body;
    VICTIM_MOVES[name] = body;
  }
}

/* heavy moves started from a clinch must begin from the hunched pose, not standing */
export const victimEmoteName = (move) => "vic_" + move;

export function solveWrestling(name, t, P, a) {
  const m = WRESTLING_MOVES[name];
  if (m) m.solve(t, P, a);
}

export function registerWrestlingEmotes(EMOTES, EMOTE_FN) {
  for (const name in WRESTLING_MOVES) {
    const cfg = WRESTLING_MOVES[name];
    EMOTES[name] = { dur: cfg.dur, label: cfg.label };
    EMOTE_FN[name] = (t, P, a) => cfg.solve(clamp(t / cfg.dur, 0, 1), P, a);
    const vf = VICTIM_MOVES[name];
    if (vf) {
      EMOTES["vic_" + name] = { dur: cfg.dur, label: cfg.label + " (VICTIM)" };
      EMOTE_FN["vic_" + name] = (t, P, a) => vf(clamp(t / cfg.dur, 0, 1), P, a);
    }
  }
}
