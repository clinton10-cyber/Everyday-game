import * as THREE from "three";
import { Quality } from "./quality.js";
import { Pocket, POCKET_ITEMS } from "./pocket.js";
import { Multiplayer } from "./multiplayer.js";
import { Surfaces } from "./surfaces.js";
import { buildCat, tickCatModel, triggerCatReaction, PALETTE_NAMES } from "../characters/cat.js";

const CAT_NAMES = ["Whiskers","Shadow","Tigger","Momo","Biscuit","Pepper","Nala",
                   "Simba","Cleo","Oscar","Boots","Socks","Mittens","Muffin"];

const FOOD_IDS = ["jollof","egusi","pepper","suya","pounded","plantain","puffpuff","fish"];

function seededRandom(seed){
  let s = seed;
  return function(){
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const CAT_SCALE = 0.5;

export const Cats = {
  list: [],
  scene: null,
  player: null,
  _spawned: false,
  _lastBroadcast: 0,
  _audioCtx: null,

  /* Called by scenes */
  spawn(scene, count, seed, playerObj, opts){
    opts = opts || {};
    this.groundFn = opts.ground || null; this.blockedFn = opts.blocked || null;
    this.despawn();
    this.scene = scene;
    this.player = playerObj;
    const tier = Quality.current;
    const n = Math.min(count, tier.treeCount > 80 ? 8 : 5);
    const used = [];
    const rng = seededRandom(seed || 1337);

    for(let i=0;i<n;i++){
      let palName = PALETTE_NAMES[Math.floor(rng() * PALETTE_NAMES.length)];
      for (let k = 0; k < 6 && (palName === Cats._lastPal || used.includes(palName)); k++) palName = PALETTE_NAMES[Math.floor(Math.random() * PALETTE_NAMES.length)];
      used.push(palName); Cats._lastPal = palName;
      const model = buildCat(palName);
      const a = rng() * Math.PI * 2;
      const r = (opts.rMin != null ? opts.rMin : 15) + rng() * ((opts.rMax != null ? opts.rMax : 55) - (opts.rMin != null ? opts.rMin : 15));
      let cx0 = (opts.cx || 0) + Math.cos(a) * r, cz0 = (opts.cz || 0) + Math.sin(a) * r;
      for (let k = 0; k < 20 && this.blockedFn && this.blockedFn(cx0, cz0); k++) { const a2 = rng() * 6.283, r2 = 3 + rng() * 12; cx0 = (opts.cx || 0) + Math.cos(a2) * r2; cz0 = (opts.cz || 0) + Math.sin(a2) * r2; }
      const cat = {
        id: "cat_" + i,
        x: cx0,
        z: cz0,
        yaw: rng() * Math.PI * 2,
        state: "wander",
        palette: palName,
        tamed: false,
        tamedBy: null,
        name: CAT_NAMES[Math.floor(rng() * CAT_NAMES.length)],
        wanderTarget: null,
        wanderTimer: 0,
        alive: true,
        dying: 0,
        model: model,
        group: model.group,
      };
      cat.y = this.groundFn ? this.groundFn(cat.x, cat.z) : 0;
      model.group.position.set(cat.x, cat.y, cat.z);
      model.group.rotation.y = cat.yaw; model.group.userData.isNpc = true;
      model.group.scale.setScalar(CAT_SCALE); /* cats were too big: half size */
      scene.add(model.group);
      this.list.push(cat);
    }
    this._spawned = true;
    console.log("%c[cats]", "background:#ffb15c;color:#2a1400;font-weight:bold;padding:2px 6px;border-radius:4px",
      "spawned " + n + " cats");
  },

  despawn(){
    for(const c of this.list){
      if(c.group && c.group.parent) c.group.parent.remove(c.group);
      c.group.traverse(o => {
        if(o.geometry) o.geometry.dispose();
        if(o.material) o.material.dispose();
      });
    }
    this.list = [];
    this._spawned = false;
  },

  nearest(px, pz, maxDist){
    let best = null, bestD = maxDist * maxDist;
    for(const c of this.list){
      if(!c.alive) continue;
      const dx = c.x - px, dz = c.z - pz;
      const d = dx*dx + dz*dz;
      if(d < bestD){ bestD = d; best = c; }
    }
    return best;
  },

  /* Feed the cat — tames it and makes it follow you */
  feed(cat, foodId){
    if(!cat || !cat.alive) return { ok:false, reason:"no_cat" };
    const slot = Pocket.slots.findIndex(s => s && s.id === foodId);
    if(slot < 0) return { ok:false, reason:"not_in_pocket" };
    Pocket.remove(slot);
    cat.tamed = true;
    cat.tamedBy = Multiplayer.self ? Multiplayer.self.id : "me";
    cat.state = "follow";
    triggerCatReaction(cat.model);
    this.meow(cat);
    if(Multiplayer.ready){
      Multiplayer.action("cat-tame", { catId: cat.id, foodId });
    }
    return { ok:true, cat };
  },

  /* Pet — just a little reaction */
  pet(cat){
    if(!cat || !cat.alive) return { ok:false };
    triggerCatReaction(cat.model);
    this.meow(cat);
    return { ok:true };
  },

  /* Call a tamed cat to follow */
  call(cat){
    if(!cat || !cat.alive) return { ok:false };
    if(!cat.tamed) return { ok:false, reason:"not_tamed" };
    cat.state = "follow";
    cat.wanderTarget = null;
    this.meow(cat);
    return { ok:true };
  },

  /* Kill — used by weapons and crime system */
  kill(catId, byId){
    const c = this.list.find(x => x.id === catId);
    if(!c || !c.alive) return false;
    c.alive = false;
    c.dying = 2.5;
    if(Multiplayer.ready){
      Multiplayer.action("cat-kill", { catId, by: byId || (Multiplayer.self && Multiplayer.self.id) });
    }
    if(window.__ph3d_crime && byId === (Multiplayer.self && Multiplayer.self.id)){
      window.__ph3d_crime.addEvent("kill", 25, "You");
    }
    return true;
  },

  /* Sit on nearest surface (Surfaces must be registered) */
  sitOnNearestSurface(cat){
    if(!cat || !cat.alive) return false;
    const hit = Surfaces.findTop(cat.x, cat.z, 0.5);
    if(hit){
      cat.state = "sit";
      cat.surface = hit.surface;
      cat.y = hit.y + 0.11;
    } else {
      cat.state = "sit";
      cat.y = 0;
    }
    return true;
  },

  meow(cat){
    try {
      if(!this._audioCtx) this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = this._audioCtx.createOscillator();
      const gain = this._audioCtx.createGain();
      osc.type = "sine";
      const now = this._audioCtx.currentTime;
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(820, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(560, now + 0.22);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain).connect(this._audioCtx.destination);
      osc.start(); osc.stop(now + 0.3);
    } catch(e) {}
  },

  tick(dt, time){
    if(!this._spawned || !this.player) return;

    for(const c of this.list){
      if(!c.alive){
        c.dying -= dt;
        if(c.dying <= 0 && c.group.parent){
          c.group.parent.remove(c.group);
          c.group.traverse(o => {
            if(o.geometry) o.geometry.dispose();
            if(o.material) o.material.dispose();
          });
        } else {
          c.group.rotation.z += dt * 4;
          c.group.position.y = Math.max(0, c.group.position.y - dt * 0.8);
        }
        continue;
      }

      const px0 = c.x, pz0 = c.z;
      const dx = this.player.x - c.x;
      const dz = this.player.z - c.z;
      const dist = Math.sqrt(dx*dx + dz*dz);

      /* transitions */
      if(c.tamed && c.state !== "follow" && c.state !== "sit") c.state = "follow";
      if(!c.tamed && c.state === "wander" && dist < 2.2) c.state = "flee";
      if(!c.tamed && c.state === "flee" && dist > 8) c.state = "wander";

      /* motion */
      let motion = 0;
      if(c.state === "wander"){
        c.wanderTimer -= dt;
        if(!c.wanderTarget || c.wanderTimer <= 0){
          const a = Math.random() * Math.PI * 2;
          const r = 3 + Math.random() * 8;
          c.wanderTarget = { x: c.x + Math.cos(a)*r, z: c.z + Math.sin(a)*r };
          c.wanderTimer = 3 + Math.random() * 3;
        }
        const tx = c.wanderTarget.x - c.x;
        const tz = c.wanderTarget.z - c.z;
        const td = Math.hypot(tx, tz);
        if(td > 0.3){
          c.x += (tx/td) * 0.9 * dt;
          c.z += (tz/td) * 0.9 * dt;
          c.yaw = Math.atan2(tx, tz);
          motion = 1;
        } else c.wanderTarget = null;
      } else if(c.state === "flee"){
        const fd = Math.max(0.01, dist);
        c.x -= (dx/fd) * 3.2 * dt;
        c.z -= (dz/fd) * 3.2 * dt;
        c.yaw = Math.atan2(-dx, -dz);
        motion = 2;
      } else if(c.state === "follow"){
        if(dist > 2.2){
          c.x += (dx/dist) * 1.8 * dt;
          c.z += (dz/dist) * 1.8 * dt;
          c.yaw = Math.atan2(dx, dz);
          motion = 1;
        } else if(dist < 1.4){
          c.x -= (dx/dist) * 0.7 * dt;
          c.z -= (dz/dist) * 0.7 * dt;
          motion = 1;
        }
      }

      if(this.blockedFn && (c.x !== px0 || c.z !== pz0) && this.blockedFn(c.x, c.z)){ c.x = px0; c.z = pz0; c.wanderTarget = null; motion = 0; }
      /* ground Y — respect surface if sitting */
      if(c.state === "sit" && c.surface){
        /* keep y */
      } else {
        c.y = this.groundFn ? this.groundFn(c.x, c.z) : 0;
      }

      c.group.position.set(c.x, c.y, c.z);
      c.group.rotation.y = c.yaw;

      /* advance animation */
      tickCatModel(c.model, dt, time, motion);
    }

    /* broadcast positions to other players */
    if(Multiplayer.ready){
      const now = performance.now();
      if(now - this._lastBroadcast > 250){
        this._lastBroadcast = now;
        Multiplayer._send({
          t: "cat-state",
          id: Multiplayer.self.id,
          cats: this.list.map(c => ({ id:c.id, x:c.x, z:c.z, yaw:c.yaw, alive:c.alive })),
        });
      }
    }
  },

  applyRemote(msg){
    if(!msg || !msg.cats) return;
    for(const r of msg.cats){
      const c = this.list.find(x => x.id === r.id);
      if(!c) continue;
      c.x = r.x; c.z = r.z; c.yaw = r.yaw;
      if(r.alive === false && c.alive){
        c.alive = false;
        c.dying = 2.5;
      }
    }
  },

  tamedByPlayer(catId, playerId){
    const c = this.list.find(x => x.id === catId);
    if(!c) return;
    c.tamed = true;
    c.tamedBy = playerId;
    c.state = "follow";
  },

  /* Used by weapons.js hitscan */
  hitTest(fromVec, dirVec, range){
    let best = null, bestT = range;
    for(const c of this.list){
      if(!c.alive) continue;
      const ox = c.x - fromVec.x;
      const oz = c.z - fromVec.z;
      const oy = 0.4 - fromVec.y;
      const t = ox*dirVec.x + oy*dirVec.y + oz*dirVec.z;
      if(t < 0 || t > bestT) continue;
      const cx = fromVec.x + dirVec.x*t;
      const cy = fromVec.y + dirVec.y*t;
      const cz = fromVec.z + dirVec.z*t;
      const dx = cx - c.x, dy = cy - 0.4, dz = cz - c.z;
      if(dx*dx + dy*dy + dz*dz < 0.36){
        bestT = t;
        best = c;
      }
    }
    return best;
  },
};

