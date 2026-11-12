/* ================================================================
   world-objects.js  —  World Object System
   ================================================================
   Spawns interactive 3D objects around the city.
   Objects can be:
     • Picked up by the player (proximity → prompt)
     • Used after picking up (type-specific action)
     • Thrown / dropped

   Object types (from obj.html catalog):
     food, junkfood, water, money, phone, bag, bat,
     bottle, book, cigarettes, dumbbell, crate, spray_can

   Player API:
     WorldObjects.getNearby(x, z, radius)  → nearest item
     WorldObjects.pickup(item, player)
     WorldObjects.use(item, holder)
     WorldObjects.drop(item, x, z)
     WorldObjects.throw(item, tx, tz, holder)
   ================================================================ */

import * as THREE from "three";
import { createMarketItemMesh } from "./market-item-models.js";

const TAU  = Math.PI * 2;
let _scene = null;

/* ── Object catalogue ───────────────────────────────────────── */
const CATALOGUE = {
  food: {
    label: "Street Food",
    color: 0xe8a840,
    use: "Restores +20 health.",
    icon: "🍖",
    build(pos) { return _buildFood(pos); },
  },
  junkfood: {
    label: "Junk Food",
    color: 0xff6644,
    use: "Restores +10 health, -1 stamina.",
    icon: "🍔",
    build(pos) { return _buildJunk(pos); },
  },
  water: {
    label: "Water Bottle",
    color: 0x88ccff,
    use: "Restores +5 health.",
    icon: "💧",
    build(pos) { return _buildWater(pos); },
  },
  money: {
    label: "Money",
    color: 0x44cc44,
    use: "Adds ₦500 to your wallet.",
    icon: "💵",
    build(pos) { return _buildMoney(pos); },
  },
  phone: {
    label: "Mobile Phone",
    color: 0x222222,
    use: "Open your phone.",
    icon: "📱",
    build(pos) { return _buildPhone(pos); },
  },
  bag: {
    label: "Shopping Bag",
    color: 0xddcc88,
    use: "Carry more items.",
    icon: "🛍",
    build(pos) { return _buildBag(pos); },
  },
  bat: {
    label: "Wooden Bat",
    color: 0x8b5e3c,
    use: "Melee weapon — deals 40 damage.",
    icon: "🏏",
    build(pos) { return _buildBat(pos); },
  },
  bottle: {
    label: "Glass Bottle",
    color: 0x55aa44,
    use: "Throw to stun. Melee deals 20 dmg.",
    icon: "🍾",
    build(pos) { return _buildBottle(pos); },
  },
  book: {
    label: "Textbook",
    color: 0x4466cc,
    use: "+5 XP (study).",
    icon: "📚",
    build(pos) { return _buildBook(pos); },
  },
  cigarettes: {
    label: "Cigarettes",
    color: 0xeeddcc,
    use: "Reduces stress. -1 health long-term.",
    icon: "🚬",
    build(pos) { return _buildCigarettes(pos); },
  },
  dumbbell: {
    label: "Dumbbell",
    color: 0x555566,
    use: "+2 strength.",
    icon: "🏋",
    build(pos) { return _buildDumbbell(pos); },
  },
  crate: {
    label: "Wooden Crate",
    color: 0xaa8855,
    use: "Heavy lift obstacle or weapon.",
    icon: "📦",
    build(pos) { return _buildCrate(pos); },
  },
  spray_can: {
    label: "Spray Paint",
    color: 0xff4488,
    use: "Tag buildings. Increases heat.",
    icon: "🎨",
    build(pos) { return _buildSprayCan(pos); },
  },
};

/* ── Object list ────────────────────────────────────────────── */
const _items = []; // { id, type, x, z, mesh, taken, holder }

/* ── Build helpers ──────────────────────────────────────────── */
function M(geo, color) { return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color })); }
function G(w,h,d) { return new THREE.BoxGeometry(w,h,d); }
function C(r,h,s) { return new THREE.CylinderGeometry(r,r,h,s||8); }

