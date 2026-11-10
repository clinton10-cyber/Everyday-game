/* js/core/wrestling-combat.js — fight engine (REWRITE)
   ─────────────────────────────────────────────────────────────────────────
   One clock per move drives BOTH bodies, every frame:

     • GRIP / CARRY  the victim is attached to the attacker and follows the
                     move's contact path (forward / side, metres) relative to
                     the attacker's live position — pulled in, lifted, swung
                     over, driven back — instead of teleporting or gliding
                     on timers.
     • IMPACT        damage, sound, body part, shove and a short HIT-STOP
                     (both animations freeze for a few frames) land exactly
                     on the move's impact frame. Multi-hit moves (stunner)
                     fire every hit on its own frame.
     • KNOCK-DOWN    heavy moves put the victim on the ground at their `fin`
                     frame with a body-fall thud.
     • CLINCH        G grabs and HOLDS the victim; follow-up skills (knee,
                     suplex, hip toss, DDT, stunner, choke slam) work from the
                     hold. An unused hold ends in a shove.
     • CHAINS        inputs are buffered; the next move takes over at the
                     current move's `cancel` frame, so strings flow. Landed
                     hits build a combo that scales damage (+7% each, max 8).
   ───────────────────────────────────────────────────────────────────────── */
import { WRESTLING_MOVES, EMOTE_SPEED } from "../characters/wrestling.js";
import * as Animator from "../characters/animator.js";
import { NPCs } from "./npcs.js";
import { Pursuit } from "./pursuit.js";
import { Sfx } from "./sfx.js";
import { WalkActions } from "./walk-actions.js";
import { Limp } from "../characters/limp.js";

const FRONT_ARC = 1.9;                 /* ±109° — wider than that is "behind you" */
const COMBO_KEEP_MS = 1600;
const BUF_KEEP_MS = 650;
const CLINCH_MAX_MS = 2300;
const CLINCH_F = 0.58;                 /* metres in front of the attacker in a clinch */

const S = { cur: null, buf: [], clinch: null, combo: 0, comboAt: 0, raf: 0, last: 0, subs: new Set() };

const sstep = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const emit = (type, data) => { for (const fn of S.subs) { try { fn({ type, ...data }); } catch (e) {} } };
const sfx = (key, x, z) => { try { key && Sfx.play(key, { x, z, vol: 0.9 }); } catch (e) {} };

const ctlOf = (t) => (t && ((t._npc && t._npc.ctl) || (t._pursuer && t._pursuer.ctl))) || null;
const comboCount = () => (performance.now() - S.comboAt > COMBO_KEEP_MS ? 0 : S.combo);
const comboMul = () => 1 + 0.07 * Math.min(comboCount(), 8);

function targetsNear(px, pz, reach) {
  return NPCs.targets(px, pz, reach).concat(Pursuit.targets(px, pz, reach)).filter((t) => t.alive);
}

/* nearest opponent in front of the attacker (sticky target preferred) */
function pickTarget(w, m, prefer) {
  const px = w.x, pz = w.z, facing = typeof w.yaw === "number" ? w.yaw : 0;
  const list = targetsNear(px, pz, m.reach + 0.2);
  if (prefer && prefer.alive) {
    const d = Math.hypot(prefer.x - px, prefer.z - pz);
    if (d <= m.reach + 0.5) return prefer;
  }
  let best = null, bs = Infinity;
  for (const t of list) {
    const a = angDiff(Math.atan2(t.x - px, t.z - pz), facing);
    if (a > FRONT_ARC) continue;
    const s = Math.hypot(t.x - px, t.z - pz) + a * 0.6;
    if (s < bs) { bs = s; best = t; }
  }
  return best;
}

/* drop whatever blocks a two-handed move */
function freeHands(walker, m) {
  const PA = window.__ph3d_playerActions;
  if (!PA || !PA._held) return;
  const two = PA._held.mesh && PA._held.mesh.userData && PA._held.mesh.userData._hands === 2;
  if (two || m.kind !== "strike") {
    try { PA.drop(walker); } catch (e) {}
    try { window.__ph3d_phone && window.__ph3d_phone._toast("✋ Dropped item to fight"); } catch (e) {}
  }
}

