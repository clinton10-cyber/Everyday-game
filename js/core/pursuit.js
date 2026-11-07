/* ════════════════════════════════════════════════════════════════
   js/core/pursuit.js — NPCs that fight back and never stop.

   • An NPC you wrestle to the ground (npcs.js → wrestleFinish) is
     handed to Pursuit.start(npc). It lies there, stands up and then
     hunts you, using random wrestling moves on you.
   • The pursuer lives in this module, NOT in a scene, so it follows
     you through doors, interiors and city ↔ zone changes: on every
     scene change it is rebuilt in the new scene and re-appears
     near you a couple of seconds later.
   • It never stops until you SURRENDER (button, top of screen) or
     you put it down for good (hp ≤ 0). You can wrestle / shoot /
     stab it exactly like any NPC (Pursuit.targets).
   ════════════════════════════════════════════════════════════════ */

import { Limp } from "../characters/limp.js";
import { buildCharacter } from "../characters/lowpoly.js";
import * as Animator from "../characters/animator.js";
import { WRESTLING_MOVES, victimEmoteName, EMOTE_SPEED, IMPACT_AT } from "../characters/wrestling.js";
import { Combat } from "./combat.js";
import { NPCs } from "./npcs.js";
import { WalkActions } from "./walk-actions.js";

const CHASE_SPEED = 6.2;
const REACH_START = 1.7;
const MIN_HP_TO_FIGHT = 12;
const PAUSE_CRUMBS = new Set(["AUTO HUB"]);     /* scenes with no player body */

const list = [];
let _raf = 0, _last = 0, _btn = null;
let _pl = { x: 0, z: 0, t: 0, speed: 0, has: false };

const rnd = Math.random;
const rb = (a, b) => a + rnd() * (b - a);
const toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} };

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

function disposeTree(root) {
  if (!root) return;
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => m && m.dispose && m.dispose());
    }
  });
}

/* ── where is the player right now? (null = no body in this scene) ── */
function getPlayer() {
  const R = window.__ph3d_router;
  const cur = R && R.current;
  if (!cur || !cur.three) return null;
  if (PAUSE_CRUMBS.has(cur.crumb)) return null;
  try {
    const I = WalkActions.info && WalkActions.info();
    if (I) {                                      /* city / drive scene */
      const d = window.__ph3d_drive;
      if (I.mode === "walk" && I.walker) return { x: I.walker.x, z: I.walker.z, y: I.walker.y || 0, walking: true };
      if (d && d.getPos) { const p = d.getPos(); return { x: p.x, z: p.z, y: 0, walking: false }; }
    }
  } catch (e) {}
  const wc = window.__ph3d_walkCtrl;
  if (wc && wc.pos) return { x: wc.pos.x, z: wc.pos.z, y: wc.pos.y || 0, walking: true };
  const tp = window.__ph3d_tp;
  if (tp && tp.pos) return { x: tp.pos.x, z: tp.pos.z, y: tp.pos.y || 0, walking: true };
  return null;
}

/* ── building / placing ── */
function attach(p, three) {
  if (p.group && p.group.parent) p.group.parent.remove(p.group);
  disposeTree(p.group);
  const built = buildCharacter(p.cfg);
  p.group = built.root; p.rig = built.rig;
  const old = p.ctl;
  p.ctl = makeCtl(p.rig, old ? old.pos.x : 0, old ? old.pos.z : 0, old ? old.yaw : 0);
  p.group.position.set(p.ctl.pos.x, p.y || 0, p.ctl.pos.z);
  three.add(p.group);
  p.scene = three;
  try { Animator.animate(p.ctl, 0.016); } catch (e) {}
}

function placeNear(p, pl) {
  const aabbs = NPCs.aabbs ? NPCs.aabbs() : [];
  const rings = [[9, 13], [5, 8], [2.5, 4]];
  for (const [a, b] of rings) {
    for (let i = 0; i < 20; i++) {
      const ang = rnd() * Math.PI * 2, r = rb(a, b);
      const x = pl.x + Math.cos(ang) * r, z = pl.z + Math.sin(ang) * r;
      if (!NPCs._insideAABB(x, z, aabbs, 0.6)) { p.ctl.pos.x = x; p.ctl.pos.z = z; return; }
    }
  }
  p.ctl.pos.x = pl.x + 3; p.ctl.pos.z = pl.z;
}

