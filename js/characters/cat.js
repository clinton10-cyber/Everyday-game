import * as THREE from "three";

/* ============================================================
   Compact math helpers
   ============================================================ */
const clamp = (v,a,b)=> v<a?a:(v>b?b:v);
const lerp  = (a,b,t)=> a+(b-a)*t;
const smoothstep = (e0,e1,x)=>{ const t=clamp((x-e0)/(e1-e0),0,1); return t*t*(3-2*t); };
function hash(x,y,z){
  const s = Math.sin(x*127.1 + y*311.7 + z*74.7) * 43758.5453123;
  return s - Math.floor(s);
}
function vnoise(x,y,z){
  const xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z);
  const xf=x-xi, yf=y-yi, zf=z-zi;
  const u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf), w=zf*zf*(3-2*zf);
  const c000=hash(xi,yi,zi), c100=hash(xi+1,yi,zi);
  const c010=hash(xi,yi+1,zi), c110=hash(xi+1,yi+1,zi);
  const c001=hash(xi,yi,zi+1), c101=hash(xi+1,yi,zi+1);
  const c011=hash(xi,yi+1,zi+1), c111=hash(xi+1,yi+1,zi+1);
  return lerp(lerp(lerp(c000,c100,u),lerp(c010,c110,u),v),
              lerp(lerp(c001,c101,u),lerp(c011,c111,u),v), w);
}

/* ============================================================
   Vertex color helper
   ============================================================ */
function addColors(g, fn){
  const pos = g.attributes.position, nor = g.attributes.normal;
  const arr = new Float32Array(pos.count*3);
  const p = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color();
  for(let i=0;i<pos.count;i++){
    p.fromBufferAttribute(pos,i); n.fromBufferAttribute(nor,i);
    fn(p,n,c); arr[i*3]=c.r; arr[i*3+1]=c.g; arr[i*3+2]=c.b;
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(arr,3));
  return g;
}

/* ============================================================
   Sweep builder - same curve sweep as your HTML
   ============================================================ */
function buildSweep(centerFn, radiusFn, TS, RS, colorFn, opt){
  opt = opt || {};
  const P = new Array(TS+1);
  for(let i=0;i<=TS;i++) P[i] = centerFn(i/TS);
  const T = new Array(TS+1);
  for(let i=0;i<=TS;i++){
    const a = P[Math.max(0,i-1)], b = P[Math.min(TS,i+1)];
    T[i] = new THREE.Vector3().subVectors(b,a).normalize();
  }
  const N = new Array(TS+1), B = new Array(TS+1);
  if(opt.frameFn){
    for(let i=0;i<=TS;i++){
      const f = opt.frameFn(i/TS);
      N[i] = f.N.clone(); B[i] = f.B.clone();
    }
  } else {
    let up = new THREE.Vector3(0,1,0);
    if(Math.abs(T[0].dot(up)) > 0.95) up.set(1,0,0);
    let n0 = up.clone().addScaledVector(T[0], -up.dot(T[0])).normalize();
    N[0] = n0; B[0] = new THREE.Vector3().crossVectors(T[0], n0).normalize();
    for(let i=1;i<=TS;i++){
      const axis = new THREE.Vector3().crossVectors(T[i-1], T[i]);
      const l = axis.length();
      const v = N[i-1].clone();
      if(l > 1e-7){
        axis.divideScalar(l);
        v.applyAxisAngle(axis, Math.acos(clamp(T[i-1].dot(T[i]),-1,1)));
      }
      v.addScaledVector(T[i], -v.dot(T[i])).normalize();
      N[i] = v;
      B[i] = new THREE.Vector3().crossVectors(T[i], v).normalize();
    }
  }
  const positions=[], uvs=[], indices=[];
  for(let i=0;i<=TS;i++){
    const t = i/TS;
    for(let j=0;j<=RS;j++){
      const a = (j/RS)*Math.PI*2;
      const off = radiusFn(t,a);
      const p = P[i].clone().addScaledVector(N[i], off.u).addScaledVector(B[i], off.v);
      positions.push(p.x,p.y,p.z);
      uvs.push(j/RS, t);
    }
  }
  for(let i=0;i<TS;i++){
    for(let j=0;j<RS;j++){
      const a = i*(RS+1)+j;
      const b = (i+1)*(RS+1)+j;
      indices.push(a, a+1, b,  b, a+1, b+1);
    }
  }
  if(opt.capStart !== false){
    const c = P[0], ci = positions.length/3;
    positions.push(c.x,c.y,c.z); uvs.push(.5,0);
    for(let j=0;j<RS;j++) indices.push(j, ci, j+1);
  }
  if(opt.capEnd !== false){
    const c = P[TS], ci = positions.length/3;
    positions.push(c.x,c.y,c.z); uvs.push(.5,1);
    const base = TS*(RS+1);
    for(let j=0;j<RS;j++) indices.push(base+j, base+j+1, ci);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs,2));
  g.setIndex(indices);
  g.computeVertexNormals();
  if(colorFn) addColors(g, colorFn);
  return g;
}

