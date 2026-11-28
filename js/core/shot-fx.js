/* ════════════════════════════════════════════════════════════════
   shot-fx.js — dramatic gunfire.

   Called from guns.js (_doFire) once per shot. Everything is cheap, pooled
   textures, self-cleaning, and wrapped in try/catch by the caller so a
   graphics hiccup can never break shooting.

   • muzzle: star flash + forward fire jet + rising smoke puffs
   • tracer: a bright streak that races to the target (heavier for sniper)
   • impacts: flesh (blood + mist), head (big burst + red flash), hard surface
     (sparks + dust + chips), ground (dust kick)
   • camera: screen kick + zoom punch on the canvas (never fights the game camera)
   • HUD: crosshair hit-marker (white / red) + floating damage numbers
   • audio: small synthesized thump / crack / bone-pop layered over Sfx
   ════════════════════════════════════════════════════════════════ */
import * as THREE from "three";
import { Blood } from "./blood.js";
import { FlashPool } from "./flash-pool.js";

/* ── per-weapon feel ─────────────────────────────────────────── */
const FEEL = {
  pistol:  { flash: 0.26, jet: 0.45, kick: 0.9,  zoom: 0.004, tracer: 0.010, smoke: 2, shake: 0.9 },
  smg:     { flash: 0.22, jet: 0.40, kick: 0.6,  zoom: 0.003, tracer: 0.008, smoke: 1, shake: 0.6 },
  rifle:   { flash: 0.32, jet: 0.62, kick: 1.1,  zoom: 0.006, tracer: 0.011, smoke: 2, shake: 1.1 },
  lmg:     { flash: 0.36, jet: 0.70, kick: 1.0,  zoom: 0.006, tracer: 0.012, smoke: 2, shake: 1.0 },
  shotgun: { flash: 0.50, jet: 1.00, kick: 2.2,  zoom: 0.012, tracer: 0.007, smoke: 4, shake: 2.2 },
  sniper:  { flash: 0.42, jet: 1.10, kick: 2.8,  zoom: 0.016, tracer: 0.016, smoke: 3, shake: 2.6 },
};
const feel = (t) => FEEL[t] || FEEL.pistol;

/* ── shared textures (built once) ────────────────────────────── */
let _texStar = null, _texSoft = null;
function texStar() {
  if (_texStar) return _texStar;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  const rg = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  rg.addColorStop(0, "rgba(255,255,235,1)"); rg.addColorStop(0.25, "rgba(255,210,110,.9)");
  rg.addColorStop(0.6, "rgba(255,120,30,.35)"); rg.addColorStop(1, "rgba(255,80,0,0)");
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = "lighter";                         /* 6-point spikes */
  for (let i = 0; i < 6; i++) {
    g.save(); g.translate(64, 64); g.rotate((i * Math.PI) / 3 + 0.3);
    const lg = g.createLinearGradient(0, 0, 60, 0);
    lg.addColorStop(0, "rgba(255,240,190,.95)"); lg.addColorStop(1, "rgba(255,160,40,0)");
    g.fillStyle = lg; g.beginPath(); g.moveTo(0, -4); g.lineTo(60, 0); g.lineTo(0, 4); g.closePath(); g.fill();
    g.restore();
  }
  _texStar = new THREE.CanvasTexture(c);
  return _texStar;
}
function texSoft() {
  if (_texSoft) return _texSoft;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  const rg = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  rg.addColorStop(0, "rgba(255,255,255,.9)"); rg.addColorStop(0.5, "rgba(255,255,255,.35)"); rg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  _texSoft = new THREE.CanvasTexture(c);
  return _texSoft;
}

