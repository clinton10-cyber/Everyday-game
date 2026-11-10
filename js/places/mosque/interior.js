/* mosque/interior.js -- converted from the standalone prototype "mosque.html".
   World-building code is the prototype's own; the touch controls, loop and
   renderer were replaced by the game's ThirdPersonControls (player avatar,
   wardrobe, phone, weapons...). Collision boxes are converted below. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";

export async function buildInterior(router) {
  /* ======== prototype kit + world ======== */
  /* ================= SHARED KIT ================= */
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x1a1c22);
  scene.fog=new THREE.Fog(0x1a1c22,15,50);
  const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,100);

  /* Lighting */
  scene.add(new THREE.HemisphereLight(0xfff8e8,0x2a2a34,0.9));
  const sun=new THREE.DirectionalLight(0xfff0d0,1.0);
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

  const mihrabLight = new THREE.PointLight(0xffe0a0, 1.5, 15);
  mihrabLight.position.set(0, 3, -11);
  scene.add(mihrabLight);

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
  const marbleTex = tex(128,128,g=>{
    g.fillStyle='#f0ece4'; g.fillRect(0,0,128,128);
    g.strokeStyle='#d8d0c4'; g.lineWidth=2;
    for(let i=0;i<10;i++){
      g.beginPath(); g.moveTo(Math.random()*128,0); g.lineTo(Math.random()*128,128); g.stroke();
      g.beginPath(); g.moveTo(0,Math.random()*128); g.lineTo(128,Math.random()*128); g.stroke();
    }
  }, 6, 8);

  const carpetTex = tex(128,128,g=>{
    // Prayer rug pattern
    g.fillStyle='#1a4a3a'; g.fillRect(0,0,128,128); // Deep green
    g.strokeStyle='#c8a850'; g.lineWidth=4; // Gold border
    g.strokeRect(8,8,112,112);
    g.fillStyle='#c8a850';
    g.beginPath(); g.arc(64,64,30,0,Math.PI*2); g.fill(); // Central medallion
    g.fillStyle='#1a4a3a';
    g.beginPath(); g.arc(64,64,20,0,Math.PI*2); g.fill();
    g.strokeStyle='#c8a850'; g.lineWidth=2;
    g.beginPath(); g.moveTo(64,34); g.lineTo(64,94); g.stroke();
    g.beginPath(); g.moveTo(34,64); g.lineTo(94,64); g.stroke();
  }, 4, 6);

  const wallTex = tex(128,128,g=>{
    g.fillStyle='#f4f0e8'; g.fillRect(0,0,128,128);
    g.fillStyle='#e8e0d0';
    for(let y=0;y<128;y+=32){
      for(let x=0;x<128;x+=32){
        g.fillRect(x,y,28,28);
      }
    }
  }, 4, 6);

  const floorM = mat(0xffffff,{map:marbleTex});
  const wallM = mat(0xffffff,{map:wallTex});
  const carpetM = mat(0xffffff,{map:carpetTex});
  const ceilM = mat(0xf0ece4);
  const woodM = mat(0x5a3f26);
  const goldM = mat(0xc8a850);
  const darkWood = mat(0x3a2a1a);
  const greenM = mat(0x1a4a3a);

  /* ================= MOSQUE BUILD ================= */
  const W=18, D=32, H=8;
  const ROOM={x:W/2-0.5, z:D/2-0.5};
  const START={x:0, z:13, yaw:0};

  /* Shell */
  box(W,.2,D,0,-.1,0,floorM);
  box(W,.2,D,0,H+.1,0,ceilM);
  box(W,H,.3,0,H/2,-D/2,wallM,{solid:true});
  box(W,H,.3,0,H/2,D/2,wallM,{solid:true});
  box(.3,H,D,-W/2,H/2,0,wallM,{solid:true});
  box(.3,H,D,W/2,H/2,0,wallM,{solid:true});

  /* Carpet */
  box(16,.04,28,0,.02,-2,carpetM);

  /* ===== MIHRAB (Prayer Niche) ===== */
  // Indentation in the back wall
  box(4,5,.5,0,2.5,-D/2+.2,mat(0xd8d0c0));
  box(3.6,4.6,.6,0,2.3,-D/2+.3,mat(0x1a4a3a)); // Darker inside
  // Arch shape
  box(2,.5,.6,0,4.2,-D/2+.3,goldM);
  box(.5,3,.6,-1.5,2.5,-D/2+.3,goldM);
  box(.5,3,.6,1.5,2.5,-D/2+.3,goldM);
  // Calligraphy detail
  box(1.5,.8,.1,0,3.5,-D/2+.25,glow(0xfff4d0));
  box(.8,.2,.1,0,4.0,-D/2+.25,glow(0xfff4d0));
  uses.push({ kind: "pray", label: "PRAY AT MIHRAB", x: 0, z: -D/2+1.3, y: 0, level: 0, r: 2.0 });

  /* Prayer rows on the carpet */
  for(let row=0;row<4;row++){
    for(let col=-3;col<=3;col++){
      seats.push({ type: "kneel", label: "PRAY (KNEEL)",
                   x: col*1.6, z: -8+row*2.2, yaw: Math.PI, h: 0.25, level: 0, taken: false });
    }
  }

  /* ===== MINBAR (Pulpit) ===== */
  box(2,1.5,2,4,0.75,-10,woodM,{solid:true});
  box(2.2,.1,2.2,4,1.5,-10,darkWood);
  for(let i=0;i<3;i++){
    box(1.8,.4,.4,4,.4+i*.4,-9+i*0.4,woodM); // Steps
  }
  box(1.8,1.5,.4,4,1.5,-8.4,woodM); // Backrest
  seats.push({ type: "sit", label: "SIT ON MINBAR STEPS",
               x: 4, z: -8.2, yaw: Math.PI, h: 0.5, level: 0, taken: false });

  /* ===== COLUMNS ===== */
  function column(x,z){
    cyl(.8,H,x,H/2,z,mat(0xe8e0d0),{solid:true});
    cyl(.9,.3,x,H-.15,z,goldM);
    cyl(.9,.3,x,.15,z,goldM);
    cyl(.85,.1,x,H/2,z,goldM); // Mid-band
  }
  column(-6,-6); column(6,-6);
  column(-6,2); column(6,2);
  column(-6,10); column(6,10);

  /* ===== CHANDELIERS ===== */
  for(let i=0;i<3;i++){
    const z = -6 + i*8;
    cyl(.05,3,0,H-.5,z,goldM);
    cyl(.8,.3,0,H-3.5,z,goldM);
    for(let j=0;j<12;j++){
      const a=j/12*Math.PI*2;
      cyl(.06,.2,Math.cos(a)*.7,H-3.8,z+Math.sin(a)*.7,glow(0xfff4d0));
    }
    sph(.2,0,H-4,z,glow(0xfff4d0));
  }

  /* ===== ENTRANCE ===== */
  box(4,5,.2,0,2.5,D/2-.15,woodM,{solid:true});
  box(4.4,.3,.3,0,5.1,D/2-.15,goldM);
  box(.3,5.2,.3,-2.2,2.6,D/2-.15,goldM);
  box(.3,5.2,.3,2.2,2.6,D/2-.15,goldM);
  // Decorative arch over door
  box(4.5,.8,.2,0,4.8,D/2-.15,goldM);

  /* ===== DECOR ===== */
  // Wall lanterns
  function lantern(x,y,z){
    box(.3,.5,.3,x,y,z,glow(0xfff4d0));
    box(.4,.1,.4,x,y+.3,z,goldM);
    box(.4,.1,.4,x,y-.3,z,goldM);
  }
  for(let i=0;i<4;i++){
    lantern(-8.5, 3, -10+i*6);
    lantern(8.5, 3, -10+i*6);
  }

  // Bookshelf for Qurans
  box(3,2,.5,-8,1,-14,woodM,{solid:true});
  for(let i=0;i<3;i++){
    box(2.8,.05,.4,-8,.4+i*.6,-14,darkWood);
    // Books
    for(let j=0;j<4;j++){
      box(.4,.4,.3,-9+j*.5,.65+i*.6,-14,mat([0x1a4a3a,0x8a1a1a,0x3a2a1a,0x1a2a3a][j]));
    }
  }
  box(3,2,.5,8,1,-14,woodM,{solid:true});
  for(let i=0;i<3;i++){
    box(2.8,.05,.4,8,.4+i*.6,-14,darkWood);
    for(let j=0;j<4;j++){
      box(.4,.4,.3,7+j*.5,.65+i*.6,-14,mat([0x1a4a3a,0x8a1a1a,0x3a2a1a,0x1a2a3a][j]));
    }
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
    crumb: "CENTRAL MOSQUE",
    title: "PRAYER HALL",
    subtitle: "",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: INTERACT",
    isInterior: true,
    sceneId: "mosque",
    update: (dt) => {
      ctl.update(dt);
    },
    dispose: () => ctl.dispose(),
  };
}

