/* ════════════════════════════════════════════════════════════════
   hit-react.js — per-body-part bullet reactions + limb dislocation.

   Plugs into the animator's existing `ctl._overlay(R)` hook (runs after the
   pose is written, before the joint blend), so it layers ON TOP of walking /
   idle / fleeing and never touches drive.js, interiors or the gait code.

   How it works
   • every joint group is a damped spring (rotation offset a, velocity v)
   • a hit kicks the springs with an impulse that depends on the BODY PART,
     the SIDE it landed on, the direction the bullet travelled and how hard
     it hit  -> head snap, chest fold, arm whip, knee buckle, ankle give…
   • some clips also set a short "hold" pose (hands cover head, clutch belly,
     arm held against ribs, hop on one leg, drop to a knee)
   • arm / leg hits can DISLOCATE the limb: the joint pops, then the limb
     hangs wrong (arm swung out + twisted forearm, leg splayed + knee bent +
     limp) for ~25 s while the other arm clutches it
   • badly hurt NPCs (<35 % hp) hunch over, hold their belly and stumble

   API
     HitReact.hit(actor, part, dmg, info) -> { clip, dur, dislocated }
        actor = { ctl, rig?, hp?, maxHp? }  (an NPC or a pursuer)
        info  = { dir:{x,y,z}, point:{x,y,z}, type }
     HitReact.attach(actor)   install the overlay (done by hit())
     HitReact.clear(actor)    remove it (death / limp takes over)
     HitReact.CLIP_NAMES      every clip name, for debugging / the lab
   ════════════════════════════════════════════════════════════════ */

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* spring constants [stiffness k, damping c] per channel */
const KC = {
  head: [70, 7], neck: [60, 7], spine: [46, 6], hips: [40, 6], hipsP: [90, 16],
  shL: [52, 6], shR: [52, 6], elL: [46, 5.5], elR: [46, 5.5], wrL: [30, 3.5], wrR: [30, 3.5],
  hpL: [58, 7], hpR: [58, 7], knL: [58, 7], knR: [58, 7], anL: [40, 5], anR: [40, 5],
};
const CH = Object.keys(KC);
const LIM = { hipsP: 0.34 };           /* metres; every other channel is radians */

/* current hp of an NPC (actor.hp) or a pursuer (its target holds the live value) */
const hpOf = (a) => (a.tgt && a.tgt.hp != null ? a.tgt.hp : a.hp);

function newState() {
  const st = {
    a: {}, v: {}, tg: {},
    hold: null, holdT: 0, holdDur: 0,
    daze: 0, dazeAmp: 0,
    disc: { armL: 0, armR: 0, legL: 0, legR: 0 },      /* seconds of dislocation left */
    limbDmg: { armL: 0, armR: 0, legL: 0, legR: 0 },
    t: 0, last: 0, phase: 0, tripCd: 2, lastClip: "",
    woundSide: Math.random() < 0.5 ? "L" : "R",
    wasWounded: false, stumble: 0,
  };
  for (const c of CH) { st.a[c] = [0, 0, 0]; st.v[c] = [0, 0, 0]; st.tg[c] = [0, 0, 0]; }
  return st;
}

/* ── tiny helpers the clips use ─────────────────────────────── */
const P = (st, ch, x, y, z) => { const v = st.v[ch]; v[0] += x || 0; v[1] += y || 0; v[2] += z || 0; };
const D = (st, d) => P(st, "hipsP", 0, d, 0);                       /* hips drop impulse (negative = down) */
const H = (st, dur, pose) => { st.hold = pose; st.holdT = st.holdDur = dur; };
const other = (n) => (n === "L" ? "R" : "L");

/* Clips. s = +1 when the hit landed on the victim's LEFT side, -1 right.
   N = near side letter, F = far side letter, o = outward-z sign of the near arm.
   I = intensity (0.55 … 1.6). Each returns its own duration (the NPC's react timer uses it). */
