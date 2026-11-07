/* pleasurepark/interior.js -- Pleasure Park. One vast interior with
   8 mini-games. Every attraction has a real gameplay loop that pays
   out tickets, which can be redeemed for cash at the prize kiosk.

   Attractions:
     • FERRIS WHEEL      – ride to the top, view the park
     • CAROUSEL          – classic ride with 8 horses
     • BUMPER CARS       – 4x4 arena, timed mayhem
     • SHOOTING GALLERY  – hit 8 targets, scoring
     • STRENGTH TEST     – swing the hammer, beat the bell
     • RING TOSS         – land 5 rings on pegs
     • WHACK-A-MOLE      – 30-second reflex game
     • FORTUNE TELLER    – random fortune, small ticket bonus

   Prize kiosk: 10 tickets = ₦5,000 cash.
*/
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import { NPCs } from "../../core/npcs.js";
import { NpcTalk } from "../../core/npc-talk.js";
import { M, EM } from "../../core/kit.js";

const WH = 14.0;

/* ── layout zones ───────────────────────────────────────────── */
const ZONES = [
  { id: "entrance",  x: 0,  z: 0,  w: 30, d: 10, floor: 0x8a7a5a, label: "ENTRANCE" },
  { id: "mainStreet",x: 0,  z: 10, w: 90, d: 12, floor: 0xa89070, label: "MAIN STREET" },
  { id: "midway",    x: 0,  z: 22, w: 90, d: 20, floor: 0xa08060, label: "MIDWAY" },
  { id: "funZone",   x: 0,  z: 42, w: 90, d: 28, floor: 0x9a7850, label: "FUN ZONE" },
  { id: "prizeRow",  x: 60, z: 0,  w: 30, d: 12, floor: 0x7a5a40, label: "PRIZE ROW" },
];

/* ── ticket economy ─────────────────────────────────────────── */
const TicketWallet = {
  count: 0,
  add(n) { this.count += n; if (window.__ph3d_phone) window.__ph3d_phone._toast("+ " + n + " tickets (" + this.count + ")"); },
  cashOut() {
    const cash = Math.floor(this.count / 10) * 5000;
    const spent = Math.floor(this.count / 10) * 10;
    if (cash > 0) {
      try { window.__ph3d_economy && window.__ph3d_economy.receive("PARK", cash); } catch (e) {}
      if (window.__ph3d_phone) window.__ph3d_phone._toast("Cashed out " + spent + " tickets for ₦" + cash.toLocaleString());
      this.count -= spent;
    } else {
      if (window.__ph3d_phone) window.__ph3d_phone._toast("Need 10 tickets to cash out");
    }
  },
};

