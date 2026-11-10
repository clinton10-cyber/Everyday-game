/* ═══════════════════════════════════════════════════════════════════════
   npc-lives.js — every NPC is a PERSON with their own life.

   • Persistent population (saved in localStorage): name, age, job, home,
     personality (friendliness, temper, romance, loyalty, religion…), looks.
   • Daily SCHEDULE per person (sleep · school · work · lunch · leisure · church);
     people who are indoors are hidden, so the street changes with the hour.
   • Their own relationships with each other: acquaintances → friends → best
     friends, rivals → enemies, crushes → dating → marriage, jealousy and
     cheating, quarrels, pregnancies, births. Children grow up and become adults.
   • Visible behaviour: friends stop to chat, enemies argue, couples and
     parents walk together (children follow their parents).
   • YOU can build relationships too: friend, date, marry, have children
     (the child is a real small NPC that grows and follows you).
   • "People" phone app: family, friends, enemies, everyone, town gossip.

   The simulation runs on the game clock (DayNight.hour) for EVERYONE, near or far.
   ═══════════════════════════════════════════════════════════════════════ */
import { DayNight } from "./daynight.js";
import { Economy } from "./economy.js";
import { Belly, Baby } from "./body-attach.js";

const LS = "ph3d_lives_v1";
const DAYS_PER_YEAR = 4;          /* game days per game year (children grow up) */
const PREG_DAYS = 3;              /* pregnancy length in game days */
const MAX_PEOPLE = 220;
const OUTDOOR_JOBS = new Set(["trader", "police", "taxi", "priest", "banker", "doctor", "mechanic"]);   /* stand at their post */
const JOBS = ["walker", "trader", "walker", "mechanic", "walker", "taxi", "walker", "clerk", "student", "trader"];

const M_NAMES = ["Chinedu", "Emeka", "Obinna", "Tamuno", "Boma", "Ibiso", "Chidi", "Kelechi", "Ebube", "Tonye", "Ikenna", "Dubem", "Sotonye", "Nnamdi", "Tobi", "Ayo", "Musa", "Ibrahim", "Segun", "Chukwudi", "Dagogo", "Preye", "Uche", "Femi"];
const F_NAMES = ["Ngozi", "Ibinabo", "Tonbra", "Amaka", "Chioma", "Ifeoma", "Nkechi", "Ebiere", "Preye", "Blessing", "Joy", "Favour", "Adaeze", "Tamara", "Bisola", "Zainab", "Funke", "Ene", "Oluchi", "Dinma", "Teboho", "Ibiba", "Grace", "Mercy"];
const SURN = ["Okafor", "Amadi", "Wokocha", "Briggs", "Nwosu", "Ejiofor", "Ibe", "Dokubo", "Horsfall", "Eze", "Ogbonna", "Opara", "Nnadi", "Okoro", "Jaja", "Abbey", "Fubara", "Kalio", "Owhonda", "Peterside"];
const GENDERS = ["masculine", "feminine"];

const rnd = Math.random;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const uid = () => "p" + Math.random().toString(36).slice(2, 8);
const toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} };

let S = null;                      /* persistent state */
let host = null;                   /* NPCs (set by npcs.js) */
let lastHourInt = -1, secAcc = 0, saveAcc = 0, cityOn = false, wasHour = 0;
const byId = (id) => (S && S.people[id]) || null;

/* ── life-sim helpers: pregnancy progress, relationship stage, infants ── */
const INFANT_AGE = 1.5;                       /* years — younger than this = carried infant */
const STAGES = ["stranger", "acquaintance", "dating", "engaged", "married"];
const STAGE_LABEL = { stranger: "Stranger", acquaintance: "Acquaintance", dating: "Dating", engaged: "Engaged", married: "Married" };
const LSim = () => (typeof window !== "undefined" ? window.__ph3d_lifesim : null);
function nowAbsDays() { return S.day + DayNight.hour / 24; }
/* 0..1 through the pregnancy (the baby arrives at 06:00 on the due day) */
function pregProgress(p) {
  if (!p || !p.preg || !S) return 0;
  const due = p.preg.due + 0.25;
  const start = p.preg.start != null ? p.preg.start : (p.preg.due - PREG_DAYS);
  return clamp((nowAbsDays() - start) / Math.max(0.5, due - start), 0, 1);
}
/* stranger → acquaintance → dating → engaged → married */
function stageOf(p) {
  const P = S.player;
  if (P.spouse === p.id) return "married";
  if (P.partner === p.id) return P.engaged === p.id ? "engaged" : "dating";
  const r = p.rel.player;
  if (!r || !(r.met > 0)) return "stranger";
  return "acquaintance";
}
function infantOf(p) {                        /* the baby this adult is currently carrying (if any) */
  if (!p || p.age < 16 || !p.kids) return null;
  for (const id of p.kids) { const k = byId(id); if (k && !k.dead && k.age < INFANT_AGE && S.player.held !== k.id) return k; }
  return null;
}
function topUpInfants() {                     /* keep a few babies in town so carrying parents are visible */
  try {
    let have = Object.values(S.people).filter((q) => !q.dead && q.age < INFANT_AGE && q.role === "kid").length;
    if (have >= 5) return;
    const moms = Object.values(S.people).filter((q) => !q.dead && q.g === "feminine" && q.spouse && q.spouse !== "player" && q.age >= 21 && q.age < 40 && q.kids.length < 4 && !q.preg);
    let guard = 0;
    while (have < 5 && moms.length && guard++ < 12) {
      const m = pick(moms), f = byId(m.spouse); if (!f || f.dead) continue;
      const kid = birth(m, f, true); kid.age = 0.1 + rnd() * 1.2; kid.bornDay = S.day; have++;
    }
  } catch (e) {}
}

/* ── state ───────────────────────────────────────────────────────────── */
function load() {
  try { const j = localStorage.getItem(LS); if (j) { const o = JSON.parse(j); if (o && o.people) return o; } } catch (e) {}
  return null;
}
function save() {
  try {
    const o = JSON.parse(JSON.stringify(S, (k, v) => (k === "_npc" || k === "_tag" ? undefined : v)));
    localStorage.setItem(LS, JSON.stringify(o));
  } catch (e) {}
}
function absHour() { return S.day * 24 + Math.floor(DayNight.hour); }

function newPerson(o) {
  const g = o.g || pick(GENDERS);
  const p = {
    id: uid(), g, age: o.age != null ? o.age : 18 + Math.floor(rnd() * 40),
    name: (g === "feminine" ? pick(F_NAMES) : pick(M_NAMES)) + " " + (o.surname || pick(SURN)),
    role: o.role || pick(JOBS), home: o.home || "H" + Math.random().toString(36).slice(2, 6),
    tr: { ext: rnd(), kind: rnd(), temper: rnd(), rom: rnd(), loy: 0.25 + rnd() * 0.75, amb: rnd(), rel: rnd() },
    attr: rnd() < 0.9 ? (g === "feminine" ? "m" : "f") : (rnd() < 0.5 ? "b" : (g === "feminine" ? "f" : "m")),
    cfg: o.cfg || null, rel: {}, spouse: null, partner: null, partnerSince: 0, kids: [], parents: o.parents || [],
    preg: null, act: "home", place: "home", out: false, mood: 0.6, dead: false, shift: rnd() < 0.25 ? 1 : 0, owl: rnd() < 0.2,
    plan: { eve: "home", day: -1 }, hang: 0, bornDay: S ? S.day : 0, affair: null,
  };
  if (p.age < 18) p.role = "kid";
  S.people[p.id] = p;
  return p;
}
function genStart() {
  S = { v: 1, day: 0, people: {}, log: [], player: { spouse: null, partner: null, kids: [], companion: true, home: "H_player" } };
  /* families */
  const n = 14;
  for (let i = 0; i < n; i++) {
    const surname = pick(SURN), hh = "H" + i;
    const hus = newPerson({ g: "masculine", age: 24 + Math.floor(rnd() * 28), surname, home: hh });
    if (rnd() < 0.62) {
      const wife = newPerson({ g: "feminine", age: Math.max(20, hus.age - 6 + Math.floor(rnd() * 10)), surname, home: hh });
      hus.attr = "f"; wife.attr = "m"; marry(hus, wife, true);
      const kids = Math.floor(rnd() * 3.2);
      for (let k = 0; k < kids; k++) birth(wife, hus, true);
    }
  }
  /* singles, roommates, elders */
  for (let i = 0; i < 24; i++) newPerson({ age: 18 + Math.floor(rnd() * 45) });
  for (const r of ["police", "police", "banker", "doctor", "doctor", "priest", "priest", "mechanic", "taxi", "trader", "trader"]) newPerson({ age: 26 + Math.floor(rnd() * 30), role: r });
  for (let i = 0; i < 4; i++) newPerson({ age: 58 + Math.floor(rnd() * 14), role: pick(["walker", "trader", "priest"]) });
  /* people already know the neighbours */
  const all = Object.values(S.people);
  for (let i = 0; i < all.length * 3; i++) { const a = pick(all), b = pick(all); if (a !== b && a.age >= 16 && b.age >= 16) interact(a, b, true); }
}

