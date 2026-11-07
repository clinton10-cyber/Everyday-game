/* bazooka.js -- M9A1 shoulder-fired rocket launcher.
   Model ported from the standalone bazooka prototype (tripod removed, scaled to
   be carried on the player's right shoulder). Same interface as Gun in guns.js:
   draw / holster / fire / update(dt,targets) / applyArmPose(R) / dispose.
   The rocket flies, detonates on ground / wall / target, and the blast damages
   EVERY alive target inside BLAST_RADIUS (falloff), so one shot can kill many. */
import * as THREE from "three";
import { setGrip } from "../characters/lowpoly.js";
import { Combat } from "./combat.js";
import { Sfx } from "./sfx.js";

/* ───────── tuning (edit here) ───────── */
const CFG = {
  cooldown: 2.6,          // seconds between shots (reload)
  fireDuration: 0.95,     // arm/recoil animation length
  launchAt: 0.18,         // fraction of the animation when the rocket leaves
  speed0: 16, speed1: 58, // rocket speed ramp (m/s)
  maxLife: 3.4,           // seconds before it self-detonates
  blastRadius: 9,         // metres: everyone in here is hurt
  killRadius: 4.5,        // inside this: full damage
  damage: 400,            // full damage (NPCs have ~60-100 hp)
  selfRadius: 6, selfDamage: 70,
  modelScale: 0.55,       // size of the launcher on the shoulder
  mount: [-0.19, 0.43, 0.0],   // pivot on the spine (right shoulder), metres
  tubeZ: 0.36,            // how far forward the tube centre sits from the pivot
};

/* ───────── arm poses ───────── */
const READY = {
  r_shoulder: [-0.60, 0.12, -0.12], r_elbow: [-1.60, 0, 0], r_wrist: [0.10, 0, 0],
  l_shoulder: [-1.30, -0.50, 0.18], l_elbow: [-0.30, 0, 0], l_wrist: [0.10, 0, 0],
  spine: [0, 0.05, 0], head: [0.02, 0.02, 0],
};
const KICK = {
  r_shoulder: [0.35, 0, 0], r_elbow: [0.20, 0, 0], r_wrist: [-0.20, 0, 0],
  l_shoulder: [0.30, 0, 0], l_elbow: [0.15, 0, 0], l_wrist: [0, 0, 0],
  spine: [-0.14, 0, 0], head: [0.12, 0, 0],
};
function applyPose(R, p, k = 1) {
  const s = (a) => [a[0] * k, a[1] * k, a[2] * k];
  if (R.armR) {
    R.armR.shoulder.rotation.set(...p.r_shoulder);
    R.armR.elbow.rotation.set(...p.r_elbow);
    if (R.armR.wrist) R.armR.wrist.rotation.set(...p.r_wrist);
  }
  if (R.armL) {
    R.armL.shoulder.rotation.set(...p.l_shoulder);
    R.armL.elbow.rotation.set(...p.l_elbow);
    if (R.armL.wrist) R.armL.wrist.rotation.set(...p.l_wrist);
  }
  if (R.spine) R.spine.rotation.set(...p.spine);
  if (R.head) R.head.rotation.set(...p.head);
}

