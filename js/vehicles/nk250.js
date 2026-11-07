/* ═══════════════════════════════════════════════════════════════════════
   nk250.js — QLink NK250, fully procedural naked motorcycle.

   Every part comes from analytic curves / parametric surfaces (superellipsoid
   tank + crankcase, Catmull-Rom spars / exhaust / handlebar, helical rear
   spring). No external assets.

   Game conventions
     • forward = +Z, up = +Y, wheels sit on y = 0   (front correction = 0)
     • Lambert materials only (the game's lights have no env-map, so metal
       materials would render black); body = paint colour, rim = wheel colour
     • static parts are baked into one mesh per material, so the whole bike is
       ~30 draw calls instead of ~200
     • userData.wheels follows the drive scene's contract:
         front : { pivot, spin, steer:true }  → the whole front end (forks, bar,
                 lamp, wheel) turns about the raked steering axis
         rear  : { mesh }                     → spins only
   ═══════════════════════════════════════════════════════════════════════ */
import * as THREE from "three";

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);

/* ── geometry helpers ───────────────────────────────────────────────── */
function parametric(fn, uSeg, vSeg) {
  const n = (uSeg + 1) * (vSeg + 1), pos = new Float32Array(n * 3), idx = [];
  let p = 0;
  for (let i = 0; i <= uSeg; i++) for (let j = 0; j <= vSeg; j++) { const P = fn(i / uSeg, j / vSeg); pos[p++] = P.x; pos[p++] = P.y; pos[p++] = P.z; }
  const W = vSeg + 1;
  for (let i = 0; i < uSeg; i++) for (let j = 0; j < vSeg; j++) { const a = i * W + j, b = a + 1, c = a + W, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/* superellipsoid: e → 1 ellipsoid, e → 0.3 rounded box */
function superBox(w, h, d, e1, e2) {
  const f = (t, e) => Math.sign(t) * Math.pow(Math.abs(t), e);
  return parametric((u, v) => {
    const th = (u - 0.5) * Math.PI, ph = v * TAU;
    const ct = f(Math.cos(th), e1), st = f(Math.sin(th), e1), cp = f(Math.cos(ph), e2), sp = f(Math.sin(ph), e2);
    return V(0.5 * w * ct * cp, 0.5 * h * st, 0.5 * d * ct * sp);
  }, 12, 16);
}
const tube = (pts, r, mat, ts, rs) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), ts || 20, r, rs || 6, false), mat);
function rod(a, b, r, mat, seg) {
  const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 8, 1, false), mat);
  m.position.addVectors(a, b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(UP, dir.normalize()); return m;
}
function bar(a, b, w, h, mat) {
  const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, h), mat);
  m.position.addVectors(a, b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(UP, dir.normalize()); return m;
}
function helixSpring(radius, length, turns, wire, mat) {
  const seg = Math.round(turns * 8), pts = [];
  for (let i = 0; i <= seg; i++) { const t = i / seg, a = t * TAU * turns; pts.push(V(Math.cos(a) * radius, t * length - length * 0.5, Math.sin(a) * radius)); }
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, wire, 4, false), mat);
}
function mudguard(R, halfW, thick, a0, a1, mat) {
  return new THREE.Mesh(parametric((u, v) => {
    const ang = lerp(a0, a1, u), c = Math.cos(v * TAU), s = Math.sin(v * TAU), rr = R + thick * s;
    return V(halfW * c, rr * Math.cos(ang), rr * Math.sin(ang));
  }, 14, 8), mat);
}

/* Bake every plain mesh under `root` (except subtrees flagged userData.keep and
   meshes flagged userData.noMerge) into ONE mesh per material, in root's space. */
function bake(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map(), dead = [];
  (function walk(n) {
    for (const c of n.children) {
      if (c.userData.keep) continue;
      if (c.isMesh && !c.userData.noMerge) {
        const g = (c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone());
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld));
        let b = buckets.get(c.material); if (!b) buckets.set(c.material, (b = []));
        b.push(g); dead.push(c);
      } else if (c.children.length) walk(c);
    }
  })(root);
  for (const m of dead) { m.parent.remove(m); if (m.geometry) m.geometry.dispose(); }
  buckets.forEach((list, mat) => {
    let tri = 0; list.forEach((g) => (tri += g.attributes.position.count));
    const pos = new Float32Array(tri * 3), nor = new Float32Array(tri * 3); let o = 0;
    list.forEach((g) => { pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); o += g.attributes.position.count * 3; g.dispose(); });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; root.add(mesh);
  });
}