const CLIPS = {
  head: {
    snapBack(st, s, I, N, F, o) {
      P(st, "head", -8 * I, 0, 0); P(st, "neck", -4 * I, 0, 0); P(st, "spine", -2.5 * I, 0, 0);
      P(st, "shL", 0, 0, 4 * I); P(st, "shR", 0, 0, -4 * I); P(st, "elL", -3 * I, 0, 0); P(st, "elR", -3 * I, 0, 0);
      D(st, -0.5 * I); st.daze = 0.9 * I; st.dazeAmp = 0.22; return 0.55;
    },
    snapSide(st, s, I) {
      P(st, "head", 0, -8 * I * s, 6 * I * s); P(st, "neck", 0, -3 * I * s, 3 * I * s); P(st, "spine", 0, 0, -3 * I * s);
      D(st, -0.3 * I); st.daze = 0.6 * I; st.dazeAmp = 0.18; return 0.5;
    },
    coverHead(st, s, I) {
      P(st, "head", 7 * I, 0, 0); P(st, "spine", 5 * I, 0, 0); D(st, -0.5 * I);
      H(st, 0.9 + 0.3 * I, {
        shL: [-1.9, 0, 0.2], shR: [-1.9, 0, -0.2], elL: [-1.9, 0, 0], elR: [-1.9, 0, 0],
        spine: [0.35, 0, 0], head: [0.3, 0, 0],
      });
      return 0.7;
    },
    whiplash(st, s, I) {
      P(st, "head", 0, 12 * I * s, 0); P(st, "spine", 0, 5 * I * s, 0); P(st, "hips", 0, 4 * I * s, 0);
      P(st, "hpL", -3, 0, 0); P(st, "hpR", 3, 0, 0); P(st, "knL", 5 * I, 0, 0); D(st, -1.4 * I);
      st.daze = 1.3 * I; st.dazeAmp = 0.3; return 0.75;
    },
  },
  torso: {
    fold(st, s, I, N, F, o) {
      P(st, "spine", 10 * I, 0, 0); P(st, "head", 5 * I, 0, 0); D(st, -0.9 * I);
      H(st, 1.6, {
        spine: [0.55, 0, 0], head: [0.3, 0, 0],
        ["sh" + N]: [-0.95, 0, -0.35 * o], ["el" + N]: [-1.6, 0, 0],
        ["sh" + F]: [-0.9, 0, 0.35 * o], ["el" + F]: [-1.55, 0, 0],
      });
      return 0.7;
    },
    arch(st, s, I) {
      P(st, "spine", -9 * I, 0, 0); P(st, "head", -6 * I, 0, 0);
      P(st, "shL", 0, 0, 5 * I); P(st, "shR", 0, 0, -5 * I); P(st, "elL", -4 * I, 0, 0); P(st, "elR", -4 * I, 0, 0);
      D(st, -0.3 * I); H(st, 0.5, { spine: [-0.25, 0, 0] }); return 0.5;
    },
    twist(st, s, I, N) {
      P(st, "spine", 0, 9 * I * s, 0); P(st, "hips", 0, 4 * I * s, 0); P(st, "head", 0, -5 * I * s, 0);
      P(st, "sh" + N, -5 * I, 0, 0); D(st, -0.25 * I); return 0.55;
    },
    ribs(st, s, I, N, F, o) {
      P(st, "spine", 0, 0, 8 * I * s); P(st, "hips", 0, 0, 3 * I * s);
      H(st, 1.5, { spine: [0.1, 0, 0.2 * s], ["sh" + N]: [-0.25, 0, -0.08 * o], ["el" + N]: [-1.35, 0, 0] });
      return 0.6;
    },
    stagger(st, s, I) {
      P(st, "spine", -4 * I, 0, 0); P(st, "hpL", -6, 0, 0); P(st, "hpR", 5, 0, 0); P(st, "knL", 3, 0, 0);
      P(st, "shL", 0, 0, 5 * I); P(st, "shR", 0, 0, -5 * I); D(st, -0.4 * I); H(st, 0.4, { spine: [-0.12, 0, 0] });
      return 0.55;
    },
  },
  arm: {
    jerk(st, s, I, N, F, o) {
      P(st, "sh" + N, -6 * I, 0, 7 * I * o); P(st, "el" + N, -8 * I, 0, 0); P(st, "wr" + N, 0, 0, 6 * o); P(st, "spine", 0, 0, 3 * I * o);
      H(st, 1.4, { ["sh" + F]: [-0.95, 0, 0.3 * o], ["el" + F]: [-1.65, 0, 0] }); return 0.45;
    },
    swingBack(st, s, I, N, F, o) {
      P(st, "sh" + N, 9 * I, 0, 0); P(st, "el" + N, -3 * I, 0, 0); P(st, "spine", 0, 3 * I * s, 0);
      H(st, 1.0, { ["sh" + N]: [0.3, 0, 0.25 * o], ["el" + N]: [-0.9, 0, 0] }); return 0.45;
    },
    spin(st, s, I, N, F, o) {
      P(st, "sh" + N, 0, 10 * I * o, 0); P(st, "spine", 0, 4 * I * s, 0); P(st, "hips", 0, 2 * I * s, 0); D(st, -0.3 * I); return 0.5;
    },
    flail(st, s, I, N, F, o) {
      P(st, "shL", -7 * I, 0, 0); P(st, "shR", -7 * I, 0, 0); P(st, "elL", -6 * I, 0, 0); P(st, "elR", -6 * I, 0, 0); P(st, "head", -2, 0, 0);
      H(st, 1.2, { ["sh" + F]: [-0.95, 0, 0.3 * o], ["el" + F]: [-1.65, 0, 0] }); return 0.5;
    },
  },
  leg: {
    buckle(st, s, I, N) {
      P(st, "kn" + N, 9 * I, 0, 0); P(st, "hp" + N, -4 * I, 0, 0); D(st, -1.8 * I); P(st, "spine", 3 * I, 0, 0);
      H(st, 0.9, { ["kn" + N]: [0.9, 0, 0], ["hp" + N]: [-0.35, 0, 0], hipsP: [0, -0.1, 0] }); return 0.7;
    },
    kickOut(st, s, I, N) {
      P(st, "hp" + N, -9 * I, 0, 0); P(st, "kn" + N, 4 * I, 0, 0); P(st, "spine", -3 * I, 0, 0);
      P(st, "shL", 0, 0, 4 * I); P(st, "shR", 0, 0, -4 * I); D(st, -0.8 * I); return 0.6;
    },
    hop(st, s, I, N) {
      D(st, 0.4); P(st, "spine", 2, 0, 0);
      H(st, 1.4, { ["hp" + N]: [-0.85, 0, 0], ["kn" + N]: [1.35, 0, 0], shL: [-0.2, 0, 0.55], shR: [-0.2, 0, -0.55] }); return 0.7;
    },
    trip(st, s, I) {
      P(st, "hpL", -6, 0, 0); P(st, "hpR", 6, 0, 0); P(st, "spine", 6 * I, 0, 0);
      P(st, "shL", -8 * I, 0, 0); P(st, "shR", 8 * I, 0, 0); D(st, -0.7 * I); return 0.65;
    },
    kneeDrop(st, s, I) {
      D(st, -1.2 * I); H(st, 1.6, { hipsP: [0, -0.3, 0], spine: [0.3, 0, 0], head: [0.1, 0, 0] }); return 0.9;
    },
  },
  foot: {
    hopHold(st, s, I, N) {
      P(st, "an" + N, 6, 0, 0); D(st, 0.3);
      H(st, 1.1, { ["hp" + N]: [-0.9, 0, 0], ["kn" + N]: [1.4, 0, 0], shL: [-0.2, 0, 0.5], shR: [-0.2, 0, -0.5] }); return 0.6;
    },
    ankleGive(st, s, I, N, F, o) {
      P(st, "an" + N, 0, 0, 9 * o); P(st, "kn" + N, 3, 0, 0); P(st, "hips", 0, 0, 3 * s);
      P(st, "shL", 0, 0, 4); P(st, "shR", 0, 0, -4); D(st, -0.6 * I); return 0.55;
    },
    stompBack(st, s, I) {
      P(st, "hpL", -5, 0, 0); P(st, "hpR", 5, 0, 0); P(st, "spine", -3, 0, 0);
      P(st, "shL", 0, 0, 3); P(st, "shR", 0, 0, -3); D(st, -0.3 * I); return 0.5;
    },
  },
};
const CLIP_NAMES = [];
for (const part in CLIPS) for (const n in CLIPS[part]) CLIP_NAMES.push(part + "." + n);

