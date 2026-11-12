/* ════════════════════════════════════════════════════════════════
   interior-npcs.js — role NPCs placed inside interiors.

   v2: much denser NPC population. Base roster is ~2x larger per
   place, and the area-derived count is now area/55 (was area/100)
   with the ceiling at 18 (was 10).  Small interiors that used to
   spawn 2–3 NPCs now spawn 5–8; larger ones spawn 12–18.

   Base-list spots are also pushed out of any overlapping AABB
   before spawning, since the denser roster can land a hand-picked
   spot inside furniture.

   Exports: INTERIOR_NPCS, spawnInteriorNPCs, despawnInteriorNPCs
   ════════════════════════════════════════════════════════════════ */

import { NPCs } from "./npcs.js";

const STORE_KEY = "ph3d.interior-npcs.v1";

export const INTERIOR_NPCS = {
  market: [
    { role: "trader",   x: -20, z:  6 },
    { role: "trader",   x:  -8, z:  6 },
    { role: "trader",   x:   6, z:  6 },
    { role: "trader",   x:  20, z:  6 },
    { role: "trader",   x: -12, z: 22 },
    { role: "trader",   x:  12, z: 22 },
    { role: "trader",   x: -28, z: 18 },
    { role: "trader",   x:  28, z: 18 },
    { role: "trader",   x: -28, z: -8 },
    { role: "trader",   x:  28, z: -8 },
    { role: "banker",   x: -36, z: 14 },
    { role: "mechanic", x:  34, z: 12 },
    { role: "walker",   x:   0, z: 15 },
    { role: "walker",   x: -16, z: -12 },
    { role: "walker",   x:  16, z: -12 },
  ],
  hospital: [
    { role: "banker", x: -8, z: -2 },
    { role: "banker", x:  8, z:  6 },
    { role: "doctor", x:  6, z: -8 },
    { role: "doctor", x: -4, z:  4 },
    { role: "doctor", x: 10, z:  4 },
    { role: "doctor", x: -10, z: -4 },
    { role: "walker", x:  4, z: 10 },
    { role: "walker", x: -6, z: -10 },
  ],
  nightclub: [
    { role: "walker", x: -3, z: 2 }, { role: "walker", x: 3, z: 3 },
    { role: "walker", x: 0, z: -1 }, { role: "walker", x: -2, z: -3 },
    { role: "walker", x: 4, z: -2 }, { role: "trader", x: -9, z: -6 },
  ],
  church: [
    { role: "priest", x: 0,  z: -8 },
    { role: "priest", x: 4,  z: -6 },
    { role: "walker", x: 0,  z:  6 },
    { role: "walker", x: -6, z:  2 },
    { role: "walker", x: 6,  z:  2 },
    { role: "walker", x: -4, z:  8 },
  ],
  mosque: [
    { role: "priest", x: 0,  z: -12 },
    { role: "priest", x: -6, z:  -8 },
    { role: "walker", x: 4,  z:   4 },
    { role: "walker", x: -4, z:   6 },
    { role: "walker", x: 8,  z:   8 },
  ],
  govhouse: [
    { role: "police", x: -6, z: -4 },
    { role: "police", x:  6, z: -4 },
    { role: "police", x:  0, z: -8 },
    { role: "police", x: -8, z:  8 },
    { role: "police", x:  8, z:  8 },
    { role: "banker", x:  0, z:  4 },
    { role: "banker", x: -8, z:  0 },
    { role: "walker", x:  4, z: 10 },
  ],
  governorInterior: [
    { role: "police", x:  0, z:  6 },
    { role: "police", x: -6, z: -4 },
    { role: "police", x:  6, z: -4 },
    { role: "banker", x: -9, z: 12 },
    { role: "banker", x:  9, z: 12 },
    { role: "walker", x:  0, z: 12 },
  ],
  statehouse: [
    { role: "police", x: -6, z:  0 },
    { role: "police", x:  6, z:  0 },
    { role: "police", x: -6, z:  8 },
    { role: "police", x:  6, z:  8 },
    { role: "banker", x:  0, z: -4 },
    { role: "banker", x: -8, z:  4 },
    { role: "walker", x:  0, z:  6 },
  ],
  jobcenter: [
    { role: "banker", x:  0, z: -3 },
    { role: "banker", x: -6, z:  2 },
    { role: "walker", x:  0, z:  2 },
    { role: "walker", x:  6, z:  0 },
    { role: "walker", x: -4, z: -6 },
  ],
  realestate: [
    { role: "banker", x:  0, z: -3 },
    { role: "banker", x:  4, z:  2 },
    { role: "walker", x: -4, z:  2 },
    { role: "walker", x:  2, z: -6 },
  ],
  showroom: [
    { role: "mechanic", x:  4, z:  4 },
    { role: "mechanic", x: -8, z:  4 },
    { role: "mechanic", x:  8, z: -4 },
    { role: "banker",   x: -4, z:  4 },
    { role: "banker",   x:  0, z: -6 },
    { role: "walker",   x:  0, z:  8 },
  ],
  university: [
    { role: "banker", x:   6, z: -6 },
    { role: "banker", x:  -6, z:  2 },
    { role: "walker", x:  -8, z:  4 },
    { role: "walker", x:   8, z:  4 },
    { role: "walker", x:   0, z: -10 },
    { role: "walker", x: -12, z: -4 },
    { role: "walker", x:  12, z: -4 },
    { role: "walker", x:   0, z: 10 },
  ],
  statejail: [
    /* inmates loitering in the cell block */
    { role: "inmate", x: -5, z:  3 },
    { role: "inmate", x:  1, z:  4 },
    { role: "inmate", x: -5, z: -3 },
    { role: "inmate", x:  1, z: -4 },
    { role: "inmate", x: -2, z: -8 },
    /* wardens at the gates / corners */
    { role: "warden", x: -7, z:  11 },
    { role: "warden", x:  7, z:  11 },
    { role: "warden", x: -7, z: -11 },
    { role: "warden", x:  7, z: -11 },
  ],

  autoHub: [
    { role: "mechanic", x:  4, z:  4 },
    { role: "mechanic", x: -4, z:  4 },
    { role: "banker",   x:  0, z: -4 },
    { role: "walker",   x:  8, z: -2 },
  ],
  ferris: [
    { role: "banker", x: -4, z:  0 },
    { role: "banker", x:  4, z: -2 },
    { role: "trader", x:  4, z:  0 },
    { role: "trader", x: -4, z:  2 },
    { role: "walker", x:  0, z:  6 },
  ],
  foodcourt: [
    { role: "trader", x: -3, z:  3 },
    { role: "trader", x:  3, z:  3 },
    { role: "trader", x: -6, z:  0 },
    { role: "banker", x:  3, z:  3 },
    { role: "banker", x:  6, z:  0 },
    { role: "walker", x:  0, z: -4 },
  ],
  arcade: [
    { role: "banker", x:  0, z: -3 },
    { role: "banker", x:  5, z:  2 },
    { role: "walker", x: -4, z:  2 },
    { role: "walker", x:  4, z: -2 },
  ],
  airport: [
    { role: "banker", x: -14, z:  0 },
    { role: "banker", x: -14, z: -6 },
    { role: "banker", x: -14, z:  6 },
    { role: "police", x:   0, z: 12 },
    { role: "police", x:  -8, z: 12 },
    { role: "walker", x:   6, z:  8 },
    { role: "walker", x:  10, z: -4 },
    { role: "walker", x:  -4, z: -8 },
  ],
  prisonScene: [
    { role: "police", x:  0, z:  12 },
    { role: "police", x:  8, z:  -8 },
    { role: "police", x: -8, z:  -8 },
    { role: "police", x:  0, z: -12 },
    { role: "walker", x:  0, z:   4 },
  ],
};

