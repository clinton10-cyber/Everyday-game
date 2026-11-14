/* hospital/interior.js — CITY HOSPITAL, three storeys.
   Ground  : reception & triage · waiting lounge (TV) · emergency bays + doctor · pharmacy · directory
   Floor 1 : radiology (X-ray) · laboratory · doctors' offices · Ward A · Ward B (TV)
   Floor 2 : operating theatre (surgeon) · ICU · director's office · maternity · lounge (TV)
   Stairs  : switchback core on the east side (flight A: G→1, flight B: 1→2).
   Entrance is on the NORTH wall; the building runs south from there. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import { Economy } from "../../core/economy.js";

export async function buildInterior(router) {
  /* ================= KIT ================= */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c10);
  scene.fog = new THREE.Fog(0x0a0c10, 40, 120);
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .05, 200);
  camera.rotation.order = "YXZ";
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3a44, 1.35));
  const L1_ = new THREE.DirectionalLight(0xffffff, .9); L1_.position.set(9, 16, 7); scene.add(L1_);
  const L2_ = new THREE.DirectionalLight(0xbcd2ff, .4); L2_.position.set(-9, 8, -8); scene.add(L2_);

  const BOXG = new THREE.BoxGeometry(1, 1, 1), CYLG = new THREE.CylinderGeometry(.5, .5, 1, 10), SPHG = new THREE.SphereGeometry(.5, 10, 8);
  const MC = new Map();
  const mat = (c, o) => {
    if (o && o.map) return new THREE.MeshLambertMaterial(Object.assign({ color: c }, o));
    const k = c + "|" + JSON.stringify(o || 0); let m = MC.get(k);
    if (!m) { m = new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {})); MC.set(k, m); }
    return m;
  };
  const glow = c => new THREE.MeshBasicMaterial({ color: c });
  const world = new THREE.Group(); scene.add(world);

  /* ---- building constants ---- */
  const W = 34, D = 26, H = 4.2, FH = 4.5;           /* width, depth, wall height, floor-to-floor */
  const X0 = -W / 2, X1 = W / 2, Z0 = -D / 2, Z1 = D / 2;
  const SA = { x0: 12.4, x1: 15.6, z0: 3, z1: 11 };   /* flight A footprint (rises toward +z) */
  const SB = { x0: 8.4, x1: 12.0, z0: 3, z1: 11 };    /* flight B footprint (rises toward -z) */
  let L = 0;                                          /* level currently being built */
  const base = () => L * FH;
  const solid = [], seats = [], uses = [];

  function box(w, h, d, x, y, z, m, o) {
    o = o || {};
    const s = new THREE.Mesh(BOXG, typeof m === "number" ? mat(m) : m);
    s.scale.set(w, h, d); s.position.set(x, y + base(), z); s.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
    world.add(s);
    if (o.solid) { const c = Math.abs(Math.cos(o.ry || 0)), n = Math.abs(Math.sin(o.ry || 0));
      solid.push({ x, z, hw: (c * w + n * d) / 2, hd: (n * w + c * d) / 2, lvl: L }); }
    return s;
  }
  function cyl(r, h, x, y, z, m, o) {
    o = o || {};
    const s = new THREE.Mesh(CYLG, typeof m === "number" ? mat(m) : m);
    s.scale.set(r * 2, h, r * 2); s.position.set(x, y + base(), z); s.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
    world.add(s);
    if (o.solid) solid.push({ x, z, hw: r, hd: r, lvl: L });
    return s;
  }
  function sph(r, x, y, z, m) {
    const s = new THREE.Mesh(SPHG, typeof m === "number" ? mat(m) : m);
    s.scale.setScalar(r * 2); s.position.set(x, y + base(), z); world.add(s); return s;
  }
  const colBox = (xa, xb, za, zb, lv) => solid.push({ x: (xa + xb) / 2, z: (za + zb) / 2, hw: (xb - xa) / 2, hd: (zb - za) / 2, lvl: lv });
  function tex(w, h, draw, rx, ry) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1);
    t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  /* readable wall sign (canvas text) */
  function sign(text, x, y, z, w, h, ry, bg, fg) {
    const t = tex(512, Math.round(512 * h / w), (g, cw, ch) => {
      g.fillStyle = bg || "#176b65"; g.fillRect(0, 0, cw, ch);
      g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 6; g.strokeRect(6, 6, cw - 12, ch - 12);
      g.fillStyle = fg || "#fff"; g.font = "bold " + Math.round(ch * .46) + "px Arial,sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(text, cw / 2, ch / 2 + 2, cw - 30);
    });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
    m.position.set(x, y + base(), z); m.rotation.y = ry || 0; world.add(m); return m;
  }

  /* ---- materials ---- */
  const floorTex = tex(64, 64, g => {
    g.fillStyle = "#e8edf0"; g.fillRect(0, 0, 64, 64);
    g.fillStyle = "#d9e0e4"; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
    g.strokeStyle = "#c7cfd5"; g.lineWidth = 2; g.strokeRect(1, 1, 62, 62); g.strokeRect(1, 1, 30, 30); g.strokeRect(33, 33, 30, 30);
  }, W / 1.4, D / 1.4);
  const wallM = mat(0xe9eef1), ceilM = mat(0xf2f5f7), floorM = mat(0xffffff, { map: floorTex });
  const slabM = mat(0xdde4e8), roofM = mat(0xb9c2c8);
  const metal = mat(0x9aa4ad), white = mat(0xf7f9fa), dark = mat(0x39424d), bbM = mat(0xcfd6db);
  const teal = 0x176b65, blue = 0x2d7192, red = 0xb23a48, green = 0x2f8f5b, amber = 0xc98a1a;

  /* ---- wall builders (height H, thickness .2, with door gaps) ---- */
  function segs(a, b, doors) {
    const ds = (doors || []).map(d => [d[0] - d[1] / 2, d[0] + d[1] / 2]).sort((p, q) => p[0] - q[0]);
    const out = []; let cur = a;
    for (const [s, e] of ds) { if (s > cur + .02) out.push([cur, s]); cur = e; }
    if (b > cur + .02) out.push([cur, b]);
    return out;
  }
  function wallX(z, xa, xb, doors, m) {
    m = m || wallM;
    for (const [s, e] of segs(xa, xb, doors)) box(e - s, H, .2, (s + e) / 2, H / 2, z, m, { solid: true });
    for (const d of (doors || [])) box(d[1], H - 2.4, .2, d[0], (H + 2.4) / 2, z, m);
  }
  function wallZ(x, za, zb, doors, m) {
    m = m || wallM;
    for (const [s, e] of segs(za, zb, doors)) box(.2, H, e - s, x, H / 2, (s + e) / 2, m, { solid: true });
    for (const d of (doors || [])) box(.2, H - 2.4, d[1], x, (H + 2.4) / 2, d[0], m);
  }
  const slabRects = (rects, m) => rects.forEach(r => box(r[1] - r[0], .3, r[3] - r[2], (r[0] + r[1]) / 2, -.15, (r[2] + r[3]) / 2, m || slabM));
  const zoneFloor = (xa, xb, za, zb, c) => box(xb - xa, .02, zb - za, (xa + xb) / 2, .015, (za + zb) / 2, mat(c));
  const lineFloor = (xa, xb, za, zb, c) => box(xb - xa, .025, zb - za, (xa + xb) / 2, .03, (za + zb) / 2, glow(c));

  /* ---- registration helpers ---- */
  const seat = (type, label, x, z, yaw, h) => seats.push({ type, label, x, z, yaw, h: base() + h, level: L, taken: false });
  const use = (kind, label, x, z, r) => uses.push({ kind, label, x, z, y: base(), level: L, r: r || 1.8 });

  /* ---- furniture ---- */
  function bed(x, z) {
    [[-.45, -.92], [.45, -.92], [-.45, .92], [.45, .92]].forEach(p => cyl(.05, .55, x + p[0], .28, z + p[1], metal));
    box(1.06, .14, 2.0, x, .6, z, metal, { solid: true });
    box(1.0, .24, 1.94, x, .79, z, mat(0xf4f4ee));
    box(.62, .14, .34, x, .95, z - .72, white);
    box(1.0, .1, 1.15, x, .92, z + .4, mat(0x7fb6dd));
    box(1.1, .75, .09, x, .93, z - 1.03, mat(0xdfe6ea));
    box(1.1, .48, .09, x, .73, z + 1.03, mat(0xdfe6ea));
    seat("lie", "LIE ON HOSPITAL BED", x, z, 0, .91);
  }
  function cabinet(x, z) {
    box(.52, .62, .46, x, .62, z, mat(0xdde3e7), { solid: true });
    box(.56, .05, .5, x, .95, z, white);
    box(.3, .025, .05, x, .78, z + .23, dark); box(.3, .025, .05, x, .56, z + .23, dark);
  }
  function chair(x, z, ry, c) {
    ry = ry || 0; const cs = Math.cos(ry), sn = Math.sin(ry);
    const put = (w, h, d, ox, oy, oz, m) => box(w, h, d, x + ox * cs + oz * sn, oy, z - ox * sn + oz * cs, m, { ry });
    put(.5, .07, .5, 0, .45, 0, mat(c || 0x5b7f9c));
    put(.5, .5, .07, 0, .72, -.22, mat(c || 0x5b7f9c));
    [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]].forEach(p => cyl(.025, .45, x + p[0] * cs + p[1] * sn, .22, z - p[0] * sn + p[1] * cs, metal));
    seat("sit", "SIT", x, z, ry, .485);
  }
  function chairRow(x, z, n, gap, ry, c) { for (let i = 0; i < n; i++) chair(x + i * gap, z, ry, c); }
  function curtain(x, z, len, alongX) {
    cyl(.03, len, x, 2.5, z, metal, { rx: alongX ? 0 : Math.PI / 2, rz: alongX ? Math.PI / 2 : 0 });
    if (alongX) box(len, 1.9, .05, x, 1.5, z, mat(0xbfd8cf, { transparent: true, opacity: .85 }));
    else box(.05, 1.9, len, x, 1.5, z, mat(0xbfd8cf, { transparent: true, opacity: .85 }));
  }
  function tv(x, y, z, ry, w, h) {
    w = w || 1.5; h = h || .86; ry = ry || 0;
    box(w + .1, h + .1, .07, x, y, z, mat(0x1d2128), { ry });
    box(w, h, .03, x + Math.sin(ry) * .05, y, z + Math.cos(ry) * .05, glow(0x2c6fae), { ry });
    box(w * .5, .05, .03, x + Math.sin(ry) * .07, y - h * .28, z + Math.cos(ry) * .07, glow(0x7fd0ff), { ry });
  }
  function desk(x, z, ry, w) {
    w = w || 1.6; ry = ry || 0;
    box(w, .06, .8, x, .76, z, mat(0xc9a578), { ry, solid: true });
    box(.06, .74, .7, x - w / 2 + .06, .37, z, mat(0x8c6e4c), { ry }); box(.06, .74, .7, x + w / 2 - .06, .37, z, mat(0x8c6e4c), { ry });
    box(.5, .32, .04, x, 1.0, z - .1, mat(0x20252b), { ry }); box(.44, .26, .02, x, 1.0, z - .08, glow(0x9fd8ff), { ry });
  }
  function staff(x, z, coat) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.25, .31, .85, 10), mat(coat)); b.position.set(x, 1.05 + base(), z); world.add(b);
    const hd = new THREE.Mesh(SPHG, mat(0x87583f)); hd.scale.set(.29, .32, .28); hd.position.set(x, 1.68 + base(), z); world.add(hd);
    box(.12, .16, .035, x + .13, 1.28, z + .26, glow(0xffffff));
  }
  function plant(x, z) { cyl(.22, .4, x, .2, z, mat(0x8c979e), { solid: true }); sph(.34, x, .75, z, mat(0x3f8f55)); sph(.24, x + .12, 1.0, z - .06, mat(0x4aa564)); }
  function lightPanels(nx, nz) {
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++)
      box(1.4, .06, .7, X0 + (i + .5) * W / nx, H - .06, Z0 + (j + .5) * D / nz, glow(0xf6faff));
  }
  function windows(l) {
    for (const x of [-12, -4, 4, 12]) box(2.6, 1.7, .05, x, 2.1, Z1 - .13, glow(0xcbe6f7));
    for (const z of [-8, 0, 8]) { box(.05, 1.7, 2.6, X0 + .13, 2.1, z, glow(0xcbe6f7)); box(.05, 1.7, 2.6, X1 - .13, 2.1, z, glow(0xcbe6f7)); }
    for (const x of [-12, 12]) box(2.6, 1.7, .05, x, 2.1, Z0 + .13, glow(0xcbe6f7));
  }

  /* ---- medical equipment ---- */
  function xray(x, z) {
    box(2.1, .12, .8, x, .85, z, mat(0x3f4a55), { solid: true });
    cyl(.18, .8, x - .6, .4, z, metal);
    box(.25, 2.2, .25, x + 1.5, 1.1, z, mat(0xd7dde1), { solid: true });
    box(.25, .25, 1.6, x + 1.5, 2.2, z - .5, mat(0xd7dde1));
    box(.9, .1, .9, x, 2.1, z, mat(0x8794a0)); box(.8, .02, .8, x, 2.04, z, glow(0x9fe7ff));
  }
  function opTable(x, z) {
    box(.8, .12, 2.0, x, 1.0, z, mat(0xb9c4cc), { solid: true });
    cyl(.14, .95, x, .5, z, metal); box(.7, .06, .7, x, .06, z, metal);
    box(.7, .05, .5, x, 1.08, z + .1, mat(0x9bd6e4));
    cyl(.55, .07, x, 3.0, z, mat(0xe9eef1)); cyl(.4, .04, x, 2.96, z, glow(0xfffbe8));
    cyl(.03, 1.0, x, 3.5, z, metal);
  }
  function monitor(x, y, z, ry) { box(.5, .32, .05, x, y, z, mat(0x20252b), { ry }); box(.44, .24, .02, x + Math.sin(ry || 0) * .03, y, z + Math.cos(ry || 0) * .03, glow(0x66ffb0), { ry }); }
  function labBench(x, z, len) {
    box(len, .9, .8, x, .45, z, mat(0xdde3e7), { solid: true });
    box(len + .1, .06, .9, x, .93, z, mat(0x4a5560));
    for (let i = 0; i < 5; i++) cyl(.05, .22, x - len / 2 + .5 + i * (len - 1) / 4, 1.07, z, mat([0xff6b6b, 0x6bd6ff, 0x9bff6b, 0xffd36b, 0xc78bff][i]));
    cyl(.07, .3, x + len / 2 - .4, 1.1, z, mat(0x2a3038)); box(.12, .12, .22, x + len / 2 - .4, 1.28, z, mat(0x2a3038));
  }
  function shelf(x, z, w, ry) {
    ry = ry || 0; const cs = Math.cos(ry), sn = Math.sin(ry);
    box(w, 2.3, .4, x, 1.15, z, mat(0xe4e9ec), { solid: true, ry });
    for (let r = 0; r < 4; r++) for (let i = 0; i < Math.floor(w / .45); i++) {
      const ox = -w / 2 + .3 + i * .45;
      box(.34, .26, .3, x + ox * cs, .45 + r * .5, z - ox * sn + .02, mat([0xe05a5a, 0x5aa0e0, 0x5ac98c, 0xe0c25a, 0xb07be0][(i + r) % 5]), { ry });
    }
  }
  function sofa(x, z, ry, w) {
    w = w || 2.2; ry = ry || 0; const cs = Math.cos(ry), sn = Math.sin(ry);
    box(w, .4, .85, x, .3, z, mat(0x4b6f8c), { solid: true, ry });
    box(w, .5, .2, x - .35 * sn, .75, z - .35 * cs, mat(0x3f6180), { ry });
    seat("sit", "SIT", x, z, ry, .5);
  }

  /* ================= SHELL (per floor) ================= */
  function shell(lv, entrance) {
    L = lv;
    wallX(Z0, X0, X1, entrance ? [[0, 4.4]] : [], wallM);              /* north (entrance on ground) */
    wallX(Z1, X0, X1, [], wallM);                                       /* south */
    wallZ(X0, Z0, Z1, [], wallM); wallZ(X1, Z0, Z1, [], wallM);        /* west / east */
    box(W, .13, .06, 0, .065, Z0 + .14, bbM); box(W, .13, .06, 0, .065, Z1 - .14, bbM);
    box(.06, .13, D, X0 + .14, .065, 0, bbM); box(.06, .13, D, X1 - .14, .065, 0, bbM);
    windows(lv); lightPanels(5, 3);
  }

  /* ================= STAIRS ================= */
  function stairMeshes() {
    const n = 18;
    /* flight A: bottom at z=3 (y 0) rising to z=11 (y FH) */
    L = 0;
    for (let i = 0; i < n; i++) {
      const top = FH * (i + .5) / n, dz = (SA.z1 - SA.z0) / n;
      box(SA.x1 - SA.x0 + .2, top, dz, (SA.x0 + SA.x1) / 2, top / 2, SA.z0 + dz * (i + .5), mat(i % 2 ? 0xc9ced2 : 0xd8dce0));
    }
    /* flight B (on floor 1): bottom at z=11 (y FH) rising toward z=3 (y 2FH) */
    L = 1;
    for (let i = 0; i < n; i++) {
      const top = FH * (i + .5) / n, dz = (SB.z1 - SB.z0) / n;
      box(SB.x1 - SB.x0 + .2, top, dz, (SB.x0 + SB.x1) / 2, top / 2, SB.z1 - dz * (i + .5), mat(i % 2 ? 0xc9ced2 : 0xd8dce0));
    }
    /* handrails */
    const th = Math.atan2(FH, 8), len = Math.hypot(8, FH);
    L = 0; box(.05, .05, len, 12.55, FH / 2 + 1.0, 7, metal, { rx: -th }); box(.05, .05, len, 15.45, FH / 2 + 1.0, 7, metal, { rx: -th });
    L = 1; box(.05, .05, len, 8.6, FH / 2 + 1.0, 7, metal, { rx: th }); box(.05, .05, len, 11.85, FH / 2 + 1.0, 7, metal, { rx: th });
  }

  /* ================= GROUND FLOOR ================= */
  function ground() {
    L = 0;
    shell(0, true);
    box(W, .2, D, 0, -.1, 0, floorM);
    /* zone tints + guidance lines */
    zoneFloor(X0 + .3, -4.6, 2.6, Z1 - .3, 0xf0cfd3);   /* emergency */
    zoneFloor(5.0, X1 - .3, Z0 + .3, -2.6, 0xcfe9d8);   /* pharmacy */
    zoneFloor(-4.4, 4.4, Z0 + .3, -5.6, 0xcfe3ea);      /* reception */
    lineFloor(-.12, .12, -12.4, -.3, 0x35d1c4);          /* entrance → centre */
    lineFloor(-10.5, -.12, 1.6, 1.8, 0xff6b7a);          /* → emergency */
    lineFloor(.12, 10.5, -3.0, -2.8, 0x5ee08a);          /* → pharmacy */
    lineFloor(12.2, 15.8, 1.7, 1.9, 0x5ea8ff);           /* → stairs */

    /* ---- stair core (solid, closed) ---- */
    box(4.0, H, 10.0, 10.2, H / 2, 8.0, wallM, { solid: true });          /* x 8.2..12.2, z 3..13  (under flight B) */
    box(1.2, H, 10.0, 16.4, H / 2, 8.0, wallM, { solid: true });          /* x 15.8..17 */
    box(3.6, H, 2.0, 14.0, H / 2, 12.0, wallM, { solid: true });          /* x 12.2..15.8, z 11..13 (under landing) */
    sign("STAIRS ▲  WARDS · THEATRE", 10.2, 2.5, 2.88, 3.6, .7, Math.PI, "#2d7192");
    sign("FLOOR 1 · WARDS · LAB · X-RAY", 14.0, 3.0, 2.9, 3.4, .5, Math.PI, "#24323f");

    /* ---- entrance & reception ---- */
    box(5.0, 3.0, .08, 0, 1.5, Z0 + .08, mat(0xbfe6f5, { transparent: true, opacity: .35 }));
    box(.12, 2.6, .12, -2.1, 1.3, Z0 + .1, metal); box(.12, 2.6, .12, 2.1, 1.3, Z0 + .1, metal); box(4.4, .14, .14, 0, 2.7, Z0 + .1, metal);
    sign("CITY HOSPITAL · 24H CARE", 0, 3.5, Z0 + .13, 6, .8, 0, "#176b65");
    box(4.2, 1.05, .9, 0, .55, -8.4, mat(0x9c7652), { solid: true });
    box(4.3, .12, 1.0, 0, 1.12, -8.4, mat(0xe8ecee));
    box(.8, .5, .05, -1, 1.45, -8.7, mat(0x20252b)); box(.7, .4, .02, -1, 1.45, -8.67, glow(0x9fd8ff));
    sign("RECEPTION · TRIAGE", 0, 3.1, -9.4, 3.6, .7, 0, "#176b65");
    staff(-1.2, -9.7, 0xe9f4f4); staff(1.2, -9.7, 0xdcecf2);
    use("triage", "RECEPTION / TRIAGE · CHECK IN", 0, -6.8, 2.2);
    /* directory board */
    box(2.4, 1.5, .08, -5.6, 1.7, -4.2, mat(0x24323f), { solid: true });
    sign("DIRECTORY", -5.6, 2.25, -4.27, 1.9, .3, Math.PI, "#176b65");
    sign("G  EMERGENCY · PHARMACY", -5.6, 1.85, -4.27, 2.2, .24, Math.PI, "#2d4254");
    sign("1  X-RAY · LAB · WARDS", -5.6, 1.57, -4.27, 2.2, .24, Math.PI, "#2d4254");
    sign("2  THEATRE · ICU · MATERNITY", -5.6, 1.29, -4.27, 2.2, .24, Math.PI, "#2d4254");
    use("directory", "HOSPITAL DIRECTORY", -5.6, -5.4, 1.8);

    /* ---- waiting lounge with TV (NW) ---- */
    sign("WAITING AREA", -10.5, 3.1, Z0 + .13, 3.4, .6, 0, "#2d7192");
    tv(-10.5, 1.8, Z0 + .22, 0, 2.0, 1.1);
    chairRow(-13.0, -8.3, 5, 1.1, Math.PI);
    chairRow(-13.0, -6.6, 5, 1.1, Math.PI);
    box(.9, .05, .6, -10.5, .45, -7.45, mat(0xc9a578), { solid: true });
    use("watch", "WATCH TV", -10.5, -7.5, 3.4);
    plant(-16.0, -11.8); plant(5.0, -11.8);

    /* ---- pharmacy (NE) ---- */
    sign("PHARMACY", 11, 3.2, Z0 + .13, 3.2, .6, 0, "#2f8f5b");
    shelf(8.5, -12.45, 3.2); shelf(13.5, -12.45, 3.2);
    box(6.5, 1.05, .8, 11, .55, -7.4, mat(0x9aa4ad), { solid: true });
    box(6.6, .1, .9, 11, 1.1, -7.4, mat(0xe8ecee));
    box(.6, .6, .06, 8.7, 1.4, -7.4, glow(0x5ac98c)); box(.2, .6, .06, 8.7, 1.4, -7.37, glow(0xffffff));
    staff(10, -8.7, 0xf4f4ed); staff(12.4, -8.7, 0xe9f4f4);
    use("pharmacy", "HOSPITAL PHARMACY · ₦3,000", 11, -5.9, 2.2);

    /* ---- emergency bays + doctor (west) ---- */
    sign("EMERGENCY", -10.8, 3.1, 2.7, 3.2, .6, Math.PI, "#b23a48");
    for (let i = 0; i < 4; i++) { const bx = -15.2 + i * 2.9; bed(bx, 8.0); cabinet(bx + .85, 7.4); if (i < 3) curtain(bx + 1.45, 8.0, 3.4, false); }
    for (const x of [-15.2, -12.3]) monitor(x, 1.7, 12.7, Math.PI);
    sign("CONSULTATION", -12.5, 3.1, -1.1, 3.0, .55, Math.PI, "#2d7192");
    desk(-12.5, -.4, 0, 1.8); chair(-12.5, .55, Math.PI, 0x9c4a4a); chair(-12.5, -1.4, 0, 0x5b7f9c);
    staff(-12.5, -1.9, 0xf4f4ed);
    use("doctor", "DOCTOR CONSULTATION · ₦7,500", -12.5, 1.3, 2.4);
    cyl(.18, .5, -5.9, .25, 5.2, mat(0x8c979e), { solid: true });

    /* ---- central south hall ---- */
    sign("AMBULANCE BAY →", 1, 3.1, 2.9, 3.4, .5, Math.PI, "#24323f");
    sofa(-1.5, 11.6, Math.PI, 2.4); sofa(3.5, 11.6, Math.PI, 2.4);
    plant(-3.6, 12.2); plant(6.0, 12.2);
    box(.9, 1.7, .6, 6.2, .85, 3.5, mat(0x7a8a99), { solid: true }); box(.7, .5, .02, 6.2, 1.3, 3.8, glow(0xffd36b));   /* vending */
  }

  /* ================= FIRST FLOOR ================= */
  function first() {
    L = 1;
    shell(1, false);
    slabRects([[X0, 12.2, Z0, Z1], [15.8, X1, Z0, Z1], [12.2, 15.8, Z0, 3], [12.2, 15.8, 11, Z1]]);
    /* corridor walls (z = -1.5 north side, z = 1.5 south side) */
    wallX(-1.5, X0, X1, [[-11.5, 1.8], [-1, 1.8], [10.5, 1.8]]);
    wallX(1.5, X0, 8.2, [[-10.5, 1.8], [2.0, 1.8]]);
    wallZ(-6, Z0, -1.5, []); wallZ(4, Z0, -1.5, []);                  /* radiology | lab | offices */
    wallZ(-4, 1.5, Z1, []);                                           /* ward A | ward B */
    /* stair core on floor 1 (sealed except the landing) */
    wallX(3, 8.2, X1, [], wallM);                                      /* north face of core */
    wallZ(8.2, 3, Z1, [[12.0, 1.4]], wallM);                           /* west wall, door to landing */
    wallZ(12.2, 3, 11, [], wallM);                                     /* divider between flights */
    wallZ(15.8, 3, 11, [], wallM);                                     /* east side of flight A hole */
    sign("◄ WARDS · LAB", 8.32, 2.9, 12.0, 1.3, .5, Math.PI / 2, "#2d7192");
    sign("▲ FLOOR 2 · THEATRE · ICU", 10.2, 3.2, 11.12, 3.2, .5, 0, "#24323f");
    sign("▼ GROUND · EMERGENCY", 14.0, 3.2, 11.12, 3.2, .5, 0, "#24323f");
    /* corridor guidance + signs */
    lineFloor(X0 + 1, 8.0, -.06, .06, 0x5ea8ff);
    sign("FLOOR 1 · WARDS & DIAGNOSTICS", 0, 3.3, 1.38, 6, .5, Math.PI, "#176b65");
    chairRow(-16, -.6, 3, 1.0, 0, 0x7a8fa3);

    /* Radiology */
    sign("RADIOLOGY · X-RAY", -11.5, 3.0, -1.38, 3.4, .5, 0, "#2d7192");
    xray(-12.5, -7.2); labBench(-14.8, -11.8, 3.2); monitor(-8.4, 1.5, -12.6, 0); staff(-8.5, -4.5, 0xdcecf2);
    use("xray", "X-RAY SCAN · ₦4,000", -11.0, -4.6, 2.4);
    /* Laboratory */
    sign("LABORATORY", -1, 3.0, -1.38, 3.0, .5, 0, "#2f8f5b");
    labBench(-3.0, -11.6, 3.4); labBench(1.6, -11.6, 3.4); labBench(-1, -6.4, 4.2); staff(-1, -8.4, 0xe9f4f4);
    use("lab", "BLOOD TEST · ₦2,500", -1, -4.4, 2.4);
    /* Offices */
    sign("DOCTORS' OFFICES", 10.5, 3.0, -1.38, 3.6, .5, 0, "#24323f");
    desk(7.5, -9.5, 0, 1.8); desk(12.5, -9.5, 0, 1.8); chair(7.5, -8.3, Math.PI, 0x6d5b8c); chair(12.5, -8.3, Math.PI, 0x6d5b8c);
    shelf(15.4, -6.5, 3.0, -Math.PI / 2); plant(5.2, -2.8);

    /* Ward A */
    sign("WARD A", -10.5, 3.0, 1.62, 2.6, .5, 0, "#2d7192");
    for (let i = 0; i < 4; i++) { const bx = -15.0 + i * 3.0; bed(bx, 8.2); cabinet(bx + .85, 7.6); }
    tv(-10.5, 1.9, Z1 - .22, Math.PI, 1.8, 1.0); use("watch", "WATCH TV", -10.5, 10.6, 3.4);
    /* Ward B */
    sign("WARD B", 2.0, 3.0, 1.62, 2.6, .5, 0, "#2d7192");
    for (let i = 0; i < 3; i++) { const bx = -1.8 + i * 3.0; bed(bx, 8.2); cabinet(bx + .85, 7.6); }
    sink(7.4, 4.2);
    sign("NURSES' STATION", 5.2, 3.0, 12.88, 3.0, .5, Math.PI, "#176b65");
    staff(6.2, 11.4, 0xe9f4f4);
  }
  function sink(x, z) {
    box(.6, .1, 1.6, x, 1.0, z, mat(0xe6ebee), { solid: true }); box(.5, .55, 1.4, x, .72, z, mat(0xd6dde1));
    box(.34, .16, 1.0, x, 1.03, z, mat(0xaeb9c0)); cyl(.04, .34, x - .1, 1.2, z, metal);
  }

  /* ================= SECOND FLOOR ================= */
  function second() {
    L = 2;
    shell(2, false);
    slabRects([[X0, X1, Z0, 3], [X0, X1, 11, Z1], [X0, 8.2, 3, 11], [12.2, X1, 3, 11]]);
    box(W, .3, D, 0, H + .15, 0, roofM);                                 /* roof */
    wallX(-1.5, X0, X1, [[-10.5, 1.8], [2.0, 1.8], [12.5, 1.8]]);
    wallX(1.5, X0, 8.2, [[-10.0, 1.8], [2.5, 1.8]]);
    wallZ(-4, Z0, -1.5, []); wallZ(8, Z0, -1.5, []);                    /* theatre | ICU | offices */
    wallZ(-3, 1.5, Z1, []);                                             /* maternity | lounge */
    /* sealed stair hole of flight B + closed service shaft over flight A */
    wallX(11, 8.2, 12.2, [], wallM); wallZ(8.2, 3, 11, [], wallM);
    wallZ(12.2, 3, 11, [], wallM); wallZ(X1, 3, 11, [], wallM); wallX(3, 12.2, X1, [], wallM); wallX(11, 12.2, X1, [], wallM);
    sign("ELECTRICAL · NO ENTRY", 14.6, 2.6, 2.88, 3.2, .5, Math.PI, "#b23a48");
    sign("▼ STAIRS DOWN", 10.2, 3.1, 2.88, 3.0, .5, Math.PI, "#24323f");
    lineFloor(X0 + 1, 8.0, -.06, .06, 0xc78bff);
    sign("FLOOR 2 · THEATRE · ICU · MATERNITY", 0, 3.3, 1.38, 7, .5, Math.PI, "#6d3f8c");

    /* Operating theatre */
    sign("OPERATING THEATRE", -10.5, 3.0, -1.38, 3.8, .5, 0, "#b23a48");
    opTable(-10.5, -7.5); monitor(-13.4, 1.5, -12.6, 0); monitor(-7.6, 1.5, -12.6, 0);
    labBench(-14.9, -6.8, 3.0); sink(-4.8, -8.0);
    staff(-9.4, -6.2, 0x4aa38a); staff(-11.6, -8.8, 0x4aa38a); staff(-12.2, -4.5, 0xe9f4f4);
    use("surgery", "SURGEON · FULL RECOVERY · ₦25,000", -10.5, -4.2, 2.6);
    /* ICU */
    sign("ICU · INTENSIVE CARE", 2.0, 3.0, -1.38, 3.8, .5, 0, "#2d7192");
    for (let i = 0; i < 4; i++) { const bx = -2.4 + i * 2.6; bed(bx, -8.0); monitor(bx, 1.9, -12.7, 0); cabinet(bx + .85, -8.6); }
    /* Director's office */
    sign("DIRECTOR", 12.5, 3.0, -1.38, 2.6, .5, 0, "#24323f");
    desk(12.5, -9.5, 0, 2.4); chair(12.5, -8.3, Math.PI, 0x3a2f2a); shelf(15.5, -5.5, 3, -Math.PI / 2); plant(9.0, -3.2);

    /* Maternity */
    sign("MATERNITY WARD", -10.0, 3.0, 1.62, 3.4, .5, 0, "#c26d9c");
    for (let i = 0; i < 4; i++) { const bx = -15.0 + i * 3.0; bed(bx, 8.2); cabinet(bx + .85, 7.6); box(.5, .4, .8, bx - .9, .5, 9.2, mat(0xf7e8ee), { solid: true }); }
    /* Lounge with TV */
    sign("PATIENT LOUNGE", 2.5, 3.0, 1.62, 3.2, .5, 0, "#2d7192");
    tv(1.5, 1.9, Z1 - .22, Math.PI, 2.0, 1.1);
    sofa(-.5, 8.2, 0, 2.4); sofa(3.8, 8.2, 0, 2.4);
    box(1.6, .05, .8, 1.6, .42, 10.2, mat(0xc9a578), { solid: true });
    use("watch", "WATCH TV", 1.6, 9.2, 3.4);
    plant(-1.9, 12.2); plant(7.0, 12.2);
  }

  /* ================= ASSEMBLE ================= */
  ground(); first(); second(); stairMeshes();

  /* ======== game glue ======== */
  camera.fov = 95; camera.updateProjectionMatrix();
  const __cols = solid.map(b => ({ minX: b.x - b.hw, maxX: b.x + b.hw, minZ: b.z - b.hd, maxZ: b.z + b.hd, y0: 0, y1: 60, level: b.lvl }));
  const __world = {
    colliders: __cols, seats, uses,
    stairs: [
      { minX: SA.x0, maxX: SA.x1, minZ: SA.z0, maxZ: SA.z1, axis: "z", y0: 0,      y1: FH,     level: 0, toLevel: 1 },
      { minX: SB.x0, maxX: SB.x1, minZ: SB.z0, maxZ: SB.z1, axis: "z", y0: 2 * FH, y1: FH,     level: 1, toLevel: 2 },
    ],
    platforms: [],
    levelHeight: (lv) => lv * FH,
    ceilingHeight: H,
    bounds: { minX: X0 + .7, maxX: X1 - .7, minZ: Z0 + .7, maxZ: Z1 - .7 },
  };

  const START = { x: 0, z: Z0 + 1.8, yaw: Math.PI };
  const FLOORS = ["GROUND · RECEPTION · EMERGENCY · PHARMACY", "FLOOR 1 · RADIOLOGY · LAB · WARDS", "FLOOR 2 · THEATRE · ICU · MATERNITY"];
  const toast = (msg) => window.__ph3d_phone?._toast(msg);
  const pay = (fee, who) => {
    if (Economy.balance < fee) { toast(`${who}: ₦${fee.toLocaleString()} required. Insufficient funds.`); return false; }
    Economy.withdraw(fee); return true;
  };

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, __world, {
    scene, x: START.x, z: START.z, yaw: Math.PI + (START.yaw || 0), level: 0,
    onUse: (u) => {
      const hp = window.__ph3d_combat;
      if (u.kind === "triage") {
        const n = Number(localStorage.getItem("ph3d.hospital.visits") || 0) + 1;
        localStorage.setItem("ph3d.hospital.visits", String(n));
        toast(`CITY HOSPITAL · Triage registered. Visit #${n}. Doctor is at the Emergency bays (west).`);
      } else if (u.kind === "doctor") {
        if (!hp || hp.hp >= hp.maxHp) { toast("Doctor: Your health is stable. No treatment is required."); return; }
        if (!pay(7500, "Doctor")) return;
        hp.heal(Math.min(65, hp.maxHp - hp.hp));
        toast("Doctor: Treatment completed. ₦7,500 paid · Health restored.");
      } else if (u.kind === "pharmacy") {
        const inv = window.__ph3d_inv;
        if (!inv || typeof inv.add !== "function") { toast("Pharmacy inventory is unavailable."); return; }
        if (!pay(3000, "Pharmacy")) return;
        inv.add({ id: "medkit", name: "MEDICAL KIT", type: "consumable" });
        toast("Pharmacy: Medical kit purchased for ₦3,000 and added to inventory.");
      } else if (u.kind === "xray") {
        if (!pay(4000, "Radiology")) return;
        toast(["Radiology: Scan complete · no fractures found.", "Radiology: Scan complete · bones look healthy.", "Radiology: Scan complete · all clear. ₦4,000 paid."][Math.floor(Math.random() * 3)]);
      } else if (u.kind === "lab") {
        if (!pay(2500, "Laboratory")) return;
        toast(["Lab: Blood test done · results normal.", "Lab: Blood test done · slightly low iron. Eat well.", "Lab: Blood test done · healthy. ₦2,500 paid."][Math.floor(Math.random() * 3)]);
      } else if (u.kind === "surgery") {
        if (!hp || hp.hp >= hp.maxHp) { toast("Surgeon: You are in full health. No surgery is needed."); return; }
        if (!pay(25000, "Surgeon")) return;
        hp.heal(hp.maxHp - hp.hp);
        toast("Surgeon: Procedure successful. ₦25,000 paid · Fully recovered.");
      } else if (u.kind === "watch") {
        import("../../core/tv-player.js").then(m => m.TV.open()).catch(() => toast("The television is not working."));
      } else if (u.kind === "directory") {
        toast("DIRECTORY · G: Emergency, Pharmacy · 1: X-Ray, Lab, Wards · 2: Theatre, ICU, Maternity · Stairs: east side");
      } else toast(u.label || "USE");
    },
  });

  let lastLevel = 0;
  return {
    three: scene, camera,
    controls: { update: () => {} },
    crumb: "CITY HOSPITAL",
    title: "3 FLOORS \u00b7 24H CARE",
    subtitle: "",
    hint: "RECEPTION: CHECK IN \u00b7 EMERGENCY (WEST): DOCTOR \u00b7 PHARMACY (EAST) \u00b7 STAIRS (EAST) FOR X-RAY, LAB, WARDS, THEATRE \u00b7 E: INTERACT",
    isInterior: true,
    sceneId: "hospital",
    update: (dt) => {
      ctl.update(dt);
      if (ctl.level !== lastLevel) { lastLevel = ctl.level; toast("\uD83C\uDFE5 " + (FLOORS[lastLevel] || "")); }
    },
    dispose: () => ctl.dispose(),
  };
}