/* which clips are allowed for a given hit. fromBehind biases head/torso variants. */
function pickClip(part, fromBehind, st) {
  const group = CLIPS[part] ? part : "torso";
  let names = Object.keys(CLIPS[group]);
  if (group === "head") names = fromBehind ? ["coverHead", "whiplash", "snapSide"] : ["snapBack", "snapSide", "whiplash", "coverHead"];
  if (group === "torso") names = fromBehind ? ["arch", "stagger", "twist", "ribs"] : ["fold", "ribs", "twist", "stagger", "arch"];
  const pool = names.filter((n) => group + "." + n !== st.lastClip);
  const name = (pool.length ? pool : names)[Math.floor(Math.random() * (pool.length ? pool.length : names.length))];
  return { group, name };
}

/* ── dislocation ────────────────────────────────────────────── */
const DISC_TIME = 25;
function dislocate(st, kind, letter) {
  const key = kind + letter;
  st.disc[key] = DISC_TIME;
  const o = letter === "L" ? 1 : -1;
  if (kind === "arm") {                                   /* the joint pops: violent snap, then it hangs wrong */
    P(st, "sh" + letter, 4, 12 * o, 10 * o); P(st, "el" + letter, -10, 0, 0); P(st, "wr" + letter, 0, 0, 10 * o);
    P(st, "spine", 0, 0, 4 * o); P(st, "head", 0, 0, 3 * o);
  } else {
    P(st, "hp" + letter, -6, 8 * o, 7 * o); P(st, "kn" + letter, 8, 0, 0); P(st, "an" + letter, 6, 0, 4 * o);
    P(st, "hips", 0, 0, -4 * o); D(st, -1.6);
  }
  st.dazeAmp = Math.max(st.dazeAmp, 0.12); st.daze = Math.max(st.daze, 0.5);
  return key;
}

