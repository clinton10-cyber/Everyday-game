/* vatican/interior.js -- converted from the standalone prototype "vatican.html".
   World-building code is the prototype's own; the touch controls, loop and
   renderer were replaced by the game's ThirdPersonControls (player avatar,
   wardrobe, phone, weapons...). Collision boxes are converted below. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import { ZoneDrive } from "../../core/drive-zones.js";
import { addStreetLamp } from "../../core/scene-lamps.js";

export async function buildInterior(router) {
  /* ======== prototype kit + world ======== */
  /* ================= SHARED KIT ================= */
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0xb8d8f0); // Italian sky
  scene.fog=new THREE.Fog(0xb8d8f0,60,220); // Vast distance
  const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,300);

  /* Lighting */
  scene.add(new THREE.HemisphereLight(0xfff8e8,0x4a4a4a,1.0));
  const sun=new THREE.DirectionalLight(0xfff0d0,1.2);
  sun.position.set(30,50,30);
  sun.castShadow=true;
  sun.shadow.mapSize.width=1024;
  sun.shadow.mapSize.height=1024;
  sun.shadow.camera.near=0.5;
  sun.shadow.camera.far=100;
  sun.shadow.camera.left=-40;
  sun.shadow.camera.right=40;
  sun.shadow.camera.top=50;
  sun.shadow.camera.bottom=-20;
  scene.add(sun);

  // Interior lighting
  const domeLight = new THREE.PointLight(0xffe0a0, 2.0, 40);
  domeLight.position.set(0, 20, -55);
  scene.add(domeLight);

  const BOXG = new THREE.BoxGeometry(1,1,1);
  const CYLG = new THREE.CylinderGeometry(.5,.5,1,16);
  const SPHG = new THREE.SphereGeometry(.5,12,10);
  const CONEG = new THREE.ConeGeometry(.5,1,16);
  const MC = new Map();

  function mat(c,o){
    if(o&&o.map) return new THREE.MeshLambertMaterial(Object.assign({color:c},o));
    const k=c+'|'+JSON.stringify(o||0); let m=MC.get(k);
    if(!m){m=new THREE.MeshLambertMaterial(Object.assign({color:c},o||{}));MC.set(k,m);}
    return m;
  }
  const glow = (c) => new THREE.MeshBasicMaterial({color: c});

  const world=new THREE.Group(); scene.add(world);
  const solid=[];
  const seats=[];
  const uses=[];

  function box(w,h,d,x,y,z,m,o){
    o=o||{};
    const s=new THREE.Mesh(BOXG,typeof m==='number'?mat(m):m);
    s.scale.set(w,h,d); s.position.set(x,y,z); s.rotation.set(o.rx||0,o.ry||0,o.rz||0);
    s.castShadow = true; s.receiveShadow = true;
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
    s.castShadow = true; s.receiveShadow = true;
    world.add(s);
    if(o.solid) solid.push({x,z,hw:r,hd:r});
    return s;
  }
  function sph(r,x,y,z,m){
    const s=new THREE.Mesh(SPHG,typeof m==='number'?mat(m):m);
    s.scale.setScalar(r*2); s.position.set(x,y,z);
    s.castShadow = true; s.receiveShadow = true;
    world.add(s); return s;
  }
  function cone(r,h,x,y,z,m,o){
    o=o||{};
    const s=new THREE.Mesh(CONEG,typeof m==='number'?mat(m):m);
    s.scale.set(r*2,h,r*2); s.position.set(x,y,z); s.rotation.set(o.rx||0,o.ry||0,o.rz||0);
    s.castShadow = true; s.receiveShadow = true;
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

  /* ================= TEXTURES & MATERIALS ================= */
  const cobbleTex = tex(128,128,g=>{
    g.fillStyle='#c8c0b0'; g.fillRect(0,0,128,128);
    g.strokeStyle='#a89a8a'; g.lineWidth=2;
    for(let y=0;y<128;y+=16){
      for(let x=0;x<128;x+=16){
        g.strokeRect(x,y,16,16);
      }
    }
  }, 30, 30);

  const marbleTex = tex(128,128,g=>{
    g.fillStyle='#f8f8f8'; g.fillRect(0,0,128,128);
    g.strokeStyle='#e0e0e0'; g.lineWidth=1.5;
    for(let i=0;i<10;i++){
      g.beginPath(); g.moveTo(Math.random()*128,0); g.lineTo(Math.random()*128,128); g.stroke();
    }
  }, 10, 20);

  const goldTex = tex(64,64,g=>{
    g.fillStyle='#d4af37'; g.fillRect(0,0,64,64);
    g.fillStyle='#b89020';
    for(let i=0;i<10;i++){g.fillRect(Math.random()*64,Math.random()*64,4,4);}
  }, 4, 4);

  const floorM = mat(0xffffff,{map:cobbleTex});
  const interiorFloorM = mat(0xffffff,{map:marbleTex});
  const wallM = mat(0xf4f0e8);
  const goldM = mat(0xffffff,{map:goldTex});
  const domeM = mat(0xd8d0c0);
  const darkM = mat(0x3a3a3a);
  const woodM = mat(0x6a4a32);

  /* ================= VATICAN BUILD ================= */
  const W=80, D=80;
  const ROOM={x:W/2-1, z:D/2-1};
  const START={x:0, z:25, yaw:0};

  /* St. Peter's Square Ground */
  box(W,.2,D,0,-.1,0,floorM);

  /* Obelisk */
  box(3,1,3,0,.5,20,darkM,{solid:true});
  box(2,15,2,0,8,20,mat(0xc8b8a0),{solid:true});
  sph(1,0,16,20,goldM);
  box(2.5,.5,2.5,0,.25,20,darkM);

  /* Colonnades (Left and Right) */
  for(let i=0;i<10;i++){
    const z = 10 - i*8;
    if(z < -15) continue;
    // Left side
    cyl(1,6,-25,3,z,mat(0xd8d0c0),{solid:true});
    cyl(1.2,.5,-25,6.1,z,mat(0xc8b8a0));
    // Right side
    cyl(1,6,25,3,z,mat(0xd8d0c0),{solid:true});
    cyl(1.2,.5,25,6.1,z,mat(0xc8b8a0));
  }
  // Roof over colonnades
  box(6,.5,30,-25,6.5,0,wallM);
  box(6,.5,30,25,6.5,0,wallM);

  /* St. Peter's Basilica (Exterior Facade) */
  box(40,20,10,0,10,-25,wallM,{solid:true});
  // Columns on facade
  for(let i=0;i<6;i++){
    cyl(1.5,15,-15+i*6,7.5,-19.8,mat(0xe8e0d0));
    cyl(1.8,1,-15+i*6,15.2,-19.8,mat(0xc8b8a0));
  }
  // Pediment
  cone(25,5,0,22.5,-25,wallM,{rz:Math.PI/2, ry:Math.PI/2});
  // Dome (Exterior)
  cyl(12,8,0,24,-25,mat(0xc8c0b0));
  sph(12,0,32,-25,mat(0xb8b0a0));
  cyl(2,5,0,44,-25,goldM);
  sph(.8,0,46.5,-25,goldM);

  /* ===== INTERIOR ===== */
  // Move interior back a bit so we have space
  const INT_Z = -55;
  // Floor
  box(36,.2,50,0,.1,INT_Z,interiorFloorM);
  // Walls
  box(36,30,.5,0,15,INT_Z-25,wallM,{solid:true});
  box(.5,30,50,-18,15,INT_Z,wallM,{solid:true});
  box(.5,30,50,18,15,INT_Z,wallM,{solid:true});
  // Ceiling / Dome Base
  box(36,.5,50,0,30,INT_Z,wallM);
  // Interior Dome
  const domeGeo = new THREE.SphereGeometry(18, 16, 8, 0, Math.PI*2, 0, Math.PI/2);
  const domeMesh = new THREE.Mesh(domeGeo, domeM);
  domeMesh.position.set(0, 30, INT_Z);
  world.add(domeMesh);
  // Oculus
  cyl(3,.5,0,47,INT_Z,goldM);
  sph(3,0,47,INT_Z,glow(0xfff8e8)); // God light

  // Main Altar (Baldacchino)
  box(4,1,4,0,.5,INT_Z-15,darkM,{solid:true});
  // Bronze pillars
  for(let i=0;i<4;i++){
    const px = (i%2===0? -1.5 : 1.5);
    const pz = (i<2? -1.5 : 1.5);
    cyl(.4,8,px,4,INT_Z-15+pz,mat(0x4a3a2a),{solid:true});
  }
  // Canopy
  box(4,.5,4,0,8,INT_Z-15,goldM);
  box(3,2,3,0,9,INT_Z-15,darkM);
  uses.push({ kind: "pray", label: "PRAY AT ALTAR", x: 0, z: INT_Z-13, y: 0, level: 0, r: 2.5 });

  // Pews (Rows of benches)
  for(let row=0; row<8; row++){
    const z = INT_Z + 20 - row*4.5;
    // Left pews
    box(10,.5,1.5,-9,.4,z,woodM,{solid:true});
    box(10,.8,.2,-9,.8,z-0.65,woodM);
    seats.push({ type: "sit", label: "SIT IN PEW", x: -9, z: z, yaw: Math.PI, h: 0.55, level: 0, taken: false });
    // Right pews
    box(10,.5,1.5,9,.4,z,woodM,{solid:true});
    box(10,.8,.2,9,.8,z-0.65,woodM);
    seats.push({ type: "sit", label: "SIT IN PEW", x: 9, z: z, yaw: Math.PI, h: 0.55, level: 0, taken: false });
  }

  // Marble columns inside
  for(let i=0;i<5;i++){
    const z = INT_Z + 15 - i*10;
    cyl(1.2,25,-15,12.5,z,mat(0xe8e0d0),{solid:true});
    cyl(1.2,25,15,12.5,z,mat(0xe8e0d0),{solid:true});
    cyl(1.5,1.5,-15,25,z,mat(0xc8b8a0));
    cyl(1.5,1.5,15,25,z,mat(0xc8b8a0));
  }

  // Side Altars / Art
  box(4,8,.5,-17.5,4,INT_Z-10,mat(0x8a3a3a));
  box(3,6,.1,-17.5,4,INT_Z-10,glow(0xfff0d0));
  box(4,8,.5,17.5,4,INT_Z-10,mat(0x3a3a8a));
  box(3,6,.1,17.5,4,INT_Z-10,glow(0xfff0d0));

  // Entrance to interior (from the square)
  // We create a corridor connecting the facade to the interior
  box(10,.1,30,0,.05,-35,interiorFloorM);
  box(.5,15,30,-5,7.5,-35,wallM,{solid:true});
  box(.5,15,30,5,7.5,-35,wallM,{solid:true});
  // Open doors into the main basilica
  // (No collision box here so we can walk through)

  /* ---------- STREET LAMPS (around the square, lit at night) ---------- */
  {
    const lx = ROOM.x - 4, lz = ROOM.z - 4;
    const spots = [
      [-lx, -lz, Math.PI * 0.25], [0, -lz, Math.PI], [lx, -lz, Math.PI * 0.75],
      [-lx, 0, Math.PI * 0.5],                         [lx, 0, -Math.PI * 0.5],
      [-lx, lz, -Math.PI * 0.25], [0, lz, 0], [lx, lz, -Math.PI * 0.75],
    ];
    for (const [sx, sz, yaw] of spots) addStreetLamp(scene, sx, 0, sz, yaw);
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

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, __world, {
    scene, x: START.x, z: START.z, yaw: Math.PI + (START.yaw || 0), level: 0,
    onUse: (use) => { if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE"); },
  });

  const drv = ZoneDrive.attach({
    scene, camera, renderer: router.renderer, world: __world,
    spawn: { x: START.x, z: START.z, y: 0 },
  });

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "VATICAN CITY",
    title: "HOLY SEE \u00b7 BASILICA",
    subtitle: "",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: INTERACT",
    isInterior: true,
    sceneId: "vatican",
    update: (dt) => {
      if (!drv.isDriving()) ctl.update(dt);
      drv.update(dt);
    },
    dispose: () => { drv.dispose(); ctl.dispose(); },
  };
}

