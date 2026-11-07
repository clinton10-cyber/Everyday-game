/* guns.js -- Pistol + Sniper at realistic real-world scale.
   Both are mounted with rotation.set(π/2, 0, 0) so that when the
   arm raises to aim, the barrel points forward in world space
   (same convention as the knife). Two-handed grip, torso recoil,
   ejected shell casings. */
import * as THREE from "three";
import { setGrip } from "../characters/lowpoly.js";
import { Combat } from "./combat.js";
import { Knife } from "./knife.js";
import { Sfx } from "./sfx.js";
import { RocketLauncher } from "./bazooka.js";

/* ── Pistol: real Glock-class dimensions ───────────────────────
   Total length 0.20m, height 0.14m, slide width 0.03m.
   Grip is centred on the gun's local origin (fist grips here). */
export function buildPistol3D() {
  const g = new THREE.Group();
  const matBody   = new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.45, metalness: 0.75 });
  const matGrip   = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.85, metalness: 0.10 });
  const matBarrel = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.30, metalness: 0.92 });
  const matAccent = new THREE.MeshStandardMaterial({ color: 0xccaa44, roughness: 0.50, metalness: 0.60 });

  /* Grip below the slide, at the fist */
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.095, 0.048), matGrip);
  grip.position.set(0, -0.045, -0.010);
  grip.rotation.x = 0.18;
  g.add(grip);

  /* Slide above grip */
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.032, 0.155), matBody);
  slide.position.set(0, 0.025, 0.035);
  g.add(slide);

  /* Barrel extension */
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.040, 8), matBarrel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.028, 0.135);
  g.add(barrel);

  /* Trigger guard */
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.003, 4, 8, Math.PI), matBarrel);
  guard.rotation.z = Math.PI;
  guard.position.set(0, -0.010, 0.020);
  g.add(guard);

  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.020, 0.005), matBarrel);
  trigger.position.set(0, -0.008, 0.018);
  g.add(trigger);

  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.008, 0.008), matAccent);
  frontSight.position.set(0, 0.045, 0.100);
  g.add(frontSight);

  const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.008, 0.008), matAccent);
  rearSight.position.set(0, 0.045, -0.035);
  g.add(rearSight);

  const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.015, 0.015), matAccent);
  hammer.position.set(0, 0.038, -0.045);
  g.add(hammer);

  g.userData.muzzleLocal = new THREE.Vector3(0, 0.028, 0.155);
  return g;
}

/* ── Sniper: real bolt-action dimensions ───────────────────────
   Total length 1.13m (stock back -0.34 → muzzle +0.79). */
export function buildSniper3D() {
  const g = new THREE.Group();
  const matBody   = new THREE.MeshStandardMaterial({ color: 0x2a4a3a, roughness: 0.55, metalness: 0.45 });
  const matBarrel = new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.25, metalness: 0.95 });
  const matScope  = new THREE.MeshStandardMaterial({ color: 0x0d0e14, roughness: 0.30, metalness: 0.80 });
  const matStock  = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.75, metalness: 0.15 });
  const matAccent = new THREE.MeshStandardMaterial({ color: 0xddbb55, roughness: 0.40, metalness: 0.80 });

  /* Grip at origin */
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.110, 0.055), matStock);
  grip.position.set(0, -0.058, -0.015);
  grip.rotation.x = 0.18;
  g.add(grip);

  /* Receiver body */
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.360), matBody);
  body.position.set(0, 0.030, 0.120);
  g.add(body);

  /* Stock behind grip */
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.090, 0.220), matStock);
  stock.position.set(0, 0.020, -0.230);
  g.add(stock);

  /* Cheek rest */
  const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.150), matStock);
  cheek.position.set(0, 0.085, -0.190);
  g.add(cheek);

  /* Scope */
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.220, 10), matScope);
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0, 0.110, 0.090);
  g.add(scope);

  const lensF = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.008, 10), matAccent);
  lensF.rotation.x = Math.PI / 2;
  lensF.position.set(0, 0.110, 0.202);
  g.add(lensF);
  const lensB = lensF.clone();
  lensB.position.z = -0.022;
  g.add(lensB);

  const m1 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.030, 0.020), matAccent);
  m1.position.set(0, 0.085, 0.160);
  g.add(m1);
  const m2 = m1.clone();
  m2.position.z = 0.020;
  g.add(m2);

  /* Long barrel */
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.440, 8), matBarrel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.028, 0.520);
  g.add(barrel);

  /* Muzzle brake */
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.050, 8), matAccent);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 0.028, 0.765);
  g.add(muzzle);

  /* Bipod legs */
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.120, 4), matBarrel);
    leg.rotation.z = s * 0.30;
    leg.position.set(s * 0.030, -0.055, 0.340);
    g.add(leg);
  }

  /* Magazine */
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.100, 0.040), matBody);
  mag.position.set(0, -0.045, 0.035);
  mag.rotation.x = 0.10;
  g.add(mag);

  /* Bolt handle */
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.060, 6), matAccent);
  bolt.rotation.z = Math.PI / 2;
  bolt.position.set(0.045, 0.045, 0.020);
  g.add(bolt);

  g.userData.muzzleLocal = new THREE.Vector3(0, 0.028, 0.790);
  return g;
}

