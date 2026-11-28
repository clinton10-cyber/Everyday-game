/* ════════════════════════════════════════════════════════════════
   crash-fx.js — dramatic accident / explosion effects.

   One small module every crash source talks to:
     • car ↔ car, car ↔ wall, car ↔ person   → impact()
     • bazooka rocket, exploding wreck        → explosion() + blast()
   It draws: sparks, glass + metal debris, smoke, fireballs, shockwave
   rings, scorch marks, burning wrecks (fire + black smoke), screen
   flash / red damage vignette, camera shake and a short slow-motion
   "hit-stop".

   blast(pos, opts) is the single entry point for "something just blew
   up here": every system that can be hurt registers a handler with
   onBlast() (NPC cars, pedestrians, the player, the player's car), so
   the bazooka (or anything else) never needs to know about them.

   All calls are safe no-ops until init() has been called, so shared
   code can call CrashFX from interiors too.
   ════════════════════════════════════════════════════════════════ */
import * as THREE from "three";
import { Sfx } from "./sfx.js";

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const MAX_PARTS = 240;      /* live sprites (fire/smoke/sparks) */
const MAX_DEBRIS = 64;      /* live debris meshes */
const MAX_SCORCH = 8;

let scene = null, camera = null;
const parts = [];           /* sprite particles */
const free = [];            /* pooled sprites */
const rings = [];           /* shockwave rings + flash spheres */
const debris = [];
const fires = [];           /* burning emitters */
const scorches = [];
const handlers = [];

/* shared assets (created lazily, disposed in dispose()) */
let _puff = null, _scorch = null, _boxGeo = null, _wheelGeo = null;
let _matMetal = null, _matGlass = null, _matRubber = null;

function puffTex() {
  if (_puff) return _puff;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.45, "rgba(255,255,255,0.55)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  _puff = new THREE.CanvasTexture(c);
  return _puff;
}
function scorchTex() {
  if (_scorch) return _scorch;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  r.addColorStop(0, "rgba(8,8,8,0.95)"); r.addColorStop(0.6, "rgba(15,12,10,0.7)"); r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  _scorch = new THREE.CanvasTexture(c);
  return _scorch;
}
function assets() {
  if (_boxGeo) return;
  _boxGeo = new THREE.BoxGeometry(1, 1, 1);
  _wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14); _wheelGeo.rotateZ(Math.PI / 2);
  _matMetal = new THREE.MeshStandardMaterial({ color: 0x4a4e54, metalness: 0.8, roughness: 0.5 });
  _matGlass = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.55 });
  _matRubber = new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.95 });
}

/* ───────── sprite particles ───────── */
function spawn(o) {
  if (!scene || parts.length >= MAX_PARTS) return;
  let s = free.pop();
  if (!s) {
    s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex(), transparent: true, depthWrite: false }));
    s.renderOrder = 5;
  }
  s.material.blending = o.add ? THREE.AdditiveBlending : THREE.NormalBlending;
  s.material.color.setHex(o.c0); s.material.opacity = o.a || 1;
  s.material.rotation = Math.random() * 6.28;
  s.position.copy(o.pos); s.scale.setScalar(o.s0); s.visible = true;
  scene.add(s);
  parts.push({ s, t: 0, life: o.life, v: o.vel, s0: o.s0, s1: o.s1, c0: new THREE.Color(o.c0), c1: new THREE.Color(o.c1), drag: o.drag == null ? 1.5 : o.drag, grav: o.grav || 0, a: o.a || 1 });
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const dirRand = (ymin = -0.3, ymax = 1) => V(rnd(-1, 1), rnd(ymin, ymax), rnd(-1, 1)).normalize();

/* ───────── screen overlay (flash / damage vignette) ───────── */
let _ov = null;
function overlay() {
  if (_ov && _ov.isConnected) return _ov;
  _ov = document.createElement("div");
  _ov.id = "ph3d-crashfx-flash";
  _ov.style.cssText = "position:fixed;inset:0;z-index:119;pointer-events:none;opacity:0;";
  document.body.appendChild(_ov);
  return _ov;
}
function flash(background, alpha, dur) {
  try {
    const el = overlay();
    el.style.transition = "none"; el.style.background = background; el.style.opacity = String(alpha);
    void el.offsetWidth;
    el.style.transition = "opacity " + dur + "s ease-out"; el.style.opacity = "0";
  } catch (e) {}
}

