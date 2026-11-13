/* beach/interior.js -- converted from standalone "Beach Walk".
   World code is the prototype's own; first-person controls, renderer, loop,
   resize and boot UI were removed and replaced by the game's ThirdPersonControls.
   Terrain height is exposed through world.groundAt so the avatar follows the dunes. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import { addStreetLamp } from "../../core/scene-lamps.js";
import { addNightGlow } from "../../core/night-glow.js";

export async function buildInterior(router) {
  const CORES = navigator.hardwareConcurrency || 4, MEM_GB = navigator.deviceMemory || 8;
  const LOW = CORES <= 4 || MEM_GB <= 2;
  const Q = {
    terrainSeg: LOW ? 112 : 168, grass: LOW ? 650 : 1500, rocks: LOW ? 26 : 58, pebbles: LOW ? 110 : 320,
    palms: LOW ? 9 : 16, logs: LOW ? 4 : 7, clouds: LOW ? 5 : 8, waterSeg: LOW ? 40 : 64,
  };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.15, 800);
  camera.rotation.order = "YXZ";
  const FOG_COLOR = new THREE.Color(0xcabfae), FOG_DENSITY = 0.0056;
  scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);
  const SUN_DIR = new THREE.Vector3(0.34, 0.245, 0.905).normalize();

  /* ---- math ---- */
  function smoothstep(e0, e1, x) { let t = (x - e0) / (e1 - e0); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash2(ix, iy) {
    let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
    return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
  }
  function fbm(x, y, oct) { let s = 0, amp = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f, y * f); f *= 2.03; amp *= 0.5; } return s; }

  /* ---- terrain field ---- */
  function shoreOffset(x) { return Math.sin(x * 0.021) * 9.0 + Math.sin(x * 0.058 + 1.7) * 3.5 + Math.sin(x * 0.11 + 0.4) * 1.2; }
  function zzOf(x, z) { return z - shoreOffset(x); }
  function terrainHeight(x, z) {
    const zz = zzOf(x, z), zc = Math.max(zz, -50);
    let h = 0.4 - zc * 0.075;
    const inland = smoothstep(-2.0, 24.0, -zz);
    if (inland > 0.001) {
      h += inland * (fbm(x * 0.017, z * 0.017, 3) * 3.4 + 1.3);
      h += inland * fbm(x * 0.07 + 31.1, z * 0.07 - 12.7, 2) * 0.5;
    }
    h += Math.sin(x * 1.7 + fbm(x * 0.12, z * 0.12, 2) * 8.0) * 0.012;
    return h;
  }
  const _n = new THREE.Vector3();
  function terrainNormal(x, z, out) {
    const e = 0.7;
    out.set(terrainHeight(x - e, z) - terrainHeight(x + e, z), 2 * e, terrainHeight(x, z - e) - terrainHeight(x, z + e)).normalize();
    return out;
  }

  /* ---- textures ---- */
  function makeSandTexture(size) {
    const c = document.createElement("canvas"); c.width = c.height = size;
    const g = c.getContext("2d"), img = g.createImageData(size, size), d = img.data;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let v = 196 + (Math.random() - 0.5) * 74;
      v += (vnoise(x * 0.075, y * 0.075) - 0.5) * 46;
      v += (vnoise(x * 0.42, y * 0.42) - 0.5) * 22;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function makeRadialShadowTexture() {
    const s = 128, c = document.createElement("canvas"); c.width = c.height = s;
    const g = c.getContext("2d"), grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, "rgba(255,255,255,0.85)"); grd.addColorStop(0.45, "rgba(255,255,255,0.42)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function makeCloudTexture() {
    const s = 128, c = document.createElement("canvas"); c.width = c.height = s;
    const g = c.getContext("2d");
    for (let i = 0; i < 26; i++) {
      const x = 20 + Math.random() * (s - 40), y = s * 0.30 + Math.random() * s * 0.42, r = 9 + Math.random() * 24;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, "rgba(255,255,255,0.50)"); grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  /* ---- lights ---- */
  const sunLight = new THREE.DirectionalLight(0xffe6bb, 3.0); sunLight.position.copy(SUN_DIR).multiplyScalar(120); scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(0xa8cbe8, 0xd0bd96, 1.45));

  /* ---- sky ---- */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: {
      uSunDir: { value: SUN_DIR }, uZenith: { value: new THREE.Color(0x2a6da8) },
      uHorizCool: { value: new THREE.Color(0xa9c6dc) }, uHorizWarm: { value: new THREE.Color(0xffd6a2) }, uSunColor: { value: new THREE.Color(0xfff4d8) },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uSunDir, uZenith, uHorizCool, uHorizWarm, uSunColor;
      void main(){
        vec3 d = normalize(vDir); float y = d.y;
        float horizMix = pow(1.0 - clamp(y, 0.0, 1.0), 4.5);
        vec2 dh = normalize(d.xz + vec2(1e-5)); vec2 sh = normalize(uSunDir.xz + vec2(1e-5));
        float sunSide = pow(clamp(dot(dh, sh) * 0.5 + 0.5, 0.0, 1.0), 2.2);
        vec3 horizonCol = mix(uHorizCool, uHorizWarm, sunSide);
        vec3 col = mix(uZenith, horizonCol, horizMix);
        float sd = max(dot(d, uSunDir), 0.0);
        col += uSunColor * pow(sd, 900.0) * 7.0; col += uSunColor * pow(sd, 42.0) * 0.32; col += uSunColor * pow(sd, 6.0) * 0.10;
        col = mix(col, horizonCol * 0.82, smoothstep(0.0, -0.16, y));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 18), skyMat);
  sky.renderOrder = -1000; sky.frustumCulled = false; scene.add(sky);

  const WORLD = 280;
  let time = 0;
  const uTimeGrass = { value: 0 }, uTimeWater = { value: 0 };

  /* ---- water ---- */
  const waterMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: uTimeWater, uSunDir: { value: SUN_DIR }, uDeep: { value: new THREE.Color(0x0a3a5c) }, uShallow: { value: new THREE.Color(0x35a9b4) },
      uSky: { value: new THREE.Color(0x9dc3dd) }, uSunColor: { value: new THREE.Color(0xfff1cf) }, uFogColor: { value: FOG_COLOR }, uFogDensity: { value: FOG_DENSITY },
    },
    transparent: true, depthWrite: false, fog: false,
    vertexShader: `
      uniform float uTime; varying vec3 vWorld;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        wp.y += sin(wp.x * 0.075 + uTime * 0.8) * 0.09 + sin(wp.z * 0.092 - uTime * 0.95) * 0.07;
        vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      precision highp float;
      uniform float uTime, uFogDensity; uniform vec3 uSunDir, uDeep, uShallow, uSky, uSunColor, uFogColor; varying vec3 vWorld;
      float shoreOff(float x){ return sin(x * 0.021) * 9.0 + sin(x * 0.058 + 1.7) * 3.5 + sin(x * 0.11 + 0.4) * 1.2; }
      float sandH(vec2 p){ float zz = p.y - shoreOff(p.x); float zc = max(zz, -50.0); return 0.4 - zc * 0.075; }
      vec2 waveGrad(vec2 p, float t, out float h){
        h = 0.0; vec2 g = vec2(0.0); float ph, a;
        a = 0.090; ph = p.x*0.28 + p.y*0.19 + t*1.15; h += sin(ph)*a; g += cos(ph)*a*vec2(0.28, 0.19);
        a = 0.070; ph = p.x*0.13 - p.y*0.34 + t*0.85; h += sin(ph)*a; g += cos(ph)*a*vec2(0.13,-0.34);
        a = 0.028; ph = p.x*0.62 + p.y*0.51 - t*1.85; h += sin(ph)*a; g += cos(ph)*a*vec2(0.62, 0.51);
        a = 0.012; ph = p.x*1.25 - p.y*0.95 + t*2.60; h += sin(ph)*a; g += cos(ph)*a*vec2(1.25,-0.95);
        return g;
      }
      void main(){
        vec2 p = vWorld.xz; float h; vec2 g = waveGrad(p, uTime, h);
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y)); vec3 V = normalize(cameraPosition - vWorld);
        float sd = -sandH(p); float depth = max(0.0, sd);
        vec3 col = mix(uDeep, uShallow, 1.0 - smoothstep(0.0, 3.2, depth));
        float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
        col = mix(col, uSky, fres * 0.78);
        vec3 Hv = normalize(uSunDir + V); float spec = pow(max(dot(N, Hv), 0.0), 180.0);
        col += uSunColor * spec * 2.4;
        float wob = sin(vWorld.x * 0.85 + uTime * 1.1) * 0.5 + sin(vWorld.z * 1.40 - uTime * 0.7) * 0.5;
        float band = smoothstep(0.62, 0.0, sd + wob * 0.22);
        float crest = smoothstep(0.085, 0.140, h);
        float foam = clamp(band * 0.92 + crest * 0.55, 0.0, 1.0);
        float sp = sin(vWorld.x * 6.0 + uTime * 3.0) * sin(vWorld.z * 5.3 - uTime * 2.2);
        foam *= smoothstep(-0.45, 0.55, sp * 0.5 + 0.55);
        col = mix(col, vec3(0.94, 0.97, 1.0), foam);
        float alpha = clamp(0.42 + smoothstep(0.0, 1.5, depth) * 0.55, 0.0, 0.95);
        alpha = max(alpha, foam * 0.95);
        float dist = length(cameraPosition - vWorld);
        float fogF = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
        col = mix(col, uFogColor, fogF);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  /* ---- geometry factories ---- */
  function makeGrassGeometry() {
    const pos = [], col = [], idx = [];
    const cBase = new THREE.Color(0x4a5c2a), cTip = new THREE.Color(0xbdb271);
    const blades = 5; let vi = 0;
    for (let b = 0; b < blades; b++) {
      const ang = (b / blades) * Math.PI * 2 + Math.random() * 0.9, lean = 0.22 + Math.random() * 0.5, hgt = 0.50 + Math.random() * 0.52, w0 = 0.036;
      const dx = Math.cos(ang), dz = Math.sin(ang), px = -dz, pz = dx, SEG = 3;
      for (let s = 0; s <= SEG; s++) {
        const u = s / SEG, bend = u * u * lean * 0.55, x = dx * bend, z = dz * bend, y = hgt * u, w = w0 * (1 - u * 0.92);
        pos.push(x + px * w, y, z + pz * w); pos.push(x - px * w, y, z - pz * w);
        const c = cBase.clone().lerp(cTip, u); col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
      for (let s = 0; s < SEG; s++) { const i0 = vi + s * 2; idx.push(i0, i0 + 1, i0 + 3, i0, i0 + 3, i0 + 2); }
      vi += (SEG + 1) * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  }

  function makePalmGeometry(seed) {
    const rnd = mulberry32(seed), pos = [], col = [], idx = []; let vi = 0;
    const cTrunkA = new THREE.Color(0x6a4f32), cTrunkB = new THREE.Color(0xa08155), cLeafA = new THREE.Color(0x33552a), cLeafB = new THREE.Color(0x8bb254);
    const H = 5.2 + rnd() * 2.6, bendX = (rnd() - 0.5) * 2.0, bendZ = (rnd() - 0.5) * 2.0, RINGS = 9, SIDES = 7, baseR = 0.19 + rnd() * 0.07;
    const spine = [];
    for (let i = 0; i <= RINGS; i++) {
      const t = i / RINGS;
      spine.push({ x: bendX * t * t, y: H * t, z: bendZ * t * t, r: baseR * (1 - 0.5 * t) * (1 + 0.09 * Math.sin(t * Math.PI * 6.5)) });
    }
    for (let i = 0; i <= RINGS; i++) {
      const s = spine[i];
      for (let j = 0; j < SIDES; j++) {
        const a = (j / SIDES) * Math.PI * 2;
        pos.push(s.x + Math.cos(a) * s.r, s.y, s.z + Math.sin(a) * s.r);
        const c = cTrunkA.clone().lerp(cTrunkB, i / RINGS), sh = 0.86 + 0.14 * Math.cos(a);
        col.push(c.r * sh, c.g * sh, c.b * sh);
      }
    }
    for (let i = 0; i < RINGS; i++) for (let j = 0; j < SIDES; j++) {
      const a = vi + i * SIDES + j, b = vi + i * SIDES + (j + 1) % SIDES, c = vi + (i + 1) * SIDES + j, d = vi + (i + 1) * SIDES + (j + 1) % SIDES;
      idx.push(a, c, b, b, c, d);
    }
    vi += (RINGS + 1) * SIDES;
    const top = spine[RINGS], nF = 8 + Math.floor(rnd() * 3);
    for (let f = 0; f < nF; f++) {
      const ang = (f / nF) * Math.PI * 2 + rnd() * 0.5, dx = Math.cos(ang), dz = Math.sin(ang), px = -dz, pz = dx;
      const len = 2.4 + rnd() * 1.5, droop = 1.5 + rnd() * 1.1, rise = 0.9 + rnd() * 0.6, SEGS = 6, halfW = 0.25 + rnd() * 0.09, fbase = vi;
      for (let s = 0; s <= SEGS; s++) {
        const u = s / SEGS, cx = top.x + dx * len * u, cz = top.z + dz * len * u, cy = top.y + rise * u - droop * u * u;
        const w = halfW * Math.sin(Math.PI * Math.pow(u, 0.75)) + 0.015, fold = w * 0.45;
        pos.push(cx, cy + fold, cz); pos.push(cx + px * w, cy - fold * 0.6, cz + pz * w); pos.push(cx - px * w, cy - fold * 0.6, cz - pz * w);
        const c = cLeafA.clone().lerp(cLeafB, u * 0.85 + rnd() * 0.15);
        col.push(c.r, c.g, c.b, c.r * 0.88, c.g * 0.88, c.b * 0.88, c.r * 0.88, c.g * 0.88, c.b * 0.88);
        vi += 3;
      }
      for (let s = 0; s < SEGS; s++) {
        const a0 = fbase + s * 3, a1 = fbase + (s + 1) * 3;
        idx.push(a0, a0 + 1, a1 + 1, a0, a1 + 1, a1); idx.push(a0, a1, a1 + 2, a0, a1 + 2, a0 + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  }

  function makeRockGeometry() {
    const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = vnoise(x * 3.1 + 11.3, y * 3.1 + 7.7) * 0.55 + vnoise(y * 4.7 + 3.1, z * 4.7 + 9.4) * 0.45, s = 0.72 + n * 0.55;
      p.setXYZ(i, x * s, y * s * 0.78, z * s);
    }
    g.computeVertexNormals(); return g;
  }

  /* ---- build world ---- */
  function buildWorld() {
    const SEG = Q.terrainSeg;
    const geo = new THREE.PlaneGeometry(WORLD, WORLD, SEG, SEG); geo.rotateX(-Math.PI / 2);
    const posAttr = geo.attributes.position, colors = new Float32Array(posAttr.count * 3);
    const cDry = new THREE.Color(0xf0e0bb), cWet = new THREE.Color(0xb09a72), cDeep = new THREE.Color(0x6d6449), cVeg = new THREE.Color(0x93a05a), tmp = new THREE.Color();
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i), z = posAttr.getZ(i), h = terrainHeight(x, z);
      posAttr.setY(i, h);
      const zz = zzOf(x, z); tmp.copy(cDry);
      tmp.lerp(cWet, (1 - smoothstep(-0.1, 1.2, h)) * 0.9);
      tmp.lerp(cDeep, smoothstep(0.0, -2.2, h) * 0.85);
      const inland = smoothstep(-2.0, 26.0, -zz), vegN = fbm(x * 0.045 + 7.3, z * 0.045 - 3.1, 2);
      tmp.lerp(cVeg, inland * 0.42 * smoothstep(0.34, 0.76, vegN));
      tmp.multiplyScalar(0.90 + fbm(x * 0.4 + 1.7, z * 0.4 + 9.2, 2) * 0.22);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3)); geo.computeVertexNormals();
    const sandTex = makeSandTexture(512); sandTex.repeat.set(WORLD / 2.2, WORLD / 2.2);
    sandTex.anisotropy = Math.min(4, router.renderer.capabilities.getMaxAnisotropy());
    const terrain = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ map: sandTex, bumpMap: sandTex, bumpScale: 0.16, vertexColors: true, shininess: 22, specular: new THREE.Color(0x151513) }));
    terrain.frustumCulled = false; scene.add(terrain);

    const wGeo = new THREE.PlaneGeometry(700, 700, Q.waterSeg, Q.waterSeg); wGeo.rotateX(-Math.PI / 2);
    const waterMesh = new THREE.Mesh(wGeo, waterMat); waterMesh.position.set(0, 0, 200); waterMesh.renderOrder = 2; waterMesh.frustumCulled = false; scene.add(waterMesh);

    const rng = mulberry32(90210), blockers = [], shadowItems = [], up = new THREE.Vector3(0, 1, 0);
    const free = (x, z, r) => { for (const b of blockers) { const dx = b.x - x, dz = b.z - z; if (dx * dx + dz * dz < (b.r + r) * (b.r + r)) return false; } return true; };
    function scatter(count, radius, test, cb) {
      let placed = 0, tries = 0; const max = count * 60;
      while (placed < count && tries < max) {
        tries++;
        const x = (Math.random() - 0.5) * WORLD * 0.88, z = (Math.random() - 0.5) * WORLD * 0.88;
        if (!test(x, z)) continue;
        if (radius > 0 && !free(x, z, radius)) continue;
        if (radius > 0) blockers.push({ x, z, r: radius });
        cb(x, z); placed++;
      }
    }

    const palmGeoA = makePalmGeometry(1234), palmGeoB = makePalmGeometry(8765);
    const palmMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    palmMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTimeGrass;
      sh.vertexShader = "uniform float uTime;\n" + sh.vertexShader;
      sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float iph = instanceMatrix[3].x * 0.45 + instanceMatrix[3].z * 0.35;
        #else
          float iph = 0.0;
        #endif
        float k = clamp(transformed.y / 7.0, 0.0, 1.0);
        float sw = sin(uTime * 1.25 + iph) * 0.20 + sin(uTime * 2.6 + iph * 1.9) * 0.07;
        transformed.x += sw * k * k; transformed.z += sw * 0.7 * k * k;`);
    };
    const nA = Math.ceil(Q.palms / 2), nB = Q.palms - nA;
    const palmsA = new THREE.InstancedMesh(palmGeoA, palmMat, nA), palmsB = new THREE.InstancedMesh(palmGeoB, palmMat, nB);
    palmsA.frustumCulled = palmsB.frustumCulled = false;
    let ia = 0, ib = 0;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
    scatter(Q.palms, 4.5,
      (x, z) => { const zz = zzOf(x, z); if (zz > -13 || zz < -105) return false; const h = terrainHeight(x, z); return h > 1.1 && h < 8.5; },
      (x, z) => {
        const y = terrainHeight(x, z) - 0.18, sc = 0.82 + rng() * 0.45;
        q.setFromAxisAngle(up, rng() * Math.PI * 2); v3.set(x, y, z); s3.set(sc, sc, sc); m4.compose(v3, q, s3);
        if (ia < nA) palmsA.setMatrixAt(ia++, m4); else if (ib < nB) palmsB.setMatrixAt(ib++, m4);
        shadowItems.push({ x, z, size: 3.6 * sc });
      });
    palmsA.count = ia; palmsB.count = ib;
    palmsA.instanceMatrix.needsUpdate = true; palmsB.instanceMatrix.needsUpdate = true; scene.add(palmsA, palmsB);

    const rockGeo = makeRockGeometry();
    const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), Q.rocks);
    rocks.frustumCulled = false;
    const rockCol = new THREE.Color(); let ri = 0;
    scatter(Q.rocks, 2.6,
      (x, z) => zzOf(x, z) >= -45 && terrainHeight(x, z) > -2.2,
      (x, z) => {
        const sc = 0.35 + Math.pow(rng(), 2.2) * 1.5, y = terrainHeight(x, z) - sc * 0.28;
        q.setFromEuler(new THREE.Euler(rng() * 0.5, rng() * Math.PI * 2, rng() * 0.5)); v3.set(x, y, z);
        s3.set(sc * (0.85 + rng() * 0.5), sc * (0.7 + rng() * 0.5), sc * (0.85 + rng() * 0.5)); m4.compose(v3, q, s3);
        rocks.setMatrixAt(ri, m4);
        const t = 0.55 + rng() * 0.4; rockCol.setRGB(0.52 * t, 0.48 * t, 0.42 * t); rocks.setColorAt(ri, rockCol);
        shadowItems.push({ x, z, size: sc * 2.6 }); ri++;
      });
    rocks.count = ri; rocks.instanceMatrix.needsUpdate = true; if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true; scene.add(rocks);

    const pebbles = new THREE.InstancedMesh(rockGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), Q.pebbles);
    pebbles.frustumCulled = false;
    const pebCol = new THREE.Color(); let pi = 0;
    scatter(Q.pebbles, 0,
      (x, z) => { const zz = zzOf(x, z); return zz > -20 && zz < 12 && terrainHeight(x, z) > -0.9; },
      (x, z) => {
        const sc = 0.05 + Math.pow(rng(), 2) * 0.16, y = terrainHeight(x, z);
        q.setFromEuler(new THREE.Euler(rng() * 3, rng() * 3, rng() * 3)); v3.set(x, y + sc * 0.25, z); s3.set(sc, sc * 0.6, sc); m4.compose(v3, q, s3);
        pebbles.setMatrixAt(pi, m4);
        if (rng() > 0.72) pebCol.setRGB(0.92, 0.88, 0.80); else pebCol.setRGB(0.46, 0.44, 0.40);
        pebbles.setColorAt(pi, pebCol); pi++;
      });
    pebbles.count = pi; pebbles.instanceMatrix.needsUpdate = true; if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true; scene.add(pebbles);

    const logGeo = new THREE.CylinderGeometry(0.11, 0.17, 2.3, 6, 1); logGeo.rotateZ(Math.PI / 2);
    const logs = new THREE.InstancedMesh(logGeo, new THREE.MeshLambertMaterial({ color: 0x9a8b74, flatShading: true }), Q.logs);
    logs.frustumCulled = false; let li = 0;
    scatter(Q.logs, 3,
      (x, z) => { const zz = zzOf(x, z); return zz > -22 && zz < -1 && terrainHeight(x, z) > 0.1; },
      (x, z) => {
        const sc = 0.8 + rng() * 0.8, y = terrainHeight(x, z) + 0.1 * sc;
        q.setFromEuler(new THREE.Euler((rng() - 0.5) * 0.35, rng() * Math.PI * 2, (rng() - 0.5) * 0.35)); v3.set(x, y, z); s3.set(sc, sc, sc); m4.compose(v3, q, s3);
        logs.setMatrixAt(li++, m4); shadowItems.push({ x, z, size: 2.4 * sc });
      });
    logs.count = li; logs.instanceMatrix.needsUpdate = true; scene.add(logs);

    const grassMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    grassMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTimeGrass;
      sh.vertexShader = "uniform float uTime;\n" + sh.vertexShader;
      sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float iph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.55;
        #else
          float iph = 0.0;
        #endif
        float swayAmt = max(transformed.y, 0.0);
        float sw = sin(uTime * 1.7 + iph) * 0.11 + sin(uTime * 2.9 + iph * 1.7) * 0.045;
        transformed.x += sw * swayAmt; transformed.z += sw * 0.6 * swayAmt;`);
    };
    const grass = new THREE.InstancedMesh(makeGrassGeometry(), grassMat, Q.grass);
    grass.frustumCulled = false; let gi = 0;
    scatter(Q.grass, 0,
      (x, z) => { const zz = zzOf(x, z); if (zz > -5 || zz < -95) return false; const h = terrainHeight(x, z); return h > 0.7 && h < 9.5; },
      (x, z) => {
        const y = terrainHeight(x, z) - 0.05, sc = 0.6 + rng() * 0.95;
        q.setFromAxisAngle(up, rng() * Math.PI * 2); v3.set(x, y, z); s3.set(sc, sc * (0.75 + rng() * 0.7), sc); m4.compose(v3, q, s3);
        grass.setMatrixAt(gi++, m4);
      });
    grass.count = gi; grass.instanceMatrix.needsUpdate = true; scene.add(grass);

    const shadowGeo = new THREE.PlaneGeometry(1, 1); shadowGeo.rotateX(-Math.PI / 2);
    const shadows = new THREE.InstancedMesh(shadowGeo, new THREE.MeshBasicMaterial({ map: makeRadialShadowTexture(), color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false }), Math.max(1, shadowItems.length));
    shadows.frustumCulled = false; shadows.renderOrder = 1;
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    for (let i = 0; i < shadowItems.length; i++) {
      const it = shadowItems[i];
      terrainNormal(it.x, it.z, _n); qa.setFromUnitVectors(up, _n); qb.setFromAxisAngle(up, Math.random() * Math.PI * 2); q.copy(qa).multiply(qb);
      v3.set(it.x, terrainHeight(it.x, it.z) + 0.04, it.z); s3.set(it.size, 1, it.size); m4.compose(v3, q, s3); shadows.setMatrixAt(i, m4);
    }
    shadows.count = shadowItems.length; shadows.instanceMatrix.needsUpdate = true; scene.add(shadows);

    const cloudTex = makeCloudTexture();
    for (let i = 0; i < Q.clouds; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.42 + Math.random() * 0.25, depthWrite: false, color: 0xffeedd, fog: false }));
      const ang = Math.random() * Math.PI * 2, dist = 180 + Math.random() * 220;
      sp.position.set(Math.cos(ang) * dist, 70 + Math.random() * 110, Math.sin(ang) * dist);
      const w = 110 + Math.random() * 170; sp.scale.set(w, w * (0.38 + Math.random() * 0.2), 1); scene.add(sp);
    }
    return blockers;
  }
  const blockers = buildWorld();

  /* Warm low-glare promenade lighting: a row of lamps follows the beach
     access path, with ground pools so the sand path remains readable at night. */
  const beachLampSpots = [];
  for (let x = -176; x <= 176; x += 44) {
    const z = -13;
    const gy = terrainHeight(x, z);
    beachLampSpots.push(addStreetLamp(scene, x, gy, z, Math.PI));
  }
  addNightGlow(scene, beachLampSpots, { poolRadius: 12 });

  /* ======== game glue ======== */
  const START = { x: 0, z: -2 };
  const __cols = [];
  for (const b of blockers) if (b.r >= 4) __cols.push({ minX: b.x - 0.35, maxX: b.x + 0.35, minZ: b.z - 0.35, maxZ: b.z + 0.35, y0: 0, y1: 60, level: 0 }); /* palm trunks */
  const uses = [{ kind: "use", label: "ENJOY THE SEA BREEZE", x: START.x, z: START.z + 4, y: 0, level: 0, r: 3 }];
  const __world = {
    colliders: __cols, seats: [], uses, stairs: [], platforms: [], levelHeight: () => 0,
    groundAt: (x, z) => Math.max(terrainHeight(x, z), -0.45),
    bounds: { minX: -WORLD * 0.44, maxX: WORLD * 0.44, minZ: -WORLD * 0.44, maxZ: 30 },
  };
  // Beach leisure zone: colourful umbrellas, loungers, sand castles and usable beach balls.
  const beachProps = new THREE.Group(); scene.add(beachProps);
  const makeMat = (color, roughness = 0.82) => new THREE.MeshStandardMaterial({ color, roughness });
  const sandMat = makeMat(0xd8bd88), poleMat = makeMat(0x6f5135), seatMat = makeMat(0xe8e0cf);
  const umbrellaMats = [0xe74c3c, 0xf1c40f, 0x2e86de, 0x27ae60, 0x9b59b6].map(c => makeMat(c));
  const beachSeats = [];
  function addUmbrella(x, z, colorIndex) {
    const y = terrainHeight(x, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 2.15, 8), poleMat);
    pole.position.set(x, y + 1.08, z); beachProps.add(pole);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.65, 0.62, 10), umbrellaMats[colorIndex % umbrellaMats.length]);
    canopy.position.set(x, y + 2.18, z); canopy.rotation.y = colorIndex * 0.35; beachProps.add(canopy);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.16, 2.0), seatMat);
    seat.position.set(x + 1.9, terrainHeight(x + 1.9, z) + 0.42, z + 0.4); seat.rotation.y = -0.18; beachProps.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.75, 0.12), seatMat);
    back.position.set(x + 1.9, terrainHeight(x + 1.9, z) + 0.78, z - 0.52); back.rotation.x = -0.16; back.rotation.y = -0.18; beachProps.add(back);
    beachSeats.push({ x: x + 1.9, z: z + 0.4, y: terrainHeight(x + 1.9, z) + 0.42, w: 1.35, d: 2.0, level: 0, type: "sit", yaw: Math.PI });
  }
  [[-18,-18,0],[-6,-22,1],[8,-18,2],[22,-24,3],[-30,-30,4],[32,-32,0]].forEach(v => addUmbrella(v[0],v[1],v[2]));

  // Sand castles are sculpted from stacked sand blocks and conical turrets.
  function addSandCastle(x, z, scale = 1) {
    const y = terrainHeight(x, z), m = sandMat;
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.5*scale, 0.65*scale, 2.1*scale), m);
    base.position.set(x, y + 0.32*scale, z); beachProps.add(base);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.48*scale, 0.62*scale, 1.15*scale, 8), m);
    tower.position.set(x, y + 1.15*scale, z); beachProps.add(tower);
    const tur = new THREE.Mesh(new THREE.ConeGeometry(0.58*scale, 0.72*scale, 8), makeMat(0xb98d58));
    tur.position.set(x, y + 2.08*scale, z); beachProps.add(tur);
    for (const dx of [-0.8,0.8]) { const tower2 = new THREE.Mesh(new THREE.CylinderGeometry(0.25*scale,0.34*scale,0.75*scale,7),m); tower2.position.set(x+dx*scale,y+0.7*scale,z+0.62*scale); beachProps.add(tower2); }
  }
  addSandCastle(-9, -7, 0.8); addSandCastle(14, -9, 0.72); addSandCastle(37, -15, 0.65);

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, __world, {
    scene, x: START.x, z: START.z, yaw: Math.PI, level: 0,
    onUse: (use) => { if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE"); },
  });
  __world.seats.push(...beachSeats);
  // Pick up, carry and throw beach balls using the existing carry/drop controls.
  const ballMaterials = [0xff4b4b,0xffd43b,0x39a8ff,0x39c77a].map(c => new THREE.MeshStandardMaterial({ color:c, roughness:0.48 }));
  const beachBalls = [];
  for (let i=0;i<4;i++) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.48, 18, 14), ballMaterials[i]);
    const x = -24 + i*16, z = -5 - (i%2)*5;
    ball.position.set(x, terrainHeight(x,z)+0.5, z); ball.castShadow = true; ball.receiveShadow = true; ball.name = "Beach Ball"; ball.userData._item = { type:"beach-ball", name:"Beach Ball" };
    scene.add(ball); beachBalls.push({ mesh: ball, radius:0.48, halfH:0.48 });
  }
  ctl.registerCarryables(beachBalls);

  // A small group of swimmers patrols the shallow swimming area with a looping stroke/bob animation.
  const swimmers = [];
  const swimmerColors = [0x2e86de,0xf39c12,0xe84393,0x16a085];
  for (let i=0;i<4;i++) {
    const swimmer = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color:[0x8d5524,0xb87948,0x6d4328,0xd49a70][i], roughness:0.9 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24,0.62,4,8), makeMat(swimmerColors[i])); torso.rotation.x = Math.PI/2; swimmer.add(torso);
    const safetyVest = new THREE.Mesh(new THREE.BoxGeometry(0.42,0.24,0.48), vestOrange); safetyVest.position.set(0,0.04,0.12); swimmer.add(safetyVest);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22,12,10), skin); head.position.set(0,0.02,0.56); swimmer.add(head);
    for (const side of [-1,1]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07,0.42,3,6),skin); arm.position.set(side*0.29,0.02,0.12); arm.rotation.z = side*0.48; swimmer.add(arm); }
    const x = -22 + i*14, z = 13 + (i%2)*4; swimmer.position.set(x,-0.16,z); scene.add(swimmer);
    swimmers.push({ group:swimmer, x, z, phase:i*1.7, direction:i%2?1:-1, arms:[swimmer.children[3],swimmer.children[4]] });
  }
  __world.isSwimming = (x,z) => z > 4 && z < 29 && terrainHeight(x,z) < -0.12;
  const beachHud = document.createElement("div"); beachHud.id = "beach-swim-hud";
  beachHud.textContent = "SWIM AREA · Move with the joystick to swim";
  beachHud.style.cssText = "position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 76px);transform:translateX(-50%);z-index:24;padding:8px 13px;border-radius:20px;background:rgba(5,35,55,.72);border:1px solid rgba(130,225,255,.35);color:#eafaff;font:700 11px system-ui;letter-spacing:.08em;pointer-events:none;opacity:0;transition:opacity .2s";
  document.body.appendChild(beachHud);

  // Wearable life jacket: available at the beach rental point and toggled with a clear mobile control.
  const vest = new THREE.Group();
  const vestOrange = new THREE.MeshStandardMaterial({ color:0xff7a18, roughness:0.78 });
  const vestDark = new THREE.MeshStandardMaterial({ color:0x202a32, roughness:0.9 });
  const vestLeft = new THREE.Mesh(new THREE.BoxGeometry(0.36,0.52,0.22), vestOrange); vestLeft.position.set(-0.2,1.12,0.02); vest.add(vestLeft);
  const vestRight = vestLeft.clone(); vestRight.position.x = 0.2; vest.add(vestRight);
  for (const y of [0.91,1.25]) { const strap = new THREE.Mesh(new THREE.BoxGeometry(0.52,0.055,0.25),vestDark); strap.position.y=y; vest.add(strap); }
  vest.visible = false;
  const vestButton = document.createElement("button"); vestButton.id = "beach-life-jacket"; vestButton.type = "button"; vestButton.textContent = "LIFE JACKET: OFF";
  vestButton.style.cssText = "position:fixed;left:16px;bottom:calc(env(safe-area-inset-bottom) + 26px);z-index:31;border:1px solid rgba(255,255,255,.45);border-radius:24px;padding:11px 14px;background:rgba(8,35,48,.88);color:#fff;font:800 11px system-ui;letter-spacing:.04em;box-shadow:0 5px 18px #0006;touch-action:manipulation";
  document.body.appendChild(vestButton);
  const setLifeJacket = (on) => {
    ctl._lifeJacketOn = !!on; vest.visible = !!on;
    vestButton.textContent = on ? "LIFE JACKET: ON" : "LIFE JACKET: OFF";
    vestButton.style.background = on ? "rgba(185,75,12,.94)" : "rgba(8,35,48,.88)";
    if (window.__ph3d_phone) window.__ph3d_phone._toast(on ? "Life jacket equipped" : "Life jacket removed");
  };
  vestButton.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); setLifeJacket(!ctl._lifeJacketOn); });
  ctl.avatar.add(vest);
  // Rental rack beside the promenade, so players understand where the safety equipment comes from.
  const rack = new THREE.Group();
  const rackPost = new THREE.Mesh(new THREE.BoxGeometry(2.2,1.8,0.16), makeMat(0x31515a)); rackPost.position.y=0.9; rack.add(rackPost);
  for (let i=0;i<3;i++) { const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.42,0.72,0.16), vestOrange); jacket.position.set(-0.65+i*0.65,1.0,0.12); rack.add(jacket); }
  rack.position.set(-39,terrainHeight(-39,-5),-5); scene.add(rack);
  const rentalLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map:(() => { const c=document.createElement("canvas"); c.width=512;c.height=128;const x=c.getContext("2d");x.fillStyle="#123b4a";x.fillRect(0,0,512,128);x.fillStyle="#fff";x.font="bold 42px system-ui";x.textAlign="center";x.fillText("LIFE JACKET RENTAL",256,78);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;})(), transparent:true }));
  rentalLabel.position.set(-39,terrainHeight(-39,-5)+2.7,-5); rentalLabel.scale.set(7,1.75,1); scene.add(rentalLabel);

  return {
    three: scene, camera,
    controls: { update: () => {} },
    crumb: "BEACH", title: "BEACH WALK", subtitle: "",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: INTERACT",
    isInterior: true, sceneId: "beach",
    update: (dt) => {
      time += dt; uTimeGrass.value = time; uTimeWater.value = time;
      ctl.update(dt);
      const swimming = !!__world.isSwimming(ctl.pos.x, ctl.pos.z);
      if (vest.parent !== ctl.avatar) ctl.avatar.add(vest);
      beachHud.style.opacity = swimming ? "1" : "0";
      vestButton.style.opacity = swimming ? "1" : "0.88";
      for (const n of swimmers) {
        n.phase += dt * 2.1;
        n.group.position.x = n.x + Math.sin(n.phase * 0.45) * 3.8 * n.direction;
        n.group.position.z = n.z + Math.sin(n.phase * 0.7) * 1.3;
        n.group.position.y = -0.18 + Math.sin(n.phase * 2.0) * 0.055;
        n.group.rotation.y = n.direction > 0 ? Math.PI/2 : -Math.PI/2;
        n.arms.forEach((arm,k) => { arm.rotation.x = Math.sin(n.phase*2 + k*Math.PI) * 0.48; });
      }
      beachBalls.forEach((b,i) => { if (!b.mesh.userData.phys?.active && b.mesh !== ctl.held) b.mesh.rotation.z += dt * (0.12 + i*0.025); });
      sky.position.copy(camera.position);
    },
    dispose: () => { ctl.dispose(); beachHud.remove(); vestButton.remove(); },
  };
}
