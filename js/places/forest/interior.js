/* forest/interior.js -- converted from the standalone prototype "forest.html".
   World-building code is the prototype's own; the touch controls, loop and
   renderer were replaced by the game's ThirdPersonControls (player avatar,
   wardrobe, phone, weapons...). Collision boxes are converted below. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";

export async function buildInterior(router) {
  /* ======== prototype kit + world ======== */
  /* ================= SHARED KIT ================= */
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x8fb8d8);
  scene.fog=new THREE.Fog(0x8fb8d8,25,110);
  const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,300);
  camera.rotation.order='YXZ';

  /* lighting */
  scene.add(new THREE.HemisphereLight(0xcfe8ff,0x2a3a1a,1.0));
  const sun=new THREE.DirectionalLight(0xfff4d6,1.1);
  sun.position.set(30,50,20); scene.add(sun);
  const fill=new THREE.DirectionalLight(0xa8c8e8,.35);
  fill.position.set(-20,20,-20); scene.add(fill);

  const BOXG=new THREE.BoxGeometry(1,1,1),
        CYLG=new THREE.CylinderGeometry(.5,.5,1,8),
        SPHG=new THREE.SphereGeometry(.5,8,6),
        CONEG=new THREE.ConeGeometry(.5,1,7);
  const MC=new Map();
  function mat(c,o){
    if(o&&o.map) return new THREE.MeshLambertMaterial(Object.assign({color:c},o));
    const k=c+'|'+JSON.stringify(o||0); let m=MC.get(k);
    if(!m){m=new THREE.MeshLambertMaterial(Object.assign({color:c},o||{}));MC.set(k,m);}
    return m;
  }
  const glow=c=>new THREE.MeshBasicMaterial({color:c});
  const world=new THREE.Group(); scene.add(world);
  const solid=[];
  const seats=[];
  const uses=[];
  function box(w,h,d,x,y,z,m,o){
    o=o||{};
    const s=new THREE.Mesh(BOXG,typeof m==='number'?mat(m):m);
    s.scale.set(w,h,d); s.position.set(x,y,z); s.rotation.set(o.rx||0,o.ry||0,o.rz||0);
    world.add(s);
    if(o.solid){const c=Math.abs(Math.cos(o.ry||0)),n=Math.abs(Math.sin(o.ry||0));
      solid.push({x,z,hw:(c*w+n*d)/2,hd:(n*w+c*d)/2});}
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

  /* ================= FOREST ================= */
  const WORLD_R=55, ROOM={x:WORLD_R,z:WORLD_R};
  const START={x:0,z:12,yaw:0};

  /* --- ground --- */
  const groundTex=tex(128,128,g=>{
    g.fillStyle='#4a7a3a'; g.fillRect(0,0,128,128);
    g.fillStyle='#3a6a2a';
    for(let i=0;i<300;i++){g.fillRect(Math.random()*128,Math.random()*128,3,3);}
    g.fillStyle='#5a8a4a';
    for(let i=0;i<200;i++){g.fillRect(Math.random()*128,Math.random()*128,2,2);}
    g.strokeStyle='#3a5a2a'; g.lineWidth=1;
    for(let i=0;i<20;i++){
      g.beginPath(); g.moveTo(Math.random()*128,Math.random()*128);
      g.lineTo(Math.random()*128,Math.random()*128); g.stroke();
    }
  },WORLD_R/2,WORLD_R/2);
  const ground=box(2*WORLD_R,.2,2*WORLD_R,0,-.1,0,mat(0xffffff,{map:groundTex}));

  /* path texture */
  const pathTex=tex(64,256,g=>{
    g.fillStyle='#8a7a5a'; g.fillRect(0,0,64,256);
    g.fillStyle='#7a6a4a';
    for(let i=0;i<100;i++){g.fillRect(Math.random()*64,Math.random()*256,4,4);}
    g.fillStyle='#9a8a6a';
    for(let i=0;i<80;i++){g.fillRect(Math.random()*64,Math.random()*256,3,3);}
  },1,8);

  /* --- trees (low-poly, instanced-ish) --- */
  const treePositions=[];
  function tree(x,z,scale){
    scale=scale||1;
    const trunkH=2.2*scale, trunkR=.22*scale;
    /* trunk */
    cyl(trunkR,trunkH,x,trunkH/2,z,mat(0x5a3f26),{solid:true});
    /* foliage layers */
    const g1=mat(0x2a5a2a), g2=mat(0x3a6a3a), g3=mat(0x4a7a4a);
    cone(1.6*scale,2.0*scale,x,trunkH+.8*scale,z,g1);
    cone(1.3*scale,1.8*scale,x,trunkH+1.6*scale,z,g2);
    cone(.9*scale,1.6*scale,x,trunkH+2.3*scale,z,g3);
    treePositions.push({x,z});
  }
  /* place trees in a ring, avoiding the center clearing */
  for(let i=0;i<70;i++){
    const ang=Math.random()*Math.PI*2;
    const dist=12+Math.random()*(WORLD_R-14);
    const x=Math.cos(ang)*dist, z=Math.sin(ang)*dist;
    if(Math.hypot(x,z)<10) continue;
    tree(x,z,.7+Math.random()*.7);
  }

  /* --- bushes --- */
  function bush(x,z,s){
    s=s||1;
    sph(.6*s,x,.35*s,z,mat(0x3a6a3a));
    sph(.45*s,x+.5*s,.3*s,z+.2*s,mat(0x2e5e2e));
    sph(.4*s,x-.4*s,.28*s,z-.2*s,mat(0x4a7a4a));
  }
  for(let i=0;i<40;i++){
    const ang=Math.random()*Math.PI*2;
    const dist=8+Math.random()*(WORLD_R-10);
    bush(Math.cos(ang)*dist,Math.sin(ang)*dist,.7+Math.random()*.6);
  }

  /* --- rocks --- */
  function rock(x,z,s){
    s=s||1;
    const r=new THREE.Mesh(SPHG,mat(0x7a7a72));
    r.scale.set(1.2*s,.7*s,1.0*s); r.position.set(x,.25*s,z);
    r.rotation.y=Math.random()*Math.PI; world.add(r);
    solid.push({x,z,hw:.5*s,hd:.5*s});
  }
  for(let i=0;i<25;i++){
    const ang=Math.random()*Math.PI*2;
    const dist=9+Math.random()*(WORLD_R-12);
    rock(Math.cos(ang)*dist,Math.sin(ang)*dist,.5+Math.random()*.8);
  }

  /* --- flowers --- */
  const flowerColors=[0xff6a8a,0xffd04a,0xa06aff,0xff8a4a,0xffffff];
  for(let i=0;i<60;i++){
    const ang=Math.random()*Math.PI*2;
    const dist=6+Math.random()*(WORLD_R-8);
    const x=Math.cos(ang)*dist, z=Math.sin(ang)*dist;
    cyl(.015,.2,x,.1,z,mat(0x3a6a2a));
    sph(.06,x,.22,z,glow(flowerColors[i%flowerColors.length]));
  }

  /* --- fallen log --- */
  box(.6,.5,3.5,-8,.25,-5,mat(0x6a4a2a),{solid:true,ry:.4});
  cyl(.25,.6,-9.2,.25,-4.8,mat(0x5a3f26));
  seats.push({ type:"sit", label:"SIT ON LOG", x:-8, z:-5, yaw:.4+Math.PI/2, h:0.50, level:0, taken:false });

  /* --- stumps --- */
  for(let i=0;i<6;i++){
    const ang=Math.random()*Math.PI*2, dist=10+Math.random()*30;
    const x=Math.cos(ang)*dist, z=Math.sin(ang)*dist;
    cyl(.45,.5,x,.25,z,mat(0x6a4a2a),{solid:true});
    cyl(.48,.04,x,.52,z,mat(0x8a6a4a));
    seats.push({ type:"sit", label:"SIT ON STUMP", x, z, yaw:0, h:0.54, level:0, taken:false });
  }

  /* --- clearing marker: campfire ring --- */
  for(let i=0;i<10;i++){
    const a=i/10*Math.PI*2;
    const x=Math.cos(a)*1.6, z=Math.sin(a)*1.6;
    box(.35,.25,.35,x,.12,z,mat(0x7a7a72),{ry:a});
  }
  box(.4,.1,1.2,0,.08,0,mat(0x5a3f26),{ry:.3});
  box(.4,.1,1.2,0,.12,.1,mat(0x4a2f16),{ry:-.5});
  /* small flame glow */
  sph(.25,0,.35,0,glow(0xffa040));
  sph(.15,0,.55,0,glow(0xffd060));
  uses.push({ kind:"use", label:"WARM AT CAMPFIRE", x:0, z:2.0, y:0, level:0, r:2.0 });

  /* --- distant mountains (background, non-collidable) --- */
  for(let i=0;i<8;i++){
    const ang=i/8*Math.PI*2+.3;
    const dist=WORLD_R-5;
    const x=Math.cos(ang)*dist, z=Math.sin(ang)*dist;
    cone(6+Math.random()*3, 8+Math.random()*4, x, 3, z, mat(0x5a6a7a,{transparent:true,opacity:.6}));
  }

  /* --- grass tufts --- */
  for(let i=0;i<100;i++){
    const ang=Math.random()*Math.PI*2;
    const dist=4+Math.random()*(WORLD_R-6);
    const x=Math.cos(ang)*dist, z=Math.sin(ang)*dist;
    cone(.06,.35,x,.17,z,mat(0x4a7a3a));
    cone(.05,.3,x+.1,.15,z+.05,mat(0x3a6a2a));
  }

  uses.push({ kind:"use", label:"LOOK AROUND FOREST", x:0, z:0, y:0, level:0, r:2.0 });

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

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "FOREST TRAIL",
    title: "CAMPFIRE CLEARING",
    subtitle: "",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: INTERACT",
    isInterior: true,
    sceneId: "forest",
    update: (dt) => {
      ctl.update(dt);
    },
    dispose: () => ctl.dispose(),
  };
}
