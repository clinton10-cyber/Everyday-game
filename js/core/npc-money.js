/* ============================================================
   npc-money.js — NPCs can hand the player money through chat.
   Called by ChatBrain when the matched intent carries an `action`.

     beg      "abeg help me with small money"  -> gift (or a polite no)
     borrow   "lend me 5k"                     -> loan, tracked as a debt
     repay    "take your money, 2000"          -> pays the debt, trust goes up
     errand   "i need work"                    -> quick job, paid on the spot
     give_to  "take 500"                       -> YOU gift the NPC, they warm up
     debt     "how much do i owe you"          -> tells you the balance

   Plus spontaneous(): a small tip after a compliment / a good laugh.

   Willingness comes from how well they know you (relationship),
   their mood, how kind they are, and their job (a banker has more
   than a prisoner). Guard rails: per-NPC cooldown + daily limit, a
   global daily cap, and nobody pities you once you're rich.
   ============================================================ */
import { Economy } from "./economy.js";

const KEY = "ph3d.npcmoney.v1";
const COOLDOWN_MS   = 8 * 60 * 1000;   /* per NPC, per kind of favour */
const MAX_PER_NPC_DAY = 3;
const DAILY_CAP     = 60000;           /* ₦ from all NPCs per real day */
const RICH_LIMIT    = 250000;          /* above this nobody feels sorry for you */

/* rough pocket money by job (₦) */
const BASE = { banker: 2500, doctor: 2500, police: 1500, warden: 1200, trader: 1200, taxi: 800,
               mechanic: 1000, priest: 700, walker: 700, inmate: 0 };
const NEVER = new Set(["inmate"]);             /* have nothing to give */
const OFFICIAL = new Set(["police", "warden"]); /* don't hand out cash */

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const r50 = (n) => Math.max(50, Math.round(n / 50) * 50);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (n) => "₦" + Math.floor(n).toLocaleString();
const dayKey = () => new Date().toISOString().slice(0, 10);

