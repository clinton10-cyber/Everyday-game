/* ════════════════════════════════════════════════════════════════
   family.js — your spouse and children, with you in EVERY scene.

   • CALL    📞  Bring your spouse + kids to your side in any scene (city, interiors, house,
                 church, prison visit, plane…). They follow you through doors and stay until
                 you send them home. In the open city the existing life-sim companions are
                 used; everywhere else lightweight avatars of the SAME people are spawned
                 (same face, same clothes) and driven here, so no scene needs NPC support.
   • HOLD    🤝  Walk holding hands, or link arms (spouse) — real arm poses on both
                 characters (animator.js "hold layer"), with the kids' hand held low.
   • DRESS   👗  Choose an outfit for your spouse and each child (casual, smart, traditional,
                 party, sport, beach, school, sleepwear) and a colour. Or leave them on AUTO:
                 they change into something suitable for the place and time of day.

   State is saved on the life-sim person records (p.cfg = look, p.outfit = {key, auto}).
   ════════════════════════════════════════════════════════════════ */
import * as THREE from "three";
import { Lives } from "./npc-lives.js";
import { buildCharacter, liveApplyConfig } from "../characters/lowpoly.js";
import * as Animator from "../characters/animator.js";
import { Wardrobe, SHIRT_COLORS, withPlayerLook } from "./wardrobe.js";
import { playerFree } from "./death-pose.js";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} };
const first = (n) => String(n || "").split(" ")[0];

/* ═══ outfits ═══════════════════════════════════════════════════ */
/* colours are plain hex (the wardrobe accepts "#rrggbb" in any colour slot) */
const OUTFITS = {
  casual:      { label: "Casual",      icon: "👕", f: { topStyle: "vneck", bottomStyle: "jeans", shoeStyle: "sneakers" },
                                                  m: { topStyle: "tshirt", bottomStyle: "jeans", shoeStyle: "sneakers" },
                                                  k: { topStyle: "tshirt", bottomStyle: "shorts", shoeStyle: "sneakers" } },
  smart:       { label: "Smart",       icon: "👔", f: { topStyle: "dress", bottomStyle: "skirt", shoeStyle: "heels", bottomColor: "#1e293b" },
                                                  m: { topStyle: "suit", bottomStyle: "baggy", shoeStyle: "formal", bottomColor: "#1e293b" },
                                                  k: { topStyle: "polo", bottomStyle: "shorts", shoeStyle: "loafers", bottomColor: "#1e293b" } },
  traditional: { label: "Traditional", icon: "🧵", f: { topStyle: "kaftan", topPattern: "ankara", bottomStyle: "palazzo", shoeStyle: "sandals" },
                                                  m: { topStyle: "agbada", bottomStyle: "baggy", shoeStyle: "formal" },
                                                  k: { topStyle: "dashiki", bottomStyle: "baggy", shoeStyle: "sandals" } },
  party:       { label: "Party",       icon: "🎉", f: { topStyle: "dress", bottomStyle: "miniskirt", shoeStyle: "heels", topColor: "#dc2626" },
                                                  m: { topStyle: "jacket", bottomStyle: "jeans", shoeStyle: "loafers" },
                                                  k: { topStyle: "bomber", bottomStyle: "jeans", shoeStyle: "hightops" } },
  sport:       { label: "Sport",       icon: "🏃", f: { topStyle: "croptop", bottomStyle: "leggings", shoeStyle: "sneakers" },
                                                  m: { topStyle: "jersey", bottomStyle: "shorts", shoeStyle: "sneakers" },
                                                  k: { topStyle: "jersey", bottomStyle: "shorts", shoeStyle: "sneakers" } },
  beach:       { label: "Beach",       icon: "🏖", f: { topStyle: "tube", bottomStyle: "shorts", shoeStyle: "flipflops" },
                                                  m: { topStyle: "singlet", bottomStyle: "bermuda", shoeStyle: "flipflops" },
                                                  k: { topStyle: "tank", bottomStyle: "shorts", shoeStyle: "flipflops" } },
  school:      { label: "School",      icon: "🎒", f: { topStyle: "polo", bottomStyle: "skirt", shoeStyle: "sneakers", topColor: "#f0f0f0", bottomColor: "#3a5a7a" },
                                                  m: { topStyle: "polo", bottomStyle: "shorts", shoeStyle: "sneakers", topColor: "#f0f0f0", bottomColor: "#3a5a7a" },
                                                  k: { topStyle: "polo", bottomStyle: "shorts", shoeStyle: "sneakers", topColor: "#f0f0f0", bottomColor: "#3a5a7a" } },
  sleep:       { label: "Sleepwear",   icon: "🌙", f: { topStyle: "longsleeve", bottomStyle: "tracksuit", shoeStyle: "slippers" },
                                                  m: { topStyle: "tshirt", bottomStyle: "tracksuit", shoeStyle: "slippers" },
                                                  k: { topStyle: "tshirt", bottomStyle: "tracksuit", shoeStyle: "slippers" } },
};
/* swatches for the top colour in the Dress panel */
const SWATCHES = ["#3a7bd5", "#e84a5f", "#16a34a", "#fbbf24", "#7c3aed", "#f0f0f0", "#1e293b", "#ec4899", "#14b8a6", "#f59e0b", "#7f1d1d", "#0f766e"];

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); }
const kindOf = (p) => (p.age < 17 ? "k" : p.g === "feminine" ? "f" : "m");
const pronoun = (p) => (p.g === "feminine" ? "her" : "his");

