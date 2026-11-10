/* computerlab/interior.js -- converted from the standalone prototype "computer.html".
   World-building code is the prototype's own; the touch controls, loop and
   renderer were replaced by the game's ThirdPersonControls (player avatar,
   wardrobe, phone, weapons...). Collision boxes are converted below. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";

export async function buildInterior(router) {
  /* ======== prototype kit + world ======== */
  /* ================= SHARED KIT ================= */
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x1a1e26);
  scene.fog=new THREE.Fog(0x1a1e26,15,45);
  const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,100);

  /* Lighting */
  scene.add(new THREE.HemisphereLight(0xd8e8ff,0x2a2a34,0.8));
  const sun=new THREE.DirectionalLight(0xffffff,0.8);
  sun.position.set(10,20,5);
  sun.castShadow=true;
  sun.shadow.mapSize.width=512;
  sun.shadow.mapSize.height=512;
  sun.shadow.camera.near=0.5;
  sun.shadow.camera.far=30;
  sun.shadow.camera.left=-10;
  sun.shadow.camera.right=10;
  sun.shadow.camera.top=15;
  sun.shadow.camera.bottom=-5;
  scene.add(sun);

  const roomLight = new THREE.PointLight(0xd8e8ff, 0.6, 15);
  roomLight.position.set(0, 3, 0);
  scene.add(roomLight);

  const BOXG = new THREE.BoxGeometry(1,1,1);
  const CYLG = new THREE.CylinderGeometry(.5,.5,1,12);
  const SPHG = new THREE.SphereGeometry(.5,10,8);
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
  const seats=[]; // FIXED: Added seats array

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
  function tex(w,h,draw,rx,ry){
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    draw(c.getContext('2d'),w,h);
    const t=new THREE.CanvasTexture(c);
    t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx||1,ry||1);
    t.colorSpace=THREE.SRGBColorSpace;
    return t;
  }

  /* ================= TEXTURES & MATERIALS ================= */
  const floorTex = tex(128,128,g=>{
    // Carpet tiles
    g.fillStyle='#3a4a5a'; g.fillRect(0,0,128,128);
    g.fillStyle='#2a3a4a';
    for(let y=0;y<128;y+=16){
      for(let x=0;x<128;x+=16){
        g.fillRect(x+1,y+1,14,14);
      }
    }
  }, 8, 10);

  const wallTex = tex(128,128,g=>{
    g.fillStyle='#e8e8e8'; g.fillRect(0,0,128,128);
    g.strokeStyle='#d0d0d0'; g.lineWidth=2;
    g.strokeRect(0,0,128,128);
  }, 4, 4);

  const screenTex = tex(128,128,g=>{
    g.fillStyle='#1a2a4a'; g.fillRect(0,0,128,128);
    g.fillStyle='#4a9a3a';
    g.fillRect(10,10,40,4); // Code line
    g.fillRect(10,20,60,4);
    g.fillRect(10,30,30,4);
    g.fillRect(10,40,50,4);
    g.fillStyle='#c8a850';
    g.fillRect(60,10,30,4);
    g.fillRect(80,20,20,4);
    g.fillRect(10,60,80,2); // Separator
    g.fillStyle='#3a6a8a';
    g.fillRect(10,70,90,20); // Terminal
    g.fillStyle='#e8e8e8';
    g.fillRect(15,75,10,4); // Command prompt
  }, 1, 1);

  const floorM = mat(0xffffff,{map:floorTex});
  const wallM = mat(0xffffff,{map:wallTex});
  const ceilM = mat(0xf0f0f0);
  const deskM = mat(0xd8d0c0);
  const metalM = mat(0x4a4a4a);
  const blackM = mat(0x1a1a1a);
  const whiteM = mat(0xf8f8f8);

  /* ================= ROOM BUILD ================= */
  const W=18, D=24, H=3.2;
  const ROOM={x:W/2-0.5, z:D/2-0.5};
  const START={x:0, z:10, yaw:0};

  /* Shell */
  box(W,.2,D,0,-.1,0,floorM);
  box(W,.2,D,0,H+.1,0,ceilM);
  box(W,H,.3,0,H/2,-D/2,wallM,{solid:true});
  box(W,H,.3,0,H/2,D/2,wallM,{solid:true});
  box(.3,H,D,-W/2,H/2,0,wallM,{solid:true});
  box(.3,H,D,W/2,H/2,0,wallM,{solid:true});

  /* Whiteboard (Front) */
  box(8,2.5,.1,0,1.8,-D/2+.2,whiteM);
  box(8.2,.2,.2,0,3.1,-D/2+.2,metalM);
  // Marker tray
  box(6,.1,.2,0,1.3,-D/2+.2,metalM);
  box(.2,.1,.1,-2,1.35,-D/2+.2,mat(0x8a1a1a));
  box(.2,.1,.1,2,1.35,-D/2+.2,mat(0x1a3a8a));

  /* Teacher's Desk */
  box(4,1.1,1.5,0,.55,-9.5,deskM,{solid:true});
  box(4.2,.1,1.7,0,1.15,-9.5,mat(0xa89a8a));
  // Monitor
  box(.8,.5,.05,0,1.4,-10,glow(0xffffff),{map:screenTex});
  box(.1,.2,.1,0,1.2,-10,blackM);
  // Keyboard
  box(1.2,.05,.4,0,1.17,-9.3,blackM);
  // Chair
  box(.6,.1,.6,0,.5,-8.5,blackM,{solid:true});
  box(.6,.8,.1,0,.9,-8.2,blackM);
  cyl(.05,.5,0,.25,-8.5,metalM);
  cyl(.25,.1,0,.05,-8.5,blackM);

  /* ===== STUDENT WORKSTATIONS ===== */
  function workstation(x,z){
    // Desk
    box(2.2,.1,1.0,x,.75,z,deskM,{solid:true});
    box(.1,.75,.1,x-1,.37,z,metalM);
    box(.1,.75,.1,x+1,.37,z,metalM);
    box(2.1,.5,.8,x,.25,z,mat(0xb8b0a0)); // Modesty panel
  
    // Monitor
    box(.9,.5,.05,x,.95,z-.2,glow(0xffffff),{map:screenTex});
    box(.2,.2,.15,x,.8,z-.1,blackM);
    // PC Tower
    box(.3,.6,.6,x+1,.3,z,blackM);
    // Keyboard & Mouse
    box(.9,.04,.3,x,.81,z+.25,blackM);
    box(.15,.04,.2,x+.7,.81,z+.25,blackM);
    // Chair
    box(.5,.1,.5,x,.45,z+.8,blackM,{solid:true});
    box(.5,.6,.1,x,.75,z+1.05,blackM);
    cyl(.04,.45,x,.22,z+.8,metalM);
    cyl(.2,.08,x,.04,z+.8,blackM);
    
    // FIXED: Added seat interactable for workstation chairs
    seats.push({ type: "sit", label: "SIT", x: x, z: z + 1.1, yaw: Math.PI, h: 0.55, level: 0, taken: false });
  }

  /* 3 Rows x 4 Columns */
  for(let row=0; row<3; row++){
    for(let col=0; col<4; col++){
      const x = -6.5 + col*4.3;
      const z = -6.0 + row*3.8;
      workstation(x, z);
    }
  }

  /* ===== SERVER RACKS ===== */
  box(1.5,2.2,.8,8,1.1,8,blackM,{solid:true});
  box(1.6,.1,.9,8,2.25,8,metalM);
  // Blinking lights
  for(let i=0;i<8;i++){
    sph(.04,7.8,1.8-(i*.2),8.45,glow(i%2===0?0x4a9a3a:0xc8a850));
  }
  box(1.5,2.2,.8,8,1.1,10,blackM,{solid:true});
  box(1.6,.1,.9,8,2.25,10,metalM);
  for(let i=0;i<8;i++){
    sph(.04,7.8,1.8-(i*.2),10.45,glow(i%2===0?0x4a9a3a:0xc8a850));
  }

  /* ===== DECOR ===== */
  // Ceiling Lights
  for(let i=0;i<3;i++) for(let j=0;j<3;j++)
    box(2,.05,1,-6+i*6,H-.05,-6+j*6,glow(0xf0f8ff));

  // Wall Clock
  cyl(.3,.05,8,2.5,D/2-.2,whiteM,{rx:Math.PI/2});
  box(.03,.2,.04,8,2.55,D/2-.25,blackM);
  box(.15,.03,.04,8.05,2.5,D/2-.25,blackM);

  // Entrance Door
  box(3,2.5,.2,0,1.25,D/2-.15,mat(0x5a4a3a),{solid:true});
  box(3.4,.2,.3,0,2.6,D/2-.15,metalM);
  box(.2,2.6,.3,-1.6,1.3,D/2-.15,metalM);
  box(.2,2.6,.3,1.6,1.3,D/2-.15,metalM);

  // Trash cans
  cyl(.2,.4,-8,.2,10,metalM,{solid:true});
  cyl(.2,.4,8,.2,-10,metalM,{solid:true});
  /* ======== game glue ======== */
  camera.fov = 95; camera.updateProjectionMatrix();
  const __cols = [];
  for (const b of solid) {
    const mk = (level) => ({ minX: b.x - b.hw, maxX: b.x + b.hw, minZ: b.z - b.hd, maxZ: b.z + b.hd, y0: 0, y1: 60, level });
    __cols.push(mk(0));
  }
  const __world = {
    colliders: __cols, seats: seats, uses: [], // FIXED: Passed seats array
    stairs: [],
    platforms: [],
    levelHeight: () => 0,
    ceilingHeight: H,
    bounds: { minX: -ROOM.x, maxX: ROOM.x, minZ: -ROOM.z, maxZ: ROOM.z },
  };

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, __world, {
    scene, x: START.x, z: START.z, yaw: Math.PI + (START.yaw || 0), level: 0,
    onUse: (use) => { if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE"); },
  });

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "COMPUTER LAB",
    title: "TECH HUB",
    subtitle: "",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: INTERACT",
    isInterior: true,
    sceneId: "computerlab",
    update: (dt) => {
      ctl.update(dt);
    },
    dispose: () => ctl.dispose(),
  };
}
