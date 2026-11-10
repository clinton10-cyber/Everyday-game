/* ═══════════════════════════════════════════════════════════════════════
   body-attach.js — things that attach to a character rig.

   • Belly   : pregnancy belly that swells through 3 trimesters.
   • Baby    : low-poly infant + carry sockets on the parent's rig
               (front-carry against the chest / back-carry in a wrapper).
   • applyCarryPose(R) : cradle-arm pose used by the animator while an infant
               is carried at the front.

   Everything hangs off `rig.spine` (the same joint the torso is built on), so
   it follows every walk / sit / emote animation for free.  Works for the
   player rig AND for every NPC rig (shared by the world, the home and the
   church).  Rigs are rebuilt when a look changes (wardrobe / reskin), so every
   `ensure*` call re-attaches when the old mesh is no longer parented.
   ═══════════════════════════════════════════════════════════════════════ */
import * as THREE from "three";

/* ── Belly ──────────────────────────────────────────────────────────── */
const _bellyGeo = new THREE.SphereGeometry(0.16, 16, 12);

export const Belly = {
  /* 0 = none, 1..3 = trimester, from progress 0..1 */
  stage(p) { return !(p > 0) ? 0 : p < 1 / 3 ? 1 : p < 2 / 3 ? 2 : 3; },

  /* Create / update the belly on `rig` for progress p (0..1). p<=0 removes it. */
  ensure(rig, p) {
    if (!rig || !rig.spine) return null;
    if (!(p > 0.001)) { this.remove(rig); return null; }
    p = Math.min(1, p);
    let b = rig.belly;
    if (!b || b.parent !== rig.spine) {
      const mat = (rig.mats && rig.mats.top) || new THREE.MeshLambertMaterial({ color: 0xd9d2c6 });
      b = new THREE.Mesh(_bellyGeo, mat);
      b.name = "belly"; b.castShadow = true; b.receiveShadow = true;
      rig.spine.add(b);
      rig.belly = b;
    }
    const s = 0.30 + 0.80 * p;                     /* 0.30 … 1.10 */
    b.scale.set(0.80 * s, 0.80 * s, 1.0 * s);
    b.position.set(0, 0.075 + 0.02 * s, 0.015 + 0.06 * s);
    b.visible = true;
    rig._bellyP = p;
    return b;
  },

  remove(rig) {
    if (!rig || !rig.belly) return;
    if (rig.belly.parent) rig.belly.parent.remove(rig.belly);
    rig.belly = null; rig._bellyP = 0;
  },
};

/* ── Baby ───────────────────────────────────────────────────────────── */
const WRAPPERS = [0xd9534f, 0x2f7fb8, 0xe0a526, 0x3f9b5c, 0x8e4fb0, 0xe0508a, 0x1f8f8a, 0xc6702a];
const SKINS = [0x7a4a30, 0x6b3e28, 0x8a5a3c, 0x5a3322, 0x9a6a48];
const _hashN = (s) => { let h = 0; s = String(s || "x"); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

/* A swaddled infant. Local +Y is up (head), +Z is the face direction.
   Height ≈ 0.46 m at scale 1. `o.seed` picks wrapper colour / skin tone. */
export function buildBaby(o) {
  o = o || {};
  const n = _hashN(o.seed);
  const skinC = o.skin != null ? o.skin : SKINS[n % SKINS.length];
  const clothC = o.cloth != null ? o.cloth : 0xf4ecd8;
  const skin = new THREE.MeshLambertMaterial({ color: skinC });
  const cloth = new THREE.MeshLambertMaterial({ color: clothC });
  const dark = new THREE.MeshBasicMaterial({ color: 0x1a0f0a });
  const pink = new THREE.MeshLambertMaterial({ color: 0xb86a5a });

  const g = new THREE.Group(); g.name = "baby";
  const add = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; (parent || g).add(m); return m; };

  /* swaddled body */
  add(new THREE.CapsuleGeometry(0.072, 0.15, 4, 10), cloth, 0, 0.0, 0);
  /* little feet peeking out the bottom */
  add(new THREE.SphereGeometry(0.024, 8, 6), skin, -0.028, -0.175, 0.012);
  add(new THREE.SphereGeometry(0.024, 8, 6), skin, 0.028, -0.175, 0.012);
  /* head group (so it can bob / turn) */
  const head = new THREE.Group(); head.position.set(0, 0.205, 0.005); g.add(head);
  const skull = add(new THREE.SphereGeometry(0.07, 14, 10), skin, 0, 0, 0, head); skull.scale.set(1, 0.96, 1.0);
  /* knitted cap */
  const cap = add(new THREE.SphereGeometry(0.0735, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), cloth, 0, 0.004, -0.004, head);
  cap.rotation.x = -0.12;
  /* face: closed eyes, nose, mouth, cheeks */
  for (const s of [-1, 1]) {
    const e = add(new THREE.BoxGeometry(0.016, 0.0038, 0.004), dark, 0.026 * s, 0.006, 0.064, head);
    e.rotation.z = 0.12 * s; e.castShadow = false;
    add(new THREE.SphereGeometry(0.0125, 6, 5), pink, 0.042 * s, -0.014, 0.052, head).scale.set(1, 0.8, 0.5);
    add(new THREE.SphereGeometry(0.014, 6, 5), skin, 0.071 * s, -0.003, 0.0, head).scale.set(0.5, 1, 0.8);   /* ears */
  }
  add(new THREE.SphereGeometry(0.0095, 6, 5), skin, 0, -0.008, 0.07, head);
  const mouth = add(new THREE.BoxGeometry(0.016, 0.004, 0.003), pink, 0, -0.03, 0.064, head); mouth.castShadow = false;
  g.userData.mouth = mouth; g.userData.head = head;
  /* arms tucked in the wrap, hands out */
  for (const s of [-1, 1]) {
    const a = add(new THREE.CapsuleGeometry(0.019, 0.06, 3, 6), cloth, 0.085 * s, 0.055, 0.035);
    a.rotation.set(0.9, 0, 0.35 * s);
    add(new THREE.SphereGeometry(0.02, 7, 5), skin, 0.078 * s, 0.1, 0.075);
  }
  const sc = (o.scale != null ? o.scale : 1);
  g.scale.setScalar(sc);
  g.userData.wrapColor = o.wrap != null ? o.wrap : WRAPPERS[(n >> 3) % WRAPPERS.length];
  return g;
}