/* ───────── materials (shared) ───────── */
const M = {
  paint:  new THREE.MeshStandardMaterial({ color: 0x55613f, metalness: 0.35, roughness: 0.62, side: THREE.DoubleSide }),
  paintDk:new THREE.MeshStandardMaterial({ color: 0x39412c, metalness: 0.40, roughness: 0.72 }),
  steel:  new THREE.MeshStandardMaterial({ color: 0x9aa3ab, metalness: 0.9, roughness: 0.32 }),
  gun:    new THREE.MeshStandardMaterial({ color: 0x2f353b, metalness: 0.9, roughness: 0.45 }),
  dark:   new THREE.MeshStandardMaterial({ color: 0x14161a, metalness: 0.6, roughness: 0.62 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.96 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xd8b322, metalness: 0.5, roughness: 0.45, emissive: 0x241c00 }),
  sling:  new THREE.MeshStandardMaterial({ color: 0x2a2b22, roughness: 0.9 }),
  bore:   new THREE.MeshStandardMaterial({ color: 0x0a0b0d, metalness: 0.5, roughness: 0.86, side: THREE.DoubleSide }),
  body:   new THREE.MeshStandardMaterial({ color: 0x6a6f5a, metalness: 0.6, roughness: 0.5 }),
  nose:   new THREE.MeshStandardMaterial({ color: 0x181a1b, metalness: 0.5, roughness: 0.55 }),
  fin:    new THREE.MeshStandardMaterial({ color: 0x3a3f33, metalness: 0.7, roughness: 0.45 }),
  flameO: new THREE.MeshBasicMaterial({ color: 0xff7722, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  flameI: new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
};

function strut(a, b, r, mat) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
function cage(z0, z1, radius, bars, rings) {
  const g = new THREE.Group(), len = z1 - z0;
  for (let i = 0; i < rings; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.0075, 6, 28), M.steel);
    t.position.z = z0 + len * i / (rings - 1); g.add(t);
  }
  for (let i = 0; i < bars; i++) {
    const a = i / bars * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.013, len), M.steel);
    b.position.set(Math.cos(a) * radius, Math.sin(a) * radius, (z0 + z1) / 2);
    b.rotation.z = a; g.add(b);
  }
  return g;
}

/* The launcher itself, in prototype units (tube axis = +Z, muzzle at +Z). */
export function buildBazooka3D() {
  const elev = new THREE.Group();
  const R = 0.085, HL = 1.30;
  const cyl = (rt, rb, h, mat, z, open = true, seg = 32) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat);
    m.rotation.x = Math.PI / 2; m.position.z = z; elev.add(m); return m;
  };
  cyl(R, R, HL * 2, M.paint, 0, true, 36);                     // tube
  cyl(R * 0.9, R * 0.9, HL * 2 - 0.02, M.bore, 0, true, 28);   // bore
  cyl(R, R * 1.58, 0.28, M.gun, -HL - 0.14, true, 32);         // venturi
  cyl(R * 1.26, R, 0.20, M.paint, HL - 0.10, true, 32);        // muzzle flare
  const vr = new THREE.Mesh(new THREE.TorusGeometry(R * 1.58, 0.012, 8, 36), M.steel); vr.position.z = -HL - 0.28; elev.add(vr);
  const mr = new THREE.Mesh(new THREE.TorusGeometry(R * 1.27, 0.011, 8, 36), M.steel); mr.position.z = HL; elev.add(mr);
  elev.add(cage(0.05, 0.95, R * 1.17, 8, 5));
  elev.add(cage(-0.95, -0.15, R * 1.17, 8, 4));
  cyl(R * 1.13, R * 1.13, 0.20, M.paintDk, -0.05, true, 28);   // sleeve
  cyl(R * 1.02, R * 1.02, 0.045, M.yellow, 1.045, true, 28);   // warning band

  /* grip + trigger */
  const gm = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.115), M.gun); gm.position.set(0, -0.115, -0.36); elev.add(gm);
  const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.033, 0.135, 4, 10), M.rubber);
  grip.position.set(0, -0.185, -0.365); grip.rotation.x = 0.2; elev.add(grip);
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.0065, 6, 16, Math.PI), M.gun);
  guard.rotation.y = Math.PI / 2; guard.position.set(0, -0.115, -0.30); elev.add(guard);
  const trg = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.036, 0.014), M.steel);
  trg.position.set(0, -0.128, -0.285); trg.rotation.x = 0.3; elev.add(trg);

  /* shoulder rest */
  const butt = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.215, 0.028), M.rubber);
  butt.position.set(0, -0.12, -1.34); butt.rotation.x = -0.16; elev.add(butt);
  elev.add(strut(new THREE.Vector3(0.05, -0.05, -1.16), new THREE.Vector3(0.06, -0.16, -1.33), 0.009, M.gun));
  elev.add(strut(new THREE.Vector3(-0.05, -0.05, -1.16), new THREE.Vector3(-0.06, -0.16, -1.33), 0.009, M.gun));

  /* sights */
  const fb = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.035), M.gun); fb.position.set(0, R * 1.2, 0.86); elev.add(fb);
  const fp = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.075, 0.009), M.steel); fp.position.set(0, R * 1.2 + 0.055, 0.86); elev.add(fp);
  const rb = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.045), M.gun); rb.position.set(0, R * 1.12, -0.52); elev.add(rb);
  const rr = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 6, 18), M.steel); rr.position.set(0, R * 1.12 + 0.048, -0.52); elev.add(rr);

  /* sling */
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.075, -0.055, 0.90), new THREE.Vector3(0.150, -0.230, 0.55),
    new THREE.Vector3(0.165, -0.300, -0.10), new THREE.Vector3(0.140, -0.245, -0.72),
    new THREE.Vector3(0.070, -0.070, -1.02)]);
  elev.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.008, 6, false), M.sling));

  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, HL + 0.1); elev.add(muzzle);
  elev.userData.muzzle = muzzle;
  return elev;
}

