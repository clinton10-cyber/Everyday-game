/* chiron3d.js -- Bugatti Chiron. Ported from the reference HTML model.
   Forward = +X. Wheels use rotateX(π/2) so the axle is along Z,
   tagged spinZ: true. Exposes userData.wing for a drive.js hook
   that raises the wing with speed. */
import * as THREE from "three";

export function buildChiron3D(bodyColor, rimColor) {
  bodyColor = bodyColor || "#0e2138";
  rimColor  = rimColor  || "#c9ced6";

  const TAU   = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp  = (a, b, t) => a + (b - a) * t;

  /* ── Dimensions (Chiron) ─────────────────────────────────── */
  const HALF_W  = 1.01;
  const CAB_HW  = 0.81;
  const GROUND  = 0.20;
  const AXLE_F  = 1.42;
  const AXLE_R  = -1.32;
  const WHEEL_R = 0.355;
  const ARCH_R  = 0.405;
  const WHEELBASE = AXLE_F - AXLE_R;
  const BELT_Y  = 0.78;
  const ROOF_Y  = 1.22;

  /* ── Canvas textures ──────────────────────────────────────── */
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
    g.addColorStop(0.00, "rgba(0,0,0,0.9)");
    g.addColorStop(0.45, "rgba(0,0,0,0.45)");
    g.addColorStop(1.00, "rgba(0,0,0,0)");
    x.fillStyle = g;
    x.beginPath(); x.arc(0, 0, 64, 0, TAU); x.fill();
    x.restore();
  });

  const rimTex = cvs(256, 256, (x) => {
    const C = 128;
    x.fillStyle = "#08090b"; x.fillRect(0, 0, 256, 256);
    const ring = x.createRadialGradient(C - 55, C - 55, 40, C, C, 106);
    ring.addColorStop(0, "#f4f7fb"); ring.addColorStop(0.55, "#c3cbd3"); ring.addColorStop(1, "#767e86");
    x.fillStyle = ring; x.beginPath(); x.arc(C, C, 105, 0, TAU); x.fill();
    x.fillStyle = "#0f1114"; x.beginPath(); x.arc(C, C, 97, 0, TAU); x.fill();
    for (let i = 0; i < 10; i++) {
      const base = i * TAU / 10;
      for (const off of [-0.105, 0.105]) {
        x.save(); x.translate(C, C); x.rotate(base + off);
        const g = x.createLinearGradient(-11, 0, 11, 0);
        g.addColorStop(0, "#5a626a");
        g.addColorStop(0.45, "#eef2f7");
        g.addColorStop(1, "#69727a");
        x.fillStyle = g;
        x.beginPath();
        x.moveTo(-10, -18); x.lineTo(10, -18); x.lineTo(5.5, -94); x.lineTo(-5.5, -94);
        x.closePath(); x.fill();
        x.strokeStyle = "rgba(255,255,255,.4)"; x.lineWidth = 1; x.stroke();
        x.restore();
      }
    }
    x.strokeStyle = "#f4f8fc"; x.lineWidth = 3.5;
    x.beginPath(); x.arc(C, C, 100, 0, TAU); x.stroke();
    x.fillStyle = "#b7c0c9"; x.beginPath(); x.arc(C, C, 32, 0, TAU); x.fill();
    x.fillStyle = "#1d2126"; x.beginPath(); x.arc(C, C, 20, 0, TAU); x.fill();
    x.fillStyle = "#e9eff5";
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 - 0.5;
      x.beginPath(); x.arc(C + Math.cos(a) * 14, C + Math.sin(a) * 14, 3.4, 0, TAU); x.fill();
    }
    x.strokeStyle = "#1e4d8c"; x.lineWidth = 3;
    x.beginPath(); x.arc(C, C, 42, 0.4, 2.1); x.stroke();
  });

  const treadTex = cvs(64, 64, (x, w, h) => {
    x.fillStyle = "#0f1013"; x.fillRect(0, 0, w, h);
    x.fillStyle = "#1b1e22";
    for (let i = 0; i < 8; i++) x.fillRect(i * 8 + 1, 0, 5, h);
    x.fillStyle = "#090a0c";
    for (let i = 0; i < 8; i++) x.fillRect(i * 8 + 6, 0, 2, h);
  });
  treadTex.wrapS = treadTex.wrapT = THREE.RepeatWrapping;
  treadTex.repeat.set(11, 1);

  const horseshoeTex = cvs(128, 128, (x, w, h) => {
    x.fillStyle = "#050607"; x.fillRect(0, 0, w, h);
    x.strokeStyle = "#c8d2dc"; x.lineWidth = 5;
    x.beginPath();
    x.moveTo(w / 2, 8);
    x.bezierCurveTo(w * 0.9, 8, w * 0.95, h * 0.6, w / 2, h - 8);
    x.bezierCurveTo(w * 0.05, h * 0.6, w * 0.1, 8, w / 2, 8);
    x.stroke();
    x.strokeStyle = "#3a4048"; x.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const yy = 22 + i * 16;
      x.beginPath();
      x.moveTo(28, yy);
      x.bezierCurveTo(w * 0.35, yy + 4, w * 0.65, yy + 4, w - 28, yy);
      x.stroke();
    }
  });

  const tailBarTex = cvs(256, 32, (x, w, h) => {
    x.fillStyle = "#1a0303"; x.fillRect(0, 0, w, h);
    const g = x.createLinearGradient(0, h / 2 - 6, 0, h / 2 + 6);
    g.addColorStop(0, "rgba(255,40,40,0.25)");
    g.addColorStop(0.5, "rgba(255,120,120,1)");
    g.addColorStop(1, "rgba(255,40,40,0.25)");
    x.fillStyle = g; x.fillRect(0, h / 2 - 5, w, 10);
    x.fillStyle = "rgba(255,255,255,.85)";
    x.fillRect(4, h / 2 - 1, w - 8, 2);
  });

  const ebTex = cvs(128, 64, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = "#cbd5df";
    x.beginPath(); x.ellipse(w / 2, h / 2, w / 2 - 3, h / 2 - 3, 0, 0, TAU); x.fill();
    x.fillStyle = "#0b0d10";
    x.font = "bold 34px Helvetica, Arial, sans-serif";
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText("EB", w / 2, h / 2 + 2);
  });

  /* ── Materials ────────────────────────────────────────────── */
  const MAT = {
    paint:    new THREE.MeshPhongMaterial({ color: new THREE.Color(bodyColor), shininess: 230, specular: 0x9db8d6 }),
    paintDk:  new THREE.MeshPhongMaterial({ color: new THREE.Color(bodyColor).multiplyScalar(0.55), shininess: 180, specular: 0x6e87a6 }),
    carbon:   new THREE.MeshPhongMaterial({ color: 0x0a0c10, shininess: 130, specular: 0x4a525a }),
    black:    new THREE.MeshLambertMaterial({ color: 0x07090c }),
    plastic:  new THREE.MeshPhongMaterial({ color: 0x0f1216, shininess: 36,  specular: 0x2a2f36 }),
    rubber:   new THREE.MeshLambertMaterial({ color: 0x101114 }),
    tireSide: new THREE.MeshPhongMaterial({ map: treadTex, color: 0x2c3036, shininess: 6, specular: 0x0a0a0a }),
    rimSide:  new THREE.MeshPhongMaterial({ color: 0x22262b, shininess: 60, specular: 0x555555 }),
    rimFace:  new THREE.MeshPhongMaterial({ map: rimTex, color: new THREE.Color(rimColor), shininess: 150, specular: 0xc4ccd4 }),
    glass:    new THREE.MeshPhongMaterial({ color: 0x080f19, shininess: 340, specular: 0xbfe0ff, side: THREE.DoubleSide }),
    chrome:   new THREE.MeshPhongMaterial({ color: 0xc4ced8, shininess: 340, specular: 0xffffff }),
    head:     new THREE.MeshPhongMaterial({ color: 0xe9f4ff, emissive: 0x88c0ff, shininess: 340, specular: 0xffffff }),
    tail:     new THREE.MeshPhongMaterial({ color: 0xc81313, emissive: 0x720000, shininess: 260, specular: 0xff9999 }),
    horseshoe:new THREE.MeshPhongMaterial({ map: horseshoeTex, shininess: 90, specular: 0x888888 }),
    tailBar:  new THREE.MeshPhongMaterial({ map: tailBarTex, emissive: 0xa01010, emissiveMap: tailBarTex, shininess: 240 }),
    eb:       new THREE.MeshPhongMaterial({ map: ebTex, transparent: true, shininess: 140 }),
  };

  /* ── Geometry helpers ─────────────────────────────────────── */
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

  const taperHW = y => CAB_HW * (1 - 0.20 * clamp((y - BELT_Y) / (ROOF_Y - BELT_Y), 0, 1));

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

  /* ── Build ────────────────────────────────────────────────── */
  const car3d = new THREE.Group();
  const body = new THREE.Group();
  car3d.add(body);

  /* Main tub — low, wide, aggressive */
  {
    const P = [];
    P.push(V2(-2.35, 0.24));
    archPoints(AXLE_R).forEach(p => P.push(p));
    archPoints(AXLE_F).forEach(p => P.push(p));
    P.push(V2(2.02, 0.24));
    P.push(V2(2.28, 0.30));
    P.push(V2(2.42, 0.42));
    P.push(V2(2.44, 0.58));
    P.push(V2(2.32, 0.72));
    P.push(V2(2.05, 0.78));
    P.push(V2(1.30, 0.84));
    P.push(V2(0.70, 0.86));
    P.push(V2(-0.30, 0.82));
    P.push(V2(-1.70, 0.80));
    P.push(V2(-2.10, 0.78));
    P.push(V2(-2.28, 0.70));
    P.push(V2(-2.36, 0.42));
    body.add(extrudeProfile(P, HALF_W * 2, MAT.paint));
  }

  /* Teardrop greenhouse with tumblehome */
  {
    const C = new THREE.Shape();
    C.moveTo( 0.72, 0.84);
    C.lineTo( 0.28, 1.20);
    C.lineTo(-0.42, 1.22);
    C.lineTo(-1.05, 0.80);
    C.closePath();
    const geo = new THREE.ExtrudeGeometry(C, {
      depth: CAB_HW * 2, bevelEnabled: false, curveSegments: 1, steps: 1
    });
    geo.translate(0, 0, -CAB_HW);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const s = 1 - 0.20 * clamp((y - BELT_Y) / (ROOF_Y - BELT_Y), 0, 1);
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
      const b = V2(0.72, 0.84), t = V2(0.28, 1.20);
      const nx = 0.616, ny = 0.788, o = 0.013;
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
      const b = V2(-0.42, 1.22), t = V2(-1.05, 0.80);
      const nx = -0.643, ny = 0.766, o = 0.013;
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

    // Side glass — single pane per side
    const pane = [[0.64, 0.87], [0.26, 1.175], [-0.30, 1.18], [-0.78, 0.83]];
    for (const s of [1, -1]) {
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

  /* Signature C-line side accent (curved chrome tube) */
  {
    const pts = [
      V3( 0.55, 0.80,  HALF_W + 0.006),
      V3( 0.10, 0.72,  HALF_W + 0.010),
      V3(-0.35, 0.55,  HALF_W + 0.012),
      V3(-0.70, 0.34,  HALF_W + 0.010),
      V3(-1.05, 0.30,  HALF_W + 0.004)
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 32, 0.018, 4, false),
      MAT.chrome
    );
    body.add(tube);
    const mirror = tube.clone();
    mirror.scale.z = -1;
    body.add(mirror);
  }

  /* Horseshoe grille */
  {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.48), MAT.horseshoe);
    g.rotation.y = Math.PI / 2;
    g.position.set(2.445, 0.55, 0);
    body.add(g);

    const surround = box(0.045, 0.50, 0.72, MAT.chrome, 2.428, 0.55, 0, body);
    surround.scale.z = 0.92;
    box(0.02, 0.44, 0.66, MAT.black, 2.442, 0.55, 0, body);
  }

  /* Quad LED headlights (4 stacked squares per side) */
  {
    for (const s of [1, -1]) {
      for (let i = 0; i < 4; i++) {
        const sz = 0.055 + i * 0.006;
        const hx = 2.42 - i * 0.010;
        const hy = 0.72 - i * 0.040;
        const hz = s * (0.62 + i * 0.028);
        box(0.04, sz, sz, MAT.head, hx, hy, hz, body);
        box(0.02, sz + 0.014, sz + 0.014, MAT.chrome, hx - 0.008, hy, hz, body);
      }
      box(0.05, 0.022, 0.24, MAT.head, 2.44, 0.44, s * 0.72, body);
    }
  }

  /* Front splitter + intakes */
  {
    box(0.30, 0.06, 1.86, MAT.carbon, 2.30, 0.22, 0, body);
    for (const s of [1, -1]) {
      const v = box(0.14, 0.22, 0.34, MAT.black, 2.32, 0.40, s * 0.78, body);
      v.rotation.z = 0.10;
      box(0.05, 0.04, 0.30, MAT.carbon, 2.40, 0.50, s * 0.78, body);
    }
    for (const s of [1, -1]) {
      const hv = box(0.42, 0.012, 0.14, MAT.carbon, 1.62, 0.855, s * 0.28, body);
      hv.rotation.z = 0.02;
    }
  }

  /* Rear end: full-width LED bar + diffuser + quad exhaust */
  {
    const tb = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 0.10), MAT.tailBar);
    tb.position.set(-2.375, 0.72, 0);
    tb.rotation.y = -Math.PI / 2;
    body.add(tb);
    box(0.05, 0.13, 1.80, MAT.black, -2.365, 0.72, 0, body);

    const eb = new THREE.Mesh(new THREE.CircleGeometry(0.075, 18), MAT.eb);
    eb.position.set(-2.395, 0.87, 0);
    eb.rotation.y = -Math.PI / 2;
    body.add(eb);

    box(0.20, 0.26, 1.90, MAT.carbon, -2.30, 0.40, 0, body);
    for (let i = -2; i <= 2; i++) {
      box(0.22, 0.18, 0.022, MAT.black, -2.36, 0.35, i * 0.26, body);
    }
    for (const s of [1, -1]) {
      for (const k of [1, 2]) {
        const tip = cyl(0.062, 0.062, 0.10, 10, MAT.chrome, -2.42, 0.28, s * (0.26 + k * 0.12), body);
        tip.rotation.z = Math.PI / 2;
        const bore = cyl(0.046, 0.046, 0.04, 8, MAT.black, -2.455, 0.28, s * (0.26 + k * 0.12), body);
        bore.rotation.z = Math.PI / 2;
      }
    }
  }

  /* Active rear wing — exposed for drive.js to animate */
  const wing = new THREE.Group();
  wing.position.set(-1.92, 1.00, 0);
  body.add(wing);

  const wingBlade = box(0.28, 0.028, 1.30, MAT.carbon, 0, 0, 0, wing);
  for (const s of [1, -1]) {
    box(0.06, 0.20, 0.05, MAT.carbon, -0.04, -0.10, s * 0.55, wing);
    box(0.30, 0.10, 0.014, MAT.carbon, 0, 0.02, s * 0.66, wing);
  }
  const wingLight = box(0.04, 0.020, 0.90, MAT.tail, 0.15, 0.020, 0, wing);

  /* Side details */
  {
    for (const x of [0.55, -0.55]) {
      for (const s of [1, -1]) box(0.012, 0.50, 0.008, MAT.black, x, 0.56, s * (HALF_W + 0.002), body);
    }
    for (const s of [1, -1]) {
      box(0.22, 0.024, 0.026, MAT.chrome, 0.30, 0.72, s * (HALF_W + 0.008), body);
    }
    for (const s of [1, -1]) {
      const arm = box(0.09, 0.028, 0.14, MAT.paintDk, 0.68, 0.92, s * 0.94, body);
      arm.rotation.y = -s * 0.22;
      const shell = box(0.11, 0.055, 0.10, MAT.paint, 0.68, 0.965, s * 1.03, body);
      shell.rotation.y = -s * 0.10;
      box(0.015, 0.045, 0.08, MAT.glass, 0.635, 0.965, s * 1.03, body);
    }
    for (const s of [1, -1]) box(1.95, 0.075, 0.10, MAT.carbon, -0.05, 0.235, s * 0.965, body);

    const cap = cyl(0.075, 0.075, 0.012, 10, MAT.paintDk, -0.95, 0.72, HALF_W + 0.002, body);
    cap.rotation.x = Math.PI / 2;

    const scoop = box(0.24, 0.055, 0.42, MAT.paintDk, -0.92, 1.235, 0, body);
    scoop.rotation.z = -0.18;

    for (let i = 0; i < 2; i++) {
      const w = box(0.42, 0.010, 0.014, MAT.black,
        0.72 - i * 0.06, 0.865 + i * 0.012, -0.30 + i * 0.60, body);
      w.rotation.y = 0.24;
    }
  }

  /* Arch trim */
  for (const ax of [AXLE_F, AXLE_R]) {
    for (const s of [1, -1]) {
      const t = new THREE.Mesh(
        new THREE.TorusGeometry(ARCH_R + 0.010, 0.028, 4, 14, Math.PI),
        MAT.carbon
      );
      t.position.set(ax, WHEEL_R, s * (HALF_W + 0.006));
      body.add(t);
    }
  }

  /* ── Wheels (axle along Z, spinZ tagged) ────────────────── */
  function makeWheel() {
    const g = new THREE.Group();

    const tireGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.295, 22, 1, false);
    tireGeo.rotateX(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, [MAT.tireSide, MAT.rubber, MAT.rubber]);
    g.add(tire);

    const rimGeo = new THREE.CylinderGeometry(0.265, 0.265, 0.305, 22, 1, false);
    rimGeo.rotateX(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, [MAT.rimSide, MAT.rimFace, MAT.rimFace]);
    g.add(rim);

    return g;
  }

  const wheelPos = [
    [ AXLE_F,  0.82, true ], [ AXLE_F, -0.82, true ],
    [ AXLE_R,  0.82, false], [ AXLE_R, -0.82, false]
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
    new THREE.PlaneGeometry(8.4, 4.4),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.96 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  shadow.renderOrder = -1;
  car3d.add(shadow);

  car3d.userData.wheels = wheels;
  car3d.userData.wing = wing;
  car3d.userData.wingLight = wingLight;
  return car3d;
}