/* ── relationships ───────────────────────────────────────────────────── */
function getRel(a, b) {
  let r = a.rel[b.id];
  if (!r) { r = a.rel[b.id] = { v: 0, met: 0, last: 0 }; b.rel[a.id] = b.rel[a.id] || { v: 0, met: 0, last: 0 }; }
  return r;
}
function setBoth(a, b, fn) { fn(getRel(a, b)); fn(getRel(b, a)); }
function relType(r, p, other) {
  if (!r) return "stranger";
  if (p && other && (p.spouse === other.id)) return "spouse";
  if (p && other && (p.partner === other.id)) return "partner";
  if (r.fam) return "family";
  if (r.v <= -40) return "enemy";
  if (r.v >= 70 && r.met >= 6) return "best friend";
  if (r.v >= 35 && r.met >= 3) return "friend";
  if (r.v <= -18) return "rival";
  if (r.met >= 1) return "acquaintance";
  return "stranger";
}
function typeBetween(a, b) { return relType(a.rel[b.id], a, b); }
function attracted(a, b) {
  if (a.age < 18 || b.age < 18) return false;
  return a.attr === "b" || (a.attr === "m" && b.g === "masculine") || (a.attr === "f" && b.g === "feminine");
}
function log(txt) { S.log.unshift({ d: S.day, h: Math.floor(DayNight.hour), t: txt }); if (S.log.length > 60) S.log.length = 60; }

function interact(a, b, quiet) {
  const ra = getRel(a, b), rb = getRel(b, a);
  const before = relType(ra, a, b);
  let dv = (a.tr.kind + b.tr.kind) * 2 + (a.tr.ext + b.tr.ext) * 1.2 - 2.4 - a.tr.temper * b.tr.temper * 6 + (rnd() * 6 - 3);
  if (ra.fam) dv += 1.4;
  if (a.spouse === b.id) dv += 1.2;
  if (a.partner === b.id) dv += 0.8;
  if (attracted(a, b) && attracted(b, a)) dv += 1.5 * (a.tr.rom + b.tr.rom) * 0.5;
  dv = clamp(dv, -6, 6);
  ra.v = clamp(ra.v + dv, -100, 100); rb.v = clamp(rb.v + dv + (rnd() * 2 - 1), -100, 100);
  ra.met++; rb.met++; ra.last = rb.last = S.day;
  if (quiet) return;
  const after = relType(ra, a, b);
  if (before !== after) {
    if (after === "friend") log(a.name + " and " + b.name + " became friends");
    else if (after === "best friend") log(a.name + " and " + b.name + " are now best friends");
    else if (after === "enemy") log(a.name + " and " + b.name + " are now enemies");
  }
  if (dv < -4.5 && a.tr.temper + b.tr.temper > 1.3 && rnd() < 0.12) log(a.name + " and " + b.name + " had a loud argument");
  /* romance */
  if (!a.spouse && !b.spouse && !a.partner && !b.partner && attracted(a, b) && attracted(b, a) && ra.v >= 38 && rb.v >= 38 && !ra.fam && rnd() < 0.4) {
    a.partner = b.id; b.partner = a.id; a.partnerSince = b.partnerSince = S.day;
    log(a.name + " and " + b.name + " started dating ❤");
  }
  /* jealousy / cheating */
  if ((a.spouse || a.partner) && a.spouse !== b.id && a.partner !== b.id && !a.affair && attracted(a, b) && attracted(b, a)
      && ra.v >= 50 && (1 - a.tr.loy) * rnd() > 0.5 && rnd() < 0.05) {
    a.affair = b.id; log("Rumour: " + a.name + " is seeing " + b.name + " behind their partner's back…");
  }
}
function marry(a, b, quiet) {
  a.spouse = b.id; b.spouse = a.id; a.partner = b.partner = null;
  setBoth(a, b, (r) => { r.v = Math.max(r.v, 75); r.met = Math.max(r.met, 8); });
  b.home = a.home;
  if (!quiet) log(a.name + " and " + b.name + " got married 💍");
}
function split(a, b, divorce) {
  if (a.spouse === b.id) a.spouse = null; if (b.spouse === a.id) b.spouse = null;
  if (a.partner === b.id) a.partner = null; if (b.partner === a.id) b.partner = null;
  if (divorce) { b.home = "H" + Math.random().toString(36).slice(2, 6); }
}
function birth(mother, father, quiet) {
  const g = pick(GENDERS);
  const kid = newPerson({ g, age: quiet ? Math.floor(rnd() * 12) : 0, role: "kid", surname: (father && father.name.split(" ").slice(-1)[0]) || mother.name.split(" ").slice(-1)[0], home: mother.home, parents: [mother.id, father ? father.id : null] });
  kid.role = "kid";
  mother.kids.push(kid.id); if (father) father.kids.push(kid.id);
  for (const par of [mother, father]) { if (!par) continue; setBoth(par, kid, (r) => { r.v = 85; r.met = 20; r.fam = true; }); }
  for (const sid of mother.kids) { const sib = byId(sid); if (sib && sib !== kid) setBoth(sib, kid, (r) => { r.v = 55; r.met = 12; r.fam = true; }); }
  if (!quiet) log("👶 " + kid.name + " was born to " + mother.name + (father ? " and " + father.name : ""));
  return kid;
}

/* ── schedule ────────────────────────────────────────────────────────── */
function schedule(p, h, dow, day) {
  if (p.dead) return { act: "dead", place: "grave", out: false };
  if (p.preg) {                                  /* pregnancy: she rests at home as the belly grows */
    const st = Belly.stage(pregProgress(p));
    const mine = p.preg.by === "player" || p.spouse === "player";
    if (mine || st >= 3 || (st === 2 && h >= 11)) {
      const asleep = p.owl ? (h >= 1.5 && h < 8) : (h >= 22.5 || h < 6);
      return { act: asleep ? "sleep" : "home", place: "home", out: false };
    }
  }
  if (p.plan.day !== day) {           /* new day: decide the evening */
    p.plan.day = day;
    p.plan.eve = pick(["park", "bar", "market", "street", "home", "home", "park", "church"].filter((x) => x !== "bar" || p.age >= 18));
    p.plan.err = rnd() < 0.5;
  }
  const weekend = dow >= 5, sunday = dow === 6;
  if (p.hang > 0 && absHourNow() < p.hang) return { act: "hangout", place: "with you", out: true };
  const asleep = p.owl ? (h >= 1.5 && h < 8) : (h >= 22.5 || h < 6);
  if (asleep) return { act: "sleep", place: "home", out: false };
  if (p.age < 18) {
    if (h < 7.5) return { act: "home", place: "home", out: false };
    if (!weekend && h < 14.5) return { act: "school", place: "school", out: false };
    if (h < 18) return { act: "play", place: "park", out: true };
    return { act: "home", place: "home", out: false };
  }
  if (sunday && h >= 8 && h < 11.5 && p.tr.rel > 0.45) return { act: "church", place: "church", out: true };
  const day0 = p.shift ? 16 : 8, day1 = p.shift ? 24 : 17;
  if (!weekend || OUTDOOR_JOBS.has(p.role)) {
    if (h >= day0 && h < day1) {
      if (!p.shift && h >= 12 && h < 13) return { act: "lunch", place: "market", out: true };
      return { act: "work", place: "work:" + p.role, out: OUTDOOR_JOBS.has(p.role) };
    }
  }
  if (h >= 9 && h < 16 && p.plan.err) return { act: "errands", place: "market", out: true };
  if (h >= 17 && h < 21.5) return { act: "leisure", place: p.plan.eve, out: p.plan.eve !== "home" };
  if (h >= 21.5 && p.owl) return { act: "leisure", place: "bar", out: p.age >= 18 };
  if (h >= 21.5 && h < 24 && p.tr.ext > 0.55 && p.age >= 18) return { act: "leisure", place: "street", out: true };
  if (h < 1.5 && p.shift && (p.role === "police" || p.role === "taxi")) return { act: "work", place: "work:" + p.role, out: true };
  return { act: "home", place: "home", out: false };
}
let _abs = 0;
function absHourNow() { return _abs; }

