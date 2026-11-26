/* Everyday Cinematics — film director.
   Turns a scripted scene (cast, blocking, dialogue timing, shot list) into acting + camera work.

   • Every actor is driven by the game's own Animator (characters/animator.js): the real foot-planted gait,
     seated pose, hug / handshake / wave / look-around … emotes. Nothing is a looping "pace and turn" fake.
   • Actors turn to face the person they talk to and look at the speaker; the speaker gestures, listeners nod.
     Nobody ever plays to the lens.
   • The camera is a small film crew: establishing, two-shot, over-the-shoulder, close-up with eye-line
     matching, tracking and behind-shoulder follow, insert shots — real lens (focal length) maths, a fixed
     side of the line of action (180° rule), eased pushes / slides / orbits and a touch of handheld.
   • Scenes are deterministic: step(dt) from t=0 gives the same film every time (used by the MP4 renderer). */
import * as THREE from '../../vendor/three/three.module.min.js';
import * as Animator from '../characters/animator.js';
import { addCarDoors, setDoorTarget, updateDoors } from '../vehicles/car-doors.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
/* focal length (mm, full-frame, 16:9 crop → 20.25 mm sensor height) → vertical field of view in degrees */
export const lensToFov = (mm) => THREE.MathUtils.radToDeg(2 * Math.atan(20.25 / (2 * mm)));

/* ------------------------------------------------------------------ props */
const lam = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
const bx = (w, h, d, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y, z); return m; };
const cy = (r1, r2, h, c, x = 0, y = 0, z = 0, seg = 14) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), lam(c)); m.position.set(x, y, z); return m; };

export const PROPS = {
  /* origin = where the hand grips; the object hangs below */
  suitcase() { const g = new THREE.Group(); g.add(bx(0.46, 0.62, 0.21, '#7b2b2b', 0, -0.44, 0), bx(0.40, 0.04, 0.215, '#1c1c1f', 0, -0.30, 0), bx(0.12, 0.03, 0.03, '#2a2a2e', 0, -0.07, 0), bx(0.02, 0.10, 0.02, '#2a2a2e', -0.05, -0.04, 0), bx(0.02, 0.10, 0.02, '#2a2a2e', 0.05, -0.04, 0), cy(0.03, 0.03, 0.03, '#111', -0.17, -0.77, 0.07), cy(0.03, 0.03, 0.03, '#111', 0.17, -0.77, 0.07)); g.rotation.y = Math.PI / 2; return g; },
  briefcase() { const g = new THREE.Group(); g.add(bx(0.42, 0.30, 0.10, '#3a2a1c', 0, -0.26, 0), bx(0.12, 0.03, 0.03, '#15110d', 0, -0.07, 0), bx(0.03, 0.08, 0.03, '#15110d', -0.05, -0.05, 0), bx(0.03, 0.08, 0.03, '#15110d', 0.05, -0.05, 0), bx(0.05, 0.03, 0.105, '#c7a447', -0.12, -0.14, 0), bx(0.05, 0.03, 0.105, '#c7a447', 0.12, -0.14, 0)); g.rotation.y = Math.PI / 2; return g; },
  phone() { const g = new THREE.Group(); g.add(bx(0.072, 0.150, 0.009, '#101114'), bx(0.064, 0.138, 0.002, '#72b9ff', 0, 0, 0.0055)); const s = g.children[1]; s.material = new THREE.MeshBasicMaterial({ color: '#8cc8ff' }); return g; },
  book() { const g = new THREE.Group(); g.add(bx(0.21, 0.29, 0.024, '#2a5fa8'), bx(0.19, 0.27, 0.018, '#f1ede2', 0.006, 0, 0.0)); return g; },
  folder() { const g = new THREE.Group(); g.add(bx(0.23, 0.31, 0.012, '#e0d2a6'), bx(0.205, 0.285, 0.012, '#fbfaf5', 0.005, 0, 0.007)); return g; },
  cup() { const g = new THREE.Group(); g.add(cy(0.036, 0.028, 0.10, '#f4f1ea', 0, 0, 0), cy(0.0375, 0.0375, 0.025, '#b8352f', 0, 0.01, 0)); return g; },
  backpack() { const g = new THREE.Group(); g.add(bx(0.30, 0.40, 0.15, '#2d3b5a', 0, 0, 0), bx(0.24, 0.16, 0.06, '#26324d', 0, -0.07, 0.10), bx(0.30, 0.04, 0.155, '#22304b', 0, 0.16, 0)); return g; },
  plate() { const g = new THREE.Group(); g.add(cy(0.13, 0.11, 0.018, '#f6f4ee', 0, 0, 0, 20)); const rice = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), lam('#f1e8d0')); rice.scale.set(1, 0.55, 1); rice.position.set(-0.04, 0.03, 0); const stew = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), lam('#b5341d')); stew.scale.set(1, 0.5, 1); stew.position.set(0.05, 0.025, 0.02); g.add(rice, stew); return g; },
  pen() { const g = new THREE.Group(); g.add(cy(0.006, 0.006, 0.14, '#1d2a52')); g.rotation.z = Math.PI / 2; return g; },
  keys() { const g = new THREE.Group(); g.add(cy(0.012, 0.012, 0.004, '#c9ced6', 0, -0.03, 0), bx(0.012, 0.05, 0.004, '#c9ced6', 0, -0.065, 0)); return g; },
};
/* how each prop sits when held (local to the wrist joint) */
const HOLD = {
  suitcase: { p: [0, -0.07, 0.01], r: [0, 0, 0] },
  briefcase: { p: [0, -0.07, 0.01], r: [0, 0, 0] },
  phone: { p: [0, -0.10, 0.045], r: [-0.45, 0, 0] },
  book: { p: [0, -0.10, 0.05], r: [-1.2, 0, 0] },
  folder: { p: [0.02, -0.11, 0.05], r: [-1.2, 0, 0] },
  cup: { p: [0, -0.12, 0.03], r: [0, 0, 0] },
  pen: { p: [0, -0.10, 0.02], r: [0.3, 0, 0] },
  keys: { p: [0, -0.09, 0.0], r: [0, 0, 0] },
};

