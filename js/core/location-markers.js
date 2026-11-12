/* ================================================================
   location-markers.js  —  3D Location Signs & Entrance Markers
   ================================================================
   Adds two kinds of in-world location indicators:
     1. STREET SIGNS  — pole + sign board visible from afar
     2. ENTRANCE ARCH — glow ring + label at the building gate
     3. DIRECTION ARROWS — floating arrows on sidewalks pointing
                           to each major landmark

   Usage:
     import { LocationMarkers } from './location-markers.js';
     LocationMarkers.build(scene, compounds, camera);
     // In update loop:
     LocationMarkers.tick(dt, camera, playerX, playerZ);
   ================================================================ */

import * as THREE from "three";
import { textLabel } from "../core/kit.js";

const _markers = [];
let   _camera  = null;

/* ── Icon per landmark ──────────────────────────────────────── */
const ICONS = {
  govhouse:     "🏛️",
  governor:     "🏅",
  hotel:        "🏨",
  airport:      "✈️",
  mansion:      "🏰",
  showroom:     "🚘",
  realestate:   "🏠",
  market:       "🛒",
  prison:       "🔒",
  myhouse:      "🏡",
  jobcenter:    "💼",
  university:   "🎓",
  boropark:     "🌳",
  pleasurepark: "🎡",
  hospital: "🏥",
  church: "⛪",
  mosque: "🕌",
  vatican: "✝️",
  statehouse: "🏛️",
  classroom: "🏫",
  computerlab: "💻",
  zoo: "🦁",
  statejail: "⛓️",
  vastcity: "🏙️",
  duplex: "🏘️",
  lagosflat: "🏢",
  forest: "🌲",
  canteen: "🍽️",
  phoneshop: "📱",
  beach: "🏖️",
  citypark: "⛲",
  nightclub: "🪩",
  village: "🛖",
  default:      "📍",
};

const COLORS = {
  govhouse:     0xffd76b,
  governor:     0xffc200,
  hotel:        0xff9f5c,
  airport:      0x5ee0ff,
  mansion:      0xffccee,
  showroom:     0x88ccff,
  realestate:   0xb0e890,
  market:       0xf4a460,
  prison:       0x8a8a92,
  myhouse:      0xaaddaa,
  jobcenter:    0x4ab0ff,
  university:   0xee88ff,
  boropark:     0x66cc66,
  pleasurepark: 0xffcc33,
  hospital: 0xff6b6b,
  church: 0xffe2a0,
  mosque: 0x66e0b0,
  vatican: 0xffd76b,
  statehouse: 0xc9a961,
  classroom: 0xffd34a,
  computerlab: 0x5ee0ff,
  zoo: 0xffa940,
  statejail: 0xb0b4bc,
  vastcity: 0x7ab8ff,
  duplex: 0xf0c060,
  lagosflat: 0xffb347,
  forest: 0x66cc66,
  canteen: 0xe8a860,
  phoneshop: 0x2f9bff,
  beach: 0x35a9b4,
  citypark: 0x7ee0a0,
  nightclub: 0xb04aff,
  village: 0xe0b070,
  default:      0x5ee0ff,
};

/* ── Build a street sign ─────────────────────────────────────── */
function buildStreetSign(name, sub, color) {
  const g = new THREE.Group();

  /* Pole */
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.07, 5.5, 8),
    new THREE.MeshLambertMaterial({ color: 0x555566 })
  );
  pole.position.y = 2.75;
  g.add(pole);

  /* Sign board */
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.9, 0.12),
    new THREE.MeshLambertMaterial({ color: color || 0x1a2a3a })
  );
  board.position.y = 5.3;
  g.add(board);

  /* Colour stripe */
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.12, 0.13),
    new THREE.MeshLambertMaterial({ color: color || 0x5ee0ff })
  );
  stripe.position.y = 4.87;
  g.add(stripe);

  /* Canvas label */
  try {
    const lbl = textLabel(name.toUpperCase(), sub || "");
    lbl.scale.multiplyScalar(0.45);
    lbl.position.y = 5.3;
    g.add(lbl);
  } catch(e) {}

  return g;
}

/* ── Build an entrance arch ──────────────────────────────────── */
function buildEntranceArch(color) {
  const g = new THREE.Group();

  /* Glow ring on the ground */
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.8, 4.3, 32),
    new THREE.MeshBasicMaterial({ color: color || 0x5ee0ff, transparent:true, opacity:0.55, side:THREE.DoubleSide, depthWrite:false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  g.add(ring);
  g.userData.ring = ring;

  /* Two gate pillars */
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x2a3a4a });
  for (const sx of [-4.8, 4.8]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 0.35), pillarMat);
    p.position.set(sx, 1.6, 0);
    g.add(p);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), new THREE.MeshLambertMaterial({ color: color || 0x5ee0ff }));
    cap.position.set(sx, 3.3, 0);
    g.add(cap);
  }

  /* Crossbar */
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(9.8, 0.25, 0.25),
    new THREE.MeshLambertMaterial({ color: color || 0x5ee0ff })
  );
  bar.position.y = 3.1;
  g.add(bar);

  return g;
}

