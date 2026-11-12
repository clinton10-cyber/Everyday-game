/* hotel/interior.js -- Hotel Presidential. Hand-built 5-star interior.
   Grand atrium lobby with fountain, 3 suites, gym, spa, sky bar,
   fine dining restaurant, business centre, pool deck, concierge.

   Every chair, bed, bar stool, sun lounger, toilet, and sink is a
   real seat/use point. Uses the shared ThirdPersonControls rig and
   the batch-merge pattern used by market/interior.js and zoo/interior.js
   for performance.
*/
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import { NPCs } from "../../core/npcs.js";
import { NpcTalk } from "../../core/npc-talk.js";
import { M, EM } from "../../core/kit.js";
import { Economy } from "../../core/economy.js";


const HOTEL_ROOMS = [
  { id:"suite101", name:"EXECUTIVE SUITE", price:85000, detail:"King bed · lounge · city view" },
  { id:"suite102", name:"DELUXE SUITE", price:125000, detail:"Premium lounge · upgraded finish" },
  { id:"suite103", name:"PRESIDENTIAL SUITE", price:220000, detail:"Top-tier suite · luxury furnishing" },
];
function openHotelBooking() {
  const id = "ph3d-hotel-booking";
  let root = document.getElementById(id);
  if (!root) {
    root = document.createElement("div"); root.id = id;
    root.style.cssText = "position:fixed;inset:0;z-index:120;display:none;align-items:center;justify-content:center;background:rgba(3,8,15,.78);backdrop-filter:blur(9px);font-family:system-ui;color:#f7f2e8;padding:14px";
    root.innerHTML = `<section style="width:min(520px,96vw);max-height:88vh;overflow:auto;background:linear-gradient(145deg,#282019,#100f12);border:1px solid #c9a76b;border-radius:22px;padding:20px;box-shadow:0 24px 80px #000">
      <header style="display:flex;align-items:center;gap:12px"><div style="flex:1"><small style="letter-spacing:.2em;color:#d9bd82">HOTEL PRESIDENTIAL · WOJI ROAD</small><h2 style="margin:5px 0">Reserve a suite</h2></div><button data-close style="width:42px;height:42px;border-radius:50%;border:1px solid #9b8156;background:#211b17;color:white;font-size:22px">×</button></header>
      <p style="color:#c7bda9;font-size:13px">Choose a room for one in-game night. Payment uses your Everyday Pay game balance.</p>
      <div data-rooms style="display:grid;gap:10px"></div><p data-status style="min-height:20px;color:#d9bd82;font-size:12px"></p><div style="display:flex;justify-content:space-between;border-top:1px solid #594a34;padding-top:12px"><span>Wallet balance</span><b data-balance></b></div>
    </section>`;
    document.body.appendChild(root);
    root.querySelector("[data-close]").onclick = () => root.style.display = "none";
    root.addEventListener("pointerdown", e => { if (e.target === root) root.style.display = "none"; });
  }
  const rooms = root.querySelector("[data-rooms]"); rooms.innerHTML = "";
  root.querySelector("[data-balance]").textContent = Economy.format(Economy.balance);
  let existing = null;
  try { existing = JSON.parse(localStorage.getItem("ph3d.hotel.booking") || "null"); } catch(e) {}
  root.querySelector("[data-status]").textContent = existing ? ("Current reservation: " + existing.name + ". One active booking is allowed at a time.") : "";
  HOTEL_ROOMS.forEach(room => {
    const card = document.createElement("article");
    card.style.cssText = "border:1px solid #66543a;border-radius:15px;padding:13px;background:rgba(255,255,255,.04)";
    const title = document.createElement("b"); title.textContent = room.name;
    const detail = document.createElement("p"); detail.textContent = room.detail; detail.style.cssText = "margin:5px 0;color:#c7bda9;font-size:12px";
    const price = document.createElement("strong"); price.textContent = Economy.format(room.price) + " / night"; price.style.color = "#e7c77e";
    const button = document.createElement("button"); button.textContent = "BOOK SUITE";
    button.style.cssText = "display:block;width:100%;margin-top:10px;padding:12px;border:0;border-radius:10px;background:#c9a76b;color:#21170a;font-weight:900";
    if (existing) { button.disabled = true; button.textContent = existing.room === room.id ? "YOUR RESERVED SUITE" : "RESERVATION ACTIVE"; button.style.opacity = ".45"; }
    button.onclick = () => {
      if (!Economy.withdraw(room.price)) { root.querySelector("[data-status]").textContent = "Insufficient Everyday Pay balance."; return; }
      const booking = { room:room.id, name:room.name, paid:room.price, at:Date.now(), nights:1 };
      try { localStorage.setItem("ph3d.hotel.booking", JSON.stringify(booking)); } catch(e) {}
      root.querySelector("[data-balance]").textContent = Economy.format(Economy.balance);
      root.querySelector("[data-status]").textContent = "Reservation confirmed: " + room.name + ". Your suite is ready.";
      if (window.__ph3d_phone) window.__ph3d_phone._toast("Hotel reservation confirmed");
      rooms.querySelectorAll("button").forEach(b => { b.disabled = true; b.textContent = b === button ? "BOOKED" : "RESERVATION ACTIVE"; b.style.opacity = ".45"; });
    };
    card.append(title, detail, price, button); rooms.appendChild(card);
  });
  root.style.display = "flex";
}

