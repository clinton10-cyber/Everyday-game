import * as THREE from "three";
export function buildGWagon3D(bodyColor="#24282e",rimColor="#9aa3ad"){
  const car=new THREE.Group();
  const paint=new THREE.MeshStandardMaterial({color:new THREE.Color(bodyColor),metalness:.72,roughness:.30});
  const black=new THREE.MeshStandardMaterial({color:0x121417,metalness:.35,roughness:.62});
  const chrome=new THREE.MeshStandardMaterial({color:0xd9dee4,metalness:1,roughness:.12});
  const tire=new THREE.MeshStandardMaterial({color:0x121212,roughness:.94});
  const rim=new THREE.MeshStandardMaterial({color:new THREE.Color(rimColor),metalness:.95,roughness:.24});
  const glass=new THREE.MeshStandardMaterial({color:0x1a2a33,metalness:.6,roughness:.05,transparent:true,opacity:.4,side:THREE.DoubleSide,depthWrite:false});
  const head=new THREE.MeshStandardMaterial({color:0xfff8e2,emissive:0xfff0c2,emissiveIntensity:.85,roughness:.18});
  const tail=new THREE.MeshStandardMaterial({color:0x2a0000,emissive:0xff1800,emissiveIntensity:.8,roughness:.4});
  const amber=new THREE.MeshStandardMaterial({color:0x4a2000,emissive:0xff8a00,emissiveIntensity:.8,roughness:.4});
  const YB=.6,YT=1.15,ZF=-2.3,ZR=2.3,WR=.52,WCY=.44;
  const a0=Math.asin((YB-WCY)/WR),a1=Math.PI-a0,w=Math.cos(a0)*WR;
  const s=new THREE.Shape();
  s.moveTo(ZF,YT);s.lineTo(ZR,YT);s.lineTo(ZR,YB);
  s.lineTo(1.45+w,YB);s.absarc(1.45,WCY,WR,a0,a1,false);
  s.lineTo(-1.45+w,YB);s.absarc(-1.45,WCY,WR,a0,a1,false);
  s.lineTo(ZF,YB);s.closePath();
  const geo=new THREE.ExtrudeGeometry(s,{depth:.08,bevelEnabled:false,curveSegments:14});
  for(const side of [1,-1]){
    const m=new THREE.Mesh(geo,paint);
    m.rotation.y=-Math.PI/2;m.position.x=side>0?0.91:-0.83;
    m.castShadow=m.receiveShadow=true;car.add(m);
  }
  function put(w_,h_,d_,mat,x,y,z){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w_,h_,d_),mat);
    mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;car.add(mesh);return mesh;
  }
  put(1.82,.55,.10,paint,0,.875,-2.25);
  put(1.82,.55,.10,paint,0,.875,2.25);
  put(1.44,.08,4.6,black,0,.62,0);
  put(1.80,.06,1.35,paint,0,1.12,-1.625);
  put(1.82,.08,3.10,paint,0,1.96,.72);
  [.86,-.86].forEach(x=>put(.10,.86,.12,paint,x,1.555,-.875).rotation.x=.18);
  [.87,-.87].forEach(x=>{put(.10,.81,.12,paint,x,1.555,.62);put(.10,.81,.12,paint,x,1.555,2.22);});
  const ws=put(1.72,.88,.04,glass,0,1.555,-.875);ws.rotation.x=.18;ws.castShadow=false;
  put(1.72,.78,.04,glass,0,1.56,2.22).castShadow=false;
  [.84,-.84].forEach(x=>{
    put(.03,.74,1.52,glass,x,1.56,-.17).castShadow=false;
    put(.03,.74,1.55,glass,x,1.56,1.42).castShadow=false;
  });
  [.80,-.80].forEach(x=>put(.07,.07,2.9,black,x,2.04,.75));
  put(1.70,.05,.07,black,0,2.05,-.35);
  put(1.70,.05,.07,black,0,2.05,1.85);
  put(1.80,.24,.26,black,0,.62,-2.34);
  put(1.80,.24,.26,black,0,.62,2.34);
  put(.96,.46,.06,chrome,0,1,-2.325);
  put(.88,.38,.04,black,0,1,-2.345);
  for(let i=0;i<3;i++)put(.05,.38,.05,chrome,-.22+i*.22,1,-2.355);
  [.66,-.66].forEach(x=>{
    const h=new THREE.Mesh(new THREE.CylinderGeometry(.155,.155,.08,16),head);
    h.rotation.x=Math.PI/2;h.position.set(x,1,-2.325);h.castShadow=true;car.add(h);
  });
  [.66,-.66].forEach(x=>put(.22,.09,.16,amber,x,1.19,-1.98));
  [.78,-.78].forEach(x=>put(.13,.30,.07,tail,x,.95,2.31));
  const sp=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.24,20),tire);
  sp.rotation.x=Math.PI/2;sp.position.set(0,1.22,2.48);sp.castShadow=true;car.add(sp);
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(.26,.26,.26,16),black);
  cap.rotation.x=Math.PI/2;cap.position.set(0,1.22,2.49);car.add(cap);
  [1,-1].forEach(s=>{
    put(.12,.09,.06,black,s*.93,1.36,-.82);
    put(.20,.16,.10,black,s*1.03,1.38,-.82);
    put(.05,.05,.22,chrome,s*.925,1.05,-.36);
    put(.05,.05,.22,chrome,s*.925,1.05,.72);
    put(.18,.06,1.60,black,s*.94,.50,.10);
    put(.24,.12,1.10,black,s*.92,.92,-1.45);
    put(.24,.12,1.10,black,s*.92,.92,1.45);
  });
  const cabin=new THREE.MeshStandardMaterial({color:0x1b1a19,metalness:.1,roughness:.88});
  const leather=new THREE.MeshStandardMaterial({color:0x3b2f26,metalness:.05,roughness:.82});
  const dash=new THREE.MeshStandardMaterial({color:0x0e0e0f,metalness:.2,roughness:.68});
  put(1.42,.05,4.30,cabin,0,.685,0);
  [.79,-.79].forEach(x=>put(.06,.50,3.00,cabin,x,.91,.60));
  put(1.62,.30,.55,dash,0,1,-.62);
  put(.46,.17,.06,dash,-.42,1.05,-.885);
  put(.36,.26,.04,black,0,1.02,-.885);
  put(.30,.32,1.00,cabin,0,.84,.10);
  put(.28,.10,.04,chrome,0,1.72,-.88);
  const sw=new THREE.Mesh(new THREE.TorusGeometry(.165,.023,6,20),dash);
  sw.position.set(-.42,1.07,-.42);sw.rotation.x=Math.PI/2-.42;car.add(sw);
  [.42,-.42].forEach(x=>{
    put(.52,.18,.56,leather,x,.79,.15);
    put(.52,.66,.16,leather,x,1.18,.47).rotation.x=.12;
    put(.26,.18,.14,leather,x,1.62,.55);
  });
  put(1.50,.18,.52,leather,0,.79,1.10);
  put(1.50,.60,.16,leather,0,1.17,1.40).rotation.x=.12;
  const wheels=[];
  function wh(x,z,steerable){
    const pivot=new THREE.Group();pivot.position.set(x,.44,z);car.add(pivot);
    const spin=new THREE.Group();pivot.add(spin);
    const t=new THREE.Mesh(new THREE.CylinderGeometry(.44,.44,.26,18,1),tire);
    t.rotation.z=Math.PI/2;t.castShadow=true;spin.add(t);
    const r=new THREE.Mesh(new THREE.CylinderGeometry(.285,.285,.27,16,1),rim);
    r.rotation.z=Math.PI/2;spin.add(r);
    for(let i=0;i<5;i++){
      const s2=new THREE.Mesh(new THREE.BoxGeometry(.29,.075,.50),rim);
      s2.rotation.x=i*Math.PI/5;spin.add(s2);
    }
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.30,10),chrome);
    hub.rotation.z=Math.PI/2;spin.add(hub);
    wheels.push({pivot,spin,steer:steerable});
  }
  wh(-.85,-1.45,true);wh(.85,-1.45,true);
  wh(-.85,1.45,false);wh(.85,1.45,false);
  car.userData.wheels=wheels;
  return car;
}

