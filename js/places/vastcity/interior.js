/* vastcity/interior.js -- converted from the standalone prototype "city.html".
   World-building code is the prototype's own; the touch controls, loop and
   renderer were replaced by the game's ThirdPersonControls (player avatar,
   wardrobe, phone, weapons...). Collision boxes are converted below. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import { addStreetLamp } from "../../core/scene-lamps.js";
import { addNightGlow } from "../../core/night-glow.js";
import { ZoneDrive } from "../../core/drive-zones.js";
import { buildTrafficCar, TRAFFIC_MODELS } from "../../vehicles/traffic.js";
import { addCarLights } from "../../core/car-lights.js";
import { addPoleLine } from "../../core/power-lines.js";

/* ---------------------------------------------------------------------------
   Safe optional-module wrappers.
   A missing/broken optional module no longer crashes the scene.
   --------------------------------------------------------------------------- */
let _addPoleLine = null, _addCarLights = null, _ZoneDrive = null;
try { _addPoleLine = addPoleLine; } catch (e) { console.warn("[vastcity] power-lines missing", e); }
try { _addCarLights = addCarLights; } catch (e) { console.warn("[vastcity] car-lights missing", e); }
try { _ZoneDrive = ZoneDrive; } catch (e) { console.warn("[vastcity] drive-zones missing", e); }

