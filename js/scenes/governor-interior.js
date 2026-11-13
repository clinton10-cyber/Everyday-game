/* governor-interior.js -- Rivers State Governor's Mansion, INTERIOR.
   Walkable in third person. Single connected floor plan:
   Grand Foyer (front) → Living · Dining · Study · Bedroom · Library,
   with walkable stairs up to an upper landing.
   The player spawns just inside the front doors; standing on the
   door use-point and pressing E returns to the exterior scene. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ThirdPersonControls } from "../core/thirdperson.js";
import { Quality } from "../core/quality.js";
import { NPCs } from "../core/npcs.js";
import { NpcTalk } from "../core/npc-talk.js";

export async function governorInteriorScene(params, router) {
  const LOW = Quality.isLow;

  /* ═══════════════════════════════════════════════════════════
     SCENE
     ═══════════════════════════════════════════════════════════ */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0806);

  const camera = new THREE.PerspectiveCamera(
    72, innerWidth / innerHeight, 0.1, 200
  );
  camera.rotation.order = "YXZ";

  scene.add(new THREE.AmbientLight(0xfff2e0, 0.62));
  scene.add(new THREE.HemisphereLight(0xfff5e6, 0x3a2f24, 0.80));

  const sun = new THREE.DirectionalLight(0xfff0d0, 1.55);
  sun.position.set(15, 17, 13);
  sun.target.position.set(0, 2.5, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(LOW ? 512 : 1024, LOW ? 512 : 1024);
  sun.shadow.camera.left   = -40;
  sun.shadow.camera.right  =  40;
  sun.shadow.camera.top    =  40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.near   = 1;
  sun.shadow.camera.far    = 100;
  sun.shadow.bias          = -0.0007;
  sun.shadow.normalBias    = 0.05;
  scene.add(sun, sun.target);

  /* ═══════════════════════════════════════════════════════════
     TEXTURES
     ═══════════════════════════════════════════════════════════ */
  const textures = [];
  const track = (t) => { textures.push(t); return t; };

  const cvs = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const _fin = (c, rx = 1, ry = 1) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = LOW ? 1 : 4;
    return track(t);
  };

  function marbleTex(rep) {
    const s = 256, c = cvs(s, s), x = c.getContext("2d");
    x.fillStyle = "#efe9dc"; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      x.strokeStyle = i % 6 === 0 ? "rgba(198,160,50,0.30)" : "rgba(150,150,158,0.18)";
      x.lineWidth = Math.random() * 2 + 0.4;
      let px = Math.random() * s, py = Math.random() * s;
      x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 4; k++) {
        px += (Math.random() - 0.5) * 100; py += (Math.random() - 0.5) * 100;
        x.quadraticCurveTo(px + (Math.random() - 0.5) * 60, py + (Math.random() - 0.5) * 60, px, py);
      }
      x.stroke();
    }
    return _fin(c, rep, rep);
  }

  function woodTex(rep) {
    const s = 256, c = cvs(s, s), x = c.getContext("2d");
    x.fillStyle = "#3e2716"; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 8; i++) {
      x.fillStyle = `rgba(${92 + Math.random() * 42 | 0},${60 + Math.random() * 28 | 0},${34 + Math.random() * 18 | 0},0.55)`;
      x.fillRect(0, i * 32, s, 30);
      x.strokeStyle = "rgba(18,10,4,0.75)"; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(0, i * 32); x.lineTo(s, i * 32); x.stroke();
    }
    return _fin(c, rep, rep);
  }

  function rugTex(bg, border, accent) {
    const s = 256, c = cvs(s, s), x = c.getContext("2d");
    x.fillStyle = bg; x.fillRect(0, 0, s, s);
    x.strokeStyle = border; x.lineWidth = 9; x.strokeRect(13, 13, s - 26, s - 26);
    x.strokeStyle = accent; x.lineWidth = 3; x.strokeRect(27, 27, s - 54, s - 54);
    return _fin(c, 1, 1);
  }

  function carpetTex() {
    const s = 128, c = cvs(s, s), x = c.getContext("2d");
    x.fillStyle = "#d9cbb0"; x.fillRect(0, 0, s, s);
    const im = x.getImageData(0, 0, s, s), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 22; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    x.putImageData(im, 0, 0);
    return _fin(c, 6, 5);
  }

  const TX = {
    marbleF: marbleTex(4), marbleS: marbleTex(1),
    woodF: woodTex(3), woodS: woodTex(1),
    rug1: rugTex("#5d1a20", "#c9a227", "#8f5a2a"),
    rug2: rugTex("#1f3a5f", "#d9c27a", "#3d6b8f"),
    rug3: rugTex("#2c4a2e", "#c9a227", "#7a5a2a"),
    carpet: carpetTex(),
  };

  /* ═══════════════════════════════════════════════════════════
     MATERIALS
     ═══════════════════════════════════════════════════════════ */
  const M = {
    floor:    new THREE.MeshPhongMaterial({ map: TX.marbleF, shininess: 85, specular: 0x555555 }),
    floorWood:new THREE.MeshPhongMaterial({ map: TX.woodF, shininess: 30, specular: 0x333333 }),
    carpet:   new THREE.MeshLambertMaterial({ map: TX.carpet }),
    rug1:     new THREE.MeshLambertMaterial({ map: TX.rug1 }),
    rug2:     new THREE.MeshLambertMaterial({ map: TX.rug2 }),
    rug3:     new THREE.MeshLambertMaterial({ map: TX.rug3 }),

    wall:     new THREE.MeshLambertMaterial({ color: 0xefe4ce }),
    wainscot: new THREE.MeshLambertMaterial({ color: 0xf8f2e4 }),
    trim:     new THREE.MeshLambertMaterial({ color: 0xfdf8ec }),
    ceiling:  new THREE.MeshLambertMaterial({ color: 0xfaf5ea }),

    gold:     new THREE.MeshPhongMaterial({ color: 0xc9a227, specular: 0xfff0b0, shininess: 150 }),
    brass:    new THREE.MeshPhongMaterial({ color: 0xb08d3a, shininess: 120 }),
    darkWood: new THREE.MeshPhongMaterial({ map: TX.woodS, color: 0x9a7350, shininess: 55 }),
    marbleW:  new THREE.MeshPhongMaterial({ map: TX.marbleS, shininess: 115, specular: 0x777777 }),

    velvetGold: new THREE.MeshLambertMaterial({ color: 0xb99a4e }),
    velvetBurg: new THREE.MeshLambertMaterial({ color: 0x6e2029 }),
    velvetTeal: new THREE.MeshLambertMaterial({ color: 0x1e514d }),
    cream:      new THREE.MeshLambertMaterial({ color: 0xe9dcc2 }),
    leather:    new THREE.MeshPhongMaterial({ color: 0x5a3a24, shininess: 45, specular: 0x2a1a10 }),
    leatherDark:new THREE.MeshPhongMaterial({ color: 0x37241a, shininess: 35 }),
    curtain:    new THREE.MeshLambertMaterial({ color: 0xd8c9a8 }),
    curtainBurg:new THREE.MeshLambertMaterial({ color: 0x7a2830 }),

    glass:   new THREE.MeshPhongMaterial({ color: 0x9fc8dd, transparent: true, opacity: 0.32, shininess: 220, specular: 0xffffff }),
    crystal: new THREE.MeshPhongMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.82, shininess: 260, specular: 0xffffff }),
    mirror:  new THREE.MeshPhongMaterial({ color: 0x93a8b5, shininess: 250, specular: 0xffffff }),
    black:   new THREE.MeshLambertMaterial({ color: 0x161616 }),
    stone:   new THREE.MeshLambertMaterial({ color: 0xcfc3ab }),
    fire:    new THREE.MeshBasicMaterial({ color: 0xff7a2a }),
    sky:     new THREE.MeshBasicMaterial({ color: 0xa9d6f2 }),

    plant:     new THREE.MeshLambertMaterial({ color: 0x2f7a35 }),
    plantDark: new THREE.MeshLambertMaterial({ color: 0x225c28 }),
    pot:       new THREE.MeshLambertMaterial({ color: 0x8a5a3c }),

    bookA: new THREE.MeshLambertMaterial({ color: 0x8c2b2b }),
    bookB: new THREE.MeshLambertMaterial({ color: 0x2b5a8c }),
    bookC: new THREE.MeshLambertMaterial({ color: 0x2f6b3a }),
    bookD: new THREE.MeshLambertMaterial({ color: 0xc9a227 }),
    bookE: new THREE.MeshLambertMaterial({ color: 0x6b4a2f }),
    bookF: new THREE.MeshLambertMaterial({ color: 0x4a3a5a }),
  };

  /* ═══════════════════════════════════════════════════════════
     BUILDER + COLLIDERS
     ═══════════════════════════════════════════════════════════ */
  const _e = new THREE.Euler(), _q = new THREE.Quaternion(),
        _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  function m4(x, y, z, ry = 0, rx = 0, rz = 0) {
    _e.set(rx, ry, rz, "YXZ");
    _q.setFromEuler(_e);
    _p.set(x, y, z); _s.set(1, 1, 1);
    return new THREE.Matrix4().compose(_p, _q, _s);
  }

  const NO_COLLIDE = new Set([
    "floor", "floorWood", "carpet", "rug1", "rug2", "rug3",
    "ceiling", "glass", "crystal", "fire", "mirror", "sky"
  ]);

  const colliders = [];

  class Builder {
    constructor() { this.bags = new Map(); this.noCollide = false; this.level = 0; }

    push(key, geo, mat) {
      geo.applyMatrix4(mat);
      let a = this.bags.get(key);
      if (!a) { a = []; this.bags.set(key, a); }
      a.push(geo);

      if (!this.noCollide && !NO_COLLIDE.has(key)) {
        geo.computeBoundingBox();
        const bb = geo.boundingBox;
        colliders.push({
          minX: bb.min.x, maxX: bb.max.x,
          minZ: bb.min.z, maxZ: bb.max.z,
          y0: bb.min.y, y1: bb.max.y,
          level: this.level,
        });
      }
    }

    box(key, w, h, d, x, y, z, ry = 0) {
      this.push(key, new THREE.BoxGeometry(w, h, d), m4(x, y, z, ry));
    }
    cyl(key, rt, rb, h, seg, x, y, z, ry = 0) {
      this.push(key, new THREE.CylinderGeometry(rt, rb, h, seg, 1), m4(x, y, z, ry));
    }
    sph(key, r, ws, hs, x, y, z) {
      this.push(key, new THREE.SphereGeometry(r, ws, hs), m4(x, y, z));
    }

    build() {
      const g = new THREE.Group();
      for (const [k, arr] of this.bags) {
        const merged = mergeGeometries(arr, false);
        arr.forEach(x => x.dispose());
        if (!merged) { console.warn("merge failed:", k); continue; }
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, M[k] || M.trim);
        mesh.castShadow    = !["glass", "crystal", "mirror", "fire"].includes(k);
        mesh.receiveShadow = !["glass", "crystal", "fire"].includes(k);
        mesh.matrixAutoUpdate = false;
        g.add(mesh);
      }
      this.bags.clear();
      return g;
    }
  }

  /* ═══════════════════════════════════════════════════════════
     ROOM SHELLS
     Floor plan (top-down, +Z is SOUTH, front of mansion):

       ┌─────────────────────┬──────────────┐
       │  LIVING  (-14, -6)  │ DINING (14,-6)│
       ├─────────────────────┼──────────────┤
       │  STUDY   (-14, 6)   │ BEDROOM(14,6) │
       ├───────────┬─────────┴──────────────┤
       │  LIBRARY  │      GRAND FOYER       │
       │ (-24,22)  │      (0, 22)           │
       └───────────┴────────────────────────┘
                    ▲
                    │  front doors
                    │  (z = +30)
     ═══════════════════════════════════════════════════════════ */

  const H = 8.4;
  const WT = 0.3;
  const DOOR_H = 4.6;   /* doorway height; wall above it is a header */

  /* build a single rectangular room with doors on any side */
  function shell(B, cx, cz, w, d, opts = {}) {
    const floorKey = opts.floorKey || "floor";
    const doors = opts.doors || {};

    B.box(floorKey, w, 0.3, d, cx, -0.15, cz);
    B.box("ceiling", w, 0.3, d, cx, H + 0.15, cz);

    const sides = [
      { k: "N", x: cx,         z: cz - d / 2, len: w, rotY: 0 },
      { k: "S", x: cx,         z: cz + d / 2, len: w, rotY: Math.PI },
      { k: "W", x: cx - w / 2, z: cz,         len: d, rotY: Math.PI / 2 },
      { k: "E", x: cx + w / 2, z: cz,         len: d, rotY: -Math.PI / 2 },
    ];

    for (const s of sides) {
      const gaps = doors[s.k] || [];
      if (!gaps.length) {
        B.box("wall", s.len + 0.6, H, WT, s.x, H / 2, s.z, s.rotY);
        continue;
      }
      gaps.sort((a, b) => a[0] - b[0]);
      let cur = -s.len / 2 - WT / 2;   /* extend past the corner so no light leaks */
      for (const [a, b, dhx] of gaps) {
        const dh = dhx || DOOR_H;
        /* header above each doorway so it reads as a door, not a missing wall */
        {
          const hl = b - a, hm = (a + b) / 2;
          const hx = s.x + hm * Math.cos(s.rotY), hz = s.z - hm * Math.sin(s.rotY);
          const hh = H - dh;
          const was = B.noCollide; B.noCollide = true;
          B.box("wall", hl, hh, WT, hx, dh + hh / 2, hz, s.rotY);
          B.box("trim", hl + 0.3, 0.22, WT + 0.12, hx, dh - 0.11, hz, s.rotY);
          B.noCollide = was;
        }
        if (a > cur) {
          const l = a - cur;
          const mx = cur + l / 2;
          const px = s.x + mx * Math.cos(s.rotY);
          const pz = s.z - mx * Math.sin(s.rotY);
          B.box("wall", l, H, WT, px, H / 2, pz, s.rotY);
        }
        cur = b;
      }
      if (cur < s.len / 2 + WT / 2) {
        const l = s.len / 2 + WT / 2 - cur;
        const mx = cur + l / 2;
        const px = s.x + mx * Math.cos(s.rotY);
        const pz = s.z - mx * Math.sin(s.rotY);
        B.box("wall", l, H, WT, px, H / 2, pz, s.rotY);
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════
     FURNITURE (kept compact — enough to read each room)
     ═══════════════════════════════════════════════════════════ */
  function fr(x, z, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    return (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  }

  function sofa(B, x, z, ang, w, d, key, cush) {
    const F = fr(x, z, ang);
    const P = (k, sw, sh, sd, lx, ly, lz) => {
      const p = F(lx, lz);
      B.box(k, sw, sh, sd, p[0], ly, p[1], ang);
    };
    P(key, w, 0.42, d, 0, 0.46, 0);
    P(key, w, 0.98, 0.32, 0, 0.95, -d / 2 + 0.16);
    P(key, 0.34, 0.74, d, -w / 2 + 0.17, 0.80, 0);
    P(key, 0.34, 0.74, d,  w / 2 - 0.17, 0.80, 0);
    const n = Math.max(2, Math.round(w / 1.6));
    const cw = (w - 0.72) / n;
    for (let i = 0; i < n; i++) {
      const lx = -(w - 0.72) / 2 + cw * (i + 0.5);
      P(cush, cw - 0.08, 0.28, d - 0.44, lx, 0.80, 0.08);
      P(cush, cw - 0.10, 0.60, 0.20, lx, 1.16, -d / 2 + 0.40);
    }
  }

  function table(B, x, z, ang, w = 3, d = 1.6, h = 0.95, keyTop = "marbleW") {
    const F = fr(x, z, ang);
    const P = (k, sw, sh, sd, lx, ly, lz) => {
      const p = F(lx, lz);
      B.box(k, sw, sh, sd, p[0], ly, p[1], ang);
    };
    P(keyTop, w, 0.14, d, 0, h, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      P("darkWood", 0.12, h, 0.12, sx * (w / 2 - 0.2), h / 2, sz * (d / 2 - 0.2));
  }

  function chair(B, x, z, ang, key, cush) {
    const F = fr(x, z, ang);
    const P = (k, sw, sh, sd, lx, ly, lz) => {
      const p = F(lx, lz);
      B.box(k, sw, sh, sd, p[0], ly, p[1], ang);
    };
    P(key, 0.64, 0.12, 0.64, 0, 0.52, 0);
    P(cush, 0.58, 0.10, 0.58, 0, 0.60, 0);
    P(key, 0.64, 0.82, 0.11, 0, 0.98, -0.27);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      P(key, 0.09, 0.52, 0.09, sx * 0.26, 0.26, sz * 0.26);
  }

  function bookshelf(B, x, z, ang, w, h, depth, shelves) {
    const F = fr(x, z, ang);
    const P = (k, sw, sh, sd, lx, ly, lz) => {
      const p = F(lx, lz);
      B.box(k, sw, sh, sd, p[0], ly, p[1], ang);
    };
    P("darkWood", 0.18, h, depth, -w / 2, h / 2, 0);
    P("darkWood", 0.18, h, depth,  w / 2, h / 2, 0);
    P("darkWood", w, 0.16, depth, 0, h - 0.08, 0);
    P("darkWood", w, 0.24, depth, 0, 0.12, 0);
    P("darkWood", w, h, 0.10, 0, h / 2, -depth / 2 + 0.05);

    const sh = (h - 0.4) / shelves;
    for (let i = 1; i < shelves; i++)
      P("darkWood", w - 0.22, 0.08, depth - 0.12, 0, 0.24 + i * sh, 0);

    const keys = ["bookA", "bookB", "bookC", "bookD", "bookE", "bookF"];
    for (let i = 0; i < shelves; i++) {
      const yy = 0.28 + i * sh;
      let bx = -w / 2 + 0.28;
      const end = w / 2 - 0.28;
      let cnt = 0;
      while (bx < end - 0.2 && cnt < (LOW ? 8 : 14)) {
        const bw = 0.10 + Math.random() * 0.13;
        const bh = sh * 0.52 + Math.random() * sh * 0.30;
        if (bx + bw > end) break;
        P(keys[(Math.random() * 6) | 0], bw, bh, depth * 0.70, bx + bw / 2, yy + bh / 2, 0.04);
        bx += bw + 0.022;
        cnt++;
      }
    }
  }

  function bed(B, x, z, ang, w = 6.4) {
    const F = fr(x, z, ang);
    const P = (k, sw, sh, sd, lx, ly, lz) => {
      const p = F(lx, lz);
      B.box(k, sw, sh, sd, p[0], ly, p[1], ang);
    };
    const L = 7.6;
    P("darkWood", w + 0.5, 0.5, L + 0.4, 0, 0.25, 0);
    P("cream", w, 0.55, L, 0, 0.78, 0);
    P("cream", w + 0.34, 0.26, L * 0.70, 0, 1.06, L * 0.10);
    P("velvetGold", w + 0.7, 3.5, 0.36, 0, 2.05, -L / 2 - 0.16);
    for (let i = 0; i < 5; i++)
      P("cream", w * 0.17, 0.52, 0.86, -(w * 0.36) + i * (w * 0.18), 1.33, -L / 2 + 0.72);
  }

  function plant(B, x, z, s = 1, oy = 0) {
    B.cyl("pot", 0.58 * s, 0.44 * s, 0.88 * s, 10, x, oy + 0.44 * s, z);
    B.cyl("pot", 0.64 * s, 0.64 * s, 0.10 * s, 10, x, oy + 0.90 * s, z);
    B.cyl("plantDark", 0.09 * s, 0.12 * s, 1.2 * s, 5, x, oy + 1.45 * s, z);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      B.sph(i % 2 ? "plant" : "plantDark", 0.54 * s, 5, 4,
        x + Math.cos(a) * 0.52 * s, oy + 1.95 * s + (i % 2) * 0.36 * s, z + Math.sin(a) * 0.52 * s);
    }
    B.sph("plant", 0.70 * s, 6, 5, x, oy + 2.40 * s, z);
  }

  function column(B, x, z, r, h) {
    B.box("marbleW", r * 3.0, 0.26, r * 3.0, x, 0.13, z);
    B.cyl("marbleW", r, r * 1.08, h - 0.94, LOW ? 10 : 14, x, 0.44 + (h - 0.94) / 2, z);
    B.box("marbleW", r * 2.6, 0.22, r * 2.6, x, h - 0.39, z);
  }

  function chandelier(B, x, y, z, s, ceilY) {
    const chain = Math.max(0.6, ceilY - y - 0.5 * s);
    B.cyl("gold", 0.05 * s, 0.05 * s, chain, 6, x, y + 0.3 * s + chain / 2, z);
    B.cyl("gold", 0.92 * s, 0.92 * s, 0.10 * s, 12, x, y + 0.28 * s, z);

    const n1 = LOW ? 8 : 12;
    for (let i = 0; i < n1; i++) {
      const a = i / n1 * Math.PI * 2;
      const px = x + Math.cos(a) * 1.5 * s, pz = z + Math.sin(a) * 1.5 * s;
      B.cyl("trim", 0.075 * s, 0.075 * s, 0.44 * s, 6, px, y + 0.30 * s, pz);
      B.sph("crystal", 0.10 * s, 5, 4, px, y - 0.14 * s, pz);
    }
    B.sph("crystal", 0.26 * s, 8, 6, x, y - 0.74 * s, z);

    const pl = new THREE.PointLight(0xffe0b0, LOW ? 22 : 32, 30, 1.6);
    pl.position.set(x, y - 0.2 * s, z);
    return pl;
  }

  /* ═══════════════════════════════════════════════════════════
     BUILD ROOMS
     ═══════════════════════════════════════════════════════════ */
  const B = new Builder();
  const pointLights = [];

  /* ── Room dimensions ── */
  const ROOMS = {
    /* North wing now ends exactly at z = 0 where the study / bedroom begin,
       so there are no overlapping rooms, double walls or z-fighting floors. */
    living:  { cx: -14, cz: -7.5, w: 22, d: 15 },
    dining:  { cx:  14, cz: -7.5, w: 22, d: 15 },
    study:   { cx: -14, cz:  6, w: 22, d: 12 },
    bedroom: { cx:  14, cz:  6, w: 22, d: 12 },
    foyer:   { cx:   0, cz: 22, w: 30, d: 20 },
    library: { cx: -22, cz: 22, w: 14, d: 20 },
  };

  /* ── Foyer staircase geometry (shared by visuals, colliders, ramp) ── */
  const STAIR_STEPS = 14, STAIR_RISE = 0.32, STAIR_RUN = 0.5, STAIR_W = 5.6;
  const STAIR_H = STAIR_STEPS * STAIR_RISE;                  // 4.48 m
  const FOYER_NORTH = ROOMS.foyer.cz - ROOMS.foyer.d / 2 + WT / 2;   // inner face of the north wall
  const PODIUM_W = 12, PODIUM_D = 2.5;
  const PODIUM_Z0 = FOYER_NORTH, PODIUM_Z1 = PODIUM_Z0 + PODIUM_D;
  const STAIR_Z_BACK = PODIUM_Z1;                            // top of the flight
  const STAIR_Z_FRONT = STAIR_Z_BACK + STAIR_STEPS * STAIR_RUN;   // bottom of the flight

  /* ── Shells with doorways on shared walls ── */
  // Living (NW) — door on S wall toward Study, E wall toward Dining
  shell(B, ROOMS.living.cx, ROOMS.living.cz, ROOMS.living.w, ROOMS.living.d, {
    floorKey: "floorWood",
    doors: {
      S: [[-2.5, 2.5]],   // to study
      E: [[-2.5, 2.5]],   // to dining
    }
  });

  // Dining (NE) — door on S wall toward Bedroom, W wall toward Living
  shell(B, ROOMS.dining.cx, ROOMS.dining.cz, ROOMS.dining.w, ROOMS.dining.d, {
    floorKey: "floorWood",
    doors: {
      S: [[-2.5, 2.5]],
      W: [[-2.5, 2.5]],
    }
  });

  // Study (SW) — door on N wall toward Living, S wall toward Foyer, E wall toward Bedroom
  shell(B, ROOMS.study.cx, ROOMS.study.cz, ROOMS.study.w, ROOMS.study.d, {
    floorKey: "floorWood",
    doors: {
      N: [[-2.5, 2.5]],
      S: [[-7, -4]],      // world x -10..-7: lines up with foyer N doorway (S side is mirrored)
      E: [[-2.5, 2.5]],
    }
  });

  // Bedroom (SE) — door on N wall toward Dining, W wall toward Study, S wall toward Foyer
  shell(B, ROOMS.bedroom.cx, ROOMS.bedroom.cz, ROOMS.bedroom.w, ROOMS.bedroom.d, {
    floorKey: "carpet",
    doors: {
      N: [[-2.5, 2.5]],
      W: [[-2.5, 2.5]],
      S: [[4, 7]],        // world x 7..10: lines up with foyer N doorway
    }
  });

  // Foyer (centre-south) — doors on N (to Study + Bedroom via corridor), W (to Library), S (front doors)
  shell(B, ROOMS.foyer.cx, ROOMS.foyer.cz, ROOMS.foyer.w, ROOMS.foyer.d, {
    floorKey: "floor",
    doors: {
      N: [[-10, -7], [-3, 3, 7.2], [7, 10]],   // study + bedroom doorways; centre opens (above the podium) onto the upper gallery
      W: [[-2.5, 2.5]],         // to Library
      S: [[-2.5, 2.5]],         // front doors
    }
  });

  // Library (W of Foyer) — door on E wall toward Foyer
  shell(B, ROOMS.library.cx, ROOMS.library.cz, ROOMS.library.w, ROOMS.library.d, {
    floorKey: "floorWood",
    doors: {
      E: [[-2.5, 2.5]],
    }
  });

  /* ── CENTRAL GALLERY (two storeys) ─────────────────────────
     Ground: marble gallery linking the four wing doorways.
     Upper: reached by the grand staircase; a portrait gallery that ends in the
     Governor's private study. Level 1 is a separate collision level so the
     ground gallery stays walkable underneath. */
  const UY = STAIR_H;                       // upper floor height
  const STUDY_H = 9.0;
  const upperSeats = [], upperUses = [];
  {
    const GX = 0, GZ = -1.5, GW = 6, GD = 27;       // x -3..3, z -15..12
    B.box("floor", GW, 0.3, GD, GX, -0.15, GZ);                 // ground floor
    B.box("ceiling", GW, 0.3, GD, GX, H + 0.15, GZ);
    B.box("wall", GW + 0.6, UY, WT, GX, UY / 2, GZ - GD / 2);   // ground north end
    B.noCollide = true;
    B.box("floor", GW, 0.3, GD + 0.3, GX, UY - 0.15, GZ + 0.15);  // upper floor slab (underside = ground ceiling)
    B.box("marbleW", 2.6, 0.02, GD - 2, GX, 0.011, GZ);           // ground runner
    B.box("rug1", 2.6, 0.02, GD - 4, GX, UY + 0.011, GZ - 1);     // upper runner
    for (let i = 0; i < 4; i++) {
      const pz = -11.5 + i * 7;
      for (const sx of [-1, 1]) {
        B.box("gold", 0.06, 2.0, 1.7, GX + sx * 2.9, 2.5, pz);          // ground portraits
        B.box("velvetBurg", 0.04, 1.7, 1.4, GX + sx * 2.87, 2.5, pz);
        B.box("gold", 0.06, 2.2, 1.9, GX + sx * 2.9, UY + 2.4, pz);     // upper portraits
        B.box("velvetTeal", 0.04, 1.9, 1.6, GX + sx * 2.87, UY + 2.4, pz);
      }
    }
    B.noCollide = false;
    // upper north wall: solid piers either side of a doorway into the study
    B.level = 1;
    for (const sx of [-1, 1]) B.box("wall", 1.3, H - UY, WT, sx * 2.65, (UY + H) / 2, GZ - GD / 2);
    B.noCollide = true;
    B.box("wall", 4.0, H - 7.2, WT, 0, (7.2 + H) / 2, GZ - GD / 2);
    B.noCollide = false;
    B.level = 0;
    for (const pz of [-12.5, 9.5]) { plant(B, GX - 2.1, pz, 1.0); plant(B, GX + 2.1, pz, 1.0); }
    B.level = 1;
    for (const pz of [-12.5, 9.0]) { plant(B, GX - 2.1, pz, 1.0, UY); plant(B, GX + 2.1, pz, 1.0, UY); }
    B.level = 0;
    for (const lz of [-10, 2]) {                                // ground-gallery lamps
      const l = new THREE.PointLight(0xffe2b0, 0.85, 16, 2);
      l.position.set(0, 3.2, lz); pointLights.push(l);
    }
    pointLights.push(chandelier(B, GX, 7.0, -8, 0.9, H));       // upper chandeliers
    pointLights.push(chandelier(B, GX, 7.0, 3, 0.9, H));
    // level-1 fences: gallery side walls, podium back wall (either side of the opening)
    for (const sx of [-1, 1]) {
      colliders.push({ minX: sx * 3 - 0.2, maxX: sx * 3 + 0.2, minZ: -15.2, maxZ: 12.2, y0: UY, y1: UY + 3, level: 1 });
      colliders.push({ minX: Math.min(sx * 3, sx * 6.3), maxX: Math.max(sx * 3, sx * 6.3), minZ: 11.8, maxZ: 12.2, y0: UY, y1: UY + 3, level: 1 });
    }

    /* ── GOVERNOR'S PRIVATE STUDY (upper level, north of the gallery) ── */
    const Z0 = -29, Z1 = -15, CZ = (Z0 + Z1) / 2, SD = Z1 - Z0, hh = STUDY_H - UY;
    B.level = 1;
    B.noCollide = true;
    B.box("floorWood", 18.6, 0.3, SD + 0.6, 0, UY - 0.15, CZ);
    B.box("ceiling", 18.6, 0.3, SD + 0.6, 0, STUDY_H + 0.15, CZ);
    B.box("rug2", 9, 0.02, 6, 0, UY + 0.011, -22);
    B.box("sky", 10, 2.6, 0.05, 0, UY + 2.6, Z0 + 0.2);                // window view
    B.box("gold", 10.3, 0.12, 0.1, 0, UY + 3.95, Z0 + 0.22); B.box("gold", 10.3, 0.12, 0.1, 0, UY + 1.25, Z0 + 0.22);
    for (const sx of [-5.15, 0, 5.15]) B.box("gold", 0.1, 2.8, 0.1, sx, UY + 2.6, Z0 + 0.22);
    for (const sx of [-1, 1]) B.box("curtainBurg", 0.9, 3.4, 0.2, sx * 5.9, UY + 2.4, Z0 + 0.35);
    B.box("gold", 3.1, 1.9, 0.1, 0, UY + 3.1, Z0 + 0.2);               // portrait over the desk
    B.box("velvetBurg", 2.8, 1.6, 0.06, 0, UY + 3.1, Z0 + 0.26);
    B.noCollide = false;
    B.box("wall", 18.6, hh, WT, 0, UY + hh / 2, Z0);                    // N
    for (const sx of [-1, 1]) {
      B.box("wall", WT, hh, SD + 0.3, sx * 9.3, UY + hh / 2, CZ);       // W / E
      B.box("wall", 6.3, hh, WT, sx * 6.15, UY + hh / 2, Z1);           // S piers beside the doorway
    }
    B.noCollide = true;
    B.box("wall", 4.0, STUDY_H - 7.2, WT, 0, (7.2 + STUDY_H) / 2, Z1);
    B.noCollide = false;
    // desk, chair, shelves, sofas, table, globe
    B.box("darkWood", 3.4, 0.12, 1.3, 0, UY + 0.95, -26.4);
    for (const sx of [-1, 1]) B.box("darkWood", 0.15, 0.9, 1.2, sx * 1.55, UY + 0.45, -26.4);
    B.box("darkWood", 3.0, 0.7, 0.08, 0, UY + 0.6, -26.85);
    B.box("leather", 0.75, 0.12, 0.75, 0, UY + 0.5, -24.9);
    B.box("leather", 0.75, 0.9, 0.12, 0, UY + 0.95, -24.5);
    B.box("leather", 0.75, 0.48, 0.75, 0, UY + 0.24, -24.9);
    for (const sx of [-1, 1]) {
      B.box("darkWood", 0.5, 3.6, 7.0, sx * 8.6, UY + 1.8, -23);
      ["bookA", "bookB", "bookC", "bookD", "bookE"].forEach((k, r) => {
        const o = B.noCollide; B.noCollide = true;
        B.box(k, 0.3, 0.38, 6.4, sx * 8.28, UY + 0.5 + r * 0.66, -23);
        B.noCollide = o;
      });
      // sofa facing the middle of the room
      B.box("velvetTeal", 1.0, 0.5, 3.2, sx * 5.4, UY + 0.45, -19.3);
      B.box("velvetTeal", 0.28, 0.9, 3.2, sx * 5.95, UY + 0.75, -19.3);
      B.box("gold", 0.1, 0.1, 3.2, sx * 5.96, UY + 1.22, -19.3);
      upperSeats.push({ type: "sit", label: "SIT · STUDY SOFA", x: sx * 5.3, z: -19.3, dx: -sx, dz: 0, yaw: Math.atan2(-sx, 0), h: UY + 0.5, level: 1, taken: false });
    }
    B.box("darkWood", 1.5, 0.08, 1.0, 0, UY + 0.45, -19.3);
    B.box("darkWood", 1.2, 0.4, 0.7, 0, UY + 0.2, -19.3);
    B.sph("brass", 0.42, 14, 10, -7.0, UY + 1.15, -27.4);
    B.cyl("gold", 0.12, 0.2, 0.6, 8, -7.0, UY + 0.3, -27.4);
    pointLights.push(chandelier(B, 0, 7.6, -21, 0.95, STUDY_H));
    const sl = new THREE.PointLight(0xffe8c0, 0.8, 22, 2); sl.position.set(0, UY + 3.4, -22); pointLights.push(sl);
    B.level = 0;
    upperSeats.push({ type: "sit", label: "SIT · GOVERNOR'S DESK", x: 0, z: -24.9, dx: 0, dz: -1, yaw: Math.PI, h: UY + 0.5, level: 1, taken: false });
    upperUses.push({ kind: "desk", label: "GOVERNOR'S DESK · CLASSIFIED FILES", x: 0, y: UY, z: -25.8, level: 1, r: 2.2 });
    // study fences: nothing else needed (walls collide); keep players off the window edge
  }

  /* ── FURNISH: FOYER ──────────────────────────────────── */
  {
    const F = ROOMS.foyer;
    // marble medallion (decor only: no collider, so it can't lift the player)
    B.noCollide = true;
    B.cyl("marbleW", 4.5, 4.5, 0.03, 40, F.cx, 0.015, F.cz);
    B.noCollide = false;
    // grand staircase: a solid podium against the north wall + a 5.6 m flight
    {
      const steps = STAIR_STEPS, sh = STAIR_RISE, sd = STAIR_RUN;
      /* The flight is visual only (walking is handled by world.stairs) so the
         step boxes never snag the player; side rails + the podium collider keep
         the player on the lane. */
      B.noCollide = true;
      for (let i = 0; i < steps; i++) {
        B.box("marbleW", STAIR_W, sh * (i + 1), sd, F.cx, sh * (i + 1) / 2, STAIR_Z_FRONT - sd * (i + 0.5));
      }
      B.noCollide = false;
      // podium: solid mass, collider spans ground..top so nobody walks into / under it
      B.box("marbleW", PODIUM_W, STAIR_H, PODIUM_D, F.cx, STAIR_H / 2, PODIUM_Z0 + PODIUM_D / 2);
      B.noCollide = true;
      B.box("trim", PODIUM_W + 0.2, 0.02, PODIUM_D + 0.2, F.cx, STAIR_H + 0.005, PODIUM_Z0 + PODIUM_D / 2);
      // balustrades: gold rail + posts on podium front edge (either side of the flight)
      for (const sx of [-1, 1]) {
        const x0 = sx * (STAIR_W / 2 + 0.1), x1 = sx * PODIUM_W / 2;
        const len = Math.abs(x1 - x0), cx = (x0 + x1) / 2 + F.cx;
        B.box("gold", len, 0.10, 0.12, cx, STAIR_H + 1.05, PODIUM_Z1 - 0.12);
        for (let k = 0; k <= Math.round(len / 0.9); k++) {
          const px = F.cx + x0 + (x1 - x0) * (k / Math.max(1, Math.round(len / 0.9)));
          B.box("marbleW", 0.12, 1.0, 0.12, px, STAIR_H + 0.55, PODIUM_Z1 - 0.12);
        }
        // side rail on the podium end
        B.box("gold", 0.12, 0.10, PODIUM_D - 0.2, F.cx + sx * (PODIUM_W / 2 - 0.12), STAIR_H + 1.05, PODIUM_Z0 + PODIUM_D / 2);
        // stair rails: stepped posts + slanted handrail
        for (let i = 0; i < steps; i += 2) {
          B.box("marbleW", 0.10, 1.0, 0.10, F.cx + sx * (STAIR_W / 2 - 0.05), sh * (i + 1) + 0.5, STAIR_Z_FRONT - sd * (i + 0.5));
        }
        const rise = Math.atan2(STAIR_H, STAIR_Z_FRONT - STAIR_Z_BACK);
        const rl = Math.hypot(STAIR_H, STAIR_Z_FRONT - STAIR_Z_BACK);
        B.push("gold", new THREE.BoxGeometry(0.10, 0.10, rl),
               m4(F.cx + sx * (STAIR_W / 2 - 0.05), STAIR_H / 2 + 1.0, (STAIR_Z_FRONT + STAIR_Z_BACK) / 2, 0, rise, 0));
      }
      // two flags + portrait over the landing (decor)
      B.box("gold", 5.2, 3.2, 0.12, F.cx, STAIR_H + 3.2, PODIUM_Z0 - 0.02);
      B.box("velvetBurg", 4.8, 2.8, 0.08, F.cx, STAIR_H + 3.2, PODIUM_Z0 + 0.04);
      for (const sx of [-1, 1]) {
        B.box("plant", 0.7, 2.4, 0.06, F.cx + sx * 4.6, STAIR_H + 3.0, PODIUM_Z0 + 0.1);
        B.box("trim", 0.7, 2.4, 0.06, F.cx + sx * 4.6 + sx * 0.7, STAIR_H + 3.0, PODIUM_Z0 + 0.1);
        B.box("plant", 0.7, 2.4, 0.06, F.cx + sx * 4.6 + sx * 1.4, STAIR_H + 3.0, PODIUM_Z0 + 0.1);
      }
      B.noCollide = false;
    }
    // flanking columns
    for (const s of [-1, 1]) {
      column(B, F.cx + s * 8.2, F.cz - 1.6, 0.52, 7.4);
    }
    // Entrance double doors are shown swung open.  The previous single
    // full-width slab visually filled the doorway and its collider trapped
    // players inside even though the exit interaction was reachable.
    {
      const was = B.noCollide; B.noCollide = true;
      B.box("darkWood", 2.25, 4.85, 0.18, F.cx - 1.12, 2.42, F.cz + 9.78, -0.62);
      B.box("darkWood", 2.25, 4.85, 0.18, F.cx + 1.12, 2.42, F.cz + 9.78,  0.62);
      B.box("gold", 0.07, 4.65, 0.22, F.cx - 1.95, 2.42, F.cz + 9.25, -0.62);
      B.box("gold", 0.07, 4.65, 0.22, F.cx + 1.95, 2.42, F.cz + 9.25,  0.62);
      B.box("gold", 0.10, 0.10, 0.10, F.cx - 0.42, 2.45, F.cz + 9.52);
      B.box("gold", 0.10, 0.10, 0.10, F.cx + 0.42, 2.45, F.cz + 9.52);
      B.noCollide = was;
    }
    // side consoles
    B.box("marbleW", 0.9, 1.05, 3.0, F.cx - 13.4, 0.525, F.cz);
    B.box("marbleW", 0.9, 1.05, 3.0, F.cx + 13.4, 0.525, F.cz);
    // plants
    plant(B, F.cx - 11.0, F.cz - 7.0, 1.1);
    plant(B, F.cx + 11.0, F.cz - 7.0, 1.1);
    // chandeliers
    pointLights.push(chandelier(B, F.cx, 5.2, F.cz, 1.15, H));
    pointLights.push(chandelier(B, F.cx, 5.2, F.cz - 3.5, 0.85, H));
  }

  /* ── FURNISH: LIVING ─────────────────────────────────── */
  {
    const R = ROOMS.living;
    B.box("rug1", 14, 0.02, 11, R.cx, 0.011, R.cz);
    sofa(B, R.cx, R.cz - 3.8, 0, 6.4, 2.3, "velvetTeal", "cream");
    sofa(B, R.cx, R.cz + 3.8, Math.PI, 6.4, 2.3, "velvetTeal", "cream");
    sofa(B, R.cx - 6.6, R.cz, Math.PI / 2, 1.75, 1.55, "velvetGold", "cream");
    sofa(B, R.cx + 6.6, R.cz, -Math.PI / 2, 1.75, 1.55, "velvetGold", "cream");
    table(B, R.cx, R.cz, 0, 4.6, 2.6, 0.95);
    plant(B, R.cx - 9.6, R.cz - 6.2, 1.2);
    plant(B, R.cx + 9.6, R.cz + 6.2, 1.2);
    pointLights.push(chandelier(B, R.cx, 5.4, R.cz, 1.0, H));
  }

  /* ── FURNISH: DINING ─────────────────────────────────── */
  {
    const R = ROOMS.dining;
    B.box("rug2", 18, 0.02, 11, R.cx, 0.011, R.cz);
    // long table
    B.box("darkWood", 13, 0.18, 3.4, R.cx, 1.55, R.cz);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      B.box("darkWood", 0.26, 1.37, 0.26, R.cx + sx * 5.8, 0.685, R.cz + sz * 1.2);
    // chairs
    for (let i = 0; i < 5; i++) {
      const cx = R.cx - 4.4 + i * 2.2;
      chair(B, cx, R.cz - 2.4, 0, "darkWood", "velvetBurg");
      chair(B, cx, R.cz + 2.4, Math.PI, "darkWood", "velvetBurg");
    }
    // sideboard on N wall
    B.box("darkWood", 9.0, 2.0, 1.4, R.cx, 1.0, R.cz - R.d / 2 + 1.3);
    B.box("marbleW", 9.4, 0.14, 1.7, R.cx, 2.07, R.cz - R.d / 2 + 1.3);
    plant(B, R.cx - 9.6, R.cz + 6.2, 1.15);
    plant(B, R.cx + 9.6, R.cz - 6.2, 1.15);
    pointLights.push(chandelier(B, R.cx - 4.6, 5.6, R.cz, 0.9, H));
    pointLights.push(chandelier(B, R.cx + 4.6, 5.6, R.cz, 0.9, H));
  }

  /* ── FURNISH: STUDY ──────────────────────────────────── */
  {
    const R = ROOMS.study;
    B.box("rug3", 12, 0.02, 8, R.cx, 0.011, R.cz + 0.5);
    // desk
    B.box("darkWood", 7.2, 0.16, 3.0, R.cx, 1.5, R.cz + 1.0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      B.box("darkWood", 0.24, 1.34, 0.24, R.cx + sx * 3.2, 0.67, R.cz + 1.0 + sz * 1.1);
    chair(B, R.cx, R.cz + 3.2, Math.PI, "leatherDark", "leather");
    // bookshelves on north + west wall
    bookshelf(B, R.cx, R.cz - R.d / 2 + 1.1, 0, 10.5, 7.2, 1.5, LOW ? 4 : 5);
    bookshelf(B, R.cx - R.w / 2 + 1.1, R.cz - 1.0, Math.PI / 2, 8.0, 7.2, 1.5, LOW ? 4 : 5);
    plant(B, R.cx + 9.6, R.cz - 4.4, 1.1);
    pointLights.push(chandelier(B, R.cx, 6.0, R.cz + 1.0, 0.85, H));
  }

  /* ── FURNISH: BEDROOM ────────────────────────────────── */
  {
    const R = ROOMS.bedroom;
    B.box("rug1", 15, 0.02, 10, R.cx, 0.011, R.cz - 0.5);
    // bed against north wall
    bed(B, R.cx, R.cz - 3.4, 0, 6.6);
    // nightstands
    for (const s of [-1, 1]) {
      B.box("darkWood", 1.7, 1.5, 1.5, R.cx + s * 4.7, 0.75, R.cz - 5.6);
      B.box("marbleW", 1.9, 0.10, 1.7, R.cx + s * 4.7, 1.55, R.cz - 5.6);
    }
    // bench at foot of bed
    B.box("velvetGold", 5.4, 0.42, 1.5, R.cx, 0.62, R.cz + 1.0);
    // dresser east wall
    B.box("darkWood", 1.6, 2.3, 6.0, R.cx + R.w / 2 - 1.0, 1.15, R.cz - 1.0);
    plant(B, R.cx - 9.6, R.cz + 4.4, 1.15);
    pointLights.push(chandelier(B, R.cx, 6.2, R.cz - 1.0, 0.9, H));
  }

  /* ── FURNISH: LIBRARY ───────────────────────────────── */
  {
    const R = ROOMS.library;
    B.box("rug2", 10, 0.02, 12, R.cx, 0.011, R.cz);
    bookshelf(B, R.cx, R.cz - R.d / 2 + 1.1, 0, 11.0, 7.4, 1.5, LOW ? 4 : 5);
    bookshelf(B, R.cx - R.w / 2 + 1.1, R.cz - 4.5, Math.PI / 2, 7.0, 7.4, 1.5, LOW ? 4 : 5);
    bookshelf(B, R.cx - R.w / 2 + 1.1, R.cz + 4.5, Math.PI / 2, 7.0, 7.4, 1.5, LOW ? 4 : 5);
    // reading chair + side table
    sofa(B, R.cx + 2.0, R.cz + 2.0, -Math.PI / 2, 1.75, 1.55, "leather", "leather");
    table(B, R.cx + 2.0, R.cz - 1.0, 0, 1.6, 1.2, 0.85);
    plant(B, R.cx - 5.0, R.cz + 8.4, 1.15);
    pointLights.push(chandelier(B, R.cx, 5.8, R.cz, 0.85, H));
  }

  /* ── ADD CHANDELIER + WALL-SCONCE LIGHTS ──────────────── */
  // Fill the room corners instead of leaving only bright pools under
  // chandeliers.  Low-quality devices get fewer, shorter-range lights.
  const sconceSpots = LOW
    ? [[-14,-7.5],[14,-7.5],[0,22],[0,-22]]
    : [[-20,-7.5],[-8,-7.5],[8,-7.5],[20,-7.5],[-20,6],[20,6],[-22,22],[-8,22],[8,22],[22,22],[0,-22]];
  for (const [lx,lz] of sconceSpots) {
    const lamp = new THREE.PointLight(0xffd99a, LOW ? 0.55 : 0.78, LOW ? 10 : 14, 2);
    lamp.position.set(lx, 3.0, lz);
    pointLights.push(lamp);
  }
  pointLights.forEach((pl) => scene.add(pl));

  /* ── MERGE + ADD ─────────────────────────────────────── */
  const mergedRoot = B.build();
  scene.add(mergedRoot);

  /* ═══════════════════════════════════════════════════════════
     STAIRCASE (foyer) + PLATFORMS
     ═══════════════════════════════════════════════════════════ */
  const F = ROOMS.foyer;
  const stairs = [{
    minX: F.cx - STAIR_W / 2, maxX: F.cx + STAIR_W / 2,
    minZ: STAIR_Z_BACK, maxZ: STAIR_Z_FRONT,
    axis: "z", y0: STAIR_H, y1: 0,          // y0 at minZ (top), y1 at maxZ (bottom)
    level: 0, toLevel: 0,
  }];

  /* Colliders: podium body, side rails on the flight, and rails along the
     podium top so you cannot step off the edge (only down the stairs). */
  colliders.push({ minX: F.cx - PODIUM_W / 2, maxX: F.cx + PODIUM_W / 2,
                   minZ: PODIUM_Z0, maxZ: PODIUM_Z1, y0: 0, y1: STAIR_H, level: 0 });
  for (const sx of [-1, 1]) {            // flight rails also bind players already on level 1
    const a = F.cx + sx * (STAIR_W / 2), b = F.cx + sx * (STAIR_W / 2 + 0.25);
    colliders.push({ minX: Math.min(a, b), maxX: Math.max(a, b),
                     minZ: STAIR_Z_BACK, maxZ: STAIR_Z_FRONT, y0: 0.2, y1: STAIR_H + 1.3, level: 1 });
  }
  for (const sx of [-1, 1]) {
    const a = F.cx + sx * (STAIR_W / 2), b = F.cx + sx * (STAIR_W / 2 + 0.25);
    colliders.push({ minX: Math.min(a, b), maxX: Math.max(a, b),
                     minZ: STAIR_Z_BACK, maxZ: STAIR_Z_FRONT, y0: 0.2, y1: STAIR_H + 1.3, level: 0 });
    // podium front rail (either side of the flight) and podium end rail
    const fa = F.cx + sx * (STAIR_W / 2 + 0.1), fb = F.cx + sx * PODIUM_W / 2;
    colliders.push({ minX: Math.min(fa, fb), maxX: Math.max(fa, fb),
                     minZ: PODIUM_Z1 - 0.25, maxZ: PODIUM_Z1, y0: STAIR_H, y1: STAIR_H + 1.3, level: 1 });
    colliders.push({ minX: F.cx + sx * PODIUM_W / 2 - (sx > 0 ? 0.25 : 0), maxX: F.cx + sx * PODIUM_W / 2 + (sx > 0 ? 0 : 0.25),
                     minZ: PODIUM_Z0, maxZ: PODIUM_Z1, y0: STAIR_H, y1: STAIR_H + 1.3, level: 1 });
  }

  /* ═══════════════════════════════════════════════════════════
     INTERACTABLES
     ═══════════════════════════════════════════════════════════ */
  let _ctlRef = null;
  const uses = [...upperUses, {
    kind: "exit-mansion",
    label: "EXIT · BACK TO THE COMPOUND",
    x: F.cx, z: F.cz + 9.2, y: 0, level: 0,
    r: 2.8,
  }];

  /* ═══════════════════════════════════════════════════════════
     WORLD + CONTROLS
     ═══════════════════════════════════════════════════════════ */
  const world = {
    colliders,
    seats: upperSeats,
    uses,
    platforms: [],
    stairs,
    solidFurniture: true,
    levelHeight: (lvl) => (lvl >= 1 ? STAIR_H : 0),
    /* under the upper floor the camera must not rise through it */
    get ceilingHeight() {
      const c = _ctlRef;
      if (!c) return H;
      // The central gallery has an upper floor above the ground level;
      // the upper private study has a lower ceiling at absolute y=9m.
      if (c.level === 0 && Math.abs(c.pos.x) < 3.3 && c.pos.z > -15 && c.pos.z < 12) return STAIR_H - 0.5;
      if (c.level >= 1) return c.pos.z < -15 ? (STUDY_H - STAIR_H) : (H - STAIR_H);
      return H;
    },
    bounds: {
      minX: -32, maxX: 32,
      // The upper private study extends to z=-29; -20 clipped its back half.
      minZ: -31, maxZ: 34,
    },
  };

  /* Player spawns just inside the front doors, facing the staircase. */
  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, world, {
    scene,
    x: F.cx, z: F.cz + 5.5, yaw: Math.PI, level: 0,
    speedMult: 1.15,
    camDist: 5.5,
    onUse: (use) => {
      if (use.kind === "exit-mansion") {
        router.go("governor");
      } else if (window.__ph3d_phone) {
        window.__ph3d_phone._toast(use.label || "USE");
      }
    },
  });

  _ctlRef = ctl;
  window.__ph3d_walkCtrl = ctl;

  /* Spawn NPCs for governor interior */
  try {
    const { spawnInteriorNPCs } = await import("../core/interior-npcs.js");
    spawnInteriorNPCs(scene, "governorInterior", {
      fallback: { role: "walker", x: 0, z: 6 },
    });
  } catch (e) {}

  try {
    NpcTalk.mount({
      getPos: () => ({ x: ctl.pos.x, z: ctl.pos.z }),
      getYaw: () => ctl.yaw,
    });
  } catch (e) {}

  const _govTalkKey = (e) => {
    if (e.code !== "KeyE" || e.repeat) return;
    const npc = NPCs.nearest(ctl.pos.x, ctl.pos.z, 2.5);
    if (npc) { NPCs.talk(npc); e.preventDefault(); }
  };
  window.addEventListener("keydown", _govTalkKey, { capture: true });

  /* ═══════════════════════════════════════════════════════════
     RETURN
     ═══════════════════════════════════════════════════════════ */
  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "GOVERNOR'S MANSION",
    title: "STATE ROOMS",
    subtitle: "INTERIOR",
    hint: "LEFT: MOVE  ·  RIGHT: LOOK  ·  E: INTERACT",
    isInterior: true,
    sceneId: "governorInterior",

    update: (dt) => {
      ctl.update(dt);
      try { NpcTalk.tick(dt); } catch (e) {}
    },

    dispose: () => {
      window.removeEventListener("keydown", _govTalkKey, { capture: true });
      try { NpcTalk.unmount(); } catch (e) {}
      try { NPCs.despawn(); } catch (e) {}
      if (window.__ph3d_walkCtrl === ctl) window.__ph3d_walkCtrl = null;
      ctl.dispose();
      mergedRoot.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      Object.values(M).forEach((m) => { if (m && m.dispose) m.dispose(); });
      textures.forEach((t) => { try { t.dispose(); } catch (e) {} });
    },
  };
}
