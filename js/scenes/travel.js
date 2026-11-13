/* travel.js -- night ride / night drive cinematic while travelling. */
import * as THREE from "three";
import { State } from "../core/state.js";
import { Quality } from "../core/quality.js";
import { buildGWagon3D } from "../vehicles/gwagon3d.js";
import { buildCybertruck3D } from "../vehicles/cybertruck3d.js";
import { buildRangeRover3D } from "../vehicles/rangerover_compound.js";
import { buildMoto3D } from "../vehicles/moto3d.js";
import { buildVehicle as buildVehicleSimple } from "../vehicles/models.js";
import { buildScrappy3D } from "../vehicles/scrappy3d.js";

const UP = new THREE.Vector3(0, 1, 0);
const FOG_COL = 0x070a12;

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

function texFacade() {
  const S = 64; const c = makeCanvas(S, S); const x = c.getContext("2d");
  x.fillStyle = "#0b0f16"; x.fillRect(0, 0, S, S);
  for (let r = 0; r < 4; r++) {
    for (let q = 0; q < 4; q++) {
      let col = "#121822";
      if (Math.random() >= 0.42) {
        const rr = 190 + Math.floor(Math.random() * 65); const gg = 150 + Math.floor(Math.random() * 70);
        const bb = Math.random() > 0.55 ? 80 + Math.floor(Math.random() * 60) : 150 + Math.floor(Math.random() * 90);
        col = "rgb(" + rr + "," + gg + "," + bb + ")";
      }
      x.fillStyle = col; x.fillRect(q * 16 + 1.5, r * 16 + 1.5, 13, 13);
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function texGlow() {
  const S = 64; const c = makeCanvas(S, S); const x = c.getContext("2d");
  const g = x.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
  g.addColorStop(0.00, "rgba(255,242,214,1)"); g.addColorStop(0.22, "rgba(255,214,150,0.55)"); g.addColorStop(0.55, "rgba(255,190,110,0.14)"); g.addColorStop(1.00, "rgba(255,180,90,0)");
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}

function texBlob() {
  const S = 64; const c = makeCanvas(S, S); const x = c.getContext("2d");
  const g = x.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
  g.addColorStop(0.00, "rgba(0,0,0,0.85)"); g.addColorStop(0.50, "rgba(0,0,0,0.42)"); g.addColorStop(1.00, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}

function texBeam() {
  const S = 128; const c = makeCanvas(S, S); const x = c.getContext("2d");
  const gv = x.createLinearGradient(0, 0, 0, S);
  gv.addColorStop(0.00, "rgba(255,240,205,0.66)"); gv.addColorStop(0.25, "rgba(255,232,190,0.36)"); gv.addColorStop(0.60, "rgba(255,222,175,0.10)"); gv.addColorStop(1.00, "rgba(255,215,165,0)");
  x.fillStyle = gv; x.fillRect(0, 0, S, S);
  x.globalCompositeOperation = "destination-in";
  const gh = x.createLinearGradient(0, 0, S, 0);
  gh.addColorStop(0.00, "rgba(0,0,0,0)"); gh.addColorStop(0.50, "rgba(0,0,0,1)"); gh.addColorStop(1.00, "rgba(0,0,0,0)");
  x.fillStyle = gh; x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}

function texDash() {
  const c = makeCanvas(8, 64); const x = c.getContext("2d");
  x.clearRect(0, 0, 8, 64); x.fillStyle = "#e6e2ce"; x.fillRect(2, 4, 4, 26);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}

function makeRibbon(path, o1, o2, y, segs, vScale) {
  const pos = []; const uv = []; const idx = [];
  const p = new THREE.Vector3(); const t = new THREE.Vector3(); const n = new THREE.Vector3();
  let cum = 0; let px = 0; let pz = 0;
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    path.getPointAt(u, p); path.getTangentAt(u, t); n.crossVectors(t, UP).normalize();
    if (i > 0) { const dx = p.x - px; const dz = p.z - pz; cum += Math.sqrt(dx * dx + dz * dz); }
    px = p.x; pz = p.z;
    pos.push(p.x + n.x * o1, y, p.z + n.z * o1); pos.push(p.x + n.x * o2, y, p.z + n.z * o2);
    const v = cum * vScale; uv.push(0, v, 1, v);
    if (i < segs) { const a = i * 2; const b = a + 1; const c = a + 2; const d = a + 3; idx.push(a, b, c, b, d, c); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

export async function travelScene(params, router) {
  const mode = params.mode; const target = params.target; const name = params.name; const kind = params.kind;
  const TIER = (Quality && Quality.current && Quality.current.tier) || "medium";
  const LOW = TIER === "low";
  const model = (State && State.vehicle && State.vehicle.model) || "gwagon";
  const useBike = (mode === "bike") || (model === "moto");

  const RIB_SEG = LOW ? 120 : 200; const POLE_N = LOW ? 20 : 34; const PATH_SEG = 100; const BOX_STEP = LOW ? 24 : 17;

  const three = new THREE.Scene(); three.background = new THREE.Color(FOG_COL); three.fog = new THREE.Fog(FOG_COL, 34, LOW ? 120 : 150);
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.6, 300);

  three.add(new THREE.HemisphereLight(0x2b4066, 0x05070c, 1.2));
  const keyLight = new THREE.DirectionalLight(0x9fb9ff, 0.75); keyLight.position.set(-50, 90, -35); three.add(keyLight);

  const facadeTex = texFacade(); const glowTex = texGlow(); const blobTex = texBlob(); const beamTex = texBeam(); const dashTex = texDash();

  const ringPts = [[52, -32], [28, -38], [-28, -38], [-52, -32], [-62, -12], [-62, 12], [-52, 32], [-28, 38], [28, 38], [52, 32], [62, 12], [62, -12]].map(function (p) { return new THREE.Vector3(p[0], 0, p[1]); });
  const path = new THREE.CatmullRomCurve3(ringPts, true, "catmullrom", 0.5); path.arcLengthDivisions = 300; const pathLen = path.getLength();

  const groundGeo = new THREE.PlaneGeometry(460, 460); const groundMat = new THREE.MeshBasicMaterial({ color: 0x080b11 });
  const ground = new THREE.Mesh(groundGeo, groundMat); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.08; three.add(ground);

  const asphalt = new THREE.Mesh(makeRibbon(path, -6.2, 6.2, 0.0, RIB_SEG, 0), new THREE.MeshBasicMaterial({ color: 0x151a22, side: THREE.DoubleSide })); three.add(asphalt);
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x2f3a4c, side: THREE.DoubleSide });
  three.add(new THREE.Mesh(makeRibbon(path, 5.6, 6.0, 0.02, RIB_SEG, 0), edgeMat)); three.add(new THREE.Mesh(makeRibbon(path, -6.0, -5.6, 0.02, RIB_SEG, 0), edgeMat));
  const dashMat = new THREE.MeshBasicMaterial({ map: dashTex, color: 0xbfc4b4, alphaTest: 0.5, side: THREE.DoubleSide });
  three.add(new THREE.Mesh(makeRibbon(path, -0.22, 0.22, 0.03, RIB_SEG, 1 / 9), dashMat));

  const samples = []; for (let si = 0; si < PATH_SEG; si++) samples.push(path.getPointAt(si / PATH_SEG));
  function nearRoad(x, z) { for (let i = 0; i < PATH_SEG; i++) { const p = samples[i]; const dx = p.x - x; const dz = p.z - z; if (dx * dx + dz * dz < 169) return true; } return false; }

  const boxes = [];
  for (let gx = -102; gx <= 102; gx += BOX_STEP) {
    for (let gz = -85; gz <= 85; gz += BOX_STEP) {
      const jx = gx + (Math.random() - 0.5) * 3; const jz = gz + (Math.random() - 0.5) * 3;
      if (nearRoad(jx, jz)) continue;
      boxes.push({ x: jx, z: jz, w: 9 + Math.random() * 5, d: 9 + Math.random() * 5, h: 13 + Math.pow(Math.random(), 2.1) * 44, rot: (Math.random() < 0.5 ? 0 : Math.PI / 2) + (Math.random() - 0.5) * 0.12 });
    }
  }

  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const whiteCols = new Float32Array(boxGeo.attributes.position.count * 3); whiteCols.fill(1); boxGeo.setAttribute("color", new THREE.Float32BufferAttribute(whiteCols, 3));
  const cityMat = new THREE.MeshLambertMaterial({ map: facadeTex, emissive: 0xffffff, emissiveMap: facadeTex, emissiveIntensity: 0.9, vertexColors: true, color: 0xffffff });
  const city = new THREE.InstancedMesh(boxGeo, cityMat, boxes.length); city.frustumCulled = false;

  const _m4 = new THREE.Matrix4(); const _q = new THREE.Quaternion(); const _s = new THREE.Vector3(); const _p = new THREE.Vector3(); const _c = new THREE.Color();
  for (let bi = 0; bi < boxes.length; bi++) {
    const b = boxes[bi]; _p.set(b.x, 0, b.z); _q.setFromAxisAngle(UP, b.rot); _s.set(b.w, b.h, b.d); _m4.compose(_p, _q, _s);
    city.setMatrixAt(bi, _m4); const tint = 0.72 + Math.random() * 0.5; _c.setRGB(tint * 0.95, tint * 0.98, Math.min(1.2, tint * 1.06)); city.setColorAt(bi, _c);
  }
  city.instanceMatrix.needsUpdate = true; if (city.instanceColor) city.instanceColor.needsUpdate = true; three.add(city);

  const poleGeo = new THREE.CylinderGeometry(0.09, 0.14, 7.2, 5, 1, true); poleGeo.translate(0, 3.6, 0);
  const headGeo = new THREE.BoxGeometry(0.34, 0.16, 1.3); headGeo.translate(0, 7.15, 0.6);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x1c222c }), POLE_N); const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), POLE_N);
  poles.frustumCulled = false; heads.frustumCulled = false;

  const glowPos = new Float32Array(POLE_N * 3); const _pt = new THREE.Vector3(); const _tn = new THREE.Vector3(); const _nm = new THREE.Vector3();
  for (let li = 0; li < POLE_N; li++) {
    const lu = li / POLE_N; path.getPointAt(lu, _pt); path.getTangentAt(lu, _tn); _nm.crossVectors(_tn, UP).normalize();
    const side = (li % 2 === 0) ? 1 : -1; const lx = _pt.x + _nm.x * 7.4 * side; const lz = _pt.z + _nm.z * 7.4 * side; const yaw = Math.atan2(-_nm.x * side, -_nm.z * side);
    _q.setFromAxisAngle(UP, yaw); _p.set(lx, 0, lz); _s.set(1, 1, 1); _m4.compose(_p, _q, _s); poles.setMatrixAt(li, _m4); heads.setMatrixAt(li, _m4);
    glowPos[li * 3] = lx + Math.sin(yaw) * 0.6; glowPos[li * 3 + 1] = 7.15; glowPos[li * 3 + 2] = lz + Math.cos(yaw) * 0.6;
  }
  poles.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true; three.add(poles); three.add(heads);

  const glowGeo = new THREE.BufferGeometry(); glowGeo.setAttribute("position", new THREE.BufferAttribute(glowPos, 3));
  const glowsMat = new THREE.PointsMaterial({ size: 3.4, map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, color: 0xffcf95, fog: true });
  const glows = new THREE.Points(glowGeo, glowsMat); glows.frustumCulled = false; three.add(glows);

  /* ── VEHICLE CREATION (Restored Bike Model) ── */
  let carRoot; let wheels; let steerGroup = null; let shadow = null; let beamGroup = null;

  if (useBike) {
   let bikeMesh = buildMoto3D(State.vehicle.body, State.vehicle.rim);
bikeMesh.rotation.y = Math.PI; // Bike model faces -Z locally
    carRoot = new THREE.Group();
    carRoot.add(bikeMesh);
    three.add(carRoot);
    wheels = bikeMesh.userData.wheels || [];
    
    const beamMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 15), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95, fog: false }));
    beamMesh.rotation.x = -Math.PI / 2; beamMesh.position.set(0, 0.05, 8.0); beamMesh.renderOrder = 4; carRoot.add(beamMesh);
    
    const carBlob = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3.9), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.85, color: 0x000000, fog: true }));
    carBlob.rotation.x = -Math.PI / 2; carBlob.position.y = 0.02; carBlob.renderOrder = 3; carRoot.add(carBlob);
  } else {
        let carMesh;
    if (model === "scrappy") carMesh = buildScrappy3D(State.vehicle.body, State.vehicle.rim);
    else if (model === "cybertruck") carMesh = buildCybertruck3D(State.vehicle.body, State.vehicle.rim);
    else if (model === "rangerover") carMesh = buildRangeRover3D(State.vehicle.body, State.vehicle.rim);
    else if (model === "gwagon") carMesh = buildGWagon3D(State.vehicle.body, State.vehicle.rim);
    else carMesh = buildVehicleSimple(model, State.vehicle.body, State.vehicle.rim);

    const FRONT_CORRECTION = {
  gwagon:     Math.PI,
  cybertruck: 0,
  rangerover: 0,
  mercedes:  -Math.PI / 2,
  bmw:       -Math.PI / 2,
  chiron:    -Math.PI / 2,
  hilux:     -Math.PI / 2,
  taxi:       0,
  scrappy:    0,
  nk250:      0,
  hoverboard: 0,
};
carRoot = new THREE.Group(); carRoot.rotation.order = "YXZ";
carMesh.rotation.y = FRONT_CORRECTION[model] !== undefined
  ? FRONT_CORRECTION[model]
  : -Math.PI / 2;
    carRoot.add(carMesh); three.add(carRoot);
    wheels = (carMesh.userData && carMesh.userData.wheels) || [];

    const carBeam = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 16), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95, fog: false }));
    carBeam.rotation.x = -Math.PI / 2; carBeam.position.set(0, 0.05, 8.5); carBeam.renderOrder = 4; carRoot.add(carBeam);

    const carBlob = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6.4), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.85, color: 0x000000, fog: true }));
    carBlob.rotation.x = -Math.PI / 2; carBlob.position.y = 0.02; carBlob.renderOrder = 3; carRoot.add(carBlob);
  }

  const hudWrap = document.createElement("div"); hudWrap.id = "ph3d-travel-hud";
  hudWrap.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:28;display:flex;flex-direction:column;align-items:center;gap:13px;padding:0 24px calc(env(safe-area-inset-bottom) + 9vh);pointer-events:none;transition:opacity .9s ease";
  const hudLabel = document.createElement("div"); hudLabel.style.cssText = "font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:#6f86ab;font-weight:600;display:flex;gap:10px;align-items:baseline;font-family:Inter,system-ui,sans-serif";
  const hudMsg = document.createElement("span"); hudMsg.textContent = useBike ? "RIDING" : "DRIVING";
  const hudPct = document.createElement("b"); hudPct.textContent = "0%"; hudPct.style.cssText = "color:#dceaff;font-weight:700;font-variant-numeric:tabular-nums";
  hudLabel.appendChild(hudMsg); hudLabel.appendChild(hudPct);
  const hudTrack = document.createElement("div"); hudTrack.style.cssText = "width:min(58vw,330px);height:2px;border-radius:2px;background:rgba(150,180,230,.15);overflow:hidden";
  const hudFill = document.createElement("div"); hudFill.style.cssText = "height:100%;width:100%;transform:scaleX(0);transform-origin:0 50%;background:linear-gradient(90deg,#2c66c4,#69b6ff 58%,#d5ecff);will-change:transform";
  hudTrack.appendChild(hudFill); hudWrap.appendChild(hudLabel); hudWrap.appendChild(hudTrack); document.body.appendChild(hudWrap);

  try { router.ui.travelStart(mode, name); } catch (e) {}

  const SPEED = useBike ? 17 : 19; const LANE = useBike ? 2.5 : 2.9; const WHEEL_R = useBike ? 0.33 : 0.44; const DURATION = 3600;
  const start = performance.now(); let arrived = false; let u = 0.02; let wheelRot = 0; let steer = 0; let heading = 0; let shown = -1;

  const _cp = new THREE.Vector3(); const _ct = new THREE.Vector3(); const _ct2 = new THREE.Vector3(); const _cr = new THREE.Vector3(); const _cf = new THREE.Vector3(); const _camP = new THREE.Vector3(); const _camL = new THREE.Vector3();

  path.getPointAt(u, _cp); path.getTangentAt(u, _ct); _cr.crossVectors(UP, _ct).normalize(); heading = Math.atan2(_ct.x, _ct.z);

  function doArrive() {
    if (arrived) return; arrived = true;
    try { router.ui.travelEnd(); } catch (e) {}
    try { hudWrap.style.opacity = "0"; } catch (e) {}
    setTimeout(function () { try { hudWrap.remove(); } catch (e) {} }, 900);
    try { router.stack.pop(); } catch (e) {}
    setTimeout(function () {
      let dest = "interior"; let destParams = { id: target };
      if (params.parent) destParams.parent = params.parent;
      if (target === "pleasurepark") { dest = "pleasurepark"; destParams = { id: target }; }
      else if (kind === "parent") { dest = "minimap"; destParams = { id: target }; }
      else if (target === "showroom") { dest = "showroom"; destParams = { id: target }; }
      else if (target === "pleasurepark") { dest = "pleasurepark"; destParams = { id: target }; }
      router.go(dest, destParams);
    }, 200);
  }

  return {
    three: three, camera: camera, controls: { update: function () {} },
    crumb: "TRAVELLING", title: name, subtitle: useBike ? "RIDING" : "DRIVING", hint: "",
    dispose: function () { try { router.ui.travelEnd(); } catch (e) {} try { hudWrap.remove(); } catch (e) {} },
    update: function (dt, t) {
      const now = performance.now(); const p = Math.min(1, (now - start) / DURATION);
      try { router.ui.travelProgress(p); } catch (e) {}

      u = (u + (SPEED * dt) / pathLen) % 1; path.getPointAt(u, _cp); path.getTangentAt(u, _ct); _cr.crossVectors(UP, _ct).normalize();
      const newHeading = Math.atan2(_ct.x, _ct.z);
      let dY = newHeading - heading; while (dY > Math.PI) dY -= Math.PI * 2; while (dY < -Math.PI) dY += Math.PI * 2;
      heading += dY * Math.min(1, dt * 10);

      const carX = _cp.x + _cr.x * LANE; const carZ = _cp.z + _cr.z * LANE;
      carRoot.position.set(carX, 0, carZ); carRoot.rotation.y = heading;

      path.getTangentAt((u + 0.004) % 1, _ct2); let dy2 = Math.atan2(_ct2.x, _ct2.z) - heading; while (dy2 > Math.PI) dy2 -= Math.PI * 2; while (dy2 < -Math.PI) dy2 += Math.PI * 2;
      const maxSteer = useBike ? 0.42 : 0.46; const targetSteer = Math.max(-maxSteer, Math.min(maxSteer, dy2 * 11));
      steer += (targetSteer - steer) * Math.min(1, dt * 7);

      if (useBike) {
  carRoot.rotation.z = -steer * 1.18; carRoot.rotation.x = Math.sin(t * 13) * 0.006;
  wheelRot += (SPEED * dt / WHEEL_R) * 0.40; if (wheelRot > Math.PI * 2) wheelRot -= Math.PI * 2;
  if (wheels[0] && wheels[0].spin) wheels[0].spin.rotation.x = -wheelRot;
  if (wheels[1] && wheels[1].spin) wheels[1].spin.rotation.x = -wheelRot;
  if (wheels[0] && wheels[0].pivot) wheels[0].pivot.rotation.y = steer;
} else {
  carRoot.rotation.z = -steer * 0.30; carRoot.rotation.x = Math.sin(t * 11) * 0.005;
  wheelRot += (SPEED * dt / WHEEL_R) * 0.42; if (wheelRot > Math.PI * 2) wheelRot -= Math.PI * 2;
  
  // --- WHEEL SPIN FIX ---
  if (wheels && wheels.length) {
    for (let wi = 0; wi < wheels.length; wi++) {
      const w = wheels[wi];
      if (w.spin && w.pivot) {
        if (w.spinZ) w.spin.rotation.z = -wheelRot;
        else         w.spin.rotation.x =  wheelRot;
        if (w.steer) w.pivot.rotation.y = steer;
      } else if (w.mesh) {
        if (w.spinZ) w.mesh.rotation.z = -wheelRot;
        else         w.mesh.rotation.x =  wheelRot;
      }
    }
  }
  // ----------------------
}
      _cf.set(Math.sin(heading), 0, Math.cos(heading)); _cr.set(Math.cos(heading), 0, -Math.sin(heading));
      _camP.set(carX - _cf.x * 9.2 + _cr.x * 1.1, 4.4, carZ - _cf.z * 9.2 + _cr.z * 1.1);
      camera.position.lerp(_camP, 1 - Math.pow(0.02, dt));
      _camL.set(carX + _cf.x * 6.5, 1.35, carZ + _cf.z * 6.5);
      camera.up.set(0, 1, 0); camera.lookAt(_camL);

      const e = 1 - Math.pow(1 - p, 2.6);
      if (e - shown > 0.004 || p >= 1) { shown = e; hudFill.style.transform = "scaleX(" + e.toFixed(4) + ")"; hudPct.textContent = Math.round(e * 100) + "%"; }
      if (p >= 1) { hudMsg.textContent = "ARRIVED"; doArrive(); }
    }
  };
}

