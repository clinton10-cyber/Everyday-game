import * as THREE from "three";
import { M, EM, box, cyl } from "./kit.js";

const F = {};

F.reception = (g,cx,cz,w,d)=>{
  g.add(box(w*.7,.9,.5,M(0x4a3820,1),cx,.45,cz));
  g.add(box(w*.7,.06,.6,M(0x6b4a2f,1),cx,.93,cz));
  for (let i=0;i<4;i++){
    const x = cx - w*.3 + i*w*.2;
    g.add(box(.4,.06,.4,M(0x222222,1),x,.5,cz+d*.32));
    g.add(box(.4,.5,.06,M(0x222222,1),x,.75,cz+d*.47));
    g.add(cyl(.03,.03,.5,M(0x333333,1),x,.25,cz+d*.32));
  }
  const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(.7,0), M(0x3f7a3a,1));
  pl.position.set(cx-w*.42,1,cz); g.add(pl);
  g.add(cyl(.24,.28,.4,M(0x3a2a1a,1),cx-w*.42,.2,cz));
  const ch = new THREE.Mesh(new THREE.SphereGeometry(.15,10,10), EM(0xfff2c8,2));
  ch.position.set(cx,3,cz); g.add(ch);
};

F.lobby = F.reception;

F.office = (g,cx,cz,w,d)=>{
  g.add(box(w*.5,.06,d*.32,M(0x6b4a2f,1),cx,1.05,cz));
  [[-.45,-.14],[.45,-.14],[-.45,.14],[.45,.14]].forEach(p=>{
    g.add(cyl(.04,.04,1,M(0x2a1f16,1),cx+p[0]*w*.4,.5,cz+p[1]*d*.4));
  });
  const scr = new THREE.Mesh(new THREE.BoxGeometry(w*.22,.36,.03), EM(0x88c8ff,1.2));
  scr.position.set(cx+.1,1.35,cz); g.add(scr);
  g.add(cyl(.28,.32,.08, M(0x2a2a2e,1),cx,.46,cz+.9));
  g.add(box(.5,.6,.08,M(0x2a2a2e,1),cx,.82,cz+1.16));
  g.add(cyl(.04,.04,.46,M(0x444444,1),cx,.23,cz+.9));
  g.add(box(.4,2.2,1.4,M(0x4a3820,1),cx-w*.38,1.1,cz));
  for (let i=0;i<4;i++)
    g.add(box(.36,.08,1.34,M(0x6b4a2f,1),cx-w*.38,.4+i*.55,cz));
  const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(.55,0),M(0x3f7a3a,1));
  pl.position.set(cx+w*.4,.85,cz+d*.3); g.add(pl);
  g.add(cyl(.2,.24,.4,M(0x3a2a1a,1),cx+w*.4,.2,cz+d*.3));
};

F.meeting = (g,cx,cz,w,d)=>{
  g.add(box(w*.7,.06,d*.4,M(0x3a2a1a,1),cx,1,cz));
  g.add(box(w*.7,.8,d*.4,M(0x2a1f16,1),cx,.5,cz));
  for (let r=0;r<2;r++) for (let c=0;c<4;c++){
    const x = cx-w*.3 + c*w*.2;
    const z = cz + (r===0 ? d*.32 : -d*.32);
    g.add(box(.36,.06,.36,M(0x222222,1),x,.5,z));
    g.add(box(.36,.5,.06,M(0x222222,1),x,.75,z + (r===0 ? .16 : -.16)));
  }
  g.add(box(w*.5,.7,.05,M(0x141414,.5,.4),cx,1.8,cz-d*.44));
  const s = new THREE.Mesh(new THREE.BoxGeometry(w*.46,.55,.02), EM(0x224466,1.4));
  s.position.set(cx,1.8,cz-d*.38); g.add(s);
};

