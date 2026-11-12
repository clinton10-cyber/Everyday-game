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
import {
  Wardrobe, SHIRT_COLORS, withPlayerLook,
  TOP_STYLES, BOTTOM_STYLES, SHOE_STYLES, PATTERNS, DRESS_SHAPES, HAT_STYLES, GLASS_STYLES,
  NECK_STYLES, EAR_STYLES, WRIST_STYLES, BAG_STYLES, TIE_STYLES,
  BOTTOM_COLORS, SHOE_COLORS, ACCENT_COLORS, GEAR_COLORS,
} from "./wardrobe.js";
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
  const air = tp.onGround === false || ((tp.pos.y || 0) - (tp.floorY || 0) > 0.3);
  if (air && a.snapped) {                                                  /* you jumped / fly: stay on the ground, no dragging */
    ctl._intentSpeed = 0; g.position.set(ctl.pos.x, ctl.pos.y, ctl.pos.z); g.rotation.y = ctl.yaw; return;
  }
  if (holding && a.snapped && d < 5 && free(bx, bz)) {                    /* hands stay together at any speed */
    const k = 1 - Math.exp(-dt * 16);
    ctl.pos.x += dx * k; ctl.pos.z += dz * k; sp = clamp(d * 8, 0, 6); a.stuck = 0;
  } else if (d > 40 || a.stuck > 1.6 || !a.snapped) {                     /* lost, stuck, or just arrived: stand beside you */
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

/* ═══ sit / lie with you (interiors) ════════════════════════════
   When you sit or lie down your family finds the closest free seat (or bed) to yours and takes it.
   No seat → they sit on the floor beside you. They stand up when you do. */
function postureOf(tp) {
  const st = tp.state;
  if ((st === "sitting" || st === "lying") && tp.sitTarget) return { kind: st === "lying" ? "lie" : "sit", seat: tp.sitTarget };
  return null;
}
function releaseSeat(a) {
  if (a.seat && a.seat._famTaken === a.p.id) { a.seat._famTaken = null; a.seat.taken = false; }
  a.seat = null; a.seated = false;
  a.ctl.state = "standing"; a.ctl.sitTarget = null;
}
function chooseSeat(a, tp, post, side) {
  const seats = (tp.world && tp.world.seats) || [];
  const ps = post.seat;
  const wantLie = post.kind === "lie";
  let best = null, bd = 12 * 12;
  for (const s of seats) {
    if (s === ps || s.taken || s._famTaken || (s.level != null && s.level !== tp.level)) continue;
    const okType = wantLie ? s.type === "lie" : (s.type === "sit" || s.type === "seat" || s.type === undefined);
    if (!okType) continue;
    const dx = s.x - ps.x, dz = s.z - ps.z, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = s; }
  }
  if (best) { best._famTaken = a.p.id; best.taken = true; return best; }
  const yaw = tp.yaw || 0, rx = Math.cos(yaw) * side, rz = -Math.sin(yaw) * side;
  if (wantLie && (ps.w === undefined || ps.w >= 1.4)) {                     /* share the bed: other side */
    return Object.assign({}, ps, { x: ps.x + rx * 0.45, z: ps.z + rz * 0.45 });
  }
  return { type: "sit", label: "GROUND", x: tp.pos.x + rx * 0.95, z: tp.pos.z + rz * 0.95, dx: Math.sin(yaw), dz: Math.cos(yaw),
    yaw, h: (tp.floorY || 0) + 0.045, level: tp.level, taken: false };
}
function seatStep(a, dt, free) {
  const ctl = a.ctl, g = a.group, s = a.seat;
  const dx = s.x - ctl.pos.x, dz = s.z - ctl.pos.z, d = Math.hypot(dx, dz);
  let sp = 0;
  if (!a.seated) {
    if (d < 0.3) {
      ctl.pos.x = s.x; ctl.pos.z = s.z; ctl.yaw = s.yaw || 0; a.seated = true;
      ctl.state = s.type === "lie" ? "lying" : "sitting"; ctl.sitTarget = s; ctl.level = s.level || 0;
    } else {
      sp = clamp(1.4 + d, 0, 3.4);
      const step = Math.min(d, sp * dt), nx = ctl.pos.x + (dx / d) * step, nz = ctl.pos.z + (dz / d) * step;
      if (free(nx, nz)) { ctl.pos.x = nx; ctl.pos.z = nz; } else if (free(nx, ctl.pos.z)) ctl.pos.x = nx; else if (free(ctl.pos.x, nz)) ctl.pos.z = nz; else { ctl.pos.x = s.x; ctl.pos.z = s.z; }
      const want = Math.atan2(dx, dz), da = Math.atan2(Math.sin(want - ctl.yaw), Math.cos(want - ctl.yaw));
      ctl.yaw += clamp(da, -8 * dt, 8 * dt);
    }
  } else { ctl.pos.x = s.x; ctl.pos.z = s.z; ctl.yaw = s.yaw || 0; }
  ctl._intentSpeed = sp;
  ctl.pos.y = s.type === "lie" && a.seated ? (s.h || 0) - 0.022 : (ctl.pos.y || 0);
  g.position.set(ctl.pos.x, ctl.pos.y, ctl.pos.z); g.rotation.y = ctl.yaw;
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
      n._holding = !!s.hold;
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
  const post = postureOf(tp);
  let side = 1;
  for (const m of list) {
    const a = _live.get(m.p.id); if (!a) continue;
    const s = plan.get(m.p.id); if (!s) continue;
    if (post) {
      if (!a.seat) { a.seat = chooseSeat(a, tp, post, side); a.seated = false; side = -side; }
      seatStep(a, dt, free);
    } else {
      if (a.seat) releaseSeat(a);
      stepAvatar(a, tp, s, dt, free);
    }
  }
  applyHold(tp, list, plan);
  if (post) { tp._holdArms = null; for (const a of _live.values()) a.ctl._holdArms = null; }   /* arms relax while sitting */
  for (const a of _live.values()) { try { Animator.animate(a.ctl, dt); } catch (e) {} }
}

