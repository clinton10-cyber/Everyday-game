/* hoverboard.js — HOVERBOARD X-1, procedural. forward = +Z, up = +Y.
   Lambert/Basic materials only (game lights have no env-map). Floats ~0.32 above y=0.
   userData.isHoverboard → drive scene leans it into turns; userData.spinners → turbines. */
import * as THREE from "three";

const HALF_L = 0.92, HALF_W = 0.315, EXP = 3.2, KICK = 0.115;
const kick = (z) => KICK * Math.pow(Math.min(Math.abs(z) / HALF_L, 1), 3);

function deckShape(scale) {
  const s = new THREE.Shape(), SEG = 64;
  for (let i = 0; i < SEG; i++) {
    const t = (i / SEG) * Math.PI * 2, ct = Math.cos(t), st = Math.sin(t);
    const x = HALF_W * scale * Math.sign(ct) * Math.pow(Math.abs(ct), 2 / EXP);
    const y = HALF_L * scale * Math.sign(st) * Math.pow(Math.abs(st), 2 / EXP);
    i === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
  }
  s.closePath();
  return s;
}
function deckGeo(scale, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(deckShape(scale), { depth, steps: 1, curveSegments: 1, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + kick(p.getZ(i)));
  g.translate(0, -depth / 2, 0); g.computeVertexNormals();
  return g;
}

export function buildHoverboard(body = "#38e8ff", rim = "#9aa2ad", opts = {}) {
  const L = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c, side: THREE.DoubleSide }, o || {}));
  const neonC = new THREE.Color(body);
  const M = {
    deck: L(0x4a525c), grip: L(0x1b1f26), dark: L(0x0d1014), alu: L(new THREE.Color(rim)),
    neon: new THREE.MeshBasicMaterial({ color: neonC }),
    nose: new THREE.MeshBasicMaterial({ color: 0xbff8ff }),
    tail: new THREE.MeshBasicMaterial({ color: 0xff5a22 }),
    jacket: L(0x23262d), pants: L(0x1b2a4a), glove: L(0x111111), helm: L(neonC), visor: L(0x0a0a0c),
  };
  const B = new THREE.Group(); B.name = "hoverboard";
  const board = new THREE.Group(); board.position.y = 0.34; board.rotation.y = Math.PI; /* original nose was -Z */
  B.add(board);

  board.add(new THREE.Mesh(deckGeo(1.0, 0.055, 0.016), M.deck));
  const gp = new THREE.Mesh(deckGeo(0.93, 0.012, 0.004), M.grip); gp.position.y = 0.036; board.add(gp);
  const bp = new THREE.Mesh(deckGeo(0.94, 0.010, 0.004), M.dark); bp.position.y = -0.036; board.add(bp);
  board.add(new THREE.Mesh(deckGeo(1.035, 0.012, 0.005), M.neon));
  const nb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.012, 0.048), M.nose); nb.position.set(0, 0.046 + kick(-0.8), -0.8); board.add(nb);
  const tb = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.012, 0.042), M.tail); tb.position.set(0, 0.046 + kick(0.82), 0.82); board.add(tb);

  const spinners = [];
  [-0.56, 0.56].forEach((z) => {
    const g = new THREE.Group(); g.position.set(0, -0.06, z);
    const sh = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.03, 8, 22), M.deck); sh.rotation.x = Math.PI / 2; g.add(sh);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.125, 0.095, 18, 1, true), M.dark));
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.122, 18), M.neon); core.rotation.x = Math.PI / 2; core.position.y = -0.0475; g.add(core);
    const sp = new THREE.Group(); sp.position.y = -0.012;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, bl = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.007, 0.105), M.alu);
      bl.position.set(Math.cos(a) * 0.062, 0, Math.sin(a) * 0.062); bl.rotation.set(0, Math.PI / 2 - a, 0.5); sp.add(bl);
    }
    g.add(sp); spinners.push(sp); board.add(g);
  });

  if (!(opts && opts.riderless)) {
  /* ── RIDER: standing, side-on stance, facing +Z ── */
  const R = new THREE.Group(); R.position.y = 0.06; board.add(R); R.rotation.y = Math.PI; /* board is flipped; flip back */
  const rod = (a, b, r, m) => {
    const d = new THREE.Vector3().subVectors(b, a), me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 7), m);
    me.position.addVectors(a, b).multiplyScalar(0.5); me.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); R.add(me);
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const hip = V(0, 0.82, 0), sh = V(0, 1.26, 0.04);
  [-1, 1].forEach((s) => {
    const foot = V(s * 0.12, 0.03, s * 0.3), knee = V(s * 0.14, 0.42, s * 0.16), hp = V(s * 0.1, 0.82, 0);
    rod(foot, knee, 0.055, M.pants); rod(knee, hp, 0.07, M.pants);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.22), M.glove); boot.position.set(s * 0.12, 0.04, s * 0.3); R.add(boot);
    const shd = V(s * 0.2, 1.22, 0.04), hand = V(s * 0.36, 0.95, 0.06 + s * 0.04);
    rod(shd, hand, 0.04, M.jacket);
  });
  rod(hip, sh, 0.15, M.jacket);
  const hd = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 9), M.helm); hd.position.set(0, 1.46, 0.05); R.add(hd);
  const vz = new THREE.Mesh(new THREE.SphereGeometry(0.1, 9, 7), M.visor); vz.scale.set(1, 0.55, 0.7); vz.position.set(0, 1.46, 0.17); R.add(vz);

  }

  B.userData.isHoverboard = true;
  B.userData.spinners = spinners;
  B.userData.hoverBoard = board;
  B.userData.wheels = [];
  return B;
}
