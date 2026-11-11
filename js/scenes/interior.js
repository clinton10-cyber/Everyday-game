/* ════════════════════════════════════════════════════════════════
   interior.js — dispatcher for every landmark interior.
   Also places role NPCs from interior-npcs.js.
   ════════════════════════════════════════════════════════════════ */

import * as THREE from "three";
import { PLACES } from "../core/registry.js";
import { ThirdPersonControls } from "../core/thirdperson.js";
import { NPCs } from "../core/npcs.js";
import { NpcTalk } from "../core/npc-talk.js";
import { Sfx } from "../core/sfx.js";

export async function interiorScene(params, router) {
  const { id, parent } = params;

  let scene = null;
  let loadError = null;

  /* Clean up any interior NPCs from a previous scene. */
  try {
    const { despawnInteriorNPCs } = await import("../core/interior-npcs.js");
    despawnInteriorNPCs();
  } catch (e) {}

  /* Also clean the NPC list so role NPCs from the previous
     interior don't leak into the next one. */
  try { NPCs.despawn(); } catch (e) {}

  let thunk = PLACES[id] && PLACES[id].interior;
  if (!thunk && parent && PLACES[parent] && PLACES[parent][id]) {
    thunk = PLACES[parent][id].interior;
  }
  /* No (or wrong) parent passed: find the child under whichever parent owns it. */
  if (!thunk) {
    for (const pk of Object.keys(PLACES)) {
      const c = PLACES[pk] && PLACES[pk][id];
      if (c && typeof c === "object" && c.interior) { thunk = c.interior; break; }
    }
  }

  if (!thunk) {
    return fallbackScene(
      router,
      "NO INTERIOR",
      "This building doesn't have a walkable interior yet.",
      id
    );
  }

  try {
    const mod = await thunk();
    scene = await buildFromModule(mod, params, router);
  } catch (e) {
    loadError = e;
    console.error("[interior] failed for '" + id + "':", e);
  }

  if (!scene) {
    return fallbackScene(
      router,
      "COULDN'T LOAD",
      (loadError && loadError.message) || "The interior failed to open.",
      id
    );
  }

  /* ── Extract the real colliders from the walk controls ─── */
  let sceneAABBs = [];
  try {
    const wc = window.__ph3d_walkCtrl;
    if (wc && wc.world && Array.isArray(wc.world.colliders)) {
      sceneAABBs = wc.world.colliders
        .filter(c => c && typeof c.minX === "number" && typeof c.maxX === "number")
        .map(c => ({
          x:  (c.minX + c.maxX) * 0.5,
          z:  (c.minZ + c.maxZ) * 0.5,
          hx: (c.maxX - c.minX) * 0.5,
          hz: (c.maxZ - c.minZ) * 0.5,
        }));
    }
    if (!sceneAABBs.length) {
      console.warn("[interior] no colliders found for '" + id + "' — NPCs will not avoid walls");
    }
  } catch (e) {
    console.warn("[interior] collider extraction failed:", e);
  }

  /* Read floor height from the walk controller (0 for most interiors). */
  let floorY = 0;
  try {
    const wc = window.__ph3d_walkCtrl;
    if (wc && typeof wc.floorY === "number") floorY = wc.floorY;
  } catch (e) {}

  /* ── Wire weapons + emotes into the ThirdPersonControls ── */
  try {
    const ctl = window.__ph3d_walkCtrl;
    if (ctl && ctl.weapons) {
      ctl._parity = true;   // this scene wires weapons/actions itself
      ctl.opts = ctl.opts || {};

      /* Give the Weapons system real targets (the interior's own NPCs). */
      ctl.opts.getTargets = () => {
        try { return NPCs.targets(ctl.pos.x, ctl.pos.z, 80); }
        catch (e) { return []; }
      };

      /* React to shots — same behaviour drive.js wires into walker.opts. */
      ctl.opts.onGunFire = () => {
        try { NPCs.scare(ctl.pos.x, ctl.pos.z, 15); } catch (e) {}
        try {
          const S = window.__ph3d_social;
          if (S && S.onCrime) S.onCrime(ctl.pos.x, ctl.pos.z, "gun");
        } catch (e) {}
      };
      ctl.opts.onKnifeStab = () => {
        try { NPCs.scare(ctl.pos.x, ctl.pos.z, 10); } catch (e) {}
        try {
          const S = window.__ph3d_social;
          if (S && S.onCrime) S.onCrime(ctl.pos.x, ctl.pos.z, "knife");
        } catch (e) {}
      };

      /* Walker shim so WalkActions can drive the ThirdPersonControls
         exactly as it drives the drive.js walker. */
      const walkerShim = {
        get x()           { return ctl.pos.x; },
        get z()           { return ctl.pos.z; },
        get y()           { return ctl.floorY; },
        get sitting()     { return ctl.state !== "standing" && ctl.state !== "crouching"; },
        get ragdoll()     { return false; },
        get onGround()    { return ctl.onGround !== false; },
        get _emoteName()  { return ctl._emoteName; },
        set _emoteName(v) { ctl._emoteName = v; },
        get _emoteTimer() { return ctl._emoteTimer; },
        set _emoteTimer(v){ ctl._emoteTimer = v; },
        get _emotePhase() { return ctl._emotePhase; },
        set _emotePhase(v){ ctl._emotePhase = v; },
        _ul: () => { try { ctl._ul && ctl._ul(); } catch (e) {} },
      };

      const mod = await import("../core/walk-actions.js");
      const WA = mod.WalkActions;
      WA.mount({
        walker: walkerShim,
        weapons: ctl.weapons,
        getMode: () => "walk",
      });

      /* Chain update + dispose so WalkActions gets its tick and cleanup. */
      const baseUpdate2 = scene.update || (() => {});
      scene.update = function (dt, t) {
        baseUpdate2.call(this, dt, t);
        try { WA.tick(dt, ctl.moving ? 4.6 : 0); } catch (e) {}
      };
      const baseDispose2 = scene.dispose || (() => {});
      scene.dispose = function () {
        try { WA.unmount(); } catch (e) {}
        baseDispose2.call(this);
      };

      console.log(
        "%c[interior] weapons + emotes wired",
        "background:#ffcc5e;color:#2a1400;font-weight:bold;padding:2px 6px;border-radius:4px",
        id
      );
    }
  } catch (e) {
    console.warn("[interior] weapons wiring failed:", e);
  }

  try {
    const { spawnInteriorNPCs } = await import("../core/interior-npcs.js");

    const _wc = window.__ph3d_walkCtrl;
    try { NPCs.setTerrain(_wc && _wc.world && _wc.world.groundAt, _wc && _wc.world && _wc.world.bounds); } catch (e) {}
    const _seats = (_wc && _wc.world && _wc.world.seats) || [];
    spawnInteriorNPCs(scene.three, id, {
      aabbs: sceneAABBs,
      seats: _seats,
      targetCount: id === "statejail" ? 0 : undefined,
      yOffset: floorY,
      fallback: { role: "walker", x: 2, z: 2 },
    });

    /* Mount TALK button */
    const _wc2 = window.__ph3d_walkCtrl;
    try {
      NpcTalk.mount({
        getPos: () => _wc2 ? { x: _wc2.pos.x, z: _wc2.pos.z } : null,
        getYaw: () => _wc2 ? _wc2.yaw : 0,
      });
    } catch (e) {}

    /* E key → talk first, then default handler */
    const talkKeyHandler = (e) => {
      if (e.code !== "KeyE" || e.repeat) return;
      if (!_wc2) return;
      const npc = NPCs.nearest(_wc2.pos.x, _wc2.pos.z, 2.5);
      if (npc) { NPCs.talk(npc); e.preventDefault(); }
    };
    window.addEventListener("keydown", talkKeyHandler, { capture: true });

    const baseUpdate = scene.update || (() => {});
    scene.update = function (dt, t) {
      baseUpdate.call(this, dt, t);
      try {
        const px = _wc2 ? _wc2.pos.x : 0;
        const pz = _wc2 ? _wc2.pos.z : 0;
        NPCs.tick(dt, px, pz);
        if (sceneAABBs.length) NPCs.unstickAll(sceneAABBs);
        NpcTalk.tick(dt);
      } catch (e) {}
    };

    const baseDispose = scene.dispose || (() => {});
    scene.dispose = function () {
      window.removeEventListener("keydown", talkKeyHandler, { capture: true });
      try { NpcTalk.unmount(); } catch (e) {}
      baseDispose.call(this);
      try { NPCs.despawn(); } catch (e) {}
    };
  } catch (e) {
    console.warn("[interior] NPC spawn failed:", e);
  }


  return scene;
}