function mergeGeos(list){
  let vcount=0, icount=0;
  for(const g of list){
    vcount += g.attributes.position.count;
    icount += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos=new Float32Array(vcount*3), nor=new Float32Array(vcount*3),
        col=new Float32Array(vcount*3), idx=new Uint16Array(icount);
  let vo=0, io=0;
  for(const g of list){
    const p=g.attributes.position, n=g.attributes.normal, c=g.attributes.color;
    pos.set(p.array, vo*3); nor.set(n.array, vo*3); col.set(c.array, vo*3);
    if(g.index){ const a=g.index.array; for(let i=0;i<a.length;i++) idx[io+i]=a[i]+vo; io+=a.length; }
    else { for(let i=0;i<p.count;i++) idx[io+i]=i+vo; io+=p.count; }
    vo += p.count;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  g.setAttribute('normal',   new THREE.BufferAttribute(nor,3));
  g.setAttribute('color',    new THREE.BufferAttribute(col,3));
  g.setIndex(new THREE.BufferAttribute(idx,1));
  return g;
}

/* ============================================================
   Palettes - each cat gets one at random
   ============================================================ */
export const CAT_PALETTES = {
  ginger: { base: 0xd98a3f, cream: 0xf7e8d2, stripe: 0x8a4711, dark: 0xb2661f, eye: 0x9ec93b, nose: 0xd9736f },
  black:  { base: 0x1a1a1e, cream: 0x2a2a2e, stripe: 0x0a0a0e, dark: 0x0e0e12, eye: 0xd8c040, nose: 0x2a2a2e },
  white:  { base: 0xeae4d8, cream: 0xf7f2e8, stripe: 0xc8bfae, dark: 0xd4cbb8, eye: 0x5ec8c0, nose: 0xe8a0a0 },
  gray:   { base: 0x8a8a92, cream: 0xc8c8d0, stripe: 0x4a4a52, dark: 0x6a6a72, eye: 0xb8d860, nose: 0xc09090 },
  calico: { base: 0xe8dcc4, cream: 0xf7f0e0, stripe: 0x3a2a1a, dark: 0xa85a20, eye: 0x8ab848, nose: 0xd88080 },
  tuxedo: { base: 0x121216, cream: 0xf7f2e8, stripe: 0x000000, dark: 0x2a2a2e, eye: 0xf0c020, nose: 0xc06060 },
  siamese:{ base: 0xf0e0c8, cream: 0xfcf7ec, stripe: 0x5a4a3a, dark: 0x2a1a10, eye: 0x60c0e0, nose: 0xe0a8a8 },
  tabby:  { base: 0xa07048, cream: 0xe8d8b8, stripe: 0x4a3018, dark: 0x7a5030, eye: 0xa8d848, nose: 0xc88080 },
  cream:  { base: 0xe0c8a0, cream: 0xf8f0dc, stripe: 0xa88060, dark: 0xc8a880, eye: 0x80d0c0, nose: 0xe0a0a0 },
};
export const PALETTE_NAMES = Object.keys(CAT_PALETTES);

function makeColorFns(pal){
  const C_BASE   = new THREE.Color(pal.base);
  const C_CREAM  = new THREE.Color(pal.cream);
  const C_STRIPE = new THREE.Color(pal.stripe);
  const C_DARK   = new THREE.Color(pal.dark);
  const _tmpV = new THREE.Vector3();
  const MUZ_DIR = new THREE.Vector3(0, -0.30, 1).normalize();

  function bodyColor(p, n, out){
    const dorsal = smoothstep(0.00, 0.85,  n.y);
    const belly  = smoothstep(-0.05,-0.75, n.y);
    const s = Math.sin(p.z*22 + vnoise(p.x*5, p.y*5, p.z*5)*5.0);
    const stripe = smoothstep(0.25, 0.85, s) * dorsal;
    const grain  = vnoise(p.x*34, p.y*34, p.z*34);
    out.copy(C_BASE);
    out.lerp(C_DARK,   dorsal*0.35);
    out.lerp(C_CREAM,  belly*0.90);
    out.lerp(C_STRIPE, stripe*0.62);
    out.multiplyScalar(0.94 + grain*0.12);
    return out;
  }
  function headColor(p, n, out){
    _tmpV.copy(p).normalize();
    const muzzle = smoothstep(0.45, 0.95, _tmpV.dot(MUZ_DIR));
    const chin   = smoothstep(0.25, 0.90, (-p.y/0.22)*0.55 + (p.z/0.22)*0.65);
    const cream  = Math.max(muzzle, chin*0.92);
    const dorsal = smoothstep(0.0, 0.75, n.y);
    const s = Math.sin(p.x*34 + vnoise(p.x*9,p.y*9,p.z*9)*4.0);
    const stripe = smoothstep(0.30, 0.90, s) * dorsal * smoothstep(-0.2, 0.4, _tmpV.y);
    const grain = vnoise(p.x*40, p.y*40, p.z*40);
    out.copy(C_BASE);
    out.lerp(C_DARK,   dorsal*0.30);
    out.lerp(C_CREAM,  cream);
    out.lerp(C_STRIPE, stripe*0.55);
    out.multiplyScalar(0.95 + grain*0.10);
    return out;
  }
  function legColor(p, n, out){
    const low  = smoothstep(-0.28, -0.42, p.y);
    const dark = smoothstep(-0.02, -0.30, p.y);
    out.copy(C_BASE);
    out.lerp(C_DARK, dark*0.30);
    out.lerp(C_CREAM, low*0.85);
    return out;
  }
  function tailColor(p, n, out){
    const tip = smoothstep(0.35, 0.62, p.length());
    out.copy(C_BASE);
    out.lerp(C_STRIPE, tip*0.70);
    return out;
  }
  return { bodyColor, headColor, legColor, tailColor };
}

/* ============================================================
   Solid sphere helper (for eyes / nose)
   ============================================================ */
function solidSphere(r, w, h, hex, sx, sy, sz){
  sx = sx || 1; sy = sy || 1; sz = sz || 1;
  const g = new THREE.SphereGeometry(r, w, h);
  const c = new THREE.Color(hex);
  addColors(g, (p,n,out)=> out.copy(c));
  if(sx!==1||sy!==1||sz!==1) g.scale(sx,sy,sz);
  return g;
}

/* ============================================================
   Build a full cat from a palette
   ============================================================ */
export function buildCat(paletteName){
  const pal = CAT_PALETTES[paletteName] || CAT_PALETTES.ginger;
  const CF = makeColorFns(pal);

  const root = new THREE.Group();

  const furMat = new THREE.MeshPhongMaterial({
    vertexColors: true, shininess: 9,
    specular: new THREE.Color(0x151515), flatShading: false
  });
  const eyeMat = new THREE.MeshPhongMaterial({
    vertexColors: true, shininess: 95,
    specular: new THREE.Color(0xffffff)
  });
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x1a1010 });

  /* --- BODY --- */
  const BODY_Z0 = -0.62, BODY_Z1 = 0.48;
  function bodyCenter(t){
    const z = BODY_Z0 + (BODY_Z1-BODY_Z0)*t;
    const y = 0.58 + 0.050*Math.sin(Math.PI*t) - 0.015*t;
    return new THREE.Vector3(0, y, z);
  }
  function bodyRadius(t, a){
    const s = Math.max(0, Math.sin(Math.PI*t));
    const rs = Math.pow(s, 0.45);
    const neckKeep = smoothstep(0.78, 1.0, t) * 0.55;
    const scale = rs + neckKeep*(1-rs);
    let rx = 0.245 * scale;
    let ry = 0.255 * scale;
    ry += 0.035*scale*Math.exp(-Math.pow((t-0.72)/0.25, 2));
    const ca = Math.cos(a), sa = Math.sin(a);
    const ryv = ry * (ca > 0 ? 0.94 : 1.05);
    const e = 0.44;
    return {
      u: ryv * Math.sign(ca) * Math.pow(Math.abs(ca), e),
      v: rx  * Math.sign(sa) * Math.pow(Math.abs(sa), e)
    };
  }
  const bodyGeo = buildSweep(bodyCenter, bodyRadius, 32, 16, CF.bodyColor, { capStart:true, capEnd:true });
  const bodyMesh = new THREE.Mesh(bodyGeo, furMat);
  root.add(bodyMesh);

  /* --- HEAD --- */
  const HEAD_PIVOT  = new THREE.Vector3(0, 0.56, 0.44);
  const HEAD_OFFSET = new THREE.Vector3(0, 0.16, 0.18);

  function buildHead(){
    const g = new THREE.SphereGeometry(1, 24, 16);
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    const MUZ = new THREE.Vector3(0, -0.32, 1).normalize();
    const R = 0.215;
    for(let i=0;i<pos.count;i++){
      v.fromBufferAttribute(pos, i);
      const d = v;
      let r = 1.0;
      const m = Math.max(0, d.dot(MUZ));
      r += 0.21 * Math.pow(m, 2.4);
      const ch = Math.max(0, Math.abs(d.x)*0.95 - Math.abs(d.z)*0.35 - 0.05);
      r += 0.22 * Math.pow(ch, 1.6);
      r -= 0.05 * Math.max(0, d.y) * Math.max(0, d.y);
      r -= 0.10 * Math.pow(Math.max(0, -d.z), 1.8);
      r += 0.03 * Math.max(0, d.y) * Math.max(0, d.z);
      v.multiplyScalar(r * R);
      v.x *= 1.02; v.y *= 0.97; v.z *= 1.03;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    addColors(g, CF.headColor);
    g.translate(HEAD_OFFSET.x, HEAD_OFFSET.y, HEAD_OFFSET.z);
    return g;
  }
  const headGroup = new THREE.Group();
  headGroup.position.copy(HEAD_PIVOT);
  root.add(headGroup);
  const headMesh = new THREE.Mesh(buildHead(), furMat);
  headGroup.add(headMesh);

  /* --- EARS --- */
  function buildEar(side){
    const up   = new THREE.Vector3(side*0.42, 1.0, -0.12).normalize();
    const fRaw = new THREE.Vector3(side*0.55, 0.08, 0.83).normalize();
    const e3   = new THREE.Vector3().crossVectors(up, fRaw).normalize();
    const e2   = new THREE.Vector3().crossVectors(e3, up).normalize();
    const H = 0.235;
    const centerFn = (t)=> up.clone().multiplyScalar(t*H);
    const radiusFn = (t,a)=>{
      const w  = 0.098 * Math.pow(1-t, 0.80);
      const th = 0.030 * Math.pow(1-t, 0.55) + 0.0035;
      const ca = Math.cos(a), sa = Math.sin(a);
      const cup = -0.030*(1-t);
      return {
        u: w * Math.sign(ca) * Math.pow(Math.abs(ca), 0.75),
        v: th* Math.sign(sa) * Math.pow(Math.abs(sa), 0.90) + cup
      };
    };
    const colorFn = (p,n,out)=>{
      const facing = n.dot(e2);
      const inner  = smoothstep(0.10, 0.80, facing);
      const tip    = smoothstep(0.55, 1.0, p.length()/H);
      out.copy(new THREE.Color(pal.base));
      out.lerp(new THREE.Color(0xe7a79f), inner*0.88);
      out.lerp(new THREE.Color(pal.stripe), tip*0.45);
      return out;
    };
    return buildSweep(centerFn, radiusFn, 12, 10, colorFn, {
      frameFn: ()=>({ N: e3, B: e2 }),
      capStart: true, capEnd: true
    });
  }
  const earLGroup = new THREE.Group();
  earLGroup.position.set(-0.115, HEAD_OFFSET.y + 0.16, HEAD_OFFSET.z - 0.02);
  earLGroup.add(new THREE.Mesh(buildEar(-1), furMat));
  headGroup.add(earLGroup);

  const earRGroup = new THREE.Group();
  earRGroup.position.set( 0.115, HEAD_OFFSET.y + 0.16, HEAD_OFFSET.z - 0.02);
  earRGroup.add(new THREE.Mesh(buildEar( 1), furMat));
  headGroup.add(earRGroup);

  /* --- EYES --- */
  const EYE_DIR  = new THREE.Vector3(0.42, 0.22, 0.88).normalize();
  const EYE_DIST = 0.205;
  const EYE_R    = 0.056;
  function buildEye(side){
    const dir = new THREE.Vector3(EYE_DIR.x*side, EYE_DIR.y, EYE_DIR.z).normalize();
    const iris  = solidSphere(EYE_R, 12, 10, pal.eye);
    const pupil = solidSphere(0.030, 8, 8, 0x0a0a0e, 0.34, 1.20, 0.34);
    pupil.translate(0, 0, EYE_R*0.80);
    const shine = solidSphere(0.011, 6, 6, 0xffffff, 1, 1, 0.4);
    shine.translate(EYE_R*0.42, EYE_R*0.42, EYE_R*0.82);
    const geo = mergeGeos([iris, pupil, shine]);
    const grp = new THREE.Group();
    grp.position.copy(dir).multiplyScalar(EYE_DIST).add(HEAD_OFFSET);
    grp.add(new THREE.Mesh(geo, eyeMat));
    grp.lookAt(grp.position.clone().add(dir));
    return grp;
  }
  const eyeL = buildEye(-1);
  const eyeR = buildEye( 1);
  headGroup.add(eyeL, eyeR);

  /* --- NOSE + MOUTH --- */
  const NOSE_Y = HEAD_OFFSET.y - 0.055;
  const NOSE_Z = HEAD_OFFSET.z + 0.250;
  const nosePos = new THREE.Vector3(0, NOSE_Y, NOSE_Z);
  const noseGeo = solidSphere(0.026, 10, 8, pal.nose, 1.30, 0.78, 0.85);
  const noseMesh = new THREE.Mesh(noseGeo, eyeMat);
  noseMesh.position.copy(nosePos);
  headGroup.add(noseMesh);

  const philMesh = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.020, 0.006), darkMat);
  philMesh.position.set(0, NOSE_Y - 0.020, NOSE_Z - 0.006);
  headGroup.add(philMesh);

  const mouthPts = [
    new THREE.Vector3(-0.048, NOSE_Y - 0.038, NOSE_Z - 0.008),
    new THREE.Vector3(-0.022, NOSE_Y - 0.028, NOSE_Z - 0.016),
    new THREE.Vector3( 0.000, NOSE_Y - 0.048, NOSE_Z - 0.012),
    new THREE.Vector3( 0.022, NOSE_Y - 0.028, NOSE_Z - 0.016),
    new THREE.Vector3( 0.048, NOSE_Y - 0.038, NOSE_Z - 0.008),
  ];
  const mouthCurve = new THREE.CatmullRomCurve3(mouthPts, false, "catmullrom", 0.5);
  headGroup.add(new THREE.Mesh(new THREE.TubeGeometry(mouthCurve, 16, 0.0042, 5, false), darkMat));

  const stem = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, NOSE_Y - 0.006, NOSE_Z - 0.004),
      new THREE.Vector3(0, NOSE_Y - 0.026, NOSE_Z - 0.010),
      new THREE.Vector3(0, NOSE_Y - 0.048, NOSE_Z - 0.012),
    ]), 6, 0.0032, 5, false);
  headGroup.add(new THREE.Mesh(stem, darkMat));

  /* --- WHISKERS --- */
  const whiskPts = [];
  const wRootX = 0.088, wRootY = NOSE_Y + 0.012, wRootZ = NOSE_Z - 0.045;
  const wDirs = [[-1.00,0.18,0.34],[-1.05,-0.02,0.22],[-0.95,-0.22,0.16],[-0.72,-0.38,0.06]];
  for(let s=-1;s<=1;s+=2){
    for(const d of wDirs){
      const len = 0.26;
      whiskPts.push(s*wRootX, wRootY, wRootZ);
      whiskPts.push(s*wRootX + s*d[0]*len, wRootY + d[1]*len, wRootZ + d[2]*len);
    }
  }
  const whiskGeo = new THREE.BufferGeometry();
  whiskGeo.setAttribute("position", new THREE.Float32BufferAttribute(whiskPts,3));
  headGroup.add(new THREE.LineSegments(whiskGeo,
    new THREE.LineBasicMaterial({ color:0xfff6e8, transparent:true, opacity:0.5 })));

  /* --- LEGS --- */
  function makeLegGeo(front){
    const pts = front ? [
      new THREE.Vector3(0,0.000,0.010), new THREE.Vector3(0,-0.121,0.038),
      new THREE.Vector3(0,-0.231,0.016), new THREE.Vector3(0,-0.352,-0.017),
      new THREE.Vector3(0,-0.440,0.005),
    ] : [
      new THREE.Vector3(0,0.000,-0.010), new THREE.Vector3(0,-0.132,-0.062),
      new THREE.Vector3(0,-0.253,0.022), new THREE.Vector3(0,-0.363,0.006),
      new THREE.Vector3(0,-0.440,0.020),
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
    const centerFn = (t)=> curve.getPoint(t);
    const radiusFn = (t,a)=>{
      const thigh = 0.075 * Math.exp(-t*2.6);
      const pf    = Math.exp(-Math.pow((t-0.94)/0.075, 2));
      const paw   = 0.030 * pf;
      const r = 0.028 + thigh + paw;
      const ca = Math.cos(a), sa = Math.sin(a);
      const rx = r;
      const ry = r*(1 - 0.45*pf) + 0.004;
      const e  = 0.60;
      return {
        u: ry * Math.sign(ca) * Math.pow(Math.abs(ca), e),
        v: rx * Math.sign(sa) * Math.pow(Math.abs(sa), e)
      };
    };
    return buildSweep(centerFn, radiusFn, 14, 10, CF.legColor, { capStart:true, capEnd:true });
  }
  const legGeoFront = makeLegGeo(true);
  const legGeoBack  = makeLegGeo(false);
  const legData = [
    { x:-0.155, y:0.44, z: 0.28, front:true,  key:"FL" },
    { x: 0.155, y:0.44, z: 0.28, front:true,  key:"FR" },
    { x:-0.168, y:0.44, z:-0.34, front:false, key:"BL" },
    { x: 0.168, y:0.44, z:-0.34, front:false, key:"BR" },
  ];
  const legs = {};
  for(const d of legData){
    const m = new THREE.Mesh(d.front ? legGeoFront : legGeoBack, furMat);
    m.position.set(d.x, d.y, d.z);
    root.add(m);
    legs[d.key] = m;
  }

  /* --- TAIL --- */
  const TAIL_BASE = new THREE.Vector3(0, 0.66, -0.58);
  const TAIL_TS = 24, TAIL_RS = 6;
  const tailGroup = new THREE.Group();
  tailGroup.position.copy(TAIL_BASE);
  root.add(tailGroup);

  const tailPts = [
    new THREE.Vector3(0,0.00,0.00), new THREE.Vector3(0,0.03,-0.13),
    new THREE.Vector3(0,0.11,-0.24), new THREE.Vector3(0,0.22,-0.30),
    new THREE.Vector3(0,0.33,-0.26), new THREE.Vector3(0,0.40,-0.16),
  ];
  const tailCurve = new THREE.CatmullRomCurve3(tailPts, false, "catmullrom", 0.5);
  const tailGeo = buildSweep(
    (t)=> tailCurve.getPoint(t),
    (t,a)=>{
      const r  = 0.030 + 0.021*Math.pow(1-t, 1.15);
      const ca = Math.cos(a), sa = Math.sin(a);
      return { u: r*Math.sign(ca)*Math.pow(Math.abs(ca),0.8),
               v: r*Math.sign(sa)*Math.pow(Math.abs(sa),0.8) };
    },
    TAIL_TS, TAIL_RS, CF.tailColor, { capStart:true, capEnd:true });
  const tailMesh = new THREE.Mesh(tailGeo, furMat);
  tailMesh.frustumCulled = false;
  tailGroup.add(tailMesh);
  const tailRest = Float32Array.from(tailGeo.attributes.position.array);
  const tailTArr = new Float32Array(tailGeo.attributes.position.count);
  const perRing = TAIL_RS + 1;
  for(let i=0;i<tailGeo.attributes.position.count;i++)
    tailTArr[i] = Math.floor(i/perRing) / TAIL_TS;

  /* --- shadow sprite (billboard plane on ground) --- */
  const shGeo = new THREE.CircleGeometry(0.62, 16);
  shGeo.rotateX(-Math.PI/2);
  const shMat = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false
  });
  const shadow = new THREE.Mesh(shGeo, shMat);
  shadow.position.y = 0.006;
  shadow.renderOrder = -1;
  root.add(shadow);

  return {
    group: root,
    palette: paletteName,
    parts: { bodyMesh, headGroup, headMesh, earLGroup, earRGroup,
             eyeL, eyeR, legs, tailGroup, tailGeo, tailRest, tailTArr, shadow,
             headPivot: HEAD_PIVOT },
    anim: { gaitPhase: 0, motionBlend: 0, leanBlend: 0, reactT: 0,
            blinkTimer: 1.5 + Math.random()*3, blinkT: -1 },
  };
}