F.bedroom = (g,cx,cz,w,d)=>{
  g.add(box(w*.5,.4,d*.55,M(0x4a3820,1),cx,.2,cz));
  g.add(box(w*.48,.22,d*.53,M(0xa55a5a,1),cx,.5,cz));
  g.add(box(w*.46,.14,d*.12,M(0xf0e8d8,1),cx,.65,cz-d*.2));
  g.add(box(w*.5,.9,.14,M(0x3a2a1a,1),cx,.65,cz-d*.28));
  [1,-1].forEach(s=>{
    g.add(box(.4,.5,.4,M(0x4a3820,1),cx+s*w*.4,.25,cz-d*.25));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.14,10,10), EM(0xffddaa,1.6));
    lamp.position.set(cx+s*w*.4,.62,cz-d*.25); g.add(lamp);
    g.add(cyl(.02,.02,.14,M(0x222222,1),cx+s*w*.4,.5,cz-d*.25));
  });
  g.add(box(.6,2.4,1.4,M(0x3a2a1a,1),cx-w*.42,1.2,cz+d*.2));
  const rug = new THREE.Mesh(new THREE.BoxGeometry(w*.5,.02,d*.3), M(0x8a3a3a,1));
  rug.position.set(cx,.05,cz+d*.28); g.add(rug);
};

F.bath = (g,cx,cz,w,d)=>{
  g.add(box(.5,.7,.35,M(0xf4f4f4,1),cx-w*.3,.35,cz-d*.3));
  g.add(box(.55,.1,.38,M(0xe8e8e8,1),cx-w*.3,.05,cz-d*.24));
  g.add(box(.7,.5,.4,M(0xf4f4f4,1),cx+w*.3,.75,cz-d*.3));
  g.add(box(.6,.06,.34,M(0xdcdcdc,1),cx+w*.3,1.02,cz-d*.3));
  g.add(box(.6,.6,.05,M(0x2a3a4a,.15,1),cx+w*.3,1.6,cz-d*.42));
  const glass = new THREE.MeshStandardMaterial({color:0x88c8ff,roughness:.05,metalness:.1,transparent:true,opacity:.32});
  [w*.4, -w*.4].forEach(x=>{
    const s = new THREE.Mesh(new THREE.BoxGeometry(.05,2,d*.6), glass);
    s.position.set(cx+x,1,cz+d*.15); g.add(s);
  });
  const back = new THREE.Mesh(new THREE.BoxGeometry(w*.8,2,.05), glass);
  back.position.set(cx,1,cz+d*.45); g.add(back);
  g.add(cyl(.06,.06,.6,M(0xcfcfcf,.3,1),cx,1.8,cz+d*.3));
};

F.kitchen = (g,cx,cz,w,d)=>{
  g.add(box(w*.8,.9,.5,M(0x8a7a5a,1),cx,.45,cz-d*.3));
  g.add(box(w*.8,.06,.6,M(0xcfcfcf,.5,.5),cx,.93,cz-d*.3));
  g.add(box(.7,.06,.5,M(0x1c1c1c,.4,.6),cx-w*.15,.97,cz-d*.3));
  g.add(box(.7,2,.7,M(0xdcdcdc,.3,.4),cx+w*.35,1,cz+d*.3));
  g.add(box(.68,.02,.7,M(0x222222,1),cx+w*.35,1.4,cz+d*.3));
  g.add(box(.5,.06,.4,M(0x9aa2ab,.2,.8),cx+w*.05,.97,cz-d*.3));
  g.add(cyl(.03,.03,.4,M(0xcfcfcf,.3,1),cx+w*.05,1.2,cz-d*.42));
};

F.dining = (g,cx,cz,w,d)=>{
  g.add(box(w*.7,.06,d*.4,M(0x6b4a2f,1),cx,.75,cz));
  g.add(box(w*.5,.7,d*.28,M(0x4a3820,1),cx,.38,cz));
  for (let c=0;c<3;c++){
    const x = cx-w*.25+c*w*.25;
    [-1,1].forEach(s=>{
      g.add(box(.42,.06,.42,M(0x222222,1),x,.5,cz+s*d*.25));
      g.add(box(.42,.5,.06,M(0x222222,1),x,.75,cz+s*d*.31));
    });
  }
};

