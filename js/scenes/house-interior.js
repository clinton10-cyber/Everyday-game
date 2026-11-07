import * as THREE from 'three';
import { NPCs } from '../core/npcs.js';
import { NpcTalk } from '../core/npc-talk.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Quality } from '../core/quality.js';
import { Garage } from '../core/garage.js';
import { Identity } from '../core/identity.js';
import { Wardrobe } from '../core/wardrobe.js';
import { buildCharacter } from '../characters/lowpoly.js';
import { HOUSE_INTERACT_DATA } from './house-interiors-data.js';
import { buildHouse } from '../houses/_index.js';
import { SPACE_SCALE } from '../houses/_kit.js';

const MAT_LIT  = new THREE.MeshLambertMaterial({ vertexColors: true });
const MAT_GLOW = new THREE.MeshBasicMaterial({ vertexColors: true });
const MAT_CEIL = new THREE.MeshLambertMaterial({ vertexColors: true });

function finalizeInto(B, group, colliders, ceilMeshes) {
  const push = (arr, mat) => {
    if (!arr || arr.length === 0) return null;
    const merged = mergeGeometries(arr, false);
    arr.length = 0;
    if (!merged) return null;
    const m = new THREE.Mesh(merged, mat);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    group.add(m);
    return m;
  };
  push(B.lit, MAT_LIT);
  push(B.glow, MAT_GLOW);
  const cm = push(B.ceilParts, MAT_CEIL);
  if (cm) ceilMeshes.push(cm);
  B.lit = null; B.glow = null; B.ceilParts = null;
  for (const c of B.colliders) colliders.push(c);
  B.colliders = null;
}

const HOUSE_KEY_MAP = {
  starter_flat: "flat1",
  studio_plus:  "flat1",
  townhouse:    "flat2",
  bungalow:     "flat2",
  duplex:       "flat10",
  villa:        "flat10",
  mansion:      "mansion",
  governor:     "mansion",
};

