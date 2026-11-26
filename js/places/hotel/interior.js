/* hotel/interior.js — Hotel Presidential
   Premium hand-built 5-star interior, rebuilt from scratch.

   ── Layout ─────────────────────────────────────────────────────────────
   Building: 44 × 46 m, two floors, 4.5 m ceilings.
   Entrance on the SOUTH wall (z=0). Pool terrace at the NORTH end.

   GROUND FLOOR (y = 0)
     Concierge  x 0–14 · z 0–12     │  Lobby  x 14–30 · z 0–12
     Reception  x 30–44 · z 0–12    │
     Spa        x 0–14 · z 12–28    │  Grand Atrium  x 14–30 · z 12–28
     Gym        x 30–44 · z 12–28   │
     Restaurant x 0–22 · z 28–38    │  Sky Bar  x 22–44 · z 28–38
     Garden Pool Terrace           x 0–44 · z 38–46 (glass roof)

   UPPER FLOOR (y = 4.5)
     VIP Lounge x 0–22 · z 0–10     │  Grand Ballroom x 22–44 · z 0–10
     Corridor (south) x 0–44 · z 10–14
     Corridor (west)  x 0–14 · z 14–28 (balustrade to atrium)
     Corridor (east)  x 30–44 · z 14–28 (balustrade to atrium)
     Void / atrium    x 14–30 · z 14–28
     Corridor (north) x 0–44 · z 28–32
     Suites 0..3      x 0–11 / 11–22 / 22–33 / 33–44 · z 32–46

   CIRCULATION
     • Grand staircase  x 20–24 · z 14–28 (in the atrium)
     • Twin elevators   x 38 & x 41 · z 11.9 (reception ↔ south corridor)

   ── Premium details ───────────────────────────────────────────────────
   Marble floors, gold trim, crystal chandelier, tiered fountain,
   velvet upholstery, wainscot panels, crown molding, recessed ceiling
   lights, potted palms, ambient staff NPCs. */

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/* ── lazy game modules ─────────────────────────────────────────────── */
let ThirdPersonControls, Economy, HotelGuestServices;
async function loadGameplayModules() {
  const [tp, eco, gs] = await Promise.all([
    import("../../core/thirdperson.js"),
    import("../../core/economy.js"),
    import("./guest-services.js").catch(() => ({ HotelGuestServices: null })),
  ]);
  ThirdPersonControls = tp.ThirdPersonControls;
  Economy = eco.Economy;
  HotelGuestServices = gs.HotelGuestServices;
}

/* ── booking data + persistence ────────────────────────────────────── */
const HOTEL_ROOMS = [
  { id:"classic",      name:"CLASSIC ROOM",       price:65000,  detail:"Queen bed · marble bath · garden view",     guests:2 },
  { id:"executive",    name:"EXECUTIVE SUITE",    price:95000,  detail:"King bed · lounge · work desk · city view",  guests:2 },
  { id:"deluxe",       name:"DELUXE SUITE",       price:145000, detail:"Separate lounge · premium bath · breakfast", guests:3 },
  { id:"presidential", name:"PRESIDENTIAL SUITE", price:260000, detail:"Private lounge · dining area · butler",      guests:4 },
  { id:"royal",        name:"ROYAL PENTHOUSE",    price:420000, detail:"Panoramic view · private dining · butler",   guests:5 },
];
const BOOKINGS_KEY = "ph3d.hotel.bookings.v2";

function readHotelBookings() {
  try {
    const rows = JSON.parse(localStorage.getItem(BOOKINGS_KEY) || "[]");
    if (Array.isArray(rows)) return rows;
  } catch (_) {}
  try {
    const old = JSON.parse(localStorage.getItem("ph3d.hotel.booking") || "null");
    if (old) return [{ ...old, id:"legacy-"+(old.at||Date.now()), room:old.room||"executive",
      checkIn:new Date().toISOString().slice(0,10), nights:old.nights||1, guests:1, status:"confirmed" }];
  } catch (_) {}
  return [];
}
function saveHotelBookings(rows) {
  try { localStorage.setItem(BOOKINGS_KEY, JSON.stringify(rows.slice(-40))); } catch (_) {}
}
function datePlus(date, days) {
  const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}
function overlaps(aStart, aN, bStart, bN) {
  const a = new Date(aStart + "T00:00:00").getTime();
  const b = new Date(bStart + "T00:00:00").getTime();
  const day = 86400000;
  return a < b + bN*day && b < a + aN*day;
}

/* ── booking modal (kept compatible with old call sites) ──────────── */
function openHotelBooking() {
  if (!Economy) return;
  const id = "ph3d-hotel-booking";
  let root = document.getElementById(id);
  if (!root) {
    root = document.createElement("div"); root.id = id;
    root.style.cssText = "position:fixed;inset:0;z-index:120;display:none;align-items:center;justify-content:center;background:rgba(3,8,15,.82);backdrop-filter:blur(12px);font-family:system-ui;color:#f7f2e8;padding:12px";
    root.innerHTML = `<section style="width:min(760px,98vw);max-height:92vh;overflow:auto;background:linear-gradient(145deg,#292117,#101116);border:1px solid #c9a76b;border-radius:24px;padding:20px;box-shadow:0 28px 100px #000">
      <header style="display:flex;align-items:center;gap:12px"><div style="flex:1"><small style="letter-spacing:.22em;color:#e0c48c">HOTEL PRESIDENTIAL · PORT LIFEX</small><h2 style="margin:5px 0;font-size:25px">Luxury reservations</h2><p style="margin:0;color:#c9bda9;font-size:12px">Choose your room, dates and guest count. Rates are charged to your Everyday Pay game wallet.</p></div><button data-close style="width:42px;height:42px;border-radius:50%;border:1px solid #9b8156;background:#211b17;color:white;font-size:22px">×</button></header>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin:16px 0"><label style="font-size:11px;color:#d9bd82">CHECK-IN<input data-date type="date" style="display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:10px;border-radius:9px;background:#211f1b;color:white;border:1px solid #66543a"></label><label style="font-size:11px;color:#d9bd82">NIGHTS<input data-nights type="number" min="1" max="30" value="1" style="display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:10px;border-radius:9px;background:#211f1b;color:white;border:1px solid #66543a"></label><label style="font-size:11px;color:#d9bd82">GUESTS<input data-guests type="number" min="1" max="5" value="1" style="display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:10px;border-radius:9px;background:#211f1b;color:white;border:1px solid #66543a"></label></div>
      <div data-rooms style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:11px"></div>
      <h3 style="color:#e0c48c;margin:20px 0 8px">My reservations</h3><div data-bookings style="display:grid;gap:8px"></div>
      <p data-status role="status" style="min-height:20px;color:#e0c48c;font-size:12px"></p><div style="display:flex;justify-content:space-between;border-top:1px solid #594a34;padding-top:12px"><span>Everyday Pay balance</span><b data-balance></b></div>
    </section>`;
    document.body.appendChild(root);
    root.querySelector("[data-close]").onclick = () => root.style.display = "none";
    root.addEventListener("pointerdown", e => { if (e.target === root) root.style.display = "none"; });
    ["[data-date]","[data-nights]","[data-guests]"].forEach(sel =>
      root.querySelector(sel).addEventListener("input", () => renderHotelBooking(root)));
  }
  const today = new Date();
  const todayStr = new Date(today.getTime() - today.getTimezoneOffset()*60000).toISOString().slice(0,10);
  root.querySelector("[data-date]").min = todayStr;
  if (!root.querySelector("[data-date]").value) root.querySelector("[data-date]").value = todayStr;
  root.style.display = "flex";
  renderHotelBooking(root);
}

