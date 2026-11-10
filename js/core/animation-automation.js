/* js/core/animation-automation.js — context-aware idle director.
   Every ~0.5–0.9 s picks ONE idle NPC near the player and fires a micro-emote
   weighted by weather, time of day, mood, role and nearby friends. */
import { EMOTES } from "../characters/animator.js";

export const AnimationAutomation = {
  paused: false,
  _cd: 0.5,
  _lastEmote: new WeakMap(),
  _cooldown: 6000,
  _list: null,
  playerIdle: true,              /* set false to stop the player fidgeting */
  _pIdle: 0, _pNext: 6,

  tick(dt, npcsList, px, pz) {
    if (this.paused) return;
    this._cd -= dt;
    if (this._cd > 0) return;
    this._cd = 0.5 + Math.random() * 0.4;
    this._list = npcsList;

    const cands = [], ws = [];
    let total = 0;
    for (const n of npcsList) {
      if (n.dead || n._lifeHidden || n._isHunter || n._companion) continue;
      if (n.state !== "idle") continue;
      if (!n.ctl || !n.group || n.group.visible === false) continue;
      if (n.ctl._emoteName && n.ctl._emoteTimer > 0) continue;
      const d = Math.hypot(n.ctl.pos.x - px, n.ctl.pos.z - pz);
      if (d > 45) continue;
      const w = d < 3 ? 0.35 : 1 / (1 + d * 0.10);
      cands.push(n); ws.push(w); total += w;
    }
    if (!cands.length) return;

    let roll = Math.random() * total, npc = cands[0];
    for (let i = 0; i < cands.length; i++) { roll -= ws[i]; if (roll <= 0) { npc = cands[i]; break; } }

    if (performance.now() - (this._lastEmote.get(npc) || 0) < this._cooldown) return;

    const ctx = this._context();
    const emote = this._choose(npc, ctx);
    if (!emote) return;
    this._trigger(npc, emote);
    this._lastEmote.set(npc, performance.now());
  },

  /* the player's own fidgets: after standing still for a while.
     Any movement input cancels the emote (thirdperson.js already does that). */
  tickPlayer(dt, p) {
    const gun = p.weapons && ["pistol", "sniper", "bazooka"].includes(p.weapons.current);
    const busy = !this.playerIdle || this.paused || p.state !== "standing" || p.moving || p.dead ||
      p.ragdoll || p._fightLock || p.held || p.look && p.look.on || gun ||
      (p._emoteTimer > 0) || (p._useTimer > 0);
    if (busy) { this._pIdle = 0; if (!p.moving) return; this._pNext = 5 + Math.random() * 5; return; }
    this._pIdle += dt;
    if (this._pIdle < this._pNext) return;
    this._pIdle = 0;
    this._pNext = 7 + Math.random() * 6;              /* gap between fidgets */
    const name = this._choose({ role: null, _life: null }, this._context(), true);
    if (name && typeof p.playEmote === "function") p.playEmote(name);
  },

  _context() {
    const day = window.__ph3d_daynight, wx = window.__ph3d_weather;
    const season = (wx && wx.season) || "summer";
    return {
      hour: day && day.hour != null ? day.hour : 12,
      isHot: season === "summer", isCold: season === "harmattan", isRainy: season === "rainy",
    };
  },

  _choose(npc, ctx, solo) {
    const pool = [];
    const push = (name, w) => { for (let i = 0; i < w; i++) pool.push(name); };
    push("look_around", 10); push("stretch", 6); push("yawn", 4); push("scratch_head", 4);
    push("check_phone", 5); push("adjust_hat", 3); push("cross_arms", 4); push("kick_pebble", 3); push("hum", 3);

    if (ctx.isHot)   { push("fan_self", 12); push("shield_eyes", 6); if (ctx.hour > 8 && ctx.hour < 17) push("shield_eyes", 8); }
    if (ctx.isCold)  push("warm_hands", 14);
    if (ctx.isRainy) push("look_up", 6);

    if (ctx.hour >= 6 && ctx.hour < 9) push("stretch", 8);
    if (ctx.hour >= 22 || ctx.hour < 5) { push("yawn", 8); push("slump", 4); }

    const life = npc._life;
    if (life) {
      if (life.mood > 0.75) { push("hum", 6); push("selfie_pose", 2); }
      if (life.mood < 0.35) push("slump", 8);
    }

    const role = npc.role;
    if (role === "trader") { push("check_phone", 4); push("cross_arms", 2); }
    if (role === "police") { push("cross_arms", 6); push("look_around", 6); }
    if (role === "priest") push("look_up", 3);
    if (role === "inmate") { push("slump", 6); push("kick_pebble", 4); }

    if (!solo && this._findFriend(npc)) push("wave_at_friend", 10);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  },

  _findFriend(npc) {
    const list = this._list;
    if (!list) return null;
    for (const o of list) {
      if (o === npc || o.dead || o.state !== "idle" || !o.ctl) continue;
      const d = Math.hypot(o.ctl.pos.x - npc.ctl.pos.x, o.ctl.pos.z - npc.ctl.pos.z);
      if (d > 1.0 && d < 4.5) return o;
    }
    return null;
  },

  _trigger(npc, emote) {
    if (emote === "wave_at_friend") {
      const friend = this._findFriend(npc);
      if (!friend) return this._fire(npc, "wave");
      this._fire(npc, "wave");
      npc.yawTarget = Math.atan2(friend.ctl.pos.x - npc.ctl.pos.x, friend.ctl.pos.z - npc.ctl.pos.z);
      setTimeout(() => {
        if (friend.dead || !friend.ctl || friend.state !== "idle") return;
        if (friend.ctl._emoteName && friend.ctl._emoteTimer > 0) return;
        this._fire(friend, "wave");
        friend.yawTarget = Math.atan2(npc.ctl.pos.x - friend.ctl.pos.x, npc.ctl.pos.z - friend.ctl.pos.z);
      }, 450);
      return;
    }
    this._fire(npc, emote);
  },

  _fire(npc, name) {
    const em = EMOTES[name];
    if (!em || !npc.ctl) return;
    npc.ctl._emoteName = name;
    npc.ctl._emoteTimer = em.dur;
    npc.ctl._emotePhase = 0;
  },
};

if (typeof window !== "undefined") window.__ph3d_autoanim = AnimationAutomation;
