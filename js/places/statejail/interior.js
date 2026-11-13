/* statejail/interior.js -- converted from the standalone prototype "prison.html".
   World-building code is the prototype's own; the touch controls, loop and
   renderer were replaced by the game's ThirdPersonControls (player avatar,
   wardrobe, phone, weapons...). Collision boxes are converted below. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";

export async function buildInterior(router) {
  /* ======== prototype kit + world ======== */
  /* ================= KIT ================= */
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x0a0c10);
  scene.fog=new THREE.Fog(0x0a0c10,55,150);
  const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,300);
  camera.rotation.order='YXZ';

  scene.add(new THREE.HemisphereLight(0xdfe8f5,0x2a2a30,1.0));
  const sun=new THREE.DirectionalLight(0xffffff,1.0);
  sun.position.set(20,45,18); scene.add(sun);
  const fill=new THREE.DirectionalLight(0xa8c0e0,.45);
  fill.position.set(-20,22,-18); scene.add(fill);

  const BOXG=new THREE.BoxGeometry(1,1,1),
        CYLG=new THREE.CylinderGeometry(.5,.5,1,10),
        SPHG=new THREE.SphereGeometry(.5,8,6);
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
    if(o.solid){
      const c=Math.abs(Math.cos(o.ry||0)),n=Math.abs(Math.sin(o.ry||0));
      solid.push({x,z,hw:(c*w+n*d)/2,hd:(n*w+c*d)/2,ground:o.ground,up:o.up});
    }
    return s;
  }
  function cyl(r,h,x,y,z,m,o){
    o=o||{};
    const s=new THREE.Mesh(CYLG,typeof m==='number'?mat(m):m);
    s.scale.set(r*2,h,r*2); s.position.set(x,y,z); s.rotation.set(o.rx||0,o.ry||0,o.rz||0);
    world.add(s);
    if(o.solid) solid.push({x,z,hw:r,hd:r,ground:o.ground,up:o.up});
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

  /* ================= PRISON ================= */
  const W=22, D=30, H=4.2, H2=8.4;
  const ROOM={x:W/2-.9, z:D/2-.9};
  const START={x:0, z:13.2, yaw:0};

  /* --- textures --- */
  const concreteTex=tex(128,128,g=>{
    g.fillStyle='#8e9095'; g.fillRect(0,0,128,128);
    g.fillStyle='#84868b';
    for(let i=0;i<220;i++){g.fillRect(Math.random()*128,Math.random()*128,3,3);}
    g.fillStyle='#9a9ca0';
    for(let i=0;i<120;i++){g.fillRect(Math.random()*128,Math.random()*128,2,2);}
    g.strokeStyle='#7a7c81'; g.lineWidth=2;
    g.strokeRect(1,1,126,126);
  },9,12);

  const tileTex=tex(64,64,g=>{
    g.fillStyle='#b8bcc0'; g.fillRect(0,0,64,64);
    g.strokeStyle='#9a9ea2'; g.lineWidth=2;
    g.strokeRect(1,1,62,62);
  },10,13);

  const concreteM=mat(0xffffff,{map:concreteTex});
  const tileM=mat(0xffffff,{map:tileTex});
  const wallM=mat(0xa8aaa8), cellWallM=mat(0xb8bab8), ceilM=mat(0xc0c2c0),
        barM=mat(0x6a6e74), steel=mat(0x8a8e94), dark=mat(0x2a2c30),
        blackM=mat(0x101214), white=mat(0xd8dade), cream=mat(0xc8c4b8),
        concreteWall=mat(0x9a9c9a), orange=mat(0xc86a20),
        benchM=mat(0x70747a), glassM=mat(0xcfe4ee,{transparent:true,opacity:.22}),
        woodM=mat(0x7a5a3a);

  /* ===== FLOOR & CEILING ===== */
  box(W,.2,D,0,-.1,0,concreteM);
  box(W,.2,D,0,H2+.1,0,ceilM);

  /* outer walls */
  box(W,H2,.3,0,H2/2,-D/2,wallM,{solid:true});
  /* Front elevation: retain the upper-storey wall, but leave a real
     ground-floor secure entrance instead of sealing the entire facade. */
  const ENTRY_W = 3.2, ENTRY_H = 3.1;
  box((W-ENTRY_W)/2,ENTRY_H,.3,-(W+ENTRY_W)/4,ENTRY_H/2,D/2,wallM,{solid:true});
  box((W-ENTRY_W)/2,ENTRY_H,.3, (W+ENTRY_W)/4,ENTRY_H/2,D/2,wallM,{solid:true});
  box(W,H2-ENTRY_H,.3,0,ENTRY_H+(H2-ENTRY_H)/2,D/2,wallM,{solid:true,up:true});
  /* reinforced entrance jambs and overhead security beam */
  box(.22,ENTRY_H,.42,-ENTRY_W/2,ENTRY_H/2,D/2,steel,{solid:true});
  box(.22,ENTRY_H,.42, ENTRY_W/2,ENTRY_H/2,D/2,steel,{solid:true});
  box(ENTRY_W,.18,.42,0,ENTRY_H-.09,D/2,steel);
  box(.3,H2,D,-W/2,H2/2,0,wallM,{solid:true});
  box(.3,H2,D,W/2,H2/2,0,wallM,{solid:true});

  /* ===== ZONE FLOOR STRIPES ===== */
  /* front processing zone — tiled */
  box(W,.04,7,0,.02,11.5,tileM);
  /* rear mess hall — tiled */
  box(W,.04,6,0,.02,-12,tileM);
  /* painted line at cell block boundary */
  box(W,.05,.12,0,.03,8,mat(0xd8b020));
  box(W,.05,.12,0,.03,-9,mat(0xd8b020));

  /* ================= UPPER FLOOR SLABS ================= */
  const slabM=concreteM;
  /* cell floors (left & right) */
  box(3,.25,14.4,-9.5,H-.125,0,slabM);
  box(3,.25,14.4, 9.5,H-.125,0,slabM);
  /* left catwalk x -8..-4.2, z -9..8 */
  box(3.8,.25,17,-6.1,H-.125,-0.5,slabM);
  /* right catwalk x 4.2..8, z -9..0 */
  box(3.8,.25,9, 6.1,H-.125,-4.5,slabM);
  /* back bridge x -4.2..4.2, z -9..-6.5 */
  box(8.4,.25,2.5,0,H-.125,-7.75,slabM);

  /* slab edge trims */
  box(3.8,.12,.12,-6.1,H-.06,8,steel);
  box(3.8,.12,.12, 6.1,H-.06,0,steel);
  box(8.4,.12,.12,0,H-.06,-6.5,steel);
  box(.12,.12,17,-4.2,H-.06,-0.5,steel);
  box(.12,.12,9, 4.2,H-.06,-4.5,steel);

  /* ================= CELL COLUMNS ================= */
  function cellColumn(xFront, dir, zc, open){
    const xc = xFront + dir*1.5;
    const zA = zc-1.6, zB = zc+1.6;

    /* side walls (full height) */
    /* These partitions span both storeys, so they must collide on both levels. */
    box(3,H2,.16,xc,H2/2,zA,cellWallM,{solid:true});
    box(3,H2,.16,xc,H2/2,zB,cellWallM,{solid:true});
    /* back is the outer wall */

    /* horizontal bar rails */
    box(.12,.12,3.2,xFront,.35,zc,barM);
    box(.12,.12,3.2,xFront,H,zc,barM);
    box(.12,.12,3.2,xFront,H2-.35,zc,barM);
    /* vertical bars */
    const nB=10, span=2.9;
    for(let i=0;i<nB;i++){
      const bz = zA+0.15 + i*span/(nB-1);
      if(open && bz>zc-1.0 && bz<zc-0.2) continue;
      box(.07,H2-.7,.07,xFront,(H2-.7)/2+.35,bz,barM);
    }
    /* door frame */
    box(.18,H2-.4,.18,xFront,(H2-.4)/2+.2,open?zc-1.05:zA+.1,steel);
    box(.18,H2-.4,.18,xFront,(H2-.4)/2+.2,zB-.1,steel);
    if(open){
      box(.18,H2-.4,.18,xFront,(H2-.4)/2+.2,zc-0.2,steel);
      box(.18,.18,1.0,xFront,H2-.4,zc-0.6,steel);
    }

    /* collision at the barred front */
    if(open){
      solid.push({x:xFront,z:(zA+zc-1.05)/2,hw:.12,hd:(zc-1.05-zA)/2});
      solid.push({x:xFront,z:(zc-0.2+zB)/2,hw:.12,hd:(zB-(zc-0.2))/2});
    } else {
      solid.push({x:xFront,z:zc,hw:.12,hd:1.6});
    }

    /* ---- cell interior furniture, both levels ---- */
    function furnish(yb){
      const bx = xc - dir*0.55;
      /* bunk bed frame */
      box(1.0,.12,1.9,bx,yb+.55,zc-.45,steel,{solid:true});
      box(.95,.22,1.85,bx,yb+.72,zc-.45,mat(0x5a6070));
      box(.5,.14,.3,bx,yb+.9,zc-1.1,white);
      /* blanket */
      box(.95,.06,1.1,bx,yb+.82,zc-.05,orange);
      /* legs */
      [[-.45,-.85],[.45,-.85],[-.45,.35],[.45,.35]].forEach(p=>
        box(.07,.55,.07,bx+p[0],yb+.28,zc-.45+p[1],steel));
      const lvl = yb>0 ? 1 : 0;
      seats.push({ type: "lie", label: "LIE DOWN", x: bx, z: zc-.45, yaw: 0, h: 0.72+yb, level: lvl, taken: false });
      /* toilet */
      cyl(.24,.42,xc+dir*1.05,yb+.21,zc+1.1,white);
      box(.5,.28,.18,xc+dir*1.15,yb+.42,zc+1.28,white);
      seats.push({ type: "toilet", label: "USE TOILET", x: xc+dir*1.05, z: zc+1.1, yaw: 0, h: 0.42+yb, level: lvl, taken: false });
      /* sink */
      box(.55,.1,.35,xc+dir*1.1,yb+.85,zc+0.35,white);
      cyl(.045,.28,xc+dir*1.1,yb+1.0,zc+0.2,steel);
      uses.push({ kind: "sink", label: "WASH", x: xc+dir*1.1, z: zc+0.35, y: yb, level: lvl, r: 1.2 });
      /* stool */
      box(.38,.06,.38,xc-dir*0.2,yb+.45,zc+0.9,woodM);
      seats.push({ type: "sit", label: "SIT", x: xc-dir*0.2, z: zc+0.9, yaw: 0, h: 0.45+yb, level: lvl, taken: false });
      /* wall scratch / notice */
      box(.5,.35,.03,xc+dir*1.44,yb+1.9,zc-.2,mat(0xd8d4c8));
    }
    furnish(0);
    furnish(H);
  }

  /* left cells (front face x=-8) */
  [-5.4,-1.8,1.8,5.4].forEach((zc,i)=>{
    cellColumn(-8,-1,zc, i===2);   /* cell at z=1.8 is open */
  });
  /* right cells (front face x=8) */
  [-5.4,-1.8,1.8,5.4].forEach(zc=>{
    cellColumn(8, 1, zc, false);
  });

  /* cell numbers over doors */
  function number(x,y,z,ry){
    box(.5,.26,.03,x,y,z,mat(0x2a2c30),{ry});
    box(.34,.16,.02,x,y,z+.02,glow(0xd8d4c8),{ry});
  }
  [-5.4,-1.8,1.8,5.4].forEach((zc,i)=>{
    number(-7.9,3.55,zc,0);
    number(7.9,3.55,zc,0);
    number(-7.9,H+3.55,zc,0);
    number(7.9,H+3.55,zc,0);
  });

  /* ================= STAIRCASE (x 4.2..8, z 0..8) ================= */
  const SX1=4.2, SX2=8.0, SZB=8.0, SZT=0.0, NST=14;
  const stepH=H/NST, stepD=(SZB-SZT)/NST;
  for(let i=0;i<NST;i++){
    const z=SZB - i*stepD - stepD/2;
    const y=stepH*(i+.5);
    /* tread */
    box(SX2-SX1, stepH, stepD*.96, (SX1+SX2)/2, y, z, concreteM);
    /* anti-slip nosing */
    box(SX2-SX1-.05, .03, .07, (SX1+SX2)/2, y+stepH/2+.01, z-stepD*.44, mat(0xd8b020));
    /* solid stringer wall on the atrium side — blocks both levels */
    const sh=stepH*(i+1);
    box(.18, sh, stepD*.98, SX1, sh/2, z, concreteWall, {solid:true});
    /* steel handrail on the stringer */
    box(.07,.07,stepD*.98, SX1, sh+.02, z, steel);
  }

  /* ================= PARAPETS / RAILINGS (upper only) ================= */
  function parapet(w,d,x,z){
    box(w,1.05,d,x,H+.52,z,concreteWall,{solid:true,up:true});
    box(w+.06,.1,d+.06,x,H+1.09,z,steel,{up:true});
  }
  /* left catwalk inner edge */
  parapet(.16,14.5,-4.2,0.75);
  /* right catwalk inner edge (z -6.5..0) */
  parapet(.16,6.5, 4.2,-3.25);
  /* back bridge front edge */
  parapet(8.4,.16, 0,-6.5);
  /* left catwalk front edge at z=8 */
  parapet(3.8,.16,-6.1,8.0);

  /* corner posts */
  [[-4.2,8],[-4.2,-6.5],[4.2,-6.5],[4.2,0]].forEach(p=>
    cyl(.11,1.25,p[0],H+.62,p[1],steel));

  /* ================= FRONT PROCESSING ZONE ================= */
  /* entrance doors (z=14.7) */
  box(4.6,3.6,.2,0,1.8,D/2-.18,mat(0x3a3e44));
  box(2.1,3.3,.1,-1.15,1.65,D/2-.26,mat(0x4a4e54));
  box(2.1,3.3,.1, 1.15,1.65,D/2-.26,mat(0x4a4e54));
  box(5.0,.28,.28,0,3.72,D/2-.22,steel);
  box(.28,3.8,.28,-2.45,1.9,D/2-.22,steel);
  box(.28,3.8,.28, 2.45,1.9,D/2-.22,steel);
  /* door windows */
  box(1.5,1.4,.04,-1.15,2.3,D/2-.32,glow(0x8fb0c8));
  box(1.5,1.4,.04, 1.15,2.3,D/2-.32,glow(0x8fb0c8));
  /* WARNING sign */
  box(2.6,.55,.05,0,4.3,D/2-.28,mat(0x8a1a1a));
  box(2.3,.35,.02,0,4.3,D/2-.32,glow(0xd8d4c8));

  /* metal detector arch */
  box(.22,2.4,.22,-.85,1.2,13.0,steel,{solid:true});
  box(.22,2.4,.22,.85,1.2,13.0,steel,{solid:true});
  box(1.92,.22,.22,0,2.35,13.0,steel);
  sph(.1,0,2.5,13.0,glow(0x4ad04a));

  /* processing / intake desk */
  box(4.2,1.0,1.1,-5.4,.5,11.4,steel,{solid:true});
  box(4.4,.1,1.25,-5.4,1.02,11.4,mat(0x7a7e84));
  box(3.0,.85,.06,-5.4,.5,11.98,dark);
  /* monitor + papers */
  box(.6,.42,.05,-6.4,1.32,11.2,glow(0x1e3a5a));
  box(.08,.26,.08,-6.4,1.1,11.2,dark);
  box(.42,.03,.3,-4.4,1.08,11.3,white);
  box(.3,.18,.24,-4.0,1.15,11.5,dark);
  /* chair behind */
  function chair(x,z,ry){
    ry=ry||0;
    box(.58,.1,.58,x,.5,z,mat(0x3a3e44),{ry,solid:true});
    box(.58,.6,.1,x,.82,z-.26,mat(0x3a3e44),{ry});
    cyl(.04,.5,x,.25,z,steel);
    cyl(.26,.06,x,.03,z,steel);
  }
  chair(-5.4,12.4,0);

  /* guard station (right of entrance) */
  box(3.2,1.0,1.0,5.6,.5,11.6,steel,{solid:true});
  box(3.4,.1,1.15,5.6,1.02,11.6,mat(0x7a7e84));
  box(2.0,.5,.06,5.6,.6,12.06,dark);
  /* CCTV monitors */
  for(let i=0;i<3;i++){
    box(.55,.4,.05,4.6+i*1.0,1.5,11.9,glow(0x123a2a));
    box(.06,.06,.18,4.6+i*1.0,1.5,12.02,dark);
  }
  /* key rack */
  box(1.6,1.0,.12,9.6,1.9,12.0,mat(0x5a5e64),{solid:true});
  for(let r=0;r<3;r++) for(let c=0;c<5;c++)
    box(.06,.2,.04,8.95+c*.32,2.25-r*.3,11.92,steel);
  /* radio */
  box(.24,.16,.14,7.0,1.12,11.4,dark);

  /* visitor benches along the front */
  function bench(x,z,w,ry){
    ry=ry||0;
    const cs=Math.cos(ry), sn=Math.sin(ry);
    const put=(ox,oz)=>({ x:x+ox*cs+oz*sn, z:z-ox*sn+oz*cs }); /* local offset -> world, rotated with the bench */
    const back=put(0,-.22);
    const leg1=put(-w/2+.06,0), leg2=put(w/2-.06,0);
    box(w,.14,.55,x,.45,z,benchM,{ry,solid:true});
    box(w,.5,.12,back.x,.72,back.z,benchM,{ry});
    box(.12,.45,.55,leg1.x,.22,leg1.z,steel);
    box(.12,.45,.55,leg2.x,.22,leg2.z,steel);
  }
  bench(-8.5,9.6,3.0,0);
  bench( 8.5,9.6,3.0,0);
  bench(-2.5,9.6,2.4,0);
  bench( 2.5,9.6,2.4,0);

  /* noticeboard on front wall */
  box(3.2,1.6,.06,0,2.6,14.6,mat(0x4a4e54));
  box(3.0,1.4,.03,0,2.6,14.55,mat(0xc8c4b8));
  box(1.0,.7,.02,-.9,2.7,14.52,mat(0xd8d4c8));
  box(.9,.6,.02,.1,2.6,14.52,mat(0xd8d4c8));
  box(.8,.5,.02,1.0,2.85,14.52,mat(0xd8d4c8));

  /* ================= ATRIUM (cell block, ground) ================= */
  /* fixed picnic tables */
  function picnic(x,z,ry){
    ry=ry||0;
    box(2.6,.1,1.0,x,.78,z,woodM,{ry,solid:true});
    box(.12,.78,.12,x-1.1,.39,z-.35,steel);
    box(.12,.78,.12,x+1.1,.39,z-.35,steel);
    box(.12,.78,.12,x-1.1,.39,z+.35,steel);
    box(.12,.78,.12,x+1.1,.39,z+.35,steel);
    box(2.4,.08,.32,x,.45,z-.85,benchM,{ry,solid:true});
    box(2.4,.08,.32,x,.45,z+.85,benchM,{ry,solid:true});
    box(.1,.45,.1,x-1.0,.22,z-.85,steel);
    box(.1,.45,.1,x+1.0,.22,z-.85,steel);
    box(.1,.45,.1,x-1.0,.22,z+.85,steel);
    box(.1,.45,.1,x+1.0,.22,z+.85,steel);
  }
  picnic(-2.5,3.5,0);
  picnic(-2.5,-1.5,0);
  picnic( 1.0,-4.5,0);

  /* bolted stools along the left wall */
  for(let i=0;i<5;i++){
    cyl(.22,.06,-7.4,.42,-6.5+i*1.6,benchM,{solid:true});
    cyl(.06,.42,-7.4,.21,-6.5+i*1.6,steel);
  }

  /* central drain / floor detail */
  box(1.2,.02,1.2,0,.02,0,mat(0x6a6e74));
  for(let i=0;i<5;i++) box(1.0,.03,.1,0,.03,-.4+i*.2,dark);

  /* wall-mounted lights on cell fronts */
  for(let i=0;i<4;i++){
    const zc=[-5.4,-1.8,1.8,5.4][i];
    [-7.85,7.85].forEach(x=>{
      box(.16,.5,.2,x,3.0,zc,steel);
      box(.12,.42,.06,x+(x<0?.12:-.12),3.0,zc,glow(0xfff4c8));
      box(.16,.5,.2,x,H+3.0,zc,steel);
      box(.12,.42,.06,x+(x<0?.12:-.12),H+3.0,zc,glow(0xfff4c8));
    });
  }

  /* ================= GUARD BOOTH ON BACK BRIDGE ================= */
  box(3.2,2.0,2.0,0,H+1.0,-8.0,glassM,{solid:true,up:true});
  box(3.4,.14,2.2,0,H+2.05,-8.0,steel);
  box(.16,2.0,.16,-1.6,H+1.0,-9.0,steel);
  box(.16,2.0,.16,1.6,H+1.0,-9.0,steel);
  box(.16,2.0,.16,-1.6,H+1.0,-7.0,steel);
  box(.16,2.0,.16,1.6,H+1.0,-7.0,steel);
  /* desk inside */
  box(2.4,.85,.7,0,H+.43,-8.5,steel);
  box(2.5,.08,.8,0,H+.9,-8.5,mat(0x7a7e84));
  box(.6,.4,.05,-.6,H+1.2,-8.85,glow(0x1e3a5a));
  box(.6,.4,.05,.6,H+1.2,-8.85,glow(0x1e3a5a));
  /* spotlight pointing down into atrium */
  cyl(.22,.3,0,H+2.0,-6.6,steel);
  sph(.18,0,H+1.82,-6.6,glow(0xfff0c0));

  /* ================= REAR MESS HALL (z -15..-9) ================= */
  /* serving counter along back wall */
  box(12,1.0,1.0,0,.5,-14.2,steel,{solid:true});
  box(12.2,.1,1.15,0,1.02,-14.2,mat(0x9a9ea2));
  box(11.8,.06,.9,0,1.08,-14.2,mat(0xb0b4b8));
  /* sneeze guard */
  box(12,.04,.04,0,1.7,-13.8,glassM);
  box(12,.5,.03,0,1.45,-13.8,glassM);
  /* pots */
  cyl(.3,.35,-3.6,1.28,-14.2,steel);
  cyl(.26,.3,-1.8,1.25,-14.2,steel);
  cyl(.28,.32,0.2,1.26,-14.2,steel);
  cyl(.24,.28,2.2,1.24,-14.2,steel);
  cyl(.3,.35,4.4,1.28,-14.2,steel);

  /* mess tables */
  function messTable(x,z){
    box(3.6,.1,1.0,x,.78,z,woodM,{solid:true});
    box(.12,.78,.12,x-1.5,.39,z-.35,steel);
    box(.12,.78,.12,x+1.5,.39,z-.35,steel);
    box(.12,.78,.12,x-1.5,.39,z+.35,steel);
    box(.12,.78,.12,x+1.5,.39,z+.35,steel);
    bench(x,z-.85,3.4,0);
    bench(x,z+.85,3.4,Math.PI);
    seats.push({ type: "sit", label: "SIT", x: x, z: z-.85, yaw: 0, h: 0.45, level: 0, taken: false });
    seats.push({ type: "sit", label: "SIT", x: x, z: z+.85, yaw: Math.PI, h: 0.45, level: 0, taken: false });
  }
  messTable(-6.0,-11.4);
  messTable( 0.0,-11.4);
  messTable( 6.0,-11.4);

  /* trays on tables */
  for(let i=0;i<3;i++){
    box(.5,.04,.36,-6.0+i*6.0,.84,-11.4,mat(0xb84a2a));
    cyl(.1,.12,-6.3+i*6.0,.9,-11.4,white);
  }

  /* rear exit */
  box(3.0,3.2,.18,-8.5,1.6,-D/2+.18,mat(0x3a3e44));
  box(3.3,.24,.3,-8.5,3.3,-D/2+.2,steel);
  box(.26,3.4,.26,-10.2,1.7,-D/2+.2,steel);
  box(.26,3.4,.26,-6.8,1.7,-D/2+.2,steel);
  box(1.0,1.0,.04,-8.5,2.0,-D/2+.3,glow(0x8fb0c8));

  /* ================= WALL DETAILS ================= */
  /* cell block walls — painted stripe */
  box(W,.14,.06,0,1.3,8.02,mat(0x4a6a8a));
  box(W,.14,.06,0,1.3,-9.02,mat(0x4a6a8a));
  box(W,.14,.06,0,H+1.3,8.02,mat(0x4a6a8a));

  /* posters in the atrium */
  box(1.3,1.7,.05,-4.6,2.6,8.06,mat(0x2a2c30));
  box(1.1,1.5,.02,-4.6,2.6,8.02,mat(0xc8c4b8));
  box(1.3,1.7,.05, 4.6,2.6,8.06,mat(0x2a2c30));
  box(1.1,1.5,.02, 4.6,2.6,8.02,mat(0xc8c4b8));

  /* ================= LIGHTING ================= */
  /* main ceiling panels */
  for(let i=0;i<3;i++) for(let j=0;j<4;j++)
    box(1.6,.08,.9,-7+i*7,H2-.08,-12+j*7.5,glow(0xeaf2ff));
  /* atrium suspended fixtures */
  for(let i=0;i<3;i++){
    cyl(.03,1.4,0,H2-.7,-6+i*6,steel);
    cyl(.5,.18,0,H2-1.4,-6+i*6,mat(0x9a9ea2));
    cyl(.42,.1,0,H2-1.5,-6+i*6,glow(0xeaf2ff));
  }
  /* front zone fixtures */
  for(let i=0;i<3;i++)
    box(1.4,.08,.8,-6+i*6,H2-.08,11.5,glow(0xeaf2ff));

  /* ================= OUTER SAFETY BOUNDS ================= */
  /* thick safety bounds so fast movement / frame hitches cannot tunnel through */
  solid.push({x:0,z:-D/2+.25,hw:W/2,hd:.45});
  solid.push({x:0,z:D/2-.25,hw:W/2,hd:.45});
  solid.push({x:-W/2+.25,z:0,hw:.45,hd:D/2});
  solid.push({x:W/2-.25,z:0,hw:.45,hd:D/2});
  /* ======== game glue ======== */
  camera.fov = 95; camera.updateProjectionMatrix();
  const __cols = [];
  for (const b of solid) {
    const mk = (level) => ({ minX: b.x - b.hw, maxX: b.x + b.hw, minZ: b.z - b.hd, maxZ: b.z + b.hd, y0: 0, y1: 60, level });
    /* upper-floor flags from the prototype: ground = blocks floor 0 only, up = blocks floor 1 only */
    if (b.ground) __cols.push(mk(0));
    else if (b.up) __cols.push(mk(1));
    else { __cols.push(mk(0)); __cols.push(mk(1)); }
  }
  uses.push({ kind: "exit", label: "EXIT PRISON", x: 0, z: 13.9, y: 0, level: 0, r: 1.7 });

  const __world = {
    colliders: __cols, seats, uses,
    stairs: [{ minX: 4.25, maxX: 7.95, minZ: 0, maxZ: 8.0, axis: 'z', y0: H, y1: 0, level: 0, toLevel: 1 }],
    platforms: [
      /* Upper cell floors: these slabs are real meshes and must also be
         registered as walkable platforms, otherwise the player falls through. */
      { level: 1, minX: -10.9, maxX: -8.1, minZ: -7.2, maxZ: 7.2, h: H },
      { level: 1, minX: 8.1, maxX: 10.9, minZ: -7.2, maxZ: 7.2, h: H },
      { level: 1, minX: -7.9, maxX: -4.3, minZ: -8.9, maxZ: 7.9, h: H },
      { level: 1, minX: 4.3, maxX: 7.9, minZ: -8.9, maxZ: 0.1, h: H },
      { level: 1, minX: -4.1, maxX: 4.1, minZ: -8.9, maxZ: -6.6, h: H }
    ],
    levelHeight: () => 0,
    /* The lower atrium is double-height; the upper cells/catwalk have
       one storey of clearance above their floor. */
    ceilingHeight: (level) => level === 1 ? H : H2,
    bounds: { minX: -ROOM.x, maxX: ROOM.x, minZ: -ROOM.z, maxZ: ROOM.z },
  };

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, __world, {
    scene, x: START.x, z: START.z, yaw: Math.PI + (START.yaw || 0), level: 0,
    onUse: (use) => {
      if (use && use.kind === "exit") {
        const P = window.__ph3d_prison;
        if (P && (P.inJail || (P.timeLeft || 0) > 0)) {
          if (window.__ph3d_phone) window.__ph3d_phone._toast("You must serve your sentence or pay bail.");
          return;
        }
        if (router && router.go) router.go("city");
        return;
      }
      if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE");
    },
  });

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "STATE JAIL",
    title: "CELL BLOCK \u00b7 2 FLOORS",
    subtitle: "",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: INTERACT",
    isInterior: true,
    sceneId: "statejail",
    update: (dt) => {
      /* sub-step so a lag spike cannot carry the player through thin walls/bars */
      let r = Math.min(dt, 0.25);
      while (r > 1e-6) { const t = Math.min(r, 1 / 60); ctl.update(t); r -= t; }
    },
    dispose: () => ctl.dispose(),
  };
}