let _spawned = [];
let _placeId = null;
let _store = {};

function _loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); }
  catch (e) { return {}; }
}
function _saveStore(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
}

function _pickWalkableSpot(aabbs, center, i, total) {
  const baseX = center.x != null ? center.x : 0;
  const baseZ = center.z != null ? center.z : 0;
  const baseAngle = (i / Math.max(1, total)) * Math.PI * 2;
  const dist = 3 + (i % 3) * 2.2;
  let best = { x: baseX + Math.cos(baseAngle) * dist, z: baseZ + Math.sin(baseAngle) * dist };
  if (!aabbs || !aabbs.length) return best;
  for (let attempt = 0; attempt < 8; attempt++) {
    const a = baseAngle + attempt * 0.42;
    const x = baseX + Math.cos(a) * dist;
    const z = baseZ + Math.sin(a) * dist;
    let blocked = false;
    for (const b of aabbs) {
      if (x > b.x - b.hx - 0.4 && x < b.x + b.hx + 0.4 &&
          z > b.z - b.hz - 0.4 && z < b.z + b.hz + 0.4) { blocked = true; break; }
    }
    if (!blocked) { best = { x, z }; break; }
  }
  return best;
}

/* Area-based count — denser than v1. Divisor 55 (was 100), cap 18 (was 10). */
function _estimateCount(aabbs, baseCount) {
  if (!aabbs || !aabbs.length) return Math.max(baseCount, 4);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const b of aabbs) {
    if (b.x - b.hx < minX) minX = b.x - b.hx;
    if (b.x + b.hx > maxX) maxX = b.x + b.hx;
    if (b.z - b.hz < minZ) minZ = b.z - b.hz;
    if (b.z + b.hz > maxZ) maxZ = b.z + b.hz;
  }
  const area = Math.max(1, (maxX - minX) * (maxZ - minZ));
  const computed = Math.round(area / 55);
  return Math.max(baseCount, Math.max(4, Math.min(18, computed)));
}