/* start a victim reaction mid-way through its animation so it lines up with the attacker's clock */
function playOn(ctl, name, startNorm) {
  const em = Animator.EMOTES[name];
  if (!ctl || !em) return false;
  const s = Math.max(0, Math.min(0.95, startNorm || 0));
  ctl._emoteName = name;
  ctl._emotePhase = em.dur * s;
  ctl._emoteTimer = em.dur * (1 - s);
  return true;
}
function clearEmote(ctl, name) {
  if (!ctl) return;
  if (!name || ctl._emoteName === name || String(ctl._emoteName || "").startsWith("vic_")) { ctl._emoteTimer = 0; ctl._emoteName = null; }
}

function markDriven(tgt) {
  try {
    if (tgt._npc && tgt._npc.wrestle) tgt._npc.wrestle.driven = true;
    if (tgt._pursuer && tgt._pursuer.wr) tgt._pursuer.wr.driven = true;
  } catch (e) {}
}
function keepHeld(tgt, c) {
  try {
    if (tgt._npc && tgt._npc.wrestle) { tgt._npc.stateT = Math.max(tgt._npc.stateT || 0, 1.2); tgt._npc.wrestle.ax = c.walker.x; tgt._npc.wrestle.az = c.walker.z; }
    if (tgt._pursuer) { tgt._pursuer.t = 0; if (tgt._pursuer.wr) { tgt._pursuer.wr.ax = c.walker.x; tgt._pursuer.wr.az = c.walker.z; } }
  } catch (e) {}
}
function releaseTarget(tgt) {
  try { tgt && (tgt._pursuer ? Pursuit.release(tgt) : NPCs.wrestleRelease(tgt)); } catch (e) { console.warn(e); }
}

/* glide a body a short way (shoves, shoves out of a clinch) */
function nudge(ctl, dx, dz, ms) {
  if (!ctl || !ctl.pos) return;
  const sx = ctl.pos.x, sz = ctl.pos.z, t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / ms), e = sstep(k);
    ctl.pos.x = sx + dx * e; ctl.pos.z = sz + dz * e;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ── victim carry: where the victim is at normalised time t ── */
function carryPos(c, t) {
  const p = c.m.path;
  if (!p || !p.length) return null;
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), lx = fz, lz = -fx;     /* forward, left */
  let f, s, u = 1;
  if (t < p[0][0]) {                                                       /* being pulled in from where it stood */
    f = p[0][1]; s = p[0][2]; u = sstep(t / Math.max(p[0][0], 1e-3));
  } else {
    let i = 1;
    while (i < p.length && t > p[i][0]) i++;
    if (i >= p.length) { f = p[p.length - 1][1]; s = p[p.length - 1][2]; }
    else {
      const a = p[i - 1], b = p[i], k = sstep((t - a[0]) / Math.max(b[0] - a[0], 1e-4));
      f = a[1] + (b[1] - a[1]) * k; s = a[2] + (b[2] - a[2]) * k;
    }
  }
  const tx = c.walker.x + fx * f + lx * s, tz = c.walker.z + fz * f + lz * s;
  if (t < p[0][0]) return { x: c.sx + (tx - c.sx) * u, z: c.sz + (tz - c.sz) * u };
  return { x: tx, z: tz };
}
function carry(c, t) {
  if (!c.held || !c.ctl || !c.ctl.pos) return;
  const pos = carryPos(c, t);
  if (!pos) return;
  c.ctl.pos.x = pos.x; c.ctl.pos.z = pos.z;
  const face = Math.atan2(c.walker.x - pos.x, c.walker.z - pos.z);
  c.ctl.yaw = face;
  keepHeld(c.tgt, c);
}