/* ═══ UI: dress panel ═══════════════════════════════════════════ */
let panel = null, panelWho = null;
function css() {
  if (document.getElementById("fam-css")) return;
  const s = document.createElement("style"); s.id = "fam-css";
  s.textContent = `
#fam-panel{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 92px);transform:translateX(-50%);z-index:9600;width:min(94vw,470px);max-height:72vh;display:flex;flex-direction:column;background:rgba(10,16,13,.97);border:1px solid rgba(255,122,168,.45);border-radius:16px;padding:10px 12px 12px;color:#fff;font-family:Inter,system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6)}
#fam-panel h3{margin:0 0 6px;display:flex;align-items:center;gap:10px;flex:none}
#fam-panel h3 .t{flex:1;font:900 16px Inter,system-ui,sans-serif;display:flex;flex-direction:column;line-height:1.15}
#fam-panel h3 .t small{font:600 11px Inter,system-ui,sans-serif;opacity:.65}
#fam-panel h3 .pv{display:flex;flex-direction:column;gap:2px}
#fam-panel h3 .pv i{display:block;width:26px;height:9px;border-radius:5px;border:1px solid #fff3}
#fam-panel .row{display:flex;flex-wrap:wrap;gap:6px;margin:5px 0}
#fam-panel .row.tabs,#fam-panel .row.who{flex-wrap:nowrap;overflow-x:auto;flex:none;scrollbar-width:none}
#fam-panel .row.tabs::-webkit-scrollbar,#fam-panel .row.who::-webkit-scrollbar{display:none}
#fam-panel .body{overflow-y:auto;flex:1;min-height:0;-webkit-overflow-scrolling:touch;padding-top:2px}
#fam-panel .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:6px 0}
#fam-panel button{border:1px solid #ffffff33;background:#1c2b24;color:#fff;border-radius:10px;padding:8px 10px;font:700 12px Inter,system-ui,sans-serif;touch-action:manipulation;white-space:nowrap}
#fam-panel button.on{border-color:#ff7aa8;background:#5a2a40}
#fam-panel .card{display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 4px;white-space:normal;text-align:center;line-height:1.15;font-size:11px}
#fam-panel .card .ic{font-size:22px}
#fam-panel .chip.wide{flex:1}
#fam-panel .sw{width:30px;height:30px;padding:0;border-radius:50%;flex:none}
#fam-panel .sw.on{outline:2px solid #fff;outline-offset:1px}
#fam-panel .lbl{opacity:.7;font-size:11px;margin-top:8px;letter-spacing:.06em;text-transform:uppercase}
#fam-panel .hint{opacity:.55;font-size:11px;margin:2px 0}
@media (max-height:520px){#fam-panel{left:auto;right:8px;bottom:8px;transform:none;width:min(52vw,460px);max-height:calc(100vh - 16px)}#fam-panel .grid{grid-template-columns:repeat(4,1fr)}}`;

  document.head.appendChild(s);
}
function closeDress() { if (panel) { panel.remove(); panel = null; } }