async function buildFromModule(mod, params, router) {
  if (!mod) return null;

  if (typeof mod.buildInterior === "function") {
    return await mod.buildInterior(router);
  }

  if (typeof mod.default === "function") {
    return await mod.default(params, router);
  }

  if (mod.default && typeof mod.default === "object") {
    if (typeof mod.default.buildInterior === "function") {
      return await mod.default.buildInterior(router);
    }
    if (typeof mod.default.build === "function") {
      return await mod.default.build(router);
    }
  }

  const names = Object.keys(mod);
  for (const n of names) {
    if (n === "default") continue;
    if (typeof mod[n] === "function") {
      try {
        const r = await mod[n](params, router);
        if (r && r.three && r.camera) return r;
      } catch (e) {}
    }
  }

  return null;
}

function fallbackScene(router, title, message, id) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ea0b0);
  scene.fog = new THREE.Fog(0x8ea0b0, 12, 40);

  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.06, 120);
  camera.rotation.order = "YXZ";

  scene.add(new THREE.HemisphereLight(0xffffff, 0x4a4a52, 1.2));
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  const sun = new THREE.DirectionalLight(0xfff0dd, 0.6);
  sun.position.set(6, 12, 4);
  scene.add(sun);

  const W = 10, D = 10, H = 4;
  const wallMat  = new THREE.MeshLambertMaterial({ color: 0xd8d4c8 });
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x6a5a4a });
  const ceilMat  = new THREE.MeshLambertMaterial({ color: 0xece8e0 });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.15, D), floorMat);
  floor.position.set(0, 0.075, 0);
  scene.add(floor);

  const ceil = new THREE.Mesh(new THREE.BoxGeometry(W, 0.15, D), ceilMat);
  ceil.position.set(0, H - 0.075, 0);
  scene.add(ceil);

  const mkWall = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallMat);
    m.position.set(x, H / 2, z);
    scene.add(m);
  };
  mkWall(W, 0.2, 0, -D / 2);
  mkWall(W, 0.2, 0,  D / 2);
  mkWall(0.2, D, -W / 2, 0);
  mkWall(0.2, D,  W / 2, 0);

  const cv = document.createElement("canvas");
  cv.width = 1024; cv.height = 512;
  const g = cv.getContext("2d");
  g.fillStyle = "#0d1420"; g.fillRect(0, 0, 1024, 512);
  g.strokeStyle = "#5ee0ff"; g.lineWidth = 8;
  g.strokeRect(12, 12, 1000, 488);
  g.fillStyle = "#5ee0ff";
  g.font = "900 76px Inter, sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(title, 512, 140);
  g.fillStyle = "#eaf6ff";
  g.font = "500 34px Inter, sans-serif";
  const words = String(message || "").split(" ");
  let line = "", y = 240;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (g.measureText(test).width > 920) {
      g.fillText(line, 512, y);
      y += 46; line = w;
    } else line = test;
  }
  if (line) g.fillText(line, 512, y);
  g.fillStyle = "#9db0a6";
  g.font = "600 22px Inter, sans-serif";
  g.fillText("ID: " + id, 512, 460);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 4),
    new THREE.MeshBasicMaterial({ map: tex })
  );
  sign.position.set(0, 2.2, -D / 2 + 0.11);
  scene.add(sign);

  const colliders = [
    { minX: -W / 2, maxX: -W / 2 + 0.2, minZ: -D / 2, maxZ: D / 2, y0: 0, y1: H, level: 0 },
    { minX:  W / 2 - 0.2, maxX: W / 2,  minZ: -D / 2, maxZ: D / 2, y0: 0, y1: H, level: 0 },
    { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: -D / 2 + 0.2, y0: 0, y1: H, level: 0 },
    { minX: -W / 2, maxX: W / 2, minZ:  D / 2 - 0.2, maxZ: D / 2, y0: 0, y1: H, level: 0 },
  ];
  const world = {
    colliders,
    seats: [],
    uses: [
      { kind: "leave", label: "LEAVE ROOM", x: 0, z: 3.5, y: 0, level: 0, r: 1.6 },
    ],
    platforms: [],
    levelHeight: () => 0,
    ceilingHeight: H,
    bounds: { minX: -W / 2 + 0.4, maxX: W / 2 - 0.4, minZ: -D / 2 + 0.4, maxZ: D / 2 - 0.4 },
  };

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, world, {
    scene,
    x: 0, z: 3.5, yaw: Math.PI, level: 0,
    speedMult: 1.0,
    onUse: (use) => {
      if (use.kind === "leave") {
        try { router.go("city"); } catch (e) {}
      } else if (window.__ph3d_phone) {
        window.__ph3d_phone._toast(use.label || "USE");
      }
    },
  });

  /* Fallback room also gets a single walker so it's not empty */
  try {
    const { spawnInteriorNPCs } = require ? null : null;
  } catch (e) {}
  setTimeout(async () => {
    try {
      const { spawnInteriorNPCs } = await import("../core/interior-npcs.js");
      spawnInteriorNPCs(scene, "__fallback__", {
        fallback: { role: "walker", x: 0, z: 1 },
      });
    } catch (e) {}
  }, 100);

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "INTERIOR",
    title,
    subtitle: "FALLBACK ROOM",
    hint: "",
    isInterior: true,
    sceneId: id || "fallback",
    update: (dt) => {
      ctl.update(dt);
      try {
        const px = window.__ph3d_walkCtrl ? window.__ph3d_walkCtrl.pos.x : 0;
        const pz = window.__ph3d_walkCtrl ? window.__ph3d_walkCtrl.pos.z : 0;
        NPCs.tick(dt, px, pz);
      } catch (e) {}
    },
    dispose: () => {
      ctl.dispose();
      try { NPCs.despawn(); } catch (e) {}
    },
  };
}
