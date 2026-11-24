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
import { GUN_STANCE, STANCE_PITCHES, STANCE_LEGS, STANCE_DROP } from "./gun-stances.js";

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

/* ── Long-gun family: shared low-poly construction, distinct proportions ── */
function buildLongGun3D(type) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x303944, roughness: 0.42, metalness: 0.78 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x171b20, roughness: 0.82, metalness: 0.12 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x68737c, roughness: 0.3, metalness: 0.9 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x493522, roughness: 0.8, metalness: 0.05 });
  const box = (w,h,d,mat,x,y,z) => { const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); m.castShadow=true; g.add(m); return m; };
  const cyl = (r1,r2,len,mat,x,y,z) => { const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,len,8),mat); m.rotation.x=Math.PI/2; m.position.set(x,y,z); m.castShadow=true; g.add(m); return m; };
  const dims = { rifle:{barrel:0.48, stock:0.24, mag:0.12, fore:0.22}, smg:{barrel:0.25,stock:0.14,mag:0.10,fore:0.12}, shotgun:{barrel:0.38,stock:0.27,mag:0.05,fore:0.25}, lmg:{barrel:0.62,stock:0.28,mag:0.20,fore:0.30} }[type] || {barrel:0.45,stock:0.22,mag:0.12,fore:0.2};
  const stockMat = type === "shotgun" ? wood : dark;
  box(0.055,0.065,0.34,metal,0,0.02,0.10);
  box(0.045,0.075,dims.stock,stockMat,0,0.005,-0.19-dims.stock*0.35);
  box(0.045,0.075,dims.fore,dark,0,-0.005,0.27);
  cyl(0.012,0.014,dims.barrel,accent,0,0.025,0.42+dims.barrel*0.5);
  box(0.032,0.12,0.055,dark,0,-0.075,0.055);
  if (type !== "shotgun") box(0.045,dims.mag,0.06,metal,0,-0.105,0.08);
  if (type === "lmg") {
    box(0.07,0.11,0.12,dark,0,-0.12,0.18);
    for (const side of [-1,1]) { const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.008,0.17,5),accent); leg.position.set(side*0.035,-0.11,0.34); leg.rotation.z=side*0.22; g.add(leg); }
  }
  if (type === "shotgun") {
    cyl(0.018,0.018,0.34,wood,0,-0.035,0.37);
    box(0.018,0.018,0.18,accent,0,-0.06,0.34);
  }
  if (type === "rifle" || type === "lmg") {
    cyl(0.022,0.022,0.17,dark,0,0.085,0.12);
    box(0.012,0.025,0.025,accent,0,0.12,0.18);
  }
  g.userData.muzzleLocal = new THREE.Vector3(0,0.025,0.42+dims.barrel);
  return g;
}

/* ── Runtime config ─────────────────────────────────────────── */
const GUN_CONFIG = {
  pistol: {
    damage: 25, range: 25, cooldown: 0.40, fireDuration: 0.22,
  },
  sniper: { damage: 85, range: 70, cooldown: 1.50, fireDuration: 0.55 },
  rifle: { damage: 30, range: 46, cooldown: 0.12, fireDuration: 0.24 },
  smg: { damage: 19, range: 30, cooldown: 0.075, fireDuration: 0.18 },
  shotgun: { damage: 62, range: 17, cooldown: 0.82, fireDuration: 0.38 },
  lmg: { damage: 25, range: 43, cooldown: 0.105, fireDuration: 0.30 },
};