/* ───────── rocket model ───────── */
function buildRocket() {
  const g = new THREE.Group(), r = 0.055;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.50, 16), M.body); body.rotation.x = Math.PI / 2; g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(r, 0.24, 16), M.nose); nose.rotation.x = Math.PI / 2; nose.position.z = 0.37; g.add(nose);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.06, r * 1.06, 0.035, 16), M.steel); collar.rotation.x = Math.PI / 2; collar.position.z = 0.2; g.add(collar);
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.13, 0.14), M.fin);
    f.position.set(0, 0, -0.17);
    const p = new THREE.Group(); p.add(f); f.position.y = 0.09; p.rotation.z = i * Math.PI / 2 + Math.PI / 4; g.add(p);
  }
  const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.048, 0.07, 12, 1, true), M.gun); noz.rotation.x = Math.PI / 2; noz.position.z = -0.285; g.add(noz);
  const fo = new THREE.Mesh(new THREE.ConeGeometry(0.062, 0.46, 12, 1, true), M.flameO); fo.rotation.x = -Math.PI / 2; fo.position.z = -0.55; g.add(fo);
  const fi = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.28, 10, 1, true), M.flameI); fi.rotation.x = -Math.PI / 2; fi.position.z = -0.46; g.add(fi);
  g.userData.flames = [fo, fi];
  return g;
}

/* ───────── effects (sprites + ring + scorch) ───────── */
let _puffTex = null, _scorchTex = null;
function puffTex() {
  if (_puffTex) return _puffTex;
  const c = document.createElement("canvas"); c.width = c.height = 96;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(48, 48, 0, 48, 48, 48);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.45, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 96, 96);
  _puffTex = new THREE.CanvasTexture(c); _puffTex.colorSpace = THREE.SRGBColorSpace; return _puffTex;
}
function scorchTex() {
  if (_scorchTex) return _scorchTex;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.9)"); g.addColorStop(0.6, "rgba(10,8,6,0.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  _scorchTex = new THREE.CanvasTexture(c); return _scorchTex;
}
const rnd = (a, b) => a + Math.random() * (b - a);