const WH = 4.2;   /* was 8.0 — walls were towering; 4.2 m is a grand-but-real ceiling */

/* ── ROOMS ──────────────────────────────────────────────────────
   x, z are top-left corners; w, d are width and depth.
   Floor colours are handed to M() so the room reads at a glance. */
const ROOMS = [
  { id: "lobby",      x: 0,  z: 0,  w: 24, d: 16, floor: 0xe8dcc8, label: "GRAND LOBBY" },
  { id: "reception",  x: 24, z: 0,  w: 10, d: 16, floor: 0xd8c8b0, label: "RECEPTION" },
  { id: "concierge",  x: 34, z: 0,  w: 10, d: 16, floor: 0xd8c8b0, label: "CONCIERGE" },
  { id: "suite101",   x: 0,  z: 16, w: 11, d: 12, floor: 0x6a4a62, label: "SUITE 101" },
  { id: "suite102",   x: 11, z: 16, w: 11, d: 12, floor: 0x6a4a62, label: "SUITE 102" },
  { id: "suite103",   x: 22, z: 16, w: 11, d: 12, floor: 0x6a4a62, label: "SUITE 103" },
  { id: "corridor",   x: 33, z: 16, w: 11, d: 12, floor: 0x8a6248, label: "PRIVATE CORRIDOR" },
  { id: "gym",        x: 0,  z: 28, w: 11, d: 8,  floor: 0x22262c, label: "GYM" },
  { id: "spa",        x: 11, z: 28, w: 11, d: 8,  floor: 0x1c2c34, label: "SPA" },
  { id: "business",   x: 22, z: 28, w: 22, d: 8,  floor: 0x3a2a1a, label: "BUSINESS CENTRE" },
  { id: "restaurant", x: 0,  z: 36, w: 22, d: 10, floor: 0x2a1e28, label: "FINE DINING" },
  { id: "skybar",     x: 22, z: 36, w: 12, d: 10, floor: 0x352619, label: "SKY BAR" },
  { id: "pool",       x: 34, z: 36, w: 10, d: 10, floor: 0x0f3a4e, label: "POOL DECK" },
];