export async function houseInteriorScene(params, router) {
  /* LEGACY: every route to "my house" now lands in the one canonical home
     (places/myhouse). Kept so old saves / links to houseInterior still work. */
  if (!params || !params.__legacyBuild) {
    const m = await import("./interior.js");
    return m.interiorScene({ id: "myhouse" }, router);
  }
  /* params.houseId is already a build key ("flat1"/"flat2"/"flat10"/
     "mansion") from phone.js and travel.js. But if a full house id
     like "townhouse" or "villa" is passed in, resolve it via Houses. */
  let requested = (params && params.houseId) || "flat1";
  if (!HOUSE_KEY_MAP[requested]) {
    try {
      const { Houses } = await import("../core/houses.js");
      const k = Houses.buildKeyFor(requested);
      if (k) requested = k;
    } catch (e) {}
  }
  const houseKey = HOUSE_KEY_MAP[requested] || requested;
  const spec = HOUSE_INTERACT_DATA[houseKey] || HOUSE_INTERACT_DATA.flat1;

  const three = new THREE.Scene();
  three.background = new THREE.Color(0x9dc4e8);
  const [fogNear, fogFar] = Quality.isLow ? [40, 130] : Quality.isHigh ? [100, 380] : [80, 260];
  three.fog = new THREE.Fog(0x9dc4e8, fogNear, fogFar);

  const camera = new THREE.PerspectiveCamera(95, innerWidth / innerHeight, 0.06, 420);
  camera.rotation.order = 'YXZ';

  three.add(new THREE.HemisphereLight(0xfff6e8, 0x6a6a78, 1.15));
  three.add(new THREE.AmbientLight(0xffffff, 0.18));
  const sun = new THREE.DirectionalLight(0xfff0dd, 0.55);
  sun.position.set(40, 90, 30);
  three.add(sun);

  {
  /* FIX #26 — much larger ground + distant sky so walking to the edge never shows void */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400),
    new THREE.MeshLambertMaterial({ color: 0x86a86a }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  three.add(ground);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1200, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0x9dc4e8, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  three.add(sky);
}

  const group = new THREE.Group();
  three.add(group);
  const colliders = [];
  const ceilMeshes = [];

  {
    const b = await buildHouse(houseKey);
    finalizeInto(b, group, colliders, ceilMeshes);
    /* Attach the per-room point lights returned by the builder.
       These make the flats feel lit instead of flat-lit. */
    if (b && Array.isArray(b._lights)) {
      for (const pl of b._lights) {
        group.add(pl);
      }
    }
  }

  let VIEW_MODE = 1;   /* third person by default */
  let VIEW_CHAR = null;
  try {
    const cfg = Identity.characterConfig(Wardrobe && Wardrobe.config ? Wardrobe.config : null);
    const built = buildCharacter(cfg);
    VIEW_CHAR = built.root;
    VIEW_CHAR.visible = true;
    three.add(VIEW_CHAR);
    VIEW_CHAR._rig = built.rig;
  } catch (e) { console.warn('[view] character build failed', e); }

  let MIRROR_RT = null, MIRROR_CAM = null, MIRROR_MESH = null;
  let _mirrorTick = 0;
  const MIRROR_INTERVAL = Quality.isHigh ? 2 : 4;
  try {
    if (Quality.isLow || houseKey === 'mansion') throw new Error('mirror disabled');
  } catch (e) {}

  /* No view toggle: interiors are always third person. */

  const EYE = 1.45;
  let player = { x: spec.spawn.x * SPACE_SCALE, z: spec.spawn.z * SPACE_SCALE, y: EYE, level: 0, frozen: false, vy: 0, onGround: true, cooldown: 0 };
  let yaw = spec.spawn.yaw || 0;
  let pitch = 0;

  try {
    const { Surfaces } = await import('../core/surfaces.js');
    if (Surfaces) {
      Surfaces.clear && Surfaces.clear();
      for (const s of spec.surfaces) {
        Surfaces.register(s.x * SPACE_SCALE, s.yTop, s.z * SPACE_SCALE, s.w * SPACE_SCALE, s.d * SPACE_SCALE, 0);
      }
    }
  } catch (e) {}

  const isMansion = houseKey === "mansion";
  const SX0 = 84 * SPACE_SCALE, SX1 = 88 * SPACE_SCALE, SZ0 = 24 * SPACE_SCALE, SZ1 = 34 * SPACE_SCALE;
  function inStairs(x, z) { return isMansion && x >= SX0 && x <= SX1 && z >= SZ0 && z <= SZ1; }
  function groundY(x, z, lv) {
    if (inStairs(x, z)) { const t = (SZ1 - z) / (SZ1 - SZ0); return 8.0 * t; }
    return lv * 8.0;
  }
  player.y = groundY(player.x, player.z, 0) + EYE;

  const keys = Object.create(null);
  const kd = e => { keys[e.code] = true; };
  const ku = e => { keys[e.code] = false; };
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);

  const joy = { on: false, id: -1, bx: 0, by: 0, x: 0, y: 0 };
  const look = { on: false, id: -1, px: 0, py: 0 };
  const LOOK_SENS = 0.0028;
  const dom = router.renderer.domElement;

  let padEl = document.getElementById('ph3d-house-pad');
  let knobEl = document.getElementById('ph3d-house-knob');
  if (!padEl) {
    padEl = document.createElement('div');
    padEl.id = 'ph3d-house-pad';
    padEl.style.cssText = 'position:fixed;width:118px;height:118px;border-radius:50%;background:rgba(255,255,255,.10);border:2px solid rgba(255,255,255,.30);pointer-events:none;display:none;z-index:9;transform:translate(-50%,-50%)';
    document.body.appendChild(padEl);
  }
  if (!knobEl) {
    knobEl = document.createElement('div');
    knobEl.id = 'ph3d-house-knob';
    knobEl.style.cssText = 'position:fixed;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.42);border:2px solid rgba(255,255,255,.65);pointer-events:none;display:none;z-index:9;transform:translate(-50%,-50%)';
    document.body.appendChild(knobEl);
  }

  const onPD = e => {
    try { dom.setPointerCapture(e.pointerId); } catch (err) {}
    const leftSide = e.clientX < innerWidth * 0.45;
    if (leftSide && !joy.on) {
      joy.on = true; joy.id = e.pointerId;
      joy.bx = e.clientX; joy.by = e.clientY;
      joy.x = 0; joy.y = 0;
      padEl.style.display = 'block';
      padEl.style.left = e.clientX + 'px';
      padEl.style.top = e.clientY + 'px';
      knobEl.style.display = 'block';
      knobEl.style.left = e.clientX + 'px';
      knobEl.style.top = e.clientY + 'px';
    } else if (!look.on) {
      look.on = true; look.id = e.pointerId;
      look.px = e.clientX; look.py = e.clientY;
    }
  };
  const onPM = e => {
    if (joy.on && e.pointerId === joy.id) {
      const R = 52;
      let dx = e.clientX - joy.bx, dy = e.clientY - joy.by;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = dx/len*R; dy = dy/len*R; }
      joy.x = dx / R; joy.y = dy / R;
      knobEl.style.left = (joy.bx + dx) + 'px';
      knobEl.style.top = (joy.by + dy) + 'px';
    } else if (look.on && e.pointerId === look.id) {
      const dx = e.clientX - look.px, dy = e.clientY - look.py;
      look.px = e.clientX; look.py = e.clientY;
      yaw -= dx * LOOK_SENS;
      pitch -= dy * LOOK_SENS;
      pitch = Math.max(-1.35, Math.min(1.35, pitch));
    }
  };
  const onPU = e => {
    if (joy.on && e.pointerId === joy.id) {
      joy.on = false; joy.id = -1; joy.x = 0; joy.y = 0;
      padEl.style.display = 'none';
      knobEl.style.display = 'none';
    }
    if (look.on && e.pointerId === look.id) { look.on = false; look.id = -1; }
  };
  dom.addEventListener('pointerdown', onPD);
  dom.addEventListener('pointermove', onPM);
  dom.addEventListener('pointerup', onPU);
  dom.addEventListener('pointercancel', onPU);

  const P_R = 0.34;
  function resolve(px, pz, lv) {
    const r = P_R;
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < colliders.length; i++) {
        const b = colliders[i];
        if (b.level !== lv) continue;
        if (px < b.minX - r || px > b.maxX + r || pz < b.minZ - r || pz > b.maxZ + r) continue;
        const cx = px < b.minX ? b.minX : (px > b.maxX ? b.maxX : px);
        const cz = pz < b.minZ ? b.minZ : (pz > b.maxZ ? b.maxZ : pz);
        const dx = px - cx, dz = pz - cz;
        const d2 = dx*dx + dz*dz;
        if (d2 < r*r) {
          if (d2 > 1e-7) {
            const d = Math.sqrt(d2);
            const k = (r - d) / d;
            px += dx * k; pz += dz * k;
          } else {
            const dl = px - b.minX, dr = b.maxX - px;
            const db = pz - b.minZ, dt = b.maxZ - pz;
            const m = Math.min(dl, dr, db, dt);
            if (m === dl) px = b.minX - r;
            else if (m === dr) px = b.maxX + r;
            else if (m === db) pz = b.minZ - r;
            else pz = b.maxZ + r;
          }
        }
      }
    }
    return [px, pz];
  }





  const actBtn = document.createElement('button');
  actBtn.id = 'ph3d-act-btn';
  actBtn.textContent = 'SIT';
  actBtn.style.cssText = 'position:fixed;right:16px;bottom:calc(env(safe-area-inset-bottom) + 34px);z-index:30;padding:14px 26px;border-radius:999px;background:rgba(8,16,28,.85);border:1px solid rgba(94,224,255,.5);color:#eaf6ff;font:900 12px Inter,system-ui,sans-serif;letter-spacing:.14em;backdrop-filter:blur(14px);cursor:pointer;pointer-events:none;opacity:0;transform:translateY(10px);transition:opacity .25s,transform .25s;touch-action:manipulation';
  document.body.appendChild(actBtn);

  const statePill = document.createElement('div');
  statePill.id = 'ph3d-house-state';
  statePill.textContent = 'STANDING';
  statePill.style.cssText = 'position:fixed;left:14px;bottom:calc(env(safe-area-inset-bottom) + 34px);z-index:30;padding:9px 16px;border-radius:999px;background:rgba(8,16,28,.7);border:1px solid rgba(94,224,255,.25);color:#eaf6ff;font:800 10px Inter,system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;backdrop-filter:blur(10px);pointer-events:none';
  document.body.appendChild(statePill);

  let runHold = false;
  const runBtn = document.createElement("button");
  runBtn.id = "ph3d-house-run";
  runBtn.textContent = "RUN";
  /* HUD handles colour/position */
  runBtn.style.cssText = "cursor:pointer;pointer-events:auto;user-select:none;touch-action:manipulation;";
  document.body.appendChild(runBtn);
  runBtn.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();
    runHold = !runHold;
    runBtn.classList.toggle("is-on", runHold);
  }, { passive: false });

  const jumpBtn = document.createElement("button");
  jumpBtn.id = "ph3d-house-jump";
  jumpBtn.textContent = "JUMP";
  /* HUD handles colour/position */
  jumpBtn.style.cssText = "cursor:pointer;pointer-events:auto;user-select:none;touch-action:manipulation;";
  document.body.appendChild(jumpBtn);
  jumpBtn.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();
    if (player.onGround && !player.frozen) { player.vy = 6.5; player.onGround = false; }
    jumpBtn.classList.add("h-flash");
    setTimeout(() => jumpBtn.classList.remove("h-flash"), 200);
  }, { passive: false });

  let sitting = null;
  let nearSit = null;
  let nearInteract = null;
  const SIT_RANGE = 1.6 * SPACE_SCALE, INT_RANGE = 2.2 * SPACE_SCALE;

  function sitAt(point) {
    if (!point) return;
    sitting = point;
    player.x = point.x;
    player.z = point.z;
    player.frozen = true;
    yaw = point.yaw || 0;
    pitch = point.kind === 'bed' ? -0.35 : -0.05;

    let baseY = groundY(point.x, point.z, player.level);
    if (point.kind === 'bed') player.y = baseY + 1.10;
    else if (point.kind === 'toilet') player.y = baseY + 1.15;
    else player.y = baseY + 1.20;

    updateStatePill();
  }
  function standUp() {
    if (!sitting) return;
    sitting = null;
    player.frozen = false;
    player.cooldown = 0.5;
    player.y = groundY(player.x, player.z, player.level) + EYE;

    if (VIEW_CHAR && VIEW_CHAR._rig) {
      VIEW_CHAR._rig.spine.rotation.x = 0;
      VIEW_CHAR._rig.hips.rotation.x = 0;
      VIEW_CHAR._rig.head.rotation.x = 0;
    }

    updateStatePill();
  }
  function updateStatePill() {
    let s = 'STANDING';
    if (sitting) {
      if (sitting.kind === 'bed') s = 'LYING DOWN';
      else if (sitting.kind === 'toilet') s = 'ON TOILET';
      else if (sitting.kind === 'lounger') s = 'LOUNGING';
      else s = 'SITTING';
    }
    statePill.textContent = s;
  }
  async function doInteract(point) {
    if (!point) return;
    try {
      if (point.kind === 'cook') {
        try {
          const { Pocket } = await import('../core/pocket.js');
          const foods = ['note','coin','cigarette'];
          const pick = foods[Math.floor(Math.random() * foods.length)];
          if (Pocket && Pocket.add) Pocket.add(pick, 1);
          if (window.__ph3d_phone) window.__ph3d_phone._toast('\uD83C\uDF73 Cooked: ' + pick);
        } catch (e) {}
      } else if (point.kind === 'fridge') {
        if (window.__ph3d_phone) window.__ph3d_phone._toast('\uD83E\uDDC0 Fridge opened');
      } else if (point.kind === 'sink') {
        if (window.__ph3d_phone) window.__ph3d_phone._toast('\uD83D\uDCA7 Water running');
      } else if (point.kind === 'gym') {
        try { const { Combat } = await import('../core/combat.js'); if (Combat && Combat.heal) Combat.heal(12); } catch (e) {}
        if (window.__ph3d_phone) window.__ph3d_phone._toast('\uD83C\uDFCB Workout +12 HP');
      } else if (point.kind === 'yoga') {
        try { const { Combat } = await import('../core/combat.js'); if (Combat && Combat.heal) Combat.heal(8); } catch (e) {}
        if (window.__ph3d_phone) window.__ph3d_phone._toast('\uD83E\uDDD8 Yoga +8 HP');
      } else if (point.kind === 'lift') {
        try { const { Combat } = await import('../core/combat.js'); if (Combat && Combat.heal) Combat.heal(10); } catch (e) {}
        if (window.__ph3d_phone) window.__ph3d_phone._toast('\uD83D\uDCAA Lifted +10 HP');
      } else if (point.kind === 'wardrobe') {
        try {
          const mod = await import('../core/thirdperson.js');
          if (mod && mod.openWardrobeFor && window.__ph3d_walkCtrl) {
            mod.openWardrobeFor(window.__ph3d_walkCtrl);
          }
        } catch (e) {}
      }
    } catch (e) {}
  }
  actBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (sitting) { standUp(); return; }
    if (nearInteract) { doInteract(nearInteract); return; }
    if (nearSit) { sitAt(nearSit); return; }
  }, { passive: false });

  try {
    Garage.spawnCars(three,
      isMansion ? 80 * SPACE_SCALE : 1.5 * SPACE_SCALE,
      isMansion ? 16 * SPACE_SCALE : 8.2 * SPACE_SCALE,
      3.6, isMansion ? Math.PI : 0);
  } catch (e) {}

  router.ui.setHint('LEFT: MOVE \u00B7 RIGHT: LOOK \u00B7 SHIFT: RUN', true);