/* ── wheel: torus tyre + rim + 5 cast spokes + disc ─────────────────── */
function makeWheel(o, M) {
  const g = new THREE.Group(), R = o.R, tw = o.tireW, rimR = o.rimR, n = o.spokes, tR = tw * 0.5;
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(R - tR, tR, 8, 26), M.rubber); tyre.rotation.y = Math.PI / 2; g.add(tyre);
  const bead = new THREE.Mesh(new THREE.TorusGeometry(R - tR * 0.52, tR * 0.15, 4, 22), M.black); bead.rotation.y = Math.PI / 2; g.add(bead);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, tw * 0.6, 20, 1, true), M.rim); barrel.rotation.z = Math.PI / 2; g.add(barrel);
  [-1, 1].forEach((s) => { const fl = new THREE.Mesh(new THREE.TorusGeometry(rimR - 0.004, 0.010, 4, 22), M.rim); fl.rotation.y = Math.PI / 2; fl.position.x = s * tw * 0.29; g.add(fl); });
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, tw * 0.64, 12), M.dark); hub.rotation.z = Math.PI / 2; g.add(hub);
  const r0 = 0.05, r1 = rimR - 0.004, midR = (r0 + r1) * 0.5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, sp = new THREE.Mesh(new THREE.BoxGeometry(tw * 0.42, r1 - r0, 0.038), M.dark);
    sp.position.set(0, Math.cos(a) * midR, Math.sin(a) * midR); sp.rotation.x = a; g.add(sp);
  }
  const discR = rimR * 0.8, dx = o.discX * tw * 0.42;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(discR, discR, 0.007, 18), M.chrome); disc.rotation.z = Math.PI / 2; disc.position.x = dx; g.add(disc);
  const car = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.013, 10), M.dark); car.rotation.z = Math.PI / 2; car.position.x = dx; g.add(car);
  bake(g);
  return g;
}

