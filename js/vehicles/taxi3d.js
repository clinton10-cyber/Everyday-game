/* js/vehicles/taxi3d.js -- smooth, procedurally lofted taxi (not boxy).
   The body is a surface S(s,theta) swept along the car with per-station width, floor, roofline,
   tumblehome and superellipse exponent; the cabin is a second lofted tube; glass, wheel arches,
   lamps, checker belt, bumpers and roof sign are all generated from math.

   Convention (same as models.js): the returned group has its NOSE toward +X, wheels in
   g.userData.wheels as { pivot, spin, steer, spinZ:false } so drive.js can steer / spin them. */
import * as THREE from "three";

const clamp = (v,a,b) => v < a ? a : v > b ? b : v;
const lerp  = (a,b,t) => a + (b-a)*t;

/** Hermite smoothstep — C1 continuous, zero derivative at both ends */
const smoothstep = (e0,e1,x) => {
  const t = clamp((x-e0)/(e1-e0), 0, 1);
  return t*t*(3-2*t);
};

/**
 * Catmull–Rom keyframe interpolator.
 * Given [[x0,y0],[x1,y1],...] returns f(x) with C1 continuity.
 *   P(t) = ½ [ 2P1 + (-P0+P2)t + (2P0-5P1+4P2-P3)t² + (-P0+3P1-3P2+P3)t³ ]
 */
function keyCurve(pts){
  const n = pts.length;
  return function(x){
    if (x <= pts[0][0])     return pts[0][1];
    if (x >= pts[n-1][0])   return pts[n-1][1];
    let i = 0;
    while (i < n-2 && x > pts[i+1][0]) i++;
    const p0 = pts[Math.max(0,i-1)], p1 = pts[i],
          p2 = pts[i+1],             p3 = pts[Math.min(n-1,i+2)];
    const t  = (x - p1[0]) / (p2[0] - p1[0]);
    const t2 = t*t, t3 = t2*t;
    return 0.5*( 2*p1[1]
               + (-p0[1] +      p2[1])           * t
               + ( 2*p0[1] - 5*p1[1] + 4*p2[1] - p3[1]) * t2
               + (-p0[1] + 3*p1[1] - 3*p2[1] + p3[1]) * t3 );
  };
}

/**
 * Superellipse (Lamé curve)  |x/a|^n + |y/b|^n = 1
 * Parametrised so the result lives on the unit square:
 *   x = sgn(cosθ)·|cosθ|^(2/n)      y = sgn(sinθ)·|sinθ|^(2/n)
 * n = 2 → ellipse,  n → ∞ → rectangle
 */
function superellipse(theta, n){
  const p = 2/n;
  const c = Math.cos(theta), s = Math.sin(theta);
  return [
    Math.sign(c) * Math.pow(Math.abs(c), p),
    Math.sign(s) * Math.pow(Math.abs(s), p)
  ];
}

const Z0 = -2.30, Z1 = 2.30, LEN = Z1 - Z0;

/* Half-width of the body in plan view (metres) */
const cW = keyCurve([
  [0.00,0.620],[0.03,0.800],[0.08,0.890],[0.18,0.925],[0.50,0.930],
  [0.82,0.925],[0.92,0.900],[0.97,0.860],[1.00,0.700]
]);

/* Floor line of the body */
const cYB = keyCurve([
  [0.00,0.580],[0.03,0.430],[0.08,0.300],[0.30,0.270],[0.70,0.270],
  [0.92,0.300],[0.97,0.380],[1.00,0.420]
]);

/* Upper line of the lower body = the "belt line" the greenhouse sits on */
const cYT = keyCurve([
  [0.00,0.760],[0.05,0.870],[0.12,0.930],[0.28,0.955],[0.50,0.965],
  [0.72,0.945],[0.86,0.900],[0.95,0.860],[1.00,0.820]
]);

/* Tumblehome: how much the section narrows toward the top */
const cK = keyCurve([
  [0.00,0.30],[0.08,0.13],[0.30,0.08],[0.50,0.06],
  [0.70,0.08],[0.92,0.13],[1.00,0.30]
]);

/* Superellipse exponent — controls boxiness of each cross-section */
const cN = keyCurve([
  [0.00,3.2],[0.10,6.0],[0.50,7.0],[0.90,6.0],[1.00,3.2]
]);

