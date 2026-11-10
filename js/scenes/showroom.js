/* showroom.js -- Auto Hub. Futuristic holographic car shop.
   Bottom: horizontal grid of car name cards.
   Center: 3D hologram plinth; selected car pops in and auto-rotates.
   Customization panel is a flex-column overlay at the BOTTOM.
   Owned cars show a checkmark; the currently-driven car shows ACTIVE.
   Buying deducts Economy.balance, adds to Auth.user.cars, saves the
   vehicle choice to the profile.
   Room lighting is bright so the car reads against the dark floor. */
import * as THREE from "three";
import { State } from "../core/state.js";
import { Quality } from "../core/quality.js";
import { Sfx } from "../core/sfx.js";
import { buildGWagon3D } from "../vehicles/gwagon3d.js";
import { buildCybertruck3D } from "../vehicles/cybertruck3d.js";
import { buildRangeRover3D } from "../vehicles/rangerover_compound.js";
import { buildMercedes3D } from "../vehicles/mercedes3d.js";
import { buildBMW3D } from "../vehicles/bmw3d.js";
import { buildChiron3D } from "../vehicles/chiron3d.js";
import { buildScrappy3D } from "../vehicles/scrappy3d.js";
import { buildNK250 } from "../vehicles/nk250.js";
import { buildHoverboard } from "../vehicles/hoverboard.js";
import {
  buildVehicle as buildVehicleSimple,
  buildHilux,
} from "../vehicles/models.js";

const CARS = [
  { id: "gwagon", name: "G-WAGON", tag: "AMG · 4.0L V8 · 577 HP", price: 48000000, color: "#24282e", build: (b, r) => buildGWagon3D(b, r) },
  { id: "mercedes", name: "MERCEDES S-CLASS", tag: "S 580 · 4MATIC · 496 HP", price: 62000000, color: "#b9c3cd", build: (b, r) => buildMercedes3D(b, r) },
  { id: "cybertruck", name: "CYBERTRUCK", tag: "TRI-MOTOR AWD · 845 HP", price: 55000000, color: "#c4c9d2", build: (b, r) => buildCybertruck3D(b, r) },
  { id: "rangerover", name: "RANGE ROVER", tag: "AUTOBIOGRAPHY · 523 HP", price: 71000000, color: "#f2f4f7", build: (b, r) => buildRangeRover3D(b, r) },
  { id: "hilux", name: "TOYOTA HILUX", tag: "2.8 GD-6 · 4×4", price: 32000000, color: "#d6dce3", build: (b, r) => buildHilux(b, r) },
  { id: "bmw", name: "BMW M4", tag: "COMPETITION · 503 HP", price: 58000000, color: "#1f3a93", build: (b, r) => buildBMW3D(b, r) },
  { id: "chiron", name: "BUGATTI CHIRON", tag: "W16 · 1500PS · 420 KM/H", price: 280000000, color: "#0e2138", build: (b, r) => buildChiron3D(b, r) },
  { id: "nk250", name: "QLINK NK250", tag: "250 CC · NAKED SPORT · 29 HP", price: 6500000, color: "#d51f2b", build: (b, r) => buildNK250(b, r) },
  { id: "hoverboard", name: "HOVERBOARD X-1", tag: "ANTI-GRAV · DUAL TURBINE · 12 HP", price: 3500000, color: "#38e8ff", build: (b, r) => buildHoverboard(b, r) },
  { id: "scrappy", name: "SCRAPPY CAR", tag: "STARTER · RUSTY · UNBREAKABLE", price: 0, color: "#4d6b74", build: (b, r) => buildScrappy3D(b, r) },
];

const BODY_COLORS = [
  "#0d0d0f", "#f2f4f7", "#b8bcc2", "#c0392b", "#1f3a93",
  "#1e8449", "#d4a017", "#7d3c98", "#e67e22", "#16a085",
  "#5d4037", "#00bcd4", "#e91e63", "#37474f",
];
const RIM_COLORS = ["#c9ced6", "#0d0d0f", "#d4af37", "#8e9aa6", "#2b2b2b", "#e8e8e8"];