/* ── dress & formal-wear catalogue ───────────────────────────────
   Each entry is a complete look. accessories use { style, color } (colour = index into the gear / shirt palettes). */
const DRESSES = [
  { id: "lbd",      icon: "🖤", name: "Little black",   v: { topStyle: "dress", dressStyle: "pencil", topColor: "#111827", topPattern: "solid", shoeStyle: "heels", neck: { style: "pearls", color: 1 } } },
  { id: "redparty", icon: "❤️", name: "Red party",      v: { topStyle: "dress", dressStyle: "skater", topColor: "#dc2626", topPattern: "solid", shoeStyle: "heels", ears: { style: "hoops", color: 3 } } },
  { id: "sundress", icon: "🌻", name: "Sundress",       v: { topStyle: "dress", dressStyle: "aline", topColor: "#fbbf24", topPattern: "dots", topAccent: "#ffffff", shoeStyle: "sandals" } },
  { id: "maxi",     icon: "🌿", name: "Maxi",           v: { topStyle: "dress", dressStyle: "maxi", topColor: "#0f766e", topPattern: "solid", shoeStyle: "sandals", wrist: { style: "bangles", color: 3 } } },
  { id: "ankara",   icon: "🧵", name: "Ankara gown",    v: { topStyle: "dress", dressStyle: "aline", topColor: "#e84a5f", topPattern: "ankara", topAccent: "#fbbf24", shoeStyle: "heels", hat: { style: "gele", color: 3 } } },
  { id: "kente",    icon: "👑", name: "Kente ball gown",v: { topStyle: "dress", dressStyle: "ball", topColor: "#f59e0b", topPattern: "kente", topAccent: "#16a34a", shoeStyle: "heels", neck: { style: "beads", color: 3 } } },
  { id: "church",   icon: "⛪", name: "Church white",   v: { topStyle: "dress", dressStyle: "maxi", topColor: "#f5f5f4", topPattern: "solid", shoeStyle: "sandals", hat: { style: "headscarf", color: 5 } } },
  { id: "office",   icon: "💼", name: "Office pleated", v: { topStyle: "dress", dressStyle: "pleated", topColor: "#3a5a7a", topPattern: "solid", shoeStyle: "heels" } },
  { id: "tulip",    icon: "🌷", name: "Pink tulip",     v: { topStyle: "dress", dressStyle: "tulip", topColor: "#ec4899", topPattern: "solid", shoeStyle: "heels" } },
  { id: "hanky",    icon: "🦋", name: "Handkerchief",   v: { topStyle: "dress", dressStyle: "handkerchief", topColor: "#7c3aed", topPattern: "solid", shoeStyle: "heels" } },
  { id: "wedding",  icon: "💍", name: "Wedding gown",   v: { topStyle: "dress", dressStyle: "ball", topColor: "#ffffff", topPattern: "solid", shoeStyle: "heels", neck: { style: "pearls", color: 1 }, ears: { style: "drops", color: 2 } } },
  { id: "gala",     icon: "✨", name: "Gala maxi",      v: { topStyle: "dress", dressStyle: "maxi", topColor: "#7f1d1d", topPattern: "solid", shoeStyle: "heels", ears: { style: "drops", color: 3 }, wrist: { style: "bangles", color: 3 } } },
  { id: "stripe",   icon: "🎀", name: "Striped skater", v: { topStyle: "dress", dressStyle: "skater", topColor: "#3a7bd5", topPattern: "stripes-h", topAccent: "#ffffff", shoeStyle: "sneakers" } },
  { id: "beach",    icon: "🏖", name: "Beach dress",    v: { topStyle: "dress", dressStyle: "skater", topColor: "#14b8a6", topPattern: "solid", shoeStyle: "flipflops", glasses: { style: "shades", color: 0 } } },
  { id: "princess", icon: "👸", name: "Princess",       v: { topStyle: "dress", dressStyle: "ball", topColor: "#f9a8d4", topPattern: "solid", shoeStyle: "sandals", hat: { style: "crown", color: 3 } }, kidOnly: true },
];
const FORMAL = [
  { id: "suit",    icon: "🤵", name: "Suit & tie",   v: { topStyle: "suit", tie: "classic", topColor: "#1e293b", topPattern: "solid", bottomStyle: "baggy", bottomColor: "#1e293b", shoeStyle: "formal" } },
  { id: "tux",     icon: "🎩", name: "Tuxedo",       v: { topStyle: "suit", tie: "bow", topColor: "#111827", topPattern: "solid", bottomStyle: "baggy", bottomColor: "#111827", shoeStyle: "formal" } },
  { id: "agbada",  icon: "🧵", name: "Agbada",       v: { topStyle: "agbada", topColor: "#f5f5f4", topPattern: "solid", topAccent: "#d4af37", bottomStyle: "baggy", bottomColor: "#f3e9d2", shoeStyle: "formal", hat: { style: "fila", color: 5 } } },
  { id: "dashiki", icon: "🌍", name: "Dashiki",      v: { topStyle: "dashiki", topColor: "#16a34a", topPattern: "dots", topAccent: "#ffffff", bottomStyle: "baggy", bottomColor: "#f5f5f4", shoeStyle: "sandals" } },
  { id: "kaftan",  icon: "🕌", name: "Kaftan",       v: { topStyle: "kaftan", topColor: "#1e3a8a", topPattern: "solid", bottomStyle: "baggy", bottomColor: "#1e3a8a", shoeStyle: "formal" } },
  { id: "blazer",  icon: "🧥", name: "Blazer",       v: { topStyle: "jacket", topColor: "#1e293b", topPattern: "solid", bottomStyle: "jeans", bottomColor: "#3a5a7a", shoeStyle: "loafers" } },
  { id: "polo",    icon: "👔", name: "Smart polo",   v: { topStyle: "polo", topColor: "#f0f0f0", topPattern: "solid", bottomStyle: "cargo", bottomColor: "#111827", shoeStyle: "loafers" } },
  { id: "beachm",  icon: "🏖", name: "Beach",        v: { topStyle: "singlet", topColor: "#0ea5e9", topPattern: "solid", bottomStyle: "bermuda", bottomColor: "#f5f5f4", shoeStyle: "flipflops" } },
];
const BY_ID = Object.fromEntries(DRESSES.concat(FORMAL).map((d) => [d.id, d]));
/* one-tap sets for the whole family: [mum/woman, man, girl, boy] */
const FAMILY_SETS = [
  { id: "church",  icon: "⛪", label: "Church Sunday", f: "church",   m: "agbada", g: "church",   b: "dashiki" },
  { id: "wedding", icon: "💍", label: "Wedding day",   f: "wedding",  m: "tux",    g: "princess", b: "suit" },
  { id: "party",   icon: "🎉", label: "Party night",   f: "redparty", m: "blazer", g: "stripe",   b: "polo" },
  { id: "gala",    icon: "✨", label: "Gala",          f: "gala",     m: "suit",   g: "tulip",    b: "suit" },
  { id: "beach",   icon: "🏖", label: "Beach day",     f: "beach",    m: "beachm", g: "beach",    b: "beachm" },
  { id: "ankara",  icon: "🧵", label: "Ankara & traditional", f: "ankara", m: "agbada", g: "ankara", b: "dashiki" },
];
const GIRLISH = (p) => p.g === "feminine";
const LABELS = { dress: "Dress", tube: "Tube top", croptop: "Crop top", vneck: "V-neck", longsleeve: "Long sleeve", tshirt: "T-shirt", hoodie: "Hoodie", tank: "Tank", jacket: "Jacket", singlet: "Singlet",
  suit: "Suit", polo: "Polo", sweater: "Sweater", turtleneck: "Turtleneck", bomber: "Bomber", jersey: "Jersey", dashiki: "Dashiki", kaftan: "Kaftan", agbada: "Agbada",
  jeans: "Jeans", shorts: "Shorts", tracksuit: "Tracksuit", baggy: "Baggy", cargo: "Cargo", bermuda: "Bermuda", leggings: "Leggings", skirt: "Skirt", miniskirt: "Mini skirt", palazzo: "Palazzo",
  aline: "A-line", skater: "Skater", maxi: "Maxi", ball: "Ball gown", pencil: "Pencil", tulip: "Tulip", pleated: "Pleated", handkerchief: "Handkerchief", auto: "Auto",
  "stripes-h": "Stripes ↔", "stripes-v": "Stripes ↕", checkers: "Checkers", plaid: "Plaid", camo: "Camo", ankara: "Ankara", kente: "Kente", solid: "Plain", dots: "Dots", gradient: "Gradient" };