class FX {
  constructor(scene) { this.scene = scene; this.parts = []; this.rings = []; this.scorches = []; this.free = []; }
  spawn(o) {
    let s = this.free.pop();
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex(), transparent: true, depthWrite: false }));
      s.renderOrder = 5;
    }
    s.material.blending = o.add ? THREE.AdditiveBlending : THREE.NormalBlending;
    s.material.color.setHex(o.c0); s.material.opacity = o.a || 1;
    s.material.rotation = Math.random() * 6.28;
    s.position.copy(o.pos); s.scale.setScalar(o.s0); s.visible = true;
    this.scene.add(s);
    this.parts.push({ s, t: 0, life: o.life, v: o.vel, s0: o.s0, s1: o.s1, c0: new THREE.Color(o.c0), c1: new THREE.Color(o.c1), drag: o.drag ?? 1.5, grav: o.grav ?? 0, a: o.a || 1 });
  }
  burst(pos) {
    /* fireball */
    for (let i = 0; i < 22; i++) {
      const d = new THREE.Vector3(rnd(-1, 1), rnd(-0.4, 1), rnd(-1, 1)).normalize();
      this.spawn({ pos: pos.clone().addScaledVector(d, rnd(0, 0.8)), vel: d.clone().multiplyScalar(rnd(1.5, 8)), s0: rnd(0.8, 1.6), s1: rnd(3.5, 6.5), life: rnd(0.4, 0.9), c0: 0xffc060, c1: 0x401000, drag: 2.4, grav: 2.5, add: true });
    }
    /* smoke */
    for (let i = 0; i < 26; i++) {
      const d = new THREE.Vector3(rnd(-1, 1), rnd(0.1, 1), rnd(-1, 1)).normalize();
      this.spawn({ pos: pos.clone().addScaledVector(d, rnd(0, 1.5)), vel: d.multiplyScalar(rnd(1, 5)), s0: rnd(1, 2), s1: rnd(5, 10), life: rnd(1.8, 3.6), c0: 0x6a6258, c1: 0x15171a, drag: 0.9, grav: 0.9, a: rnd(0.45, 0.75) });
    }
    /* sparks */
    for (let i = 0; i < 34; i++) {
      const d = new THREE.Vector3(rnd(-1, 1), rnd(0.2, 1.2), rnd(-1, 1)).normalize();
      this.spawn({ pos: pos.clone(), vel: d.multiplyScalar(rnd(6, 20)), s0: 0.18, s1: 0.05, life: rnd(0.5, 1.2), c0: 0xffd070, c1: 0xff3000, drag: 0.8, grav: -16, add: true });
    }
    /* shockwave ring + core flash */
    const rm = new THREE.MeshBasicMaterial({ color: 0xffdd99, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40), rm);
    ring.rotation.x = -Math.PI / 2; ring.position.set(pos.x, pos.y + 0.05, pos.z); this.scene.add(ring);
    this.rings.push({ o: ring, m: rm, t: 0, max: 0.7, s1: CFG.blastRadius * 1.6, flat: true });
    const cm = new THREE.MeshBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), cm);
    core.position.copy(pos); this.scene.add(core);
    this.rings.push({ o: core, m: cm, t: 0, max: 0.25, s1: 3.2, flat: false });
  }
  scorch(pos) {
    const m = new THREE.MeshBasicMaterial({ map: scorchTex(), transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
    p.rotation.x = -Math.PI / 2; p.rotation.z = Math.random() * 6.28;
    p.position.set(pos.x, pos.y + 0.03, pos.z); p.scale.setScalar(rnd(5, 7));
    this.scene.add(p); this.scorches.push(p);
    while (this.scorches.length > 6) { const o = this.scorches.shift(); this.scene.remove(o); o.geometry.dispose(); o.material.dispose(); }
  }
  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) { this.scene.remove(p.s); p.s.visible = false; this.free.push(p.s); this.parts.splice(i, 1); continue; }
      p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt)); p.v.y += p.grav * dt;
      p.s.position.addScaledVector(p.v, dt);
      p.s.scale.setScalar(p.s0 + (p.s1 - p.s0) * (1 - Math.pow(1 - k, 3)));
      p.s.material.color.copy(p.c0).lerp(p.c1, k);
      const a = k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9;
      p.s.material.opacity = Math.max(0, a) * p.a;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt; const k = r.t / r.max;
      if (k >= 1) { this.scene.remove(r.o); r.o.geometry.dispose(); r.m.dispose(); this.rings.splice(i, 1); continue; }
      r.o.scale.setScalar(0.4 + (r.s1 - 0.4) * (1 - Math.pow(1 - k, 2.4)));
      r.m.opacity = 1 - k;
    }
  }
  dispose() {
    for (const p of this.parts) { this.scene.remove(p.s); p.s.material.dispose(); }
    for (const s of this.free) s.material.dispose();
    for (const r of this.rings) { this.scene.remove(r.o); r.o.geometry.dispose(); r.m.dispose(); }
    for (const p of this.scorches) { this.scene.remove(p); p.geometry.dispose(); p.material.dispose(); }
    this.parts = []; this.rings = []; this.scorches = []; this.free = [];
  }
}

