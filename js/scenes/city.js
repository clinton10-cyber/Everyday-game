/* city.js -- Port Harcourt overhead map.
   Uses the shared reference world (js/world/phworld.js).
   Overhead orbital camera, no camera collision, natural orbit.
   Same game HUD / menu / ATMs / travel routing as before. */

import * as THREE from "three";
import { Quality } from "../core/quality.js";
import { ATMs } from "../core/atms.js";
import { HUD } from "../ui/hud.js";
import { textLabel } from "../core/kit.js";
import { buildPHWorld } from "../world/phworld.js";
import { askAndRoute } from "../core/landmark-routing.js";
import { addNightGlow } from "../core/night-glow.js";

export async function cityScene(params, router) {
  return _citySceneInner(params, router);
}

async function _citySceneInner(params, router) {
  const TIER = (Quality.current && Quality.current.tier) || "medium";
  const LOW = TIER === "low";

  const SKY = 0xa6c8e6;
  const three = new THREE.Scene();
  three.background = new THREE.Color(SKY);
  three.fog = new THREE.Fog(SKY, 700, 1800);

  const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 1.5, 2400);

  three.add(new THREE.HemisphereLight(0xc4dcf0, 0x5c6a4c, 0.55));
  const sun = new THREE.DirectionalLight(0xfff3dc, 2.0);
  sun.position.set(220, 380, 140);
  three.add(sun);
  const bounce = new THREE.DirectionalLight(0x93bcd8, 0.35);
  bounce.position.set(-240, 140, -200);
  three.add(bounce);

  /* ── 1. World: two meshes so base never fights detail ─────── */
  const world = buildPHWorld();

  const baseMat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });
  const detailMat = new THREE.MeshPhongMaterial({
    vertexColors: true,
    shininess: 16,
    specular: new THREE.Color(0x303840),
    flatShading: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  const baseMesh = new THREE.Mesh(world.baseGeometry, baseMat);
  baseMesh.frustumCulled = false;
  baseMesh.matrixAutoUpdate = false;
  baseMesh.renderOrder = 0;
  three.add(baseMesh);

  const detailMesh = new THREE.Mesh(world.detailGeometry, detailMat);
  detailMesh.frustumCulled = false;
  detailMesh.matrixAutoUpdate = false;
  detailMesh.renderOrder = 1;
  three.add(detailMesh);

  /* ── 1b. Night: every streetlight lights up (bulbs + halos + ground
        light pools), driven by StreetLights.tick() from the day/night
        clock. The overhead camera is far from the lamps, so the glow
        meshes carry the illumination rather than the PointLight pool. ── */
  try { addNightGlow(three, world.lampSpots, { poolRadius: LOW ? 12 : 16 }); } catch (e) { console.warn("[city] night glow failed:", e); }

  /* ── 2. ATMs ──────────────────────────────────────────────── */
  const atmPositions = [
    { x: -60,  z:  45, hackable: Math.random() < 0.4 },
    { x:  80,  z: -40, hackable: Math.random() < 0.4 },
    { x: 120,  z:  60, hackable: Math.random() < 0.4 },
    { x: -90,  z: -80, hackable: Math.random() < 0.4 },
    { x:  40,  z: 180, hackable: Math.random() < 0.4 },
    { x: -160, z:  20, hackable: Math.random() < 0.4 },
    { x: 180,  z: -120, hackable: Math.random() < 0.4 },
    { x: -30,  z: -180, hackable: Math.random() < 0.4 },
  ];
  try { ATMs.register(atmPositions); } catch (e) {}

  /* ── 3. Pins, labels and tap planes (game-style map markers) ──────── */
  const PIN_PX = 26, LABEL_PX = 18;
  const TAN_HALF = Math.tan(THREE.MathUtils.degToRad(46 / 2));
  const wpp = (d) => (2 * TAN_HALF * d) / Math.max(1, innerHeight);       // world units per screen pixel at distance d

  function pinTexture(fill) {
    const c = document.createElement("canvas"); c.width = c.height = 96;
    const g = c.getContext("2d");
    g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = 8; g.shadowOffsetY = 3;
    g.beginPath(); g.arc(48, 46, 30, 0, Math.PI * 2); g.fillStyle = "#ffffff"; g.fill();
    g.shadowColor = "transparent";
    g.beginPath(); g.arc(48, 46, 23, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
    g.beginPath(); g.arc(48, 46, 8, 0, Math.PI * 2); g.fillStyle = "#06101a"; g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function ringTexture() {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d");
    g.lineWidth = 9; g.strokeStyle = "#ffc62b"; g.shadowColor = "rgba(255,198,43,.9)"; g.shadowBlur = 14;
    g.beginPath(); g.arc(64, 64, 46, 0, Math.PI * 2); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const texPin = pinTexture("#35c8ff"), texHome = pinTexture("#ffc62b");
  const ringMat = new THREE.SpriteMaterial({ map: ringTexture(), transparent: true, depthTest: false, depthWrite: false });
  const ring = new THREE.Sprite(ringMat); ring.renderOrder = 997; ring.visible = false; three.add(ring);

  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const lmItems = [];
  let selected = null;
  for (const lm of world.landmarks) {
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), hitMat);
    hit.rotation.x = -Math.PI / 2;
    hit.position.set(lm.x, 12, lm.z);
    const it = { lm, x: lm.x, z: lm.z, dist: 0, aspect: 4, pin: null, label: null };
    hit.userData.tap = () => selectLandmark(it, false);
    three.add(hit);

    const pin = new THREE.Sprite(new THREE.SpriteMaterial({
      map: lm.id === "myhouse" ? texHome : texPin, transparent: true, depthTest: false, depthWrite: false }));
    pin.renderOrder = 998; three.add(pin); it.pin = pin;

    try {
      const lbl = textLabel(lm.name, "");
      it.aspect = lbl.scale.x / lbl.scale.y;
      lbl.visible = false; three.add(lbl); it.label = lbl;
    } catch (e) {}
    lmItems.push(it);
  }

  function routeToLandmark(lm, router) {
    askAndRoute(lm, router);
  }

  /* ── 4. Menu button ──────────────────────────────────────── */
  const menuBtn = document.createElement("button");
  menuBtn.id = "ph3d-menu-btn";
  menuBtn.type = "button";
  menuBtn.setAttribute("aria-label", "Menu");
  menuBtn.textContent = "Menu";
  document.body.appendChild(menuBtn);

  const goTo = (name, params) => () => router.go(name, params);
  menuBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    HUD.sheet({
      title: "Where to?",
      sub: "Pick a way to explore Port Harcourt",
      sections: [
        { cols: 2, items: [
          { icon: "car",  label: "Drive", sub: "Open world", tone: "danfo", onClick: goTo("drive") },
          { icon: "walk", label: "Walk",  sub: "On foot",    onClick: goTo("walk") },
          { icon: "leaf", label: "Outskirts", sub: "Beyond the wall", onClick: goTo("drive", { startMode: "drive", wilderness: true, startZ: 350, startX: 0 }) },
          { icon: "aim",  label: "Shooting range", sub: "Practice", onClick: goTo("range") },
        ] },
        { cols: 1, items: [
          { icon: "lock", label: "State prison", sub: "Cell block", onClick: goTo("prisonScene") },
        ] },
        { cols: 1, items: [
          { icon: "aim", label: "Replay tutorial",
            onClick: () => {
              import("../ui/onboarding.js").then((m) => m.Onboarding.startTour());
            } },
        ] },
      ],
    });
  });

  /* ── 5. Ambient plane + helicopter ───────────────────────── */
  let planeGroup = null, planePath = null;
  let heliGroup = null, heliPath = null, heliRotors = null;

  if (!LOW) {
    planeGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 16, 10),
      new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }));
    body.rotation.z = Math.PI / 2;
    planeGroup.add(body);
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(20, 0.4, 3),
      new THREE.MeshLambertMaterial({ color: 0xc8cdd2 }));
    wing.position.y = -0.4;
    planeGroup.add(wing);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 4, 3),
      new THREE.MeshLambertMaterial({ color: 0x2a4a8a }));
    tail.position.set(-7, 2, 0);
    planeGroup.add(tail);
    three.add(planeGroup);

    planePath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-500, 100, -300),
      new THREE.Vector3(-100, 80, -500),
      new THREE.Vector3(400, 90, -300),
      new THREE.Vector3(500, 100, 100),
      new THREE.Vector3(300, 90, 400),
      new THREE.Vector3(-200, 100, 300),
    ], true, "catmullrom", 0.5);

    heliGroup = new THREE.Group();
    const hb = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 10, 8),
      new THREE.MeshPhongMaterial({ color: 0x1f2c3b, shininess: 55 }));
    heliGroup.add(hb);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(5, 0.05, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x0b1119 }));
    rotor.position.y = 1.3;
    heliGroup.add(rotor);
    heliRotors = { main: rotor };
    three.add(heliGroup);

    const HR = 380;
    heliPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3( HR, 34, 0),
      new THREE.Vector3( HR*0.3, 30, HR*0.95),
      new THREE.Vector3(-HR*0.7, 36, HR*0.5),
      new THREE.Vector3(-HR, 32, 0),
      new THREE.Vector3(-HR*0.3, 38, -HR*0.9),
      new THREE.Vector3( HR*0.6, 30, -HR*0.6),
    ], true, "catmullrom", 0.5);
  }

  /* ── 6. Overhead camera (natural orbit, no collision) ─────── */
  const canvas = router.renderer.domElement;
  canvas.style.touchAction = "none";
  canvas.style.cursor = "grab";

  const cam = {
    target: new THREE.Vector3(-30, 0, 0),
    dist: 430,
    theta: 0.72,
    phi: 0.78,
    tTarget: new THREE.Vector3(-30, 0, 0),
    tDist: 430,
    tTheta: 0.72,
    tPhi: 0.78,
    drag: false, panning: false,
    lx: 0, ly: 0,
  };
  const MIN_PHI = 0.13, MAX_PHI = 1.38, MIN_DIST = 45, MAX_DIST = 1000;

  const onPD = (e) => {
    if (e.button === 2 || e.shiftKey) cam.panning = true;
    else { cam.drag = true; canvas.style.cursor = "grabbing"; }
    cam.lx = e.clientX; cam.ly = e.clientY;
  };
  const onPM = (e) => {
    if (!cam.drag && !cam.panning) return;
    const dx = e.clientX - cam.lx, dy = e.clientY - cam.ly;
    cam.lx = e.clientX; cam.ly = e.clientY;
    if (cam.drag) {
      cam.tTheta += dx * 0.0052;
      cam.tPhi   -= dy * 0.0042;
      cam.tPhi = Math.max(MIN_PHI, Math.min(MAX_PHI, cam.tPhi));
    } else {
      const k = cam.dist * 0.0016;
      const ct = Math.cos(cam.theta), st = Math.sin(cam.theta);
      cam.tTarget.x -= (dx * ct - dy * st * 0.9) * k;
      cam.tTarget.z -= (dx * st + dy * ct * 0.9) * k;
      cam.tTarget.x = Math.max(-620, Math.min(620, cam.tTarget.x));
      cam.tTarget.z = Math.max(-620, Math.min(620, cam.tTarget.z));
    }
  };
  const onPU = () => { cam.drag = false; cam.panning = false; canvas.style.cursor = "grab"; };
  const onCM = (e) => e.preventDefault();
  const onWheel = (e) => {
    e.preventDefault();
    const f = Math.pow(1.0012, e.deltaY);
    cam.tDist = Math.max(MIN_DIST, Math.min(MAX_DIST, cam.tDist * f));
  };

  let touchDist = 0;
  const onTS = (e) => {
    if (e.touches.length === 2) {
      cam.drag = false;
      touchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  };
  const onTM = (e) => {
    if (e.touches.length === 2) {
      if (e.cancelable) e.preventDefault();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (touchDist > 0) {
        cam.tDist = Math.max(MIN_DIST, Math.min(MAX_DIST, cam.tDist * (touchDist / d)));
      }
      touchDist = d;
    }
  };

  canvas.addEventListener("pointerdown", onPD);
  canvas.addEventListener("pointermove", onPM);
  canvas.addEventListener("pointerup", onPU);
  canvas.addEventListener("pointercancel", onPU);
  canvas.addEventListener("pointerleave", onPU);
  canvas.addEventListener("contextmenu", onCM);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("touchstart", onTS, { passive: true });
  canvas.addEventListener("touchmove", onTM, { passive: false });

  let simTime = 0, planeT = 0, heliT = 0;

  /* ── 6b. Game-style map controls: D-pad, rotate/zoom/tilt, compass, places, GO ── */
  const ARW = {
    up:    '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
    down:  '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    left:  '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    home:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg>',
    rotL:  '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/></svg>',
    rotR:  '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M20 4v4h-4"/></svg>',
    zin:   '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    zout:  '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
    tup:   '<svg viewBox="0 0 24 24"><path d="M5 17l7-9 7 9"/><path d="M5 21h14"/></svg>',
    tdn:   '<svg viewBox="0 0 24 24"><path d="M5 7l7 9 7-9"/><path d="M5 3h14"/></svg>',
  };
  const ui = document.createElement("div");
  ui.id = "cm-ui";
  ui.innerHTML =
    '<div class="cm-vig"></div>' +
    '<div class="cm-plate"><b>PORT HARCOURT</b><span>CITY MAP</span><em id="cm-near">OPEN GROUND</em></div>' +
    '<button class="cm-compass" id="cm-compass" type="button" aria-label="Face north"><i id="cm-needle"></i><b>N</b></button>' +
    '<div class="cm-dpad" id="cm-dpad">' +
      '<button class="cm-b cm-up"    data-k="up"    type="button" aria-label="Move up">'    + ARW.up    + '</button>' +
      '<button class="cm-b cm-left"  data-k="left"  type="button" aria-label="Move left">'  + ARW.left  + '</button>' +
      '<button class="cm-b cm-mid"   data-k="reset" type="button" aria-label="Reset view">' + ARW.home  + '</button>' +
      '<button class="cm-b cm-right" data-k="right" type="button" aria-label="Move right">' + ARW.right + '</button>' +
      '<button class="cm-b cm-down"  data-k="down"  type="button" aria-label="Move down">'  + ARW.down  + '</button>' +
    '</div>' +
    '<div class="cm-cluster" id="cm-cluster">' +
      '<button class="cm-b" data-k="rotL"  type="button" aria-label="Rotate left">'  + ARW.rotL + '<u>TURN</u></button>' +
      '<button class="cm-b" data-k="rotR"  type="button" aria-label="Rotate right">' + ARW.rotR + '<u>TURN</u></button>' +
      '<button class="cm-b" data-k="zin"   type="button" aria-label="Zoom in">'      + ARW.zin  + '<u>ZOOM</u></button>' +
      '<button class="cm-b" data-k="zout"  type="button" aria-label="Zoom out">'     + ARW.zout + '<u>ZOOM</u></button>' +
      '<button class="cm-b" data-k="tup"   type="button" aria-label="Look down">'    + ARW.tup  + '<u>TILT</u></button>' +
      '<button class="cm-b" data-k="tdn"   type="button" aria-label="Look ahead">'   + ARW.tdn  + '<u>TILT</u></button>' +
    '</div>' +
    '<div class="cm-bottom">' +
      '<button class="cm-places" id="cm-places" type="button"><i></i>PLACES</button>' +
      '<div class="cm-go" id="cm-go" hidden><button class="cm-gobtn" id="cm-gobtn" type="button"><small>GO TO</small><b id="cm-goname"></b></button><button class="cm-x" id="cm-clear" type="button" aria-label="Clear">&#10005;</button></div>' +
    '</div>' +
    '<div class="cm-edge" id="cm-edge" hidden><i></i><b id="cm-edgename"></b></div>';
  document.body.appendChild(ui);
  const $c = (id) => document.getElementById(id);

  /* hold-to-move buttons */
  const held = Object.create(null);
  const setHeld = (k, v) => { held[k] = v; };
  const pressFx = [];
  ui.querySelectorAll(".cm-b").forEach((b) => {
    const k = b.dataset.k;
    const down = (e) => {
      e.preventDefault(); e.stopPropagation();
      try { b.setPointerCapture(e.pointerId); } catch (_) {}
      b.classList.add("on");
      if (k === "reset") { resetView(); return; }
      setHeld(k, true);
    };
    const up = (e) => { b.classList.remove("on"); if (k !== "reset") setHeld(k, false); };
    b.addEventListener("pointerdown", down);
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("lostpointercapture", up);
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    pressFx.push([b, down, up]);
  });

  function resetView() {
    cam.tTarget.set(-30, 0, 0); cam.tDist = 430; cam.tTheta = 0.72; cam.tPhi = 0.78;
  }
  $c("cm-compass").addEventListener("click", (e) => {
    e.stopPropagation();
    /* turn so that north (-Z) is straight up the screen: camera looks along -Z => theta = PI/2 */
    let d = (Math.PI / 2 - cam.tTheta) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
    cam.tTheta += d;
  });

  /* keyboard (desktop): arrows/WASD move, Q/E turn, +/- zoom */
  const KEYMAP = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right", KeyQ: "rotL", KeyE: "rotR", Equal: "zin", NumpadAdd: "zin", Minus: "zout", NumpadSubtract: "zout" };
  const onKD = (e) => {
    const t = e.target; if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
    const k = KEYMAP[e.code]; if (k) { setHeld("k_" + k, true); e.preventDefault(); }
  };
  const onKU = (e) => { const k = KEYMAP[e.code]; if (k) setHeld("k_" + k, false); };
  window.addEventListener("keydown", onKD);
  window.addEventListener("keyup", onKU);

  /* selection + GO */
  function selectLandmark(it, fly) {
    selected = it;
    $c("cm-goname").textContent = it.lm.name.toUpperCase();
    $c("cm-go").hidden = false; $c("cm-places").hidden = true;
    if (fly) { cam.tTarget.set(it.x, 0, it.z); cam.tDist = Math.min(cam.tDist, 260); cam.tTarget.x = Math.max(-620, Math.min(620, cam.tTarget.x)); cam.tTarget.z = Math.max(-620, Math.min(620, cam.tTarget.z)); }
  }
  function clearSelection() {
    selected = null; ring.visible = false;
    $c("cm-go").hidden = true; $c("cm-places").hidden = false; $c("cm-edge").hidden = true;
  }
  $c("cm-gobtn").addEventListener("click", (e) => { e.stopPropagation(); if (selected) routeToLandmark(selected.lm, router); });
  $c("cm-clear").addEventListener("click", (e) => { e.stopPropagation(); clearSelection(); });

  /* PLACES list: nearest first, with an arrow + distance relative to the view */
  const ARROWS = ["\u2191", "\u2197", "\u2192", "\u2198", "\u2193", "\u2199", "\u2190", "\u2196"];
  function bearingArrow(dx, dz) {
    /* screen-relative: forward = (-cos th, -sin th), right = (sin th, -cos th) */
    const st = Math.sin(cam.theta), ct = Math.cos(cam.theta);
    const fwd = dx * -ct + dz * -st, rgt = dx * st + dz * -ct;
    const a = Math.atan2(rgt, fwd);                         // 0 = straight ahead, + = to the right
    return ARROWS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
  }
  $c("cm-places").addEventListener("click", (e) => {
    e.stopPropagation();
    const list = lmItems.map((it) => {
      const dx = it.x - cam.target.x, dz = it.z - cam.target.z;
      return { it, d: Math.hypot(dx, dz), arrow: bearingArrow(dx, dz) };
    }).sort((a, b) => a.d - b.d);
    let sh = null;
    const items = list.map((r) => ({
      icon: "walk", label: r.it.lm.name, sub: r.arrow + "  " + Math.round(r.d) + " m",
      onClick: () => { try { sh && sh.close(); } catch (_) {} selectLandmark(r.it, true); },
    }));
    sh = HUD.sheet({ title: "Places", sub: "Nearest first · arrows are relative to your view", sections: [{ cols: 3, items }] });
  });

  /* per-frame UI + camera input */
  const _v = new THREE.Vector3(), _up = new THREE.Vector3(), _sv = new THREE.Vector3();
  let nearT = 0;
  function cmUpdate(dt) {
    /* held buttons -> camera targets */
    const H = (k) => held[k] || held["k_" + k];
    const sp = cam.dist * 0.85 * dt;
    const st = Math.sin(cam.theta), ct = Math.cos(cam.theta);
    let mx = 0, mz = 0;
    if (H("up"))    { mx += -ct; mz += -st; }
    if (H("down"))  { mx +=  ct; mz +=  st; }
    if (H("right")) { mx +=  st; mz += -ct; }
    if (H("left"))  { mx += -st; mz +=  ct; }
    if (mx || mz) {
      cam.tTarget.x = Math.max(-620, Math.min(620, cam.tTarget.x + mx * sp));
      cam.tTarget.z = Math.max(-620, Math.min(620, cam.tTarget.z + mz * sp));
      /* moving by hand drops any fly-to */
    }
    if (H("rotL")) cam.tTheta -= 1.5 * dt;
    if (H("rotR")) cam.tTheta += 1.5 * dt;
    if (H("zin"))  cam.tDist = Math.max(MIN_DIST, cam.tDist * Math.exp(-1.15 * dt));
    if (H("zout")) cam.tDist = Math.min(MAX_DIST, cam.tDist * Math.exp( 1.15 * dt));
    if (H("tup"))  cam.tPhi = Math.max(MIN_PHI, cam.tPhi - 0.9 * dt);
    if (H("tdn"))  cam.tPhi = Math.min(MAX_PHI, cam.tPhi + 0.9 * dt);
  }
  function cmLayout(dt, t) {
    camera.updateMatrixWorld();
    _up.setFromMatrixColumn(camera.matrixWorld, 1);

    /* compass: needle points to north (-Z) in screen terms */
    const st = Math.sin(cam.theta), ct = Math.cos(cam.theta);
    const fx = -ct, fz = -st, rx = st, rz = -ct;
    const needle = Math.atan2(0 * rx + -1 * rz, 0 * fx + -1 * fz) * 180 / Math.PI;
    const nd = $c("cm-needle"); if (nd) nd.style.transform = "rotate(" + needle.toFixed(1) + "deg)";

    /* pins at constant screen size */
    for (const it of lmItems) {
      _v.set(it.x, 14, it.z);
      const d = _v.distanceTo(camera.position), s = wpp(d) * PIN_PX;
      it.pin.scale.set(s, s, 1);
      it.pin.position.copy(_v).addScaledVector(_up, s * 0.5);
      it.dist = Math.hypot(it.x - cam.target.x, it.z - cam.target.z);
    }

    /* labels: the closest few that fit on screen without overlapping */
    const order = lmItems.slice().sort((a, b) => ((b === selected) - (a === selected)) || (a.dist - b.dist));
    /* keep labels clear of the on-screen controls (cached, refreshed ~1/s) */
    if (!cmLayout._ex || (cmLayout._exT = (cmLayout._exT || 0) - dt) <= 0) {
      cmLayout._exT = 1;
      cmLayout._ex = [];
      document.querySelectorAll(".cm-plate,.cm-dpad,.cm-compass,.cm-cluster,.cm-bottom,#hud-tl,#hud-tr").forEach((e) => {
        const r = e.getBoundingClientRect();
        if (r.width > 2 && r.height > 2) cmLayout._ex.push({ x0: r.left - 4, x1: r.right + 4, y0: r.top - 4, y1: r.bottom + 4 });
      });
    }
    const taken = cmLayout._ex.slice(); let shown = 0;
    for (const it of order) {
      if (!it.label) continue;
      it.label.visible = false;
      if (shown >= 9) continue;
      if (it !== selected && it.dist > cam.dist * 0.95) continue;
      _v.set(it.x, 14, it.z);
      const d = _v.distanceTo(camera.position), k = wpp(d);
      const h = k * LABEL_PX, w = h * it.aspect;
      _v.addScaledVector(_up, k * (PIN_PX + LABEL_PX * 0.6 + 2));
      it.label.scale.set(w, h, 1); it.label.position.copy(_v);
      _sv.copy(_v).project(camera);
      if (_sv.z > 1 || Math.abs(_sv.x) > 1.05 || Math.abs(_sv.y) > 1.05) continue;
      const cx = (_sv.x * 0.5 + 0.5) * innerWidth, cy = (-_sv.y * 0.5 + 0.5) * innerHeight, pw = w / k;
      const r = { x0: cx - pw / 2 - 4, x1: cx + pw / 2 + 4, y0: cy - LABEL_PX / 2 - 3, y1: cy + LABEL_PX / 2 + 3 };
      if (it !== selected && taken.some((q) => !(r.x1 < q.x0 || q.x1 < r.x0 || r.y1 < q.y0 || q.y1 < r.y0))) continue;
      taken.push(r); it.label.visible = true; shown++;
    }

    /* selection ring + off-screen direction arrow */
    const edge = $c("cm-edge");
    if (selected) {
      _v.set(selected.x, 14, selected.z);
      const d = _v.distanceTo(camera.position), k = wpp(d);
      const s = k * 60 * (1 + 0.1 * Math.sin(t * 5));
      ring.scale.set(s, s, 1); ring.position.copy(_v).addScaledVector(_up, k * PIN_PX * 0.5); ring.visible = true;
      _sv.copy(_v).project(camera);
      const behind = _sv.z > 1;
      const sx = (_sv.x * 0.5 + 0.5) * innerWidth, sy = (-_sv.y * 0.5 + 0.5) * innerHeight;
      const off = behind || sx < 56 || sx > innerWidth - 56 || sy < 70 || sy > innerHeight - 70;
      if (off) {
        let dx = sx - innerWidth / 2, dy = sy - innerHeight / 2;
        if (behind) { dx = -dx; dy = -dy; }
        const ang = Math.atan2(dy, dx);
        /* free area between the title plate, the D-pad/compass and the turn/zoom cluster */
        const x0 = 160, x1 = innerWidth - 120, y0 = 104, y1 = innerHeight - 110;
        const cx0 = (x0 + x1) / 2, cy0 = (y0 + y1) / 2, hw = Math.max(20, (x1 - x0) / 2), hh = Math.max(10, (y1 - y0) / 2);
        const sc = Math.min(Math.abs(hw / (Math.cos(ang) || 1e-6)), Math.abs(hh / (Math.sin(ang) || 1e-6)));
        const ex = cx0 + Math.cos(ang) * sc, ey = cy0 + Math.sin(ang) * sc;
        edge.hidden = false;
        edge.style.left = ex.toFixed(0) + "px"; edge.style.top = ey.toFixed(0) + "px";
        edge.firstChild.style.transform = "rotate(" + (ang * 180 / Math.PI + 90).toFixed(1) + "deg)";
        $c("cm-edgename").textContent = selected.lm.name;
      } else edge.hidden = true;
    }

    /* "near" readout, a few times a second */
    nearT -= dt;
    if (nearT <= 0) {
      nearT = 0.25;
      let best = null;
      for (const it of lmItems) if (!best || it.dist < best.dist) best = it;
      const el = $c("cm-near");
      if (el) el.textContent = best && best.dist < 140 ? "NEAR \u00b7 " + best.lm.name.toUpperCase() : "OPEN GROUND";
    }
  }
  const cmDispose = () => {
    window.removeEventListener("keydown", onKD);
    window.removeEventListener("keyup", onKU);
    try { ui.remove(); } catch (e) {}
  };


  return {
    three, camera,
    controls: { update: () => {} },
    crumb: "CITY MAP",
    title: "PORT HARCOURT",
    subtitle: "ARROWS TO MOVE · TAP A PIN",
    hint: "",
    dispose: () => {
      try { menuBtn.remove(); } catch (e) {}
      try { cmDispose(); } catch (e) {}
      canvas.removeEventListener("pointerdown", onPD);
      canvas.removeEventListener("pointermove", onPM);
      canvas.removeEventListener("pointerup", onPU);
      canvas.removeEventListener("pointercancel", onPU);
      canvas.removeEventListener("pointerleave", onPU);
      canvas.removeEventListener("contextmenu", onCM);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTS);
      canvas.removeEventListener("touchmove", onTM);
      try {
        three.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            const ms = Array.isArray(o.material) ? o.material : [o.material];
            ms.forEach((m) => m && m.dispose && m.dispose());
          }
        });
      } catch (e) {}
    },
    update: (dt, t) => {
      simTime += dt;
      const k = 1 - Math.pow(0.0016, dt);
      cam.theta += (cam.tTheta - cam.theta) * k;
      cam.phi   += (cam.tPhi   - cam.phi)   * k;
      cam.dist  += (cam.tDist  - cam.dist)  * k;
      cam.target.lerp(cam.tTarget, k);

      const sp = Math.sin(cam.phi), cp = Math.cos(cam.phi);
      const st = Math.sin(cam.theta), ct = Math.cos(cam.theta);
      camera.position.set(
        cam.target.x + cam.dist * sp * ct,
        cam.target.y + cam.dist * cp,
        cam.target.z + cam.dist * sp * st
      );
      if (camera.position.y < 6) camera.position.y = 6;
      camera.lookAt(cam.target);
      cmUpdate(dt);
      cmLayout(dt, simTime);

      if (planeGroup && planePath) {
        planeT = (planeT + dt / 26) % 1;
        const pos = planePath.getPointAt(planeT);
        const ahead = planePath.getPointAt((planeT + 0.01) % 1);
        planeGroup.position.copy(pos);
        const dx = ahead.x - pos.x, dz = ahead.z - pos.z;
        if (dx * dx + dz * dz > 0.001) planeGroup.rotation.y = Math.atan2(dx, dz);
      }
      if (heliGroup && heliPath) {
        heliT = (heliT + dt / 16) % 1;
        const pos = heliPath.getPointAt(heliT);
        const ahead = heliPath.getPointAt((heliT + 0.01) % 1);
        heliGroup.position.copy(pos);
        heliGroup.position.y += Math.sin(simTime * 1.4) * 0.6;
        const dx = ahead.x - pos.x, dz = ahead.z - pos.z;
        if (dx * dx + dz * dz > 0.001) heliGroup.rotation.y = Math.atan2(dx, dz) + Math.PI;
        if (heliRotors && heliRotors.main) heliRotors.main.rotation.y = simTime * 42;
      }
    },
  };
}