/* ── Floating direction arrow (sidewalk) ─────────────────────── */
function buildArrow(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: color || 0x5ee0ff });
  // Arrow shaft
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.6), mat), {}).translateZ(-0.3));
  // Arrow head
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 6), mat);
  head.rotation.x = -Math.PI / 2;
  head.position.z = 0.2;
  g.add(head);
  return g;
}

/* ── Main module ─────────────────────────────────────────────── */
export const LocationMarkers = {

  build(scene, compounds, camera) {
    _camera = camera;

    for (const c of compounds) {
      if (!c.lm || c.lm.id === "airplane") continue;

      const id    = c.lm.id;
      const name  = c.lm.name || id.toUpperCase();
      const color = COLORS[id] || COLORS.default;
      const cx    = c.x, cz = c.z, ry = c.ry;
      const icon  = ICONS[id] || ICONS.default;

      /* Street sign near the entrance (front of compound, facing road) */
      const sign = buildStreetSign(name, icon, color);
      const signOff = 20;                  // offset from compound centre toward road
      sign.position.set(
        cx + Math.sin(ry + Math.PI) * signOff,
        0,
        cz + Math.cos(ry + Math.PI) * signOff
      );
      sign.rotation.y = ry;
      scene.add(sign);

      /* Entrance arch at gate (the gap in the fence) */
      const arch = buildEntranceArch(color);
      arch.position.set(
        cx + Math.sin(ry + Math.PI) * 17.2,
        0,
        cz + Math.cos(ry + Math.PI) * 17.2
      );
      arch.rotation.y = ry;
      scene.add(arch);

      /* Floating billboard above the building */
      const board = new THREE.Group();
      try {
        const lbl = textLabel(name, icon);
        lbl.scale.multiplyScalar(0.8);
        board.add(lbl);
      } catch(e) {}
      board.position.set(cx, 18, cz);
      scene.add(board);

      _markers.push({ id, arch, board, color, cx, cz, ring: arch.userData.ring, phase: Math.random() * Math.PI * 2 });
    }

    /* Sidewalk arrows — directional nudges toward key locations */
    _buildSidewalkArrows(scene, compounds);
  },

  tick(dt, camera, playerX, playerZ) {
    if (camera) _camera = camera;
    const t = performance.now() * 0.001;

    for (const m of _markers) {
      /* Pulsing glow ring */
      if (m.ring) {
        const pulse = 0.35 + Math.sin(t * 2 + m.phase) * 0.2;
        m.ring.material.opacity = pulse;
        const s = 1 + Math.sin(t * 2 + m.phase) * 0.04;
        m.ring.scale.set(s, s, s);
      }

      /* Billboard always faces camera */
      if (m.board && _camera) {
        m.board.lookAt(_camera.position);

        /* Fade billboard based on player distance */
        const dx = m.cx - playerX, dz = m.cz - playerZ;
        const dist = Math.sqrt(dx*dx + dz*dz);
        const alpha = Math.max(0, Math.min(1, (dist - 30) / 60));
        m.board.traverse(o => {
          if (o.material) {
            o.material.opacity = alpha * 0.9;
            o.material.transparent = true;
          }
        });
      }
    }
  },

  clear() {
    _markers.length = 0;
  },
};

/* ── Sidewalk arrows pointing toward landmarks ───────────────── */
function _buildSidewalkArrows(scene, compounds) {
  const BLOCK = 64;
  const key   = ["govhouse","airport","mansion","prison","university","market","jobcenter","hotel"];

  for (const c of compounds) {
    if (!key.includes(c.lm?.id)) continue;
    const color = COLORS[c.lm.id] || COLORS.default;
    const cx = c.x, cz = c.z;

    // 4 arrows along the road corridors leading to this compound
    for (let step = 1; step <= 3; step++) {
      const dist  = step * BLOCK;
      const ang   = Math.atan2(cx, cz) + Math.PI; // road toward compound

      for (const offset of [-8, 8]) {
        const perp   = ang + Math.PI / 2;
        const ax     = Math.sin(ang) * dist + Math.cos(perp) * offset;
        const az     = Math.cos(ang) * dist + Math.sin(perp) * offset;
        const arrow  = buildArrow(color);
        arrow.position.set(ax, 0.25, az);
        arrow.rotation.y = Math.atan2(cx - ax, cz - az); // point at compound
        // Gentle float
        arrow.userData.baseY = 0.25;
        arrow.userData.phase = Math.random() * Math.PI * 2;
        scene.add(arrow);
      }
    }
  }
}

