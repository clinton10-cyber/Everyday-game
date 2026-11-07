/* Shared polish for campus / park interiors.
   The room shells (floors, walls, furniture, colliders, seats) stay as they
   were; this adds what they lacked: textured floors chosen by room type,
   skirting boards, a grid of ceiling light panels with a few real lights, and
   per-room accent lighting. All meshes are decoration-only (no colliders). */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

function tex(w, h, draw, rx, ry) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const KINDS = {
  wood:    { tile: 2.4, make: () => tex(128, 128, (g, w, h) => { g.fillStyle = "#a9764a"; g.fillRect(0, 0, w, h);
              for (let i = 0; i < 6; i++) { g.fillStyle = `rgb(${150 + i * 6},${100 + i * 4},${62 + i * 3})`; g.fillRect(0, i * 21, w, 20); g.fillStyle = "rgba(50,28,12,.7)"; g.fillRect(0, i * 21, w, 1.5); } }) },
  vinyl:   { tile: 1.6, make: () => tex(64, 64, (g, w, h) => { g.fillStyle = "#cfd8de"; g.fillRect(0, 0, w, h); g.strokeStyle = "#a9b5be"; g.lineWidth = 2; g.strokeRect(0, 0, w, h); }) },
  tile:    { tile: 1.2, make: () => tex(64, 64, (g, w, h) => { g.fillStyle = "#eef0ee"; g.fillRect(0, 0, w, h); g.strokeStyle = "#b9bfbc"; g.lineWidth = 3; g.strokeRect(0, 0, w, h); }) },
  checker: { tile: 1.6, make: () => tex(64, 64, (g, w, h) => { g.fillStyle = "#f2efe6"; g.fillRect(0, 0, w, h); g.fillStyle = "#b5483c"; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32); }) },
  carpet:  { tile: 3.0, make: () => tex(64, 64, (g, w, h) => { g.fillStyle = "#2d4a6e"; g.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .08})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }) },
  court:   { tile: 4.0, make: () => tex(128, 128, (g, w, h) => { g.fillStyle = "#c98a3d"; g.fillRect(0, 0, w, h); g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12); }) },
  marble:  { tile: 3.0, make: () => tex(128, 128, (g, w, h) => { g.fillStyle = "#efeae0"; g.fillRect(0, 0, w, h); g.strokeStyle = "rgba(140,140,150,.25)"; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(Math.random() * w, 0); g.lineTo(Math.random() * w, h); g.stroke(); } g.strokeStyle = "rgba(110,100,90,.4)"; g.strokeRect(0, 0, w, h); }) },
  pave:    { tile: 2.0, make: () => tex(64, 64, (g, w, h) => { g.fillStyle = "#9a9a9e"; g.fillRect(0, 0, w, h); g.strokeStyle = "#7c7c82"; g.lineWidth = 2; g.strokeRect(0, 0, w, h); }) },
};
function kindFor(label, floorHex) {
  const L = (label || "").toUpperCase();
  if (/GARDEN|PLAYGROUND|OUTDOOR GYM|POOL/.test(L)) return null;       // keep grass / water as built
  if (/PLAZA/.test(L)) return "pave";
  if (/REST ?ROOM|BATH|TOILET|CHANGING|WASH/.test(L)) return "tile";
  if (/KITCHEN|DINING|CAFE|BAR|SEATING|KITCHENETTE/.test(L)) return "checker";
  if (/GYM|COURT|SPORT/.test(L)) return "court";
  if (/LAB|WARD|TREATMENT|PHARMACY|CONSULT|RECEPTION|STORAGE/.test(L)) return "vinyl";
  if (/LECTURE|LT\d|SEMINAR|SENATE|STAGE/.test(L)) return "carpet";
  if (/LIBRARY|READING|JOURNAL|REFERENCE|CATALOGUE|OFFICE|LIBRARIAN|REGISTRY|BURSARY|VICE|ROOM|LECTURER|FOYER|COMMON/.test(L)) return /FOYER/.test(L) ? "marble" : "wood";
  return "marble";
}

export function polishCampus(scene, ROOMS, WH, opts = {}) {
  const cache = {};
  const skirt = [];
  const panels = [], lamps = [];
  let lights = 0;
  ROOMS.forEach(r => {
    if (r.level) return;
    const k = kindFor(r.label, r.floor);
    if (k) {
      const spec = KINDS[k];
      const t = (cache[k] = cache[k] || spec.make()).clone(); t.needsUpdate = true;
      t.repeat.set(Math.max(1, r.w / spec.tile), Math.max(1, r.d / spec.tile));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(r.w - 0.02, r.d - 0.02),
        new THREE.MeshLambertMaterial({ map: t }));
      m.rotation.x = -Math.PI / 2; m.position.set(r.x + r.w / 2, 0.158, r.z + r.d / 2);
      m.receiveShadow = true; m.userData.isDecoration = true; scene.add(m);
    }
    if (opts.indoor !== false) {
      // skirting boards just inside each room edge
      const inset = 0.12, h = 0.16, th = 0.05, y = 0.15 + h / 2;
      const edge = (w, d, x, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); skirt.push(g); };
      edge(r.w - 0.3, th, r.x + r.w / 2, r.z + inset); edge(r.w - 0.3, th, r.x + r.w / 2, r.z + r.d - inset);
      edge(th, r.d - 0.3, r.x + inset, r.z + r.d / 2); edge(th, r.d - 0.3, r.x + r.w - inset, r.z + r.d / 2);
      // ceiling light panels on a 5 m grid
      const nx = Math.max(1, Math.floor(r.w / 5)), nz = Math.max(1, Math.floor(r.d / 5));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const g = new THREE.BoxGeometry(1.5, 0.05, 0.55);
        g.translate(r.x + (i + .5) * r.w / nx, WH - 0.12, r.z + (j + .5) * r.d / nz);
        panels.push(g);
      }
      if (lights < (opts.maxLights ?? 5) && r.w * r.d > 90) {
        const l = new THREE.PointLight(0xfff4e0, 0.7, Math.max(r.w, r.d) * 1.4, 2);
        l.position.set(r.x + r.w / 2, WH - 1.2, r.z + r.d / 2); scene.add(l); lights++;
      }
    }
  });
  if (skirt.length) { const m = new THREE.Mesh(mergeGeometries(skirt, false), new THREE.MeshLambertMaterial({ color: 0xf6f1e6 })); m.userData.isDecoration = true; scene.add(m); skirt.forEach(g => g.dispose()); }
  if (panels.length) { const m = new THREE.Mesh(mergeGeometries(panels, false), new THREE.MeshBasicMaterial({ color: 0xfffbe8 })); m.userData.isDecoration = true; scene.add(m); panels.forEach(g => g.dispose()); }
}