/* the config fields an outfit writes (everything else — face, hair, skin — stays the person's own) */
function outfitFields(p, key, topColor) {
  const O = OUTFITS[key] || OUTFITS.casual;
  const base = O[kindOf(p)] || O.f;
  const seed = hash(p.id + key + Math.floor(Date.now() / 864e5));          /* stable all day, changes tomorrow */
  const out = Object.assign({ topPattern: "solid", bottomPattern: "solid" }, base);
  if (!out.topColor) out.topColor = SHIRT_COLORS[seed % SHIRT_COLORS.length];
  if (!out.bottomColor) out.bottomColor = ["#2b3446", "#1e293b", "#3d3d3d", "#6b5b4a", "#3a5a7a", "#111827"][(seed >> 3) % 6];
  if (!out.shoeColor) out.shoeColor = ["#161a21", "#f0f0f0", "#8a5a3a", "#1e293b"][(seed >> 5) % 4];
  if (topColor) out.topColor = topColor;
  return out;
}

/* what suits the place + hour? (used by AUTO) */
function autoKey(p, sceneId, hour) {
  const id = String(sceneId || "");
  const kid = p.age < 17, night = hour >= 21 || hour < 6;
  if (/church|mosque|vatican/i.test(id)) return "traditional";
  if (/beach|waterpark|pool/i.test(id)) return "beach";
  if (/gym|stadium|football|pitch|court/i.test(id)) return "sport";
  if (/nightclub|club\b|skybar/i.test(id)) return kid ? "casual" : "party";
  if (/classroom|school|university|computerlab|lecture/i.test(id)) return kid ? "school" : "smart";
  if (/hotel|restaurant|mansion|statehouse|governor|govhouse|vastcity|showroom|realestate|airport|airplane/i.test(id)) return "smart";
  if (/myhouse|duplex|lagosflat|flat|house|home/i.test(id)) return night ? "sleep" : "casual";
  if (/hospital|prison|jail/i.test(id)) return "casual";
  if (night) return kid ? "sleep" : "smart";
  return "casual";
}

/* ═══ people ════════════════════════════════════════════════════ */
function P() { return Lives.player(); }

/* spouse (or partner) + children old enough to walk */
function members() {
  const pl = P(); if (!pl) return [];
  const out = [];
  const sp = Lives.byId(pl.spouse) || Lives.byId(pl.partner);
  if (sp && !sp.dead) out.push({ p: sp, role: "spouse" });
  (pl.kids || []).forEach((id) => {
    const k = Lives.byId(id);
    if (k && !k.dead && k.age >= Lives.INFANT_AGE && k.age < 17) out.push({ p: k, role: "child" });
  });
  return out;
}

function fallbackCfg(p) {
  const f = p.g === "feminine";
  const cfg = JSON.parse(JSON.stringify(Wardrobe.config));
  Object.assign(cfg, { gender: p.g || "neutral", skinTone: 3 + (hash(p.id) % 3), hairStyle: f ? "bob" : "short", hairColor: 0, hat: null, glasses: null, beard: null, neck: null, ears: null, wrist: null, bag: null, mask: null, costume: null });
  return cfg;
}
const cfgOf = (p) => { if (!p.cfg) p.cfg = fallbackCfg(p); return p.cfg; };

