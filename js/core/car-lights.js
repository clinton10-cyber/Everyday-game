import * as THREE from "three";
/* Geometry is shared by every car. Parts are hidden (visible=false) whenever they are off: a transparent mesh at
   opacity 0 is still sent to the GPU, and 6 per car x dozens of cars was ~200 wasted draw calls all daytime. */
let _bulbG = null, _beamG = null, _brakeG = null;
export function addCarLights(group) {
  if (!_bulbG) {
    _bulbG = new THREE.SphereGeometry(0.11, 8, 6);
    _beamG = new THREE.ConeGeometry(1.1, 7, 12, 1, true);
    _brakeG = new THREE.SphereGeometry(0.09, 6, 5);
  }
  const bulbs = [], beams = [], brakes = [];
  for (const sx of [-0.72, 0.72]) {
    const b = new THREE.Mesh(_bulbG, new THREE.MeshBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: 0 }));
    b.position.set(sx, 0.55, 1.95); b.visible = false; group.add(b); bulbs.push(b);
    const beam = new THREE.Mesh(_beamG, new THREE.MeshBasicMaterial({
      color: 0xfff4d0, transparent: true, opacity: 0, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    beam.rotation.x = Math.PI / 2; beam.position.set(sx, 0.5, 5.45); beam.visible = false; group.add(beam); beams.push(beam);
    const br = new THREE.Mesh(_brakeG, new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0 }));
    br.position.set(sx, 0.65, -2.05); br.visible = false; group.add(br); brakes.push(br);
  }
  return {
    setNight(n) {
      const on = n > 0.25;
      for (const b of bulbs) { b.material.opacity = on ? 1 : 0; b.visible = on; }
      for (const b of beams) { b.material.opacity = on ? 0.06 + n * 0.10 : 0; b.visible = on; }
    },
    setBrake(on) { for (const b of brakes) { b.material.opacity = on ? 1 : 0; b.visible = !!on; } },
    dispose() { for (const m of [...bulbs, ...beams, ...brakes]) { m.parent?.remove(m); m.material.dispose(); } },
  };
}