function setEmote(p, name, phase, timer) {
  const em = Animator.EMOTES[name];
  if (!em) return;
  p.ctl._emoteName = name;
  p.ctl._emotePhase = phase || 0;
  p.ctl._emoteTimer = timer != null ? timer : em.dur;
}

function removeP(p) {
  const i = list.indexOf(p);
  if (i >= 0) list.splice(i, 1);
  if (p.group && p.group.parent) p.group.parent.remove(p.group);
  disposeTree(p.group);
  refreshUI();
}

/* ── the targetable face of a pursuer (same shape as NPC targets) ── */
function makeTgt(p, hp) {
  return {
    get x() { return p.ctl.pos.x; },
    get z() { return p.ctl.pos.z; },
    get y() { return p.y || 0; },
    get alive() { return p.state !== "dead" && p.state !== "leave" && p.state !== "spawn"; },
    hp,
    _pursuer: p,
    onHit(dmg, type) { onPursuerHit(p, type); },
  };
}

function onPursuerHit(p, type) {
  if (p.state === "dead" || p.state === "leave") return;
  if (p.tgt.hp <= 0) return die(p);
  if (type === "wrestling") { p.cd = Math.max(p.cd || 0, 0.7); return; }   /* strikes break their rhythm */
  if (type !== "wrestling") {                      /* guns / knife: stagger */
    p.state = "down"; p.t = 0; p.downT = 2.0; p.wr = null;
    setEmote(p, victimEmoteName("spear"), 0.55 * 1.2, 0.4);
  }
}

function die(p) {
  if (p.state === "dead") return;
  p.state = "dead"; p.t = 0; p.wr = null; p.ctl._intentSpeed = 0;
  p.ctl._emoteTimer = 0; p.ctl._emoteName = null;
  try { const Cr = window.__ph3d_crime; Cr && Cr.addEvent && Cr.addEvent("kill", 100, "You"); } catch (e) {}
  toast("They're finished — you're free");
  refreshUI();
}

/* ── surrender button ── */
function ensureUI() {
  if (_btn) return;
  const b = document.createElement("button");
  b.id = "ph3d-surrender";
  b.type = "button";
  b.textContent = "🏳 SURRENDER";
  b.style.cssText =
    "position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 58px);transform:translateX(-50%);" +
    "z-index:40;display:none;padding:10px 18px;border-radius:14px;border:1px solid #ff5a3c;" +
    "background:rgba(30,10,6,.88);color:#ffd9cf;font:900 12px/1 Archivo,system-ui,sans-serif;" +
    "letter-spacing:.14em;cursor:pointer;touch-action:manipulation;pointer-events:auto;" +
    "box-shadow:0 0 0 0 rgba(255,90,60,.5);animation:ph3dSurr 1.2s ease-in-out infinite;";
  if (!document.getElementById("ph3d-surrender-css")) {
    const s = document.createElement("style");
    s.id = "ph3d-surrender-css";
    s.textContent = "@keyframes ph3dSurr{0%,100%{box-shadow:0 0 0 0 rgba(255,90,60,.5)}60%{box-shadow:0 0 0 12px rgba(255,90,60,0)}}";
    document.head.appendChild(s);
  }
  b.addEventListener("pointerdown", (e) => e.stopPropagation());
  b.addEventListener("click", (e) => { e.stopPropagation(); Pursuit.surrender(); });
  document.body.appendChild(b);
  _btn = b;
}
function refreshUI() {
  ensureUI();
  const on = list.some((p) => p.state !== "dead" && p.state !== "leave");
  _btn.style.display = on ? "block" : "none";
}

/* ── main loop (independent of any scene) ── */
function loop(now) {
  _raf = requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - _last) / 1000 || 0.016);
  _last = now;
  if (!list.length) return;

  const R = window.__ph3d_router;
  const three = R && R.current && R.current.three;
  const pl = three ? getPlayer() : null;

  if (pl) {
    if (_pl.has) _pl.speed = Math.hypot(pl.x - _pl.x, pl.z - _pl.z) / Math.max(dt, 1e-3);
    _pl.x = pl.x; _pl.z = pl.z; _pl.has = true;
  } else _pl.has = false;

  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    if (!pl || !three) { if (p.group) p.group.visible = false; continue; }

    if (p.scene !== three) {                       /* new scene → rebuild + re-appear near the player */
      attach(p, three);
      placeNear(p, pl);
      if (p.state !== "dead" && p.state !== "leave") { p.state = "spawn"; p.delay = 2.2; p.wr = null; }
      else { removeP(p); continue; }
    }
    p.y = pl.y;
    step(p, dt, pl);
  }
}

