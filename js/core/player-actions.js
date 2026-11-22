/* Player bend-to-pickup + use-with-animation.
   Runs alongside the walk scene's Animator.animator. The player's
   crouch/reach/use animation is driven by overriding the walker pose
   frame-by-frame; the Animator still handles locomotion underneath.

   Public API:
     PlayerActions.pickup(walker, item)      → animates bend + grab, then pockets
     PlayerActions.use(walker, item)         → animates the use gesture
     PlayerActions.hold(walker, mesh)        → attaches a mesh to the hand
     PlayerActions.tick(walker, dt, camera)  → call every frame (before animator)
     PlayerActions.isBusy()                  → true while an action is playing
     PlayerActions.cancel()                  → force-stop the current action */

import * as THREE from "three";

const BEND_TIME   = 0.85;    // seconds from standing → touching → stand
const USE_TIME    = 0.90;
const HOLD_TARGET_Y = 0.95;  // hand height (m above feet)

const _tmpV3 = new THREE.Vector3();
const _tmpV3B = new THREE.Vector3();

/* ── CARRY SYSTEM ─────────────────────────────────────────────────
   Every object is carried in one of a few STYLES. A style fixes the arm and
   hand pose; a PROFILE (per item type) says which style, where on the object
   the fingers close (anchor, as a fraction of its own bounding box), how the
   object is turned relative to the torso (rel), how heavy it feels (move,
   swing, lean) and which hand does the work.

   Joint angles are radians on the right arm. Items nobody listed (market
   goods, pocket items, anything you add later) are classified from their real
   bounding box by _classify(), so they never end up inside the forearm.

   Tuning live in the browser: window.__ph3d_carry.STYLES / PROFILES are the
   same objects the game reads every frame. */
const STYLES = {
  /* thumb-up fist, forearm forward: bottles, cans, packs, cups */
  fist_up:   { hands: 1, curl: 0.85, thumb: 1.0, swing: 0.10, sh: [-0.52, 0.10, -0.10], el: [-1.22, 0, 0], wr: [0, -1.25, 0], off: [0, 0, 0.045] },
  /* phone / small device held up in front of the chest */
  phone:     { hands: 1, curl: 0.55, thumb: 0.6, swing: 0.05, sh: [-0.85, 0.30, -0.10], el: [-1.55, 0, 0], wr: [0.1, -1.0, 0], off: [0, 0, 0.03] },
  /* open palm under the load, forearm forward: plates, boxes, books, notes */
  palm_flat: { hands: 1, curl: 0.12, thumb: 0.2, swing: 0.08, sh: [-0.60, 0.15, -0.06], el: [-1.20, 0, 0], wr: [0, 0, 0], off: [0, 0, 0.03] },
  /* arm straight down, load hangs from the fist: bags, dumbbells */
  hang:      { hands: 1, curl: 0.95, thumb: 1.0, swing: 0.30, sh: [-0.04, 0, -0.10], el: [-0.10, 0, 0], wr: [0, -1.30, 0], off: [0, 0, 0.03] },
  /* fist at the collarbone, long thing rests on the shoulder: bat, broom, cane */
  shoulder:  { hands: 1, curl: 0.95, thumb: 1.0, swing: 0.08, sh: [-0.45, 0.25, -0.22], el: [-1.7, 0, 0], wr: [0, -0.6, 0], off: [0, 0, 0.03] },
  /* both arms round the load, held against the belly: crates, sacks, pots */
  hug2:      { hands: 2, curl: 0.55, thumb: 0.8, swing: 0.0, lean: -0.10 },
};

/* anchor: [x, y, z] fractions of the object's local bounds that sit in the palm.
   rel: object rotation relative to the torso, Euler YXZ radians.
   move: walking-speed multiplier while carrying (running is capped by the same factor). */