function chance(part, dmg, maxHp, type, st, key) {
  st.limbDmg[key] += dmg;
  if (st.disc[key] > 0) return false;
  if (st.limbDmg[key] > maxHp * 0.30) return true;                         /* enough punishment: it goes */
  let p = 0.10 + (dmg / maxHp) * 1.5;
  if (type === "shotgun" || type === "sniper") p += 0.28;
  else if (type === "rifle" || type === "lmg") p += 0.06;
  return Math.random() < clamp(p, 0.08, 0.85);
}

/* ── continuous targets (dislocated limbs, wounded posture, hold poses) ── */
function buildTargets(st, actor, dt) {
  const tg = st.tg;
  for (const c of CH) { const t = tg[c]; t[0] = 0; t[1] = 0; t[2] = 0; }
  const add = (ch, x, y, z, w) => { const t = tg[ch]; w = w == null ? 1 : w; t[0] += x * w; t[1] += y * w; t[2] += z * w; };
  const T = st.t;
  const fade = (v) => clamp(v / 1.5, 0, 1);                              /* limb "relocates" over the last 1.5 s */

  for (const L of ["L", "R"]) {
    const o = L === "L" ? 1 : -1, F = other(L);
    if (st.disc["arm" + L] > 0) {
      const w = fade(st.disc["arm" + L]);
      add("sh" + L, 0.35, 0.7 * o, 0.55 * o, w);
      add("el" + L, -0.75 + Math.sin(T * 2.3 + o) * 0.06, 0, 0, w);
      add("wr" + L, 0, 0, 0.5 * o + Math.sin(T * 3.1) * 0.12, w);
      add("spine", 0, 0, 0.10 * o, w);
      /* the other hand clutches it */
      add("sh" + F, -0.85, 0, 0.32 * o, w); add("el" + F, -1.5, 0, 0, w);
    }
    if (st.disc["leg" + L] > 0) {
      const w = fade(st.disc["leg" + L]);
      add("hp" + L, -0.22, 0.45 * o, 0.5 * o, w);
      add("kn" + L, 0.65, 0, 0, w);
      add("an" + L, 0.4, 0, 0.3 * o, w);
      add("hips", 0, 0, -0.10 * o, w);
      add("spine", 0, 0, 0.08 * o, w);
      add("hipsP", 0, -0.045, 0, w);
    }
  }

  /* walking with a dislocated leg: a hitch in every step */
  const legBad = st.disc.legL > 0 || st.disc.legR > 0;
  const speed = actor.moveSpeed || 0;
  if (legBad && speed > 0.3) {
    st.phase += dt * (1.2 + speed * 1.1);
    add("hipsP", 0, -0.03 * Math.abs(Math.sin(st.phase * Math.PI)), 0);
    add("hips", 0, 0, Math.sin(st.phase * Math.PI) * 0.05 * (st.disc.legL > 0 ? -1 : 1));
  }

  /* badly hurt: hunched, hand on the belly, shaking breath, the odd stumble */
  const maxHp = actor.maxHp || 100;
  const cur = hpOf(actor), frac = (cur != null ? cur : maxHp) / maxHp;
  const hurt = frac < 0.35 && !(actor.dead);
  if (hurt) {
    const w = clamp((0.35 - frac) / 0.2, 0.35, 1);
    const W = st.woundSide, o = W === "L" ? 1 : -1;
    add("spine", 0.18 + Math.sin(T * 9) * 0.015, 0, 0, w);
    add("head", 0.10, 0, 0, w);
    if (st.disc["arm" + W] <= 0 && st.disc["arm" + other(W)] <= 0) {
      add("sh" + W, -0.75, 0, -0.3 * o, w); add("el" + W, -1.55, 0, 0, w);
    }
    if (speed > 1 && !st.holdT) {
      st.tripCd -= dt;
      if (st.tripCd <= 0) {
        st.tripCd = 2.2 + Math.random() * 2.5;
        CLIPS.leg.trip(st, 1, 0.8, "L", "R", 1);
      }
    }
  }

  /* timed hold pose (hands over head, clutch belly…) with soft in / out */
  if (st.holdT > 0 && st.hold) {
    const e = Math.min(1, (st.holdDur - st.holdT) / 0.12, st.holdT / 0.35);
    const w = clamp(e, 0, 1);
    for (const ch in st.hold) { const h = st.hold[ch]; add(ch, h[0], h[1], h[2], w); }
  }
  /* daze: head wobble after a hard knock */
  if (st.daze > 0) {
    const w = clamp(st.daze / 0.5, 0, 1) * st.dazeAmp;
    add("head", Math.sin(T * 7.3) * 0.5 * w, Math.sin(T * 5.1) * 1.0 * w, Math.sin(T * 6.2) * 0.8 * w);
    add("spine", Math.sin(T * 4.4) * 0.15 * w, 0, Math.sin(T * 3.7) * 0.2 * w);
  }
}