/* ═══ broadcast-style impact visuals (screen shake · flash · callout) ═══ */
const LIMBS = new Set(["shL", "shR", "hpL", "hpR", "elL", "elR", "knL", "knR", "hd", "wrL", "wrR", "anL", "anR"]);
function shake(px, ms) {
  try {
    const cv = document.querySelector("canvas"); if (!cv || !cv.animate) return;
    const k = [], n = 9;
    for (let i = 0; i <= n; i++) { const d = (1 - i / n) * px; k.push({ transform: `translate(${((Math.random() - .5) * 2 * d).toFixed(1)}px,${((Math.random() - .5) * 2 * d).toFixed(1)}px)` }); }
    k.push({ transform: "translate(0,0)" });
    cv.animate(k, { duration: ms, easing: "linear" });
  } catch (e) {}
}
function flash(op) {
  try {
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9000;background:radial-gradient(circle,rgba(255,255,255,.85),rgba(255,230,160,.25) 55%,transparent 80%)";
    document.body.appendChild(d);
    d.animate([{ opacity: op }, { opacity: 0 }], { duration: 260, easing: "ease-out" }).onfinish = () => d.remove();
  } catch (e) {}
}
function callout(text, sub, big) {
  try {
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;left:50%;top:" + (big ? "34%" : "40%") + ";transform:translate(-50%,-50%);pointer-events:none;z-index:9001;text-align:center;font:900 " + (big ? 46 : 28) + "px/1 Impact,Arial Black,sans-serif;letter-spacing:2px;color:#ffd23a;-webkit-text-stroke:2px #7a0b00;text-shadow:0 4px 0 #7a0b00,0 0 18px rgba(255,120,0,.8);font-style:italic";
    d.innerHTML = text + (sub ? '<div style="font-size:' + (big ? 20 : 14) + 'px;color:#fff;-webkit-text-stroke:0;text-shadow:0 2px 4px #000;margin-top:4px">' + sub + "</div>" : "");
    document.body.appendChild(d);
    d.animate([{ transform: "translate(-50%,-50%) scale(2.2) rotate(-8deg)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1) rotate(-4deg)", opacity: 1, offset: .15 },
      { transform: "translate(-50%,-60%) scale(1.04) rotate(-4deg)", opacity: 1, offset: .75 }, { transform: "translate(-50%,-80%) scale(.9) rotate(-4deg)", opacity: 0 }],
      { duration: big ? 1100 : 750, easing: "ease-out" }).onfinish = () => d.remove();
  } catch (e) {}
}

/* thrown / lifted victims: limbs become dead weight (pendulums driven by the real body motion) */
function limpOn(c) {
  const ctl = c.ctl; if (!ctl || !ctl.rig || c.limp) return;
  c.limp = true; c.limpPrev = ctl._overlay;
  ctl._overlay = (R) => {
    const t = c.tNow || 0, m = c.m;
    const w = m.kind === "heavy" ? sstep((t - 0.22) / 0.18) * 0.62 : 0.25;
    try { Limp.step(R, R.hips, c.dtNow || 1 / 60, { mask: LIMBS, w }); } catch (e) {}
  };
}
function limpOff(c) {
  const ctl = c && c.ctl; if (!ctl || !c.limp) return;
  c.limp = false;
  try { ctl._overlay = c.limpPrev || null; ctl.rig && Limp.release(ctl.rig); } catch (e) {}
}

/* ── a move starts ── */
function begin(walker, name, opts) {
  const m = WRESTLING_MOVES[name];
  if (!m) return false;
  if (!WalkActions.playEmote(name)) return false;
  freeHands(walker, m);

  const now = performance.now();
  const c = {
    name, m, walker, t0: now, real: (m.dur / EMOTE_SPEED) * 1000,
    tgt: null, ctl: null, held: false, fin: false, fired: new Set(), stop: 0,
    yaw: typeof walker.yaw === "number" ? walker.yaw : 0, sx: 0, sz: 0, lastTgt: S.lastTgt || null,
  };

  /* who is on the other end */
  const inClinch = !!(S.clinch && S.clinch.tgt.alive);
  const useClinch = inClinch && (m.needs === "clinch" || m.kind === "hold" || m.kind === "clinchStrike");
  if (useClinch) { c.tgt = S.clinch.tgt; c.held = true; }
  else {
    if (inClinch) endClinch(true);                       /* a different move: let go first */
    c.tgt = pickTarget(walker, m, S.lastTgt);
  }
  c.ctl = ctlOf(c.tgt);

  if (c.tgt) {
    S.lastTgt = c.tgt;
    const yaw = Math.atan2(c.tgt.x - walker.x, c.tgt.z - walker.z);
    c.yaw = yaw;
    try { if (typeof walker.yaw === "number") walker.yaw = yaw; } catch (e) {}
    if (useClinch) {
      playOn(c.ctl, "vic_" + name, 0);
      keepHeld(c.tgt, c); markDriven(c.tgt);
    } else if (m.kind === "heavy" || m.kind === "grab") {
      const startX = c.ctl ? c.ctl.pos.x : 0, startZ = c.ctl ? c.ctl.pos.z : 0;
      let ok = false;
      try { ok = c.tgt._pursuer ? Pursuit.hold(c.tgt, name, walker.x, walker.z) : NPCs.wrestleHold(c.tgt, name, walker.x, walker.z); } catch (e) { console.warn(e); }
      if (ok && c.ctl) {
        c.ctl.pos.x = startX; c.ctl.pos.z = startZ;        /* hold() teleports — undo, carry() pulls it in properly */
        c.sx = startX; c.sz = startZ; c.held = true; markDriven(c.tgt);
      }
    }
  } else {
    emit("whiff", { name });
  }
  if (c.held && c.ctl && !c.sx) { c.sx = c.ctl.pos.x; c.sz = c.ctl.pos.z; }

  if (c.held && m.kind === "heavy") limpOn(c);
  c.hitList = m.hits.map((h) => ({ ...h, done: false }));
  walker._fightLock = true;                         /* moving must not cancel the move */
  S.cur = c;
  emit("move", { name, combo: comboCount() });
  ensureLoop();
  return true;
}