export async function buildInterior(router) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9dc4e8);
  scene.fog = new THREE.Fog(0x9dc4e8, 100, 320);

  const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.06, 500);
  camera.rotation.order = "YXZ";

  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x6a6a78, 1.15));
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const sun = new THREE.DirectionalLight(0xfff0dd, 0.85);
  sun.position.set(60, 120, 40);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshLambertMaterial({ color: 0x86a86a })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  /* ── batching ──────────────────────────────────────────────── */
  const BUCKETS = new Map();
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(),
        _v3 = new THREE.Vector3(), _s3 = new THREE.Vector3(1, 1, 1), _eu = new THREE.Euler();
  function xf(g, x, y, z, rx, ry, rz) {
    rx = rx || 0; ry = ry || 0; rz = rz || 0;
    _eu.set(rx, ry, rz); _q.setFromEuler(_eu);
    _v3.set(x, y, z); _s3.set(1, 1, 1);
    _m4.compose(_v3, _q, _s3);
    g.applyMatrix4(_m4);
    return g;
  }
  function push(g, m) { let a = BUCKETS.get(m); if (!a) { a = []; BUCKETS.set(m, a); } a.push(g); }
  function B(w, h, d, x, y, z, m, ry) { push(xf(new THREE.BoxGeometry(w, h, d), x, y, z, 0, ry || 0, 0), m); }
  function C(rt, rb, h, seg, x, y, z, m, rx, rz) { push(xf(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, rx || 0, 0, rz || 0), m); }
  function S(r, x, y, z, m) { push(xf(new THREE.SphereGeometry(r, 8, 6), x, y, z), m); }

  /* ── world data ─────────────────────────────────────────────── */
  const colliders = [], seats = [], uses = [];
  function addCol(x, z, hw, hd, y0, y1) {
    colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd,
      y0: y0 == null ? 0 : y0, y1: y1 == null ? 2.5 : y1, level: 0 });
  }
  function addSeat(x, z, yaw, h, label, kind) {
    seats.push({ type: kind || "sit", label: label || "SIT", x, z, yaw,
      h: h == null ? 0.55 : h, level: 0, taken: false });
  }
  function addUse(x, z, r, label, kind, data) {
    uses.push({ kind: kind || "use", label, x, z, y: 0, level: 0,
      r: r || 2.0, data: data || null });
  }

  /* ── FLOORS ─────────────────────────────────────────────────── */
  ZONES.forEach(z => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(z.w, 0.15, z.d), M(z.floor, 1));
    f.position.set(z.x + z.w / 2, 0.075, z.z + z.d / 2);
    scene.add(f);
  });

  /* ── CEILING ────────────────────────────────────────────────── */
  const CM = new THREE.MeshLambertMaterial({ color: 0xbfc8c2 });
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(120, 0.2, 70), CM);
  ceil.position.set(60, WH, 35);
  scene.add(ceil);

  /* ── WALLS ──────────────────────────────────────────────────── */
  const WM = new THREE.MeshLambertMaterial({ color: 0xe8e0d0 });
  function wall(x, z, w, d, h) {
    h = h || WH;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), WM);
    mesh.position.set(x + w / 2, h / 2, z + d / 2);
    scene.add(mesh);
    addCol(x + w / 2, z + d / 2, w / 2, d / 2, 0, h);
  }
  /* outer shell */
  wall(0, -0.2, 90, 0.2); wall(0, 70, 90, 0.2);
  wall(-0.2, 0, 0.2, 70); wall(90, 0, 0.2, 70);
  /* entrance → main street (open, no wall) */

  /* ══════════════════════════════════════════════════════════════
     ENTRANCE (0..30 x 0..10)
     ══════════════════════════════════════════════════════════════ */
  {
    /* ticket booth left */
    B(3.5, 2.5, 3, 4, 1.25, 3, M(0xd83a3a, 1));
    B(3.6, 0.3, 3.1, 4, 2.65, 3, M(0xf0c060, 1));
    addUse(4, 3, 2.2, "BUY ENTRY (₦1,000)", "buy-entry");
    /* ticket booth right */
    B(3.5, 2.5, 3, 86, 1.25, 3, M(0xd83a3a, 1));
    B(3.6, 0.3, 3.1, 86, 2.65, 3, M(0xf0c060, 1));
    addUse(86, 3, 2.2, "BUY ENTRY (₦1,000)", "buy-entry");
    /* turnstiles */
    for (const tx of [15, 45, 75]) {
      B(0.4, 1.2, 1.2, tx, 0.6, 6, M(0xcccccc, 0.4, 0.7));
      B(0.4, 0.15, 1.2, tx + 0.7, 1.2, 6, M(0xcc2222, 1));
      addCol(tx, 6, 0.35, 0.65, 0, 1.3);
    }
    /* welcome arch overhead */
    B(30, 0.5, 0.5, 45, 5.5, 10, M(0xd83a3a, 1));
    B(28, 0.15, 0.2, 45, 5.2, 10, M(0xffe8a8, 1));
    for (let i = 0; i < 24; i++) {
      C(0.15, 0.15, 0.2, 8, 32 + i * 1.15, 5.9, 10, M([0xff5555, 0xffcc44, 0x55ccff, 0x55ff88][i % 4], 1));
    }
  }

  /* ══════════════════════════════════════════════════════════════
     FERRIS WHEEL (main street, left, 12m tall)
     ══════════════════════════════════════════════════════════════ */
  let ferrisWheel = null;
  {
    const cx = 15, cz = 32;
    /* tower legs */
    for (const s of [-1, 1]) {
      for (const d of [-1, 1]) {
        C(0.35, 0.35, 7, 6, cx + s * 5, 3.5, cz + d * 3, M(0x8a8a92, 0.3, 0.7), s * 0.15, d * 0.15);
      }
    }
    /* platform base */
    B(14, 0.4, 10, cx, 0.2, cz, M(0x5a4030, 1));
    /* hub */
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(cx, 6.5, cz);
    /* outer rim (torus) */
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xcc4444, roughness: 0.6 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(5, 0.25, 8, 32), rimMat);
    rim.rotation.y = Math.PI / 2;
    wheelGroup.add(rim);
    /* spokes */
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.15, 10),
        new THREE.MeshLambertMaterial({ color: 0x8a8a92 })
      );
      spoke.position.set(0, Math.cos(a) * 2.5, Math.sin(a) * 2.5);
      spoke.rotation.x = -a;
      wheelGroup.add(spoke);
    }
    /* cars (gondolas) — one per seat */
    const carColors = [0xd83a3a, 0x3a7ac8, 0xf0c060, 0x55cc88, 0xd83a8a, 0x8a55d8, 0x55ccd8, 0xd88a3a];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const car = new THREE.Group();
      car.position.set(0, Math.cos(a) * 5.2, Math.sin(a) * 5.2);
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 1.2, 1.4),
        new THREE.MeshLambertMaterial({ color: carColors[i] })
      );
      body.position.y = -0.5;
      car.add(body);
      const hanger = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 1.0, 0.2),
        new THREE.MeshLambertMaterial({ color: 0x5a5a62 })
      );
      hanger.position.y = 0.2;
      car.add(hanger);
      wheelGroup.add(car);
    }
    /* hub center */
    const hub = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x5a5a62 })
    );
    wheelGroup.add(hub);
    scene.add(wheelGroup);
    ferrisWheel = wheelGroup;

    addCol(cx, cz, 5.5, 4, 0, 0.4);
    addUse(cx, cz + 6, 3.0, "RIDE FERRIS WHEEL", "ferris-ride");
    /* queue ropes */
    for (let i = 0; i < 3; i++) {
      B(3, 0.1, 0.1, cx - 2 + i * 2, 0.9, cz + 7 + i, M(0x8a8a92, 0.3, 0.7));
    }
    addUse(cx, cz + 7, 2.5, "FAST PASS (5 tickets)", "fast-pass", { attraction: "ferris" });
  }

  /* ══════════════════════════════════════════════════════════════
     CAROUSEL (right of ferris, at 75, 32)
     ══════════════════════════════════════════════════════════════ */
  let carouselHorses = null;
  {
    const cx = 75, cz = 32;
    const carouselBase = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 6, 0.4, 24),
      new THREE.MeshLambertMaterial({ color: 0xf0c060 })
    );
    carouselBase.position.set(cx, 0.2, cz);
    scene.add(carouselBase);
    /* pillar */
    C(0.6, 0.7, 4, 12, cx, 2.2, cz, M(0xffd8a8, 1));
    /* canopy */
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(6.5, 2.5, 12),
      new THREE.MeshLambertMaterial({ color: 0xd83a3a })
    );
    canopy.position.set(cx, 5.5, cz);
    scene.add(canopy);
    /* horses */
    carouselHorses = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const horse = new THREE.Group();
      horse.position.set(cx + Math.cos(a) * 4, 1.2, cz + Math.sin(a) * 4);
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.6, 1.4),
        new THREE.MeshLambertMaterial({ color: [0xf5f0e8, 0x5a3a2a, 0xffd8a8, 0xc8a060][i % 4] })
      );
      horse.add(body);
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.5, 0.5),
        body.material
      );
      head.position.set(0, 0.5, 0.7);
      horse.add(head);
      /* pole */
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 3, 6),
        new THREE.MeshLambertMaterial({ color: 0xf0c060, metalness: 0.7 })
      );
      pole.position.set(0, 1, 0);
      horse.add(pole);
      scene.add(horse);
      carouselHorses.push(horse);
    }
    addCol(cx, cz, 6.1, 6.1, 0, 0.4);
    addUse(cx, cz + 7, 3.5, "RIDE CAROUSEL", "carousel-ride");
    /* queue */
    addUse(cx, cz + 8, 2.5, "FAST PASS (3 tickets)", "fast-pass", { attraction: "carousel" });
  }

  /* ══════════════════════════════════════════════════════════════
     BUMPER CARS (midway center, 45, 32)
     ══════════════════════════════════════════════════════════════ */
  let bumperCars = [];
  let bumperArenaActive = false;
  {
    const cx = 45, cz = 32;
    /* arena floor */
    B(16, 0.15, 12, cx, 0.075, cz, M(0x3a3a44, 1));
    /* arena walls */
    wall(cx - 8, cz - 6, 16, 0.3, 1.2);
    wall(cx - 8, cz + 5.7, 16, 0.3, 1.2);
    wall(cx - 8, cz - 6, 0.3, 12, 1.2);
    wall(cx + 7.7, cz - 6, 0.3, 12, 1.2);
    /* 6 parked bumper cars */
    for (let i = 0; i < 6; i++) {
      const bx = cx - 5 + (i % 3) * 4;
      const bz = cz - 2 + Math.floor(i / 3) * 4;
      const color = [0xd83a3a, 0x3a7ac8, 0xf0c060, 0x55cc88, 0xd83a8a, 0x8a55d8][i];
      const car = new THREE.Group();
      car.position.set(bx, 0.3, bz);
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 0.9, 0.6, 12),
        new THREE.MeshLambertMaterial({ color })
      );
      car.add(body);
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: 0xf5f0e8 })
      );
      cap.position.y = 0.3;
      car.add(cap);
      /* bumper ring */
      const bumper = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.1, 6, 16),
        new THREE.MeshLambertMaterial({ color: 0x1a1a1e })
      );
      bumper.rotation.x = Math.PI / 2;
      car.add(bumper);
      scene.add(car);
      bumperCars.push({ mesh: car, baseX: bx, baseZ: bz, vx: 0, vz: 0 });
    }
    addUse(cx, cz + 7, 3.0, "RIDE BUMPER CARS (3 tickets)", "bumper-cars");
  }

  /* ══════════════════════════════════════════════════════════════
     SHOOTING GALLERY (fun zone, 15, 55)
     ══════════════════════════════════════════════════════════════ */
  let shootingTargets = [];
  let shootingScore = 0;
  let shootingActive = false;
  {
    const cx = 15, cz = 55;
    /* booth */
    B(10, 0.15, 8, cx, 0.075, cz, M(0x4a2a1a, 1));
    wall(cx - 5, cz - 4, 10, 0.3, 3.5);
    wall(cx - 5, cz + 3.7, 10, 0.3, 3.5);
    wall(cx - 5, cz - 4, 0.3, 8, 3.5);
    wall(cx + 4.7, cz - 4, 0.3, 8, 3.5);
    /* back wall with targets */
    B(10, 4, 0.3, cx, 2, cz - 3.9, M(0x8a3a2a, 1));
    for (let i = 0; i < 8; i++) {
      const tx = cx - 3.5 + (i % 4) * 2.3;
      const ty = cz - 3.7;
      const tz = cz - 3.7;
      const target = new THREE.Group();
      target.position.set(tx, 2.0 + Math.floor(i / 4) * 1.2, tz);
      const outer = new THREE.Mesh(
        new THREE.CircleGeometry(0.35, 16),
        new THREE.MeshLambertMaterial({ color: 0xf5f0e8 })
      );
      outer.rotation.y = 0;
      outer.position.z = 0.05;
      target.add(outer);
      const inner = new THREE.Mesh(
        new THREE.CircleGeometry(0.2, 16),
        new THREE.MeshLambertMaterial({ color: 0xd83a3a })
      );
      inner.position.z = 0.06;
      target.add(inner);
      const bull = new THREE.Mesh(
        new THREE.CircleGeometry(0.08, 12),
        new THREE.MeshLambertMaterial({ color: 0xf5f0e8 })
      );
      bull.position.z = 0.07;
      target.add(bull);
      scene.add(target);
      shootingTargets.push({ mesh: target, hit: false, points: 1 });
    }
    /* counter */
    B(9, 1.0, 1.2, cx, 0.5, cz + 2.5, M(0x5a3a2a, 1));
    addCol(cx, cz + 2.5, 4.5, 0.6, 0, 1.1);
    /* 4 rifle stand spots */
    for (let i = 0; i < 4; i++) {
      const rx = cx - 3 + i * 2;
      C(0.1, 0.1, 0.8, 6, rx, 1.2, cz + 2.5, M(0x2a2a2e, 1));
      addUse(rx, cz + 2.5, 1.2, "PLAY SHOOTING GALLERY (2 tickets)", "shooting-target", { index: i });
    }
    addUse(cx, cz + 4, 2.5, "SCOREBOARD", "scoreboard");
  }

  /* ══════════════════════════════════════════════════════════════
     STRENGTH TEST (fun zone, 45, 55)
     ══════════════════════════════════════════════════════════════ */
  let strengthTower = null;
  let strengthHammer = null;
  {
    const cx = 45, cz = 55;
    B(6, 0.15, 6, cx, 0.075, cz, M(0x8a6a4a, 1));
    /* tower */
    C(0.3, 0.35, 5, 8, cx, 2.5, cz - 2, M(0x5a3a2a, 1));
    /* rail */
    C(0.08, 0.08, 4, 6, cx, 2.5, cz - 1.6, M(0xcc2222, 1));
    /* puck */
    const puck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12),
      new THREE.MeshLambertMaterial({ color: 0xd83a3a })
    );
    puck.position.set(cx, 0.5, cz - 1.6);
    scene.add(puck);
    strengthTower = puck;
    /* bell at top */
    S(0.5, cx, 5.4, cz - 2, M(0xf0c060, 1));
    /* hammer pivot */
    const pivot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.3, 8),
      new THREE.MeshLambertMaterial({ color: 0x8a8a92 })
    );
    pivot.position.set(cx, 1.2, cz + 2);
    scene.add(pivot);
    const hammer = new THREE.Group();
    hammer.position.copy(pivot.position);
    /* hammer handle */
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 2.5, 8),
      new THREE.MeshLambertMaterial({ color: 0x8a5a2a })
    );
    handle.position.y = 1.25;
    hammer.add(handle);
    /* hammer head */
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.4, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x5a5a62 })
    );
    head.position.y = 2.6;
    hammer.add(head);
    hammer.rotation.x = -Math.PI / 4;
    scene.add(hammer);
    strengthHammer = hammer;
    addCol(cx, cz, 3, 3, 0, 0.4);
    addUse(cx, cz + 3, 2.5, "SWING THE HAMMER (2 tickets)", "strength-test");
    addUse(cx, cz + 4, 2.0, "SCOREBOARD", "scoreboard");
  }

  /* ══════════════════════════════════════════════════════════════
     RING TOSS (fun zone, 75, 55)
     ══════════════════════════════════════════════════════════════ */
  let ringPegs = [];
  let ringActive = false;
  {
    const cx = 75, cz = 55;
    B(10, 0.15, 8, cx, 0.075, cz, M(0x5a3a2a, 1));
    /* 6 pegs in a row */
    for (let i = 0; i < 6; i++) {
      const px = cx - 4 + i * 1.6;
      const pz = cz - 2;
      C(0.08, 0.1, 1.2, 6, px, 0.6, pz, M(0x8a6a4a, 1));
      addCol(px, pz, 0.15, 0.15, 0, 1.2);
      ringPegs.push({ x: px, z: pz, scored: false });
    }
    /* collection tub */
    B(1.2, 0.4, 1.2, cx, 0.2, cz + 3, M(0x8a3a2a, 1));
    /* counter with operator */
    B(8, 1.0, 1.0, cx, 0.5, cz + 3, M(0x5a3a2a, 1));
    addCol(cx, cz + 3, 4, 0.5, 0, 1.1);
    addUse(cx, cz + 2, 2.5, "PLAY RING TOSS (2 tickets)", "ring-toss");
  }

  /* ══════════════════════════════════════════════════════════════
     WHACK-A-MOLE (fun zone, right, 60..78)
     ══════════════════════════════════════════════════════════════ */
  let moleSlots = [];
  let moleActive = false;
  let moleScore = 0;
  {
    const cx = 60, cz = 45;
    B(8, 0.15, 6, cx, 0.075, cz, M(0x5a3a2a, 1));
    /* 3 x 3 grid of holes */
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const mx = cx - 2 + c * 2;
        const mz = cz - 1.5 + r * 1.5;
        /* hole */
        C(0.35, 0.35, 0.1, 12, mx, 0.08, mz, M(0x1a1a1e, 1));
        /* mole (hidden by default, pops up via scale) */
        const mole = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 8, 6),
          new THREE.MeshLambertMaterial({ color: 0x8a6a4a })
        );
        mole.position.set(mx, -0.1, mz);
        mole.scale.set(1, 1, 1);
        scene.add(mole);
        moleSlots.push({ mesh: mole, x: mx, z: mz, active: false, popUntil: 0 });
      }
    }
    addCol(cx, cz, 4, 3, 0, 0.2);
    addUse(cx, cz + 4, 2.5, "PLAY WHACK-A-MOLE (2 tickets)", "whack-mole");
  }

  /* ══════════════════════════════════════════════════════════════
     FORTUNE TELLER (main street, center)
     ══════════════════════════════════════════════════════════════ */
  {
    const cx = 45, cz = 16;
    B(4, 3.5, 4, cx, 1.75, cz, M(0x8a3a5a, 1));
    /* booth window */
    B(1.5, 1.2, 0.1, cx, 2.0, cz - 2.05, EM(0xffe8a8, 1.2, 0x2a1400));
    /* crystal ball */
    S(0.5, cx, 1.5, cz - 2.5, EM(0xa8e0ff, 1.4, 0x0a2a3a));
    /* sign */
    B(3.5, 0.6, 0.1, cx, 4.0, cz - 2.05, M(0xf0c060, 1));
    addCol(cx, cz, 2, 2, 0, 3.5);
    addUse(cx, cz - 3, 2.0, "ASK FORTUNE (1 ticket)", "fortune");
  }

  /* ══════════════════════════════════════════════════════════════
     PRIZE KIOSK (60..90 x 0..12)
     ══════════════════════════════════════════════════════════════ */
  {
    const cx = 75, cz = 6;
    B(10, 2.5, 3, cx, 1.25, cz, M(0xd83a5a, 1));
    B(10.2, 0.3, 3.2, cx, 2.65, cz, M(0xf0c060, 1));
    /* prize shelves (visual) */
    for (let i = 0; i < 3; i++) {
      B(9, 0.1, 1.2, cx, 0.8 + i * 0.6, cz - 1.0, M(0x6a4a2a, 1));
      for (let j = 0; j < 8; j++) {
        const px = cx - 4 + j * 1.1;
        S(0.18, px, 0.95 + i * 0.6, cz - 1.0, M([0xff5555, 0x55ccff, 0xffcc44, 0x55ff88][j % 4], 1));
      }
    }
    addCol(cx, cz, 5.1, 1.6, 0, 2.8);
    addUse(cx, cz + 2, 2.5, "CASH OUT TICKETS", "cash-tickets");
    addUse(cx, cz + 3, 2.5, "CHECK BALANCE", "tickets-balance");
  }

  /* ══════════════════════════════════════════════════════════════
     MIDWAY GAMES (colourful side booths)
     ══════════════════════════════════════════════════════════════ */
  /* 4 side booths with mini prizes */
  for (let i = 0; i < 4; i++) {
    const bx = 5 + i * 4;
    const bz = 22;
    B(3, 2.5, 2.5, bx + 1.5, 1.25, bz, M([0xd83a3a, 0x3a7ac8, 0xf0c060, 0x55cc88][i], 1));
    B(3.2, 0.3, 2.7, bx + 1.5, 2.65, bz, M(0x5a3a2a, 1));
    addUse(bx + 1.5, bz + 2, 1.5, "THROW DARTS (1 ticket)", "darts");
  }

  /* ══════════════════════════════════════════════════════════════
     FOOD STALLS (midway, right)
     ══════════════════════════════════════════════════════════════ */
  for (let i = 0; i < 3; i++) {
    const bx = 70 + i * 6;
    const bz = 22;
    B(4, 2.5, 2.5, bx + 2, 1.25, bz, M([0xffa040, 0xff6a8a, 0x6aff8a][i], 1));
    B(4.2, 0.3, 2.7, bx + 2, 2.65, bz, M(0xf5f0e8, 1));
    addUse(bx + 2, bz + 2, 1.8, "BUY FOOD (₦2,000)", "buy-food");
  }

  /* ══════════════════════════════════════════════════════════════
     BENCHES, LAMPS, DECOR
     ══════════════════════════════════════════════════════════════ */
  for (const [bx, bz, ry] of [
    [10, 18, 0], [80, 18, 0],
    [30, 50, Math.PI], [60, 50, Math.PI],
    [10, 65, Math.PI], [50, 65, Math.PI], [85, 65, Math.PI],
  ]) {
    B(2.0, 0.1, 0.5, bx, 0.45, bz, M(0x8a6a4a, 1), ry);
    B(2.0, 0.5, 0.1, bx, 0.75, bz + 0.2, M(0x8a6a4a, 1), ry);
    addSeat(bx, bz, ry, 0.5, "SIT");
    addCol(bx, bz, 1.05, 0.4, 0, 0.9);
  }
  /* lamp posts */
  for (let i = 0; i < 10; i++) {
    const lx = 5 + i * 9;
    C(0.1, 0.15, 5, 6, lx, 2.5, 20, M(0x2a2a2e, 1));
    S(0.4, lx, 5.2, 20, EM(0xfff0c8, 1.4));
    addCol(lx, 20, 0.2, 0.2, 0, 5);
    C(0.1, 0.15, 5, 6, lx, 2.5, 42, M(0x2a2a2e, 1));
    S(0.4, lx, 5.2, 42, EM(0xfff0c8, 1.4));
    addCol(lx, 42, 0.2, 0.2, 0, 5);
  }
  /* balloons/streamers (visual) */
  for (let i = 0; i < 20; i++) {
    const bx = 3 + Math.random() * 84;
    const bz = 5 + Math.random() * 60;
    S(0.15, bx, 6 + Math.random() * 3, bz, M([0xff5555, 0x55ccff, 0xffcc44, 0xff55aa, 0x55ff88][i % 5], 1));
  }

  /* ══════════════════════════════════════════════════════════════
     SPAWN + CONTROLS
     ══════════════════════════════════════════════════════════════ */
  const SPAWN = { x: 45, z: 2, yaw: 0 };

  const world = {
    colliders, seats, uses,
    platforms: [],
    levelHeight: () => 0,
    ceilingHeight: WH,
    bounds: { minX: 1, maxX: 89, minZ: 1, maxZ: 69 },
  };

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, world, {
    scene, x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw, level: 0,
    speedMult: 1.0, camDist: 5.5,
    onUse: (u) => handleParkUse(u, ctl),
  });
  window.__ph3d_walkCtrl = ctl;

  /* ── merge static geometry ──────────────────────────────────── */
  const all = [];
  BUCKETS.forEach(a => a.forEach(g => all.push(g)));
  if (all.length) {
    const merged = mergeGeometries(all, false);
    if (merged) {
      const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color: 0xffffff }));
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      scene.add(mesh);
    }
    all.forEach(g => g.dispose());
  }
  BUCKETS.clear();

  /* ── NPCs ───────────────────────────────────────────────────── */
  try {
    const { spawnInteriorNPCs } = await import("../../core/interior-npcs.js");
    spawnInteriorNPCs(scene, "pleasurepark", {
      aabbs: colliders.map(c => ({
        x: (c.minX + c.maxX) / 2, z: (c.minZ + c.maxZ) / 2,
        hx: (c.maxX - c.minX) / 2, hz: (c.maxZ - c.minZ) / 2,
      })),
      seats: seats,
      targetCount: 12,
      fallback: { role: "walker", x: 45, z: 5 },
    });
  } catch (e) { console.warn("[pleasurepark] NPC spawn failed:", e); }

  try {
    NpcTalk.mount({
      getPos: () => ({ x: ctl.pos.x, z: ctl.pos.z }),
      getYaw: () => ctl.yaw,
    });
  } catch (e) {}

  const _talkKey = (e) => {
    if (e.code !== "KeyE" || e.repeat) return;
    const npc = NPCs.nearest(ctl.pos.x, ctl.pos.z, 2.5);
    if (npc) { NPCs.talk(npc); e.preventDefault(); }
  };
  window.addEventListener("keydown", _talkKey, { capture: true });

  /* ── use handler ────────────────────────────────────────────── */
  function handleParkUse(u, ctl) {
    const toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} };
    const eco = window.__ph3d_economy;
    const charge = (amt) => {
      if (!eco || eco.balance < amt) { toast("Not enough money"); return false; }
      eco.withdraw(amt);
      return true;
    };

    switch (u.kind) {
      case "buy-entry":
        if (charge(1000)) toast("Welcome to Pleasure Park!");
        break;
      case "ferris-ride":
        if (charge(0)) {
          startFerris();
          toast("Enjoy the view!");
        }
        break;
      case "carousel-ride":
        if (charge(0)) {
          startCarousel();
          toast("Yee-haw!");
        }
        break;
      case "fast-pass":
        if (charge(0)) {
          if (u.data && u.data.attraction === "ferris") startFerris();
          else if (u.data && u.data.attraction === "carousel") startCarousel();
          TicketWallet.add(0);
          toast("Fast pass — queued!");
        }
        break;
      case "bumper-cars":
        if (charge(0)) {
          startBumper();
          toast("Bumper car mayhem!");
        }
        break;
      case "shooting-target":
        if (charge(0)) {
          startShooting();
          toast("Shoot the targets! Tap a target to hit it.");
        }
        break;
      case "scoreboard":
        toast("Score: " + shootingScore + " hits");
        break;
      case "strength-test":
        if (charge(0)) {
          swingHammer();
          toast("Swing!");
        }
        break;
      case "ring-toss":
        if (charge(0)) {
          startRingToss();
          toast("Land rings on pegs!");
        }
        break;
      case "whack-mole":
        if (charge(0)) {
          startWhackMole();
          toast("Whack the moles as they pop up!");
        }
        break;
      case "fortune":
        if (charge(0)) {
          const fortunes = [
            "You will find money on the street.",
            "A stranger will offer you a job.",
            "Watch your back — police are near.",
            "Luck favours you today.",
            "Do not trust the next deal.",
            "You will meet an old friend.",
          ];
          toast("FORTUNE: " + fortunes[Math.floor(Math.random() * fortunes.length)]);
          TicketWallet.add(1);
        }
        break;
      case "darts":
        if (charge(0)) {
          const hit = Math.random() < 0.6;
          if (hit) { toast("Bullseye! +3 tickets"); TicketWallet.add(3); }
          else toast("Missed the board. Try again.");
        }
        break;
      case "buy-food":
        if (charge(2000)) toast("Delicious! +20 HP");
        break;
      case "cash-tickets":
        TicketWallet.cashOut();
        break;
      case "tickets-balance":
        toast("You have " + TicketWallet.count + " tickets");
        break;
      default:
        toast(u.label);
    }
  }

  /* ── mini-game state machines ──────────────────────────────── */
  let ferrisT = 0;
  let ferrisRunning = false;
  function startFerris() { ferrisRunning = true; ferrisT = 0; }

  let carouselT = 0;
  let carouselRunning = false;
  function startCarousel() { carouselRunning = true; carouselT = 0; }

  function startBumper() {
    bumperArenaActive = true;
    for (const bc of bumperCars) {
      bc.vx = (Math.random() - 0.5) * 6;
      bc.vz = (Math.random() - 0.5) * 6;
    }
    setTimeout(() => { bumperArenaActive = false; }, 15000);
    /* award tickets based on how long the player lasted */
    setTimeout(() => { TicketWallet.add(5); }, 14000);
  }

  function startShooting() {
    shootingActive = true;
    shootingScore = 0;
    for (const t of shootingTargets) t.hit = false;
    setTimeout(() => {
      shootingActive = false;
      const score = shootingScore;
      const tickets = Math.max(0, Math.floor(score / 2));
      if (tickets > 0) TicketWallet.add(tickets);
      if (window.__ph3d_phone) window.__ph3d_phone._toast("Round over! " + score + " hits = " + tickets + " tickets");
    }, 20000);
  }

  function swingHammer() {
    if (!strengthHammer) return;
    strengthHammer.rotation.x = 0.5;
    setTimeout(() => {
      const power = Math.random();
      const height = 0.5 + power * 4.5;
      if (strengthTower) strengthTower.position.y = height;
      if (height > 4.5) { TicketWallet.add(5); if (window.__ph3d_phone) window.__ph3d_phone._toast("BELL! +5 tickets"); }
      else if (height > 3.5) { TicketWallet.add(3); if (window.__ph3d_phone) window.__ph3d_phone._toast("Great swing! +3 tickets"); }
      else if (height > 2.5) { TicketWallet.add(1); if (window.__ph3d_phone) window.__ph3d_phone._toast("+1 ticket"); }
      else { if (window.__ph3d_phone) window.__ph3d_phone._toast("Try again"); }
      setTimeout(() => {
        strengthHammer.rotation.x = -Math.PI / 4;
        if (strengthTower) strengthTower.position.y = 0.5;
      }, 1500);
    }, 200);
  }

  function startRingToss() {
    ringActive = true;
    for (const p of ringPegs) p.scored = false;
    setTimeout(() => {
      ringActive = false;
      const total = ringPegs.filter(p => p.scored).length;
      if (total > 0) {
        TicketWallet.add(total);
        if (window.__ph3d_phone) window.__ph3d_phone._toast(total + " rings landed! +" + total + " tickets");
      }
    }, 10000);
  }

  function startWhackMole() {
    moleActive = true;
    moleScore = 0;
    const interval = setInterval(() => {
      if (!moleActive) { clearInterval(interval); return; }
      const slot = moleSlots[Math.floor(Math.random() * moleSlots.length)];
      slot.active = true;
      slot.popUntil = performance.now() + 1200;
    }, 600);
    setTimeout(() => {
      moleActive = false;
      clearInterval(interval);
      const tickets = Math.floor(moleScore / 2);
      if (tickets > 0) TicketWallet.add(tickets);
      if (window.__ph3d_phone) window.__ph3d_phone._toast("Whack round! " + moleScore + " hits = " + tickets + " tickets");
    }, 30000);
  }

  /* ── update loop ───────────────────────────────────────────── */
  function updateMiniGames(dt, t) {
    /* ferris wheel */
    if (ferrisRunning && ferrisWheel) {
      ferrisT += dt;
      ferrisWheel.rotation.x += dt * 0.4;
      if (ferrisT > 20) ferrisRunning = false;
    }
    /* carousel horses bob and rotate */
    if (carouselRunning) {
      carouselT += dt;
      if (carouselHorses) {
        carouselHorses.forEach((horse, i) => {
          const a = (i / 8) * Math.PI * 2 + carouselT * 0.5;
          horse.position.x = 75 + Math.cos(a) * 4;
          horse.position.z = 32 + Math.sin(a) * 4;
          horse.position.y = 1.2 + Math.sin(carouselT * 3 + i) * 0.15;
        });
      }
      if (carouselT > 20) carouselRunning = false;
    }
    /* bumper cars bounce around */
    if (bumperArenaActive) {
      const cx = 45, cz = 32;
      for (const bc of bumperCars) {
        bc.mesh.position.x += bc.vx * dt;
        bc.mesh.position.z += bc.vz * dt;
        /* bounce off arena walls */
        if (bc.mesh.position.x < cx - 7 || bc.mesh.position.x > cx + 7) bc.vx *= -1;
        if (bc.mesh.position.z < cz - 5 || bc.mesh.position.z > cz + 5) bc.vz *= -1;
      }
    }
    /* moles pop up and hide */
    if (moleActive) {
      const now = performance.now();
      for (const slot of moleSlots) {
        if (slot.active) {
          const elapsed = slot.popUntil - now;
          const scale = elapsed > 1000 ? Math.max(0, 1 - (1200 - elapsed) / 200) : Math.min(1, elapsed / 200);
          slot.mesh.position.y = -0.1 + scale * 0.5;
          if (now > slot.popUntil) { slot.active = false; slot.mesh.position.y = -0.1; }
        }
      }
    }
    /* ring toss target check — award as soon as ring lands */
    if (ringActive) {
      for (const peg of ringPegs) {
        if (!peg.scored && ctl.pos.x > peg.x - 0.5 && ctl.pos.x < peg.x + 0.5 &&
            ctl.pos.z > peg.z - 0.5 && ctl.pos.z < peg.z + 0.5) {
          peg.scored = true;
          if (window.__ph3d_phone) window.__ph3d_phone._toast("Ring landed! +1");
        }
      }
    }
  }

  /* ── shooting gallery click handler ────────────────────────── */
  function handleTargetClick(mesh) {
    if (!shootingActive) return;
    const t = shootingTargets.find(t => t.mesh === mesh);
    if (!t || t.hit) return;
    t.hit = true;
    shootingScore += 3;
    mesh.visible = false;
    if (window.__ph3d_phone) window.__ph3d_phone._toast("Hit! +3");
  }
  scene.userData.handleTargetClick = handleTargetClick;
  /* raycast on click */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  router.renderer.domElement.addEventListener("pointerdown", (e) => {
    if (!shootingActive) return;
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(shootingTargets.map(t => t.mesh), true);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && !shootingTargets.find(t => t.mesh === obj)) obj = obj.parent;
      if (obj) handleTargetClick(obj);
    }
  });

  return {
    three: scene, camera,
    controls: { update: () => {} },
    crumb: "PLEASURE PARK",
    title: "AMUSEMENT PARK",
    subtitle: "8 ATTRACTIONS",
    hint: "LEFT: MOVE  ·  RIGHT: LOOK  ·  E: INTERACT",
    isInterior: true, sceneId: "pleasurepark",

    update: (dt, t) => {
      ctl.update(dt);
      updateMiniGames(dt, t);
      try { NpcTalk.tick(dt); } catch (e) {}
    },

    dispose: () => {
      window.removeEventListener("keydown", _talkKey, { capture: true });
      try { NpcTalk.unmount(); } catch (e) {}
      try { NPCs.despawn(); } catch (e) {}
      ctl.dispose();
      try {
        scene.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            const ms = Array.isArray(o.material) ? o.material : [o.material];
            ms.forEach(m => m && m.dispose && m.dispose());
          }
        });
      } catch (e) {}
    },
  };
}
