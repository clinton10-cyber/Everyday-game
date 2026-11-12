/* ═══════════════════════════════════════════════════════════════════════
   lifesim.js — hub for the life-sim systems.

     relationships : stranger → acquaintance → dating → engaged → married (npc-lives.js)
     wedding       : planner + church ceremony (wedding.js)
     pregnancy     : wife stays home, belly swells by trimester (npc-lives + body-attach)
     infants       : carry front/back, soothe, NPC parents carry babies too
     photos        : camera at dates/weddings, group selfies, 3D album (photos.js, photo3d.js)
     home          : starts empty, furnished by purchase / gifts (home-prog.js)

   Exposes window.__ph3d_lifesim and adds the 👥 Life app to the phone.
   ═══════════════════════════════════════════════════════════════════════ */
import { Lives } from "./npc-lives.js";
import { Baby, Belly } from "./body-attach.js";
import { Photos, captureSelfie } from "./photos.js";
import { NPCs } from "./npcs.js";
import { Economy } from "./economy.js";
import { HomeProg } from "./home-prog.js";
import { Wedding } from "./wedding.js";

const KEY = "ph3d_lifesim_v1";
const toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* an existing player (has played before this feature shipped) keeps the home they built */
function looksLikeExistingPlayer() {
  try { return ["ph3d_lives_v1", "ph3d.visits.v1", "ph3d.furn.v1", "ph3d.interior-npcs.v1"].some((k) => localStorage.getItem(k) != null); } catch (e) { return false; }
}
function loadState() {
  try { const j = localStorage.getItem(KEY); if (j) { const o = JSON.parse(j); if (o && o.v === 1) return o; } } catch (e) {}
  return { v: 1, legacyHome: looksLikeExistingPlayer(), home: { owned: {} }, wedding: { guests: [], reception: true, done: false }, baby: { mood: 0.8 }, family: { happiness: 70, activities: 0, lastActivity: "" } };
}
const state = loadState();
state.family = state.family || { happiness: 70, activities: 0, lastActivity: "" };
state.family.happiness = clamp(Number(state.family.happiness) || 70, 0, 100);
state.family.activities = Math.max(0, Number(state.family.activities) || 0);
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
save();

let soothing = 0, crying = false, cryAt = 0, nextCry = performance.now() + 40000;

/* the player's current rig (third-person scenes or the drive-scene walker) */
function playerRig() {
  const tp = window.__ph3d_tp;
  if (tp && tp.rig && tp.avatar) return tp.rig;
  try { const ws = window.__ph3d_drive && window.__ph3d_drive.getWalkState && window.__ph3d_drive.getWalkState(); if (ws && ws.charRig) return ws.charRig; } catch (e) {}
  return null;
}
function playerPos() {
  const tp = window.__ph3d_tp; if (tp && tp.pos) return { x: tp.pos.x, z: tp.pos.z };
  try { const ws = window.__ph3d_drive.getWalkState(); return { x: ws.walker.x, z: ws.walker.z }; } catch (e) {}
  return null;
}

