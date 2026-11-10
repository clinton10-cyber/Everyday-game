/* classroom/interior.js -- converted from the standalone prototype "class.html".
   World-building code is the prototype's own; the touch controls, loop and
   renderer were replaced by the game's ThirdPersonControls (player avatar,
   wardrobe, phone, weapons...). Collision boxes are converted below. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";

export async function buildInterior(router) {
  /* ======== prototype kit + world ======== */
  /* ================= SHARED KIT ================= */
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x0a0c10);
  scene.fog=new THREE.Fog(0x0a0c10,30,90);
  const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,200);
  camera.rotation.order='YXZ';
  scene.add(new THREE.HemisphereLight(0xdfe8ff,0x3a3a44,1.2));
  const L1=new THREE.DirectionalLight(0xffffff,1.0); L1.position.set(9,16,7); scene.add(L1);
  const L2=new THREE.DirectionalLight(0xbcd2ff,.45); L2.position.set(-9,8,-8); scene.add(L2);

  const BOXG=new THREE.BoxGeometry(1,1,1),
        CYLG=new THREE.CylinderGeometry(.5,.5,1,10),
        SPHG=new THREE.SphereGeometry(.5,10,8);
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
  const seats=[]; // FIXED: Added seats array
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
  function tex(w,h,draw,rx,ry){
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    draw(c.getContext('2d'),w,h);
    const t=new THREE.CanvasTexture(c);
    t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx||1,ry||1);
    t.colorSpace=THREE.SRGBColorSpace;
    return t;
  }

  /* ================= CLASSROOM ================= */
  const W=14,D=16,H=3.4,ROOM={x:W/2-.7,z:D/2-.7};
  const START={x:0,z:D/2-1.6,yaw:0};

  /* floor: wooden planks */
  const floorTex=tex(128,128,g=>{
    g.fillStyle='#a9764a'; g.fillRect(0,0,128,128);
    g.strokeStyle='#8a5f3a'; g.lineWidth=2;
    for(let i=0;i<6;i++){g.beginPath();g.moveTo(0,i*22);g.lineTo(128,i*22);g.stroke();}
    g.strokeStyle='#7a5232'; g.lineWidth=1;
    for(let i=0;i<20;i++){const x=Math.random()*128;g.beginPath();g.moveTo(x,0);g.lineTo(x+8,128);g.stroke();}
  },W/2,D/2);

  /* wall texture: painted plaster */
  const wallTex=tex(64,64,g=>{
    g.fillStyle='#e8dfc8'; g.fillRect(0,0,64,64);
    g.fillStyle='#e0d6bd';
    for(let i=0;i<200;i++){g.fillRect(Math.random()*64,Math.random()*64,2,2);}
  },4,2);

  const wallM=mat(0xffffff,{map:wallTex}), ceilM=mat(0xf2f2ec), floorM=mat(0xffffff,{map:floorTex});
  const wood=mat(0x8a5f3a), darkWood=mat(0x5a3f26), metal=mat(0x9aa4ad),
        white=mat(0xf7f9fa), dark=mat(0x2a3038), green=mat(0x2e5d3a),
        chalkM=mat(0x1c2b24), boardM=mat(0x1a2e24);

  /* shell */
  box(W,.2,D,0,-.1,0,floorM);
  box(W,.2,D,0,H+.1,0,ceilM);
  box(W,H,.2,0,H/2,-D/2,wallM,{solid:true});
  box(W,H,.2,0,H/2,D/2,wallM,{solid:true});
  box(.2,H,D,-W/2,H/2,0,wallM,{solid:true});
  box(.2,H,D,W/2,H/2,0,wallM,{solid:true});
  /* baseboards */
  box(W,.15,.07,0,.075,-D/2+.15,wood); box(W,.15,.07,0,.075,D/2-.15,wood);
  box(.07,.15,D,-W/2+.15,.075,0,wood); box(.07,.15,D,W/2-.15,.075,0,wood);

  /* ceiling lights */
  for(let i=0;i<3;i++) for(let j=0;j<3;j++)
    box(1.6,.08,.8,-4+i*4,H-.08,-5+j*5,glow(0xfffaf0));

  /* ===== CHALKBOARD (back wall) ===== */
  const bw=9, bh=2.2, bx=0, by=2.1, bz=-D/2+.12;
  box(bw+.3,bh+.3,.1,bx,by,bz,wood);
  box(bw,bh,.04,bx,by,bz+.06,boardM);
  /* chalk tray */
  box(bw,.08,.18,bx,by-bh/2-.06,bz+.12,wood);
  /* chalk pieces */
  box(.25,.03,.03,-2.0,by-bh/2+.01,bz+.12,white);
  box(.2,.03,.03,1.5,by-bh/2+.01,bz+.12,white);
  box(.15,.03,.03,2.2,by-bh/2+.01,bz+.12,mat(0xffe08a));
  /* chalk writing */
  box(3.0,.05,.01,-1.0,by+.6,bz+.09,mat(0xd8e8dc));
  box(2.2,.05,.01,1.5,by+.3,bz+.09,mat(0xd8e8dc));
  box(1.4,.05,.01,2.0,by-.1,bz+.09,mat(0xd8e8dc));

  /* ===== TEACHER DESK ===== */
  box(2.2,.1,1.0,0,1.0,-6.0,wood,{solid:true});
  box(2.0,.78,.9,0,.55,-6.0,mat(0x7a5232));
  box(1.9,.06,.8,0,1.06,-6.0,wood);
  box(.6,.3,.04,0,1.3,-6.4,glow(0xe8f0ff));
  box(.5,.35,.5,0,1.2,-6.0,white);
  box(.35,.25,.04,0,1.45,-6.0,glow(0x9fd0ff));
  uses.push({ kind: "work", label: "TEACHER DESK", x: 0, z: -6.0, y: 0, level: 0, r: 1.5 });
  uses.push({ kind: "read", label: "READ CHALKBOARD", x: bx, z: bz + 0.5, y: 0, level: 0, r: 1.5 });

  /* ===== STUDENT DESKS (3 rows × 4 cols) ===== */
  function desk(x,z){
    /* desktop */
    box(1.3,.07,.65,x,.78,z,wood,{solid:true});
    /* legs */
    [[-.55,-.25],[.55,-.25],[-.55,.25],[.55,.25]].forEach(p=>
      box(.06,.72,.06,x+p[0],.36,z+p[1],metal));
    /* chair */
    box(.5,.07,.45,x,.46,z+.62,mat(0x5a7a9a));
    box(.5,.45,.06,x,.7,z+.82,mat(0x5a7a9a));
    [[-.18,.55],[.18,.55]].forEach(p=>
      box(.04,.42,.04,x+p[0],.24,z+.62,metal));
    /* FIXED: Added seat interactable for student desks */
    seats.push({ type: "sit", label: "SIT", x: x, z: z + 0.85, yaw: Math.PI, h: 0.55, level: 0, taken: false });
    
    /* books on desk */
    box(.3,.05,.22,x-.2,.83,z,mat(0xc44a3a));
    box(.28,.04,.2,x-.22,.88,z,mat(0x3a6ac4));
    box(.2,.18,.03,x+.3,.9,z,glow(0xf0f0f0));
  }
  for(let row=0;row<3;row++){
    for(let col=0;col<4;col++){
      desk(-4.5+col*3.0, -1.5+row*3.2);
    }
  }

  /* ===== BOOKSHELVES (left wall) ===== */
  for(let b=0;b<2;b++){
    const bx2=-W/2+.35, bz2=-4+b*4.5, bh2=2.6, bw2=.7;
    box(bw2,bh2,.9,bx2,bh2/2,bz2,wood,{solid:true});
    for(let s=0;s<5;s++){
      const sy=.3+s*.5;
      box(bw2-.1,.04,.8,bx2,sy,bz2,darkWood);
      /* books */
      for(let k=0;k<4;k++){
        const h=.28+Math.random()*.12;
        const c=[0xc44a3a,0x3a6ac4,0x4a9a5a,0xd4a03a,0x8a5ac4][(s+k)%5];
        box(.08,h,.5,bx2-.2+k*.13,sy+.02+h/2,bz2,mat(c));
      }
    }
  }

  /* ===== WINDOW (right wall) ===== */
  box(.06,2.6,5.5,W/2-.12,1.9,0,glow(0xbfe0f5));
  box(.16,2.8,.12,W/2-.1,1.9,-2.8,wood);
  box(.16,2.8,.12,W/2-.1,1.9,2.8,wood);
  box(.16,.12,5.6,W/2-.1,3.3,0,wood);
  box(.16,.12,5.6,W/2-.1,.5,0,wood);
  box(.14,2.7,.08,W/2-.14,1.9,0,wood);
  /* sill */
  box(.3,.08,5.6,W/2-.25,.54,0,mat(0xd8d0c0));

  /* ===== CLOCK (front wall above door) ===== */
  cyl(.28,.06,4.5,2.8,D/2-.16,white,{rx:Math.PI/2});
  box(.03,.2,.04,4.5,2.87,D/2-.21,dark);
  box(.16,.03,.04,4.58,2.8,D/2-.21,dark);

  /* ===== DOOR (front wall) ===== */
  box(1.6,2.4,.12,-4.5,1.2,D/2-.14,mat(0x6a4a2a),{solid:true});
  box(1.8,.15,.18,-4.5,2.5,D/2-.14,wood);
  box(.06,.7,.06,-3.8,1.2,D/2-.22,metal);
  box(.5,.3,.03,-4.5,1.8,D/2-.22,glow(0xdff0fa));

  /* ===== BULLETIN BOARD (right of chalkboard) ===== */
  box(2.0,1.4,.06,4.5,2.0,-D/2+.11,mat(0x8a6a4a));
  box(1.8,1.2,.02,4.5,2.0,-D/2+.13,mat(0x3a5a7a));
  box(.5,.4,.02,4.1,2.2,-D/2+.14,mat(0xe8e0c8));
  box(.4,.3,.02,4.8,1.9,-D/2+.14,mat(0xe8c8a8));
  box(.35,.25,.02,4.3,1.7,-D/2+.14,mat(0xc8e0c8));

  /* ===== TRASH BIN ===== */
  cyl(.22,.55,-5.5,.27,5.5,metal,{solid:true});
  cyl(.24,.04,-5.5,.55,5.5,dark);

  /* ===== GLOBE on teacher desk ===== */
  cyl(.03,.25,1.0,1.15,-6.1,metal);
  sph(.22,1.0,1.45,-6.1,mat(0x3a6ac4));
  cyl(.22,.02,1.0,1.46,-6.1,mat(0x4a9a5a));

  /* ===== PLANT in corner ===== */
  cyl(.28,.4,5.6,.2,5.6,mat(0xb07040),{solid:true});
  sph(.35,5.6,.85,5.6,mat(0x3a7a3a));
  sph(.25,5.4,1.1,5.5,mat(0x4a8a4a));
  sph(.2,5.8,1.15,5.7,mat(0x2e6a2e));
  /* ======== game glue ======== */
  camera.fov = 95; camera.updateProjectionMatrix();
  const __cols = [];
  for (const b of solid) {
    const mk = (level) => ({ minX: b.x - b.hw, maxX: b.x + b.hw, minZ: b.z - b.hd, maxZ: b.z + b.hd, y0: 0, y1: 60, level });
    __cols.push(mk(0));
  }
  const __world = {
    colliders: __cols, seats: seats, uses: uses, // FIXED: Passed seats array
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
    crumb: "CLASSROOM",
    title: "PRIMARY SCHOOL",
    subtitle: "",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: INTERACT",
    isInterior: true,
    sceneId: "classroom",
    update: (dt) => {
      ctl.update(dt);
    },
    dispose: () => ctl.dispose(),
  };
}