function stepState(st, actor, dt) {
  /* timers */
  if (st.holdT > 0) { st.holdT -= dt; if (st.holdT <= 0) { st.hold = null; st.holdT = 0; } }
  if (st.daze > 0) st.daze = Math.max(0, st.daze - dt);
  for (const k in st.disc) if (st.disc[k] > 0) {
    const before = st.disc[k];
    st.disc[k] = Math.max(0, before - dt);
    if (before > 0 && st.disc[k] === 0) {                       /* shoulder / knee slides back in with a pop */
      const letter = k.slice(-1), o = letter === "L" ? 1 : -1;
      if (k.startsWith("arm")) P(st, "sh" + letter, -3, -5 * o, -4 * o); else P(st, "hp" + letter, 3, -4 * o, -3 * o);
    }
  }
  st.t += dt;
  buildTargets(st, actor, dt);

  /* spring integration (sub-stepped so stiff springs stay stable) */
  const n = dt > 0.025 ? 2 : 1, h = dt / n;
  for (let s = 0; s < n; s++) {
    for (const ch of CH) {
      const a = st.a[ch], v = st.v[ch], tg = st.tg[ch], k = KC[ch][0], c = KC[ch][1];
      for (let i = 0; i < 3; i++) {
        const acc = -k * (a[i] - tg[i]) - c * v[i];
        v[i] += acc * h;
        a[i] += v[i] * h;
        const lim = ch === "hipsP" ? LIM.hipsP : 1.7;
        if (a[i] > lim) { a[i] = lim; if (v[i] > 0) v[i] = 0; }
        else if (a[i] < -lim) { a[i] = -lim; if (v[i] < 0) v[i] = 0; }
        if (!isFinite(a[i])) { a[i] = 0; v[i] = 0; }
      }
    }
  }
}