const lab = (k) => { k = String(k || ""); return LABELS[k] || (k.charAt(0).toUpperCase() + k.slice(1)); };
const isKid = (p) => p.age < 17;

/* apply a ready-made look to one person (kids don't wear heels; adults-only pieces are skipped for kids) */
function applyLook(p, entry, opts = {}) {
  const cfg = cfgOf(p);
  const v = JSON.parse(JSON.stringify(entry.v));
  if (isKid(p) && v.shoeStyle === "heels") v.shoeStyle = "sandals";
  cfg.hat = null; cfg.neck = null; cfg.ears = null; cfg.wrist = null; cfg.glasses = cfg.glasses && opts.keepGlasses ? cfg.glasses : null; cfg.tie = "none";
  Object.assign(cfg, v);
  p.outfit = Object.assign({}, p.outfit, { key: "custom", name: entry.name, auto: false, topColor: null });
  refreshLook(p); Lives.save();
  if (!opts.silent) toast(entry.icon + " " + first(p.name) + " is wearing " + entry.name.toLowerCase());
}
function setField(p, field, value) {
  const cfg = cfgOf(p);
  cfg[field] = value;
  p.outfit = Object.assign({}, p.outfit, { key: "custom", name: "Your mix", auto: false });
  refreshLook(p); Lives.save();
}
function setAcc(p, field, style) {
  const cfg = cfgOf(p), prev = cfg[field];
  setField(p, field, style ? { style, color: prev && prev.color != null ? prev.color : 3 } : null);
}
function setAccColor(p, field, idx) { const cfg = cfgOf(p); if (cfg[field]) setField(p, field, { style: cfg[field].style, color: idx }); }