F.lounge = (g,cx,cz,w,d)=>{
  g.add(box(w*.6,.4,.6,M(0x8a4a4a,1),cx-w*.1,.2,cz-d*.15));
  g.add(box(w*.6,.6,.15,M(0x8a4a4a,1),cx-w*.1,.5,cz-d*.4));
  g.add(box(w*.15,.6,.6,M(0x8a4a4a,1),cx+w*.2,.5,cz-d*.15));
  g.add(box(w*.4,.06,d*.25,M(0x6b4a2f,1),cx,.45,cz+d*.15));
  g.add(box(w*.5,.6,.1,M(0x141414,.6,.3),cx,1.6,cz-d*.44));
  const scr = new THREE.Mesh(new THREE.BoxGeometry(w*.46,.5,.02), EM(0x224466,1.4));
  scr.position.set(cx,1.6,cz-d*.38); g.add(scr);
};

F.library = (g,cx,cz,w,d)=>{
  const shelf = (x,z,rot)=>{
    const s = box(w*.9,2.6,.4,M(0x4a3820,1),x,1.3,z);
    s.rotation.y = rot; g.add(s);
    for (let i=0;i<4;i++){
      const b = box(w*.85,.1,.42,M(0x6b4a2f,1),x,.35+i*.55,z);
      b.rotation.y = rot; g.add(b);
    }
  };
  shelf(cx, cz-d*.4, 0);
  shelf(cx-w*.3, cz+d*.35, Math.PI/2);
  g.add(box(w*.7,.06,d*.25,M(0x6b4a2f,1),cx,.75,cz+d*.15));
  g.add(box(w*.5,.7,d*.2,M(0x4a3820,1),cx,.38,cz+d*.15));
  g.add(box(.42,.06,.42,M(0x222222,1),cx,.5,cz+d*.5));
};

F.lab = (g,cx,cz,w,d)=>{
  for (let i=0;i<3;i++){
    const x = cx-w*.3+i*w*.3;
    g.add(box(w*.22,.85,d*.35,M(0xcfcfcf,.5,.5),x,.42,cz));
    g.add(box(w*.22,.06,d*.38,M(0xe8e8e8,.4,.6),x,.87,cz));
    g.add(cyl(.05,.05,.35,M(0x9aa2ab,.3,1),x,1.1,cz-d*.1));
    for (let j=0;j<3;j++){
      const tube = cyl(.04,.04,.18,M(0xcce4ff,.2,.5),x-0.15+j*0.15,.98,cz-d*.05,12);
      g.add(tube);
    }
  }
};

F.lecture = (g,cx,cz,w,d)=>{
  for (let row=0;row<5;row++){
    for (let col=0;col<8;col++){
      const x = cx-w*.4+col*w*.11;
      const z = cz-d*.3+row*d*.14;
      g.add(box(.5,.3,.42,M(0x3a2a1a,1),x,.15,z));
      g.add(box(.5,.5,.06,M(0x3a2a1a,1),x,.45,z-d*.05));
    }
  }
  g.add(box(w*.6,.1,.05,M(0x0f2a12,.6),cx,2.4,cz-d*.45));
  const s = new THREE.Mesh(new THREE.BoxGeometry(w*.56,.7,.02), EM(0x2a4a6a,1.2));
  s.position.set(cx,2.4,cz-d*.4); g.add(s);
};

F.ward = (g,cx,cz,w,d)=>{
  const bed = (x,z)=>{
    g.add(box(.9,.5,1.9,M(0xdcdcdc,1),x,.25,z));
    g.add(box(.85,.12,1.85,M(0xf0f0f0,1),x,.56,z));
    g.add(box(.85,.14,.4,M(0xf8f8f8,1),x,.65,z-.75));
  };
  bed(cx-w*.3, cz);
  bed(cx+w*.3, cz);
  g.add(box(.3,.5,.3,M(0xcfcfcf,1),cx,.25,cz+d*.35));
  const mon = new THREE.Mesh(new THREE.BoxGeometry(.4,.3,.05), EM(0x22ff44,1.2));
  mon.position.set(cx,1.2,cz+d*.38); g.add(mon);
};

F.treatment = F.ward;

