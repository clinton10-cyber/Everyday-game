/* statehouse/interior.js -- converted from the standalone prototype "state.html".
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
  scene.fog=new THREE.Fog(0x0a0c10,70,200);
  const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,400);
  camera.rotation.order='YXZ';

  scene.add(new THREE.HemisphereLight(0xfff6e8,0x3a3028,1.05));
  const sun=new THREE.DirectionalLight(0xfff4d6,1.15);
  sun.position.set(30,55,22); scene.add(sun);
  const fill=new THREE.DirectionalLight(0xc8d8ff,.5);
  fill.position.set(-22,26,-22); scene.add(fill);

  const BOXG=new THREE.BoxGeometry(1,1,1),
        CYLG=new THREE.CylinderGeometry(.5,.5,1,14),
        SPHG=new THREE.SphereGeometry(.5,10,8),
        CONEG=new THREE.ConeGeometry(.5,1,10);
  const MC=new Map();
  function mat(c,o){
    if(o&&o.map) return new THREE.MeshLambertMaterial(Object.assign({color:c},o));
    const k=c+'|'+JSON.stringify(o||0); let m=MC.get(k);
    if(!m){m=new THREE.MeshLambertMaterial(Object.assign({color:c},o||{}));MC.set(k,m);}
    return m;
  }
  const glow=c=>new THREE.MeshBasicMaterial({color:c});
  const glassM=mat(0xcfe4ee,{transparent:true,opacity:.22});
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
      solid.push({x,z,hw:(c*w+n*d)/2,hd:(n*w+c*d)/2, ground:o.ground, up:o.up});
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

  /* ================= STATEHOUSE ================= */
  const W=26, D=32, H=4.6, H2=8.0;   /* H = gallery level, H2 = foyer ceiling */
  const ROOM={x:W/2-1, z:D/2-1};
  const START={x:0, z:14.5, yaw:0};

  /* --- textures --- */
  const marbleTex=tex(128,128,g=>{
    g.fillStyle='#f6f2ea'; g.fillRect(0,0,128,128);
    g.strokeStyle='#e4dccc'; g.lineWidth=2;
    for(let i=0;i<10;i++){
      g.beginPath(); g.moveTo(Math.random()*128,0); g.lineTo(Math.random()*128,128); g.stroke();
      g.beginPath(); g.moveTo(0,Math.random()*128); g.lineTo(128,Math.random()*128); g.stroke();
    }
    g.fillStyle='#efe9dd';
    for(let i=0;i<45;i++){g.fillRect(Math.random()*128,Math.random()*128,4,4);}
  },9,11);

  const woodTex=tex(128,128,g=>{
    g.fillStyle='#7a4a26'; g.fillRect(0,0,128,128);
    g.strokeStyle='#5e3618'; g.lineWidth=2;
    for(let i=0;i<8;i++){g.beginPath();g.moveTo(0,i*16);g.lineTo(128,i*16);g.stroke();}
    g.strokeStyle='#4e2c12'; g.lineWidth=1;
    for(let i=0;i<28;i++){const x=Math.random()*128;g.beginPath();g.moveTo(x,0);g.lineTo(x+5,128);g.stroke();}
  },6,6);

  const marbleM=mat(0xffffff,{map:marbleTex});
  const woodM=mat(0xffffff,{map:woodTex});
  const wallM=mat(0xf3ecdd), ceilM=mat(0xfbf8f2),
        darkWood=mat(0x3a2010), mahog=mat(0x5e3618),
        gold=mat(0xc8a850), metal=mat(0xc8ced4), white=mat(0xfbfbfb),
        cream=mat(0xe8e0cc), dark=mat(0x1a1a1a),
        leather=mat(0x3a2416), greenLeather=mat(0x26423a),
        redCarpet=mat(0x8a1e1e), navy=mat(0x1e2a4a);

  /* ===== SHELL ===== */
  box(W,.2,D,0,-.1,0,marbleM);                 /* ground floor */
  box(W,.3,14,0,H-.15,-9,ceilM);               /* back-wing ceiling at 4.6 */
  box(W,.2,D,0,H2+.1,0,ceilM);                 /* main ceiling at 8.0 */

  /* outer walls (full height) */
  box(W,H2,.3,0,H2/2,-D/2,wallM,{solid:true});
  box(W,H2,.3,0,H2/2,D/2,wallM,{solid:true});
  box(.3,H2,D,-W/2,H2/2,0,wallM,{solid:true});
  box(.3,H2,D,W/2,H2/2,0,wallM,{solid:true});
  /* baseboards */
  box(W,.18,.08,0,.09,-D/2+.17,mahog); box(W,.18,.08,0,.09,D/2-.17,mahog);
  box(.08,.18,D,-W/2+.17,.09,0,mahog); box(.08,.18,D,W/2-.17,.09,0,mahog);
  /* cornice */
  box(W,.22,.14,0,H2-.2,-D/2+.2,gold); box(W,.22,.14,0,H2-.2,D/2-.2,gold);
  box(.14,.22,D,-W/2+.2,H2-.2,0,gold); box(.14,.22,D,W/2-.2,H2-.2,0,gold);

  /* ===== INTERIOR WALLS (back wing z -16..-2) ===== */
  /* wall along z=-2 (with doorways) */
  box(4,H,.24,-11,H/2,-2,wallM,{solid:true});   /* -13..-9 */
  box(5,H,.24,-4.5,H/2,-2,wallM,{solid:true});  /* -7..-2 */
  box(4,H,.24,4,H/2,-2,wallM,{solid:true});     /* 2..6  */
  box(5,H,.24,10.5,H/2,-2,wallM,{solid:true});  /* 8..13 */
  /* door headers */
  box(2,.9,.24,-8,H-.45,-2,wallM);
  box(2,.9,.24,7,H-.45,-2,wallM);
  /* corridor walls x=-2 and x=2 */
  box(.24,H,14,-2,H/2,-9,wallM,{solid:true});
  box(.24,H,14,2,H/2,-9,wallM,{solid:true});
  /* corridor/rear door gap already open at z=-2 between x -2..2 */

  /* ===== GRAND STAIRCASE (x 8.2..11.0, z 4.0..11.0) ===== */
  const SX1=8.2, SX2=11.0, SZBOT=11.0, SZTOP=4.0, NSTEP=14;
  const stepH=H/NSTEP, stepD=(SZBOT-SZTOP)/NSTEP;
  const stairDir=(SZBOT-SZTOP)>0?-1:1;
  for(let i=0;i<NSTEP;i++){
    const z=SZTOP + i*stepD + stepD/2;
    /* tread */
    box(SX2-SX1, stepH, stepD*.96, (SX1+SX2)/2, stepH*(i+.5), z, marbleM);
    /* gold nosing strip */
    box(SX2-SX1, .03, .06, (SX1+SX2)/2, stepH*(i+1)+.005, z-stepD/2+stepD*.48, gold);
  }
  /* carpet runner up the stairs */
  for(let i=0;i<NSTEP;i++){
    const z=SZTOP + i*stepD + stepD/2;
    box(1.3, .04, stepD*.94, (SX1+SX2)/2, stepH*(i+.5)+stepH/2+.02, z, redCarpet);
  }
  /* glass balustrades on both sides of the stairs */
  for(let i=0;i<NSTEP;i+=1){
    const z=SZTOP + i*stepD + stepD/2;
    box(.06, 1.05, stepD, SX1, stepH*(i+.5)+.53, z, glassM,{solid:true});
    box(.06, 1.05, stepD, SX2, stepH*(i+.5)+.53, z, glassM,{solid:true});
  }
  /* gold handrails */
  cyl(.045, 7.3, SX1, H*1.08, 7.5, gold, {rx:-Math.atan2(H,7.0)});
  cyl(.045, 7.3, SX2, H*1.08, 7.5, gold, {rx:-Math.atan2(H,7.0)});

  /* ===== GALLERY BALCONY (over foyer front) ===== */
  // Gallery slab spans z=4..16, but must leave a stairwell opening over
  // the staircase (x 8.2..11.0, z 4.0..11.0) so the stairs actually lead
  // somewhere instead of dead-ending under a solid floor.
  box(SX1+W/2,.3,12.0,(-W/2+SX1)/2,H-.15,10.0,marbleM);         /* slab west of the stairwell */
  box(W/2-SX2,.3,12.0,(SX2+W/2)/2,H-.15,10.0,marbleM);          /* slab east of the stairwell */
  box(W,.3,16.0-SZBOT,0,H-.15,(SZBOT+16.0)/2,marbleM);          /* slab north of the stairwell top (z 11..16) */
  
  /* balustrade along the inner edge (x -13..8.0), upper floor only */
  box(21,1.15,.14,-2.5,H+.58,10.8,glassM,{solid:true,up:true});
  cyl(.055,21,-2.5,H+1.2,10.8,gold,{rz:Math.PI/2});
  /* end posts */
  cyl(.09,1.2,8.0,H+.6,10.8,gold);
  cyl(.09,1.2,-13,H+.6,10.8,gold);
  /* return along the stair opening */
  box(.14,1.15,5.2,11.0,H+.58,13.4,glassM,{solid:true,up:true});
  cyl(.055,5.2,11.0,H+1.2,13.4,gold,{rx:Math.PI/2});

  /* ===== FOYER FLOOR DETAIL ===== */
  /* red carpet runner */
  box(3.4,.03,13.4,0,.02,8.9,redCarpet);
  box(3.7,.02,13.7,0,.01,8.9,gold);
  /* central diamond inlay */
  box(7.5,.02,7.5,0,.012,4.5,mat(0xe4dccc),{ry:Math.PI/4});
  box(7.0,.02,7.0,0,.022,4.5,mat(0x8a7a5a),{ry:Math.PI/4});
  box(6.4,.02,6.4,0,.032,4.5,mat(0xe4dccc),{ry:Math.PI/4});

  /* ===== FOYER: COLUMNS ===== */
  function column(x,z){
    box(1.1,.35,1.1,x,.18,z,marbleM,{solid:true});
    cyl(.5,H-1.0,x,H/2+.35,z,white);
    box(1.15,.35,1.15,x,H-.35,z,marbleM);
    cyl(.55,.18,x,H-.75,z,gold);
    cyl(.55,.18,x,.45,z,gold);
  }
  [[-7.5,2],[-7.5,7.5],[7.5,2]].forEach(p=>column(p[0],p[1]));

  /* ===== FOYER: CHANDELIER ===== */
  function chandelier(x,y,z,r){
    cyl(.04,2.4,x,y+1.2,z,gold);
    cyl(r*2.0,.14,x,y,z,gold);
    cyl(r*1.35,.12,x,y+.42,z,gold);
    cyl(r*.75,.10,x,y+.8,z,gold);
    for(let i=0;i<14;i++){
      const a=i/14*Math.PI*2;
      cyl(.055,.22,x+Math.cos(a)*r,y+.1,z+Math.sin(a)*r,glow(0xfff0c0));
      cyl(.035,.3,x+Math.cos(a)*r,y+.28,z+Math.sin(a)*r,gold);
    }
    for(let i=0;i<8;i++){
      const a=i/8*Math.PI*2;
      cyl(.045,.18,x+Math.cos(a)*r*.7,y+.5,z+Math.sin(a)*r*.7,glow(0xfff0c0));
    }
    sph(.22,x,y+1.0,z,glow(0xfff8e0));
  }
  chandelier(0,6.1,7.0,1.5);

  /* ===== FOYER: RECEPTION DESK ===== */
  box(4.6,.95,1.0,-9,.475,12.5,woodM,{solid:true});
  box(4.9,.1,1.2,-9,1.0,12.5,marbleM);
  box(.06,.75,1.0,-11.3,.55,12.5,mahog);
  box(.06,.75,1.0,-6.7,.55,12.5,mahog);
  /* gold state seal on the desk front */
  cyl(.36,.05,-9,.55,13.02,gold,{rx:Math.PI/2});
  cyl(.26,.06,-9,.55,13.06,mat(0x3a6a3a),{rx:Math.PI/2});
  /* monitor, phone, papers */
  box(.6,.42,.05,-9.8,1.3,12.3,glow(0x1e3a5a));
  box(.08,.25,.08,-9.8,1.05,12.3,dark);
  box(.28,.1,.22,-8.2,1.1,12.4,dark);
  box(.4,.02,.3,-10.4,1.06,12.4,white);
  /* reception chairs */
  function officeChair(x,z,ry,c){
    ry=ry||0;
    const cs=Math.cos(ry), sn=Math.sin(ry);
    const bx=x-.25*sn, bz=z-.25*cs; /* backrest offset rotated with the chair, not just spun in place */
    box(.6,.1,.6,x,.5,z,mat(c||0x2a2a2a),{ry,solid:true});
    box(.6,.62,.1,bx,.82,bz,mat(c||0x2a2a2a),{ry});
    cyl(.04,.5,x,.25,z,metal);
    cyl(.28,.06,x,.03,z,metal);
    seats.push({ type: "sit", label: "SIT", x, z, yaw: ry, h: 0.5, level: 0, taken: false });
  }
  officeChair(-10.6,11.4,Math.PI);
  officeChair(-7.4,11.4,Math.PI);
  uses.push({ kind: "work", label: "RECEPTION DESK", x: -9, z: 12.3, y: 0, level: 0, r: 1.6 });

  /* ===== FOYER: SECURITY POST ===== */
  box(3.0,.95,.9,6.5,.475,14.2,woodM,{solid:true});
  box(3.2,.1,1.05,6.5,1.0,14.2,marbleM);
  box(.55,.4,.05,6.0,1.3,14.0,glow(0x1e3a5a));
  box(.4,.25,.3,7.2,1.12,14.1,dark);
  officeChair(6.5,13.3,0);
  uses.push({ kind: "work", label: "SECURITY DESK", x: 6.5, z: 14.2, y: 0, level: 0, r: 1.6 });

  /* ===== FOYER: SEATING ===== */
  function benchSofa(x,z,w,ry,c){
    ry=ry||0;
    const cs=Math.cos(ry), sn=Math.sin(ry);
    const put=(ww,hh,dd,ox,oy,oz,m)=>box(ww,hh,dd,x+ox*cs+oz*sn,oy,z-ox*sn+oz*cs,m,{ry,solid:true});
    put(w,.3,.85,0,.3,0,mat(c));
    put(w,.55,.16,0,.58,-.35,mat(c));
    put(.16,.55,.85,-w/2+.08,.58,0,mat(c));
    put(.16,.55,.85,w/2-.08,.58,0,mat(c));
    const n=Math.max(2,Math.floor(w/.7));
    for(let i=0;i<n;i++) put(w/n-.06,.14,.7,-w/2+(i+.5)*(w/n),.47,.05,mat(c+0x0a0a0a));
    [[-w/2+.14,-.3],[w/2-.14,-.3],[-w/2+.14,.3],[w/2-.14,.3]].forEach(p=>
      box(.07,.15,.07,x+p[0]*cs+p[1]*sn,.08,z-p[0]*sn+p[1]*cs,gold));
    seats.push({ type: "sit", label: "SIT", x, z, yaw: ry, h: 0.5, level: 0, taken: false });
  }
  benchSofa(-10.5,16.4,3.2,Math.PI,0x2a3a4a);
  benchSofa(10.5,16.4,3.2,Math.PI,0x2a3a4a);
  benchSofa(-12.2,9.0,3.4,Math.PI/2,0x2a3a4a);

  /* side tables + flower vases */
  function vaseTable(x,z){
    cyl(.45,.06,x,.62,z,marbleM,{solid:true});
    cyl(.06,.6,x,.31,z,gold);
    cyl(.38,.05,x,.02,z,marbleM);
    cyl(.2,.32,x,.78,z,white);
    sph(.28,x,1.12,z,mat(0x8a2a4a));
    sph(.2,x+.2,1.22,z+.1,mat(0xc83a5a));
    sph(.18,x-.18,1.18,z-.1,mat(0x6a2a5a));
  }
  vaseTable(-12.2,12.5);
  vaseTable(12.2,12.5);
  vaseTable(0,1.2);

  /* ===== FOYER: FLAG POLES (entrance) ===== */
  function nigerianFlag(x,z){
    cyl(.05,3.4,x,1.7,z,gold);
    sph(.09,x,3.45,z,gold);
    box(.05,.95,.36,x+.03,3.0,z-.5,mat(0x008751));
    box(.05,.95,.28,x+.03,3.0,z-.5,white);
    box(.05,.95,.36,x+.03,3.0,z-.86,mat(0x008751));
  }
  nigerianFlag(-2.6,15.2);
  nigerianFlag(2.6,15.2);
  /* desk flags in office use same helper later */

  /* ===== ENTRANCE DOORS ===== */
  box(4.0,3.4,.2,0,1.7,D/2-.16,mat(0x3a2010));
  box(1.9,3.2,.08,-1.0,1.6,D/2-.24,mat(0x2a1a0a));
  box(1.9,3.2,.08,1.0,1.6,D/2-.24,mat(0x2a1a0a));
  box(4.4,.3,.3,0,3.5,D/2-.2,gold);
  box(.3,3.6,.3,-2.15,1.8,D/2-.2,gold);
  box(.3,3.6,.3,2.15,1.8,D/2-.2,gold);
  cyl(.06,.5,-.25,1.5,D/2-.34,gold);
  cyl(.06,.5,.25,1.5,D/2-.34,gold);

  /* ===== OFFICE (x -13..-2, z -16..-2) ===== */
  box(10.6,.02,13.4,-7.5,.012,-9,mat(0x3a4a3a));      /* carpet */
  box(10.0,.02,12.6,-7.5,.022,-9,mat(0x44544a));

  /* governor's desk */
  box(4.2,.12,1.8,-7.5,1.02,-11.5,woodM,{solid:true});
  box(4.0,.9,1.6,-7.5,.5,-11.5,mahog);
  box(.12,1.0,.12,-9.4,.5,-12.1,woodM);
  box(.12,1.0,.12,-5.6,.5,-12.1,woodM);
  /* desk inlay */
  box(3.6,.02,1.3,-7.5,1.09,-11.5,mat(0x2a4a2a));
  /* desk items */
  box(.6,.42,.05,-8.6,1.3,-11.8,glow(0x1e3a5a));
  box(.08,.28,.08,-8.6,1.05,-11.8,dark);
  box(.34,.12,.26,-6.4,1.15,-11.4,dark);          /* phone */
  cyl(.09,.28,-7.5,1.2,-11.9,gold);               /* pen pot */
  cyl(.02,.3,-7.45,1.35,-11.9,gold);
  box(.5,.03,.36,-7.2,1.1,-11.1,white);           /* papers */
  box(.4,.03,.3,-6.8,1.14,-11.0,white);
  sph(.13,-9.6,1.2,-11.2,mat(0xc8a850));          /* ornament */

  /* executive chair */
  function execChair(x,z,ry,c){
    ry=ry||0; const cs=Math.cos(ry), sn=Math.sin(ry);
    const put=(w,h,d,ox,oy,oz,m)=>box(w,h,d,x+ox*cs+oz*sn,oy,z-ox*sn+oz*cs,m,{ry,solid:true});
    put(.78,.14,.72,0,.5,0,mat(c));
    put(.78,.95,.14,0,1.0,-.32,mat(c));
    put(.16,.55,.72,-.39,.85,0,mat(c));
    put(.16,.55,.72,.39,.85,0,mat(c));
    put(.6,.1,.6,0,.72,.05,mat(c+0x0a0a0a));
    cyl(.06,.35,x,.28,z,metal);
    cyl(.3,.07,x,.06,z,metal);
  }
  execChair(-7.5,-10.4,0,0x3a2416);
  /* guest chairs facing the desk */
  execChair(-9.0,-13.2,Math.PI,0x26423a);
  execChair(-6.0,-13.2,Math.PI,0x26423a);

  /* flags behind the desk */
  function officeFlag(x,z,stripes){
    cyl(.05,3.0,x,1.5,z,gold);
    sph(.09,x,3.05,z,gold);
    if(stripes){
      box(.05,.85,.3,x+.03,2.6,z-.42,mat(0x008751));
      box(.05,.85,.24,x+.03,2.6,z-.42,white);
      box(.05,.85,.3,x+.03,2.6,z-.72,mat(0x008751));
    } else {
      box(.05,.85,.6,x+.03,2.6,z-.55,mat(0x1e3a6a));
      cyl(.16,.05,x+.06,2.6,z-.55,gold,{rz:Math.PI/2});
    }
  }
  officeFlag(-9.2,-14.6,true);
  officeFlag(-6.8,-14.6,false);

  /* bookshelves along left wall */
  for(let b=0;b<2;b++){
    const bz=-6.5-b*4.2;
    box(.9,2.6,3.6,-12.4,1.3,bz,woodM,{solid:true});
    box(.05,2.4,3.5,-11.95,1.3,bz,mahog);
    for(let s=0;s<5;s++){
      box(.85,.05,3.4,-12.4,.35+s*.48,bz,mat(0x2a1a0a));
      for(let k=0;k<9;k++){
        const hh=.28+((s*7+k*3)%5)*.03;
        box(.06,hh,.26,-12.2,.4+s*.48+hh/2,bz-1.45+k*.33,
          mat([0x8a2a2a,0x2a4a7a,0x2a6a3a,0x7a5a2a,0x5a2a6a,0x2a5a6a][(s+k)%6]));
      }
    }
  }

  /* office window on back wall */
  box(5.5,2.6,.12,-8,2.4,-D/2+.18,glow(0xbfe0f5));
  box(5.8,.18,.24,-8,3.85,-D/2+.2,gold);
  box(5.8,.18,.24,-8,.95,-D/2+.2,gold);
  box(.2,3.0,.24,-10.85,2.4,-D/2+.2,gold);
  box(.2,3.0,.24,-5.15,2.4,-D/2+.2,gold);
  box(.14,2.6,.14,-8,2.4,-D/2+.24,gold);
  /* curtains */
  box(.6,3.2,.1,-10.3,2.5,-D/2+.4,mat(0x6a2a2a));
  box(.6,3.2,.1,-5.7,2.5,-D/2+.4,mat(0x6a2a2a));

  /* office coffee corner */
  box(2.0,.08,1.0,-4.0,.42,-5.0,woodM,{solid:true});
  box(1.9,.06,.9,-4.0,.46,-5.0,glassM);
  [[-3.4,-4.6],[-4.6,-4.6],[-3.4,-5.4],[-4.6,-5.4]].forEach(p=>
    box(.05,.42,.05,p[0],.21,p[1],gold));
  execChair(-4.0,-3.4,Math.PI,0x3a2416);
  execChair(-4.0,-6.6,0,0x3a2416);

  /* filing cabinets */
  box(.7,1.3,3.2,-12.4,.65,-13.0,metal,{solid:true});
  for(let i=0;i<3;i++) box(.05,.03,2.9,-12.05,.3+i*.4,-13.0,dark);

  /* office wall art */
  box(1.6,2.0,.08,-2.2,2.6,-8,mat(0x3a2010));
  box(1.4,1.8,.03,-2.2,2.6,-8.06,mat(0x6a5a4a));
  sph(.24,-2.2,3.0,-8.1,mat(0x3a2a1a));
  box(.7,.7,.04,-2.2,2.3,-8.1,mat(0x1e2a4a));

  /* ===== CABINET ROOM (x 2..13, z -16..-2) ===== */
  box(10.6,.02,13.4,7.5,.012,-9,mat(0x2a3a4a));
  box(10.0,.02,12.6,7.5,.022,-9,mat(0x34445a));

  /* long conference table */
  box(7.6,.12,2.3,7.5,1.02,-9,woodM,{solid:true});
  box(7.3,.85,2.0,7.5,.5,-9,mahog);
  box(7.0,.02,1.7,7.5,1.09,-9,mat(0x1e3a2a));
  /* table legs */
  [[4.2,-10.0],[10.8,-10.0],[4.2,-8.0],[10.8,-8.0]].forEach(p=>
    box(.18,1.0,.18,p[0],.5,p[1],mahog));

  /* conference chairs */
  for(let i=0;i<7;i++){
    const cx=4.6+i*1.0;
    execChair(cx,-10.5,0,0x1e2a4a);
    execChair(cx,-7.5,Math.PI,0x1e2a4a);
  }
  execChair(4.0,-9,Math.PI/2,0x1e2a4a);
  execChair(11.0,-9,-Math.PI/2,0x1e2a4a);

  /* table items */
  for(let i=0;i<7;i++){
    cyl(.05,.16,4.6+i*1.0,1.14,-9.4,glassM);
    box(.24,.02,.16,4.6+i*1.0,1.11,-8.6,white);
  }
  cyl(.14,.28,7.5,1.18,-9,gold);
  sph(.2,7.5,1.45,-9,mat(0x8a2a4a));

  /* cabinet room screen on back wall */
  box(7.0,3.4,.12,7.5,2.4,-D/2+.18,mat(0x0a0a0a));
  box(6.6,3.0,.05,7.5,2.4,-D/2+.25,glow(0x16283c));
  box(7.2,.2,.24,7.5,4.15,-D/2+.2,gold);

  /* side credenzas */
  box(.8,1.0,4.0,12.4,.5,-9,woodM,{solid:true});
  box(.7,.06,3.8,12.0,1.05,-9,marbleM);
  box(.9,1.0,3.0,-0.6+2.0-1.0,0.5,-13.5,woodM,{solid:true});

  /* flags in corner */
  cyl(.05,3.2,12.2,1.6,-15.2,gold);
  box(.05,.9,.34,12.23,2.7,-15.6,mat(0x008751));
  box(.05,.9,.26,12.23,2.7,-15.6,white);
  box(.05,.9,.34,12.23,2.7,-15.94,mat(0x008751));
  cyl(.05,3.2,11.4,1.6,-15.2,gold);
  box(.05,.9,.56,11.43,2.7,-15.7,mat(0x1e3a6a));
  cyl(.16,.05,11.46,2.7,-15.7,gold,{rz:Math.PI/2});

  /* ===== CORRIDOR (x -2..2, z -16..-2) ===== */
  box(3.6,.02,13.4,0,.012,-9,redCarpet);
  box(3.9,.02,13.7,0,.005,-9,gold);
  /* rear door */
  box(2.2,3.0,.18,0,1.5,-D/2+.18,mat(0x2a1a0a));
  box(2.5,.22,.3,0,3.1,-D/2+.2,gold);
  box(.3,3.2,.3,-1.25,1.6,-D/2+.2,gold);
  box(.3,3.2,.3,1.25,1.6,-D/2+.2,gold);
  /* corridor portraits */
  box(1.2,1.6,.08,-1.82,2.4,-5.5,mat(0x3a2010));
  box(1.0,1.4,.03,-1.78,2.4,-5.5,mat(0x6a5a4a));
  box(1.2,1.6,.08,1.82,2.4,-12.0,mat(0x3a2010));
  box(1.0,1.4,.03,1.78,2.4,-12.0,mat(0x6a5a4a));
  /* corridor side tables */
  box(1.6,.08,.5,-1.4,.9,-9.5,woodM,{solid:true});
  box(1.5,.7,.4,-1.4,.45,-9.5,mahog);
  vaseTable(-1.2,-6.5);
  vaseTable(1.2,-14.0);

  /* ===== GALLERY FURNISHINGS ===== */
  /* runner carpet on the gallery */
  box(20,.03,2.6,-3,H+.03,13.4,redCarpet);
  /* gallery benches */
  function galleryBench(x,z,w){
    box(w,.14,.6,x,H+.4,z,mahog,{solid:true,up:true});
    box(w,.5,.12,x,H+.68,z-.24,mahog,{up:true});
    box(.12,.4,.6,x-w/2+.06,H+.2,z,mahog);
    box(.12,.4,.6,x+w/2-.06,H+.2,z,mahog);
    seats.push({ type: "sit", label: "SIT", x, z, yaw: 0, h: H + 0.4, level: 1, taken: false });
  }
  galleryBench(-8,15.0,3.0);
  galleryBench(-1,15.0,3.0);
  /* gallery portraits */
  box(1.6,2.0,.08,-9,6.2,D/2-.18,mat(0x3a2010));
  box(1.4,1.8,.03,-9,6.2,D/2-.24,mat(0x6a5a4a));
  box(1.6,2.0,.08,-4,6.2,D/2-.18,mat(0x3a2010));
  box(1.4,1.8,.03,-4,6.2,D/2-.24,mat(0x6a5a4a));
  /* gallery railing lamps */
  for(let i=0;i<5;i++){
    const gx=-11+i*4.2;
    cyl(.05,.5,gx,H+1.2,10.9,gold);
    cyl(.16,.22,gx,H+1.5,10.9,glow(0xfff0c0));
  }

  /* ===== WALL ART / PORTRAITS (foyer) ===== */
  function portrait(x,y,z,ry,c1,c2,w,h){
    w=w||1.6; h=h||2.0;
    const cs=Math.cos(ry), sn=Math.sin(ry);
    const put=(ww,hh,dd,oy,oz,m)=>box(ww,hh,dd,x+oz*sn,y+oy,z+oz*cs,m,{ry});
    put(w+.16,h+.16,.09,0,0,mat(0x3a2010));
    put(w+.06,h+.06,.04,0,0.035,gold);
    put(w,h,.02,0,0.07,mat(c1||0x6a5a4a));
    /* silhouette */
    const sh=sph(.11,0,0,mat(c2||0x2a1a0a));
    sh.position.set(x+.07*sn, y+h*0.18, z+.07*cs);
    sh.scale.setScalar(.22);
    const torso=box(w*.5,h*.34,.02,x+.075*sn,y-h*0.16,z+.075*cs,mat(c2||0x1a1a1a),{ry});
  }
  portrait(-12.8,2.8,-6, Math.PI/2,0x5a4a3a,0x1a1a1a);
  portrait(-12.8,2.8,0,  Math.PI/2,0x5a4a3a,0x1a1a1a);
  portrait(12.8,2.8,-6, -Math.PI/2,0x5a4a3a,0x1a1a1a);
  portrait(12.8,2.8,0,  -Math.PI/2,0x5a4a3a,0x1a1a1a);
  portrait(-9,3.2,-1.8, 0,0x5a4a3a,0x1a1a1a,2.0,2.4);
  portrait(9,3.2,-1.8, 0,0x5a4a3a,0x1a1a1a,2.0,2.4);

  /* state seal above the entrance */
  cyl(.9,.08,0,3.9,D/2-.3,gold,{rx:Math.PI/2});
  cyl(.72,.08,0,3.9,D/2-.36,mat(0x1e3a6a),{rx:Math.PI/2});
  sph(.18,0,3.9,D/2-.42,gold);

  /* ===== LIGHTING ===== */
  /* foyer ceiling lights (high) */
  for(let i=0;i<3;i++) for(let j=0;j<2;j++)
    box(1.6,.07,.9,-8+i*8,H2-.08,4+j*8,glow(0xfff8ee));
  /* back wing ceiling lights */
  for(let i=0;i<3;i++) for(let j=0;j<3;j++)
    box(1.2,.07,.7,-8+i*8,H-.08,-13+j*5,glow(0xfff8ee));
  /* cabinet room pendants */
  for(let i=0;i<3;i++){
    cyl(.03,1.3,5.5+i*2.0,H-.5,-9,gold);
    cyl(.28,.2,5.5+i*2.0,H-1.25,-9,glow(0xfff0c0));
  }
  /* office desk lamp */
  cyl(.04,.5,-8.6,1.3,-11.2,gold);
  cyl(.22,.18,-8.6,1.6,-11.2,mat(0xf0e8c0));
  sph(.13,-8.6,1.6,-11.2,glow(0xfff4d0));

  /* ===== COLLISION BOUNDS (safety) ===== */
  solid.push({x:0,z:-D/2+.2,hw:W/2,hd:.1});
  solid.push({x:0,z:D/2-.2,hw:W/2,hd:.1});
  solid.push({x:-W/2+.2,z:0,hw:.1,hd:D/2});
  solid.push({x:W/2-.2,z:0,hw:.1,hd:D/2});
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
  const __world = {
    colliders: __cols, seats, uses,
    stairs: [{ minX: 8.05, maxX: 11.15, minZ: 4.0, maxZ: 11.0, axis: 'z', y0: 0, y1: H, level: 0, toLevel: 1 }],
    // FIXED: Changed minZ to 4.0 to connect with stairs
    platforms: [{ level: 1, minX: -W/2, maxX: W/2, minZ: 4.0, maxZ: D/2, h: H }],
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
    crumb: "STATEHOUSE",
    title: "ASSEMBLY \u00b7 2 FLOORS",
    subtitle: "",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: INTERACT",
    isInterior: true,
    sceneId: "statehouse",
    update: (dt) => {
      ctl.update(dt);
    },
    dispose: () => ctl.dispose(),
  };
}