/* ── per-hit work ── */
function whiff(c) { if (!c.whiffed) { c.whiffed = true; emit("whiff", { name: c.name }); } }

function fire(c, h) {
  h.done = true;
  const m = c.m, tgt = c.tgt, w = c.walker;
  if (!tgt || !tgt.alive) { whiff(c); return; }
  const reach = m.reach + 0.7;
  const inReach = (tgt.x - w.x) ** 2 + (tgt.z - w.z) ** 2 <= reach * reach;
  if (!inReach && !c.held) { whiff(c); return; }

  const mul = comboMul();
  const dmg = Math.round((m.damage || 0) * (h.w == null ? 1 : h.w) * mul);
  const main = h.t === m.impact && (m.damage || 0) > 0;
  if (dmg > 0) {
    if (tgt.hp !== undefined) tgt.hp -= dmg;
    try { tgt.onHit && tgt.onHit(dmg, "wrestling", h.part || m.part || "torso"); } catch (e) { console.warn(e); }
  }
  sfx(m.sfx && m.sfx[0], tgt.x, tgt.z);
  if (main) {
    c.stop = Math.max(c.stop, (m.stop || 0.04) * (m.kind === "heavy" ? 1.6 : 1));
    if (m.kind === "heavy") { shake(m.damage > 26 ? 9 : 6, 320); flash(0.35); }
    else shake(2 + dmg * 0.12, 160);
    if (S.combo >= 2 || m.kind === "heavy") callout(m.label + (comboCount() >= 2 ? " ×" + (comboCount() + 1) : ""), dmg + " DMG", false);
    S.combo = comboCount() + 1; S.comboAt = performance.now();
    emit("hit", { name: c.name, dmg, combo: S.combo, mul, heavy: m.kind === "heavy" });
  }

  /* light strikes: the victim is not grabbed, so give it a flinch + a shove */
  if (!c.held && main && c.ctl) {
    const st = tgt._npc ? tgt._npc.state : (tgt._pursuer && tgt._pursuer.state);
    if (st !== "dying" && st !== "dead" && st !== "wrestled" && st !== "held" && tgt.alive) {
      if (!tgt._pursuer || st === "chase") playOn(c.ctl, "vic_" + c.name, m.impact);
      if (m.push) nudge(c.ctl, Math.sin(c.yaw) * m.push, Math.cos(c.yaw) * m.push, 160);
    }
  }
  /* heavy moves splash 30% onto anyone else in reach */
  if (main && m.kind === "heavy") {
    const rsq = reach * reach;
    for (const t of targetsNear(w.x, w.z, m.reach)) {
      if (t === tgt || (t._npc && t._npc === tgt._npc && t._npc) || ((t.x - w.x) ** 2 + (t.z - w.z) ** 2) > rsq) continue;
      const d = Math.round(m.damage * 0.3);
      if (t.hp !== undefined) t.hp -= d;
      try { t.onHit && t.onHit(d, "wrestling", "torso"); } catch (e) {}
    }
  }
}

function doFinish(c) {
  c.fin = true;
  const tgt = c.tgt;
  if (!c.held || !tgt) return;
  const x = tgt.x, z = tgt.z;
  c.held = false;
  S.clinch = null;
  clearEmote(c.ctl);
  try { tgt._pursuer ? Pursuit.finish(tgt) : NPCs.wrestleFinish(tgt, c.name); } catch (e) { console.warn(e); }
  sfx(c.m.sfx && c.m.sfx[1], x, z);
  limpOff(c);
  shake(14, 480); flash(0.55); callout(c.m.label + "!", c.m.damage >= 28 ? "FINISHER" : "", true);
  emit("clinch", { on: false });
}