const CSS_ID = "ph3d-showroom-css";
function injectCSS() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement("style");
  s.id = CSS_ID;
  s.textContent = `
    #ph3d-showroom-ui {
      position: fixed; inset: 0; z-index: 26; pointer-events: none;
      font-family: Inter, system-ui, sans-serif; color: #eaf6ff;
      display: flex; flex-direction: column;
      user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
    }
    .sr-scanlines {
      position: absolute; inset: 0;
      background: repeating-linear-gradient(0deg, rgba(94,224,255,.025) 0px, rgba(94,224,255,.025) 1px, transparent 1px, transparent 3px);
      pointer-events: none; mix-blend-mode: screen;
    }
    .sr-title {
      padding-top: calc(env(safe-area-inset-top) + 12px);
      text-align: center; font-size: 11px; font-weight: 900; letter-spacing: .32em;
      color: #5ee0ff; text-shadow: 0 0 16px rgba(94,224,255,.9);
      pointer-events: none; white-space: nowrap;
    }
    .sr-title::after {
      content: ""; display: block; width: 60%; height: 1px; margin: 6px auto 0;
      background: linear-gradient(90deg, transparent, #5ee0ff, transparent); opacity: .55;
    }
    .sr-stage { flex: 1 1 auto; pointer-events: none; }
    .sr-custom {
      flex: 0 0 auto; margin: 0 12px 8px; padding: 14px 16px 12px; border-radius: 18px;
      background: linear-gradient(165deg, rgba(8,20,35,.94), rgba(5,10,20,.96));
      border: 1px solid rgba(94,224,255,.4);
      box-shadow: 0 20px 60px rgba(0,0,0,.85), 0 0 40px rgba(94,224,255,.15) inset;
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      pointer-events: auto; opacity: 0; transform: translateY(20px);
      transition: opacity .3s, transform .3s;
    }
    .sr-custom.on { opacity: 1; transform: translateY(0); }
    .sr-custom-header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
    .sr-name { font-size: 15px; font-weight: 900; letter-spacing: .06em; color: #eaf6ff; text-shadow: 0 0 12px rgba(94,224,255,.4); }
    .sr-price { font-size: 13px; font-weight: 900; color: #ffd76a; font-variant-numeric: tabular-nums; text-shadow: 0 0 10px rgba(255,215,106,.4); }
    .sr-sub { font-size: 10px; color: rgba(234,246,255,.55); letter-spacing: .14em; margin-top: 4px; text-transform: uppercase; }
    .sr-row-label { font-size: 9px; letter-spacing: .24em; text-transform: uppercase; color: rgba(94,224,255,.7); margin: 12px 0 6px; font-weight: 800; }
    .sr-swatches { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
    .sr-swatches::-webkit-scrollbar { display: none; }
    .sr-sw { flex: 0 0 auto; width: 26px; height: 26px; border-radius: 8px; border: 2px solid rgba(255,255,255,.12); cursor: pointer; transition: .15s; }
    .sr-sw.on { border-color: #5ee0ff; box-shadow: 0 0 0 2px rgba(94,224,255,.3), 0 0 14px rgba(94,224,255,.5); transform: scale(1.08); }
    .sr-actions { display: flex; gap: 8px; margin-top: 14px; }
    .sr-btn {
      flex: 1; padding: 13px; border-radius: 14px; border: none; font-family: inherit;
      font-size: 11px; font-weight: 900; letter-spacing: .14em; cursor: pointer; transition: .15s;
      user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
    }
    .sr-btn:active { transform: scale(.97); }
    .sr-btn:disabled { opacity: .4; cursor: not-allowed; }
    .sr-btn.sr-buy { background: linear-gradient(135deg, #7dff9b, #4ade80); color: #031a0d; box-shadow: 0 8px 24px rgba(125,255,155,.35); }
    .sr-btn.sr-select { background: linear-gradient(135deg, #5ee0ff, #4ab6ff); color: #04121c; box-shadow: 0 8px 24px rgba(94,224,255,.4); }
    .sr-btn.sr-active { background: linear-gradient(135deg, rgba(125,255,155,.25), rgba(74,222,128,.15)); color: #7dff9b; border: 1px solid rgba(125,255,155,.5); cursor: default; }
    .sr-grid-wrap { flex: 0 0 auto; padding: 6px 12px calc(env(safe-area-inset-bottom) + 12px); pointer-events: auto; }
    .sr-grid { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
    .sr-grid::-webkit-scrollbar { display: none; }
    .sr-card {
      flex: 0 0 auto; min-width: 108px; padding: 10px 12px; border-radius: 14px;
      background: rgba(8,20,35,.85); border: 1px solid rgba(94,224,255,.22); color: #eaf6ff;
      font-family: inherit; text-align: center; cursor: pointer; transition: all .2s;
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
      user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
    }
    .sr-card:active { transform: translateY(-2px); }
    .sr-card.on { background: linear-gradient(135deg, rgba(94,224,255,.28), rgba(74,182,255,.16)); border-color: #5ee0ff; box-shadow: 0 0 22px rgba(94,224,255,.55); transform: translateY(-3px); }
    .sr-card.owned { border-color: rgba(125,255,155,.4); }
    .sr-card.current { background: linear-gradient(135deg, rgba(125,255,155,.28), rgba(74,222,128,.15)); border-color: #7dff9b; box-shadow: 0 0 22px rgba(125,255,155,.55); }
    .sr-card-name { font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; line-height: 1.3; }
    .sr-card-price { font-size: 9px; font-weight: 700; letter-spacing: .04em; color: #ffd76a; margin-top: 4px; font-variant-numeric: tabular-nums; }
    .sr-card-owned-tag { font-size: 9px; font-weight: 900; letter-spacing: .14em; color: #7dff9b; margin-top: 4px; }
    .sr-card-active-tag { font-size: 9px; font-weight: 900; letter-spacing: .14em; color: #7dff9b; margin-top: 4px; text-shadow: 0 0 10px rgba(125,255,155,.8); }
  `;
  document.head.appendChild(s);
}

