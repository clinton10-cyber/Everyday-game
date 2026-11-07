/* ════════════════════════════════════════════════════════════════
   world-events.js — random things happening across the city.

   API:
     WorldEvents.init(scene)
     WorldEvents.tick(dt, px, pz)
     WorldEvents.getActive()
     WorldEvents.nearestInteractable(x, z)  → event in reach | null
     WorldEvents.interact(ev)
     WorldEvents.despawn()

   Types: crash · fight · fire · wallet · medical
   Handle an event (E / tap button) for rep (and sometimes money / HP).
   Ignore it and, when it expires, the bigger ones cost rep.
   ════════════════════════════════════════════════════════════════ */

import * as THREE from "three";
import { Rep } from "./rep.js";

let _scene = null;
let _events = [];
let _spawnCd = 0;
const _toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} };

/* world bounds so events never spawn in the void */
const BOUNDS = { minX: -380, maxX: 430, minZ: -300, maxZ: 280 };

/* ── props ─────────────────────────────────────────────────── */
function _beacon(color) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.9, 14, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.35,
      depthWrite: false, side: THREE.DoubleSide,
    })
  );
  mesh.position.y = 7;
  return mesh;
}

function _stickPerson(shirt, skin) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.8, 8), new THREE.MeshLambertMaterial({ color: shirt }));
  body.position.y = 1.0;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.65;
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 8), new THREE.MeshLambertMaterial({ color: 0x23262d }));
  legs.position.y = 0.3;
  g.add(body, head, legs);
  return g;
}

function _makeCrash() {
  const g = new THREE.Group();
  const car = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 4.4), new THREE.MeshLambertMaterial({ color: 0xa83a2e }));
  car.position.y = 0.6;
  const car2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 4.4), new THREE.MeshLambertMaterial({ color: 0x3b5b8a }));
  car2.position.set(2.2, 0.6, 2.4);
  car2.rotation.y = 0.9;
  g.add(car, car2);
  /* smoke puffs that rise and loop */
  const puffs = [];
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.5, depthWrite: false })
    );
    p.userData.phase = i / 4;
    puffs.push(p);
    g.add(p);
  }
  g.userData.puffs = puffs;
  return g;
}

function _makeFight() {
  const g = new THREE.Group();
  const a = _stickPerson(0xc0392b, 0x8d5a3c);
  const b = _stickPerson(0x2c6fb0, 0x5a3a26);
  a.position.x = -0.9; b.position.x = 0.9;
  g.add(a, b);
  g.userData.fighters = [a, b];
  return g;
}

function _makeFire() {
  const g = new THREE.Group();
  const bin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshLambertMaterial({ color: 0x3a2a1a }));
  bin.position.y = 0.4;
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 1.4, 8),
    new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.85 })
  );
  flame.position.y = 1.5;
  g.add(bin, flame);
  g.userData.flame = flame;
  return g;
}

function _makeWallet() {
  const g = new THREE.Group();
  const w = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.2), new THREE.MeshLambertMaterial({ color: 0x4a2f1a }));
  w.position.y = 0.06;
  g.add(w);
  return g;
}

function _makeMedical() {
  const g = new THREE.Group();
  /* victim lying on the ground */
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.1, 8), new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.22;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshLambertMaterial({ color: 0x6b4630 }));
  head.position.set(-0.75, 0.24, 0);
  g.add(body, head);
  /* floating red cross */
  const mat = new THREE.MeshBasicMaterial({ color: 0xff3344, side: THREE.DoubleSide });
  const cross = new THREE.Group();
  cross.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 0.04), mat));
  cross.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.04), mat));
  cross.position.y = 1.7;
  g.add(cross);
  g.userData.cross = cross;
  return g;
}

const TYPES = [
  { id: "crash",   label: "Car crash",         color: 0xff6633, make: _makeCrash,   reach: 6,   repGain: 10, repLoss: 0,  ttl: 60, prompt: "⚠ Handle crash" },
  { id: "fight",   label: "Street fight",      color: 0xff3333, make: _makeFight,   reach: 4,   repGain: 8,  repLoss: 5,  ttl: 40, prompt: "✊ Break up fight" },
  { id: "fire",    label: "Fire",              color: 0xff8822, make: _makeFire,    reach: 5,   repGain: 15, repLoss: 10, ttl: 50, prompt: "🔥 Put out fire" },
  { id: "wallet",  label: "Lost wallet",       color: 0xffd76a, make: _makeWallet,  reach: 3,   repGain: 5,  repLoss: 0,  ttl: 90, prompt: "💼 Pick up wallet" },
  { id: "medical", label: "Medical emergency", color: 0xff4466, make: _makeMedical, reach: 4.5, repGain: 20, repLoss: 15, ttl: 45, prompt: "🚑 Help victim" },
];

function _dispose(ev) {
  if (ev.group && ev.group.parent) ev.group.parent.remove(ev.group);
  ev.group.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(m => m && m.dispose && m.dispose());
    }
  });
}

