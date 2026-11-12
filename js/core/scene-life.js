/* scene-life.js — lightweight scene population and ambient life.
   The router calls SceneLife.tick() from its frame loop.  Population is
   scene-scoped, quality-aware and deliberately spread across large maps. */
import { NPCs } from "./npcs.js";
import { Cats } from "./cats.js";
import { NpcTalk } from "./npc-talk.js";
import { Quality } from "./quality.js";

const NO_LIFE = new Set(["city", "travel", "minimap", "zonedrive", "airplane", "range", "showroom"]);
const NO_NPC_FILL = new Set(["drive", "houseInterior", "myhouse", "starterflat", "duplex", "lagosflat", "mansion", "statejail", "prisonScene"]);

/* Population targets are maximum living ambient NPCs for each named map at
   High quality. They scale down automatically on weaker phones. */
const SCENE_PROFILES = {
  university: { target: 26, gap: 19, grid: 58, roles: ["student", "student", "student", "walker", "banker", "clerk"] },
  village:    { target: 20, gap: 15, grid: 44, roles: ["mamas", "trader", "walker", "school_kids", "walker", "taxi"] },
  citypark:   { target: 15, gap: 13, grid: 34, roles: ["walker", "couple", "school_kids", "trader"] },
  boropark:   { target: 15, gap: 13, grid: 34, roles: ["walker", "couple", "school_kids", "trader"] },
  beach:      { target: 13, gap: 14, grid: 36, roles: ["walker", "couple", "trader", "taxi"] },
  forest:     { target: 10, gap: 16, grid: 40, roles: ["walker", "walker", "couple"] },
  market:     { target: 16, gap: 12, grid: 30, roles: ["mamas", "trader", "walker", "taxi", "school_kids"] },
  airport:    { target: 12, gap: 15, grid: 38, roles: ["walker", "banker", "taxi", "student"] },
};

const LOCAL_MIN = 6;
const LOCAL_TARGET = 9;
const LOCAL_CAP = 14;
let _scene = null, _st = null;

function sceneKey(sc) {
  return String((sc._routeParams && sc._routeParams.id) || sc.sceneId || sc._routeName || "").toLowerCase();
}
function routeName(sc) { return String(sc._routeName || "").toLowerCase(); }
function inScene(n, sc) {
  return !!(n && !n.dead && n.group && n.group.parent === sc.three);
}
function sceneNPCs(sc) { return NPCs.list.filter(n => inScene(n, sc)); }

function anchorOf(sc) {
  const c = window.__ph3d_walkCtrl;
  if (c && c.scene === sc.three) return { x: c.pos.x, z: c.pos.z, y: c.floorY || 0, ctl: c };
  if (window.__ph3d_drive && routeName(sc) === "drive") {
    const p = window.__ph3d_drive.getPos();
    if (p) return { x: p.x, z: p.z, y: 0, ctl: null };
  }
  const p = sc.camera.position;
  return { x: p.x, z: p.z, y: 0, ctl: null };
}

function reset() {
  try { Cats.despawn(); } catch (e) {}
  if ((_st && _st.mountedTalk) || NpcTalk.isMounted()) { try { NpcTalk.unmount(); } catch (e) {} }
  _st = { t: 0, done: false, mountedTalk: false, populationTimer: 0 };
}