/* ── Runtime config ─────────────────────────────────────────── */
const GUN_CONFIG = {
  pistol: {
    damage: 25, range: 25, cooldown: 0.40, fireDuration: 0.22,
  },
  sniper: {
    damage: 85, range: 70, cooldown: 1.50, fireDuration: 0.55,
  },
};

/* ── Crosshair, hitscan ray helper, body parts ────────────────── */
let _crosshair = null;
function ensureCrosshair() {
  if (_crosshair && _crosshair.parentNode) return _crosshair;
  _crosshair = document.createElement("div");
  _crosshair.id = "ph3d-crosshair";
  _crosshair.style.cssText =
    "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);" +
    "width:28px;height:28px;z-index:26;pointer-events:none;display:none";
  _crosshair.innerHTML =
    '<div style="position:absolute;left:50%;top:0;width:2px;height:9px;margin-left:-1px;background:#fff;box-shadow:0 0 6px rgba(0,0,0,.95)"></div>' +
    '<div style="position:absolute;left:50%;bottom:0;width:2px;height:9px;margin-left:-1px;background:#fff;box-shadow:0 0 6px rgba(0,0,0,.95)"></div>' +
    '<div style="position:absolute;top:50%;left:0;height:2px;width:9px;margin-top:-1px;background:#fff;box-shadow:0 0 6px rgba(0,0,0,.95)"></div>' +
    '<div style="position:absolute;top:50%;right:0;height:2px;width:9px;margin-top:-1px;background:#fff;box-shadow:0 0 6px rgba(0,0,0,.95)"></div>' +
    '<div style="position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;background:#ffcc2b;border-radius:50%;box-shadow:0 0 6px rgba(255,204,43,.85)"></div>';
  document.body.appendChild(_crosshair);
  return _crosshair;
}

function setCrosshairVisible(v) {
  const c = ensureCrosshair();
  let isInterior = false;
  try {
    isInterior = !!(window.__ph3d_router && window.__ph3d_router.current &&
      window.__ph3d_router.current.isInterior);
  } catch (e) {}
  c.style.display = (v && isInterior) ? "block" : "none";
}

function rayAABBHelper(ox, oy, oz, dx, dy, dz, minX, minY, minZ, maxX, maxY, maxZ, maxT) {
  let tmin = 0, tmax = maxT;
  if (Math.abs(dx) < 1e-8) { if (ox < minX || ox > maxX) return -1; }
  else { const inv = 1/dx; let t1 = (minX-ox)*inv, t2 = (maxX-ox)*inv;
    if (t1>t2) { const tmp=t1; t1=t2; t2=tmp; }
    if (t1>tmin) tmin=t1; if (t2<tmax) tmax=t2; if (tmin>tmax) return -1; }
  if (Math.abs(dy) < 1e-8) { if (oy < minY || oy > maxY) return -1; }
  else { const inv = 1/dy; let t1 = (minY-oy)*inv, t2 = (maxY-oy)*inv;
    if (t1>t2) { const tmp=t1; t1=t2; t2=tmp; }
    if (t1>tmin) tmin=t1; if (t2<tmax) tmax=t2; if (tmin>tmax) return -1; }
  if (Math.abs(dz) < 1e-8) { if (oz < minZ || oz > maxZ) return -1; }
  else { const inv = 1/dz; let t1 = (minZ-oz)*inv, t2 = (maxZ-oz)*inv;
    if (t1>t2) { const tmp=t1; t1=t2; t2=tmp; }
    if (t1>tmin) tmin=t1; if (t2<tmax) tmax=t2; if (tmin>tmax) return -1; }
  if (tmin <= 0.001) return -1;
  return tmin;
}

