/* airport/interior.js -- Omagwa Airport · Terminal 3 in THIRD PERSON.
   Full reference Terminal 3 layout (check-in counters, departure
   boards, security lanes, café, duty free, seating blocks, glass
   curtain wall onto the apron) driven by ThirdPersonControls.
   All static passenger figures have been removed — the terminal is
   empty of people. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import meta from "./meta.js";

function buildTerminal(router) {
  const scene = new THREE.Scene();
  const BG = 0xc2d8ea;
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 55, 175);

  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 320);
  camera.rotation.order = "YXZ";

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a94a3, 1.9));
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const sun = new THREE.DirectionalLight(0xfff3e0, 1.6);
  sun.position.set(40, 55, -25);
  scene.add(sun);

  const W = 36, L = 120, H = 7.6, HW = W * 0.5, HL = L * 0.5;

  /* Terminal ceiling lights: StreetLights fades these in at dusk (they are
     PointLights above 2.5 m), so the hall stays bright after dark while
     the sky and apron outside follow the day/night clock. */
  for (let lz = -HL + 12; lz <= HL - 11; lz += 24) {       /* 5 lights keeps the shader cheap */
    const cl = new THREE.PointLight(0xfff0d8, 34, 42, 1.6);
    cl.position.set(0, H - 1.0, lz);
    scene.add(cl);
  }

  function makeFloorTexture() {
    const S = 512, cv = document.createElement("canvas");
    cv.width = cv.height = S;
    const g = cv.getContext("2d");
    g.fillStyle = "#b9c0c9"; g.fillRect(0, 0, S, S);
    const T = 128;
    for (let ty = 0; ty < 4; ty++) {
      for (let tx = 0; tx < 4; tx++) {
        const v = 206 + ((tx * 47 + ty * 29) % 22);
        g.fillStyle = `rgb(${v},${v + 4},${v + 9})`;
        g.fillRect(tx * T + 2, ty * T + 2, T - 4, T - 4);
        g.fillStyle = "rgba(255,255,255,.30)";
        g.fillRect(tx * T + 2, ty * T + 2, T - 4, 2);
      }
    }
    for (let i = 0; i < 5200; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.055})`;
      g.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(4, router.renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  function makeBoardTexture() {
    const cv = document.createElement("canvas");
    cv.width = 1024; cv.height = 512;
    const g = cv.getContext("2d");

    g.fillStyle = "#06101a"; g.fillRect(0, 0, 1024, 512);
    for (let y = 0; y < 512; y += 3) {
      g.fillStyle = "rgba(120,200,255,.035)";
      g.fillRect(0, y, 1024, 1);
    }
    g.fillStyle = "#0e3350"; g.fillRect(0, 0, 1024, 66);
    g.fillStyle = "#7fd4ff";
    g.font = "bold 32px ui-monospace,Menlo,Consolas,monospace";
    g.fillText("DEPARTURES", 26, 45);
    g.font = "bold 20px ui-monospace,Menlo,Consolas,monospace";
    g.fillStyle = "#ffce4a";
    g.fillText("TIME", 26, 100);
    g.fillText("FLIGHT", 140, 100);
    g.fillText("DESTINATION", 300, 100);
    g.fillText("GATE", 700, 100);
    g.fillText("STATUS", 810, 100);
    g.fillStyle = "#204a68"; g.fillRect(20, 112, 984, 2);

    const rows = [
      ["08:15", "AI 302", "LONDON HEATHROW", "A12", "BOARDING"],
      ["08:40", "EK 004", "DUBAI INTL", "B04", "ON TIME"],
      ["09:05", "SQ 231", "SINGAPORE", "A07", "ON TIME"],
      ["09:20", "LH 761", "FRANKFURT", "C02", "DELAYED"],
      ["09:55", "QF 002", "SYDNEY", "B11", "ON TIME"],
      ["10:10", "AF 083", "PARIS CDG", "A03", "BOARDING"],
      ["10:45", "NH 106", "TOKYO HANEDA", "C09", "ON TIME"],
      ["11:00", "DL 042", "NEW YORK JFK", "B07", "GATE OPEN"],
      ["11:30", "TK 199", "ISTANBUL", "A15", "ON TIME"],
      ["12:00", "BA 118", "LONDON CITY", "C05", "CHECK-IN"]
    ];
    g.font = "20px ui-monospace,Menlo,Consolas,monospace";
    rows.forEach((r, i) => {
      const y = 150 + i * 34;
      if (i % 2 === 0) {
        g.fillStyle = "rgba(40,90,130,.20)";
        g.fillRect(20, y - 22, 984, 32);
      }
      g.fillStyle = "#9fd8f2"; g.fillText(r[0], 26, y);
      g.fillStyle = "#ffffff"; g.fillText(r[1], 140, y);
      g.fillStyle = "#d3e7f5"; g.fillText(r[2], 300, y);
      g.fillStyle = "#ffce4a"; g.fillText(r[3], 700, y);
      g.fillStyle = r[4] === "DELAYED" ? "#ff7b6b"
                  : r[4] === "BOARDING" ? "#7dffa8" : "#9fd8f2";
      g.fillText(r[4], 810, y);
    });

    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(4, router.renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  const M = {
    wall:      new THREE.MeshLambertMaterial({ color: 0xe4e8ed }),
    wallPanel: new THREE.MeshLambertMaterial({ color: 0xcfd5dd }),
    wallDark:  new THREE.MeshLambertMaterial({ color: 0x8d959d }),
    ceiling:   new THREE.MeshLambertMaterial({ color: 0x99a1aa }),
    beam:      new THREE.MeshLambertMaterial({ color: 0x6b737b }),
    metal:     new THREE.MeshLambertMaterial({ color: 0xa7afb7 }),
    darkMetal: new THREE.MeshLambertMaterial({ color: 0x4a5259 }),
    light:     new THREE.MeshBasicMaterial({ color: 0xfff8e8 }),
    glass:     new THREE.MeshBasicMaterial({ color: 0xc8e6f5, transparent: true, opacity: 0.10, depthWrite: false, fog: false }),
    blue:      new THREE.MeshLambertMaterial({ color: 0x2d5f8f }),
    blueDark:  new THREE.MeshLambertMaterial({ color: 0x1c3f61 }),
    white:     new THREE.MeshLambertMaterial({ color: 0xf1f4f7 }),
    seat:      new THREE.MeshLambertMaterial({ color: 0x27476e }),
    green:     new THREE.MeshLambertMaterial({ color: 0x3e7a45 }),
    greenDark: new THREE.MeshLambertMaterial({ color: 0x2a5a30 }),
    brown:     new THREE.MeshLambertMaterial({ color: 0x7a5a3c }),
    red:       new THREE.MeshLambertMaterial({ color: 0xa83c3c }),
    yellow:    new THREE.MeshLambertMaterial({ color: 0xd9b53c }),
    concrete:  new THREE.MeshLambertMaterial({ color: 0x9da4ac }),
    asphalt:   new THREE.MeshLambertMaterial({ color: 0x4a4f56 }),
    planeBody: new THREE.MeshLambertMaterial({ color: 0xeef2f6 }),
    planeTail: new THREE.MeshLambertMaterial({ color: 0x2a5f9e }),
  };

  const BUCKETS = new Map();
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(),
        _v3 = new THREE.Vector3(), _s3 = new THREE.Vector3(1, 1, 1),
        _eu = new THREE.Euler();

  function push(geo, mat) {
    let a = BUCKETS.get(mat);
    if (!a) { a = []; BUCKETS.set(mat, a); }
    a.push(geo);
  }
  function xform(g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _eu.set(rx, ry, rz);
    _q.setFromEuler(_eu);
    _v3.set(x, y, z); _s3.set(sx, sy, sz);
    _m4.compose(_v3, _q, _s3);
    g.applyMatrix4(_m4);
    return g;
  }
  function box(w, h, d, x, y0, z, mat, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    push(xform(g, x, y0 + h * 0.5, z, 0, ry, 0), mat);
  }
  function cyl(rTop, rBot, h, x, y0, z, mat, seg = 8, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1);
    push(xform(g, x, y0 + h * 0.5, z, rx, ry, rz), mat);
  }
  function cylZ(r, len, x, y, z, mat, seg = 8) {
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
    g.rotateX(Math.PI / 2);
    push(xform(g, x, y, z), mat);
  }
  const colliders = [];
  function collider(x0, x1, z0, z1) { colliders.push({ x0, x1, z0, z1 }); }
  const seats = [];

  /* Floor */
  {
    const floorTex = makeFloorTexture();
    floorTex.repeat.set(9, 30);
    const g = new THREE.PlaneGeometry(W, L);
    g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: floorTex }));
    scene.add(mesh);
  }
  box(9, 0.03, L - 4, 0, 0, 0, M.wallDark);
  box(0.12, 0.04, L - 4, 15.2, 0, 0, M.yellow);
  box(0.12, 0.04, L - 4, 15.8, 0, 0, M.yellow);

  /* Ceiling */
  {
    const g = new THREE.PlaneGeometry(W, L);
    g.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(g, M.ceiling);
    mesh.position.y = H;
    scene.add(mesh);
  }
  for (let z = -HL + 4; z <= HL - 4; z += 8) box(W, 0.5, 0.45, 0, H - 0.5, z, M.beam);
  cylZ(0.35, L - 2, -9.5, H - 0.95, 0, M.metal, 8);
  cylZ(0.35, L - 2,  9.5, H - 0.95, 0, M.metal, 8);
  for (let x = -13.5; x <= 13.5; x += 6.75) {
    for (let z = -HL + 4; z <= HL - 4; z += 8) {
      box(1.35, 0.5, 5.7, x, H - 0.5, z, M.beam);
      box(1.00, 0.14, 5.2, x, H - 0.62, z, M.light);
    }
  }

  /* Walls */
  box(0.45, H, L, -HW - 0.22, 0, 0, M.wall);
  box(0.10, 0.28, L, -HW + 0.01, 3.05, 0, M.blue);
  box(0.10, 0.10, L, -HW + 0.01, 0.30, 0, M.darkMetal);
  for (let z = -HL; z <= HL; z += 4) box(0.10, H - 0.4, 0.10, -HW + 0.02, 0.2, z, M.wallPanel);
  box(W, H, 0.45, 0, 0, -HL - 0.22, M.wall);
  box(W, H, 0.45, 0, 0,  HL + 0.22, M.wall);
  box(W - 2, 1.2, 0.10, 0, 4.6, -HL + 0.01, M.blueDark);
  box(W - 2, 1.2, 0.10, 0, 4.6,  HL - 0.01, M.blueDark);

  /* Right glass wall */
  box(0.7, 0.62, L, HW + 0.05, 0, 0, M.wall);
  box(0.32, 0.32, L, HW, H - 0.20, 0, M.metal);
  box(0.22, 0.22, L, HW, 3.55, 0, M.metal);
  for (let z = -HL; z <= HL; z += 4) box(0.30, H - 0.62, 0.30, HW, 0.62, z, M.metal);
  {
    const g = new THREE.PlaneGeometry(L, H - 0.62);
    g.rotateY(-Math.PI / 2);
    push(xform(g, HW + 0.02, 0.62 + (H - 0.62) * 0.5, 0), M.glass);
  }
  collider(HW - 0.6, HW + 3, -HL, HL);

  /* Columns */
  for (let z = -50; z <= 50; z += 20) {
    for (const x of [-13.5, 13.5]) {
      box(1.0, H, 1.0, x, 0, z, M.wallPanel);
      box(1.4, 0.35, 1.4, x, 0, z, M.darkMetal);
      box(1.3, 0.25, 1.3, x, H - 0.6, z, M.metal);
      collider(x - 0.6, x + 0.6, z - 0.6, z + 0.6);
    }
  }

  /* Check-in counters */
  for (let i = 0; i < 10; i++) {
    const z = 11 + i * 4.1;
    box(1.00, 1.15, 3.50, -16.3, 0, z, M.blue);
    box(1.30, 0.12, 3.85, -16.15, 1.15, z, M.white);
    box(0.22, 2.90, 3.50, -17.75, 0.40, z, M.blueDark);
    box(0.14, 0.90, 2.10, -17.58, 2.05, z, M.white);
    box(0.10, 0.42, 0.62, -17.55, 1.35, z, M.darkMetal);
    box(0.06, 0.34, 0.52, -17.48, 1.39, z, M.light);
    box(0.40, 0.10, 1.10, -16.55, 1.27, z, M.darkMetal);
    collider(-18, -15.5, z - 1.95, z + 1.95);
  }
  for (let i = 0; i < 10; i++) {
    const z = 11 + i * 4.1;
    cyl(0.09, 0.11, 0.95, -14.6, 0, z - 1.6, M.metal, 6);
    cyl(0.09, 0.11, 0.95, -14.6, 0, z + 1.6, M.metal, 6);
    box(0.05, 0.05, 3.2, -14.6, 0.92, z, M.darkMetal);
  }

  /* Departure boards */
  {
    const bt = makeBoardTexture();
    const boardMat = new THREE.MeshBasicMaterial({ map: bt });
    const g = new THREE.PlaneGeometry(11, 3.4);
    const m = new THREE.Mesh(g, boardMat);
    m.position.set(-HW + 0.04, 4.6, 24);
    m.rotation.y = Math.PI / 2;
    scene.add(m);

    const g2 = new THREE.PlaneGeometry(8, 2.5);
    const m2 = new THREE.Mesh(g2, boardMat);
    m2.position.set(-HW + 0.04, 4.6, -24);
    m2.rotation.y = Math.PI / 2;
    scene.add(m2);

    box(0.16, 3.8, 11.6, -HW + 0.10, 2.7, 24, M.darkMetal);
    box(0.16, 2.9,  8.6, -HW + 0.10, 3.15, -24, M.darkMetal);
  }

  /* Seating blocks */
  function seatRow(cx, cz, count) {
    const w = 0.58;
    for (let i = 0; i < count; i++) {
      const z = cz + (i - (count - 1) / 2) * w;
      box(0.62, 0.12, w - 0.07, cx,        0.42, z, M.seat);
      box(0.14, 0.62, w - 0.07, cx - 0.33, 0.52, z, M.seat);
      box(0.10, 0.42, 0.09,    cx - 0.05,  0.00, z, M.metal);
      box(0.10, 0.42, 0.09,    cx + 0.25,  0.00, z, M.metal);
      /* Sit target: seat pan is at y=0.42, so hip height is roughly
         0.42 + half the pan thickness; chair faces +x (away from the
         backrest, which sits on the -x side at cx-0.33). */
      seats.push({
        type: "sit", label: "SIT", x: cx + 0.08, z, dx: 1, dz: 0,
        yaw: Math.atan2(1, 0), h: 0.46, level: 0, taken: false,
      });
    }
    box(0.10, 0.09, count * w, cx - 0.16, 0.34, cz, M.metal);
    collider(cx - 0.55, cx + 0.45, cz - count * w / 2 - 0.1, cz + count * w / 2 + 0.1);
  }
  const rowsA = [-44, -37, -30, 8, 15, 22, 29, 36, 43];
  for (const z of rowsA) seatRow(-1.5, z, 5);
  const rowsB = [-40, -33, 4, 11, 18, 25, 32, 39, 46];
  for (const z of rowsB) seatRow(5.0, z, 5);

  /* Security lanes */
  for (const x of [-6, 6]) {
    box(0.16, 2.25, 0.55, x - 0.80, 0, -14, M.darkMetal);
    box(0.16, 2.25, 0.55, x + 0.80, 0, -14, M.darkMetal);
    box(1.90, 0.22, 0.55, x, 2.25, -14, M.metal);
    box(1.55, 0.10, 0.42, x, 2.30, -14, M.blue);
    collider(x - 0.95, x - 0.65, -14.35, -13.65);
    collider(x + 0.65, x + 0.95, -14.35, -13.65);

    box(1.90, 1.55, 3.10, x, 0, -18.2, M.wallDark);
    box(0.10, 0.85, 0.95, x - 0.98, 0.35, -18.2, M.darkMetal);
    box(1.95, 0.10, 3.20, x, 1.55, -18.2, M.metal);
    collider(x - 1.05, x + 1.05, -19.85, -16.55);

    box(1.40, 0.55, 2.40, x, 0, -16.2, M.metal);
    for (let i = 0; i < 6; i++)
      cylZ(0.10, 1.30, x, 0.62, -17.3 + i * 0.42, M.darkMetal, 6);
  }

  /* Café */
  {
    box(1.60, 1.10, 7.00, -16.6, 0, -38, M.brown);
    box(1.90, 0.12, 7.30, -16.5, 1.10, -38, M.white);
    box(0.16, 3.10, 7.00, -17.75, 0.30, -38, M.brown);
    box(2.20, 0.14, 7.40, -16.4, 3.30, -38, M.red);
    box(2.20, 0.14, 7.40, -16.4, 3.10, -38, M.white);
    box(0.90, 0.55, 3.00, -16.4, 1.22, -38, M.glass);
    collider(-18, -15.6, -41.8, -34.2);
    for (let i = 0; i < 4; i++) {
      const z = -34.6 + i * 2.2;
      cyl(0.09, 0.11, 0.72, -11.6, 0, z, M.darkMetal, 6);
      cyl(0.42, 0.42, 0.07, -11.6, 0.72, z, M.white, 10);
      cyl(0.24, 0.24, 0.50, -10.5, 0, z, M.red, 8);
      cyl(0.24, 0.24, 0.50, -12.7, 0, z, M.red, 8);
      collider(-12.1, -11.1, z - 0.5, z + 0.5);
    }
  }

  /* Duty free */
  {
    box(1.20, 2.20, 9.00, -17.1, 0, -52, M.blueDark);
    box(1.40, 0.16, 9.30, -17.1, 2.20, -52, M.blue);
    for (let r = 0; r < 3; r++) {
      box(1.10, 0.08, 8.60, -16.6, 0.55 + r * 0.75, -52, M.white);
      for (let i = 0; i < 9; i++) {
        const z = -56.1 + i * 1.0;
        box(0.30, 0.30, 0.30, -16.6, 0.63 + r * 0.75, z, i % 3 === 0 ? M.yellow : (i % 3 === 1 ? M.red : M.white));
      }
    }
    collider(-18, -15.9, -57, -47);
  }

  /* Hanging signs */
  const signColors = [M.blue, M.red, M.green];
  for (let i = 0; i < 6; i++) {
    const z = -50 + i * 20;
    const mat = signColors[i % 3];
    box(0.08, 0.85, 3.6, -1, H - 2.9, z, mat);
    box(0.08, 0.85, 3.6,  1, H - 2.9, z, mat);
    box(0.85, 0.85, 0.10, 0, H - 2.9, z - 1.85, mat);
    box(0.85, 0.85, 0.10, 0, H - 2.9, z + 1.85, mat);
    cyl(0.03, 0.03, 1.1, 0, H - 3.75, z, M.darkMetal, 4);
  }

  /* Planters */
  const potPos = [[-9, -46], [-9, -10], [-9, 26], [-9, 52], [9, -46], [9, -8], [9, 28], [9, 52]];
  for (const [x, z] of potPos) {
    cyl(0.72, 0.60, 0.70, x, 0, z, M.wallDark, 8);
    cyl(0.62, 0.62, 0.06, x, 0.68, z, M.brown, 8);
    const f = new THREE.IcosahedronGeometry(0.85, 0);
    push(xform(f, x, 1.35, z), M.green);
    const f2 = new THREE.IcosahedronGeometry(0.62, 0);
    push(xform(f2, x + 0.35, 1.85, z - 0.2), M.greenDark);
    collider(x - 0.75, x + 0.75, z - 0.75, z + 0.75);
  }

  /* Bins */
  for (const [x, z] of [[-8, -20], [-8, 14], [-8, 44], [8, -24], [8, 10], [8, 40]]) {
    cyl(0.28, 0.24, 0.85, x, 0, z, M.darkMetal, 8);
    cyl(0.30, 0.30, 0.06, x, 0.85, z, M.metal, 8);
    collider(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
  }

  /* Apron + aircraft (no passengers) */
  box(74, 0.12, 320, 55, -0.12, 0, M.concrete);
  box(26, 0.04, 320, 112, 0.0, 0, M.asphalt);
  for (let z = -140; z <= 140; z += 18) box(0.7, 0.05, 9, 112, 0.05, z, M.white);
  for (let z = -140; z <= 140; z += 14) box(12, 0.05, 0.7, 60, 0.05, z, M.yellow);

  function airplane(px, pz, ry) {
    const base = new THREE.Matrix4().makeRotationY(ry).setPosition(px, 0, pz);
    const add = (geo, mat) => { geo.applyMatrix4(base); push(geo, mat); };

    const fus = new THREE.CylinderGeometry(1.9, 1.9, 26, 10, 1);
    fus.rotateX(Math.PI / 2); fus.translate(0, 3.2, 0);
    add(fus, M.planeBody);

    const nose = new THREE.CylinderGeometry(0.18, 1.9, 3.6, 10, 1);
    nose.rotateX(-Math.PI / 2); nose.translate(0, 3.2, -14.8);
    add(nose, M.planeBody);

    const tail = new THREE.CylinderGeometry(1.9, 0.35, 4.2, 10, 1);
    tail.rotateX(-Math.PI / 2); tail.translate(0, 3.2, 15.1);
    add(tail, M.planeBody);

    const wing = new THREE.BoxGeometry(31, 0.55, 5.6); wing.translate(0, 3.05, 0.8);
    add(wing, M.planeBody);
    const wl1 = new THREE.BoxGeometry(0.4, 1.6, 3.0); wl1.translate( 15.3, 4.0, 0.8);
    add(wl1, M.planeTail);
    const wl2 = new THREE.BoxGeometry(0.4, 1.6, 3.0); wl2.translate(-15.3, 4.0, 0.8);
    add(wl2, M.planeTail);

    for (const ex of [-7.5, 7.5]) {
      const eng = new THREE.CylinderGeometry(1.0, 1.0, 3.4, 8, 1);
      eng.rotateX(Math.PI / 2); eng.translate(ex, 2.15, 0.8);
      add(eng, M.planeBody);
      const pyl = new THREE.BoxGeometry(0.5, 1.0, 2.4); pyl.translate(ex, 2.7, 0.8);
      add(pyl, M.metal);
    }

    const vs = new THREE.BoxGeometry(0.55, 5.6, 3.6); vs.translate(0, 7.0, 12.6);
    add(vs, M.planeTail);
    const hs = new THREE.BoxGeometry(10.5, 0.4, 2.8); hs.translate(0, 3.4, 13.2);
    add(hs, M.planeBody);

    const band = new THREE.BoxGeometry(0.08, 0.35, 20); band.translate(-1.92, 3.8, 0);
    add(band, M.darkMetal);
    const band2 = new THREE.BoxGeometry(0.08, 0.35, 20); band2.translate(1.92, 3.8, 0);
    add(band2, M.darkMetal);
  }
  airplane(50, -22, 0);
  airplane(56,  34, 0.06);

  // FIXED: Extended jet bridge so it connects terminal (x=18) to plane (x=50)
  for (const z of [-22, 34]) {
    box(32, 2.9, 2.7, 34, 2.6, z, M.metal);
    box(32, 0.25, 2.9, 34, 5.5, z, M.wallDark);
    box(1.0, 2.6, 1.0, 18, 0, z - 2.0, M.darkMetal);
    box(1.0, 2.6, 1.0, 18, 0, z + 2.0, M.darkMetal);
    box(1.0, 2.6, 1.0, 50, 0, z - 2.0, M.darkMetal);
    box(1.0, 2.6, 1.0, 50, 0, z + 2.0, M.darkMetal);
  }
  for (const [x, z] of [[38, -8], [40, 20], [34, 48]]) {
    box(2.6, 1.1, 5.0, x, 0.3, z, M.yellow);
    box(2.2, 0.9, 1.8, x, 1.4, z - 1.3, M.wallDark);
    cylZ(0.42, 0.30, x - 1.3, 0.42, z - 1.6, M.darkMetal, 6);
    cylZ(0.42, 0.30, x + 1.3, 0.42, z - 1.6, M.darkMetal, 6);
  }

  /* Merge */
  let tris = 0;
  for (const [mat, geos] of BUCKETS) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    for (const g of geos) g.dispose();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    scene.add(mesh);
    tris += merged.index ? merged.index.count / 3 : merged.attributes.position.count / 3;
  }
  console.log(`[airport] ${BUCKETS.size} merged meshes · ${tris | 0} triangles`);

  /* Convert colliders */
  const collidersTp = [];
  for (const c of colliders) {
    collidersTp.push({ minX: c.x0, maxX: c.x1, minZ: c.z0, maxZ: c.z1, level: 0 });
  }

  const world = {
    colliders: collidersTp,
    seats: seats,
    uses: [],
    platforms: [],
    levelHeight: () => 0,
    bounds: { minX: -HW + 1.0, maxX: HW - 1.0, minZ: -HL + 1.2, maxZ: HL - 1.2 },
  };

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, world, {
    scene,
    x: 0, z: 50, yaw: 0, level: 0,
    speedMult: 1.0,
    onUse: (use) => {
      if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE");
    },
  });

  return {
  three: scene,
  camera,
  controls: { update: () => {} },
  crumb: meta.name,
  title: "TERMINAL 3",
  subtitle: meta.sub || "",
  hint: "",
  isInterior: true,
  sceneId: "airport",
  update: (dt) => { ctl.update(dt); },
  dispose: () => { ctl.dispose(); },
};
}

export async function buildInterior(router) {
  return buildTerminal(router);
}