let S = null;
function load() {
  if (S) return S;
  try { S = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { S = null; }
  if (!S || typeof S !== "object") S = {};
  S.npc = S.npc || {};      /* id -> { day, n, last:{kind:ts} } */
  S.debts = S.debts || {};  /* id -> { owed, principal, since, name } */
  if (S.day !== dayKey()) { S.day = dayKey(); S.total = 0; for (const k in S.npc) { S.npc[k].n = 0; } }
  return S;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

function toast(msg) {
  try { if (window.__ph3d_phone && window.__ph3d_phone._toast) { window.__ph3d_phone._toast(msg); return; } } catch (e) {}
  try { console.log("[npc-money]", msg); } catch (e) {}
}

/* "5000", "5,000", "₦2k", "10 k", "2 thousand" -> number | null */
export function parseAmount(text) {
  const t = String(text || "").toLowerCase().replace(/,/g, "");
  const m = t.match(/(\d+(?:\.\d+)?)\s*(k|thousand|m|million)?\b/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  const u = m[2];
  if (u === "k" || u === "thousand") n *= 1000;
  else if (u === "m" || u === "million") n *= 1000000;
  return n > 0 ? Math.floor(n) : null;
}

function info(npc) {
  const L = npc && npc._life; if (!L) return null;
  const role = npc.groupTag || npc.role || "walker";
  const rel = (L.rel && L.rel.player) || { v: 0, met: 0 };
  const tr = L.tr || {};
  const rec = (S.npc[L.id] = S.npc[L.id] || { n: 0, last: {} });
  return {
    L, id: L.id, name: L.name || "Someone", first: String(L.name || "friend").split(" ")[0],
    role, v: rel.v || 0, kind: tr.kind == null ? 0.5 : tr.kind, mood: L.mood == null ? 0.6 : L.mood, rec,
    base: BASE[role] != null ? BASE[role] : 700,
  };
}
const bumpRel = (L, n) => {
  if (!L.rel) L.rel = {};
  const r = L.rel.player || (L.rel.player = { v: 0, met: 0, last: 0 });
  r.v = clamp((r.v || 0) + n, -100, 100);
};
const cooling = (I, kind) => Date.now() - (I.rec.last[kind] || 0) < COOLDOWN_MS;
const capped = () => (S.total || 0) >= DAILY_CAP;

/* money from the NPC to the player */
function payOut(I, amt, note) {
  amt = Math.floor(amt);
  amt = Math.min(amt, Math.max(0, DAILY_CAP - (S.total || 0)));
  if (amt <= 0) return 0;
  Economy.receive(I.name, amt, note);
  S.total = (S.total || 0) + amt;
  I.rec.n = (I.rec.n || 0) + 1;
  save();
  toast("💸 " + I.first + " gave you " + fmt(amt));
  return amt;
}

/* ---- the favours ------------------------------------------------ */
const NO_STRANGER = [
  "Ah, I no know you reach like that o.", "Oga, we never close like that. Come back later.",
  "Na so you go just ask me money? Make we know each other first.", "My brother, I no get now.",
];
const NO_BROKE = [
  "Ah, my own hand dey empty too.", "I no get anything for hand now, sorry.", "Na the same sapa dey follow me.",
];
const NO_COOL = [
  "I just help you small time now. Make e rest small.", "Oga, give me breathing space. Later.", "Eh! You no go let me breathe?",
];
const NO_RICH = [
  "You get more money pass me! Na me you dey ask?", "Ah, you dey look like person wey get plenty. Not today.",
];
const NO_MOOD = ["I no dey mood for this thing today.", "Not now, I dey vex small. Another time."];

function guard(I, kind) {
  if (NEVER.has(I.role)) return pick(["Me? I dey inside here, wetin I get?", "Ha! I no even get belt, na money?"]);
  if (Economy.balance > RICH_LIMIT) return pick(NO_RICH);
  if (capped()) return pick(NO_BROKE);
  if (cooling(I, kind)) return pick(NO_COOL);
  if ((I.rec.n || 0) >= MAX_PER_NPC_DAY) return "Enough for today, o. Come back tomorrow.";
  return null;
}

function beg(I) {
  const g = guard(I, "beg"); if (g) return g;
  if (OFFICIAL.has(I.role)) return I.role === "police" ? "Officer no dey give money. Go and find work." : "I no dey give money. Move.";
  if (I.mood < 0.28) return pick(NO_MOOD);
  /* chance: how close + how kind + mood. Strangers can still get pity from kind people. */
  let chance = 0.12 + (I.v / 100) * 0.62 + (I.kind - 0.5) * 0.4 + (I.mood - 0.5) * 0.25;
  if (I.role === "priest") chance += 0.25;
  if (I.role === "trader" && I.v < 25) chance -= 0.15;
  chance = clamp(chance, 0.04, 0.92);
  I.rec.last.beg = Date.now();
  if (Math.random() > chance) { save(); return I.v < 10 ? pick(NO_STRANGER) : pick(NO_BROKE); }
  const amt = payOut(I, r50(I.base * (0.45 + Math.max(0, I.v) / 100) * rnd(0.6, 1.4)), "Gift");
  if (!amt) return pick(NO_BROKE);
  bumpRel(I.L, 0.5);
  const lines = I.role === "priest"
    ? ["Take this for transport, my child. God bless you. 🙏", "The Lord provides. Here, " + fmt(amt) + "."]
    : I.v >= 40
      ? ["Ah, you be my person. Collect " + fmt(amt) + ".", "Take " + fmt(amt) + ", don't mention.", "No wahala. " + fmt(amt) + " for you."]
      : ["Since you ask nicely, take " + fmt(amt) + ".", "Hmm. Here, " + fmt(amt) + ". Use am well.", "God punish poverty. Take " + fmt(amt) + "."];
  return pick(lines) + " 💸 +" + fmt(amt);
}

function limitFor(I) {
  const bank = I.role === "banker";
  const f = bank ? 10 : 4;
  return r50(I.base * f * (bank ? 1 : 0.4 + Math.max(0, I.v) / 100));
}

function borrow(I, text) {
  const debt = S.debts[I.id];
  if (debt) return "Oga, you still dey owe me " + fmt(debt.owed) + ". Pay that one first.";
  const g = guard(I, "borrow"); if (g) return g;
  const bank = I.role === "banker";
  if (OFFICIAL.has(I.role)) return "I no lend money. Go to the bank.";
  if (!bank && I.v < 15) return pick(NO_STRANGER);
  if (I.mood < 0.25) return pick(NO_MOOD);
  const limit = limitFor(I);
  let want = parseAmount(text);
  let capped_ = false;
  if (!want) want = r50(limit * 0.4);
  if (want > limit) { want = limit; capped_ = true; }
  if (want < 100) want = 100;
  const rate = bank ? 0.15 : 0;
  const owed = Math.round(want * (1 + rate));
  I.rec.last.borrow = Date.now();
  const amt = payOut(I, want, bank ? "Loan" : "Loan from " + I.first);
  if (!amt) return pick(NO_BROKE);
  S.debts[I.id] = { owed: Math.round(amt * (1 + rate)), principal: amt, since: Date.now(), name: I.name };
  save();
  const pre = capped_ ? "That amount too big for me, but " : "";
  return pre + (bank
    ? (capped_ ? "I can approve " : "Loan approved: ") + fmt(amt) + ". You go pay back " + fmt(S.debts[I.id].owed) + " (15% interest). Tell me when you ready."
    : (capped_ ? "I fit lend you " : "Okay, I fit lend you ") + fmt(amt) + ". Just bring am back, o. Don't disgrace me.") + " 💸 +" + fmt(amt);
}

function repay(I, text) {
  const d = S.debts[I.id];
  if (!d) return pick(["You no owe me anything, my friend.", "Which money? We clear before.", "No debt between us."]);
  let amt = parseAmount(text) || d.owed;
  amt = Math.min(amt, d.owed);
  if (amt > Economy.balance) return "Your account no reach " + fmt(amt) + " now. Come back when you get am.";
  if (!Economy.send(I.name, amt, "Loan repayment")) return "The payment no go through. Try again.";
  d.owed -= amt;
  if (d.owed <= 0) {
    delete S.debts[I.id];
    bumpRel(I.L, I.role === "banker" ? 2 : 6);
    save(); toast("✅ Debt cleared with " + I.first);
    return pick(["You be man of your word! Debt don clear. 🙌", "Ah, you pay am. I respect you.", "All clear. Anytime you need small help, come."]);
  }
  save();
  return "I receive " + fmt(amt) + ". You still dey owe " + fmt(d.owed) + ".";
}

function debt(I) {
  const d = S.debts[I.id];
  return d ? "You owe me " + fmt(d.owed) + ". Whenever you ready." : pick(["You no owe me anything.", "We clear. No wahala."]);
}

const ERRANDS = {
  trader:   ["Help me carry these goods to the shop.", "Arrange these tomatoes for me small.", "Come mind my table for a minute."],
  taxi:     ["Help me wash the windscreen.", "Come push this car small.", "Direct me for the park."],
  mechanic: ["Pass me those spanners.", "Hold this torch for me.", "Help me roll this tyre."],
  banker:   ["Carry these files upstairs.", "Run to the printer for me."],
  doctor:   ["Help me move these boxes of supplies.", "Run this paper to reception."],
  priest:   ["Help me arrange the chairs.", "Sweep around the compound small."],
  walker:   ["Help me carry this load.", "Run to the shop for me.", "Hold this bag small."],
};
function errand(I) {
  const g = guard(I, "errand"); if (g) return g;
  if (OFFICIAL.has(I.role)) return "No work here. Move along.";
  if (I.mood < 0.25) return pick(NO_MOOD);
  I.rec.last.errand = Date.now();
  const amt = payOut(I, r50(I.base * rnd(0.35, 0.8)), "Job");
  if (!amt) return pick(NO_BROKE);
  bumpRel(I.L, 1.5);
  return pick(ERRANDS[I.role] || ERRANDS.walker) + " ... Done! Good work. Here, " + fmt(amt) + " for your trouble. 💸 +" + fmt(amt);
}

function giveTo(I, text) {
  const amt = parseAmount(text);
  if (!amt || amt < 50) return null;           /* no real amount: let the normal reply run */
  if (amt > Economy.balance) return "Oga, your account no reach " + fmt(amt) + ". Keep am.";
  if (!Economy.send(I.name, amt, "Gift to " + I.first)) return null;
  const warm = clamp(amt / 400, 0.5, 8);
  bumpRel(I.L, warm);
  I.L.mood = clamp((I.L.mood == null ? 0.6 : I.L.mood) + 0.1, 0, 1);
  save();
  return pick(["Chai! " + fmt(amt) + "? God bless you!", "Ah, thank you, oga. I no go forget this.", "Wow, na so? You dey kind, o!", "May your pocket never dry. 🙏"]);
}

export const NpcMoney = {
  handle(action, npc, text) {
    load();
    const I = info(npc); if (!I) return null;
    switch (action) {
      case "beg": return beg(I);
      case "borrow": return borrow(I, text);
      case "repay": return repay(I, text);
      case "errand": return errand(I);
      case "give_to": return giveTo(I, text);
      case "debt": return debt(I);
      default: return null;
    }
  },

  /* a small unprompted tip after kind words. Returns text to append, or "". */
  spontaneous(npc) {
    load();
    const I = info(npc); if (!I) return "";
    if (NEVER.has(I.role) || OFFICIAL.has(I.role) || Economy.balance > RICH_LIMIT || capped()) return "";
    if (I.v < 20 || I.mood < 0.5 || cooling(I, "tip") || (I.rec.n || 0) >= MAX_PER_NPC_DAY) return "";
    if (Math.random() > 0.12 + I.kind * 0.1) return "";
    I.rec.last.tip = Date.now();
    const amt = payOut(I, r50(I.base * rnd(0.15, 0.35)), "Tip");
    return amt ? " " + pick(["Take " + fmt(amt) + " for chop.", "Here, " + fmt(amt) + " for your trouble.", "Small something: " + fmt(amt) + "."]) + " 💸" : "";
  },

  /* reminder tacked onto a greeting when the player owes this NPC */
  reminder(npc) {
    load();
    const L = npc && npc._life; if (!L) return "";
    const d = S.debts[L.id];
    if (!d) return "";
    const overdue = Date.now() - d.since > 20 * 60 * 1000;
    return overdue ? " By the way, my " + fmt(d.owed) + " dey wait you o." : "";
  },

  debts() { load(); return S.debts; },
  hasDebt(npc) { load(); return !!(npc && npc._life && S.debts[npc._life.id]); },
  parseAmount,
};
if (typeof window !== "undefined") window.__ph3d_npcMoney = NpcMoney;