export const LifeSim = {
  state, save, toast, Lives, HomeProg, Wedding,

  /* ── infants ─────────────────────────────────────── */
  carryBaby(kidId, mode) {
    const P = Lives.player(), kid = Lives.byId(kidId); if (!P || !kid) return false;
    if (kid.age >= Lives.INFANT_AGE) { toast("They're too big to carry!"); return false; }
    P.carryMode = mode === "back" ? "back" : "front";
    Lives.setHeld(kidId);
    this._syncCarry(true);
    toast("👶 Carrying " + kid.name.split(" ")[0] + " (" + P.carryMode + ") — you walk a little slower");
    this._hud();
    return true;
  },
  putDown() {
    const rig = playerRig(); const P = Lives.player();
    if (rig) Baby.detach(rig);
    Lives.setHeld(null); if (P) P.carryMode = null; crying = false; this._hud();
    toast("You put the baby down safely 🛏");
  },
  soothe() {
    const P = Lives.player(); if (!P || !P.held) return;
    soothing = 3; state.baby.mood = clamp(state.baby.mood + 0.35, 0, 1);
    if (crying) { crying = false; toast("🤫 Baby calms down"); }
    const kid = Lives.byId(P.held); if (kid) { const r = kid.rel.player || (kid.rel.player = { v: 80, met: 5 }); r.v = clamp(r.v + 1, -100, 100); }
    this._hud();
  },
  heldKid() { const P = Lives.player(); return P && P.held ? Lives.byId(P.held) : null; },
  _syncCarry(force) {
    const P = Lives.player(); const rig = playerRig(); if (!rig) return;
    const kid = P && P.held ? Lives.byId(P.held) : null;
    if (!kid || kid.dead || kid.age >= Lives.INFANT_AGE) { if (rig.baby) Baby.detach(rig); if (P && P.held) { Lives.setHeld(null); this._hud(); } return; }
    Baby.ensure(rig, P.carryMode || "front", { seed: kid.id, scale: 0.85 + 0.22 * Math.min(kid.age, Lives.INFANT_AGE) });
  },
  onPlayerBirth(kid, sp) { toast("👶 Open the 👥 Life app to see your family"); try { HomeProg.refreshFamily(); } catch (e) {} },
  onEngaged() { Wedding.onEngaged(); },
  onBreakEngagement() { state.wedding = { guests: [], reception: true, done: false }; save(); },
  onDate(p, kind) {
    /* the camera is usable on dates — snap one together */
    setTimeout(() => { try { this.togetherSelfie(p._npc, p, true); } catch (e) {} }, 600);
  },

  /* ── family activities: low-friction bonding actions with persistent progress ── */
  familyActivity(kind) {
    const P = Lives.player(); if (!P) return false;
    const partner = Lives.byId(P.spouse) || Lives.byId(P.partner);
    const kids = (P.kids || []).map(Lives.byId).filter((k) => k && !k.dead);
    const members = [partner, ...kids].filter(Boolean);
    if (!members.length) { toast("Build a family first — invite a partner or welcome children."); return false; }
    const options = {
      game: { name: "Family game night", cost: 0, happiness: 6, bond: 5 },
      picnic: { name: "Park picnic", cost: 3500, happiness: 10, bond: 8 },
      dinner: { name: "Family dinner", cost: 9000, happiness: 14, bond: 11 },
      celebrate: { name: "Family celebration", cost: 18000, happiness: 20, bond: 15 },
    };
    const activity = options[kind]; if (!activity) return false;
    if (activity.cost && !Economy.withdraw(activity.cost)) { toast("Not enough money for this family activity."); return false; }
    for (const person of members) {
      const rel = Lives.rel(person);
      rel.v = clamp((Number(rel.v) || 0) + activity.bond, -100, 100);
      rel.met = (Number(rel.met) || 0) + 1;
      rel.last = Lives.state().day;
      person.mood = clamp((Number(person.mood) || 0.5) + 0.08, 0, 1);
    }
    state.family.happiness = clamp(state.family.happiness + activity.happiness, 0, 100);
    state.family.activities += 1;
    state.family.lastActivity = activity.name;
    save(); Lives.save();
    toast(activity.name + " completed · family bonds improved!");
    return true;
  },

  /* ── photos ──────────────────────────────────────── */
  nearbyActors(x, z, r) {
    const out = [];
    for (const n of NPCs.list || []) {
      if (!n || n.dead || !n.group || n.group.visible === false || n._lifeHidden) continue;
      const d = Math.hypot(n.ctl.pos.x - x, n.ctl.pos.z - z);
      if (d <= r && d > 0.35) out.push({ group: n.group, name: n._life ? n._life.name.split(" ")[0] : "", scale: n._lifeScale || 1, d });
    }
    return out.sort((a, b) => a.d - b.d);
  },
  photoMeta() {
    let tag = window.__ph3d_camMode === "selfie" ? "selfie" : "photo", where = "", who = [];
    try { const c = window.__ph3d_router && window.__ph3d_router.current; where = (c && (c.title || c.sceneId)) || ""; } catch (e) {}
    if (tag === "selfie") who = (window.__ph3d_lastSelfieWho || []).slice();
    if (Wedding.active) tag = "wedding";
    else if (who.some((n) => { const P = Lives.player(); const s = P && (Lives.byId(P.spouse) || Lives.byId(P.partner)); return s && s.name.indexOf(n) === 0; })) tag = "date";
    return { tag, who, where };
  },
  togetherSelfie(npc, p, quiet) {
    const url = captureSelfie("smile");
    if (!url) { if (!quiet) toast("Selfie needs a walkable scene"); return; }
    const P = Lives.player(); const partner = P && (P.spouse === p.id || P.partner === p.id);
    const who = (window.__ph3d_lastSelfieWho || []).slice(); if (p && who.indexOf(p.name.split(" ")[0]) < 0) who.unshift(p.name.split(" ")[0]);
    Photos.add(url, partner ? "Us ❤" : "With " + p.name.split(" ")[0], { tag: partner ? "date" : "selfie", who, where: (window.__ph3d_router && window.__ph3d_router.current && window.__ph3d_router.current.title) || "" });
    toast("🤳 Selfie saved to your 3D album");
  },

  openWedding() { Wedding.openPlanner(); },
  openApp(t) { if (t) tab = t; openLifeApp(); },

  /* ── baby HUD (shows while you carry one) ────────── */
  _hud() {
    const P = Lives.player(); let el = document.getElementById("ls-baby-hud");
    if (!P || !P.held) { if (el) el.style.display = "none"; return; }
    if (!el) {
      el = document.createElement("div"); el.id = "ls-baby-hud";
      el.style.cssText = "position:fixed;left:10px;top:calc(env(safe-area-inset-top,0px) + 70px);z-index:9400;background:rgba(10,16,13,.88);border:1px solid rgba(255,200,120,.45);border-radius:14px;padding:8px;display:flex;gap:6px;align-items:center;color:#fff;font:800 12px Inter,system-ui,sans-serif";
      document.body.appendChild(el);
    }
    const kid = Lives.byId(P.held);
    const b = (id, t) => `<button data-a="${id}" style="background:#26382e;border:1px solid #7dff9a55;color:#fff;border-radius:10px;padding:7px 9px;font:800 11px Inter,system-ui,sans-serif">${t}</button>`;
    el.innerHTML = `<span id="ls-bb-face" style="font-size:20px">${crying ? "😭" : soothing > 0 ? "😴" : "👶"}</span><span>${kid ? kid.name.split(" ")[0] : "Baby"}</span>`
      + b("soothe", "🤫 Soothe") + b("flip", P.carryMode === "back" ? "🤱 Front" : "🎒 Back") + b("down", "🛏 Down");
    el.style.display = "flex";
    el.querySelectorAll("button").forEach((x) => (x.onclick = () => {
      const a = x.dataset.a;
      if (a === "soothe") this.soothe();
      else if (a === "down") this.putDown();
      else { P.carryMode = P.carryMode === "back" ? "front" : "back"; Lives.save(); this._syncCarry(true); this._hud(); }
    }));
  },
};
window.__ph3d_lifesim = LifeSim;