/* ── a move ends (naturally, by chain, or aborted) ── */
function endMove(c, chained) {
  S.cur = null; limpOff(c);
  try { c.walker._anim && (c.walker._anim.wrDist = 0); } catch (e) {}
  const w = c.walker;
  if (c.m.hold && c.held && c.tgt && c.tgt.alive) {                    /* the grab landed → hold */
    S.clinch = { tgt: c.tgt, ctl: c.ctl, at: performance.now(), walker: w };
    emit("clinch", { on: true });
    if (!chained) holdPose(w);
  } else if (c.held && !c.fin && S.clinch && c.m.kind === "clinchStrike") {
    S.clinch.at = performance.now();                                    /* keep holding between knees */
    if (!chained) holdPose(w);
  } else if (c.held && !c.fin && c.tgt) {
    releaseTarget(c.tgt);                                               /* held, never finished → let go */
  }
  if (!chained && !S.clinch) { w._fightLock = false; }
}

function holdPose(w) {
  if (!S.clinch) return;
  WalkActions.playEmote("clinchHold");
  playOn(S.clinch.ctl, "vic_clinchHold", 0);
  const c = { name: "clinchHold", m: WRESTLING_MOVES.clinchHold, walker: w, tgt: S.clinch.tgt, ctl: S.clinch.ctl, held: true, yaw: S.clinch.yaw || 0 };
  S.clinch.c = c;
}

function endClinch(shove) {
  const k = S.clinch; if (!k) return;
  S.clinch = null;
  const w = k.walker;
  if (k.tgt && k.tgt.alive) {
    clearEmote(k.ctl);
    releaseTarget(k.tgt);
    if (shove && k.ctl) {
      const yaw = Math.atan2(k.tgt.x - w.x, k.tgt.z - w.z);
      nudge(k.ctl, Math.sin(yaw) * 0.9, Math.cos(yaw) * 0.9, 220);
    }
  }
  if (w._emoteName === "clinchHold") { w._emoteTimer = 0; w._emoteName = null; }
  if (!S.cur) w._fightLock = false;
  emit("clinch", { on: false });
}

/* ── frame loop ── */
function tick(now) {
  S.raf = 0;
  const dt = Math.min(0.05, Math.max(0, (now - S.last) / 1000)); S.last = now;
  if (S.cur) stepMove(S.cur, now, dt);
  else if (S.clinch) stepClinch(now);
  if (S.cur || S.clinch) S.raf = requestAnimationFrame(tick);
}
function ensureLoop() { if (!S.raf) { S.last = performance.now(); S.raf = requestAnimationFrame(tick); } }

function stepClinch(now) {
  const k = S.clinch, w = k.walker;
  if (!k.tgt.alive || now - k.at > CLINCH_MAX_MS || w._emoteName !== "clinchHold" || w.sitting || w.ragdoll) { endClinch(k.tgt.alive); return; }
  const c = k.c || { m: WRESTLING_MOVES.clinchHold, walker: w, tgt: k.tgt, ctl: k.ctl, held: true };
  c.yaw = Math.atan2(k.tgt.x - w.x, k.tgt.z - w.z);
  c.sx = k.ctl ? k.ctl.pos.x : 0; c.sz = k.ctl ? k.ctl.pos.z : 0;
  /* in the hold the victim stays glued in front of the attacker */
  if (k.ctl) {
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    k.ctl.pos.x += (w.x + fx * CLINCH_F - k.ctl.pos.x) * 0.35; k.ctl.pos.z += (w.z + fz * CLINCH_F - k.ctl.pos.z) * 0.35;
    k.ctl.yaw = Math.atan2(w.x - k.ctl.pos.x, w.z - k.ctl.pos.z);
  }
  keepHeld(k.tgt, c);
  k.c = c;
}