/* ------------------------------------------------------------------ actor */
const WALK = 1.32;

export class Actor {
  constructor(character, id, seed = 0, scale = 1) {
    this.id = id; this.character = character; this.root = character.root; this.rig = character.rig;
    this.seed = seed; this.t = seed * 3.7;
    this.x = 0; this.z = 0; this.y = 0; this.yaw = 0;
    this.speed = 0; this.cruise = WALK; this.route = []; this.afterFace = null;
    this.faceT = null; this.turnRate = 3.6; this.look = null; this.gaze = 0; this.gazeP = 0;
    this.speakT = 0; this.spk = 0; this.listenNod = 0;
    this.phone = 0; this.phoneGoal = 0; this.carry = null; this.holding = {};
    this.seat = null; this.seatPhase = 0; this.seatAnim = null;
    this.handUse = 0; this.hidden = false; this.fade = 1; this.emoteLock = 0;
    this._dt = 1 / 30; this.eyeH = 1.6;
    this.ctl = {
      rig: this.rig, pos: { x: 0, y: 0, z: 0 }, yaw: 0, state: 'standing', onGround: true, level: 0, vel: { y: 0 },
      _intentSpeed: 0, _ul: () => {}, _emoteTimer: 0, _emoteName: null, _emotePhase: 0, _useTimer: 0, _useBend: 0.3,
      weapons: null, held: null, phoneHold: false, sitTarget: null,
    };
    this.ctl._overlay = (R, emoting) => this._overlay(R, emoting);
  }

  place(x, z, yaw) { this.x = x; this.z = z; this.y = 0; this.yaw = yaw; this.speed = 0; this.route = []; this.faceT = null; this.sync(); }
  get eyeY() { return this.y + this.eyeH; }
  head() { return new THREE.Vector3(this.x, this.y + this.eyeH, this.z); }
  sync() {
    this.root.position.set(this.x, this.y, this.z); this.root.rotation.y = this.yaw;
    this.ctl.pos.x = this.x; this.ctl.pos.z = this.z; this.ctl.pos.y = this.y; this.ctl.yaw = this.yaw;
  }
  stepTo(p) { return p && (p.isActor ? [p.x, p.z] : [p.x, p.z]); }

  walk(points, speed, face) { this.route = points.map((p) => ({ x: p.x, z: p.z })); this.cruise = speed || WALK; this.afterFace = face || null; this.faceT = null; }
  faceTo(target) { this.faceT = target; }
  lookAt(target) { this.look = target; }
  say(dur) { this.speakT = dur; }
  emote(name, secs) {
    const c = this.ctl, d = Animator.EMOTES[name];
    if (!d) return;
    c._emoteName = name; c._emotePhase = 0; c._emoteTimer = (secs || d.dur / 1.4) * 1.4;
  }
  setPhone(on) { this.phoneGoal = on ? 1 : 0; }

  /* grab a prop: it hangs in the right hand (or on the back) until dropped */
  hold(name, hand = 'R') {
    this.release(name);
    const m = PROPS[name]; if (!m) return null;
    const obj = m();
    if (name === 'backpack') { obj.position.set(0, 0.28, -0.15); this.rig.spine.add(obj); }
    else {
      const wrist = hand === 'L' ? this.rig.armL.wrist : this.rig.armR.wrist, h = HOLD[name] || HOLD.keys;
      obj.position.set(...h.p); obj.rotation.x += h.r[0]; obj.rotation.y += h.r[1]; obj.rotation.z += h.r[2]; wrist.add(obj);
      if (name === 'suitcase' || name === 'briefcase') this.carry = hand;
    }
    this.holding[name] = obj; return obj;
  }
  release(name) { const o = this.holding[name]; if (!o) return null; o.parent && o.parent.remove(o); delete this.holding[name]; if ((name === 'suitcase' || name === 'briefcase')) this.carry = null; return o; }
  putDown(name, scene, wx, wy, wz, ry = 0) { const o = this.release(name); if (!o) return; if (name === 'suitcase' || name === 'briefcase') o.position.set(wx, wy + (name === 'suitcase' ? 0.77 : 0.43), wz); else o.position.set(wx, wy, wz); o.rotation.y = ry + (name === 'suitcase' || name === 'briefcase' ? Math.PI / 2 : 0); scene.add(o); return o; }

  sit(seat, from) {
    this.seat = seat; this.ctl.state = 'sitting'; this.ctl.sitTarget = seat;
    this.seatAnim = { t: 0, dur: 1.0, x0: this.x, z0: this.z, y0: this.y, yaw0: this.yaw, x1: seat.x, z1: seat.z, y1: seat.h - 0.935 + 0.10, yaw1: seat.yaw };
    this.route = []; this.speed = 0;
  }
  stand(exit) {
    if (!this.seat) return;
    const s = this.seat;
    this.ctl.state = 'standing'; this.ctl.sitTarget = null;
    this.seatAnim = { t: 0, dur: 0.9, x0: this.x, z0: this.z, y0: this.y, yaw0: this.yaw, x1: exit ? exit.x : this.x, z1: exit ? exit.z : this.z, y1: 0, yaw1: this.yaw, standing: true };
    this.seat = null;
  }
  get seated() { return !!this.seat || (this.seatAnim && !this.seatAnim.standing); }