export function spawnInteriorNPCs(scene, placeId, opts) {
  opts = opts || {};
  if (!scene) return;
  NPCs.setScene(scene);
  if (opts.aabbs) NPCs.setAABBs(opts.aabbs);
  NPCs.setSeats(opts.seats || []);

  _placeId = placeId;
  _store = _loadStore();
  const saved = Array.isArray(_store[placeId]) ? _store[placeId].slice() : [];

  const baseList = INTERIOR_NPCS[placeId] || [];
  const skip = new Set(opts.skip || []);
  const activeBase = baseList.filter(s => !skip.has(s.role));

  const target = opts.targetCount != null
    ? Math.max(activeBase.length, opts.targetCount)
    : _estimateCount(opts.aabbs, activeBase.length);

  _spawned = [];

  activeBase.forEach((spot, idx) => {
    const prev = saved[idx];
    let cfg = prev && prev.look ? prev.look : null;
    if (prev && prev.dead) cfg = null;

    /* Nudge base spots out of any furniture they may overlap. */
    let sx = spot.x, sz = spot.z;
    if (opts.aabbs && opts.aabbs.length) {
      const pushed = NPCs._pushOut(sx, sz, opts.aabbs, 0.5);
      sx = pushed[0]; sz = pushed[1];
    }

    try {
      const npc = NPCs.spawnRole(scene, spot.role, sx, sz, {
        aabbs: opts.aabbs, yOffset: opts.yOffset || 0, forcedConfig: cfg,
      });
      if (npc) {
        npc._interiorPlace = placeId;
        npc._interiorSpotIndex = idx;
        npc.maxDist = 80;   /* keep far interior NPCs animating (was 45) */
        _spawned.push(npc);
      }
    } catch (e) {
      console.warn("[interior-npcs] spawn failed:", placeId, spot.role, e);
    }
  });

  const spawnCenter = opts.fallback || { x: 0, z: 0 };
  const remaining = target - _spawned.length;
  for (let i = 0; i < remaining; i++) {
    const idx = activeBase.length + i;
    const prev = saved[idx];
    let cfg = prev && prev.look ? prev.look : null;
    if (prev && prev.dead) cfg = null;
    const spot = _pickWalkableSpot(opts.aabbs, spawnCenter, i, remaining);
    try {
      const npc = NPCs.spawnRole(scene, "walker", spot.x, spot.z, {
        aabbs: opts.aabbs, yOffset: opts.yOffset || 0, forcedConfig: cfg,
      });
      if (npc) {
        npc._interiorPlace = placeId;
        npc._interiorSpotIndex = idx;
        npc.maxDist = 80;   /* keep far interior NPCs animating (was 45) */
        _spawned.push(npc);
      }
    } catch (e) {}
  }

  /* kids in every interior (shops, houses, church, hospital…): small walkers that get a child identity */
  const kidN = Math.max(1, Math.min(4, Math.round(_spawned.length * 0.25)));
  for (let k = 0; k < kidN; k++) {
    const idx = activeBase.length + remaining + k;
    const spot = _pickWalkableSpot(opts.aabbs, spawnCenter, k + remaining, kidN + remaining);
    try {
      const kid = NPCs.spawnRole(scene, "walker", spot.x, spot.z, { aabbs: opts.aabbs, yOffset: opts.yOffset || 0 });
      if (kid) {
        kid._wantKid = true;
        kid._interiorPlace = placeId; kid._interiorSpotIndex = idx; kid.maxDist = 80;
        _spawned.push(kid);
      }
    } catch (e) {}
  }

  _spawnInteriorObjects(scene, placeId, opts);
  _store[placeId] = _spawned.map(npc => ({ look: npc._cfg || null, dead: false }));
  _saveStore(_store);

  NPCs.onKill((deadNpc) => {
    if (deadNpc._interiorPlace !== _placeId) return;
    if (deadNpc._interiorSpotIndex == null) return;
    const list = _store[_placeId] || [];
    if (list[deadNpc._interiorSpotIndex]) {
      list[deadNpc._interiorSpotIndex].dead = true;
      _store[_placeId] = list;
      _saveStore(_store);
    }
  });

  console.log(
    "%c[interior-npcs]",
    "background:#a5b4fc;color:#1e1b4b;font-weight:bold;padding:2px 6px;border-radius:4px",
    placeId + " · " + _spawned.length + " NPCs (target " + target + ")"
  );
}

