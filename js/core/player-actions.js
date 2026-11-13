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

/* ── SMART OBJECT HANDLING ─────────────────────────────────────
   Small things ride in ONE hand (right grip). Big things need TWO hands:
   the object is hugged against the chest, both arms wrap around it, the
   posture leans back to balance the load, and you move slower.
   Unknown types are sized from their real bounding box, so any new object
   you add is classified automatically.
     hands : 1 | 2
     move  : walking-speed multiplier while carrying (running is capped too) */
const HANDLING = {
  phone: { hands: 1, move: 1.00 }, water: { hands: 1, move: 1.00 },
  food: { hands: 1, move: 1.00 },  junkfood: { hands: 1, move: 1.00 },
  money: { hands: 1, move: 1.00 }, cigarettes: { hands: 1, move: 1.00 },
  spray_can: { hands: 1, move: 1.00 }, bottle: { hands: 1, move: 0.98 },
  book: { hands: 1, move: 0.98 },  bag: { hands: 1, move: 0.95 },
  bat: { hands: 1, move: 0.95 },   dumbbell: { hands: 1, move: 0.85 },
  crate: { hands: 2, move: 0.60 },
};
const _bbox = new THREE.Box3(), _bsz = new THREE.Vector3();
function _handling(mesh) {
  const type = mesh && mesh.userData && mesh.userData.itemType;
  if (type && HANDLING[type]) return HANDLING[type];
  try {                                   /* size it up: long/bulky ⇒ two hands */
    _bbox.setFromObject(mesh); _bbox.getSize(_bsz);
    const big = Math.max(_bsz.x, _bsz.y, _bsz.z), vol = _bsz.x * _bsz.y * _bsz.z;
    if (big > 0.45 || vol > 0.05) return { hands: 2, move: Math.max(0.5, 0.8 - vol * 3) };
  } catch (e) {}
  return { hands: 1, move: 1 };
}
const _lerp = (a, b, k) => a + (b - a) * k;
function _blendRot(joint, x, y, z, k) {
  if (!joint || !joint.rotation) return;
  const r = joint.rotation;
  r.set(_lerp(r.x, x, k), _lerp(r.y, y, k), _lerp(r.z, z, k));
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
      const incoming = _handling(item.mesh).hands === 2;
      if (carrying || incoming) {
        try { window.__ph3d_phone && window.__ph3d_phone._toast("🙌 Both hands needed — drop what you're carrying first"); } catch (e) {}
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
            const icon = (item.icon || "✋");
            const name = (item.label || item.type || "item");
            window.__ph3d_phone._toast(icon + " Picked up " + name);
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
      window.__ph3d_phone?._toast("✋ Dropped " + ((item && item.label) || "item"));
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

  /* ── HOLD: attach a mesh to the player's hand ───────────────── */
  hold(walker, mesh) {
    if (!walker || !walker.rig || !walker.rig.armR || !mesh) return;
    if (this._held && this._held.mesh && this._held.mesh !== mesh) {
      /* swapping items: the old one is pocketed, drop its visual */
      const old = this._held.mesh;
      if (old.parent) old.parent.remove(old);
      old.userData._inHand = false;
      this._held = null;
    }
    const prof = _handling(mesh);
    mesh.userData._hands = prof.hands;
    walker._carryMul = prof.move;
    if (prof.hands === 2 && walker.rig.spine) {
      /* two-hand carry: hug it against the chest, in front of the torso */
      walker.rig.spine.add(mesh);
      mesh.position.set(0, 0.34, 0.30);
      mesh.rotation.set(0, 0, 0);
      mesh.scale.setScalar(1);
      mesh.userData._inHand = true;
      this._held = { mesh, walker };
      return;
    }
    const grip = walker.rig.armR.grip || walker.rig.armR.wrist;
    if (!grip) return;
    grip.add(mesh);
    mesh.position.set(0, -0.10, 0.06);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.setScalar(1);
    mesh.userData._inHand = true;
    this._held = { mesh, walker };
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
    const want = held && !this._active ? 1 : 0;
    this._carryBlend += (want - this._carryBlend) * Math.min(1, dt * 9);
    if (this._carryBlend < 0.01) { this._carryBlend = 0; if (!held) walker._carryMul = 1; return; }
    const k = this._carryBlend, R = walker.rig;
    if (held && held.mesh.userData._hands === 2) {
      /* both arms wrap round the load, back leans against its weight */
      if (R.armL) { _blendRot(R.armL.shoulder, -1.05, 0.30, 0.22, k); _blendRot(R.armL.elbow, -1.20, 0, 0, k); }
      if (R.armR) { _blendRot(R.armR.shoulder, -1.05, -0.30, -0.22, k); _blendRot(R.armR.elbow, -1.20, 0, 0, k); }
      if (R.spine) _blendRot(R.spine, -0.10, R.spine.rotation.y, R.spine.rotation.z, k);
      if (R.head) _blendRot(R.head, 0.08, R.head.rotation.y, R.head.rotation.z, k);
    } else if (R.armR) {
      /* one hand: forearm raised, load held at the side-front; left arm keeps swinging */
      _blendRot(R.armR.shoulder, -0.45, 0, -0.14, k);
      _blendRot(R.armR.elbow, -1.05, 0, 0, k);
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