  update(dt) {
    this._dt = dt; this.t += dt;
    const c = this.ctl;
    /* sit / stand transition */
    if (this.seatAnim) {
      const a = this.seatAnim; a.t += dt; const k = sstep(a.t / a.dur);
      this.x = lerp(a.x0, a.x1, k); this.z = lerp(a.z0, a.z1, k); this.y = lerp(a.y0, a.y1, k);
      this.yaw = a.yaw0 + wrapPi(a.yaw1 - a.yaw0) * k;
      if (a.t >= a.dur) this.seatAnim = null;
      c._intentSpeed = a.standing ? 0.5 * (1 - k) : 0;
    } else if (!this.seat) {
      this.updateMove(dt);
    } else c._intentSpeed = 0;

    /* talking envelope */
    if (this.speakT > 0) this.speakT -= dt;
    this.spk = damp(this.spk, this.speakT > 0 ? 1 : 0, this.speakT > 0 ? 7 : 4, dt);
    this.phone = damp(this.phone, this.phoneGoal, 6, dt);
    this.sync();
    Animator.animate(c, dt);
  }

  updateMove(dt) {
    const c = this.ctl; let want = 0;
    if (this.route.length) {
      const tgt = this.route[0], dx = tgt.x - this.x, dz = tgt.z - this.z, d = Math.hypot(dx, dz);
      const last = this.route.length === 1;
      const slow = last ? clamp(d * 1.5, 0.18, this.cruise) : this.cruise;
      if (d < (last ? 0.06 : 0.35)) {
        this.route.shift();
        if (!this.route.length) { this.speed = 0; if (this.afterFace) this.faceT = this.afterFace; }
      } else {
        const heading = Math.atan2(dx, dz), diff = wrapPi(heading - this.yaw);
        this.yaw += clamp(diff, -this.turnRate * 1.6 * dt, this.turnRate * 1.6 * dt);
        want = Math.abs(diff) > 1.1 ? 0.25 : slow;
        this.speed = damp(this.speed, want, 5, dt);
        const adv = Math.min(this.speed * dt, d);
        this.x += Math.sin(this.yaw) * adv; this.z += Math.cos(this.yaw) * adv;
      }
    } else this.speed = damp(this.speed, 0, 8, dt);
    c._intentSpeed = this.speed < 0.03 ? 0 : this.speed;
    if (!this.route.length && this.faceT && this.speed < 0.2) {
      const t = this.faceT.isActor ? this.faceT : { x: this.faceT.x, z: this.faceT.z };
      const goal = Math.atan2(t.x - this.x, t.z - this.z), diff = wrapPi(goal - this.yaw);
      this.yaw += clamp(diff, -this.turnRate * dt, this.turnRate * dt);
    }
  }