export const WorldEvents = {
  init(scene) {
    _scene = scene;
    _events = [];
    _spawnCd = 12;           // first event ~12 s in
  },

  _spawnOne(px, pz) {
    if (!_scene) return;
    const type = TYPES[Math.floor(Math.random() * TYPES.length)];

    let x = 0, z = 0, ok = false;
    for (let attempt = 0; attempt < 12 && !ok; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 80;
      x = px + Math.cos(ang) * dist;
      z = pz + Math.sin(ang) * dist;
      ok = x > BOUNDS.minX && x < BOUNDS.maxX && z > BOUNDS.minZ && z < BOUNDS.maxZ;
      const aabbs = window.__ph3d_world_aabbs;
      if (ok && aabbs) {
        for (const b of aabbs) {
          if (x > b.x - b.hx - 3 && x < b.x + b.hx + 3 &&
              z > b.z - b.hz - 3 && z < b.z + b.hz + 3) { ok = false; break; }
        }
      }
    }
    if (!ok) return;

    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const prop = type.make();
    group.add(prop);
    group.add(_beacon(type.color));
    const beacon = group.children[group.children.length - 1];
    _scene.add(group);

    _events.push({
      id: "ev_" + Math.random().toString(36).slice(2, 7),
      type: type.id, label: type.label,
      x, z, group, prop, beacon,
      reach: type.reach, repGain: type.repGain, repLoss: type.repLoss,
      prompt: type.prompt,
      expiresAt: performance.now() + type.ttl * 1000,
    });
    _toast("📍 " + type.label + " nearby");
  },

  tick(dt, px, pz) {
    if (!_scene) return;

    _spawnCd -= dt;
    if (_spawnCd <= 0) {
      _spawnCd = 45 + Math.random() * 45;
      if (_events.length < 3) this._spawnOne(px, pz);
    }

    const now = performance.now();
    for (let i = _events.length - 1; i >= 0; i--) {
      const ev = _events[i];
      const ud = ev.prop.userData;

      ev.beacon.material.opacity = 0.2 + 0.15 * Math.sin(now * 0.004);
      if (ud.flame) {
        ud.flame.scale.y = 1 + Math.sin(now * 0.008) * 0.18;
        ud.flame.scale.x = ud.flame.scale.z = 1 + Math.sin(now * 0.011) * 0.1;
      }
      if (ud.cross) ud.cross.rotation.y += dt * 1.5;
      if (ud.puffs) {
        for (const p of ud.puffs) {
          const t = ((now * 0.0004) + p.userData.phase) % 1;
          p.position.set(0.4 * Math.sin(t * 6 + p.userData.phase * 9), 1.4 + t * 4, 0.4 * Math.cos(t * 5));
          p.material.opacity = 0.5 * (1 - t);
          p.scale.setScalar(0.6 + t * 1.6);
        }
      }
      if (ud.fighters) {
        const k = Math.sin(now * 0.012);
        ud.fighters[0].position.x = -0.9 + Math.max(0, k) * 0.5;
        ud.fighters[1].position.x =  0.9 - Math.max(0, -k) * 0.5;
        ud.fighters[0].rotation.z = -0.15 * k;
        ud.fighters[1].rotation.z = -0.15 * k;
      }

      if (now > ev.expiresAt) {
        if (ev.repLoss > 0) {
          Rep.add(-ev.repLoss);
          _toast("😔 You ignored the " + ev.label.toLowerCase() + " · rep -" + ev.repLoss);
        }
        _dispose(ev);
        _events.splice(i, 1);
      }
    }
  },

  getActive() { return _events.slice(); },

  /* Closest event the player is close enough to handle */
  nearestInteractable(x, z) {
    let best = null, bestD = Infinity;
    for (const ev of _events) {
      const dx = ev.x - x, dz = ev.z - z;
      const d = dx * dx + dz * dz;
      const r = ev.reach + 1;
      if (d < r * r && d < bestD) { bestD = d; best = ev; }
    }
    return best;
  },

  interact(ev) {
    if (!ev || _events.indexOf(ev) < 0) return;

    Rep.add(ev.repGain);

    if (ev.type === "wallet") {
      try {
        const E = window.__ph3d_economy;
        if (E && E.receive) E.receive("WALLET", 5000, "found wallet");
      } catch (e) {}
      _toast("💼 Wallet returned · ₦5,000 reward · rep +" + ev.repGain);
    } else if (ev.type === "medical") {
      try {
        const C = window.__ph3d_combat;
        if (C && C.heal) C.heal(10);
      } catch (e) {}
      _toast("🚑 You helped · rep +" + ev.repGain + " · +10 HP");
    } else if (ev.type === "fire") {
      _toast("🔥 Fire out · rep +" + ev.repGain);
    } else if (ev.type === "fight") {
      _toast("✊ Fight broken up · rep +" + ev.repGain);
    } else {
      _toast("⚠ Crash handled · rep +" + ev.repGain);
    }

    _events.splice(_events.indexOf(ev), 1);
    _dispose(ev);
  },

  despawn() {
    for (const ev of _events) _dispose(ev);
    _events = [];
    _scene = null;
  },
};