export async function buildInterior(router) {
  const LOW = (window.__ph3d_quality && window.__ph3d_quality.tier === "low");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9dc4e8);
  scene.fog = new THREE.Fog(0x9dc4e8, LOW ? 40 : 70, LOW ? 140 : 280);

  const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.06, 300);
  camera.rotation.order = "YXZ";

  /* ── LIGHTING ──────────────────────────────────────────────── */
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x6a6a78, 1.15));
  scene.add(new THREE.AmbientLight(0xffffff, 0.22));
  const sun = new THREE.DirectionalLight(0xfff0dd, 0.7);
  sun.position.set(40, 90, 30);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshLambertMaterial({ color: 0x86a86a })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  /* ── BATCHING ──────────────────────────────────────────────── */
  const BUCKETS = new Map();
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(),
        _v3 = new THREE.Vector3(), _s3 = new THREE.Vector3(1,1,1),
        _eu = new THREE.Euler();
  function xf(g, x, y, z, rx, ry, rz) {
    rx = rx || 0; ry = ry || 0; rz = rz || 0;
    _eu.set(rx, ry, rz); _q.setFromEuler(_eu);
    _v3.set(x, y, z); _s3.set(1, 1, 1);
    _m4.compose(_v3, _q, _s3);
    g.applyMatrix4(_m4);
    return g;
  }
  function push(g, m) {
    let a = BUCKETS.get(m); if (!a) { a = []; BUCKETS.set(m, a); }
    a.push(g);
  }
  function B(w, h, d, x, y, z, m, ry) {
    push(xf(new THREE.BoxGeometry(w, h, d), x, y, z, 0, ry || 0, 0), m);
  }
  function C(rt, rb, h, seg, x, y, z, m, rx, rz) {
    push(xf(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, rx || 0, 0, rz || 0), m);
  }

  /* ── INTERACTIVES ──────────────────────────────────────────── */
  const colliders = [], seats = [], uses = [];

  function addCol(x, z, hw, hd, y0, y1) {
    colliders.push({
      minX: x - hw, maxX: x + hw,
      minZ: z - hd, maxZ: z + hd,
      y0: y0 == null ? 0 : y0,
      y1: y1 == null ? 2.5 : y1,
      level: 0,
    });
  }
  function addSeat(x, z, yaw, h, label, kind) {
    seats.push({
      type: kind || "sit", label: label || "SIT",
      x, z, yaw, h: h == null ? 0.55 : h,
      level: 0, taken: false,
    });
  }
  function addUse(x, z, r, label, kind, data) {
    uses.push({
      kind: kind || "use", label, x, z, y: 0, level: 0, r: r || 1.6,
      data: data || null,
    });
  }

  /* ── FLOORS ────────────────────────────────────────────────── */
  ROOMS.forEach((r) => {
    const f = new THREE.Mesh(
      new THREE.BoxGeometry(r.w, 0.15, r.d),
      M(r.floor, 1)
    );
    f.position.set(r.x + r.w / 2, 0.075, r.z + r.d / 2);
    scene.add(f);
  });

  /* ── CEILING ───────────────────────────────────────────────── */
  const CM = new THREE.MeshLambertMaterial({ color: 0xf3ecdc });
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(44, 0.2, 46), CM);
  ceil.position.set(22, WH, 23);
  scene.add(ceil);

  /* ── WALLS ─────────────────────────────────────────────────── */
  const WM = new THREE.MeshLambertMaterial({ color: 0xefe6d2 });
  function wall(x, z, w, d, h) {
    h = h || WH;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), WM);
    mesh.position.set(x + w / 2, h / 2, z + d / 2);
    scene.add(mesh);
    addCol(x + w / 2, z + d / 2, w / 2, d / 2, 0, h);
  }
  /* Outer shell */
  wall(0, -0.2, 44, 0.2);       /* south */
  wall(0, 46, 44, 0.2);         /* north */
  wall(-0.2, 0, 0.2, 46);       /* west */
  wall(44, 0, 0.2, 46);         /* east */

  /* Lobby ↔ Reception (doorway at z 6..10) */
  wall(24, 0, 0.2, 6);
  wall(24, 10, 0.2, 6);
  /* Reception ↔ Concierge (doorway at z 6..10) */
  wall(34, 0, 0.2, 6);
  wall(34, 10, 0.2, 6);
  /* Lobby ↔ Suites (doorways at x 6..9, 17..20, 28..31) */
  wall(0, 16, 6, 0.2);
  wall(9, 16, 8, 0.2);
  wall(20, 16, 8, 0.2);
  wall(31, 16, 2, 0.2);
  /* Suite partitions */
  wall(11, 16, 0.2, 6); wall(11, 22, 0.2, 6);
  wall(22, 16, 0.2, 6); wall(22, 22, 0.2, 6);
  wall(33, 16, 0.2, 12);
  /* Suites ↔ Gym/Spa/Business (doorways at x 5..8, 16..19, 28..31) */
  wall(0, 28, 5, 0.2);
  wall(8, 28, 8, 0.2);
  wall(19, 28, 9, 0.2);
  wall(31, 28, 13, 0.2);
  wall(11, 28, 0.2, 8);
  wall(22, 28, 0.2, 8);
  /* Business ↔ Restaurant/SkyBar (doorway at x 5..8) */
  wall(0, 36, 5, 0.2);
  wall(8, 36, 14, 0.2);
  wall(22, 36, 0.2, 10);
  /* Restaurant ↔ SkyBar (doorway at x 26..29) */
  wall(22, 36, 4, 0.2);
  wall(29, 36, 5, 0.2);
  wall(34, 36, 0.2, 10);
  /* SkyBar ↔ Pool (doorway at z 40..44) */
  wall(34, 36, 0.2, 4);
  wall(34, 44, 0.2, 2);

  /* ── WALL DRESSING: dark-wood wainscot, gold rail, baseboard + cornice ── */
  {
    const wood = new THREE.MeshLambertMaterial({ color: 0x5a3a28 });
    const gold = new THREE.MeshLambertMaterial({ color: 0xd4af37 });
    const trim = (x, z, w, d, ax) => {                 /* ax: 'x' = wall runs along X */
      const put = (h, y, t, m) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(ax === "x" ? w : t, h, ax === "x" ? t : d), m);
        mesh.position.set(x, y, z); scene.add(mesh);
      };
      put(1.1, 0.55, 0.12, wood);          /* wainscot panelling */
      put(0.08, 1.14, 0.16, gold);         /* chair rail */
      put(0.2, 0.1, 0.16, gold);           /* baseboard */
      put(0.22, WH - 0.11, 0.2, gold);     /* cornice */
    };
    trim(22, 0.12, 44, 0, "x");             /* south */
    trim(22, 45.88, 44, 0, "x");            /* north */
    trim(0.12, 23, 0, 46, "z");             /* west */
    trim(43.88, 23, 0, 46, "z");            /* east */
    trim(12, 15.9, 24, 0, "x");             /* lobby back wall */
    /* lobby pilasters */
    for (const px of [3, 8.5, 15.5, 21]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.6, WH, 0.35), WM);
      pil.position.set(px, WH / 2, 0.3); scene.add(pil);
    }
  }

  /* ── LOG: LOBBY (the showpiece) ────────────────────────────── */
  {
    /* Marble medallion in the centre */
    C(4.5, 4.5, 0.08, 32, 12, 0.04, 8, M(0xf0e8d8, 1));

    /* Central fountain (4m radius) */
    C(4.0, 4.2, 0.9, 24, 12, 0.45, 8, M(0xc8bfa8, 1));
    C(3.6, 3.6, 0.15, 24, 12, 0.9, 8, M(0x5fa8c8, 1));
    C(0.4, 0.6, 2.5, 12, 12, 1.8, 8, M(0xc8bfa8, 1));
    C(0.9, 0.9, 0.6, 16, 12, 3.1, 8, M(0xc8bfa8, 1));
    addCol(12, 8, 4.2, 4.2, 0, 3.7);
    addUse(12, 8, 5.0, "WISH AT FOUNTAIN", "use");

    /* Four chandeliers (visual only, no meshes since they'd add weight) */
    for (const [cx, cz] of [[6, 4], [18, 4], [6, 12], [18, 12]]) {
      C(0.05, 0.05, 0.9, 6, cx, WH - 0.45, cz, M(0xd4af37, 0.3, 0.7));
      C(0.5, 0.7, 0.4, 12, cx, WH - 1.2, cz, M(0xfff0c8, 1));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        B(0.04, 0.5, 0.04, cx + Math.cos(a) * 0.6, WH - 1.45, cz + Math.sin(a) * 0.6, M(0xd4af37, 0.3, 0.7));
      }
    }

    /* Lobby seating — 3 sofas + 4 armchairs around the fountain */
    /* South sofa (facing north toward fountain) */
    B(4.2, 0.4, 1.0, 12, 0.25, 3.5, M(0x3a5578, 1));
    B(4.2, 0.65, 0.15, 12, 0.55, 3.0, M(0x3a5578, 1));
    for (let i = 0; i < 3; i++) addSeat(10 + i * 2, 3.5, 0, 0.55, "SIT");
    addCol(12, 3.5, 2.2, 0.55, 0, 0.9);

    /* North sofa (facing south) */
    B(4.2, 0.4, 1.0, 12, 0.25, 12.5, M(0x3a5578, 1));
    B(4.2, 0.65, 0.15, 12, 0.55, 13.0, M(0x3a5578, 1));
    for (let i = 0; i < 3; i++) addSeat(10 + i * 2, 12.5, Math.PI, 0.55, "SIT");
    addCol(12, 12.5, 2.2, 0.55, 0, 0.9);

    /* East / West armchairs */
    for (const [ax, az, ay] of [[18, 6, -Math.PI/2], [18, 10, -Math.PI/2], [6, 6, Math.PI/2], [6, 10, Math.PI/2]]) {
      B(1.0, 0.4, 1.0, ax, 0.25, az, M(0x6a4a2a, 1));
      B(0.15, 0.6, 1.0, ax + (ay < 0 ? -0.45 : 0.45), 0.55, az, M(0x6a4a2a, 1));
      addSeat(ax, az, ay, 0.55, "SIT");
      addCol(ax, az, 0.55, 0.55, 0, 0.9);
    }

    /* Two tall potted palms flanking the entrance */
    for (const [px, pz] of [[7, 1.5], [17, 1.5]]) {
      C(0.5, 0.6, 0.7, 10, px, 0.35, pz, M(0x8a6a4a, 1));
      C(0.15, 0.2, 2.0, 8, px, 1.7, pz, M(0x6a4a2a, 1));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        push(xf(new THREE.ConeGeometry(0.5, 1.8, 4),
          px + Math.cos(a) * 0.4, 2.6, pz + Math.sin(a) * 0.4,
          Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9), M(0x3f7a44, 1));
      }
      addCol(px, pz, 0.6, 0.6, 0, 2.5);
    }

    /* Elevators (back wall of lobby) */
    for (const [ex, ez] of [[3, 15.7], [6, 15.7], [18, 15.7], [21, 15.7]]) {
      B(2.0, 3.0, 0.1, ex, 1.5, ez, M(0x888e94, 0.3, 0.7));
      B(1.8, 0.15, 0.15, ex, 3.0, ez + 0.15, M(0xd4af37, 0.3, 0.7));
      addUse(ex, 14.5, 1.5, "CALL ELEVATOR", "use");
    }
  }

  /* ── RECEPTION ─────────────────────────────────────────────── */
  {
    /* Curved reception counter */
    B(7.0, 1.0, 1.0, 29, 0.5, 4.0, M(0x3a2010, 1));
    B(7.2, 0.1, 1.2, 29, 1.05, 4.0, M(0x6a4a2a, 1));
    addCol(29, 4.0, 3.6, 0.55, 0, 1.1);
    addUse(29, 5.5, 2.5, "CHECK IN", "use");

    /* 3 computer screens on the counter */
    for (const cx of [26.5, 29, 31.5]) {
      B(0.6, 0.4, 0.05, cx, 1.45, 4.0, EM(0x1e3a5a, 1.2, 0x0a0a14));
      B(0.1, 0.2, 0.1, cx, 1.2, 4.0, M(0x2a2a2e, 1));
    }

    /* Receptionist chairs (behind the counter) */
    for (const cx of [26.5, 29, 31.5]) {
      B(0.6, 0.1, 0.6, cx, 0.45, 3.0, M(0x2a2a2e, 1));
      B(0.6, 0.55, 0.1, cx, 0.72, 2.7, M(0x2a2a2e, 1));
      addSeat(cx, 3.0, Math.PI, 0.55, "RECEPTION DESK");
      addCol(cx, 3.0, 0.35, 0.35, 0, 1.0);
    }

    /* Guest waiting bench (2 rows of 3) */
    for (let row = 0; row < 2; row++) {
      const bz = 10 + row * 3;
      B(6.0, 0.1, 0.7, 29, 0.45, bz, M(0x8a6a4a, 1));
      B(6.0, 0.7, 0.15, 29, 0.8, bz - 0.3, M(0x8a6a4a, 1));
      for (let i = 0; i < 3; i++) addSeat(27 + i * 2, bz, row === 0 ? 0 : Math.PI, 0.55, "SIT");
      addCol(29, bz, 3.1, 0.45, 0, 1.2);
    }

    /* Two big potted plants */
    for (const [px, pz] of [[25.5, 1.5], [33, 14.5]]) {
      C(0.5, 0.6, 0.9, 10, px, 0.45, pz, M(0x8a6a4a, 1));
      C(0.15, 0.2, 1.5, 8, px, 1.5, pz, M(0x6a4a2a, 1));
      push(xf(new THREE.SphereGeometry(0.9, 8, 6), px, 2.8, pz), M(0x3f7a44, 1));
      addCol(px, pz, 0.6, 0.6, 0, 2.5);
    }
  }

  /* ── CONCIERGE ─────────────────────────────────────────────── */
  {
    /* Concierge desk */
    B(2.5, 1.0, 1.2, 39, 0.5, 4.0, M(0x3a2010, 1));
    B(2.7, 0.1, 1.4, 39, 1.05, 4.0, M(0x6a4a2a, 1));
    addCol(39, 4.0, 1.35, 0.6, 0, 1.1);
    addUse(39, 5.5, 1.8, "ASK CONCIERGE", "use");

    /* Concierge chair */
    B(0.6, 0.1, 0.6, 39, 0.45, 3.0, M(0x2a2a2e, 1));
    B(0.6, 0.55, 0.1, 39, 0.72, 2.7, M(0x2a2a2e, 1));
    addSeat(39, 3.0, Math.PI, 0.55, "CONCIERGE");

    /* Luggage rack area */
    B(1.5, 0.6, 0.6, 41, 0.3, 9, M(0x8a6a4a, 1));
    addCol(41, 9, 0.8, 0.35, 0, 0.6);

    /* Wall art */
    B(0.05, 1.2, 2.5, 43.8, 3.5, 7, M(0x8a6a4a, 1));
    B(0.04, 1.0, 2.2, 43.7, 3.5, 7, EM(0xffe8a8, 1.2, 0x2a1800));
  }

  /* ── SUITES 101, 102, 103 ──────────────────────────────────── */
  for (const suite of ["suite101", "suite102", "suite103"]) {
    const r = ROOMS.find(x => x.id === suite);
    const cx = r.x + r.w / 2;
    const cz = r.z + r.d / 2;

    /* King bed against north wall */
    B(2.4, 0.4, 2.2, cx, 0.2, r.z + 2, M(0x6a4a2a, 1));
    B(2.4, 0.3, 2.2, cx, 0.55, r.z + 2, M(0xf5efe0, 1));
    B(2.4, 0.1, 1.4, cx, 0.75, r.z + 2.5, M(0xd94f8a, 1));
    B(0.8, 0.15, 0.4, cx - 0.7, 0.85, r.z + 1.2, M(0xf5efe0, 1));
    B(0.8, 0.15, 0.4, cx + 0.7, 0.85, r.z + 1.2, M(0xf5efe0, 1));
    B(2.6, 1.2, 0.12, cx, 0.9, r.z + 0.9, M(0x5a3a1a, 1));
    addSeat(cx, r.z + 2, 0, 0.78, "SLEEP", "lie");
    addCol(cx, r.z + 2, 1.3, 1.2, 0, 1.1);

    /* Nightstands */
    for (const nx of [cx - 1.6, cx + 1.6]) {
      B(0.6, 0.5, 0.5, nx, 0.25, r.z + 2, M(0x5a3a1a, 1));
      addCol(nx, r.z + 2, 0.35, 0.3, 0, 0.5);
    }

    /* Small sitting area (2 chairs + round table) */
    const sitZ = r.z + r.d - 3.5;
    B(1.6, 0.06, 0.9, cx, 0.4, sitZ, M(0x8a6a4a, 1));
    C(0.2, 0.2, 0.4, 6, cx, 0.22, sitZ, M(0x5a3a1a, 1));
    for (const sx of [cx - 1.6, cx + 1.6]) {
      B(0.6, 0.1, 0.6, sx, 0.5, sitZ, M(0x3a5578, 1));
      B(0.6, 0.6, 0.1, sx, 0.8, sitZ + 0.3, M(0x3a5578, 1));
      addSeat(sx, sitZ, Math.PI, 0.55, "SIT");
      addCol(sx, sitZ, 0.35, 0.35, 0, 0.9);
    }
    addCol(cx, sitZ, 0.85, 0.5, 0, 0.5);

    /* Wardrobe on east wall */
    B(0.6, 2.2, 2.0, r.x + r.w - 0.6, 1.1, r.z + 5, M(0x4a2f1a, 1));
    addCol(r.x + r.w - 0.6, r.z + 5, 0.35, 1.05, 0, 2.2);
  }

  /* ── GYM ───────────────────────────────────────────────────── */
  {
    /* 2 treadmills */
    for (const tx of [2.5, 5.5]) {
      B(1.2, 0.2, 2.4, tx, 0.1, 32, M(0x2a2a2e, 1));
      B(1.0, 0.1, 2.2, tx, 0.25, 32, M(0x3a3a44, 1));
      B(0.1, 1.6, 0.1, tx, 0.9, 30.9, M(0x2a2a2e, 1));
      B(1.2, 0.1, 0.3, tx, 1.7, 30.9, M(0x2a2a2e, 1));
      addCol(tx, 32, 0.65, 1.25, 0, 1.8);
      addUse(tx, 33.8, 1.8, "RUN ON TREADMILL", "run");
    }
    /* 2 weight benches */
    for (const bx of [8.5, 10.5]) {
      B(0.8, 0.15, 1.8, bx, 0.5, 32, M(0x2a2a2e, 1));
      B(0.6, 0.15, 0.6, bx, 0.65, 31.3, M(0x2a2a2e, 1));
      for (const off of [-0.3, 0.3]) B(0.08, 0.5, 1.6, bx + off, 0.25, 32, M(0x1a1a1e, 1));
      addCol(bx, 32, 0.5, 0.95, 0, 0.8);
      addUse(bx, 33.6, 1.8, "LIFT WEIGHTS", "lift");
    }
    /* Dumbbell rack (east wall) */
    B(0.7, 1.4, 3.0, 10.4, 0.7, 29.6, M(0x3a3a48, 1));
    addCol(10.4, 29.6, 0.4, 1.55, 0, 1.4);
  }

  /* ── SPA ───────────────────────────────────────────────────── */
  {
    /* Massage table */
    B(1.0, 0.55, 2.2, 16.5, 0.28, 32, M(0xf5efe0, 1));
    B(0.9, 0.06, 2.0, 16.5, 0.58, 32, M(0x8a6a4a, 1));
    addCol(16.5, 32, 0.55, 1.15, 0, 0.6);
    addUse(16.5, 33.8, 1.8, "MASSAGE", "use");
    addSeat(16.5, 32, 0, 0.6, "LIE ON MASSAGE TABLE", "lie");

    /* Hot tub (raised) */
    C(1.6, 1.7, 0.6, 16, 20.5, 0.3, 32, M(0xc8bfa8, 1));
    C(1.4, 1.4, 0.1, 16, 20.5, 0.6, 32, M(0x5fa8c8, 1));
    addCol(20.5, 32, 1.7, 1.7, 0, 0.7);
    addUse(20.5, 32, 2.4, "SOAK IN HOT TUB", "bath");

    /* Yoga mats */
    for (const mx of [13.5, 14.7, 15.9]) {
      B(0.6, 0.03, 1.5, mx, 0.015, 32, EM(0x7dff9b, 1.2, 0x0a2a10));
      addSeat(mx, 32, 0, 0.05, "DO YOGA", "lie");
    }

    /* Two chairs in the waiting corner */
    for (const [sx, sy] of [[12.5, 29.5], [13.8, 29.5]]) {
      B(0.6, 0.1, 0.6, sx, 0.5, sy, M(0x3a5578, 1));
      B(0.6, 0.6, 0.1, sx, 0.8, sy + 0.3, M(0x3a5578, 1));
      addSeat(sx, sy, Math.PI, 0.55, "SIT");
      addCol(sx, sy, 0.35, 0.35, 0, 0.9);
    }
  }

  /* ── BUSINESS CENTRE ──────────────────────────────────────── */
  {
    /* 3 desks */
    for (const [dx, dz] of [[25, 30], [28, 30], [31, 30]]) {
      B(2.0, 0.75, 1.0, dx, 0.4, dz, M(0x6a4a2a, 1));
      B(2.0, 0.1, 1.0, dx, 0.8, dz, M(0x8a6a4a, 1));
      B(0.5, 0.35, 0.05, dx, 1.15, dz - 0.4, EM(0x1e3a5a, 1.2, 0x0a0a14));
      B(0.6, 0.1, 0.6, dx, 0.45, dz + 0.9, M(0x2a2a2e, 1));
      B(0.6, 0.55, 0.1, dx, 0.72, dz + 1.2, M(0x2a2a2e, 1));
      addCol(dx, dz, 1.05, 0.55, 0, 0.9);
      addSeat(dx, dz + 0.9, Math.PI, 0.55, "WORK AT DESK");
      addUse(dx, dz + 1.6, 1.5, "USE COMPUTER", "use");
    }
    /* Printer station */
    B(1.2, 0.9, 0.6, 34, 0.45, 30, M(0x8a6a4a, 1));
    addCol(34, 30, 0.65, 0.35, 0, 0.9);
    /* Meeting table (east end) */
    B(4.0, 0.06, 2.0, 40, 0.75, 32, M(0x8a6a4a, 1));
    B(4.0, 0.7, 0.1, 40, 0.35, 32, M(0x5a3a1a, 1));
    for (let i = 0; i < 4; i++) {
      const cx = 38.3 + i * 1.2;
      B(0.5, 0.1, 0.5, cx, 0.55, 30.8, M(0x3a5578, 1));
      B(0.5, 0.55, 0.1, cx, 0.82, 30.55, M(0x3a5578, 1));
      addSeat(cx, 30.8, 0, 0.6, "SIT AT MEETING");
    }
    addCol(40, 32, 2.1, 1.1, 0, 0.85);
  }

  /* ── RESTAURANT (fine dining) ──────────────────────────────── */
  {
    /* 6 tables with 4 chairs each */
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        const tx = 4 + i * 6;
        const tz = 39 + j * 5;
        C(0.9, 1.0, 0.08, 16, tx, 0.78, tz, M(0xf5efe0, 1));
        C(0.1, 0.15, 0.75, 8, tx, 0.4, tz, M(0x5a3a1a, 1));
        addCol(tx, tz, 1.0, 1.0, 0, 0.9);
        addUse(tx, tz, 2.0, "ORDER FOOD", "cook");
        for (const [cx, cz, cy] of [
          [tx - 1.3, tz, Math.PI/2], [tx + 1.3, tz, -Math.PI/2],
          [tx, tz - 1.3, 0], [tx, tz + 1.3, Math.PI],
        ]) {
          B(0.55, 0.06, 0.55, cx, 0.45, cz, M(0x3a2010, 1));
          B(0.55, 0.7, 0.06, cx, 0.75, cz + (cy === Math.PI ? 0.28 : cy === 0 ? -0.28 : 0), M(0x3a2010, 1));
          addSeat(cx, cz, cy + Math.PI, 0.55, "DINE");
        }
      }
    }
    /* Pendant lights over tables (visual) */
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        const tx = 4 + i * 6;
        const tz = 39 + j * 5;
        C(0.03, 0.03, 1.2, 4, tx, 7.0, tz, M(0x2a2a2a, 1));
        C(0.35, 0.5, 0.4, 12, tx, 6.4, tz, M(0xffd89a, 1));
      }
    }
    /* Wine rack on south wall */
    B(8.0, 2.4, 0.5, 11, 1.2, 36.4, M(0x3a2010, 1));
    addCol(11, 36.4, 4.05, 0.3, 0, 2.4);
  }

  /* ── SKY BAR ──────────────────────────────────────────────── */
  {
    /* Long counter with 6 stools */
    B(8.0, 1.0, 1.2, 28, 0.5, 38, M(0x3a2010, 1));
    B(8.2, 0.1, 1.4, 28, 1.05, 38, M(0x6a4a2a, 1));
    addCol(28, 38, 4.1, 0.6, 0, 1.1);
    addUse(28, 39.6, 2.5, "ORDER DRINK", "cook");
    for (let i = 0; i < 6; i++) {
      const cx = 24.5 + i * 1.4;
      B(0.35, 0.05, 0.35, cx, 0.65, 39.6, M(0x8a5a2a, 1));
      B(0.05, 0.65, 0.05, cx, 0.33, 39.6, M(0x5a3a1a, 1));
      addSeat(cx, 39.6, 0, 0.65, "SIT AT BAR");
    }
    /* Whiskey shelf (visual, behind bar) */
    B(8.0, 0.05, 0.4, 28, 2.0, 36.4, M(0x6a4a2a, 1));
    for (let i = 0; i < 12; i++) {
      C(0.05, 0.05, 0.25, 6, 24.5 + i * 0.65, 2.15, 36.4, M([0xffe8a8, 0xc87a3a, 0x8a3a2a][i % 3], 1));
    }
    /* 2 cocktail tables by windows */
    for (const [tx, tz] of [[24, 43], [32, 43]]) {
      C(0.4, 0.5, 0.05, 12, tx, 0.75, tz, M(0xf5efe0, 1));
      C(0.06, 0.08, 0.75, 6, tx, 0.4, tz, M(0x5a3a1a, 1));
      addCol(tx, tz, 0.55, 0.55, 0, 0.85);
      for (const [cx, cz] of [[tx - 0.7, tz], [tx + 0.7, tz]]) {
        B(0.4, 0.5, 0.4, cx, 0.25, cz, M(0x3a5578, 1));
        addSeat(cx, cz, Math.PI/2, 0.55, "SIT");
      }
    }
  }

  /* ── POOL DECK ────────────────────────────────────────────── */
  {
    /* Main pool (rectangular) */
    B(7.0, 0.4, 5.0, 39, 0.2, 41, M(0x2a9ac4, 1));
    B(6.6, 0.05, 4.6, 39, 0.4, 41, M(0x80e8ff, 1));
    addCol(39, 41, 3.6, 2.6, 0, 0.5);
    addUse(39, 41, 4.5, "SWIM", "swim");
    /* Pool ladder */
    C(0.03, 0.03, 1.0, 4, 36, 0.6, 41, M(0xc9ced5, 1));
    /* 4 sun loungers */
    for (let i = 0; i < 4; i++) {
      const lx = 36 + i * 1.2;
      B(0.6, 0.15, 1.6, lx, 0.3, 44, M(0xfff0d0, 1));
      B(0.6, 0.5, 0.1, lx, 0.55, 44.75, M(0xe0d0b0, 1));
      for (const [ox, oz] of [[-0.25, -0.7], [0.25, -0.7], [-0.25, 0.7], [0.25, 0.7]]) {
        B(0.06, 0.3, 0.06, lx + ox, 0.15, 44 + oz, M(0xb0a090, 1));
      }
      addSeat(lx, 44, Math.PI, 0.55, "LOUNGE BY POOL");
      addCol(lx, 44, 0.4, 0.85, 0, 0.65);
    }
    /* Side table between loungers */
    B(0.5, 0.55, 0.5, 39.8, 0.28, 44, M(0x8a6a4a, 1));
    /* Poolside bar */
    B(3.0, 0.9, 0.8, 42, 0.45, 38, M(0x8a5a2a, 1));
    addUse(42, 39, 1.5, "ORDER COCKTAIL", "cook");
  }

  /* ── SPAWN ────────────────────────────────────────────────── */
  const SPAWN = { x: 12, z: 1.5, yaw: 0 };

  /* ── WORLD + CONTROLS ────────────────────────────────────── */
  const world = {
    colliders, seats, uses,
    platforms: [],
    levelHeight: () => 0,
    ceilingHeight: WH,
    bounds: { minX: 1, maxX: 43, minZ: 1, maxZ: 45 },
  };

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, world, {
    scene, x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw, level: 0,
    speedMult: 1.0,
    camDist: 4.2,
    onUse: (u) => {
      if (u && u.label === "CHECK IN") { openHotelBooking(); return; }
      const msg = {
        use:     "You use it.",
        cook:    "The kitchen prepares your order.",
        run:     "You run on the treadmill.",
        lift:    "You lift the weights.",
        bath:    "You soak in the hot tub.",
        swim:    "You swim a lap.",
      }[u.kind] || u.label;
      if (window.__ph3d_phone) window.__ph3d_phone._toast(msg);
    },
  });
  window.__ph3d_walkCtrl = ctl;

  /* ── NPCs ────────────────────────────────────────────────── */
  try {
    const { spawnInteriorNPCs } = await import("../../core/interior-npcs.js");
    spawnInteriorNPCs(scene, "hotel", {
      aabbs: colliders.map(c => ({
        x: (c.minX + c.maxX) / 2,
        z: (c.minZ + c.maxZ) / 2,
        hx: (c.maxX - c.minX) / 2,
        hz: (c.maxZ - c.minZ) / 2,
      })),
      seats: seats,
      targetCount: 8,
      fallback: { role: "walker", x: 12, z: 8 },
    });
  } catch (e) { console.warn("[hotel] NPC spawn failed:", e); }

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

  /* ── MERGE STATIC MESHES ─────────────────────────────────── */
  const all = [];
  BUCKETS.forEach(a => a.forEach(g => all.push(g)));
  if (all.length) {
    const merged = mergeGeometries(all, false);
    if (merged) {
      const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color: 0xffffff }));
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh);
    }
    all.forEach(g => g.dispose());
  }
  BUCKETS.clear();

  console.log(
    "%c[hotel]",
    "background:#f0c060;color:#2a1400;font-weight:bold;padding:2px 6px;border-radius:4px",
    "interior ready — " + seats.length + " seats, " + uses.length + " uses, " + colliders.length + " colliders"
  );

  /* ── RETURN ──────────────────────────────────────────────── */
  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "HOTEL PRESIDENTIAL",
    title: "5-STAR · WOJI ROAD",
    subtitle: "LOBBY · SUITES · SKY BAR",
    hint: "LEFT: MOVE  ·  RIGHT: LOOK  ·  E: INTERACT",
    isInterior: true,
    sceneId: "hotel",

    update: (dt) => {
      ctl.update(dt);
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