/* ── Crosshair, hitscan ray helper, body parts ────────────────── */
let _crosshair = null;
function ensureCrosshair() {
  if (_crosshair && _crosshair.parentNode) return _crosshair;
  _crosshair = document.createElement("div");
  _crosshair.id = "ph3d-crosshair";
  _crosshair.style.cssText =
    "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);" +
    "width:24px;height:24px;z-index:29;pointer-events:none;display:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.75))";
  _crosshair.innerHTML =
    '<i style="position:absolute;left:50%;top:1px;width:2px;height:7px;margin-left:-1px;background:#fff;border-radius:2px;box-shadow:0 1px 3px #000"></i>' +
    '<i style="position:absolute;left:50%;bottom:1px;width:2px;height:7px;margin-left:-1px;background:#fff;border-radius:2px;box-shadow:0 1px 3px #000"></i>' +
    '<i style="position:absolute;top:50%;left:1px;width:7px;height:2px;margin-top:-1px;background:#fff;border-radius:2px;box-shadow:0 1px 3px #000"></i>' +
    '<i style="position:absolute;top:50%;right:1px;width:7px;height:2px;margin-top:-1px;background:#fff;border-radius:2px;box-shadow:0 1px 3px #000"></i>' +
    '<i style="position:absolute;left:50%;top:50%;width:3px;height:3px;margin:-1.5px 0 0 -1.5px;background:#fff;border:1px solid rgba(0,0,0,.75);border-radius:50%"></i>';
  document.body.appendChild(_crosshair);
  return _crosshair;
}

