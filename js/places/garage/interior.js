/* garage/interior.js — MY GARAGE.
   Every car the player owns is parked in a neat grid, each on its own lit bay with a
   name plate. Walk up to a car and press the action button to make it your active car
   (the one you drive in the city). The hall grows with the number of cars owned.
   Entrance is on the NORTH wall; the hall runs south from there. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import { State } from "../../core/state.js";
import { Auth } from "../../core/auth.js";
import { Garage } from "../../core/garage.js";
import { buildGWagon3D } from "../../vehicles/gwagon3d.js";
import { buildCybertruck3D } from "../../vehicles/cybertruck3d.js";
import { buildRangeRover3D } from "../../vehicles/rangerover_compound.js";
import { buildMercedes3D } from "../../vehicles/mercedes3d.js";
import { buildBMW3D } from "../../vehicles/bmw3d.js";
import { buildChiron3D } from "../../vehicles/chiron3d.js";
import { buildScrappy3D } from "../../vehicles/scrappy3d.js";
import { buildNK250 } from "../../vehicles/nk250.js";
import { buildHoverboard } from "../../vehicles/hoverboard.js";
import { buildSkyfury } from "../../vehicles/skyfury.js";
import { buildHilux } from "../../vehicles/models.js";

/* name, tagline, default colour and model builder for every car in the game */
const CATALOG = {
  gwagon:     { name: "G-WAGON",          tag: "AMG · 4.0L V8",          color: "#24282e", build: (b, r) => buildGWagon3D(b, r) },
  mercedes:   { name: "MERCEDES S-CLASS", tag: "S 580 · 4MATIC",         color: "#b9c3cd", build: (b, r) => buildMercedes3D(b, r) },
  cybertruck: { name: "CYBERTRUCK",       tag: "TRI-MOTOR AWD",          color: "#c4c9d2", build: (b, r) => buildCybertruck3D(b, r) },
  rangerover: { name: "RANGE ROVER",      tag: "AUTOBIOGRAPHY",          color: "#f2f4f7", build: (b, r) => buildRangeRover3D(b, r) },
  hilux:      { name: "TOYOTA HILUX",     tag: "2.8 GD-6 · 4×4",         color: "#d6dce3", build: (b, r) => buildHilux(b, r) },
  bmw:        { name: "BMW M4",           tag: "COMPETITION",            color: "#1f3a93", build: (b, r) => buildBMW3D(b, r) },
  chiron:     { name: "BUGATTI CHIRON",   tag: "W16 · 420 KM/H",         color: "#0e2138", build: (b, r) => buildChiron3D(b, r) },
  nk250:      { name: "QLINK NK250",      tag: "NAKED SPORT BIKE",       color: "#d51f2b", build: (b, r) => buildNK250(b, r) },
  hoverboard: { name: "HOVERBOARD X-1",   tag: "ANTI-GRAV",              color: "#38e8ff", build: (b, r) => buildHoverboard(b, r) },
  skyfury:    { name: "SKYFURY JET",      tag: "TWIN AFTERBURNER · FLIGHT", color: "#9aa7b4", build: (b, r) => buildSkyfury(b, r) },
  scrappy:    { name: "SCRAPPY CAR",      tag: "STARTER · UNBREAKABLE",  color: "#4d6b74", build: (b, r) => buildScrappy3D(b, r) },
};
const FACE_YAW = Math.PI;            /* cars park nose-first toward the entrance so you see their fronts */
const SMALL = { nk250: 1, hoverboard: 1, skyfury: 1 };
const FRONT_FIX = { nk250: 0, hoverboard: 0, skyfury: 0, gwagon: Math.PI, cybertruck: 0, rangerover: 0, mercedes: -Math.PI / 2, chiron: -Math.PI / 2, scrappy: 0, bmw: -Math.PI / 2, hilux: -Math.PI / 2 };

