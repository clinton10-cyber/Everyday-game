import * as THREE from "three";
import { Wardrobe } from "../core/wardrobe.js";
import { HIP_HEIGHT, measures, revolve, bone, mk, sphere, box, lerp } from "./lp-parts.js";
import { buildPelvis, buildLeg } from "./lp-bottoms.js";
import { buildTop, buildSleeves } from "./lp-tops.js";
import { buildHair, buildBeard } from "./lp-hair.js";
import { buildHat, buildGlasses, buildAccessories } from "./lp-extras.js";
import { buildCostume, COSTUMES } from "./lp-costumes.js";

export { HIP_HEIGHT, COSTUMES };

export function makeBlob() {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  g.addColorStop(0.00, "rgba(0,0,0,0.55)");
  g.addColorStop(0.55, "rgba(0,0,0,0.28)");
  g.addColorStop(1.00, "rgba(0,0,0,0.00)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.9 })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.005;
  blob.scale.set(1.15, 1.15, 1);
  return blob;
}


/* ── Main builder ─────────────────────────────────────── */
export function buildCharacter(config) {
  config = Wardrobe.effective(config || Wardrobe.config);
  const root = new THREE.Group();
  const rig = {};
  const mats = Wardrobe.makeMaterials(config);
  mats.top.side = mats.bottom.side = THREE.DoubleSide;
  rig.mats = mats;
  buildInto(root, rig, config, mats);
  return { root, rig };
}

export function applyConfig(root, rig, config) {
  config = Wardrobe.effective(config);
  while (root.children.length) {
    const c = root.children[0];
    root.remove(c);
    disposeTree(c);
  }
  Wardrobe.updateMaterials(rig.mats, config);
  buildInto(root, rig, config, rig.mats);
}

function disposeTree(node) {
  node.traverse(o => { if (o.geometry) o.geometry.dispose(); });
}

function buildInto(root, rig, config, mats) {
  const M = mats;
  const B = measures(config);
  const female = B.female;

  const hips = new THREE.Group();
  hips.position.y = HIP_HEIGHT;
  root.add(hips);
  rig.hips = hips;

  const spine = new THREE.Group();
  spine.position.y = 0.06;
  hips.add(spine);
  rig.spine = spine;

  const ctx = { B, cfg: config, M, hips, spine };
  buildPelvis(ctx);          /* decides ctx.bSpec (garment ease under the top) */
  buildTop(ctx);             /* torso shell, tail / skirt, collars → ctx.sleeve */

  /* ── neck + head ── */
  const neck = new THREE.Group();
  neck.position.y = 0.40;
  spine.add(neck);
  rig.neck = neck;
  mk(bone(0.052, 0.060, 0.10, 8), M.skin, neck);

  const head = new THREE.Group();
  head.position.y = 0.11;
  neck.add(head);
  rig.head = head;

  const skull = mk(sphere(0.105, 14, 10), M.skin, head, 0, 0.055, 0);
  skull.scale.set(1.00, 1.10, 1.04); skull.receiveShadow = true;
  const jaw = mk(sphere(0.074, 10, 7), M.skin, head, 0, 0.016, 0.012);
  jaw.scale.set(0.90, 0.76, 0.94); jaw.receiveShadow = true;

  const blob = (r, sx, sy, sz, x, y, z, mat, ws = 8, hs = 6) => {
    const m = mk(sphere(r, ws, hs), mat || M.skin, head, x, y, z);
    m.scale.set(sx, sy, sz); return m;
  };
  blob(0.0175, 1.0, 0.88, 0.95, 0, 0.034, 0.108);
  for (const s of [-1, 1]) blob(0.0100, 0.95, 0.80, 0.80, 0.0125 * s, 0.030, 0.103);
  blob(0.011, 0.85, 1.25, 0.80, 0, 0.050, 0.100).rotation.x = 0.15;
  for (const s of [-1, 1]) {
    const ex = 0.038 * s;
    blob(0.0225, 1.12, 0.82, 0.60, ex, 0.066, 0.088, M.eyeW, 10, 7);
    blob(0.0158, 1.00, 1.00, 0.60, ex, 0.0665, 0.0965, M.eyeD, 8, 6);
    blob(0.0040, 1.00, 1.00, 1.00, ex + 0.005, 0.0725, 0.1025, M.eyeW, 5, 4);
    blob(0.0225, 1.14, 0.12, 0.50, ex, 0.0735, 0.0925, M.eyeD, 9, 4);
    if (female) {
      const flick = mk(box(0.011, 0.0028, 0.004), M.eyeD, head, 0.0575 * s, 0.0765, 0.0925, 0, 0, 0.5 * s);
      flick.castShadow = false;
    }
    const brow = blob(0.018, 1.30, female ? 0.24 : 0.32, 0.50, 0.040 * s, 0.092, 0.092, M.hair, 7, 4);
    brow.rotation.z = -0.10 * s;
    blob(0.034, 0.32, 1.0, 0.78, 0.103 * s, 0.055, -0.004, M.skin, 8, 6);
  }
  blob(0.025, 1.00, 0.24, 0.30, 0, 0.0205, 0.0965, M.mouth, 8, 5);
  blob(0.023, 0.92, 0.30, 0.32, 0, 0.0115, 0.0975, M.mouth, 8, 5);

  buildHair(config, M, head, B);
  buildBeard(config, M, head, B);
  buildGlasses(config.glasses, M, head);
  buildHat(config.hat, M, head, config);
  buildAccessories(config, M, { head, neck, spine, hips, B });
  buildCostume(config, M, head, spine, hips, B);

  /* ── arms ── */
  function makeArm(side) {
    const g = {};
    const shoulder = new THREE.Group();
    shoulder.position.set(B.shoulderX * side, 0.350, 0);
    spine.add(shoulder);
    g.shoulder = shoulder;

    mk(bone(B.armTop, B.armElbow, 0.270, 10), M.skin, shoulder);

    const elbow = new THREE.Group();
    elbow.position.y = -0.270;
    shoulder.add(elbow);
    g.elbow = elbow;
    mk(bone(B.armElbow, B.armWrist, 0.250, 8), M.skin, elbow);

    buildSleeves(ctx, shoulder, elbow, side);

    const wrist = new THREE.Group();
    wrist.position.y = -0.250;
    elbow.add(wrist);
    g.wrist = wrist;

    const palm = mk(sphere(0.050, 8, 6), M.skin, wrist, 0, -0.045, 0);
    palm.scale.set(0.85, 1.00, 0.55);

    const thumbGroup = new THREE.Group();
    thumbGroup.position.set(-0.032 * side, -0.035, 0.008);
    const thumbMesh = mk(sphere(0.020, 6, 5), M.skin, thumbGroup, 0, -0.018, 0);
    thumbMesh.scale.set(0.80, 1.30, 0.90);
    wrist.add(thumbGroup);
    g.thumb = thumbGroup;

    const fingers = [];
    for (let f = 0; f < 4; f++) {
      const fingerGroup = new THREE.Group();
      fingerGroup.position.set((f - 1.5) * 0.023, -0.068, 0.020);
      mk(box(0.019, 0.032, 0.019), M.skin, fingerGroup, 0, -0.016, 0);
      const midJoint = new THREE.Group();
      midJoint.position.y = -0.032;
      fingerGroup.add(midJoint);
      mk(box(0.017, 0.026, 0.017), M.skin, midJoint, 0, -0.013, 0);
      wrist.add(fingerGroup);
      fingers.push({ group: fingerGroup, midJoint });
    }
    g.fingers = fingers;

    const grip = new THREE.Group();
    grip.position.set(0, -0.075, 0.005);
    wrist.add(grip);
    g.grip = grip;
    return g;
  }

  rig.armL = makeArm(+1);
  rig.armR = makeArm(-1);
  rig.legL = buildLeg(ctx, +1);
  rig.legR = buildLeg(ctx, -1);
  rig.measures = B;
  /* wrist accessories need the arm groups */
  buildAccessories(config, M, { head, neck, spine, hips, B, rig }, "arms");
}

/* ── Grip controller ────────────────────────────────────── */
export function setGrip(rig, sign, amount) {
  const arm = sign > 0 ? rig.armL : rig.armR;
  if (!arm || !arm.fingers) return;
  const t = Math.max(0, Math.min(1, amount));
  for (const f of arm.fingers) {
    f.group.rotation.x  = t * Math.PI * 0.55;
    f.midJoint.rotation.x = t * Math.PI * 0.60;
  }
  if (arm.thumb) {
    arm.thumb.rotation.x = -t * 0.40;
    arm.thumb.rotation.z = -sign * t * 0.70;
  }
}

/* ── Gait solvers ────────────────────────────────────── */
export function groundLeg(p, stride, kneeAmp, move) {
  const thigh  = -Math.cos(p) * stride;
  const swing  = Math.max(0, -Math.sin(p)) * move;
  const stance = Math.max(0,  Math.sin(p)) * move;
  const knee   = 0.12 * stance + kneeAmp * Math.pow(swing, 1.35);
  const ankle  = 0.30 * Math.max(0, Math.sin(p - 0.5)) * move - 0.06 - 0.22 * swing;
  return { thigh, knee, ankle };
}
export function airLeg(side, vy) {
  const j = (Math.max(-1, Math.min(1, vy / 4.0)) + 1) * 0.5;
  return {
    thigh: -0.30 + (-0.88 - -0.30) * j + (side > 0 ? -0.18 : 0.24),
    knee:   0.35 + ( 1.30 -  0.35) * j + (side > 0 ?  0.28 : -0.16),
    ankle: -0.16 + ( 0.46 - -0.16) * j,
  };
}
export function groundArm(p, amp, runAmt, move) {
  const swing  = Math.cos(p) * amp;
  const e0 = 0.30 + (1.45 - 0.30) * runAmt;
  const elbow  = -(e0 + 0.28 * Math.max(0, Math.cos(p))) * move;
  const spread = 0.10 + (0.06 - 0.10) * runAmt;
  return { swing, elbow, spread };
}
export function airArm(side, vy) {
  const j = (Math.max(-1, Math.min(1, vy / 4.0)) + 1) * 0.5;
  return {
    swing:  -0.50 + (-2.10 - -0.50) * j,
    elbow:  -0.90 + (-0.35 - -0.90) * j,
    spread:  0.55 + ( 0.25 -  0.55) * j,
  };
}
export function attachPhone(rig) {
  if (!rig || !rig.armR || rig.armR._phoneMesh) return;
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.10, 0.008),
    new THREE.MeshStandardMaterial({ color: 0x111417, roughness: 0.4 })
  );
  body.castShadow = true;
  g.add(body);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.048, 0.088),
    new THREE.MeshBasicMaterial({ color: 0x7fd0ff })
  );
  screen.position.z = 0.005;
  g.add(screen);
  g.position.set(0, -0.10, 0.06);
  g.rotation.set(-0.5, 0, 0);
  rig.armR.wrist = rig.armR.wrist || rig.armR.elbow;
  rig.armR.wrist.add(g);
  rig.armR._phoneMesh = g;
  rig.armR._phoneMesh.visible = false;
}