const PROFILES = {
  water:      { style: "fist_up",   anchor: [0.5, 0.36, 0.5], move: 1.00 },
  bottle:     { style: "fist_up",   anchor: [0.5, 0.34, 0.5], move: 0.98 },
  spray_can:  { style: "fist_up",   anchor: [0.5, 0.40, 0.5], move: 1.00 },
  cigarettes: { style: "fist_up",   anchor: [0.5, 0.50, 0.5], move: 1.00 },
  phone:      { style: "phone",     anchor: [0.5, 0.45, 0.5], move: 1.00, rel: [0.0, Math.PI, 0.0] },
  money:      { style: "palm_flat", anchor: [0.5, 0.0, 0.5],  move: 1.00 },
  food:       { style: "palm_flat", anchor: [0.5, 0.0, 0.5],  move: 0.97 },
  junkfood:   { style: "palm_flat", anchor: [0.5, 0.0, 0.5],  move: 0.97 },
  book:       { style: "palm_flat", anchor: [0.5, 0.0, 0.5],  move: 0.98 },
  bag:        { style: "hang",      anchor: [0.5, 0.97, 0.5], move: 0.92, rel: [0, Math.PI / 2, 0] },
  dumbbell:   { style: "hang",      anchor: [0.5, 0.50, 0.5], move: 0.80, rel: [0, Math.PI / 2, 0], lean: 0.05 },
  bat:        { style: "shoulder",  anchor: [0.5, 0.10, 0.5], move: 0.95, rel: [-1.15, 0, -0.5] },
  crate:      { style: "hug2",      anchor: [0.5, 0.5, 0.5],  move: 0.55 },
  /* pocket valuables: small enough to rest on the open palm, no weight to speak of */
  ring:       { style: "palm_flat", anchor: [0.5, 0.0, 0.5],  move: 1.00 },
  watch:      { style: "palm_flat", anchor: [0.5, 0.0, 0.5],  move: 1.00 },
  jewel:      { style: "palm_flat", anchor: [0.5, 0.0, 0.5],  move: 1.00 },
  key_house:  { style: "palm_flat", anchor: [0.5, 0.0, 0.5],  move: 1.00 },
  coin:       { style: "palm_flat", anchor: [0.5, 0.0, 0.5],  move: 1.00 },
  cash:       { style: "palm_flat", anchor: [0.5, 0.0, 0.5],  move: 1.00 },
  note:       { style: "palm_flat", anchor: [0.5, 0.0, 0.5],  move: 1.00 },
  bullet:     { style: "palm_flat", anchor: [0.5, 0.0, 0.5],  move: 1.00 },
  cigarette:  { style: "palm_flat", anchor: [0.5, 0.0, 0.5],  move: 1.00 },
  lighter:    { style: "fist_up",   anchor: [0.5, 0.45, 0.5], move: 1.00 },
};

const _bbox = new THREE.Box3(), _bsz = new THREE.Vector3(), _tb = new THREE.Box3(), _tm = new THREE.Matrix4(), _tinv = new THREE.Matrix4();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e1 = new THREE.Euler();

/* bounds in the object's own (unscaled) frame; ignores the pickup glow ring and
   decorative effects so they can neither inflate the size nor shift the grip */
function _localBounds(root) {
  root.updateMatrixWorld(true);
  _tinv.copy(root.matrixWorld).invert();
  const out = new THREE.Box3();
  let any = false;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.visible === false || o.name === "_glowRing" || (o.userData && o.userData.fx)) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    _tb.copy(o.geometry.boundingBox).applyMatrix4(_tm.multiplyMatrices(_tinv, o.matrixWorld));
    out.union(_tb); any = true;
  });
  return any ? out : null;
}

/* Pick a style for anything that has no hand-made profile, from its real size. */
function _classify(mesh, size) {
  const hint = mesh.userData && mesh.userData.carryHint;
  const x = size.x, y = size.y, z = size.z;
  const big = Math.max(x, y, z), small = Math.min(x, y, z);
  const mid = x + y + z - big - small;
  const vol = x * y * z;
  if (hint === "drink") return { style: "fist_up", anchor: [0.5, 0.40, 0.5], move: 0.99 };
  if (hint === "textile") return { style: "palm_flat", anchor: [0.5, 0.0, 0.5], move: 0.98 };
  if (big < 0.14 || hint === "adornment") return { style: "palm_flat", anchor: [0.5, 0.0, 0.5], move: 1.0 };
  if (big > 0.42 || vol > 0.045) return { style: "hug2", anchor: [0.5, 0.5, 0.5], move: Math.max(0.5, 0.8 - vol * 3) };
  if (big / Math.max(mid, 0.001) > 2.4 && big > 0.30) {
    return { style: "shoulder", anchor: [0.5, 0.10, 0.5], move: 0.96, longAxis: x >= y && x >= z ? "x" : (z > y ? "z" : "y") };
  }
  if (small / big < 0.25) return { style: "palm_flat", anchor: [0.5, 0.0, 0.5], move: 0.98 };
  return { style: "fist_up", anchor: [0.5, 0.45, 0.5], move: 0.97 };
}