  /* applied by the Animator after it writes the pose: gaze, conversational gestures, phone, carried bag */
  _overlay(R, emoting) {
    const t = this.t, dt = this._dt, seed = this.seed;
    const pairEmote = this.ctl._emoteName === 'hug' || this.ctl._emoteName === 'handshake';
    const seated = this.ctl.state === 'sitting';
    /* ---- gaze ---- */
    if (this.look) {
      const L = this.look, lx = L.x, lz = L.z, ly = L.isActor ? L.eyeY : (L.y ?? 1.5);
      const want = wrapPi(Math.atan2(lx - this.x, lz - this.z) - this.yaw);
      const dist = Math.hypot(lx - this.x, lz - this.z) + 0.01;
      this.gaze = damp(this.gaze, clamp(want, -1.25, 1.25), 6, dt);
      this.gazeP = damp(this.gazeP, clamp(Math.atan2(ly - this.eyeY, dist), -0.5, 0.5), 5, dt);
    } else { this.gaze = damp(this.gaze, 0, 4, dt); this.gazeP = damp(this.gazeP, 0, 4, dt); }
    if (!pairEmote) {
      R.head.rotation.y += this.gaze * 0.62; R.head.rotation.x -= this.gazeP * 0.7;
      if (R.neck) { R.neck.rotation.y += this.gaze * 0.30; R.neck.rotation.x -= this.gazeP * 0.2; }
      R.spine.rotation.y += this.gaze * (seated ? 0.42 : 0.08);
    }
    if (emoting) return;
    /* ---- conversation: speaking gestures, listening nods ---- */
    const sp = this.spk;
    if (sp > 0.02) {
      const g = Math.pow(Math.max(0, Math.sin(t * 2.1 + seed * 2.3) * Math.sin(t * 0.83 + seed)), 0.7);
      const g2 = Math.pow(Math.max(0, Math.sin(t * 1.7 + seed * 5.1 + 1.3) * Math.sin(t * 0.61 + seed * 0.7)), 0.8);
      const wR = sp * (0.22 + 0.78 * g), wL = sp * g2 * 0.8;
      R.head.rotation.x += sp * (0.02 * Math.sin(t * 6.4 + seed) + 0.06 * g);
      R.head.rotation.y += sp * 0.05 * Math.sin(t * 1.3 + seed);
      R.head.rotation.z += sp * 0.03 * Math.sin(t * 0.9 + seed * 2);
      R.spine.rotation.x += sp * 0.015;
      const down = seated ? -0.55 : 0;                          /* seated: gestures come from the lap / desk height */
      if (this.carry !== 'R' && !this.phone) {
        const e = 0.5 + 0.5 * Math.sin(t * 4.2 + seed);
        const a = R.armR; const k = clamp(wR, 0, 1);
        a.shoulder.rotation.x = lerp(a.shoulder.rotation.x, -0.78 - 0.30 * g + down * 0.4, k);
        a.shoulder.rotation.z = lerp(a.shoulder.rotation.z, -0.30 - 0.20 * g, k);
        a.elbow.rotation.x = lerp(a.elbow.rotation.x, -1.05 - 0.30 * g - 0.10 * e, k);
        a.wrist.rotation.y = lerp(a.wrist.rotation.y, 0.5, k);
        if (k > 0.3) Animator.setHand(a, -1, Animator.HAND.open);
      }
      if (this.carry !== 'L' && !seated && wL > 0.05) {
        const a = R.armL; const k = clamp(wL, 0, 1);
        a.shoulder.rotation.x = lerp(a.shoulder.rotation.x, -0.62 - 0.25 * g2, k);
        a.shoulder.rotation.z = lerp(a.shoulder.rotation.z, 0.28 + 0.18 * g2, k);
        a.elbow.rotation.x = lerp(a.elbow.rotation.x, -1.0 - 0.25 * g2, k);
        if (k > 0.3) Animator.setHand(a, +1, Animator.HAND.open);
      }
    } else if (this.look && this.look.isActor && this.look.spk > 0.5) {
      /* listening: slow agreeing nods and a small head tilt */
      const n = Math.pow(Math.max(0, Math.sin(t * 0.95 + seed * 4.1)), 10);
      R.head.rotation.x += 0.10 * n; R.head.rotation.z += 0.025 * Math.sin(t * 0.5 + seed);
    }
    /* ---- phone to the ear ---- */
    if (this.phone > 0.02) {
      const k = sstep(this.phone), a = R.armR;
      a.shoulder.rotation.x = lerp(a.shoulder.rotation.x, -1.95, k); a.shoulder.rotation.y = lerp(a.shoulder.rotation.y, 0.28, k); a.shoulder.rotation.z = lerp(a.shoulder.rotation.z, -0.42, k);
      a.elbow.rotation.x = lerp(a.elbow.rotation.x, -2.30, k); a.wrist.rotation.y = lerp(a.wrist.rotation.y, 0.1, k);
      R.head.rotation.z += 0.07 * k; Animator.setHand(a, -1, Animator.HAND.relaxed);
    }
    /* ---- a carried bag: the carrying arm barely swings ---- */
    if (this.carry) {
      const a = this.carry === 'R' ? R.armR : R.armL, s = this.carry === 'R' ? -1 : 1;
      a.shoulder.rotation.x *= 0.22; a.shoulder.rotation.z = s * 0.07; a.elbow.rotation.x = Math.min(a.elbow.rotation.x, -0.12);
    }
  }
}
Actor.prototype.isActor = true;

/* ------------------------------------------------------------------ directed act */
export function wallMeshes(group) {
  /* every solid thing the lens could end up inside (walls, pillars, furniture): everything except flat floors / rugs */
  const out = [], box = new THREE.Box3(), v = new THREE.Vector3();
  group.updateWorldMatrix(true, true);
  group.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.visible === false) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); box.getSize(v);
    if (v.y >= 0.35 && box.min.y < 2.4) out.push(o);
  });
  return out;
}

export class DirectedAct {
  /* opts: { script, stage, toWorld(v:[x,y,z])→Vector3, yaw, scene, castGroup, makeCharacter(spec,index), car, carBuilder,
             setRec, interior } */
  constructor(o) {
    Object.assign(this, o);
    const S = this.script;
    this.actors = new Map(); this.list = [];
    this.yawS = this.stage.yaw || 0;
    this.zAxisW = new THREE.Vector3(Math.sin(this.yawS), 0, Math.cos(this.yawS));
    this.events = (S.events || []).slice().sort((a, b) => a.t - b.t);
    this.shots = (S.shots || []).slice().sort((a, b) => a.t - b.t);
    this.duration = S.duration || 13;
    this.props = []; this.walls = null; this.ray = new THREE.Raycaster();
    S.cast.forEach((spec, i) => {
      const ch = this.makeCharacter(spec, i);
      const a = new Actor(ch, spec.id, i * 1.37 + 0.4);
      this.castGroup.add(ch.root); this.actors.set(spec.id, a); this.list.push(a);
    });
    /* vehicle */
    this.car = null;
    if (S.car && this.carBuilder) {
      this.car = this.carBuilder(S.car.color || '#183b67', '#c9ced6');
      this.car.scale.setScalar(S.car.scale || 1);
      this.castGroup.add(this.car);
      try { addCarDoors(this.car, { model: 'rangerover' }); } catch (e) { /* doors are cosmetic */ }
    }
    this.car2 = null;
    if (S.car2 && this.carBuilder) { this.car2 = this.carBuilder(S.car2.color || '#8a1f1f', '#c9ced6'); this.castGroup.add(this.car2); }
    this.camPos = new THREE.Vector3(); this.camTgt = new THREE.Vector3(); this.lastShot = -1; this.shotT0 = 0;
    this.camFov = 40; this.keyLight = null;
  }

  W(p) { return p.isVector3 ? p : (p.isActor ? new THREE.Vector3(p.x, 0, p.z) : this.toWorld([p[0], p[2] !== undefined && p.length > 2 ? p[1] : 0, p.length > 2 ? p[2] : p[1]])); }
  /* local [x,z] → world {x,z} */
  P2(p) { const v = this.toWorld([p[0], 0, p[1]]); return { x: v.x, z: v.z }; }
  ref(r) { if (r == null) return null; if (typeof r === 'string') return this.actors.get(r); if (r.isActor) return r; if (Array.isArray(r)) { const q = this.P2(r); return { x: q.x, z: q.z, y: r[2] ?? 1.5 }; } return r; }

