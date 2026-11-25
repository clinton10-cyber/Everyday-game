/* lp-tattoos.js — purchasable body tattoo decals.
   Canvas ink planes parented to spine / arms / hips, pushed outside the skin
   with polygonOffset so they stay visible on both classic and faceted looks. */
import * as THREE from "three";
import { TATTOOS } from "../core/style-ability-shop.js";

const _texCache = new Map();

function makeTattooTexture(id, colorHex) {
  const key = id + ":" + colorHex;
  if (_texCache.has(key)) return _texCache.get(key);

  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  const col = colorHex || "#111111";
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const cx = size / 2, cy = size / 2;

  switch (id) {
    case "tribal_arm": {
      ctx.lineWidth = 12;
      for (let i = 0; i < 4; i++) {
        const y = 40 + i * 44;
        ctx.beginPath();
        ctx.moveTo(24, y);
        ctx.bezierCurveTo(70, y - 18, 180, y + 18, 232, y);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(50, 30); ctx.lineTo(40, 220); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(206, 30); ctx.lineTo(216, 220); ctx.stroke();
      break;
    }
    case "rose_chest": {
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.25) {
        const r = 48 + 16 * Math.sin(a * 5);
        const x = cx + Math.cos(a) * r;
        const y = cy - 12 + Math.sin(a) * r;
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 40);
      ctx.bezierCurveTo(cx - 16, cy + 80, cx + 12, cy + 100, cx - 8, cy + 120);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx + 28, cy + 70, 20, 10, 0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "dragon_back": {
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(cx, 24);
      ctx.bezierCurveTo(cx + 60, 70, cx - 60, 130, cx + 20, 200);
      ctx.bezierCurveTo(cx + 40, 220, cx - 20, 236, cx, 240);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const y = 50 + i * 30;
        ctx.beginPath();
        ctx.arc(cx - 12 + (i % 2) * 24, y, 14, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case "geo_sleeve": {
      ctx.lineWidth = 6;
      const pts = [[30, 50], [128, 24], [226, 50], [210, 140], [128, 210], [46, 140]];
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(128, 24); ctx.lineTo(128, 210); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(30, 50); ctx.lineTo(226, 50); ctx.stroke();
      break;
    }
    case "flame_fore": {
      for (let i = 0; i < 3; i++) {
        const x = 60 + i * 60;
        ctx.beginPath();
        ctx.moveTo(x, 220);
        ctx.bezierCurveTo(x - 28, 140, x + 20, 90, x, 30);
        ctx.bezierCurveTo(x + 16, 100, x - 12, 160, x + 8, 220);
        ctx.fill();
      }
      break;
    }
    case "star_map": {
      const stars = [[50, 70], [110, 40], [190, 80], [90, 140], [160, 160], [70, 190]];
      stars.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.lineWidth = 4;
      ctx.beginPath();
      stars.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
      break;
    }
    case "ankara_band": {
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 7; col++) {
          if ((row + col) % 2 === 0) ctx.fillRect(20 + col * 32, 30 + row * 32, 26, 26);
        }
      }
      break;
    }
    case "infinity": {
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.bezierCurveTo(cx - 70, cy - 50, cx - 70, cy + 50, cx, cy);
      ctx.bezierCurveTo(cx + 70, cy - 50, cx + 70, cy + 50, cx, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.bezierCurveTo(cx - 14, cy - 32, cx - 24, cy, cx, cy + 18);
      ctx.bezierCurveTo(cx + 24, cy, cx + 14, cy - 32, cx, cy - 10);
      ctx.fill();
      break;
    }
    case "cross_faith": {
      ctx.fillRect(cx - 12, 40, 24, 170);
      ctx.fillRect(cx - 55, 80, 110, 24);
      break;
    }
    case "wave_hip": {
      ctx.lineWidth = 10;
      for (let i = 0; i < 3; i++) {
        const y = 70 + i * 40;
        ctx.beginPath();
        ctx.moveTo(16, y);
        ctx.bezierCurveTo(70, y - 30, 160, y + 30, 240, y);
        ctx.stroke();
      }
      break;
    }
    default: {
      ctx.beginPath();
      ctx.arc(cx, cy, 50, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  _texCache.set(key, tex);
  return tex;
}

/* Joint + local pose. Z is pushed outward so ink sits on top of skin, not inside it. */
const SLOT_POSE = {
  chest: { joint: "spine", pos: [0, 0.30, 0.18],  rot: [0, 0, 0],           scale: [0.22, 0.22, 1] },
  back:  { joint: "spine", pos: [0, 0.28, -0.17], rot: [0, Math.PI, 0],     scale: [0.24, 0.28, 1] },
  armL:  { joint: "armL",  pos: [0.04, -0.12, 0.06], rot: [0, 0.55, 0],     scale: [0.14, 0.18, 1] },
  armR:  { joint: "armR",  pos: [-0.04, -0.12, 0.06], rot: [0, -0.55, 0],   scale: [0.14, 0.18, 1] },
  hip:   { joint: "hips",  pos: [0.07, -0.05, 0.13], rot: [0, 0, 0],        scale: [0.16, 0.13, 1] },
};

function resolveParent(rig, slot) {
  if (slot === "spine" || slot === "chest" || slot === "back") return rig.spine;
  if (slot === "hips" || slot === "hip") return rig.hips;
  if (slot === "armL") {
    if (rig.armL && rig.armL.shoulder) return rig.armL.shoulder;
    if (rig.armL && rig.armL.isObject3D) return rig.armL;
    return null;
  }
  if (slot === "armR") {
    if (rig.armR && rig.armR.shoulder) return rig.armR.shoulder;
    if (rig.armR && rig.armR.isObject3D) return rig.armR;
    return null;
  }
  return rig.spine;
}

export function clearTattoos(rig) {
  if (!rig) return;
  const parents = [rig.spine, rig.hips];
  if (rig.armL) parents.push(rig.armL.shoulder || rig.armL);
  if (rig.armR) parents.push(rig.armR.shoulder || rig.armR);
  for (const p of parents) {
    if (!p || !p.children) continue;
    for (const c of p.children.slice()) {
      if (c.userData && c.userData.isTattoo) {
        p.remove(c);
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      }
    }
  }
  rig._tattooGroup = null;
}

/**
 * Attach equipped tattoos to the character rig.
 * @param {object} rig
 * @param {string[]} equippedIds
 */
export function attachTattoos(rig, equippedIds) {
  if (!rig || !rig.spine) return;
  clearTattoos(rig);
  if (!equippedIds || !equippedIds.length) return;

  const placed = [];

  for (const id of equippedIds) {
    const def = TATTOOS.find(t => t.id === id);
    if (!def) continue;
    const pose = SLOT_POSE[def.slot] || SLOT_POSE.chest;
    const parent = resolveParent(rig, def.slot);
    if (!parent) {
      console.warn("[tattoos] no parent for slot", def.slot, id);
      continue;
    }

    const tex = makeTattooTexture(def.id, def.color);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.15,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    mesh.rotation.set(pose.rot[0], pose.rot[1], pose.rot[2]);
    mesh.scale.set(pose.scale[0], pose.scale[1], pose.scale[2]);
    mesh.renderOrder = 10;
    mesh.userData.isTattoo = true;
    mesh.userData.tattooId = id;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
    placed.push(id);
  }

  if (placed.length) {
    console.info("[tattoos] attached", placed.join(", "));
  }
}