function setCrosshairVisible(v) {
  const c = ensureCrosshair();
  c.style.display = v ? "block" : "none";
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

/* ── Two-handed stances ──
   The poses live in gun-stances.js (generated by solving the real rig + gun meshes). They are sampled by aim pitch
   so the barrel follows the camera exactly, and blended idle <-> move so the bladed firing stance (hips turned, knees
   bent, one foot forward) only shows while the player stands still. */
function stanceSample(set, pitch) {
  const P = STANCE_PITCHES, n = P.length;
  if (pitch <= P[0]) return set[0];
  if (pitch >= P[n - 1]) return set[n - 1];
  let i = 0; while (pitch > P[i + 1]) i++;
  const k = (pitch - P[i]) / (P[i + 1] - P[i]), a = set[i], b = set[i + 1];
  return a.map((v, j) => v + (b[j] - v) * k);
}
function stanceMix(a, b, k) { return a.map((v, j) => v + (b[j] - v) * k); }
function poseFromP(p) {
  return {
    r_shoulder: [p[0], p[1], p[2]], r_elbow: [p[3], 0, 0], r_wrist: [p[4], 0, 0],
    l_shoulder: [p[5], p[6], p[7]], l_elbow: [p[8], 0, 0], l_wrist: [p[9], 0, 0],
    spine: [p[10], p[11], 0], head: [p[13], p[14], p[15]],
  };
}
/* lower body: staggered, knee-bent legs + a slightly lower pelvis, only while standing still (k = 0..1) */
function applyLowerStance(R, k) {
  if (!(k > 0.001) || !R.legL || !R.legR) return;
  const L = STANCE_LEGS, ank = (l) => l.ankle || l.ank;
  const to = (j, v) => { if (j) j.rotation.x += (v - j.rotation.x) * k; };
  to(R.legL.hip, L.lh); to(R.legL.knee, L.lk); to(ank(R.legL), -(L.lh + L.lk));
  to(R.legR.hip, L.rh); to(R.legR.knee, L.rk); to(ank(R.legR), -(L.rh + L.rk));
  if (R.hips) R.hips.position.y += STANCE_DROP * k;
}

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
const RIFLE_KICK = { ...PISTOL_KICK, r_shoulder:[0.24,0,0], l_shoulder:[0.20,0,0], spine:[0.055,0,0], head:[0.07,0,0] };
const SMG_KICK = { ...PISTOL_KICK, r_shoulder:[0.15,0,0], l_shoulder:[0.13,0,0], spine:[0.035,0,0], head:[0.045,0,0] };
const SHOTGUN_KICK = { ...SNIPER_KICK, r_shoulder:[0.78,0,0], l_shoulder:[0.70,0,0], spine:[0.24,0,0], head:[0.22,0,0] };
const LMG_KICK = { ...RIFLE_KICK, r_shoulder:[0.30,0,0], l_shoulder:[0.28,0,0], spine:[0.075,0,0] };

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

    this.mesh = type === "pistol" ? buildPistol3D() : type === "sniper" ? buildSniper3D() : buildLongGun3D(type);
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
    setGrip(this.controls.rig, +1, 1);
    this._setState("drawn");
  }

  holster() {
    if (this.state === "holstered") return;
    this.mesh.visible = false;
    setGrip(this.controls.rig, -1, 0);
    setGrip(this.controls.rig, +1, 0);
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
    const kick  = ({ pistol: PISTOL_KICK, sniper: SNIPER_KICK, rifle: RIFLE_KICK, smg: SMG_KICK, shotgun: SHOTGUN_KICK, lmg: LMG_KICK })[this.type] || PISTOL_KICK;
    const c = this.controls || {};
    const aimPitch = c.aimPitch || 0;
    const sets = GUN_STANCE[this.type] || GUN_STANCE.pistol;

    /* hip -> aimed blend, eased over ~0.12 s so raising the gun is a motion, not a snap */
    const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
    const dt = Math.min(0.1, Math.max(0, (now - (this._aimT || now)) / 1000)); this._aimT = now;
    const want = c.aiming ? 1 : 0;
    this._aimK = (this._aimK || 0) + (want - (this._aimK || 0)) * Math.min(1, dt * 14);

    /* firing stance only when standing still on the ground; walking / crouching / flying keep the square stance */
    const standing = (c.state === undefined || c.state === "standing") && c.onGround !== false && !(c.jet && c.jet.on);
    const idleWant = standing ? Math.max(0, Math.min(1, 1 - (c._moveAmt || 0))) : 0;
    this._idleK = (this._idleK == null ? idleWant : this._idleK) + (idleWant - (this._idleK == null ? idleWant : this._idleK)) * Math.min(1, dt * 9);

    const pose = (m) => stanceMix(stanceSample(sets[m].move, aimPitch), stanceSample(sets[m].idle, aimPitch), this._idleK);
    const pp = stanceMix(pose("ready"), pose("ads"), this._aimK);
    const aimed = poseFromP(pp);

    const lower = () => { if (R.hips) R.hips.rotation.y += pp[12]; applyLowerStance(R, this._idleK); };
    if (this.state === "drawn") {
      applyPose(R, aimed);
      lower();
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
      const scale = ({ sniper:1.30, shotgun:1.42, lmg:0.92, rifle:0.86, smg:0.62 })[this.type] || 1.00;
      const blend = blendPose(
        { r_shoulder:[0,0,0], r_elbow:[0,0,0], r_wrist:[0,0,0], l_shoulder:[0,0,0], l_elbow:[0,0,0], l_wrist:[0,0,0], spine:[0,0,0], head:[0,0,0] },
        kick,
        kickAmount * scale
      );
      applyPose(R, addPose(aimed, blend));
      lower();
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
    if (this.type !== "shotgun") this._spawnCasing();

    // Interior shots stop at the first registered solid collider.
    let wallT = this.range;
    if (c._interiorWeaponMode && c.world && Array.isArray(c.world.colliders)) {
      for (const col of c.world.colliders) {
        if (!col) continue;
        if (col.level !== undefined && col.level !== (c.level || 0)) continue;
        const t = rayAABBHelper(
          origin.x, origin.y, origin.z, dir.x, dir.y, dir.z,
          col.minX, col.y0 != null ? col.y0 : 0, col.minZ,
          col.maxX, col.y1 != null ? col.y1 : 3, col.maxZ, wallT
        );
        if (t > 0 && t < wallT) wallT = t;
      }
    }
    let bestHit = null, bestT = wallT, bestPart = "torso";
    const radius = this.type === "sniper" ? 0.52 : this.type === "shotgun" ? 0.82 : 0.55;

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
    this.rifle = new Gun(controls, "rifle");
    this.smg = new Gun(controls, "smg");
    this.shotgun = new Gun(controls, "shotgun");
    this.lmg = new Gun(controls, "lmg");
    this.bazooka = new RocketLauncher(controls);
    this.current = "fists";
    this.onStateChange = null;
  }

  _notify() {
    if (this.onStateChange) try { this.onStateChange(this); } catch (e) {}
  }

  select(name) {
    if (name === this.current) return;
    this.knife.holster();
    this.pistol.holster();
    this.sniper.holster();
    this.rifle.holster(); this.smg.holster(); this.shotgun.holster(); this.lmg.holster();
    this.bazooka.holster();
    this.current = name;
    if (name === "knife")  this.knife.draw();
    else if (name === "pistol") this.pistol.draw();
    else if (name === "sniper") this.sniper.draw();
    else if (name === "rifle") this.rifle.draw();
    else if (name === "smg") this.smg.draw();
    else if (name === "shotgun") this.shotgun.draw();
    else if (name === "lmg") this.lmg.draw();
    else if (name === "bazooka") this.bazooka.draw();
    this._notify();
    this._syncCrosshair();
  }

  _syncCrosshair() {
    setCrosshairVisible(["pistol", "sniper", "rifle", "smg", "shotgun", "lmg", "bazooka"].includes(this.current));
  }

  cycle() {
    const list = ["fists", "knife", "pistol", "smg", "rifle", "shotgun", "lmg", "sniper", "bazooka"];
    const i = list.indexOf(this.current);
    this.select(list[(i + 1) % list.length]);
  }

  holsterAll() { this.select("fists"); }
  isArmed() { return this.current !== "fists"; }

  attack(targets) {
    const c = this.controls;
    /* plain walker objects (drive/walk scenes) have no .state; only block when a state exists */
    const st = c && c.state;
    if (c && st && st !== "standing" && st !== "crouching") return false;
    if (c && (!!c.held || (c._emoteTimer > 0.12) || (!!(c.jet && c.jet.on) && c.onGround === false))) return false;
    if (this.current === "knife")  return this.knife.stab();
    if (this.current === "pistol") return this.pistol.fire();
    if (this.current === "sniper") return this.sniper.fire();
    if (this.current === "rifle") return this.rifle.fire();
    if (this.current === "smg") return this.smg.fire();
    if (this.current === "shotgun") return this.shotgun.fire();
    if (this.current === "lmg") return this.lmg.fire();
    if (this.current === "bazooka") return this.bazooka.fire();
    return false;
  }

  update(dt, targets) {
    this.knife.update(dt, targets);
    this.pistol.update(dt, targets);
    this.sniper.update(dt, targets);
    this.rifle.update(dt, targets); this.smg.update(dt, targets); this.shotgun.update(dt, targets); this.lmg.update(dt, targets);
    this.bazooka.update(dt, targets);
  }

  applyArmPose(R) {
    if (this.current === "knife")  return this.knife.applyArmPose(R);
    if (this.current === "pistol") return this.pistol.applyArmPose(R);
    if (this.current === "sniper") return this.sniper.applyArmPose(R);
    if (this.current === "rifle") return this.rifle.applyArmPose(R);
    if (this.current === "smg") return this.smg.applyArmPose(R);
    if (this.current === "shotgun") return this.shotgun.applyArmPose(R);
    if (this.current === "lmg") return this.lmg.applyArmPose(R);
    if (this.current === "bazooka") return this.bazooka.applyArmPose(R);
  }

  dispose() {
    this.knife.dispose();
    this.pistol.dispose();
    this.sniper.dispose();
    this.rifle.dispose(); this.smg.dispose(); this.shotgun.dispose(); this.lmg.dispose();
    this.bazooka.dispose();
    setCrosshairVisible(false);
  }
}
