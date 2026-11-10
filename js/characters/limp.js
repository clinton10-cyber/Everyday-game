/* ═══════════════════════════════════════════════════════════
   limp.js — "dead weight" joint physics.

   When a body goes limp (death, knock-out, thrown) its joints are NOT posed:
   every joint becomes a damped pendulum that is pulled by the *effective
   gravity in the body's own frame*  g_eff = g − a_body  (d'Alembert).
     • standing / falling  → arms and legs swing and trail behind the motion
     • lying on the floor  → limbs flop down onto the ground and settle
     • in free fall        → g_eff ≈ 0, limbs float loosely
     • being thrown / hit  → the body's acceleration swings the limbs
   Joint limits are soft (bounce a little) so nothing bends through itself.

   API
     Limp.step(rig, group, dt)   advance + write rotations (auto-starts)
     Limp.kick(rig, x, y, z, k)  world-space impulse (hit, blast, slam)
     Limp.release(rig)           back to animator control
     Limp.asleep(rig)            true once everything has come to rest
   ═══════════════════════════════════════════════════════════ */
import * as THREE from "three";

const G = 9.8;
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _p = new THREE.Vector3();

/* joint table: kind decides how gravity maps to the rest angle */
const DEF = {
  /* hanging limbs: 2-DOF (rx, rz). k = pendulum stiffness, c = damping */
  shL: { k: 24, c: 2.6, x: [-3.0, 0.5], z: [-0.2, 2.6],  s: 1 },
  shR: { k: 24, c: 2.6, x: [-3.0, 0.5], z: [-2.6, 0.2],  s: -1 },
  hpL: { k: 30, c: 3.4, x: [-1.9, 0.22], z: [-0.25, 0.9], s: 1 },
  hpR: { k: 30, c: 3.4, x: [-1.9, 0.22], z: [-0.9, 0.25], s: -1 },
  /* hinge joints */
  elL: { k: 16, c: 2.4, lo: -2.4, hi: -0.04 }, elR: { k: 16, c: 2.4, lo: -2.4, hi: -0.04 },
  knL: { k: 20, c: 2.8, lo: 0.02, hi: 2.4 },   knR: { k: 20, c: 2.8, lo: 0.02, hi: 2.4 },
  /* spine / head: loll with gravity */
  sp:  { k: 14, c: 3.2 }, hd: { k: 9, c: 2.2 }, nk: { k: 9, c: 2.2 },
  /* wrists + ankles hang slack */
  wrL: { k: 8, c: 1.6 }, wrR: { k: 8, c: 1.6 }, anL: { k: 8, c: 1.8 }, anR: { k: 8, c: 1.8 },
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function joints(R) {
  const an = (l) => l && (l.ank || l.ankle);
  return {
    shL: R.armL && R.armL.shoulder, shR: R.armR && R.armR.shoulder,
    elL: R.armL && R.armL.elbow,    elR: R.armR && R.armR.elbow,
    wrL: R.armL && R.armL.wrist,    wrR: R.armR && R.armR.wrist,
    hpL: R.legL && R.legL.hip,      hpR: R.legR && R.legR.hip,
    knL: R.legL && R.legL.knee,     knR: R.legR && R.legR.knee,
    anL: an(R.legL),                anR: an(R.legR),
    sp: R.spine, nk: R.neck, hd: R.head,
  };
}

function start(R, group, partial) {
  const J = joints(R), st = { J, a: {}, v: {}, t: 0, rest: 0, last: null, lastV: null, vel: new THREE.Vector3(), kick: new THREE.Vector3() };
  for (const k in J) {
    const j = J[k]; if (!j) continue;
    st.a[k] = [j.rotation.x, j.rotation.y, j.rotation.z];
    st.v[k] = [0, 0, 0];
  }
  /* the pose the body had when it let go keeps its momentum: little random flop */
  for (const k in st.v) { st.v[k][0] = (Math.random() - 0.5) * 1.2; st.v[k][2] = (Math.random() - 0.5) * 1.2; }
  /* hips: straighten out so the group's tilt does the lying (animator's lying frame would fight us) */
  if (!partial) R.hips.rotation.set(0, 0, 0);
  R.__limp = st;
  return st;
}

export const Limp = {
  step(R, group, dt, opt) {
    if (!R || !R.hips || !group) return;
    dt = clamp(dt || 1 / 60, 0.001, 0.05);
    const w = opt && opt.w != null ? opt.w : 1, mask = opt && opt.mask;
    const st = R.__limp || start(R, group, !!mask);
    if (st.sleep && !mask) return;

    /* body-frame effective gravity: g − a  (a from the group's world motion) */
    group.getWorldPosition(_p);
    const acc = new THREE.Vector3();
    if (st.last) {
      _v.copy(_p).sub(st.last).divideScalar(dt);                 /* world velocity */
      if (st.lastV) acc.copy(_v).sub(st.lastV).divideScalar(dt);  /* world acceleration */
      st.lastV = (st.lastV || new THREE.Vector3()).copy(_v);
    }
    st.last = (st.last || new THREE.Vector3()).copy(_p);
    if (acc.lengthSq() > 900) acc.setLength(30);                  /* clamp teleports */
    acc.add(st.kick); st.kick.multiplyScalar(0);
    const ge = new THREE.Vector3(0, -G, 0).sub(acc);              /* effective gravity, world */
    group.getWorldQuaternion(_q); _q.invert();
    ge.applyQuaternion(_q);                                       /* → body frame */
    const gl = ge.length() || 1e-6, gn = ge.clone().divideScalar(gl);
    const gk = clamp(gl / G, 0, 2.5);                             /* 0 in free-fall */

    const sub = dt > 0.02 ? 2 : 1, h = dt / sub;
    let energy = 0;
    const A = st.a, Vv = st.v, J = st.J;
    for (let s = 0; s < sub; s++) {
      for (const k in A) {
        if (mask && !mask.has(k)) continue;
        const d = DEF[k], a = A[k], v = Vv[k];
        if (w < 1 && J[k]) { const r = J[k].rotation; a[0] += (r.x - a[0]) * (1 - w) * 0.5; a[2] += (r.z - a[2]) * (1 - w) * 0.5; }
        let eqX = 0, eqZ = 0;
        switch (k) {
          case "shL": case "shR": case "hpL": case "hpR": {
            /* limb hangs along −Y; find (rx, rz) that align it with g */
            eqZ = Math.asin(clamp(gn.x, -1, 1));
            eqX = Math.atan2(-gn.z, -gn.y);
            eqZ += d.s * (k[0] === "s" ? 0.2 : 0.1);                 /* limbs rest slightly splayed */
            if (gn.y > 0.25) { eqX = Math.atan2(-gn.z, 1e-3) * 0.9; }   /* body upside-down: swing through */
            break;
          }
          case "elL": case "elR": eqX = -0.28 - 0.9 * clamp(1 - (-gn.y), 0, 1) * 0.5; break;
          case "knL": case "knR": eqX = 0.16 + 0.7 * clamp(1 + gn.y, 0, 1) * 0.5; break;
          case "sp": eqX = clamp(gn.z * 0.45, -0.5, 0.6); eqZ = clamp(-gn.x * 0.4, -0.4, 0.4); break;
          case "hd": case "nk": eqX = clamp(gn.z * 0.85, -0.75, 0.7); eqZ = clamp(-gn.x * 0.7, -0.6, 0.6); break;
          case "wrL": case "wrR": case "anL": case "anR": eqX = clamp(gn.z * 0.5, -0.6, 0.6); break;
        }
        const kk = d.k * gk + 0.8;                                   /* never fully free */
        v[0] += (-(a[0] - eqX) * kk - v[0] * d.c) * h;
        v[2] += (-(a[2] - eqZ) * kk - v[2] * d.c) * h;
        v[1] += (-a[1] * 6 - v[1] * 3) * h;                          /* twist relaxes */
        a[0] += v[0] * h; a[1] += v[1] * h; a[2] += v[2] * h;
        /* soft limits */
        const lx = d.x ? d.x : d.lo !== undefined ? [d.lo, d.hi] : [-1.2, 1.2];
        const lz = d.z ? d.z : [-0.9, 0.9];
        if (a[0] < lx[0]) { a[0] = lx[0]; if (v[0] < 0) v[0] = v[0] < -1.2 ? v[0] * -0.25 : 0; }
        if (a[0] > lx[1]) { a[0] = lx[1]; if (v[0] > 0) v[0] = v[0] > 1.2 ? v[0] * -0.25 : 0; }
        if (a[2] < lz[0]) { a[2] = lz[0]; if (v[2] < 0) v[2] = v[2] < -1.2 ? v[2] * -0.25 : 0; }
        if (a[2] > lz[1]) { a[2] = lz[1]; if (v[2] > 0) v[2] = v[2] > 1.2 ? v[2] * -0.25 : 0; }
        energy += Math.abs(v[0]) + Math.abs(v[2]);
      }
    }
    for (const k in A) {
      if (mask && !mask.has(k)) continue;
      const j = J[k]; if (!j) continue;
      if (w >= 1) j.rotation.set(A[k][0], A[k][1], A[k][2]);
      else j.rotation.set(j.rotation.x + (A[k][0] - j.rotation.x) * w, j.rotation.y, j.rotation.z + (A[k][2] - j.rotation.z) * w);
    }
    if (!mask) { R.hips.rotation.x *= 0.85; R.hips.rotation.y *= 0.85; R.hips.rotation.z *= 0.85; }   /* body lies flat */

    st.t += dt;
    if (mask) return;
    st.rest = energy < 0.05 ? st.rest + dt : 0;
    if (st.rest > 0.6 && gk > 0.6) st.sleep = true;               /* settled → free CPU */
  },

  /* world-space impulse: a punch, a landing, a slam */
  kick(R, x, y, z, k = 1) {
    const st = R && R.__limp; if (!st) return;
    st.sleep = false;
    st.kick.set(x * k, y * k, z * k);
    for (const j in st.v) { st.v[j][0] += (Math.random() - 0.5) * 2.2 * k; st.v[j][2] += (Math.random() - 0.5) * 2.2 * k; }
  },
  wake(R) { if (R && R.__limp) { R.__limp.sleep = false; R.__limp.rest = 0; } },
  release(R) { if (R) R.__limp = null; },
  active(R) { return !!(R && R.__limp); },
  asleep(R) { return !!(R && R.__limp && R.__limp.sleep); },
};
