/* knife.js -- Always-available knife. Bladed stance + hip-rotation
   stab. Two-hand-ready pose puts left arm out for balance. */
import * as THREE from "three";
import { setGrip } from "../characters/lowpoly.js";
import { Combat } from "./combat.js";
import { Sfx } from "./sfx.js";

export const KNIFE_DAMAGE   = 22;
export const KNIFE_REACH    = 2.2;
export const KNIFE_COOLDOWN = 0.65;
const STAB_DURATION = 0.48;

export function buildKnife3D() {
  const g = new THREE.Group();
  const bladeMat  = new THREE.MeshStandardMaterial({ color: 0xd8dce4, roughness: 0.15, metalness: 0.95 });
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.85, metalness: 0.05 });
  const metalMat  = new THREE.MeshStandardMaterial({ color: 0xb8b8c0, roughness: 0.30, metalness: 0.90 });

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.023, 0.12, 8), handleMat);
  handle.castShadow = true; g.add(handle);

  for (let i = 0; i < 4; i++) {
    const wrap = new THREE.Mesh(
      new THREE.TorusGeometry(0.022, 0.003, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x14100a, roughness: 0.95 })
    );
    wrap.rotation.x = Math.PI / 2;
    wrap.position.y = -0.045 + i * 0.030;
    g.add(wrap);
  }

  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), metalMat);
  pommel.position.y = -0.070; g.add(pommel);

  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.080, 0.010, 0.020), metalMat);
  guard.position.y = 0.068; g.add(guard);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.200, 0.005), bladeMat);
  blade.position.y = 0.175; blade.castShadow = true; g.add(blade);

  const tipGeo = new THREE.ConeGeometry(0.0225, 0.05, 4);
  tipGeo.rotateZ(Math.PI);
  const tip = new THREE.Mesh(tipGeo, bladeMat);
  tip.position.y = 0.300; tip.scale.z = 0.15; tip.castShadow = true; g.add(tip);

  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(0.004, 0.180, 0.001),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  edge.position.set(0.0225, 0.175, 0.003); g.add(edge);

  return g;
}

/* Ready pose: bladed stance. Right hand at hip, blade forward.
   Left arm out to the side for balance. Torso turned. */
const KNIFE_READY = {
  r_shoulder: [-0.45,  0.20, -0.15],
  r_elbow:    [-1.35,  0,     0    ],
  r_wrist:    [ 1.15,  0,     0.10 ],
  l_shoulder: [-0.30, -0.70,  0.40 ],
  l_elbow:    [-0.85,  0,     0    ],
  l_wrist:    [ 0,     0,     0    ],
  spine:      [ 0,     0.10,  0    ],
  head:       [ 0,    -0.10,  0    ],
};

function applyPose(R, pose) {
  if (R.armR) {
    R.armR.shoulder.rotation.set(pose.r_shoulder[0], pose.r_shoulder[1], pose.r_shoulder[2]);
    R.armR.elbow.rotation.set(pose.r_elbow[0], pose.r_elbow[1], pose.r_elbow[2]);
    if (R.armR.wrist) R.armR.wrist.rotation.set(pose.r_wrist[0], pose.r_wrist[1], pose.r_wrist[2]);
  }
  if (R.armL) {
    R.armL.shoulder.rotation.set(pose.l_shoulder[0], pose.l_shoulder[1], pose.l_shoulder[2]);
    R.armL.elbow.rotation.set(pose.l_elbow[0], pose.l_elbow[1], pose.l_elbow[2]);
    if (R.armL.wrist) R.armL.wrist.rotation.set(pose.l_wrist[0], pose.l_wrist[1], pose.l_wrist[2]);
  }
  if (R.spine) {
    R.spine.rotation.x = pose.spine[0];
    R.spine.rotation.y = pose.spine[1];
    R.spine.rotation.z = pose.spine[2];
  }
  if (R.head) {
    R.head.rotation.x = pose.head[0];
    R.head.rotation.y = pose.head[1];
    R.head.rotation.z = pose.head[2];
  }
}

export class Knife {
  constructor(controls) {
    this.controls = controls;
    this.mesh = buildKnife3D();
    this.mesh.visible = false;
    this.state = "holstered";
    this.animTime = 0;
    this.cooldown = 0;
    this.hitDone = false;
    this.onStateChange = null;

    const rig = controls.rig;
    if (rig && rig.armR && rig.armR.grip) {
      this.mesh.rotation.set(Math.PI / 2, 0, 0);
      rig.armR.grip.add(this.mesh);
    }
  }

  _setState(s) {
    if (this.state === s) return;
    this.state = s;
    if (this.onStateChange) { try { this.onStateChange(this); } catch (e) {} }
  }

  draw() {
    if (this.state !== "holstered") return;
    this.mesh.visible = true;
    setGrip(this.controls.rig, -1, 1);
    this._setState("drawn");
  }

  holster() {
    if (this.state === "holstered") return;
    this.mesh.visible = false;
    setGrip(this.controls.rig, -1, 0);
    this._setState("holstered");
  }