function faceToward(p, tx, tz, dt, rate) {
  const want = Math.atan2(tx - p.ctl.pos.x, tz - p.ctl.pos.z);
  let d = want - p.ctl.yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  p.ctl.yaw += d * Math.min(1, dt * (rate || 10));
}

function tryMove(p, nx, nz) {
  const aabbs = NPCs.aabbs ? NPCs.aabbs() : [];
  const c = p.ctl.pos;
  if (!NPCs._insideAABB(nx, nz, aabbs, 0.4)) { c.x = nx; c.z = nz; p._blockT = 0; return true; }
  if (!NPCs._insideAABB(nx, c.z, aabbs, 0.4)) { c.x = nx; p._blockT = 0; return true; }
  if (!NPCs._insideAABB(c.x, nz, aabbs, 0.4)) { c.z = nz; p._blockT = 0; return true; }
  /* truly blocked: after a moment, hop to a free spot that is closer to the player */
  p._blockT = (p._blockT || 0) + 1 / 60;
  if (p._blockT > 0.8 && _pl.has) {
    p._blockT = 0;
    const cur = Math.hypot(c.x - _pl.x, c.z - _pl.z);
    for (let i = 0; i < 24; i++) {
      const a = rnd() * Math.PI * 2, d = 2 + rnd() * 4;
      const jx = c.x + Math.cos(a) * d, jz = c.z + Math.sin(a) * d;
      if (!NPCs._insideAABB(jx, jz, aabbs, 0.4) && Math.hypot(jx - _pl.x, jz - _pl.z) < cur) { c.x = jx; c.z = jz; return true; }
    }
  }
  return false;
}