/* ═══ outfit changes ════════════════════════════════════════════ */
const _live = new Map();       /* person id → { group, rig, ctl } own avatar */

function refreshLook(p) {
  const cfg = cfgOf(p);
  const targets = [];
  const av = _live.get(p.id); if (av) targets.push([av.group, av.rig, av.ctl]);
  const n = p._npc; if (n && n.group && n.rig && !n.dead) targets.push([n.group, n.rig, n.ctl]);
  for (const [group, rig, ctl] of targets) {
    try { if (liveApplyConfig(group, rig, cfg) && ctl) ctl._anim = null; } catch (e) { console.warn("[family] dress", e); }
  }
}

function setOutfit(p, key, opts = {}) {
  const cfg = cfgOf(p);
  Object.assign(cfg, outfitFields(p, key, opts.topColor));
  p.outfit = Object.assign({}, p.outfit, { key, auto: !!opts.auto, topColor: opts.topColor || null });
  refreshLook(p);
  Lives.save();
  if (!opts.silent) {
    const O = OUTFITS[key];
    toast((opts.auto ? "👗 " + first(p.name) + " changed into " : "👗 " + first(p.name) + " is wearing ") + (key === "sleep" ? "sleepwear" : O.label.toLowerCase() + " clothes") + " " + O.icon);
  }
}

let _sceneId = "", _autoCheck = 0;
function autoDress() {
  const hour = (window.__ph3d_daynight && window.__ph3d_daynight.hour) || 12;
  for (const { p } of members()) {
    if (p.outfit && p.outfit.auto === false) continue;                   /* dressed by you: leave it */
    const want = autoKey(p, _sceneId, hour);
    if (!p.outfit || p.outfit.key !== want) setOutfit(p, want, { auto: true, silent: !p.outfit });
    else if (!p.outfit.auto) p.outfit.auto = true;
  }
}

/* ═══ hold hands / link arms ════════════════════════════════════ */
/* side: +1 = player's left, -1 = right. spouse takes the left, the first child the right. */
function slots(list) {
  const pl = P(), mode = (pl && pl.hold) || "off";
  const out = new Map();
  let kidHeld = false;
  for (const m of list) {
    const id = m.p.id;
    if (m.role === "spouse") {
      out.set(id, mode === "off"
        ? { side: 0.95, back: 0.25, hold: null }
        : mode === "elbow" ? { side: 0.62, back: 0.0, hold: { kind: "link", arm: "L" } } : { side: 0.74, back: 0.0, hold: { kind: "hand", arm: "L" } });
    }
  }
  let i = 0;
  for (const m of list) {
    if (m.role !== "child") continue;
    const sc = clamp(0.38 + m.p.age * 0.036, 0.38, 1);
    if (mode !== "off" && !kidHeld) {                                    /* one child by the hand */
      kidHeld = true;
      out.set(m.p.id, { side: -(0.46 + 0.22 * sc), back: 0.0, hold: { kind: "hand", arm: "R", up: 1 - sc } });
    } else {
      const j = i++;
      out.set(m.p.id, { side: (j % 2 ? 0.8 : -0.8) * (1 + 0.3 * Math.floor(j / 2)), back: 1.1 + 0.5 * Math.floor(j / 2), hold: null });
    }
  }
  return out;
}

/* Hold arms per character. The player gets one entry per held hand. */
function applyHold(tp, list, plan) {
  const mine = [];
  for (const m of list) {
    const s = plan.get(m.p.id); if (!s) continue;
    const ctl = (_live.get(m.p.id) || {}).ctl || (m.p._npc && m.p._npc.ctl);
    if (!ctl) continue;
    if (s.hold) {
      /* the companion uses the arm nearest the player: player's left ⇒ companion's right */
      const cArm = s.hold.arm === "L" ? "R" : "L";
      ctl._holdArms = [{ kind: s.hold.kind === "link" ? "linker" : "hand", arm: cArm, up: s.hold.up || 0 }];
      mine.push({ kind: s.hold.kind === "link" ? "linked" : "hand", arm: s.hold.arm, up: 0, kid: !!s.hold.up });
    } else ctl._holdArms = null;
  }
  tp._holdArms = mine.length ? mine : null;
}