  stab() {
    if (this.state !== "drawn") return false;
    if (this.cooldown > 0) return false;
    this.cooldown = KNIFE_COOLDOWN;
    this.animTime = 0;
    this.hitDone = false;
    this._setState("stabbing");
    try { Sfx.play("knife_slash"); } catch (_) {}
    return true;
  }

  update(dt, others) {
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.state !== "stabbing") return;
    this.animTime += dt;
    const p = Math.min(this.animTime / STAB_DURATION, 1);
    if (!this.hitDone && p >= 0.42) {
      this.hitDone = true;
      this._doHit(others);
    }
    if (p >= 1) this._setState("drawn");
  }

  /* Full-body stab: hip rotation wind-up → thrust → recover.
     Uses the same pose struct as the guns. */
  applyArmPose(R) {
    if (!R) return;
    if (this.state === "drawn") {
      applyPose(R, KNIFE_READY);
      return;
    }
    if (this.state !== "stabbing") return;

    const p = this.animTime / STAB_DURATION;
    const P = KNIFE_READY;

    if (p < 0.30) {
      /* Wind-up: turn torso left, pull arm back */
      const k = p / 0.30;
      applyPose(R, {
        r_shoulder: [P.r_shoulder[0] - k * 0.45, P.r_shoulder[1] + k * 0.15, P.r_shoulder[2]],
        r_elbow:    [P.r_elbow[0]    - k * 0.20, 0, 0],
        r_wrist:    [P.r_wrist[0]    - k * 0.15, 0, 0],
        l_shoulder: [P.l_shoulder[0] + k * 0.10, P.l_shoulder[1], P.l_shoulder[2]],
        l_elbow:    P.l_elbow,
        l_wrist:    P.l_wrist,
        spine:      [P.spine[0], P.spine[1] + k * 0.35, P.spine[2]],
        head:       [P.head[0], P.head[1], P.head[2]],
      });
    } else if (p < 0.55) {
      /* Thrust: swing torso right, extend arm forward */
      const k = (p - 0.30) / 0.25;
      applyPose(R, {
        r_shoulder: [P.r_shoulder[0] - 0.45 + k * 1.05, P.r_shoulder[1] + 0.15 - k * 0.40, P.r_shoulder[2]],
        r_elbow:    [P.r_elbow[0]    - 0.20 + k * 1.35, 0, 0],
        r_wrist:    [P.r_wrist[0]    - 0.15 + k * 0.05, 0, 0],
        l_shoulder: [P.l_shoulder[0] + 0.10 - k * 0.30, P.l_shoulder[1] - k * 0.20, P.l_shoulder[2]],
        l_elbow:    [P.l_elbow[0] - k * 0.35, 0, 0],
        l_wrist:    P.l_wrist,
        spine:      [P.spine[0] + k * 0.08, P.spine[1] + 0.35 - k * 0.60, P.spine[2]],
        head:       [P.head[0], P.head[1] + k * 0.10, P.head[2]],
      });
    } else {
      /* Recover */
      const k = (p - 0.55) / 0.45;
      applyPose(R, {
        r_shoulder: [P.r_shoulder[0] + 0.60 - k * 0.60, P.r_shoulder[1] - 0.25 + k * 0.25, P.r_shoulder[2]],
        r_elbow:    [P.r_elbow[0]    + 1.15 - k * 1.15, 0, 0],
        r_wrist:    [P.r_wrist[0]    - 0.10 + k * 0.10, 0, 0],
        l_shoulder: [P.l_shoulder[0] - 0.20 + k * 0.20, P.l_shoulder[1] - 0.20 + k * 0.20, P.l_shoulder[2]],
        l_elbow:    [P.l_elbow[0] - 0.35 + k * 0.35, 0, 0],
        l_wrist:    P.l_wrist,
        spine:      [P.spine[0] + 0.08 - k * 0.08, P.spine[1] - 0.25 + k * 0.25, P.spine[2]],
        head:       [P.head[0], P.head[1] + 0.10 - k * 0.10, P.head[2]],
      });
    }
  }

  _doHit(others) {
    const c = this.controls;
    if (!c) return;
    const fx = -Math.sin(c.yaw);
    const fz = -Math.cos(c.yaw);
    let hitAny = false;
    if (others && others.length) {
      for (const o of others) {
        if (!o || !o.alive) continue;
        const dx = o.x - c.pos.x;
        const dz = o.z - c.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > KNIFE_REACH) continue;
        const dot = (dx * fx + dz * fz) / Math.max(0.001, d);
        if (dot < 0.35) continue;
        try {
          if (o.hp !== undefined) o.hp -= KNIFE_DAMAGE;
          if (o.onHit) o.onHit(KNIFE_DAMAGE, "knife");
        } catch (e) {}
        hitAny = true;
        try { Sfx.play("knife_hit_flesh"); } catch (_) {}
      }
    }
    try {
      if (c.opts && typeof c.opts.onKnifeStab === "function") {
        c.opts.onKnifeStab({ x: c.pos.x + fx, z: c.pos.z + fz, damage: KNIFE_DAMAGE, hitAny });
      }
    } catch (e) {}
    try { Combat.flash && Combat.flash(hitAny ? 0.25 : 0.08); } catch (e) {}
  }

  dispose() {
    if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
    setGrip(this.controls.rig, -1, 0);
  }
}
