/* garage/exterior.js — simple garage building (roller door + sign) for the exterior route. */
import * as THREE from "three";

export function buildExterior() {
  const g = new THREE.Group();
  const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
  const part = (w, h, d, x, y, z, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y, z); g.add(m); return m; };
  part(22, 7, 14, 0, 3.5, 0, 0xdfe3e8);          /* main hall */
  part(22.6, .6, 14.6, 0, 7.3, 0, 0x2b3138);     /* flat roof */
  part(22.2, .5, 14.2, 0, 4.9, 0, 0x2fd1c5);     /* accent band */
  part(9, 4.6, .3, 0, 2.3, 7.05, 0x2b3138);      /* door frame */
  for (let i = 0; i < 6; i++) part(8.4, .62, .2, 0, .5 + i * .72, 7.2, 0xc7ccd3);   /* roller-door slats */
  const c = document.createElement("canvas"); c.width = 512; c.height = 128;
  const x = c.getContext("2d"); x.fillStyle = "#171c22"; x.fillRect(0, 0, 512, 128);
  x.strokeStyle = "#2fd1c5"; x.lineWidth = 6; x.strokeRect(5, 5, 502, 118);
  x.fillStyle = "#fff"; x.font = "800 64px Arial,sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("MY GARAGE", 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: t }));
  s.position.set(0, 6, 7.25); g.add(s);
  return g;
}
export default buildExterior;
