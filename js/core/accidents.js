import * as THREE from "three";
import { Combat } from "./combat.js";
import { Multiplayer } from "./multiplayer.js";

const COOLDOWN_MS = 2200;

export const Accidents = {
  _cd: new Map(),      // "a|b" -> timestamp

  _key(a, b) { return a < b ? a + "|" + b : b + "|" + a; },

  canFire(a, b) {
    const k = this._key(a, b);
    const t = this._cd.get(k) || 0;
    if (performance.now() - t < COOLDOWN_MS) return false;
    this._cd.set(k, performance.now());
    return true;
  },

  /* Return list of damage events between me and remote avatars.
     me = { id, x, z, radius, speed, kind: "car"|"character" }
     others = list from RemoteAvatars.collideList() */
  check(me, others) {
    const events = [];
    for (const o of others) {
      const dx = o.x - me.x, dz = o.z - me.z;
      const dist = Math.hypot(dx, dz);
      const threshold = me.radius + o.radius;
      if (dist > threshold) continue;
      if (!this.canFire(me.id, o.id)) continue;

      let dmgToMe = 0, dmgToOther = 0, kind = "bump";

      if (me.kind === "car" && o.kind === "car") {
        const rel = Math.max(0, me.speed - o.speed);
        dmgToMe    = Math.min(55, rel * 3.5 + 4);
        dmgToOther = dmgToMe;
        kind = "car-crash";
      } else if (me.kind === "car" && o.kind === "character") {
        dmgToMe    = Math.min(12, me.speed * 0.8);
        dmgToOther = Math.min(100, 18 + me.speed * 6);
        kind = "car-hit-walker";
      } else if (me.kind === "character" && o.kind === "car") {
        dmgToMe    = Math.min(100, 18 + o.speed * 6);
        dmgToOther = Math.min(12, o.speed * 0.8);
        kind = "walker-hit-by-car";
      } else {
        dmgToMe = 5; dmgToOther = 5;
        kind = "shove";
      }

      events.push({
        id: o.id,
        kind,
        dmgToMe: Math.round(dmgToMe),
        dmgToOther: Math.round(dmgToOther),
        x: me.x + (o.x - me.x) * 0.5,
        z: me.z + (o.z - me.z) * 0.5,
      });
    }
    return events;
  },

  /* Apply damage locally + broadcast to the other player. */
  apply(event) {
    if (event.dmgToMe > 0) {
      Combat.damage(event.dmgToMe, "accident:" + event.id);
      Combat.flash && Combat.flash(event.dmgToMe / 60);
      if (window.__ph3d_phone) window.__ph3d_phone._toast("💥 " + this._label(event.kind) + " (−" + event.dmgToMe + " HP)");
    }
    if (event.dmgToOther > 0) {
      Multiplayer.action("damage", {
        to: event.id,
        amount: event.dmgToOther,
        kind: event.kind,
      });
    }
  },

  _label(kind) {
    return {
      "car-crash": "CRASH",
      "car-hit-walker": "HIT PEDESTRIAN",
      "walker-hit-by-car": "STRUCK BY CAR",
      "shove": "BUMP",
    }[kind] || "IMPACT";
  },
};

/* Simple particle burst (called by scenes on collision) */
export function spawnSparks(parent, x, y, z, color = 0xffcc5e) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
  const geo = new THREE.SphereGeometry(0.09, 5, 4);
  const parts = [];
  for (let i = 0; i < 14; i++) {
    const p = new THREE.Mesh(geo, mat.clone());
    p.userData.v = new THREE.Vector3(
      (Math.random() - 0.5) * 9,
      Math.random() * 7 + 1,
      (Math.random() - 0.5) * 9
    );
    group.add(p);
    parts.push(p);
  }
  parent.add(group);
  const start = performance.now();
  const tick = () => {
    const dt = 0.016;
    let alive = 0;
    for (const p of parts) {
      p.userData.v.y -= 14 * dt;
      p.position.addScaledVector(p.userData.v, dt);
      p.material.opacity = Math.max(0, p.material.opacity - dt * 1.6);
      if (p.material.opacity > 0) alive++;
    }
    if (alive > 0 && performance.now() - start < 900) {
      requestAnimationFrame(tick);
    } else {
      parent.remove(group);
      parts.forEach(p => { p.geometry.dispose(); p.material.dispose(); });
      geo.dispose();
      mat.dispose();
    }
  };
  tick();
}