function _profileFor(mesh, size) {
  const type = mesh && mesh.userData && mesh.userData.itemType;
  const real = size.clone().multiply(mesh.scale);   /* classify by the size you actually see */
  const base = (type && PROFILES[type]) ? PROFILES[type] : _classify(mesh, real);
  const st = STYLES[base.style];
  return { ...base, hands: st.hands, st };
}
const _lerp = (a, b, k) => a + (b - a) * k;
function _blendRot(joint, x, y, z, k) {
  if (!joint || !joint.rotation) return;
  const r = joint.rotation;
  r.set(_lerp(r.x, x, k), _lerp(r.y, y, k), _lerp(r.z, z, k));
}

/* Put the right (or left) palm on a point given in the spine's own frame by
   searching shoulder + elbow angles against the real rig, so hands land ON the
   object whatever its width. Returns { sh:[x,y,z], el:x }. */
const _gp = new THREE.Vector3();
function _gripInSpine(R, arm) {
  arm.grip.getWorldPosition(_gp);
  return R.spine.worldToLocal(_gp);
}
function _solveHand(R, side, target, start) {
  const arm = side < 0 ? R.armR : R.armL;
  if (!arm || !arm.shoulder || !arm.elbow || !arm.grip) return start;
  R.spine.updateWorldMatrix(true, false);
  const p = [start.sh[0], start.sh[1], start.sh[2], start.el];
  const apply = () => { arm.shoulder.rotation.set(p[0], p[1], p[2]); arm.elbow.rotation.set(p[3], 0, 0); arm.shoulder.updateMatrixWorld(true); };
  const err = () => { apply(); const g = _gripInSpine(R, arm); return g.distanceToSquared(target) + 0.0008 * ((p[0] - start.sh[0]) ** 2 + (p[2] - start.sh[2]) ** 2); };
  let best = err(), step = 0.35;
  const lim = [[-2.2, 0.4], [-1.2, 1.2], [-1.0, 1.0], [-2.4, -0.2]];
  for (let it = 0; it < 90 && step > 0.003; it++) {
    let improved = false;
    for (let i = 0; i < 4; i++) {
      for (const dir of [1, -1]) {
        const keep = p[i];
        p[i] = Math.max(lim[i][0], Math.min(lim[i][1], keep + dir * step));
        const e = err();
        if (e < best - 1e-9) { best = e; improved = true; } else p[i] = keep;
      }
    }
    if (!improved) step *= 0.55;
  }
  apply();
  return { sh: [p[0], p[1], p[2]], el: p[3] };
}

