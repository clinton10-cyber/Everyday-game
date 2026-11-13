import * as THREE from "three";
import { Quality } from "../../core/quality.js";
import { ThirdPersonControls } from "../../core/thirdperson.js";

export async function buildPleasurePark(router) {
  const isMobile = Quality.current.tier === "low";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9dc4e8);
  scene.fog = new THREE.Fog(0x9dc4e8, 150, 520);

  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 560);
  camera.rotation.order = "YXZ";

  scene.add(new THREE.HemisphereLight(0xdcecff, 0x6a6a78, 1.2));
  const sun = new THREE.DirectionalLight(0xfff5d1, 2.0);
  sun.position.set(60, 100, 40);
  if (!isMobile) {
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    sun.shadow.camera.far = 300;
  }
  scene.add(sun);

  /* ============================================================
     NATIVE WORLD DATA
     ============================================================ */
  const world = {
    colliders: [], // ONLY tall walls for camera occlusion
    seats: [],     
    uses: [],      
    platforms: [],
    levelHeight: () => 0,
    bounds: { minX: -155, maxX: 155, minZ: -155, maxZ: 155 }
  };

  const G = {
    box: new THREE.BoxGeometry(1,1,1), sphere: new THREE.IcosahedronGeometry(1,0),
    cyl: new THREE.CylinderGeometry(1,1,1,8), cone: new THREE.ConeGeometry(1,1,6), plane: new THREE.PlaneGeometry(1,1)
  };

  const L = (c, e) => new THREE.MeshLambertMaterial({ color:c, emissive:e || 0x000000 });

  const MAT = {
    grass:      L(0x6aaa5a), plaza:      L(0x8a8a94), marble:     L(0xfcdcd0),
    marbleDark: L(0xc9c1b6), rose:       L(0xd09a8a), gold:       L(0xe8b848, 0x4a2a00),
    brass:      L(0xd8b040, 0x3a2000), wood:       L(0x8a6c42), oak:        L(0xc8a57a),
    darkWood:   L(0x5e3c20), cream:      L(0xf0e4c8), red:        L(0x9a2c32),
    redDark:    L(0x6a1e22), green:      L(0x3e5a46), felt:       L(0x2a7a44),
    ice:        L(0xcad0e8, 0x2d3744), mirror:     L(0xe8f8ff, 0x406070),
    metal:      L(0x5a5a62), black:      L(0x2a2a2e), white:      L(0xfaf6ec),
    stone:      L(0x9e9eaa), leaf:       L(0x4c8a4c), leafLight:  L(0x6eaa6a),
    water:      L(0x4a9aba, 0x183a46),
    dome:       new THREE.MeshLambertMaterial({ color:0x4a5aae, emissive:0x1e2050, side:THREE.DoubleSide }),
    glass:      new THREE.MeshLambertMaterial({ color:0xcae8fe, transparent:true, opacity:0.26, side:THREE.DoubleSide, depthWrite:false }),
    glassCase:  new THREE.MeshLambertMaterial({ color:0xdfeefc, transparent:true, opacity:0.34, side:THREE.DoubleSide, depthWrite:false }),
    flame:      new THREE.MeshBasicMaterial({ color:0xffeebb }),
    flameWarm:  new THREE.MeshBasicMaterial({ color:0xffbb66, transparent:true, opacity:0.75 }),
  };
  MAT.oak = L(0xc8a57a);
  MAT.oakPolished = L(0xd8b88a, 0x2a2010);

  const colliderGroups = [];
  const PLAYER_R = 0.32;

  function mkGroup(px, pz){
    const g = new THREE.Group();
    g.position.set(px, 0, pz);
    g.rotation.y = Math.atan2(-px, -pz);
    g.userData.boxes = [];
    g.userData.rings = [];
    scene.add(g);
    colliderGroups.push(g);
    return g;
  }

  function addUse(g, lx, lz, r, label, msg) {
    const v = new THREE.Vector3(lx, 0, lz);
    g.localToWorld(v);
    world.uses.push({
      x: v.x, z: v.z, y: 0, level: 0, r: r || 2.0, label: label,
      onUse: () => { if (window.__ph3d_phone) window.__ph3d_phone._toast(msg); }
    });
  }

  function addSeat(g, lx, lz, yaw, h) {
    const v = new THREE.Vector3(lx, 0, lz);
    g.localToWorld(v);
    world.seats.push({
      x: v.x, z: v.z, yaw: yaw + g.rotation.y, h: h || 0.55, level: 0, type: "sit", label: "SIT", taken: false
    });
  }

  function addBox(parent, x, y, z, w, h, d, mat, ry){
    const m = new THREE.Mesh(G.box, mat);
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    if (ry) m.rotation.y = ry;
    m.castShadow = !isMobile; m.receiveShadow = !isMobile;
    parent.add(m);
    return m;
  }

  function wallSeg(g, x, z, w, d, h, mat, y0){
    y0 = y0 || 0;
    const m = new THREE.Mesh(G.box, mat);
    m.position.set(x, y0 + h/2, z);
    m.scale.set(w, h, d);
    m.castShadow = !isMobile; m.receiveShadow = !isMobile;
    g.add(m);
    
    // 1. Add to physics collisions (Player)
    g.userData.boxes.push({ x, z, hw: w/2, hd: d/2 });

    // 2. Only add TALL objects to Camera Colliders (Walls, not tiny railings)
    if (h > 2.0) {
      const v = new THREE.Vector3(x, 0, z);
      g.localToWorld(v);
      const a = g.rotation.y;
      const c = Math.cos(a), s = Math.sin(a);
      const ex = (w/2) * Math.abs(c) + (d/2) * Math.abs(s);
      const ez = (w/2) * Math.abs(s) + (d/2) * Math.abs(c);
      world.colliders.push({
        minX: v.x - ex, maxX: v.x + ex,
        minZ: v.z - ez, maxZ: v.z + ez,
        y0: y0, y1: y0 + h, level: 0
      });
    }
    return m;
  }

  function addCollider(g, x, z, hw, hd){
    g.userData.boxes.push({ x, z, hw, hd });
  }

  function makeRoom(g, W, D, H, wallMat, doorW, floorMat, ceilMat, doorH){
    doorH = doorH || 4.4;
    const t = 0.35;
    const f = new THREE.Mesh(G.box, floorMat || MAT.stone);
    f.position.set(0, 0.06, 0); f.scale.set(W, 0.12, D); f.receiveShadow = !isMobile; g.add(f);

    wallSeg(g, 0, -D/2, W, t, H, wallMat);
    wallSeg(g, -W/2, 0, t, D, H, wallMat);
    wallSeg(g,  W/2, 0, t, D, H, wallMat);

    const seg = (W - doorW) / 2;
    if (seg > 0.15){
      wallSeg(g, -(doorW/2 + seg/2), D/2, seg, t, H, wallMat);
      wallSeg(g,  (doorW/2 + seg/2), D/2, seg, t, H, wallMat);
    }
    if (doorH < H){
      const hdr = new THREE.Mesh(G.box, wallMat);
      hdr.position.set(0, doorH + (H-doorH)/2, D/2);
      hdr.scale.set(doorW, H-doorH, t);
      g.add(hdr);
    }
    if (ceilMat){
      const c = new THREE.Mesh(G.box, ceilMat);
      c.position.set(0, H, 0); c.scale.set(W, 0.2, D); g.add(c);
    }
  }

  function lampPost(parent, x, z, h){
    h = h || 3.2;
    const pole = new THREE.Mesh(G.cyl, MAT.metal);
    pole.scale.set(0.09, h, 0.09); pole.position.set(x, h/2, z); parent.add(pole);
    const glow = new THREE.Mesh(G.sphere, MAT.flame);
    glow.scale.setScalar(0.24); glow.position.set(x, h + 0.18, z); parent.add(glow);
  }

  function lotusLamp(parent, x, y, z, s){
    s = s || 1;
    const b = new THREE.Mesh(G.sphere, MAT.flame);
    b.scale.setScalar(0.16 * s); b.position.set(x, y, z); parent.add(b);
  }

  function chandelier(parent, x, y, z, s){
    s = s || 1;
    const grp = new THREE.Group(); grp.position.set(x, y, z); parent.add(grp);
    for (let i = 0; i < 3; i++){
      const r = (1.0 - i * 0.27) * s;
      const ring = new THREE.Mesh(G.cyl, MAT.brass);
      ring.scale.set(r, 0.09 * s, r);
      ring.position.y = -i * 0.68 * s;
      grp.add(ring);
      const glow = new THREE.Mesh(G.sphere, MAT.flame);
      glow.scale.setScalar(r * 0.8);
      glow.position.y = -i * 0.68 * s + 0.14 * s;
      grp.add(glow);
    }
    const rod = new THREE.Mesh(G.cyl, MAT.brass);
    rod.scale.set(0.04 * s, 2 * s, 0.04 * s);
    rod.position.y = s;
    grp.add(rod);
    return grp;
  }

  /* ============================================================
     GROUND
     ============================================================ */
  const geo = new THREE.CircleGeometry(165, 48);
  geo.rotateX(-Math.PI/2);
  const mGround = new THREE.Mesh(geo, MAT.grass);
  mGround.receiveShadow = !isMobile;
  scene.add(mGround);

  /* ============================================================
     OPEN-AIR PLEASURE PARK GROUNDS
     The park is a large walkable outdoor destination. The original
     attraction buildings remain as indoor venues within this landscape.
     ============================================================ */
  const outdoor = {
    path: new THREE.MeshLambertMaterial({ color: 0xd7c7a6 }),
    pathEdge: new THREE.MeshLambertMaterial({ color: 0x9b8767 }),
    turf: new THREE.MeshLambertMaterial({ color: 0x4d914e }),
    turf2: new THREE.MeshLambertMaterial({ color: 0x68a85d }),
    water: new THREE.MeshPhongMaterial({ color: 0x42b9d5, transparent: true, opacity: 0.82, shininess: 90 }),
    white: new THREE.MeshLambertMaterial({ color: 0xfff5df }),
    red: new THREE.MeshLambertMaterial({ color: 0xe64b4b }),
    yellow: new THREE.MeshLambertMaterial({ color: 0xffd447 }),
    blue: new THREE.MeshLambertMaterial({ color: 0x328bd1 }),
    pink: new THREE.MeshLambertMaterial({ color: 0xf078b5 }),
    purple: new THREE.MeshLambertMaterial({ color: 0x8060c8 }),
    dark: new THREE.MeshLambertMaterial({ color: 0x344252 }),
    steel: new THREE.MeshLambertMaterial({ color: 0x8797a6 }),
    flower: new THREE.MeshLambertMaterial({ color: 0xff8fb5 }),
    flower2: new THREE.MeshLambertMaterial({ color: 0xffdf68 }),
  };
  const outdoorBox = (x,y,z,w,h,d,mat,ry=0) => {
    const m = new THREE.Mesh(G.box, mat); m.position.set(x,y,z); m.scale.set(w,h,d); m.rotation.y=ry;
    m.castShadow = !isMobile; m.receiveShadow = !isMobile; scene.add(m); return m;
  };
  const outdoorCyl = (x,y,z,rt,rb,h,mat,seg=12,ry=0) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat); m.position.set(x,y,z); m.rotation.y=ry;
    m.castShadow = !isMobile; scene.add(m); return m;
  };
  const outdoorSphere = (x,y,z,sx,sy,sz,mat) => {
    const m = new THREE.Mesh(G.sphere,mat); m.position.set(x,y,z); m.scale.set(sx,sy,sz); m.castShadow = !isMobile; scene.add(m); return m;
  };
  const flatPath = (x,z,w,d,ry=0) => {
    outdoorBox(x,0.035,z,w,0.07,d,outdoor.path,ry);
    const ox=Math.sin(ry)*d*0.43, oz=Math.cos(ry)*d*0.43;
    outdoorBox(x+ox,0.078,z-oz,w,0.035,0.16,outdoor.pathEdge,ry);
    outdoorBox(x-ox,0.078,z+oz,w,0.035,0.16,outdoor.pathEdge,ry);
  };
  // Main promenades and a broad perimeter walking loop.
  flatPath(0,-28,8,118); flatPath(0,88,8,58);
  flatPath(-43,0,82,6); flatPath(43,0,82,6);
  for (let i=0;i<64;i++) {
    const a=i/64*Math.PI*2, r=112;
    const x=Math.cos(a)*r, z=Math.sin(a)*r;
    flatPath(x,z,11.2,4.8,a+Math.PI/2);
  }
  // Four cross-paths make the grounds navigable instead of a single small plaza.
  flatPath(-82,-50,54,5,Math.PI/4); flatPath(82,-50,54,5,-Math.PI/4);
  flatPath(-82,52,54,5,-Math.PI/4); flatPath(82,52,54,5,Math.PI/4);

  // Ornamental pond, island and stepping-stone edge in the west garden.
  const pond = new THREE.Mesh(new THREE.CircleGeometry(18,40),outdoor.water);
  pond.rotation.x=-Math.PI/2; pond.position.set(-82,0.12,12); scene.add(pond);
  const pondRim = new THREE.Mesh(new THREE.RingGeometry(18,20,40),MAT.marbleDark);
  pondRim.rotation.x=-Math.PI/2; pondRim.position.set(-82,0.16,12); scene.add(pondRim);
  outdoorCyl(-82,0.28,12,4.6,5.2,0.3,MAT.stone,16);
  outdoorSphere(-82,1.0,12,2.0,0.8,2.0,outdoor.turf2);
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;outdoorBox(-82+Math.cos(a)*21,0.16,12+Math.sin(a)*21,2.2,0.22,1.1,MAT.marbleDark,a);}

  // Ferris wheel: open-air ride with support A-frame, coloured gondolas and queue plaza.
  {
    const x=68,z=-58,cy=20,r=16;
    const wheel=new THREE.Mesh(new THREE.TorusGeometry(r,0.42,8,64),outdoor.steel);wheel.position.set(x,cy,z);scene.add(wheel);
    const hub=outdoorCyl(x,cy,z,1.6,1.6,2.4,outdoor.yellow,16,Math.PI/2);
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2;outdoorBox(x,cy,z,0.22,0.22,0.22,outdoor.white);const spoke=outdoorBox(x+Math.cos(a)*r/2,cy+Math.sin(a)*r/2,z,0.28,r,0.32,outdoor.white,-a);spoke.rotation.z=a;}
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2;const gx=x+Math.cos(a)*r,gy=cy+Math.sin(a)*r;outdoorBox(gx,gy-1.1,z,2.0,1.8,1.8,[outdoor.red,outdoor.yellow,outdoor.blue,outdoor.pink][i%4]);outdoorBox(gx,gy-0.15,z,2.1,0.16,1.9,outdoor.white);}
    for(const sx of [-7,7]){const leg=outdoorBox(x+sx,9,z,1.0,18,1.2,outdoor.white);leg.rotation.z=sx>0?-0.28:0.28;}
    outdoorBox(x,1.2,z,22,1.2,9,outdoor.dark);
    addUse(mkGroup(x,z),0,0,8,"FERRIS WHEEL","You enjoyed a panoramic ride above Pleasure Park.");
    flatPath(x,z+15,26,5);
  }

  // Roller coaster with a colourful elevated track, supports and station.
  {
    const pts=[new THREE.Vector3(-88,8,-60),new THREE.Vector3(-76,18,-72),new THREE.Vector3(-55,23,-66),new THREE.Vector3(-42,8,-50),new THREE.Vector3(-56,5,-32),new THREE.Vector3(-78,12,-25),new THREE.Vector3(-92,5,-42)];
    const curve=new THREE.CatmullRomCurve3(pts);const track=new THREE.Mesh(new THREE.TubeGeometry(curve,100,0.58,8,false),outdoor.red);scene.add(track);
    for(let i=0;i<=24;i++){const p=curve.getPoint(i/24);outdoorCyl(p.x,p.y/2,p.z,0.22,0.22,p.y,outdoor.steel,8);}
    outdoorBox(-88,1.3,-60,16,2.6,12,outdoor.blue);
    outdoorBox(-88,2.8,-60,18,0.35,14,outdoor.yellow);
    const q=mkGroup(-88,-60);addCollider(q,0,0,8,6);addUse(q,0,8,8,"ROLLER COASTER","You boarded the colourful roller coaster.");
  }

  // Outdoor carousel with striped canopy and horses.
  {
    const x=66,z=57;outdoorCyl(x,0.7,z,10,10,1.2,outdoor.yellow,32);
    outdoorCyl(x,6.4,z,0.55,0.55,11,outdoor.steel,16);
    const canopy=new THREE.Mesh(new THREE.ConeGeometry(12,5,12),outdoor.pink);canopy.position.set(x,10,z);scene.add(canopy);
    outdoorCyl(x,7.7,z,11.7,11.7,0.5,outdoor.white,32);
    for(let i=0;i<10;i++){const a=i/10*Math.PI*2;const px=x+Math.cos(a)*7.3,pz=z+Math.sin(a)*7.3;outdoorCyl(px,4.4,pz,0.12,0.12,5.5,outdoor.yellow,8);outdoorSphere(px,2.1,pz,0.85,1.2,0.38,[outdoor.white,outdoor.blue,outdoor.red][i%3]);}
    const q=mkGroup(x,z);addCollider(q,0,0,10,10);addUse(q,0,13,7,"CAROUSEL","You took a ride on the carousel.");
  }

  // Splash park with two pools, slides and colourful shade sails.
  {
    const x=-68,z=58;
    for(const [dx,dz,w,d] of [[0,0,34,22],[22,10,17,13]]){
      const pool=new THREE.Mesh(new THREE.BoxGeometry(w,0.25,d),outdoor.water);pool.position.set(x+dx,0.13,z+dz);scene.add(pool);
      outdoorBox(x+dx,0.05,z+dz,w+1,0.2,d+1,outdoor.white);
    }
    for(let i=0;i<3;i++){const sx=x-12+i*12;outdoorCyl(sx,4,z-16,0.2,0.2,8,outdoor.blue,8);outdoorBox(sx+3,6,z-10,7,0.35,14,[outdoor.yellow,outdoor.pink,outdoor.blue][i],(i-1)*0.14);}
    const q=mkGroup(x,z);addUse(q,0,18,9,"SPLASH PARK","You entered the splash park and cooled off.");
  }

  // Outdoor performance amphitheatre and food village.
  {
    const x=0,z=-112;
    for(let i=0;i<5;i++){const radius=9+i*3;const arc=new THREE.Mesh(new THREE.TorusGeometry(radius,0.48,6,48,Math.PI),outdoor.pathEdge);arc.position.set(x,0.55+i*0.48,z);arc.rotation.y=Math.PI;scene.add(arc);}
    outdoorBox(x,1.2,z-10,26,2.4,2,outdoor.dark);
    outdoorBox(x,2.6,z-10,29,0.45,3,outdoor.purple);
    const q=mkGroup(x,z);addUse(q,0,-8,12,"OPEN-AIR STAGE","You watched a live performance at the park amphitheatre.");
    for(let i=0;i<5;i++){
      const sx=-40+i*20,sz=103;outdoorBox(sx,1.8,sz,12,3.6,9,[outdoor.red,outdoor.yellow,outdoor.blue,outdoor.pink,outdoor.purple][i]);
      outdoorBox(sx,3.8,sz,13,0.5,10,outdoor.white);
      outdoorBox(sx,1.7,sz+4.65,5,2.2,0.18,outdoor.dark);
      const stall=mkGroup(sx,sz);addUse(stall,0,6,5,"FOOD KIOSK","You visited a food kiosk at Pleasure Park.");
    }
  }

  // Landscaped lawns, palm clusters, flower beds, benches and park lighting.
  function parkTree(x,z,s=1){
    outdoorCyl(x,1.8*s,z,0.34*s,0.48*s,3.6*s,MAT.wood,7);
    outdoorSphere(x,4.2*s,z,2.4*s,2.1*s,2.4*s,[outdoor.turf,outdoor.turf2,MAT.leafLight][Math.floor(Math.abs(x+z))%3]);
    const c=mkGroup(x,z);addCollider(c,0,0,0.7*s,0.7*s);
  }
  for(let i=0;i<82;i++){
    const a=i*2.399963,r=48+(i%7)*11,x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(Math.hypot(x,z)>142 || (Math.abs(x)<28 && Math.abs(z)<45) || (x>45&&z>35&&x<95) || (x<-45&&z>35&&x>-100) || (x>42&&z<-30&&x<100) || (x<-40&&z<-20&&x>-110)) continue;
    parkTree(x,z,0.75+(i%4)*0.12);
  }
  for(let i=0;i<24;i++){
    const a=i/24*Math.PI*2,x=Math.cos(a)*96,z=Math.sin(a)*96;
    for(let k=0;k<5;k++){const fx=x+Math.cos(a+Math.PI/2)*(k-2)*1.2,fz=z+Math.sin(a+Math.PI/2)*(k-2)*1.2;outdoorSphere(fx,0.5,fz,0.35,0.35,0.35,k%2?outdoor.flower:outdoor.flower2);}
  }
  for(let i=0;i<22;i++){
    const a=i/22*Math.PI*2,x=Math.cos(a)*76,z=Math.sin(a)*76;
    outdoorBox(x,0.65,z,3.2,0.35,0.9,MAT.wood,a);
    outdoorBox(x,1.05,z-0.25,3.2,0.35,0.22,MAT.darkWood,a);
    const lamp=outdoorCyl(x+2.3,2.1,z,0.09,0.12,4.2,outdoor.steel,8);
    outdoorSphere(x+2.3,4.3,z,0.38,0.32,0.38,outdoor.yellow);
  }

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(17, 17, 0.24, 24), MAT.plaza);
  disc.position.y = 0.12; disc.receiveShadow = !isMobile; scene.add(disc);

  const inner = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.28, 20), MAT.marbleDark);
  inner.position.y = 0.14; inner.receiveShadow = !isMobile; scene.add(inner);

  const fGroup = mkGroup(0.001, 0.001);
  fGroup.rotation.y = 0;
  addBox(fGroup, 0, 0.45, 0, 6.4, 0.9, 6.4, MAT.stone);
  addBox(fGroup, 0, 0.95, 0, 5.6, 0.1, 5.6, MAT.water);
  const stem = new THREE.Mesh(G.cyl, MAT.stone);
  stem.scale.set(0.45, 2.2, 0.45); stem.position.set(0, 2.0, 0); stem.castShadow = !isMobile; fGroup.add(stem);
  const bowl = new THREE.Mesh(G.cyl, MAT.stone);
  bowl.scale.set(1.5, 0.3, 1.5); bowl.position.set(0, 3.1, 0); bowl.castShadow = !isMobile; fGroup.add(bowl);
  const water = new THREE.Mesh(G.cyl, MAT.water);
  water.scale.set(1.35, 0.08, 1.35); water.position.set(0, 3.28, 0); fGroup.add(water);
  addCollider(fGroup, 0, 0, 3.2, 3.2);
  
  // Add fountain to camera occlusion (it's tall)
  world.colliders.push({ minX: -3.2, maxX: 3.2, minZ: -3.2, maxZ: 3.2, y0: 0, y1: 3.2, level: 0 });

  for (let i = 0; i < 10; i++){
    const a = (i / 10) * Math.PI * 2 + 0.3;
    lampPost(scene, Math.sin(a) * 14.5, Math.cos(a) * 14.5, 3.4);
  }

  /* ============================================================
     BUILDINGS
     ============================================================ */
  function buildEntranceHall(){
    const g = mkGroup(0, 34);
    const R = 8, H = 11, gap = 0.42;
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.4, 20), MAT.marble);
    fl.position.y = 0.2; fl.receiveShadow = !isMobile; g.add(fl);
    const rose = new THREE.Mesh(new THREE.CircleGeometry(3.6, 12), MAT.rose);
    rose.rotation.x = -Math.PI/2; rose.position.y = 0.44; g.add(rose);
    const ringM = new THREE.Mesh(new THREE.RingGeometry(3.9, 4.2, 12), MAT.gold);
    ringM.rotation.x = -Math.PI/2; ringM.position.y = 0.45; g.add(ringM);

    const wallGeo = new THREE.CylinderGeometry(R, R, H, 20, 1, true, gap, Math.PI*2 - gap*2);
    const wm = new THREE.Mesh(wallGeo, new THREE.MeshLambertMaterial({ color:0xdcd4c8, side:THREE.DoubleSide }));
    wm.position.y = H/2; wm.castShadow = !isMobile; g.add(wm);
    g.userData.rings.push({ r:R, t:0.6, gap:gap });

    const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 16, 8, 0, Math.PI*2, 0, Math.PI/2), MAT.dome);
    dome.position.y = H; g.add(dome);

    for (let i = 0; i < 8; i++){
      const a = gap + 0.45 + i * ((Math.PI*2 - 2*gap - 0.9) / 7);
      const col = new THREE.Mesh(G.cyl, MAT.marble);
      col.scale.set(0.32, H, 0.32);
      col.position.set(Math.sin(a) * 7.0, H/2, Math.cos(a) * 7.0);
      col.castShadow = !isMobile; g.add(col);
      
      // Add pillars to camera occlusion
      world.colliders.push({
        minX: Math.sin(a) * 7.0 - 0.4, maxX: Math.sin(a) * 7.0 + 0.4,
        minZ: Math.cos(a) * 7.0 - 0.4, maxZ: Math.cos(a) * 7.0 + 0.4,
        y0: 0, y1: H, level: 0
      });

      const cap = new THREE.Mesh(G.box, MAT.gold);
      cap.scale.set(0.9, 0.22, 0.9);
      cap.position.set(Math.sin(a) * 7.0, H - 0.2, Math.cos(a) * 7.0);
      g.add(cap);
    }
    chandelier(g, 0, 8.2, 0, 1.5);

    addBox(g, -5.4, 1.1, 4.4, 2.6, 2.2, 1.8, MAT.wood);
    addBox(g, -5.4, 2.3, 4.4, 2.8, 0.25, 2.0, MAT.gold);
    addBox(g, -5.4, 1.3, 5.35, 1.8, 0.9, 0.08, MAT.brass);
    addCollider(g, -5.4, 4.4, 1.4, 1.0);
    addUse(g, -5.4, 3.4, 2.0, "TICKET BOOTH", "You bought a ticket to the park.");

    addBox(g, 5.4, 1.1, 4.4, 2.6, 2.2, 1.8, MAT.darkWood);
    addBox(g, 5.4, 2.3, 4.4, 2.8, 0.25, 2.0, MAT.gold);
    addCollider(g, 5.4, 4.4, 1.4, 1.0);
    addUse(g, 5.4, 3.4, 2.0, "CLOAKROOM", "You checked your coat.");

    [[-4.5, -3.5], [4.5, -3.5], [-6.0, 0.5], [6.0, 0.5]].forEach(p => {
      addBox(g, p[0], 0.55, p[1], 2.4, 0.7, 0.9, MAT.red);
      addBox(g, p[0], 1.0, p[1] - 0.35, 2.4, 0.5, 0.2, MAT.red);
      addSeat(g, p[0], p[1], 0, 0.55);
    });

    [[-3.6, -6.2], [3.6, -6.2], [-7.0, -1.5], [7.0, -1.5]].forEach(p => {
      const trunk = new THREE.Mesh(G.cyl, MAT.wood);
      trunk.scale.set(0.16, 1.6, 0.16); trunk.position.set(p[0], 0.8, p[1]); g.add(trunk);
      const urn = new THREE.Mesh(G.cyl, MAT.rose);
      urn.scale.set(0.55, 0.7, 0.55); urn.position.set(p[0], 0.35, p[1]); g.add(urn);
      for (let k = 0; k < 5; k++){
        const a = k / 5 * Math.PI * 2;
        const leaf = new THREE.Mesh(G.cone, MAT.leaf);
        leaf.scale.set(0.18, 1.5, 0.18);
        leaf.position.set(p[0] + Math.cos(a)*0.5, 2.0, p[1] + Math.sin(a)*0.5);
        leaf.rotation.z = Math.cos(a) * 0.7;
        leaf.rotation.x = -Math.sin(a) * 0.7;
        g.add(leaf);
      }
    });

    [-4.4, 4.4].forEach(x => {
      const base = new THREE.Mesh(G.cyl, MAT.stone);
      base.scale.set(0.6, 0.5, 0.6); base.position.set(x, 0.25, 6.6); g.add(base);
      const body = new THREE.Mesh(G.cyl, MAT.brass);
      body.scale.set(0.28, 1.5, 0.28); body.position.set(x, 1.25, 6.6); g.add(body);
      const head = new THREE.Mesh(G.sphere, MAT.brass);
      head.scale.setScalar(0.26); head.position.set(x, 2.2, 6.6); g.add(head);
      addCollider(g, x, 6.6, 0.6, 0.6);
      addUse(g, x, 5.6, 1.5, "ADMIRE STATUE", "A beautiful bronze statue.");
    });

    addBox(g, 0, 0.5, -6.4, 5.0, 1.0, 2.0, MAT.wood);
    for (let i = 0; i < 4; i++){
      const fig = new THREE.Mesh(G.cyl, MAT.black);
      fig.scale.set(0.18, 0.9, 0.18);
      fig.position.set(-1.8 + i * 1.2, 1.45, -6.4);
      g.add(fig);
    }
    addUse(g, 0, -6.4, 3.0, "LISTEN TO QUARTET", "A string quartet plays a soft waltz.");
  }

  function buildHallOfMirrors(){
    const g = mkGroup(-24, 24);
    const W = 22, D = 12, H = 7;
    makeRoom(g, W, D, H, MAT.cream, 5, MAT.marbleDark, null);

    const ceil = new THREE.Mesh(G.box, MAT.glass);
    ceil.position.set(0, H, 0); ceil.scale.set(W - 0.6, 0.15, D - 0.6); g.add(ceil);
    for (let i = -3; i <= 3; i++) addBox(g, i * 3.1, H - 0.05, 0, 0.18, 0.28, D - 0.6, MAT.metal);
    for (let i = -1; i <= 1; i++) addBox(g, 0, H - 0.05, i * 3.4, W - 0.6, 0.28, 0.18, MAT.metal);

    for (let i = 0; i < 7; i++){
      const x = -9.3 + i * 3.1;
      const p1 = addBox(g, x, 3.4, D/2 - 0.22, 2.5, 4.4, 0.12, MAT.mirror);
      const p2 = addBox(g, x, 3.4, -D/2 + 0.22, 2.5, 4.4, 0.12, MAT.mirror);
      p1.rotation.z = (i % 2 ? 0.04 : -0.04);
      p2.rotation.z = (i % 2 ? -0.04 : 0.04);
      addBox(g, x, 5.75, D/2 - 0.2, 2.7, 0.18, 0.2, MAT.gold);
      addBox(g, x, 5.75, -D/2 + 0.2, 2.7, 0.18, 0.2, MAT.gold);
    }

    const cases = [-7.5, -2.5, 2.5, 7.5];
    cases.forEach((x, idx) => {
      addBox(g, x, 0.45, 0, 2.0, 0.9, 1.6, MAT.darkWood);
      const glass = new THREE.Mesh(G.box, MAT.glassCase);
      glass.position.set(x, 1.55, 0); glass.scale.set(2.0, 1.3, 1.6); g.add(glass);
      if (idx === 0){
        const s = new THREE.Mesh(G.sphere, MAT.white);
        s.scale.set(0.35, 0.22, 0.5); s.position.set(x, 1.25, 0); g.add(s);
        const n = new THREE.Mesh(G.cyl, MAT.white);
        n.scale.set(0.05, 0.5, 0.05); n.position.set(x, 1.6, 0.35); g.add(n);
        addUse(g, x, -1.5, 2.0, "SWAN AUTOMATON", "The silver swan spreads its wings.");
      } else if (idx === 1){
        for (let k = 0; k < 4; k++){
          const f = new THREE.Mesh(G.cyl, MAT.gold);
          f.scale.set(0.09, 0.45, 0.09); f.position.set(x - 0.65 + k * 0.43, 1.2, 0); g.add(f);
        }
        addUse(g, x, -1.5, 2.0, "CLOCKWORK ORCHESTRA", "A tiny brass orchestra plays a tune.");
      } else if (idx === 2){
        const b = new THREE.Mesh(G.cone, MAT.red);
        b.scale.set(0.3, 0.8, 0.3); b.position.set(x, 1.35, 0); g.add(b);
        const hd = new THREE.Mesh(G.sphere, MAT.cream);
        hd.scale.setScalar(0.18); hd.position.set(x, 1.85, 0); g.add(hd);
        addUse(g, x, -1.5, 2.0, "FORTUNE TELLER", "The automaton predicts good luck!");
      } else {
        const s = new THREE.Mesh(G.sphere, MAT.mirror);
        s.scale.setScalar(0.35); s.position.set(x, 1.35, 0); g.add(s);
        addUse(g, x, -1.5, 2.0, "MIRRORED SPHERE", "Your reflection bends around the room.");
      }
      addCollider(g, x, 0, 1.0, 0.8);
    });

    for (let i = 0; i < 6; i++){
      const x = -10 + i * 4;
      lotusLamp(g, x, 4.6, D/2 - 0.6, 1.2);
      lotusLamp(g, x, 4.6, -D/2 + 0.6, 1.2);
    }
  }

  function buildConservatory(){
    const g = mkGroup(24, 24);
    const W = 18, D = 14, H = 6;
    const f = new THREE.Mesh(G.box, MAT.stone);
    f.position.set(0, 0.06, 0); f.scale.set(W, 0.12, D); f.receiveShadow = !isMobile; g.add(f);
    addBox(g, 0, 0.14, 0, W - 2.5, 0.06, 3.2, MAT.white);

    const t = 0.25;
    wallSeg(g, 0, -D/2, W, t, H, MAT.glass);
    wallSeg(g, -W/2, 0, t, D, H, MAT.glass);
    wallSeg(g,  W/2, 0, t, D, H, MAT.glass);
    const seg = (W - 5) / 2;
    wallSeg(g, -(2.5 + seg/2), D/2, seg, t, H, MAT.glass);
    wallSeg(g,  (2.5 + seg/2), D/2, seg, t, H, MAT.glass);

    for (let i = -2; i <= 2; i++) addBox(g, i * 4.2, H, 0, 0.16, 0.3, D, MAT.metal);
    for (let i = -1; i <= 1; i++) addBox(g, 0, H, i * 4.2, W, 0.3, 0.16, MAT.metal);
    
    const roof = new THREE.Mesh(G.box, MAT.glass);
    roof.position.set(0, H + 0.1, 0); roof.scale.set(W, 0.12, D); g.add(roof);

    [[-W/2, -D/2], [W/2, -D/2], [-W/2, D/2], [W/2, D/2]].forEach(p => addBox(g, p[0], H/2, p[1], 0.3, H, 0.3, MAT.metal));

    const basin = new THREE.Mesh(G.cyl, MAT.stone);
    basin.scale.set(2.0, 0.55, 2.0); basin.position.set(0, 0.28, 0); basin.castShadow = !isMobile; g.add(basin);
    const wtr = new THREE.Mesh(G.cyl, MAT.water);
    wtr.scale.set(1.8, 0.1, 1.8); wtr.position.set(0, 0.58, 0); g.add(wtr);
    const boy = new THREE.Mesh(G.cyl, MAT.brass);
    boy.scale.set(0.22, 1.1, 0.22); boy.position.set(0, 1.15, 0); g.add(boy);
    const head = new THREE.Mesh(G.sphere, MAT.brass);
    head.scale.setScalar(0.2); head.position.set(0, 1.8, 0); g.add(head);
    addCollider(g, 0, 0, 2.0, 2.0);
    addUse(g, 0, -2.5, 2.5, "FOUNTAIN", "The water is cool and clear.");

    const beds = [[-6.5, -4.8], [6.5, -4.8], [-6.5, 4.8], [6.5, 4.8], [-4.2, -4.8], [4.2, 4.8]];
    beds.forEach((p, i) => {
      addBox(g, p[0], 0.35, p[1], 3.0, 0.7, 2.4, MAT.wood);
      for (let k = 0; k < 3; k++){
        const px = p[0] - 0.9 + k * 0.9;
        const trunk = new THREE.Mesh(G.cyl, MAT.wood);
        trunk.scale.set(0.1, 1.2, 0.1); trunk.position.set(px, 1.3, p[1]); trunk.castShadow = !isMobile; g.add(trunk);
        for (let j = 0; j < 4; j++){
          const a = j / 4 * Math.PI * 2;
          const leaf = new THREE.Mesh(G.cone, (i + j) % 2 ? MAT.leaf : MAT.leafLight);
          leaf.scale.set(0.15, 1.1, 0.15);
          leaf.position.set(px + Math.cos(a) * 0.42, 2.1, p[1] + Math.sin(a) * 0.42);
          leaf.rotation.z = Math.cos(a) * 0.85;
          leaf.rotation.x = -Math.sin(a) * 0.85;
          g.add(leaf);
        }
      }
      addCollider(g, p[0], p[1], 1.5, 1.2);
    });

    [[-6, 1.5], [6, 1.5]].forEach(p => {
      addBox(g, p[0], 0.5, p[1], 2.2, 0.12, 0.6, MAT.metal);
      addBox(g, p[0], 0.25, p[1], 2.2, 0.5, 0.1, MAT.metal);
      addSeat(g, p[0], p[1], 0, 0.5);
    });
  }

  function buildBallroom(){
    const g = mkGroup(0, -34);
    const W = 26, D = 18, H = 12;
    makeRoom(g, W, D, H, MAT.cream, 7, MAT.oakPolished, MAT.cream, 5.2);

    for (let i = 0; i < 6; i++){
      const x = -10 + i * 4;
      addBox(g, x, 6.0, -D/2 + 0.25, 3.0, 5.0, 0.1, MAT.mirror);
      addBox(g, x, 8.7, -D/2 + 0.22, 3.4, 0.2, 0.2, MAT.gold);
      lotusLamp(g, x, 3.2, -D/2 + 0.7, 1.1);
    }
    for (let i = 0; i < 5; i++){
      const z = -6 + i * 3;
      addBox(g, -W/2 + 0.25, 6.0, z, 0.1, 5.0, 2.6, MAT.mirror);
      addBox(g,  W/2 - 0.25, 6.0, z, 0.1, 5.0, 2.6, MAT.mirror);
    }

    chandelier(g, -8, 8.5, 0, 1.8);
    chandelier(g,  0, 8.5, 0, 1.8);
    chandelier(g,  8, 8.5, 0, 1.8);

    addBox(g, 0, 0.45, -6.6, 13, 0.9, 4.4, MAT.darkWood);
    addBox(g, 0, 0.95, -6.6, 13.4, 0.14, 4.7, MAT.oak);
    addBox(g, -3.2, 1.55, -6.4, 2.2, 1.0, 1.3, MAT.black);
    addBox(g, -3.2, 1.1, -6.4, 2.0, 0.1, 1.1, MAT.white);
    addUse(g, -3.2, -5.2, 2.5, "PLAY PIANO", "You play a sweeping waltz.");
    
    for (let i = 0; i < 6; i++){
      const c = new THREE.Mesh(G.cyl, MAT.black);
      c.scale.set(0.1, 0.9, 0.1);
      c.position.set(2.0 + i * 0.55, 1.4, -6.6); g.add(c);
    }

    addBox(g, -W/2 + 2.2, 0.85, 1.0, 1.4, 0.14, 12, MAT.white);
    for (let i = 0; i < 3; i++){
      const urn = new THREE.Mesh(G.cyl, MAT.white);
      urn.scale.set(0.32, 0.55, 0.32);
      urn.position.set(-W/2 + 2.2, 1.2, -3.5 + i * 4); g.add(urn);
    }
    addUse(g, -W/2 + 3.5, 1.0, 2.0, "REFRESHMENTS", "You sip a glass of punch.");

    for (let i = 0; i < 4; i++){
      const bowl = new THREE.Mesh(G.cyl, MAT.glassCase);
      bowl.scale.set(0.3, 0.22, 0.3);
      bowl.position.set(-W/2 + 2.2, 1.05, -1.8 + i * 2.4); g.add(bowl);
    }

    for (let i = 0; i < 5; i++){
      const x = -7 + i * 3.5, z = 2.5 + (i % 2) * 2.0;
      const a = new THREE.Mesh(G.cyl, MAT.red);
      a.scale.set(0.16, 1.1, 0.16); a.position.set(x, 0.55, z); g.add(a);
      const b = new THREE.Mesh(G.cyl, MAT.black);
      b.scale.set(0.16, 1.15, 0.16); b.position.set(x + 0.42, 0.58, z); g.add(b);
    }
    addUse(g, 0, 4, 4.0, "DANCE", "You twirl across the ballroom floor.");
  }

  function buildGallery(){
    const g = mkGroup(-24, -24);
    const W = 14, D = 10, H = 6;
    makeRoom(g, W, D, H, MAT.redDark, 3.6, MAT.red, MAT.darkWood);

    addBox(g, 0, 0.16, 0, 3.2, 0.06, D - 1.2, MAT.red);
    addBox(g, 0, 0.16, 0, W - 2, 0.06, 2.0, MAT.red);

    for (let i = 0; i < 8; i++){
      const x = -6.0 + i * 1.7;
      addBox(g, x, 3.0, -D/2 + 0.3, 0.55, 5.4, 0.16, MAT.red);
    }

    const exhibits = [
      { x:-4.5, z:-3.4, c:0x88aa88 }, { x:-1.5, z:-3.4, c:0xa8c8d8 },
      { x: 1.5, z:-3.4, c:0xd8c088 }, { x: 4.5, z:-3.4, c:0xcc8899 },
      { x:-4.5, z: 3.4, c:0x99bbcc }, { x: 4.5, z: 3.4, c:0xbb9966 }
    ];
    exhibits.forEach((e, i) => {
      addBox(g, e.x, 0.45, e.z, 1.5, 0.9, 1.1, MAT.darkWood);
      const gl = new THREE.Mesh(G.box, MAT.glassCase);
      gl.position.set(e.x, 1.55, e.z); gl.scale.set(1.5, 1.3, 1.1); g.add(gl);
      const sp = new THREE.Mesh(G.sphere, L(e.c));
      sp.scale.set(0.3, 0.42, 0.3); sp.position.set(e.x, 1.35, e.z); g.add(sp);
      const sp2 = new THREE.Mesh(G.sphere, MAT.flame);
      sp2.scale.setScalar(0.09); sp2.position.set(e.x, 2.75, e.z); g.add(sp2);
      addCollider(g, e.x, e.z, 0.8, 0.6);
      addUse(g, e.x, e.z > 0 ? e.z - 1.5 : e.z + 1.5, 1.5, "EXAMINE EXHIBIT", "You study the strange curiosity.");
    });

    const clock = new THREE.Mesh(G.cyl, MAT.gold);
    clock.scale.set(0.6, 0.12, 0.6);
    clock.rotation.x = Math.PI/2;
    clock.position.set(0, 3.6, -D/2 + 0.4); g.add(clock);

    addBox(g, 0, 0.6, 0, 0.8, 1.2, 0.8, MAT.stone);
    const rock = new THREE.Mesh(G.sphere, MAT.metal);
    rock.scale.setScalar(0.34); rock.position.set(0, 1.45, 0); g.add(rock);
    addCollider(g, 0, 0, 0.5, 0.5);
    addUse(g, 0, -1.5, 1.5, "TOUCH METEORITE", "It is cold to the touch.");

    const barker = new THREE.Mesh(G.cyl, MAT.gold);
    barker.scale.set(0.24, 1.2, 0.24);
    barker.position.set(4.2, 0.6, 3.6); g.add(barker);
    const bh = new THREE.Mesh(G.sphere, MAT.cream);
    bh.scale.setScalar(0.2); bh.position.set(4.2, 1.4, 3.6); g.add(bh);
  }

  function buildArcade(){
    const g = mkGroup(24, -24);
    const W = 18, D = 12, H = 6;
    makeRoom(g, W, D, H, MAT.green, 5, MAT.darkWood, MAT.darkWood);

    [[-5.5, -2.5], [-5.5, 2.2]].forEach(p => {
      addBox(g, p[0], 0.75, p[1], 3.4, 0.2, 2.0, MAT.wood);
      addBox(g, p[0], 0.88, p[1], 3.0, 0.1, 1.6, MAT.felt);
      addBox(g, p[0], 0.35, p[1], 3.4, 0.7, 0.2, MAT.wood);
      addCollider(g, p[0], p[1], 1.7, 1.0);
      addUse(g, p[0], p[1], 2.5, "PLAY BILLIARDS", "You sink the 8-ball!");
    });

    [[2.5, -3.0], [2.5, 0.6], [2.5, 3.6]].forEach((p, i) => {
      const t = new THREE.Mesh(G.cyl, MAT.felt);
      t.scale.set(1.0, 0.14, 1.0); t.position.set(p[0], 0.82, p[1]); g.add(t);
      const leg = new THREE.Mesh(G.cyl, MAT.wood);
      leg.scale.set(0.2, 0.8, 0.2); leg.position.set(p[0], 0.4, p[1]); g.add(leg);
      if (i === 0){
        const wheel = new THREE.Mesh(G.cyl, MAT.brass);
        wheel.scale.set(0.55, 0.1, 0.55); wheel.position.set(p[0], 0.95, p[1]); g.add(wheel);
        addUse(g, p[0], p[1], 2.0, "PLAY ROULETTE", "The ball lands on red!");
      } else {
        addUse(g, p[0], p[1], 2.0, "PLAY CARDS", "You win a hand of poker.");
      }
      addCollider(g, p[0], p[1], 1.0, 1.0);
    });

    addBox(g, 0, 0.6, -D/2 + 1.6, W - 2, 1.2, 1.2, MAT.darkWood);
    addBox(g, 0, 1.28, -D/2 + 1.6, W - 2, 0.16, 1.5, MAT.brass);
    addCollider(g, 0, -D/2 + 1.6, (W-2)/2, 0.75);
    addUse(g, 0, -D/2 + 2.8, 3.0, "ORDER A DRINK", "The bartender pours you a cold drink.");
    
    for (let i = 0; i < 14; i++){
      const b = new THREE.Mesh(G.cyl, i % 3 === 0 ? MAT.gold : (i % 3 === 1 ? L(0x2e6a3a) : L(0x8a3a22)));
      b.scale.set(0.07, 0.4, 0.07);
      b.position.set(-7.5 + i * 1.15, 1.56, -D/2 + 0.35);
      g.add(b);
    }
    addBox(g, 0, 2.2, -D/2 + 0.25, W - 2, 2.6, 0.1, MAT.mirror);

    [[-5.5, -2.5], [-5.5, 2.2], [2.5, -3.0], [2.5, 0.6]].forEach(p => {
      const sh = new THREE.Mesh(G.cone, MAT.gold);
      sh.scale.set(0.65, 0.45, 0.65); sh.rotation.x = Math.PI;
      sh.position.set(p[0], 3.0, p[1]); g.add(sh);
      lotusLamp(g, p[0], 2.75, p[1], 1.3);
    });
  }

  function buildRink(){
    const g = mkGroup(-34, 0);
    const W = 26, D = 20, H = 10;

    const ice = new THREE.Mesh(G.box, MAT.ice);
    ice.position.set(0, 0.08, 0); ice.scale.set(W - 1, 0.16, D - 1); g.add(ice);
    const rim = new THREE.Mesh(G.box, MAT.stone);
    rim.position.set(0, 0.05, 0); rim.scale.set(W, 0.1, D); g.add(rim);

    const t = 0.4;
    wallSeg(g, 0, -D/2, W, t, 1.1, MAT.stone, 0);
    wallSeg(g, -W/2, 0, t, D, 1.1, MAT.stone, 0);
    wallSeg(g,  W/2, 0, t, D, 1.1, MAT.stone, 0);
    const seg = (W - 6) / 2;
    wallSeg(g, -(3 + seg/2), D/2, seg, t, 1.1, MAT.stone, 0);
    wallSeg(g,  (3 + seg/2), D/2, seg, t, 1.1, MAT.stone, 0);

    for (let i = -4; i <= 4; i++){
      addBox(g, 0, H, i * 2.4, W, 0.26, 0.2, MAT.metal);
      const arc = new THREE.Mesh(G.box, MAT.metal);
      arc.position.set(i * 3.0, H - 0.4, 0);
      arc.scale.set(0.2, 0.26, D); g.add(arc);
    }
    const roof = new THREE.Mesh(G.box, MAT.glass);
    roof.position.set(0, H + 0.12, 0); roof.scale.set(W, 0.14, D); g.add(roof);

    [[-W/2, -D/2], [W/2, -D/2], [-W/2, D/2], [W/2, D/2]].forEach(p => {
      const c = new THREE.Mesh(G.cyl, MAT.metal);
      c.scale.set(0.28, H, 0.28); c.position.set(p[0], H/2, p[1]); c.castShadow = !isMobile; g.add(c);
      // Add corner pillars to camera occlusion
      world.colliders.push({ minX: p[0]-0.4, maxX: p[0]+0.4, minZ: p[1]-0.4, maxZ: p[1]+0.4, y0: 0, y1: H, level: 0 });
    });

    addBox(g, 0, 0.6, -D/2 + 3.2, 8, 1.2, 4, MAT.wood);
    for (let i = 0; i < 4; i++){
      const c = new THREE.Mesh(G.cyl, MAT.white);
      c.scale.set(0.15, 4, 0.15);
      c.position.set(-3.5 + (i % 2) * 7, 2.0, -D/2 + 3.2 + (i < 2 ? -1.6 : 1.6));
      g.add(c);
    }
    addBox(g, 0, 4.1, -D/2 + 3.2, 8.4, 0.25, 4.4, MAT.gold);
    
    for (let i = 0; i < 5; i++){
      const f = new THREE.Mesh(G.cyl, MAT.black);
      f.scale.set(0.14, 0.8, 0.14);
      f.position.set(-2.6 + i * 1.3, 2.0, -D/2 + 3.2); g.add(f);
    }
    addCollider(g, 0, -D/2 + 3.2, 4.0, 2.0);
    addUse(g, 0, -D/2 + 5.5, 3.0, "LISTEN TO BAND", "A small band plays a lively tune.");

    [[-4.5, D/2 - 1.5], [4.5, D/2 - 1.5]].forEach(p => {
      const b = new THREE.Mesh(G.cyl, MAT.metal);
      b.scale.set(0.5, 0.8, 0.5); b.position.set(p[0], 0.4, p[1]); g.add(b);
      const fire = new THREE.Mesh(G.sphere, MAT.flame);
      fire.scale.setScalar(0.34); fire.position.set(p[0], 1.0, p[1]); g.add(fire);
      addCollider(g, p[0], p[1], 0.55, 0.55);
      addUse(g, p[0], p[1] - 1.5, 1.5, "WARM UP", "You warm your hands by the fire.");
    });

    for (let i = -4; i <= 4; i++){
      for (let j = -3; j <= 3; j++){
        lotusLamp(g, i * 3.0, H - 0.9, j * 2.8, 1.0);
      }
    }
  }

  function buildTheatre(){
    const g = mkGroup(34, 0);
    const W = 20, D = 16, H = 12;
    makeRoom(g, W, D, H, MAT.red, 6, MAT.red, MAT.darkWood, 5.4);

    addBox(g, 0, 5.0, -D/2 + 3.4, 14, 10, 0.5, MAT.gold);
    addBox(g, 0, 5.0, -D/2 + 3.6, 12, 9, 0.3, MAT.redDark);
    addBox(g, 0, 0.6, -D/2 + 2.2, 14, 1.2, 3.0, MAT.darkWood);
    addCollider(g, 0, -D/2 + 2.2, 7.0, 1.5);
    addUse(g, 0, -D/2 + 5.0, 3.0, "WATCH PLAY", "The actors take the stage.");
    
    addBox(g, 0, 5.5, -D/2 + 3.9, 12, 8.6, 0.2, MAT.red);
    addBox(g, 0, 9.9, -D/2 + 4.0, 12.4, 0.4, 0.35, MAT.gold);

    for (let i = 0; i < 9; i++) lotusLamp(g, -5.0 + i * 1.25, 1.35, -D/2 + 3.6, 1.1);

    for (let r = 0; r < 6; r++){
      const z = -D/2 + 6.0 + r * 1.7;
      const y = 0.35 + r * 0.16;
      addBox(g, 0, y, z, 16, 0.35, 1.1, MAT.redDark);
      addBox(g, 0, y + 0.42, z + 0.5, 16, 0.55, 0.18, MAT.red);
      for(let c = -3; c <= 3; c++) {
        addSeat(g, c * 2.2, z, Math.PI, y + 0.2);
      }
    }

    addBox(g, 0, 6.4, D/2 - 2.2, W - 2, 0.5, 3.0, MAT.redDark);
    addBox(g, 0, 7.4, D/2 - 3.6, W - 2, 1.6, 0.25, MAT.gold);
    for (let i = 0; i < 5; i++) lotusLamp(g, -8 + i * 4, 5.8, D/2 - 3.0, 1.2);

    const sky = new THREE.Mesh(G.box, MAT.dome);
    sky.position.set(0, H - 0.15, 0); sky.scale.set(W - 1, 0.2, D - 1); g.add(sky);
    chandelier(g, 0, 7.6, 2.0, 1.2);
  }

  const RG = { x: 0, z: -58, halfW: 9, halfD: 8, h: 5 };

  function buildRoofGarden(){
    const g = mkGroup(RG.x, RG.z);
    const W = RG.halfW * 2, D = RG.halfD * 2, H = RG.h;

    addBox(g, 0, H/2, 0, W, H, D, MAT.stone);
    // Add solid block to camera occlusion
    world.colliders.push({ minX: RG.x - W/2, maxX: RG.x + W/2, minZ: RG.z - D/2, maxZ: RG.z + D/2, y0: 0, y1: H, level: 0 });

    addBox(g, 0, H + 0.1, 0, W + 0.6, 0.2, D + 0.6, MAT.white);
    addBox(g, 0, H + 0.22, 0, W - 2, 0.06, 2.4, MAT.marbleDark);
    addBox(g, 0, H + 0.22, 0, 2.4, 0.06, D - 2, MAT.marbleDark);

    const railMat = MAT.metal;
    wallSeg(g, 0, -D/2, W, 0.3, 1.1, railMat, H);
    wallSeg(g, -W/2, 0, 0.3, D, 1.1, railMat, H);
    wallSeg(g,  W/2, 0, 0.3, D, 1.1, railMat, H);
    const seg = (W - 6) / 2;
    wallSeg(g, -(3 + seg/2), D/2, seg, 0.3, 1.1, railMat, H);
    wallSeg(g,  (3 + seg/2), D/2, seg, 0.3, 1.1, railMat, H);

    const rampLen = Math.hypot(8, H);
    const ang = Math.atan2(H, 8);
    const ramp = new THREE.Mesh(G.box, MAT.stone);
    ramp.scale.set(6, 0.35, rampLen);
    ramp.rotation.x = ang;
    ramp.position.set(0, H/2, D/2 + 4);
    g.add(ramp);
    
    [-3, 3].forEach(x => {
      const r = new THREE.Mesh(G.box, MAT.metal);
      r.scale.set(0.18, 0.9, rampLen);
      r.rotation.x = ang;
      r.position.set(x, H/2 + 0.6, D/2 + 4);
      g.add(r);
      g.userData.boxes.push({ x, z: D/2 + 4, hw: 0.3, hd: 4.2 });
    });

    for (let i = 0; i < 10; i++){
      const a = i / 10 * Math.PI * 2;
      const px = Math.sin(a) * 7.0, pz = Math.cos(a) * 6.0;
      if (pz > 5 && Math.abs(px) < 3.5) continue;
      const pot = new THREE.Mesh(G.cyl, MAT.rose);
      pot.scale.set(0.5, 0.7, 0.5); pot.position.set(px, H + 0.55, pz); g.add(pot);
      const tr = new THREE.Mesh(G.cyl, MAT.wood);
      tr.scale.set(0.13, 1.8, 0.13); tr.position.set(px, H + 1.8, pz); g.add(tr);
      for (let k = 0; k < 3; k++){
        const b = new THREE.Mesh(G.sphere, MAT.leaf);
        b.scale.setScalar(0.55 + Math.random() * 0.3);
        b.position.set(px + (Math.random()-0.5)*1.2, H + 2.6 + Math.random()*0.6, pz + (Math.random()-0.5)*1.2);
        g.add(b);
      }
      addCollider(g, px, pz, 0.6, 0.6);
    }

    [[-7,-6],[7,-6],[-7,6],[7,6]].forEach(p => {
      lampPost(g, p[0], p[1], 3.0);
      const l = g.children[g.children.length - 1];
      l.position.y += H;
      const l2 = g.children[g.children.length - 2];
      l2.position.y += H;
    });

    for (let i = 0; i < 4; i++){
      const px = -5 + i * 3.2, pz = -2.0;
      addBox(g, px, H + 0.35, pz, 0.9, 0.1, 0.9, MAT.wood);
      const leg = new THREE.Mesh(G.cyl, MAT.wood);
      leg.scale.set(0.08, 0.7, 0.08); leg.position.set(px, H + 0.0, pz); g.add(leg);
      addBox(g, px + 0.8, H + 0.35, pz, 0.7, 0.08, 0.7, MAT.gold);
      addSeat(g, px + 0.8, pz, 0, H + 0.35);
    }

    addBox(g, 0, H + 0.3, 2.6, 8, 0.2, 6, MAT.oak);
    for (let i = 0; i < 4; i++){
      const f = new THREE.Mesh(G.cyl, MAT.black);
      f.scale.set(0.15, 0.9, 0.15);
      f.position.set(-3 + i * 2, H + 0.9, -5.0); g.add(f);
    }
    chandelier(g, 0, H + 4.2, 0, 1.0);
    addUse(g, 0, 2.6, 4.0, "DANCE", "You dance under the sun on the roof garden.");
  }

  buildEntranceHall();
  buildConservatory();
  buildTheatre();
  buildArcade();
  buildBallroom();
  buildGallery();
  buildRink();
  buildHallOfMirrors();
  buildRoofGarden();

  /* ============================================================
     COLLISION LOGIC & NATIVE CONTROLS
     ============================================================ */
  function resolveCollisions(px, pz) {
    const p = { x: px, z: pz };
    for (let gi = 0; gi < colliderGroups.length; gi++){
      const g = colliderGroups[gi];
      const gx = g.position.x, gz = g.position.z;
      let dxw = p.x - gx, dzw = p.z - gz;
      if (dxw*dxw + dzw*dzw > 3600) continue;

      const a = g.rotation.y, ca = Math.cos(a), sa = Math.sin(a);
      let lx =  ca*dxw - sa*dzw;
      let lz =  sa*dxw + ca*dzw;

      const boxes = g.userData.boxes;
      for (let i = 0; i < boxes.length; i++){
        const b = boxes[i];
        const dx = lx - b.x, dz = lz - b.z;
        const cx = Math.max(-b.hw, Math.min(b.hw, dx));
        const cz = Math.max(-b.hd, Math.min(b.hd, dz));
        let ex = dx - cx, ez = dz - cz;
        const d2 = ex*ex + ez*ez;
        if (d2 >= PLAYER_R * PLAYER_R) continue;
        if (d2 > 1e-8){
          const d = Math.sqrt(d2);
          const k = (PLAYER_R - d) / d;
          lx += ex * k; lz += ez * k;
        } else {
          const ox = b.hw - Math.abs(dx);
          const oz = b.hd - Math.abs(dz);
          if (ox < oz) lx = b.x + (dx < 0 ? -1 : 1) * (b.hw + PLAYER_R);
          else         lz = b.z + (dz < 0 ? -1 : 1) * (b.hd + PLAYER_R);
        }
      }

      const rings = g.userData.rings;
      for (let i = 0; i < rings.length; i++){
        const r = rings[i];
        const d = Math.hypot(lx, lz);
        if (d < 0.001) continue;
        const ang = Math.atan2(lx, lz);
        if (r.gap > 0 && Math.abs(ang) < r.gap) continue;
        const need = r.t / 2 + PLAYER_R;
        const diff = d - r.r;
        if (Math.abs(diff) < need){
          const nd = r.r + (diff >= 0 ? need : -need);
          const inv = 1 / d;
          lx *= nd * inv; lz *= nd * inv;
        }
      }

      p.x = gx + (ca*lx + sa*lz);
      p.z = gz + (-sa*lx + ca*lz);
    }
    return [p.x, p.z];
  }

  function groundHeight(x, z){
    const dx = x - RG.x, dz = z - RG.z;
    if (Math.abs(dx) <= RG.halfW && Math.abs(dz) <= RG.halfD) return RG.h;
    if (Math.abs(dx) <= 3 && dz > RG.halfD && dz < RG.halfD + 8){
      return RG.h * (1 - (dz - RG.halfD) / 8);
    }
    return 0;
  }

  class ParkControls extends ThirdPersonControls {
    _resolve(px, pz, level) {
      let [nx, nz] = resolveCollisions(px, pz);
      const dist = Math.hypot(nx, nz);
      if (dist > 148) {
        const k = 148 / dist;
        nx *= k; nz *= k;
      }
      return [nx, nz];
    }
    _groundInfo(x, z, level) {
      return { y: groundHeight(x, z), level: 0, onStairs: false };
    }
  }

  const ctrl = new ParkControls(camera, router.renderer.domElement, world, {
    scene: scene,
    x: 0, z: 12, yaw: Math.PI, level: 0,
    speedMult: 1.0,
    onUse: (use) => {
      if (use.onUse) use.onUse();
      else if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE");
    }
  });

  return {
    three: scene,
    camera: camera,
    controls: { update: () => {} },
    crumb: "PLEASURE PARK",
    title: "Pleasure Park",
    subtitle: "EXPLORE",
    hint: "",
    update: (dt) => {
      ctrl.update(dt);
    },
    dispose: () => {
      ctrl.dispose();
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => m.dispose());
        }
      });
    }
  };
}1