function dressTheFamily(setId) {
  const set = FAMILY_SETS.find((x) => x.id === setId); if (!set) return;
  for (const { p } of members()) {
    const key = isKid(p) ? (GIRLISH(p) ? set.g : set.b) : (GIRLISH(p) ? set.f : set.m);
    const e = BY_ID[key]; if (e) applyLook(p, e, { silent: true });
  }
  toast(set.icon + " The family is dressed for: " + set.label.toLowerCase());
}
function matchColour(hex) {
  for (const { p } of members()) setField(p, "topColor", hex);
  toast("🎨 Everyone's top is now the same colour");
}

let dressTab = "outfits";
const TABS = [["outfits", "✨ Outfits"], ["dresses", "👗 Dresses"], ["tops", "👕 Tops"], ["bottoms", "👖 Bottoms"], ["shoes", "👟 Shoes"], ["extras", "🎩 Extras"], ["colours", "🎨 Colours"], ["family", "👨‍👩‍👧 Family"]];

function openDress(id) {
  const list = members(); if (!list.length) { toast("You have no spouse or children to dress yet"); return; }
  css();
  const keepScroll = panel ? panel.querySelector(".body").scrollTop : 0;
  closeDress();
  const m = list.find((x) => x.p.id === id) || list.find((x) => x.p.id === panelWho) || list[0]; panelWho = m.p.id;
  const p = m.p, cfg = cfgOf(p), o = p.outfit || {};
  const fem = GIRLISH(p), kid = isKid(p);
  const dressTabLabel = fem ? "👗 Dresses" : "🤵 Formal";
  const who = list.map((x) => `<button data-w="${x.p.id}" class="${x.p.id === p.id ? "on" : ""}">${x.role === "spouse" ? "💍" : "👶"} ${first(x.p.name)}</button>`).join("");
  const tabs = TABS.map(([k, l]) => `<button data-t="${k}" class="${dressTab === k ? "on" : ""}">${k === "dresses" ? dressTabLabel : l}</button>`).join("");
  const card = (attr, e, on) => `<button class="card ${on ? "on" : ""}" ${attr}><span class="ic">${e.icon}</span><span>${e.name}</span></button>`;
  const chip = (attr, label, on) => `<button class="chip ${on ? "on" : ""}" ${attr}>${label}</button>`;
  const swatch = (attr, c, on) => `<button class="sw ${on ? "on" : ""}" ${attr} style="background:${c}"></button>`;
  const hexOf = (v, list2) => (typeof v === "number" ? list2[v] : v);
  let body = "";

  if (dressTab === "outfits") {
    body += `<div class="lbl">Ready-made outfits</div><div class="grid">` +
      Object.keys(OUTFITS).map((k) => card(`data-o="${k}"`, { icon: OUTFITS[k].icon, name: OUTFITS[k].label }, o.key === k && o.auto === false)).join("") + `</div>` +
      `<div class="row"><button data-auto="1" class="chip wide ${o.auto !== false ? "on" : ""}">✨ Auto — changes for the place &amp; time</button></div>`;
  } else if (dressTab === "dresses") {
    const cat = fem ? DRESSES.filter((d) => !d.kidOnly || kid) : FORMAL;
    body += `<div class="lbl">${fem ? "Choose a dress" : "Formal &amp; traditional"}</div><div class="grid">` +
      cat.map((d) => card(`data-l="${d.id}"`, d, o.name === d.name && o.auto === false)).join("") + `</div>`;
    if (fem) body += `<div class="lbl">Dress shape</div><div class="row">` + DRESS_SHAPES.map((sh) => chip(`data-f="dressStyle:${sh}"`, lab(sh), (cfg.dressStyle || "auto") === sh)).join("") + `</div>` +
      `<div class="hint">Shapes show best in the Faceted look.</div>`;
  } else if (dressTab === "tops") {
    const tops = TOP_STYLES.filter((t) => fem || t !== "dress");
    body += `<div class="lbl">Top</div><div class="row">` + tops.map((t) => chip(`data-f="topStyle:${t}"`, lab(t), cfg.topStyle === t)).join("") + `</div>`;
    if (cfg.topStyle === "dress") body += `<div class="lbl">Dress shape</div><div class="row">` + DRESS_SHAPES.map((sh) => chip(`data-f="dressStyle:${sh}"`, lab(sh), (cfg.dressStyle || "auto") === sh)).join("") + `</div>`;
    if (cfg.topStyle === "suit") body += `<div class="lbl">Tie</div><div class="row">` + TIE_STYLES.map((t) => chip(`data-f="tie:${t}"`, lab(t), (cfg.tie || "none") === t)).join("") + `</div>`;
    body += `<div class="lbl">Pattern</div><div class="row">` + PATTERNS.map((t) => chip(`data-f="topPattern:${t}"`, lab(t), (cfg.topPattern || "solid") === t)).join("") + `</div>`;
  } else if (dressTab === "bottoms") {
    body += `<div class="lbl">Bottom</div><div class="row">` + BOTTOM_STYLES.map((t) => chip(`data-f="bottomStyle:${t}"`, lab(t), cfg.bottomStyle === t)).join("") + `</div>` +
      (cfg.topStyle === "dress" ? `<div class="hint">A dress covers the bottom — pick another top to show these.</div>` : "") +
      `<div class="lbl">Pattern</div><div class="row">` + PATTERNS.map((t) => chip(`data-f="bottomPattern:${t}"`, lab(t), (cfg.bottomPattern || "solid") === t)).join("") + `</div>`;
  } else if (dressTab === "shoes") {
    const shoes = SHOE_STYLES.filter((t) => !(kid && (t === "heels" || t === "cleats")));
    body += `<div class="lbl">Shoes</div><div class="row">` + shoes.map((t) => chip(`data-f="shoeStyle:${t}"`, lab(t), cfg.shoeStyle === t)).join("") + `</div>`;
  } else if (dressTab === "extras") {
    const acc = (title, field, styles) => {
      const cur = cfg[field] && cfg[field].style;
      let h = `<div class="lbl">${title}</div><div class="row">` + chip(`data-a="${field}:"`, "None", !cur) + styles.map((t) => chip(`data-a="${field}:${t}"`, lab(t), cur === t)).join("") + `</div>`;
      if (cur) h += `<div class="row">` + GEAR_COLORS.slice(0, 14).map((c, i) => swatch(`data-ac="${field}:${i}"`, c, cfg[field].color === i)).join("") + `</div>`;
      return h;
    };
    body += acc("Hat / headwear", "hat", HAT_STYLES) + acc("Glasses", "glasses", GLASS_STYLES) + acc("Necklace", "neck", NECK_STYLES) +
      acc("Earrings", "ears", EAR_STYLES) + acc("Wrist", "wrist", WRIST_STYLES) + acc("Bag", "bag", BAG_STYLES);
  } else if (dressTab === "colours") {
    const sw = (title, field, colors) => `<div class="lbl">${title}</div><div class="row">` +
      colors.map((c) => swatch(`data-c="${field}:${c}"`, c, String(cfg[field]).toLowerCase() === c)).join("") + `</div>`;
    body += sw(cfg.topStyle === "dress" ? "Dress colour" : "Top colour", "topColor", SHIRT_COLORS) + sw("Pattern accent", "topAccent", ACCENT_COLORS) +
      sw("Bottom colour", "bottomColor", BOTTOM_COLORS) + sw("Shoe colour", "shoeColor", SHOE_COLORS);
  } else if (dressTab === "family") {
    body += `<div class="lbl">Dress the whole family</div><div class="grid">` +
      FAMILY_SETS.map((x) => card(`data-fs="${x.id}"`, { icon: x.icon, name: x.label }, false)).join("") + `</div>` +
      `<div class="lbl">Match everyone's top colour</div><div class="row">` + SWATCHES.map((c) => swatch(`data-mc="${c}"`, c, false)).join("") + `</div>` +
      `<div class="row"><button class="chip wide" data-allauto="1">✨ Everyone back to Auto</button></div>`;
  }

  /* a little preview strip of what they're wearing */
  const tc = hexOf(cfg.topColor, SHIRT_COLORS) || "#888", bc = hexOf(cfg.bottomColor, BOTTOM_COLORS) || "#444", sc = hexOf(cfg.shoeColor, SHOE_COLORS) || "#222";
  const wearing = cfg.topStyle === "dress" ? lab(cfg.dressStyle || "auto") + " dress" : lab(cfg.topStyle) + " · " + lab(cfg.bottomStyle);
  panel = document.createElement("div"); panel.id = "fam-panel";
  panel.innerHTML = `<h3><span class="pv"><i style="background:${tc}"></i><i style="background:${bc}"></i><i style="background:${sc}"></i></span><span class="t">${first(p.name)}<small>${o.name ? o.name + " · " : ""}${wearing}</small></span><button data-x="1">✕</button></h3>
    <div class="row who">${who}</div>
    <div class="row tabs">${tabs}</div>
    <div class="body">${body}</div>`;
  panel.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const d = b.dataset;
    if (d.x) return closeDress();
    if (d.w) return openDress(d.w);
    if (d.t) { dressTab = d.t; return openDress(p.id); }
    if (d.o) { setOutfit(p, d.o, { auto: false, topColor: (p.outfit && p.outfit.topColor) || null }); }
    else if (d.auto) { p.outfit = Object.assign({}, p.outfit, { auto: true }); Lives.save(); autoDress(); }
    else if (d.l) { applyLook(p, BY_ID[d.l]); }
    else if (d.f) { const [k, v] = d.f.split(":"); setField(p, k, v); }
    else if (d.a) { const [k, v] = d.a.split(":"); setAcc(p, k, v || null); }
    else if (d.ac) { const [k, v] = d.ac.split(":"); setAccColor(p, k, +v); }
    else if (d.c) { const i = d.c.indexOf(":"); setField(p, d.c.slice(0, i), d.c.slice(i + 1)); }
    else if (d.fs) { dressTheFamily(d.fs); }
    else if (d.mc) { matchColour(d.mc); }
    else if (d.allauto) { for (const x of members()) { x.p.outfit = Object.assign({}, x.p.outfit, { auto: true }); } Lives.save(); autoDress(); toast("✨ Everyone is on Auto"); }
    openDress(p.id);
  };
  document.body.appendChild(panel);
  const bodyEl = panel.querySelector(".body"); if (bodyEl) bodyEl.scrollTop = keepScroll;
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
