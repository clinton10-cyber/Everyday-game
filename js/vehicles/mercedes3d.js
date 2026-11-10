/* mercedes3d.js -- Mercedes-Benz S-Class (W223). Ported from the
   reference HTML model. Forward = +X. Wheels built with
   rotateX(π/2) so axle is along Z, tagged spinZ so drive.js rolls
   them around Z with the correct sign. */
import * as THREE from "three";

export function buildMercedes3D(bodyColor, rimColor) {
  bodyColor = bodyColor || "#b9c3cd";
  rimColor  = rimColor  || "#c9ced6";

  const TAU   = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp  = (a, b, t) => a + (b - a) * t;

  /* ── Dimensions (W223) ─────────────────────────────────── */
  const HALF_W  = 0.975;
  const CAB_HW  = 0.80;
  const GROUND  = 0.24;
  const AXLE_F  = 1.55;
  const AXLE_R  = -1.55;
  const WHEEL_R = 0.36;
  const ARCH_R  = 0.40;
  const WHEELBASE = AXLE_F - AXLE_R;
  const BELT_Y  = 0.95;
  const ROOF_Y  = 1.44;

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
    x.strokeStyle = "#1c232c"; x.lineWidth = 1;
    x.beginPath();
    x.moveTo(w / 2, 0); x.lineTo(w / 2, h);
    x.moveTo(0, h / 2); x.lineTo(w, h / 2);
    x.stroke();
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
    const ring = x.createRadialGradient(C - 50, C - 50, 40, C, C, 105);
    ring.addColorStop(0, "#eef3f8");
    ring.addColorStop(0.55, "#b6bfc8");
    ring.addColorStop(1, "#6e777f");
    x.fillStyle = ring; x.beginPath(); x.arc(C, C, 104, 0, TAU); x.fill();
    x.fillStyle = "#15171a"; x.beginPath(); x.arc(C, C, 96, 0, TAU); x.fill();
    for (let i = 0; i < 10; i++) {
      x.save(); x.translate(C, C); x.rotate(i * TAU / 10);
      const g = x.createLinearGradient(-10, 0, 10, 0);
      g.addColorStop(0, "#5f6871"); g.addColorStop(0.5, "#e2e9f0"); g.addColorStop(1, "#6d767f");
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(-9, -20); x.lineTo(9, -20); x.lineTo(4.5, -92); x.lineTo(-4.5, -92);
      x.closePath(); x.fill();
      x.restore();
    }
    x.strokeStyle = "#f0f5fa"; x.lineWidth = 3;
    x.beginPath(); x.arc(C, C, 99, 0, TAU); x.stroke();
    x.fillStyle = "#cbd4dd"; x.beginPath(); x.arc(C, C, 30, 0, TAU); x.fill();
    x.fillStyle = "#22262b"; x.beginPath(); x.arc(C, C, 20, 0, TAU); x.fill();
    x.fillStyle = "#e8eff5";
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 - 0.3;
      x.beginPath(); x.arc(C + Math.cos(a) * 15, C + Math.sin(a) * 15, 3.6, 0, TAU); x.fill();
    }
    x.strokeStyle = "#f2f7fb"; x.lineWidth = 3; x.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + i * TAU / 3;
      x.beginPath(); x.moveTo(C, C); x.lineTo(C + Math.cos(a) * 12, C + Math.sin(a) * 12); x.stroke();
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

  const grilleTex = cvs(128, 128, (x, w, h) => {
    x.fillStyle = "#06070a"; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      const g = x.createLinearGradient(0, 10 + i * 13, 0, 17 + i * 13);
      g.addColorStop(0, "#e6ecf2");
      g.addColorStop(0.45, "#7d858d");
      g.addColorStop(1, "#e6ecf2");
      x.fillStyle = g; x.fillRect(5, 10 + i * 13, w - 10, 5);
    }
    x.strokeStyle = "#cfd8e0"; x.lineWidth = 4;
    x.strokeRect(3, 3, w - 6, h - 6);
  });

  const starTex = cvs(64, 64, (x) => {
    const C = 32;
    x.clearRect(0, 0, 64, 64);
    x.fillStyle = "#cdd6df"; x.beginPath(); x.arc(C, C, 30, 0, TAU); x.fill();
    x.fillStyle = "#0d1014"; x.beginPath(); x.arc(C, C, 25.5, 0, TAU); x.fill();
    x.strokeStyle = "#e6eef5"; x.lineWidth = 5; x.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + i * TAU / 3;
      x.beginPath(); x.moveTo(C, C); x.lineTo(C + Math.cos(a) * 22, C + Math.sin(a) * 22); x.stroke();
    }
    x.fillStyle = "#e6eef5"; x.beginPath(); x.arc(C, C, 4, 0, TAU); x.fill();
  });

  const badgeTex = cvs(256, 64, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = "#c7d1db";
    x.font = "600 30px Helvetica, Arial, sans-serif";
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText("S - C L A S S", w / 2, h / 2);
  });

  /* ── Materials ────────────────────────────────────────── */
  const MAT = {
    paint:    new THREE.MeshPhongMaterial({ color: new THREE.Color(bodyColor), shininess: 190, specular: 0xdde6ef }),
    paintDk:  new THREE.MeshPhongMaterial({ color: new THREE.Color(bodyColor).multiplyScalar(0.7), shininess: 150, specular: 0xb6c0ca }),
    black:    new THREE.MeshLambertMaterial({ color: 0x0c0e11 }),
    plastic:  new THREE.MeshPhongMaterial({ color: 0x15181c, shininess: 30, specular: 0x2a2f36 }),
    rubber:   new THREE.MeshLambertMaterial({ color: 0x131417 }),
    tireSide: new THREE.MeshPhongMaterial({ map: treadTex, color: 0x34373c, shininess: 6, specular: 0x0a0a0a }),
    rimSide:  new THREE.MeshPhongMaterial({ color: 0x262a2f, shininess: 60, specular: 0x555555 }),
    rimFace:  new THREE.MeshPhongMaterial({ map: rimTex, color: new THREE.Color(rimColor), shininess: 140, specular: 0xc4ccd4 }),
    glass:    new THREE.MeshPhongMaterial({ color: 0x0b1520, shininess: 340, specular: 0xffffff, side: THREE.DoubleSide }),
    chrome:   new THREE.MeshPhongMaterial({ color: 0xc8d2dc, shininess: 340, specular: 0xffffff }),
    head:     new THREE.MeshPhongMaterial({ color: 0xeaf2ff, emissive: 0x40506a, shininess: 340, specular: 0xffffff }),
    drl:      new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0xbcd6ff, shininess: 340, specular: 0xffffff }),
    tail:     new THREE.MeshPhongMaterial({ color: 0xa11414, emissive: 0x3a0000, shininess: 240, specular: 0xff9999 }),
    grille:   new THREE.MeshPhongMaterial({ map: grilleTex, shininess: 80, specular: 0x777777 }),
    star:     new THREE.MeshPhongMaterial({ map: starTex, transparent: true, shininess: 160 }),
    badge:    new THREE.MeshPhongMaterial({ map: badgeTex, transparent: true, shininess: 120 }),
  };

  /* ── Geometry helpers ─────────────────────────────────── */
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
    p.lineTo(x0 + w - r, y0); p.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
    p.lineTo(x0 + w, y0 + h - r); p.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
    p.lineTo(x0 + r, y0 + h); p.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
    p.lineTo(x0, y0 + r); p.quadraticCurveTo(x0, y0, x0 + r, y0);
    return p;
  }

  const taperHW = y => CAB_HW * (1 - 0.12 * clamp((y - BELT_Y) / (ROOF_Y - BELT_Y), 0, 1));

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

  /* ── Build ─────────────────────────────────────────────── */
  const car3d = new THREE.Group();
  const body = new THREE.Group();
  car3d.add(body);

  /* Main tub */
  {
    const P = [];
    P.push(V2(-2.52, 0.26));
    archPoints(AXLE_R).forEach(p => P.push(p));
    archPoints(AXLE_F).forEach(p => P.push(p));
    P.push(V2(2.18, 0.26));
    P.push(V2(2.42, 0.34));
    P.push(V2(2.55, 0.48));
    P.push(V2(2.58, 0.70));
    P.push(V2(2.54, 0.86));
    P.push(V2(2.18, 0.90));
    P.push(V2(1.20, 0.94));
    P.push(V2(0.85, 0.98));
    P.push(V2(-0.30, 0.95));
    P.push(V2(-1.80, 0.93));
    P.push(V2(-2.34, 0.90));
    P.push(V2(-2.50, 0.82));
    P.push(V2(-2.56, 0.58));
    body.add(extrudeProfile(P, HALF_W * 2, MAT.paint));
  }

  /* Greenhouse with tumblehome */
  {
    const C = new THREE.Shape();
    C.moveTo( 0.86, 0.97);
    C.lineTo( 0.30, 1.44);
    C.lineTo(-0.88, 1.43);
    C.lineTo(-1.62, 0.93);
    C.closePath();
    const geo = new THREE.ExtrudeGeometry(C, {
      depth: CAB_HW * 2, bevelEnabled: false, curveSegments: 1, steps: 1
    });
    geo.translate(0, 0, -CAB_HW);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const s = 1 - 0.12 * clamp((y - BELT_Y) / (ROOF_Y - BELT_Y), 0, 1);
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
      const b = V2(0.86, 0.97), t = V2(0.30, 1.44);
      const nx = 0.648, ny = 0.762, o = 0.014;
      const p0 = V2(lerp(b.x, t.x, 0.06), lerp(b.y, t.y, 0.06));
      const p1 = V2(lerp(b.x, t.x, 0.94), lerp(b.y, t.y, 0.94));
      const w0 = taperHW(p0.y) + 0.006;
      const w1 = taperHW(p1.y) + 0.006;
      q.push([
        V3(p0.x + nx * o, p0.y + ny * o,  w0),
        V3(p1.x + nx * o, p1.y + ny * o,  w1),
        V3(p1.x + nx * o, p1.y + ny * o, -w1),
        V3(p0.x + nx * o, p0.y + ny * o, -w0)
      ]);
    }

    // Rear screen
    {
      const b = V2(-0.88, 1.43), t = V2(-1.62, 0.93);
      const nx = -0.735, ny = 0.678, o = 0.014;
      const p0 = V2(lerp(b.x, t.x, 0.06), lerp(b.y, t.y, 0.06));
      const p1 = V2(lerp(b.x, t.x, 0.94), lerp(b.y, t.y, 0.94));
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

    // Side glass — two panes split by a B-pillar
    const panes = [
      [[ 0.80, 0.99], [ 0.28, 1.405], [-0.10, 1.40], [-0.10, 0.99]],
      [[-0.18, 0.99], [-0.18, 1.40], [-0.86, 1.395], [-1.24, 0.99]]
    ];
    for (const s of [1, -1]) {
      for (const pane of panes) {
        const shape = new THREE.Shape(pane.map(p => V2(p[0], p[1])));
        const geo = new THREE.ShapeGeometry(shape);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          pos.setZ(i, s * (taperHW(pos.getY(i)) + 0.007));
        }
        geo.computeVertexNormals();
        body.add(new THREE.Mesh(geo, MAT.glass));
      }
    }
  }

  /* Panoramic roof */
  {
    const wA = taperHW(1.432) - 0.06;
    const wB = taperHW(1.425) - 0.06;
    const q = [[
      V3( 0.26, 1.433,  wA), V3(-0.84, 1.424,  wB),
      V3(-0.84, 1.424, -wB), V3( 0.26, 1.433, -wA)
    ]];
    body.add(new THREE.Mesh(quadsGeometry(q), MAT.black));
  }

  /* Chrome trim */
  {
    for (const s of [1, -1]) {
      const bl = box(2.06, 0.020, 0.014, MAT.chrome, -0.24, 0.985, s * (CAB_HW + 0.010), body);
      bl.rotation.z = 0.012;
      box(2.10, 0.022, 0.012, MAT.chrome, -0.20, 0.34, s * (HALF_W + 0.004), body);
      const rr = box(1.10, 0.016, 0.012, MAT.chrome, -0.28, 1.427, s * (CAB_HW * 0.905 + 0.006), body);
      rr.rotation.z = 0.004;
    }
  }

  /* Front grille */
  {
    const GW = 1.00, GH = 0.46, GR = 0.13;
    const outer = roundedRect(GW, GH, GR);
    const inner = roundedRect(GW - 0.075, GH - 0.075, GR - 0.025);
    outer.holes.push(inner);
    const geo = new THREE.ExtrudeGeometry(outer, {
      depth: 0.07, bevelEnabled: false, curveSegments: 4, steps: 1
    });
    geo.translate(0, 0, -0.035);
    const frame = new THREE.Mesh(geo, MAT.chrome);
    frame.rotation.y = Math.PI / 2;
    frame.position.set(2.585, 0.655, 0);
    body.add(frame);

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(GW - 0.09, GH - 0.09), MAT.grille);
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(2.545, 0.655, 0);
    body.add(mesh);

    box(0.10, 0.13, 1.10, MAT.black,  2.50, 0.40,  0, body);
    box(0.06, 0.030, 1.14, MAT.chrome, 2.55, 0.335, 0, body);
  }

  /* Headlights + hood star */
  {
    for (const s of [1, -1]) {
      const hl = box(0.12, 0.105, 0.40, MAT.head, 2.44, 0.795, s * 0.68, body);
      hl.rotation.z = -0.14;
      const drl = box(0.09, 0.026, 0.38, MAT.drl, 2.475, 0.748, s * 0.68, body);
      drl.rotation.z = -0.14;
      const ci = box(0.10, 0.14, 0.20, MAT.black, 2.48, 0.46, s * 0.78, body);
      ci.rotation.z = 0.12;
    }
    const star = new THREE.Mesh(new THREE.CircleGeometry(0.062, 18), MAT.star);
    star.rotation.x = -Math.PI / 2;
    star.position.set(2.30, 0.912, 0);
    body.add(star);
    cyl(0.045, 0.045, 0.02, 10, MAT.chrome, 2.30, 0.905, 0, body);
  }

  /* Rear end */
  {
    for (const s of [1, -1]) {
      box(0.075, 0.10, 0.40, MAT.tail, -2.505, 0.795, s * 0.70, body);
      box(0.045, 0.028, 0.34, MAT.drl, -2.535, 0.855, s * 0.70, body);
    }
    box(0.05, 0.028, 0.92, MAT.chrome, -2.545, 0.795, 0, body);

    const bd = new THREE.Mesh(new THREE.PlaneGeometry(0.40, 0.10), MAT.badge);
    bd.position.set(-2.567, 0.72, 0);
    bd.rotation.y = -Math.PI / 2;
    body.add(bd);

    box(0.20, 0.32, 1.86, MAT.plastic, -2.50, 0.44, 0, body);
    box(0.07, 0.034, 1.30, MAT.chrome, -2.585, 0.365, 0, body);

    for (const s of [1, -1]) {
      const tip = cyl(0.055, 0.055, 0.12, 10, MAT.chrome, -2.60, 0.30, s * 0.66, body);
      tip.rotation.z = Math.PI / 2;
      const bore = cyl(0.042, 0.042, 0.05, 8, MAT.black, -2.645, 0.30, s * 0.66, body);
      bore.rotation.z = Math.PI / 2;
    }
  }

  /* Side details */
  {
    for (const x of [0.92, -0.14, -1.26]) {
      for (const s of [1, -1]) box(0.012, 0.58, 0.008, MAT.black, x, 0.63, s * (HALF_W + 0.002), body);
    }
    for (const s of [1, -1]) {
      box(0.20, 0.030, 0.026, MAT.chrome,  0.42, 0.905, s * (HALF_W + 0.006), body);
      box(0.20, 0.030, 0.026, MAT.chrome, -0.64, 0.905, s * (HALF_W + 0.006), body);
    }
    for (const s of [1, -1]) {
      const arm = box(0.09, 0.035, 0.15, MAT.paintDk, 0.80, 1.00, s * 0.93, body);
      arm.rotation.y = -s * 0.20;
      const shell = box(0.12, 0.08, 0.14, MAT.paint, 0.80, 1.045, s * 1.03, body);
      shell.rotation.y = -s * 0.08;
      box(0.018, 0.062, 0.10, MAT.glass, 0.755, 1.045, s * 1.03, body);
    }
    for (const s of [1, -1]) box(1.90, 0.075, 0.09, MAT.paintDk, -0.05, 0.265, s * 0.945, body);

    const cap = cyl(0.085, 0.085, 0.014, 10, MAT.paintDk, -1.05, 0.86, HALF_W + 0.002, body);
    cap.rotation.x = Math.PI / 2;

    const fin = cyl(0.006, 0.042, 0.13, 4, MAT.paintDk, -1.34, 1.395, 0, body);
    fin.rotation.z = 0.40;

    for (let i = 0; i < 2; i++) {
      const w = box(0.46, 0.010, 0.014, MAT.black,
        0.86 - i * 0.05, 0.995 + i * 0.012, -0.32 + i * 0.64, body);
      w.rotation.y = 0.24;
    }
  }

  /* Arch trim */
  for (const ax of [AXLE_F, AXLE_R]) {
    for (const s of [1, -1]) {
      const t = new THREE.Mesh(
        new THREE.TorusGeometry(ARCH_R + 0.010, 0.030, 4, 14, Math.PI),
        MAT.chrome
      );
      t.position.set(ax, WHEEL_R, s * (HALF_W + 0.006));
      body.add(t);
    }
  }

  /* ── Wheels (axle along Z, spinZ tagged) ─────────────── */
  function makeWheel() {
    const g = new THREE.Group();

    const tireGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.245, 20, 1, false);
    tireGeo.rotateX(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, [MAT.tireSide, MAT.rubber, MAT.rubber]);
    g.add(tire);

    const rimGeo = new THREE.CylinderGeometry(0.263, 0.263, 0.255, 20, 1, false);
    rimGeo.rotateX(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, [MAT.rimSide, MAT.rimFace, MAT.rimFace]);
    g.add(rim);

    return g;
  }

  const wheelPos = [
    [ AXLE_F,  0.80, true ], [ AXLE_F, -0.80, true ],
    [ AXLE_R,  0.80, false], [ AXLE_R, -0.80, false]
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