/* ───────── camera shake + slow motion ───────── */
const SH = { amt: 0, t: 0, dur: 0.01, ox: 0, oy: 0, oz: 0 };
const SL = { scale: 1, t: 0, dur: 0.01 };

function camDist(x, z) {
  if (!camera) return 999;
  return Math.hypot(camera.position.x - x, camera.position.z - z);
}

export const CrashFX = {
  /* ── lifecycle ── */
  init(sc, cam) {
    this.dispose();
    scene = sc; camera = cam;
  },
  dispose() {
    if (scene) {
      for (const p of parts) { scene.remove(p.s); p.s.material.dispose(); }
      for (const s of free) s.material.dispose();
      for (const d of debris) scene.remove(d.m);
      for (const r of rings) { scene.remove(r.o); r.o.geometry.dispose(); r.m.dispose(); }
      for (const s of scorches) { scene.remove(s); s.geometry.dispose(); s.material.dispose(); }
    }
    parts.length = 0; free.length = 0; debris.length = 0; rings.length = 0; fires.length = 0; scorches.length = 0;
    handlers.length = 0;
    SH.amt = 0; SH.t = 0; SL.scale = 1; SL.t = 0;
    if (_ov) { try { _ov.remove(); } catch (e) {} _ov = null; }
    for (const t of [_puff, _scorch]) if (t) t.dispose();
    for (const g of [_boxGeo, _wheelGeo]) if (g) g.dispose();
    for (const m of [_matMetal, _matGlass, _matRubber]) if (m) m.dispose();
    _puff = _scorch = _boxGeo = _wheelGeo = _matMetal = _matGlass = _matRubber = null;
    scene = null; camera = null;
  },
  get ready() { return !!scene; },

  /* ── per-frame hooks used by the scene's update(): returns the dt the world should use ── */
  beforeFrame(dt, cam) {
    const c = cam || camera;
    if (c && (SH.ox || SH.oy || SH.oz)) { c.position.x -= SH.ox; c.position.y -= SH.oy; c.position.z -= SH.oz; }
    SH.ox = SH.oy = SH.oz = 0;
    if (SH.t > 0) SH.t = Math.max(0, SH.t - dt);
    let k = 1;
    if (SL.t > 0) {
      SL.t = Math.max(0, SL.t - dt);
      const e = 1 - SL.t / SL.dur;                       /* 0 → 1 over the slow-mo */
      k = e < 0.4 ? SL.scale : SL.scale + (1 - SL.scale) * Math.pow((e - 0.4) / 0.6, 2);
    }
    return dt * k;
  },
  afterFrame(cam) {
    const c = cam || camera;
    if (!c || SH.t <= 0) return;
    const f = SH.t / SH.dur, a = SH.amt * f * f;
    SH.ox = rnd(-1, 1) * a; SH.oy = rnd(-1, 1) * a * 0.7; SH.oz = rnd(-1, 1) * a;
    c.position.x += SH.ox; c.position.y += SH.oy; c.position.z += SH.oz;
  },
  shake(amount, dur) {
    return;   /* camera shake removed */
    dur = dur || 0.5;
    const cur = SH.t > 0 ? SH.amt * Math.pow(SH.t / SH.dur, 2) : 0;
    if (amount >= cur) { SH.amt = amount; SH.dur = dur; SH.t = dur; }
  },
  shakeFrom(x, z, power) {
    return;   /* camera shake removed */
    const d = camDist(x, z);
    const amp = power * 1.1 * Math.max(0, 1 - d / 28);   /* was 50: far-off traffic bumps no longer shake the camera */
    if (amp > 0.12) this.shake(Math.min(1.6, amp), 0.35 + power * 0.55);
  },
  slowmo(scale, dur) {
    if (SL.t > 0 && scale > SL.scale && SL.t > dur * 0.5) return;
    SL.scale = scale; SL.dur = dur; SL.t = dur;
  },
  flash(color, alpha, dur) { flash(color || "#fff", alpha == null ? 0.5 : alpha, dur || 0.4); },
  /* red "you are hurt" vignette */
  hurt(power) {
    power = clamp(power == null ? 0.6 : power, 0.15, 1);
    flash("radial-gradient(ellipse at center, rgba(120,0,0,0) 30%, rgba(170,0,0," + (0.55 + 0.4 * power).toFixed(2) + ") 100%)", 0.55 + 0.45 * power, 0.9 + power * 0.8);
  },

  /* ── per-frame update of particles / debris / fires ── */
  tick(dt) {
    if (!scene) return;
    dt = Math.min(dt, 0.1);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) { scene.remove(p.s); p.s.visible = false; free.push(p.s); parts.splice(i, 1); continue; }
      p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt)); p.v.y += p.grav * dt;
      p.s.position.addScaledVector(p.v, dt);
      p.s.scale.setScalar(p.s0 + (p.s1 - p.s0) * (1 - Math.pow(1 - k, 3)));
      p.s.material.color.copy(p.c0).lerp(p.c1, k);
      const a = k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9;
      p.s.material.opacity = Math.max(0, a) * p.a;
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.t += dt; const k = r.t / r.max;
      if (k >= 1) { scene.remove(r.o); r.o.geometry.dispose(); r.m.dispose(); rings.splice(i, 1); continue; }
      r.o.scale.setScalar(0.4 + (r.s1 - 0.4) * (1 - Math.pow(1 - k, 2.4)));
      r.m.opacity = 1 - k;
    }
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i]; d.t += dt;
      if (d.t > d.life) { scene.remove(d.m); debris.splice(i, 1); continue; }
      const m = d.m;
      if (!d.rest) {
        d.vy -= 18 * dt;
        m.position.x += d.vx * dt; m.position.y += d.vy * dt; m.position.z += d.vz * dt;
        m.rotation.x += d.sx * dt; m.rotation.y += d.sy * dt; m.rotation.z += d.sz * dt;
        if (m.position.y <= d.gy + d.h && d.vy < 0) {
          m.position.y = d.gy + d.h;
          d.vy *= -0.38; d.vx *= 0.7; d.vz *= 0.7; d.sx *= 0.6; d.sy *= 0.6; d.sz *= 0.6;
          if (Math.abs(d.vy) < 1.2) { d.rest = true; d.vy = 0; }
        }
      }
      const left = d.life - d.t;
      if (left < 1) m.scale.setScalar(Math.max(0.01, left)).multiply(d.base);
    }
    for (let i = fires.length - 1; i >= 0; i--) {
      const f = fires[i];
      if (f.stopped) { fires.splice(i, 1); continue; }
      f.t += dt;
      if (f.t >= f.life) { fires.splice(i, 1); continue; }
      if (f.follow) { f.x = f.follow.position.x; f.y = f.follow.position.y + f.off; f.z = f.follow.position.z; }
      const power = f.t > f.life - 4 ? (f.life - f.t) / 4 : 1;
      f.aF += dt; f.aS += dt;
      while (!f.smokeOnly && f.aF > 0.05 / f.scale) {
        f.aF -= 0.05 / f.scale;
        if (Math.random() > power) continue;
        spawn({ pos: V(f.x + rnd(-0.5, 0.5) * f.scale, f.y, f.z + rnd(-0.5, 0.5) * f.scale), vel: V(rnd(-0.4, 0.4), rnd(1.5, 3.2), rnd(-0.4, 0.4)), s0: rnd(0.6, 1.1) * f.scale, s1: rnd(0.2, 0.5) * f.scale, life: rnd(0.45, 0.8), c0: 0xffc060, c1: 0xd02a00, drag: 0.6, add: true, a: 0.85 });
      }
      while (f.aS > 0.11 / f.scale) {
        f.aS -= 0.11 / f.scale;
        spawn({ pos: V(f.x + rnd(-0.4, 0.4), f.y + 0.9 * f.scale, f.z + rnd(-0.4, 0.4)), vel: V(rnd(-0.6, 0.6) + (f.wind || 0), rnd(1.8, 3.6), rnd(-0.6, 0.6)), s0: rnd(0.8, 1.4) * f.scale, s1: rnd(3, 5.5) * f.scale, life: rnd(2.2, 3.6) * (0.6 + power * 0.4), c0: f.smokeOnly ? 0x9a948c : 0x3a3633, c1: 0x0e0f11, drag: 0.35, grav: 0.4, a: (f.smokeOnly ? 0.45 : 0.6) * power });
      }
    }
  },

  /* ── building blocks ── */
  sparks(x, y, z, n, dir) {
    for (let i = 0; i < n; i++) {
      const d = dirRand(0, 1.1);
      if (dir) d.add(V(dir.x, 0, dir.z).multiplyScalar(0.8)).normalize();
      spawn({ pos: V(x, y, z), vel: d.multiplyScalar(rnd(5, 17)), s0: 0.16, s1: 0.04, life: rnd(0.3, 0.8), c0: 0xffe090, c1: 0xff3000, drag: 0.8, grav: -16, add: true });
    }
  },
  smoke(x, y, z, o) {
    o = o || {};
    for (let i = 0; i < (o.count || 6); i++) {
      spawn({ pos: V(x + rnd(-0.5, 0.5), y, z + rnd(-0.5, 0.5)), vel: dirRand(0.1, 1).multiplyScalar(rnd(0.6, 2.4) * (o.speed || 1)), s0: rnd(0.6, 1.1) * (o.size || 1), s1: rnd(2.4, 4.5) * (o.size || 1), life: rnd(1.2, 2.4), c0: o.c0 || 0x8c867e, c1: o.c1 || 0x24262a, drag: 0.8, grav: 0.5, a: o.a || 0.6 });
    }
  },
  debris(x, y, z, o) {
    if (!scene) return;
    assets(); o = o || {};
    const n = Math.min(o.count || 10, MAX_DEBRIS);
    const gy = o.groundY || 0;
    const panel = new THREE.MeshStandardMaterial({ color: o.color != null ? o.color : 0x777777, metalness: 0.6, roughness: 0.45 });
    for (let i = 0; i < n; i++) {
      if (debris.length >= MAX_DEBRIS) { const old = debris.shift(); scene.remove(old.m); }
      const kind = Math.random();
      const isGlass = kind < 0.3, isPanel = kind > 0.62;
      const m = new THREE.Mesh(_boxGeo, isGlass ? _matGlass : isPanel ? panel : _matMetal);
      const sz = isGlass ? rnd(0.06, 0.2) : isPanel ? rnd(0.25, 0.7) : rnd(0.1, 0.3);
      const base = V(sz, isGlass ? 0.02 : sz * rnd(0.12, 0.5), sz * rnd(0.5, 1));
      m.scale.copy(base);
      m.position.set(x + rnd(-0.4, 0.4), y + rnd(0, 0.5), z + rnd(-0.4, 0.4));
      m.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6));
      scene.add(m);
      const d = dirRand(0.2, 1.3).multiplyScalar(rnd(4, 13) * (o.power || 1));
      debris.push({ m, base, vx: d.x, vy: d.y, vz: d.z, sx: rnd(-12, 12), sy: rnd(-12, 12), sz: rnd(-12, 12), t: 0, life: rnd(5, 8), gy, h: 0.03, rest: false });
    }
    if (o.wheels) {
      for (let i = 0; i < o.wheels; i++) {
        const m = new THREE.Mesh(_wheelGeo, _matRubber);
        m.position.set(x + rnd(-0.8, 0.8), y + 0.4, z + rnd(-0.8, 0.8));
        scene.add(m);
        const d = dirRand(0.5, 1.4).multiplyScalar(rnd(6, 11));
        debris.push({ m, base: V(1, 1, 1), vx: d.x, vy: d.y, vz: d.z, sx: rnd(-9, 9), sy: rnd(-3, 3), sz: rnd(-9, 9), t: 0, life: 9, gy, h: 0.34, rest: false });
      }
    }
  },
  scorch(x, y, z, size) {
    if (!scene) return;
    const m = new THREE.MeshBasicMaterial({ map: scorchTex(), transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
    p.rotation.x = -Math.PI / 2; p.rotation.z = Math.random() * 6.28;
    p.position.set(x, y + 0.03, z); p.scale.setScalar(size || 5);
    scene.add(p); scorches.push(p);
    while (scorches.length > MAX_SCORCH) { const o = scorches.shift(); scene.remove(o); o.geometry.dispose(); o.material.dispose(); }
  },
  /* burning emitter: flames + black smoke. follow = an Object3D to stick to (a wreck). Returns a handle. */
  fire(x, y, z, o) {
    if (!scene) return null;
    o = o || {};
    const f = { x, y, z, t: 0, life: o.life || 22, scale: o.scale || 1, follow: o.follow || null, off: o.offsetY == null ? 0.7 : o.offsetY, smokeOnly: !!o.smokeOnly, aF: 0, aS: 0, wind: rnd(-0.4, 0.4), stopped: false };
    fires.push(f);
    return f;
  },
  stopFire(h) { if (h) h.stopped = true; },

  /* dark, burnt paint on a car/model. Returns restore(). */
  charCar(root) {
    const saved = [];
    try {
      root.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const list = Array.isArray(o.material) ? o.material : [o.material];
        const orig = o.material;
        const clones = list.map((m) => {
          const c = m.clone();
          if (c.color) c.color.lerp(new THREE.Color(0x0c0b0a), 0.88);
          if (c.emissive) c.emissive.setHex(0x000000);
          if (c.map && !m.transparent) c.map = null;
          if (c.metalness != null) c.metalness = 0.2;
          if (c.roughness != null) c.roughness = 0.95;
          if (m.transparent) { c.opacity = Math.min(c.opacity == null ? 1 : c.opacity, 0.35); }
          return c;
        });
        o.material = Array.isArray(orig) ? clones : clones[0];
        saved.push({ o, orig, clones });
      });
    } catch (e) {}
    return function restore() {
      for (const s of saved) { try { s.o.material = s.orig; s.clones.forEach((c) => c.dispose()); } catch (e) {} }
      saved.length = 0;
    };
  },

  /* ── composite effects ── */

  /* a collision: sparks, glass, dust, shake, short hit-stop. power 0..1.3 */
  impact(x, y, z, o) {
    if (!scene) return;
    o = o || {};
    const p = clamp(o.power == null ? 0.5 : o.power, 0.1, 1.3);
    if (o.dust) {                                              /* a person was hit: only a puff of dust — no sparks, glass or flying debris */
      this.smoke(x, y - 0.4, z, { count: Math.round(3 + p * 5), size: 0.9, a: 0.5, c0: 0xb8a88c, c1: 0x6d6556 });
      this.shakeFrom(x, z, 0.2 + p * 0.3);
      return;
    }
    this.sparks(x, y, z, Math.round(6 + p * 22), o.dir);
    this.smoke(x, y, z, { count: Math.round(2 + p * 5), size: 0.8, a: 0.45 });
    if (p > 0.3) this.debris(x, y, z, { count: Math.round(3 + p * 9), color: o.color, power: 0.5 + p * 0.4, groundY: o.groundY });
    const d = camDist(x, z);
    if (!o.noShake) this.shakeFrom(x, z, (0.25 + p * 0.9) * (o.shakeScale == null ? 1 : o.shakeScale));
    if (p > 0.55 && d < 30) this.slowmo(p > 0.9 ? 0.25 : 0.4, 0.2 + p * 0.15);
    if (p > 0.45 && d < 20) this.flash("#fff", 0.12 + p * 0.18, 0.25);
    try { Sfx.play(p > 0.6 ? "car_crash_heavy" : "car_crash_light", { x, z }); } catch (e) {}
    try { if (d < 20 && p > 0.5) navigator.vibrate && navigator.vibrate(p > 0.9 ? [60, 30, 90] : 50); } catch (e) {}
  },

  /* a vehicle-sized fireball with flying panels and wheels. scale 1 = car */
  explosion(x, y, z, o) {
    if (!scene) return;
    o = o || {};
    const s = o.scale || 1;
    const P = V(x, y, z);
    for (let i = 0; i < 20; i++) {
      const d = dirRand(-0.2, 1);
      spawn({ pos: P.clone().addScaledVector(d, rnd(0, 0.7 * s)), vel: d.clone().multiplyScalar(rnd(1.5, 7) * s), s0: rnd(0.9, 1.7) * s, s1: rnd(3.2, 6) * s, life: rnd(0.4, 0.9), c0: 0xffc060, c1: 0xcc2200, drag: 1.6, add: true, a: 0.95 });
    }
    for (let i = 0; i < 18; i++) {
      const d = dirRand(0.1, 1);
      spawn({ pos: P.clone().addScaledVector(d, rnd(0, 1.2 * s)), vel: d.multiplyScalar(rnd(1, 4.5) * s), s0: rnd(1, 2) * s, s1: rnd(4.5, 9) * s, life: rnd(1.8, 3.4), c0: 0x5a544c, c1: 0x121416, drag: 0.5, grav: 0.5, a: 0.75 });
    }
    this.sparks(x, y, z, Math.round(24 * s), null);
    const rm = new THREE.MeshBasicMaterial({ color: 0xffdd99, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40), rm);
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, y > 1 ? 0.1 : y + 0.05, z); scene.add(ring);
    rings.push({ o: ring, m: rm, t: 0, max: 0.6, s1: 9 * s });
    const cm = new THREE.MeshBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), cm);
    core.position.copy(P); scene.add(core);
    rings.push({ o: core, m: cm, t: 0, max: 0.25, s1: 2.8 * s });
    this.debris(x, y, z, { count: Math.round(14 * s), color: o.color, power: 1.1 * s, wheels: o.wheels == null ? 2 : o.wheels, groundY: o.groundY });
    if (!o.noScorch && y < 3) this.scorch(x, o.groundY || 0, z, 5.5 * s);
    const d = camDist(x, z);
    this.shakeFrom(x, z, 1.1 * s);
    if (d < 26) { this.slowmo(0.3, 0.7); this.flash("#ffe2a8", clamp(0.7 * (1 - d / 26), 0.1, 0.7), 0.55); }
    try { Sfx.play("explosion", { x, z, vol: 1 }); } catch (e) {}
    try { if (d < 25) navigator.vibrate && navigator.vibrate([70, 30, 110]); } catch (e) {}
  },

  /* ── blast dispatcher: "something exploded at pos" ── */
  onBlast(fn) {
    handlers.push(fn);
    return () => { const i = handlers.indexOf(fn); if (i >= 0) handlers.splice(i, 1); };
  },
  /* pos {x,y,z}; opts { radius, damage, source } */
  blast(pos, opts) {
    opts = opts || {};
    this.shakeFrom(pos.x, pos.z, opts.source === "wreck" ? 0.5 : 1.0);
    for (const h of handlers.slice()) { try { h(pos, opts); } catch (e) { console.warn("[crashfx] blast handler", e); } }
  },
};