const PART_MULT  = { head: 4.0, torso: 1.0, arm: 0.55, leg: 0.70, foot: 0.45 };
const PART_LABEL = { head: "HEADSHOT", torso: "", arm: "ARM", leg: "LEG", foot: "FOOT" };
function bodyPartFor(localY, lateral) {
  if (localY > 1.45) return "head";
  if (localY > 0.85) return lateral > 0.34 ? "arm" : "torso";
  if (localY > 0.30) return "leg";
  return "foot";
}

function rayCylinder(ox, oy, oz, dx, dy, dz, cx, cz, r, yMin, yMax) {
  const px = ox - cx, pz = oz - cz;
  const a = dx*dx + dz*dz;
  let tNear, tFar;
  if (a < 1e-8) {
    if (px*px + pz*pz > r*r) return -1;
    tNear = -Infinity; tFar = Infinity;
  } else {
    const b = 2*(px*dx + pz*dz);
    const c = px*px + pz*pz - r*r;
    const disc = b*b - 4*a*c;
    if (disc < 0) return -1;
    const sq = Math.sqrt(disc);
    tNear = (-b - sq) / (2*a);
    tFar  = (-b + sq) / (2*a);
  }
  if (Math.abs(dy) < 1e-8) { if (oy < yMin || oy > yMax) return -1; }
  else {
    const tA = (yMin-oy)/dy, tB = (yMax-oy)/dy;
    tNear = Math.max(tNear, Math.min(tA,tB));
    tFar  = Math.min(tFar,  Math.max(tA,tB));
  }
  if (tNear > tFar || tFar < 0) return -1;
  return Math.max(tNear, 0);
}

/* ── Two-handed ready poses ───────────────────────────────────
   Both arms + torso + head. Recoil blends from ready → peak → ready. */
const PISTOL_READY = {
  r_shoulder: [-1.60,  0.10, -0.08],
  r_elbow:    [-0.18,  0,     0    ],
  r_wrist:    [ 0.05,  0,     0    ],
  l_shoulder: [-1.55, -0.32,  0.22 ],
  l_elbow:    [-0.55,  0,     0    ],
  l_wrist:    [ 0.10, -0.05,  0    ],
  spine:      [ 0.02,  0,     0    ],
  head:       [ 0.03, -0.05,  0    ],
};

const SNIPER_READY = {
  r_shoulder: [-0.55,  0.15, -0.25],
  r_elbow:    [-1.55,  0,     0    ],
  r_wrist:    [ 0.15,  0,     0    ],
  l_shoulder: [-1.45, -0.50,  0.25 ],
  l_elbow:    [-0.35,  0,     0    ],
  l_wrist:    [ 0.10,  0.05,  0    ],
  spine:      [ 0,     0.10,  0    ],
  head:       [ 0.05, -0.10,  0    ],
};

function blendPose(a, b, k) {
  const mix = (arrA, arrB) => [
    arrA[0] + (arrB[0] - arrA[0]) * k,
    arrA[1] + (arrB[1] - arrA[1]) * k,
    arrA[2] + (arrB[2] - arrA[2]) * k,
  ];
  return {
    r_shoulder: mix(a.r_shoulder, b.r_shoulder),
    r_elbow:    mix(a.r_elbow,    b.r_elbow),
    r_wrist:    mix(a.r_wrist,    b.r_wrist),
    l_shoulder: mix(a.l_shoulder, b.l_shoulder),
    l_elbow:    mix(a.l_elbow,    b.l_elbow),
    l_wrist:    mix(a.l_wrist,    b.l_wrist),
    spine:      mix(a.spine,      b.spine),
    head:       mix(a.head,       b.head),
  };
}