/* two-link leg flex so a lowered pelvis bends BOTH knees instead of sinking the feet into the floor */
function autoFlex(drop) {
  const d = clamp(-drop, 0, 0.5);                                /* metres the hips are down */
  if (d < 0.004) return null;
  const al = 2 * Math.acos(clamp((0.92 - d) / 0.92, 0, 1));      /* knee angle for a 0.92 m leg */
  return { hip: -al / 2, knee: al, ank: -al / 2 };
}

function restActive(st) {
  if (st.holdT > 0 || st.daze > 0) return true;
  for (const k in st.disc) if (st.disc[k] > 0) return true;
  for (const ch of CH) {
    const a = st.a[ch], v = st.v[ch];
    for (let i = 0; i < 3; i++) if (Math.abs(a[i]) > 0.003 || Math.abs(v[i]) > 0.02) return true;
  }
  return false;
}

function makeOverlay(actor, st) {
  return function hitReactOverlay(R) {
    if (!R || !R.hips) return;
    const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
    const dt = clamp((now - (st.last || now)) / 1000, 0.001, 0.05);
    st.last = now;
    const maxHp = actor.maxHp || 100;
    const cur = hpOf(actor), hurt = (cur != null ? cur : maxHp) / maxHp < 0.35;
    if (!hurt && !restActive(st)) return;                        /* fully settled: cost nothing */
    stepState(st, actor, dt);
    const a = st.a;
    const add = (j, v) => { if (j) { j.rotation.x += v[0]; j.rotation.y += v[1]; j.rotation.z += v[2]; } };
    add(R.head, a.head); add(R.neck, a.neck); add(R.spine, a.spine); add(R.hips, a.hips);
    R.hips.position.x += a.hipsP[0]; R.hips.position.y += a.hipsP[1]; R.hips.position.z += a.hipsP[2];
    add(R.armL && R.armL.shoulder, a.shL); add(R.armR && R.armR.shoulder, a.shR);
    add(R.armL && R.armL.elbow, a.elL);    add(R.armR && R.armR.elbow, a.elR);
    add(R.armL && R.armL.wrist, a.wrL);    add(R.armR && R.armR.wrist, a.wrR);
    const lL = R.legL, lR = R.legR;
    add(lL && lL.hip, a.hpL); add(lR && lR.hip, a.hpR);
    add(lL && lL.knee, a.knL); add(lR && lR.knee, a.knR);
    add(lL && (lL.ank || lL.ankle), a.anL); add(lR && (lR.ank || lR.ankle), a.anR);
    const lim = (j, lo, hi) => { if (j) j.rotation.x = clamp(j.rotation.x, lo, hi); };
    const fx = autoFlex(a.hipsP[1]);
    if (fx) {
      if (lL) { lL.hip.rotation.x += fx.hip; lL.knee.rotation.x += fx.knee; const an = lL.ank || lL.ankle; if (an) an.rotation.x += fx.ank; }
      if (lR) { lR.hip.rotation.x += fx.hip; lR.knee.rotation.x += fx.knee; const an = lR.ank || lR.ankle; if (an) an.rotation.x += fx.ank; }
    }
    /* joint limits AFTER everything is summed: no knee folding the wrong way, no thigh through the chest */
    for (const L of [lL, lR]) { if (!L) continue; lim(L.hip, -1.9, 0.55); lim(L.knee, -0.05, 2.25); const an = L.ank || L.ankle; lim(an, -1.0, 1.0); }
    for (const A of [R.armL, R.armR]) { if (!A) continue; lim(A.elbow, -2.6, 0.1); }
  };
}