/* ───────── the weapon ───────── */
export class RocketLauncher {
  constructor(controls) {
    this.controls = controls;
    this.type = "bazooka";
    this.state = "holstered";
    this.animTime = 0; this.cdTime = 0; this.hitDone = false;
    this.onStateChange = null;
    this.rockets = [];
    this._targets = [];
    this._trail = 0;

    this.pivot = new THREE.Group();
    this.pivot.position.set(...CFG.mount);
    this.tube = buildBazooka3D();
    this.tube.scale.setScalar(CFG.modelScale);
    this.tube.position.z = CFG.tubeZ;
    this.pivot.add(this.tube);
    this.mesh = this.pivot;
    this.mesh.visible = false;
    const rig = controls.rig;
    if (rig && rig.spine) rig.spine.add(this.pivot);
    this.fx = controls.scene ? new FX(controls.scene) : null;
  }

  _setState(s) {
    if (this.state === s) return;
    this.state = s;
    if (this.onStateChange) { try { this.onStateChange(this); } catch (e) {} }
  }
  _grip(v) { try { setGrip(this.controls.rig, -1, v); setGrip(this.controls.rig, 1, v); } catch (e) {} }

  draw() {
    if (this.state !== "holstered") return;
    this.mesh.visible = true; this._grip(1); this._setState("drawn");
  }
  holster() {
    if (this.state === "holstered") return;
    this.mesh.visible = false; this._grip(0);
    this._setState("holstered"); this.animTime = 0; this.cdTime = 0;
  }
  fire() {
    if (this.state !== "drawn") return false;
    if (this.cdTime > 0) {
      try { window.__ph3d_phone && window.__ph3d_phone._toast("RELOADING…"); } catch (e) {}
      return false;
    }
    this.cdTime = CFG.cooldown; this.animTime = 0; this.hitDone = false;
    this._setState("firing");
    return true;
  }

  update(dt, targets) {
    if (targets) this._targets = targets;
    if (this.cdTime > 0) this.cdTime = Math.max(0, this.cdTime - dt);

    /* tilt the launcher with the aim pitch (pivot = shoulder) */
    const ap = (this.controls && this.controls.aimPitch) || 0;
    this.pivot.rotation.x = -ap;

    if (this.state === "firing") {
      this.animTime += dt;
      const p = Math.min(this.animTime / CFG.fireDuration, 1);
      if (!this.hitDone && p >= CFG.launchAt) { this.hitDone = true; this._launch(); }
      if (p >= 1) this._setState("drawn");
    }
    this._updateRockets(dt);
    if (this.fx) this.fx.update(dt);
  }

  applyArmPose(R) {
    if (!R) return;
    const ap = (this.controls && this.controls.aimPitch) || 0;
    const P = {
      r_shoulder: [READY.r_shoulder[0] - ap, READY.r_shoulder[1], READY.r_shoulder[2]],
      r_elbow: READY.r_elbow, r_wrist: READY.r_wrist,
      l_shoulder: [READY.l_shoulder[0] - ap, READY.l_shoulder[1], READY.l_shoulder[2]],
      l_elbow: READY.l_elbow, l_wrist: READY.l_wrist,
      spine: READY.spine, head: [READY.head[0] + ap * 0.35, READY.head[1], READY.head[2]],
    };
    if (this.state === "firing") {
      const p = this.animTime / CFG.fireDuration;
      let k;
      if (p < 0.15) k = p / 0.15; else if (p < 0.30) k = 1; else k = Math.max(0, 1 - (p - 0.30) / 0.70);
      const add = (a, b) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
      for (const key of Object.keys(P)) P[key] = add(P[key], KICK[key]);
    }
    applyPose(R, P);
  }