  reset() {
    const S = this.script; this.time = 0; this.ei = 0; this.lastShot = -1;
    this.props.forEach((p) => p.parent && p.parent.remove(p)); this.props = [];
    this.list.forEach((a) => {
      Object.keys(a.holding).forEach((k) => a.release(k));
      a.ctl._anim = null; a.ctl._emoteTimer = 0; a.ctl._emoteName = null; a.ctl.state = 'standing'; a.ctl.sitTarget = null;
      a.seat = null; a.seatAnim = null; a.hidden = false; a.root.visible = true; a.phone = 0; a.phoneGoal = 0;
      a.look = null; a.faceT = null; a.speakT = 0; a.spk = 0; a.gaze = 0; a.gazeP = 0; a.t = a.seed * 3.7; a.afterFace = null; a.carry = null;
    });
    for (const [id, st] of Object.entries(S.start || {})) {
      const a = this.actors.get(id); if (!a) continue; const p = this.P2(st.p);
      a.place(p.x, p.z, (st.yaw ?? 0) + this.yawS);
      if (st.face) a.yaw = Math.atan2(this.ref(st.face).x - p.x, this.ref(st.face).z - p.z);
      a.sync();
    }
    /* actors that start seated */
    for (const [id, st] of Object.entries(S.start || {})) {
      if (!st.seat) continue; const a = this.actors.get(id); const seat = this.findSeat(st.seat);
      if (seat) { a.x = seat.x; a.z = seat.z; a.y = seat.h - 0.835; a.yaw = seat.yaw; a.seat = seat; a.ctl.state = 'sitting'; a.ctl.sitTarget = seat; a.sync(); }
    }
    for (const [id, pr] of Object.entries(S.props || {})) {
      const a = this.actors.get(id); if (a) (Array.isArray(pr) ? pr : [pr]).forEach((p) => a.hold(typeof p === 'string' ? p : p.name, typeof p === 'string' ? 'R' : p.hand || 'R'));
    }
    for (const sp of (S.set || [])) {
      const m = PROPS[sp.prop]; if (!m) continue; const o = m(); const w = this.toWorld([sp.p[0], sp.p[1] || 0, sp.p[2]]);
      o.position.copy(w); o.rotation.y = (sp.ry || 0) + this.yawS; this.scene.add(o); this.props.push(o);
    }
    if (this.car) {
      const c = S.car, w = this.P2(c.p);
      this.car.position.set(w.x, 0, w.z); this.carYaw = (c.yaw ?? 0) + this.yawS; this.car.rotation.y = this.carYaw; this.carSpeed = 0; this.carRoute = []; this.carWheel = 0;
      setDoorTarget(this.car, 'both', 0); updateDoors(this.car, 1);
    }
    if (this.car2) { const c = S.car2, w = this.P2(c.p); this.car2.position.set(w.x, 0, w.z); this.car2.rotation.y = (c.yaw ?? 0) + this.yawS; }
    this.list.forEach((a) => { Animator.animate(a.ctl, 1 / 60); });
    this.pendingShake = 0; this.camInit = false;
  }