function renderHotelBooking(root) {
  if (!Economy) return;
  const roomsEl = root.querySelector("[data-rooms]"), bookingsEl = root.querySelector("[data-bookings]");
  const checkIn = root.querySelector("[data-date]").value;
  const nights = Math.max(1, Math.min(30, Number(root.querySelector("[data-nights]").value) || 1));
  const guests = Math.max(1, Math.min(5, Number(root.querySelector("[data-guests]").value) || 1));
  const bookings = readHotelBookings();
  const fmt = n => Economy.format(n);
  root.querySelector("[data-balance]").textContent = fmt(Economy.balance);
  roomsEl.innerHTML = "";
  HOTEL_ROOMS.forEach(room => {
    const conflict = bookings.some(b => b.room === room.id && b.status !== "cancelled" && overlaps(checkIn, nights, b.checkIn, b.nights || 1));
    const card = document.createElement("article");
    card.style.cssText = "border:1px solid #705c3e;border-radius:16px;padding:14px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.02))";
    const title = document.createElement("b"); title.textContent = room.name;
    const detail = document.createElement("p"); detail.textContent = room.detail + " · up to " + room.guests + " guests";
    detail.style.cssText = "min-height:34px;margin:7px 0;color:#c7bda9;font-size:12px";
    const price = document.createElement("strong"); price.textContent = fmt(room.price) + " / night"; price.style.color = "#e7c77e";
    const total = document.createElement("div"); total.textContent = "Total: " + fmt(room.price * nights) + " · " + nights + " night(s)";
    total.style.cssText = "margin-top:7px;font-size:12px;color:#f1dfbd";
    const button = document.createElement("button");
    button.textContent = conflict ? "DATES UNAVAILABLE" : guests > room.guests ? "GUEST LIMIT EXCEEDED" : "CONFIRM RESERVATION";
    button.disabled = conflict || guests > room.guests || !checkIn;
    button.style.cssText = "display:block;width:100%;margin-top:12px;padding:12px;border:0;border-radius:10px;background:#c9a76b;color:#21170a;font-weight:900;opacity:" + (button.disabled ? ".45" : "1");
    button.onclick = () => {
      const totalCost = room.price * nights;
      const latest = readHotelBookings();
      if (latest.some(b => b.room === room.id && b.status !== "cancelled" && overlaps(checkIn, nights, b.checkIn, b.nights || 1))) { renderHotelBooking(root); return; }
      if (Economy.balance < totalCost || !Economy.withdraw(totalCost)) {
        root.querySelector("[data-status]").textContent = "Insufficient Everyday Pay balance for this reservation."; return;
      }
      const booking = { id:"HP-" + Date.now().toString(36).toUpperCase(), room:room.id, name:room.name,
        checkIn, checkOut:datePlus(checkIn, nights), nights, guests, paid:totalCost, at:Date.now(), status:"confirmed" };
      latest.push(booking); saveHotelBookings(latest);
      root.querySelector("[data-status]").textContent = "Reservation confirmed · " + booking.id + " · Check-out " + booking.checkOut + ".";
      if (window.__ph3d_phone) window.__ph3d_phone._toast("Hotel reservation confirmed");
      renderHotelBooking(root);
    };
    card.append(title, detail, price, total, button); roomsEl.appendChild(card);
  });
  bookingsEl.innerHTML = "";
  const active = bookings.filter(b => b.status !== "cancelled").slice().reverse();
  if (!active.length) {
    const empty = document.createElement("p"); empty.textContent = "No reservations yet.";
    empty.style.cssText = "color:#a99b86;font-size:12px"; bookingsEl.appendChild(empty);
  }
  active.forEach(b => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:10px;border:1px solid #51452f;border-radius:10px;background:#171612";
    const info = document.createElement("span");
    info.textContent = `${b.name} · ${b.checkIn} to ${b.checkOut} · ${b.guests || 1} guest(s) · ${fmt(b.paid || 0)} · ${(b.status || "confirmed").toUpperCase()} · ${b.id}`;
    info.style.cssText = "font-size:11px;color:#e7dcc9;flex:1;min-width:190px";
    const cancel = document.createElement("button"); cancel.textContent = "CANCEL";
    cancel.disabled = b.status !== "confirmed";
    cancel.style.cssText = "padding:8px 12px;border:1px solid #8b5d4c;border-radius:8px;background:#321d19;color:#ffd8c8;font-weight:800;opacity:"+(cancel.disabled?".35":"1");
    cancel.onclick = () => {
      const all = readHotelBookings(), target = all.find(x => x.id === b.id);
      if (!target || target.status !== "confirmed") return;
      target.status = "cancelled";
      const today = new Date().toISOString().slice(0,10);
      if (target.checkIn >= today) {
        try { Economy.receive("Hotel Presidential", target.paid || 0, "Hotel reservation cancellation refund"); } catch (_) {}
      }
      saveHotelBookings(all);
      root.querySelector("[data-status]").textContent = "Reservation cancelled. Eligible refund returned to your wallet.";
      renderHotelBooking(root);
    };
    if (b.status === "confirmed") {
      const today = new Date();
      const todayKey = new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
      const checkInBtn = document.createElement("button"); checkInBtn.textContent = "CHECK IN";
      checkInBtn.disabled = !(b.checkIn <= todayKey && b.checkOut > todayKey) || bookings.some(x=>x.status === "checked-in");
      checkInBtn.style.cssText = "padding:8px 12px;border:1px solid #7d9a71;border-radius:8px;background:#1e3020;color:#d5ffd1;font-weight:800;opacity:"+(checkInBtn.disabled?".4":"1");
      checkInBtn.onclick = () => {
        const all = readHotelBookings(), target = all.find(x => x.id === b.id);
        if (!target || target.status !== "confirmed") return;
        if (all.some(x => x.status === "checked-in")) {
          root.querySelector("[data-status]").textContent = "You already have an active hotel stay."; return;
        }
        target.status = "checked-in"; target.checkedInAt = Date.now();
        try { localStorage.setItem("ph3d.hotel.room-status.v1", JSON.stringify({ room:target.room, status:"occupied", updatedAt:Date.now() })); } catch (_) {}
        saveHotelBookings(all);
        root.querySelector("[data-status]").textContent = "Welcome to Hotel Presidential. Your room is ready.";
        if (window.__ph3d_phone) window.__ph3d_phone._toast("Hotel check-in complete");
        renderHotelBooking(root);
      };
      row.appendChild(checkInBtn);
    } else if (b.status === "checked-in") {
      const checkout = document.createElement("button"); checkout.textContent = "CHECK OUT";
      checkout.style.cssText = "padding:8px 12px;border:1px solid #9b8156;border-radius:8px;background:#33291c;color:#f5dfb0;font-weight:800";
      checkout.onclick = () => {
        const all = readHotelBookings(), target = all.find(x => x.id === b.id);
        if (!target || target.status !== "checked-in") return;
        target.status = "checked-out"; target.checkedOutAt = Date.now();
        try { localStorage.setItem("ph3d.hotel.room-status.v1", JSON.stringify({ room:target.room, status:"cleaning-required", updatedAt:Date.now() })); } catch (_) {}
        saveHotelBookings(all);
        root.querySelector("[data-status]").textContent = "You have checked out. Housekeeping has been notified.";
        if (window.__ph3d_phone) window.__ph3d_phone._toast("Hotel checkout complete");
        renderHotelBooking(root);
      };
      row.appendChild(checkout);
    }
    row.append(info, cancel); bookingsEl.appendChild(row);
  });
}

/* ── elevator modal — exits match the new geometry ────────────────── */
const ELEVATOR_STOPS = [
  { level: 0, label: "GROUND · LOBBY",   x: 39.5, z: 11.2 },
  { level: 1, label: "LEVEL 1 · SUITES", x: 39.5, z: 13.2 },
];

function openHotelElevator(ctl) {
  const id = "ph3d-hotel-elevator";
  let root = document.getElementById(id);
  if (!root) {
    root = document.createElement("div"); root.id = id;
    root.style.cssText = "position:fixed;inset:0;z-index:121;display:none;align-items:center;justify-content:center;background:rgba(4,6,10,.7);font-family:system-ui;color:#fff;padding:14px";
    root.innerHTML = `<section style="width:min(340px,94vw);padding:20px;border:1px solid #d4b46d;border-radius:18px;background:linear-gradient(145deg,#292117,#111116);box-shadow:0 20px 70px #000"><small style="letter-spacing:.2em;color:#d4b46d">HOTEL PRESIDENTIAL</small><h2 style="margin:7px 0 14px">Elevator</h2><div data-floors style="display:grid;gap:9px"></div><button data-close style="width:100%;margin-top:12px;padding:11px;border-radius:9px;background:#29231b;color:white;border:1px solid #806b48">CLOSE</button></section>`;
    document.body.appendChild(root);
    root.querySelector("[data-close]").onclick = () => root.style.display = "none";
    root.addEventListener("pointerdown", e => { if (e.target === root) root.style.display = "none"; });
  }
  const floorsEl = root.querySelector("[data-floors]"); floorsEl.innerHTML = "";
  ELEVATOR_STOPS.forEach(f => {
    const b = document.createElement("button"); b.textContent = f.label;
    b.style.cssText = "padding:13px;border:1px solid #9b8156;border-radius:10px;background:#33291c;color:#f5dfb0;font-weight:800";
    b.onclick = () => {
      ctl.level = f.level;
      if (typeof ctl.floorY === "number") ctl.floorY = f.level * 4.5;
      if (ctl.vel && ctl.vel.set) ctl.vel.set(0, 0, 0);
      /* keep the teleport resilient to whichever container the controls use */
      if (ctl.pos)      { ctl.pos.x = f.x; ctl.pos.z = f.z; }
      if (ctl.position) { ctl.position.x = f.x; ctl.position.z = f.z; }
      if (typeof ctl.x === "number") ctl.x = f.x;
      if (typeof ctl.z === "number") ctl.z = f.z;
      if (typeof ctl.state !== "undefined") ctl.state = "standing";
      if (typeof ctl.onGround !== "undefined") ctl.onGround = true;
      root.style.display = "none";
      if (window.__ph3d_phone) window.__ph3d_phone._toast(f.level ? "Arrived at VIP floor" : "Arrived at lobby");
    };
    floorsEl.appendChild(b);
  });
  root.style.display = "flex";
}

/* ═══════════════════════════════════════════════════════════════════
   BUILD
   ═══════════════════════════════════════════════════════════════════ */
const WH = 4.5;   // ceiling height