function disposeGroup(g) {
  if (!g) return;
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => { if (!m) return; if (m.map) m.map.dispose(); m.dispose(); });
    }
  });
  if (g.parent) g.parent.remove(g);
}

export async function showroomScene(params, router) {
  const LOW = Quality.isLow;
  const three = new THREE.Scene();
  three.background = new THREE.Color(0x0e1729);
  three.fog = new THREE.Fog(0x0e1729, 22, 65);

  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 200);
  camera.position.set(0, 4.2, 12);
  camera.lookAt(0, 1.2, 0);

  three.add(new THREE.AmbientLight(0x6a9ec4, 2.2));
  three.add(new THREE.HemisphereLight(0x9dd0ff, 0x1a2b3d, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 3.0); key.position.set(6, 12, 6); three.add(key);
  const key2 = new THREE.DirectionalLight(0xffffff, 1.8); key2.position.set(-6, 10, 4); three.add(key2);
  const rim = new THREE.DirectionalLight(0x5ee0ff, 1.6); rim.position.set(-6, 5, -6); three.add(rim);
  const fill = new THREE.DirectionalLight(0x4ab6ff, 1.2); fill.position.set(0, -2, 8); three.add(fill);

  const grid = new THREE.GridHelper(50, 50, 0x5ee0ff, 0x14304a);
  grid.material.transparent = true; grid.material.opacity = 0.5; grid.position.y = 0;
  three.add(grid);

  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(3.6, 3.8, 0.16, 48),
    new THREE.MeshBasicMaterial({ color: 0x1a2e44 })
  );
  plinth.position.y = 0.08;
  three.add(plinth);

  const ring1Mat = new THREE.MeshBasicMaterial({
    color: 0x5ee0ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const ring1 = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.55, 64), ring1Mat);
  ring1.rotation.x = -Math.PI / 2; ring1.position.y = 0.18; three.add(ring1);

  const ring2Mat = ring1Mat.clone();
  ring2Mat.opacity = 0.65; ring2Mat.color.set(0x4ab6ff);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(4.1, 4.2, 64), ring2Mat);
  ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.20; three.add(ring2);

  let beam = null;
  if (!LOW) {
    beam = new THREE.Mesh(
      new THREE.CylinderGeometry(3.5, 3.5, 10, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x5ee0ff, transparent: true, opacity: 0.08, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    beam.position.y = 5;
    three.add(beam);
  }

  let particles = null;
  const particleVelocities = [];
  const PARTICLE_COUNT = LOW ? 30 : 80;
  if (PARTICLE_COUNT > 0) {
    const pPos = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2.5 + Math.random() * 4.5;
      pPos[i * 3] = Math.cos(angle) * radius;
      pPos[i * 3 + 1] = Math.random() * 7;
      pPos[i * 3 + 2] = Math.sin(angle) * radius;
      particleVelocities.push({ speed: 0.3 + Math.random() * 0.5, angle });
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
      color: 0x5ee0ff, size: 0.09, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    three.add(particles);
  }

  const Auth = window.__ph3d_auth;
  if (Auth && Auth.user && Auth.user.vehicle) {
    State.vehicle.model = Auth.user.vehicle.model || State.vehicle.model;
    State.vehicle.body = Auth.user.vehicle.body || State.vehicle.body;
    State.vehicle.rim = Auth.user.vehicle.rim || State.vehicle.rim;
  }

  let carRoot = null;
  let carRotY = 0;
  let carRotVel = 0.4;
  let dragActive = false;
  let lastDragX = 0;

  const selected = { def: null, body: "#24282e", rim: "#c9ced6" };

  injectCSS();
  const ui = document.createElement("div");
  ui.id = "ph3d-showroom-ui";
  ui.innerHTML = `
    <div class="sr-scanlines"></div>
    <div class="sr-title">AUTO HUB · HOLOGRAPHIC SHOWROOM</div>
    <div class="sr-stage"></div>

    <div class="sr-custom" id="sr-custom">
      <div class="sr-custom-header">
        <div class="sr-name" id="sr-name">—</div>
        <div class="sr-price" id="sr-price">—</div>
      </div>
      <div class="sr-sub" id="sr-sub">—</div>
      <div class="sr-row-label">BODY PAINT</div>
      <div class="sr-swatches" id="sr-body"></div>
      <div class="sr-row-label">RIM FINISH</div>
      <div class="sr-swatches" id="sr-rim"></div>
      <div class="sr-actions">
        <button class="sr-btn" id="sr-action">—</button>
      </div>
    </div>

    <div class="sr-grid-wrap">
      <div class="sr-grid" id="sr-grid"></div>
    </div>
  `;
  document.body.appendChild(ui);

  const elCustom = ui.querySelector("#sr-custom");
  const elName = ui.querySelector("#sr-name");
  const elPrice = ui.querySelector("#sr-price");
  const elSub = ui.querySelector("#sr-sub");
  const elBody = ui.querySelector("#sr-body");
  const elRim = ui.querySelector("#sr-rim");
  const elAction = ui.querySelector("#sr-action");
  const elGrid = ui.querySelector("#sr-grid");

  /* One showroom sound at a time: a new sound cuts the previous one,
     so taps, purchase and error sounds never stack on top of each other. */
  let _cur = null;
  function snd(key, opts) {
    try {
      if (_cur) { _cur.pause(); _cur.currentTime = 0; _cur = null; }
      _cur = Sfx.play(key, opts) || null;
      if (_cur) _cur.addEventListener("ended", () => { if (_cur) _cur = null; }, { once: true });
    } catch (e) {}
  }

  function ownedList() { return (Auth && Auth.user && Auth.user.cars) || []; }
  function isOwned(id) { return ownedList().indexOf(id) >= 0; }
  function isCurrent(id) { return isOwned(id) && State.vehicle && State.vehicle.model === id; }

  function rebuildCarMesh() {
    if (!selected.def) return;
    disposeGroup(carRoot);
    carRoot = new THREE.Group();
    let mesh = null;
    try { mesh = selected.def.build(selected.body, selected.rim); }
    catch (e) { console.error("[showroom] build failed", selected.def.id, e); mesh = new THREE.Group(); }
    carRoot.add(mesh);
    carRoot.position.set(0, 0.2, 0);
    carRoot.scale.setScalar(0.001);
    three.add(carRoot);
  }

  function renderSwatches() {
    elBody.innerHTML = "";
    BODY_COLORS.forEach(c => {
      const d = document.createElement("div");
      d.className = "sr-sw" + (selected.body === c ? " on" : "");
      d.style.background = c;
      d.onclick = () => { if (selected.body === c) return; snd("ui_tap"); selected.body = c; renderSwatches(); rebuildCarMesh(); };
      elBody.appendChild(d);
    });
    elRim.innerHTML = "";
    RIM_COLORS.forEach(c => {
      const d = document.createElement("div");
      d.className = "sr-sw" + (selected.rim === c ? " on" : "");
      d.style.background = c;
      d.onclick = () => { if (selected.rim === c) return; snd("ui_tap"); selected.rim = c; renderSwatches(); rebuildCarMesh(); };
      elRim.appendChild(d);
    });
  }

  function renderActionButton() {
    if (!selected.def) { elAction.style.display = "none"; return; }
    elAction.style.display = "";
    const owned = isOwned(selected.def.id);
    const current = isCurrent(selected.def.id);

    elAction.className = "sr-btn";
    elAction.disabled = false;
    elAction.onclick = null;

    if (current) {
      elAction.classList.add("sr-active");
      elAction.textContent = "● ACTIVE · DRIVING THIS";
      elAction.disabled = true;
      return;
    }
    if (owned || selected.def.price === 0) {
      elAction.classList.add("sr-select");
      elAction.textContent = "SELECT · FREE";
      elAction.onclick = () => doSelect(selected.def);
      return;
    }
    const Eco = window.__ph3d_economy;
    const bal = Eco ? Eco.balance : 0;
    if (bal < selected.def.price) {
      elAction.classList.add("sr-buy");
      elAction.disabled = true;
      elAction.textContent = "NEED ₦" + (selected.def.price - bal).toLocaleString();
    } else {
      elAction.classList.add("sr-buy");
      elAction.textContent = "BUY · ₦" + selected.def.price.toLocaleString();
      elAction.onclick = () => doBuy(selected.def);
    }
  }

  function renderGrid() {
    elGrid.innerHTML = "";
    const currentModel = (State.vehicle && State.vehicle.model) || "";
    CARS.forEach(car => {
      const owned = isOwned(car.id);
      const current = currentModel === car.id && owned;
      const active = selected.def && selected.def.id === car.id;

      const card = document.createElement("button");
      card.className = "sr-card";
      if (active) card.classList.add("on");
      if (owned) card.classList.add("owned");
      if (current) card.classList.add("current");

      let inner = '<div class="sr-card-name">' + car.name + '</div>';
      if (current) inner += '<div class="sr-card-active-tag">● ACTIVE</div>';
      else if (owned) inner += '<div class="sr-card-owned-tag">✓ OWNED</div>';
      else inner += '<div class="sr-card-price">₦' + car.price.toLocaleString() + '</div>';

      card.innerHTML = inner;
      card.onclick = () => { if (selected.def && selected.def.id === car.id) return; snd("ui_tap"); selectCar(car); };
      elGrid.appendChild(card);
    });
  }

  function selectCar(carDef) {
    selected.def = carDef;
    selected.body = carDef.color;
    selected.rim = "#c9ced6";
    if (isOwned(carDef.id) && State.vehicle.model === carDef.id) {
      selected.body = State.vehicle.body || carDef.color;
      selected.rim = State.vehicle.rim || "#c9ced6";
    }
    elName.textContent = carDef.name;
    elPrice.textContent = isOwned(carDef.id) ? "OWNED" : "₦" + carDef.price.toLocaleString();
    elSub.textContent = carDef.tag;
    renderSwatches();
    renderActionButton();
    renderGrid();
    elCustom.classList.add("on");
    rebuildCarMesh();
  }

  async function persistVehicle(carDef) {
    State.vehicle.model = carDef.id;
    State.vehicle.body = selected.body;
    State.vehicle.rim = selected.rim;
    try {
      if (Auth && Auth.save) {
        await Auth.save({ vehicle: { model: carDef.id, body: selected.body, rim: selected.rim } });
      }
    } catch (e) { console.warn("[showroom] persist failed", e); }
  }

  async function doBuy(carDef) {
    const Eco = window.__ph3d_economy;
    if (!Eco) { snd("purchase_fail"); if (window.__ph3d_phone) window.__ph3d_phone._toast("Economy offline"); return; }
    if (carDef.price > 0) {
      if (Eco.balance < carDef.price) {
        snd("purchase_fail");
        if (window.__ph3d_phone) window.__ph3d_phone._toast("Not enough money");
        return;
      }
      Eco.withdraw(carDef.price);
    }
    try { if (window.__ph3d_garage) window.__ph3d_garage.grantCar(carDef.id); }
    catch (e) { console.warn("[showroom] grantCar", e); }
    await persistVehicle(carDef);
    snd("purchase_ok");
    if (window.__ph3d_phone) window.__ph3d_phone._toast("Bought " + carDef.name);
    renderActionButton();
    renderGrid();
    setTimeout(() => { try { router.go("city"); } catch (e) {} }, 800);
  }

  async function doSelect(carDef) {
    if (!isOwned(carDef.id) && carDef.price > 0) return;
    if (!isOwned(carDef.id) && carDef.price === 0) {
      try { if (window.__ph3d_garage) window.__ph3d_garage.grantCar(carDef.id); } catch (e) {}
    }
    await persistVehicle(carDef);
    snd("ui_open");
    if (window.__ph3d_phone) window.__ph3d_phone._toast("Selected " + carDef.name);
    renderActionButton();
    renderGrid();
    setTimeout(() => { try { router.go("city"); } catch (e) {} }, 600);
  }

  const dom = router.renderer.domElement;
  const onPD = (e) => { dragActive = true; lastDragX = e.clientX; };
  const onPM = (e) => {
    if (!dragActive) return;
    const dx = e.clientX - lastDragX;
    lastDragX = e.clientX;
    carRotY += dx * 0.012;
    carRotVel = Math.max(-6, Math.min(6, dx * 0.4));
  };
  const onPU = () => { dragActive = false; };
  dom.addEventListener("pointerdown", onPD);
  dom.addEventListener("pointermove", onPM);
  dom.addEventListener("pointerup", onPU);
  dom.addEventListener("pointercancel", onPU);
  const onCtx = (e) => e.preventDefault();
  dom.addEventListener("contextmenu", onCtx);

  const startModel = (State.vehicle && State.vehicle.model) || "gwagon";
  const startCar = CARS.find(c => c.id === startModel) || CARS[0];
  selectCar(startCar);
  snd("ui_open");

  let pulse = 1;
  let simTime = 0;

  return {
    three, camera,
    controls: { update: () => {} },
    crumb: "AUTO HUB",
    title: "CAR SHOWROOM",
    subtitle: "HOLOGRAPHIC · LIVE",
    hint: "",
    update: (dt, t) => {
      const d = Math.min(dt, 0.05);
      simTime += d;

      if (!dragActive) carRotVel += (0.4 - carRotVel) * Math.min(1, d * 1.2);
      carRotY += carRotVel * d;
      if (carRoot) {
        carRoot.rotation.y = carRotY;
        const cur = carRoot.scale.x;
        if (cur < 1) {
          const next = Math.min(1, cur + d * 3.5);
          carRoot.scale.setScalar(next);
          pulse = Math.max(0, 1 - next);
        }
      }

      ring1.rotation.z += d * 0.6;
      ring2.rotation.z -= d * 0.35;
      const p = 0.85 + Math.sin(simTime * 2.2) * 0.15 + pulse * 0.4;
      ring1Mat.opacity = Math.min(1, p);

      if (beam) beam.material.opacity = 0.07 + Math.sin(simTime * 1.6) * 0.02;

      if (particles) {
        const arr = particles.geometry.attributes.position.array;
        for (let i = 0; i < particleVelocities.length; i++) {
          const v = particleVelocities[i];
          arr[i * 3 + 1] += v.speed * d;
          if (arr[i * 3 + 1] > 7) arr[i * 3 + 1] = 0;
          v.angle += d * 0.2;
          const radius = 2.5 + (i % 5) * 0.9;
          arr[i * 3] = Math.cos(v.angle) * radius;
          arr[i * 3 + 2] = Math.sin(v.angle) * radius;
        }
        particles.geometry.attributes.position.needsUpdate = true;
      }

      if (selected.def && !isOwned(selected.def.id)) {
        const Eco = window.__ph3d_economy;
        if (Eco) {
          const bal = Eco.balance;
          if (bal < selected.def.price) { if (!elAction.disabled) renderActionButton(); }
          else { if (elAction.disabled) renderActionButton(); }
        }
      }
    },
    dispose: () => {
      dom.removeEventListener("pointerdown", onPD);
      dom.removeEventListener("pointermove", onPM);
      dom.removeEventListener("pointerup", onPU);
      dom.removeEventListener("pointercancel", onPU);
      dom.removeEventListener("contextmenu", onCtx);
      try { if (_cur) { _cur.pause(); _cur = null; } } catch (e) {}
      disposeGroup(carRoot);
      try { ui.remove(); } catch (e) {}
      try {
        three.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            const m = Array.isArray(o.material) ? o.material : [o.material];
            m.forEach(x => x && x.dispose && x.dispose());
          }
        });
      } catch (e) {}
    },
  };
}
