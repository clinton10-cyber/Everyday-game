/* scene-life.js — per-scene life: a randomly-skinned NPC cat in every scene, plus a
   top-up of walking NPCs for public scenes that spawn none (UNIPORT, governor, ...).
   Driven from the router's frame loop; resets itself whenever the scene object changes. */
import { NPCs } from "./npcs.js";
import { Cats } from "./cats.js";
import { NpcTalk } from "./npc-talk.js";

const NO_LIFE = new Set(["city", "travel", "minimap", "zonedrive", "airplane", "range", "showroom"]);
const NO_NPC_FILL = new Set(["drive", "houseInterior", "myhouse", "starterflat", "duplex", "lagosflat", "mansion", "statejail", "prisonScene"]);
const ROLE_MIX = {
  university: ["student", "student", "walker", "banker"],
  governorScene: ["police", "walker", "banker", "walker"],
  governorInterior: ["police", "banker", "walker"],
  govhouse: ["police", "banker", "walker"],
  statehouse: ["police", "banker", "walker"],
  hospital: ["doctor", "walker"],
  church: ["priest", "walker"], mosque: ["priest", "walker"],
};
const MIN_NPCS = 6, FILL_TO = 9;

let _scene = null, _st = null;

function anchorOf(sc) {
  const c = window.__ph3d_walkCtrl;
  if (c && c.scene === sc.three) return { x: c.pos.x, z: c.pos.z, y: c.floorY || 0, ctl: c };
  if (window.__ph3d_drive && sc._routeName === "drive") {
    const p = window.__ph3d_drive.getPos(); if (p) return { x: p.x, z: p.z, y: 0, ctl: null };
  }
  const p = sc.camera.position;
  return { x: p.x, z: p.z, y: 0, ctl: null };
}

function reset() {
  try { Cats.despawn(); } catch (e) {}
  if (_st && _st.mountedTalk) { try { NpcTalk.unmount(); } catch (e) {} }
  _st = { t: 0, done: false, mountedTalk: false, anchor: { x: 0, z: 0 } };
}

function colliderOK(ctl) { return !!(ctl && ctl.world && ctl.world.colliders); }
function blocked(ctl, x, z, pad) {
  if (!colliderOK(ctl)) return false;
  for (const b of ctl.world.colliders) {
    if (b.level !== ctl.level) continue;
    if (b.y0 !== undefined && b.y0 > 1.4) continue;
    if (b.y1 !== undefined && b.y1 < 0.5) continue;
    if (x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad) return true;
  }
  const bd = ctl.world.bounds;
  if (bd && (x < bd.minX + 1 || x > bd.maxX - 1 || z < bd.minZ + 1 || z > bd.maxZ - 1)) return true;
  return false;
}
function groundY(ctl, x, z) {
  try { return ctl._groundInfo(x, z, ctl.level, 0).y || 0; } catch (e) { return 0; }
}

function fillNPCs(sc, A) {
  const ctl = A.ctl, name = sc._routeName, id = (sc._routeParams && sc._routeParams.id) || sc.sceneId || name;
  if (!ctl || NO_NPC_FILL.has(name) || NO_NPC_FILL.has(id) || NO_NPC_FILL.has(sc.sceneId)) return;
  const near = NPCs.list.filter(n => !n.dead && n.group &&
    Math.hypot(n.group.position.x - A.x, n.group.position.z - A.z) < 90).length;
  if (near >= MIN_NPCS) return;
  NPCs.setScene(sc.three);
  if (!NPCs.aabbs().length && colliderOK(ctl)) {
    NPCs.setAABBs(ctl.world.colliders.filter(b => b.level === ctl.level && (b.y0 === undefined || b.y0 < 1.2))
      .map(b => ({ x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, hx: (b.maxX - b.minX) / 2, hz: (b.maxZ - b.minZ) / 2 })));
  }
  try { NPCs.setTerrain(ctl.world.groundAt, ctl.world.bounds); } catch (e) {}
  const mix = ROLE_MIX[id] || ROLE_MIX[name] || ["walker", "walker", "banker"];
  let made = 0;
  for (let i = 0; i < 60 && NPCs.list.length < FILL_TO + near && made < FILL_TO - near; i++) {
    const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 24;
    const x = A.x + Math.cos(a) * r, z = A.z + Math.sin(a) * r;
    if (blocked(ctl, x, z, 0.7)) continue;
    const npc = NPCs.spawnRole(sc.three, mix[made % mix.length], x, z, { yOffset: groundY(ctl, x, z) });
    if (npc) { npc.maxDist = 100; made++; }
  }
  if (!NpcTalk.isMounted()) {
    NpcTalk.mount({ getPos: () => ({ x: ctl.pos.x, z: ctl.pos.z }), getYaw: () => ctl.yaw });
    _st.mountedTalk = true;
  }
}

function spawnCat(sc, A) {
  const ctl = A.ctl;
  Cats.spawn(sc.three, 2, (Math.random() * 1e9) | 0,
    { get x() { return anchorOf(sc).x; }, get z() { return anchorOf(sc).z; } },
    { cx: A.x, cz: A.z, rMin: 4, rMax: 14,
      ground: ctl ? (x, z) => groundY(ctl, x, z) + (ctl.floorY > 0.3 && ctl.level === 0 ? 0 : 0) : null,
      blocked: ctl ? (x, z) => blocked(ctl, x, z, 0.35) : null });
}

export const SceneLife = {
  tick(sc, dt, t) {
    if (!sc || !sc.three) return;
    if (sc !== _scene) { _scene = sc; reset(); }
    const name = sc._routeName;
    if (NO_LIFE.has(name)) return;
    try {
      _st.t += dt;
      if (!_st.done && _st.t > 1.0) {
        _st.done = true;
        const A = anchorOf(sc);
        spawnCat(sc, A);
        fillNPCs(sc, A);
      }
      if (!_st.done) return;
      Cats.tick(Math.min(dt, 0.1), t || performance.now() / 1000);
      /* scenes that never tick NPCs themselves: do it here */
      if (NPCs.list.length && performance.now() - (NPCs._tickStamp || 0) > 150) {
        const A = anchorOf(sc); NPCs.tick(dt, A.x, A.z);
      }
      if (_st.mountedTalk) { const A = anchorOf(sc); NpcTalk.tick(dt); }
    } catch (e) { console.warn("[scene-life]", e); }
  },
};