/* ── tiny effect scheduler (own rAF, sleeps when idle) ───────── */
const _fx = [];
let _raf = 0, _last = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - _last) / 1000 || 0.016); _last = now;
  for (let i = _fx.length - 1; i >= 0; i--) {
    let alive = false;
    try { alive = _fx[i].update(dt); } catch (e) { alive = false; }
    if (!alive) { try { _fx[i].dispose(); } catch (e) {} _fx.splice(i, 1); }
  }
  stepScreen(dt);
  _raf = (_fx.length || _scr.kick > 0.002 || _scr.zoom > 0.0005) ? requestAnimationFrame(loop) : 0;
}
function run(fx) { _fx.push(fx); if (!_raf) { _last = performance.now(); _raf = requestAnimationFrame(loop); } }

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);

/* ── screen kick / zoom punch on the game canvas ─────────────── */
const _scr = { kick: 0, zoom: 0, ang: 0, ox: 0, oy: 0, el: null, t: 0 };
function canvasEl() {
  if (_scr.el && _scr.el.isConnected) return _scr.el;
  _scr.el = document.querySelector("#app canvas") || null;   /* the 3D renderer lives in #app; never the face / minimap canvases */
  return _scr.el;
}
function stepScreen(dt) {
  const el = canvasEl(); if (!el) return;
  _scr.t += dt;
  _scr.kick *= Math.exp(-dt * 16); _scr.zoom *= Math.exp(-dt * 12);
  if (_scr.kick < 0.002 && _scr.zoom < 0.0005) {
    if (el.style.transform) { el.style.transform = ""; el.style.willChange = ""; }
    _scr.kick = 0; _scr.zoom = 0; return;
  }
  const k = _scr.kick;
  const x = Math.sin(_scr.t * 83) * k * 3 + _scr.ox * k, y = -k * 6 + Math.cos(_scr.t * 97) * k * 2 + _scr.oy * k;
  el.style.willChange = "transform";
  el.style.transformOrigin = "50% 55%";
  el.style.transform = "translate(" + x.toFixed(2) + "px," + y.toFixed(2) + "px) rotate(" + (_scr.ang * k * 0.25).toFixed(3) + "deg) scale(" + (1 + _scr.zoom + 0.008).toFixed(4) + ")";
}
function kickScreen(amount, zoom) {
  _scr.kick = Math.min(3.2, _scr.kick + amount);
  _scr.zoom = Math.min(0.03, _scr.zoom + zoom);
  _scr.ang = (Math.random() - 0.5) * 2; _scr.ox = (Math.random() - 0.5) * 2; _scr.oy = 0;
  if (!_raf) { _last = performance.now(); _raf = requestAnimationFrame(loop); }
}

