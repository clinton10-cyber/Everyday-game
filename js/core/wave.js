import * as THREE from "three";
import { Quality } from "./quality.js";
import { Combat } from "./combat.js";

const BOT_RADIUS = 0.5;
const BOT_HEIGHT = 1.7;

export const Wave = {
  bots: [],
  wave: 0,
  alive: 0,
  kills: 0,
  spawnPulse: 0,
  onKill: null,
  onWave: null,
  onBotHit: null,
  onBotShoot: null,
  arenaRadius: 60,
  running: false,

  start(scene) {
    this.scene = scene;
    this.bots = [];
    this.wave = 0;
    this.kills = 0;
    this.running = true;
    this.nextWave();
  },

  stop() {
    this.running = false;
    for (const b of this.bots) this._dispose(b);
    this.bots.length = 0;
  },

  nextWave() {
    this.wave++;
    const n = Math.min(14, 2 + this.wave);
    this.onWave && this.onWave(this.wave);
    for (let i = 0; i < n; i++) this._spawn(i * 0.4);
    this.alive = n;
  },

  /* Cheap humanoid bot: 4 boxes + 1 sphere. Runs on 2GB. */
  _makeBot() {
    const g = new THREE.Group();
    const M = new THREE.MeshLambertMaterial({ color: 0xb03030 });
    const Md = new THREE.MeshLambertMaterial({ color: 0x301010 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), M);
    head.position.y = 1.5; g.add(head);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.3), M);
    torso.position.y = 1.05; g.add(torso);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.28), Md);
    legs.position.y = 0.45; g.add(legs);
    return g;
  },

  _spawn(delay) {
    const a = Math.random() * Math.PI * 2;
    const r = this.arenaRadius * (0.75 + Math.random() * 0.2);
    const bot = {
      id: "bot_" + Math.random().toString(36).slice(2, 7),
      group: this._makeBot(),
      hp: 60 + this.wave * 8,
      maxHp: 60 + this.wave * 8,
      speed: 1.8 + Math.min(1.8, this.wave * 0.15),
      fireCd: 900 + Math.random() * 700,
      spawnT: delay,
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      yaw: 0,
      alive: true,
    };
    bot.group.position.set(bot.x, 0, bot.z);
    bot.group.visible = false;
    this.scene.add(bot.group);
    this.bots.push(bot);
    setTimeout(() => { bot.group.visible = true; }, delay * 1000);
  },

  hitBot(id, dmg) {
    const b = this.bots.find(x => x.id === id);
    if (!b || !b.alive) return false;
    b.hp -= dmg;
    this.onBotHit && this.onBotHit(b);
    if (b.hp <= 0) {
      b.alive = false;
      this.alive--;
      this.kills++;
      this.onKill && this.onKill(b);
      // fade out cheaply
      b.group.visible = false;
      setTimeout(() => this._dispose(b), 600);
      if (this.alive <= 0) setTimeout(() => this.nextWave(), 1500);
    }
    return true;
  },

  _dispose(b) {
    if (b.group.parent) b.group.parent.remove(b.group);
    b.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
    });
    const idx = this.bots.indexOf(b);
    if (idx >= 0) this.bots.splice(idx, 1);
  },

  tick(dt, meX, meZ) {
    if (!this.running) return;
    for (const b of this.bots) {
      if (!b.alive) continue;
      // chase player
      const dx = meX - b.x, dz = meZ - b.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01) {
        b.yaw = Math.atan2(dx, dz);
        b.group.rotation.y = b.yaw;
      }
      if (d > 3) {
        b.x += (dx / d) * b.speed * dt;
        b.z += (dz / d) * b.speed * dt;
      }
      b.group.position.set(b.x, 0, b.z);

      // fire at player
      b.fireCd -= dt * 1000;
      if (b.fireCd <= 0 && d < 20) {
        b.fireCd = 900 + Math.random() * 900;
        this.onBotShoot && this.onBotShoot(b, d);
      }
    }
  },
};