/* ── background loop: world clock, carry sync, baby mood ───────────── */
Lives.init();
setInterval(() => {
  try {
    Lives.pulse();
    const P = Lives.player();
    if (P && P.held) {
      LifeSim._syncCarry(false);
      const now = performance.now();
      if (soothing > 0) soothing -= 1;
      state.baby.mood = clamp(state.baby.mood - 0.012, 0, 1);
      if (!crying && now > nextCry && state.baby.mood < 0.8) { crying = true; cryAt = now; toast("😭 The baby is crying — tap Soothe"); LifeSim._hud(); }
      if (!crying && now > nextCry) nextCry = now + 30000 + Math.random() * 40000;
      if (crying && now - cryAt > 45000) { crying = false; state.baby.mood = 0.5; nextCry = now + 60000; LifeSim._hud(); }
      if (crying) { try { window.__ph3d_sfx && window.__ph3d_sfx.play && window.__ph3d_sfx.play("ui_error"); } catch (e) {} }
    }
  } catch (e) {}
}, 1000);
let _t0 = performance.now();
(function frame() {
  requestAnimationFrame(frame);
  try {
    const P = Lives.player(); if (!P || !P.held) return;
    const rig = playerRig(); if (rig && rig.baby) Baby.tick(rig, (performance.now() - _t0) / 1000, { soothing: soothing > 0, crying });
  } catch (e) {}
})();
window.addEventListener("beforeunload", () => { try { save(); Lives.save(); } catch (e) {} });
setInterval(save, 20000);