function step(p, dt, pl) {
  const c = p.ctl;
  p.t += dt;
  c._intentSpeed = 0;
  const dx = pl.x - c.pos.x, dz = pl.z - c.pos.z;
  const dist = Math.hypot(dx, dz);

  switch (p.state) {
    case "spawn":
      p.group.visible = false;
      p.delay -= dt;
      if (p.delay <= 0) {
        p.group.visible = true; p.state = "chase"; p.cd = 0.8; p.t = 0;
        toast("⚠ They found you again — SURRENDER or keep fighting");
        refreshUI();
      }
      break;

    case "chase": {
      p.group.visible = true;
      p.cd -= dt;
      faceToward(p, pl.x, pl.z, dt, 10);
      /* player far away and not moving fast (not in a car) → catch up */
      if (dist > 45 && _pl.speed < 2) {
        p.far = (p.far || 0) + dt;
        if (p.far > 1.5) { placeNear(p, pl); p.far = 0; }
      } else p.far = 0;
      if (dist > REACH_START) {
        let armed = false;
        try { const w = window.__ph3d_weapons; armed = !!(w && w.isArmed && w.isArmed()); } catch (e) {}
        const spd = armed && dist > 4 ? CHASE_SPEED * 1.2 : CHASE_SPEED;   /* rush an armed player */
        const k = spd * dt / (dist || 1);
        const before = c.pos.x + c.pos.z;
        tryMove(p, c.pos.x + dx * k, c.pos.z + dz * k);
        c._intentSpeed = spd;
        /* stuck behind a wall → pop next to the player */
        p.stuckT = (p.stuckT || 0) + dt;
        if (Math.abs(c.pos.x + c.pos.z - before) > 0.01) p.stuckT = Math.max(0, p.stuckT - dt * 3);
        if (p.stuckT > 3) { placeNear(p, pl); p.stuckT = 0; }
      } else {
        p.stuckT = 0;
        if (p.cd <= 0 && pl.walking && !Combat.downed) startAttack(p);
      }
      break;
    }

    case "attack": {
      faceToward(p, pl.x, pl.z, dt, 14);
      const m = WRESTLING_MOVES[p.move];
      const dur = m.dur / EMOTE_SPEED;
      if (!p.hitDone && p.t >= dur * (m.impact != null ? m.impact : IMPACT_AT)) {
        p.hitDone = true;
        if (dist <= m.reach + 0.3 && pl.walking && !Combat.downed) {
          try { Combat.damage(Math.max(8, Math.round(m.damage * 0.55)), "npc"); } catch (e) {}
          try { Combat.flash(0.3); } catch (e) {}
          try { WalkActions.react(p.move); } catch (e) {}
        }
      }
      if (p.t >= dur + 0.1) { p.state = "chase"; p.t = 0; p.cd = rb(0.6, 1.5); }
      break;
    }

    case "held": {
      const w = p.wr;
      if (!w) { p.state = "chase"; p.t = 0; break; }
      if (!w.driven) {                               /* fight engine carries driven victims itself */
        const ddx = c.pos.x - w.ax, ddz = c.pos.z - w.az, dd = Math.hypot(ddx, ddz) || 1;
        const k = Math.min(1, dt * 8);
        c.pos.x += (w.ax + ddx / dd - c.pos.x) * k;
        c.pos.z += (w.az + ddz / dd - c.pos.z) * k;
        faceToward(p, w.ax, w.az, dt, 12);
      }
      if (p.t > 2.5) { p.state = "down"; p.t = 0; p.downT = 2.5; p.wr = null; }
      break;
    }

    case "down":
      p.downT -= dt;
      if (p.downT <= 0) { p.state = "chase"; p.t = 0; p.cd = 0.6; }
      break;

    case "dead":
      if (p.t > 12) { removeP(p); return; }
      break;

    case "leave": {                                 /* surrendered: walk away, vanish */
      const ax = c.pos.x - pl.x, az = c.pos.z - pl.z, ad = Math.hypot(ax, az) || 1;
      p.ctl.yaw += (Math.atan2(ax, az) - p.ctl.yaw) * Math.min(1, dt * 6);
      tryMove(p, c.pos.x + (ax / ad) * 2.4 * dt, c.pos.z + (az / ad) * 2.4 * dt);
      c._intentSpeed = 2.4;
      if (p.t > 8) { removeP(p); return; }
      break;
    }
  }

  /* lying-down visual (same recipe as npcs.js "downed") */
  const target = (p.state === "down" || p.state === "dead") ? 1 : 0;
  p.downV += (target - p.downV) * Math.min(1, dt * 6);
  if (p.downV > 0.005) {
    p.group.rotation.x = -Math.PI / 2 * p.downV;
  } else if (p.group.rotation.x !== 0) p.group.rotation.x = 0;
  p.group.position.set(c.pos.x, (p.y || 0) + 0.22 * p.downV, c.pos.z);
  p.group.rotation.y = c.yaw;

  try { Animator.animate(c, dt); } catch (e) {}
  /* knocked out / dead → every joint goes limp (dead weight), otherwise back to the animator */
  if (p.rig || c.rig) {
    const R = c.rig;
    if (p.state === "dead" || (p.state === "down" && p.downV > 0.5)) Limp.step(R, p.group, dt);
    else if (R && R.__limp) Limp.release(R);
  }
}

function startAttack(p) {
  const names = Object.keys(WRESTLING_MOVES).filter((n) => n !== p.lastMove && WRESTLING_MOVES[n].npc !== false && !WRESTLING_MOVES[n].hidden);
  const name = names[Math.floor(rnd() * names.length)];
  const m = WRESTLING_MOVES[name];
  p.move = name; p.lastMove = name;
  p.state = "attack"; p.t = 0; p.hitDone = false;
  setEmote(p, name, 0, m.dur);
}

/* ══════════════════════════════════════════════════════════════════
   PUBLIC API
   ══════════════════════════════════════════════════════════════════ */