/* ---------------------------------------------------------------------------
   Wheel-arch carving.
   A smooth semi-elliptical bump that lifts the *underside* of the body at the
   two axle stations, producing genuine wheel wells:
        arch(s) = h · (1 - ((s-a)/w)²)^1.5
   ------------------------------------------------------------------------- */
function archHeight(s){
  const w = 0.115, h = 0.470;
  const f = a => {
    const t = clamp(Math.abs(s - a)/w, 0, 1);
    return h * Math.pow(1 - t*t, 1.5);
  };
  return Math.max(f(0.185), f(0.815));   // rear axle, front axle
}

/* ---------------------------------------------------------------------------
   End rounding — collapses the cross-section toward its centre at both
   extremities so the nose and tail are smoothly closed volumes.
        e(a) = 0.70 + 0.30·√(1 - a⁴),  a = |2s-1|
   ------------------------------------------------------------------------- */
function endRound(s){
  const a = Math.abs(2*s - 1);
  return 0.70 + 0.30 * Math.sqrt(Math.max(0, 1 - Math.pow(a, 4)));
}

/* ---------------------------------------------------------------------------
   S(s, θ) — the master body surface
   ------------------------------------------------------------------------- */
function bodyPoint(s, theta, target){
  s = clamp(s, 0, 1);

  const w  = cW(s),  yb = cYB(s), yt = cYT(s);
  const k  = cK(s),  n  = cN(s);

  const [xn, yn] = superellipse(theta, n);

  const cy = 0.5*(yb + yt);
  const hy = 0.5*(yt - yb);

  const v = (yn + 1) * 0.5;                       // 0 = floor, 1 = roofline
  let x = w * (1 - k*v*v) * xn;
  let y = cy + hy * yn;

  // --- wheel-arch clamp (only near the axles) ---
  const ao = archHeight(s);
  if (ao > 1e-4){
    const ay = yb + ao * smoothstep(0.55, 0.70, Math.abs(x));
    if (y < ay) y = ay;
  }

  // --- rounded ends ---
  const er = endRound(s);
  x *= er;
  y  = cy + (y - cy) * er;

  return target.set(x, y, Z0 + LEN * s);
}

/* ---------------------------------------------------------------------------
   Greenhouse (cabin) — a second lofted tube resting on the belt line.
   Its lower half is deliberately buried inside the body so no seams show.
   ------------------------------------------------------------------------- */
const GS0 = 0.255, GS1 = 0.765;

const cGW = keyCurve([
  [0.25,0.700],[0.30,0.790],[0.38,0.820],[0.50,0.832],
  [0.62,0.824],[0.70,0.790],[0.78,0.700]
]);

const cGR = keyCurve([                       // roof / glass-line profile
  [0.25,0.860],[0.28,0.950],[0.31,1.080],[0.35,1.260],[0.39,1.400],
  [0.42,1.462],[0.47,1.483],[0.56,1.483],[0.60,1.468],[0.645,1.360],
  [0.69,1.120],[0.72,0.980],[0.765,0.860]
]);

function greenhousePoint(s, theta, target){
  s = clamp(s, GS0, GS1);

  const w  = cGW(s);
  const yb = cYT(s) - 0.22;                 // sunk into the lower body
  const yt = cGR(s);

  const n = 3.2, k = 0.30, p = 2/n;
  const c = Math.cos(theta), si = Math.sin(theta);
  const xn = Math.sign(c)  * Math.pow(Math.abs(c),  p);
  const yn = Math.sign(si) * Math.pow(Math.abs(si), p);

  const cy = 0.5*(yb + yt), hy = 0.5*(yt - yb);
  const v  = (yn + 1) * 0.5;

  return target.set(
    w * (1 - k*v*v) * xn,
    cy + hy * yn,
    Z0 + LEN * s
  );
}

/* ============================================================================
   4 ·  GEOMETRY BUILDERS
   ============================================================================ */

const _a = new THREE.Vector3(), _b = new THREE.Vector3(),
      _c = new THREE.Vector3(), _d = new THREE.Vector3();

/** Outward surface normal via central differences:  N = ∂θ × ∂s */
function normalOf(fn, s, t, sMin, sMax, target = new THREE.Vector3()){
  const e  = 0.0018;
  const s1 = Math.min(sMax, s + e), s0 = Math.max(sMin, s - e);
  fn(s1, t, _a); fn(s0, t, _b); _a.sub(_b);
  fn(s, t + e, _c); fn(s, t - e, _d); _c.sub(_d);
  return target.crossVectors(_c, _a).normalize();
}