/* ───────── wreck rigid body ─────────
   A tumbling car is a box that spins about its CENTRE of mass. Every step the lowest of its 8 corners is
   found and the body is lifted so that corner never goes below the ground — so a car can't sink into
   the road however it rotates. Landing bounces with restitution, kicks the body's spin from the contact
   point, rubs off speed, then eases the nearest flat face (wheels, side or roof) flat on the ground. */
const _UP = new THREE.Vector3(0, 1, 0);
const _tv = new THREE.Vector3(), _tq = new THREE.Quaternion(), _tq2 = new THREE.Quaternion(), _ident = new THREE.Quaternion();
const _AX = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

/* the real oriented size + centre of a model, measured with no rotation so the yaw can't inflate it */
/* helper geometry that is NOT car body: headlight beam cones, glow sprites, particles, lines.
   (The additive headlight cones stick 7 m out of the nose; counting them made the wreck box far too long,
   so a car resting on its side or roof floated in the air.) */
const _isHelper = (o) => {
  if (o.userData && (o.userData.noBody || o.userData.isHelper)) return true;
  if (o.isSprite || o.isPoints || o.isLine || o.isLight) return true;
  if (!o.isMesh) return false;
  const ms = Array.isArray(o.material) ? o.material : [o.material];
  for (const m of ms) {
    if (!m) continue;
    if (m.blending === THREE.AdditiveBlending) return true;
    if (m.depthWrite === false && m.transparent) return true;
  }
  return false;
};
const _bodyMeshes = (obj, out) => {
  obj.traverse((o) => { if (o.isMesh && o.geometry && !_isHelper(o)) out.push(o); });
  return out;
};
const _mb = new THREE.Box3(), _mb2 = new THREE.Box3();
function _bodyBox(obj) {
  _mb.makeEmpty();
  for (const m of _bodyMeshes(obj, [])) { _mb2.setFromObject(m); if (!_mb2.isEmpty()) _mb.union(_mb2); }
  if (_mb.isEmpty()) _mb.setFromObject(obj);
  return _mb;
}

