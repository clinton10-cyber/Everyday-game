/* mansion/interior.js -- Presidential Palace interior.
   Delegates all geometry to mansion_layout.js (single source of truth
   for floor plan, furniture, colliders and seats).  Adds water shader,
   lighting and ThirdPersonControls on top. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import { Quality } from "../../core/quality.js";
import * as F from "../../core/furniture.js";
import { buildMansion, mansionStairs, mansionLevelHeight,
         MANSION_ROOF_Y, MANSION_SPAWN }
  from "./mansion_layout.js";

export async function buildInterior(router) {
  const LOW = Quality.isLow;

  /* ── Scene ────────────────────────────────────────────────────── */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070c);
  scene.fog = new THREE.FogExp2(0x070b14, 0.0072);

  const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.08, 700);
  camera.rotation.order = "YXZ";

  /* ── Build layout via shared Builder ──────────────────────────── */
  const B = new F.Builder(0, 0);
  buildMansion(B);
  const group = new THREE.Group();
  F.finalize(B, F.makeMats(), group);
  scene.add(group);

  /* Expose for inspection */
  const seats     = B.seats     || [];
  const uses      = B.uses      || [];
  const colliders = B.colliders || [];
  const platforms = B.platforms || [];

  /* ── Roof-terrace pool water shader ───────────────────────────── */
  const waterUniforms = { uTime: { value: 0 } };
  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; varying vec2 vUv;
      void main(){
        vec2 p = vUv; float t = uTime; float w = 0.0;
        w += sin(p.x*34.0 + t*1.60) * 0.50;
        w += sin(p.y*29.0 - t*1.30) * 0.50;
        w += sin((p.x+p.y)*21.0 + t*2.10) * 0.38;
        w += sin((p.x-p.y)*47.0 - t*2.70) * 0.22;
        float n = w * 0.18 + 0.5;
        vec3 deep = vec3(0.012,0.075,0.125);
        vec3 shallow = vec3(0.075,0.430,0.560);
        vec3 col = mix(deep, shallow, smoothstep(0.22, 0.95, n));
        float spec = pow(max(0.0, w*0.10), 5.0);
        col += vec3(0.80,0.96,1.0)*spec*1.15;
        float spark = smoothstep(0.93,1.0,sin(p.x*150.0+t*3.1)*sin(p.y*128.0-t*2.5));
        col += vec3(0.55,0.88,1.0)*spark*0.55;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  {
    /* Pool is on the roof terrace at x 22-34, z 22-28, y = MANSION_ROOF_Y */
    const pg = new THREE.PlaneGeometry(8.0, 4.0);
    pg.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(pg, waterMat);
    water.position.set(28, MANSION_ROOF_Y - 0.14, 25);
    scene.add(water);
  }

  /* ── Lights ───────────────────────────────────────────────────── */
  scene.add(new THREE.HemisphereLight(0x93b4e0, 0x4a3828, 1.05));
  const dirL = new THREE.DirectionalLight(0xc2d8ff, 0.75);
  dirL.position.set(14, 60, 8); scene.add(dirL);
  /* Chandeliers: parlour and great hall */
  const chA = new THREE.PointLight(0xffd7a0, 2.4, 62, 1.7);
  chA.position.set(6, 3.6, 4.5); scene.add(chA);
  const chB = new THREE.PointLight(0xffd7a0, 1.8, 52, 1.7);
  chB.position.set(17, 3.6, 17.5); scene.add(chB);
  /* Dining chandelier */
  const chC = new THREE.PointLight(0xffd7a0, 1.6, 40, 1.7);
  chC.position.set(28, 3.6, 12.5); scene.add(chC);
  /* Pool glow */
  const poolLight = new THREE.PointLight(0x6fe4ff, 2.0, 30, 1.8);
  poolLight.position.set(28, MANSION_ROOF_Y - 0.7, 25); scene.add(poolLight);

  /* ── World + Controls ─────────────────────────────────────────── */
  const world = {
    colliders,
    seats,
    uses,
    platforms,
    stairs: mansionStairs(),
    levelHeight: mansionLevelHeight,
    ceilingHeight: MANSION_ROOF_Y,
    bounds: { minX: -2, maxX: 36, minZ: -2, maxZ: 30 },
  };

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, world, {
    scene,
    x: MANSION_SPAWN.x, z: MANSION_SPAWN.z,
    yaw: MANSION_SPAWN.yaw, level: MANSION_SPAWN.level,
    speedMult: 1.15,
    camDist: 4.5,
    onUse: (use) => {
      if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE");
    },
  });
  window.__ph3d_walkCtrl = ctl;

  /* ── Return ───────────────────────────────────────────────────── */
  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "MY HOUSE",
    title: "THE MANSION",
    subtitle: "PRESIDENTIAL PALACE",
    hint: "",
    isInterior: true,
    sceneId: "mansion",
    getExteriorSceneId: () => "mansion",
    update: (dt) => {
      ctl.update(dt);
      waterUniforms.uTime.value += dt;
      const t = performance.now() * 0.001;
      chA.intensity = 2.4 + Math.sin(t * 1.7)  * 0.12;
      chB.intensity = 1.8 + Math.sin(t * 1.3 + 2.0) * 0.10;
      chC.intensity = 1.6 + Math.sin(t * 1.5 + 1.0) * 0.08;
      poolLight.intensity = 2.0 + Math.sin(t * 2.2) * 0.25;
    },
    dispose: () => {
      ctl.dispose();
      waterMat.dispose();
      group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    },
  };
}

