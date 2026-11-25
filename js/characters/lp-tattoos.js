/* lp-tattoos.js — purchasable body tattoo decals for classic + faceted characters.
   Each design is a small transparent canvas plane parented to spine / arm / hip joints.
   Only equipped tattoos (from style-ability-shop) are attached. */
import * as THREE from "three";
import { TATTOOS } from "../core/style-ability-shop.js";

const _texCache = new Map();

function makeTattooTexture(id, colorHex) {
  const key = id + ":" + colorHex;
  if (_texCache.has(key)) return _texCache.get(key);

  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = colorHex || "#111";
  ctx.strokeStyle = colorHex || "#111";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const cx = size / 2, cy = size / 2;

  switch (id) {
    case "tribal_arm": {
      ctx.lineWidth = 6;
      for (let i = 0; i < 4; i++) {
        const y = 28 + i * 22;
        ctx.beginPath();
        ctx.moveTo(18, y);
        ctx.bezierCurveTo(40, y - 10, 88, y + 10, 110, y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(30, 20); ctx.lineTo(24, 108); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(98, 20); ctx.lineTo(104, 108); ctx.stroke();
      break;
    }
    case "rose_chest": {
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.3) {
        const r = 22 + 8 * Math.sin(a * 5);
        const x = cx + Math.cos(a) * r;
        const y = cy - 8 + Math.sin(a) * r;
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 18);
      ctx.bezierCurveTo(cx - 8, cy + 40, cx + 6, cy + 48, cx - 4, cy + 58);
      ctx.stroke();
      /* leaf */
      ctx.beginPath();
      ctx.ellipse(cx + 14, cy + 36, 10, 5, 0.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "dragon_back": {
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx, 16);
      ctx.bezierCurveTo(cx + 30, 40, cx - 30, 70, cx + 10, 100);
      ctx.bezierCurveTo(cx + 20, 110, cx - 10, 118, cx, 120);
      ctx.stroke();
      /* scales */
      for (let i = 0; i < 5; i++) {
        const y = 30 + i * 16;
        ctx.beginPath();
        ctx.arc(cx - 6 + (i % 2) * 12, y, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case "geo_sleeve": {
      ctx.lineWidth = 3;
      const pts = [[20, 30], [64, 18], [108, 30], [100, 70], [64, 100], [28, 70]];
      ctx.beginPath();
      pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.closePath(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(64, 18); ctx.lineTo(64, 100); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(20, 30); ctx.lineTo(108, 30); ctx.stroke();
      break;
    }
    case "flame_fore": {
      ctx.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        const x = 36 + i * 28;
        ctx.beginPath();
        ctx.moveTo(x, 110);
        ctx.bezierCurveTo(x - 14, 70, x + 10, 50, x, 20);
        ctx.bezierCurveTo(x + 8, 50, x - 6, 80, x + 4, 110);
        ctx.fill();
      }
      break;
    }
    case "star_map": {
      const stars = [[30, 40], [60, 28], [95, 45], [50, 70], [80, 80], [40, 95]];
      stars.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.lineWidth = 2;
      ctx.beginPath();
      stars.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.stroke();
      break;
    }
    case "ankara_band": {
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 6; col++) {
          if ((row + col) % 2 === 0) {
            ctx.fillRect(12 + col * 18, 20 + row * 18, 14, 14);
          }
        }
      }
      break;
    }
    case "infinity": {
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.bezierCurveTo(cx - 40, cy - 30, cx - 40, cy + 30, cx, cy);
      ctx.bezierCurveTo(cx + 40, cy - 30, cx + 40, cy + 30, cx, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.bezierCurveTo(cx - 8, cy - 18, cx - 14, cy, cx, cy + 10);
      ctx.bezierCurveTo(cx + 14, cy, cx + 8, cy - 18, cx, cy - 6);
      ctx.fill();
      break;
    }
    case "cross_faith": {
      ctx.fillRect(cx - 6, 24, 12, 80);
      ctx.fillRect(cx - 28, 44, 56, 12);
      break;
    }
    case "wave_hip": {
      ctx.lineWidth = 5;
      for (let i = 0; i < 3; i++) {
        const y = 40 + i * 22;
        ctx.beginPath();
        ctx.moveTo(10, y);
        ctx.bezierCurveTo(40, y - 18, 80, y + 18, 118, y);
        ctx.stroke();
      }
      break;
    }
    default: {
      ctx.beginPath();
      ctx.arc(cx, cy, 28, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  _texCache.set(key, tex);
  return tex;
}

/** Slot → parent joint path on the rig + local pose */
const SLOT_POSE = {
  chest: { joint: "spine", pos: [0, 0.30, 0.14], rot: [0, 0, 0], scale: [0.16, 0.16, 1] },
  back:  { joint: "spine", pos: [0, 0.28, -0.13], rot: [0, Math.PI, 0], scale: [0.18, 0.22, 1] },
  armL:  { joint: "armL",  pos: [0.02, -0.10, 0.04], rot: [0, 0.4, 0], scale: [0.11, 0.14, 1] },
  armR:  { joint: "armR",  pos: [-0.02, -0.10, 0.04], rot: [0, -0.4, 0], scale: [0.11, 0.14, 1] },
  hip:   { joint: "hips",  pos: [0.06, -0.04, 0.10], rot: [0, 0, 0], scale: [0.12, 0.10, 1] },
};

function resolveParent(rig, slot) {
  const pose = SLOT_POSE[slot] || SLOT_POSE.chest;
  if (pose.joint === "spine") return rig.spine;
  if (pose.joint === "hips") return rig.hips;
  if (pose.joint === "armL") return rig.armL && (rig.armL.shoulder || rig.armL);
  if (pose.joint === "armR") return rig.armR && (rig.armR.shoulder || rig.armR);
  return rig.spine;
}

/**
 * Attach equipped tattoos to the character rig.
 * @param {object} rig  - character rig (spine, hips, armL, armR)
 * @param {string[]} equippedIds - list of tattoo ids from getEquippedTattoos()
 */
export function attachTattoos(rig, equippedIds) {
  if (!rig || !rig.spine) return;
  /* remove previous */
  const old = rig._tattooGroup;
  if (old && old.parent) old.parent.remove(old);
  rig._tattooGroup = null;
  if (!equippedIds || !equippedIds.length) return;

  const group = new THREE.Group();
  group.name = "body-tattoos";
  group.userData.keepOnRebuild = false;

  for (const id of equippedIds) {
    const def = TATTOOS.find(t => t.id === id);
    if (!def) continue;
    const pose = SLOT_POSE[def.slot] || SLOT_POSE.chest;
    const parent = resolveParent(rig, def.slot);
    if (!parent) continue;

    const tex = makeTattooTexture(def.id, def.color);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    mesh.rotation.set(pose.rot[0], pose.rot[1], pose.rot[2]);
    mesh.scale.set(pose.scale[0], pose.scale[1], pose.scale[2]);
    mesh.renderOrder = 3;
    mesh.userData.tattooId = id;
    parent.add(mesh);
    group.attach?.(mesh); // keep reference list
    if (!group.userData.meshes) group.userData.meshes = [];
    group.userData.meshes.push(mesh);
  }

  /* store handle on spine so rebuild can clear */
  rig.spine.add(group);
  rig._tattooGroup = group;
}

export function clearTattoos(rig) {
  if (!rig) return;
  if (rig._tattooGroup && rig._tattooGroup.parent) {
    rig._tattooGroup.parent.remove(rig._tattooGroup);
  }
  /* also remove any tattoo meshes left on joints */
  for (const j of [rig.spine, rig.hips, rig.armL?.shoulder, rig.armR?.shoulder]) {
    if (!j) continue;
    for (const c of j.children.slice()) {
      if (c.userData && c.userData.tattooId) j.remove(c);
    }
  }
  rig._tattooGroup = null;
}