function addPose(a, b) {
  const add = (x, y) => [x[0]+y[0], x[1]+y[1], x[2]+y[2]];
  return {
    r_shoulder: add(a.r_shoulder, b.r_shoulder),
    r_elbow:    add(a.r_elbow,    b.r_elbow),
    r_wrist:    add(a.r_wrist,    b.r_wrist),
    l_shoulder: add(a.l_shoulder, b.l_shoulder),
    l_elbow:    add(a.l_elbow,    b.l_elbow),
    l_wrist:    add(a.l_wrist,    b.l_wrist),
    spine:      add(a.spine,      b.spine),
    head:       add(a.head,       b.head),
  };
}

const PISTOL_KICK = {
  r_shoulder: [ 0.35, 0,  0    ],
  r_elbow:    [ 0.20, 0,  0    ],
  r_wrist:    [-0.30, 0,  0    ],
  l_shoulder: [ 0.30, 0,  0    ],
  l_elbow:    [ 0.20, 0,  0    ],
  l_wrist:    [ 0,    0,  0    ],
  spine:      [ 0.08, 0,  0    ],
  head:       [ 0.10, 0,  0    ],
};

const SNIPER_KICK = {
  r_shoulder: [ 0.60, 0,  0    ],
  r_elbow:    [ 0.35, 0,  0    ],
  r_wrist:    [-0.40, 0,  0    ],
  l_shoulder: [ 0.55, 0,  0    ],
  l_elbow:    [ 0.35, 0,  0    ],
  l_wrist:    [ 0,    0,  0    ],
  spine:      [ 0.20, 0,  0    ],
  head:       [ 0.20, 0,  0    ],
};

/* Apply a full pose (both arms + torso + head). */
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

/* ── Gun runtime ─────────────────────────────────────────────── */
export class Gun {
  constructor(controls, type) {
    this.controls = controls;
    this.type = type;
    const cfg = GUN_CONFIG[type];
    this.damage = cfg.damage;
    this.range = cfg.range;
    this.cooldown = cfg.cooldown;
    this.fireDuration = cfg.fireDuration;

    this.mesh = type === "pistol" ? buildPistol3D() : buildSniper3D();
    this.mesh.visible = false;
    this.state = "holstered";
    this.animTime = 0;
    this.cdTime = 0;
    this.hitDone = false;
    this.onStateChange = null;
    this._pendingTimers = [];

    const rig = controls.rig;
    if (rig && rig.armR && rig.armR.grip) {
      /* +Z of gun → -Y of wrist → forward in world when arm is raised
         (same as knife mount). Without this the barrel points up. */
      this.mesh.rotation.set(Math.PI / 2, 0, 0);
      rig.armR.grip.add(this.mesh);
    }
    this._initLaser();
  }