/* ═══ Life app (phone tile) ═════════════════════════════════════════ */
let appEl = null, tab = "love";
function money(n) { return "₦" + Math.floor(n).toLocaleString(); }
function openLifeApp() {
  if (!appEl) {
    appEl = document.createElement("div"); appEl.id = "ls-app";
    appEl.style.cssText = "position:fixed;inset:0;z-index:9650;background:rgba(5,9,7,.98);color:#eaf6ff;font:600 14px Inter,system-ui,sans-serif;display:none;flex-direction:column";
    document.body.appendChild(appEl);
  }
  appEl.style.display = "flex"; renderApp();
}
function renderApp() {
  const P = Lives.player(); if (!P) return;
  const tabs = { love: "❤ Love", wedding: "💍 Wedding", family: "👨‍👩‍👧 Family", home: "🏠 Home", album: "🖼 Album" };
  const card = (h) => `<div style="background:#121b16;border-radius:14px;padding:12px;margin-bottom:10px">${h}</div>`;
  const btn = (id, t, d) => `<button data-a="${id}" ${d ? "disabled" : ""} style="background:#1c2b24;border:1px solid rgba(125,255,154,.3);color:#eaf6ff;border-radius:11px;padding:9px 12px;font:700 12px Inter,system-ui,sans-serif;margin:3px 3px 0 0;${d ? "opacity:.4" : ""}">${t}</button>`;
  let h = `<div style="display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 12px) 14px 8px"><b style="flex:1;font:900 20px Inter,system-ui,sans-serif">👥 Life</b>${btn("people", "People")}${btn("close", "Close")}</div>
    <div style="display:flex;gap:6px;padding:0 14px 8px;overflow:auto">${Object.keys(tabs).map((k) => `<button data-tab="${k}" style="white-space:nowrap;background:${k === tab ? "#2f6b4a" : "#1c2b24"};border:1px solid ${k === tab ? "#7dff9a" : "rgba(125,255,154,.3)"};color:#fff;border-radius:11px;padding:7px 12px;font:700 12px Inter,system-ui,sans-serif">${tabs[k]}</button>`).join("")}</div>
    <div id="ls-body" style="flex:1;overflow:auto;padding:4px 14px 30px">`;
  const partner = Lives.byId(P.spouse) || Lives.byId(P.partner);
  if (tab === "love") {
    if (!partner) h += card("<b>Single</b><br><span style='opacity:.7'>Talk to anyone, anywhere — street, market, church, events. Chat → friends → flirt → ask out. Stages: Stranger → Acquaintance → Dating → Engaged → Married.</span>");
    else {
      const st = Lives.stageOf(partner), r = Lives.rel(partner);
      h += card(`<b>${partner.name}</b> · ${Lives.STAGE_LABEL[st]}<br><div style="height:8px;border-radius:6px;background:#26302b;margin:8px 0"><i style="display:block;height:100%;width:${(r.v + 100) / 2}%;background:linear-gradient(90deg,#ff5a4d,#ffd23a,#7dff9a);border-radius:6px"></i></div>
        <span style="opacity:.75">${{ dating: "Unlocks: outings, selfies together, proposal.", engaged: "Unlocks: wedding planning, guest list, church ceremony.", married: "Unlocks: shared home, babies, family life." }[st] || ""}</span>`);
      if (partner.preg) { const pr = Lives.pregProgress(partner), s = Belly.stage(pr); h += card(`🤰 <b>Expecting</b> — ${["", "1st", "2nd", "3rd"][s]} trimester · ${Math.round(pr * 100)}%<br><span style="opacity:.7">She rests at home while pregnant.</span>`); }
    }
  } else if (tab === "wedding") h += Wedding.renderTab(card, btn);
  else if (tab === "family") {
    const kids = P.kids.map(Lives.byId).filter((k) => k && !k.dead);
    const fam = state.family;
    h += card(`<b>Household overview</b><br>Partner: ${partner ? partner.name : "No spouse or partner yet"}<br>Children: ${kids.length}<br><span style="opacity:.75">Family happiness · ${Math.round(fam.happiness)}%</span><div style="height:8px;border-radius:8px;background:#26302b;margin:8px 0"><i style="display:block;width:${fam.happiness}%;height:100%;background:linear-gradient(90deg,#ffb454,#7dff9a);border-radius:8px"></i></div><span style="opacity:.7">Family activities completed: ${fam.activities}</span>`);
    if (partner) h += card(`<b>💑 ${partner.name}</b><br>${Lives.STAGE_LABEL[Lives.stageOf(partner)] || "Partner"}${partner.preg ? " · 🤰 expecting" : ""}<br><span style="opacity:.7">Relationship: ${Math.round((Lives.rel(partner).v + 100) / 2)}%</span>`);
    h += kids.length ? kids.map((k) => card(`<b>${k.name}</b> · ${k.age < 2 ? Math.max(0, Math.floor(k.age * 12)) + " months" : Math.floor(k.age) + " yrs"}${P.held === k.id ? " · 🤱 in your arms" : ""}<br>${k.age < Lives.INFANT_AGE ? (P.held === k.id ? btn("soothe", "🤫 Soothe") + btn("down", "🛏 Put down") : btn("fcarry:" + k.id, "🤱 Carry (front)") + btn("bcarry:" + k.id, "🎒 Carry (back)")) : ""}`)).join("") : card("No children yet. Married couples can try for a baby from the relationship panel.");
    h += card(`<b>🎉 Family activities</b><br><span style="opacity:.7">Spend time together to strengthen family bonds and improve household happiness.</span><br>${btn("fam:game", "🎲 Game night · Free", !partner && !kids.length)}${btn("fam:picnic", "🧺 Park picnic · ₦3,500", !partner && !kids.length)}${btn("fam:dinner", "🍲 Family dinner · ₦9,000", !partner && !kids.length)}${btn("fam:celebrate", "🎊 Family celebration · ₦18,000", !partner && !kids.length)}<br><span style="opacity:.7">${fam.lastActivity ? "Last activity: " + fam.lastActivity : "Plan your first family activity."}</span>`);
  } else if (tab === "home") h += HomeProg.renderTab(card, btn);
  else {
    const n = Photos.list.length;
    h += card(`<b>3D Album</b> · ${n} photo${n === 1 ? "" : "s"}<br><span style="opacity:.7">Every photo is a 3D object: zoom, rotate, flip it over and pin favourites to your home wall.</span><br>${btn("album", "🖼 Open 3D album", !n)}`);
  }
  h += "</div>";
  appEl.innerHTML = h;
  appEl.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; renderApp(); }));
  appEl.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => {
    const a = b.dataset.a;
    if (a === "close") { appEl.style.display = "none"; return; }
    if (a === "people") { appEl.style.display = "none"; Lives.openApp(); return; }
    if (a === "album") { appEl.style.display = "none"; import("./photo3d.js").then((m) => m.PhotoViewer3D.open(Photos.list[0] && Photos.list[0].id, { onClose: () => openLifeApp() })); return; }
    if (a === "soothe") LifeSim.soothe();
    else if (a === "down") LifeSim.putDown();
    else if (a.indexOf("fam:") === 0) LifeSim.familyActivity(a.slice(4));
    else if (a.indexOf("fcarry:") === 0) LifeSim.carryBaby(a.slice(7), "front");
    else if (a.indexOf("bcarry:") === 0) LifeSim.carryBaby(a.slice(7), "back");
    else if (Wedding.handle(a) || HomeProg.handle(a)) { /* handled */ }
    renderApp();
  }));
}
LifeSim.renderApp = () => { if (appEl && appEl.style.display !== "none") renderApp(); };

/* phone tile */
(function hook() {
  let tries = 0;
  const iv = setInterval(() => {
    const grid = document.querySelector("#app-home .tgrid");
    if (grid && !document.getElementById("ls-tile")) {
      const d = document.createElement("div"); d.className = "tapp-ic"; d.id = "ls-tile";
      d.innerHTML = '<div class="tico">💞</div><div class="tnm">Life</div>';
      d.onclick = () => { try { window.__ph3d_phone.hide(); } catch (e) {} openLifeApp(); };
      grid.appendChild(d); clearInterval(iv);
    }
    if (++tries > 180) clearInterval(iv);
  }, 1000);
})();
window.addEventListener("keydown", (e) => { if (e.key === "Escape" && appEl) appEl.style.display = "none"; });
