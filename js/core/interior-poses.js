/* ════════════════════════════════════════════════════════════════
   interior-poses.js — everyday-life poses for NPCs (and the player).

   NPCs inside interiors now:
     • jog / run across the room
     • sit on the ground
     • bless their food (pray) then eat it
     • hug each other
     • shake hands
     • lean on tables

   The poses themselves live in characters/animator.js (EMOTES:
   sit_ground, pray, eat, hug, handshake, lean_table).
   This file only decides WHO does WHAT and WHEN.

   Hooks (npcs.js):
     NPCs.tick           → InteriorPoses.tick(dt, px, pz, NPCs)
     state "pose"/"meet" → InteriorPoses.update(npc, dt, NPCs)

   Player:
     InteriorPoses.withPlayer(player, "hug" | "handshake", NPCs)
     InteriorPoses.findTable(colliders, x, z, floorY, level)
   ════════════════════════════════════════════════════════════════ */

const EMOTE_SPEED = 1.4;                 /* animator runs emote clocks at 1.4× */
const rnd = Math.random;
const rBetween = (a, b) => a + rnd() * (b - a);

let _cd = 3;

function _startEmote(npc, name, secs) {
  const c = npc.ctl;
  c._emoteName = name;
  c._emoteTimer = secs * EMOTE_SPEED + 0.5;
  c._emotePhase = 0;
}
function _stopEmote(npc) {
  const c = npc.ctl;
  if (c._emoteTimer > 0.4) c._emoteTimer = 0.4;   /* animator blends out over the last 0.45 */
}
function _face(npc, x, z) {
  npc.yawTarget = Math.atan2(x - npc.ctl.pos.x, z - npc.ctl.pos.z);
}
/* centre-to-centre distance at which the pair pose looks right:
   hug = bodies nearly touching, handshake = one extended arm each */
const STOP_DIST = { hug: 0.58, handshake: 1.0 };
const _stopFor = (name) => STOP_DIST[name] || 0.85;
function _busy(n) { return n.state === "pose" || n.state === "meet"; }
function _available(n) {
  return !n.dead && !n._lifeHidden && (n.state === "idle" || n.state === "walk" || n.state === "stroll") && !n.seatTarget;
}

function _beginPose(npc, name, secs, next) {
  npc.state = "pose";
  npc.stateT = secs + 1;
  npc.moveSpeed = 0;
  npc._pose = { name, t: secs, next: next || null };
  _startEmote(npc, name, secs);
}

/* nearest table-like box from NPC data: {x,z,hx,hz} (no height info there) */
function _tableForNPC(npc, aabbs) {
  if (!aabbs || !aabbs.length) return null;
  const px = npc.ctl.pos.x, pz = npc.ctl.pos.z;
  let best = null, bd = 14 * 14;
  for (const b of aabbs) {
    const w = b.hx * 2, d = b.hz * 2, area = w * d;
    if (b.hx < 0.3 || b.hz < 0.3 || w > 3.2 || d > 3.2 || area < 0.5 || area > 6) continue;
    const cx = Math.max(b.x - b.hx, Math.min(b.x + b.hx, px));
    const cz = Math.max(b.z - b.hz, Math.min(b.z + b.hz, pz));
    const dx = px - cx, dz = pz - cz, d2 = dx * dx + dz * dz;
    if (d2 < 0.04 || d2 > bd) continue;
    const L = Math.sqrt(d2);
    const sx = cx + (dx / L) * 0.5, sz = cz + (dz / L) * 0.5;
    best = { gx: sx, gz: sz, tx: cx, tz: cz }; bd = d2;
  }
  return best;
}