/* the real oriented size + centre of a model, measured with no rotation so the yaw can't inflate it */
CrashFX.measureBody = function (obj) {
  const q = obj.quaternion.clone(), p = obj.position.clone();
  obj.quaternion.identity(); obj.position.set(0, 0, 0); obj.updateMatrixWorld(true);
  const bb = _bodyBox(obj).clone();
  obj.quaternion.copy(q); obj.position.copy(p); obj.updateMatrixWorld(true);
  return { size: bb.getSize(new THREE.Vector3()), center: bb.getCenter(new THREE.Vector3()) };
};

/* exact lowest world-space point of the real body (vertex accurate) */
const _lv = new THREE.Vector3();
CrashFX.lowestBodyY = function (obj) {
  obj.updateMatrixWorld(true);
  let low = Infinity;
  for (const m of _bodyMeshes(obj, [])) {
    const pos = m.geometry.attributes && m.geometry.attributes.position;
    if (!pos) continue;
    const step = pos.count > 4000 ? 3 : 1;
    for (let i = 0; i < pos.count; i += step) {
      _lv.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (_lv.y < low) low = _lv.y;
    }
  }
  return low;
};

CrashFX.makeWreckBody = function (obj, size, o) {
  o = o || {};
  const q = obj.quaternion.clone();
  /* ctr = the middle of the car's box in the object's own space (defaults to half-height above the origin) */
  const ctr = o.center ? o.center.clone() : new THREE.Vector3(0, size.y / 2, 0);
  const c = ctr.clone().applyQuaternion(q).add(obj.position);
  return { obj, size, ctr, q, c, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, wx: o.wx || 0, wy: o.wy || 0, wz: o.wz || 0, landed: false, done: false, rest: 0, age: 0, color: o.color, onBounce: o.onBounce || null, _bounce: null };
};