export const HitReact = {
  CLIP_NAMES,
  CLIPS,

  attach(actor) {
    if (!actor || !actor.ctl) return null;
    if (!actor._hr) {
      actor._hr = newState();
      actor._hrPrevOverlay = actor.ctl._overlay || null;
      const mine = makeOverlay(actor, actor._hr);
      const prev = actor._hrPrevOverlay;
      actor.ctl._overlay = prev ? (R, e) => { prev(R, e); mine(R, e); } : mine;
    }
    return actor._hr;
  },

  clear(actor) {
    if (!actor || !actor._hr) return;
    try { actor.ctl._overlay = actor._hrPrevOverlay || null; } catch (e) {}
    actor._hr = null; actor._hrPrevOverlay = null;
  },

  /* a bullet (or any strike) hit `part`. Returns what happened so callers can add sound / FX. */
  hit(actor, part, dmg, info) {
    const st = this.attach(actor);
    if (!st) return null;
    info = info || {};
    const maxHp = actor.maxHp || 100;
    const I = clamp(0.55 + (dmg || 20) / 90, 0.55, 1.6);

    /* which side of the victim did it land on, and did it come from behind? */
    const ctl = actor.ctl, yaw = (ctl && ctl.yaw) || 0;
    const px = ctl && ctl.pos ? ctl.pos.x : 0, pz = ctl && ctl.pos ? ctl.pos.z : 0;
    let s = Math.random() < 0.5 ? 1 : -1, fromBehind = false;
    if (info.point) {
      const lat = (info.point.x - px) * Math.cos(yaw) + (info.point.z - pz) * (-Math.sin(yaw));
      if (Math.abs(lat) > 0.025) s = lat > 0 ? 1 : -1;                       /* +X (local) is the character's left */
    }
    if (info.dir) {
      const fwd = info.dir.x * Math.sin(yaw) + info.dir.z * Math.cos(yaw);
      fromBehind = fwd > 0.25;                                                 /* bullet travelling the way it faces */
      if (!info.point) { const lat = -(info.dir.x * Math.cos(yaw) + info.dir.z * -Math.sin(yaw)); if (Math.abs(lat) > 0.2) s = lat > 0 ? 1 : -1; }
    }
    const N = s > 0 ? "L" : "R", F = other(N), o = s;

    const { group, name } = pickClip(part, fromBehind, st);
    st.lastClip = group + "." + name;
    const clipDur = CLIPS[group][name](st, s, I, N, F, o) || 0.5;

    /* limbs may pop out of their sockets */
    let dislocated = null;
    if (part === "arm" || part === "leg" || part === "foot") {
      const kind = part === "arm" ? "arm" : "leg";
      const key = kind + N;
      if (chance(part, dmg || 20, maxHp, info.type, st, key)) dislocated = dislocate(st, kind, N);
    } else if (part === "head" && (dmg || 0) > maxHp * 0.3) {
      st.daze = Math.max(st.daze, 1.6); st.dazeAmp = Math.max(st.dazeAmp, 0.3);
    }
    /* a hard torso hit can also wrench an arm loose */
    if (!dislocated && part === "torso" && (info.type === "shotgun" || info.type === "sniper") && Math.random() < 0.3) {
      dislocated = dislocate(st, "arm", N);
    }
    return { clip: st.lastClip, dur: clipDur * (0.85 + 0.3 * I), dislocated };
  },
};

if (typeof window !== "undefined") window.__ph3d_hitReact = HitReact;
