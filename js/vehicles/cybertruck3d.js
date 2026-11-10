import * as THREE from "three";
export function buildCybertruck3D(bodyColor="#c4c9d2",rimColor="#9aa0a8"){
  const truck=new THREE.Group();
  const steel=new THREE.MeshStandardMaterial({color:new THREE.Color(bodyColor),metalness:.92,roughness:.28,side:THREE.DoubleSide});
  const glass=new THREE.MeshStandardMaterial({color:0x0b1826,metalness:.55,roughness:.06,transparent:true,opacity:.42,side:THREE.DoubleSide,depthWrite:false});
  const tire=new THREE.MeshStandardMaterial({color:0x0d0d0f,roughness:.95,metalness:.05});
  const rim=new THREE.MeshStandardMaterial({color:new THREE.Color(rimColor),roughness:.35,metalness:.9});
  const under=new THREE.MeshStandardMaterial({color:0x14161a,roughness:.9,side:THREE.DoubleSide});
  const head=new THREE.MeshStandardMaterial({color:0xeaf4ff,emissive:0xa8d4ff,emissiveIntensity:1.6,roughness:.2});
  const tail=new THREE.MeshStandardMaterial({color:0xff2a2a,emissive:0xff1010,emissiveIntensity:1.5,roughness:.3});
  const flare=new THREE.MeshStandardMaterial({color:0x14161a,roughness:.85,metalness:.15,side:THREE.DoubleSide});
  const HW=1.015,FA=1.815,RA=-1.815,WR=.45,WW=.32;
  const P=[[2.84,.28],[2.84,.95],[1.80,1.18],[.55,1.80],[-.60,1.76],[-2.84,1.48],[-2.84,.28]];
  function panel(a,b,w,mat,off=0){
    const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,len),mat);
    m.rotation.x=Math.atan2(dx,dy);
    const nx=dy/len,ny=-dx/len;
    m.position.set(0,(a[1]+b[1])/2+ny*off,(a[0]+b[0])/2+nx*off);
    m.castShadow=m.receiveShadow=true;return m;
  }
  const FW=[[1.45,1.20],[.72,1.20],[.62,1.66],[1.15,1.35]];
  const RW=[[.62,1.20],[-.30,1.20],[-.38,1.66],[.52,1.68]];
  function sideGeo(holes,right,depth){
    const flip=p=>right?[-p[0],p[1]]:[p[0],p[1]];
    const s=new THREE.Shape();
    const o=P.map(flip);s.moveTo(o[0][0],o[0][1]);
    for(let i=1;i<o.length;i++)s.lineTo(o[i][0],o[i][1]);
    s.closePath();
    for(const hp of holes){
      const h=hp.map(flip);const pt=new THREE.Path();
      pt.moveTo(h[0][0],h[0][1]);
      for(let i=1;i<h.length;i++)pt.lineTo(h[i][0],h[i][1]);
      pt.closePath();s.holes.push(pt);
    }
    const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false});
    g.rotateY(right?Math.PI/2:-Math.PI/2);
    return g;
  }
  const sd=.03;
  for(const r of [false,true]){
    const m=new THREE.Mesh(sideGeo([FW,RW],r,sd),steel);
    m.position.x=r?(HW-sd):-(HW-sd);
    m.castShadow=m.receiveShadow=true;truck.add(m);
  }
  truck.add(panel(P[0],P[1],2.03,steel));
  truck.add(panel(P[1],P[2],2.03,steel));
  truck.add(panel(P[2],P[3],1.90,glass,.012));
  truck.add(panel(P[3],P[4],1.90,steel));
  truck.add(panel(P[4],P[5],2.03,steel));
  truck.add(panel(P[5],P[6],2.03,steel));
  truck.add(panel(P[6],P[0],2.03,under));
  function gp(pts,right,x){
    const flip=p=>right?[-p[0],p[1]]:[p[0],p[1]];
    const s=new THREE.Shape();const o=pts.map(flip);
    s.moveTo(o[0][0],o[0][1]);
    for(let i=1;i<o.length;i++)s.lineTo(o[i][0],o[i][1]);
    s.closePath();
    const g=new THREE.ShapeGeometry(s);
    g.rotateY(right?Math.PI/2:-Math.PI/2);
    const m=new THREE.Mesh(g,glass);m.position.x=x;return m;
  }
  for(const r of [false,true]){
    const x=r?HW-sd/2:-(HW-sd/2);
    truck.add(gp(FW,r,x));truck.add(gp(RW,r,x));
  }
  const fbar=new THREE.Mesh(new THREE.BoxGeometry(1.86,.055,.05),head);
  fbar.position.set(0,.80,2.855);truck.add(fbar);
  const rbar=new THREE.Mesh(new THREE.BoxGeometry(1.86,.055,.05),tail);
  rbar.position.set(0,.80,-2.855);truck.add(rbar);
  function wh(){
    const g=new THREE.Group();
    const t=new THREE.Mesh(new THREE.CylinderGeometry(WR,WR,WW,20),tire);
    t.rotation.z=Math.PI/2;g.add(t);
    const r=new THREE.Mesh(new THREE.CylinderGeometry(WR*.66,WR*.66,WW+.01,18),rim);
    r.rotation.z=Math.PI/2;g.add(r);
    const sgeo=new THREE.BoxGeometry(WW+.02,.055,WR*1.08);
    for(let i=0;i<6;i++){
      const sp=new THREE.Mesh(sgeo,new THREE.MeshStandardMaterial({color:0x2a2d33,roughness:.5,metalness:.7}));
      sp.rotation.x=(i/6)*Math.PI*2;sp.rotation.z=Math.PI/2;g.add(sp);
    }
    const h=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,WW+.03,12),
      new THREE.MeshStandardMaterial({color:0x1a1c20,roughness:.4,metalness:.8}));
    h.rotation.z=Math.PI/2;g.add(h);
    return g;
  }
  const wheels=[];
  for(const z of [FA,RA])for(const s of [-1,1]){
    const w=wh();w.position.set(s*.855,WR,z);truck.add(w);wheels.push(w);
  }
  const fs=new THREE.Shape();
  fs.moveTo(-.68,-.42);fs.lineTo(.68,-.42);fs.lineTo(.55,.64);fs.lineTo(-.55,.64);fs.closePath();
  const hh=new THREE.Path();hh.absarc(0,.09,.50,0,Math.PI*2,true);fs.holes.push(hh);
  const fg=new THREE.ExtrudeGeometry(fs,{depth:.14,bevelEnabled:false});
  fg.translate(0,0,-.07);fg.rotateY(-Math.PI/2);
  for(const z of [FA,RA])for(const s of [-1,1]){
    const f=new THREE.Mesh(fg,flare);
    f.position.set(s*(HW+.035),WR,z);truck.add(f);
  }
  const ip=new THREE.MeshStandardMaterial({color:0x1c1e24,roughness:.85,metalness:.15});
  const seat=new THREE.MeshStandardMaterial({color:0xd6d8dc,roughness:.85});
  const bez=new THREE.MeshStandardMaterial({color:0x0a0b0d,roughness:.4,metalness:.5});
  const dash=new THREE.Mesh(new THREE.BoxGeometry(1.88,.055,.6),ip);
  dash.position.set(0,1.145,1.18);truck.add(dash);
  const lo=new THREE.Mesh(new THREE.BoxGeometry(1.86,.28,.12),ip);
  lo.position.set(0,.955,1.42);truck.add(lo);
  const sc=new THREE.Mesh(new THREE.BoxGeometry(.61,.355,.022),bez);
  sc.position.set(0,1.30,1.22);sc.rotation.x=-.16;truck.add(sc);
  const sf=new THREE.Mesh(new THREE.PlaneGeometry(.58,.325),new THREE.MeshBasicMaterial({color:0x1a3050}));
  sf.position.set(0,1.30,1.235);sf.rotation.x=-.16;truck.add(sf);
  const yoke=new THREE.Group();yoke.position.set(.46,1.06,1.0);yoke.rotation.x=-.35;truck.add(yoke);
  const yr=new THREE.Mesh(new THREE.TorusGeometry(.11,.02,6,14),new THREE.MeshStandardMaterial({color:0x1b1d22,roughness:.65}));yoke.add(yr);
  const yp=new THREE.Mesh(new THREE.BoxGeometry(.15,.1,.045),new THREE.MeshStandardMaterial({color:0x1b1d22,roughness:.65}));yoke.add(yp);
  function st(x){const g=new THREE.Group();g.position.set(x,0,.22);
    const c=new THREE.Mesh(new THREE.BoxGeometry(.5,.13,.55),seat);c.position.y=.72;g.add(c);
    const b=new THREE.Mesh(new THREE.BoxGeometry(.5,.72,.14),seat);b.position.set(0,1.1,-.26);b.rotation.x=-.1;g.add(b);
    const hd=new THREE.Mesh(new THREE.BoxGeometry(.34,.2,.13),seat);hd.position.set(0,1.52,-.30);hd.rotation.x=-.1;g.add(hd);
    return g;}
  truck.add(st(.46));truck.add(st(-.46));
  truck.userData.wheels=wheels.map(w=>({mesh:w,spinX:true}));
  return truck;
}