function applySchedules() {
  const h = Math.floor(DayNight.hour);
  for (const p of Object.values(S.people)) { const s = schedule(p, h + 0.5, S.day % 7, S.day); p.act = s.act; p.place = s.place; p.out = s.out; }
}
/* ── hourly simulation (everyone) ────────────────────────────────────── */
function simHour(h) {
  S.day += (h === 0 ? 1 : 0);
  _abs = S.day * 24 + h;
  const dow = S.day % 7;
  const people = Object.values(S.people).filter((p) => !p.dead);
  const groups = {};
  for (const p of people) {
    p.age += 1 / (DAYS_PER_YEAR * 24);
    if (p.role === "kid" && p.age >= 18) graduate(p);
    const s = schedule(p, h + 0.5, dow, S.day);
    p.act = s.act; p.place = s.place; p.out = s.out;
    p.mood = clamp(p.mood + (rnd() - 0.5) * 0.12 + (s.act === "leisure" ? 0.03 : s.act === "sleep" ? 0.02 : -0.005), 0, 1);
    if (s.act !== "sleep") (groups[s.place === "home" ? "home:" + p.home : s.place] = groups[s.place === "home" ? "home:" + p.home : s.place] || []).push(p);
  }
  for (const key in groups) {
    const g = groups[key]; if (g.length < 2) continue;
    const n = Math.min(3, Math.ceil(g.length / 2));
    for (let i = 0; i < n; i++) {
      const a = pick(g), b = pick(g); if (a === b) continue;
      if ((a.age < 12) !== (b.age < 12) && !(getRel(a, b).fam)) continue;   /* small kids only mix with kids / family */
      interact(a, b);
    }
  }
  /* once a day, 06:00 : pregnancies, births, affairs found out, splits */
  if (h === 6) {
    for (const p of people) {
      if (p.preg && S.day >= p.preg.due) {
        if (p.preg.by === "player") { p.preg = null; playerChild(); continue; }
        const f = byId(p.preg.by); birth(p, f && !f.dead ? f : null); p.preg = null;
      }
      if (p.spouse && p.g === "feminine" && !p.preg && p.age >= 20 && p.age < 42 && p.kids.length < 4 && rnd() < 0.09) {
        const sp = byId(p.spouse); if (sp && !sp.dead) { p.preg = { due: S.day + PREG_DAYS, by: sp.id }; if (rnd() < 0.5) log(p.name + " is expecting a baby 🤰"); }
      }
      if (p.affair && rnd() < 0.18) {
        const lover = byId(p.affair), mate = byId(p.spouse || p.partner);
        if (lover && mate) {
          setBoth(mate, p, (r) => { r.v -= 55; }); setBoth(mate, lover, (r) => { r.v -= 40; });
          log("💔 " + mate.name + " found out about " + p.name + " and " + lover.name + "!");
          if (rnd() < 0.55) { const dv = !!mate.spouse; split(p, mate, dv); log(mate.name + " and " + p.name + (dv ? " divorced" : " broke up")); }
        }
        p.affair = null;
      }
      const pr = p.spouse || p.partner;
      if (pr) {
        const o = byId(pr), r = p.rel[pr];
        if (o && r) {
          if (p.partner && S.day - p.partnerSince >= 2 && r.v >= 72 && rnd() < 0.2 && p.id < o.id) marry(p, o);
          else if (p.partner && r.v < 12 && rnd() < 0.4) { split(p, o, false); log(p.name + " and " + o.name + " broke up"); }
          else if (p.spouse && r.v < -15 && rnd() < 0.3 && p.id < o.id) { split(p, o, true); log(p.name + " and " + o.name + " divorced"); }
        }
      }
    }
  }
  if (Object.keys(S.people).length < 60) newPerson({ age: 18 + Math.floor(rnd() * 40) });
  /* the player's pregnancy / adoption */
  const pp = S.player;
  if (pp.preg && S.day >= pp.preg.due && h === 6) playerChild();
}
function graduate(p) {
  p.role = pick(JOBS.filter((j) => j !== "student")); p.home = "H" + Math.random().toString(36).slice(2, 6);
  log(p.name + " is all grown up and moved out");
}

/* ── the player ──────────────────────────────────────────────────────── */
function playerChild() {
  const pp = S.player, sp = byId(pp.spouse);
  if (!sp) { pp.preg = null; return; }
  const kid = newPerson({ g: pick(GENDERS), age: 0, role: "kid", surname: "You", home: "H_player", parents: ["player", sp.id] });
  kid.name = (kid.g === "feminine" ? pick(F_NAMES) : pick(M_NAMES));
  pp.kids.push(kid.id); sp.kids.push(kid.id);
  kid.rel.player = { v: 90, met: 30, fam: true, last: S.day };
  setBoth(sp, kid, (r) => { r.v = 90; r.met = 30; r.fam = true; });
  pp.preg = null; sp.preg = null;
  kid.bornDay = S.day;
  toast("👶 " + kid.name + " was born! You're a parent.");
  try { const L = LSim(); L && L.onPlayerBirth && L.onPlayerBirth(kid, sp); } catch (e) {}
  log("👶 " + kid.name + " was born to you and " + sp.name);
  save();
}
const pRel = (p) => { let r = p.rel.player; if (!r) r = p.rel.player = { v: 0, met: 0, last: 0 }; return r; };

const ACT_LINES = {
  sleep: "asleep", home: "at home", school: "at school", play: "playing at the park", church: "at church", work: "at work",
  lunch: "on lunch break", errands: "running errands", leisure: "out relaxing", hangout: "hanging out with you", dead: "deceased",
};
function whereText(p) {
  if (p.dead) return "deceased";
  if (p.act === "leisure") return { park: "at the park", bar: "at a bar", market: "at the market", street: "out walking", church: "at church", home: "at home" }[p.place] || "out";
  return ACT_LINES[p.act] || "around";
}
function relLabel(p) {
  const r = p.rel.player; const S_ = S.player;
  if (S_.spouse === p.id) return "💍 Spouse";
  if (S_.partner === p.id) return S_.engaged === p.id ? "💍 Fiancé(e)" : "❤ Partner";
  if (S_.kids.includes(p.id)) return "👶 Your child";
  const t = relType(r, null, null);
  return { "best friend": "⭐ Best friend", friend: "😊 Friend", enemy: "💢 Enemy", rival: "😠 Rival", acquaintance: "🙂 Acquaintance", stranger: "Stranger", family: "Family" }[t] || "Stranger";
}

/* ── person ↔ walker binding ─────────────────────────────────────────── */
const TAG_PRED = {
  school_kids: (p) => p.age < 17, couple: (p) => !!(p.spouse || p.partner), mamas: (p) => p.g === "feminine" && p.age >= 34,
  suit_men: (p) => p.g === "masculine" && p.age >= 25, yahoo_boys: (p) => p.g === "masculine" && p.age >= 18 && p.age < 32,
  student: (p) => p.age >= 17 && p.age < 28, clerk: (p) => p.age >= 22,
};
let pendingPartner = null, reskinBudget = 3;
function claim(npc, anywhere) {
  if (!S || npc._life || npc.dead || npc._isHunter) return;
  const tag = npc.groupTag, role = npc.role;
  const free = (p) => (!p._npc || p._npc.dead || !p._npc.group || !p._npc.group.parent) && !p.dead && !(p.age < INFANT_AGE);
  let best = null;
  const cand = Object.values(S.people).filter((p) => free(p) && (p.out || anywhere));
  const wantKid = tag === "school_kids";
  if (tag === "couple" && pendingPartner) { const pp = byId(pendingPartner); pendingPartner = null; if (pp && free(pp)) best = pp; }
  if (!best) {
    let pool = cand;
    if (tag && TAG_PRED[tag]) pool = pool.filter(TAG_PRED[tag]);
    else if (role !== "walker") pool = pool.filter((p) => p.role === role);
    else pool = pool.filter((p) => p.age >= 16 && !["trader", "police", "taxi", "priest", "banker", "doctor", "mechanic"].includes(p.role));
    if (wantKid) pool = pool.filter((p) => p.age >= 4 && p.age < 17);
    if (pool.length) best = pick(pool);
  }
  if (!best) {                          /* nobody fits → a new townsperson is born into town */
    if (Object.keys(S.people).length >= MAX_PEOPLE) return;
    const g = npc._cfg && npc._cfg.gender === "feminine" ? "feminine" : npc._cfg && npc._cfg.gender === "masculine" ? "masculine" : pick(GENDERS);
    const age = wantKid ? 7 + Math.floor(rnd() * 9) : tag === "mamas" ? 38 + Math.floor(rnd() * 20) : tag === "yahoo_boys" ? 19 + Math.floor(rnd() * 10) : 20 + Math.floor(rnd() * 40);
    best = newPerson({ g, age, role: role === "walker" ? (tag === "clerk" ? "clerk" : tag === "student" ? "student" : pick(["walker", "walker", "clerk"])) : role, cfg: npc._cfg });
    if (wantKid) best.role = "kid";
    best.out = true; best.act = "errands"; best.place = "street";
  }
  const needSkin = !!(best.cfg && !tag && role === "walker" && host && host._reskin);
  if (needSkin && reskinBudget <= 0) return;                 /* spread the (costly) model swaps over a few seconds */
  best._npc = npc; npc._life = best;
  if (tag === "couple" && (best.spouse || best.partner)) pendingPartner = best.spouse || best.partner;
  /* looks: keep the person's own look (persistent), or remember this walker's */
  if (needSkin) { reskinBudget--; try { host._reskin(npc, best.cfg); } catch (e) {} }
  else best.cfg = npc._cfg;
  if (best.age < 17 && npc.group) { const s = clamp(0.38 + best.age * 0.036, 0.38, 1); npc.group.scale.setScalar(s); npc._lifeScale = s; }
  best.hang = best.hang || 0;
}
function unbind(npc) { if (npc && npc._life) { if (npc._life._npc === npc) npc._life._npc = null; npc._life = null; } }