export const InteriorPoses = {
  /* Called every frame from NPCs.tick */
  tick(dt, px, pz, NPCs) {
    /* clean up NPCs whose pose was interrupted (flee, talk, hit…) */
    let interior = 0, busy = 0;
    for (const n of NPCs.list) {
      if (n._pose && !_busy(n)) { _stopEmote(n); n._pose = null; }
      if (n._interiorPlace) { interior++; if (_busy(n)) busy++; }
    }
    if (!interior) return;

    _cd -= dt;
    if (_cd > 0) return;
    _cd = rBetween(2.2, 4.5);
    if (busy > Math.max(2, interior * 0.4)) return;

    const pool = NPCs.list.filter((n) => n._interiorPlace && n.role !== "police" && _available(n) &&
      Math.hypot(n.ctl.pos.x - px, n.ctl.pos.z - pz) < 45);
    if (!pool.length) return;
    const npc = pool[Math.floor(rnd() * pool.length)];

    const r = rnd();
    if (r < 0.20)      this._jog(npc, NPCs);
    else if (r < 0.36) this._sitGround(npc);
    else if (r < 0.52) this._prayEat(npc);
    else if (r < 0.66) this._pair(npc, pool, "hug");
    else if (r < 0.82) this._pair(npc, pool, "handshake");
    else               this._lean(npc, NPCs);
  },

  _jog(npc, NPCs) {
    const spot = NPCs._freeSpot(npc.ctl.pos.x, npc.ctl.pos.z, 6, 14);
    if (!spot) return;
    npc.strollX = spot.x; npc.strollZ = spot.z; npc.strollSp = rBetween(3.8, 4.8);
    npc.state = "stroll"; npc.stateT = 10; npc._rt = null;
  },

  _sitGround(npc) { _beginPose(npc, "sit_ground", rBetween(14, 26)); },

  _prayEat(npc) { _beginPose(npc, "pray", 4.5, { name: "eat", secs: rBetween(6, 9) }); },

  _pair(npc, pool, kind) {
    let best = null, bd = 12 * 12;
    for (const o of pool) {
      if (o === npc) continue;
      const dx = o.ctl.pos.x - npc.ctl.pos.x, dz = o.ctl.pos.z - npc.ctl.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = o; }
    }
    if (!best) return;
    npc.state = "meet"; npc.stateT = 9; npc._pose = { kind, partner: best, name: kind };
    best.state = "meet"; best.stateT = 9; best._pose = { kind, partner: npc, name: kind };
    npc._rt = null; best._rt = null;
  },

  _lean(npc, NPCs) {
    const t = _tableForNPC(npc, NPCs.aabbs());
    if (!t) return;
    npc.state = "meet"; npc.stateT = 12; npc._rt = null;
    npc._pose = { kind: "lean", goal: { x: t.gx, z: t.gz }, face: { x: t.tx, z: t.tz }, name: "lean_table" };
  },

  /* Called while npc.state is "pose" or "meet" */
  update(npc, dt, NPCs) {
    const P = npc._pose;
    if (!P) { npc.state = "idle"; npc.stateT = 1; return; }

    if (npc.state === "meet") {
      npc.stateT -= 0;                                  /* npcs.js already counts stateT down */
      let tx, tz, stop;
      if (P.partner) {
        const q = P.partner;
        if (q.dead || q.state === "flee") { npc._pose = null; npc.state = "idle"; npc.stateT = 1; return; }
        tx = q.ctl.pos.x; tz = q.ctl.pos.z; stop = _stopFor(P.name);
      } else if (P.player) {
        const pp = P.player.pos();
        tx = pp.x; tz = pp.z; stop = _stopFor(P.name);
      } else { tx = P.goal.x; tz = P.goal.z; stop = 0.5; }

      const dx = tx - npc.ctl.pos.x, dz = tz - npc.ctl.pos.z, d = Math.hypot(dx, dz);
      if (d > stop && npc.stateT > 0) {
        NPCs._stepToward(npc, dx, dz, 1.9, dt);
        return;
      }
      if (npc.stateT <= 0) { npc._pose = null; npc.state = "idle"; npc.stateT = 1; return; }

      /* arrived */
      if (P.kind === "lean") {
        _face(npc, P.face.x, P.face.z);
        _beginPose(npc, "lean_table", rBetween(10, 20));
      } else if (P.player) {
        _face(npc, tx, tz);
        _beginPose(npc, P.name, P.name === "hug" ? 4 : 3);
        try { P.player.act(P.name, npc.ctl.pos.x, npc.ctl.pos.z); } catch (e) {}
      } else {
        const q = P.partner;
        const qd = Math.hypot(q.ctl.pos.x - npc.ctl.pos.x, q.ctl.pos.z - npc.ctl.pos.z);
        /* partner may still be a step away: wait for it (or give up when stateT runs out) */
        if (qd > _stopFor(P.name) + 0.3) { npc.moveSpeed = 0; _face(npc, tx, tz); return; }
        const secs = P.name === "hug" ? 4 : 3;
        _face(npc, tx, tz); _face(q, npc.ctl.pos.x, npc.ctl.pos.z);
        _beginPose(npc, P.name, secs);
        if (q._pose && q._pose.partner === npc) _beginPose(q, P.name, secs);
      }
      return;
    }

    /* state === "pose" */
    npc.moveSpeed = 0;
    P.t -= dt;
    npc.stateT = Math.max(npc.stateT, 0.5);              /* we own the timing */
    if (P.t > 0) return;
    if (P.next) {
      const n = P.next;
      _beginPose(npc, n.name, n.secs);
      return;
    }
    _stopEmote(npc);
    npc._pose = null;
    npc.state = "idle"; npc.stateT = rBetween(1, 3);
  },

  /* ── player + NPC (hug / handshake) ─────────────────────────────
     player = { pos:() => ({x,z}), act:(name, npcX, npcZ) => void }  */
  withPlayer(player, name, NPCs) {
    const p = player.pos();
    const npc = NPCs.nearest(p.x, p.z, 6);
    if (!npc || npc.dead || npc.role === "police" && name === "hug") return false;
    if (_busy(npc)) return false;
    npc.state = "meet"; npc.stateT = 8; npc._rt = null;
    npc._pose = { kind: "player", player, name };
    return true;
  },

  /* ── player: nearest table-height collider ─────────────────────── */
  findTable(colliders, x, z, floorY, level) {
    if (!colliders) return null;
    let best = null, bd = 1.8 * 1.8;
    for (const c of colliders) {
      if (c.level !== level) continue;
      const y0 = (c.y0 != null ? c.y0 : 0) - floorY, y1 = (c.y1 != null ? c.y1 : 3) - floorY;
      if (y0 > 0.35 || y1 < 0.55 || y1 > 1.25) continue;      /* table-height only */
      const w = c.maxX - c.minX, d = c.maxZ - c.minZ;
      if (w > 6 || d > 6) continue;                            /* not a wall */
      const cx = Math.max(c.minX, Math.min(c.maxX, x));
      const cz = Math.max(c.minZ, Math.min(c.maxZ, z));
      const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
      if (d2 > bd || d2 < 1e-6) continue;
      bd = d2; best = { tx: cx, tz: cz, dx, dz, len: Math.sqrt(d2) };
    }
    return best;
  },
};

if (typeof window !== "undefined") window.__ph3d_interiorPoses = InteriorPoses;