  /* ── launch ── */
  _launch() {
    const c = this.controls; if (!c || !c.scene) return;
    let dir;
    const aim = c.getAim && c.getAim();
    if (aim) dir = aim.dir.clone().normalize();
    else dir = new THREE.Vector3(-Math.sin(c.yaw), 0, -Math.cos(c.yaw));

    const muzzle = this.tube.userData.muzzle;
    this.pivot.updateWorldMatrix(true, true);
    const mp = new THREE.Vector3(); muzzle.getWorldPosition(mp);

    const obj = buildRocket();
    obj.position.copy(mp);
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    c.scene.add(obj);
    this.rockets.push({ obj, pos: mp.clone(), dir, t: 0 });

    /* back-blast + muzzle smoke */
    if (this.fx) {
      const back = dir.clone().negate();
      const rear = mp.clone().addScaledVector(dir, -1.2);
      for (let i = 0; i < 10; i++) {
        const d = back.clone().add(new THREE.Vector3(rnd(-.5, .5), rnd(-.3, .5), rnd(-.5, .5))).normalize();
        this.fx.spawn({ pos: rear.clone(), vel: d.multiplyScalar(rnd(3, 9)), s0: 0.4, s1: 1.8, life: rnd(0.3, 0.6), c0: 0xffc060, c1: 0x301000, drag: 3, add: true });
      }
      for (let i = 0; i < 14; i++) {
        const d = back.clone().add(new THREE.Vector3(rnd(-.8, .8), rnd(0, .6), rnd(-.8, .8))).normalize();
        this.fx.spawn({ pos: rear.clone(), vel: d.multiplyScalar(rnd(2, 6)), s0: 0.5, s1: 2.6, life: rnd(1, 2), c0: 0x8a8378, c1: 0x20242a, drag: 1.4, grav: 0.6, a: 0.5 });
      }
    }
    try { Sfx.play("gunshot_sniper", { x: mp.x, z: mp.z, vol: 1, rate: 0.55 }); } catch (e) {}
    try { navigator.vibrate && navigator.vibrate([40, 20, 60]); } catch (e) {}
  }

  _groundAt(x, z) {
    const w = this.controls.world;
    try { if (w && w.groundAt) return w.groundAt(x, z); } catch (e) {}
    return 0;
  }

  _hitsWorld(p) {
    const cols = this.controls.world && this.controls.world.colliders;
    if (!cols) return false;
    for (let i = 0; i < cols.length; i++) {
      const b = cols[i];
      if (p.x < b.minX || p.x > b.maxX || p.z < b.minZ || p.z > b.maxZ) continue;
      const y0 = b.y0 != null ? b.y0 : 0, y1 = b.y1 != null ? b.y1 : 3;
      if (p.y >= y0 && p.y <= y1) return true;
    }
    return false;
  }

  _hitsTarget(p) {
    for (const o of this._targets || []) {
      if (!o || !o.alive) continue;
      const oy = o.y != null ? o.y : 0;
      if (Math.hypot(p.x - o.x, p.z - o.z) < 0.75 && p.y > oy - 0.1 && p.y < oy + 1.95) return true;
    }
    return false;
  }

