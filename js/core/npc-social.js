/* ════════════════════════════════════════════════════════════════
   npc-social.js — reactions and small social events.

   Reactions (triggered externally):
     Social.onCrime(x, z, kind)  — crime near (x,z): civilians panic,
                                   nearby police walk to the spot
     Social.onAccident(x, z)     — crash / run-over: a crowd gathers
     Social.tick(dt, px, pz)     — drives the ambient events

   Ambient events (timer, every 6–12 s):
     • two traders argue
     • a priest blesses a nearby walker (or you, if you're close)
     • a police officer confronts a nearby walker

   NPC states used here are implemented in npcs.js:
     investigate, watch, argue, bless, confront, confronted
   ════════════════════════════════════════════════════════════════ */

import { NPCs } from "./npcs.js";

const TAU = Math.PI * 2;
const _toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} };

let _eventCd = 6;
let _px = 0, _pz = 0;
let _lastCrimeAt = -1e9;
let _lastAccidentAt = -1e9;
let _lastCopToast = -1e9;

/* An NPC that's busy fleeing / talking / already in a social state
   shouldn't be hijacked by an ambient event. */
const _free = (n) => !n.dead && (n.state === "walk" || n.state === "idle");

function _dist2(a, b) {
  const dx = a.ctl.pos.x - b.ctl.pos.x;
  const dz = a.ctl.pos.z - b.ctl.pos.z;
  return dx * dx + dz * dz;
}

function _nearestFree(from, maxD, filter) {
  let best = null, bestD = maxD * maxD;
  for (const n of NPCs.list) {
    if (n === from || !_free(n) || (filter && !filter(n))) continue;
    const d = _dist2(from, n);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

export const Social = {
  onCrime(x, z, kind) {
    const now = performance.now();
    if (now - _lastCrimeAt < 1200) return;
    _lastCrimeAt = now;

    /* Civilians run — without touching the crime meter (NPCs.scare
       does that, and would feed back into this very handler). */
    NPCs.panic(x, z, 14);

    let copNear = false;
    for (const npc of NPCs.list) {
      if (npc.role !== "police" || npc.dead) continue;
      const dx = npc.ctl.pos.x - x;
      const dz = npc.ctl.pos.z - z;
      if (dx * dx + dz * dz < 40 * 40) {
        npc.state = "investigate";
        npc.investigateX = x;
        npc.investigateZ = z;
        npc.lookX = x; npc.lookZ = z;
        npc.stateT = 10;
        copNear = true;
      }
    }

    if (copNear && kind !== "shove" && now - _lastCopToast > 8000) {
      _lastCopToast = now;
      _toast("🚔 Police are responding");
    }
  },

  onAccident(x, z) {
    const now = performance.now();
    if (now - _lastAccidentAt < 3000) return;
    _lastAccidentAt = now;

    /* Closest 2–4 free civilians form a ring around the spot */
    const near = [];
    for (const npc of NPCs.list) {
      if (npc.role === "police" || !_free(npc)) continue;
      const dx = npc.ctl.pos.x - x;
      const dz = npc.ctl.pos.z - z;
      const d = dx * dx + dz * dz;
      if (d < 20 * 20) near.push({ npc, d });
    }
    near.sort((a, b) => a.d - b.d);
    const crowd = near.slice(0, 4).map(o => o.npc);

    for (let i = 0; i < crowd.length; i++) {
      const npc = crowd[i];
      const ang = (i / crowd.length) * TAU + Math.random() * 0.4;
      const r = 3.5 + Math.random() * 1.5;
      npc.state = "watch";
      npc.investigateX = x + Math.cos(ang) * r;
      npc.investigateZ = z + Math.sin(ang) * r;
      npc.lookX = x; npc.lookZ = z;
      npc.stateT = 8;
    }
  },

  _argue() {
    const traders = NPCs.list.filter(n => n.role === "trader" && _free(n));
    if (traders.length < 2) return;
    const a = traders[Math.floor(Math.random() * traders.length)];
    const b = traders[Math.floor(Math.random() * traders.length)];
    if (a === b || _dist2(a, b) > 15 * 15) return;

    const dx = b.ctl.pos.x - a.ctl.pos.x;
    const dz = b.ctl.pos.z - a.ctl.pos.z;
    a.state = "argue"; a.stateT = 2.5; a.yawTarget = Math.atan2(dx, dz);
    b.state = "argue"; b.stateT = 2.5; b.yawTarget = Math.atan2(-dx, -dz);

    /* Only mention it if the player is around to see it */
    const pdx = a.ctl.pos.x - _px, pdz = a.ctl.pos.z - _pz;
    if (pdx * pdx + pdz * pdz < 30 * 30 && Math.random() < 0.5) _toast("🗣 Traders arguing");
  },

  _bless() {
    const priests = NPCs.list.filter(n => n.role === "priest" && _free(n));
    if (!priests.length) return;
    const priest = priests[Math.floor(Math.random() * priests.length)];

    /* If the player is close and on foot, bless them */
    const pdx = _px - priest.ctl.pos.x, pdz = _pz - priest.ctl.pos.z;
    let onFoot = false;
    try { onFoot = window.__ph3d_drive && window.__ph3d_drive.getMode() === "walk"; } catch (e) {}
    if (onFoot && pdx * pdx + pdz * pdz < 8 * 8 && Math.random() < 0.5) {
      priest.yawTarget = Math.atan2(pdx, pdz);
      priest.state = "bless";
      priest.stateT = 2.5;
      try {
        const C = window.__ph3d_combat;
        if (C && C.heal) C.heal(5);
      } catch (e) {}
      _toast("🙏 The priest blessed you · +5 HP");
      return;
    }

    const target = _nearestFree(priest, 12, n => n.role !== "police");
    if (!target) return;
    priest.yawTarget = Math.atan2(
      target.ctl.pos.x - priest.ctl.pos.x,
      target.ctl.pos.z - priest.ctl.pos.z
    );
    priest.state = "bless";
    priest.stateT = 2.5;
  },

  _policeConfront() {
    const cops = NPCs.list.filter(n => n.role === "police" && _free(n));
    if (!cops.length) return;
    const cop = cops[Math.floor(Math.random() * cops.length)];
    const target = _nearestFree(cop, 8, n => n.role !== "police");
    if (!target) return;

    const dx = target.ctl.pos.x - cop.ctl.pos.x;
    const dz = target.ctl.pos.z - cop.ctl.pos.z;
    cop.yawTarget = Math.atan2(dx, dz);
    cop.state = "confront";
    cop.stateT = 3;
    target.yawTarget = Math.atan2(-dx, -dz);
    target.state = "confronted";
    target.stateT = 3;
  },

  tick(dt, playerX, playerZ) {
    _px = playerX || 0;
    _pz = playerZ || 0;
    _eventCd -= dt;
    if (_eventCd > 0) return;
    _eventCd = 6 + Math.random() * 6;

    const roll = Math.random();
    if (roll < 0.30)      this._argue();
    else if (roll < 0.55) this._bless();
    else if (roll < 0.80) this._policeConfront();
    /* else: quiet tick */
  },
};