function _makeRoot(pos) {
  const g = new THREE.Group();
  g.position.set(pos.x, 0.05, pos.z);
  return g;
}

function _buildFood(pos) {
  const g = _makeRoot(pos);
  g.add(Object.assign(M(C(0.12,0.22,6),0xcc8844), {}).translateY(0.12));
  g.add(Object.assign(M(G(0.28,0.06,0.28),0x8b4513), {}).translateY(0.01));
  return g;
}
function _buildJunk(pos) {
  const g = _makeRoot(pos);
  g.add(Object.assign(M(G(0.3,0.18,0.3),0xff6644), {}).translateY(0.09));
  g.add(Object.assign(M(G(0.28,0.08,0.28),0xddcc88), {}).translateY(0.2));
  return g;
}
function _buildWater(pos) {
  const g = _makeRoot(pos);
  const body = M(C(0.06,0.26,8),0x88ccff);
  body.material.transparent = true; body.material.opacity = 0.7;
  g.add(body.translateY(0.14));
  g.add(Object.assign(M(C(0.04,0.05,6),0xdddddd), {}).translateY(0.285));
  return g;
}
function _buildMoney(pos) {
  const g = _makeRoot(pos);
  for (let i=0;i<3;i++)
    g.add(Object.assign(M(G(0.18,0.005,0.09),0x44cc44), {}).translateY(0.005+i*0.007).rotateY(i*0.18));
  return g;
}
function _buildPhone(pos) {
  const g = _makeRoot(pos);
  g.add(Object.assign(M(G(0.07,0.14,0.01),0x222222), {}).translateY(0.08).rotateX(-0.1));
  g.add(Object.assign(M(G(0.055,0.11,0.003),0x4499ff), {}).translateY(0.082).translateZ(0.007).rotateX(-0.1));
  return g;
}
function _buildBag(pos) {
  const g = _makeRoot(pos);
  g.add(Object.assign(M(G(0.22,0.28,0.12),0xddcc88), {}).translateY(0.15));
  g.add(Object.assign(M(G(0.18,0.22,0.10),0xccbb77), {}).translateY(0.3));
  g.add(Object.assign(M(C(0.01,0.12,4),0x9a8855), {}).translateY(0.33).translateX(-0.06).rotateZ(0.5));
  g.add(Object.assign(M(C(0.01,0.12,4),0x9a8855), {}).translateY(0.33).translateX( 0.06).rotateZ(-0.5));
  return g;
}
function _buildBat(pos) {
  const g = _makeRoot(pos);
  g.add(Object.assign(M(C(0.025,0.55,8),0x8b5e3c), {}).translateY(0.28).rotateZ(0.15));
  g.add(Object.assign(M(C(0.04,0.12,8),0xa0724a), {}).translateY(0.67).rotateZ(0.15));
  return g;
}
function _buildBottle(pos) {
  const g = _makeRoot(pos);
  g.add(Object.assign(M(C(0.05,0.28,8),0x55aa44), {}).translateY(0.15));
  g.add(Object.assign(M(C(0.025,0.06,6),0x55aa44), {}).translateY(0.32));
  const top = M(C(0.027,0.02,6),0xdddddd); top.translateY(0.353); g.add(top);
  return g;
}
function _buildBook(pos) {
  const g = _makeRoot(pos);
  g.add(Object.assign(M(G(0.18,0.04,0.24),0x4466cc), {}).translateY(0.02));
  g.add(Object.assign(M(G(0.16,0.035,0.22),0xf0f0e8), {}).translateY(0.02).translateZ(0.004));
  return g;
}
function _buildCigarettes(pos) {
  const g = _makeRoot(pos);
  g.add(Object.assign(M(G(0.09,0.05,0.13),0xeeddcc), {}).translateY(0.026));
  g.add(Object.assign(M(G(0.085,0.048,0.125),0xffffff), {}).translateY(0.026));
  return g;
}
function _buildDumbbell(pos) {
  const g = _makeRoot(pos);
  g.add(Object.assign(M(C(0.04,0.22,8),0x666677), {}).translateY(0.06).rotateZ(Math.PI/2));
  g.add(Object.assign(M(C(0.07,0.04,8),0x444455), {}).translateY(0.06).translateX( 0.12).rotateZ(Math.PI/2));
  g.add(Object.assign(M(C(0.07,0.04,8),0x444455), {}).translateY(0.06).translateX(-0.12).rotateZ(Math.PI/2));
  return g;
}
function _buildCrate(pos) {
  const g = _makeRoot(pos);
  g.add(Object.assign(M(G(0.36,0.28,0.36),0xaa8855), {}).translateY(0.14));
  // slats
  for(let i=-1;i<=1;i++) {
    g.add(Object.assign(M(G(0.38,0.02,0.02),0x8a6633), {}).translateY(0.06+i*0.1).translateZ(0.18));
    g.add(Object.assign(M(G(0.38,0.02,0.02),0x8a6633), {}).translateY(0.06+i*0.1).translateZ(-0.18));
  }
  return g;
}
function _buildSprayCan(pos) {
  const g = _makeRoot(pos);
  const cols = [0xff4488,0x4488ff,0x44ff88,0xff8844,0xff4444];
  const col = cols[Math.floor(Math.random()*cols.length)];
  g.add(Object.assign(M(C(0.04,0.22,10),col), {}).translateY(0.12));
  g.add(Object.assign(M(C(0.03,0.04,8),0x888888), {}).translateY(0.24));
  g.add(Object.assign(M(C(0.012,0.03,6),0x333333), {}).translateY(0.265));
  return g;
}