F.gym = (g,cx,cz,w,d)=>{
  for (let i=0;i<3;i++){
    const x = cx-w*.3+i*w*.3;
    g.add(cyl(.06,.06,1.8,M(0x2a2a2a,1),x,.9,cz-d*.2,12));
    g.add(box(.6,.06,.15,M(0x1c1c1c,1),x,1.75,cz-d*.2));
  }
  g.add(box(w*.6,.15,d*.25,M(0x2a2a2a,1),cx,.075,cz+d*.3));
  for (let i=0;i<5;i++){
    g.add(cyl(.05,.05,.5,M(0x2a2a2a,1),cx-w*.3+i*.15,.25,cz+d*.3,10));
  }
};

F.pool = (g,cx,cz,w,d)=>{
  const water = new THREE.Mesh(new THREE.BoxGeometry(w*.85,.05,d*.7), 
    new THREE.MeshStandardMaterial({color:0x2a9ac4, roughness:.05, metalness:.5, transparent:true, opacity:.85}));
  water.position.set(cx,.16,cz); g.add(water);
  g.add(box(w*.9,.12,d*.75,M(0xe8e8e8,1),cx,.06,cz));
};

F.garden = (g,cx,cz,w,d)=>{
  for (let i=0;i<7;i++){
    const x = cx-w*.35+Math.random()*w*.7;
    const z = cz-d*.35+Math.random()*d*.7;
    g.add(cyl(.06,.08,.8,M(0x3a2a1a,1),x,.4,z,8));
    const fol = new THREE.Mesh(new THREE.IcosahedronGeometry(.5,0), M(0x3f7a3a,1));
    fol.position.set(x,1,z); g.add(fol);
  }
  g.add(box(w*.9,.06,d*.9,M(0x5a7a5a,1),cx,.03,cz));
};

F.plaza = (g,cx,cz,w,d)=>{
  g.add(box(w*.9,.12,d*.9,M(0x8a8880,1),cx,.06,cz));
  const fountain = cyl(.6,.8,.5,M(0xcfcfcf,.3,1),cx,.25,cz,20);
  g.add(fountain);
  const spout = new THREE.Mesh(new THREE.SphereGeometry(.2,10,10), EM(0x88c8ff,1.2));
  spout.position.set(cx,.6,cz); g.add(spout);
};

F.stage = (g,cx,cz,w,d)=>{
  g.add(box(w*.9,.6,d*.5,M(0x2a1e28,1),cx,.3,cz-d*.15));
  g.add(cyl(.06,.06,3.5,M(0x141414,1),cx-w*.35,1.75,cz-d*.4,10));
  g.add(cyl(.06,.06,3.5,M(0x141414,1),cx+w*.35,1.75,cz-d*.4,10));
  const spot = new THREE.Mesh(new THREE.SphereGeometry(.2,10,10), EM(0xffddaa,2.5));
  spot.position.set(cx-w*.35,3.4,cz-d*.4); g.add(spot);
  const spot2 = spot.clone(); spot2.position.set(cx+w*.35,3.4,cz-d*.4);
  g.add(spot2);
};

F.arcade = (g,cx,cz,w,d)=>{
  for (let i=0;i<4;i++) for (let j=0;j<2;j++){
    const x = cx-w*.3+i*w*.2;
    const z = cz-d*.25+j*d*.5;
    g.add(box(.9,1.8,.6,M(0x1c1a34,1),x,.9,z));
    const scr = new THREE.Mesh(new THREE.BoxGeometry(.65,.45,.02), EM(0xff5ee0,1.6));
    scr.position.set(x,1.35,z+.31); g.add(scr);
    const scr2 = new THREE.Mesh(new THREE.BoxGeometry(.65,.45,.02), EM(0x5ee0ff,1.6));
    scr2.position.set(x,1.35,z-.31); scr2.rotation.y = Math.PI; g.add(scr2);
  }
};

F.cafe = (g,cx,cz,w,d)=>{
  g.add(box(w*.7,.9,.5,M(0x6b4a2f,1),cx,.45,cz-d*.3));
  g.add(box(w*.7,.06,.6,M(0x8a7a5a,1),cx,.93,cz-d*.3));
  for (let c=0;c<3;c++) for (let r=0;r<2;r++){
    const x = cx-w*.25+c*w*.25;
    const z = cz+d*.15+r*d*.3;
    g.add(cyl(.3,.3,.06,M(0x4a3820,1),x,.75,z,16));
    g.add(cyl(.05,.06,.75,M(0x2a1f16,1),x,.37,z,10));
    g.add(cyl(.18,.22,.06,M(0x222222,1),x,.75,z+.55,12));
    g.add(cyl(.18,.22,.06,M(0x222222,1),x,.75,z-.55,12));
  }
};

