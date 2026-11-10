import * as THREE from "three";
import { Combat } from "./combat.js";
import { Multiplayer } from "./multiplayer.js";
import { Cats } from "./cats.js";
import { Sfx } from "./sfx.js";

export const WEAPONS = {
  pistol: {
    id: "pistol", name: "PISTOL", price: 45000,
    damage: 26, rpm: 260, magSize: 12, reloadMs: 1500,
    range: 60, spread: 0.012, auto: false, scope: false,
  },
  sniper: {
    id: "sniper", name: "SNIPER", price: 220000,
    damage: 92, rpm: 42, magSize: 5, reloadMs: 2800,
    range: 240, spread: 0.0008, auto: false, scope: true,
    scopeFov: 22,
  },
};

const KEYS = { owned: "ph3d.guns.owned", ammo: "ph3d.guns.ammo" };

export const Weapons = {
  owned: ["pistol"],       // start with a pistol
  ammo: {},                // id -> rounds in reserve
  current: "pistol",
  mags: {},                // id -> rounds in magazine
  _lastFire: 0,
  _reloading: 0,
  onAmmoChange: null,
  onFire: null,

  load() {
    try {
      const o = localStorage.getItem(KEYS.owned);
      if (o) this.owned = JSON.parse(o);
    } catch (e) {}
    try {
      const a = localStorage.getItem(KEYS.ammo);
      if (a) this.ammo = JSON.parse(a);
    } catch (e) {}
    for (const id of Object.keys(WEAPONS)) {
      if (this.ammo[id] == null) this.ammo[id] = id === "pistol" ? 48 : 0;
      if (this.mags[id] == null) this.mags[id] = WEAPONS[id].magSize;
    }
    return this;
  },
  save() {
    try {
      localStorage.setItem(KEYS.owned, JSON.stringify(this.owned));
      localStorage.setItem(KEYS.ammo, JSON.stringify(this.ammo));
    } catch (e) {}
  },
  buy(id) {
    if (!WEAPONS[id]) return false;
    if (this.owned.includes(id)) return false;
    const w = WEAPONS[id];
    const Eco = window.__ph3d_economy;
    if (!Eco) return false;
    if (Eco.balance < w.price) return false;
    Eco.withdraw(w.price);   // spends
    this.owned.push(id);
    this.ammo[id] = (id === "sniper" ? 15 : 60);
    this.save();
    return true;
  },
  select(id) {
    if (!this.owned.includes(id)) return false;
    this.current = id;
    return true;
  },

  canFire() {
    const w = WEAPONS[this.current];
    if (!w) return false;
    if (this._reloading > 0) return false;
    const now = performance.now();
    if (now - this._lastFire < 60000 / w.rpm) return false;
    if ((this.mags[this.current] || 0) <= 0) return false;
    return true;
  },

  fire(fromVec, dirVec, scene, remoteList) {
    if (!this.canFire()) {
      const w = WEAPONS[this.current];
      if ((this.mags[this.current] || 0) <= 0) this.reload();
      return null;
    }
    const w = WEAPONS[this.current];
    this._lastFire = performance.now();
    this.mags[this.current]--;

    // spread
    const dir = dirVec.clone();
    dir.x += (Math.random() - 0.5) * w.spread * 2;
    dir.y += (Math.random() - 0.5) * w.spread * 2;
    dir.z += (Math.random() - 0.5) * w.spread * 2;
    dir.normalize();

    // hitscan against remote players
    let hit = null;
    let bestT = w.range;
    if (remoteList && remoteList.length) {
      for (const o of remoteList) {
        const ox = o.x - fromVec.x;
        const oz = o.z - fromVec.z;
        const oy = (o.y || 1.0) - fromVec.y;
        const t = ox * dir.x + oy * dir.y + oz * dir.z;
        if (t < 0 || t > bestT) continue;
        const cx = fromVec.x + dir.x * t;
        const cy = fromVec.y + dir.y * t;
        const cz = fromVec.z + dir.z * t;
        const dx = cx - o.x, dy = cy - (o.y || 1.0), dz = cz - o.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        const r = o.kind === "bot" ? 0.55 : 0.45;
        if (d2 < r * r) {
          bestT = t;
          hit = { id: o.id, kind: o.kind, t, x: cx, y: cy, z: cz };
        }
      }
    }

   // cat hit test — only if no remote was hit first
if (!hit) {
  /* Check the standard Cats (from cats.js) */
  if (!hit) {
    const cat = Cats.hitTest(fromVec, dir, w.range);
    if (cat) {
      Cats.kill(cat.id);
      hit = { id: cat.id, kind: "cat", x: cat.x, z: cat.z };
    }
  }
}
    // damage
    if (hit) {
      if (hit.kind === "bot" && window.__ph3d_wave) {
        window.__ph3d_wave.hitBot(hit.id, w.damage);
      } else if (hit.kind === "remote") {
        Multiplayer.action("damage", { to: hit.id, amount: w.damage, kind: "gun:" + w.id });
      }
    }

    this.onAmmoChange && this.onAmmoChange(this.current, this.mags[this.current], this.ammo[this.current]);
    this.onFire && this.onFire(this.current, hit);
    return hit;
  },

  reload() {
    const w = WEAPONS[this.current];
    if (!w) return;
    const reserve = this.ammo[this.current] || 0;
    const need = w.magSize - (this.mags[this.current] || 0);
    if (need <= 0 || reserve <= 0) return;
    this._reloading = w.reloadMs;
    Sfx.play("reload_click");
    setTimeout(() => {
      const take = Math.min(need, this.ammo[this.current] || 0);
      this.mags[this.current] = (this.mags[this.current] || 0) + take;
      this.ammo[this.current] -= take;
      this._reloading = 0;
      this.save();
      this.onAmmoChange && this.onAmmoChange(this.current, this.mags[this.current], this.ammo[this.current]);
    }, w.reloadMs);
  },

  tick() {
    if (this._reloading > 0) this._reloading = Math.max(0, this._reloading - 16);
  },
};

/* expose weapon defs on the exported object for phone UI */
try { Weapons.WEAPONS = WEAPONS; } catch (e) {}