/* ── muzzle flash ────────────────────────────────────────────── */
function muzzle(scene, pos, dir, type) {
  const f = feel(type);
  const mat = new THREE.SpriteMaterial({ map: texStar(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const star = new THREE.Sprite(mat);
  star.position.copy(pos);
  star.material.rotation = Math.random() * 6.28;
  scene.add(star);

  const coneMat = new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.05 + f.flash * 0.1, f.jet, 8, 1, true), coneMat);
  _q.setFromUnitVectors(_up, dir); cone.quaternion.copy(_q);
  cone.position.copy(pos).addScaledVector(dir, f.jet * 0.5);
  scene.add(cone);

  let t = 0; const life = type === "sniper" || type === "shotgun" ? 0.10 : 0.065;
  run({
    update(dt) {
      t += dt; const k = t / life; if (k >= 1) return false;
      const s = f.flash * (1.0 + (1 - k) * 0.6) * (1 + (type === "shotgun" ? 0.4 : 0));
      star.scale.set(s, s, s); mat.opacity = 1 - k * k;
      coneMat.opacity = 0.9 * (1 - k); cone.scale.set(1 + k * 0.6, 1 + k * 0.8, 1 + k * 0.6);
      return true;
    },
    dispose() { scene.remove(star); scene.remove(cone); mat.dispose(); cone.geometry.dispose(); coneMat.dispose(); },
  });

  for (let i = 0; i < f.smoke; i++) smoke(scene, pos, dir, 0.7 + Math.random() * 0.5, 0.35 + f.flash);
}

function smoke(scene, pos, dir, life, size) {
  const mat = new THREE.SpriteMaterial({ map: texSoft(), color: 0xbfbfbf, transparent: true, opacity: 0.35, depthWrite: false });
  const sp = new THREE.Sprite(mat); sp.position.copy(pos); scene.add(sp);
  const vx = dir.x * (0.6 + Math.random()) + (Math.random() - 0.5) * 0.5;
  const vy = 0.5 + Math.random() * 0.5, vz = dir.z * (0.6 + Math.random()) + (Math.random() - 0.5) * 0.5;
  let t = 0;
  run({
    update(dt) {
      t += dt; const k = t / life; if (k >= 1) return false;
      sp.position.x += vx * dt; sp.position.y += vy * dt * (1 - k); sp.position.z += vz * dt;
      const s = size * (0.5 + k * 2.4); sp.scale.set(s, s, s); mat.opacity = 0.32 * (1 - k);
      return true;
    },
    dispose() { scene.remove(sp); mat.dispose(); },
  });
}

/* ── screen-aware sizing: effects keep a readable size ON SCREEN at any distance / zoom ─────────────────
   metres per pixel at 1 m from the camera = 2·tan(fov/2) / screenHeight. A 1.6 cm tracer is ~0.1 px at
   100 m in an 8x scope, i.e. invisible; scaling by distance·px keeps it a steady couple of pixels. */
function pxPerMetre(cam) { return 2 * Math.tan(((cam && cam.fov) || 60) * Math.PI / 360) / Math.max(300, (typeof window !== "undefined" && window.innerHeight) || 800); }
const _vf = new THREE.Vector3(), _vr = new THREE.Vector3(), _vu = new THREE.Vector3();
/* a point INSIDE the (zoomed) view, lower-right, where the bullet visibly leaves the player's line of fire */
function viewOrigin(cam, dist) {
  cam.getWorldDirection(_vf); _vr.setFromMatrixColumn(cam.matrixWorld, 0); _vu.setFromMatrixColumn(cam.matrixWorld, 1);
  const th = Math.tan((cam.fov || 60) * Math.PI / 360);
  return cam.position.clone().addScaledVector(_vf, dist).addScaledVector(_vr, th * (cam.aspect || 1.7) * dist * 0.5).addScaledVector(_vu, -th * dist * 0.55);
}
let _sf = null;
/* lens flash for a scoped shot: the gun is out of frame, so the muzzle blast shows as a warm burst at the lens edge */
function scopeFlash(type) {
  try {
    if (!_sf || !_sf.isConnected) {
      _sf = document.createElement("div"); _sf.id = "ph3d-scope-flash";
      _sf.style.cssText = "position:fixed;inset:0;z-index:31;pointer-events:none;opacity:0;";
      document.body.appendChild(_sf);
    }
    const big = type === "shotgun" ? 1 : 0.85;
    _sf.style.transition = "none";
    _sf.style.background = "radial-gradient(circle at 74% 84%, rgba(255,236,170," + (0.95 * big) + ") 0%, rgba(255,170,60," + (0.6 * big) + ") 16%, rgba(255,120,30,0) 52%), radial-gradient(circle at 50% 50%, rgba(255,210,150,0.16) 0%, rgba(255,160,70,0) 70%)";
    _sf.style.opacity = "1"; void _sf.offsetWidth;
    _sf.style.transition = "opacity " + (type === "sniper" ? 0.22 : 0.16) + "s ease-out"; _sf.style.opacity = "0";
  } catch (e) {}
}

/* ── tracer ──────────────────────────────────────────────────── */
let _tracerGeo = null;
function tracer(scene, from, to, type, cam, scoped) {
  const f = feel(type);
  const len = from.distanceTo(to); if (len < 1.5) return;
  if (!_tracerGeo) { _tracerGeo = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true); _tracerGeo.translate(0, 0.5, 0); }
  const mat = new THREE.MeshBasicMaterial({ color: type === "sniper" ? 0xfff2c0 : 0xffd080, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const m = new THREE.Mesh(_tracerGeo, mat); m.frustumCulled = false; scene.add(m);
  const dir = _v.copy(to).sub(from).normalize().clone();
  _q.setFromUnitVectors(_up, dir); m.quaternion.copy(_q);
  const speed = scoped ? 300 : 380, tail = Math.min(len, scoped ? 26 : (type === "sniper" ? 11 : 6.5));
  const pxm = cam ? pxPerMetre(cam) : 0, pix = scoped ? 2.6 : 1.5;
  let d = 0;
  run({
    update(dt) {
      d += speed * dt;
      const head = Math.min(d, len), tailD = Math.max(0, d - tail);
      if (tailD >= len) return false;
      const segLen = Math.max(0.01, head - tailD);
      m.position.copy(from).addScaledVector(dir, tailD);
      const th = cam ? Math.max(0.0015, cam.position.distanceTo(m.position) * pxm * pix) : f.tracer;   /* steady on-screen width (a thin streak, not a fat wedge up close) */
      m.scale.set(th, segLen, th);
      mat.opacity = 0.95 * (1 - Math.max(0, d - len) / tail);
      return true;
    },
    dispose() { scene.remove(m); mat.dispose(); },
  });
}

/* ── impacts ─────────────────────────────────────────────────── */
/* bright spark/flare at the impact point, sized in screen pixels so it is visible at 100 m in an 8x scope */
function impactFlare(scene, p, sizeM, color) {
  const mat = new THREE.SpriteMaterial({ map: texStar(), color: color || 0xffd890, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, opacity: 1 });
  const sp = new THREE.Sprite(mat); sp.renderOrder = 20; sp.position.copy(p); sp.material.rotation = Math.random() * 6.28; scene.add(sp);
  let t = 0; const life = 0.16;
  run({
    update(dt) { t += dt; const k = t / life; if (k >= 1) return false; const sz = sizeM * (0.6 + k * 0.8); sp.scale.set(sz, sz, sz); mat.opacity = 1 - k; return true; },
    dispose() { scene.remove(sp); mat.dispose(); },
  });
}
function dustPuff(scene, p, color, n, size, op, lifeK) {
  op = op == null ? 0.5 : op; lifeK = lifeK || 1; size *= _impactScale;
  for (let i = 0; i < n; i++) {
    const mat = new THREE.SpriteMaterial({ map: texSoft(), color, transparent: true, opacity: op, depthWrite: false });
    const sp = new THREE.Sprite(mat); sp.position.copy(p); scene.add(sp);
    const vx = (Math.random() - 0.5) * 1.6, vy = 0.4 + Math.random() * 1.2, vz = (Math.random() - 0.5) * 1.6;
    let t = 0; const life = (0.45 + Math.random() * 0.35) * lifeK;
    run({
      update(dt) {
        t += dt; const k = t / life; if (k >= 1) return false;
        sp.position.x += vx * dt; sp.position.y += vy * dt; sp.position.z += vz * dt;
        const s = size * (0.4 + k * 1.8); sp.scale.set(s, s, s); mat.opacity = op * (1 - k);
        return true;
      },
      dispose() { scene.remove(sp); mat.dispose(); },
    });
  }
}

function flash(scene, p, color, intensity, dist, life) {
  /* pooled light: never add/remove a PointLight at runtime (forces every lit material to recompile) */
  FlashPool.fire(scene, p, color, intensity, dist, life);
}

let _impactScale = 1;
function impact(scene, p, dir, kind, dmg, type, floorY, sc, flareM) {
  _impactScale = sc || 1;
  if (flareM && kind !== "flesh" && kind !== "head") impactFlare(scene, p, flareM, kind === "ground" ? 0xffe0a8 : 0xffd890);
  else if (flareM) impactFlare(scene, p, flareM * 0.7, 0xff5030);                                           /* far / zoomed impacts are drawn bigger so they read on screen */
  const d = { x: dir.x, y: dir.y, z: dir.z };
  if (kind === "head") {
    /* exit spray along the bullet + a thin entry mist back toward the shooter; thin red haze, never a solid cloud */
    try { Blood.spray(scene, p.x, p.y, p.z, { count: 38, spread: 5.5, dir: d, floorY }); } catch (e) {}
    try { Blood.spray(scene, p.x, p.y, p.z, { count: 14, spread: 3, dir: d, back: true, floorY }); } catch (e) {}
    try { Blood.spray(scene, p.x, p.y, p.z, { count: 10, spread: 2.2, color: 0xd8c8b0, dir: d, floorY }); } catch (e) {}   /* bone fleck */
    dustPuff(scene, p, 0xa01010, 2, 0.34, 0.16, 0.55);
    flash(scene, p, 0xff2a1a, 3.2, 4, 0.12);
  } else if (kind === "flesh") {
    const big = (dmg || 0) > 40;
    try { Blood.spray(scene, p.x, p.y, p.z, { count: big ? 26 : 16, spread: big ? 4.6 : 3.4, dir: d, floorY }); } catch (e) {}
    try { Blood.spray(scene, p.x, p.y, p.z, { count: big ? 8 : 5, spread: 2.2, dir: d, back: true, floorY }); } catch (e) {}
    if (big) dustPuff(scene, p, 0xa01010, 1, 0.3, 0.14, 0.5);
  } else if (kind === "ground") {
    dustPuff(scene, p, 0xb9a98a, 3, 0.5);
    try { Blood.spray(scene, p.x, p.y + 0.02, p.z, { count: 10, spread: 3, color: 0x8f7a56, gravity: -18 }); } catch (e) {}
  } else {                                                         /* hard surface */
    try { Blood.spray(scene, p.x, p.y, p.z, { count: 18, spread: 4.5, color: 0xffcc5e, gravity: -14 }); } catch (e) {}
    dustPuff(scene, p, 0xcfcfcf, 2, 0.38);
    flash(scene, p, 0xffc060, 2.2 * Math.min(2.5, _impactScale), 3 * Math.min(2.5, _impactScale), 0.07);
  }
  _impactScale = 1;
}

/* ── hit-marker + floating numbers (DOM, centred on the crosshair) ── */
let _hm = null;
function hitMarkerEl() {
  if (_hm && _hm.isConnected) return _hm;
  _hm = document.createElement("div");
  _hm.id = "ph3d-hitmarker";
  _hm.style.cssText = "position:fixed;left:50%;top:50%;width:34px;height:34px;margin:-17px 0 0 -17px;pointer-events:none;z-index:30;opacity:0;transition:none";
  const bar = (rot) => '<i style="position:absolute;left:50%;top:50%;width:11px;height:3px;margin:-1.5px 0 0 -5.5px;background:currentColor;border-radius:2px;box-shadow:0 0 4px #000;transform:rotate(' + rot + 'deg) translateX(10px)"></i>';
  _hm.innerHTML = bar(45) + bar(135) + bar(225) + bar(315);
  document.body.appendChild(_hm);
  return _hm;
}
function hitMarker(kind) {
  const el = hitMarkerEl();
  const col = kind === "kill" ? "#ff2a2a" : kind === "head" ? "#ffb020" : "#ffffff";
  el.style.color = col;
  el.style.transition = "none"; el.style.opacity = "1";
  el.style.transform = "scale(" + (kind === "kill" ? 1.6 : kind === "head" ? 1.35 : 1.0) + ")";
  void el.offsetWidth;
  el.style.transition = "opacity .22s ease-out, transform .22s ease-out";
  el.style.opacity = "0";
  el.style.transform = "scale(" + (kind === "kill" ? 2.1 : 1.5) + ")";
}
let _vig = null;
function vignette(color, ms) {
  if (!_vig || !_vig.isConnected) {
    _vig = document.createElement("div");
    _vig.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:28;opacity:0";
    document.body.appendChild(_vig);
  }
  _vig.style.background = "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, " + color + " 100%)";
  _vig.style.transition = "none"; _vig.style.opacity = "1"; void _vig.offsetWidth;
  _vig.style.transition = "opacity " + ms + "ms ease-out"; _vig.style.opacity = "0";
}
function damageText(text, kind) {
  const d = document.createElement("div");
  const x = 50 + (Math.random() - 0.5) * 8, y = 42 + (Math.random() - 0.5) * 4;
  d.textContent = text;
  d.style.cssText = "position:fixed;left:" + x + "%;top:" + y + "%;transform:translate(-50%,-50%);pointer-events:none;z-index:30;font:800 " +
    (kind === "head" || kind === "kill" ? 22 : 16) + "px/1 system-ui,sans-serif;letter-spacing:.5px;color:" +
    (kind === "kill" ? "#ff4040" : kind === "head" ? "#ffc040" : "#fff") + ";text-shadow:0 2px 4px #000,0 0 8px rgba(0,0,0,.7);transition:transform .7s ease-out,opacity .7s ease-in";
  document.body.appendChild(d);
  requestAnimationFrame(() => { d.style.transform = "translate(-50%,-" + (kind === "kill" ? 150 : 110) + "px)"; d.style.opacity = "0"; });
  setTimeout(() => { try { d.remove(); } catch (e) {} }, 750);
}

/* ── synthesized layers (thump / crack / bone pop) ───────────── */
let _ac = null;
function ac() {
  if (_ac) return _ac;
  try { _ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { _ac = null; }
  return _ac;
}
function tone(kind) { try { _tone(kind); } catch (e) {} }     /* audio must never be able to break the visuals */
function _tone(kind) {
  const a = ac(); if (!a) return;
  if (a.state === "suspended") { try { a.resume(); } catch (e) {} }
  const t0 = a.currentTime, g = a.createGain(); g.connect(a.destination);
  const o = a.createOscillator(); o.connect(g);
  if (kind === "thump") { o.type = "sine"; o.frequency.setValueAtTime(150, t0); o.frequency.exponentialRampToValueAtTime(45, t0 + 0.12); g.gain.setValueAtTime(0.35, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16); o.start(t0); o.stop(t0 + 0.18); }
  else if (kind === "crack") { o.type = "square"; o.frequency.setValueAtTime(1800, t0); o.frequency.exponentialRampToValueAtTime(300, t0 + 0.07); g.gain.setValueAtTime(0.22, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1); o.start(t0); o.stop(t0 + 0.12); }
  else if (kind === "pop") { o.type = "triangle"; o.frequency.setValueAtTime(420, t0); o.frequency.exponentialRampToValueAtTime(70, t0 + 0.09); g.gain.setValueAtTime(0.3, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14); o.start(t0); o.stop(t0 + 0.16);
    const o2 = a.createOscillator(), g2 = a.createGain(); o2.type = "square"; o2.frequency.value = 2400; o2.connect(g2); g2.connect(a.destination); g2.gain.setValueAtTime(0.12, t0 + 0.02); g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05); o2.start(t0 + 0.02); o2.stop(t0 + 0.06); }
  else { o.type = "sawtooth"; o.frequency.setValueAtTime(900, t0); o.frequency.exponentialRampToValueAtTime(200, t0 + 0.05); g.gain.setValueAtTime(0.12, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07); o.start(t0); o.stop(t0 + 0.08); }
}

/* ── public API ──────────────────────────────────────────────── */
export const ShotFX = {
  /* once per shot.
     o = { scene, muzzle:Vector3, origin:Vector3, dir:Vector3, end:Vector3, type, part, hit, dmg, killed, surface }
     surface: "flesh" | "solid" | "ground" | null (miss in open air) */
  fire(o) {
    const scene = o.scene; if (!scene) return;
    const f = feel(o.type);
    const dir = o.dir.clone().normalize();
    const cam = o.camera || null, scoped = !!(o.scoped && cam);
    const pxm = cam ? pxPerMetre(cam) : 0;
    const dEnd = cam ? cam.position.distanceTo(o.end) : 0;
    const sc = cam ? Math.max(1, Math.min(6, 60 * dEnd * pxm / 0.5)) : 1;           /* impact size factor for far / zoomed shots */
    const flareM = cam && dEnd > 12 ? 26 * dEnd * pxm : 0;                           /* ~26 px flare at the impact */
    /* scoped: the gun is outside the zoomed picture, so the shot is shown IN the view — a lens flash, plus a tracer that
       starts inside the frame (lower-right) and streaks to the target */
    const from = scoped ? viewOrigin(cam, 3) : o.muzzle;
    muzzle(scene, o.muzzle, dir, o.type);
    if (scoped) scopeFlash(o.type);
    if (o.type === "shotgun") {                                   /* pellet streaks */
      for (let i = 0; i < 5; i++) {
        const e = o.end.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.6));
        tracer(scene, from, e, o.type, cam, scoped);
      }
    } else tracer(scene, from, o.end, o.type, cam, scoped);
    kickScreen(f.kick * (scoped ? 0.95 : 0.55), f.zoom * (scoped ? 1.5 : 1));

    /* the bullet takes time to arrive: a long shot (e.g. 100 m through a scope) lands visibly AFTER the flash and tracer */
    const travel = Math.min(0.32, (o.muzzle.distanceTo(o.end)) / 320);
    const land = () => {
      if (o.hit) {
        const head = o.part === "head";
        impact(scene, o.end, dir, head ? "head" : "flesh", o.dmg, o.type, o.floorY, sc, flareM);
        const kind = o.killed ? "kill" : head ? "head" : "body";
        hitMarker(kind);
        damageText((head ? "HEADSHOT  " : "") + "-" + Math.round(o.dmg), kind);
        tone(head ? "crack" : "thump");
        if (head) { vignette("rgba(160,0,0,.55)", 380); kickScreen(0.5, 0.006); }
        if (o.killed) { vignette("rgba(120,0,0,.7)", 650); kickScreen(0.8, 0.012); }
      } else if (o.surface === "solid" || o.surface === "ground") {
        impact(scene, o.end, dir, o.surface === "ground" ? "ground" : "solid", 0, o.type, undefined, sc, flareM);
        tone("ping");
      }
    };
    if (travel > 0.05) setTimeout(() => { try { land(); } catch (e) { console.warn("[shotfx] impact", e); } }, travel * 1000); else land();
  },

  /* a body hit the floor: dust skid, thud, and a jolt if it happened close to the player */
  bodyDrop(scene, x, y, z, strength, near) {
    if (!scene) return;
    const p = new THREE.Vector3(x, y + 0.1, z);
    dustPuff(scene, p, 0xb9a98a, 2 + Math.round(strength * 3), 0.5 + strength * 0.4);
    try { tone("thump"); } catch (e) {}
    if (near) kickScreen(0.5 * strength, 0.004 * strength);
  },

  /* a limb just popped out of its socket (HitReact told us) */
  dislocate(point) {
    tone("pop");
    kickScreen(0.35, 0.004);
    try { damageText("DISLOCATED", "head"); } catch (e) {}
  },

  hitMarker, vignette, kickScreen,
};

if (typeof window !== "undefined") window.__ph3d_shotFx = ShotFX;