/* ═══ own avatars (non-city scenes) ═════════════════════════════ */
const _V = new THREE.Vector3();
function rootOf(o) { while (o && o.parent) o = o.parent; return o; }

function makeAvatar(p, tp) {
  const cfg = withPlayerLook(cfgOf(p));
  const built = buildCharacter(cfg);
  const group = built.root, rig = built.rig;
  const sc = p.age < 17 ? clamp(0.38 + p.age * 0.036, 0.38, 1) : 1;
  group.scale.setScalar(sc);
  const ctl = {
    rig, pos: { x: tp.pos.x, y: 0, z: tp.pos.z }, yaw: tp.yaw || 0,
    state: "standing", onGround: true, level: 0, vel: { y: 0 },
    _intentSpeed: 0, _ul: () => {},
    _emoteTimer: 0, _emoteName: null, _emotePhase: 0, _useTimer: 0, _useBend: 0.3,
    weapons: null, held: null, phoneHold: false, sitTarget: null,
  };
  group.position.set(tp.pos.x, tp.floorY || 0, tp.pos.z);
  return { group, rig, ctl, p, sc, stuck: 0, snapped: false, parent: null };
}

function dropAvatar(id) {
  const a = _live.get(id); if (!a) return;
  try { if (a.group.parent) a.group.parent.remove(a.group); a.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } catch (e) {}
  _live.delete(id);
}
function dropAll() { for (const id of [..._live.keys()]) dropAvatar(id); }

function stepAvatar(a, tp, slot, dt, free) {
  const ctl = a.ctl, g = a.group;
  const yaw = tp.yaw || 0, sy = Math.sin(yaw), cy = Math.cos(yaw);
  const bx = tp.pos.x + cy * slot.side - sy * slot.back, bz = tp.pos.z - sy * slot.side - cy * slot.back;
  const dx = bx - ctl.pos.x, dz = bz - ctl.pos.z, d = Math.hypot(dx, dz);
  let sp = 0;
  const holding = !!slot.hold;
  if (d > 14 || a.stuck > 1.6 || !a.snapped) {                            /* lost, stuck, or just arrived: stand beside you */
    let tx = bx, tz = bz;
    if (!free(tx, tz)) { tx = tp.pos.x - sy * 0.9; tz = tp.pos.z - cy * 0.9; }
    ctl.pos.x = tx; ctl.pos.z = tz; a.stuck = 0; a.snapped = true; ctl.yaw = yaw;
  } else if (d > (holding ? 0.08 : 0.45)) {
    sp = clamp(1.1 + d * 1.6, 0, holding ? 5.2 : 4.6);
    if (holding && d < 0.5) sp = clamp(d * 6, 0, 3);
    const step = Math.min(d, sp * dt), nx = ctl.pos.x + (dx / d) * step, nz = ctl.pos.z + (dz / d) * step;
    if (free(nx, nz)) { ctl.pos.x = nx; ctl.pos.z = nz; a.stuck = Math.max(0, a.stuck - dt); }
    else if (free(nx, ctl.pos.z)) { ctl.pos.x = nx; a.stuck += dt * 0.5; }
    else if (free(ctl.pos.x, nz)) { ctl.pos.z = nz; a.stuck += dt * 0.5; }
    else { sp = 0; a.stuck += dt; }
  }
  /* facing: walk direction while moving, your direction while standing / holding hands */
  let want = (sp > 0.6 && !holding) ? Math.atan2(dx, dz) : yaw;
  let da = Math.atan2(Math.sin(want - ctl.yaw), Math.cos(want - ctl.yaw));
  ctl.yaw += clamp(da, -6 * dt, 6 * dt);
  ctl._intentSpeed = sp;
  const fy = tp.floorY || 0;
  ctl.pos.y += (fy - ctl.pos.y) * Math.min(1, dt * 10);
  g.position.set(ctl.pos.x, ctl.pos.y, ctl.pos.z);
  g.rotation.y = ctl.yaw;
}