/* ── name tags + bubbles ─────────────────────────────────────────────── */
let THREE_ = null;
async function getTHREE() { if (!THREE_) THREE_ = await import("three"); return THREE_; }
const _texCache = new Map();
function makeTex(text, color, emoji) {
  const key = text + "|" + color + "|" + (emoji || "");
  let t = _texCache.get(key); if (t) return t;
  const T = THREE_, c = document.createElement("canvas"); c.width = 320; c.height = 96;
  const x = c.getContext("2d");
  x.fillStyle = "rgba(10,16,13,.72)"; x.beginPath(); x.roundRect ? x.roundRect(6, 20, 308, 58, 16) : x.rect(6, 20, 308, 58); x.fill();
  x.strokeStyle = color; x.lineWidth = 3; x.stroke();
  x.font = "800 30px system-ui,sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  x.fillStyle = "#fff"; x.fillText(text, 160, 49, 290);
  if (emoji) { x.font = "34px system-ui,sans-serif"; x.fillText(emoji, 160, 12); }
  t = new T.CanvasTexture(c); t.minFilter = T.LinearFilter; _texCache.set(key, t); return t;
}
const TAGCOL = { spouse: "#ff7aa8", partner: "#ff7aa8", family: "#ffd36a", "best friend": "#ffd23a", friend: "#7dff9a", enemy: "#ff5a4d", rival: "#ff9a4d", acquaintance: "#9ab", stranger: "#789" };
function updateTag(npc, show, dist) {
  if (!THREE_ || !npc.group) return;
  const p = npc._life;
  if (!show || !p) { if (npc._tag) npc._tag.visible = false; return; }
  const lab = relLabel(p).replace(/^[^\w]+\s*/, "");
  const typ = S.player.spouse === p.id ? "spouse" : S.player.partner === p.id ? "partner" : S.player.kids.includes(p.id) ? "family" : relType(p.rel.player, null, null);
  const emoji = npc._icon || "";
  const text = p.name.split(" ")[0] + (typ !== "stranger" ? " · " + lab : "");
  const key = text + emoji;
  if (!npc._tag) {
    const spr = new THREE_.Sprite(new THREE_.SpriteMaterial({ map: makeTex(text, TAGCOL[typ] || "#789", emoji), transparent: true, depthTest: false }));
    spr.renderOrder = 999; npc.group.add(spr); npc._tag = spr; npc._tagKey = key;
  } else if (npc._tagKey !== key) { npc._tag.material.map = makeTex(text, TAGCOL[typ] || "#789", emoji); npc._tag.material.needsUpdate = true; npc._tagKey = key; }
  const s = npc._lifeScale || 1;
  npc._tag.scale.set(1.5 / s, 0.45 / s, 1);
  npc._tag.position.set(0, (2.25 + (emoji ? 0.12 : 0)) / s * (s < 1 ? 0.92 : 1), 0);
  npc._tag.material.opacity = clamp(1.2 - dist / 9, 0, 1);
  npc._tag.visible = true;
}

/* ── per-NPC behaviour (called by npcs.js for states "life_*") ───────── */
function leaderPos(npc) {
  const L = npc._lifeLead;
  if (L === "player") {
    let yaw = 0; try { const ws = window.__ph3d_drive && window.__ph3d_drive.getWalkState && window.__ph3d_drive.getWalkState(); yaw = ws ? ws.walker.yaw : 0; } catch (e) {}
    return { x: _px, z: _pz, yaw, ok: true };
  }
  if (L && !L.dead && L.group && !L._lifeHidden) return { x: L.ctl.pos.x, z: L.ctl.pos.z, yaw: L.ctl.yaw, ok: true };
  return { ok: false };
}
let _px = 0, _pz = 0;
function drive(npc, dt) {
  const st = npc.state;
  if (st === "life_chat") {
    npc.moveSpeed = 0;
    const w = npc._lifeWith;
    if (!w || w.dead || npc.stateT <= 0) { endLife(npc); return; }
    const dx = w.ctl.pos.x - npc.ctl.pos.x, dz = w.ctl.pos.z - npc.ctl.pos.z;
    if (dx * dx + dz * dz > 0.01) npc.yawTarget = Math.atan2(dx, dz);
    if (npc._lifeKind === "friend" && !(npc.ctl._emoteTimer > 0) && rnd() < dt * 0.35) { npc.ctl._emoteName = "wave"; npc.ctl._emoteTimer = 1.6; npc.ctl._emotePhase = 0; }
    return;
  }
  if (st === "life_follow") {
    const L = leaderPos(npc);
    if (!L.ok || npc.stateT <= 0 && npc._lifeLead !== "player") { endLife(npc); return; }
    const off = npc._lifeOff || [0.9, 1.2];                  /* [side, back] metres */
    const sy = Math.sin(L.yaw), cy = Math.cos(L.yaw);
    const bx = L.x + cy * off[0] - sy * off[1], bz = L.z - sy * off[0] - cy * off[1];
    const dx = bx - npc.ctl.pos.x, dz = bz - npc.ctl.pos.z, d = Math.hypot(dx, dz);
    npc.stateT = Math.max(npc.stateT, 1);
    if (d > 0.5) {
      const sp = clamp(1.1 + d * 1.0, 1.2, 4.6);
      if (d > 14) { npc.ctl.pos.x = bx; npc.ctl.pos.z = bz; }
      else host._stepToward(npc, dx, dz, sp, dt);
    } else { npc.moveSpeed = 0; npc.yawTarget = L.yaw; }
    return;
  }
  if (st === "life_away") { npc.moveSpeed = 0; return; }
}
function endLife(npc) {
  npc._lifeWith = null; npc._lifeLead = null; npc._icon = ""; npc.moveSpeed = 0;
  npc.state = "idle"; npc.stateT = 0.6 + rnd() * 1.5;
}
const isFree = (n) => n && !n.dead && !n._lifeHidden && (n.state === "walk" || n.state === "idle");

/* ── 1-second pass: bind, visibility, visible interactions, companions ─ */
function secondPass(px, pz) {
  if (!host) return;
  const list = host.list; reskinBudget = 3;
  for (const npc of list) if (!npc._life && !npc.dead) claim(npc);

  /* schedule → hide / show the walkers */
  for (const npc of list) {
    const p = npc._life; if (!p || npc.dead) continue;
    if (npc._companion) continue;
    const d = Math.hypot(npc.ctl.pos.x - px, npc.ctl.pos.z - pz);
    if (!p.out && !npc._lifeHidden) {
      if (npc.state === "wrestled" || npc.state === "talk" || npc.state === "flee" || npc.state === "downed") continue;
      if (d > 60) { npc._lifeHidden = true;   /* only vanish well out of sight (was 16 m — people popped out while driving) */
        npc.state = "life_away"; npc.group.visible = false; }
    } else if (p.out && npc._lifeHidden) {
      if (host._lifeShow) host._lifeShow(npc, px, pz);
      npc._lifeHidden = false; npc.state = "idle"; npc.stateT = 0.5;
    }
  }

  /* family / couples / friends & enemies out on the street */
  const vis = list.filter((n) => n._life && !n._lifeHidden && !n.dead && n.group.visible !== false);
  for (let i = 0; i < vis.length; i++) {
    const A = vis[i]; if (!isFree(A) || A._lifeCd > 0 || A._companion) continue;
    for (let j = i + 1; j < vis.length; j++) {
      const B = vis[j]; if (!isFree(B) || B._lifeCd > 0 || B._companion) continue;
      const d = Math.hypot(A.ctl.pos.x - B.ctl.pos.x, A.ctl.pos.z - B.ctl.pos.z);
      if (d > 7) continue;
      const pa = A._life, pb = B._life, t = typeBetween(pa, pb);
      if (pa.age < 17 && pa.parents.includes(pb.id)) { follow(A, B, [0.7, 0.9]); break; }
      if (pb.age < 17 && pb.parents.includes(pa.id)) { follow(B, A, [0.7, 0.9]); break; }
      if (t === "spouse" || t === "partner") { follow(pa.id < pb.id ? A : B, pa.id < pb.id ? B : A, [0.85, 0.2]); A._lifeCd = B._lifeCd = 40; break; }
      const chance = t === "best friend" ? 0.5 : t === "friend" ? 0.35 : t === "enemy" ? 0.4 : t === "rival" ? 0.18 : 0.04;
      if (rnd() < chance) { chat(A, B, t); break; }
      A._lifeCd = B._lifeCd = 12;
    }
  }
  for (const n of list) if (n._lifeCd > 0) n._lifeCd -= 1;

  for (const n of vis) { try { bodyFx(n); } catch (e) {} }

  /* bubbles + name tags near the player */
  let shown = 0;
  const near = vis.map((n) => [n, Math.hypot(n.ctl.pos.x - px, n.ctl.pos.z - pz)]).sort((a, b) => a[1] - b[1]);
  for (const [n, d] of near) { const on = d < 8 && shown < 6; if (on) shown++; updateTag(n, on, d); }
  for (const n of list) if (!vis.includes(n) && n._tag) n._tag.visible = false;

  companions(px, pz);
}
/* belly for pregnant women, infant on the back / chest of carrying parents */
function bodyFx(n) {
  const p = n._life; if (!p || !n.rig) return;
  const pr = p.preg && p.g === "feminine" ? pregProgress(p) : 0;
  if (pr > 0.04) Belly.ensure(n.rig, pr); else if (n.rig.belly) Belly.remove(n.rig);
  const kid = infantOf(p);
  if (kid) {
    if (!p._carryMode) p._carryMode = p.g === "feminine" ? (rnd() < 0.55 ? "back" : "front") : (rnd() < 0.85 ? "front" : "back");
    Baby.ensure(n.rig, p._carryMode, { seed: kid.id, scale: 0.85 + 0.22 * Math.min(kid.age, INFANT_AGE) });
    if (!n._carrySlow) { n._carrySlow = true; n.speedMult = (n.speedMult || 1) * 0.9; }
  } else if (n.rig.baby) {
    Baby.detach(n.rig);
    if (n._carrySlow) { n._carrySlow = false; n.speedMult = (n.speedMult || 1) / 0.9; }
  }
}
function chat(A, B, t) {
  const kind = t === "enemy" || t === "rival" ? "enemy" : "friend";
  for (const [x, y] of [[A, B], [B, A]]) {
    x.state = "life_chat"; x.stateT = 6 + rnd() * 6; x._lifeWith = y; x._lifeKind = kind; x.moveSpeed = 0; x._lifeCd = 25;
    x._icon = kind === "enemy" ? "💢" : (t === "best friend" ? "😂" : "💬");
  }
  /* a chat actually moves the relationship */
  interact(A._life, B._life);
}
function follow(F, L, off) {
  F.state = "life_follow"; F.stateT = 30 + rnd() * 30; F._lifeLead = L; F._lifeOff = off; F._lifeCd = 40;
}

