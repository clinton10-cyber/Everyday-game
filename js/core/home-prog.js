/* ═══════════════════════════════════════════════════════════════════════
   home-prog.js — the home is a PROGRESSION system, not a given.

   • Every NEW player's home starts EMPTY (walls, floors, bathroom fittings only).
   • Existing players keep the home they already have (state.legacyHome).
   • Furniture is bought (Life app → Home) or earned as wedding gifts. Each piece
     lives in a fixed slot (room + wall position) so it never blocks a doorway;
     beds / sofas / TV / cooker register the same sit · lie · watch · cook
     interactions the old furniture had.
   • Photos you PIN in the 3D album hang as frames in the entry hall.
   • The family lives here: the married spouse (stays home while pregnant — belly
     grows by trimester), kids, and infants (carried or in the cot).
   ═══════════════════════════════════════════════════════════════════════ */
import * as THREE from "three";
import { Lives } from "./npc-lives.js";
import { NPCs } from "./npcs.js";
import { Economy } from "./economy.js";
import { Photos } from "./photos.js";
import { Belly, Baby, buildBaby } from "./body-attach.js";

const LS = () => window.__ph3d_lifesim;
const lmat = (c) => new THREE.MeshLambertMaterial({ color: c });
function bx(g, w, h, d, x, y, z, c) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lmat(c)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; }
function cyl(g, rt, rb, h, x, y, z, c) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 12), lmat(c)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; }

