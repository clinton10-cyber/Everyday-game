/* ═══════════════════════════════════════════════════════════════════════
   wedding.js — engagement → wedding at the church → marriage.

   A wedding needs:  Engaged  +  the church  +  invited guests present.
   • Planner (Life app → Wedding): pick guests (family, friends, anyone you know),
     book the church + catering.
   • In the church a 💍 START WEDDING button appears. The guests spawn in the pews,
     the priest takes the altar, then a short cutscene runs:
         procession → vows → rings → kiss → photo session → reception (optional)
   • The photo session saves real shots (guests included) to the 3D album.
   • Afterwards the relationship becomes MARRIED, which unlocks the shared home.
   ═══════════════════════════════════════════════════════════════════════ */
import * as THREE from "three";
import { Lives } from "./npc-lives.js";
import { NPCs } from "./npcs.js";
import { Economy } from "./economy.js";
import { Photos, captureShot } from "./photos.js";
import { HomeProg, SLOTS } from "./home-prog.js";

const LS = () => window.__ph3d_lifesim;
const toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} };
const CHURCH_FEE = 40000, PER_GUEST = 3000, RECEPTION_FEE = 60000, MIN_GUESTS = 3;
const first = (n) => String(n || "").split(" ")[0];

function W() { const L = LS(); if (!L) return { guests: [], reception: true }; if (!L.state.wedding) L.state.wedding = { guests: [], reception: true, done: false }; return L.state.wedding; }
function cost(w) { return CHURCH_FEE + w.guests.length * PER_GUEST + (w.reception ? RECEPTION_FEE : 0); }
function fiance() { const P = Lives.player(); return P && P.engaged ? Lives.byId(P.engaged) : null; }