  _initLaser() {
    const scene = this.controls.scene;
    if (!scene) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    this.laserLine = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        color: this.type === "sniper" ? 0xffcc2b : 0xff2a2a,
        transparent: true, opacity: 0.65,
      })
    );
    this.laserLine.frustumCulled = false;
    this.laserLine.visible = false;
    scene.add(this.laserLine);

    this.laserDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 6),
      new THREE.MeshBasicMaterial({
        color: this.type === "sniper" ? 0xffcc2b : 0xff2a2a,
        transparent: true, opacity: 0.9,
      })
    );
    this.laserDot.visible = false;
    scene.add(this.laserDot);
  }

  _updateLaser() {
    if (!this.laserLine) return;
    const armed = this.state === "drawn" || this.state === "firing";
    const aim = this.controls.getAim && this.controls.getAim();
    if (!armed || !this.mesh || !aim) {
      this.laserLine.visible = false;
      this.laserDot.visible = false;
      return;
    }
    const { origin, dir } = aim;
    const c = this.controls;
    let hit = 40;
    if (c.world && c.world.colliders) {
      for (const col of c.world.colliders) {
        if (col.level !== undefined && col.level !== (c.level || 0)) continue;
        const t = rayAABBHelper(
          origin.x, origin.y, origin.z, dir.x, dir.y, dir.z,
          col.minX, col.y0 != null ? col.y0 : 0, col.minZ,
          col.maxX, col.y1 != null ? col.y1 : 3, col.maxZ, hit
        );
        if (t > 0 && t < hit) hit = t;
      }
    }
    const end = origin.clone().addScaledVector(dir, hit);
    const muzzle = new THREE.Vector3();
    if (this.mesh.userData.muzzleLocal) {
      muzzle.copy(this.mesh.userData.muzzleLocal);
      this.mesh.localToWorld(muzzle);
    } else { muzzle.copy(origin); }

    const pos = this.laserLine.geometry.attributes.position.array;
    pos[0] = muzzle.x; pos[1] = muzzle.y; pos[2] = muzzle.z;
    pos[3] = end.x;    pos[4] = end.y;    pos[5] = end.z;
    this.laserLine.geometry.attributes.position.needsUpdate = true;
    this.laserLine.geometry.computeBoundingSphere();
    this.laserLine.visible = true;
    this.laserDot.position.copy(end);
    this.laserDot.visible = true;
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
    this.animTime = 0;
    this.cdTime = 0;
  }

  fire() {
    if (this.state !== "drawn") return false;
    if (this.cdTime > 0) return false;
    this.cdTime = this.cooldown;
    this.animTime = 0;
    this.hitDone = false;
    this._setState("firing");
    return true;
  }

  update(dt, targets) {
    if (this.cdTime > 0) this.cdTime = Math.max(0, this.cdTime - dt);
    this._updateLaser();
    if (this.state !== "firing") return;
    this.animTime += dt;
    const p = Math.min(this.animTime / this.fireDuration, 1);
    if (!this.hitDone && p >= 0.20) {
      this.hitDone = true;
      this._doFire(targets);
    }
    if (p >= 1) this._setState("drawn");
  }

  /* Full-body arm pose (both arms + torso + head). */
  applyArmPose(R) {
    if (!R) return;
    const ready = this.type === "pistol" ? PISTOL_READY : SNIPER_READY;
    const kick  = this.type === "pistol" ? PISTOL_KICK  : SNIPER_KICK;
    const aimPitch = (this.controls && this.controls.aimPitch) || 0;

    const adjust = (p) => ({
      r_shoulder: [p.r_shoulder[0] - aimPitch, p.r_shoulder[1], p.r_shoulder[2]],
      r_elbow:    p.r_elbow,
      r_wrist:    p.r_wrist,
      l_shoulder: [p.l_shoulder[0] - aimPitch, p.l_shoulder[1], p.l_shoulder[2]],
      l_elbow:    p.l_elbow,
      l_wrist:    p.l_wrist,
      spine:      p.spine,
      head:       [p.head[0] + aimPitch * 0.35, p.head[1], p.head[2]],
    });
    const aimed = adjust(ready);

    if (this.state === "drawn") {
      applyPose(R, aimed);
      return;
    }

    if (this.state === "firing") {
      const p = this.animTime / this.fireDuration;
      /* Kick curve: fast rise, longer decay for heavy weapons */
      let kickAmount;
      if (p < 0.15) kickAmount = p / 0.15;
      else if (p < 0.30) kickAmount = 1.0;
      else kickAmount = Math.max(0, 1 - (p - 0.30) / 0.70);

      /* Sniper kicks harder — scale by type */
      const scale = this.type === "sniper" ? 1.30 : 1.00;
      const blend = blendPose(
        { r_shoulder:[0,0,0], r_elbow:[0,0,0], r_wrist:[0,0,0], l_shoulder:[0,0,0], l_elbow:[0,0,0], l_wrist:[0,0,0], spine:[0,0,0], head:[0,0,0] },
        kick,
        kickAmount * scale
      );
      applyPose(R, addPose(aimed, blend));
    }
  }

  _doFire(targets) {
    const c = this.controls;
    if (!c) return;

    let origin, dir;
    const aim = c.getAim && c.getAim();
    if (aim) { origin = aim.origin; dir = aim.dir; }
    else {
      const fx = -Math.sin(c.yaw);
      const fz = -Math.cos(c.yaw);
      origin = new THREE.Vector3(c.pos.x, (c.floorY || 0) + 1.35, c.pos.z);
      dir = new THREE.Vector3(fx, 0, fz).normalize();
    }

    const muzzleWorld = new THREE.Vector3();
    if (this.mesh.userData.muzzleLocal) {
      muzzleWorld.copy(this.mesh.userData.muzzleLocal);
      this.mesh.localToWorld(muzzleWorld);
    } else { muzzleWorld.copy(origin); }
    this._spawnFlash(muzzleWorld);
    Sfx.gunshot(this.type, muzzleWorld.x, muzzleWorld.z);
    if (this.type === "pistol") this._spawnCasing();

    let bestHit = null, bestT = this.range, bestPart = "torso";
    const radius = this.type === "sniper" ? 0.52 : 0.55;

    if (targets && targets.length) {
      for (const o of targets) {
        if (!o || !o.alive) continue;
        const cy = (o.y != null ? o.y : 0);
        const t = rayCylinder(
          origin.x, origin.y, origin.z, dir.x, dir.y, dir.z,
          o.x, o.z, radius, cy + 0.05, cy + 1.70
        );
        if (t < 0 || t > this.range || t >= bestT) continue;
        const hx = origin.x + t * dir.x;
        const hz = origin.z + t * dir.z;
        const hitY = origin.y + t * dir.y;
        const lateral = Math.hypot(hx - o.x, hz - o.z);
        bestT = t; bestHit = o;
        bestPart = bodyPartFor(hitY - cy, lateral);
      }
    }

    if (bestHit) {
      const mult = PART_MULT[bestPart] || 1.0;
      const actualDmg = this.damage * mult;
      try {
        if (bestHit.hp !== undefined) bestHit.hp -= actualDmg;
        if (bestHit.onHit) bestHit.onHit(actualDmg, this.type, bestPart);
      } catch (e) {}
      if (bestPart === "head" || bestPart === "leg" || bestPart === "arm") {
        try { window.__ph3d_phone && window.__ph3d_phone._toast(PART_LABEL[bestPart]); } catch (e) {}
      }
    }

    try {
      if (c.opts && typeof c.opts.onGunFire === "function") {
        const endDist = Math.min(bestT === this.range ? this.range : bestT, this.range);
        c.opts.onGunFire({
          x: origin.x + dir.x * endDist,
          z: origin.z + dir.z * endDist,
          damage: bestHit ? this.damage * (PART_MULT[bestPart] || 1) : this.damage,
          type: this.type, part: bestPart, hit: !!bestHit,
        });
      }
    } catch (e) {}

    try { Combat.flash && Combat.flash(bestHit ? 0.15 : 0.05); } catch (e) {}
  }

  _spawnFlash(pos) {
    const scene = this.controls.scene;
    if (!scene) return;

    const light = new THREE.PointLight(
      0xffcc66,
      this.type === "sniper" ? 6 : 3,
      2.5
    );
    light.position.copy(pos);
    scene.add(light);

    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(this.type === "sniper" ? 0.05 : 0.03, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 1 })
    );
    flash.position.copy(pos);
    scene.add(flash);

    const timer = setTimeout(() => {
      try { if (light.parent) light.parent.remove(light); } catch (e) {}
      try { if (flash.parent) flash.parent.remove(flash); } catch (e) {}
      try { flash.geometry.dispose(); } catch (e) {}
      try { flash.material.dispose(); } catch (e) {}
      const i = this._pendingTimers.indexOf(timer);
      if (i >= 0) this._pendingTimers.splice(i, 1);
    }, 110);
    this._pendingTimers.push(timer);
  }

  _spawnCasing() {
    const scene = this.controls.scene;
    if (!scene) return;

    const ejectionLocal = new THREE.Vector3(0.020, 0.030, 0.020);
    const spawn = new THREE.Vector3();
    this.mesh.localToWorld(spawn.copy(ejectionLocal));

    const casing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.012, 6),
      new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.3, metalness: 0.9 })
    );
    casing.position.copy(spawn);
    scene.add(casing);

    /* Eject velocity — right and up from the character's facing */
    const yaw = this.controls.yaw;
    const v = new THREE.Vector3(1.2, 1.0, 0);
    const rotated = new THREE.Vector3(
      v.x * Math.cos(yaw) - v.z * Math.sin(yaw),
      v.y,
      v.x * Math.sin(yaw) + v.z * Math.cos(yaw)
    );

    const start = performance.now();
    const tick = () => {
      const dt = 0.016;
      rotated.y -= 9.8 * dt;
      casing.position.addScaledVector(rotated, dt);
      casing.rotation.x += dt * 22;
      casing.rotation.z += dt * 18;
      if (casing.position.y < 0.02 || performance.now() - start > 1200) {
        scene.remove(casing);
        casing.geometry.dispose();
        casing.material.dispose();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  dispose() {
    for (const t of this._pendingTimers) clearTimeout(t);
    this._pendingTimers.length = 0;
    if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
    if (this.laserLine) {
      if (this.laserLine.parent) this.laserLine.parent.remove(this.laserLine);
      this.laserLine.geometry.dispose();
      this.laserLine.material.dispose();
      this.laserLine = null;
    }
    if (this.laserDot) {
      if (this.laserDot.parent) this.laserDot.parent.remove(this.laserDot);
      this.laserDot.geometry.dispose();
      this.laserDot.material.dispose();
      this.laserDot = null;
    }
    setGrip(this.controls.rig, -1, 0);
  }
}

/* ── Weapons manager ─────────────────────────────────────────── */
export class Weapons {
  constructor(controls) {
    this.controls = controls;
    this.knife  = new Knife(controls);
    this.pistol = new Gun(controls, "pistol");
    this.sniper = new Gun(controls, "sniper");
    this.bazooka = new RocketLauncher(controls);
    this.current = "fists";
    this.onStateChange = null;
  }

  _notify() {
    if (this.onStateChange) try { this.onStateChange(this); } catch (e) {}
  }

  select(name) {
    if (name === this.current) return;
    /* Hunt rules: melee only while a contract is active */
    try {
      const H = window.__ph3d_hunt;
      if (H && H.active && name !== "fists" && name !== "knife") {
        window.__ph3d_phone?._toast("🔒 Hunt rules: melee only");
        return;
      }
    } catch (e) {}
    this.knife.holster();
    this.pistol.holster();
    this.sniper.holster();
    this.bazooka.holster();
    this.current = name;
    if (name === "knife")  this.knife.draw();
    else if (name === "pistol") this.pistol.draw();
    else if (name === "sniper") this.sniper.draw();
    else if (name === "bazooka") this.bazooka.draw();
    this._notify();
    this._syncCrosshair();
  }

  _syncCrosshair() {
    setCrosshairVisible(this.current !== "fists");
  }

  cycle() {
    const list = ["fists", "knife", "pistol", "sniper", "bazooka"];
    const i = list.indexOf(this.current);
    this.select(list[(i + 1) % list.length]);
  }

  holsterAll() { this.select("fists"); }
  isArmed() { return this.current !== "fists"; }

  attack(targets) {
    if (this.current === "knife")  return this.knife.stab();
    if (this.current === "pistol") return this.pistol.fire();
    if (this.current === "sniper") return this.sniper.fire();
    if (this.current === "bazooka") return this.bazooka.fire();
    return false;
  }

  update(dt, targets) {
    this.knife.update(dt, targets);
    this.pistol.update(dt, targets);
    this.sniper.update(dt, targets);
    this.bazooka.update(dt, targets);
  }

  applyArmPose(R) {
    if (this.current === "knife")  return this.knife.applyArmPose(R);
    if (this.current === "pistol") return this.pistol.applyArmPose(R);
    if (this.current === "sniper") return this.sniper.applyArmPose(R);
    if (this.current === "bazooka") return this.bazooka.applyArmPose(R);
  }

  dispose() {
    this.knife.dispose();
    this.pistol.dispose();
    this.sniper.dispose();
    this.bazooka.dispose();
    setCrosshairVisible(false);
  }
}