/* ============================================================
   Animate a cat model. Call every frame.
   motion: 0 = idle, 1 = walk, 2 = run
   ============================================================ */
export function tickCatModel(model, dt, time, motion){
  const P = model.parts;
  const A = model.anim;
  const pal = CAT_PALETTES[model.palette] || CAT_PALETTES.ginger;

  /* reaction decay */
  if(A.reactT > 0) A.reactT = Math.max(0, A.reactT - dt*0.55);

  let gaitSpeed = 0, gaitAmp = 0, bobAmp = 0, leanTarget = 0;
  let tailWaveBase = 2.6, tailSwayBase = 0.85, tailAmpBase = 0.055;

  if(motion === 1){
    gaitSpeed = 5.2; gaitAmp = 0.45; bobAmp = 0.016;
    leanTarget = 0.035;
    tailWaveBase = 6.0; tailSwayBase = 3.2; tailAmpBase = 0.075;
  } else if(motion === 2){
    gaitSpeed = 11.5; gaitAmp = 0.80; bobAmp = 0.038;
    leanTarget = 0.16;
    tailWaveBase = 14.0; tailSwayBase = 6.0; tailAmpBase = 0.105;
  }

  const targetBlend = motion === 0 ? 0 : 1;
  A.motionBlend += (targetBlend - A.motionBlend) * Math.min(1, dt*6);
  A.leanBlend   += (leanTarget  - A.leanBlend)   * Math.min(1, dt*5);

  A.gaitPhase += dt * gaitSpeed;
  const p = A.gaitPhase;

  const swing = gaitAmp * A.motionBlend;
  if(P.legs.FL) P.legs.FL.rotation.x = Math.sin(p) * swing;
  if(P.legs.BR) P.legs.BR.rotation.x = Math.sin(p) * swing;
  if(P.legs.FR) P.legs.FR.rotation.x = Math.sin(p + Math.PI) * swing;
  if(P.legs.BL) P.legs.BL.rotation.x = Math.sin(p + Math.PI) * swing;

  const breath = 1 + 0.012 * Math.sin(time*1.65);
  if(P.bodyMesh){
    P.bodyMesh.scale.set(1, breath, 1);
    const bodyBob = bobAmp * A.motionBlend * Math.sin(p*2);
    P.bodyMesh.position.y = 0.004 * Math.sin(time*1.65 + 0.6) + bodyBob;
  }

  if(P.headGroup){
    const hb = (bobAmp * A.motionBlend * Math.sin(p*2)) * 0.75;
    P.headGroup.position.y = P.headPivot.y + 0.008*Math.sin(time*1.32) + hb;
    const idleYaw = Math.sin(time*0.31)*0.16 + Math.sin(time*0.13)*0.07;
    P.headGroup.rotation.y = idleYaw*0.55 + A.reactT*0.25*Math.sin(time*9);
    P.headGroup.rotation.x = Math.sin(time*1.32)*0.030 + Math.sin(time*0.23)*0.028
                          - A.reactT*0.10 + A.leanBlend;
    P.headGroup.rotation.z = Math.sin(time*0.47)*0.040 + A.reactT*0.08;
  }

  const twitch  = Math.pow(Math.max(0, Math.sin(time*2.05)), 18);
  const twitch2 = Math.pow(Math.max(0, Math.sin(time*2.05 + 1.9)), 18);
  const perk = A.reactT*0.22 + A.motionBlend*0.10;
  if(P.earLGroup){
    P.earLGroup.rotation.x = -0.30*twitch  - perk*0.4 + A.leanBlend*0.4;
    P.earLGroup.rotation.z =  0.10*twitch;
  }
  if(P.earRGroup){
    P.earRGroup.rotation.x = -0.30*twitch2 - perk*0.4 + A.leanBlend*0.4;
    P.earRGroup.rotation.z = -0.10*twitch2;
  }

  /* blink */
  A.blinkTimer -= dt;
  if(A.blinkTimer <= 0){ A.blinkT = 0; A.blinkTimer = 2.4 + Math.random()*4.0; }
  let blink = 0;
  if(A.blinkT >= 0){
    A.blinkT += dt;
    if(A.blinkT > 0.19){ A.blinkT = -1; blink = 0; }
    else blink = Math.sin((A.blinkT/0.19) * Math.PI);
  }
  const runSquint = (motion === 2 ? 0.22 : motion === 1 ? 0.06 : 0) * A.motionBlend;
  const eyeY = (1 - blink*0.94) * (1 - runSquint);
  if(P.eyeL) P.eyeL.scale.y = eyeY;
  if(P.eyeR) P.eyeR.scale.y = eyeY;

  /* tail */
  const tailSwaySpeed = tailSwayBase + A.reactT * 7.0;
  const tailSwayAmp   = 0.16 + A.motionBlend * 0.15 + A.reactT * 0.20;
  if(P.tailGroup){
    P.tailGroup.rotation.y = tailSwayAmp * Math.sin(time * tailSwaySpeed);
    P.tailGroup.rotation.x = -0.10*Math.sin(time*0.62) - A.reactT*0.12 + A.leanBlend*0.6;
  }

  const waveSpeed = tailWaveBase + A.reactT * 5.0;
  const waveAmp   = tailAmpBase + A.motionBlend * 0.045 + A.reactT * 0.05;
  if(P.tailGeo && P.tailRest && P.tailTArr){
    const posAttr = P.tailGeo.attributes.position;
    const arr = posAttr.array;
    const n = posAttr.count;
    for(let i=0;i<n;i++){
      const u = P.tailTArr[i];
      const ph = time*waveSpeed - u*3.6;
      const amp = waveAmp * u * u;
      const i3 = i*3;
      arr[i3]     = P.tailRest[i3]     + Math.sin(ph) * amp;
      arr[i3 + 1] = P.tailRest[i3 + 1] + Math.sin(ph*0.7 + 1.0) * amp * 0.30;
    }
    posAttr.needsUpdate = true;
    P.tailGeo.computeVertexNormals();
  }
}

export function triggerCatReaction(model){
  const A = model.anim;
  A.reactT = 1.0;
  A.blinkT = 0;
  A.blinkTimer = 2.0 + Math.random()*3;
}

