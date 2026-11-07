/* canteen/interior.js -- converted from standalone "Canteen 3D".
   World code is the prototype's own; its first-person controls, renderer and
   loop were removed and replaced by the game's ThirdPersonControls. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";

export async function buildInterior(router) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe6ea);
  scene.fog = new THREE.Fog(0xd9e2e6, 24, 58);
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 80);
  camera.rotation.order = "YXZ";

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8a894, 1.05));
  const sun = new THREE.DirectionalLight(0xfff2dd, 0.55); sun.position.set(10, 16, 8); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xd6e8ff, 0.28); fill.position.set(-12, 9, -10); scene.add(fill);

  /* ---- procedural textures ---- */
  function makeTex(w, h, draw, repeat) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 2;
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    return t;
  }
  const floorTex = makeTex(256, 256, (g, w, h) => {
    const t = 128;
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = ((x + y) % 2) ? "#c9c5bb" : "#b4b0a6"; g.fillRect(x * t, y * t, t, t); }
    for (let i = 0; i < 700; i++) {
      const x = Math.random() * w, y = Math.random() * h, s = Math.random() * 2 + 1;
      g.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,.22)" : "rgba(40,38,34,.16)"; g.fillRect(x, y, s, s);
    }
    g.strokeStyle = "rgba(88,84,78,.55)"; g.lineWidth = 3;
    for (let i = 0; i <= 2; i++) {
      g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * t); g.lineTo(w, i * t); g.stroke();
    }
  }, [13, 11]);
  const woodTex = makeTex(128, 128, (g, w, h) => {
    g.fillStyle = "#c89b6a"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) {
      const y = Math.random() * h;
      g.strokeStyle = `rgba(${110 + Math.random() * 50 | 0},${72 + Math.random() * 34 | 0},${38 + Math.random() * 30 | 0},.22)`;
      g.lineWidth = 1 + Math.random() * 2.4;
      g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(w * .33, y + (Math.random() - .5) * 12, w * .66, y + (Math.random() - .5) * 12, w, y + (Math.random() - .5) * 7);
      g.stroke();
    }
  });
  const blobTex = makeTex(64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grd.addColorStop(0, "rgba(0,0,0,.58)"); grd.addColorStop(.55, "rgba(0,0,0,.24)"); grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  blobTex.wrapS = blobTex.wrapT = THREE.ClampToEdgeWrapping;
  const skyTex = makeTex(64, 64, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#b9ddff"); grd.addColorStop(.55, "#e6f3ff"); grd.addColorStop(1, "#dcecdd");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  skyTex.wrapS = skyTex.wrapT = THREE.ClampToEdgeWrapping;
  const menuTex = makeTex(512, 128, (g, w, h) => {
    g.fillStyle = "#1c2127"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#c8a24a"; g.lineWidth = 5; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = "#f6ecd0"; g.font = "bold 27px sans-serif"; g.textAlign = "center"; g.fillText("TODAY'S MENU", w / 2, 40);
    g.font = "17px sans-serif"; g.textAlign = "left"; g.fillStyle = "#ded2b0";
    g.fillText("Beef Stew ........ 6.50      Pasta Primavera ... 5.50", 34, 76);
    g.fillText("Grilled Chicken .. 7.00      Caesar Salad ...... 4.75", 34, 102);
  });
  menuTex.wrapS = menuTex.wrapT = THREE.ClampToEdgeWrapping;

  const unitBox = new THREE.BoxGeometry(1, 1, 1), unitPlane = new THREE.PlaneGeometry(1, 1);
  const unitCyl = new THREE.CylinderGeometry(.5, .5, 1, 10), unitCyl6 = new THREE.CylinderGeometry(.5, .5, 1, 6);
  const unitIco = new THREE.IcosahedronGeometry(.5, 0);

  /* ---- instanced batcher ---- */
  const _o = new THREE.Object3D();
  class Batch {
    constructor(geo, mat) { this.geo = geo; this.mat = mat; this.mats = []; this.cols = null; }
    add(x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, color = null, rx = 0, rz = 0) {
      _o.position.set(x, y, z); _o.rotation.set(rx, ry, rz); _o.scale.set(sx, sy, sz); _o.updateMatrix();
      this.mats.push(_o.matrix.clone());
      if (color !== null) (this.cols || (this.cols = [])).push(color instanceof THREE.Color ? color.clone() : new THREE.Color(color));
      return this;
    }
    build() {
      const n = this.mats.length; if (!n) return null;
      const im = new THREE.InstancedMesh(this.geo, this.mat, n);
      for (let i = 0; i < n; i++) im.setMatrixAt(i, this.mats[i]);
      im.instanceMatrix.needsUpdate = true;
      if (this.cols && this.cols.length === n) { for (let i = 0; i < n; i++) im.setColorAt(i, this.cols[i]); im.instanceColor.needsUpdate = true; }
      im.frustumCulled = false; scene.add(im); this.mats.length = 0; return im;
    }
  }
  function place(b, px, py, pz, lx, ly, lz, sx, sy, sz, ry, color) {
    const c = Math.cos(ry), s = Math.sin(ry);
    b.add(px + lx * c + lz * s, py + ly, pz - lx * s + lz * c, sx, sy, sz, ry, color || null);
  }

  const M = {
    floor: new THREE.MeshPhongMaterial({ map: floorTex, shininess: 14, specular: 0x2a2a2a }),
    ceil: new THREE.MeshLambertMaterial({ color: 0xf4f2ec }), wall: new THREE.MeshLambertMaterial({ color: 0xece6da }),
    dado: new THREE.MeshLambertMaterial({ color: 0xc9c0ae }), trim: new THREE.MeshLambertMaterial({ color: 0x7d7568 }),
    frame: new THREE.MeshLambertMaterial({ color: 0xf2f2f0 }),
    glass: new THREE.MeshPhongMaterial({ color: 0xbfe4f0, transparent: true, opacity: .18, shininess: 90, specular: 0xffffff, depthWrite: false, side: THREE.DoubleSide }),
    wood: new THREE.MeshPhongMaterial({ map: woodTex, shininess: 16, specular: 0x333333 }),
    metal: new THREE.MeshLambertMaterial({ color: 0x9aa1a8 }), dark: new THREE.MeshLambertMaterial({ color: 0x3d4247 }),
    chair: new THREE.MeshLambertMaterial({ color: 0xcf5138 }), counter: new THREE.MeshLambertMaterial({ color: 0x59626e }),
    counterTop: new THREE.MeshLambertMaterial({ color: 0xc7cdd3 }), white: new THREE.MeshLambertMaterial({ color: 0xf0efea }),
    pot: new THREE.MeshLambertMaterial({ color: 0xb5603f }), leaf: new THREE.MeshLambertMaterial({ color: 0x3f7a3a }),
    bin: new THREE.MeshLambertMaterial({ color: 0x4c6b52 }),
    blob: new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: .55, depthWrite: false }),
    sky: new THREE.MeshBasicMaterial({ map: skyTex }), menu: new THREE.MeshBasicMaterial({ map: menuTex }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfffdf0 }), sign: new THREE.MeshBasicMaterial({ color: 0x2fbf6a }),
  };

  /* ---- room shell ---- */
  const HX = 13, HZ = 11, RH = 3.4, T = 0.12;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, HZ * 2), M.floor); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, HZ * 2), M.ceil); ceil.rotation.x = Math.PI / 2; ceil.position.y = RH; scene.add(ceil);

  const wallB = new Batch(unitBox, M.wall);
  const southZ = HZ + T / 2, eastX = HX + T / 2;
  const winZ = [-7.5, -2.5, 2.5, 7.5], winB = 0.95, winT = 2.55;
  wallB.add(0, RH / 2, -HZ - T / 2, HX * 2 + T * 2, RH, T);
  wallB.add(-HX - T / 2, RH / 2, 0, T, RH, HZ * 2 + T * 2);
  const sideW = (HX + T) - 1.7;
  wallB.add(-(1.7 + sideW / 2), RH / 2, southZ, sideW, RH, T);
  wallB.add((1.7 + sideW / 2), RH / 2, southZ, sideW, RH, T);
  wallB.add(0, (2.7 + RH) / 2, southZ, 3.4, RH - 2.7, T);
  wallB.add(eastX, winB / 2, 0, T, winB, HZ * 2 + T * 2);
  wallB.add(eastX, (winT + RH) / 2, 0, T, RH - winT, HZ * 2 + T * 2);
  for (const [a, b] of [[-HZ - T, -8.8], [-6.2, -3.8], [-1.2, 1.2], [3.8, 6.2], [8.8, HZ + T]])
    wallB.add(eastX, (winB + winT) / 2, (a + b) / 2, T, winT - winB, b - a);
  wallB.build();

  const dadoB = new Batch(unitBox, M.dado), trimB = new Batch(unitBox, M.trim);
  function clad(ix, iz, w, d, rot) {
    dadoB.add(ix, 0.55, iz, w, 1.10, d, rot);
    trimB.add(ix, 0.06, iz, w * 1.002, 0.12, d * 1.15, rot);
    trimB.add(ix, 1.13, iz, w * 1.002, 0.06, d * 1.15, rot);
  }
  clad(0, -HZ + 0.012, HX * 2, 0.025); clad(-HX + 0.012, 0, 0.025, HZ * 2); clad(0, HZ - 0.012, HX * 2, 0.025);
  dadoB.build(); trimB.build();

  const frameB = new Batch(unitBox, M.frame), paneB = new Batch(unitPlane, M.sky);
  const ym = (winB + winT) / 2, wh = winT - winB;
  for (const wz of winZ) {
    frameB.add(eastX, winB + .03, wz, .19, .07, 2.7); frameB.add(eastX, winT - .03, wz, .19, .07, 2.7);
    frameB.add(eastX, ym, wz - 1.32, .19, wh, .07); frameB.add(eastX, ym, wz + 1.32, .19, wh, .07);
    frameB.add(eastX, ym, wz, .15, wh, .055); frameB.add(eastX, ym, wz, .15, .05, 2.64);
    paneB.add(eastX, ym, wz, 2.6, wh, 1, -Math.PI / 2);
  }
  frameB.build(); paneB.build();

  const doorB = new Batch(unitBox, M.frame);
  doorB.add(0, 2.72, southZ, 3.7, .1, .2); doorB.add(-1.78, 1.35, southZ, .1, 2.7, .2); doorB.add(1.78, 1.35, southZ, .1, 2.7, .2);
  doorB.add(-.85, 1.35, southZ, .07, 2.7, .16); doorB.add(.85, 1.35, southZ, .07, 2.7, .16);
  doorB.add(-.85, 2.66, southZ, 1.6, .09, .16); doorB.add(.85, 2.66, southZ, 1.6, .09, .16);
  doorB.add(-.85, .07, southZ, 1.6, .14, .16); doorB.add(.85, .07, southZ, 1.6, .14, .16);
  doorB.add(-.28, 1.25, southZ - .09, .05, .5, .05); doorB.add(.28, 1.25, southZ - .09, .05, .5, .05);
  doorB.build();
  const doorGlass = new Batch(unitPlane, M.glass);
  doorGlass.add(-.85, 1.38, southZ, 1.52, 2.5, 1, Math.PI); doorGlass.add(.85, 1.38, southZ, 1.52, 2.5, 1, Math.PI);
  doorGlass.build();
  const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(1.05, .34), M.sign);
  exitSign.position.set(0, 3.02, southZ - .07); exitSign.rotation.y = Math.PI; scene.add(exitSign);

  /* ---- serving counter ---- */
  const CX = -2;
  const cBody = new Batch(unitBox, M.counter), cTop = new Batch(unitBox, M.counterTop);
  cBody.add(CX, .48, -9.00, 14, .96, .90); cTop.add(CX, 1.00, -9.00, 14.2, .08, 1.02);
  cBody.add(CX, .44, -10.62, 14, .88, .62); cTop.add(CX, .90, -10.62, 14.2, .06, .70);
  cBody.add(CX, 1.90, -10.72, 14, .80, .36); cTop.add(CX, 2.32, -10.72, 14, .05, .40);
  cBody.build(); cTop.build();

  const trayB = new Batch(unitBox, M.metal), foodB = new Batch(unitBox, new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const foodCols = [0xf2e8cf, 0x8d3b2c, 0x6d9440, 0xd9b25c, 0xcf7a35, 0xd8c08a];
  for (let i = 0; i < 6; i++) { const x = -8 + i * 2.3; trayB.add(x, 1.07, -9.0, 1.5, .06, .72); foodB.add(x, 1.13, -9.0, 1.3, .10, .56, 0, foodCols[i]); }
  trayB.build(); foodB.build();

  const guardB = new Batch(unitBox, M.glass);
  guardB.add(CX, 1.75, -8.60, 13.8, .42, .03); guardB.add(-8.9, 1.75, -9.0, .03, .42, 1.0); guardB.add(4.9, 1.75, -9.0, .03, .42, 1.0);
  guardB.build();
  const postB = new Batch(unitCyl, M.metal);
  for (const x of [-8.5, -4.5, -0.5, 3.5, 4.6]) postB.add(x, 1.50, -8.60, .045, .92, .045);
  postB.build();
  const plateB = new Batch(unitCyl, M.white);
  for (let s = 0; s < 3; s++) for (let j = 0; j < 8; j++) plateB.add(-8.2 + s * 0.55, .95 + j * .034, -10.60, .24, .02, .24);
  plateB.build();
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.15), M.menu); menu.position.set(CX, 2.88, -10.96); scene.add(menu);

  /* ---- tables / chairs / props ---- */
  const tableXs = [-8, -4, 0, 4, 8], tableZs = [-5, -1, 3, 7];
  const topB = new Batch(unitBox, M.wood), tlegB = new Batch(unitCyl6, M.dark);
  const seatB = new Batch(unitBox, M.chair), backB = new Batch(unitBox, M.chair), clegB = new Batch(unitBox, M.dark);
  const blobB = new Batch(unitPlane, M.blob);
  const trayPB = new Batch(unitBox, new THREE.MeshLambertMaterial({ color: 0x9a3f33 }));
  const plateP = new Batch(unitCyl, M.white), cupPB = new Batch(unitCyl, new THREE.MeshLambertMaterial({ color: 0xf4f4f0 }));

  const solid = [], seats = [], uses = [];
  const addCollider = (x, z, hx, hz) => solid.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });

  for (const tx of tableXs) for (const tz of tableZs) {
    topB.add(tx, .75, tz, 1.70, .07, .95);
    for (const dx of [-.72, .72]) for (const dz of [-.36, .36]) tlegB.add(tx + dx, .36, tz + dz, .07, .72, .07);
    for (const side of [-1, 1]) for (const dx of [-.45, .45]) {
      const cx = tx + dx, cz = tz + side * 0.80, ry = side < 0 ? 0 : Math.PI;
      place(seatB, cx, 0, cz, 0, .46, 0, .44, .05, .44, ry);
      place(backB, cx, 0, cz, 0, .70, -.20, .44, .40, .05, ry);
      for (const lx of [-.18, .18]) for (const lz of [-.18, .18]) place(clegB, cx, 0, cz, lx, .23, lz, .035, .46, .035, ry);
      seats.push({ type: "sit", label: "SIT", x: cx, z: cz, yaw: side < 0 ? 0 : Math.PI, h: 0.46, level: 0, taken: false });
    }
    blobB.add(tx, .02, tz, 2.7, 2.9, 1, 0, null, -Math.PI / 2);
    trayPB.add(tx, .795, tz, .44, .022, .31); plateP.add(tx - .13, .815, tz + .02, .21, .02, .21); cupPB.add(tx + .15, .83, tz - .06, .085, .10, .085);
    addCollider(tx, tz, .85, 1.02);
  }
  topB.build(); tlegB.build(); seatB.build(); backB.build(); clegB.build(); blobB.build(); trayPB.build(); plateP.build(); cupPB.build();

  const lampB = new Batch(unitBox, M.lamp);
  for (const x of [-9, -3, 3, 9]) for (const z of [-7, -2.5, 2, 6.5]) lampB.add(x, RH - .06, z, 1.8, .10, .70);
  lampB.build();

  const potB = new Batch(unitCyl, M.pot), leafB = new Batch(unitIco, M.leaf), binB = new Batch(unitCyl, M.bin);
  for (const [x, z] of [[-11.6, 9.4], [11.4, 9.4], [11.4, -9.2], [-11.6, -9.2]]) {
    potB.add(x, .35, z, .52, .70, .52);
    leafB.add(x, 1.05, z, 1.05, 1.0, 1.05); leafB.add(x - .18, 1.32, z + .10, .78, .78, .78); leafB.add(x + .20, 1.24, z - .12, .70, .70, .70);
    addCollider(x, z, .34, .34);
  }
  potB.build(); leafB.build();
  for (const [x, z] of [[6.6, -8.3], [-10.6, -8.3], [11.6, 2.0]]) {
    binB.add(x, .42, z, .50, .84, .50); binB.add(x, .87, z, .54, .06, .54); addCollider(x, z, .30, .30);
  }
  binB.build();
  addCollider(CX, -9.00, 7.10, .55); addCollider(CX, -10.62, 7.10, .40);

  uses.push({ kind: "use", label: "ORDER A MEAL", x: CX, z: -7.6, y: 0, level: 0, r: 2.2 });

  /* ======== game glue ======== */
  const START = { x: 0, z: 8.4, yaw: 0 };
  /* Solid wall colliders (thick, outward) so the camera can't sink through and NPCs can't enter walls. Door gap at south stays open. */
  { const W = 3, e = 0.0;
    solid.push({ minX: -HX - W, maxX: HX + W, minZ: -HZ - W, maxZ: -HZ + e });   /* north */
    solid.push({ minX: -HX - W, maxX: -HX + e, minZ: -HZ - W, maxZ: HZ + W });   /* west */
    solid.push({ minX: HX - e, maxX: HX + W, minZ: -HZ - W, maxZ: HZ + W });     /* east */
    solid.push({ minX: -HX - W, maxX: -1.7, minZ: HZ - e, maxZ: HZ + W });       /* south L */
    solid.push({ minX: 1.7, maxX: HX + W, minZ: HZ - e, maxZ: HZ + W });         /* south R */
  }
  const __cols = solid.map((b) => ({ minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, y0: 0, y1: 60, level: 0 }));
  const __world = {
    colliders: __cols, seats, uses, stairs: [], platforms: [], levelHeight: () => 0,
    bounds: { minX: -HX + 0.3, maxX: HX - 0.3, minZ: -HZ + 0.3, maxZ: HZ - 0.3 },
  };
  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, __world, {
    scene, x: START.x, z: START.z, yaw: Math.PI + START.yaw, level: 0,
    onUse: (use) => { if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE"); },
  });

  return {
    three: scene, camera,
    controls: { update: () => {} },
    crumb: "CANTEEN", title: "CAFETERIA", subtitle: "",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: INTERACT",
    isInterior: true, sceneId: "canteen",
    update: (dt) => { ctl.update(dt); },
    dispose: () => ctl.dispose(),
  };
}
