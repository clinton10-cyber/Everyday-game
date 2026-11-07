import * as THREE from "three";
import { M, EM, textLabel, windowTexture, getEnv } from "../../core/kit.js";
import meta from "./meta.js";
import { buildTrafficCar, TRAFFIC_MODELS } from "../../vehicles/traffic.js";

export function buildExterior() {
  const g = new THREE.Group();
  const wt = windowTexture("#cfd8dc", "#4d6f8f", 8, 4);
  const wm = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.5, envMap: getEnv() });
  const glass = new THREE.MeshStandardMaterial({ color: 0x5ee0ff, transparent: true, opacity: 0.6, roughness: 0.1 });
  const roof = M(0x2c3e50, 0.8);

  // ========== SHARED GEO ==========
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
  const SPH = new THREE.SphereGeometry(1, 8, 6);
  const CONE = new THREE.ConeGeometry(1, 1, 6);
  const PLANE = new THREE.PlaneGeometry(1, 1);

  const LAM = (c) => new THREE.MeshLambertMaterial({ color: c });
  const BAS = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });

  const MAT = {
    grass: LAM(0x6a9a4a),
    tarmac: LAM(0x3a3a3a),
    runway: LAM(0x1a1a1a),
    road: LAM(0x444444),
    line: BAS(0xffffff),
    yellowLine: BAS(0xffdd00),
    runwayLight: BAS(0xffe88a),
    metalDark: LAM(0x333333),
    tire: BAS(0x111111),
    carGlass: BAS(0x88ccff),
    planeBody: LAM(0xf5f5f5),
    planeStripe: BAS(0xd32f2f),
    engine: LAM(0xcccccc),
    carRed: LAM(0xd32f2f),
    carBlue: LAM(0x1976d2),
    carYellow: LAM(0xf9a825),
    carGreen: LAM(0x388e3c),
    carWhite: LAM(0xe0e0e0),
    carPurple: LAM(0x7b1fa2),
    headlight: BAS(0xffee88),
    taillight: BAS(0xff3333),
    treeTrunk: LAM(0x5a3a20),
    treeLeaf: LAM(0x3a7a2a),
  };

  const mkBox = (mat, sx, sy, sz, x, y, z) => {
    const m = new THREE.Mesh(BOX, mat);
    m.scale.set(sx, sy, sz); m.position.set(x, y, z);
    return m;
  };

  // ========== GROUND ==========
  const grass = new THREE.Mesh(PLANE, MAT.grass);
  grass.rotation.x = -Math.PI / 2;
  grass.scale.set(500, 500, 1);
  grass.position.y = -0.02;
  g.add(grass);

  const apron = new THREE.Mesh(PLANE, MAT.tarmac);
  apron.rotation.x = -Math.PI / 2;
  apron.scale.set(140, 80, 1);
  apron.position.set(0, 0, 30);
  g.add(apron);

  const runway = new THREE.Mesh(PLANE, MAT.runway);
  runway.rotation.x = -Math.PI / 2;
  runway.scale.set(300, 40, 1);
  runway.position.set(0, 0.01, 100);
  g.add(runway);

  for (let i = -14; i <= 14; i++) {
    const dash = new THREE.Mesh(PLANE, MAT.line);
    dash.rotation.x = -Math.PI / 2;
    dash.scale.set(4, 1.2, 1);
    dash.position.set(i * 10, 0.02, 100);
    g.add(dash);
  }
  for (let i = -14; i <= 14; i += 2) {
    for (const side of [-1, 1]) {
      const light = new THREE.Mesh(SPH, MAT.runwayLight);
      light.scale.setScalar(0.15);
      light.position.set(i * 10, 0.15, 100 + side * 19);
      g.add(light);
    }
  }

  // Road (where smart cars drive)
  const road = new THREE.Mesh(PLANE, MAT.road);
  road.rotation.x = -Math.PI / 2;
  road.scale.set(300, 10, 1);
  road.position.set(0, 0.03, 20);
  g.add(road);

  for (let i = -28; i <= 28; i++) {
    const dash = new THREE.Mesh(PLANE, MAT.yellowLine);
    dash.rotation.x = -Math.PI / 2;
    dash.scale.set(2.5, 0.2, 1);
    dash.position.set(i * 5, 0.04, 20);
    g.add(dash);
  }

  // ========== TERMINAL (kept from original) ==========
  const base = new THREE.Mesh(new THREE.BoxGeometry(8, 2.5, 4), [wm, wm, roof, roof, wm, wm]);
  base.position.y = 1.25;
  base.castShadow = base.receiveShadow = true;
  g.add(base);

  const tower = new THREE.Mesh(new THREE.BoxGeometry(1.5, 6, 1.5), wm);
  tower.position.set(-3, 3, 0);
  g.add(tower);

  const towerGlass = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.8), glass);
  towerGlass.position.set(-3, 6.2, 0);
  g.add(towerGlass);

  const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.8, 4), roof);
  towerRoof.position.set(-3, 7.2, 0);
  towerRoof.rotation.y = Math.PI / 4;
  g.add(towerRoof);

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 2), M(0x555555));
  canopy.position.set(1, 2.5, 2.5);
  g.add(canopy);

  const radar = new THREE.Mesh(SPH, BAS(0xff0000));
  radar.scale.setScalar(0.3);
  radar.position.set(-3, 7.8, 0);
  g.add(radar);

  // ========== BIG AIRPLANE ==========
  function buildAirplane() {
    const plane = new THREE.Group();

    // Fuselage
    const fus = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 20, 10), MAT.planeBody);
    fus.rotation.z = Math.PI / 2;
    fus.position.y = 4;
    plane.add(fus);

    // Nose
    const nose = new THREE.Mesh(CONE, MAT.planeBody);
    nose.scale.set(2, 3, 2);
    nose.rotation.z = -Math.PI / 2;
    nose.position.set(11.5, 4, 0);
    plane.add(nose);

    // Tail cone
    const tailCone = new THREE.Mesh(CONE, MAT.planeBody);
    tailCone.scale.set(2, 2.5, 2);
    tailCone.rotation.z = Math.PI / 2;
    tailCone.position.set(-11.25, 4, 0);
    plane.add(tailCone);

    // Vertical fin + red stripe
    const vfin = new THREE.Mesh(BOX, MAT.planeBody);
    vfin.scale.set(3, 4, 0.3);
    vfin.position.set(-8, 7, 0);
    plane.add(vfin);

    const vstripe = new THREE.Mesh(BOX, MAT.planeStripe);
    vstripe.scale.set(3.02, 0.5, 0.32);
    vstripe.position.set(-8, 8, 0);
    plane.add(vstripe);

    // Horizontal stabilizers
    for (const side of [-1, 1]) {
      const hs = new THREE.Mesh(BOX, MAT.planeBody);
      hs.scale.set(2.5, 0.3, 4);
      hs.position.set(-9, 4.2, side * 2.5);
      plane.add(hs);
    }

    // Wings + engines
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(BOX, MAT.planeBody);
      wing.scale.set(4.5, 0.4, 13);
      wing.position.set(1, 3.9, side * 8);
      plane.add(wing);

      const eng = new THREE.Mesh(CYL, MAT.engine);
      eng.scale.set(1, 2.6, 1);
      eng.rotation.x = Math.PI / 2;
      eng.position.set(1.5, 3, side * 5.5);
      plane.add(eng);

      const intake = new THREE.Mesh(CYL, MAT.metalDark);
      intake.scale.set(1.08, 0.2, 1.08);
      intake.rotation.x = Math.PI / 2;
      intake.position.set(1.5, 3, side * 5.5 + 1.3);
      plane.add(intake);
    }

    // Landing gear
    for (const [gx, gz] of [[9, 0], [-2, 2.5], [-2, -2.5]]) {
      const gear = new THREE.Mesh(CYL, MAT.metalDark);
      gear.scale.set(0.15, 2, 0.15);
      gear.position.set(gx, 1, gz);
      plane.add(gear);
    }

    // Red side stripes
    for (const side of [-1, 1]) {
      const stripe = new THREE.Mesh(BOX, MAT.planeStripe);
      stripe.scale.set(18, 0.3, 0.05);
      stripe.position.set(0.5, 4.6, side * 1.99);
      plane.add(stripe);
    }

    // Windows strip via tiny canvas
    const winCanvas = document.createElement("canvas");
    winCanvas.width = 256; winCanvas.height = 16;
    const wctx = winCanvas.getContext("2d");
    wctx.clearRect(0, 0, 256, 16);
    wctx.fillStyle = "#1a3a5a";
    for (let i = 0; i < 22; i++) wctx.fillRect(10 + i * 11, 4, 5, 8);
    const winTex = new THREE.CanvasTexture(winCanvas);
    const winMat = new THREE.MeshBasicMaterial({ map: winTex, transparent: true });
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(PLANE, winMat);
      w.scale.set(18, 0.7, 1);
      w.position.set(0.5, 5.0, side * 1.98);
      w.rotation.y = side > 0 ? 0 : Math.PI;
      plane.add(w);
    }

    return plane;
  }

  const parkedPlane = buildAirplane();
  parkedPlane.position.set(0, 0, 45);
  g.add(parkedPlane);

  const taxiPlane = buildAirplane();
  taxiPlane.scale.setScalar(0.9);
  taxiPlane.position.set(60, 0, 100);
  taxiPlane.rotation.y = Math.PI;
  g.add(taxiPlane);

  // ========== SMART CARS ==========
  /* Real vehicle models from /vehicles (nose = local +Z). */
  function buildCar(colorMat) {
    const model = TRAFFIC_MODELS[Math.floor(Math.random() * TRAFFIC_MODELS.length)];
    const hex = "#" + ((colorMat && colorMat.color) ? colorMat.color.getHexString() : "c0392b");
    return buildTrafficCar(model, hex, "#8d9298");
  }

  const ROAD_Z = 20;
  const ROAD_HALF = 140;
  const cars = [];
  const carColors = [MAT.carRed, MAT.carBlue, MAT.carYellow, MAT.carGreen, MAT.carWhite, MAT.carPurple];

  for (let i = 0; i < 8; i++) {
    const lane = i % 2;
    const dir = lane === 0 ? 1 : -1;
    const car = buildCar(carColors[i % carColors.length]);
    const startX = -ROAD_HALF + (i / 8) * ROAD_HALF * 2 + Math.random() * 20;
    const z = ROAD_Z + (lane === 0 ? 2 : -2);
    car.userData = { lane, dir, x: startX, z, speed: 0, maxSpeed: 10 + Math.random() * 6 };
    car.position.set(startX, 0, z);
    car.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;   /* nose along travel (+X / -X) */
    g.add(car);
    cars.push(car);
  }

  // ========== INSTANCED TREES ==========
  const TREE_COUNT = 30;
  const trunkInst = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.25, 0.3, 2, 6),
    MAT.treeTrunk,
    TREE_COUNT
  );
  const leafInst = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.2, 3, 6),
    MAT.treeLeaf,
    TREE_COUNT
  );

  const dummy = new THREE.Object3D();
  for (let i = 0; i < TREE_COUNT; i++) {
    let x, z, attempts = 0;
    do {
      x = (Math.random() - 0.5) * 400;
      z = (Math.random() - 0.5) * 400;
      attempts++;
    } while (attempts < 20 && (
      (Math.abs(x) < 80 && Math.abs(z - 30) < 50) ||
      (Math.abs(x) < 160 && Math.abs(z - 20) < 10) ||
      (Math.abs(x) < 160 && Math.abs(z - 100) < 25) ||
      (Math.abs(x) < 20 && Math.abs(z) < 20)
    ));

    const scale = 0.8 + Math.random() * 0.6;
    dummy.position.set(x, scale, z);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);

    dummy.position.y = 3.5 * scale;
    dummy.updateMatrix();
    leafInst.setMatrixAt(i, dummy.matrix);
  }
  g.add(trunkInst);
  g.add(leafInst);

  // ========== LABEL ==========
  const lbl = textLabel(meta.name, meta.sub);
  lbl.position.y = 8.5;
  g.add(lbl);

  // ========== ANIMATION ==========
  const playerPos = new THREE.Vector3();
  let hasPlayer = false;
  let accum = 0;

  g.userData.setPlayer = (v) => {
    playerPos.copy(v);
    hasPlayer = true;
  };

  g.userData.update = (dt) => {
    if (typeof dt !== "number") dt = 0.016;
    if (dt > 0.1) dt = 0.1;

    // --- Cars ---
    for (const car of cars) {
      const d = car.userData;
      let target = d.maxSpeed;

      // Player ahead?
      if (hasPlayer) {
        const aheadX = (playerPos.x - d.x) * d.dir;
        const lateral = Math.abs(playerPos.z - d.z);
        if (aheadX > 0 && aheadX < 12 && lateral < 4) {
          target = Math.min(target, d.maxSpeed * Math.max(0, aheadX / 12 - 0.15));
        }
      }

      // Car ahead in same lane?
      for (const other of cars) {
        if (other === car) continue;
        const od = other.userData;
        if (od.lane !== d.lane) continue;
        const ahead = (od.x - d.x) * d.dir;
        if (ahead > 0 && ahead < 10) {
          target = Math.min(target, d.maxSpeed * Math.max(0, ahead / 10 - 0.3));
        }
      }

      target = Math.max(0, target);
      d.speed += (target - d.speed) * Math.min(dt * 4, 1);
      d.x += d.speed * d.dir * dt;

      if (d.x > ROAD_HALF) d.x = -ROAD_HALF;
      if (d.x < -ROAD_HALF) d.x = ROAD_HALF;
      car.position.x = d.x;
    }

    // --- Radar blink ---
    accum += dt;
    if (accum > 0.15) {
      accum = 0;
      radar.material.color.setHex(
        radar.material.color.getHex() === 0xff0000 ? 0x660000 : 0xff0000
      );
    }
  };

  return g;
}