export async function buildInterior(router) {
  /* ======== prototype kit + world ======== */
  /* ================= KIT ================= */
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x9ec4e0);
  scene.fog=new THREE.Fog(0x9ec4e0,70,210);
  const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,400);
  camera.rotation.order='YXZ';

  scene.add(new THREE.HemisphereLight(0xd8eaff,0x3a4a30,1.05));
  const sun=new THREE.DirectionalLight(0xfff4d6,1.2);
  sun.position.set(50,80,40); scene.add(sun);
  const fill=new THREE.DirectionalLight(0xa8c8e8,.4);
  fill.position.set(-40,30,-40); scene.add(fill);

  const BOXG=new THREE.BoxGeometry(1,1,1),
        CYLG=new THREE.CylinderGeometry(.5,.5,1,10),
        SPHG=new THREE.SphereGeometry(.5,10,8),
        CONEG=new THREE.ConeGeometry(.5,1,8);
  const MC=new Map();
  function mat(c,o){
    if(o&&o.map) return new THREE.MeshLambertMaterial(Object.assign({color:c},o));
    const k=c+'|'+JSON.stringify(o||0); let m=MC.get(k);
    if(!m){m=new THREE.MeshLambertMaterial(Object.assign({color:c},o||{}));MC.set(k,m);}
    return m;
  }
  const glow=c=>new THREE.MeshBasicMaterial({color:c});
  const waterM=mat(0x3a7ab0,{transparent:true,opacity:.85});
  const world=new THREE.Group(); scene.add(world);
  const solid=[];
  const seats=[];
  const uses=[];

  function box(w,h,d,x,y,z,m,o){
    o=o||{};
    const s=new THREE.Mesh(BOXG,typeof m==='number'?mat(m):m);
    s.scale.set(w,h,d); s.position.set(x,y,z); s.rotation.set(o.rx||0,o.ry||0,o.rz||0);
    world.add(s);
    if(o.solid){
      const c=Math.abs(Math.cos(o.ry||0)),n=Math.abs(Math.sin(o.ry||0));
      solid.push({x,z,hw:(c*w+n*d)/2,hd:(n*w+c*d)/2});
    }
    return s;
  }
  function cyl(r,h,x,y,z,m,o){
    o=o||{};
    const s=new THREE.Mesh(CYLG,typeof m==='number'?mat(m):m);
    s.scale.set(r*2,h,r*2); s.position.set(x,y,z); s.rotation.set(o.rx||0,o.ry||0,o.rz||0);
    world.add(s);
    if(o.solid) solid.push({x,z,hw:r,hd:r});
    return s;
  }
  function sph(r,x,y,z,m){
    const s=new THREE.Mesh(SPHG,typeof m==='number'?mat(m):m);
    s.scale.setScalar(r*2); s.position.set(x,y,z); world.add(s); return s;
  }
  function cone(r,h,x,y,z,m,o){
    o=o||{};
    const s=new THREE.Mesh(CONEG,typeof m==='number'?mat(m):m);
    s.scale.set(r*2,h,r*2); s.position.set(x,y,z); s.rotation.set(o.rx||0,o.ry||0,o.rz||0);
    world.add(s); return s;
  }
  function tex(w,h,draw,rx,ry){
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    draw(c.getContext('2d'),w,h);
    const t=new THREE.CanvasTexture(c);
    t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx||1,ry||1);
    t.colorSpace=THREE.SRGBColorSpace;
    return t;
  }

  /* ================= CITY LAYOUT ================= */
  const HALF=100;
  const ROAD_W=8;
  const ROADS=[-90,-60,-30,0,30,60,90];
  const ROOM={x:HALF-5, z:HALF-5};
  const START={x:0, z:48, yaw:0};

  /* --- textures --- */
  const grassTex=tex(128,128,g=>{
    g.fillStyle='#5a8a3a'; g.fillRect(0,0,128,128);
    g.fillStyle='#4e7e30';
    for(let i=0;i<420;i++){g.fillRect(Math.random()*128,Math.random()*128,3,3);}
    g.fillStyle='#6a9a44';
    for(let i=0;i<260;i++){g.fillRect(Math.random()*128,Math.random()*128,2,2);}
    g.strokeStyle='#3e6a24'; g.lineWidth=1;
    for(let i=0;i<40;i++){
      g.beginPath(); g.moveTo(Math.random()*128,Math.random()*128);
      g.lineTo(Math.random()*128,Math.random()*128); g.stroke();
    }
  },25,25);

  /* building window textures (shared, tiled) */
  function makeWindowTex(tint){
    return tex(128,128,g=>{
      g.fillStyle='#2a3a4a'; g.fillRect(0,0,128,128);
      for(let y=0;y<8;y++) for(let x=0;x<8;x++){
        const lit=Math.random()>.45;
        g.fillStyle=lit?tint:'#1a2a3a';
        g.fillRect(x*16+4,y*16+4,8,9);
      }
    });
  }
  const bMatA=new THREE.MeshLambertMaterial({color:0xd8d4c8,map:makeWindowTex('#ffe8a0')});
  const bMatB=new THREE.MeshLambertMaterial({color:0xc8b8a8,map:makeWindowTex('#bfe0ff')});
  const bMatC=new THREE.MeshLambertMaterial({color:0xb8c0c8,map:makeWindowTex('#ffd8a0')});
  const bMats=[bMatA,bMatB,bMatC];

  const grassM=mat(0xffffff,{map:grassTex});
  const roadM=mat(0x3a3a40), lineM=mat(0xe8c840),
        barkM=mat(0x5a4030), leafM=mat(0x3a6a28), leafM2=mat(0x2e5a20),
        stoneM=mat(0x9a9488), darkM=mat(0x2a2c30), steel=mat(0x8a8e94),
        woodM=mat(0x8a5f3a);

  /* ===== GROUND =====
     Huge circle so lake, hills and mountains all sit on solid ground. */
  {
    const groundGeo = new THREE.CircleGeometry(260, 64);
    groundGeo.rotateX(-Math.PI/2);
    const gMesh = new THREE.Mesh(groundGeo, grassM);
    gMesh.position.y = -0.1;
    world.add(gMesh);
  }

  /* ===== ROADS ===== */
  for(const rz of ROADS){
    box(180,.04,ROAD_W,0,.02,rz,roadM);
    box(180,.03,.16,0,.035,rz,lineM);
  }
  for(const rx of ROADS){
    box(ROAD_W,.04,180,rx,.02,0,roadM);
    box(.16,.03,180,rx,.035,0,lineM);
  }

  /* ===== UTILITY POLES + POWER LINES (alongside every road) ===== */
  const POLE_OFF = ROAD_W / 2 + 2.0;
  if (_addPoleLine) {
    for (const rz of ROADS) {
      try { _addPoleLine(scene, -90, rz + POLE_OFF, 90, rz + POLE_OFF, 0, 36); } catch(e) {}
    }
    for (const rx of ROADS) {
      try { _addPoleLine(scene, rx + POLE_OFF, -90, rx + POLE_OFF, 90, 0, 36); } catch(e) {}
    }
  }

  /* ===== BUILDINGS ===== */
  let bIdx=0;
  function building(cx,cz,maxSize){
    const bw=6+Math.random()*Math.min(6,maxSize-6);
    const bd=6+Math.random()*Math.min(6,maxSize-6);
    let bh=8+Math.random()*20;
    if(Math.random()<0.12) bh*=1.6;
    const bx=cx, bz=cz;
    const m=bMats[bIdx++%3];
    box(bw,bh,bd,bx,bh/2,bz,m,{solid:true});
    /* roof cap */
    box(bw+.3,.5,bd+.3,bx,bh+.25,bz,darkM);
    /* antenna on skyscrapers */
    if(bh>20){
      cyl(.1,3.5,bx,bh+2.2,bz,steel);
      sph(.24,bx,bh+4.0,bz,glow(0xff3030));
    }
    /* AC unit on mid-rise roofs */
    if(bh<18 && Math.random()<.5){
      box(1.2,.6,1.0,bx+1,bh+.8,bz-.8,steel);
    }
  }
  for(let i=0;i<ROADS.length-1;i++){
    for(let j=0;j<ROADS.length-1;j++){
      const cx=(ROADS[i]+ROADS[i+1])/2;
      const cz=(ROADS[j]+ROADS[j+1])/2;
      if(Math.random()<0.18) continue; /* empty block = park */
      /* Reserve the fountain plaza block. */
      if (Math.hypot(cx - 15, cz - 15) < 14) continue;
      const n=Math.random()<0.5?1:2;
      if(n===1){
        building(cx+(Math.random()-.5)*4, cz+(Math.random()-.5)*4, 14);
      } else {
        building(cx-6+(Math.random()-.5)*2, cz-6+(Math.random()-.5)*2, 10);
        building(cx+6+(Math.random()-.5)*2, cz+6+(Math.random()-.5)*2, 10);
      }
    }
  }

  /* ===== DISTANT SKYSCRAPERS (beyond playable bounds) ===== */
  for(let i=0;i<14;i++){
    const a=i/14*Math.PI*2+0.2;
    const r=112+Math.random()*8;
    const x=Math.cos(a)*r, z=Math.sin(a)*r;
    const bh=25+Math.random()*30;
    box(8+Math.random()*4,bh,8+Math.random()*4,x,bh/2,z,bMats[i%3]);
  }

  /* ===== HILLS (terrain) — inside the 260-radius ground disc ===== */
  const hills=[[-130,-130,30,18],[130,-130,34,20],[-130,130,30,16],[130,130,26,15]];
  for(const [hx,hz,hr,hh] of hills){
    const h=new THREE.Mesh(SPHG,grassM);
    h.scale.set(hr,hh,hr);
    h.position.set(hx,-hh*.55,hz);
    world.add(h);
    const r=new THREE.Mesh(SPHG,mat(0x8a8a82));
    r.scale.set(hr*.35,hh*.25,hr*.35);
    r.position.set(hx+hr*.1,hh*.3,hz);
    world.add(r);
  }

  /* ===== LAKE (north-west) — pulled inward to sit on ground ===== */
  cyl(24,.06,-105,.08,-105,waterM);
  for(let i=0;i<14;i++){
    const a=i/14*Math.PI*2;
    const sx=-105+Math.cos(a)*(25+Math.random()*2);
    const sz=-105+Math.sin(a)*(25+Math.random()*2);
    sph(1.2+Math.random()*.6,sx,.4,sz,stoneM);
  }

  /* ===== TREES ===== */
  function tree(x,z,s){
    s=s||1;
    const th=2.6*s;
    cyl(.22*s,th,x,th/2,z,barkM,{solid:true});
    cone(1.8*s,2.0*s,x,th+0.8*s,z,leafM);
    cone(1.4*s,1.8*s,x,th+1.9*s,z,leafM2);
    cone(1.0*s,1.6*s,x,th+2.8*s,z,leafM);
  }
  function onRoad(x,z){
    for(const r of ROADS){
      if(Math.abs(z-r)<ROAD_W/2+2 || Math.abs(x-r)<ROAD_W/2+2) return true;
    }
    return false;
  }
  function inBuilding(x,z){
    for(const b of solid){
      if(b.hw>2 && Math.abs(x-b.x)<b.hw+2 && Math.abs(z-b.z)<b.hd+2) return true;
    }
    return false;
  }
  const treesPlaced=[];
  function nearTree(x,z,minD){
    for(const t of treesPlaced){
      if(Math.hypot(x-t.x, z-t.z) < minD) return true;
    }
    return false;
  }
  let treeCount=0;
  for(let attempt=0; attempt<200 && treeCount<28; attempt++){
    const x=(Math.random()*2-1)*(HALF-6);
    const z=(Math.random()*2-1)*(HALF-6);
    if(onRoad(x,z) || inBuilding(x,z)) continue;
    if(Math.hypot(x,z)<12) continue;
    if(nearTree(x,z, 4.0)) continue;
    tree(x,z,.8+Math.random()*.6);
    treesPlaced.push({x,z});
    treeCount++;
  }

  /* ===== STREET LAMPS =====
     Alternate the corner per intersection instead of always SW. */
  function lamp(x,z){
    cyl(.08,3.6,x,1.8,z,darkM,{solid:true});
    box(.35,.12,.35,x,3.65,z,darkM);
    cyl(.26,.5,x,3.9,z,glow(0xfff0c0));
    sph(.2,x,3.9,z,glow(0xfff4d0));
    (scene.userData.__lampSpots || (scene.userData.__lampSpots = [])).push({ x, y: 3.9, z });
  }
  const intersections = [[-60,-60],[60,-60],[-60,60],[60,60],[0,-60],[0,60],[-60,0],[60,0],[0,-30],[0,30],[-30,0],[30,0],[30,-60],[-30,60],[30,60],[-30,-60]];
  intersections.forEach((p, idx)=>{
    const corners = [[-1,-1],[1,-1],[-1,1],[1,1]];
    const [sx, sz] = corners[idx % 4];
    lamp(p[0] + sx * (ROAD_W/2 + 1), p[1] + sz * (ROAD_W/2 + 1));
  });

  /* ===== BENCHES (in park-like empty blocks) ===== */
  function bench(x,z,ry){
    ry=ry||0;
    const c=Math.cos(ry), s=Math.sin(ry);
    const put=(w,h,d,ox,oy,oz,m,sol)=>box(w,h,d,x+ox*c+oz*s,oy,z-ox*s+oz*c,m,{ry,solid:sol!==false});
    put(1.8,.1,.5,0,.48,0,woodM);
    put(1.8,.5,.08,0,.82,-.21,woodM);
    put(.1,.4,.5,-.9,.62,0,darkM);
    put(.1,.4,.5,  .9,.62,0,darkM);
    put(.1,.48,.1,-.8,.24,0,steel);
    put(.1,.48,.1,  .8,.24,0,steel);
    seats.push({ type:"sit", label:"SIT", x, z, yaw:ry, h:0.53, level:0, taken:false });
  }
  bench(-15,15,0);
  bench(-15,22,0);
  bench(15,-15,Math.PI);
  bench(15,-22,Math.PI);
  bench(-45,15,0);
  bench(45,-15,Math.PI);
  bench(15,45,Math.PI);
  bench(-15,-45,0);

  /* ===== CENTRAL PLAZA =====
     Moved off the (0,0) intersection into the empty block at (15,15).
     Shrunk so it fits inside the block (half-size 11). */
  const PLAZA_X = 15, PLAZA_Z = 15, PLAZA_R = 8;
  cyl(PLAZA_R,      .05, PLAZA_X, .02, PLAZA_Z, mat(0x9a8a70));
  cyl(PLAZA_R + .4, .04, PLAZA_X, .01, PLAZA_Z, darkM);
  cyl(3.0,          .06, PLAZA_X, .03, PLAZA_Z, stoneM);
  cyl(2.6,          .04, PLAZA_X, .05, PLAZA_Z, waterM);
  sph(0.9, PLAZA_X, 1.1, PLAZA_Z, glow(0x9ae0ff));
  cyl(.3, 1.2, PLAZA_X, 1.2, PLAZA_Z, stoneM);
  solid.push({ x: PLAZA_X, z: PLAZA_Z, hw: 3.0, hd: 3.0 });
  uses.push({
    kind:"use", label:"SPLASH IN FOUNTAIN",
    x: PLAZA_X, z: PLAZA_Z, y: 0, level: 0, r: 3.4,
  });

  /* ===== CARS ===== */
  const cars=[];
  const carColors=[0xd83a3a,0x3a6ac8,0xd8b830,0xe8e8e8,0x2a2a2a,0x3a9a5a,0xc84a8a,0x8a8a8a];
  const NPC_CAR_MODELS = TRAFFIC_MODELS;
  const _hex = (c) => "#" + c.toString(16).padStart(6, "0");

  function spawnCar(axis, line, dir, startPos){
    const model = NPC_CAR_MODELS[Math.floor(Math.random()*NPC_CAR_MODELS.length)];
    const color = _hex(carColors[Math.floor(Math.random()*carColors.length)]);
    let g;
    try { g = buildTrafficCar(model, color, "#8d9298"); }
    catch (e) { console.warn("[vastcity] car build failed:", model, e); return; }
    if (!g) { console.warn("[vastcity] car build returned undefined:", model); return; }
    let ry;
    if(axis==='x') ry = dir>0 ? Math.PI/2 : -Math.PI/2;
    else ry = dir>0 ? 0 : Math.PI;
    g.rotation.y = ry;
    if(axis==='x') g.position.set(startPos, .05, line);
    else           g.position.set(line, .05, startPos);
    world.add(g);
    let lights = null;
    if (_addCarLights) { try { lights = _addCarLights(g); } catch (e) {} }
    cars.push({g,axis,dir,speed:5+Math.random()*5,lights, wrap:90});
  }

  for(const rz of [-60,-30,0,30,60]){
    spawnCar('x', rz-2, +1, -85+Math.random()*30);
    spawnCar('x', rz+2, -1,  85-Math.random()*30);
  }
  for(const rx of [-60,-30,0,30,60]){
    spawnCar('z', rx-2, +1, -85+Math.random()*30);
    spawnCar('z', rx+2, -1,  85-Math.random()*30);
  }

  /* ===== PARKED CARS =====
     On the sidewalk shoulder, out of the traffic lanes. */
  function parkedCar(x,z,ry){
    const model = NPC_CAR_MODELS[Math.floor(Math.random()*NPC_CAR_MODELS.length)];
    const color = _hex(carColors[Math.floor(Math.random()*carColors.length)]);
    let g;
    try { g = buildTrafficCar(model, color, "#8d9298"); }
    catch (e) { console.warn("[vastcity] parked car build failed:", model, e); return; }
    if (!g) return;
    g.position.set(x,.05,z); g.rotation.y=ry;
    world.add(g);
  }
  parkedCar(-13, 2,  Math.PI/2);
  parkedCar(-13, 10, Math.PI/2);
  parkedCar( 13,-2, -Math.PI/2);
  parkedCar( 13,-10,-Math.PI/2);
  parkedCar(-13, 55, Math.PI/2);
  parkedCar(-13, 60, Math.PI/2);

  /* ===== DISTANT MOUNTAINS — inside the 260-radius ground disc ===== */
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2+.4;
    const r=180+Math.random()*15;
    const x=Math.cos(a)*r, z=Math.sin(a)*r;
    cone(28+Math.random()*12, 42+Math.random()*18, x, 0, z, mat(0x7a8a9a));
  }

  /* ======== game glue ======== */
  camera.fov = 95; camera.updateProjectionMatrix();
  const __cols = [];
  for (const b of solid) {
    const mk = (level) => ({ minX: b.x - b.hw, maxX: b.x + b.hw, minZ: b.z - b.hd, maxZ: b.z + b.hd, y0: 0, y1: 60, level });
    __cols.push(mk(0));
  }
  const __world = {
    colliders: __cols, seats, uses,
    stairs: [],
    platforms: [],
    levelHeight: () => 0,

    bounds: { minX: -ROOM.x, maxX: ROOM.x, minZ: -ROOM.z, maxZ: ROOM.z },
  };

  // Location-specific perimeter and access-road lamps; StreetLights switches them on at dusk.
  const vastcityLampSpots = [];
  for (const [lx,lz] of [[-82,-70],[-42,-70],[0,-70],[42,-70],[82,-70],[-82,-25],[-42,-25],[0,-25],[42,-25],[82,-25],[-82,25],[-42,25],[0,25],[42,25],[82,25],[-82,70],[-42,70],[0,70],[42,70],[82,70]]) {
    try { vastcityLampSpots.push(addStreetLamp(scene, lx, 0, lz, Math.PI)); } catch(e) {}
  }
  try { addNightGlow(scene, vastcityLampSpots, { poolRadius: 20 }); } catch(e) {}

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, __world, {
    scene, x: START.x, z: START.z, yaw: Math.PI + (START.yaw ?? 0), level: 0,
    onUse: (use) => { if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE"); },
  });

  let drv = null;
  if (_ZoneDrive) {
    try {
      drv = _ZoneDrive.attach({
        scene, camera, renderer: router.renderer, world: __world,
        spawn: { x: START.x, z: START.z, y: 0 },
      });
    } catch (e) { console.warn("[vastcity] ZoneDrive.attach failed", e); drv = null; }
  }

  /* ===== CAR ↔ PLAYER COLLISION =====
     (a) Dynamic colliders: player can't walk into a car.
     (b) Soft push: a moving car shoves the standing player out. */
  const carColliders = [];
  function carAABB(car) {
    const g = car.g;
    const halfW = 1.0, halfL = 2.25;
    const ry = g.rotation.y;
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
    const hw = c * halfW + s * halfL;
    const hd = s * halfW + c * halfL;
    return { x: g.position.x, z: g.position.z, hw, hd };
  }
  function syncCarColliders() {
    while (carColliders.length < cars.length) {
      const c = { minX:0, maxX:0, minZ:0, maxZ:0, y0:0, y1:1.6, level:0 };
      carColliders.push(c);
      __world.colliders.push(c);
    }
    while (carColliders.length > cars.length) {
      const c = carColliders.pop();
      const idx = __world.colliders.indexOf(c);
      if (idx >= 0) __world.colliders.splice(idx, 1);
    }
    for (let i = 0; i < cars.length; i++) {
      const a = carAABB(cars[i]);
      const cc = carColliders[i];
      cc.minX = a.x - a.hw; cc.maxX = a.x + a.hw;
      cc.minZ = a.z - a.hd; cc.maxZ = a.z + a.hd;
    }
  }
  const PUSH_MARGIN = 0.05;
  function pushPlayerFromCars(ctl) {
    if (!ctl || !ctl.pos) return;
    const px = ctl.pos.x, pz = ctl.pos.z;
    for (let i = 0; i < cars.length; i++) {
      const a = carAABB(cars[i]);
      if (px < a.x - a.hw - PUSH_MARGIN || px > a.x + a.hw + PUSH_MARGIN) continue;
      if (pz < a.z - a.hd - PUSH_MARGIN || pz > a.z + a.hd + PUSH_MARGIN) continue;
      const dxL = px - (a.x - a.hw);
      const dxR = (a.x + a.hw) - px;
      const dzB = pz - (a.z - a.hd);
      const dzF = (a.z + a.hd) - pz;
      const m = Math.min(dxL, dxR, dzB, dzF);
      if (m === dxL)       ctl.pos.x = a.x - a.hw - PUSH_MARGIN;
      else if (m === dxR)  ctl.pos.x = a.x + a.hw + PUSH_MARGIN;
      else if (m === dzB)  ctl.pos.z = a.z - a.hd - PUSH_MARGIN;
      else                 ctl.pos.z = a.z + a.hd + PUSH_MARGIN;
      if (ctl.vel) {
        if (m === dxL || m === dxR) ctl.vel.x = 0;
        else                         ctl.vel.z = 0;
      }
    }
  }

  /* Fix: dispose everything we created. */
  const createdTextures = [grassTex, bMatA.map, bMatB.map, bMatC.map].filter(Boolean);
  const createdMaterials = new Set();
  world.traverse(o => {
    if (o.isMesh) {
      if (o.material && !Array.isArray(o.material)) createdMaterials.add(o.material);
      else if (Array.isArray(o.material)) o.material.forEach(m => m && createdMaterials.add(m));
    }
  });

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "VAST CITY",
    title: "WALKABLE METROPOLIS",
    subtitle: "",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: INTERACT",
    isInterior: true,
    sceneId: "vastcity",
    update: (dt) => {
      if (!drv || !drv.isDriving()) ctl.update(dt);
      if (drv) drv.update(dt);
      const _night = (window.__ph3d_daynight && window.__ph3d_daynight.nightAmount) ? window.__ph3d_daynight.nightAmount() : 0;
      for (let i = 0; i < cars.length; i++) {
        const c = cars[i];
        try { c.lights && c.lights.setNight(_night); } catch (e) {}
        if (c.axis === 'x') {
          c.g.position.x += c.dir * c.speed * dt;
          if (c.g.position.x >  c.wrap) c.g.position.x = -c.wrap;
          else if (c.g.position.x < -c.wrap) c.g.position.x =  c.wrap;
        } else {
          c.g.position.z += c.dir * c.speed * dt;
          if (c.g.position.z >  c.wrap) c.g.position.z = -c.wrap;
          else if (c.g.position.z < -c.wrap) c.g.position.z =  c.wrap;
        }
        const ws = c.g.userData && c.g.userData.wheels;
        if (ws) {
          for (const w of ws) {
            if (!w.spin) continue;
            if (w.spinZ) w.spin.rotation.z -= c.speed * dt / 0.4;
            else         w.spin.rotation.x += c.speed * dt / 0.4;
          }
        }
      }
      /* Keep dynamic car colliders in sync, then shove the player out. */
      syncCarColliders();
      if (!drv || !drv.isDriving()) pushPlayerFromCars(ctl);
    },
    dispose: () => {
      if (drv) drv.dispose();
      ctl.dispose();
      try {
        world.traverse(o => {
          if (o.isMesh) {
            if (o.geometry && o.geometry !== BOXG && o.geometry !== CYLG && o.geometry !== SPHG && o.geometry !== CONEG) {
              o.geometry.dispose();
            }
          }
        });
      } catch(e) {}
      createdMaterials.forEach(m => { try { m.dispose(); } catch(e) {} });
      createdTextures.forEach(t => { try { t.dispose(); } catch(e) {} });
      MC.clear();
    },
  };
}