/* ── One walker per house so it feels lived-in ─────────────── */
try {
  const { spawnInteriorNPCs } = await import('../core/interior-npcs.js');
  const houseAABBs = (colliders || []).map(c => ({
    x: (c.minX + c.maxX) * 0.5,
    z: (c.minZ + c.maxZ) * 0.5,
    hx: (c.maxX - c.minX) * 0.5,
    hz: (c.maxZ - c.minZ) * 0.5,
  }));
  const NPC_COUNTS = { flat1: 3, flat2: 4, flat10: 7, mansion: 8 };
  spawnInteriorNPCs(three, houseKey, {
    aabbs: houseAABBs,
    targetCount: NPC_COUNTS[houseKey] || 2,
    fallback: { role: 'walker', x: spec.spawn.x + 2, z: spec.spawn.z + 2 },
    skip: ['banker', 'police', 'doctor', 'mechanic', 'priest'],
  });
} catch (e) { console.warn('[house] NPC spawn failed:', e); }

try {
  NpcTalk.mount({
    getPos: () => ({ x: player.x, z: player.z }),
    getYaw:  () => yaw,
  });
} catch (e) {}

const _houseTalkKey = (e) => {
  if (e.code !== 'KeyE' || e.repeat) return;
  const npc = NPCs.nearest(player.x, player.z, 2.5);
  if (npc) { NPCs.talk(npc); e.preventDefault(); }
};
window.addEventListener('keydown', _houseTalkKey, { capture: true });

  return {
  three, camera,
  controls: { update: () => {} },
  crumb: 'MY HOUSE',
  title: spec.label,
  subtitle: 'WALK AROUND',
  hint: 'LEFT: MOVE \u00B7 RIGHT: LOOK',
  isInterior: true,
  sceneId: houseKey,
  dispose: () => {
window.removeEventListener('keydown', _houseTalkKey, { capture: true });
try { NpcTalk.unmount(); } catch (e) {}
try { NPCs.despawn(); } catch (e) {}
window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      dom.removeEventListener('pointerdown', onPD);
      dom.removeEventListener('pointermove', onPM);
      dom.removeEventListener('pointerup', onPU);
      dom.removeEventListener('pointercancel', onPU);
            actBtn.remove(); statePill.remove();
      try { runBtn.remove(); } catch (e) {}
      try { jumpBtn.remove(); } catch (e) {}
      try { if (VIEW_CHAR) { three.remove(VIEW_CHAR); } } catch (e) {}
      try { if (MIRROR_RT) MIRROR_RT.dispose(); } catch (e) {}
      try { if (MIRROR_MESH) three.remove(MIRROR_MESH); } catch (e) {}
    },
      update: (dt) => {
    try {
      NPCs.tick(dt,
        window.__ph3d_walkCtrl ? window.__ph3d_walkCtrl.pos.x : 0,
        window.__ph3d_walkCtrl ? window.__ph3d_walkCtrl.pos.z : 0);
      NpcTalk.tick(dt);
    } catch (e) {}
let mf = 0, ms = 0;
  if (player.cooldown > 0) player.cooldown -= dt;

      if (!player.frozen && player.cooldown <= 0) {
        if (keys.KeyW || keys.ArrowUp)    mf += 1;
        if (keys.KeyS || keys.ArrowDown)  mf -= 1;
        if (keys.KeyD || keys.ArrowRight) ms += 1;
        if (keys.KeyA || keys.ArrowLeft)  ms -= 1;
        mf -= joy.y;
        ms += joy.x;
      }
      const mag = Math.hypot(mf, ms);
      if (mag > 1) { mf /= mag; ms /= mag; }

      const speed = (runHold || keys.ShiftLeft || keys.ShiftRight) ? 9.5 : 5.5;
      const moving = (mf !== 0 || ms !== 0);

      if (moving) {
        const sy = Math.sin(yaw), cy = Math.cos(yaw);
        const dx = (-sy * mf + cy * ms) * speed * dt;
        const dz = (-cy * mf - sy * ms) * speed * dt;
        const res = resolve(player.x + dx, player.z + dz, player.level);
        player.x = res[0];
        player.z = res[1];
      }

      if (inStairs(player.x, player.z)) {
        const gy = groundY(player.x, player.z, player.level);
        if (gy > 2.5)      player.level = 1;
        else if (gy < 1.5) player.level = 0;
      }

      if (!player.frozen) {
        const floorY = groundY(player.x, player.z, player.level) + EYE;
        if (!player.onGround) {
          player.vy -= 20 * dt;
          player.y += player.vy * dt;
          if (player.y <= floorY) {
            player.y = floorY;
            player.vy = 0;
            player.onGround = true;
          }
        } else {
          player.y = floorY;
        }
      }

      if (VIEW_MODE === 1) {
        const px = player.x;
        const pz = player.z;
        const py = player.y - 0.3;
        let cx = player.x - Math.sin(yaw) * 3.2;
        let cz = player.z - Math.cos(yaw) * 3.2;
        let cy = player.y + 1.0;

        for (const b of colliders) {
           if (b.level !== player.level) continue;
           if (cx > b.minX && cx < b.maxX && cz > b.minZ && cz < b.maxZ && cy > (b.y0 ?? 0) && cy < (b.y1 ?? 3)) {
               cx = player.x;
               cz = player.z;
               cy = player.y + 0.2;
               break;
           }
        }
        camera.position.set(cx, cy, cz);
        camera.lookAt(player.x, player.y + 0.3, player.z);
      }

      {
        let ns = null, nsd = SIT_RANGE * SIT_RANGE;
        const floorHere = groundY(player.x, player.z, player.level);
        for (const s of spec.sits) {
          const sx = s.x * SPACE_SCALE, sz = s.z * SPACE_SCALE;
          if (s.floor !== undefined && Math.abs(s.floor - floorHere) > 0.5) continue;
          const dx = sx - player.x, dz = sz - player.z;
          const d = dx*dx + dz*dz;
          if (d < nsd) { nsd = d; ns = Object.assign({}, s, { x: sx, z: sz }); }
        }
        nearSit = ns;
        let ni = null, nid = INT_RANGE * INT_RANGE;
        for (const s of spec.interacts) {
          const sx = s.x * SPACE_SCALE, sz = s.z * SPACE_SCALE;
          const dx = sx - player.x, dz = sz - player.z;
          const d = dx*dx + dz*dz;
          if (d < nid) { nid = d; ni = Object.assign({}, s, { x: sx, z: sz }); }
        }
        nearInteract = ni;
      }

      let text = '', border = 'rgba(94,224,255,.5)', color = '#eaf6ff';
      if (sitting) { text = 'STAND'; border = 'rgba(255,204,94,.6)'; color = '#ffcc5e'; }
      else if (nearInteract) { text = nearInteract.label || 'USE'; border = 'rgba(160,240,255,.55)'; color = '#a0f0ff'; }
      else if (nearSit) { text = nearSit.kind === 'bed' ? 'LIE DOWN' : 'SIT'; }
      if (text) {
        actBtn.textContent = text;
        actBtn.style.borderColor = border;
        actBtn.style.color = color;
        actBtn.style.opacity = '1';
        actBtn.style.transform = 'translateY(0)';
        actBtn.style.pointerEvents = 'auto';
      } else {
        actBtn.style.opacity = '0';
        actBtn.style.transform = 'translateY(10px)';
        actBtn.style.pointerEvents = 'none';
      }

      if (VIEW_CHAR && VIEW_MODE === 1) {
        VIEW_CHAR.visible = true;
        VIEW_CHAR.position.set(player.x, groundY(player.x, player.z, player.level), player.z);
        VIEW_CHAR.rotation.y = yaw + Math.PI;
        if (VIEW_CHAR._rig && VIEW_CHAR._rig.legL) {
          const t = performance.now() * 0.001;
          const spd = moving ? 1 : 0.3;
          const amp = moving ? 0.4 : 0.03;
          VIEW_CHAR._rig.legL.hip.rotation.x = Math.sin(t * spd * 6) * amp;
          VIEW_CHAR._rig.legR.hip.rotation.x = -Math.sin(t * spd * 6) * amp;
          if (VIEW_CHAR._rig.armL) VIEW_CHAR._rig.armL.shoulder.rotation.x = -Math.sin(t * spd * 6) * amp;
          if (VIEW_CHAR._rig.armR) VIEW_CHAR._rig.armR.shoulder.rotation.x = Math.sin(t * spd * 6) * amp;

          if (sitting) {
              if (sitting.kind === 'bed') {
                  VIEW_CHAR._rig.spine.rotation.x = -1.42;
                  VIEW_CHAR._rig.hips.rotation.x = -1.42;
                  VIEW_CHAR._rig.hips.position.y = 0.30;
              } else {
                  VIEW_CHAR._rig.spine.rotation.x = 0.06;
                  VIEW_CHAR._rig.hips.rotation.x = 0;
                  VIEW_CHAR._rig.hips.position.y = 0.56 * 0.935;
              }
          } else {
              VIEW_CHAR._rig.spine.rotation.x = 0;
              VIEW_CHAR._rig.hips.rotation.x = 0;
              VIEW_CHAR._rig.hips.position.y = 0.935;
          }
        }
      } else if (VIEW_CHAR) {
        VIEW_CHAR.visible = false;
      }

      _mirrorTick++;
      if (MIRROR_RT && MIRROR_MESH && MIRROR_CAM && (_mirrorTick % MIRROR_INTERVAL === 0)) {
        const mPos = MIRROR_MESH.position;
        const mNorm = new THREE.Vector3(0, 0, 1).applyQuaternion(MIRROR_MESH.quaternion);
        const camPos = camera.position.clone();
        const toMirror = new THREE.Vector3().subVectors(mPos, camPos);
        const dist = toMirror.dot(mNorm);
        const reflectPos = camPos.clone().addScaledVector(mNorm, dist * 2);
        MIRROR_CAM.position.copy(reflectPos);
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        const reflectDir = camDir.clone().sub(mNorm.clone().multiplyScalar(2 * camDir.dot(mNorm)));
        MIRROR_CAM.lookAt(reflectPos.clone().add(reflectDir));
        const prevVis = MIRROR_MESH.visible;
        MIRROR_MESH.visible = false;
        router.renderer.setRenderTarget(MIRROR_RT);
        router.renderer.render(three, MIRROR_CAM);
        router.renderer.setRenderTarget(null);
        MIRROR_MESH.visible = prevVis;
      }

      if (VIEW_MODE === 0) {
        camera.position.set(player.x, player.y, player.z);
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;
      }
    },
  };
}