export const PlayerActions = {
  _carryBlend: 0,  /* 0 = locomotion arms, 1 = full carry pose (eases in/out) */
  _active: null,   /* { kind: "pickup"|"use", t, dur, item, walker, onDone } */
  _held: null,     /* { mesh, walker } — mesh attached to the hand */
  _outgoing: null, /* { mesh, from, to, t } — item travelling to hand */

  isBusy() { return !!this._active; },

  cancel(walker) {
    if (this._active && this._active.walker) {
      const w = this._active.walker;
      if (w.rig) _releaseArms(w);
    }
    this._active = null;
    this._outgoing = null;
  },

  /* ── PICKUP ─────────────────────────────────────────────────── */
  pickup(walker, item) {
    if (!walker || !walker.rig || !item) return false;
    if (this._active) return false;
    if (item.mesh) { item.mesh.userData = item.mesh.userData || {}; item.mesh.userData._item = item; item.mesh.userData.itemType = item.type; }

    /* hands check: a two-hand load fills both hands, and a two-hand item can't be lifted one-handed */
    if (this._held && item.mesh) {
      const carrying = this._held.mesh.userData._hands === 2;
      const _lb = _localBounds(item.mesh); const incoming = _lb ? _profileFor(item.mesh, _lb.getSize(_bsz)).hands === 2 : false;
      if (carrying || incoming) {
        try { window.__ph3d_phone && window.__ph3d_phone._toast("Both hands needed. Drop what you are carrying first."); } catch (e) {}
        return false;
      }
    }

    /* Fly the item mesh toward the hand first */
    if (item.mesh && item.mesh.parent) {
      const worldStart = new THREE.Vector3();
      item.mesh.getWorldPosition(worldStart);
      this._outgoing = {
        mesh: item.mesh,
        from: worldStart.clone(),
        t: 0,
        dur: BEND_TIME * 0.7,
      };
    }

    this._active = {
      kind: "pickup",
      t: 0,
      dur: BEND_TIME,
      item,
      walker,
      onDone: () => {
        /* Pocket the item — same as WorldObjects.pickup does today */
        try {
          if (window.__ph3d_world_objects && typeof window.__ph3d_world_objects.pickup === "function") {
            window.__ph3d_world_objects.pickup(item, walker);
          }
          if (window.__ph3d_phone) {
            const name = (item.label || item.type || "item");
            window.__ph3d_phone._toast("Picked up " + name);
          }
        } catch (e) {}
      },
    };
    return true;
  },

  /* ── USE ────────────────────────────────────────────────────── */
  use(walker, item) {
    if (!walker || !walker.rig || !item) return false;
    if (this._active) return false;

    this._active = {
      kind: "use",
      t: 0,
      dur: USE_TIME,
      item,
      walker,
      onDone: () => {
        try {
          if (window.__ph3d_world_objects && typeof window.__ph3d_world_objects.use === "function") {
            window.__ph3d_world_objects.use(item, walker);
          }
        } catch (e) {}
      },
    };
    return true;
  },

  /* ── DROP: put the held item back on the ground at the player's feet ── */
  drop(walker) {
    if (!this._held || this._active) return false;
    const mesh = this._held.mesh, item = mesh.userData && mesh.userData._item;
    const px = walker && (walker.pos ? walker.pos.x : walker.x), pz = walker && (walker.pos ? walker.pos.z : walker.z);
    const yaw = (walker && walker.yaw) || 0;
    const x = (px || 0) + Math.sin(yaw) * 0.6, z = (pz || 0) + Math.cos(yaw) * 0.6;
    mesh.userData._inHand = false;
    mesh.userData._hands = 1;
    this._held = null;
    if (walker) walker._carryMul = 1;
    try {
      const W = window.__ph3d_world_objects;
      if (item && W) { W.drop(item, x, z, walker && Number.isFinite(walker.floorY) ? walker.floorY : 0); mesh.rotation.set(0, 0, 0); mesh.scale.setScalar(1); }
      else if (mesh.parent) mesh.parent.remove(mesh);
      window.__ph3d_pocket?.remove?.(item ? item.type : "", 1);
      window.__ph3d_phone?._toast("Dropped " + ((item && item.label) || "item"));
    } catch (e) { console.warn("[drop]", e); }
    return true;
  },
  heldItem() { return this._held && this._held.mesh.userData && this._held.mesh.userData._item || null; },

  /* ── THROW: release the held world prop into a real ballistic arc ── */
  throw(walker) {
    if (!this._held || this._active) return false;
    const mesh = this._held.mesh;
    const item = mesh && mesh.userData && mesh.userData._item;
    const W = window.__ph3d_world_objects;
    if (!mesh || !item || !W || typeof W.throw !== "function") return false;
    this._held = null;
    if (walker) walker._carryMul = 1;
    mesh.userData._inHand = false;
    try {
      const ok = W.throw(item, 0, 0, walker);
      if (!ok) return false;
      try { window.__ph3d_pocket?.remove?.(item.type, 1); } catch (e) {}
      try { window.__ph3d_phone?._toast("Threw " + (item.label || item.type)); } catch (e) {}
      return true;
    } catch (e) { console.warn("[object-throw]", e); return false; }
  },

  /* ── HOLD: attach a mesh to the player's hand(s) ─────────────── */
  hold(walker, mesh) {
    if (!walker || !walker.rig || !walker.rig.armR || !mesh) return;
    if (this._held && this._held.mesh && this._held.mesh !== mesh) {
      const old = this._held.mesh;
      if (old.parent) old.parent.remove(old);
      old.userData._inHand = false;
      this._held = null;
    }
    mesh.userData = mesh.userData || {};
    mesh.traverse((o) => { if (o.name === "_glowRing") o.visible = false; });   /* pickup ring must not ride in the hand */

    const R = walker.rig;
    const bounds = _localBounds(mesh);
    const size = bounds ? bounds.getSize(new THREE.Vector3()) : new THREE.Vector3(0.2, 0.2, 0.2);
    const min = bounds ? bounds.min : new THREE.Vector3();
    const prof = _profileFor(mesh, size);
    const st = prof.st;
    mesh.userData._hands = prof.hands;
    walker._carryMul = prof.move;
    const sc = mesh.scale;
    const anchor = new THREE.Vector3(min.x + size.x * prof.anchor[0], min.y + size.y * prof.anchor[1], min.z + size.z * prof.anchor[2]);
    const center = new THREE.Vector3(min.x + size.x / 2, min.y + size.y / 2, min.z + size.z / 2);
    const rec = { mesh, walker, prof, style: prof.style, st, size };
    mesh.rotation.set(0, 0, 0);
    mesh.updateMatrixWorld(true);

    if (prof.hands === 2 && R.spine) {
      /* two-hand load: centred in front of the belly, clear of the chest, palms on its sides */
      const front = 0.15, cz = Math.max(0.22, front + size.z * sc.z / 2 + 0.03), cy = 0.20;
      R.spine.add(mesh);
      mesh.position.set(0, cy, cz).sub(center.clone().multiply(sc));
      const hw = size.x * sc.x / 2 + 0.015;
      const hy = cy + Math.min(0.02, size.y * sc.y * 0.1);
      const startR = { sh: [-1.0, -0.15, -0.1], el: -1.1 }, startL = { sh: [-1.0, 0.15, 0.1], el: -1.1 };
      rec.armR = _solveHand(R, -1, new THREE.Vector3(-hw, hy, cz - 0.01), startR);
      rec.armL = _solveHand(R, +1, new THREE.Vector3(hw, hy, cz - 0.01), startL);
      mesh.userData._inHand = true;
      this._held = rec;
      return;
    }

    const grip = R.armR.grip || R.armR.wrist;
    if (!grip) { walker._carryMul = 1; return; }

    /* bake the object's torso-relative rotation into the grip frame using the
       carry pose, so the object is gripped rigidly and still reads upright */
    const sv = [R.spine, R.armR.shoulder, R.armR.elbow, R.armR.wrist].map((j) => j.rotation.clone());
    R.spine.rotation.set(0, 0, 0);
    R.armR.shoulder.rotation.set(...st.sh); R.armR.elbow.rotation.set(...st.el); R.armR.wrist.rotation.set(...st.wr);
    R.spine.updateWorldMatrix(true, true);
    const qg = grip.getWorldQuaternion(new THREE.Quaternion()), qs = R.spine.getWorldQuaternion(new THREE.Quaternion());
    [R.spine, R.armR.shoulder, R.armR.elbow, R.armR.wrist].forEach((j, i) => j.rotation.copy(sv[i]));
    R.spine.updateWorldMatrix(true, true);

    const rel = prof.rel || [0, 0, 0];
    let qRel = new THREE.Quaternion().setFromEuler(_e1.set(rel[0], rel[1], rel[2], "YXZ"));
    if (prof.longAxis && prof.style === "shoulder") {   /* turn the long side of an unknown object into the bat direction */
      const ax = prof.longAxis === "x" ? new THREE.Vector3(1, 0, 0) : prof.longAxis === "z" ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
      qRel = new THREE.Quaternion().setFromUnitVectors(ax, new THREE.Vector3(0, 1, 0)).premultiply(qRel);
    }
    const qMesh = qg.clone().invert().multiply(qs).multiply(qRel);
    grip.add(mesh);
    mesh.quaternion.copy(qMesh);
    const off = new THREE.Vector3(...(prof.off || st.off || [0, 0, 0.03]));
    mesh.position.copy(off).sub(anchor.clone().multiply(sc).applyQuaternion(qMesh));
    mesh.userData._inHand = true;
    this._held = rec;
  },

  releaseHand(walker) {
    if (!this._held) return;
    const { mesh } = this._held;
    mesh.userData._inHand = false;
    mesh.userData._hands = 1;
    if (walker) walker._carryMul = 1;
    if (mesh.parent) mesh.parent.remove(mesh);
    if (walker && walker.scene) walker.scene.add(mesh);
    this._held = null;
  },

  /* ── Per-frame tick ─────────────────────────────────────────── */
  tick(walker, dt, camera) {
    if (!walker || !walker.rig) return;

    /* ── Outgoing item flies toward the hand ───────────────── */
    if (this._outgoing) {
      const o = this._outgoing;
      o.t += dt;
      const p = Math.min(1, o.t / o.dur);

      /* Where's the hand right now? */
      const handPos = _handWorldPos(walker.rig, _tmpV3);
      if (handPos) {
        const arc = Math.sin(p * Math.PI) * 0.5;
        o.mesh.position.set(
          o.from.x + (handPos.x - o.from.x) * p,
          o.from.y + (handPos.y - o.from.y) * p + arc,
          o.from.z + (handPos.z - o.from.z) * p
        );
        o.mesh.rotation.y += dt * 6;
      }
      if (p >= 1) {
        /* Attach to the hand for the rest of the pickup anim */
        if (o.mesh.parent) o.mesh.parent.remove(o.mesh);
        this.hold(walker, o.mesh);
        this._outgoing = null;
      }
    }

    /* ── Active action: override the rig pose ───────────────── */
    if (this._active) {
      const a = this._active;
      a.t += dt;
      const p = Math.min(1, a.t / a.dur);

      if (a.kind === "pickup") _poseBendPickup(a.walker.rig, p);
      else if (a.kind === "use") _poseUse(a.walker.rig, p, a.item);

      if (p >= 1) {
        const done = a.onDone;
        /* Release hand-held item after the anim */
        if (a.kind === "pickup") {
          /* move held mesh into the pocket visually — remove it */
          /* the item stays visibly in the hand until used or swapped */
        }
        /* Fire done() BEFORE clearing _active so isBusy() stays true
           during the callback.  The world-objects wrapper checks isBusy()
           to decide whether to animate again or execute the real pickup —
           if we cleared _active first it would see !isBusy() and restart
           the animation, creating an infinite loop. */
        if (done) { try { done(); } catch (e) {} }
        this._active = null;
        /* consumed items leave the hand */
        if (this._held && !this._held.mesh.parent) { this._held.mesh.userData._inHand = false; this._held = null; walker._carryMul = 1; }
      }
    }

    /* ── Carry pose (runs after the locomotion animator, so it wins) ── */
    const held = this._held && this._held.mesh && this._held.mesh.parent ? this._held : null;
    if (held) this._lastRec = held;
    const want = held && !this._active ? 1 : 0;
    this._carryBlend += (want - this._carryBlend) * Math.min(1, dt * 9);
    const rec = held || this._lastRec;
    if (this._carryBlend < 0.01 || !rec) {
      this._carryBlend = 0; if (!held) { walker._carryMul = 1; this._lastRec = null; }
      return;
    }
    const k = this._carryBlend, R = walker.rig, st = rec.st;
    const ks = k * (1 - (st.swing || 0));           /* what is left of the walking swing: heavy things hang, light things bob */
    if (st.hands === 2) {
      if (R.armL && rec.armL) { _blendRot(R.armL.shoulder, rec.armL.sh[0], rec.armL.sh[1], rec.armL.sh[2], k); _blendRot(R.armL.elbow, rec.armL.el, 0, 0, k); }
      if (R.armR && rec.armR) { _blendRot(R.armR.shoulder, rec.armR.sh[0], rec.armR.sh[1], rec.armR.sh[2], k); _blendRot(R.armR.elbow, rec.armR.el, 0, 0, k); }
      if (R.spine) _blendRot(R.spine, st.lean || -0.10, R.spine.rotation.y, R.spine.rotation.z, k);
      if (R.head) _blendRot(R.head, 0.08, R.head.rotation.y, R.head.rotation.z, k);
    } else if (R.armR) {
      _blendRot(R.armR.shoulder, st.sh[0], st.sh[1], st.sh[2], ks);
      _blendRot(R.armR.elbow, st.el[0], st.el[1], st.el[2], ks);
      if (R.armR.wrist) _blendRot(R.armR.wrist, st.wr[0], st.wr[1], st.wr[2], k);
      const lean = rec.prof.lean || 0;
      if (lean && R.spine) _blendRot(R.spine, R.spine.rotation.x, R.spine.rotation.y, lean, k);
    }
    /* fingers close round the object (open palm for trays) */
    const curlHand = (arm, amount, thumbAmt) => {
      if (!arm || !arm.fingers) return;
      for (const finger of arm.fingers) {
        if (finger.group) _blendRot(finger.group, -0.72 * amount, 0, 0, k);
        if (finger.midJoint) _blendRot(finger.midJoint, -0.62 * amount, 0, 0, k);
      }
      if (arm.thumb) _blendRot(arm.thumb, 0.28 * thumbAmt, 0, arm === R.armR ? -0.32 * thumbAmt : 0.32 * thumbAmt, k);
    };
    if (held && st.hands === 2) { curlHand(R.armL, st.curl, st.thumb); curlHand(R.armR, st.curl, st.thumb); }
    else if (held) { curlHand(R.armR, st.curl, st.thumb); }
    else {                                           /* just released: relax the hand and untwist the wrist */
      curlHand(R.armR, 0, 0); curlHand(R.armL, 0, 0);
      if (R.armR && R.armR.wrist) _blendRot(R.armR.wrist, 0, 0, 0, 1 - this._carryBlend);
    }
  },
};