/* ── Selfie stick ─────────────────────────────────────────
   A telescopic pole held in the right fist, running out along the forearm
   with a phone clamp at the far end.  `rig.armR._stickTip` is an Object3D at
   the phone — captureSelfie() mounts the camera exactly there.            */
export function attachSelfieStick(rig) {
  if (!rig || !rig.armR || rig.armR._stickMesh) return;
  const arm = rig.armR, parent = arm.grip || arm.wrist || arm.elbow;
  if (!parent) return;
  const g = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.5 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb9bec7, roughness: 0.25, metalness: 0.8 });
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.017, 0.14, 10), black);
  grip.position.y = -0.03; g.add(grip);
  const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.36, 8), metal);
  seg1.position.y = -0.29; g.add(seg1);
  const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.36, 8), metal);
  seg2.position.y = -0.63; g.add(seg2);
  const tip = new THREE.Group(); tip.position.y = -0.84; g.add(tip);
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.03), black); tip.add(clamp);
  const ph = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.118, 0.008), new THREE.MeshStandardMaterial({ color: 0x0e1014, roughness: 0.3 }));
  ph.position.set(0, -0.045, 0.022); tip.add(ph);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.008, 10), new THREE.MeshBasicMaterial({ color: 0x4aa8ff }));
  lens.position.set(0, -0.045, -0.0, 0); lens.position.z = 0.0185; lens.position.y = -0.02; tip.add(lens);
  /* camera looks along tip -Z... the lens is on the face looking at the player */
  g.rotation.set(0, 0, 0);
  g.visible = false;
  parent.add(g);
  arm._stickMesh = g;
  arm._stickTip = tip;
}
export function setSelfieStick(rig, on) {
  if (!rig || !rig.armR) return;
  if (!rig.armR._stickMesh) attachSelfieStick(rig);
  if (rig.armR._stickMesh) rig.armR._stickMesh.visible = !!on;
}

export function applyPhonePose(rig, active) {
  if (!rig || !rig.armR || !rig.armR._phoneMesh) return;
  rig.armR._phoneMesh.visible = !!active;
  if (active) {
    rig.armR.shoulder.rotation.x = -1.15;
    rig.armR.shoulder.rotation.z = -0.55;
    rig.armR.shoulder.rotation.y = 0.35;
    rig.armR.elbow.rotation.x = -0.95;
  }
}