export const Wedding = {
  active: false,
  onEngaged() { toast("💍 Engaged! Open 👥 Life → Wedding to invite guests"); },

  openPlanner() { const L = LS(); L && L.openApp && L.openApp("wedding"); },

  /* guests you could invite: everyone you've met, family first */
  candidates() {
    const P = Lives.player(); if (!P) return [];
    const fi = P.engaged;
    return Lives.people().filter((p) => !p.dead && p.id !== fi && p.age >= 4 && p.rel.player && p.rel.player.met > 0 && !(p.age < Lives.INFANT_AGE))
      .sort((a, b) => (P.kids.includes(b.id) ? 1000 : 0) + b.rel.player.v - ((P.kids.includes(a.id) ? 1000 : 0) + a.rel.player.v)).slice(0, 40);
  },

  renderTab(card, btn) {
    const P = Lives.player(), w = W(), fi = fiance();
    if (P && P.spouse) return card("💍 You're married" + (Lives.byId(P.spouse) ? " to <b>" + Lives.byId(P.spouse).name + "</b>" : "") + ". Your spouse shares your home.");
    if (!fi) return card("<b>No engagement yet.</b><br><span style='opacity:.7'>Date someone, then propose from the relationship panel (needs a strong bond). A wedding requires: <b>Engaged</b> + <b>the church</b> + <b>invited guests</b>.</span>");
    let h = card(`<b>Wedding to ${fi.name}</b><br><span style="opacity:.75">Guests ${w.guests.length} (min ${MIN_GUESTS}) · total ${"₦" + cost(w).toLocaleString()}</span><br>
      ${btn("recep", w.reception ? "🥂 Reception: ON" : "🥂 Reception: OFF")}${w.paid ? "" : btn("book", "⛪ Book church · pay", w.guests.length < MIN_GUESTS || Economy.balance < cost(w))}
      ${w.paid ? `<br><b style="color:#7dff9a">✔ Booked.</b> Go to the Church and press <b>START WEDDING</b>.` : ""}`);
    const list = this.candidates();
    h += card("<b>Guest list</b> — tap to invite" + (list.length ? "" : "<br><span style='opacity:.7'>You haven't met anyone yet. Chat with people first.</span>") +
      `<div style="margin-top:6px">${list.map((p) => `<button data-a="inv:${p.id}" ${w.paid ? "disabled" : ""} style="margin:3px 3px 0 0;border-radius:10px;padding:7px 10px;font:700 12px Inter,system-ui,sans-serif;color:#fff;border:1px solid ${w.guests.includes(p.id) ? "#7dff9a" : "#ffffff33"};background:${w.guests.includes(p.id) ? "#2f6b4a" : "#1c2b24"}">${w.guests.includes(p.id) ? "✔ " : ""}${first(p.name)}${P.kids.includes(p.id) ? " 👶" : ""}</button>`).join("")}</div>`);
    return h;
  },
  handle(a) {
    const w = W();
    if (a.indexOf("inv:") === 0) { const id = a.slice(4); const i = w.guests.indexOf(id); if (i >= 0) w.guests.splice(i, 1); else w.guests.push(id); LS().save(); return true; }
    if (a === "recep") { w.reception = !w.reception; LS().save(); return true; }
    if (a === "book") {
      if (w.guests.length < MIN_GUESTS) { toast("Invite at least " + MIN_GUESTS + " guests"); return true; }
      if (!Economy.withdraw(cost(w))) { toast("Not enough money for the wedding"); return true; }
      w.paid = true; LS().save(); toast("⛪ Church booked! Go to the Church to hold the wedding."); return true;
    }
    return false;
  },

  /* ── church scene hook ─────────────────────────────────────────────
     ctx: { scene, camera, ctl }  → returns { tick(dt) → true while a cutscene owns the camera, dispose() } */
  mountChurch(ctx) {
    const { scene, camera, ctl } = ctx;
    let btn = null, run = null, hint = null;
    const ready = () => { const P = Lives.player(), w = W(); return !!(P && P.engaged && w.paid && w.guests.length >= MIN_GUESTS && !P.spouse); };
    const mkBtn = () => {
      btn = document.createElement("button"); btn.id = "ph3d-wedding-btn"; btn.textContent = "💍 START WEDDING";
      btn.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 150px);z-index:9450;padding:13px 22px;border-radius:999px;border:none;background:linear-gradient(135deg,#ffe29a,#f2b04a);color:#3a2300;font:900 13px Inter,system-ui,sans-serif;letter-spacing:.1em;box-shadow:0 8px 24px #000a;display:none;touch-action:manipulation";
      btn.onclick = () => { if (!run) { btn.style.display = "none"; run = new Ceremony(ctx); } };
      document.body.appendChild(btn);
      hint = document.createElement("div");
      hint.style.cssText = "position:fixed;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 150px);text-align:center;z-index:9440;color:#fff;font:700 12px Inter,system-ui,sans-serif;text-shadow:0 1px 4px #000;pointer-events:none;display:none";
      document.body.appendChild(hint);
    };
    mkBtn();
    return {
      tick(dt) {
        if (run) { const alive = run.tick(dt); if (!alive) { run = null; } return !!run; }
        const P = Lives.player(), w = W();
        const show = ready();
        btn.style.display = show ? "block" : "none";
        const eng = P && P.engaged && !P.spouse && !show;
        hint.style.display = eng ? "block" : "none";
        if (eng) hint.textContent = w.paid ? "Invite at least " + MIN_GUESTS + " guests to hold the wedding" : "💍 Plan your wedding: 👥 Life → Wedding (guests + booking)";
        return false;
      },
      dispose() { try { run && run.abort(); } catch (e) {} if (btn) btn.remove(); if (hint) hint.remove(); },
    };
  },
};

/* ═══ the ceremony ═══════════════════════════════════════════════════ */
class Ceremony {
  constructor(ctx) {
    this.ctx = ctx; this.t = 0; this.shots = 0; this.confetti = null; this.npcs = []; this.guests = [];
    Wedding.active = true;
    const P = Lives.player(), w = W();
    this.w = w; this.fi = fiance();
    this.avatar = ctx.ctl.avatar; this.ctl = ctx.ctl;
    NPCs.setScene(ctx.scene); NPCs.setAABBs([]);
    try { if (NPCs.list.length) NPCs.despawn(); NPCs.setScene(ctx.scene); } catch (e) {}
    const mk = (role, x, z, yaw, person) => {
      const n = NPCs.spawnRole(ctx.scene, role, x, z, { forcedConfig: person && person.cfg ? person.cfg : undefined });
      if (!n) return null;
      n.stationary = true; n.maxDist = 1; n._wx = x; n._wz = z; n._wyaw = yaw; n.group.rotation.y = yaw; n.yawTarget = yaw;
      if (person) { Lives.bindNpc(n, person); if (person.age < 17) { const s = Math.max(0.38, 0.38 + person.age * 0.036); n.group.scale.setScalar(Math.min(1, s)); n._lifeScale = Math.min(1, s); } }
      this.npcs.push(n); return n;
    };
    this.priest = mk("priest", 0, -10.3, 0, null);
    this.mate = mk("walker", 1.0, 2.0, Math.PI, this.fi);
    w.guests.map(Lives.byId).filter(Boolean).forEach((g, i) => {
      const side = i % 2 ? 1 : -1, k = Math.floor(i / 2), x = side * (3.0 + (k % 2) * 1.5), z = -4 + Math.floor(k / 2) * 2.5;
      const n = mk("walker", x, z, Math.PI, g); if (n) this.guests.push(n);
    });
    this.names = this.guests.map((n) => first(n._life && n._life.name)).filter(Boolean);
    this.caption = document.createElement("div");
    this.caption.style.cssText = "position:fixed;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 70px);z-index:9460;text-align:center;padding:0 18px;color:#fff;font:italic 800 17px Georgia,serif;text-shadow:0 2px 8px #000;pointer-events:none";
    document.body.appendChild(this.caption);
    this.skip = document.createElement("button"); this.skip.textContent = "SKIP ▸▸";
    this.skip.style.cssText = "position:fixed;right:12px;top:calc(env(safe-area-inset-top,0px) + 70px);z-index:9461;background:#0008;border:1px solid #fff4;color:#fff;border-radius:12px;padding:8px 12px;font:800 11px Inter,system-ui,sans-serif";
    this.skip.onclick = () => { this.t = Math.max(this.t, this.endT() - 0.1); };
    document.body.appendChild(this.skip);
    this.startPos = { x: ctx.ctl.pos.x, z: ctx.ctl.pos.z, yaw: ctx.ctl.yaw };
    this.say("The guests settle into the pews…");
  }
  endT() { return this.w.reception ? 40 : 30; }
  say(t) { if (this.caption) this.caption.textContent = t; }
  place(n, x, z, yaw, walk) {
    if (!n) return;
    n.ctl.pos.x = x; n.ctl.pos.z = z; n.group.position.x = x; n.group.position.z = z; n.yawTarget = yaw; n.group.rotation.y = yaw;
    n.state = "idle"; n.stateT = 5; n.moveSpeed = walk ? 1.35 : 0;
  }
  tick(dt) {
    this.t += dt; const t = this.t, c = this.ctx.camera, ctl = this.ctl;
    const L = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
    /* hold everyone in place (the church has no NPC AI of its own) */
    try { NPCs.tick(dt, ctl.pos.x, ctl.pos.z); } catch (e) {}
    for (const n of this.npcs) if (n !== this.mate) this.place(n, n._wx, n._wz, n._wyaw, false);
    /* player + fiancé */
    let px = 0, pz = -8.7, mx = 1.0, mz = -8.7;
    if (t < 6) { const k = t / 6; pz = L(3.0, -8.7, k); mz = pz; px = -0.5; mx = 0.5; }
    else { px = -0.55; mx = 0.55; }
    const walking = t < 6;
    ctl.pos.x = px; ctl.pos.z = pz; ctl.yaw = Math.PI;
    if (this.avatar) { this.avatar.position.x = px; this.avatar.position.z = pz; this.avatar.rotation.y = Math.PI; this.avatar.visible = true; }
    this.place(this.mate, mx, mz, Math.PI, walking);
    if (t >= 6 && this.priest) this.priest.yawTarget = 0;
    /* camera + script */
    let lx = 0, ly = 1.45, lz = -9;
    if (t < 6) { c.position.set(0, 1.9, 5.5 - t * 0.2); lz = -8; this.say(t < 3 ? "The guests settle into the pews…" : "The couple walks down the aisle 💐"); }
    else if (t < 14) { const k = (t - 6) / 8; c.position.set(L(2.8, 1.6, k), 1.7, L(-5.2, -6.4, k)); lz = -9.2; this.say(t < 9 ? "“We are gathered here today…”" : t < 12 ? "“Do you take each other, in joy and in hardship?”" : "“I do.”  “I do.” 💞"); }
    else if (t < 19) { c.position.set(0.1, 1.65, -6.7); lx = 0; ly = 1.4; lz = -8.7; this.say("The rings are exchanged 💍"); }
    else if (t < 24) { c.position.set(-1.9, 1.6, -6.6); lx = 0; ly = 1.5; lz = -8.7; this.say("“You may now kiss the bride!” 💋"); this.burst(); this.cheer(); }
    else if (t < 30) { this.say("📸 Wedding photos!"); this.photos(t - 24); lx = 0; ly = 1.5; lz = -8.7; }
    else if (t < 40 && this.w.reception) { c.position.set(0, 2.4, -2.5); lz = -8; this.say(t < 34 ? "🥂 Reception — everyone celebrates!" : "🎁 The guests bring gifts…"); this.cheer(); this.burst(); }
    if (t >= 24 && t < 30) { /* photo camera moves are done in photos() */ }
    else { c.lookAt(lx, ly, lz); }
    this.confettiTick(dt);
    if (t >= this.endT()) { this.finish(); return false; }
    return true;
  }
  cheer() { if (Math.random() < 0.06) for (const g of this.guests) { if (Math.random() < 0.5) { g.ctl._emoteName = "wave"; g.ctl._emoteTimer = 1.6; g.ctl._emotePhase = 0; } } }
  photos(k) {
    const angles = [[0, 1.7, -5.2, 0, 1.5, -9], [3.2, 2.0, -2.5, 0, 1.4, -8.5], [-3.0, 1.7, -5.8, 0.2, 1.5, -8.8], [0, 2.3, 3.0, 0, 1.4, -8.8]];
    const i = Math.min(angles.length - 1, Math.floor(k / 1.5));
    const a = angles[i], c = this.ctx.camera;
    c.position.set(a[0], a[1], a[2]); c.lookAt(a[3], a[4], a[5]);
    if (this.shots <= i) {
      this.shots = i + 1; this.burst(true);
      const url = captureShot({ x: a[0], y: a[1], z: a[2] }, { x: a[3], y: a[4], z: a[5] }, i === 3 ? 62 : 48);
      if (url) Photos.add(url, i === 3 ? "Our wedding day 💍" : "Just married ❤", { tag: "wedding", who: [first(this.fi && this.fi.name)].concat(this.names).filter(Boolean), where: "Church" });
    }
  }
  burst(big) {
    if (!this.confetti) {
      const N = 180, g = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { pos[i * 3 + 1] = -50; const c = new THREE.Color().setHSL(Math.random(), 0.9, 0.6); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      this.confetti = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.12, vertexColors: true }));
      this.confetti.frustumCulled = false; this.confetti.userData.isDecoration = true; this.ctx.scene.add(this.confetti);
      this.cv = new Float32Array(N * 3); this.cn = 0;
    }
    if (!big && Math.random() > 0.15) return;
    const pos = this.confetti.geometry.attributes.position.array, N = pos.length / 3, n = big ? 50 : 14;
    for (let j = 0; j < n; j++) { const i = (this.cn++) % N; pos[i * 3] = (Math.random() - 0.5) * 3; pos[i * 3 + 1] = 3.5 + Math.random(); pos[i * 3 + 2] = -8.5 + (Math.random() - 0.5) * 3; this.cv[i * 3] = (Math.random() - 0.5) * 1.5; this.cv[i * 3 + 1] = -0.8 - Math.random(); this.cv[i * 3 + 2] = (Math.random() - 0.5) * 1.5; }
  }
  confettiTick(dt) {
    if (!this.confetti) return;
    const pos = this.confetti.geometry.attributes.position.array;
    for (let i = 0; i < pos.length / 3; i++) { if (pos[i * 3 + 1] > -40) { pos[i * 3] += this.cv[i * 3] * dt; pos[i * 3 + 1] += this.cv[i * 3 + 1] * dt; pos[i * 3 + 2] += this.cv[i * 3 + 2] * dt; if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = -50; } }
    this.confetti.geometry.attributes.position.needsUpdate = true;
  }
  cleanup() {
    for (const n of this.npcs) { try { NPCs._despawnOne(n); } catch (e) {} }
    this.npcs = [];
    if (this.confetti) { this.ctx.scene.remove(this.confetti); this.confetti.geometry.dispose(); this.confetti.material.dispose(); this.confetti = null; }
    if (this.caption) this.caption.remove(); if (this.skip) this.skip.remove();
    Wedding.active = false;
    /* hand control back at the altar */
    this.ctl.pos.x = 0; this.ctl.pos.z = -6.5; this.ctl.yaw = 0;
  }
  abort() { this.cleanup(); }
  finish() {
    const w = this.w, L = LS();
    const spouse = Lives.completeWedding();
    /* reception gifts: cash from the guests + furniture for the empty home */
    let msg = "";
    if (w.reception) {
      const cash = this.guests.length * (15000 + Math.floor(Math.random() * 25000));
      try { Economy.receive && Economy.receive("Wedding guests", cash, "Wedding gifts"); } catch (e) {}
      const free = SLOTS.filter((s) => !HomeProg.has(s.id)).sort(() => Math.random() - 0.5).slice(0, Math.min(3, this.guests.length));
      const got = HomeProg.gift(free.map((s) => s.id));
      msg = " 🎁 +₦" + cash.toLocaleString() + (got.length ? " and " + got.map((id) => (SLOTS.find((s) => s.id === id) || {}).name).join(", ") + " for your home" : "");
    }
    w.done = true; w.paid = false; w.guests = []; L && L.save();
    this.cleanup();
    toast("💍 You're married" + (spouse ? " to " + spouse.name : "") + "! Your home is now shared." + msg);
    try { HomeProg.refreshFamily(); L && L.renderApp && L.renderApp(); } catch (e) {}
  }
}