/** Closed lofted tube — θ wraps seamlessly, no UV seam, no normal seam. */
function loft(fn, NS, NT, s0 = 0, s1 = 1){
  const pos = [], uv = [], idx = [];
  const P = new THREE.Vector3();

  for (let i = 0; i <= NS; i++){
    const s = lerp(s0, s1, i/NS);
    for (let j = 0; j < NT; j++){
      fn(s, j/NT * Math.PI*2, P);
      pos.push(P.x, P.y, P.z);
      uv.push(j/NT, i/NS);
    }
  }
  for (let i = 0; i < NS; i++){
    for (let j = 0; j < NT; j++){
      const a =  i   *NT + j,
            b =  i   *NT + (j+1)%NT,
            c = (i+1)*NT + j,
            d = (i+1)*NT + (j+1)%NT;
      idx.push(a, b, c,  b, d, c);        // ∂θ × ∂s  → outward
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv',       new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Triangle-fan cap for the collapsed ends of a loft. */
function endCap(fn, s, NT, dir){
  const pos = [], uv = [], idx = [];
  const P = new THREE.Vector3();
  const ring = [];
  let cx = 0, cy = 0, cz = 0;

  for (let j = 0; j < NT; j++){
    fn(s, j/NT * Math.PI*2, P);
    ring.push([P.x, P.y, P.z]);
    cx += P.x; cy += P.y; cz += P.z;
  }
  cx /= NT; cy /= NT; cz /= NT;

  pos.push(cx, cy, cz); uv.push(0.5, 0.5);
  for (const r of ring){ pos.push(r[0], r[1], r[2]); uv.push(0.5, 0.5); }

  for (let j = 0; j < NT; j++){
    const a = 1 + j, b = 1 + (j+1)%NT;
    if (dir > 0) idx.push(0, a, b); else idx.push(0, b, a);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv',       new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Rectangular patch of a lofted surface, offset along its own normal. */
function patch(fn, s0, s1, t0, t1, NS, NT, offset, sMin, sMax){
  const pos = [], nor = [], uv = [], idx = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3();

  for (let i = 0; i <= NS; i++){
    const s = lerp(s0, s1, i/NS);
    for (let j = 0; j <= NT; j++){
      const t = lerp(t0, t1, j/NT);
      fn(s, t, P);
      normalOf(fn, s, t, sMin, sMax, N);
      pos.push(P.x + N.x*offset, P.y + N.y*offset, P.z + N.z*offset);
      nor.push(N.x, N.y, N.z);
      uv.push(i/NS, j/NT);
    }
  }
  for (let i = 0; i < NS; i++){
    for (let j = 0; j < NT; j++){
      const a = i*(NT+1) + j, b = a+1, c = a+NT+1, d = c+1;
      idx.push(a, b, c,  b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal',   new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv',       new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function checkerTexture(){
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  for (let y = 0; y < 2; y++)
    for (let x = 0; x < 2; x++){
      g.fillStyle = ((x + y) & 1) ? '#101014' : '#f2f2f2';
      g.fillRect(x*32, y*32, 32, 32);
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  return t;
}

function taxiSignTexture(){
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fdfaf0'; g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#f5c518'; g.fillRect(0, 0, 512, 10); g.fillRect(0, 118, 512, 10);
  g.fillStyle = '#14161c';
  g.font = 'bold 82px Helvetica, Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('TAXI', 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

function plateTexture(text){
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f5f2e8'; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#2a2a2a'; g.lineWidth = 6; g.strokeRect(6, 6, 244, 116);
  g.fillStyle = '#1a1a1a';
  g.font = 'bold 62px Helvetica, Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 70);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

/* roundedBox lives with the assembly code below (needs clamp) */
export function buildTaxi3D(body = "#f2c31a", rim = "#2a2d35") {
  const matPaint = new THREE.MeshStandardMaterial({ color: new THREE.Color(body), metalness: 0.25, roughness: 0.32 });
  const matGlass = new THREE.MeshStandardMaterial({ color: 0x0d1822, metalness: 0.5, roughness: 0.08, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
  const matRubber = new THREE.MeshStandardMaterial({ color: 0x14151a, roughness: 0.92, metalness: 0.02 });
  const matChrome = new THREE.MeshStandardMaterial({ color: 0xd8dde6, roughness: 0.2, metalness: 0.55 });
  const matDarkMetal = new THREE.MeshStandardMaterial({ color: new THREE.Color(rim), roughness: 0.4, metalness: 0.6 });
  const matBlackPlastic = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.72, metalness: 0.15 });
  const matHeadlight = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d0, emissiveIntensity: 1.2, roughness: 0.1 });
  const matTaillight = new THREE.MeshStandardMaterial({ color: 0x8e0a0a, emissive: 0xff2200, emissiveIntensity: 1.0, roughness: 0.15 });
  const matSignGlow = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6d8, emissiveIntensity: 0.7, map: taxiSignTexture(), roughness: 0.45 });
  const matInterior = new THREE.MeshStandardMaterial({ color: 0x0a0b0e, roughness: 0.95 });
  const taxi = new THREE.Group();
  /* --- 7.1  Lower body ------------------------------------------------------ */
  const bodyGeo = loft(bodyPoint, 150, 72);
  bodyGeo.computeVertexNormals();

  const bodyMesh = new THREE.Mesh(bodyGeo, matPaint);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  taxi.add(bodyMesh);

  taxi.add(new THREE.Mesh(endCap(bodyPoint, 0.0, 72, -1), matPaint));
  taxi.add(new THREE.Mesh(endCap(bodyPoint, 1.0, 72,  1), matPaint));

  /* --- 7.2  Greenhouse shell (painted) -------------------------------------- */
  const greenGeo = loft(greenhousePoint, 72, 56, GS0, GS1);
  const greenMesh = new THREE.Mesh(greenGeo, matPaint);
  greenMesh.castShadow = true;
  greenMesh.receiveShadow = true;
  taxi.add(greenMesh);

  /* --- 7.3  Glazing --------------------------------------------------------- */
  const G_OFFSET = 0.009;

  // Side windows (split by a B-pillar gap)
  const sideWindowSpecs = [
    [0.375, 0.495], [0.515, 0.635]
  ];
  for (const [a, b] of sideWindowSpecs){
    taxi.add(new THREE.Mesh(
      patch(greenhousePoint, a, b,  0.240,  0.720, 14, 12, G_OFFSET, GS0, GS1), matGlass));
    taxi.add(new THREE.Mesh(
      patch(greenhousePoint, a, b, Math.PI-0.720, Math.PI-0.240, 14, 12, G_OFFSET, GS0, GS1), matGlass));
  }

  // Windscreen
  taxi.add(new THREE.Mesh(
    patch(greenhousePoint, 0.655, 0.760, 0.060, Math.PI-0.060, 16, 24, G_OFFSET, GS0, GS1), matGlass));

  // Rear screen
  taxi.add(new THREE.Mesh(
    patch(greenhousePoint, 0.262, 0.375, 0.060, Math.PI-0.060, 16, 24, G_OFFSET, GS0, GS1), matGlass));

  /* --- 7.4  Interior (visible through the tinted glass) --------------------- */
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.20, 0.50, 1.40), matInterior);
  cabin.position.set(0, 0.86, -0.02);
  taxi.add(cabin);

  for (const sx of [-1, 1]){
    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.46), matInterior);
    seatBase.position.set(sx*0.30, 0.98, 0.02);
    taxi.add(seatBase);

    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.13), matInterior);
    seatBack.position.set(sx*0.30, 1.18, -0.18);
    seatBack.rotation.x = -0.16;
    taxi.add(seatBack);
  }

  /* --- 7.5  Underbody plate (blocks see-through under the car) -------------- */
  const under = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.06, 3.10), matBlackPlastic);
  under.position.set(0, 0.255, 0);
  taxi.add(under);

  /* --- 7.6  Checker belt -----------------------------------------------------
     A strip that literally follows the body surface. For each station s and each
     requested height y we invert the superellipse:

          yn = (y - cy)/hy
          |sinθ| = |yn|^(n/2)         →   θ = asin(|yn|^(n/2))

     then sample S(s, θ) and push it out along the analytic normal.
     ------------------------------------------------------------------------- */
  function checkerBelt(side){
    const s0 = 0.300, s1 = 0.700, y0 = 0.560, y1 = 0.740;
    const NS = 96, NY = 8;
    const pos = [], nor = [], uv = [], idx = [];

    const P = new THREE.Vector3(), N = new THREE.Vector3();

    for (let i = 0; i <= NS; i++){
      const s = lerp(s0, s1, i/NS);
      const yb = cYB(s), yt = cYT(s), n = cN(s);
      const cy = 0.5*(yb + yt), hy = 0.5*(yt - yb);

      for (let j = 0; j <= NY; j++){
        const y  = lerp(y0, y1, j/NY);
        const yn = clamp((y - cy)/hy, -0.9995, 0.9995);
        const sn = Math.pow(Math.abs(yn), n/2);
        let th = Math.asin(clamp(sn, 0, 1));
        if (yn < 0) th = -th;
        if (side < 0) th = Math.PI - th;

        bodyPoint(s, th, P);
        normalOf(bodyPoint, s, th, 0, 1, N);

        pos.push(P.x + N.x*0.007, P.y + N.y*0.007, P.z + N.z*0.007);
        nor.push(N.x, N.y, N.z);
        uv.push(i/NS, j/NY);
      }
    }
    for (let i = 0; i < NS; i++){
      for (let j = 0; j < NY; j++){
        const a = i*(NY+1) + j, b = a+1, c = a+NY+1, d = c+1;
        if (side > 0) idx.push(a, b, c,  b, d, c);
        else          idx.push(a, c, b,  b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal',   new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv',       new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }

  const beltTex = checkerTexture();
  beltTex.repeat.set(11.5, 1);
  const matBelt = new THREE.MeshStandardMaterial({
    map: beltTex, roughness: 0.35, metalness: 0.1
  });

  taxi.add(new THREE.Mesh(checkerBelt( 1), matBelt));
  taxi.add(new THREE.Mesh(checkerBelt(-1), matBelt));

  /* --- 7.7  Bumpers ---------------------------------------------------------- */
  function roundedBox(w, h, d, r, mat){
    const g = new THREE.BoxGeometry(w, h, d, 6, 4, 4);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    const hw = w/2 - r, hh = h/2 - r, hd = d/2 - r;
    for (let i = 0; i < p.count; i++){
      v.fromBufferAttribute(p, i);
      const cx = clamp(v.x, -hw, hw), cy = clamp(v.y, -hh, hh), cz = clamp(v.z, -hd, hd);
      const dx = v.x - cx, dy = v.y - cy, dz = v.z - cz;
      const len = Math.hypot(dx, dy, dz);
      if (len > 1e-6){
        const k = r/len;
        p.setXYZ(i, cx + dx*k, cy + dy*k, cz + dz*k);
      }
    }
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  }

  const frontBumper = roundedBox(1.78, 0.30, 0.34, 0.09, matBlackPlastic);
  frontBumper.position.set(0, 0.50, 2.11);
  frontBumper.castShadow = true;
  taxi.add(frontBumper);

  const rearBumper = roundedBox(1.78, 0.30, 0.32, 0.09, matBlackPlastic);
  rearBumper.position.set(0, 0.50, -2.11);
  rearBumper.castShadow = true;
  taxi.add(rearBumper);

  /* --- 7.8  Grille ----------------------------------------------------------- */
  const grille = roundedBox(0.94, 0.22, 0.10, 0.035, matBlackPlastic);
  grille.position.set(0, 0.62, 2.245);
  taxi.add(grille);

  for (let i = 0; i < 4; i++){
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.018, 0.03), matChrome);
    slat.position.set(0, 0.545 + i*0.052, 2.285);
    taxi.add(slat);
  }

  /* --- 7.9  Lamps ------------------------------------------------------------ */
  function surfaceAnchor(s, theta, offset){
    const P = new THREE.Vector3(), N = new THREE.Vector3();
    bodyPoint(s, theta, P);
    normalOf(bodyPoint, s, theta, 0, 1, N);
    P.addScaledVector(N, offset);
    return { p: P, n: N };
  }

  // Headlights
  for (const side of [-1, 1]){
    const a = surfaceAnchor(0.930, side > 0 ? 0.30 : Math.PI - 0.30, 0.012);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), matHeadlight);
    lamp.scale.set(0.115, 0.070, 0.085);
    lamp.position.copy(a.p);
    lamp.lookAt(a.p.clone().add(a.n));
    taxi.add(lamp);

    // chrome bezel
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 10, 28), matChrome);
    bezel.scale.set(1.15, 0.72, 1);
    bezel.position.copy(a.p).addScaledVector(a.n, -0.02);
    bezel.lookAt(a.p.clone().add(a.n));
    taxi.add(bezel);
  }

  // Tail lights
  for (const side of [-1, 1]){
    const a = surfaceAnchor(0.062, side > 0 ? 0.36 : Math.PI - 0.36, 0.012);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.12, 0.09), matTaillight);
    lamp.position.copy(a.p);
    lamp.lookAt(a.p.clone().add(a.n));
    lamp.castShadow = true;
    taxi.add(lamp);
  }

  // Front indicator strips
  for (const side of [-1, 1]){
    const a = surfaceAnchor(0.955, side > 0 ? 0.80 : Math.PI - 0.80, 0.010);
    const ind = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.07),
      new THREE.MeshStandardMaterial({ color: 0xff9a00, emissive: 0xff7b00,
        emissiveIntensity: 0.8, roughness: 0.2 }));
    ind.position.copy(a.p);
    ind.lookAt(a.p.clone().add(a.n));
    taxi.add(ind);
  }

  /* --- 7.10  Roof sign ------------------------------------------------------- */
  const signGroup = new THREE.Group();
  signGroup.position.set(0, 1.605, -0.06);
  taxi.add(signGroup);

  const signBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.20, 0.15), matSignGlow);
  signBody.castShadow = true;
  signGroup.add(signBody);

  const signShell = new THREE.Mesh(
    new THREE.BoxGeometry(0.655, 0.225, 0.13),
    new THREE.MeshStandardMaterial({ color: 0x1b1e26, roughness: 0.4, metalness: 0.7 })
  );
  signShell.position.z = 0;
  signGroup.add(signShell);


  for (const sx of [-0.20, 0.20]){
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.10), matBlackPlastic);
    foot.position.set(sx, -0.125, 0);
    signGroup.add(foot);
  }

  /* --- 7.11  Mirrors --------------------------------------------------------- */
  for (const side of [-1, 1]){
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.026, 0.14, 12), matBlackPlastic);
    stalk.position.set(side*0.855, 0.905, 0.63);
    stalk.rotation.z = side * 1.02;
    taxi.add(stalk);

    const housing = roundedBox(0.13, 0.085, 0.10, 0.035, matPaint);
    housing.position.set(side*0.955, 0.935, 0.63);
    housing.castShadow = true;
    taxi.add(housing);

    const glassMirror = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), matChrome);
    glassMirror.position.set(side*0.985, 0.935, 0.60);
    glassMirror.rotation.y = side * Math.PI/2;
    taxi.add(glassMirror);
  }

  /* --- 7.12  Door handles, exhaust, plates ---------------------------------- */
  for (const side of [-1, 1]){
    for (const z of [0.28, -0.62]){
      const h = roundedBox(0.035, 0.045, 0.20, 0.015, matChrome);
      const a = surfaceAnchor(z > 0 ? 0.58 : 0.40, side > 0 ? 0.02 : Math.PI - 0.02, 0.018);
      h.position.copy(a.p);
      h.position.y = 0.84;
      taxi.add(h);
    }
  }

  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.042, 0.20, 16), matChrome);
  exhaust.rotation.x = Math.PI/2;
  exhaust.position.set(-0.56, 0.315, -2.26);
  taxi.add(exhaust);

  const plateFront = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.13),
    new THREE.MeshStandardMaterial({ map: plateTexture('NYC · 7T42'), roughness: 0.6 })
  );
  plateFront.position.set(0, 0.40, 2.275);
  taxi.add(plateFront);

  const plateRear = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.13),
    new THREE.MeshStandardMaterial({ map: plateTexture('NYC · 7T42'), roughness: 0.6 })
  );
  plateRear.position.set(0, 0.62, -2.272);
  plateRear.rotation.y = Math.PI;
  taxi.add(plateRear);

  /* --- 7.13  Wheels ---------------------------------------------------------- */
  function buildWheel(){
    const g = new THREE.Group();

    /* Tyre — a surface of revolution (LatheGeometry) of a sidewall profile.
       Each profile point (r, h) sweeps a circle:  (r·cosφ, h, r·sinφ)          */
    const profile = [
      [0.230,-0.112],[0.252,-0.116],[0.292,-0.117],[0.324,-0.112],
      [0.343,-0.098],[0.352,-0.072],[0.356,-0.030],[0.356, 0.000],
      [0.356, 0.030],[0.352, 0.072],[0.343, 0.098],[0.324, 0.112],
      [0.292, 0.117],[0.252, 0.116],[0.230, 0.112]
    ].map(p => new THREE.Vector2(p[0], p[1]));

    const tyreGeo = new THREE.LatheGeometry(profile, 32);
    tyreGeo.rotateZ(Math.PI/2);                 // spin axis → X
    const tyre = new THREE.Mesh(tyreGeo, matRubber);
    tyre.castShadow = true;
    g.add(tyre);

    // Rim barrel
    const barrelGeo = new THREE.CylinderGeometry(0.234, 0.234, 0.196, 40, 1, true);
    barrelGeo.rotateZ(Math.PI/2);
    g.add(new THREE.Mesh(barrelGeo, matDarkMetal));

    // Rim face disc
    const faceGeo = new THREE.CylinderGeometry(0.234, 0.226, 0.016, 40);
    faceGeo.rotateZ(Math.PI/2);
    const face = new THREE.Mesh(faceGeo, matChrome);
    face.position.x = 0.086;
    g.add(face);

    // Brake disc
    const discGeo = new THREE.CylinderGeometry(0.185, 0.185, 0.022, 32);
    discGeo.rotateZ(Math.PI/2);
    const disc = new THREE.Mesh(discGeo, matDarkMetal);
    disc.position.x = 0.020;
    g.add(disc);

    // Five spokes, radial box instances rotated about the axle
    for (let i = 0; i < 5; i++){
      const angle = i * (Math.PI*2/5);
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.190, 0.058), matChrome);
      spoke.position.set(0.100, 0.100, 0);
      spoke.rotation.x = angle;
      // reposition radially after rotation
      spoke.position.y = Math.cos(angle) * 0.100;
      spoke.position.z = Math.sin(angle) * 0.100;
      spoke.rotation.x = -angle;
      spoke.castShadow = true;
      g.add(spoke);
    }

    // Hub cap
    const hubGeo = new THREE.CylinderGeometry(0.062, 0.062, 0.045, 24);
    hubGeo.rotateZ(Math.PI/2);
    const hub = new THREE.Mesh(hubGeo, matChrome);
    hub.position.x = 0.108;
    g.add(hub);

    return g;
  }

  const WHEEL_R = 0.356;
  const wheelPositions = [
    [ 0.800, WHEEL_R,  1.450, true ], [-0.800, WHEEL_R,  1.450, true ],
    [ 0.800, WHEEL_R, -1.450, false], [-0.800, WHEEL_R, -1.450, false]
  ];

  const wheelProto = buildWheel();
  const wheels = [];
  for (const [x, y, z, front] of wheelPositions){
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    const spin = new THREE.Group();
    pivot.add(spin);
    const w = wheelProto.clone();
    if (x < 0) w.rotation.y = Math.PI;          /* rim face points outward on both sides */
    spin.add(w);
    taxi.add(pivot);
    wheels.push({ pivot, spin, steer: front, spinZ: false });   /* axle = X in this frame */
  }

  /* --- 7.14  Wheel-arch trim (thin chrome lip around each opening) ---------- */
  for (const zc of [1.450, -1.450]){
    for (const side of [-1, 1]){
      const pts = [];
      for (let i = 0; i <= 24; i++){
        const t = i / 24;
        const ang = Math.PI * t;
        const s = (zc + Math.cos(ang) * 0.50 + 2.30) / LEN;
        pts.push(new THREE.Vector3(side * 0.905, 0.72 + Math.sin(ang) * 0.02, zc + Math.cos(ang) * 0.50));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 40, 0.016, 8, false),
        matBlackPlastic
      );
      taxi.add(tube);
    }
  }

  /* nose is +Z in the maths above; the game's models point their nose toward +X */
  taxi.scale.setScalar(1.1);
  const root = new THREE.Group();
  taxi.rotation.y = Math.PI / 2;
  root.add(taxi);
  root.userData.wheels = wheels;
  root.userData.isLoftTaxi = true;
  return root;
}