/* spouse + children walking with you (outdoor city only) */
let _forceCompanions = false;
function companions(px, pz) {
  const P = S.player;
  if (!cityOn || !host || !P.companion) return;
  const hour = DayNight.hour;
  if (!(P.called || _forceCompanions) && (hour < 7 || hour >= 22)) { for (const n of host.list) if (n._companion && !n.dead) host._despawnOne && host._despawnOne(n); return; }
  const want = [];
  if (P.spouse) { const sp0 = byId(P.spouse); if (sp0 && !sp0.preg) want.push([sp0, [0.9, 0.3]]); }
  if (P.partner) want.push([byId(P.partner), [0.9, 0.3]]);
  P.kids.forEach((k, i) => { const kid = byId(k); if (kid && kid.age >= INFANT_AGE && kid.age < 17) want.push([kid, [-0.9 + (i % 3) * 0.9, 1.1 + 0.5 * Math.floor(i / 3)]]); });
  for (const [p, off] of want) {
    if (!p || p.dead || p.act === "sleep") continue;
    let npc = p._npc;
    if (npc && npc._lifeHidden) { host._lifeShow && host._lifeShow(npc, px, pz); npc._lifeHidden = false; }
    if (!npc || npc.dead) {
      if (!host.spawnRole) continue;
      const a = rnd() * 6.28;
      npc = host.spawnRole(null, "walker", px + Math.cos(a) * 3, pz + Math.sin(a) * 3, { forcedConfig: p.cfg || undefined });
      if (!npc) continue;
      p._npc = npc; npc._life = p;
      if (!p.cfg) p.cfg = npc._cfg;
      if (p.age < 17) { const s = clamp(0.38 + p.age * 0.036, 0.38, 1); npc.group.scale.setScalar(s); npc._lifeScale = s; }
    }
    npc._companion = true; npc.stationary = false;
    if (npc.state !== "life_follow" && npc.state !== "talk" && npc.state !== "flee" && npc.state !== "wrestled" && npc.state !== "downed" && !npc.dead) {
      npc.state = "life_follow"; npc._lifeLead = "player"; npc._lifeOff = off; npc.stateT = 999;
    }
  }
  /* people no longer wanted as companions (e.g. after a breakup) go back to normal life */
  const keep = new Set(want.map((w) => w[0] && w[0].id));
  const nowAbs = S.day * 24 + Math.floor(DayNight.hour);
  for (const n of host.list) if (n._companion && n._life && !keep.has(n._life.id) && !((n._life.hang || 0) > nowAbs)) {
    n._companion = false;
    if (n._life.preg && n._life.spouse === "player") { try { host._despawnOne && host._despawnOne(n); } catch (e) {} continue; }   /* pregnant wife goes home */
    if (n.state === "life_follow") endLife(n);
  }
}

/* ═══ UI: interaction panel + People app ═══════════════════════════════ */
const css = `
#lv-panel{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 92px);transform:translateX(-50%);z-index:9500;width:min(94vw,430px);background:rgba(10,16,13,.96);border:1px solid rgba(125,255,154,.35);border-radius:18px;color:#eaf6ff;font:600 13px Inter,system-ui,sans-serif;box-shadow:0 16px 40px rgba(0,0,0,.6);padding:12px 14px;display:none}
#lv-panel h3{margin:0;font:900 17px Inter,system-ui,sans-serif;display:flex;justify-content:space-between;align-items:center;gap:8px}
#lv-panel .sub{opacity:.75;font-size:12px;margin:2px 0 8px}
#lv-panel .bar{height:8px;border-radius:6px;background:#26302b;overflow:hidden;margin:6px 0 10px}
#lv-panel .bar i{display:block;height:100%;background:linear-gradient(90deg,#ff5a4d,#ffd23a 50%,#7dff9a)}
#lv-panel .g{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
#lv-panel button,#lv-app button.pill{background:#1c2b24;border:1px solid rgba(125,255,154,.3);color:#eaf6ff;border-radius:11px;padding:8px 4px;font:700 12px Inter,system-ui,sans-serif;cursor:pointer}
#lv-panel button:active{transform:scale(.96)}
#lv-panel button[disabled]{opacity:.35}
#lv-panel .x{background:none;border:none;font-size:20px;padding:0 4px;color:#9ab}
#lv-say{margin:8px 0 2px;font-style:italic;opacity:.9;min-height:16px}
#lv-app{position:fixed;inset:0;z-index:9600;background:rgba(5,9,7,.97);color:#eaf6ff;font:600 14px Inter,system-ui,sans-serif;display:none;flex-direction:column}
#lv-app header{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 12px) 14px 8px}
#lv-app header b{font:900 20px Inter,system-ui,sans-serif;flex:1}
#lv-app .tabs{display:flex;gap:6px;padding:0 14px 8px;overflow:auto}
#lv-app .tabs button.pill{white-space:nowrap;padding:7px 12px}
#lv-app .tabs button.on{background:#2f6b4a;border-color:#7dff9a}
#lv-app .body{flex:1;overflow:auto;padding:4px 14px 30px}
#lv-app .row{display:flex;gap:10px;align-items:center;padding:9px 10px;border-radius:12px;background:#121b16;margin-bottom:7px}
#lv-app .row .av{width:38px;height:38px;border-radius:50%;background:#26382e;display:flex;align-items:center;justify-content:center;font-size:19px}
#lv-app .row .t{flex:1;min-width:0}#lv-app .row .t b{display:block}#lv-app .row .t span{opacity:.7;font-size:12px}
#lv-app .log{padding:8px 10px;border-left:3px solid #2f6b4a;margin-bottom:6px;background:#0e1612;border-radius:0 10px 10px 0}
#lv-app .card{background:#121b16;border-radius:14px;padding:12px;margin-bottom:10px}
#lv-panel{max-height:62vh;overflow-y:auto}
#lv-panel .stg{display:flex;gap:3px;margin:2px 0 6px}
#lv-panel .stg span{flex:1;text-align:center;font:800 9px Inter,system-ui,sans-serif;padding:4px 0;border-radius:7px;background:#16211b;opacity:.55}
#lv-panel .stg span.done{background:#244c37;opacity:.9}
#lv-panel .stg span.now{background:#2f8a5a;opacity:1;box-shadow:0 0 0 1px #7dff9a inset}
#lv-panel .note{font-size:11px;opacity:.7;margin:4px 0 8px}
`;
let panelEl = null, appEl = null, curNpc = null, appTab = "family", openedAt = 0;
function ensureUI() {
  if (panelEl) return;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  panelEl = document.createElement("div"); panelEl.id = "lv-panel"; document.body.appendChild(panelEl);
  appEl = document.createElement("div"); appEl.id = "lv-app"; document.body.appendChild(appEl);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") { closePanel(); closeApp(); } });
  hookPhone();
}
function hookPhone() {
  let tries = 0;
  const iv = setInterval(() => {
    const grid = document.querySelector("#app-home .tgrid");
    if (grid && !document.getElementById("lv-tile")) {
      const d = document.createElement("div"); d.className = "tapp-ic"; d.id = "lv-tile";
      d.innerHTML = '<div class="tico">👥</div><div class="tnm">People</div>';
      d.onclick = () => { try { window.__ph3d_phone.hide(); } catch (e) {} openApp(); };
      grid.appendChild(d); clearInterval(iv);
    }
    if (++tries > 120) clearInterval(iv);
  }, 1000);
}
function closePanel() { if (panelEl) panelEl.style.display = "none"; curNpc = null; try { const T = window.__ph3d_talkchat; if (T && T._current) T.close(); } catch (e) {} }
function closeApp() { if (appEl) appEl.style.display = "none"; }

const SAY = {
  chat: { friend: ["Ah, you! How far?", "Long time, oh!", "I dey fine, thank God. You?"], enemy: ["What do you want?", "Hmph.", "Don't test me."], def: ["How's your day?", "This city, eh!", "Na wa o, the traffic today.", "Good to see you."] },
};
function say(txt) {
  const e = document.getElementById("lv-say"); if (e) e.textContent = txt;
  /* when the WhatsApp-style chat is open, NPC lines become bubbles and notices become toasts */
  try {
    const T = window.__ph3d_talkchat;
    if (T && T._current && T._current._life) {
      const m = /^[^:]+:\s*[“"]([\s\S]+)[”"]$/.exec(String(txt));
      if (m) T.receive(T._current, m[1], { silent: true });
      else toast(String(txt));
    }
  } catch (e2) {}
}
function cool(p, key, secs) {
  p._cd = p._cd || {}; const now = performance.now();
  if (p._cd[key] && now - p._cd[key] < secs * 1000) return false;
  p._cd[key] = now; return true;
}
function bump(p, dv) { const r = pRel(p); r.v = clamp(r.v + dv, -100, 100); r.met++; r.last = S.day; return r; }