/* ── Hand world position from the rig ──────────────────────────── */
function _handWorldPos(rig, out) {
  if (!rig || !rig.armR || !rig.armR.wrist) return null;
  rig.armR.wrist.getWorldPosition(out);
  return out;
}

/* ── Bend-down + reach pickup pose (0..1) ──────────────────────── */
function _poseBendPickup(R, p) {
  /* 0.0 - 0.35 : lean forward, arms reach down
     0.35 - 0.55 : grab (hold)
     0.55 - 1.0 : stand back up, arms back to sides */

  let bend = 0, reach = 0;
  if (p < 0.35) { bend = _sstep(p / 0.35); reach = _sstep(p / 0.35); }
  else if (p < 0.55) { bend = 1; reach = 1; }
  else { const q = (p - 0.55) / 0.45; bend = 1 - _sstep(q); reach = 1 - _sstep(q); }

  /* Spine bends forward */
  if (R.spine) {
    R.spine.rotation.x = bend * 0.85;
    R.spine.rotation.z = 0;
    R.spine.rotation.y = 0;
  }
  /* Head follows down */
  if (R.head) {
    R.head.rotation.x = -bend * 0.45;
  }
  /* Both arms reach forward + down */
  if (R.armL && R.armL.shoulder) {
    R.armL.shoulder.rotation.set(-1.35 * reach, 0, 0.18 * reach);
    R.armL.elbow.rotation.set(-0.6 * reach, 0, 0);
    if (R.armL.wrist) R.armL.wrist.rotation.set(0, 0.6 * reach, 0);
  }
  if (R.armR && R.armR.shoulder) {
    R.armR.shoulder.rotation.set(-1.35 * reach, 0, -0.18 * reach);
    R.armR.elbow.rotation.set(-0.6 * reach, 0, 0);
    if (R.armR.wrist) R.armR.wrist.rotation.set(0, -0.6 * reach, 0);
  }
  /* Slight knee bend so it reads as a squat */
  if (R.legL && R.legL.hip) R.legL.hip.rotation.x = -bend * 0.35;
  if (R.legR && R.legR.hip) R.legR.hip.rotation.x = -bend * 0.35;
  if (R.legL && R.legL.knee) R.legL.knee.rotation.x = bend * 0.55;
  if (R.legR && R.legR.knee) R.legR.knee.rotation.x = bend * 0.55;

  /* Pelvis drops slightly while bent */
  if (R.hips) {
    R.hips.position.y = 0.935 - bend * 0.18;
  }
}