function colliderOK(ctl) { return !!(ctl && ctl.world && Array.isArray(ctl.world.colliders)); }
function blocked(ctl, x, z, pad) {
  if (!colliderOK(ctl)) return false;
  for (const b of ctl.world.colliders) {
    if (b.level != null && b.level !== ctl.level) continue;
    if (b.y0 !== undefined && b.y0 > 1.4) continue;
    if (b.y1 !== undefined && b.y1 < 0.5) continue;
    if (x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad) return true;
  }
  const bd = ctl.world.bounds;
  if (bd && (x < bd.minX + 1 || x > bd.maxX - 1 || z < bd.minZ + 1 || z > bd.maxZ - 1)) return true;
  return false;
}
function groundInfo(ctl, x, z) {
  try {
    if (typeof ctl._groundInfo === "function") {
      const info = ctl._groundInfo(x, z, ctl.level, ctl.floorY || 0);
      if (!info || !Number.isFinite(info.y)) return null;
      if (info.level != null && ctl.level != null && info.level !== ctl.level) return null;
      return info;
    }
    if (ctl.world && typeof ctl.world.groundAt === "function") {
      const y = ctl.world.groundAt(x, z);
      return Number.isFinite(y) ? { y } : null;
    }
  } catch (e) {}
  return { y: 0 };
}
function validSpot(ctl, x, z, pad) {
  const b = ctl && ctl.world && ctl.world.bounds;
  if (b && (x < b.minX + 4 || x > b.maxX - 4 || z < b.minZ + 4 || z > b.maxZ - 4)) return null;
  if (blocked(ctl, x, z, pad == null ? 0.85 : pad)) return null;
  return groundInfo(ctl, x, z);
}
function qualityScale() {
  if (Quality.isPotato) return 0.38;
  if (Quality.isLow) return 0.58;
  if (Quality.isHigh) return 1;
  return 0.78;
}
function getProfile(key, ctl) {
  if (SCENE_PROFILES[key]) return SCENE_PROFILES[key];
  const b = ctl && ctl.world && ctl.world.bounds;
  if (!b) return null;
  const area = Math.max(0, b.maxX - b.minX) * Math.max(0, b.maxZ - b.minZ);
  /* Large public destinations without a hand-authored profile also get a
     dispersed crowd, while small building interiors stay locally populated. */
  if (area >= 52000) return { target: 14, gap: 15, grid: 42, roles: ["walker", "walker", "trader", "student", "couple"] };
  return null;
}
function roleMixFor(key) {
  if (key === "university") return ["student", "student", "student", "walker", "banker", "clerk"];
  if (key === "village") return ["mamas", "trader", "walker", "school_kids", "walker", "taxi"];
  if (key === "hospital") return ["doctor", "walker", "clerk"];
  if (key === "church" || key === "mosque") return ["priest", "walker", "couple"];
  if (key === "governor" || key === "govhouse" || key === "governorinterior") return ["police", "banker", "walker"];
  return ["walker", "walker", "banker", "trader"];
}
function mountTalk(sc, ctl) {
  if (_st.mountedTalk || NpcTalk.isMounted() || !ctl) return;
  NpcTalk.mount({ getPos: () => ({ x: ctl.pos.x, z: ctl.pos.z }), getYaw: () => ctl.yaw });
  _st.mountedTalk = true;
}
function setNPCSceneContext(sc, ctl) {
  NPCs.setScene(sc.three);
  if (colliderOK(ctl)) {
    /* Always replace collision data on scene entry. Reusing the previous
       scene's AABBs can make pedestrians spawn around invisible old walls. */
    NPCs.setAABBs(ctl.world.colliders
      .filter(b => (b.level == null || b.level === ctl.level) && (b.y0 === undefined || b.y0 < 1.2))
      .map(b => ({
        x: (b.minX + b.maxX) / 2,
        z: (b.minZ + b.maxZ) / 2,
        hx: Math.max(0, (b.maxX - b.minX) / 2),
        hz: Math.max(0, (b.maxZ - b.minZ) / 2),
      })));
  } else NPCs.setAABBs([]);
  try { NPCs.setTerrain(ctl.world.groundAt, ctl.world.bounds); } catch (e) {}
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Use a shuffled grid of cells (a simple Poisson-disc approximation) so a
   large campus or village gets pedestrians across the whole walkable map. */
function spawnDispersed(sc, ctl, A, profile, target, key) {
  const bounds = ctl.world && ctl.world.bounds;
  if (!bounds) return 0;
  const present = sceneNPCs(sc);
  const placed = present.map(n => ({ x: n.ctl.pos.x, z: n.ctl.pos.z }));
  let needed = Math.max(0, target - present.length), made = 0;
  if (!needed) return 0;

  const width = Math.max(1, bounds.maxX - bounds.minX - 12);
  const depth = Math.max(1, bounds.maxZ - bounds.minZ - 12);
  const cellsX = Math.max(3, Math.ceil(width / profile.grid));
  const cellsZ = Math.max(3, Math.ceil(depth / profile.grid));
  const cellW = width / cellsX, cellD = depth / cellsZ;
  const cells = [];
  for (let rz = 0; rz < cellsZ; rz++) for (let cx = 0; cx < cellsX; cx++) cells.push({ cx, rz });
  shuffle(cells);

  const minGap = profile.gap * (Quality.isPotato ? 0.82 : 1);
  const roles = profile.roles || roleMixFor(key);
  for (const cell of cells) {
    if (made >= needed) break;
    let accepted = false;
    for (let attempt = 0; attempt < 5 && !accepted; attempt++) {
      const x = bounds.minX + 6 + (cell.cx + 0.2 + Math.random() * 0.6) * cellW;
      const z = bounds.minZ + 6 + (cell.rz + 0.2 + Math.random() * 0.6) * cellD;
      if (Math.hypot(x - A.x, z - A.z) < 10) continue;
      const ground = validSpot(ctl, x, z, 1.0);
      if (!ground) continue;
      if (placed.some(p => Math.hypot(p.x - x, p.z - z) < minGap)) continue;
      const role = roles[made % roles.length];
      const npc = NPCs.spawnRole(sc.three, role, x, z, { yOffset: ground.y });
      if (!npc) continue;
      npc.maxDist = key === "university" ? 200 : 170;
      npc._scenePopulation = key;
      npc._sceneLifeSpawned = true;
      placed.push({ x, z });
      made++;
      accepted = true;
    }
  }

  /* Fill small gaps left by blocked grid cells, still enforcing separation. */
  for (let i = 0; i < needed * 24 && made < needed; i++) {
    const x = bounds.minX + 6 + Math.random() * width;
    const z = bounds.minZ + 6 + Math.random() * depth;
    if (Math.hypot(x - A.x, z - A.z) < 10) continue;
    const ground = validSpot(ctl, x, z, 1.0);
    if (!ground || placed.some(p => Math.hypot(p.x - x, p.z - z) < minGap)) continue;
    const npc = NPCs.spawnRole(sc.three, roles[made % roles.length], x, z, { yOffset: ground.y });
    if (!npc) continue;
    npc.maxDist = key === "university" ? 200 : 170;
    npc._scenePopulation = key;
    npc._sceneLifeSpawned = true;
    placed.push({ x, z });
    made++;
  }
  return made;
}

function spawnLocal(sc, ctl, A, key, count) {
  const present = sceneNPCs(sc);
  const placed = present.map(n => ({ x: n.ctl.pos.x, z: n.ctl.pos.z }));
  const roles = roleMixFor(key);
  const minGap = Quality.isPotato ? 6.5 : 8.5;
  let made = 0;
  for (let i = 0; i < count * 28 && made < count; i++) {
    /* Golden-angle stepping avoids repeated random clusters around the spawn. */
    const angle = i * 2.399963 + Math.random() * 0.22;
    const radius = 9 + Math.sqrt(i + 1) * (Quality.isPotato ? 2.3 : 3.1) + Math.random() * 2.5;
    const x = A.x + Math.cos(angle) * radius;
    const z = A.z + Math.sin(angle) * radius;
    const ground = validSpot(ctl, x, z, 0.75);
    if (!ground || placed.some(p => Math.hypot(p.x - x, p.z - z) < minGap)) continue;
    const npc = NPCs.spawnRole(sc.three, roles[(present.length + made) % roles.length], x, z, { yOffset: ground.y });
    if (!npc) continue;
    npc.maxDist = 125;
    npc._scenePopulation = key;
    npc._sceneLifeSpawned = true;
    placed.push({ x, z });
    made++;
  }
  return made;
}

function fillNPCs(sc, A) {
  const ctl = A.ctl;
  const name = routeName(sc), key = sceneKey(sc);
  if (!ctl || NO_NPC_FILL.has(name) || NO_NPC_FILL.has(key) || NO_NPC_FILL.has(sc.sceneId)) return;
  setNPCSceneContext(sc, ctl);
  const profile = getProfile(key, ctl);
  const scale = qualityScale();
  if (profile) {
    const target = Math.max(Quality.isPotato ? 7 : 9, Math.round(profile.target * scale));
    spawnDispersed(sc, ctl, A, profile, target, key);
  } else {
    const current = sceneNPCs(sc);
    const nearby = current.filter(n => Math.hypot(n.ctl.pos.x - A.x, n.ctl.pos.z - A.z) < 85).length;
    const cap = Math.max(LOCAL_MIN, Math.round(LOCAL_CAP * scale));
    const desired = Math.max(0, Math.min(LOCAL_TARGET - nearby, cap - current.length));
    if (desired > 0) spawnLocal(sc, ctl, A, key, desired);
  }
  /* Mount independently of population count. Previously an early return
     could leave a scene full of NPCs but with no proximity-talk interface. */
  mountTalk(sc, ctl);
}

function maintainPopulation(sc, A) {
  const ctl = A.ctl;
  if (!ctl) return;
  const key = sceneKey(sc), profile = getProfile(key, ctl);
  const current = sceneNPCs(sc);
  const scale = qualityScale();
  if (profile) {
    const target = Math.max(Quality.isPotato ? 7 : 9, Math.round(profile.target * scale));
    if (current.length < target) spawnDispersed(sc, ctl, A, profile, target, key);
    return;
  }
  const cap = Math.max(LOCAL_MIN, Math.round(LOCAL_CAP * scale));
  if (current.length >= cap) return;
  const nearby = current.filter(n => Math.hypot(n.ctl.pos.x - A.x, n.ctl.pos.z - A.z) < 78).length;
  if (nearby < LOCAL_MIN) {
    const need = Math.min(3, LOCAL_MIN - nearby, cap - current.length);
    if (need > 0) spawnLocal(sc, ctl, A, key, need);
  }
}

function spawnCat(sc, A) {
  const ctl = A.ctl;
  Cats.spawn(sc.three, 2, (Math.random() * 1e9) | 0,
    { get x() { return anchorOf(sc).x; }, get z() { return anchorOf(sc).z; } },
    { cx: A.x, cz: A.z, rMin: 4, rMax: 14,
      ground: ctl ? (x, z) => { const g = groundInfo(ctl, x, z); return g ? g.y : 0; } : null,
      blocked: ctl ? (x, z) => blocked(ctl, x, z, 0.35) : null });
}

export const SceneLife = {
  tick(sc, dt, t) {
    if (!sc || !sc.three) return;
    if (sc !== _scene) {
      _scene = sc;
      reset();
    }
    const name = routeName(sc);
    if (NO_LIFE.has(name)) return;
    try {
      _st.t += dt;
      if (!_st.done && _st.t > 1.0) {
        _st.done = true;
        const A = anchorOf(sc);
        spawnCat(sc, A);
        fillNPCs(sc, A);
        _st.populationTimer = 7.5;
      }
      if (!_st.done) return;
      Cats.tick(Math.min(dt, 0.1), t || performance.now() / 1000);
      _st.populationTimer -= Math.min(dt, 0.1);
      if (_st.populationTimer <= 0) {
        const A = anchorOf(sc);
        maintainPopulation(sc, A);
        _st.populationTimer = 7.5;
      }
      /* Scenes without their own NPC update loop are advanced here. */
      if (NPCs.list.length && performance.now() - (NPCs._tickStamp || 0) > 150) {
        const A = anchorOf(sc);
        NPCs.tick(dt, A.x, A.z);
      }
      if (_st.mountedTalk) NpcTalk.tick(dt);
    } catch (e) { console.warn("[scene-life]", e); }
  },
};