export async function buildInterior(router) {
  /* ---------- what the player owns ---------- */
  let owned = [];
  try { owned = Garage.owned().slice(); } catch (e) {}
  owned = owned.filter(id => CATALOG[id]);
  if (!owned.length) owned = ["scrappy"];
  const n = owned.length;

  /* ---------- hall size grows with the collection ---------- */
  const COLS = n <= 3 ? Math.max(n, 2) : 4, ROWS = Math.ceil(n / COLS);
  const GX = 6.4, GZ = 8.6;
  const W = COLS * GX + 5, D = ROWS * GZ + 7.5, H = 5.2;
  const X0 = -W / 2, X1 = W / 2, Z0 = -D / 2, Z1 = D / 2;
  const DOOR = 3.8;                                      /* half-width of the entrance */

  /* ---------- scene + lights (bright bounce so the ceiling is never black) ---------- */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x151a20);
  scene.fog = new THREE.Fog(0x151a20, 45, 140);
  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, .05, 200);
  camera.rotation.order = "YXZ";
  scene.add(new THREE.HemisphereLight(0xf4f7ff, 0xc9ccd4, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, .55); sun.position.set(8, 18, -6); scene.add(sun);

  const BOXG = new THREE.BoxGeometry(1, 1, 1), CYLG = new THREE.CylinderGeometry(.5, .5, 1, 14);
  const MC = new Map();
  const mat = (c, o) => { const k = c + "|" + JSON.stringify(o || 0); let m = MC.get(k); if (!m) { m = new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {})); MC.set(k, m); } return m; };
  const glow = c => { const k = "g" + c; let m = MC.get(k); if (!m) { m = new THREE.MeshBasicMaterial({ color: c }); MC.set(k, m); } return m; };
  const world = new THREE.Group(); scene.add(world);
  const solid = [], uses = [];

  function box(w, h, d, x, y, z, m, o) {
    o = o || {};
    const s = new THREE.Mesh(BOXG, typeof m === "number" ? mat(m) : m);
    s.scale.set(w, h, d); s.position.set(x, y, z); s.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
    world.add(s);
    if (o.solid) solid.push({ x, z, hw: w / 2, hd: d / 2 });
    return s;
  }
  function cyl(r, h, x, y, z, m, o) {
    o = o || {};
    const s = new THREE.Mesh(CYLG, typeof m === "number" ? mat(m) : m);
    s.scale.set(r * 2, h, r * 2); s.position.set(x, y, z); s.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
    world.add(s);
    if (o.solid) solid.push({ x, z, hw: r, hd: r });
    return s;
  }
  function canvasTex(w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return { tex: t, canvas: c };
  }

  /* ---------- floor: polished concrete, painted aisle ---------- */
  const floorTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = "#4a4f57"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#53585f"; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2);
    g.strokeStyle = "#3a3e44"; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
  }).tex;
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(W / 2.2, D / 2.2);
  box(W, .2, D, 0, -.1, 0, new THREE.MeshLambertMaterial({ color: 0xffffff, map: floorTex }));

  /* ---------- walls, ceiling ---------- */
  const wallM = mat(0xdfe3e8), stripeM = glow(0x2fd1c5), trimM = mat(0x2b3138);
  const NS = (z, xa, xb) => box(xb - xa, H, .3, (xa + xb) / 2, H / 2, z, wallM, { solid: true });
  NS(Z0, X0, -DOOR); NS(Z0, DOOR, X1);                                       /* north wall with the wide door gap */
  box(DOOR * 2, H - 4.1, .3, 0, 4.1 + (H - 4.1) / 2, Z0, trimM);               /* door header */
  box(DOOR * 2 + .4, .22, .34, 0, 4.1, Z0, mat(0xffc62b));                     /* yellow door frame */
  NS(Z1, X0, X1);
  box(.3, H, D, X0, H / 2, 0, wallM, { solid: true }); box(.3, H, D, X1, H / 2, 0, wallM, { solid: true });
  for (const x of [X0 + .17, X1 - .17]) { box(.06, .22, D - .6, x, 3.0, 0, stripeM); box(.12, .9, D, x, .45, 0, trimM); }
  box(W - .6, .22, .06, 0, 3.0, Z1 - .17, stripeM); box(W, .9, .12, 0, .45, Z1 - .17, trimM);
  box(W, .3, D, 0, H + .15, 0, mat(0xe9edf1));                                  /* ceiling */
  const NL = Math.max(2, Math.round(W / 6)), ML = Math.max(2, Math.round(D / 7));
  for (let i = 0; i < NL; i++) for (let j = 0; j < ML; j++)
    box(1.6, .08, .5, X0 + (i + .5) * W / NL, H - .05, Z0 + (j + .5) * D / ML, glow(0xfaffff));
  for (let j = 0; j < ML; j++) box(W, .18, .22, 0, H - .12, Z0 + (j + .5) * D / ML + 1.4, trimM);   /* ceiling beams */

  /* ---------- big sign on the back wall ---------- */
  const title = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = "#171c22"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#2fd1c5"; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = "#ffffff"; g.font = "800 112px Arial,sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("MY GARAGE", w / 2, h / 2 - 18);
    g.fillStyle = "#2fd1c5"; g.font = "700 44px Arial,sans-serif";
    g.fillText(n + (n === 1 ? " VEHICLE PARKED" : " VEHICLES PARKED"), w / 2, h / 2 + 70);
  }).tex;
  const titleM = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: title }));
  titleM.position.set(0, 3.4, Z1 - .2); titleM.rotation.y = Math.PI; world.add(titleM);

  /* ---------- workshop dressing along the back wall ---------- */
  const bench = (x) => { box(3.2, .12, .9, x, .95, Z1 - 1.0, mat(0x8a6a45), { solid: true }); box(.12, .95, .8, x - 1.4, .47, Z1 - 1.0, mat(0x3a3f46)); box(.12, .95, .8, x + 1.4, .47, Z1 - 1.0, mat(0x3a3f46));
    box(.5, .3, .4, x - .8, 1.16, Z1 - 1.0, mat(0xd8362f)); box(.6, .08, .4, x + .6, 1.04, Z1 - 1.0, mat(0x6b7480)); };
  if (W >= 14) { bench(X0 + 3.4); bench(X1 - 3.4); }
  const tyres = (x, z) => { for (let k = 0; k < 4; k++) cyl(.42, .24, x, .12 + k * .25, z, mat(0x15171a), { solid: k === 0 }); };
  tyres(X0 + 1.2, Z0 + 2.2); tyres(X0 + 1.2, Z0 + 3.2); tyres(X1 - 1.2, Z0 + 2.2);
  cyl(.38, .9, X1 - 1.2, .45, Z0 + 3.6, mat(0x2b5aa8), { solid: true }); cyl(.38, .9, X1 - 1.8, .45, Z0 + 3.4, mat(0xd8362f), { solid: true });

  /* ---------- parking bays + cars ---------- */
  const plates = [];
  const defOf = id => CATALOG[id];
  const activeId = () => (State.vehicle && State.vehicle.model) || "scrappy";
  function drawPlate(rec) {
    const { canvas, def, id } = rec, g = canvas.getContext("2d"), w = canvas.width, h = canvas.height, active = activeId() === id;
    g.fillStyle = "#171c22"; g.fillRect(0, 0, w, h);
    g.fillStyle = active ? "#2fd1c5" : "#ffc62b"; g.fillRect(0, 0, 14, h);
    g.fillStyle = "#fff"; g.font = "800 52px Arial,sans-serif"; g.textAlign = "left"; g.textBaseline = "middle";
    g.fillText(def.name, 34, 62, w - 60);
    g.fillStyle = "#9db0a6"; g.font = "600 30px Arial,sans-serif"; g.fillText(def.tag, 34, 112, w - 60);
    g.fillStyle = active ? "#2fd1c5" : "#3a424b"; g.fillRect(34, 138, active ? 190 : 250, 40);
    g.fillStyle = active ? "#06201d" : "#cfd6dc"; g.font = "800 24px Arial,sans-serif"; g.textBaseline = "middle";
    g.fillText(active ? "● ACTIVE CAR" : "TAP TO DRIVE THIS", 46, 160);
    rec.tex.needsUpdate = true;
  }
  owned.forEach((id, i) => {
    const def = defOf(id), col = i % COLS, row = Math.floor(i / COLS);
    const cx = (col - (COLS - 1) / 2) * GX, cz = Z0 + 6.8 + row * GZ;
    const small = !!SMALL[id], bw = small ? 3.0 : 4.4, bl = small ? 4.2 : 6.6;
    /* bay: dark pad, lit edge, painted lines */
    box(bw, .1, bl, cx, .05, cz, mat(0x23282e));
    box(bw + .2, .04, .12, cx, .1, cz - bl / 2, glow(0x2fd1c5)); box(bw + .2, .04, .12, cx, .1, cz + bl / 2, glow(0x2fd1c5));
    box(.12, .04, bl, cx - bw / 2, .1, cz, glow(0x2fd1c5)); box(.12, .04, bl, cx + bw / 2, .1, cz, glow(0x2fd1c5));
    /* the car (keeps the player's chosen colours for their active car) */
    let body = def.color, rim = "#c9ced6";
    if (State.vehicle && State.vehicle.model === id) { body = State.vehicle.body || body; rim = State.vehicle.rim || rim; }
    try {
      const car = def.build(body, rim);
      /* models are authored facing different ways; FRONT_FIX is the same table the drive scene uses
         to make each one face forward (+Z). Add PI so the nose points at the entrance. */
      const base = FRONT_FIX[id] !== undefined ? FRONT_FIX[id] : -Math.PI / 2;
      car.position.set(cx, .1, cz); car.rotation.y = base + FACE_YAW; world.add(car);
    } catch (e) { console.warn("[garage] could not build", id, e); }
    solid.push({ x: cx, z: cz, hw: small ? .9 : 1.25, hd: small ? 1.2 : 2.45 });
    /* name plate on a small stand in front of the car */
    const pc = canvasTex(512, 200, () => {});
    const rec = { id, def, canvas: pc.canvas, tex: pc.tex };
    drawPlate(rec); plates.push(rec);
    const pz = cz - bl / 2 - .55;
    box(.08, .8, .08, cx - .8, .4, pz, mat(0x9aa4ad)); box(.08, .8, .08, cx + .8, .4, pz, mat(0x9aa4ad));
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.9, .74), new THREE.MeshBasicMaterial({ map: pc.tex, side: THREE.DoubleSide }));
    pm.position.set(cx, .98, pz - .02); pm.rotation.y = Math.PI; pm.rotation.x = -.18; world.add(pm);
    uses.push({ kind: "pickcar", id, label: "DRIVE " + def.name, x: cx, z: cz - bl / 2 + .4, y: 0, level: 0, r: 3.0 });
  });

  /* ---------- exit sign above the door ---------- */
  const exitTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = "#14532d"; g.fillRect(0, 0, w, h); g.fillStyle = "#eafff1"; g.font = "800 40px Arial,sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("EXIT  ↑", w / 2, h / 2 + 2); }).tex;
  const exitM = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .4), new THREE.MeshBasicMaterial({ map: exitTex }));
  exitM.position.set(0, 4.5, Z0 + .22); world.add(exitM);

  /* ---------- game glue (same shape as the other interiors) ---------- */
  const cols = solid.map(b => ({ minX: b.x - b.hw, maxX: b.x + b.hw, minZ: b.z - b.hd, maxZ: b.z + b.hd, y0: 0, y1: 60, level: 0 }));
  const gworld = {
    colliders: cols, seats: [], uses,
    stairs: [], platforms: [],
    levelHeight: () => 0, ceilingHeight: H,
    bounds: { minX: X0 + .7, maxX: X1 - .7, minZ: Z0 + .5, maxZ: Z1 - .7 },
  };
  const toast = (m) => window.__ph3d_phone?._toast(m);
  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, gworld, {
    scene, x: 0, z: Z0 + 2.2, yaw: Math.PI + Math.PI, level: 0,
    onUse: (u) => {
      if (u.kind !== "pickcar") return;
      const def = defOf(u.id);
      if (!def) return;
      const same = State.vehicle && State.vehicle.model === u.id;
      const body = same ? (State.vehicle.body || def.color) : def.color;
      const rim = same ? (State.vehicle.rim || "#c9ced6") : "#c9ced6";
      State.vehicle.model = u.id; State.vehicle.body = body; State.vehicle.rim = rim;
      try { Auth && Auth.save && Auth.save({ vehicle: { model: u.id, body, rim } }); } catch (e) {}
      plates.forEach(drawPlate);
      toast(def.name + " is now your active car");
    },
  });

  return {
    three: scene, camera,
    controls: { update: () => {} },
    crumb: "MY GARAGE",
    title: n + (n === 1 ? " CAR" : " CARS"),
    subtitle: "",
    hint: "WALK UP TO A CAR · E: DRIVE THIS CAR · BACK DOOR OUTSIDE TO LEAVE",
    isInterior: true,
    sceneId: "garage",
    update: (dt) => { ctl.update(dt); },
    dispose: () => ctl.dispose(),
  };
}