function openPanel(npc) {
  ensureUI();
  const p = npc && npc._life; if (!p) return;
  curNpc = npc; openedAt = performance.now();
  renderPanel();
  panelEl.style.display = "block";
}
function stageBar(stage) {
  const i = STAGES.indexOf(stage);
  return `<div class="stg">` + STAGES.map((k, n) => `<span class="${n < i ? "done" : n === i ? "now" : ""}">${STAGE_LABEL[k]}</span>`).join("") + `</div>`;
}
function renderPanel() {
  const npc = curNpc; if (!npc) return;
  const p = npc._life, r = pRel(p), P = S.player;
  const stage = stageOf(p);
  const isSp = stage === "married", isFi = stage === "engaged", isPt = P.partner === p.id;
  const isKid = P.kids.includes(p.id);
  const adult = p.age >= 18, single = !P.spouse && !P.partner;
  const t = relType(r, null, null);
  const pr = p.preg ? pregProgress(p) : 0, pst = Belly.stage(pr);
  const infant = isKid && p.age < INFANT_AGE, held = P.held === p.id;
  const can = {
    friend: t === "acquaintance" && r.v >= 20 && !isKid,
    ask: adult && single && r.v >= 40 && r.met >= 3,
    prop: isPt && !isFi && r.v >= 75 && S.day - (P.since || 0) >= 2,
    baby: isSp && r.v >= 65 && !P.preg && P.kids.length < 5,
  };
  const mood = p.mood > 0.7 ? "😄 happy" : p.mood > 0.4 ? "🙂 okay" : "😕 low";
  const kids = p.kids.map(byId).filter(Boolean);
  const btn = (id, label, dis) => `<button data-a="${id}" ${dis ? "disabled" : ""}>${label}</button>`;
  const tired = pst >= 2;
  let acts = "", note = "";
  if (isKid) {
    acts = btn("play", "🎈 Play", infant) + btn("gift", "🍬 Treat ₦500", infant) + btn("hug", "🤗 Hug", 0)
      + btn("dress", "👗 Dress", infant) + btn("holdhand", "🤝 Hold hand", infant);
    if (infant) {
      const other = P.carryMode === "back" ? "front" : "back";
      acts += held
        ? btn("soothe", "🤫 Soothe", 0) + btn("carry_" + other, other === "front" ? "🤱 To front" : "🎒 To back", 0) + btn("putdown", "🛏 Put down", 0)
        : btn("carry_front", "🤱 Carry · front", 0) + btn("carry_back", "🎒 Carry · back", 0) + btn("selfie", "📸 Photo", 0);
      note = held ? "You're carrying " + p.name.split(" ")[0] + ". Soothe when they cry." : "A baby — carry them close. You walk a little slower while carrying.";
    }
  } else {
    acts = btn("chat", "💬 Chat", 0) + btn("compliment", "😊 Compliment", 0) + btn("joke", "😂 Joke", 0)
      + btn("gift", "🎁 Gift ₦1,500", 0) + btn("hang", "🚶 Hang out", r.met < 2 || r.v < 5 || (p.preg && tired))
      + btn("selfie", "📸 Selfie", t === "enemy" || r.v < 10);
    if (isSp) acts += btn("dress", "👗 Dress", 0) + btn("holdhand", "🤝 Hold hand", 0) + btn("holdelbow", "💑 Link arms", 0);
    if (stage === "acquaintance" || stage === "stranger") acts += btn("friend", "🤝 Be friends", !can.friend);
    if (!isSp && !isPt && adult) acts += btn("flirt", "😉 Flirt", 0) + btn("ask", "❤ Ask out", !can.ask);
    if (stage === "dating") acts += btn("date_walk", "🌳 Park walk", 0) + btn("date_dinner", "🍽 Dinner ₦6,000", 0) + btn("date_cinema", "🎬 Cinema ₦4,000", 0)
      + btn("date_beach", "🌊 Beach ₦3,000", 0) + btn("prop", "💍 Propose", !can.prop) + btn("breakup", "💔 Break up", 0);
    if (stage === "engaged") acts += btn("date_dinner", "🍽 Dinner ₦6,000", 0) + btn("plan", "⛪ Plan wedding", 0) + btn("breakup", "💔 Call off", 0);
    if (isSp) {
      acts += btn("baby", p.g === "feminine" ? "👶 Try for a baby" : "👶 Adopt a child", !can.baby);
      if (p.preg) acts += btn("cookfor", "🍲 Cook ₦2,500", 0) + btn("massage", "🦶 Foot rub", 0) + btn("ante", "🏥 Check-up ₦8,000", pst < 2);
      acts += btn("along", p.preg ? "🏠 Resting at home" : P.companion ? "🏠 Stay home" : "🚶 Come along", !!p.preg) + btn("divorce", "⚖ Divorce", 0);
    }
    acts += btn("insult", "😠 Insult", 0) + (r.v < -10 ? btn("sorry", "🙏 Apologise", 0) : "");
    if (isFi) note = "Engaged! Plan the wedding, invite guests, then hold it at the church.";
    else if (isSp && p.preg) note = ["", "First trimester — she's still active.", "Second trimester — she rests at home more.", "Third trimester — she stays home, resting."][pst];
    else if (stage === "dating") note = "Dating unlocks outings and proposals.";
  }
  panelEl.innerHTML = `<h3><span>${p.name}</span><button class="x" data-a="close">✕</button></h3>
    <div class="sub">${p.g === "feminine" ? "♀" : "♂"} ${p.age < 2 ? Math.max(0, Math.floor(p.age * 12)) + " mo" : Math.floor(p.age)} · ${p.role === "walker" ? "resident" : p.role} · ${mood} · ${whereText(p)} · ${relLabel(p)}
      ${p.preg ? " · 🤰 expecting" : ""}${p.spouse ? " · married to " + (p.spouse === "player" ? "you" : (byId(p.spouse) || {}).name) : ""}${kids.length ? " · " + kids.length + " kid(s)" : ""}</div>
    ${isKid ? "" : stageBar(stage)}
    <div class="bar"><i style="width:${(r.v + 100) / 2}%"></i></div>
    ${note ? `<div class="note">${note}</div>` : ""}
    <div class="g">${acts}</div><div id="lv-say"></div>`;
  panelEl.querySelectorAll("button").forEach((b) => (b.onclick = () => act(b.dataset.a)));
}
function act(a) {
  const npc = curNpc, p = npc && npc._life; if (!p) return closePanel();
  if (a === "close") return closePanel();
  const P = S.player, r = pRel(p), tr = p.tr;
  const lines = (arr) => pick(arr);
  const hear = (txt) => { say(p.name.split(" ")[0] + ": “" + txt + "”"); };
  if (!cool(p, a, a === "chat" ? 6 : (a === "soothe" || a === "putdown" || a.indexOf("carry_") === 0 || a === "plan" || a === "selfie") ? 1 : 12)) { say("Give it a moment…"); return; }
  const face = () => { try { const dx = _px - npc.ctl.pos.x, dz = _pz - npc.ctl.pos.z; npc.yawTarget = Math.atan2(dx, dz); } catch (e) {} };
  face(); if (npc.state !== "life_follow") { npc.state = "talk"; npc.stateT = 5; }
  /* your own side of the conversation, as a chat bubble */
  {
    const PLAYER_LINES = {
      chat: "👋 Hey!", compliment: "😊 You look nice today", joke: "😂 Tell me a joke", gift: "🎁 Here's a gift",
      flirt: "😉 Hey, you…", ask: "❤ Can I take you out?", prop: "💍 Will you marry me?", hang: "🚶 Let's hang out",
      selfie: "📸 Can we take a selfie?", hug: "🤗 Hug me", play: "🎈 Let's play!",
    };
    try { const T = window.__ph3d_talkchat; if (PLAYER_LINES[a] && T && T._current === npc) T.pushPlayer(PLAYER_LINES[a]); } catch (e) {}
  }
  if (a === "chat") {
    const t = relType(r, null, null); const pool = t === "enemy" || t === "rival" ? SAY.chat.enemy : t === "friend" || t === "best friend" ? SAY.chat.friend : SAY.chat.def;
    const dv = 2 + tr.kind * 3 + tr.ext * 2 - (r.v < -20 ? 6 : 0);
    bump(p, dv); hear(lines(pool));
  } else if (a === "compliment") {
    const ok = rnd() < 0.55 + tr.kind * 0.3; bump(p, ok ? 4 + tr.rom * 2 : -2); hear(ok ? lines(["Aww, thank you!", "You're too kind, oh!", "Ehen? I appreciate."]) : lines(["Hmm… okay.", "Why you dey talk like that?"]));
  } else if (a === "joke") {
    const ok = rnd() < 0.35 + tr.ext * 0.5; bump(p, ok ? 5 : -3); hear(ok ? lines(["Hahaha! Stop it!", "I no fit laugh! 😂"]) : lines(["Not funny.", "…okay?"]));
  } else if (a === "gift") {
    const cost = p.age < 12 ? 500 : 1500;
    if (!Economy.send || !Economy.send(p.name, cost, "Gift")) { say("You don't have enough money."); return; }
    bump(p, 8 + tr.kind * 3); hear(lines(["For me? Thank you so much!", "God bless you!", "Ah! You shouldn't have."])); toast("🎁 −₦" + cost.toLocaleString());
  } else if (a === "hug" || a === "play") {
    bump(p, 6); hear(lines(["Yay!", "Again! Again!", "I love you!"]));
  } else if (a === "dress") {
    try { window.__ph3d_family && window.__ph3d_family.dress(p.id); } catch (e) {}
  } else if (a === "holdhand" || a === "holdelbow") {
    try { window.__ph3d_family && window.__ph3d_family.setHold(a === "holdhand" ? "hand" : "elbow"); } catch (e) {}
  } else if (a === "friend") {
    if (r.v >= 20) { r.v = Math.max(r.v, 38); r.met = Math.max(r.met, 3); hear("Of course! We're friends now."); log("You and " + p.name + " became friends"); toast("🤝 You and " + p.name + " are friends"); }
  } else if (a === "flirt") {
    const ok = r.v + tr.rom * 25 + rnd() * 30 > 55; bump(p, ok ? 7 : -5); hear(ok ? lines(["Hehe, you're smooth.", "Stop… you're making me blush."]) : lines(["Not interested.", "Abeg, no."]));
  } else if (a === "ask") {
    const ok = r.v + tr.rom * 20 + rnd() * 25 > 62 && r.v >= 40;
    if (ok) { P.partner = p.id; P.since = S.day; p.partner = "player"; bump(p, 10); hear("Yes. I'd love that. ❤"); toast("❤ You're now dating " + p.name); log("You and " + p.name + " started dating ❤"); }
    else { bump(p, -4); hear("I like you, but… not yet."); }
  } else if (a === "prop") {
    const ok = r.v >= 80 || (r.v >= 75 && rnd() < 0.5);
    if (ok) {
      P.engaged = p.id; P.engagedSince = S.day; r.v = Math.max(r.v, 82);
      hear("YES! A thousand times yes! 💍"); toast("💍 You're engaged to " + p.name + "! Plan the wedding from the 👥 Life app.");
      log("You and " + p.name + " got engaged 💍");
      try { const L = LSim(); L && L.onEngaged && L.onEngaged(p); } catch (e) {}
    } else { bump(p, -6); hear("I… need more time."); }
  } else if (a === "baby") {
    if (p.g === "feminine") {
      if (rnd() < 0.7) {
        const st0 = S.day + DayNight.hour / 24;
        P.preg = { due: S.day + PREG_DAYS, start: st0 }; p.preg = { due: S.day + PREG_DAYS, start: st0, by: "player" };
        hear("I think… we're having a baby! 🤰");
        toast("🤰 " + p.name + " is pregnant — she'll rest at home as the belly grows. Due in ~" + PREG_DAYS + " game days");
        log(p.name + " is expecting your baby 🤰");
        setTimeout(() => { try { host && host._despawnOne && npc && host._despawnOne(npc); } catch (e) {} closePanel(); }, 2200);   /* she heads home */
      } else hear("Not this time, darling.");
    } else { P.preg = { due: S.day + 1, start: S.day + DayNight.hour / 24 }; hear("Let's adopt. I'll start the paperwork."); toast("📄 Adoption started — your child arrives tomorrow"); }
  } else if (a === "breakup") {
    const wasEng = P.engaged === p.id;
    P.partner = null; p.partner = null; P.engaged = null; r.v -= 40; hear("…I hope you're happy."); log("You and " + p.name + (wasEng ? " called off the engagement" : " broke up"));
    if (wasEng) { try { const L = LSim(); L && L.onBreakEngagement && L.onBreakEngagement(p); } catch (e) {} }
  } else if (a === "divorce") {
    P.spouse = null; p.spouse = null; r.v -= 60; hear("You'll regret this."); log("You divorced " + p.name);
  } else if (a === "along") {
    P.companion = !P.companion; toast(P.companion ? "🚶 Your family comes along" : "🏠 Your family stays home");
  } else if (a === "hang" && p.preg && Belly.stage(pregProgress(p)) >= 2) {
    hear("I'm too tired to go out. Stay with me a while?");
  } else if (a === "hang") {
    p.hang = absHour() + 3; _abs = absHour(); bump(p, 10); hear("Let's go! 🚶"); toast("🚶 " + p.name + " is hanging out with you for a few hours");
    npc.state = "life_follow"; npc._lifeLead = "player"; npc._lifeOff = [0.9, 0.4]; npc.stateT = 999; npc._companion = true;
  } else if (a === "date_walk" || a === "date_dinner" || a === "date_cinema" || a === "date_beach") {
    const D = { date_walk: ["a walk in the park", 0, 7, "park"], date_dinner: ["dinner at a restaurant", 6000, 12, "dinner"], date_cinema: ["the cinema", 4000, 10, "cinema"], date_beach: ["a trip to the beach", 3000, 9, "beach"] }[a];
    if (D[1] && (!Economy.send || !Economy.send(p.name, D[1], "Date"))) { say("You don't have enough money for that date."); return; }
    bump(p, D[2] + tr.rom * 3); p.mood = clamp(p.mood + 0.15, 0, 1);
    hear(lines(["This was lovely. ❤", "I had such a good time with you.", "We should do this more often!"]));
    toast("❤ You went on " + D[0] + (D[1] ? " · −₦" + D[1].toLocaleString() : ""));
    log("You and " + p.name + " went on a date: " + D[0]);
    try { const L = LSim(); L && L.onDate && L.onDate(p, D[3]); } catch (e) {}
  } else if (a === "selfie") {
    bump(p, 3);
    try { const L = LSim(); if (L && L.togetherSelfie) L.togetherSelfie(npc, p); else say("Camera not ready."); } catch (e) { say("Camera not ready."); }
  } else if (a === "plan") {
    closePanel();
    try { const L = LSim(); L && L.openWedding && L.openWedding(); } catch (e) {}
    return;
  } else if (a === "cookfor") {
    if (!Economy.send || !Economy.send("Groceries", 2500, "Cooking")) { say("You don't have enough money for groceries."); return; }
    bump(p, 7); p.mood = clamp(p.mood + 0.12, 0, 1); hear("Your jollof! Exactly what I was craving. 😋"); toast("🍲 −₦2,500");
  } else if (a === "massage") {
    bump(p, 6); p.mood = clamp(p.mood + 0.1, 0, 1); hear("Ahh… that's the spot. Thank you, my love.");
  } else if (a === "ante") {
    if (!Economy.send || !Economy.send("Ante-natal clinic", 8000, "Check-up")) { say("You don't have enough money for the clinic."); return; }
    bump(p, 8); hear("The doctor says the baby is healthy! 💗"); toast("🏥 Ante-natal check-up · −₦8,000");
  } else if (a === "carry_front" || a === "carry_back") {
    try { const L = LSim(); if (L && L.carryBaby) { L.carryBaby(p.id, a === "carry_back" ? "back" : "front"); closePanel(); return; } } catch (e) {}
  } else if (a === "soothe") {
    try { const L = LSim(); L && L.soothe && L.soothe(); } catch (e) {}
    hear("Shhh… there, there. 🤫");
  } else if (a === "putdown") {
    try { const L = LSim(); L && L.putDown && L.putDown(); } catch (e) {}
    closePanel(); return;
  } else if (a === "insult") {
    bump(p, -12 - tr.temper * 6); hear(lines(["Who you dey talk to like that?!", "Ah ah! You're rude!", "Don't ever say that again."]));
    if (relType(r, null, null) === "enemy") log(p.name + " is now your enemy");
  } else if (a === "sorry") {
    const ok = rnd() < 0.4 + tr.kind * 0.4; bump(p, ok ? 12 : -2); hear(ok ? "Fine… apology accepted." : "Too late for that.");
  }
  save();
  try { renderPanel(); } catch (e) {}
  try { const T = window.__ph3d_talkchat; if (T && T._current === npc) T._updateRel(); } catch (e) {}
}