  _updateRockets(dt) {
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.t += dt;
      const speed = Math.min(CFG.speed0 + (CFG.speed1 - CFG.speed0) * (r.t / 0.5), CFG.speed1);
      const dist = speed * dt;
      const n = Math.max(1, Math.ceil(dist / 0.25));
      const step = dist / n;
      let boom = false;
      for (let s = 0; s < n && !boom; s++) {
        r.pos.addScaledVector(r.dir, step);
        if (r.pos.y <= this._groundAt(r.pos.x, r.pos.z) + 0.08) boom = true;
        else if (this._hitsWorld(r.pos) || this._hitsTarget(r.pos)) boom = true;
      }
      r.obj.position.copy(r.pos);

      /* flames + smoke trail */
      const fl = r.obj.userData.flames, f = 0.75 + Math.random() * 0.5;
      fl[0].scale.set(f, 1, f); fl[1].scale.set(f * 0.9, 1, f * 0.9);
      if (this.fx && (r._tr = (r._tr || 0) - dt) <= 0) {
        r._tr = 0.02;
        const back = r.dir.clone().negate();
        const p = r.pos.clone().addScaledVector(back, 0.4);
        this.fx.spawn({ pos: p, vel: back.clone().multiplyScalar(rnd(0.3, 1.2)), s0: 0.18, s1: 1.1, life: rnd(0.8, 1.5), c0: 0xcfc8bd, c1: 0x23262b, drag: 1.5, grav: 0.4, a: 0.5 });
      }
      if (boom || r.t > CFG.maxLife) {
        this.controls.scene.remove(r.obj);
        this.rockets.splice(i, 1);
        this._explode(r.pos.clone());
      }
    }
  }

  _explode(pos) {
    const c = this.controls;
    if (this.fx) { this.fx.burst(pos); if (pos.y < 2.5) this.fx.scorch(new THREE.Vector3(pos.x, this._groundAt(pos.x, pos.z), pos.z)); }
    try { Sfx.play("car_crash_heavy", { x: pos.x, z: pos.z, vol: 1, rate: 0.55 }); } catch (e) {}
    try { navigator.vibrate && navigator.vibrate([80, 30, 120]); } catch (e) {}

    /* area damage: EVERY alive target in range */
    let hits = 0, kills = 0;
    for (const o of this._targets || []) {
      if (!o || !o.alive) continue;
      const oy = (o.y != null ? o.y : 0) + 0.9;
      const d = Math.hypot(o.x - pos.x, o.z - pos.z, oy - pos.y);
      if (d > CFG.blastRadius) continue;
      const k = d <= CFG.killRadius ? 1 : 1 - (d - CFG.killRadius) / (CFG.blastRadius - CFG.killRadius);
      const dmg = Math.max(30, CFG.damage * k);
      hits++;
      try {
        if (o.hp !== undefined) o.hp -= dmg;
        if (o.onHit) o.onHit(dmg, "bazooka", "torso");
        if (!o.alive || (o.hp !== undefined && o.hp <= 0)) kills++;
      } catch (e) {}
    }

    /* the blast hurts you too if you're standing close */
    try {
      const pd = Math.hypot(c.pos.x - pos.x, (c.pos.y + 0.9) - pos.y, c.pos.z - pos.z);
      if (pd < CFG.selfRadius) Combat.damage(Math.round(CFG.selfDamage * (1 - pd / CFG.selfRadius)), "own blast");
    } catch (e) {}

    try {
      if (c.opts && typeof c.opts.onGunFire === "function") {
        c.opts.onGunFire({ x: pos.x, z: pos.z, damage: CFG.damage, type: "bazooka", part: "torso", hit: hits > 0 });
      }
    } catch (e) {}
    try {
      const ph = window.__ph3d_phone;
      if (ph && ph._toast) ph._toast(kills > 1 ? "\uD83D\uDCA5 MULTI-KILL x" + kills : kills === 1 ? "\uD83D\uDCA5 KILL" : "\uD83D\uDCA5 BOOM");
    } catch (e) {}
  }

  dispose() {
    for (const r of this.rockets) { try { this.controls.scene.remove(r.obj); } catch (e) {} }
    this.rockets = [];
    if (this.fx) this.fx.dispose();
    if (this.pivot.parent) this.pivot.parent.remove(this.pivot);
    this._grip(0);
  }
}
