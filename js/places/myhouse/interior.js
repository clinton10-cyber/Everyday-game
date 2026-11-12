/* My House -- third-person interior.
   v7: Raised ceiling to 8m, stopped camera clipping, and fixed stuck collisions. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Quality } from "../../core/quality.js";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import { NPCs } from "../../core/npcs.js";
import { NpcTalk } from "../../core/npc-talk.js";
import { Surfaces } from "../../core/surfaces.js";
import { FurnitureEditor } from "../../core/furniture-editor.js";
import { M } from "../../core/kit.js";
import { presetsFor } from "../_interactions.js";
import meta from "./meta.js";
import { ROOMS } from "./rooms/_index.js";
import { Houses } from "../../core/houses.js";
import { spawnInteriorNPCs, despawnInteriorNPCs } from "../../core/interior-npcs.js";
import { HomeProg } from "../../core/home-prog.js";
import { ANCHORS } from "./rooms/_meta.js";
import { spawnCrimeProps } from "../../core/crimeSetup.js";
import { makeFloorTextures, floorMeshForRoom, trimForSegment, TRIM_MAT, GOLD_MAT,
         chandelier, addPanoramaWindows, addSkyline, addDecor } from "./lagos-style.js";

const WH = 8.0, WC = 0xe6dfd2, OW = 0xd9d0c0, DW = 1.6, WT = .2;
const SEAT_TYPES = { sit: "sit", lie: "lie", toilet: "toilet", swim: "bath" };

export async function buildInterior(router) {
  const LOWQ = Quality.isLow;
  const STARTER = Houses.homeTier() === "starter";
  if (STARTER) {
    const { buildStarterFlat } = await import("./starter-flat.js");
    return buildStarterFlat(router);
  }
  let LOCAL = ROOMS.map(r => Object.assign({}, r));
  if (STARTER) {
    /* compact starter flat: 2 bedrooms + bath + living + kitchen off a short hall */
    const keep = ["bedroomA", "bathA", "bedroomB", "bedroomC", "corridor", "living", "kitchen"];
    LOCAL = LOCAL.filter(r => keep.includes(r.id));
    LOCAL.forEach(r => {
      if (r.id === "corridor") { r.w = 23; r._trimFurniture = true; }
      if (r.id === "bedroomC") { r.w = 6; r.label = "GUEST ROOM"; }
    });
  }

  const three = new THREE.Scene();
  const HOME_STYLE = ({
    starter:   { sky:0x9fc6e8, fog:0x9fc6e8, accent:0x5c91b8, light:0xfff3df },
    urban:     { sky:0xb5c7dc, fog:0xb5c7dc, accent:0x3e78a8, light:0xe9f3ff },
    warm:      { sky:0xd8c1a2, fog:0xd8c1a2, accent:0x9a5e38, light:0xffe4c1 },
    earth:     { sky:0xc8c3a6, fog:0xc8c3a6, accent:0x7b7950, light:0xffedcf },
    royal:     { sky:0xb8b2d4, fog:0xb8b2d4, accent:0x8060a8, light:0xf3e5ff },
    coastal:   { sky:0x9bd2d5, fog:0x9bd2d5, accent:0x36a4ad, light:0xe0ffff },
    estate:    { sky:0xcbbd9f, fog:0xcbbd9f, accent:0xc19a45, light:0xffedc5 },
  })[((Houses.catalog().find(h => h.id === Houses.home()) || {}).style) || "starter"] || { sky:0x9fc6e8, fog:0x9fc6e8, accent:0x5c91b8, light:0xfff3df };
  three.background = new THREE.Color(HOME_STYLE.sky);
  three.fog = new THREE.Fog(HOME_STYLE.fog, 30, 90);

  let mnX = Infinity, mxX = -Infinity, mnZ = Infinity, mxZ = -Infinity;
  LOCAL.forEach(r => { mnX = Math.min(mnX, r.x); mxX = Math.max(mxX, r.x + r.w);
    mnZ = Math.min(mnZ, r.z); mxZ = Math.max(mxZ, r.z + r.d); });
  const cxo = (mnX + mxX) / 2, czo = (mnZ + mxZ) / 2;
  LOCAL.forEach(r => { r.x -= cxo; r.z -= czo; });
  mnX -= cxo; mxX -= cxo; mnZ -= czo; mxZ -= czo;
  const W = mxX - mnX, D = mxZ - mnZ;
  const ent = LOCAL.find(r => r.id === meta.entrance) || LOCAL[0];
  const ecx = ent.x + ent.w / 2, ecz = ent.z + ent.d / 2;

  const cam = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, .08, 220);
  cam.rotation.order = "YXZ";

  three.add(new THREE.HemisphereLight(HOME_STYLE.light, 0x6a6354, LOWQ ? 1.75 : 1.55));
  three.add(new THREE.AmbientLight(0xffffff, LOWQ ? 0.38 : 0.28));
  const sun = new THREE.DirectionalLight(0xfff2dc, LOWQ ? 1.0 : 1.35);
  sun.position.set(14, 32, 12);
  sun.castShadow = !LOWQ;
  if (!LOWQ) {
    sun.shadow.mapSize.set(Quality.isHigh ? 2048 : 1024, Quality.isHigh ? 2048 : 1024);
    Object.assign(sun.shadow.camera, { left: -W, right: W, top: D, bottom: -D, near: 1, far: 150 });
    sun.shadow.camera.updateProjectionMatrix();
  }
  three.add(sun);

  const numLights = LOWQ ? 0 : (Quality.isHigh ? 4 : 2);
  if (numLights > 0) {
    const eligible = LOCAL.filter(r => r.w >= 3 && r.d >= 3);
    const stride = Math.max(1, Math.floor(eligible.length / numLights));
    let made = 0;
    for (let i = 0; i < eligible.length && made < numLights; i += stride, made++) {
      const r = eligible[i];
      const cx = r.x + r.w / 2, cz = r.z + r.d / 2;
      const pl = new THREE.PointLight(0xfff2d6, 0.7, Math.max(r.w, r.d) * 1.5, 2);
      pl.position.set(cx, 3.5, cz); three.add(pl);
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(.2, .24, .05, 10),
        M(0xf7f6f3, 1)
      );
      disc.position.set(cx, WH - .06, cz); three.add(disc);
    }
  }

  const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 3, .3, D + 3), M(0xc9c3b6, .8));
  slab.position.y = -.15; three.add(slab);

  const FLOOR_TEX = makeFloorTextures();
  LOCAL.forEach(r => three.add(floorMeshForRoom(r, FLOOR_TEX, LOWQ)));
  /* Each purchased property receives its own signature lounge finish. */
  const livingForStyle = LOCAL.find(r => r.id === "living");
  if (livingForStyle && !STARTER) {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(7, livingForStyle.w * .58), Math.min(5, livingForStyle.d * .55)),
      new THREE.MeshLambertMaterial({ color: HOME_STYLE.accent }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(livingForStyle.x + livingForStyle.w / 2, .105, livingForStyle.z + livingForStyle.d / 2);
    rug.userData.isDecoration = true; three.add(rug);
    const border = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(7.25, livingForStyle.w * .62), Math.min(5.25, livingForStyle.d * .59)),
      new THREE.MeshLambertMaterial({ color: 0xd4af72 }));
    border.rotation.x = -Math.PI / 2; border.position.copy(rug.position); border.position.y = .09; three.add(border);
    const cx = livingForStyle.x + livingForStyle.w / 2 + Math.min(3.2, livingForStyle.w * .25);
    const cz = livingForStyle.z + livingForStyle.d / 2 - 1.2;
    const solid = (geo, color, x, y, z) => { const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color })); m.position.set(x,y,z); m.userData.isDecoration = true; three.add(m); return m; };
    if (Houses.home() === "studio_plus") {
      solid(new THREE.BoxGeometry(2.2,1.3,.12), 0x172b3b, cx, 1.7, cz - 1.4); // modern media wall
      solid(new THREE.BoxGeometry(2.4,.08,.18), HOME_STYLE.accent, cx, 1.0, cz - 1.3);
    } else if (Houses.home() === "townhouse") {
      solid(new THREE.BoxGeometry(1.9,1.4,.35), 0x6b3825, cx, .8, cz - 1.2); // feature fireplace
      solid(new THREE.BoxGeometry(1.15,.72,.12), 0xffa64d, cx, .72, cz - 1.0);
    } else if (Houses.home() === "bungalow") {
      solid(new THREE.CylinderGeometry(.22,.3,1.5,10), 0x79502d, cx, .8, cz);
      for (let i=0;i<5;i++) { const leaf=solid(new THREE.ConeGeometry(.55,1.25,5), 0x397a43, cx+Math.cos(i*1.25)*.38, 1.65, cz+Math.sin(i*1.25)*.38); leaf.rotation.z=Math.cos(i*1.25)*.5; }
    } else if (Houses.home() === "duplex") {
      for (let i=0;i<4;i++) solid(new THREE.CylinderGeometry(.13,.16,2.8,10), 0xd4af72, cx + i*.48, 1.4, cz - 1.2);
      solid(new THREE.BoxGeometry(2.2,.14,.35), 0x8060a8, cx+.7, 2.85, cz-1.2);
    } else if (Houses.home() === "villa") {
      solid(new THREE.BoxGeometry(2.6,.22,1.4), 0x2e9eae, cx, .22, cz);
      solid(new THREE.BoxGeometry(2.8,.12,1.6), 0xd8f4ed, cx, .1, cz);
    } else if (Houses.home() === "mansion") {
      solid(new THREE.BoxGeometry(2.1,1.8,.18), 0x4a2b18, cx, 1.4, cz - 1.3);
      solid(new THREE.BoxGeometry(1.7,1.35,.08), 0xd4af72, cx, 1.4, cz - 1.18);
    }
  }

  LOCAL.forEach(r => {
    const cx = r.x + r.w / 2, cz = r.z + r.d / 2;
    const _n0 = three.children.length;        /* furniture this room adds (stripped when the home starts empty) */
    if (r._trimFurniture) {
      /* hall furniture is laid out for a 36 m hall: build it as if the hall
         started at the same west end, then drop anything past the short end. */
      const tmp = new THREE.Group();
      r.build(tmp, r.x + 18, cz, WH);
      const lim = r.x + r.w - 0.4;
      tmp.updateMatrixWorld(true);
      [...tmp.children].forEach(c => { if (c.position.x <= lim && !(c.geometry && c.position.x > lim)) three.add(c); });
    } else r.build(three, cx, cz, WH);
    try { HomeProg.stripAdded(three, three.children.slice(_n0), r.id); } catch (e) {}
  });
  const FULL = !HomeProg.empty();               /* existing players keep their furnished home */

  const colliders = [];
  const wm = M(WC, .9);
  const seen = new Set(), edges = [];
  LOCAL.forEach(a => LOCAL.forEach(b => {
    if (a === b) return;
    if (Math.abs((a.x + a.w) - b.x) < .01) {
      const z1 = Math.max(a.z, b.z), z2 = Math.min(a.z + a.d, b.z + b.d);
      if (z2 - z1 > .2) {
        const k = "z|" + (a.x + a.w).toFixed(2) + "|" + z1.toFixed(2) + "|" + z2.toFixed(2);
        if (!seen.has(k)) { seen.add(k); edges.push({ axis: "z", x: a.x + a.w, s: z1, e: z2 }); }
      }
    }
    if (Math.abs((a.z + a.d) - b.z) < .01) {
      const x1 = Math.max(a.x, b.x), x2 = Math.min(a.x + a.w, b.x + b.w);
      if (x2 - x1 > .2) {
        const k = "x|" + (a.z + a.d).toFixed(2) + "|" + x1.toFixed(2) + "|" + x2.toFixed(2);
        if (!seen.has(k)) { seen.add(k); edges.push({ axis: "x", z: a.z + a.d, s: x1, e: x2 }); }
      }
    }
  }));
  const wallGeomsByMat = new Map();
  const trimBag = [], goldBag = [];
  const seg = (ax, fx, s, e, mat) => {
    const ln = e - s; if (ln < .05) return;
    trimForSegment(ax, fx, s, e, WT, WH, trimBag, goldBag);
    const mid = (s + e) / 2;
    let w, d, x, z;
    if (ax === "z") { w = WT; d = ln; x = fx; z = mid; } else { w = ln; d = WT; x = mid; z = fx; }
    const g = new THREE.BoxGeometry(w, WH, d);
    g.translate(x, WH / 2, z);
    if (!wallGeomsByMat.has(mat)) wallGeomsByMat.set(mat, []);
    wallGeomsByMat.get(mat).push(g);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, y0: 0, y1: WH, level: 0 });
  };
  edges.forEach(e => {
    const mid = (e.s + e.e) / 2;
    seg(e.axis, e.axis === "z" ? e.x : e.z, e.s, mid - DW / 2, wm);
    seg(e.axis, e.axis === "z" ? e.x : e.z, mid + DW / 2, e.e, wm);
  });
  const om = M(OW, .9);
  seg("x", mnZ, mnX, mxX, om); seg("z", mnX, mnZ, mxZ, om); seg("z", mxX, mnZ, mxZ, om);
  seg("x", mxZ, mnX, ecx - .9, om); seg("x", mxZ, ecx + .9, mxX, om);

  wallGeomsByMat.forEach((geoms, mat) => {
    const merged = mergeGeometries(geoms, false);
    if (merged) {
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = !LOWQ;
      m.receiveShadow = !LOWQ;
      m.userData.isWall = true;
      three.add(m);
    }
    geoms.forEach(g => g.dispose());
  });

  [[trimBag, TRIM_MAT], [goldBag, GOLD_MAT]].forEach(([list, mat]) => {
    if (!list.length) return;
    const merged = mergeGeometries(list, false);
    if (merged) { const m = new THREE.Mesh(merged, mat); m.userData.isDecoration = true; three.add(m); }
    list.forEach(g => g.dispose());
  });

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W + .6, D + .6),
    new THREE.MeshLambertMaterial({ color: 0xfbf9f6 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, WH, 0); three.add(ceil);

  if (!LOWQ) {
    addPanoramaWindows(three, LOCAL, { mnX, mxX, mnZ, mxZ }, ecx, WT, WH, LOWQ);
  }
  addSkyline(three, W, D, LOWQ);
  addDecor(three, LOCAL, mnX, mxX, mnZ, mxZ, WH);
  /* chandeliers: entry hall (3), living, library, kitchen pendant, master bedroom */
  {
    const room = id => LOCAL.find(r => r.id === id);
    const hall = room("corridor"), liv = room("living"), lib = room("library"), kit = room("kitchen"), ma = room("bedroomA");
    if (hall) [-10, 0, 10].forEach(dx => chandelier(three, hall.x + hall.w / 2 + dx, WH - 1.4, hall.z + hall.d / 2, .9));
    if (liv) chandelier(three, liv.x + liv.w / 2, WH - 1.6, liv.z + liv.d / 2, 1.5);
    if (lib) chandelier(three, lib.x + lib.w / 2, WH - 1.6, lib.z + lib.d / 2, 1.2);
    if (kit) chandelier(three, kit.x + kit.w / 2, WH - 1.4, kit.z + kit.d / 2, 1.0);
    if (ma) chandelier(three, ma.x + ma.w / 2, WH - 1.5, ma.z + ma.d / 2, 1.2);
  }

  const seats = [], uses = [];
  LOCAL.forEach(r => {
    if (!FULL && !/^bath/.test(r.id)) return;   /* empty home: no beds/sofas to use until bought */
    const presets = presetsFor(r.label || "");
    const cx = r.x + r.w / 2, cz = r.z + r.d / 2;
    presets.forEach(p0 => {
      const an = (ANCHORS[r.id] || {})[p0.type];
      const p = an ? Object.assign({}, p0, an) : p0;
      const x = cx + (p.offX || 0), z = cz + (p.offZ || 0);
      const mag = Math.hypot(p.offX || 0, p.offZ || 0) || 1;
      let dx = (p.offX || 0) / mag, dz = (p.offZ || 0) / mag || 1;
      if (an && an.fx != null) { dx = an.fx; dz = an.fz; }
      const seatType = SEAT_TYPES[p.type];
      if (seatType) {
        let _h = p.type === 'lie' ? 0.74 : p.type === 'swim' ? 0.30 : p.type === 'toilet' ? 0.48 : 0.55;
        seats.push({ type: seatType, label: p.label, x, z, dx, dz, yaw: Math.atan2(dx, dz), h: _h, level: 0, taken: false });
      }
      else uses.push({ kind: p.type, label: p.label, x, z, y: 0, level: 0, r: 1.6 });
    });
  });

  /* World matrices must be current BEFORE measuring: furniture lives in
     positioned groups that have never been rendered yet. With stale matrices
     every box landed near the world origin (= the middle of the house) —
     invisible blocks in the hall, while the real furniture had no collider. */
  try { HomeProg.mount(three, LOCAL, seats, uses); } catch (e) { console.warn("[home-prog]", e); }
  three.updateMatrixWorld(true);
  const furnitureMeshes = [];
  three.traverse(o => {
    if (o.visible === false) return;
    for (let p = o.parent; p; p = p.parent) if (p.visible === false) return;
    if (!o.isMesh || !o.geometry) return;
    if (o.userData && o.userData.isDecoration) return;
    if (o.userData && o.userData.isWall) return;
    if (o === slab || o === ceil) return;
    const bb = new THREE.Box3().setFromObject(o);
    if (bb.isEmpty()) return;
    const size = new THREE.Vector3(); bb.getSize(size);
    if (size.y < 0.15) return;
    if (bb.max.y < 0.20) return;
    if (bb.min.y > WH - 0.15) return;
    
    // Prevent giant merged meshes from trapping the player
    if (size.x > 10 || size.z > 10) return; 
    
    if (o.material && Array.isArray(o.material)) return;
    if (o.material && (o.material.transparent || o.material.visible === false || o.material.opacity < 0.3)) return;
    furnitureMeshes.push({ mesh: o, bb });
  });
  for (const { bb } of furnitureMeshes) {
    colliders.push({
      minX: bb.min.x, maxX: bb.max.x,
      minZ: bb.min.z, maxZ: bb.max.z,
      y0: bb.min.y, y1: bb.max.y, level: 0
    });
  }

  const world = { colliders, seats, uses, platforms: [], solidFurniture: true,
    levelHeight: () => 0.12,
    ceilingHeight: WH, 
    bounds: { minX: mnX - 2, maxX: mxX + 2, minZ: mnZ - 2, maxZ: mxZ + 2 } };

  const SPAWN_X = ecx + 2;
  const SPAWN_Z = ecz;
  const SPAWN_YAW = -Math.PI / 2;

  const ctrl = new ThirdPersonControls(cam, router.renderer.domElement, world, {
    scene: three, x: SPAWN_X, z: SPAWN_Z, yaw: SPAWN_YAW, level: 0,
    speedMult: 1.0,
    onUse: (use) => { if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE"); },
  });

  const carries = []; const BG = new THREE.BoxGeometry(1, 1, 1);
  function mk(m, rad, h, x, y, z) {
    const g = new THREE.Group(); g.add(m); g.position.set(x, y, z);
    g.userData.isDecoration = true;
    three.add(g); carries.push({ mesh: g, radius: rad, halfH: h }); return g;
  }
  const rm = id => LOCAL.find(r => r.id === id);
  const lib = rm("library"), liv = rm("living"), cor = rm("corridor");
  if (FULL && lib) [0x8c3b3b, 0x2f5d6b, 0x6b5b2f].forEach((c, i) => {
    const g = new THREE.Group(); const b = new THREE.Mesh(BG, new THREE.MeshLambertMaterial({ color: c }));
    b.scale.set(.2, .28, .06); g.add(b);
    mk(g, .13, .14, lib.x + lib.w / 2 - .4 + i * .3, .92, lib.z + lib.d / 2 - 1.6);
  });
  if (FULL && cor && liv) [{ c: 0x2f6b7a, x: cor.x + cor.w / 2 + 6.3, z: cor.z + cor.d / 2 - 1.58, y: .96 },
   { c: 0xb5623f, x: liv.x + liv.w / 2 - 1.7, z: liv.z + liv.d / 2 - 2.5, y: .68 }].forEach(v => {
    const g = new THREE.Group(); const mt = new THREE.MeshLambertMaterial({ color: v.c });
    const bo = new THREE.Mesh(new THREE.CylinderGeometry(.1, .14, .36, 10), mt);
    const nk = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, .12, 10), mt);
    nk.position.y = .24; g.add(bo, nk); mk(g, .16, .18, v.x, v.y, v.z);
  });
  if (FULL && liv) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.SphereGeometry(.18, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe8b23a }));
    g.add(m); mk(g, .18, .18, liv.x + liv.w / 2 + 2.5, .2, liv.z + liv.d / 2 + .5);
  }
  ctrl.registerCarryables(carries);
  try { HomeProg.mountFamily({ colliders, ctrl }); } catch (e) { console.warn("[home family]", e); }

  try { spawnCrimeProps(three, LOCAL, ctrl, router); }
  catch (e) { console.warn('[crime setup]', e); }

  try {
    Surfaces.clear();
    const cl = id => { const r = rm(id); return [r.x + r.w / 2, r.z + r.d / 2]; };
    const [lx, lz] = cl("living"), [kx, kz] = cl("kitchen"), [bx, bz] = cl("library"), [hx, hz] = cl("corridor");
    Surfaces.register(lx - 3.6, 0.45, lz, 0.8, 1.5, 0);
    Surfaces.register(lx - 1.7, 0.52, lz - 2.5, 0.5, 0.5, 0);
    Surfaces.register(lx + 3.2, 0.78, lz + 6.05, 1.6, 0.6, 0);
    Surfaces.register(kx + .5, 0.78, kz + 2.9, 2.5, 1.2, 0);
    Surfaces.register(kx - 4.52, 0.95, kz - 3.4, 0.7, 4.6, 0);
    Surfaces.register(kx - 3.35, 0.95, kz - 6.05, 2.9, 0.7, 0);
    Surfaces.register(bx + .5, 0.78, bz - 1.6, 3.2, 1.2, 0);
    Surfaces.register(hx + 6.3, 0.81, hz - 1.58, 1.4, 0.45, 0);
  } catch (e) {}

  let editor = null;
  let furnitureBtn = null;
  if (!LOWQ) {
    editor = new FurnitureEditor(three, cam, ctrl, router.renderer.domElement,
      { place: "myhouse",
        onExit: () => { if (editor) editor.disable(); if (furnitureBtn) furnitureBtn.style.display = ""; },
        onReset: () => {} });
    FurnitureEditor.markEditable(three);
    editor.load();

    furnitureBtn = document.createElement("button");
    furnitureBtn.id = "ph3d-furn-btn";
    furnitureBtn.type = "button";
    furnitureBtn.textContent = "ARRANGE";
    furnitureBtn.style.cssText = "cursor:pointer;pointer-events:auto;touch-action:manipulation;";
    furnitureBtn.addEventListener("pointerdown", e => {
      e.preventDefault();
      furnitureBtn.style.display = "none";
      if (editor) editor.enable();
    }, { passive: false });
    document.body.appendChild(furnitureBtn);
  }

  if (!LOWQ) {
    three.traverse(o => {
      if (o.isMesh && !o.userData.isWall) {
        o.castShadow = false;
      }
    });
  }

  try {
    spawnInteriorNPCs(three, "myhouse", {
      aabbs: colliders.map(c => ({ x:(c.minX+c.maxX)/2, z:(c.minZ+c.maxZ)/2, hx:(c.maxX-c.minX)/2, hz:(c.maxZ-c.minZ)/2 })),
      seats, targetCount: STARTER ? 2 : 4, fallback: { x: liv ? liv.x + liv.w/2 : 0, z: liv ? liv.z + liv.d/2 : 0 },
    });
  } catch (e) { console.warn("[home guests]", e); }
  try {
    NpcTalk.mount({
      getPos: () => ({ x: ctrl.pos.x, z: ctrl.pos.z }),
      getYaw: () => ctrl.yaw,
    });
  } catch (e) {}

  const _mhTalkKey = (e) => {
    if (e.code !== "KeyE" || e.repeat) return;
    const npc = NPCs.nearest(ctrl.pos.x, ctrl.pos.z, 2.5);
    if (npc) { NPCs.talk(npc); e.preventDefault(); }
  };
  window.addEventListener("keydown", _mhTalkKey, { capture: true });

  return {
  three, camera: cam, controls: { update: () => {} }, crumb: meta.sub, title: meta.name,
  subtitle: "WALK · SIT · CARRY", hint: "LEFT: MOVE  ·  RIGHT: LOOK  ·  E: SIT / TAKE",
  isInterior: true,
  sceneId: "myhouse",
  getExteriorSceneId: () => "myhouse",
  update: dt => {
    ctrl.update(dt);
    try { HomeProg.tick(dt, ctrl.pos.x, ctrl.pos.z); } catch (e) {}
    try { NpcTalk.tick(dt); } catch (e) {}
  },
  dispose: () => {
    window.removeEventListener("keydown", _mhTalkKey, { capture: true });
    try { NpcTalk.unmount(); } catch (e) {}
    try { HomeProg.dispose(); } catch (e) {}
    try { despawnInteriorNPCs(); } catch (e) {}
    ctrl.dispose();
    try { if (editor) editor.disable(); } catch (e) {}
    const fb = document.getElementById("ph3d-furn-btn"); fb && fb.remove();
  }
};
}