/* ── Use gesture per item type (0..1) ──────────────────────────── */
function _poseUse(R, p, item) {
  const type = (item && item.type) || "default";
  const wind = p < 0.25 ? _sstep(p / 0.25) : (p < 0.7 ? 1 : 1 - _sstep((p - 0.7) / 0.3));

  /* Right hand raises forward — like drinking / eating / using */
  if (R.armR && R.armR.shoulder) {
    R.armR.shoulder.rotation.set(-1.6 * wind, 0, -0.15 * wind);
    R.armR.elbow.rotation.set(-1.4 * wind, 0, 0);
    if (R.armR.wrist) R.armR.wrist.rotation.set(0.4 * wind, 0, 0);
  }
  /* Left arm relaxed */
  if (R.armL && R.armL.shoulder) {
    R.armL.shoulder.rotation.set(-0.15 * wind, 0, 0.18);
    R.armL.elbow.rotation.set(-0.2 * wind, 0, 0);
  }

  switch (type) {
    case "food":
    case "junkfood":
    case "water":
    case "drink":
      /* Bring hand toward mouth twice (sip / bite) */
      if (p > 0.30 && p < 0.85) {
        const bite = Math.sin((p - 0.30) / 0.55 * Math.PI * 2);
        if (R.armR && R.armR.elbow) R.armR.elbow.rotation.x -= Math.max(0, bite) * 0.7;
        if (R.head) R.head.rotation.x += Math.max(0, bite) * 0.18;
      }
      break;
    case "phone":
      /* Hold hand up near ear */
      if (R.armR && R.armR.shoulder) R.armR.shoulder.rotation.set(-2.05 * wind, 0, -0.35 * wind);
      if (R.armR && R.armR.elbow) R.armR.elbow.rotation.x = -1.85 * wind;
      if (R.head) R.head.rotation.z = -0.10 * wind;
      break;
    case "book":
      /* Both hands open in front — like reading */
      if (R.armL && R.armL.shoulder) R.armL.shoulder.rotation.set(-1.1 * wind, 0, 0.42 * wind);
      if (R.armL && R.armL.elbow) R.armL.elbow.rotation.x = -1.5 * wind;
      if (R.armR && R.armR.shoulder) R.armR.shoulder.rotation.set(-1.1 * wind, 0, -0.42 * wind);
      if (R.armR && R.armR.elbow) R.armR.elbow.rotation.x = -1.5 * wind;
      if (R.head) R.head.rotation.x = 0.18 * wind;
      break;
    case "bat":
    case "bottle":
      /* Wind-up and swing */
      if (p < 0.40) {
        const w = _sstep(p / 0.40);
        if (R.armR && R.armR.shoulder) R.armR.shoulder.rotation.set(-1.9 * w, 0, 0.55 * w);
        if (R.spine) R.spine.rotation.y = -0.35 * w;
      } else if (p < 0.60) {
        const s = (p - 0.40) / 0.20;
        if (R.armR && R.armR.shoulder) R.armR.shoulder.rotation.set(0.6 - 1.8 * s, 0, 0.55 - 1.4 * s);
        if (R.spine) R.spine.rotation.y = -0.35 + 0.7 * s;
      } else {
        const r = (p - 0.60) / 0.40;
        if (R.armR && R.armR.shoulder) R.armR.shoulder.rotation.set(0.6 * (1 - r), 0, -0.85 * (1 - r));
        if (R.spine) R.spine.rotation.y = 0.35 * (1 - r);
      }
      break;
    case "cigarettes":
      /* Hand up near mouth */
      if (R.armR && R.armR.shoulder) R.armR.shoulder.rotation.set(-2.10 * wind, 0, -0.20 * wind);
      if (R.armR && R.armR.elbow) R.armR.elbow.rotation.x = -1.95 * wind;
      break;
    case "dumbbell":
      /* Curl up and down */
      if (R.armR && R.armR.elbow) R.armR.elbow.rotation.x = -1.1 * wind - Math.max(0, Math.sin(p * Math.PI * 3)) * 0.9;
      break;
    case "spray_can":
      /* Point and spray */
      if (R.armR && R.armR.shoulder) R.armR.shoulder.rotation.set(-1.4 * wind, 0, -0.22 * wind);
      if (R.armR && R.armR.elbow) R.armR.elbow.rotation.x = -0.20 * wind;
      break;
    default:
      /* Generic: lift hand forward, look down */
      if (R.head) R.head.rotation.x = 0.12 * wind;
      break;
  }
}

function _sstep(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

function _releaseArms(walker) {
  if (!walker.rig) return;
  const R = walker.rig;
  if (R.spine) R.spine.rotation.set(0, 0, 0);
  if (R.head) R.head.rotation.set(0, 0, 0);
  if (R.armL && R.armL.shoulder) R.armL.shoulder.rotation.set(0, 0, 0);
  if (R.armR && R.armR.shoulder) R.armR.shoulder.rotation.set(0, 0, 0);
  if (R.armL && R.armL.elbow) R.armL.elbow.rotation.set(0, 0, 0);
  if (R.armR && R.armR.elbow) R.armR.elbow.rotation.set(0, 0, 0);
  if (R.legL && R.legL.hip) R.legL.hip.rotation.set(0, 0, 0);
  if (R.legR && R.legR.hip) R.legR.hip.rotation.set(0, 0, 0);
  if (R.legL && R.legL.knee) R.legL.knee.rotation.set(0, 0, 0);
  if (R.legR && R.legR.knee) R.legR.knee.rotation.set(0, 0, 0);
  if (R.hips) R.hips.position.y = 0.935;
}

window.__ph3d_playerActions = PlayerActions;
window.__ph3d_carry = { STYLES, PROFILES };