/* ── People app ──────────────────────────────────────────────────────── */
function openApp() { ensureUI(); appEl.style.display = "flex"; renderApp(); }
function row(p, extra) {
  const em = p.dead ? "🕯" : p.g === "feminine" ? (p.age < 12 ? "👧" : "👩🏾") : (p.age < 12 ? "👦" : "👨🏾");
  return `<div class="row" data-id="${p.id}"><div class="av">${em}</div><div class="t"><b>${p.name}</b><span>${Math.floor(p.age)} · ${p.role === "walker" ? "resident" : p.role} · ${whereText(p)}${extra ? " · " + extra : ""}</span></div><span>${relLabel(p)}</span></div>`;
}
function renderApp() {
  const P = S.player;
  const all = Object.values(S.people).filter((p) => !p.dead || P.kids.includes(p.id));
  const known = all.filter((p) => p.rel.player && p.rel.player.met > 0);
  const tabs = { family: "Family", friends: "Friends", enemies: "Enemies", people: "Everyone", town: "Town", gossip: "Gossip" };
  let html = `<header><b>👥 People</b><button class="pill" id="lv-close">Close</button></header><div class="tabs">` +
    Object.keys(tabs).map((k) => `<button class="pill ${k === appTab ? "on" : ""}" data-tab="${k}">${tabs[k]}</button>`).join("") + `</div><div class="body">`;
  if (appTab === "family") {
    const sp = byId(P.spouse), pt = byId(P.partner), kids = P.kids.map(byId).filter(Boolean);
    html += `<div class="card"><b>Your household</b><br><span style="opacity:.7">Day ${S.day + 1} · ${P.companion ? "family comes along when you walk the city" : "family stays at home"}</span></div>`;
    if (sp) html += row(sp, sp.preg ? "🤰 expecting" : "") ; else if (pt) html += row(pt, "dating"); else html += `<div class="card" style="opacity:.7">No partner yet. Chat, be friends, flirt and ask someone out — talk to a person on the street.</div>`;
    if (P.preg) html += `<div class="card">🤰 A baby is on the way (due day ${P.preg.due + 1}).</div>`;
    for (const k of kids) html += row(k, "age " + Math.floor(k.age));
  } else if (appTab === "friends") {
    const list = known.filter((p) => ["friend", "best friend"].includes(relType(p.rel.player, null, null))).sort((a, b) => b.rel.player.v - a.rel.player.v);
    html += list.length ? list.map((p) => row(p)).join("") : `<div class="card" style="opacity:.7">No friends yet. Talk to people and keep chatting.</div>`;
  } else if (appTab === "enemies") {
    const list = known.filter((p) => p.rel.player.v <= -18).sort((a, b) => a.rel.player.v - b.rel.player.v);
    html += list.length ? list.map((p) => row(p)).join("") : `<div class="card" style="opacity:.7">Nobody hates you. Yet.</div>`;
  } else if (appTab === "people") {
    html += (known.length ? known : []).sort((a, b) => b.rel.player.last - a.rel.player.last).map((p) => row(p)).join("") || `<div class="card" style="opacity:.7">You haven't met anyone yet — press Talk near a person.</div>`;
  } else if (appTab === "town") {
    const alive = Object.values(S.people).filter((p) => !p.dead);
    const married = alive.filter((p) => p.spouse && p.id < p.spouse).length, kids = alive.filter((p) => p.age < 18).length;
    html += `<div class="card"><b>Port Harcourt population</b><br>${alive.length} people · ${married} married couples · ${kids} children</div>`;
    const outNow = alive.filter((p) => p.out).length;
    html += `<div class="card">${outNow} people are out and about right now; the rest are at home, at school or work.</div>`;
    html += alive.slice().sort((a, b) => (b.out ? 1 : 0) - (a.out ? 1 : 0)).slice(0, 30).map((p) => row(p)).join("");
  } else {
    html += S.log.length ? S.log.map((l) => `<div class="log"><span style="opacity:.6">Day ${l.d + 1}, ${String(l.h).padStart(2, "0")}:00</span><br>${l.t}</div>`).join("") : `<div class="card" style="opacity:.7">Nothing to gossip about yet — give the town a few days.</div>`;
  }
  html += "</div>";
  appEl.innerHTML = html;
  appEl.querySelector("#lv-close").onclick = closeApp;
  appEl.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { appTab = b.dataset.tab; renderApp(); }));
  appEl.querySelectorAll(".row").forEach((r) => (r.onclick = () => profile(r.dataset.id)));
}
function profile(id) {
  const p = byId(id); if (!p) return;
  const names = (ids) => ids.map(byId).filter(Boolean).map((x) => x.name).join(", ") || "—";
  const rels = Object.keys(p.rel).filter((k) => k !== "player" && byId(k) && p.rel[k].met > 0).map((k) => [byId(k), p.rel[k]]);
  const fr = rels.filter(([o, r]) => ["friend", "best friend"].includes(relType(r, p, o))).map(([o]) => o.name).slice(0, 5).join(", ") || "—";
  const en = rels.filter(([o, r]) => r.v <= -18).map(([o]) => o.name).slice(0, 5).join(", ") || "—";
  const sp = byId(p.spouse), pt = byId(p.partner);
  const tr = p.tr, bar = (v) => `<span style="display:inline-block;width:70px;height:6px;border-radius:4px;background:#26302b;vertical-align:middle"><i style="display:block;height:100%;width:${Math.round(v * 100)}%;background:#7dff9a;border-radius:4px"></i></span>`;
  appEl.querySelector(".body").innerHTML = `<button class="pill" id="lv-back">← Back</button>
    <div class="card"><b style="font-size:18px">${p.name}</b><br>${Math.floor(p.age)} · ${p.role === "walker" ? "resident" : p.role} · ${whereText(p)}<br>You: ${relLabel(p)}</div>
    <div class="card"><b>Family</b><br>Spouse: ${p.spouse === "player" ? "You 💍" : sp ? sp.name : pt ? pt.name + " (dating)" : "single"}<br>Children: ${names(p.kids)}<br>Parents: ${names(p.parents.filter((x) => x && x !== "player"))}${p.preg ? "<br>🤰 expecting" : ""}</div>
    <div class="card"><b>Social life</b><br>Friends: ${fr}<br>Enemies: ${en}</div>
    <div class="card"><b>Personality</b><br>Friendly ${bar(tr.kind)} Outgoing ${bar(tr.ext)}<br>Temper ${bar(tr.temper)} Romantic ${bar(tr.rom)}<br>Loyal ${bar(tr.loy)} Religious ${bar(tr.rel)}</div>`;
  appEl.querySelector("#lv-back").onclick = renderApp;
}