/* ═══════════════════════════════════════════════════════════════════════ */
export function buildNK250(body = "#d51f2b", rim = "#9aa2ad", opts = {}) {
  const L = (c, extra) => new THREE.MeshLambertMaterial(Object.assign({ color: c, side: THREE.DoubleSide }, extra || {}));
  const M = {
    paint: L(new THREE.Color(body)), rim: L(new THREE.Color(rim)),
    rubber: L(0x0e0f12), black: L(0x14161a), dark: L(0x2a2e35), alu: L(0x9aa2ad), chrome: L(0xdfe4ec),
    carbon: L(0x1c1f26), spring: L(0xe8a020),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff6d8 }), red: new THREE.MeshBasicMaterial({ color: 0xff2b2b }), amber: new THREE.MeshBasicMaterial({ color: 0xffa020 }),
  };
  const B = new THREE.Group(); B.name = "nk250";

  const RW = 0.315, FRONT_Z = 0.68, REAR_Z = -0.68, RAKE = 25 * D2R;
  const axleF = V(0, RW, FRONT_Z), axleR = V(0, RW, REAR_Z);
  const forkUp = V(0, Math.cos(RAKE), -Math.sin(RAKE));
  const forkTop = axleF.clone().addScaledVector(forkUp, 0.78);

  /* ── FRONT END (turns about the raked steering axis) ─────────────── */
  const tilt = new THREE.Group(); tilt.position.copy(forkTop); tilt.rotation.x = -RAKE; tilt.userData.keep = true;
  const pivot = new THREE.Group(); tilt.add(pivot);
  const inv = new THREE.Group(); inv.rotation.x = RAKE; pivot.add(inv);
  const F = new THREE.Group(); F.position.copy(forkTop).multiplyScalar(-1); inv.add(F);    /* parts below use world-style coords */
  B.add(tilt);

  const wF = makeWheel({ R: RW, tireW: 0.115, rimR: 0.238, spokes: 5, discX: -1 }, M); wF.position.copy(axleF); wF.userData.keep = true; F.add(wF);
  [-0.088, 0.088].forEach((x) => {
    const lower = V(x, RW, FRONT_Z), upper = V(x, forkTop.y, forkTop.z);
    F.add(rod(lower, upper, 0.026, M.chrome, 8));
    F.add(rod(lower, lower.clone().addScaledVector(forkUp, 0.34), 0.034, M.dark, 8));
  });
  [0.58, 0.74].forEach((t) => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.036, 0.07), M.dark); c.position.copy(axleF).addScaledVector(forkUp, t); c.rotation.x = RAKE; F.add(c); });
  F.add(rod(axleF.clone().addScaledVector(forkUp, 0.55), axleF.clone().addScaledVector(forkUp, 0.8), 0.02, M.dark, 8));
  /* handlebar, grips, levers, mirrors */
  F.add(tube([V(-0.32, 0.985, 0.272), V(-0.245, 1.005, 0.318), V(-0.11, 1.028, 0.362), V(0, 1.034, 0.372), V(0.11, 1.028, 0.362), V(0.245, 1.005, 0.318), V(0.32, 0.985, 0.272)], 0.014, M.chrome, 20, 6));
  [-1, 1].forEach((s) => {
    F.add(rod(V(s * 0.322, 0.984, 0.27), V(s * 0.252, 1.002, 0.312), 0.019, M.black, 8));
    F.add(rod(V(s * 0.255, 1.0, 0.32), V(s * 0.18, 1.006, 0.4), 0.007, M.alu, 5));
    F.add(rod(V(s * 0.245, 1.01, 0.33), V(s * 0.32, 1.135, 0.3), 0.008, M.dark, 5));
    const mir = new THREE.Mesh(superBox(0.115, 0.07, 0.03, 0.55, 0.55), M.black); mir.position.set(s * 0.335, 1.155, 0.298); mir.rotation.z = s * -0.18; mir.rotation.y = s * 0.22; F.add(mir);
  });
  /* headlight, dash, indicators */
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.086, 0.085, 16), M.black); shell.rotation.x = Math.PI / 2; shell.position.set(0, 0.925, 0.5); F.add(shell);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.092, 14, 10), M.lamp); lens.scale.set(1, 1, 0.42); lens.position.set(0, 0.925, 0.54); F.add(lens);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.094, 0.01, 5, 18), M.dark); bezel.position.set(0, 0.925, 0.54); F.add(bezel);
  const dash = new THREE.Mesh(superBox(0.15, 0.055, 0.09, 0.45, 0.45), M.black); dash.position.set(0, 1.01, 0.455); dash.rotation.x = -0.55; F.add(dash);
  [-1, 1].forEach((s) => {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.02, 0.05, 8), M.black); st.rotation.x = Math.PI / 2; st.position.set(s * 0.155, 0.885, 0.505); F.add(st);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), M.amber); bulb.position.set(s * 0.155, 0.885, 0.532); F.add(bulb);
  });
  const fenderF = mudguard(RW + 0.03, 0.07, 0.018, -0.16 * Math.PI, 0.74 * Math.PI, M.paint); fenderF.position.copy(axleF); F.add(fenderF);
  const calF = new THREE.Mesh(superBox(0.03, 0.11, 0.07, 0.4, 0.4), M.dark); calF.position.set(-0.07, 0.4, FRONT_Z + 0.115); F.add(calF);
  bake(F);

  /* ── TANK: longitudinal superellipse loft ───────────────────────── */
  (function tank() {
    const z0 = -0.09, z1 = 0.348, Wmax = 0.152, Hmax = 0.108, yBase = 0.775, nExp = 2.7;
    B.add(new THREE.Mesh(parametric((u, v) => {
      const z = lerp(z0, z1, u), taper = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * u - 1), 5)), 0.42);
      const a = Wmax * taper, b = Hmax * taper * lerp(0.82, 1.06, u), cy = yBase + 0.024 * u, ang = v * TAU;
      const cv = Math.cos(ang), sv = Math.sin(ang);
      return V(a * Math.sign(cv) * Math.pow(Math.abs(cv), 2 / nExp), cy + b * Math.sign(sv) * Math.pow(Math.abs(sv), 2 / nExp), z);
    }, 20, 18), M.paint));
  })();
  /* "QLINK" tank decals (textured → kept as separate meshes) */
  try {
    const c = document.createElement("canvas"); c.width = 256; c.height = 128;
    const g = c.getContext("2d"); g.fillStyle = "#101216"; g.font = "900 66px Arial, Helvetica, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("QLINK", 128, 70);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const dm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.145, 0.055), dm); p.position.set(s * 0.1535, 0.792, 0.128); p.rotation.y = s * Math.PI / 2; p.userData.noMerge = true; B.add(p); });
  } catch (e) {}

  /* seat, tail, tail-light */
  const seat = new THREE.Mesh(superBox(0.2, 0.078, 0.43, 0.45, 0.3), M.black); seat.position.set(0, 0.848, -0.3); seat.rotation.x = -0.03; B.add(seat);
  const pad = new THREE.Mesh(superBox(0.17, 0.03, 0.3, 0.55, 0.35), M.carbon); pad.position.set(0, 0.882, -0.27); pad.rotation.x = -0.03; B.add(pad);
  const tail = new THREE.Mesh(superBox(0.16, 0.13, 0.26, 0.5, 0.36), M.paint); tail.position.set(0, 0.828, -0.6); tail.rotation.x = -0.14; B.add(tail);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.032, 0.02), M.red); tl.position.set(0, 0.845, -0.726); tl.rotation.x = -0.14; B.add(tl);

  /* twin-spar frame, downtube, cradle, subframe */
  const spar = (sx) => [V(sx * 0.07, 0.858, 0.412), V(sx * 0.098, 0.79, 0.18), V(sx * 0.106, 0.68, -0.06), V(sx * 0.1, 0.52, -0.232), V(sx * 0.092, 0.428, -0.264)];
  B.add(tube(spar(1), 0.03, M.dark, 18, 6)); B.add(tube(spar(-1), 0.03, M.dark, 18, 6));
  B.add(rod(V(-0.07, 0.858, 0.412), V(0.07, 0.858, 0.412), 0.022, M.dark, 6));
  B.add(rod(V(-0.092, 0.428, -0.264), V(0.092, 0.428, -0.264), 0.024, M.dark, 6));
  B.add(tube([V(0, 0.848, 0.398), V(0, 0.66, 0.292), V(0, 0.5, 0.212), V(0, 0.4, 0.148)], 0.022, M.dark, 14, 6));
  B.add(tube([V(0, 0.4, 0.148), V(0, 0.302, 0.02), V(0, 0.312, -0.14), V(0, 0.412, -0.258)], 0.02, M.dark, 14, 6));
  [1, -1].forEach((sx) => B.add(tube([V(sx * 0.096, 0.7, -0.1), V(sx * 0.096, 0.762, -0.3), V(sx * 0.09, 0.8, -0.5), V(sx * 0.078, 0.816, -0.64)], 0.017, M.dark, 12, 5)));
  B.add(rod(V(-0.078, 0.816, -0.64), V(0.078, 0.816, -0.64), 0.014, M.dark, 5));

  /* engine: crankcase, covers, finned cylinder, radiator */
  const crank = new THREE.Mesh(superBox(0.3, 0.26, 0.36, 0.42, 0.42), M.dark); crank.position.set(0, 0.44, 0.02); B.add(crank);
  [[-0.156, 0.098, 0.045], [0.156, 0.086, 0.042]].forEach(([x, r, h]) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), M.dark); c.rotation.z = Math.PI / 2; c.position.set(x, 0.44, 0.02); B.add(c); });
  const cyl = new THREE.Group(); cyl.position.set(0, 0.588, 0.118); cyl.rotation.x = 0.26;
  cyl.add(new THREE.Mesh(superBox(0.2, 0.245, 0.19, 0.45, 0.45), M.dark));
  for (let i = 0; i < 7; i++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.246, 0.01, 0.226), M.alu); fin.position.y = -0.082 + i * 0.028; cyl.add(fin); }
  const hc = new THREE.Mesh(superBox(0.21, 0.07, 0.2, 0.4, 0.4), M.dark); hc.position.y = 0.15; cyl.add(hc); B.add(cyl);
  const radi = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.048), M.carbon); radi.position.set(0, 0.6, 0.292); radi.rotation.x = -0.12; B.add(radi);

  /* exhaust + tapered muffler */
  B.add(tube([V(0.055, 0.56, 0.23), V(0.115, 0.42, 0.245), V(0.15, 0.3, 0.16), V(0.162, 0.262, -0.02), V(0.17, 0.29, -0.22), V(0.172, 0.36, -0.42)], 0.028, M.chrome, 24, 8));
  {
    const a = V(0.172, 0.372, -0.42), b = V(0.172, 0.452, -0.76), dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.064, len, 14), M.chrome); m.position.addVectors(a, b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(UP, dir.clone().normalize()); B.add(m);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.03, 14), M.dark); cap.position.copy(b); cap.quaternion.copy(m.quaternion); B.add(cap);
  }

  /* swingarm, chain, shock + helical spring, hugger, footpegs, rear caliper */
  const pivotY = 0.42, pivotZ = -0.262;
  [1, -1].forEach((sx) => B.add(rod(V(sx * 0.105, pivotY, pivotZ), V(sx * 0.105, RW, REAR_Z), 0.03, M.dark, 6)));
  B.add(rod(V(-0.105, pivotY, pivotZ), V(0.105, pivotY, pivotZ), 0.026, M.dark, 6));
  {
    const cx = 0.085, fs = V(cx, 0.4, -0.055), rf = 0.046, rs = V(cx, RW, REAR_Z), rr = 0.106;
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(rf, rf, 0.014, 12), M.alu); s1.rotation.z = Math.PI / 2; s1.position.copy(fs); B.add(s1);
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.01, 18), M.alu); s2.rotation.z = Math.PI / 2; s2.position.copy(rs); B.add(s2);
    B.add(bar(V(cx, fs.y + rf, fs.z), V(cx, rs.y + rr, rs.z), 0.014, 0.019, M.black));
    B.add(bar(V(cx, fs.y - rf, fs.z), V(cx, rs.y - rr, rs.z), 0.014, 0.019, M.black));
  }
  {
    const a = V(0, 0.68, -0.14), b = V(0, 0.4, -0.36), dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
    B.add(rod(a, b, 0.02, M.chrome, 8));
    const sp = helixSpring(0.03, len * 0.62, 8, 0.0065, M.spring); sp.position.addVectors(a, b).multiplyScalar(0.5); sp.quaternion.setFromUnitVectors(UP, dir.clone().normalize()); B.add(sp);
  }
  const hug = mudguard(RW + 0.032, 0.082, 0.016, 0.06 * Math.PI, 0.56 * Math.PI, M.black); hug.position.copy(axleR); B.add(hug);
  [1, -1].forEach((s) => { B.add(rod(V(s * 0.14, 0.345, -0.195), V(s * 0.235, 0.345, -0.195), 0.013, M.alu, 6)); B.add(rod(V(s * 0.13, 0.4, -0.21), V(s * 0.14, 0.345, -0.195), 0.01, M.dark, 5)); });
  const calR = new THREE.Mesh(superBox(0.03, 0.08, 0.06, 0.4, 0.4), M.dark); calR.position.set(0.07, 0.4, REAR_Z - 0.1); B.add(calR);

  const wR = makeWheel({ R: RW, tireW: 0.148, rimR: 0.245, spokes: 5, discX: 1 }, M); wR.position.copy(axleR); wR.userData.keep = true; B.add(wR);

  /* ── RIDER (visible, leans with the bike) — skipped when opts.riderless (the drive scene seats the player's own avatar) ── */
  if (!(opts && opts.riderless)) {
    const jacket = L(0x23262d), pants = L(0x1b2a4a), glove = L(0x111111), helmM = L(new THREE.Color(body)), visor = L(0x0a0a0c), skin = L(0xd9a77c);
    const hip = V(0, 0.93, -0.3), sh = V(0, 1.3, -0.02), neck = V(0, 1.36, 0.0), head = V(0, 1.46, 0.03);
    B.add(bar(hip, sh, 0.3, 0.2, jacket));                                  /* torso */
    const hipM = new THREE.Mesh(superBox(0.3, 0.16, 0.26, 0.5, 0.5), pants); hipM.position.copy(hip); B.add(hipM);
    [-1, 1].forEach((sd) => {
      const shoulder = V(sd * 0.17, 1.28, -0.03), elbow = V(sd * 0.27, 1.12, 0.14), grip = V(sd * 0.3, 0.995, 0.28);
      B.add(rod(shoulder, elbow, 0.045, jacket, 6)); B.add(rod(elbow, grip, 0.04, jacket, 6));
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), glove); g.position.copy(grip); B.add(g);
      const hp = V(sd * 0.15, 0.92, -0.3), knee = V(sd * 0.2, 0.72, -0.02), foot = V(sd * 0.14, 0.38, -0.195);
      B.add(rod(hp, knee, 0.07, pants, 6)); B.add(rod(knee, foot, 0.055, pants, 6));
      const boot = new THREE.Mesh(superBox(0.09, 0.09, 0.2, 0.5, 0.5), glove); boot.position.set(sd * 0.14, 0.36, -0.15); B.add(boot);
    });
    const nk = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), skin); nk.position.copy(neck); B.add(nk);
    const hm = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), helmM); hm.scale.set(0.9, 1, 1.1); hm.position.copy(head); B.add(hm);
    const vz = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), visor); vz.scale.set(1, 0.55, 0.7); vz.position.set(0, 1.46, 0.14); B.add(vz);
  }

  bake(B);                                         /* static parts → one mesh per material */
  B.scale.setScalar(1.08);                         /* a touch of presence next to the cars */

  B.userData.wheels = [{ pivot, spin: wF, steer: true }, { mesh: wR }];
  B.userData.isNK250 = true;
  return B;
}