export const Pursuit = {
  list,

  /* Called by npcs.js when a wrestled NPC should fight back.
     Takes over the NPC's body (position, pose, hp). */
  start(npc, opts) {
    const R = window.__ph3d_router;
    const three = R && R.current && R.current.three;
    if (!three || !npc || npc.dead) return false;
    const p = {
      id: "pur_" + Math.random().toString(36).slice(2, 7),
      cfg: npc._cfg, hp: npc.hp,
      state: "down", t: 0, downT: 3.2, downV: npc._downVisual || 0,
      cd: 0, y: 0, lastMove: null, move: null, wr: null,
      group: null, rig: null, ctl: null, scene: null,
    };
    if (opts && opts.hunter) { p.hunter = true; p.state = "chase"; p.downT = 0; p.downV = 0; p.cd = 0.5; }
    else if (opts && opts.instant) { p.state = "chase"; p.downT = 0; p.downV = 0; p.cd = 0.4; }
    p.ctl = { pos: { x: npc.ctl.pos.x, z: npc.ctl.pos.z }, yaw: npc.ctl.yaw };
    attach(p, three);
    p.ctl.pos.x = npc.ctl.pos.x; p.ctl.pos.z = npc.ctl.pos.z; p.ctl.yaw = npc.ctl.yaw;
    p.tgt = makeTgt(p, npc.hp);
    /* continue the victim pose the NPC was in */
    if (npc.ctl._emoteTimer > 0 && npc.ctl._emoteName) {
      p.ctl._emoteName = npc.ctl._emoteName;
      p.ctl._emotePhase = npc.ctl._emotePhase;
      p.ctl._emoteTimer = npc.ctl._emoteTimer;
    }
    list.push(p);
    /* hide the original NPC; npcs.js removes it a moment later */
    npc.dead = true; npc.state = "dead"; npc.deadT = 19; npc.wrestle = null;
    if (npc.group) npc.group.visible = false;
    p.group.visible = true;
    if (!_raf) { _last = performance.now(); _raf = requestAnimationFrame(loop); }
    refreshUI();
    return true;
  },

  canFightBack(npc) {
    return !!npc && npc.role !== "police" && npc.hp >= MIN_HP_TO_FIGHT && !!npc._cfg;
  },

  /* weapons / wrestling targets */
  targets(px, pz, range) {
    const out = [];
    const r2 = (range || 80) * (range || 80);
    for (const p of list) {
      if (!p.tgt.alive || !p.group || !p.group.visible) continue;
      const dx = p.ctl.pos.x - px, dz = p.ctl.pos.z - pz;
      if (dx * dx + dz * dz <= r2) out.push(p.tgt);
    }
    return out;
  },

  /* player grabs a pursuer with a wrestling move */
  hold(tgt, move, ax, az) {
    const p = tgt && tgt._pursuer;
    const em = Animator.EMOTES[victimEmoteName(move)];
    if (!p || !em || p.state === "dead" || p.state === "leave" || p.state === "spawn") return false;
    try {
      const yaw = Math.atan2(ax - p.ctl.pos.x, az - p.ctl.pos.z);
      const reach = (WRESTLING_MOVES[move] && WRESTLING_MOVES[move].reach) || 1.2;
      p.ctl.pos.x = ax - Math.sin(yaw) * reach * 0.5;
      p.ctl.pos.z = az - Math.cos(yaw) * reach * 0.5;
    } catch (e) {}
    p.state = "held"; p.t = 0; p.wr = { move, ax, az };
    setEmote(p, victimEmoteName(move), 0, em.dur);
    return true;
  },
  release(tgt) {                                  /* let go without a knock-down */
    const p = tgt && tgt._pursuer;
    if (!p || p.state === "dead" || p.state === "leave") return;
    p.state = "chase"; p.t = 0; p.cd = 0.8; p.wr = null;
    p.ctl._emoteTimer = 0; p.ctl._emoteName = null;
  },
  finish(tgt) {
    const p = tgt && tgt._pursuer;
    if (!p) return;
    if (p.tgt.hp <= 0) { die(p); return; }
    p.state = "down"; p.t = 0; p.downT = 3.0; p.wr = null;
  },

  surrender() {
    let any = false;
    for (const p of list) {
      if (p.state === "dead" || p.state === "leave") continue;
      p.state = "leave"; p.t = 0; p.wr = null; p.ctl._emoteTimer = 0; p.ctl._emoteName = null;
      any = true;
    }
    if (any) toast("🏳 You surrendered — they let you go");
    refreshUI();
  },

  /* hunt ended: hunters walk away instead of vanishing */
  dismissHunters() {
    for (const p of list) {
      if (!p.hunter || p.state === "dead" || p.state === "leave") continue;
      p.state = "leave"; p.t = 0; p.wr = null; p.ctl._emoteTimer = 0; p.ctl._emoteName = null;
    }
    refreshUI();
  },

  endAll() {
    for (let i = list.length - 1; i >= 0; i--) removeP(list[i]);
    refreshUI();
  },

  active() { return list.some((p) => p.state !== "dead" && p.state !== "leave"); },
};

window.addEventListener("ph3d:player-dead", () => Pursuit.endAll());