/* ═══ main loop (independent of any scene) ══════════════════════ */
let _last = 0, _tpSeen = null;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, _last ? (now - _last) / 1000 : 0.016); _last = now;
  const pl = P(); if (!pl) return;
  const list = members();

  /* player controller of the current walking scene */
  const tp = window.__ph3d_walkCtrl || window.__ph3d_tp;
  const root = tp && tp.avatar && rootOf(tp.avatar);
  const live = !!(tp && tp.pos && tp.avatar && tp.avatar.visible !== false && root && root.isScene);

  /* scene id → auto outfits */
  const sid = (window.__ph3d_router && window.__ph3d_router.current && window.__ph3d_router.current.sceneId) || "city";
  if (sid !== _sceneId) { _sceneId = sid; _autoCheck = 0; }
  _autoCheck -= dt;
  if (_autoCheck <= 0) { _autoCheck = 20; if (list.length) autoDress(); }

  if (!pl.called || !list.length) { if (_live.size) dropAll(); if (tp && tp._holdArms) tp._holdArms = null; return; }

  const plan = slots(list);

  /* open city: the life-sim companions do the walking; we add the hold layer + dress */
  if (Lives.isCity()) {
    if (_live.size) dropAll();
    for (const m of list) {
      const n = m.p._npc; if (!n || n.dead) continue;
      const s = plan.get(m.p.id); if (!s) continue;
      if (n._famOff0 === undefined) n._famOff0 = n._lifeOff || null;
      if (n.state === "life_follow" && n._lifeLead === "player") n._lifeOff = [s.side, s.back];
    }
    if (tp && live) applyHold(tp, list, plan);
    return;
  }

  /* everywhere else: our own avatars */
  if (!live) { for (const a of _live.values()) a.group.visible = false; return; }
  if (_tpSeen !== tp) { _tpSeen = tp; dropAll(); }                        /* new scene → rebuild next to you */
  for (const m of list) {
    const id = m.p.id; let a = _live.get(id);
    if (a && a.parent !== root) { dropAvatar(id); a = null; }
    if (!a) {
      if (m.p.preg && m.role === "spouse") continue;                      /* expecting: resting at home */
      a = makeAvatar(m.p, tp); a.parent = root; root.add(a.group); _live.set(id, a);
    }
    a.group.visible = true;
  }
  const free = playerFree(tp);
  for (const m of list) {
    const a = _live.get(m.p.id); if (!a) continue;
    const s = plan.get(m.p.id); if (!s) continue;
    stepAvatar(a, tp, s, dt, free);
  }
  applyHold(tp, list, plan);
  for (const a of _live.values()) { try { Animator.animate(a.ctl, dt); } catch (e) {} }
}

/* ═══ UI: dress panel ═══════════════════════════════════════════ */
let panel = null, panelWho = null;
function css() {
  if (document.getElementById("fam-css")) return;
  const s = document.createElement("style"); s.id = "fam-css";
  s.textContent = `
#fam-panel{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 92px);transform:translateX(-50%);z-index:9600;width:min(94vw,430px);max-height:70vh;overflow:auto;background:rgba(10,16,13,.97);border:1px solid rgba(255,122,168,.45);border-radius:18px;color:#eaf6ff;font:600 13px Inter,system-ui,sans-serif;box-shadow:0 16px 40px rgba(0,0,0,.6);padding:12px 14px}
#fam-panel h3{margin:0 0 8px;font:900 16px Inter,system-ui,sans-serif;display:flex;justify-content:space-between;align-items:center}
#fam-panel .row{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
#fam-panel button{border:1px solid #ffffff33;background:#1c2b24;color:#fff;border-radius:10px;padding:8px 10px;font:700 12px Inter,system-ui,sans-serif;touch-action:manipulation}
#fam-panel button.on{border-color:#ff7aa8;background:#5a2a40}
#fam-panel .sw{width:30px;height:30px;padding:0;border-radius:50%}
#fam-panel .lbl{opacity:.7;font-size:11px;margin-top:8px;letter-spacing:.06em;text-transform:uppercase}`;
  document.head.appendChild(s);
}
function closeDress() { if (panel) { panel.remove(); panel = null; } }
function openDress(id) {
  const list = members(); if (!list.length) { toast("You have no spouse or children to dress yet"); return; }
  css(); closeDress();
  const m = list.find((x) => x.p.id === id) || list[0]; panelWho = m.p.id;
  const p = m.p, o = p.outfit || {};
  panel = document.createElement("div"); panel.id = "fam-panel";
  const who = list.map((x) => `<button data-w="${x.p.id}" class="${x.p.id === p.id ? "on" : ""}">${x.role === "spouse" ? "💍" : "👶"} ${first(x.p.name)}</button>`).join("");
  const outs = Object.keys(OUTFITS).map((k) => `<button data-o="${k}" class="${o.key === k && o.auto === false ? "on" : ""}">${OUTFITS[k].icon} ${OUTFITS[k].label}</button>`).join("");
  const sws = SWATCHES.map((c) => `<button class="sw ${o.topColor === c ? "on" : ""}" data-c="${c}" style="background:${c}"></button>`).join("");
  panel.innerHTML = `<h3><span>👗 Dress ${first(p.name)}</span><button data-x="1">✕</button></h3>
    <div class="row">${who}</div>
    <div class="lbl">Outfit</div><div class="row">${outs}</div>
    <div class="lbl">Top colour</div><div class="row">${sws}</div>
    <div class="row"><button data-auto="1" class="${o.auto !== false ? "on" : ""}">✨ Auto — changes for the place &amp; time</button></div>`;
  panel.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.x) return closeDress();
    if (b.dataset.w) return openDress(b.dataset.w);
    if (b.dataset.o) { setOutfit(p, b.dataset.o, { auto: false, topColor: (p.outfit && p.outfit.topColor) || null }); return openDress(p.id); }
    if (b.dataset.c) { const key = (p.outfit && p.outfit.key) || "casual"; setOutfit(p, key, { auto: false, topColor: b.dataset.c }); return openDress(p.id); }
    if (b.dataset.auto) { p.outfit = Object.assign({}, p.outfit, { auto: true }); Lives.save(); autoDress(); return openDress(p.id); }
  };
  document.body.appendChild(panel);
}