F.stall = (g,cx,cz,w,d)=>{
  g.add(box(w*.9,.9,d*.35,M(0x6b4a2f,1),cx,.45,cz-d*.3));
  g.add(box(w*.9,.1,d*.42,M(0x8a7a5a,1),cx,.95,cz-d*.3));
  for (let i=0;i<6;i++){
    const c = [0xff6b6b, 0xffcc5e, 0x88c868, 0x5ee0ff, 0xb388ff, 0xffa04d][i];
    g.add(box(.3,.25,.3,M(c,1),cx-w*.35+i*w*.14,1.15,cz-d*.3));
  }
  for (let i=0;i<3;i++){
    g.add(box(.4,.4,.4,M(0xc8b898,1),cx-w*.2+i*.3,.2,cz+d*.1));
  }
};

F.showroom = (g,cx,cz,w,d)=>{
  g.add(box(w*.9,.2,d*.9,M(0x22262c,1),cx,.1,cz));
  const marks = [[-4,0],[0,0],[4,0],[-4,4],[0,4],[4,4]];
  marks.forEach(m=>{
    if (Math.abs(m[0]) < w*.45 && Math.abs(m[1]) < d*.45){
      g.add(cyl(.5,.5,.05,M(0x2a2e36,1),cx+m[0],.22,cz+m[1],20));
      const ar = new THREE.Mesh(new THREE.TorusGeometry(.55,.03,6,24), EM(0x5ee0ff,1.4));
      ar.rotation.x = -Math.PI/2;
      ar.position.set(cx+m[0],.26,cz+m[1]); g.add(ar);
    }
  });
};

F.playground = (g,cx,cz,w,d)=>{
  g.add(box(1.5,.1,1.5,M(0x4a3820,1),cx,.9,cz));
  [-1,1].forEach(sx=>[-1,1].forEach(sz=>{
    g.add(cyl(.06,.06,1.8,M(0x2a2a2a,1),cx+sx*.7,.9,cz+sz*.7,8));
  }));
  g.add(cyl(.15,.15,2.4,M(0x2a2a2a,1),cx+w*.3,1.2,cz,12));
  const s1 = new THREE.Mesh(new THREE.BoxGeometry(2,.15,.3), M(0x8a7a5a,1));
  s1.position.set(cx-w*.1,2.3,cz); g.add(s1);
};

F.nursery = F.garden;
F.restaurant = F.dining;
F.control = (g,cx,cz,w,d)=>{
  g.add(box(w*.6,.9,.5,M(0x2a2a2e,1),cx,.45,cz));
  g.add(box(w*.6,.06,.6,M(0x4a4a4e,1),cx,.93,cz));
  for (let i=0;i<4;i++){
    const m = new THREE.Mesh(new THREE.BoxGeometry(.5,.35,.03), EM([0x88c8ff,0xffcc5e,0x88ff88,0xff8888][i],1.2));
    m.position.set(cx-w*.2+(i%2)*.4,1.5,cz-d*.2+Math.floor(i/2)*.4); g.add(m);
  }
  for (let i=0;i<6;i++){
    const l = new THREE.Mesh(new THREE.SphereGeometry(.07,10,10), EM(0x5ee0ff,2));
    l.position.set(cx-w*.3+i*.12,.95,cz+.35); g.add(l);
  }
};
F.boarding = F.plaza;
F.changing = (g,cx,cz,w,d)=>{
  for (let i=0;i<6;i++){
    const x = cx-w*.3+ (i%3)*w*.3;
    const z = cz-d*.2 + Math.floor(i/3)*d*.4;
    g.add(box(.7,1.8,.5,M(0x5a6a7a,1),x,.9,z));
    g.add(cyl(.05,.05,.15,M(0x222222,1),x,.9,z-.28,8));
  }
};
F.vip = F.lounge;

export function furnish(type, g, cx, cz, w, d, h){
  const fn = F[type] || F.office;
  fn(g, cx, cz, w, d, h);
}