/* Scatter pickup objects through the interior (carried with E, visible in hand) */
let _objMeshes = [];
async function _spawnInteriorObjects(scene, placeId, opts) {
  try {
    const { WorldObjects } = await import("./world-objects.js");
    const wc = window.__ph3d_walkCtrl;
    const types = WorldObjects.types();
    if (!types.length) return;
    const area = _estimateCount(opts.aabbs, 4);
    const n = Math.max(3, Math.min(8, Math.round(area / 2)));
    const aabbs = opts.aabbs || [];
    for (let i = 0; i < n; i++) {
      const spot = _pickWalkableSpot(aabbs, opts.fallback || { x: 0, z: 0 }, i + 31, n);
      if (!spot) continue;
      const type = types[Math.floor(Math.random() * types.length)];
      const mesh = WorldObjects.buildMesh(type, spot.x, spot.z);
      if (!mesh) continue;
      mesh.position.set(spot.x, (opts.yOffset || 0) + 0.05, spot.z);
      scene.add(mesh);
      _objMeshes.push(mesh);
      if (wc && Array.isArray(wc.carryables)) {
        mesh.userData.phys = mesh.userData.phys || { vel: new mesh.position.constructor(), radius: 0.2, halfH: 0.15, active: false };
        wc.carryables.push({ mesh, radius: 0.2, halfH: 0.15, kind: type });
      }
    }
  } catch (e) { console.warn("[interior-npcs] objects failed", placeId, e); }
}

export function despawnInteriorNPCs() {
  for (const m of _objMeshes) { if (m.parent) m.parent.remove(m); }
  _objMeshes = [];
  for (const npc of _spawned) {
    const idx = NPCs.list.indexOf(npc);
    if (idx >= 0) NPCs.list.splice(idx, 1);
    if (npc.group && npc.group.parent) npc.group.parent.remove(npc.group);
    npc.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(m => m && m.dispose && m.dispose());
      }
    });
  }
  _spawned = [];
}