  findSeat(q) {
    const seats = (this.setRec && this.setRec.built && this.setRec.built.seats) || [];
    if (typeof q === 'number') return seats[q];
    const p = this.P2(q); let best = null, bd = 1e9;
    for (const s of seats) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; best = s; } }
    return best;
  }

  /* ---------------- events ---------------- */
  exec(ev) {
    if (ev.do === 'car') return this.execCar(ev);
    const a = this.actors.get(ev.who);
    switch (ev.do) {
      case 'walk': { const pts = (Array.isArray(ev.to[0]) ? ev.to : [ev.to]).map((p) => this.P2(p)); if (a) a.walk(pts, ev.speed, ev.face != null ? this.ref(ev.face) : null); break; }
      case 'face': if (a) { a.faceT = this.ref(ev.at); if (ev.rate) a.turnRate = ev.rate; } break;
      case 'look': if (a) a.look = this.ref(ev.at); break;
      case 'say': {
        if (!a) break; a.say(ev.dur);
        const to = this.ref(ev.to); if (to && to.isActor) {
          a.look = to; if (!to.seat) { const d = Math.abs(wrapPi(Math.atan2(a.x - to.x, a.z - to.z) - to.yaw)); if (d > 0.5 && to.speed < 0.1) to.faceT = a; }
          if (!to.look || to.look !== a) to.look = a;
          if (!a.seat && !a.route.length) { const d = Math.abs(wrapPi(Math.atan2(to.x - a.x, to.z - a.z) - a.yaw)); if (d > 0.5) a.faceT = to; }
        }
        break;
      }
      case 'emote': if (a) a.emote(ev.name, ev.secs); break;
      case 'pair': { /* hug / handshake: both actors emote together */ const b = this.ref(ev.with); if (a) a.emote(ev.name, ev.secs); if (b && b.isActor) b.emote(ev.name, ev.secs); break; }
      case 'sit': if (a) { const seat = this.findSeat(ev.seat); if (seat) a.sit(seat); } break;
      case 'stand': if (a) a.stand(ev.to ? this.P2(ev.to) : null); break;
      case 'phone': if (a) a.setPhone(ev.on !== false); break;
      case 'hold': if (a) a.hold(ev.prop, ev.hand || 'R'); break;
      case 'drop': if (a) { const w = this.toWorld([ev.at[0], ev.at[1] || 0, ev.at[2]]); const o = a.putDown(ev.prop, this.scene, w.x, w.y, w.z, (ev.ry || 0) + this.yawS); if (o) this.props.push(o); } break;
      case 'give': { /* hand a prop from one actor to another */ const b = this.ref(ev.to); if (a && b) { a.release(ev.prop); b.hold(ev.prop, ev.hand || 'R'); } break; }
      case 'hide': if (a) { a.hidden = true; a.root.visible = false; } break;
      case 'show': if (a) { a.hidden = false; a.root.visible = true; if (ev.at) { const p = this.P2(ev.at); a.x = p.x; a.z = p.z; if (ev.yaw != null) a.yaw = ev.yaw + this.yawS; a.sync(); } } break;
      case 'door': if (this.car) setDoorTarget(this.car, ev.side || 'left', ev.open === false ? 0 : (ev.open ?? 1)); break;
      case 'shake': this.pendingShake = ev.amount || 0.5; break;
      default: break;
    }
  }
  execCar(ev) {
    if (!this.car) return;
    if (ev.route) this.carRoute = ev.route.map((p) => this.P2(p));
    this.carCruise = ev.speed ?? 6; this.carBrake = ev.brake ?? 6;
  }
  stepCar(dt) {
    if (!this.car) return;
    const car = this.car; let want = 0;
    if (this.carRoute && this.carRoute.length) {
      const tgt = this.carRoute[0], dx = tgt.x - car.position.x, dz = tgt.z - car.position.z, d = Math.hypot(dx, dz), last = this.carRoute.length === 1;
      const stopD = this.speedSq === undefined ? 0 : 0; void stopD;
      want = this.carCruise; if (last) want = Math.min(this.carCruise, Math.max(0.0, Math.sqrt(2 * (this.carBrake * 0.6) * Math.max(0, d - 0.05))));
      if (d < 0.25 && !last) this.carRoute.shift();
      else if (last && d < 0.05) { this.carRoute.shift(); this.carSpeed = 0; }
      else { const head = Math.atan2(dx, dz); this.carYaw += clamp(wrapPi(head - this.carYaw), -1.2 * dt, 1.2 * dt); }
    }
    this.carSpeed = damp(this.carSpeed, want, want > this.carSpeed ? 1.6 : 3.4, dt);
    if (this.carSpeed < 0.02 && !(this.carRoute && this.carRoute.length)) this.carSpeed = 0;
    car.position.x += Math.sin(this.carYaw) * this.carSpeed * dt; car.position.z += Math.cos(this.carYaw) * this.carSpeed * dt;
    car.rotation.y = this.carYaw;
    const wheels = car.userData.wheels || [];
    this.carWheel += (this.carSpeed * dt) / 0.44;
    wheels.forEach((w) => { try { const sp = w.spin || w.pivot; if (sp && sp.rotation) sp.rotation.x = this.carWheel; } catch (e) { /* ignore */ } });
    updateDoors(car, dt);
  }

  step(dt) {
    this.time += dt;
    while (this.ei < this.events.length && this.events[this.ei].t <= this.time + 1e-6) this.exec(this.events[this.ei++]);
    this.list.forEach((a) => { if (!a.hidden) a.update(dt); });
    this.stepCar(dt);
  }

  /* ---------------- camera ---------------- */
  shotAt(time) { let i = 0; for (let k = 0; k < this.shots.length; k++) if (this.shots[k].t <= time + 1e-6) i = k; return i; }
  side(sh) { return (sh.side ?? this.script.side ?? 1); }
  perp(u, s) { return new THREE.Vector3(-u.z * s, 0, u.x * s); }
  ensureSide(u, s) { /* the camera side of the line of action: always on the stage's camera side of the axis */
    const p = this.perp(u, s); if (p.dot(this.zAxisW) < -0.05) return -s; return s;
  }

  compose(sh, u, dt) {
    const E = (id) => this.ref(id);
    const out = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), lens: sh.lens || 40 };
    const eased = sstep(u);
    const lensTo = sh.lensTo; if (lensTo) out.lens = lerp(sh.lens || 40, lensTo, eased);
    switch (sh.type) {
      case 'free': {
        const a = this.toWorld(sh.from), b = this.toWorld(sh.to || sh.from);
        out.pos.lerpVectors(a, b, eased);
        const look0 = sh.look && (typeof sh.look === 'string' ? this.look3(sh.look) : this.toWorld(sh.look));
        const look1 = sh.lookTo ? (typeof sh.lookTo === 'string' ? this.look3(sh.lookTo) : this.toWorld(sh.lookTo)) : look0;
        out.tgt.lerpVectors(look0, look1, eased); break;
      }
      case 'two': {
        const A = E(sh.a), B = E(sh.b), mid = new THREE.Vector3((A.x + B.x) / 2, 0, (A.z + B.z) / 2);
        const ab = new THREE.Vector3(B.x - A.x, 0, B.z - A.z), d = ab.length(); const uu = d > 1e-3 ? ab.clone().multiplyScalar(1 / d) : new THREE.Vector3(1, 0, 0);
        const s = this.ensureSide(uu, this.side(sh)), p = this.perp(uu, s);
        const fh = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(lensToFov(out.lens)) / 2) * (16 / 9));
        const width = d + (sh.pad ?? 1.9), dist = Math.max(sh.minDist ?? 2.0, width / 2 / Math.tan(fh / 2));
        const ang = (sh.orbit || 0) * (eased - 0.5);
        const dir = p.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
        out.pos.copy(mid).addScaledVector(dir, dist * (1 - (sh.push || 0) * eased)).setY((sh.h ?? 1.45) + (A.y || 0));
        out.tgt.set(mid.x, (sh.ty ?? 1.35) + (A.y || 0), mid.z); break;
      }
      case 'ots': {
        const on = E(sh.on), over = E(sh.over), v = new THREE.Vector3(on.x - over.x, 0, on.z - over.z), d = Math.max(0.3, v.length()); v.multiplyScalar(1 / d);
        const s = this.ensureSide(v, this.side(sh)), p = this.perp(v, s);
        const back = (sh.back ?? 0.8) + (sh.pull || 0) * eased;
        out.pos.copy(over.head ? over.head() : new THREE.Vector3(over.x, 0, over.z)); out.pos.addScaledVector(v, -back).addScaledVector(p, sh.off ?? 0.42); out.pos.y = (over.eyeY ?? 1.5) + (sh.dh ?? 0.06);
        const h = on.eyeY ?? 1.5; out.tgt.set(on.x, h - 0.05, on.z).addScaledVector(p, -(sh.lead ?? 0.1)); break;
      }
      case 'cu': {
        const on = E(sh.on), from = E(sh.from), v = new THREE.Vector3(from.x - on.x, 0, from.z - on.z), d = Math.max(0.3, v.length()); v.multiplyScalar(1 / d);
        const s = this.ensureSide(v, this.side(sh)), p = this.perp(v, s);
        const dist = (sh.dist ?? 1.55) * (1 - (sh.push || 0) * eased);
        out.pos.set(on.x, on.eyeY + (sh.dh ?? 0.0), on.z).addScaledVector(v, dist).addScaledVector(p, sh.off ?? 0.7);
        out.tgt.set(on.x, on.eyeY - (sh.ty ?? 0.04), on.z).addScaledVector(p, -(sh.lead ?? 0.06)); break;
      }
      case 'follow': {
        const who = E(sh.who), hx = Math.sin(who.yaw), hz = Math.cos(who.yaw), hv = new THREE.Vector3(hx, 0, hz), p = this.perp(hv, 1);
        const s = sh.side ?? 1, dist = sh.dist ?? 3.2;
        out.pos.set(who.x, (sh.h ?? 1.35) + (who.y || 0), who.z).addScaledVector(p, s * dist).addScaledVector(hv, sh.ahead ?? -0.4);
        out.tgt.set(who.x, (sh.ty ?? 1.25) + (who.y || 0), who.z).addScaledVector(hv, sh.lead ?? 0.8); break;
      }
      case 'behind': {
        const who = E(sh.who), hv = new THREE.Vector3(Math.sin(who.yaw), 0, Math.cos(who.yaw)), p = this.perp(hv, 1);
        out.pos.set(who.x, (sh.h ?? 1.6) + (who.y || 0), who.z).addScaledVector(hv, -(sh.dist ?? 2.6)).addScaledVector(p, sh.off ?? 0.45);
        out.tgt.set(who.x, (sh.ty ?? 1.35) + (who.y || 0), who.z).addScaledVector(hv, sh.lead ?? 4.0).addScaledVector(p, -(sh.off ?? 0.45) * 0.4); break;
      }
      case 'front': { /* in front of a walker, low-ish, moving backwards with them; they look past the lens */
        const who = E(sh.who), hv = new THREE.Vector3(Math.sin(who.yaw), 0, Math.cos(who.yaw)), p = this.perp(hv, 1);
        out.pos.set(who.x, (sh.h ?? 1.3) + (who.y || 0), who.z).addScaledVector(hv, sh.dist ?? 3.0).addScaledVector(p, sh.off ?? 0.9);
        out.tgt.set(who.x, (sh.ty ?? 1.3) + (who.y || 0), who.z); break;
      }
      case 'insert': {
        const who = E(sh.who); const part = sh.part || 'handR';
        let pt;
        if (who && who.rig && part.startsWith('hand')) { const w = part === 'handL' ? who.rig.armL.wrist : who.rig.armR.wrist; const v = new THREE.Vector3(); w.updateWorldMatrix(true, false); w.getWorldPosition(v); pt = v; }
        else if (who && who.isActor) pt = new THREE.Vector3(who.x, who.y + (sh.hy ?? 1.0), who.z);
        else pt = this.toWorld(sh.at);
        const off = sh.off || [0.35, 0.35, 0.55]; const o = new THREE.Vector3(off[0], off[1], off[2]).applyAxisAngle(new THREE.Vector3(0, 1, 0), (who && who.yaw !== undefined ? who.yaw : this.yawS));
        out.pos.copy(pt).add(o); out.tgt.copy(pt); break;
      }
      case 'car': {
        const c = this.car; const cp = c.position; const hv = new THREE.Vector3(Math.sin(this.carYaw), 0, Math.cos(this.carYaw)), p = this.perp(hv, 1);
        const o = sh.off || [4.2, 1.0, 2.0];
        out.pos.set(cp.x, o[1], cp.z).addScaledVector(p, o[0] * (sh.side ?? 1)).addScaledVector(hv, o[2]); out.tgt.set(cp.x, sh.ty ?? 0.9, cp.z).addScaledVector(hv, sh.lead ?? 0.5); break;
      }
      default: out.pos.set(0, 1.6, 5); out.tgt.set(0, 1.4, 0);
    }
    /* generic eased moves */
    if (sh.slide) { const dir = new THREE.Vector3().subVectors(out.tgt, out.pos).setY(0).normalize(); const sd = this.perp(dir, 1); out.pos.addScaledVector(sd, sh.slide * (eased - 0.5)); }
    if (sh.rise) out.pos.y += sh.rise * eased;
    if (sh.dolly) { const dir = new THREE.Vector3().subVectors(out.tgt, out.pos).setY(0).normalize(); out.pos.addScaledVector(dir, sh.dolly * eased); }
    return out;
  }
  look3(id) { const a = this.ref(id); return a && a.isActor ? new THREE.Vector3(a.x, a.eyeY - 0.1, a.z) : new THREE.Vector3(); }

  updateCamera(camera, dt) {
    if (!this.shots.length) return;
    const i = this.shotAt(this.time), sh = this.shots[i];
    const end = this.shots[i + 1] ? this.shots[i + 1].t : this.duration;
    const u = clamp((this.time - sh.t) / Math.max(0.01, end - sh.t), 0, 1);
    const c = this.compose(sh, u, dt);
    const fresh = i !== this.lastShot || !this.camInit;
    const track = sh.type === 'follow' || sh.type === 'behind' || sh.type === 'front' || sh.type === 'insert' || sh.type === 'car';
    if (fresh) { this.camPos.copy(c.pos); this.camTgt.copy(c.tgt); this.camFov = lensToFov(c.lens); this.lastShot = i; this.camInit = true; this.hand0 = this.time; }
    else {
      const kp = track ? 7 : 40; /* tracked shots are smoothed, composed shots follow exactly */
      this.camPos.x = damp(this.camPos.x, c.pos.x, kp, dt); this.camPos.y = damp(this.camPos.y, c.pos.y, kp, dt); this.camPos.z = damp(this.camPos.z, c.pos.z, kp, dt);
      this.camTgt.x = damp(this.camTgt.x, c.tgt.x, kp * 1.4, dt); this.camTgt.y = damp(this.camTgt.y, c.tgt.y, kp * 1.4, dt); this.camTgt.z = damp(this.camTgt.z, c.tgt.z, kp * 1.4, dt);
      this.camFov = damp(this.camFov, lensToFov(c.lens), 14, dt);
    }
    /* keep the lens out of walls in interiors */
    const pos = this.camPos.clone();
    if (this.interior || this.shield) {
      if (!this.walls) this.walls = wallMeshes(this.setRec.group);
      const dir = new THREE.Vector3().subVectors(pos, this.camTgt); const dist = dir.length(); dir.multiplyScalar(1 / Math.max(dist, 1e-3));
      this.ray.set(this.camTgt, dir); this.ray.far = dist + 0.1;
      const hit = this.ray.intersectObjects(this.walls, false)[0];
      if (hit && hit.distance < dist + 0.05) pos.copy(this.camTgt).addScaledVector(dir, Math.max(0.5, hit.distance - 0.22));
    }
    /* handheld breathing */
    const hm = sh.hand ?? 0.6, tt = this.time;
    const sx = (Math.sin(tt * 1.7) + Math.sin(tt * 2.9 + 1.1) * 0.6) * 0.007 * hm, sy = (Math.sin(tt * 1.3 + 2) + Math.sin(tt * 3.3) * 0.5) * 0.006 * hm;
    pos.x += sx; pos.y += sy;
    camera.position.copy(pos); camera.fov = this.camFov; camera.updateProjectionMatrix();
    const tgt = this.camTgt.clone(); tgt.x += Math.sin(tt * 1.1) * 0.004 * hm; tgt.y += Math.sin(tt * 1.6 + 1) * 0.004 * hm;
    camera.lookAt(tgt);
    camera.rotateZ(Math.sin(tt * 0.9) * 0.0016 * hm);
  }

  /* three-point lighting: warm key from the lens side, cool rim from behind, fill — follows the action */
  setupLights(scene, tod) {
    if (this.lights) return; this.lights = new THREE.Group();
    const key = new THREE.DirectionalLight('#ffe2bd', 1), rim = new THREE.DirectionalLight('#9ec4ff', 1), fill = new THREE.HemisphereLight('#bcd0ff', '#3a342c', 0.0);
    this.lights.add(key, key.target, rim, rim.target, fill); this.keyL = key; this.rimL = rim; this.fillL = fill;
    scene.add(this.lights);
  }
  updateLights(tod) {
    if (!this.lights) return;
    const act = this.list.filter((a) => !a.hidden); if (!act.length) return;
    const c = new THREE.Vector3(); act.forEach((a) => { c.x += a.x; c.z += a.z; }); c.multiplyScalar(1 / act.length);
    const sh = this.shots[this.shotAt(this.time)] || {}; void sh;
    const cam = this.camPos; const toCam = new THREE.Vector3(cam.x - c.x, 0, cam.z - c.z).normalize();
    const night = tod === 'night', dusk = tod === 'dusk';
    const kI = this.interior ? 0.5 : (night ? 1.25 : dusk ? 0.8 : 0.35), rI = this.interior ? 0.35 : (night ? 0.9 : dusk ? 0.7 : 0.25);
    this.keyL.intensity = kI; this.rimL.intensity = rI; this.fillL.intensity = night ? 0.55 : dusk ? 0.3 : 0.0;
    const side = this.perp(toCam, 1);
    this.keyL.position.set(c.x + toCam.x * 4 + side.x * 3, 4.2, c.z + toCam.z * 4 + side.z * 3); this.keyL.target.position.set(c.x, 1.2, c.z);
    this.rimL.position.set(c.x - toCam.x * 4 - side.x * 2, 3.6, c.z - toCam.z * 4 - side.z * 2); this.rimL.target.position.set(c.x, 1.3, c.z);
    this.keyL.target.updateMatrixWorld(); this.rimL.target.updateMatrixWorld();
  }
  setVisible(v) { this.lights && (this.lights.visible = v); }
  destroy() { this.props.forEach((p) => p.parent && p.parent.remove(p)); }
}