/* slot: where it goes (relative to its room), how it looks, what it lets you do */
export const SLOTS = [
  { id: "bed_master", room: "bedroomA", name: "Master bed", price: 180000, icon: "🛏", at: (r) => ({ x: r.x + r.w / 2, z: r.z + 1.5 }),
    build(g) { bx(g, 2.0, 0.35, 2.2, 0, 0.2, 0, 0x5a3a28); bx(g, 1.9, 0.22, 2.1, 0, 0.47, 0.02, 0xf0e8dc); bx(g, 2.0, 1.0, 0.12, 0, 0.8, -1.05, 0x4a2f20); bx(g, 0.6, 0.14, 0.4, -0.45, 0.65, -0.7, 0xffffff); bx(g, 0.6, 0.14, 0.4, 0.45, 0.65, -0.7, 0xffffff); },
    seat: { type: "lie", label: "SLEEP", dx: 0, dz: -1, h: 0.74 } },
  { id: "wardrobe_master", room: "bedroomA", name: "Wardrobe", price: 150000, icon: "🚪", at: (r) => ({ x: r.x + 0.55, z: r.z + r.d / 2 + 2.5 }),
    build(g) { bx(g, 0.7, 2.3, 2.2, 0, 1.15, 0, 0x6b4a32); bx(g, 0.04, 2.0, 0.04, 0.37, 1.15, 0, 0xd4af37); } },
  { id: "cot", room: "bedroomB", name: "Baby cot", price: 120000, icon: "🍼", at: (r) => ({ x: r.x + r.w / 2, z: r.z + 1.0 }),
    build(g) { bx(g, 1.0, 0.1, 1.5, 0, 0.45, 0, 0x8a6a4a); for (const s of [-1, 1]) { bx(g, 0.05, 0.55, 1.5, 0.5 * s, 0.75, 0, 0xe8d8b8); } bx(g, 1.0, 0.55, 0.05, 0, 0.75, -0.75, 0xe8d8b8); bx(g, 1.0, 0.55, 0.05, 0, 0.75, 0.75, 0xe8d8b8); bx(g, 0.92, 0.1, 1.4, 0, 0.56, 0, 0xcfe8ff); } },
  { id: "bed_guest", room: "bedroomC", name: "Guest bed", price: 110000, icon: "🛏", at: (r) => ({ x: r.x + r.w / 2, z: r.z + 1.4 }),
    build(g) { bx(g, 1.5, 0.3, 2.0, 0, 0.18, 0, 0x5a4a38); bx(g, 1.4, 0.2, 1.9, 0, 0.42, 0, 0xe3ecf2); bx(g, 0.5, 0.12, 0.35, 0, 0.58, -0.7, 0xffffff); },
    seat: { type: "lie", label: "SLEEP", dx: 0, dz: -1, h: 0.7 } },
  { id: "sofa", room: "living", name: "Sofa set", price: 250000, icon: "🛋", at: (r) => ({ x: r.x + r.w / 2, z: r.z + r.d / 2 + 0.6 }),
    build(g) { bx(g, 2.6, 0.45, 0.95, 0, 0.25, 0, 0x2f4a6b); bx(g, 2.6, 0.55, 0.22, 0, 0.7, -0.4, 0x27405c); bx(g, 0.22, 0.4, 0.95, -1.3, 0.5, 0, 0x27405c); bx(g, 0.22, 0.4, 0.95, 1.3, 0.5, 0, 0x27405c); bx(g, 1.2, 0.08, 0.6, 0, 0.45, 1.6, 0x6b4a32); },
    seat: { type: "sit", label: "SIT", dx: 0, dz: 1, h: 0.55 } },
  { id: "tv", room: "living", name: "TV & stand", price: 320000, icon: "📺", at: (r) => ({ x: r.x + r.w / 2, z: r.z + r.d - 0.6 }),
    build(g) { bx(g, 2.1, 0.55, 0.5, 0, 0.28, 0, 0x2a2420); bx(g, 1.6, 0.9, 0.06, 0, 1.0, 0, 0x0a0c10); bx(g, 1.5, 0.8, 0.02, 0, 1.0, -0.035, 0x2a6f9a); },
    use: { kind: "watch", label: "WATCH TV", ox: 0, oz: -2.2 } },
  { id: "rug", room: "living", name: "Rug", price: 40000, icon: "🟫", at: (r) => ({ x: r.x + r.w / 2, z: r.z + r.d / 2 + 2.2 }),
    build(g) { bx(g, 3.4, 0.02, 2.4, 0, 0.012, 0, 0x8a3b3b); bx(g, 3.0, 0.022, 2.0, 0, 0.014, 0, 0xc9a24a); } },
  { id: "plant", room: "living", name: "House plant", price: 12000, icon: "🪴", at: (r) => ({ x: r.x + 0.7, z: r.z + r.d - 0.7 }),
    build(g) { cyl(g, 0.22, 0.17, 0.4, 0, 0.2, 0, 0x9a5b3a); const s = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), lmat(0x2f7a3a)); s.position.y = 0.85; g.add(s); } },
  { id: "cooker", room: "kitchen", name: "Gas cooker", price: 220000, icon: "🍳", at: (r) => ({ x: r.x + r.w / 2 - 2.2, z: r.z + r.d - 0.6 }),
    build(g) { bx(g, 0.95, 0.9, 0.7, 0, 0.45, 0, 0xcfd3d8); for (const x of [-0.22, 0.22]) for (const z of [-0.15, 0.15]) cyl(g, 0.1, 0.1, 0.03, x, 0.92, z, 0x222222); },
    use: { kind: "cook", label: "COOK", ox: 0, oz: -1.2 } },
  { id: "fridge", room: "kitchen", name: "Fridge-freezer", price: 400000, icon: "🧊", at: (r) => ({ x: r.x + r.w / 2 + 2.4, z: r.z + r.d - 0.6 }),
    build(g) { bx(g, 0.9, 1.95, 0.75, 0, 0.98, 0, 0xe8edf1); bx(g, 0.03, 0.5, 0.03, 0.36, 1.3, -0.4, 0x888888); } },
  { id: "dining", room: "kitchen", name: "Dining set", price: 280000, icon: "🍽", at: (r) => ({ x: r.x + r.w / 2, z: r.z + r.d / 2 - 0.8 }),
    build(g) { bx(g, 1.9, 0.08, 1.0, 0, 0.76, 0, 0x6b4a32); for (const x of [-0.8, 0.8]) for (const z of [-0.4, 0.4]) bx(g, 0.07, 0.72, 0.07, x, 0.38, z, 0x4a3222); for (const x of [-0.5, 0.5]) for (const z of [-0.85, 0.85]) bx(g, 0.42, 0.45, 0.42, x, 0.24, z, 0x7a5a3c); } },
  { id: "bookshelf", room: "library", name: "Bookshelf", price: 90000, icon: "📚", at: (r) => ({ x: r.x + r.w - 0.5, z: r.z + r.d / 2 + 2.0 }),
    build(g) { bx(g, 0.45, 2.2, 3.0, 0, 1.1, 0, 0x5a4030); for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) bx(g, 0.3, 0.38, 0.22, 0.04, 0.35 + i * 0.5, -1.2 + j * 0.34, [0x8c3b3b, 0x2f5d6b, 0x6b5b2f, 0x3b6b3f][(i + j) % 4]); } },
];
const BATH = /^bath/;