export async function buildInterior(router) {
  if (!router?.cinematic) await loadGameplayModules();
  const LOW = window.__ph3d_quality && window.__ph3d_quality.tier === "low";

  /* ── scene / camera / lights ── */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1a20);
  scene.fog = new THREE.Fog(0x0e1a20, LOW ? 50 : 80, LOW ? 120 : 220);

  const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.06, 200);
  camera.rotation.order = "YXZ";

  scene.add(new THREE.HemisphereLight(0xffe8cc, 0x1a2028, 0.85));
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));

  const sun = new THREE.DirectionalLight(0xfff4e0, 0.75);
  sun.position.set(28, 60, 40);
  scene.add(sun);

  /* warm accent lights (few, strategic) */
  const warm = (x, y, z, intensity = 0.5) => {
    const l = new THREE.PointLight(0xffd4a0, intensity, 14, 2);
    l.position.set(x, y, z); scene.add(l);
  };
  warm(22, WH - 1.2, 6, 0.9);    // above lobby fountain
  warm(22, WH - 0.6, 20, 1.0);   // above the atrium
  warm(11, WH - 1.2, 33, 0.5);   // above restaurant
  warm(33, WH - 1.2, 33, 0.5);   // above bar

  /* ── materials ── */
  const MAT = {
    wall:       new THREE.MeshLambertMaterial({ color: 0xefe6d2 }),
    wallWarm:   new THREE.MeshLambertMaterial({ color: 0xe8d8c0 }),
    wallDark:   new THREE.MeshLambertMaterial({ color: 0x4a3a2a }),
    wallSpa:    new THREE.MeshLambertMaterial({ color: 0x33434a }),
    marble:     new THREE.MeshStandardMaterial({ color: 0xf2ebdc, roughness: 0.35, metalness: 0.15 }),
    marbleDark: new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.4, metalness: 0.2 }),
    gold:       new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.22, metalness: 0.92 }),
    brass:      new THREE.MeshStandardMaterial({ color: 0xb8963a, roughness: 0.3, metalness: 0.8 }),
    wood:       new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.65, metalness: 0.05 }),
    darkWood:   new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.7, metalness: 0.05 }),
    velvet:     new THREE.MeshStandardMaterial({ color: 0x3a5578, roughness: 0.95 }),
    velvetRed:  new THREE.MeshStandardMaterial({ color: 0x8a2a2f, roughness: 0.95 }),
    velvetCrm:  new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.95 }),
    leather:    new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.55, metalness: 0.1 }),
    white:      new THREE.MeshStandardMaterial({ color: 0xfafaf5, roughness: 0.55 }),
    cream:      new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 0.6 }),
    dark:       new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.7 }),
    chrome:     new THREE.MeshStandardMaterial({ color: 0xc8cdd2, roughness: 0.15, metalness: 0.95 }),
    glass:      new THREE.MeshStandardMaterial({ color: 0x9bc4d0, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    water:      new THREE.MeshStandardMaterial({ color: 0x4a9eb8, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.85 }),
    plant:      new THREE.MeshStandardMaterial({ color: 0x2a5a30, roughness: 0.85 }),
    plantLt:    new THREE.MeshStandardMaterial({ color: 0x3f8a48, roughness: 0.85 }),
    pot:        new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.7 }),
    rugRed:     new THREE.MeshStandardMaterial({ color: 0x6a1a1f, roughness: 0.98 }),
    rugCream:   new THREE.MeshStandardMaterial({ color: 0x9a8a6a, roughness: 0.98 }),
    lamp:       new THREE.MeshBasicMaterial({ color: 0xfff0c8 }),
    screen:     new THREE.MeshBasicMaterial({ color: 0x8dd8ef }),
    skylight:   new THREE.MeshStandardMaterial({ color: 0xaad4e8, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
  };

  /* ── batching ── */
  const BUCKETS = new Map();
  const push = (geo, mat) => {
    let a = BUCKETS.get(mat); if (!a) { a = []; BUCKETS.set(mat, a); }
    a.push(geo);
  };
  function bx(w, h, d, x, y, z, m, ry) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    push(g, m);
  }
  function cy(rt, rb, h, seg, x, y, z, m, rx, rz) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    g.translate(x, y, z);
    push(g, m);
  }
  function sph(r, x, y, z, m, seg = 12) {
    const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4));
    g.translate(x, y, z);
    push(g, m);
  }

  /* ── shared NPC materials (avoids one material per NPC) ── */
  const NPC_MATS = new Map();
  const npcMat = (c) => {
    let m = NPC_MATS.get(c);
    if (!m) { m = new THREE.MeshLambertMaterial({ color: c }); NPC_MATS.set(c, m); }
    return m;
  };

  /* ── 3D sign helper — now actually adds the mesh to the scene,
        and lifts it 18 cm off the wall plane so it doesn't z-fight ── */
  function sign3d(text, x, y, z, w, h, ry = 0, bg = "#2a1a10") {
    const c = document.createElement("canvas");
    c.width = 512; c.height = Math.max(64, Math.round(512 * h / w));
    const g = c.getContext("2d");
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = "rgba(212,175,55,.7)"; g.lineWidth = 8;
    g.strokeRect(8, 8, c.width - 16, c.height - 16);
    g.fillStyle = "#e0c48c";
    g.font = "bold " + Math.round(c.height * 0.42) + "px Arial,sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, c.width / 2, c.height / 2 + 2, c.width - 40);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })
    );
    const nx = Math.sin(ry), nz = Math.cos(ry);
    mesh.position.set(x + nx * 0.18, y, z + nz * 0.18);
    mesh.rotation.y = ry;
    scene.add(mesh);
    return mesh;
  }

  /* ── interactive registries ── */
  const colliders = [], seats = [], uses = [];
  let LEVEL = 0;
  const yBase = () => LEVEL * WH;

  function addCol(x, z, hw, hd, y0, y1, lv) {
    colliders.push({
      minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd,
      y0: y0 == null ? 0 : y0, y1: y1 == null ? WH : y1,
      level: lv == null ? LEVEL : lv,
    });
  }
  function addSeat(x, z, yaw, h, label, kind, lv) {
    const level = lv == null ? LEVEL : lv;
    seats.push({
      x, z, yaw: yaw || 0,
      h: (h == null ? 0.55 : h) + level * WH,
      level, type: kind || "sit", label: label || "SIT", taken: false,
    });
  }
  function addUse(x, z, r, label, kind, data) {
    const lv = data && data.level != null ? data.level : LEVEL;
    uses.push({
      x, z, y: lv * WH, r: r || 1.8, level: lv,
      kind: kind || "use", label, data: data || null,
    });
  }

  /* ── walls with doors ──────────────────────────────────────────────
     d.at = distance from (x1,z1); d.width = opening width */
  function wall(x1, z1, x2, z2, doors, m, h) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const th = 0.2;
    const H = h || WH;
    const isH = Math.abs(dx) > Math.abs(dz);

    const ds = (doors || []).map(d => [d.at - d.width/2, d.at + d.width/2]).sort((a,b)=>a[0]-b[0]);
    const segs = [];
    let cur = 0;
    for (const [s, e] of ds) { if (s > cur + 0.02) segs.push([cur, s]); cur = e; }
    if (len > cur + 0.02) segs.push([cur, len]);

    for (const [s, e] of segs) {
      const segLen = e - s;
      const cx = x1 + dx * (s + segLen/2) / len;
      const cz = z1 + dz * (s + segLen/2) / len;
      if (isH) {
        bx(segLen, H, th, cx, H/2 + yBase(), z1, m || MAT.wall);
        addCol(cx, z1, segLen/2, th/2, yBase(), yBase()+H);
      } else {
        bx(th, H, segLen, x1, H/2 + yBase(), cz, m || MAT.wall);
        addCol(x1, cz, th/2, segLen/2, yBase(), yBase()+H);
      }
    }
    /* lintels above doors */
    for (const d of (doors || [])) {
      const doorH = 2.4;
      const linH = H - doorH;
      if (linH < 0.05) continue;
      const cx = x1 + dx * d.at / len;
      const cz = z1 + dz * d.at / len;
      if (isH) bx(d.width, linH, th, cx, doorH + linH/2 + yBase(), z1, m || MAT.wall);
      else      bx(th, linH, d.width, x1, doorH + linH/2 + yBase(), cz, m || MAT.wall);
    }
  }

  /* ── floor + rug ── */
  function floorSlab(x0, z0, x1, z1, m) {
    bx(x1 - x0, 0.15, z1 - z0, (x0+x1)/2, 0.075 + yBase(), (z0+z1)/2, m);
  }
  function rug(x0, z0, x1, z1, m) {
    bx(x1 - x0, 0.04, z1 - z0, (x0+x1)/2, 0.17 + yBase(), (z0+z1)/2, m);
  }

  /* ── premium furniture helpers ───────────────────────────────────── */
  function chair(x, z, yaw = 0, m = MAT.velvetCrm) {
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const put = (w, h, d, ox, oy, oz) => bx(w, h, d, x + ox*cs + oz*sn, oy + yBase(), z - ox*sn + oz*cs, m, yaw);
    put(0.55, 0.08, 0.55, 0, 0.45, 0);       // seat
    put(0.55, 0.55, 0.08, 0, 0.72, -0.24);   // back
    [[-0.22,-0.22],[0.22,-0.22],[-0.22,0.22],[0.22,0.22]].forEach(p =>
      cy(0.025, 0.025, 0.45, 6, x + p[0]*cs + p[1]*sn, 0.22 + yBase(), z - p[0]*sn + p[1]*cs, MAT.darkWood));
    addSeat(x, z, yaw, 0.5, "SIT", "sit");
  }
  function sofa(x, z, yaw = 0, w = 2.2, m = MAT.velvet) {
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const put = (W, H, D, ox, oy, oz) => bx(W, H, D, x + ox*cs + oz*sn, oy + yBase(), z - ox*sn + oz*cs, m, yaw);
    put(w, 0.4, 0.9, 0, 0.28, 0);
    put(w, 0.55, 0.2, 0, 0.72, -0.35);
    put(0.18, 0.5, 0.9, -w/2 + 0.09, 0.52, 0);
    put(0.18, 0.5, 0.9,  w/2 - 0.09, 0.52, 0);
    /* cushions */
    const seatCount = Math.max(2, Math.round(w / 1.1));
    for (let i = 0; i < seatCount; i++) {
      const ox = -w/2 + (i + 0.5) * (w / seatCount);
      put(w/seatCount - 0.05, 0.1, 0.85, ox, 0.52, 0.02);
    }
    addSeat(x, z, yaw, 0.45, "SIT", "sit");
    addCol(x, z, w/2, 0.5, yBase(), yBase() + 0.9);
  }
  function table(x, z, w = 1.4, d = 0.9, h = 0.78, top = MAT.wood) {
    bx(w, 0.08, d, x, h + yBase(), z, top);
    for (const ox of [-w/2 + 0.12, w/2 - 0.12])
      for (const oz of [-d/2 + 0.12, d/2 - 0.12])
        bx(0.06, h - 0.06, 0.06, x + ox, h/2 + yBase(), z + oz, MAT.darkWood);
    addCol(x, z, w/2, d/2, yBase(), yBase() + h + 0.1);
  }
  function bed(x, z, yaw = 0) {
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const put = (W, H, D, ox, oy, oz, m) => bx(W, H, D, x + ox*cs + oz*sn, oy + yBase(), z - ox*sn + oz*cs, m, yaw);
    /* frame */
    put(2.4, 0.35, 2.6, 0, 0.18, 0, MAT.darkWood);
    /* mattress + topper */
    put(2.3, 0.25, 2.5, 0, 0.52, 0, MAT.white);
    put(2.2, 0.08, 2.4, 0, 0.68, 0, MAT.cream);
    /* duvet */
    put(2.2, 0.12, 1.5, 0, 0.74, 0.35, MAT.cream);
    /* pillows */
    put(0.7, 0.16, 0.4, -0.5, 0.78, -0.95, MAT.white);
    put(0.7, 0.16, 0.4,  0.5, 0.78, -0.95, MAT.white);
    /* headboard */
    put(2.6, 1.4, 0.12, 0, 1.1, -1.3, MAT.velvetRed);
    /* nightstands */
    for (const ox of [-1.55, 1.55]) {
      bx(0.55, 0.5, 0.55, x + ox*cs + (-1.35)*sn, 0.25 + yBase(), z - ox*sn + (-1.35)*cs, MAT.darkWood);
      cy(0.08, 0.12, 0.4, 8, x + ox*cs + (-1.35)*sn, 0.7 + yBase(), z - ox*sn + (-1.35)*cs, MAT.gold);
      sph(0.12, x + ox*cs + (-1.35)*sn, 0.96 + yBase(), z - ox*sn + (-1.35)*cs, MAT.lamp);
    }
    addSeat(x, z, yaw, 0.82, "SLEEP", "lie");
    addCol(x, z, 1.0, 1.1, yBase(), yBase() + 1.0);   /* seat reach is 1.6 m: keep the walk-up collider inside it */
  }
  function loungeChair(x, z, yaw = 0) {
    chair(x, z, yaw, MAT.velvet);
  }
  function plant(x, z) {
    cy(0.28, 0.35, 0.6, 10, x, 0.3 + yBase(), z, MAT.pot);
    cy(0.06, 0.08, 1.6, 6, x, 1.4 + yBase(), z, MAT.wood);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const px = x + Math.cos(a) * 0.35, pz = z + Math.sin(a) * 0.35;
      sph(0.42, px, 2.4 + yBase(), pz, MAT.plant);
      sph(0.26, px + 0.1, 2.8 + yBase(), pz - 0.1, MAT.plantLt);
    }
    addCol(x, z, 0.4, 0.4, yBase(), yBase() + 3);
  }
  function staffNpc(x, z, coat) {
    cy(0.24, 0.3, 0.9, 10, x, 1.05 + yBase(), z, npcMat(coat));
    sph(0.28, x, 1.7 + yBase(), z, npcMat(0x8a5a42));
    bx(0.12, 0.16, 0.035, x + 0.12, 1.28 + yBase(), z + 0.24, MAT.screen);
  }
  function tvOnWall(x, y, z, w = 1.6, h = 0.9, ry = 0) {
    bx(w + 0.08, h + 0.08, 0.06, x, y + yBase(), z, MAT.dark, ry);
    bx(w, h, 0.02, x + Math.sin(ry)*0.05, y + yBase(), z + Math.cos(ry)*0.05, MAT.screen, ry);
  }
  function sconce(x, y, z, ry = 0) {
    bx(0.12, 0.5, 0.06, x, y + yBase(), z, MAT.gold, ry);
    bx(0.05, 0.35, 0.03, x + Math.sin(ry)*0.04, y + yBase(), z + Math.cos(ry)*0.04, MAT.lamp, ry);
  }

  /* ═══════════════════════════════════════════════════════════════════
     GROUND FLOOR
     ═══════════════════════════════════════════════════════════════════ */
  LEVEL = 0;

  /* ── floor slabs ── */
  floorSlab(0,  0, 14, 12, new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.6 }));  // concierge wood
  floorSlab(14, 0, 30, 12, MAT.marble);                                                            // lobby marble
  floorSlab(30, 0, 44, 12, MAT.marble);                                                            // reception marble
  floorSlab(0,  12, 14, 28, MAT.marbleDark);                                                       // spa stone
  floorSlab(14, 12, 30, 28, MAT.marble);                                                           // atrium marble
  floorSlab(30, 12, 44, 28, new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.75 }));  // gym dark
  floorSlab(0,  28, 22, 38, new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.65 }));  // restaurant wood
  floorSlab(22, 28, 44, 38, new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.65 }));  // bar dark wood
  floorSlab(0,  38, 44, 46, new THREE.MeshStandardMaterial({ color: 0xd0e8f0, roughness: 0.5 }));   // pool tile

  /* ── lobby floor medallion around the fountain ── */
  cy(5.2, 5.2, 0.02, 32, 22, 0.16 + yBase(), 7.5, MAT.gold);
  cy(4.6, 4.6, 0.02, 32, 22, 0.17 + yBase(), 7.5, MAT.marble);
  cy(1.8, 1.8, 0.02, 32, 22, 0.18 + yBase(), 7.5, MAT.gold);

  /* ── perimeter walls ── */
  wall(0, 0,   44, 0,   [{ at: 22, width: 4 }], MAT.wallWarm);   // south (entrance)
  wall(0, 46,  44, 46,  [], MAT.wallWarm);                       // north
  wall(0, 0,   0,  46,  [], MAT.wallWarm);                       // west
  wall(44, 0,  44, 46,  [], MAT.wallWarm);                       // east

  /* ── interior walls (ground) ── */
  wall(0, 12, 14, 12, [{ at: 6, width: 2.4 }], MAT.wall);        // concierge ↔ spa
  wall(30, 12, 44, 12, [{ at: 4, width: 2.4 }], MAT.wall);       // reception ↔ gym (door at x=34)
  wall(0, 28, 22, 28, [{ at: 10, width: 2.4 }, { at: 20, width: 2.4 }], MAT.wall); // spa/atrium ↔ restaurant
  wall(22, 28, 44, 28, [{ at: 12, width: 2.4 }], MAT.wall);      // gym ↔ bar (door at x=34)
  wall(0, 38, 22, 38, [{ at: 10, width: 2.4 }], MAT.glass);      // restaurant ↔ pool (glass)
  wall(22, 38, 44, 38, [{ at: 12, width: 2.4 }], MAT.glass);     // bar ↔ pool (glass, door at x=34)
  wall(14, 0, 14, 12, [{ at: 5, width: 2.4 }], MAT.wall);        // concierge ↔ lobby
  wall(30, 0, 30, 12, [{ at: 5, width: 2.4 }], MAT.wall);        // lobby ↔ reception
  wall(14, 12, 14, 28, [{ at: 6, width: 2.4 }], MAT.wall);       // spa ↔ atrium
  wall(30, 12, 30, 28, [{ at: 6, width: 2.4 }], MAT.wall);       // atrium ↔ gym
  wall(22, 28, 22, 38, [{ at: 6, width: 2.4 }], MAT.wallDark);   // restaurant ↔ bar

  /* ── ground-floor ceiling, open over the double-height atrium ── */
  bx(14, 0.15, 46, 7,  WH + 0.075, 23, MAT.wallWarm);   // west of atrium
  bx(14, 0.15, 46, 37, WH + 0.075, 23, MAT.wallWarm);   // east of atrium
  bx(16, 0.15, 14, 22, WH + 0.075, 7,  MAT.wallWarm);   // south of atrium
  bx(16, 0.15, 18, 22, WH + 0.075, 37, MAT.wallWarm);   // north of atrium

  /* ── wainscot + crown (lobby / reception / restaurant) ── */
  const addWainscot = (x0, z0, x1, z1) => {
    const isH = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const len = isH ? (x1 - x0) : (z1 - z0);
    const cx = (x0 + x1)/2, cz = (z0 + z1)/2;
    const ox = isH ? 0 : 0.13, oz = isH ? 0.13 : 0;
    bx(isH ? len : 0.1, 1.1, isH ? 0.1 : len, cx + ox, 0.55 + yBase(), cz + oz, MAT.wood);
    bx(isH ? len : 0.16, 0.08, isH ? 0.16 : len, cx + ox, 1.14 + yBase(), cz + oz, MAT.gold);
    bx(isH ? len : 0.16, 0.22, isH ? 0.16 : len, cx + ox, WH - 0.11 + yBase(), cz + oz, MAT.gold);
  };
  addWainscot(14, 0.1, 30, 0.1);      // lobby south
  addWainscot(0.1, 0, 0.1, 12);       // concierge west
  addWainscot(43.9, 0, 43.9, 12);     // reception east

  /* ═══════════════════════════════════════════════════════════════════
     LOBBY (x 14–30 · z 0–12) — entrance spine + centre fountain
     ═══════════════════════════════════════════════════════════════════ */
  {
    /* canopy over entrance */
    bx(6, 0.15, 2, 22, 3.6, 1.2, MAT.gold);
    bx(0.2, 3.5, 0.2, 19.2, 1.75, 0.2, MAT.gold);
    bx(0.2, 3.5, 0.2, 24.8, 1.75, 0.2, MAT.gold);

    /* red carpet runner, split around the fountain */
    bx(3.0, 0.02, 3.8, 22, 0.17, 2.9, MAT.rugRed);    // z 1 → 4.8
    bx(3.0, 0.02, 2.0, 22, 0.17, 11.0, MAT.rugRed);   // z 10 → 12

    /* doormen */
    staffNpc(19.5, 2, 0x3a2a1a);
    staffNpc(24.5, 2, 0x3a2a1a);

    /* potted palms */
    plant(16, 2.5);
    plant(28, 2.5);

    /* concierge entrance plaque */
    sign3d("CONCIERGE", 14, 2.9, 6, 2.2, 0.45, Math.PI/2, "#2a1a10");
    sign3d("RECEPTION",  30, 2.9, 6, 2.2, 0.45, -Math.PI/2, "#2a1a10");

    /* wall sconces along lobby walls */
    sconce(14.15, 2.4, 3, -Math.PI/2);
    sconce(14.15, 2.4, 9, -Math.PI/2);
    sconce(29.85, 2.4, 3, Math.PI/2);
    sconce(29.85, 2.4, 9, Math.PI/2);

    /* ── centrepiece fountain (moved out of the staircase footprint) ── */
    const fx = 22, fz = 7.5;
    cy(2.2, 2.6, 0.8, 24, fx, 0.4 + yBase(), fz, MAT.marbleDark);
    cy(2.05, 2.05, 0.12, 24, fx, 0.8 + yBase(), fz, MAT.water);
    cy(1.3, 1.6, 0.5, 20, fx, 1.25 + yBase(), fz, MAT.marble);
    cy(1.2, 1.2, 0.1, 20, fx, 1.5 + yBase(), fz, MAT.water);
    cy(0.4, 0.65, 1.3, 12, fx, 2.2 + yBase(), fz, MAT.marble);
    cy(0.75, 0.75, 0.3, 16, fx, 2.9 + yBase(), fz, MAT.marble);
    cy(0.68, 0.68, 0.06, 16, fx, 3.06 + yBase(), fz, MAT.water);
    /* statue on top */
    cy(0.12, 0.2, 0.7, 8, fx, 3.4 + yBase(), fz, MAT.gold);
    sph(0.16, fx, 3.85 + yBase(), fz, MAT.gold);
    addCol(fx, fz, 2.7, 2.7, yBase(), yBase() + 3.0);
    addUse(fx, fz, 4.0, "WISH AT FOUNTAIN", "use");

    /* granite surround */
    cy(3.0, 3.2, 0.12, 32, fx, 0.08 + yBase(), fz, MAT.marbleDark);
  }

  /* ═══════════════════════════════════════════════════════════════════
     RECEPTION (x 30–44 · z 0–12)
     ═══════════════════════════════════════════════════════════════════ */
  {
    /* curved marble counter */
    bx(6.5, 1.05, 1.1, 35, 0.55, 4.5, MAT.marble);
    bx(6.7, 0.08, 1.3, 35, 1.12, 4.5, MAT.gold);
    addCol(35, 4.5, 3.35, 0.6, 0, 1.2);
    addUse(35, 6.0, 2.5, "CHECK IN", "use");

    /* three monitors on the counter */
    for (const cx of [32.5, 35, 37.5]) {
      bx(0.6, 0.4, 0.05, cx, 1.45, 4.5, MAT.dark);
      bx(0.55, 0.35, 0.02, cx, 1.45, 4.53, MAT.screen);
      bx(0.1, 0.2, 0.1, cx, 1.2, 4.5, MAT.dark);
    }

    /* receptionist chairs */
    for (const cx of [32.5, 35, 37.5]) chair(cx, 3.0, Math.PI, MAT.leather);

    /* waiting bench row (east wall) */
    for (let i = 0; i < 3; i++) {
      const sz = 8 + i * 1.5;
      bx(0.6, 0.5, 1.4, 42.5, 0.25, sz, MAT.velvetCrm);
      bx(0.6, 0.6, 0.1, 42.9, 0.55, sz, MAT.velvetCrm);
      addSeat(42.5, sz, Math.PI/2, 0.5, "SIT", "sit");
    }
    addCol(42.5, 9, 0.35, 2.3, 0, 0.9);

    /* potted palm near entrance to reception */
    plant(31, 9.5);

    /* sign on the south wall behind the counter, facing the guests */
    sign3d("CHECK IN · 24H", 35, 3.1, 0, 3.4, 0.5, 0, "#2a1a10");

    /* receptionist */
    staffNpc(35, 2.4, 0xf0e6d2);
  }

  /* ═══════════════════════════════════════════════════════════════════
     CONCIERGE (x 0–14 · z 0–12)
     ═══════════════════════════════════════════════════════════════════ */
  {
    /* concierge desk */
    bx(3.0, 1.05, 1.2, 7, 0.55, 4.5, MAT.wood);
    bx(3.2, 0.08, 1.4, 7, 1.12, 4.5, MAT.gold);
    addCol(7, 4.5, 1.6, 0.65, 0, 1.2);
    addUse(7, 6.0, 2.0, "ASK CONCIERGE", "hotel_concierge");
    addUse(11, 9.5, 2.0, "LUGGAGE ASSISTANCE", "hotel_luggage");
    addUse(3.5, 9.5, 2.0, "VALET PARKING", "hotel_valet");

    chair(7, 3.0, Math.PI, MAT.leather);

    /* concierge wall art (gold panel) */
    bx(0.08, 1.6, 3.5, 0.12, 2.2, 6, MAT.gold);
    bx(0.06, 1.4, 3.3, 0.2, 2.2, 6, MAT.darkWood);

    /* big planters flanking */
    plant(2, 2); plant(12, 2);
    plant(2, 10.5);

    /* marble effect rug */
    rug(3, 3, 12, 9, MAT.rugCream);

    /* concierge NPC */
    staffNpc(7, 2.4, 0x2a1a10);
  }

  /* ═══════════════════════════════════════════════════════════════════
     GRAND ATRIUM (x 14–30 · z 12–28) — staircase + corner lounges
     ═══════════════════════════════════════════════════════════════════ */
  {
    /* four lounge groups flanking the grand staircase */
    sofa(16.5, 15.2, 0, 2.4, MAT.velvet);
    table(16.5, 17.3, 1.2, 0.7, 0.42, MAT.darkWood);
    loungeChair(16.5, 19.3, Math.PI);

    sofa(27.5, 15.2, 0, 2.4, MAT.velvet);
    table(27.5, 17.3, 1.2, 0.7, 0.42, MAT.darkWood);
    loungeChair(27.5, 19.3, Math.PI);

    sofa(16.5, 24.8, Math.PI, 2.4, MAT.velvetCrm);
    table(16.5, 22.7, 1.2, 0.7, 0.42, MAT.darkWood);
    loungeChair(16.5, 20.7, 0);

    sofa(27.5, 24.8, Math.PI, 2.4, MAT.velvetCrm);
    table(27.5, 22.7, 1.2, 0.7, 0.42, MAT.darkWood);
    loungeChair(27.5, 20.7, 0);

    /* plants along atrium edges */
    plant(15, 13); plant(29, 13);
    plant(15, 27); plant(29, 27);

    /* crystal chandelier hanging through the double-height void */
    cy(0.06, 0.06, 2.5, 6, 22, WH * 2 - 1.25, 20, MAT.gold);   // chain, roof → 6.5
    cy(1.5, 1.8, 0.6, 16, 22, WH + 1.7, 20, MAT.gold);         // bowl at 6.2
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = 1.5 + (i % 3) * 0.3;
      const px = 22 + Math.cos(a) * r;
      const pz = 20 + Math.sin(a) * r;
      sph(0.06, px, WH + 1.15, pz, MAT.lamp);
      bx(0.02, 0.35, 0.02, px, WH + 0.95, pz, MAT.gold);
    }

    /* chandelier point light */
    const chandLight = new THREE.PointLight(0xffe0b0, 1.2, 18, 1.8);
    chandLight.position.set(22, WH + 1.2, 20);
    scene.add(chandLight);
  }

  /* ═══════════════════════════════════════════════════════════════════
     GRAND STAIRCASE (x 20–24 · z 14–28) — in the atrium
     ═══════════════════════════════════════════════════════════════════ */
  {
    const N = 14;
    const dz = (28 - 14) / N;
    for (let i = 0; i < N; i++) {
      const h = (i + 1) * (WH / N);
      bx(4.0, h, dz + 0.02, 22, h/2 + yBase(), 14 + dz * (i + 0.5), MAT.marble);
      bx(4.02, 0.04, dz, 22, h + 0.02 + yBase(), 14 + dz * (i + 0.5) + 0.02, MAT.gold);
    }
    /* railings */
    for (const sx of [20.05, 23.95]) {
      const ang = Math.atan2(WH, 14);
      const len = Math.hypot(14, WH);
      const rail = new THREE.CylinderGeometry(0.05, 0.05, len, 8);
      rail.rotateX(Math.PI/2 - ang);
      rail.translate(sx, WH/2 + 1.0 + yBase(), 21);
      push(rail, MAT.gold);
      for (let i = 0; i <= N; i++) {
        const h = (i + 0.5) * (WH / N);
        cy(0.03, 0.03, 0.9, 6, sx, h + 0.45 + yBase(), 14 + dz * i, MAT.gold);
      }
    }
    /* collider strips aligned with the railings */
    addCol(20.0, 21, 0.25, 7, 0, WH + 2);
    addCol(24.0, 21, 0.25, 7, 0, WH + 2);
  }

  /* ═══════════════════════════════════════════════════════════════════
     SPA (x 0–14 · z 12–28)
     ═══════════════════════════════════════════════════════════════════ */
  {
    /* 2 massage tables */
    for (const tx of [4, 9]) {
      bx(1.1, 0.6, 2.2, tx, 0.3, 18, MAT.white);
      bx(1.0, 0.06, 2.0, tx, 0.63, 18, MAT.cream);
      addCol(tx, 18, 0.6, 1.15, 0, 0.7);
      addUse(tx, 20, 1.8, "MASSAGE", "use");
      addSeat(tx, 18, 0, 0.65, "LIE ON MASSAGE TABLE", "lie");
    }

    /* hot tub (round) */
    cy(1.7, 1.8, 0.6, 16, 4, 0.3, 24.5, MAT.marbleDark);
    cy(1.5, 1.5, 0.1, 16, 4, 0.62, 24.5, MAT.water);
    addCol(4, 24.5, 1.8, 1.8, 0, 0.7);
    addUse(4, 24.5, 2.5, "SOAK IN HOT TUB", "bath");

    /* yoga mats */
    for (const mx of [9.5, 11, 12.5]) {
      bx(0.6, 0.03, 1.5, mx, 0.18, 24, MAT.plant);
      addSeat(mx, 24, 0, 0.05, "DO YOGA", "lie");
    }

    /* relaxation chairs */
    loungeChair(12, 14, -Math.PI/2);
    loungeChair(12, 16, -Math.PI/2);

    /* spa sign */
    sign3d("SPA", 14, 3.1, 18, 1.8, 0.6, -Math.PI/2, "#2a1a10");
    sconce(0.15, 2.5, 16, Math.PI/2);
    sconce(0.15, 2.5, 22, Math.PI/2);
    sconce(0.15, 2.5, 28, Math.PI/2);

    staffNpc(5.5, 14.5, 0x33434a);
    staffNpc(10.5, 14.5, 0x33434a);
  }

  /* ═══════════════════════════════════════════════════════════════════
     GYM (x 30–44 · z 12–28)
     ═══════════════════════════════════════════════════════════════════ */
  {
    /* 2 treadmills */
    for (const tx of [33, 36]) {
      bx(1.2, 0.2, 2.4, tx, 0.1, 18, MAT.dark);
      bx(1.0, 0.1, 2.2, tx, 0.25, 18, MAT.chrome);
      bx(0.1, 1.6, 0.1, tx, 0.9, 16.9, MAT.dark);
      bx(1.2, 0.1, 0.3, tx, 1.7, 16.9, MAT.dark);
      addCol(tx, 18, 0.65, 1.25, 0, 1.8);
      addUse(tx, 19.8, 1.8, "RUN ON TREADMILL", "run");
    }
    /* 2 weight benches */
    for (const bx0 of [40, 42]) {
      bx(0.8, 0.15, 1.8, bx0, 0.5, 20, MAT.dark);
      bx(0.6, 0.15, 0.6, bx0, 0.65, 19.3, MAT.dark);
      addCol(bx0, 20, 0.5, 0.95, 0, 0.8);
      addUse(bx0, 21.5, 1.25, "LIFT WEIGHTS", "lift");
    }
    /* dumbbell rack */
    bx(0.5, 1.4, 3.0, 42.5, 0.7, 25, MAT.dark);
    for (let i = 0; i < 6; i++) {
      sph(0.09, 42.6, 0.5 + (i%3)*0.4, 24 + Math.floor(i/3), MAT.chrome);
    }
    addCol(42.5, 25, 0.35, 1.5, 0, 1.4);

    /* mirror wall (visual) */
    bx(0.05, 2.6, 12, 30.1, 1.3, 20, MAT.chrome);

    /* gym sign */
    sign3d("GYM", 30, 3.1, 18, 1.8, 0.6, Math.PI/2, "#2a1a10");

    staffNpc(33, 24, 0x22262c);
    staffNpc(40, 24, 0x22262c);
  }

  /* ═══════════════════════════════════════════════════════════════════
     RESTAURANT (x 0–22 · z 28–38)
     ═══════════════════════════════════════════════════════════════════ */
  {
    /* 6 tables with 4 chairs each */
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        const tx = 4 + i * 6;
        const tz = 31 + j * 4;
        table(tx, tz, 1.4, 1.4, 0.78, MAT.cream);
        /* white tablecloth */
        bx(1.4, 0.02, 1.4, tx, 0.79 + yBase(), tz, MAT.white);
        addUse(tx, tz, 2.0, "ORDER FOOD", "cook");
        for (const [cx, cz, cyaw] of [
          [tx - 1.1, tz, Math.PI/2], [tx + 1.1, tz, -Math.PI/2],
          [tx, tz - 1.1, 0], [tx, tz + 1.1, Math.PI],
        ]) {
          chair(cx, cz, cyaw, MAT.velvetRed);
        }
      }
    }
    /* pendant lights over tables */
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        const tx = 4 + i * 6;
        const tz = 31 + j * 4;
        cy(0.02, 0.02, 1.2, 4, tx, WH - 0.6 + yBase(), tz, MAT.dark);
        cy(0.25, 0.4, 0.3, 12, tx, WH - 1.3 + yBase(), tz, MAT.lamp);
      }
    }
    /* wine rack */
    bx(6.0, 2.4, 0.5, 18.5, 1.2, 28.3, MAT.darkWood);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      cy(0.05, 0.05, 0.25, 6, 16 + c*0.45, 0.8 + r*0.6, 28.3, [MAT.velvetRed, MAT.gold, MAT.darkWood][(r+c)%3]);
    }
    addCol(18.5, 28.3, 3.05, 0.3, 0, 2.4);

    /* sign on the north wall of the restaurant, clear of the door */
    sign3d("FINE DINING", 16, 3.1, 28, 3.0, 0.6, 0, "#2a1a10");

    staffNpc(12, 30, 0x2a1a10);
    staffNpc(9, 35, 0x2a1a10);
  }

  /* ═══════════════════════════════════════════════════════════════════
     SKY BAR (x 22–44 · z 28–38)
     ═══════════════════════════════════════════════════════════════════ */
  {
    /* long counter */
    bx(8.0, 1.05, 1.3, 33, 0.55, 30.5, MAT.darkWood);
    bx(8.2, 0.08, 1.5, 33, 1.12, 30.5, MAT.gold);
    addCol(33, 30.5, 4.1, 0.65, 0, 1.2);
    addUse(33, 32.5, 2.5, "ORDER DRINK", "cook");

    /* bar stools */
    for (let i = 0; i < 8; i++) {
      const sx = 29 + i * 1.1;
      bx(0.35, 0.08, 0.35, sx, 0.72, 32.2, MAT.leather);
      cy(0.04, 0.04, 0.72, 6, sx, 0.36, 32.2, MAT.gold);
      bx(0.28, 0.04, 0.28, sx, 0.02, 32.2, MAT.gold);
      addSeat(sx, 32.2, 0, 0.76, "SIT AT BAR", "sit");
    }

    /* back bar shelf with bottles */
    bx(8.0, 0.05, 0.35, 33, 2.1, 28.4, MAT.wood);
    for (let i = 0; i < 14; i++) {
      const bottleM = [MAT.velvetRed, MAT.gold, MAT.darkWood][i % 3];
      cy(0.05, 0.06, 0.28, 6, 29.5 + i * 0.55, 2.25, 28.4, bottleM);
    }

    /* cocktail tables */
    for (const [tx, tz] of [[26, 36], [34, 36], [40, 36]]) {
      cy(0.4, 0.5, 0.06, 12, tx, 0.78, tz, MAT.cream);
      cy(0.06, 0.08, 0.75, 6, tx, 0.4, tz, MAT.gold);
      addCol(tx, tz, 0.55, 0.55, 0, 0.85);
      for (const [cx, cz] of [[tx - 0.75, tz], [tx + 0.75, tz]]) {
        bx(0.4, 0.5, 0.4, cx, 0.25, cz, MAT.leather);
        addSeat(cx, cz, Math.PI/2, 0.5, "SIT", "sit");
      }
    }

    /* neon-style sign */
    sign3d("SKY BAR", 33, 3.1, 28, 3.0, 0.6, 0, "#2a1a10");

    staffNpc(30, 30, 0x3a2010);
    staffNpc(36, 30, 0x3a2010);
  }

  /* ═══════════════════════════════════════════════════════════════════
     GARDEN POOL TERRACE (x 0–44 · z 38–46) — glass roof
     ═══════════════════════════════════════════════════════════════════ */
  {
    /* main pool */
    bx(14, 0.4, 6, 22, 0.2, 42, MAT.marbleDark);
    bx(13.5, 0.05, 5.5, 22, 0.42, 42, MAT.water);
    addCol(22, 42, 7.2, 3.2, 0, 0.5);
    addUse(22, 42, 8.0, "SWIM", "swim");

    /* lane markers on pool floor */
    for (let i = 0; i < 4; i++) {
      bx(13.0, 0.01, 0.05, 22, 0.4, 39 + i * 1.6, MAT.white);
    }

    /* sun loungers */
    for (const lx of [6, 8, 10, 36, 38, 40]) {
      const lz = 44;
      bx(0.6, 0.15, 1.6, lx, 0.28, lz, MAT.cream);
      bx(0.6, 0.5, 0.1, lx, 0.55, lz + 0.75, MAT.white);
      bx(0.55, 0.04, 1.5, lx, 0.4, lz, MAT.velvetCrm);
      for (const [ox, oz] of [[-0.25,-0.7],[0.25,-0.7],[-0.25,0.7],[0.25,0.7]]) {
        bx(0.06, 0.28, 0.06, lx+ox, 0.14, lz+oz, MAT.gold);
      }
      addSeat(lx, lz, Math.PI, 0.42, "LOUNGE BY POOL", "sit");
      addCol(lx, lz, 0.4, 0.85, 0, 0.65);
    }

    /* parasols */
    for (const [px, pz] of [[6, 43], [10, 43], [36, 43], [40, 43]]) {
      cy(0.05, 0.05, 2.4, 6, px, 1.2, pz, MAT.gold);
      cy(1.3, 1.3, 0.06, 16, px, 2.4, pz, MAT.white);
    }

    /* poolside bar */
    bx(4.0, 0.9, 0.9, 14, 0.45, 40, MAT.wood);
    bx(4.2, 0.06, 1.0, 14, 0.93, 40, MAT.gold);
    addCol(14, 40, 2.1, 0.5, 0, 1.0);
    addUse(14, 41, 1.6, "ORDER COCKTAIL", "cook");

    /* lifeguard chair */
    bx(0.6, 1.2, 0.6, 30, 0.6, 40, MAT.wood);
    addCol(30, 40, 0.35, 0.35, 0, 1.2);

    staffNpc(30, 40, 0xf0e6d2);   // lifeguard
    staffNpc(14, 40, 0x2a1a10);   // bartender
  }

  /* ═══════════════════════════════════════════════════════════════════
     ELEVATORS (x 38, 41 · z 11.9) — ground + upper
     ═══════════════════════════════════════════════════════════════════ */
  {
    for (const ex of [38, 41]) {
      /* gold doors */
      bx(1.8, 2.8, 0.1, ex, 1.4 + yBase(), 11.9, MAT.gold);
      bx(1.7, 0.1, 0.12, ex, 2.85 + yBase(), 11.85, MAT.brass);
      /* wall plaque */
      bx(0.7, 0.12, 0.06, ex, 3.1 + yBase(), 11.85, MAT.lamp);
      addCol(ex, 11.9, 0.95, 0.1, 0, 3.0);
      addUse(ex, 11.2, 1.5, "CALL ELEVATOR", "elevator");
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     UPPER FLOOR
     ═══════════════════════════════════════════════════════════════════ */
  LEVEL = 1;

  /* floor slabs — the south strip runs all the way to the atrium edge */
  floorSlab(0, 0, 44, 14, MAT.marble);
  floorSlab(0, 14, 14, 28, MAT.marble);
  floorSlab(30, 14, 44, 28, MAT.marble);
  floorSlab(0, 28, 44, 46, MAT.marble);

  /* roof, with a glazed opening over the double-height atrium */
  bx(14, 0.15, 46, 7,  WH*2 + 0.075, 23, MAT.wallWarm);
  bx(14, 0.15, 46, 37, WH*2 + 0.075, 23, MAT.wallWarm);
  bx(16, 0.15, 14, 22, WH*2 + 0.075, 7,  MAT.wallWarm);
  bx(16, 0.15, 18, 22, WH*2 + 0.075, 37, MAT.wallWarm);
  bx(16, 0.06, 14, 22, WH*2 + 0.12, 21, MAT.skylight);

  /* ── perimeter (upper) ── */
  wall(0, 0,   44, 0,   [], MAT.wallWarm);
  wall(0, 46,  44, 46,  [], MAT.wallWarm);
  wall(0, 0,   0,  46,  [], MAT.wallWarm);
  wall(44, 0,  44, 46,  [], MAT.wallWarm);

  /* ── interior walls (upper) ── */
  wall(0, 10, 44, 10, [{ at: 6, width: 2.4 }, { at: 30, width: 2.4 }], MAT.wall); // corridor south
  wall(0, 32, 44, 32, [
    { at: 5,  width: 2.0 }, { at: 16, width: 2.0 },
    { at: 27, width: 2.0 }, { at: 38, width: 2.0 },
  ], MAT.wall);   // suites entrances
  wall(11, 32, 11, 46, [], MAT.wall);
  wall(22, 32, 22, 46, [], MAT.wall);
  wall(33, 32, 33, 46, [], MAT.wall);
  wall(14, 0, 14, 10, [{ at: 5, width: 2.4 }], MAT.wall);   // VIP ↔ ballroom

  /* ── balustrades around atrium void (gold railings, not solid walls) ── */
  function balustrade(x0, z0, x1, z1) {
    const len = Math.hypot(x1-x0, z1-z0);
    const dx = (x1-x0)/len, dz = (z1-z0)/len;
    const n = Math.max(3, Math.round(len / 1.2));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = x0 + dx * t * len;
      const pz = z0 + dz * t * len;
      cy(0.04, 0.04, 1.0, 6, px, 0.5 + yBase(), pz, MAT.gold);
    }
    /* top rail — rotate the x-aligned cylinder onto (dx,0,dz) */
    const rail = new THREE.CylinderGeometry(0.06, 0.06, len, 8);
    rail.rotateZ(Math.PI/2);
    rail.rotateY(Math.atan2(-dz, dx));
    rail.translate((x0+x1)/2, 1.02 + yBase(), (z0+z1)/2);
    push(rail, MAT.gold);
  }
  balustrade(14, 14, 20, 14);   // south edge west of stairs
  balustrade(24, 14, 30, 14);   // south edge east of stairs
  balustrade(14, 28, 20, 28);   // north edge west
  balustrade(24, 28, 30, 28);   // north edge east
  balustrade(14, 14, 14, 28);   // west edge
  balustrade(30, 14, 30, 28);   // east edge
  balustrade(20, 14, 24, 14);   // rail across the stair BOTTOM on this floor (was an open drop onto the stairs)

  /* solid guards matching the railings (level 1). The north gap x 20-24 at z=28 stays open: it is the stair's top arrival. */
  {
    const gy0 = yBase(), gy1 = yBase() + 1.1, t = 0.12;
    addCol(17, 14, 3.0, t, gy0, gy1);      // south edge, west of stairs
    addCol(27, 14, 3.0, t, gy0, gy1);      // south edge, east of stairs
    addCol(22, 14, 2.0, t, gy0, gy1);      // across the stair bottom
    addCol(17, 28, 3.0, t, gy0, gy1);      // north edge, west of stairs
    addCol(27, 28, 3.0, t, gy0, gy1);      // north edge, east of stairs
    addCol(14, 21, t, 7.0, gy0, gy1);      // west edge
    addCol(30, 21, t, 7.0, gy0, gy1);      // east edge
    addCol(20, 21, t, 7.0, gy0, gy1);      // stair side (upper half) - no sideways step-off
    addCol(24, 21, t, 7.0, gy0, gy1);
  }

  /* ── south corridor wall art ── */
  for (const px of [2, 8, 36, 42]) {
    bx(0.06, 1.4, 2.5, px, 2.0 + yBase(), 10.1, MAT.darkWood);
    bx(0.04, 1.2, 2.3, px + 0.02, 2.0 + yBase(), 10.1, MAT.lamp);
  }

  /* ── upper-floor elevator bank (freestanding in the south corridor) ── */
  {
    bx(6.4, 3.0, 0.4, 39.5, 1.5 + yBase(), 11.95, MAT.gold);
    bx(6.6, 0.12, 0.5, 39.5, 3.06 + yBase(), 11.95, MAT.brass);
    for (const ex of [38, 41]) {
      bx(1.8, 2.8, 0.05, ex, 1.4 + yBase(), 12.17, MAT.brass);
      bx(1.8, 2.8, 0.05, ex, 1.4 + yBase(), 11.73, MAT.brass);
      bx(0.7, 0.12, 0.06, ex, 3.1 + yBase(), 12.18, MAT.lamp);
      bx(0.7, 0.12, 0.06, ex, 3.1 + yBase(), 11.72, MAT.lamp);
    }
    addCol(39.5, 11.95, 3.2, 0.2, yBase(), yBase() + 3.1);
    addUse(39.5, 13.1, 1.6, "CALL ELEVATOR", "elevator");
    addUse(39.5, 10.8, 1.6, "CALL ELEVATOR", "elevator");
  }

  /* ── VIP LOUNGE (x 0–22 · z 0–10) ── */
  {
    rug(3, 2, 19, 8, MAT.rugRed);

    sofa(7, 5, 0, 3.0, MAT.velvetRed);
    sofa(15, 5, 0, 3.0, MAT.velvetRed);
    loungeChair(3, 5, Math.PI/2);
    loungeChair(19, 5, -Math.PI/2);

    table(11, 5, 2.0, 1.0, 0.42, MAT.darkWood);
    /* drinks tray */
    bx(0.5, 0.05, 0.3, 11, 0.6 + yBase(), 5, MAT.gold);
    for (let i = 0; i < 3; i++) cy(0.04, 0.05, 0.15, 6, 10.8 + i*0.2, 0.68 + yBase(), 5, MAT.gold);

    /* bar cart */
    bx(1.2, 1.0, 0.6, 20, 0.5 + yBase(), 2, MAT.gold);
    for (let i = 0; i < 6; i++) {
      cy(0.04, 0.05, 0.2, 6, 19.5 + (i%3)*0.3, 1.15 + yBase(), 2 + Math.floor(i/3)*0.25, MAT.wood);
    }
    addCol(20, 2, 0.65, 0.35, yBase(), yBase() + 1.0);

    /* chandelier */
    cy(0.05, 0.05, 0.9, 6, 11, WH - 0.5 + yBase(), 5, MAT.gold);
    cy(1.0, 1.2, 0.4, 12, 11, WH - 1.1 + yBase(), 5, MAT.gold);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      sph(0.05, 11 + Math.cos(a)*1.0, WH - 1.3 + yBase(), 5 + Math.sin(a)*1.0, MAT.lamp);
    }

    sign3d("VIP LOUNGE", 11, 3.0, 10, 2.6, 0.55, Math.PI, "#2a1a10");

    staffNpc(4, 2, 0x8a2a2f);
  }

  /* ── GRAND BALLROOM (x 22–44 · z 0–10) ── */
  {
    /* central table */
    bx(8.0, 0.12, 3.0, 33, 0.9 + yBase(), 5, MAT.wood);
    bx(8.2, 0.08, 3.2, 33, 0.98 + yBase(), 5, MAT.gold);
    addCol(33, 5, 4.1, 1.6, yBase(), yBase() + 1.0);

    /* chairs around */
    for (let i = 0; i < 4; i++) {
      const cx = 29 + i * 2.5;
      chair(cx, 3, 0, MAT.velvetRed);
      chair(cx, 7, Math.PI, MAT.velvetRed);
    }

    /* stage at north end */
    bx(10, 0.5, 2.0, 33, 0.25 + yBase(), 1.5, MAT.darkWood);
    bx(10.2, 0.1, 2.2, 33, 0.52 + yBase(), 1.5, MAT.gold);
    addCol(33, 1.5, 5.1, 1.1, yBase(), yBase() + 0.6);

    /* chandeliers row */
    for (const cx of [27, 33, 39]) {
      cy(0.05, 0.05, 1.0, 6, cx, WH - 0.5 + yBase(), 5, MAT.gold);
      cy(0.9, 1.1, 0.5, 12, cx, WH - 1.3 + yBase(), 5, MAT.gold);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        sph(0.06, cx + Math.cos(a)*0.85, WH - 1.5 + yBase(), 5 + Math.sin(a)*0.85, MAT.lamp);
      }
    }

    sign3d("GRAND BALLROOM", 33, 3.0, 10, 3.2, 0.55, Math.PI, "#2a1a10");
  }

  /* ── SUITES (4 rooms, z 32–46) ── */
  const SUITE_NAMES = ["ROYAL SUITE", "PRESIDENTIAL SUITE", "DELUXE SUITE", "EXECUTIVE SUITE"];
  const suiteRanges = [[0, 11], [11, 22], [22, 33], [33, 44]];
  suiteRanges.forEach(([x0, x1], i) => {
    const cx = (x0 + x1) / 2;
    /* rug */
    rug(x0 + 1, 34, x1 - 1, 44, MAT.rugCream);

    /* bed against north wall (z=45) */
    bed(cx, 43, Math.PI);

    /* wardrobe on the divider wall */
    if (i < 3) {
      bx(0.6, 2.2, 2.2, x1 - 0.6, 1.1 + yBase(), 40, MAT.darkWood);
      addCol(x1 - 0.6, 40, 0.35, 1.15, yBase(), yBase() + 2.2);
    } else {
      bx(0.6, 2.2, 2.2, x0 + 0.6, 1.1 + yBase(), 40, MAT.darkWood);
      addCol(x0 + 0.6, 40, 0.35, 1.15, yBase(), yBase() + 2.2);
    }

    /* sitting area */
    const sz = 36;
    sofa(cx - 2.0, sz, 0, 1.8, MAT.velvet);
    loungeChair(cx + 2.0, sz, 0);
    table(cx, sz, 1.2, 0.7, 0.42, MAT.darkWood);

    /* writing desk */
    bx(1.6, 0.75, 0.7, x0 + 2, 0.4 + yBase(), 34, MAT.darkWood);
    bx(1.7, 0.06, 0.8, x0 + 2, 0.78 + yBase(), 34, MAT.gold);
    addCol(x0 + 2, 34, 0.85, 0.4, yBase(), yBase() + 0.85);
    chair(x0 + 2, 35, Math.PI, MAT.leather);

    /* TV on the corridor wall, screen facing into the suite */
    tvOnWall(cx, 2.0, 32.2, 1.6, 0.9, 0);

    /* minibar */
    bx(1.2, 0.9, 0.5, x1 - 2, 0.45 + yBase(), 32.4, MAT.darkWood);
    addCol(x1 - 2, 32.4, 0.65, 0.3, yBase(), yBase() + 0.9);
    bx(1.0, 0.4, 0.02, x1 - 2, 0.65 + yBase(), 32.66, MAT.screen);

    /* bathroom block (corner) */
    const bathX = i < 2 ? x1 - 2.5 : x0 + 2.5;
    bx(1.6, 0.8, 1.6, bathX, 0.4 + yBase(), 44, MAT.marble);
    bx(1.4, 0.05, 1.4, bathX, 0.82 + yBase(), 44, MAT.water);
    addCol(bathX, 44, 0.85, 0.85, yBase(), yBase() + 0.85);

    /* room service tablet — mounted on the corridor wall, facing the room */
    bx(0.4, 0.6, 0.08, cx + 3.2, 1.3 + yBase(), 32.2, MAT.dark);
    bx(0.34, 0.5, 0.02, cx + 3.2, 1.3 + yBase(), 32.25, MAT.screen);
    addUse(cx + 3.2, 33.2, 1.6, "ROOM TABLET", "hotel_services", { tab: "room", level: 1 });

    /* suite sign, in the corridor, above the door */
    sign3d(SUITE_NAMES[i], cx, 3.0, 32, 2.4, 0.5, Math.PI, "#2a1a10");

    /* plants */
    plant(x0 + 1.5, 44.5);
  });

  /* ═══════════════════════════════════════════════════════════════════
     MERGE BATCHES → render meshes
     ═══════════════════════════════════════════════════════════════════ */
  for (const [m, geos] of BUCKETS) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, m);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
  }

  /* ═══════════════════════════════════════════════════════════════════
     WORLD CONFIG
     ═══════════════════════════════════════════════════════════════════ */
  const world = {
    colliders, seats, uses,
    stairs: [{
      minX: 20.0, maxX: 24.0, minZ: 14.0, maxZ: 28.0,
      axis: "z", y0: 0, y1: WH, level: 0, toLevel: 1,
    }],
    platforms: [
      { level: 1, minX: 0,  maxX: 44, minZ: 0,  maxZ: 14 },
      { level: 1, minX: 0,  maxX: 14, minZ: 14, maxZ: 28 },
      { level: 1, minX: 30, maxX: 44, minZ: 14, maxZ: 28 },
      { level: 1, minX: 0,  maxX: 44, minZ: 28, maxZ: 46 },
    ],
    levelHeight: (lv) => lv * WH,
    ceilingHeight: WH,
    bounds: { minX: 0.8, maxX: 43.2, minZ: 0.8, maxZ: 45.2 },
  };

  const SPAWN = { x: 22, z: 3.0, yaw: 0 };

  /* ── cinematic path (no controls) ── */
  if (!ThirdPersonControls) {
    return {
      three: scene, camera,
      controls: { update: () => {} },
      crumb: "HOTEL PRESIDENTIAL",
      title: "5\u2605 PREMIUM",
      subtitle: "",
      hint: "",
      isInterior: true,
      sceneId: "hotel",
      update: () => {},
      dispose: () => {},
    };
  }

  /* ── controls ── */
  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, world, {
    scene, x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw, level: 0,
    onUse: (u) => {
      const toast = (m) => window.__ph3d_phone && window.__ph3d_phone._toast && window.__ph3d_phone._toast(m);
      switch (u.kind) {
        case "elevator":         openHotelElevator(ctl); return;
        case "hotel_concierge":  openHotelBooking(); return;
        case "hotel_services":
          if (HotelGuestServices && HotelGuestServices.open)
            HotelGuestServices.open(u.data && u.data.tab || "room");
          else toast("Room services are unavailable right now.");
          return;
        case "hotel_luggage":    toast("Concierge: Your luggage will be brought to your room."); return;
        case "hotel_valet":      toast("Valet: Your vehicle is being retrieved."); return;
        case "run":              toast("You complete a 5 km run."); return;
        case "lift":             toast("You finish a set of lifts."); return;
        case "bath":             toast("You soak in the hot tub."); return;
        case "swim":             toast("You swim a few laps."); return;
        case "cook":             toast(u.label || "ORDER"); return;
        default:                 toast(u.label || "USE"); return;
      }
    },
  });

  /* guest services: resume staff routes on entry, clean the panel up on exit (as the previous hotel did) */
  try { if (HotelGuestServices && HotelGuestServices.init) HotelGuestServices.init(scene, ctl); } catch (_) {}

  /* ── return the interior ── */
  let lastLevel = 0;
  return {
    three: scene, camera,
    controls: { update: () => {} },
    crumb: "HOTEL PRESIDENTIAL",
    title: "5\u2605 PREMIUM",
    subtitle: "",
    hint: "CHECK IN AT RECEPTION \u00b7 GRAND STAIRCASE OR ELEVATORS TO VIP & SUITES \u00b7 E: INTERACT",
    isInterior: true,
    sceneId: "hotel",
    update: (dt) => {
      ctl.update(dt);
      if (ctl.level !== lastLevel) {
        lastLevel = ctl.level;
        if (window.__ph3d_phone) window.__ph3d_phone._toast(lastLevel === 1 ? "\u2b50 VIP FLOOR" : "\ud83c\udfe8 LOBBY");
      }
    },
    dispose: () => {
      try { if (HotelGuestServices && HotelGuestServices.dispose) HotelGuestServices.dispose(); } catch (_) {}
      ctl.dispose();
    },
  };
}