/* ── Hover glow ring ────────────────────────────────────────── */
function _makeGlow() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.22, 0.28, 20),
    new THREE.MeshBasicMaterial({ color: 0x5ee0ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.name = "_glowRing";
  return ring;
}

/* ── RNG ────────────────────────────────────────────────────── */
let _seed = 0xf00dbabe;
function rng() { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; }

/* ── Main module ────────────────────────────────────────────── */
export const WorldObjects = {

  init(scene) { _scene = scene; },

  /** Spawn N random objects around the grid */
  seedCity(scene, count = 80, gridRadius = 3, blockSize = 50, roadW = 14) {
    _scene = scene;
    const STEP = blockSize + roadW;
    const types = Object.keys(CATALOGUE);

    for (let i = 0; i < count; i++) {
      const gx = Math.floor(rng() * (gridRadius * 2 + 1)) - gridRadius;
      const gz = Math.floor(rng() * (gridRadius * 2 + 1)) - gridRadius;
      const bx = gx * STEP + (rng() - 0.5) * blockSize;
      const bz = gz * STEP + (rng() - 0.5) * blockSize;
      const type = types[Math.floor(rng() * types.length)];
      this.spawn(type, bx, bz);
    }
  },

  /** Spawn a specific type at a world position */
  spawn(type, x, z) {
    const def = CATALOGUE[type];
    if (!def || !_scene) return null;
    const id = "obj_" + Math.random().toString(36).slice(2, 8);
    const mesh = def.build({ x, z });
    const glow = _makeGlow();
    glow.visible = false;
    mesh.add(glow);
    _scene.add(mesh);

    const item = { id, type, x, z, mesh, glow, taken: false, holder: null,
                   label: def.label, use: def.use, icon: def.icon };
    _items.push(item);
    return item;
  },

  /** Build a bare pickup mesh (not tracked in the city list) — used for interiors */
  buildMesh(type, x, z) {
    const def = CATALOGUE[type];
    return def ? def.build({ x, z }) : null;
  },
  types() { return Object.keys(CATALOGUE); },

  /** All live objects */
  getAll() { return _items.filter(i => !i.taken); },

  /** Nearest untaken object within radius */
  getNearby(x, z, radius = 2.2) {
    let best = null, bestD = radius * radius;
    for (const item of _items) {
      if (item.taken) continue;
      const d = (item.x - x) ** 2 + (item.z - z) ** 2;
      if (d < bestD) { bestD = d; best = item; }
    }
    return best;
  },

  /** Highlight item for player proximity */
  setHighlight(item, on) {
    if (!item || !item.glow) return;
    item.glow.visible = on;
  },

  /** Pick up an item — returns true on success */
  pickup(item, holder) {
    if (!item || item.taken) return false;
    item.taken   = true;
    item.holder  = holder;
    /* keep the mesh if it is in the player's hand (visible carried item) */
    if (item.mesh && item.mesh.parent && !(item.mesh.userData && item.mesh.userData._inHand)) {
      item.mesh.parent.remove(item.mesh);
    }
    // Add to pocket / inventory if it's the player
    if (holder && holder === window.__ph3d_player) {
      try { window.__ph3d_pocket?.add(item.type, 1); } catch(e) {}
      // Toast
      try { window.__ph3d_phone?._toast(`${item.icon} Picked up ${item.label}`); } catch(e) {}
    }
    return true;
  },

  /** Use / activate a held item */
  use(item, holder) {
    if (!item) return;
    switch (item.type) {
      case "food":
      case "junkfood":
      case "water":
        try { window.__ph3d_sfx?.play(item.type === "water" ? "drink" : "eat"); } catch(e) {}
        try { window.__ph3d_player_combat?.heal(item.type === "food" ? 20 : item.type === "junkfood" ? 10 : 5); } catch(e) {}
        try { window.__ph3d_phone?._toast(`${item.icon} Used ${item.label} — ${item.use}`); } catch(e) {}
        this.consume(item);
        break;
      case "money":
        try { window.__ph3d_economy?.receive("pickup", 500); } catch(e) {}
        try { window.__ph3d_phone?._toast("💵 Found ₦500!"); } catch(e) {}
        this.consume(item);
        break;
      case "phone":
        try { window.__ph3d_phone?.open(); } catch(e) {}
        break;
      case "bat":
      case "bottle":
        // Equip as melee weapon
        try { window.__ph3d_weapons?.equip(item.type); } catch(e) {}
        try { window.__ph3d_phone?._toast(`${item.icon} Equipped ${item.label}`); } catch(e) {}
        break;
      case "cigarettes":
        try { window.__ph3d_phone?._toast("🚬 You lit a cigarette…"); } catch(e) {}
        this.consume(item);
        break;
      case "dumbbell":
        try { window.__ph3d_phone?._toast("🏋 You worked out! +2 strength"); } catch(e) {}
        this.consume(item);
        break;
      default:
        try { window.__ph3d_phone?._toast(`${item.icon} ${item.use}`); } catch(e) {}
    }
  },

  /** Drop a currently held world object with a short physical fall and bounce. */
  drop(item, x, z) {
    if (!item || !_scene) return false;
    try { window.__ph3d_sfx && window.__ph3d_sfx.dropSound(item, x, z, false); } catch (e) {}
    item.taken = false;
    item.holder = null;
    item.dropped = true;
    item.x = x; item.z = z;
    if (item.mesh) {
      if (item.mesh.parent) item.mesh.parent.remove(item.mesh);
      item.mesh.position.set(x, 0.95, z);
      item.mesh.rotation.set(0, 0, 0);
      _scene.add(item.mesh);
      item.physics = { vx: 0, vy: 0.7, vz: 0, bounce: 0 };
    }
    if (!_items.includes(item)) _items.push(item);
    return true;
  },

  /**
   * Create a real 3D object in front of the player from a Pocket slot.
   * The caller should remove one unit from Pocket only after this succeeds.
   */
  dropPocketItem(slot, player) {
    if (!slot || !slot.id || !_scene) return false;
    const actor = player || window.__ph3d_player || window.__ph3d_walkCtrl || window.__ph3d_tp || window.__ph3d_drive;
    let pos = actor && actor.pos ? actor.pos : actor;
    if (actor && typeof actor.getPos === "function") {
      try { pos = actor.getPos() || pos; } catch (e) {}
    }
    const px = pos && Number.isFinite(pos.x) ? pos.x : 0;
    const pz = pos && Number.isFinite(pos.z) ? pos.z : 0;
    const yaw = pos && Number.isFinite(pos.yaw) ? pos.yaw : actor && Number.isFinite(actor.yaw) ? actor.yaw : 0;
    const x = px + Math.sin(yaw) * 0.88;
    const z = pz + Math.cos(yaw) * 0.88;
    const def = CATALOGUE[slot.id];
    const mesh = def ? def.build({ x, z }) : createMarketItemMesh({
      id: slot.id,
      label: slot.name || slot.id,
      name: slot.name || slot.id,
    });
    if (!mesh) return false;
    const id = "drop_" + Math.random().toString(36).slice(2, 10);
    const glow = _makeGlow();
    glow.visible = false;
    mesh.add(glow);
    mesh.position.set(x, 0.92, z);
    mesh.rotation.set(0, yaw, 0);
    mesh.scale.setScalar(0.82);
    mesh.userData = mesh.userData || {};
    mesh.userData.itemType = slot.id;
    const item = {
      id, type: slot.id, x, z, mesh, glow, taken: false, holder: null,
      label: slot.name || slot.id.replace(/_/g, " ").toUpperCase(),
      icon: slot.icon || "ITEM", use: slot.desc || "Pick up this item.",
      dropped: true,
      physics: { vx: Math.sin(yaw) * 0.35, vy: 0.8, vz: Math.cos(yaw) * 0.35, bounce: 0 },
    };
    mesh.userData._item = item;
    _scene.add(mesh);
    _items.push(item);
    try { window.__ph3d_sfx && window.__ph3d_sfx.dropSound(item, x, z, false); } catch (e) {}
    return item;
  },

  /** Throw an item toward a target (basic arc; disappears on landing) */
  throw(item, tx, tz, holder) {
    if (!item) return;
    item.taken = false;
    item.dropped = true;
    const startX = holder?.x ?? 0;
    const startZ = holder?.z ?? 0;
    item.x = tx; item.z = tz;
    // Animate across frames
    let t = 0;
    const duration = 0.55;
    const tick = (dt) => {
      if (!item.mesh) return;
      t += dt;
      const p = Math.min(t / duration, 1);
      item.mesh.position.x = startX + (tx - startX) * p;
      item.mesh.position.y = Math.sin(p * Math.PI) * 3.5;
      item.mesh.position.z = startZ + (tz - startZ) * p;
      item.mesh.rotation.x += dt * 8;
      if (p >= 1) {
        item.mesh.position.y = 0.05;
        if (_scene && !item.mesh.parent) _scene.add(item.mesh);
        return;
      }
      // Will be called externally from the game loop via WorldObjects.tickThrows()
    };
    item._throwTick = tick;
    if (_scene && !item.mesh.parent) _scene.add(item.mesh);
  },

  tickThrows(dt) {
    for (const item of _items) {
      if (item._throwTick) {
        item._throwTick(dt);
        if (!item._throwTick._done) {
          // after a second call reset
          const origTick = item._throwTick;
          let done = false;
          item._throwTick = (d) => { if (done) { item._throwTick = null; return; } done = true; origTick(d); };
        }
      }
    }
  },

  /** Remove item permanently */
  consume(item) {
    if (!item) return;
    if (item.mesh && item.mesh.parent) item.mesh.parent.remove(item.mesh);
    const idx = _items.indexOf(item);
    if (idx >= 0) _items.splice(idx, 1);
  },

  /** Hover ring tick (called every frame) */
  tick(dt, playerX, playerZ) {
    const near = this.getNearby(playerX, playerZ, 2.4);
    const R2 = 60 * 60;   /* only animate objects within 60 m */
    for (const item of _items) {
      if (item.taken) continue;
      const ddx = item.x - playerX, ddz = item.z - playerZ;
      if (ddx * ddx + ddz * ddz > R2) continue;
      // Dropped pocket items and hand-held props fall, bounce once, then settle.
      if (item.mesh && item.physics) {
        const ph = item.physics;
        ph.vy -= 13.5 * dt;
        item.mesh.position.x += ph.vx * dt;
        item.mesh.position.y += ph.vy * dt;
        item.mesh.position.z += ph.vz * dt;
        item.mesh.rotation.y += dt * 1.2;
        item.x = item.mesh.position.x; item.z = item.mesh.position.z;
        if (item.mesh.position.y <= 0.05) {
          item.mesh.position.y = 0.05;
          if (!ph.bounce && Math.abs(ph.vy) > 1.25) {
            ph.vy = Math.abs(ph.vy) * 0.22;
            ph.vx *= 0.42; ph.vz *= 0.42; ph.bounce = 1;
          } else {
            item.physics = null;
            item.mesh.rotation.x = 0; item.mesh.rotation.z = 0;
          }
        }
      } else if (item.mesh && item.dropped) {
        // Dropped inventory items stay exactly where they landed; only world-spawned pickups bob.
        item.mesh.position.y = 0.05;
      } else if (item.mesh) {
        item.mesh.position.y = 0.05 + Math.sin(Date.now() * 0.002 + item.x) * 0.025;
        item.mesh.rotation.y += dt * 0.16;
      }
      this.setHighlight(item, item === near);
    }
    // Show pick-up prompt
    if (near) {
      _showPickupPrompt(near);
    } else {
      _hidePickupPrompt();
    }
    this.tickThrows(dt);
  },

  /** Cleanup */
  clear() {
    for (const item of _items) {
      if (item.mesh && item.mesh.parent) item.mesh.parent.remove(item.mesh);
    }
    _items.length = 0;
    _hidePickupPrompt();
  },

  getItemById(id) { return _items.find(i => i.id === id); },

  /** Get catalogue entry for type */
  getType(type) { return CATALOGUE[type]; },
};

/* ── Pick-up HUD prompt ─────────────────────────────────────── */
let _promptEl = null;
function _showPickupPrompt(item) {
  if (!_promptEl) {
    _promptEl = document.createElement("div");
    _promptEl.id = "ph3d-pickup-prompt";
    Object.assign(_promptEl.style, {
      position: "fixed",
      bottom: "calc(env(safe-area-inset-bottom) + 120px)",
      left: "50%",
      transform: "translateX(-50%)",
      padding: "10px 20px",
      borderRadius: "24px",
      background: "rgba(10,20,32,0.92)",
      border: "1px solid rgba(94,224,255,0.55)",
      color: "#eaf6ff",
      font: "800 12px Inter,system-ui,sans-serif",
      letterSpacing: ".1em",
      zIndex: "35",
      pointerEvents: "none",
      textAlign: "center",
      boxShadow: "0 8px 24px rgba(0,0,0,.6)",
      transition: "opacity .2s",
    });
    document.body.appendChild(_promptEl);
  }
  _promptEl.innerHTML = `${item.icon} <b>${item.label}</b><br><span style="font-weight:400;opacity:.7;font-size:10px">[E] Pick up &nbsp;·&nbsp; ${item.use}</span>`;
  _promptEl.style.opacity = "1";
  _promptEl.style.display = "block";
  // Register the nearby item globally so the walk controls can trigger pickup on E
  window.__ph3d_nearObj = item;
}
function _hidePickupPrompt() {
  if (_promptEl) { _promptEl.style.opacity = "0"; }
  window.__ph3d_nearObj = null;
}