/* ═══ public API ═══════════════════════════════════════════════════════ */
export const Lives = {
  /* One-time load of the persistent world. Safe to call from anywhere (no NPC host needed). */
  init() {
    if (!S) { S = load(); if (!S) genStart(); S.player = S.player || { spouse: null, partner: null, kids: [], companion: true }; S.log = S.log || []; _abs = S.day * 24 + Math.floor(DayNight.hour); applySchedules(); lastHourInt = Math.floor(DayNight.hour); for (const p of Object.values(S.people)) { p._npc = null; } getTHREE().catch(() => {}); try { document.addEventListener("visibilitychange", () => { if (document.hidden) save(); }); } catch (e) {} setTimeout(ensureUI, 500); topUpInfants(); if (S.player.held && (!byId(S.player.held) || byId(S.player.held).dead)) S.player.held = null; }
  },
  setHost(h) { host = h; this.init(); },
  /* hourly catch-up — runs even when no NPCs are loaded (home, church, …) */
  pulse() {
    if (!S) return;
    const hi = Math.floor(DayNight.hour);
    if (lastHourInt < 0) lastHourInt = hi;
    if (hi !== lastHourInt) {
      let guard = 0;
      while (lastHourInt !== hi && guard++ < 30) { lastHourInt = (lastHourInt + 1) % 24; simHour(lastHourInt); }
    }
  },
  state() { return S; },
  city(on) { cityOn = !!on; },
  isCity: () => cityOn,
  /* call the spouse + kids to the player right now (any hour) / send them home */
  callCompanions(on) {
    if (!S) return;
    _forceCompanions = !!on;
    if (on) { S.player.companion = true; try { companions(_px, _pz); } catch (e) {} }
    else if (host) { for (const n of host.list) if (n._companion && !n.dead) { n._companion = false; try { host._despawnOne && host._despawnOne(n); } catch (e) {} } S.player.companion = false; }
  },
  drive, endLife,
  claim, unbind,
  hidden(npc) { return !!npc._lifeHidden; },
  tick(dt, px, pz) {
    if (!S) return;
    _px = px; _pz = pz;
    Lives.pulse();
    secAcc += dt; saveAcc += dt;
    if (secAcc >= 1 && cityOn) {
      secAcc = 0;
      try { secondPass(px, pz); } catch (e) { console.warn("[lives]", e); }
      const _T = window.__ph3d_talkchat, _chatOn = !!(_T && _T._current && _T._current === curNpc);
      if (curNpc && ((panelEl && panelEl.style.display !== "none") || _chatOn)) {
        const d = Math.hypot(curNpc.ctl.pos.x - px, curNpc.ctl.pos.z - pz);
        if (d > 7 || curNpc.dead || performance.now() - openedAt > 120000) closePanel();
      }
    }
    if (saveAcc > 25) { saveAcc = 0; save(); }
  },
  /* dating & relationships work ANYWHERE — street, market, church, events, inside buildings */
  onTalk(npc) {
    if (!S) return;
    if (!npc || !npc._life) { try { claim(npc, !cityOn); } catch (e) {} }
    if (npc && npc._life) {
      curNpc = npc; openedAt = performance.now();
      import("../ui/talk-chat.js").then((m) => m.TalkChat.open(npc)).catch(() => { try { openPanel(npc); } catch (e) {} });
    }
  },
  onDeath(npc) {
    const p = npc && npc._life; if (!p) return;
    p.dead = true; p._npc = null; const P = S.player;
    log("🕯 " + p.name + " died");
    for (const k of Object.keys(p.rel)) { const o = byId(k); if (o && o.rel[p.id]) { /* mourners */ o.mood = Math.max(0, o.mood - 0.3); } }
    if (P.spouse === p.id) { P.spouse = null; toast("🕯 Your spouse " + p.name + " has died"); }
    if (P.partner === p.id) P.partner = null;
    const sp = byId(p.spouse); if (sp) sp.spouse = null;
    save();
  },
  onDespawn() { if (!S) return; for (const p of Object.values(S.people)) p._npc = null; cityOn = false; closePanel(); save(); },
  openApp, openPanel,
  /* called by the TalkChat quick-reply chips: same action code as the old panel */
  act(a, npc) { if (npc) curNpc = npc; act(a); },
  /* ── life-sim API (used by lifesim.js / wedding.js / home-prog.js) ── */
  STAGES, STAGE_LABEL, INFANT_AGE,
  byId: (id) => byId(id),
  stageOf: (p) => (S && p ? stageOf(p) : "stranger"),
  pregProgress: (p) => pregProgress(p),
  infantOf: (p) => infantOf(p),
  player: () => (S ? S.player : null),
  rel: (p) => pRel(p),
  relationLabel: (p) => relLabel(p),
  people: () => (S ? Object.values(S.people) : []),
  log: (t) => { if (S) log(t); },
  save: () => save(),
  bindNpc(npc, p) { if (!npc || !p) return; p._npc = npc; npc._life = p; if (!p.cfg && npc._cfg) p.cfg = npc._cfg; },
  setHeld(id) { if (S) { S.player.held = id || null; save(); } },
  /* the wedding finished in church: engaged → married */
  completeWedding() {
    if (!S) return null;
    const P = S.player, p = byId(P.engaged || P.partner); if (!p) return null;
    P.spouse = p.id; P.partner = null; P.engaged = null; P.married = S.day;
    p.spouse = "player"; p.partner = null; p.home = "H_player";
    const r = pRel(p); r.v = Math.max(r.v, 90); r.met = Math.max(r.met, 10);
    log("You married " + p.name + " 💍 at church"); save(); return p;
  },
  /* give the in-home family member the same relationship panel the street NPCs get */
  openPanelFor(npcLike) { try { openPanel(npcLike); } catch (e) {} },
  closePanel,
};
if (typeof window !== "undefined") window.__ph3d_lives = Lives;