/* ═══ public API ════════════════════════════════════════════════ */
export const Family = {
  members,
  isCalled: () => !!(P() && P().called),

  /* call everyone to your side / send them home */
  call() {
    const pl = P(); if (!pl) return false;
    if (!members().length) { toast("You have no spouse or children yet"); return false; }
    pl.called = true; pl.companion = true; Lives.save();
    try { Lives.callCompanions(true); } catch (e) {}
    const sp = members().find((m) => m.role === "spouse"), kids = members().filter((m) => m.role === "child").length;
    toast("📞 " + (sp ? first(sp.p.name) : "Your family") + (kids ? " and the kids are" : " is") + " coming to you");
    return true;
  },
  dismiss() {
    const pl = P(); if (!pl) return;
    pl.called = false; pl.hold = "off"; Lives.save();
    try { Lives.callCompanions(false); } catch (e) {}
    dropAll(); closeDress();
    const tp = window.__ph3d_walkCtrl || window.__ph3d_tp; if (tp) tp._holdArms = null;
    toast("🏠 Your family headed home");
  },
  toggleCall() { return this.isCalled() ? (this.dismiss(), false) : this.call(); },

  /* mode: "hand" | "elbow" | "off" — calls the family first if they aren't with you */
  setHold(mode) {
    const pl = P(); if (!pl || !members().length) { toast("You have no spouse or children yet"); return; }
    if (!pl.called) this.call();
    pl.hold = pl.hold === mode ? "off" : mode; Lives.save();
    toast(pl.hold === "hand" ? "🤝 Holding hands" : pl.hold === "elbow" ? "💑 Arm in arm" : "Let go");
  },
  hold: () => (P() && P().hold) || "off",

  dress(id) { openDress(id); },
  setOutfit(personId, key, opts) { const m = members().find((x) => x.p.id === personId); if (m && OUTFITS[key]) setOutfit(m.p, key, opts || { auto: false }); },
  OUTFITS,

  /* action-menu items (used by the Q menu in every walking scene) */
  menuItems() {
    const list = members(); if (!list.length) return [];
    const h = this.hold();
    return [
      { label: this.isCalled() ? "Send home" : "Call family", onClick: () => this.toggleCall() },
      { label: h === "hand" ? "Let go" : "Hold hand", onClick: () => this.setHold("hand") },
      { label: h === "elbow" ? "Unlink" : "Link arms", onClick: () => this.setHold("elbow") },
      { label: "Dress family", onClick: () => this.dress() },
    ];
  },
};

if (typeof window !== "undefined") {
  window.__ph3d_family = Family;
  requestAnimationFrame(loop);
}
