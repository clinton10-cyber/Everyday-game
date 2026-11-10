import * as THREE from "three";
export function addCarLights(group) {
  const bulbG = new THREE.SphereGeometry(0.11, 8, 6);
  const beamG = new THREE.ConeGeometry(1.1, 7, 12, 1, true);
  const brakeG = new THREE.SphereGeometry(0.09, 6, 5);
  const bulbs = [], beams = [], brakes = [];
  for (const sx of [-0.72, 0.72]) {
    const b = new THREE.Mesh(bulbG.clone(), new THREE.MeshBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: 0 }));
    b.position.set(sx, 0.55, 1.95); group.add(b); bulbs.push(b);
    const beam = new THREE.Mesh(beamG.clone(), new THREE.MeshBasicMaterial({
      color: 0xfff4d0, transparent: true, opacity: 0, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    beam.rotation.x = Math.PI / 2; beam.position.set(sx, 0.5, 5.45); group.add(beam); beams.push(beam);
    const br = new THREE.Mesh(brakeG.clone(), new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0 }));
    br.position.set(sx, 0.65, -2.05); group.add(br); brakes.push(br);
  }
  return {
    setNight(n) {
      const on = n > 0.25;
      for (const b of bulbs) b.material.opacity = on ? 1 : 0;
      for (const b of beams) b.material.opacity = on ? 0.06 + n * 0.10 : 0;
    },
    setBrake(on) { for (const b of brakes) b.material.opacity = on ? 1 : 0; },
    dispose() { for (const m of [...bulbs, ...beams, ...brakes]) { m.parent?.remove(m); m.geometry.dispose(); m.material.dispose(); } },
  };
}
