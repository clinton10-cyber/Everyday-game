import * as THREE from "three";
import { ThirdPersonControls } from "../core/thirdperson.js";
import { PLACES } from "../core/registry.js";
import { NPCs } from "../core/npcs.js";
import { NpcTalk } from "../core/npc-talk.js";

/* Which people hang around outside each kind of place (rest are pedestrians). */
const EXTERIOR_CAST = {
  hospital:    ["doctor", "doctor", "walker"],
  church:      ["priest", "walker", "walker"],
  mosque:      ["priest", "walker", "walker"],
  vatican:     ["priest", "priest", "walker"],
  market:      ["trader", "trader", "trader", "walker"],
  statehouse:  ["police", "police", "walker"],
  governor:    ["police", "police", "walker"],
  govhouse:    ["police", "police", "walker"],
  statejail:   ["warden", "police", "police"],
  prison:      ["warden", "police", "police"],
  airport:     ["taxi", "taxi", "walker"],
  hotel:       ["taxi", "walker", "walker"],
  showroom:    ["mechanic", "walker", "trader"],
  jobcenter:   ["banker", "walker", "walker"],
  realestate:  ["banker", "walker", "walker"],
};

export async function buildExterior(router, params) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbcd8f0);
  scene.fog = new THREE.Fog(0xbcd8f0, 40, 150);

  const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.08, 300);
  camera.rotation.order = "YXZ";

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a6354, 1.2));
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const sun = new THREE.DirectionalLight(0xfff2dc, 1.0);
  sun.position.set(20, 40, 20);
  scene.add(sun);

  // Ground plaza
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(80, 32), new THREE.MeshLambertMaterial({ color: 0x5c8a44 }));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = -0.02;
  scene.add(lawn);

  const plaza = new THREE.Mesh(new THREE.CircleGeometry(35, 24), new THREE.MeshLambertMaterial({ color: 0xb8b0a4 }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0;
  scene.add(plaza);

  // Fetch the meta data for the building we are outside of
  const thunk = PLACES[params.id] && PLACES[params.id].meta;
  let meta = { name: "BUILDING", sub: "" };
  if (thunk) {
    const m = await thunk();
    meta = m.default || m;
  }

  // Load the building exterior mesh dynamically
  let building = new THREE.Group();
  let buildingBounds = { minX: -15, maxX: 15, minZ: -15, maxZ: 15 };
  let doorZ = 0;

  try {
    if (PLACES[params.id] && PLACES[params.id].exterior) {
      const extMod = await PLACES[params.id].exterior();
      if (extMod && extMod.buildExterior) {
        building = extMod.buildExterior();
        
        // Scale the building up to real-world size
        building.scale.set(4, 4, 4); 
        scene.add(building);
        
        // Compute bounding box to find the exact front of this specific building
        const bbox = new THREE.Box3().setFromObject(building);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        
        // Center the building on X axis, and place its back near Z = -30
        building.position.x -= center.x;
        building.position.z -= bbox.max.z + 30; 
        
        building.updateMatrixWorld(true);
        const newBbox = new THREE.Box3().setFromObject(building);
        
        // The door is placed exactly at the front face of the building's mesh
        doorZ = newBbox.max.z; 
        
        buildingBounds = {
          minX: newBbox.min.x, maxX: newBbox.max.x,
          minZ: newBbox.min.z, maxZ: newBbox.max.z
        };
      }
    }
  } catch(e) { console.warn("[exterior] failed to load building mesh", e); }

  // If building failed to load, use a fallback door position
  if (doorZ === 0) doorZ = -15;

  // Add a visible doorway at the exact front of the building
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1e });
  const doorFrameMat = new THREE.MeshLambertMaterial({ color: 0x2a1a0a });
  
  const door = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 0.5), doorMat);
  door.position.set(0, 3, doorZ + 0.2);
  scene.add(door);
  
  const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6.5, 1.0), doorFrameMat);
  frameLeft.position.set(-2.3, 3.25, doorZ + 0.2);
  scene.add(frameLeft);
  
  const frameRight = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6.5, 1.0), doorFrameMat);
  frameRight.position.set(2.3, 3.25, doorZ + 0.2);
  scene.add(frameRight);
  
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.6, 1.0), doorFrameMat);
  frameTop.position.set(0, 6.55, doorZ + 0.2);
  scene.add(frameTop);

  // Glowing entry ring on the ground
  const entryRing = new THREE.Mesh(
    new THREE.RingGeometry(3.5, 4.0, 32),
    new THREE.MeshBasicMaterial({ color: 0x5ee0ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
  );
  entryRing.rotation.x = -Math.PI / 2;
  entryRing.position.set(0, 0.05, doorZ + 1);
  scene.add(entryRing);

  const colliders = [
    // Building body collision (blocks the player from walking through the walls)
    { minX: buildingBounds.minX, maxX: buildingBounds.maxX, minZ: buildingBounds.minZ, maxZ: buildingBounds.maxZ, y0: 0, y1: 40, level: 0 },
    // Ground boundary collisions
    { minX: -80, maxX: -79, minZ: -80, maxZ: 80, y0: 0, y1: 20, level: 0 },
    { minX: 79, maxX: 80, minZ: -80, maxZ: 80, y0: 0, y1: 20, level: 0 },
    { minX: -80, maxX: 80, minZ: 79, maxZ: 80, y0: 0, y1: 20, level: 0 },
    { minX: -80, maxX: 80, minZ: -80, maxZ: -79, y0: 0, y1: 20, level: 0 },
  ];

  // Enter trigger located right at the doorway
  const uses = [
    { kind: "use", label: "ENTER " + meta.name, x: 0, z: doorZ, y: 0, level: 0, r: 4.5 }
  ];

  const world = {
    colliders, seats: [], uses, platforms: [],
    levelHeight: () => 0,
    ceilingHeight: 100,
    bounds: { minX: -75, maxX: 75, minZ: -75, maxZ: 75 }
  };

  // Spawn the player exactly 25 units in front of the door
  const spawnZ = doorZ + 25;

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, world, {
    scene, x: 0, z: spawnZ, yaw: Math.PI, level: 0,
    onUse: (use) => {
      if (use.label.startsWith("ENTER")) {
        router.go("interior", { id: params.id, parent: params.parent });
      }
    },
  });

  /* ── NPCs: people milling about the plaza ──────────────────────────
     AABB format used by NPCs: { x, z, hx, hz } (centre + half-extents). */
  const npcBoxes = [{
    x: (buildingBounds.minX + buildingBounds.maxX) / 2, z: (buildingBounds.minZ + buildingBounds.maxZ) / 2,
    hx: (buildingBounds.maxX - buildingBounds.minX) / 2, hz: (buildingBounds.maxZ - buildingBounds.minZ) / 2,
  }];
  const _wc = () => window.__ph3d_walkCtrl || ctl;
  let _talkKey = null;
  try {
    NPCs.despawn();
    NPCs.setScene(scene);
    NPCs.setAABBs(npcBoxes);
    NPCs.setSeats([]);
    const cast = (EXTERIOR_CAST[params.id] || []).slice();
    const COUNT = 12;
    while (cast.length < COUNT) cast.push("walker");
    let seed = 0; for (const ch of String(params.id)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const pad = 3;
    cast.forEach((role, i) => {
      let x = 0, z = 0, ok = false;
      for (let tries = 0; tries < 30 && !ok; tries++) {
        x = (rand() * 2 - 1) * 30;
        z = doorZ + 7 + rand() * 38;                       /* in front of the building */
        const inBuilding = x > buildingBounds.minX - pad && x < buildingBounds.maxX + pad &&
                           z > buildingBounds.minZ - pad && z < buildingBounds.maxZ + pad;
        const onDoor = Math.abs(x) < 5.5 && z < doorZ + 7;   /* keep the entrance clear */
        const nearSpawn = Math.hypot(x, z - spawnZ) < 5;
        ok = !inBuilding && !onDoor && !nearSpawn && Math.hypot(x, z) < 70;
      }
      const npc = NPCs.spawnRole(scene, role, x, z, { aabbs: npcBoxes });
      if (npc) { npc.maxDist = 140; npc._exteriorPlace = params.id; }
    });
    NpcTalk.mount({
      getPos: () => { const c = _wc(); return c ? { x: c.pos.x, z: c.pos.z } : null; },
      getYaw: () => { const c = _wc(); return c ? c.yaw : 0; },
    });
    _talkKey = (e) => {
      if (e.code !== "KeyE" || e.repeat) return;
      const c = _wc(); if (!c) return;
      const npc = NPCs.nearest(c.pos.x, c.pos.z, 2.5);
      if (npc) { NPCs.talk(npc); e.preventDefault(); }
    };
    window.addEventListener("keydown", _talkKey, { capture: true });
  } catch (e) { console.warn("[exterior] NPC spawn failed", e); }

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: meta.sub || "EXTERIOR",
    title: meta.name,
    subtitle: "OUTSIDE",
    hint: "WALK TO THE DOOR TO ENTER",
    isInterior: true, 
    sceneId: params.id,
    update: (dt) => {
      ctl.update(dt);
      try {
        NPCs.tick(dt, ctl.pos.x, ctl.pos.z);
        NPCs.unstickAll(npcBoxes);
        NpcTalk.tick(dt);
      } catch (e) {}
    },
    dispose: () => {
      try { if (_talkKey) window.removeEventListener("keydown", _talkKey, { capture: true }); } catch (e) {}
      try { NpcTalk.unmount(); } catch (e) {}
      try { NPCs.despawn(); } catch (e) {}
      ctl.dispose();
    },
  };
}
