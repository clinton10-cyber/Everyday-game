/* bmw3d.js -- BMW M4 (G82). Ported from the reference HTML model.
   Forward = +X. Wheels use rotateX(π/2) so the tire's axle is along Z
   (left-right). Each wheel descriptor has `spinZ: true`, telling
   drive.js to roll around Z (with a sign flip) instead of X. */
import * as THREE from "three";

export function buildBMW3D(bodyColor, rimColor) {
  bodyColor = bodyColor || "#2b5c9e";
  rimColor  = rimColor  || "#c9ced6";

  const TAU   = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp  = (a, b, t) => a + (b - a) * t;

  /* ── Dimensions (real G82) ─────────────────────────────── */
  const HALF_W  = 0.945;
  const CAB_HW  = 0.775;
  const GROUND  = 0.28;
  const AXLE_F  = 1.42;
  const AXLE_R  = -1.44;
  const WHEEL_R = 0.335;
  const ARCH_R  = 0.375;
  const WHEELBASE = AXLE_F - AXLE_R;
  const BELT_Y  = 0.88;
  const ROOF_Y  = 1.32;

  /* ── Canvas helpers ───────────────────────────────────── */
  function cvs(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 1;
    return t;
  }

  const gridTex = cvs(128, 128, (x, w, h) => {
    x.fillStyle = "#171c24"; x.fillRect(0, 0, w, h);
    x.strokeStyle = "#232b36"; x.lineWidth = 2;
    x.strokeRect(1, 1, w - 2, h - 2);
  });
  gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
  gridTex.repeat.set(55, 55);

  const shadowTex = cvs(128, 128, (x) => {
    x.clearRect(0, 0, 128, 128);
    x.save(); x.translate(64, 64); x.scale(1, 0.5);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 64);
    g.addColorStop(0.00, "rgba(0,0,0,0.85)");
    g.addColorStop(0.45, "rgba(0,0,0,0.40)");
    g.addColorStop(1.00, "rgba(0,0,0,0)");
    x.fillStyle = g;
    x.beginPath(); x.arc(0, 0, 64, 0, TAU); x.fill();
    x.restore();
  });

  const rimTex = cvs(256, 256, (x) => {
    const C = 128;
    x.fillStyle = "#0c0d0f"; x.fillRect(0, 0, 256, 256);
    const ring = x.createRadialGradient(C - 45, C - 45, 30, C, C, 105);
    ring.addColorStop(0, "#dfe5ec"); ring.addColorStop(0.55, "#9aa3ac"); ring.addColorStop(1, "#4e565e");
    x.fillStyle = ring; x.beginPath(); x.arc(C, C, 103, 0, TAU); x.fill();
    x.fillStyle = "#121417"; x.beginPath(); x.arc(C, C, 95, 0, TAU); x.fill();
    for (let i = 0; i < 5; i++) {
      const base = i * TAU / 5;
      for (const off of [-0.118, 0.118]) {
        x.save(); x.translate(C, C); x.rotate(base + off);
        const g = x.createLinearGradient(-14, 0, 14, 0);
        g.addColorStop(0, "#6b737c"); g.addColorStop(0.45, "#d3dae1"); g.addColorStop(1, "#79828b");
        x.fillStyle = g;
        x.beginPath();
        x.moveTo(-13, -16); x.lineTo(13, -16); x.lineTo(7.5, -94); x.lineTo(-7.5, -94);
        x.closePath(); x.fill();
        x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 1; x.stroke();
        x.restore();
      }
    }
    x.strokeStyle = "#eaf0f6"; x.lineWidth = 4;
    x.beginPath(); x.arc(C, C, 99, 0, TAU); x.stroke();
    x.fillStyle = "#b9c2cb"; x.beginPath(); x.arc(C, C, 31, 0, TAU); x.fill();
    x.fillStyle = "#282c31"; x.beginPath(); x.arc(C, C, 12, 0, TAU); x.fill();
    x.fillStyle = "#e2e9ef";
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 - 0.5;
      x.beginPath(); x.arc(C + Math.cos(a) * 21, C + Math.sin(a) * 21, 4.2, 0, TAU); x.fill();
    }
    const stripes = ["#0066b1", "#003a8c", "#e2231a"];
    for (let i = 0; i < 3; i++) {
      x.fillStyle = stripes[i];
      x.fillRect(C - 9 + i * 6, C - 3.5, 5, 7);
    }
  });

  const treadTex = cvs(64, 64, (x, w, h) => {
    x.fillStyle = "#101113"; x.fillRect(0, 0, w, h);
    x.fillStyle = "#1d2023";
    for (let i = 0; i < 8; i++) x.fillRect(i * 8 + 1, 0, 5, h);
    x.fillStyle = "#0a0b0c";
    for (let i = 0; i < 8; i++) x.fillRect(i * 8 + 6, 0, 2, h);
  });
  treadTex.wrapS = treadTex.wrapT = THREE.RepeatWrapping;
  treadTex.repeat.set(10, 1);

  const grilleTex = cvs(64, 128, (x, w, h) => {
    x.fillStyle = "#08090b"; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      const g = x.createLinearGradient(0, 12 + i * 12, 0, 18 + i * 12);
      g.addColorStop(0, "#3a4046"); g.addColorStop(0.5, "#14181c"); g.addColorStop(1, "#3a4046");
      x.fillStyle = g;
      x.fillRect(3, 12 + i * 12, w - 6, 6);
    }
  });

  const roundelTex = cvs(64, 64, (x) => {
    const C = 32;
    x.clearRect(0, 0, 64, 64);
    x.fillStyle = "#1c1f24"; x.beginPath(); x.arc(C, C, 31, 0, TAU); x.fill();
    x.fillStyle = "#d8dee4"; x.beginPath(); x.arc(C, C, 27, 0, TAU); x.fill();
    x.fillStyle = "#0066b1";
    x.beginPath(); x.moveTo(C, C); x.arc(C, C, 24, Math.PI, Math.PI * 1.5); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(C, C); x.arc(C, C, 24, 0, Math.PI * 0.5); x.closePath(); x.fill();
    x.fillStyle = "#f2f6fa";
    x.beginPath(); x.moveTo(C, C); x.arc(C, C, 24, Math.PI * 1.5, TAU); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(C, C); x.arc(C, C, 24, Math.PI * 0.5, Math.PI); x.closePath(); x.fill();
    x.strokeStyle = "#1c1f24"; x.lineWidth = 3;
    x.beginPath(); x.arc(C, C, 24, 0, TAU); x.stroke();
  });

  const badgeTex = cvs(256, 96, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    const st = ["#0066b1", "#003a8c", "#e2231a"];
    for (let i = 0; i < 3; i++) {
      x.fillStyle = st[i];
      x.beginPath();
      x.moveTo(14 + i * 13, 74); x.lineTo(30 + i * 13, 74);
      x.lineTo(40 + i * 13, 22); x.lineTo(24 + i * 13, 22);
      x.closePath(); x.fill();
    }
    x.fillStyle = "#dfe6ee";
    x.font = "bold 62px Helvetica, Arial, sans-serif";
    x.textAlign = "left"; x.textBaseline = "middle";
    x.fillText("M4", 78, 52);
  });

  /* ── Materials ───────────────────────────────────────── */
  const MAT = {
    paint:    new THREE.MeshPhongMaterial({ color: new THREE.Color(bodyColor), shininess: 170, specular: 0x9ab4d8 }),
    paintDk:  new THREE.MeshPhongMaterial({ color: new THREE.Color(bodyColor).multiplyScalar(0.7), shininess: 120, specular: 0x6f8cb0 }),
    carbon:   new THREE.MeshPhongMaterial({ color: 0x14161a, shininess: 130, specular: 0x585f68 }),
    black:    new THREE.MeshLambertMaterial({ color: 0x0c0e11 }),
    plastic:  new THREE.MeshPhongMaterial({ color: 0x15181c, shininess: 30,  specular: 0x2a2f36 }),
    rubber:   new THREE.MeshLambertMaterial({ color: 0x131417 }),
    tireSide: new THREE.MeshPhongMaterial({ map: treadTex, color: 0x34373c, shininess: 6, specular: 0x0a0a0a }),
    rimSide:  new THREE.MeshPhongMaterial({ color: 0x262a2f, shininess: 60, specular: 0x555555 }),
    rimFace:  new THREE.MeshPhongMaterial({ map: rimTex, color: new THREE.Color(rimColor), shininess: 120, specular: 0xb8c0c8 }),
    glass:    new THREE.MeshPhongMaterial({ color: 0x0a1420, shininess: 320, specular: 0xffffff, side: THREE.DoubleSide }),
    chrome:   new THREE.MeshPhongMaterial({ color: 0xb4bec8, shininess: 320, specular: 0xffffff }),
    head:     new THREE.MeshPhongMaterial({ color: 0xe6efff, emissive: 0x40506a, shininess: 340, specular: 0xffffff }),
    drl:      new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0xbcd6ff, shininess: 340, specular: 0xffffff }),
    tail:     new THREE.MeshPhongMaterial({ color: 0x9e1212, emissive: 0x3a0000, shininess: 240, specular: 0xff9999 }),
    grille:   new THREE.MeshPhongMaterial({ map: grilleTex, shininess: 40, specular: 0x444444 }),
    roundel:  new THREE.MeshPhongMaterial({ map: roundelTex, transparent: true, shininess: 140 }),
    badge:    new THREE.MeshPhongMaterial({ map: badgeTex, transparent: true, shininess: 130 }),
  };

  /* ── Geometry helpers ────────────────────────────────── */
  const V2 = (x, y) => new THREE.Vector2(x, y);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  function extrudeProfile(points, depth, material) {
    const shape = new THREE.Shape(points);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: false, curveSegments: 1, steps: 1
    });
    geo.translate(0, 0, -depth / 2);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, material);
  }

  function quadsGeometry(list) {
    const pos = [];
    for (const [a, b, c, d] of list) {
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      pos.push(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }

  function box(w, h, d, mat, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  function cyl(rt, rb, h, seg, mat, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, false), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  function roundedRect(w, h, r) {
    const p = new THREE.Shape();
    const x0 = -w / 2, y0 = -h / 2;
    p.moveTo(x0 + r, y0);
    p.lineTo(x0 + w - r, y0);
    p.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
    p.lineTo(x0 + w, y0 + h - r);
    p.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
    p.lineTo(x0 + r, y0 + h);
    p.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
    p.lineTo(x0, y0 + r);
    p.quadraticCurveTo(x0, y0, x0 + r, y0);
    return p;
  }

  const taperHW = y => CAB_HW * (1 - 0.13 * clamp((y - BELT_Y) / (ROOF_Y - BELT_Y), 0, 1));

  function archPoints(cx, segments) {
    segments = segments || 12;
    const out = [];
    const dy = (GROUND - WHEEL_R) / ARCH_R;
    const a0 = Math.PI - Math.asin(dy);
    const a1 = Math.asin(dy);
    for (let i = 0; i <= segments; i++) {
      const a = a0 + (a1 - a0) * (i / segments);
      out.push(V2(cx + ARCH_R * Math.cos(a), WHEEL_R + ARCH_R * Math.sin(a)));
    }
    return out;
  }

  /* ── Build ───────────────────────────────────────────── */
  const car3d = new THREE.Group();
  const body = new THREE.Group();
  car3d.add(body);

  /* Main tub */
  {
    const P = [];
    P.push(V2(-2.28, 0.30));
    archPoints(AXLE_R).forEach(p => P.push(p));
    archPoints(AXLE_F).forEach(p => P.push(p));
    P.push(V2(2.05, 0.30));
    P.push(V2(2.26, 0.42));
    P.push(V2(2.36, 0.58));
    P.push(V2(2.38, 0.76));
    P.push(V2(2.30, 0.84));
    P.push(V2(1.30, 0.89));
    P.push(V2(0.72, 0.93));
    P.push(V2(-0.30, 0.90));
    P.push(V2(-1.55, 0.90));
    P.push(V2(-2.05, 0.88));
    P.push(V2(-2.26, 0.82));
    P.push(V2(-2.32, 0.52));
    body.add(extrudeProfile(P, HALF_W * 2, MAT.paint));
  }

  /* Cabin with tumblehome */
  {
    const C = new THREE.Shape();
    C.moveTo( 0.74, 0.92);
    C.lineTo( 0.16, 1.32);
    C.lineTo(-0.50, 1.30);
    C.lineTo(-1.14, 0.88);
    C.closePath();
    const geo = new THREE.ExtrudeGeometry(C, {
      depth: CAB_HW * 2, bevelEnabled: false, curveSegments: 1, steps: 1
    });
    geo.translate(0, 0, -CAB_HW);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const s = 1 - 0.13 * clamp((y - BELT_Y) / (ROOF_Y - BELT_Y), 0, 1);
      pos.setZ(i, pos.getZ(i) * s);
    }
    geo.computeVertexNormals();
    body.add(new THREE.Mesh(geo, MAT.paint));
  }

  /* Glass */
  {
    const q = [];

    // Windshield
    {
      const b = V2(0.74, 0.92), t = V2(0.16, 1.32);
      const nx = 0.568, ny = 0.824, o = 0.014;
      const p0 = V2(lerp(b.x, t.x, 0.07), lerp(b.y, t.y, 0.07));
      const p1 = V2(lerp(b.x, t.x, 0.93), lerp(b.y, t.y, 0.93));
      const w0 = taperHW(p0.y) + 0.006;
      const w1 = taperHW(p1.y) + 0.006;
      q.push([
        V3(p0.x + nx * o, p0.y + ny * o,  w0),
        V3(p1.x + nx * o, p1.y + ny * o,  w1),
        V3(p1.x + nx * o, p1.y + ny * o, -w1),
        V3(p0.x + nx * o, p0.y + ny * o, -w0)
      ]);
    }

    // Rear window
    {
      const b = V2(-0.50, 1.30), t = V2(-1.14, 0.88);
      const nx = -0.549, ny = 0.836, o = 0.014;
      const p0 = V2(lerp(b.x, t.x, 0.07), lerp(b.y, t.y, 0.07));
      const p1 = V2(lerp(b.x, t.x, 0.93), lerp(b.y, t.y, 0.93));
      const w0 = taperHW(p0.y) + 0.006;
      const w1 = taperHW(p1.y) + 0.006;
      q.push([
        V3(p0.x + nx * o, p0.y + ny * o,  w0),
        V3(p0.x + nx * o, p0.y + ny * o, -w0),
        V3(p1.x + nx * o, p1.y + ny * o, -w1),
        V3(p1.x + nx * o, p1.y + ny * o,  w1)
      ]);
    }

    body.add(new THREE.Mesh(quadsGeometry(q), MAT.glass));

    // Side glass
    const sidePts = [
      [ 0.66, 0.94], [ 0.62, 1.00], [ 0.18, 1.255],
      [-0.20, 1.245], [-0.40, 1.10], [-0.36, 0.94]
    ];
    for (const s of [1, -1]) {
      const shape = new THREE.Shape(sidePts.map(p => V2(p[0], p[1])));
      const geo = new THREE.ShapeGeometry(shape);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setZ(i, s * (taperHW(pos.getY(i)) + 0.007));
      }
      geo.computeVertexNormals();
      body.add(new THREE.Mesh(geo, MAT.glass));
    }
  }

  /* Carbon roof */
  {
    const wA = taperHW(1.322) - 0.045;
    const wB = taperHW(1.302) - 0.045;
    const q = [[
      V3( 0.15, 1.324,  wA), V3(-0.50, 1.304,  wB),
      V3(-0.50, 1.304, -wB), V3( 0.15, 1.324, -wA)
    ]];
    body.add(new THREE.Mesh(quadsGeometry(q), MAT.carbon));
  }

  /* Kidney grille */
  {
    const KW = 0.44, KH = 0.44, KR = 0.13;
    for (const s of [1, -1]) {
      const outer = roundedRect(KW, KH, KR);
      const inner = roundedRect(KW - 0.06, KH - 0.06, KR - 0.02);
      outer.holes.push(inner);
      const geo = new THREE.ExtrudeGeometry(outer, {
        depth: 0.06, bevelEnabled: false, curveSegments: 3, steps: 1
      });
      geo.translate(0, 0, -0.03);
      const frame = new THREE.Mesh(geo, MAT.chrome);
      frame.rotation.y = Math.PI / 2;
      frame.position.set(2.39, 0.62, s * 0.25);
      body.add(frame);

      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(KW - 0.07, KH - 0.07), MAT.grille);
      mesh.rotation.y = Math.PI / 2;
      mesh.position.set(2.355, 0.62, s * 0.25);
      body.add(mesh);
    }
  }

  /* Front end */
  {
    for (const s of [1, -1]) {
      const hl = box(0.13, 0.10, 0.40, MAT.head, 2.30, 0.785, s * 0.66, body);
      hl.rotation.z = -0.16;
      const drl = box(0.10, 0.028, 0.38, MAT.drl, 2.33, 0.735, s * 0.66, body);
      drl.rotation.z = -0.16;
    }
    for (const s of [1, -1]) {
      const v = box(0.14, 0.26, 0.30, MAT.black, 2.30, 0.50, s * 0.70, body);
      v.rotation.z = 0.10;
      box(0.05, 0.05, 0.24, MAT.carbon, 2.36, 0.62, s * 0.70, body);
    }
    box(0.34, 0.045, 1.70, MAT.carbon, 2.28, 0.295, 0, body);
    for (const s of [1, -1]) {
      const c = box(0.16, 0.03, 0.22, MAT.carbon, 2.34, 0.345, s * 0.82, body);
      c.rotation.z = 0.22;
    }
    box(0.95, 0.022, 0.86, MAT.paintDk, 1.62, 0.888, 0, body);
    for (const s of [1, -1]) {
      const vent = box(0.22, 0.012, 0.07, MAT.black, 1.60, 0.902, s * 0.30, body);
      vent.rotation.y = -s * 0.06;
    }
    const rd = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16), MAT.roundel);
    rd.rotation.x = -Math.PI / 2;
    rd.position.set(2.14, 0.855, 0);
    body.add(rd);
  }

  /* Rear end */
  {
    for (const s of [1, -1]) {
      box(0.07, 0.085, 0.36, MAT.tail, -2.30, 0.845, s * 0.60, body);
      box(0.07, 0.16, 0.09,  MAT.tail, -2.30, 0.775, s * 0.75, body);
      box(0.04, 0.03, 0.30, MAT.drl,  -2.325, 0.885, s * 0.60, body);
    }
    const dk = box(0.24, 0.035, 1.42, MAT.carbon, -2.16, 0.905, 0, body);
    dk.rotation.z = -0.16;
    box(0.20, 0.30, 1.82, MAT.plastic, -2.28, 0.50, 0, body);
    box(0.26, 0.16, 1.50, MAT.carbon, -2.24, 0.30, 0, body);
    for (let i = -2; i <= 2; i++) {
      box(0.22, 0.14, 0.028, MAT.black, -2.30, 0.30, i * 0.24, body);
    }
    for (const s of [1, -1]) {
      for (const k of [1, 2]) {
        const tip = cyl(0.052, 0.052, 0.13, 10, MAT.chrome, -2.38, 0.335, s * (0.30 + k * 0.135), body);
        tip.rotation.z = Math.PI / 2;
        const bore = cyl(0.040, 0.040, 0.05, 8, MAT.black, -2.43, 0.335, s * (0.30 + k * 0.135), body);
        bore.rotation.z = Math.PI / 2;
      }
    }
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.11), MAT.badge);
    bd.position.set(-2.315, 0.82, -0.52);
    bd.rotation.y = -Math.PI / 2;
    body.add(bd);
  }

  /* Side details */
  {
    for (const x of [0.95, -0.38]) {
      for (const s of [1, -1]) {
        box(0.012, 0.60, 0.008, MAT.black, x, 0.62, s * (HALF_W + 0.002), body);
      }
    }
    for (const s of [1, -1]) {
      box(0.19, 0.032, 0.03, MAT.chrome, 0.42, 0.815, s * (HALF_W + 0.006), body);
    }
    for (const s of [1, -1]) {
      const arm = box(0.09, 0.035, 0.16, MAT.carbon, 0.79, 0.965, s * 0.90, body);
      arm.rotation.y = -s * 0.22;
      box(0.055, 0.032, 0.10, MAT.carbon, 0.80, 0.925, s * 0.95, body);
      const shell = box(0.11, 0.085, 0.13, MAT.paint, 0.80, 1.01, s * 1.01, body);
      shell.rotation.y = -s * 0.10;
      box(0.02, 0.065, 0.10, MAT.glass, 0.755, 1.01, s * 1.01, body);
    }
    for (const s of [1, -1]) {
      box(1.85, 0.085, 0.10, MAT.carbon, -0.05, 0.265, s * 0.925, body);
    }
    for (const s of [1, -1]) {
      const g1 = box(0.075, 0.16, 0.035, MAT.black, 0.72, 0.62, s * (HALF_W + 0.004), body);
      g1.rotation.z = 0.30;
      const g2 = box(0.055, 0.13, 0.030, MAT.carbon, 0.62, 0.60, s * (HALF_W + 0.004), body);
      g2.rotation.z = 0.30;
    }
    const cap = cyl(0.085, 0.085, 0.016, 10, MAT.paintDk, -1.02, 0.80, HALF_W + 0.002, body);
    cap.rotation.x = Math.PI / 2;
    const fin = cyl(0.008, 0.048, 0.14, 4, MAT.paintDk, -0.62, 1.275, 0, body);
    fin.rotation.z = 0.42;
    for (let i = 0; i < 2; i++) {
      const w = box(0.44, 0.011, 0.016, MAT.black,
        0.74 - i * 0.05, 0.935 + i * 0.015, -0.34 + i * 0.68, body);
      w.rotation.y = 0.26;
    }
  }

  /* Arch flares */
  for (const ax of [AXLE_F, AXLE_R]) {
    for (const s of [1, -1]) {
      const t = new THREE.Mesh(
        new THREE.TorusGeometry(ARCH_R + 0.012, 0.038, 4, 14, Math.PI),
        MAT.paintDk
      );
      t.position.set(ax, WHEEL_R, s * (HALF_W + 0.008));
      body.add(t);
    }
  }

  /* ── Wheels ────────────────────────────────────────────
     rotateX(π/2) puts the tire's axle along Z (left-right for a
     forward = +X car). Drive.js spins them with spinZ. */
  function makeWheel() {
    const g = new THREE.Group();

    const tireGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.285, 20, 1, false);
    tireGeo.rotateX(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, [MAT.tireSide, MAT.rubber, MAT.rubber]);
    g.add(tire);

    const rimGeo = new THREE.CylinderGeometry(0.255, 0.255, 0.30, 20, 1, false);
    rimGeo.rotateX(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, [MAT.rimSide, MAT.rimFace, MAT.rimFace]);
    g.add(rim);

    return g;
  }

  const wheelPos = [
    [ AXLE_F,  0.795, true ], [ AXLE_F, -0.795, true ],
    [ AXLE_R,  0.795, false], [ AXLE_R, -0.795, false]
  ];

  const wheels = [];
  for (const [x, z, isFront] of wheelPos) {
    const pivot = new THREE.Group();
    pivot.position.set(x, WHEEL_R, z);
    car3d.add(pivot);

    const spin = makeWheel();
    pivot.add(spin);

    wheels.push({ pivot, spin, steer: !!isFront, spinZ: true });
  }

  /* Contact shadow */
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(8.0, 4.2),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.95 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  shadow.renderOrder = -1;
  car3d.add(shadow);

  car3d.userData.wheels = wheels;
  return car3d;
}