/* the body shape changed (a dent moved some vertices): re-measure so the box still encloses every vertex */
CrashFX.refreshWreckBody = function (b) {
  const me = CrashFX.measureBody(b.obj);
  b.size = me.size; b.ctr = me.center;
  b.c.copy(b.ctr).applyQuaternion(b.q).add(b.obj.position);
};

/* advance one step; gy = ground height under the car. Returns true once the car has come to rest. */
CrashFX.stepWreckBody = function (b, dt, gy) {
  if (b.done) return true;
  dt = Math.min(dt, 1 / 30);
  b.age += dt;
  b.vy -= 20 * dt;
  b.c.x += b.vx * dt; b.c.y += b.vy * dt; b.c.z += b.vz * dt;
  const wl = Math.hypot(b.wx, b.wy, b.wz);
  if (wl > 1e-4) {
    _tv.set(b.wx, b.wy, b.wz).multiplyScalar(1 / wl);
    _tq.setFromAxisAngle(_tv, wl * dt);
    b.q.premultiply(_tq).normalize();
  }
  /* lowest corner of the rotated box */
  const hx = b.size.x / 2, hy = b.size.y / 2, hz = b.size.z / 2;
  let low = 1e9, lx = 0, lz = 0;
  for (let i = 0; i < 8; i++) {
    _tv.set(i & 1 ? hx : -hx, i & 2 ? hy : -hy, i & 4 ? hz : -hz).applyQuaternion(b.q);
    if (_tv.y < low) { low = _tv.y; lx = _tv.x; lz = _tv.z; }
  }
  let contact = false;
  if (b.c.y + low < gy) {                                   /* touching or below the road: lift it out, never sink */
    contact = true;
    b.c.y = gy - low;
    /* one impulse at the lowest corner: it reverses the corner's approach speed (bounce) AND spins the body about its
       centre, sharing the same impulse, so every landing loses energy and the car cannot pogo forever */
    const vcn = -(b.vy + b.wz * lx - b.wx * lz);              /* approach speed of the contact corner (y of v + w × r) */
    if (vcn > 0) {
      const e = vcn > 4 ? 0.08 : 0;                           /* heavy car: low restitution, almost no bounce */
      const Iiso = (b.size.x * b.size.x + b.size.y * b.size.y + b.size.z * b.size.z) / 18;   /* box inertia per unit mass */
      const k = (lx * lx + lz * lz) / Iiso;
      const Jm = (1 + e) * vcn / (1 + k);
      b.vy += Jm;
      b.wx += -lz * Jm / Iiso; b.wz += lx * Jm / Iiso;
      if (vcn > 4) {
        b.vx *= 0.55; b.vz *= 0.55;                          /* more energy loss on heavy impact */
        b._bounce = { vn: vcn, x: b.c.x + lx, y: gy, z: b.c.z + lz };
        try { CrashFX.impact(b.c.x, gy + 0.3, b.c.z, { power: Math.min(0.5, vcn / 30), color: b.color, groundY: gy }); } catch (e) {}
      }
    }
    const fr = Math.max(0, 1 - 5 * dt);                      /* heavier road friction + spin damping */
    b.vx *= fr; b.vz *= fr;
    const ad = Math.max(0, 1 - 5 * dt);
    b.wx *= ad; b.wy *= ad; b.wz *= ad;
  } else {
    const air = Math.max(0, 1 - 0.15 * dt);
    b.wx *= air; b.wy *= air; b.wz *= air;
  }
  /* come to rest: ease the most-vertical body axis exactly upright (wheels down, on a side, or on its roof) */
  const sp = Math.hypot(b.vx, b.vz);
  const calm = sp < 1.4 && Math.abs(b.vy) < 1.2 && Math.hypot(b.wx, b.wy, b.wz) < 1.8;
  if (contact && (calm || b.age > 7)) {                      /* (failsafe: anything still twitching after 7 s is eased flat) */
    let best = 0, bd = -1, bs = 1;
    for (let i = 0; i < 2; i++) {                            /* wheels/roof (Y) or a side (X) — never balanced on its nose */
      _tv.copy(_AX[i === 0 ? 1 : 0]).applyQuaternion(b.q);
      if (Math.abs(_tv.y) > bd) { bd = Math.abs(_tv.y); best = i === 0 ? 1 : 0; bs = Math.sign(_tv.y) || 1; }
    }
    _tv.copy(_AX[best]).applyQuaternion(b.q).multiplyScalar(bs);
    _tq2.setFromUnitVectors(_tv, _UP);
    const ang = 2 * Math.acos(Math.min(1, Math.abs(_tq2.w)));
    _tq.copy(_ident).slerp(_tq2, Math.min(1, 6 * dt));
    b.q.premultiply(_tq).normalize();
    b.wx *= 0.8; b.wy *= 0.8; b.wz *= 0.8;
    if (b.age > 7) { b.vx *= 0.9; b.vz *= 0.9; b.wx *= 0.6; b.wy *= 0.6; b.wz *= 0.6; }
    b.rest += dt;
    if ((ang < 0.02 && sp < 0.25) || b.rest > 3) { b.landed = true; }
    if (b.landed && sp < 0.15) {
      b.vx = b.vy = b.vz = b.wx = b.wy = b.wz = 0; b.done = true;
      b._snap = true;                                       /* final exact ground fit, done after the write-back below */
    }
  } else if (!contact) { b.rest = 0; }
  /* the settle rotation may have dipped a corner: clamp once more so nothing ever sinks */
  if (contact) {
    let low2 = 1e9;
    for (let i = 0; i < 8; i++) { _tv.set(i & 1 ? hx : -hx, i & 2 ? hy : -hy, i & 4 ? hz : -hz).applyQuaternion(b.q); if (_tv.y < low2) low2 = _tv.y; }
    if (b.c.y + low2 < gy) b.c.y = gy - low2;
  }
  /* write back: the object's origin is the base, the body's centre is half a car-height up its own axis */
  b.obj.quaternion.copy(b.q);
  _tv.copy(b.ctr).applyQuaternion(b.q);
  b.obj.position.set(b.c.x - _tv.x, b.c.y - _tv.y, b.c.z - _tv.z);
  if (b._snap) {                                            /* never left hanging: lowest real vertex touches the ground */
    b._snap = false;
    try {
      const lo = CrashFX.lowestBodyY(b.obj);
      if (isFinite(lo)) { const d = (gy + 0.01) - lo; if (Math.abs(d) > 0.005) { b.obj.position.y += d; b.c.y += d; } }
    } catch (e) {}
  }
  if (b._bounce) { const bn = b._bounce; b._bounce = null; if (b.onBounce) { try { b.onBounce(bn); } catch (e) {} } }   /* e.g. dent the body where it landed */
  return b.done;
};

if (typeof window !== "undefined") window.__ph3d_crashfx = CrashFX;
