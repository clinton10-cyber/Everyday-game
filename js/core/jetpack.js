/* jetpack.js — visual jetpack worn on the character's back.
   Pure visuals: all control/physics lives in the game's own walk code (drive.js). */
import * as THREE from "three";

const FLAME_VERT = `varying float vT; void main(){ vT = clamp(-position.y,0.0,1.0); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const FLAME_FRAG = `uniform float uTime; uniform float uThrottle; uniform vec3 uCore; uniform vec3 uMid; uniform vec3 uEdge; varying float vT;
void main(){ float t=clamp(vT,0.0,1.0); float shape=1.0-smoothstep(0.05,1.0,t); float core=1.0-smoothstep(0.0,0.5,t);
float flick=0.75+0.25*(sin(t*24.0-uTime*26.0)*0.5+0.5)+0.12*(sin(t*57.0-uTime*41.0+1.7)*0.5+0.5);
vec3 col=mix(uEdge,mix(uMid,uCore,core),shape);
gl_FragColor=vec4(col, shape*(0.30+0.70*core)*flick*clamp(uThrottle,0.0,2.0)); }`;

export function createJetpack() {
  const group = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xb2bac6, metalness: 0.9, roughness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x24282f, metalness: 0.7, roughness: 0.55 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xffc62b, metalness: 0.5, roughness: 0.4 });
  const bell = new THREE.MeshStandardMaterial({ color: 0x4b3d33, metalness: 0.95, roughness: 0.25, side: THREE.DoubleSide });
  const add = (g, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.x = rx; group.add(o); return o; };

  add(new THREE.BoxGeometry(0.44, 0.52, 0.06), dark, 0, 0, 0.12);
  add(new THREE.BoxGeometry(0.30, 0.04, 0.02), accent, 0, 0.22, 0.155);
  const flames = [], uniformsList = [];
  const flameGeo = new THREE.ConeGeometry(0.1, 1.0, 16, 6, true);
  flameGeo.rotateX(Math.PI); flameGeo.translate(0, -0.5, 0);
  for (const sx of [-1, 1]) {
    const x = sx * 0.13;
    add(new THREE.CapsuleGeometry(0.09, 0.26, 6, 14), hull, x, 0.02, 0);
    add(new THREE.TorusGeometry(0.095, 0.012, 8, 20), accent, x, 0.04, 0, Math.PI / 2);
    add(new THREE.CylinderGeometry(0.065, 0.105, 0.14, 16, 1, true), bell, x, -0.3, 0);
    const mk = (core, mid, edge, w, l) => {
      const u = { uTime: { value: Math.random() * 50 }, uThrottle: { value: 0 },
        uCore: { value: new THREE.Color(core) }, uMid: { value: new THREE.Color(mid) }, uEdge: { value: new THREE.Color(edge) } };
      const m = new THREE.Mesh(flameGeo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: FLAME_VERT, fragmentShader: FLAME_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.position.set(x, -0.37, 0); m.frustumCulled = false; m.visible = false;
      group.add(m); flames.push({ m, w, l }); uniformsList.push(u);
    };
    mk(0xfff8d8, 0xff8a1e, 0x8a3bff, 1, 1);
    mk(0xffc070, 0xff4a10, 0x2f6bff, 1.7, 1.2);
  }
  group.position.set(0, 1.25, -0.2);   /* character faces +z → back is -z */
  group.rotation.y = Math.PI;
  group.visible = false;
  group.userData.keepOnRebuild = true;   /* survive wardrobe rebuilds (applyConfig) */

  let t = 0, thr = 0;
  return {
    group,
    attach(parent) { parent.add(group); },
    update(dt, on, thrusting) {
      group.visible = !!on;
      if (!on) { thr = 0; return; }
      t += dt;
      thr += ((thrusting ? 1 : 0.0) - thr) * Math.min(1, dt * 10);
      for (const u of uniformsList) { u.uTime.value = t; u.uThrottle.value = thr; }
      for (const f of flames) {
        f.m.visible = thr > 0.03;
        f.m.scale.set((0.85 + thr * 0.3) * f.w, (0.3 + thr * 1.4) * f.l, (0.85 + thr * 0.3) * f.w);
      }
    },
    dispose() { if (group.parent) group.parent.remove(group); },
  };
}