function buildSling(mode, wrapColor) {
  const g = new THREE.Group(); g.name = "baby_sling";
  const m = new THREE.MeshLambertMaterial({ color: wrapColor, side: THREE.DoubleSide });
  /* band tied round the torso */
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.017, 6, 28), m);
  band.rotation.x = Math.PI / 2; band.scale.set(1, 0.74, 1); band.position.y = 0.255; g.add(band);
  /* second, lower band so it reads as a wrapper */
  const band2 = band.clone(); band2.position.y = 0.17; band2.scale.set(0.94, 0.70, 1); g.add(band2);
  /* cloth flap over the baby's lower back */
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.2, 0.03), m);
  flap.castShadow = true;
  if (mode === "back") flap.position.set(0, 0.17, -0.285); else flap.position.set(0, 0.17, 0.30);
  g.add(flap);
  /* knot at the chest */
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), m);
  knot.position.set(0.07, 0.255, mode === "back" ? 0.15 : -0.14); g.add(knot);
  if (mode === "front") {                           /* shoulder strap */
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.02), m);
    strap.position.set(-0.09, 0.30, -0.12); strap.rotation.z = 0.25; g.add(strap);
  }
  return g;
}

export const Baby = {
  /* Attach an infant to `rig` in `mode` ("front" | "back").
     o: { seed, scale, skin, cloth, wrap } */
  attach(rig, mode, o) {
    if (!rig || !rig.spine) return null;
    this.detach(rig);
    mode = mode === "back" ? "back" : "front";
    const baby = buildBaby(o);
    const sling = buildSling(mode, baby.userData.wrapColor);
    if (mode === "front") {                         /* upright against the chest, face turned in */
      baby.position.set(0, 0.215, 0.215);
      baby.rotation.set(-0.16, Math.PI, 0);
    } else {                                        /* high on the back, face to the parent's back */
      baby.position.set(0, 0.235, -0.215);
      baby.rotation.set(0.10, 0, 0);
    }
    rig.spine.add(sling);
    rig.spine.add(baby);
    rig.baby = baby; rig.babySling = sling;
    rig._carryPose = mode; rig._babyMode = mode; rig._babyOpts = o || {};
    return baby;
  },

  detach(rig) {
    if (!rig) return;
    for (const k of ["baby", "babySling"]) {
      const m = rig[k];
      if (m) {
        if (m.parent) m.parent.remove(m);
        m.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material && c.material.dispose) c.material.dispose(); });
        rig[k] = null;
      }
    }
    rig._carryPose = null; rig._babyMode = null;
  },

  /* Re-attach when the rig was rebuilt or the mode changed. Returns the baby. */
  ensure(rig, mode, o) {
    if (!rig || !rig.spine) return null;
    mode = mode === "back" ? "back" : "front";
    if (rig.baby && rig.baby.parent === rig.spine && rig._babyMode === mode) return rig.baby;
    return this.attach(rig, mode, o);
  },

  has(rig) { return !!(rig && rig.baby && rig.baby.parent); },

  /* per-frame life: gentle sway, bigger when soothing, jitter when crying.
     state: { soothing:boolean, crying:boolean } */
  tick(rig, t, state) {
    if (!rig || !rig.baby) return;
    const b = rig.baby, st = state || {};
    const mode = rig._babyMode;
    const baseX = mode === "back" ? 0.10 : -0.16;
    const amp = st.soothing ? 0.06 : st.crying ? 0.035 : 0.014;
    const f = st.soothing ? 2.4 : st.crying ? 9 : 1.3;
    b.rotation.z = Math.sin(t * f) * amp;
    b.rotation.x = baseX + (st.soothing ? Math.sin(t * 1.2) * 0.05 : 0);
    const h = b.userData.head;
    if (h) h.rotation.z = st.crying ? Math.sin(t * 11) * 0.12 : Math.sin(t * 0.7) * 0.05;
    const m = b.userData.mouth;
    if (m) m.scale.set(st.crying ? 1.15 : 1, st.crying ? 3.2 + Math.sin(t * 14) * 1.2 : 1, 1);
  },
};

/* ── Cradle pose for the animator (front-carry) ──────────────────────
   Arms come up and in under the baby. Called AFTER the normal pose is
   written, so it simply overrides the arm joints. */
export function applyCarryPose(R) {
  if (!R || !R.armL || !R.armR) return;
  const set = (j, x, y, z) => { if (j && j.rotation) j.rotation.set(x, y, z); };
  set(R.armR.shoulder, -0.62, 0.46, -0.12);
  set(R.armR.elbow, -1.42, 0, 0);
  if (R.armR.wrist) set(R.armR.wrist, 0, 0, 0);
  set(R.armL.shoulder, -0.62, -0.46, 0.12);
  set(R.armL.elbow, -1.42, 0, 0);
  if (R.armL.wrist) set(R.armL.wrist, 0, 0, 0);
}

export const BodyAttach = { Belly, Baby, buildBaby, applyCarryPose };