function stepMove(c, now, dt) {
  const w = c.walker;
  const tNow = (now - c.t0) / c.real;
  /* the animation was replaced / cancelled from outside (menu emote, ragdoll, car…) → stop cleanly.
     Past 90% the emote simply finished a frame before our clock did, which is a normal ending. */
  if (w.ragdoll || w.sitting || (w._emoteName !== c.name && tNow < 0.9)) { abort(c); return; }
  if (c.tgt && !c.tgt.alive && c.held) { c.held = false; if (S.clinch) endClinch(false); }

  /* hit-stop: freeze both bodies for a few frames on contact */
  if (c.stop > 0) {
    c.stop -= dt; c.t0 += dt * 1000;
    w._emoteTimer += dt * EMOTE_SPEED; w._emotePhase -= dt * EMOTE_SPEED;
    if (c.ctl && c.ctl._emoteTimer > 0 && String(c.ctl._emoteName || "").startsWith("vic_")) { c.ctl._emoteTimer += dt * EMOTE_SPEED; c.ctl._emotePhase -= dt * EMOTE_SPEED; }
  }
  const t = (now - c.t0) / c.real;
  c.tNow = t; c.dtNow = dt;
  if (c.tgt && w._anim) w._anim.wrDist = Math.hypot(c.tgt.x - w.x, c.tgt.z - w.z);   /* contact: the body drives through the real gap */
  carry(c, Math.min(t, 1));

  for (const h of c.hitList) if (!h.done && t >= h.t) fire(c, h);
  if (c.m.knock && !c.fin && t >= c.m.fin) doFinish(c);

  /* combo window: the next buffered input takes over */
  while (S.buf.length && !S.buf[0].sticky && now - S.buf[0].at > BUF_KEEP_MS) S.buf.shift();
  if (S.buf.length && t >= c.m.cancel && !(c.m.kind === "heavy" && !c.fin && c.held)) {
    const next = S.buf.shift();
    endMove(c, true);
    if (!begin(w, next.name, { chained: true })) { S.buf.length = 0; w._fightLock = !!S.clinch; }
    return;
  }
  if (t >= 1 || (w._emoteName !== c.name && t >= 0.9)) {
    for (const h of c.hitList) if (!h.done) fire(c, h);
    if (c.m.knock && !c.fin) doFinish(c);
    endMove(c, false); S.buf.length = 0;
  }
}

function abort(c) {
  S.cur = null; limpOff(c);
  if (c.held && !c.fin && c.tgt && c.tgt.alive) { clearEmote(c.ctl); releaseTarget(c.tgt); }
  if (S.clinch && c.held) { S.clinch = null; emit("clinch", { on: false }); }
  S.buf.length = 0;
  c.walker._fightLock = false;
}

/* ══════════════════════════════════════════════════════════════════════════
   PUBLIC API
   ══════════════════════════════════════════════════════════════════════════ */
export const WrestlingCombat = {
  /* start a move now, or buffer it behind the running one (combo input) */
  press(walker, name, opts) {
    if (!walker || !WRESTLING_MOVES[name]) return false;
    if (S.cur) {
      if (S.buf.length >= 3) return false;
      S.buf.push({ name, at: performance.now(), sticky: !!(opts && opts.sticky) });
      return true;
    }
    return begin(walker, name, opts);
  },
  /* run a scripted chain (chord combos): first now, the rest buffered "sticky" */
  runChain(walker, names) {
    if (!walker || !names || !names.length) return false;
    S.buf.length = 0;
    if (S.cur) abortCurrent();
    const ok = begin(walker, names[0], { chained: false });
    if (!ok) return false;
    for (let i = 1; i < names.length && i <= 6; i++) S.buf.push({ name: names[i], at: performance.now(), sticky: true });
    return true;
  },
  /* legacy single-move entry (kept for older callers) */
  attack(walker, name) { return this.press(walker, name); },

  abortCurrent() { abortCurrent(); },
  cancelAll() { S.buf.length = 0; if (S.cur) abort(S.cur); if (S.clinch) endClinch(false); },
  releaseClinch() { if (S.clinch) endClinch(true); },
  isBusy() { return !!S.cur; },
  elapsed() { return S.cur ? Math.max(0, Math.min(1, (performance.now() - S.cur.t0) / S.cur.real)) : 1; },
  clinched() { return !!(S.clinch && S.clinch.tgt.alive); },
  comboCount, comboMul,
  on(fn) { S.subs.add(fn); return () => S.subs.delete(fn); },
};

function abortCurrent() {
  const c = S.cur; if (!c) return;
  const w = c.walker;
  abort(c);
  if (w._emoteName === c.name) { w._emoteTimer = 0; w._emoteName = null; }
}
