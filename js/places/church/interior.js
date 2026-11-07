/* church/interior.js -- converted from the standalone prototype "lundary.html".
   World-building code is the prototype's own; the touch controls, loop and
   renderer were replaced by the game's ThirdPersonControls (player avatar,
   wardrobe, phone, weapons...). Collision boxes are converted below. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import { Wedding } from "../../core/wedding.js";

export async function buildInterior(router) {
  /* ======== prototype kit + world ======== */
  /* ================= SHARED KIT ================= */
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x1a1a20);
  scene.fog=new THREE.Fog(0x1a1a20,10,45);
  const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,100);

  /* Lighting */
  scene.add(new THREE.HemisphereLight(0xfff8e8,0x2a2a34,0.9));
  const sun=new THREE.DirectionalLight(0xfff0d0,1.2);
  sun.position.set(10,20,5);
  sun.castShadow=true;
  sun.shadow.mapSize.width=512;
  sun.shadow.mapSize.height=512;
  sun.shadow.camera.near=0.5;
  sun.shadow.camera.far=30;
  sun.shadow.camera.left=-12;
  sun.shadow.camera.right=12;
  sun.shadow.camera.top=20;
  sun.shadow.camera.bottom=-5;
  scene.add(sun);

  const altarLight = new THREE.PointLight(0xffe0a0, 1.5, 15);
  altarLight.position.set(0, 3, -9);
  scene.add(altarLight);

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
  // FIX: Added missing sph function
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
  const stoneTex = tex(128,128,g=>{
    g.fillStyle='#d8d0c0'; g.fillRect(0,0,128,128);
    g.strokeStyle='#c0b8a8'; g.lineWidth=2;
    for(let y=0;y<128;y+=32){
      for(let x=0;x<128;x+=64){
        g.strokeRect(x+(y%64===0?0:32),y,64,32);
      }
    }
  }, 4, 6);

  const woodTex = tex(128,128,g=>{
    g.fillStyle='#6a4a32'; g.fillRect(0,0,128,128);
    g.strokeStyle='#4a301a'; g.lineWidth=2;
    for(let i=0;i<8;i++){g.beginPath();g.moveTo(0,i*16);g.lineTo(128,i*16);g.stroke();}
    g.strokeStyle='#3a2010'; g.lineWidth=1;
    for(let i=0;i<25;i++){const x=Math.random()*128;g.beginPath();g.moveTo(x,0);g.lineTo(x+5,128);g.stroke();}
  }, 4, 4);

  const carpetTex = tex(64,64,g=>{
    g.fillStyle='#8a1a1a'; g.fillRect(0,0,64,64);
    g.fillStyle='#6a1010';
    for(let i=0;i<100;i++){g.fillRect(Math.random()*64,Math.random()*64,2,2);}
  }, 2, 8);

  const glassTex = tex(128,256,g=>{
    g.fillStyle='#1a2a4a'; g.fillRect(0,0,128,256);
    const colors=['#c82a2a','#2a6ac8','#c8a02a','#2a8a4a','#8a2a8a','#e8e0d0'];
    for(let y=0;y<256;y+=32){
      for(let x=0;x<128;x+=32){
        g.fillStyle=colors[Math.floor(Math.random()*colors.length)];
        g.beginPath();
        g.arc(x+16,y+16,12,0,Math.PI*2);
        g.fill();
      }
    }
  }, 1, 1);

  const floorM = mat(0xffffff,{map:stoneTex});
  const wallM = mat(0xf0e8d8,{map:stoneTex});
  const woodM = mat(0xffffff,{map:woodTex});
  const carpetM = mat(0xffffff,{map:carpetTex});
  const ceilM = mat(0xd8d0c0);
  const stoneM = mat(0xd0c8b8);
  const darkWood = mat(0x3a2a1a);

  /* ================= CHURCH BUILD ================= */
  const W=16, D=28, H=8;
  const ROOM={x:W/2-0.5, z:D/2-0.5};
  const START={x:0, z:10, yaw:0};

  /* Shell */
  box(W,.2,D,0,-.1,0,floorM);
  box(W,.2,D,0,H+.1,0,ceilM);
  box(W,H,.3,0,H/2,-D/2,wallM,{solid:true});
  box(W,H,.3,0,H/2,D/2,wallM,{solid:true});
  box(.3,H,D,-W/2,H/2,0,wallM,{solid:true});
  box(.3,H,D,W/2,H/2,0,wallM,{solid:true});

  /* Aisle carpet */
  box(2.4,.04,D-4,0,.02,0,carpetM);
  box(2.6,.02,D-4,0,.01,0,mat(0xc8a850));

  /* Stained glass windows (side walls) */
  for(let i=0;i<4;i++){
    const z = -10 + i*6;
    box(.1,4,2,-W/2+.15,4,z,glow(0xffffff),{map:glassTex});
    box(.2,4.4,2.4,-W/2+.1,4,z,mat(0x3a2a1a));
    box(.1,4,2,W/2-.15,4,z,glow(0xffffff),{map:glassTex});
    box(.2,4.4,2.4,W/2-.1,4,z,mat(0x3a2a1a));
  }

  /* High ceiling beams */
  for(let i=0;i<6;i++){
    box(W-1,.3,.3,0,H-.5,-10+i*4,darkWood);
  }
  box(.4,.4,D-1,0,H-.5,0,darkWood);

  /* ===== ALTAR PLATFORM ===== */
  box(8,.3,4,0,.15,-11,stoneM);
  box(8.2,.1,4.2,0,.32,-11,mat(0xc8b8a0));
  box(7.8,.1,3.8,0,.33,-11,carpetM);

  /* Altar Table */
  box(3,.9,1.2,0,.75,-12,woodM,{solid:true});
  box(3.2,.1,1.4,0,1.25,-12,mat(0xe8e0d0));
  box(.6,.4,.08,0,1.5,-12.6,glow(0xffe0a0));
  box(.08,.4,.08,0,1.5,-12.6,glow(0xffe0a0));

  /* Pulpit */
  box(1.2,1.2,.8,-3,.6,-11.5,woodM,{solid:true});
  box(1.3,.1,.9,-3,1.25,-11.5,woodM);
  box(.8,.6,.1,-3,1.6,-11.8,mat(0xe8e0d0));

  /* Choir chairs */
  for(let i=0;i<4;i++){
    box(.6,.6,.6,2+i*0.8,.3,-10,woodM,{solid:true});
    box(.6,.8,.1,2+i*0.8,.7,-10.3,woodM);
    seats.push({ type: "sit", label: "SIT IN CHOIR",
                 x: 2+i*0.8, z: -10, yaw: 0, h: 0.55, level: 0, taken: false });
  }

  /* ===== PEWS ===== */
  function pew(x,z){
    box(4,.1,.6,x,.5,z,woodM,{solid:true});
    box(4,.6,.1,x,.8,z-.3,woodM);
    box(.1,.5,.6,x-1.95,.25,z,woodM);
    box(.1,.5,.6,x+1.95,.25,z,woodM);
    seats.push({ type: "sit", label: "SIT IN PEW",
                 x, z, yaw: Math.PI, h: 0.55, level: 0, taken: false });
  }
  for(let i=0;i<7;i++){
    pew(-4.5,-4+i*2.5);
    pew(4.5,-4+i*2.5);
  }

  /* Prayer/reading use points */
  uses.push({ kind: "pray", label: "PRAY AT ALTAR",
              x: 0, z: -10.8, y: 0, level: 0, r: 2.0 });
  uses.push({ kind: "read", label: "READ FROM PULPIT",
              x: -3, z: -10.8, y: 0, level: 0, r: 1.5 });

  /* ===== DECOR ===== */
  /* Standing candle sticks */
  function candlestick(x,z){
    cyl(.15,.05,x,.05,z,mat(0xc8a850));
    cyl(.06,1.5,x,.75,z,mat(0xc8a850));
    cyl(.1,.1,x,1.5,z,mat(0xc8a850));
    cyl(.04,.3,x,1.65,z,mat(0xffffff));
    sph(.08,x,1.85,z,glow(0xffa040));
  }
  candlestick(-4,-12);
  candlestick(4,-12);

  /* Hanging chandeliers */
  for(let i=0;i<3;i++){
    const z = -6 + i*6;
    cyl(.02,2,0,H-.5,z,mat(0x3a3a3a));
    cyl(.5,.2,0,H-2.5,z,mat(0xc8a850));
    for(let j=0;j<8;j++){
      const a=j/8*Math.PI*2;
      cyl(.04,.1,Math.cos(a)*.4,H-2.6,z+Math.sin(a)*.4,glow(0xfff4d0));
    }
  }

  /* Entrance Door */
  box(3,4,.2,0,2,D/2-.15,woodM,{solid:true});
  box(3.4,.3,.3,0,4.1,D/2-.15,darkWood);
  box(.3,4.2,.3,-1.7,2.1,D/2-.15,darkWood);
  box(.3,4.2,.3,1.7,2.1,D/2-.15,darkWood);
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
    ceilingHeight: H,
    bounds: { minX: -ROOM.x, maxX: ROOM.x, minZ: -ROOM.z, maxZ: ROOM.z },
  };

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, __world, {
    scene, x: START.x, z: START.z, yaw: Math.PI + (START.yaw || 0), level: 0,
    onUse: (use) => { if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE"); },
  });

  /* weddings: planner → church → ceremony (core/wedding.js) */
  let wed = null;
  try { wed = Wedding.mountChurch({ scene, camera, ctl }); } catch (e) { console.warn("[wedding]", e); }

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "CHURCH",
    title: "HOUSE OF WORSHIP",
    subtitle: "",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: INTERACT",
    isInterior: true,
    sceneId: "church",
    update: (dt) => {
      let cut = false;
      try { cut = wed ? wed.tick(dt) : false; } catch (e) { console.warn("[wedding]", e); }
      if (!cut) ctl.update(dt);
    },
    dispose: () => { try { wed && wed.dispose(); } catch (e) {} ctl.dispose(); },
  };
}

