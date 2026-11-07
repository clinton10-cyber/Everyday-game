import * as THREE from "three";

const _euler = new THREE.Euler();
const _quat  = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0,0,1);
const _tmpV  = new THREE.Vector3();

class Builder {
  constructor(){ this.parts = []; }
  add(geo, mat, color){
    this.parts.push({ geo, mat, color: color instanceof THREE.Color ? color : new THREE.Color(color) });
    return this;
  }
  box(w,h,d, x,y,z, color, rx,ry,rz){
    rx=rx||0; ry=ry||0; rz=rz||0;
    const g = new THREE.BoxGeometry(w,h,d);
    _euler.set(rx,ry,rz);
    const m = new THREE.Matrix4().makeRotationFromEuler(_euler);
    m.setPosition(x,y,z);
    return this.add(g,m,color);
  }
  cyl(rt,rb,h,seg, x,y,z, color, rx,ry,rz, open, t0, tl){
    rx=rx||0; ry=ry||0; rz=rz||0;
    const g = new THREE.CylinderGeometry(rt,rb,h,seg,1,open||false,t0||0,tl||Math.PI*2);
    _euler.set(rx,ry,rz);
    const m = new THREE.Matrix4().makeRotationFromEuler(_euler);
    m.setPosition(x,y,z);
    return this.add(g,m,color);
  }
  torus(r, tube, rs, ts, x,y,z, color, rx,ry,rz){
    rx=rx||0; ry=ry||0; rz=rz||0;
    const g = new THREE.TorusGeometry(r, tube, rs, ts);
    _euler.set(rx,ry,rz);
    const m = new THREE.Matrix4().makeRotationFromEuler(_euler);
    m.setPosition(x,y,z);
    return this.add(g,m,color);
  }
  beamX(x, y1,z1, y2,z2, w,t, color){
    const dy=y2-y1, dz=z2-z1, L=Math.hypot(dy,dz);
    const g = new THREE.BoxGeometry(w,t,L);
    const m = new THREE.Matrix4().makeRotationX(Math.atan2(-dy,dz));
    m.setPosition(x,(y1+y2)/2,(z1+z2)/2);
    return this.add(g,m,color);
  }
  strut(a, b, w,t, color){
    _tmpV.set(b[0]-a[0], b[1]-a[1], b[2]-a[2]);
    const L = _tmpV.length();
    const g = new THREE.BoxGeometry(w,t,L);
    _quat.setFromUnitVectors(_zAxis, _tmpV.normalize());
    const m = new THREE.Matrix4().makeRotationFromQuaternion(_quat);
    m.setPosition((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);
    return this.add(g,m,color);
  }
  plate(pts, holes, t, xCenter, color){
    const shape = new THREE.Shape();
    shape.moveTo(pts[0][0], pts[0][1]);
    for (let i=1;i<pts.length;i++) shape.lineTo(pts[i][0], pts[i][1]);
    shape.closePath();
    if (holes) for (const h of holes){
      const p = new THREE.Path();
      p.moveTo(h[0][0], h[0][1]);
      for (let i=1;i<h.length;i++) p.lineTo(h[i][0], h[i][1]);
      p.closePath();
      shape.holes.push(p);
    }
    const g = new THREE.ExtrudeGeometry(shape, {
      depth:t, bevelEnabled:false, curveSegments:3, steps:1
    });
    g.rotateY(-Math.PI/2);
    g.translate(xCenter + t/2, 0, 0);
    return this.add(g, new THREE.Matrix4(), color);
  }
}

function mergeBuilder(B, material){
  const parts = B.parts;
  let total = 0;
  for (const p of parts){
    if (p.geo.index) p.geo = p.geo.toNonIndexed();
    p.geo.applyMatrix4(p.mat);
    total += p.geo.attributes.position.count;
  }
  const pos = new Float32Array(total*3);
  const nor = new Float32Array(total*3);
  const col = new Float32Array(total*3);
  let o = 0;
  for (const p of parts){
    const P = p.geo.attributes.position.array;
    const N = p.geo.attributes.normal.array;
    const n = p.geo.attributes.position.count;
    pos.set(P, o*3);
    nor.set(N, o*3);
    const c = p.color;
    for (let i=0;i<n;i++){
      const k = (o+i)*3;
      col[k]=c.r; col[k+1]=c.g; col[k+2]=c.b;
    }
    o += n;
    p.geo.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  g.setAttribute('normal',   new THREE.BufferAttribute(nor,3));
  g.setAttribute('color',    new THREE.BufferAttribute(col,3));
  g.computeBoundingSphere();
  return new THREE.Mesh(g, material);
}

const C = {
  zF: 2.42, zR: -2.42,
  yBot: 0.46,
  zWF: 1.52, zWR: -1.38,
  archR: 0.56, archY: 0.46,
  wheelR: 0.44
};

function arcOver(p, zc, yc, r, yEnd, steps){
  const s = Math.asin(Math.max(-1, Math.min(1, (yEnd-yc)/r)));
  const a0 = Math.PI - s, a1 = s;
  for (let i=0;i<=steps;i++){
    const a = a0 + (a1-a0)*i/steps;
    p.push([zc + r*Math.cos(a), yc + r*Math.sin(a)]);
  }
}

function silhouettePts(){
  const p = [];
  p.push([C.zF, C.yBot]);
  p.push([C.zF, 1.10]);
  p.push([C.zF-0.03, 1.24]);
  p.push([C.zF-0.14, 1.36]);
  p.push([ 1.15, 1.39]);
  p.push([ 0.62, 1.44]);
  p.push([-1.90, 1.46]);
  p.push([-2.28, 1.44]);
  p.push([C.zR, 1.28]);
  p.push([C.zR, C.yBot]);
  arcOver(p, C.zWR, C.archY, C.archR, C.yBot, 10);
  arcOver(p, C.zWF, C.archY, C.archR, C.yBot, 10);
  p.push([C.zF, C.yBot]);
  return p;
}

function aperturePts(){
  const p = [];
  p.push([ 0.90, 0.72]);
  p.push([ 0.90, 1.40]);
  p.push([-2.16, 1.40]);
  p.push([-2.16, 0.72]);
  arcOver(p, C.zWR, C.archY, 0.68, 0.72, 10);
  return p;
}

function frontBlockPts(){
  const p = [];
  p.push([2.412, C.yBot]);
  p.push([2.412, 1.10]);
  p.push([2.386, 1.24]);
  p.push([2.286, 1.36]);
  p.push([ 1.15, 1.39]);
  p.push([ 0.90, 1.412]);
  p.push([ 0.90, C.yBot]);
  arcOver(p, C.zWF, C.archY, C.archR, C.yBot, 10);
  return p;
}
function rearBlockPts(){
  const p = [];
  p.push([-2.16, C.yBot]);
  p.push([-2.16, 1.412]);
  p.push([-2.28, 1.44]);
  p.push([-2.412, 1.28]);
  p.push([-2.412, C.yBot]);
  return p;
}

export function buildRangeRover3D(bodyColor, rimColor){
  const PAINT   = new THREE.Color(bodyColor || 0x47525e);
  const PAINT_D = new THREE.Color(0x39434e);
  const TRIM    = 0x181a1e;
  const CHROME  = 0xc2c8ce;
  const GLASSC  = 0x0d151f;
  const TIRE    = 0x15161a;
  const RIM     = new THREE.Color(rimColor || 0xa8adb3);
  const LAMP_W  = 0xe6eef7;
  const LAMP_R  = 0xb81c1c;
  const LAMP_A  = 0xff9d20;
  const LEATHER = 0xbf9f78;
  const LEATHER2= 0x9c7f57;
  const DASHC   = 0x212327;
  const DASHC2  = 0x2e3136;
  const HEADLIN = 0xd3d0c9;
  const WOOD    = 0x4b3323;

  const matPaint = new THREE.MeshPhongMaterial({
    vertexColors:true, shininess:72, specular:0x2a2e33,
    side:THREE.DoubleSide
  });
  const matGlass = new THREE.MeshPhongMaterial({
    color:0x16212c, transparent:true, opacity:0.52,
    shininess:120, specular:0xaaccff, side:THREE.DoubleSide, depthWrite:false
  });

  const root = new THREE.Group();
  const B = new Builder();
  const G = new Builder();

  function addWheel(B, xc, z){
    const r = C.wheelR, w = 0.32;
    const out = Math.sign(xc);
    B.cyl(r, r, w, 16, xc, r, z, TIRE, 0,0,Math.PI/2);
    B.cyl(0.31,0.31,0.22,14, xc, r, z, RIM, 0,0,Math.PI/2);
    const fx = xc + out*0.125;
    for (let i=0;i<5;i++)
      B.box(0.055, 0.54, 0.10, fx, r, z, RIM, i*Math.PI*2/5, 0, 0);
    B.cyl(0.10,0.10,0.07,8, xc+out*0.135, r, z, 0x2a2c30, 0,0,Math.PI/2);
    B.cyl(0.20,0.20,0.05,10, xc-out*0.10, r, z, 0x3a3d40, 0,0,Math.PI/2);
  }

  function addSeat(B, x, z){
    B.box(0.48, 0.10, 0.46, x, 0.790, z, DASHC);
    B.box(0.52, 0.14, 0.52, x, 0.860, z, LEATHER);
    B.box(0.46, 0.09, 0.46, x, 0.935, z, LEATHER);
    B.box(0.52, 0.62, 0.16, x, 1.135, z-0.36, LEATHER, -0.15,0,0);
    B.box(0.09, 0.50, 0.15, x-0.215, 1.150, z-0.345, LEATHER2, -0.15,0,0);
    B.box(0.09, 0.50, 0.15, x+0.215, 1.150, z-0.345, LEATHER2, -0.15,0,0);
    B.box(0.13, 0.30, 0.16, x-0.29, 0.940, z-0.05, LEATHER2);
    B.box(0.13, 0.30, 0.16, x+0.29, 0.940, z-0.05, LEATHER2);
    B.box(0.25, 0.18, 0.12, x, 1.500, z-0.415, LEATHER2, -0.15,0,0);
    B.box(0.26, 0.04, 0.06, x-0.14, 1.300, z-0.36, DASHC);
  }

  /* Body shell */
  const outer = silhouettePts();
  const hole  = aperturePts();
  B.plate(outer, [hole], 0.07,  0.955, PAINT);
  B.plate(outer, [hole], 0.07, -0.955, PAINT);
  B.plate(frontBlockPts(), null, 1.96, 0, PAINT);
  B.plate(rearBlockPts(),  null, 1.96, 0, PAINT);

  B.box(1.86, 0.26, 3.10, 0, 0.57, -0.63, 0x2b2d31);
  B.box(0.30, 0.14, 2.10, 0, 0.70, -0.55, 0x33363a);

  for (const z of [C.zWF, C.zWR]){
    B.cyl(0.552,0.552,1.90,12, 0, C.archY, z, 0x17191c, 0,0,Math.PI/2, true, Math.PI, Math.PI);
  }

  addWheel(B,  0.83, C.zWF);
  addWheel(B, -0.83, C.zWF);
  addWheel(B,  0.83, C.zWR);
  addWheel(B, -0.83, C.zWR);

  B.box(0.07, 0.13, 3.30,  0.995, 0.52, -0.60, TRIM);
  B.box(0.07, 0.13, 3.30, -0.995, 0.52, -0.60, TRIM);

  B.box(1.72, 0.085, 2.42, 0, 1.792, -0.84, PAINT);
  B.box(1.74, 0.05, 0.16, 0, 1.735, 0.34, PAINT);
  B.box(1.70, 0.06, 0.26, 0, 1.845, -1.96, PAINT_D);
  B.box(1.62, 0.025, 2.30, 0, 1.735, -0.84, HEADLIN);
  B.box(1.40, 0.02, 1.35, 0, 1.843, -0.55, GLASSC);

  for (const s of [1,-1]){
    const x = s*0.852;
    B.beamX(x, 1.42, 0.95, 1.775, 0.39, 0.10, 0.115, PAINT);
    B.box(0.105, 0.36, 0.15, x, 1.59, -0.72, PAINT);
    B.box(0.105, 0.36, 0.22, x, 1.59, -2.05, PAINT);
    B.beamX(x, 1.42, -2.20, 1.775, -2.05, 0.10, 0.115, PAINT);
    B.box(0.075, 0.07, 2.62, x, 1.425, -0.62, PAINT_D);
    B.box(0.075, 0.075, 2.40, x, 1.752, -0.84, PAINT_D);
    B.box(0.05, 0.05, 2.20, s*0.76, 1.885, -0.85, CHROME);
    B.box(0.02, 0.035, 3.00, s*0.997, 1.435, -0.60, CHROME);
  }

  G.beamX(0, 1.44, 0.92, 1.762, 0.40, 1.63, 0.045, GLASSC);
  G.beamX(0, 1.42, -2.20, 1.762, -2.05, 1.60, 0.045, GLASSC);

  B.box(1.52, 0.30, 0.06, 0, 1.185, 2.415, 0x0d0f12);
  for (let i=0;i<4;i++)
    B.box(1.48, 0.022, 0.045, 0, 1.075 + i*0.072, 2.432, CHROME);
  B.box(0.62, 0.16, 0.07,  0.655, 1.165, 2.412, LAMP_W);
  B.box(0.62, 0.16, 0.07, -0.655, 1.165, 2.412, LAMP_W);
  B.box(0.54, 0.035,0.055, 0.655, 1.055, 2.425, 0xffffff);
  B.box(0.54, 0.035,0.055,-0.655, 1.055, 2.425, 0xffffff);
  B.box(1.94, 0.32, 0.12, 0, 0.735, 2.395, TRIM);
  B.box(1.40, 0.24, 0.09, 0, 0.720, 2.425, 0x08090b);
  B.box(0.13, 0.09, 0.06,  0.80, 0.815, 2.435, LAMP_A);
  B.box(0.13, 0.09, 0.06, -0.80, 0.815, 2.435, LAMP_A);
  B.box(1.20, 0.07, 0.22, 0, 0.505, 2.355, 0x9aa0a6);
  B.box(0.46, 0.13, 0.02, 0, 0.905, 2.448, 0xe8e8e4);

  B.box(0.16, 0.36, 0.09,  0.885, 1.185, -2.415, LAMP_R);
  B.box(0.16, 0.36, 0.09, -0.885, 1.185, -2.415, LAMP_R);
  B.box(1.94, 0.34, 0.12, 0, 0.700, -2.395, TRIM);
  B.box(1.24, 0.15, 0.10, 0, 0.545, -2.425, 0x101214);
  B.cyl(0.062,0.062,0.14,8,  0.68, 0.545, -2.46, CHROME, Math.PI/2,0,0);
  B.cyl(0.062,0.062,0.14,8, -0.68, 0.545, -2.46, CHROME, Math.PI/2,0,0);
  B.box(0.46, 0.13, 0.02, 0, 0.960, -2.448, 0xe8e8e4);
  B.box(1.30, 0.05, 0.06, 0, 1.455, -2.30, CHROME);

  for (const s of [1,-1]){
    B.box(0.24, 0.055, 0.05, s*0.998, 1.235, -0.02, CHROME);
    B.box(0.24, 0.055, 0.05, s*0.998, 1.235, -1.42, CHROME);
    B.strut([s*0.96,1.345,0.74],[s*1.13,1.395,0.70], 0.09,0.09, PAINT_D);
    B.box(0.07, 0.15, 0.24, s*1.155, 1.400, 0.69, PAINT_D);
    B.box(0.02, 0.10, 0.18, s*1.192, 1.400, 0.69, GLASSC);
    B.box(0.05, 0.13, 0.26, s*1.00, 1.14, 1.36, TRIM);
  }

  B.box(1.84, 0.34, 0.46, 0, 1.005, 0.670, DASHC);
  B.box(1.84, 0.09, 0.50, 0, 1.210, 0.660, DASHC2);
  B.box(1.66, 0.10, 0.16, 0, 1.285, 0.790, DASHC2);
  B.box(0.50, 0.13, 0.30, -0.42, 1.315, 0.700, DASHC);
  B.box(0.42, 0.13, 0.03, -0.42, 1.255, 0.560, 0x0a1622);
  B.box(0.38, 0.28, 0.05, 0, 1.020, 0.425, 0x101317);
  B.box(0.34, 0.24, 0.01, 0, 1.020, 0.398, 0x1c3a54);
  B.box(0.30, 0.09, 0.04,  0.66, 1.135, 0.435, 0x0e1013);
  B.box(0.30, 0.09, 0.04, -0.66, 1.135, 0.435, 0x0e1013);
  B.box(0.05, 0.32, 0.46,  0.905, 1.005, 0.670, DASHC2);
  B.box(0.05, 0.32, 0.46, -0.905, 1.005, 0.670, DASHC2);

  B.cyl(0.045,0.045,0.30,8, -0.42, 1.115, 0.735, DASHC, Math.PI/2.35,0,0);
  B.torus(0.170, 0.024, 6, 16, -0.42, 1.175, 0.575, DASHC, 0.35,0,0);
  B.box(0.20, 0.07, 0.05, -0.42, 1.175, 0.575, DASHC2, 0.35,0,0);
  B.box(0.06, 0.03, 0.02, -0.42, 1.175, 0.545, CHROME);

  B.box(0.32, 0.30, 0.98, 0, 0.860, -0.150, DASHC);
  B.box(0.30, 0.07, 0.44, 0, 1.030, -0.360, DASHC2);
  B.cyl(0.022,0.030,0.16,8, 0, 0.985, 0.100, CHROME, 0.2,0,0);
  B.cyl(0.036,0.036,0.04,10,  0.10, 0.985, -0.05, 0x3a3d42);
  B.cyl(0.036,0.036,0.04,10, -0.10, 0.985, -0.05, 0x3a3d42);

  addSeat(B, -0.43, -0.20);
  addSeat(B,  0.43, -0.20);
  B.box(1.52, 0.14, 0.52, 0, 0.845, -1.44, LEATHER);
  B.box(0.44, 0.08, 0.44, -0.50, 0.905, -1.44, LEATHER);
  B.box(0.44, 0.08, 0.44,  0.50, 0.905, -1.44, LEATHER);
  B.box(1.52, 0.60, 0.15, 0, 1.140, -1.755, LEATHER, -0.16,0,0);
  B.box(0.24, 0.17, 0.11, -0.50, 1.510, -1.795, LEATHER2, -0.16,0,0);
  B.box(0.24, 0.17, 0.11,  0.00, 1.510, -1.795, LEATHER2, -0.16,0,0);
  B.box(0.24, 0.17, 0.11,  0.50, 1.510, -1.795, LEATHER2, -0.16,0,0);
  B.box(0.10, 0.34, 0.50, -0.80, 0.980, -1.44, LEATHER2);
  B.box(0.10, 0.34, 0.50,  0.80, 0.980, -1.44, LEATHER2);

  B.strut([0,1.720,0.36],[0,1.660,0.42],0.03,0.03, DASHC2);
  B.box(0.30, 0.10, 0.045, 0, 1.650, 0.430, DASHC);
  B.box(0.27, 0.08, 0.01, 0, 1.650, 0.452, 0x223344);

  B.box(1.70, 0.02, 3.00, 0, 0.712, -0.63, 0x2a2c30);
  B.box(1.86, 0.035, 0.34, 0, 1.215, 0.845, WOOD);
  B.box(0.30, 0.03, 0.50, 0, 1.042, -0.36, WOOD);

  root.add(mergeBuilder(B, matPaint));
  root.add(mergeBuilder(G, matGlass));

  /* Wheels with pivot groups (drive.js spins these) */
  const wheels = [];
  for (const z of [C.zWF, C.zWR]){
    for (const s of [-1,1]){
      const wg = new THREE.Group();
      wg.position.set(s*0.83, 0.44, z);
      const spin = new THREE.Group();
      wg.add(spin);
      const tireMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(C.wheelR, C.wheelR, 0.32, 16),
        new THREE.MeshLambertMaterial({ color: 0x15161a }));
      tireMesh.rotation.z = Math.PI/2;
      spin.add(tireMesh);
      const rimMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.31, 0.31, 0.22, 14),
        new THREE.MeshStandardMaterial({ color: RIM, metalness: 0.9, roughness: 0.3 }));
      rimMesh.rotation.z = Math.PI/2;
      spin.add(rimMesh);
      root.add(wg);
      wheels.push({ pivot: wg, spin: spin, steer: z === C.zWF });
    }
  }
  root.userData.wheels = wheels;

  /* ==========================================================
     DOORS — four hinged groups
     ========================================================== */
  const doors = [];

  function buildDoor(sign, isFront){
    const B2 = new Builder();
    const G2 = new Builder();
    const xc = sign * 0.955;

    if (isFront){
      const pts = [[0.885,0.735],[0.885,1.385],[-0.715,1.385],[-0.715,0.735]];
      B2.plate(pts, null, 0.07, xc, PAINT);
    } else {
      const pts = [[-0.715,0.735],[-0.715,1.385],[-2.145,1.385],[-2.145,0.735],[-1.982,0.735]];
      arcOver(pts, C.zWR, C.archY, 0.655, 0.735, 10);
      pts.push([-0.715,0.735]);
      B2.plate(pts, null, 0.07, xc, PAINT);
    }

    /* exterior trim */
    B2.box(0.02, 0.035, 0.90, sign*0.993, 1.435, isFront ? 0.10 : -1.42, CHROME);
    B2.box(0.24, 0.055, 0.05, sign*0.998, 1.235, isFront ? -0.02 : -1.42, CHROME);

    /* interior card + armrest */
    const zc = isFront ? 0.085 : -1.43;
    const len = isFront ? 1.55 : 1.40;
    B2.box(0.05, 0.60, len, sign*0.918, 1.075, zc, DASHC);
    B2.box(0.06, 0.10, len*0.95, sign*0.912, 1.330, zc, LEATHER);
    B2.box(0.09, 0.09, len*0.55, sign*0.895, 1.075, zc, LEATHER2);
    B2.cyl(0.075,0.075,0.03,10, sign*0.905, 0.980, zc - (isFront?0.42:-0.40), 0x11131a);
    B2.box(0.30, 0.05, 0.03, sign*0.905, 1.245, isFront ? 0.55 : -1.92, CHROME);
    B2.box(0.02, 0.16, 0.34, sign*0.906, 1.130, zc + 0.20, WOOD);

    /* glass */
    if (isFront){
      G2.box(0.04, 0.285, 1.50, sign*0.862, 1.585, 0.085, GLASSC);
    } else {
      G2.box(0.04, 0.285, 1.18, sign*0.862, 1.585, -1.355, GLASSC);
    }

    const hingeZ = isFront ? 0.885 : -0.715;
    const bodyMesh  = mergeBuilder(B2, matPaint);
    const glassMesh = mergeBuilder(G2, matGlass);

    /* Shift geometry so the hinge sits at local origin */
    bodyMesh.geometry.translate(-xc, -1.05, -hingeZ);
    glassMesh.geometry.translate(-xc, -1.05, -hingeZ);
    bodyMesh.geometry.computeBoundingSphere();
    glassMesh.geometry.computeBoundingSphere();

    const grp = new THREE.Group();
    grp.position.set(xc, 1.05, hingeZ);
    grp.add(bodyMesh, glassMesh);
    grp.userData.sign    = sign;
    grp.userData.opened  = 0;
    grp.userData.target  = 0;
    grp.userData.isFront = isFront;
    return grp;
  }

  for (const s of [1,-1]){
    const dF = buildDoor(s, true);  doors.push(dF); root.add(dF);
    const dR = buildDoor(s, false); doors.push(dR); root.add(dR);
  }
  root.userData.doors = doors;

  return root;
}