export const HomeProg = {
  slots: SLOTS,
  ctx: null,
  /* a NEW player's home is empty; existing players keep theirs */
  empty() { const L = LS(); return !!L && !L.state.legacyHome; },
  owned(id) { const L = LS(); return !L || !L.state.home.owned[id]; },
  has(id) { const L = LS(); return !!(L && L.state.home.owned[id]); },
  ownedCount() { const L = LS(); return L ? Object.keys(L.state.home.owned).length : 0; },

  buy(id) {
    const L = LS(), s = SLOTS.find((x) => x.id === id); if (!L || !s) return false;
    if (this.has(id)) return false;
    if (!Economy.withdraw || !Economy.withdraw(s.price)) { L.toast("Not enough money for the " + s.name); return false; }
    L.state.home.owned[id] = true; L.save();
    L.toast(s.icon + " " + s.name + " bought · −₦" + s.price.toLocaleString() + " — delivered to your home");
    if (this.ctx) this._addItem(s);
    return true;
  },
  gift(ids) {
    const L = LS(); if (!L) return [];
    const got = [];
    for (const id of ids) { if (!L.state.home.owned[id] && SLOTS.find((s) => s.id === id)) { L.state.home.owned[id] = true; got.push(id); } }
    L.save(); return got;
  },

  /* remove the factory furniture a room build added (keeps lights) — only in empty mode */
  stripAdded(three, added, roomId) {
    if (!this.empty() || BATH.test(roomId)) return;
    for (const o of added) { if (o.isLight) continue; three.remove(o); }
  },

  /* called by myhouse/interior.js after the walls exist, before colliders are measured */
  mount(three, LOCAL, seats, uses) {
    this.ctx = { three, LOCAL, seats, uses, items: {}, family: [], t: 0, aabbs: [], frames: null };
    if (this.empty()) for (const s of SLOTS) if (this.has(s.id)) this._addItem(s);
    this._frames();
  },
  _room(id) { return this.ctx && this.ctx.LOCAL.find((r) => r.id === id); },
  _addItem(s) {
    const c = this.ctx; if (!c || c.items[s.id]) return;
    const r = this._room(s.room); if (!r) return;
    const p = s.at(r), g = new THREE.Group(); g.position.set(p.x, 0, p.z); s.build(g); g.userData.homeItem = s.id; c.three.add(g); c.items[s.id] = g;
    g.updateMatrixWorld(true);
    if (s.seat) c.seats.push({ type: s.seat.type, label: s.seat.label, x: p.x, z: p.z + (s.seat.type === "lie" ? 0.2 : 0), dx: s.seat.dx, dz: s.seat.dz, yaw: Math.atan2(s.seat.dx, s.seat.dz), h: s.seat.h, level: 0, taken: false });
    if (s.use) c.uses.push({ kind: s.use.kind, label: s.use.label, x: p.x + s.use.ox, z: p.z + s.use.oz, y: 0, level: 0, r: 1.6 });
    /* live purchase: add a collider for the new piece */
    if (c.live && c.live.colliders) { const bb = new THREE.Box3().setFromObject(g); c.live.colliders.push({ minX: bb.min.x, maxX: bb.max.x, minZ: bb.min.z, maxZ: bb.max.z, y0: 0, y1: bb.max.y, level: 0 }); }
  },
  /* pinned photos hang as frames along the entry hall's north wall (always free) */
  _frames() {
    const c = this.ctx; if (!c) return;
    const hall = this._room("corridor"); if (!hall) return;
    const pins = Photos.pinned().slice(0, 6); if (!pins.length) return;
    const grp = new THREE.Group(); c.three.add(grp); c.frames = grp;
    pins.forEach((p, i) => {
      const x = hall.x + 4 + i * 3.2, z = hall.z + 0.16;
      if (x > hall.x + hall.w - 1.5) return;
      const f = new THREE.Group(); f.position.set(x, 2.5, z);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 0.06), lmat(0xd4af37)); f.add(frame);
      const mat = new THREE.MeshBasicMaterial({ color: 0x555555 });
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 0.94), mat); pic.position.z = 0.035; pic.userData.isDecoration = true; f.add(pic);
      new THREE.TextureLoader().load(p.url, (t) => { t.colorSpace = THREE.SRGBColorSpace; mat.map = t; mat.color.set(0xffffff); mat.needsUpdate = true; });
      frame.userData.isDecoration = true; f.userData.isDecoration = true;
      grp.add(f);
    });
  },

  /* ── family at home ─────────────────────────────── */
  mountFamily(live) {
    const c = this.ctx; if (!c) return;
    c.live = live;                                   /* { colliders, ctrl } */
    try { if (NPCs.list.length) NPCs.despawn(); } catch (e) {}
    this.refreshFamily();
  },
  refreshFamily() {
    const c = this.ctx; if (!c || !c.live) return;
    for (const n of c.family) { try { NPCs._despawnOne(n); } catch (e) {} }
    c.family = [];
    const P = Lives.player(); if (!P) return;
    const living = this._room("living"), cx = living ? living.x + living.w / 2 : 0, cz = living ? living.z + living.d / 2 : 0;
    c.aabbs = c.live.colliders.filter((b) => b.y0 < 1.2 && b.y1 > 0.3 && (b.maxX - b.minX) < 14 && (b.maxZ - b.minZ) < 14).map((b) => ({ x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, hx: (b.maxX - b.minX) / 2, hz: (b.maxZ - b.minZ) / 2 }));
    NPCs.setScene(c.three); NPCs.setAABBs(c.aabbs);
    const spawn = (p, x, z) => {
      if (!p || p.dead) return null;
      const npc = NPCs.spawnRole(c.three, "walker", x, z, { forcedConfig: p.cfg || undefined, aabbs: c.aabbs });
      if (!npc) return null;
      Lives.bindNpc(npc, p); npc.stationary = true; npc.maxDist = 4; npc._homeFamily = true;
      if (p.age < 17) { const s = Math.max(0.38, Math.min(1, 0.38 + p.age * 0.036)); npc.group.scale.setScalar(s); npc._lifeScale = s; }
      c.family.push(npc); return npc;
    };
    const sp = Lives.byId(P.spouse);
    let spNpc = null;
    if (sp && !sp.out) spNpc = spawn(sp, cx - 2.5, cz - 2.5);
    P.kids.map(Lives.byId).filter((k) => k && !k.dead && k.age >= Lives.INFANT_AGE && k.age < 17 && !k.out).forEach((k, i) => spawn(k, cx + 2 + i * 0.9, cz + 2.5));
    /* infants: in the cot if you bought one, else in mum's arms */
    c.babies = [];
    for (const id of P.kids) {
      const k = Lives.byId(id); if (!k || k.dead || k.age >= Lives.INFANT_AGE || P.held === k.id) continue;
      const cot = c.items.cot;
      if (cot) { const b = buildBaby({ seed: k.id, scale: 0.8 }); b.position.set(cot.position.x, 0.72, cot.position.z); b.rotation.set(-Math.PI / 2 + 0.2, 0, 0); b.userData.isDecoration = true; c.three.add(b); c.babies.push(b); }
      else if (spNpc) spNpc._carryKid = k;
    }
  },
  tick(dt, px, pz) {
    const c = this.ctx; if (!c || !c.family) return;
    try { if (c.family.length) { NPCs.tick(dt, px, pz); NPCs.unstickAll(c.aabbs); } } catch (e) {}
    c.t += dt;
    if (c.t < 0.5) return; c.t = 0;
    for (const n of c.family) {
      const p = n._life; if (!p || !n.rig) continue;
      const pr = p.preg && p.g === "feminine" ? Lives.pregProgress(p) : 0;
      if (pr > 0.04) Belly.ensure(n.rig, pr); else if (n.rig.belly) Belly.remove(n.rig);
      const kid = n._carryKid;
      if (kid && Lives.player().held !== kid.id) Baby.ensure(n.rig, "front", { seed: kid.id, scale: 0.85 + 0.22 * Math.min(kid.age, Lives.INFANT_AGE) });
      else if (n.rig.baby) Baby.detach(n.rig);
    }
    /* baby handed to you → remove the cot baby; put down → refresh */
    const held = Lives.player() && Lives.player().held;
    if (held !== c.lastHeld) { c.lastHeld = held; this.refreshFamily(); }
  },
  dispose() {
    const c = this.ctx; if (!c) return;
    for (const n of c.family || []) { try { NPCs._despawnOne(n); } catch (e) {} }
    this.ctx = null;
  },

  /* ── Life app tab ─────────────────────────────── */
  renderTab(card, btn) {
    const L = LS(); let h = "";
    h += card(this.empty()
      ? `<b>Your home starts empty.</b><br><span style="opacity:.7">Bathrooms are fitted — everything else you earn or buy. Balance ${"₦" + Math.floor(Economy.balance).toLocaleString()}. Items are delivered straight to the right room.</span>`
      : `<b>Your home is furnished.</b><br><span style="opacity:.7">You built this home before — it stays as it is. Pinned album photos hang in the entry hall.</span>`);
    if (this.empty()) {
      const rooms = {};
      for (const s of SLOTS) (rooms[s.room] = rooms[s.room] || []).push(s);
      const names = { bedroomA: "Master bedroom", bedroomB: "Bedroom 2 / nursery", bedroomC: "Guest room", living: "Living room", kitchen: "Kitchen", library: "Library" };
      for (const r of Object.keys(rooms)) {
        h += card(`<b>${names[r] || r}</b><br>` + rooms[r].map((s) => this.has(s.id)
          ? `<div style="padding:6px 0;opacity:.8">${s.icon} ${s.name} ✅</div>`
          : `<div style="display:flex;align-items:center;gap:8px;padding:5px 0"><span style="flex:1">${s.icon} ${s.name}<br><small style="opacity:.6">₦${s.price.toLocaleString()}</small></span>${btn("buy:" + s.id, "Buy", Economy.balance < s.price)}</div>`).join(""));
      }
    }
    return h;
  },
  handle(a) { if (a.indexOf("buy:") === 0) { this.buy(a.slice(4)); return true; } return false; },
};
