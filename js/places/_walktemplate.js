/* _walktemplate.js -- shared THIRD-PERSON interior builder.
   v7: Raised ceiling to 8m and added ceiling clamp. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Quality } from "../core/quality.js";
import { ThirdPersonControls } from "../core/thirdperson.js";
import { presetsFor } from "./_interactions.js";
import { NPCs } from "../core/npcs.js";
import { NpcTalk } from "../core/npc-talk.js";

const WALL_T = 0.18;
const DOOR_W = 1.8;
const SCALE = 1.6; 

const SEAT_TYPES = { sit: "sit", lie: "lie", toilet: "toilet", swim: "bath" };

export async function buildWalkInterior(router, RAW_ROOMS, opts) {
  opts = opts || {};
  const wallColor  = opts.wallColor  != null ? opts.wallColor  : 0xefe9df;
  const outerColor = opts.outerColor != null ? opts.outerColor : 0x9a9aa2;
  
  const WH = 8.0; // Extremely high ceiling

  const R = RAW_ROOMS.map(r => {
    const c = Object.assign({}, r);
    c.x *= SCALE; c.z *= SCALE; c.w *= SCALE; c.d *= SCALE;
    return c;
  });

  let mnX = Infinity, mxX = -Infinity, mnZ = Infinity, mxZ = -Infinity;
  R.forEach(r => {
    mnX = Math.min(mnX, r.x); mxX = Math.max(mxX, r.x + r.w);
    mnZ = Math.min(mnZ, r.z); mxZ = Math.max(mxZ, r.z + r.d);
  });
  const cxo = (mnX + mxX) / 2, czo = (mnZ + mxZ) / 2;
  R.forEach(r => { r.x -= cxo; r.z -= czo; });
  mnX -= cxo; mxX -= cxo; mnZ -= czo; mxZ -= czo;
  const W = mxX - mnX, D = mxZ - mnZ;

  let ent = R[0];
  if (opts.firstRoomId) {
    const f = R.find(r => r.id === opts.firstRoomId);
    if (f) ent = f;
  }
  const ecx = ent.x + ent.w / 2, ecz = ent.z + ent.d / 2;

  const three = new THREE.Scene();
  three.background = new THREE.Color(opts.bgColor != null ? opts.bgColor : 0x9db6d0);
  three.fog = new THREE.Fog(three.background.getHex(), 60, 200);

  const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.08, 400);
  camera.rotation.order = "YXZ";

  three.add(new THREE.AmbientLight(0xffffff, 0.55));
  three.add(new THREE.HemisphereLight(0xffffff, 0x808080, 0.85));
  const sun = new THREE.DirectionalLight(0xfff0d2, 0.6);
  sun.position.set(30, 60, 30);
  three.add(sun);

  R.forEach(r => {
    if (r.w < 3 || r.d < 3) return;
    if (Quality.current.lightsPerRoom === 0) return;
    const cx = r.x + r.w / 2, cz = r.z + r.d / 2;
    const pl = new THREE.PointLight(0xffe8c8, 0.6, Math.max(r.w, r.d) * 1.6, 2);
    pl.position.set(cx, 3.5, cz); 
    three.add(pl);
  });

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(W + 6, 0.4, D + 6),
    new THREE.MeshLambertMaterial({ color: 0x3a4a3a }));
  slab.position.set(0, -0.2, 0);
  three.add(slab);

  const floorGeomsByColor = new Map();
  R.forEach(r => {
    const cx = r.x + r.w / 2, cz = r.z + r.d / 2;
    const color = r.floor != null ? r.floor : 0xd8d8d8;
    const g = new THREE.BoxGeometry(r.w - 0.2, 0.15, r.d - 0.2);
    g.translate(cx, 0.08, cz);
    if (!floorGeomsByColor.has(color)) floorGeomsByColor.set(color, []);
    floorGeomsByColor.get(color).push(g);
    
    if (typeof r.build === "function") r.build(three, cx, cz, WH); 
  });
  
  floorGeomsByColor.forEach((geoms, color) => {
    const merged = mergeGeometries(geoms, false);
    const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color }));
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    three.add(mesh);
  });

  const wm = new THREE.MeshLambertMaterial({ color: wallColor });
  const om = new THREE.MeshLambertMaterial({ color: outerColor });
  const colliders = [];
  const innerGeoms = [], outerGeoms = [];

  const seg = (ax, fx, s, e, isOuter) => {
    const ln = e - s;
    if (ln < 0.05) return;
    const mid = (s + e) / 2;
    let w, d, x, z;
    if (ax === "z") { w = WALL_T; d = ln; x = fx; z = mid; }
    else            { w = ln; d = WALL_T; x = mid; z = fx; }
    const g = new THREE.BoxGeometry(w, WH, d);
    g.translate(x, WH / 2, z);
    (isOuter ? outerGeoms : innerGeoms).push(g);
    colliders.push({
      minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2,
      y0: 0, y1: WH, level: 0,
    });
  };

  const seen = new Set(), edges = [];
  R.forEach(a => R.forEach(b => {
    if (a === b) return;
    if (Math.abs((a.x + a.w) - b.x) < 0.01) {
      const z1 = Math.max(a.z, b.z), z2 = Math.min(a.z + a.d, b.z + b.d);
      if (z2 - z1 > 0.2) {
        const k = "z|" + (a.x + a.w).toFixed(2) + "|" + z1.toFixed(2) + "|" + z2.toFixed(2);
        if (!seen.has(k)) { seen.add(k); edges.push({ axis:"z", x:a.x+a.w, s:z1, e:z2 }); }
      }
    }
    if (Math.abs((a.z + a.d) - b.z) < 0.01) {
      const x1 = Math.max(a.x, b.x), x2 = Math.min(a.x + a.w, b.x + b.w);
      if (x2 - x1 > 0.2) {
        const k = "x|" + (a.z + a.d).toFixed(2) + "|" + x1.toFixed(2) + "|" + x2.toFixed(2);
        if (!seen.has(k)) { seen.add(k); edges.push({ axis:"x", z:a.z+a.d, s:x1, e:x2 }); }
      }
    }
  }));

  edges.forEach(e => {
    const mid = (e.s + e.e) / 2;
    seg(e.axis, e.axis === "z" ? e.x : e.z, e.s, mid - DOOR_W / 2, false);
    seg(e.axis, e.axis === "z" ? e.x : e.z, mid + DOOR_W / 2, e.e, false);
  });

  seg("x", mnZ, mnX, mxX, true);
  seg("z", mnX, mnZ, mxZ, true);
  seg("z", mxX, mnZ, mxZ, true);
  seg("x", mxZ, mnX, ecx - 0.9, true);
  seg("x", mxZ, ecx + 0.9, mxX, true);

  if (innerGeoms.length) {
    const mesh = new THREE.Mesh(mergeGeometries(innerGeoms, false), wm);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.userData.isWall = true;
    three.add(mesh);
  }
  if (outerGeoms.length) {
    const mesh = new THREE.Mesh(mergeGeometries(outerGeoms, false), om);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.userData.isWall = true;
    three.add(mesh);
  }

  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 0.6, D + 0.6),
    new THREE.MeshLambertMaterial({ color: 0xfbf9f6 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, WH, 0);
  three.add(ceil);

  const seats = [], uses = [];
  
  R.forEach(r => {
    const presets = presetsFor(r.label || "");
    const cx = r.x + r.w / 2, cz = r.z + r.d / 2;
    presets.forEach(p => {
      const x = cx + (p.offX || 0) * SCALE;
      const z = cz + (p.offZ || 0) * SCALE;
      const mag = Math.hypot(p.offX || 0, p.offZ || 0) || 1;
      const dx = (p.offX || 0) / mag, dz = (p.offZ || 0) / mag || 1;
      const seatType = SEAT_TYPES[p.type];
      if (seatType) {
        let _h = p.type === 'lie' ? 0.74 : p.type === 'swim' ? 0.30 : p.type === 'toilet' ? 0.48 : 0.55;
        seats.push({ type: seatType, label: p.label, x, z, dx, dz, yaw: Math.atan2(dx, dz), h: _h, level: 0, taken: false });
      } else {
        uses.push({ kind: p.type, label: p.label, x, z, y: 0, level: 0, r: 1.6 * SCALE });
      }
    });
  });

  (opts.seats || []).forEach(s => seats.push(s));
  (opts.uses  || []).forEach(u => uses.push(u));

  if (three.userData && three.userData.interactions) {
    colliders.push(...three.userData.interactions.colliders);
    seats.push(...three.userData.interactions.seats);
    uses.push(...three.userData.interactions.uses);
  }

  /* Make world matrices current first — otherwise furniture inside positioned
     groups is measured at the world origin (invisible blocks in the middle of
     the room, with no collider where the furniture really is). */
  three.updateMatrixWorld(true);
  const furnitureMeshes = [];
  three.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    if (o.visible === false) return;
    for (let p = o.parent; p; p = p.parent) if (p.visible === false) return;
    if (o.userData && o.userData.isWall) return;
    if (o === slab || o === ceil) return;
    if (o.userData && o.userData.isDecoration) return;
    const bb = new THREE.Box3().setFromObject(o);
    if (bb.isEmpty()) return;
    const size = new THREE.Vector3(); bb.getSize(size);
    if (size.y < 0.15) return;
    if (bb.max.y < 0.20) return;
    if (bb.min.y > WH - 0.15) return;
    if (o.material && Array.isArray(o.material)) return;
    if (size.x > 10 || size.z > 10) return;   /* merged mega-meshes would trap the player */
    if (o.material && (o.material.transparent || o.material.visible === false || o.material.opacity < 0.3)) return;
    furnitureMeshes.push(bb);
  });
  
  for (const bb of furnitureMeshes) {
    colliders.push({
      minX: bb.min.x, maxX: bb.max.x,
      minZ: bb.min.z, maxZ: bb.max.z,
      y0: bb.min.y, y1: bb.max.y, level: 0
    });
  }

  const world = { 
    colliders, seats, uses, platforms: [],
    levelHeight: () => 0.12,
    ceilingHeight: WH, // <--- Stops camera crossing the ceiling
    bounds: { minX: mnX - 2, maxX: mxX + 2, minZ: mnZ - 2, maxZ: mxZ + 2 } 
  };

  const SPAWN_X = ecx;
  const SPAWN_Z = mxZ - 1.5 * SCALE;
  const SPAWN_YAW = Math.PI;

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, world, {
    scene: three,
    x: SPAWN_X, z: SPAWN_Z, yaw: SPAWN_YAW, level: 0,
    interactables: opts.interactables || [],
    speedMult: 1.2,
    onUse: (use) => {
      if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE");
    },
  });

  try {
    NpcTalk.mount({
      getPos: () => ({ x: ctl.pos.x, z: ctl.pos.z }),
      getYaw: () => ctl.yaw,
    });
  } catch (e) {}

  const _wtTalkKey = (e) => {
    if (e.code !== "KeyE" || e.repeat) return;
    const npc = NPCs.nearest(ctl.pos.x, ctl.pos.z, 2.5);
    if (npc) { NPCs.talk(npc); e.preventDefault(); }
  };
  window.addEventListener("keydown", _wtTalkKey, { capture: true });

  return {
  three, camera,
  controls: { update: () => {} },
  crumb: opts.crumb || "",
  title: opts.title || ent.label || "",
  subtitle: opts.subtitle || "",
  hint: opts.hint || "LEFT: MOVE \u00B7 RIGHT: LOOK \u00B7 E: INTERACT",
  isInterior: true,
  sceneId: opts.crumb ? opts.crumb.toLowerCase().replace(/\s+/g, '') : "interior",
  update: (dt) => {
    ctl.update(dt);
    try { NpcTalk.tick(dt); } catch (e) {}
  },
  dispose: () => {
    window.removeEventListener("keydown", _wtTalkKey, { capture: true });
    try { NpcTalk.unmount(); } catch (e) {}
    ctl.dispose();
  },
};
}
