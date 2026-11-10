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

  /* ── 3. Landmark tap planes + 3D labels ──────────────────── */
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  for (const lm of world.landmarks) {
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), hitMat);
    hit.rotation.x = -Math.PI / 2;
    hit.position.set(lm.x, 12, lm.z);
    hit.userData.tap = () => routeToLandmark(lm, router);
    three.add(hit);

    try {
      const lbl = textLabel(lm.name, "");
      lbl.position.set(lm.x, 45, lm.z);
      lbl.scale.multiplyScalar(0.9);
      three.add(lbl);
    } catch (e) {}
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

  return {
    three, camera,
    controls: { update: () => {} },
    crumb: "CITY MAP",
    title: "PORT HARCOURT",
    subtitle: "DRAG TO LOOK AROUND",
    hint: "",
    dispose: () => {
      try { menuBtn.remove(); } catch (e) {}
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
