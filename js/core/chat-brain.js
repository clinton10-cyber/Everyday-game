/* js/core/chat-brain.js — NPC chat matcher.
   normalize → tokenize → score every intent → weighted pick among the best →
   role override → avoid last 3 replies → occasional follow-up. */
import { CHAT_CORPUS as BASE_CORPUS } from "../data/chat-corpus.js";
import { CHAT_PLUS, CHAT_PATCHES } from "../data/chat-corpus-plus.js";
import { NpcMoney } from "./npc-money.js";

/* Merge: base corpus + patches (extra pats/reps/roleReps/action) + brand-new intents. */
const CHAT_CORPUS = BASE_CORPUS.map((i) => {
  const p = CHAT_PATCHES[i.id];
  if (!p) return i;
  const drop = new Set(p.drop || []);
  const roleReps = p.replace ? {} : { ...(i.roleReps || {}) };
  for (const k in (p.roleReps || {})) roleReps[k] = (roleReps[k] || []).concat(p.roleReps[k]);
  return { ...i, action: p.action || i.action,
    pats: i.pats.filter((x) => !drop.has(x)).concat(p.pats || []),
    reps: (p.replace ? [] : (i.reps || [])).concat(p.reps || []),
    roleReps: Object.keys(roleReps).length ? roleReps : undefined };
}).concat(CHAT_PLUS);

const REPLY_MEMORY = new Map();   /* npcId → last 3 replies */
const TOPIC_MEMORY = new Map();   /* npcId → last 3 intent ids */
const BY_ID = new Map(CHAT_CORPUS.map((i) => [i.id, i]));
const CHILD_ONLY = new Set(CHAT_CORPUS.flatMap((i) => i.child || []));
const EMOJI_RE = /[^\x00-\x7F]/;

function normalize(s) {
  return String(s || "").toLowerCase()
    .replace(/[^\w\s'\u2600-\u27BF\u{1F000}-\u{1FFFF}\u2764\uFE0F₦]/gu, " ")
    .replace(/\s+/g, " ").trim();
}
const tokens = (s) => normalize(s).split(" ").filter(Boolean);

function lev(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/* filler words never count as a partial match on their own */
const STOP = new Set(("a an the i me my you your u am is are was it its to of for in on at and or but so we he she they " +
  "them this that do does did be been have has had will can just o oh na dey with abeg please").split(" "));

function scoreIntent(padded, tokensIn, intent) {
  let score = 0, partial = 0, phrase = false, best = 0, extra = 0;
  for (const pat of intent.pats) {
    const np = normalize(pat);
    if (!np) continue;
    /* whole-word/phrase match (longer phrases score higher). The single best phrase
       dominates; further matches in the same intent only add a little, so a pile of
       short overlapping patterns cannot outvote one specific long phrase. */
    const hit = (v) => { phrase = true; if (v > best) { extra += best; best = v; } else extra += v; };
    if (EMOJI_RE.test(np)) { if (padded.includes(np)) hit(22); continue; }
    if (padded.includes(" " + np + " ")) { hit(22 + np.length * 0.3); continue; }
    if (np.length <= 2) continue;
    const pt = np.split(" ").filter(Boolean);
    if (pt.length > 1 && pt.every((t) => tokensIn.includes(t)) && pt.some((t) => !STOP.has(t))) { hit(12); continue; }
    for (const p of pt) {
      if (STOP.has(p)) continue;
      for (const t of tokensIn) {
        if (p === t) { partial += pt.length > 1 ? 1.5 : 3; break; }
        if (p.length > 3 && t.length > 3 && lev(p, t) <= 1) { partial += 2; break; }
      }
    }
  }
  /* many loosely-related patterns must not outvote a real phrase hit */
  score = best + 0.25 * extra + Math.min(partial, phrase ? 8 : 10);
  intent._phrase = phrase;
  return score;
}

const FALLBACKS = [
  "Sorry, I no catch am. Talk am another way?",
  "Ah, I no understand. Wetin you mean?",
  "Hmm. Explain am small.",
  "I hear you, but I no sabi wetin you mean.",
  "You dey talk big grammar. Simplify am.",
  "Sorry, my friend. Try another way.",
  "Ehn? Repeat am, my ears dey block.",
  "E be like say I miss that one. Say am again.",
  "Hmm, I no too gets. Try ask me about food, money, football or PH.",
  "Wetin you dey talk? I no follow.",
  "Abeg, talk am plain so I go understand.",
  "Your gist sweet, but I no fit catch am. Another way?",
];
const ROLE_FALLBACKS = {
  police: ["State that clearly, citizen.", "I didn't get that. Speak plainly."],
  priest: ["My child, say it again, I didn't hear well.", "Speak freely, I am listening."],
  trader: ["Oga, buy something or talk plain!", "I no hear you for the noise. Say am again."],
  doctor: ["Can you describe that more clearly?", "I need more detail."],
  banker: ["Could you rephrase that, please?", "I didn't quite follow. Say again."],
  taxi: ["Oga, where you dey go? Talk plain.", "Say am again, the engine dey noise."],
  mechanic: ["Boss, explain the problem well.", "Say again. The generator dey loud."],
};
const fallback = (npc) => {
  const role = npc && (npc.groupTag || npc.role);
  const pool = (ROLE_FALLBACKS[role] && Math.random() < 0.5) ? ROLE_FALLBACKS[role] : FALLBACKS;
  return pool[Math.floor(Math.random() * pool.length)];
};

/* ---- reply tokens: {time} {daypart} {weekday} {name} ---- */
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function gameHour() {
  try { const dn = window.__ph3d_daynight; if (dn && typeof dn.hour === "number") return dn.hour; } catch (e) {}
  const n = new Date(); return n.getHours() + n.getMinutes() / 60;
}
function fillTokens(text, npc) {
  if (!text || text.indexOf("{") < 0) return text;
  const h = gameHour(), hh = Math.floor(h) % 24, mm = Math.floor((h - Math.floor(h)) * 60);
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return text
    .replace(/\{time\}/g, h12 + ":" + String(mm).padStart(2, "0") + (hh < 12 ? " am" : " pm"))
    .replace(/\{daypart\}/g, h < 5 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 20 ? "evening" : "night")
    .replace(/\{weekday\}/g, DAYS[new Date().getDay()])
    .replace(/\{name\}/g, npc && npc._life && npc._life.name ? npc._life.name.split(" ")[0] : "friend");
}

const GRUMPY = ["Ah, I no dey mood. ", "Abeg, I dey vex small. ", "Make we do am quick, my head dey hot. "];
const MERRY = ["", "", "", "😄 ", "Ah! ", ""];
const TIPPABLE = new Set(["nice", "pretty", "handsome", "smart", "kind", "strong", "talented", "respectful",
  "funny_compliment", "friendly", "lol", "funny_thing", "joke", "thankyou", "thanks_gratitude", "congrats"]);

export const ChatBrain = {
  reply(npc, text) {
    const npcId = npc && npc._life && npc._life.id;
    if (!npcId) return fallback(npc);
    const norm = normalize(text), toks = tokens(text);
    if (!toks.length) return fallback(npc);
    const padded = " " + norm + " ";

    /* sometimes continue the previous topic with its follow-up intent */
    const hist = TOPIC_MEMORY.get(npcId) || [];
    const last = BY_ID.get(hist[hist.length - 1]);
    if (last && last.child && toks.length <= 3 && Math.random() < 0.4) {
      const child = BY_ID.get(last.child[Math.floor(Math.random() * last.child.length)]);
      if (child) {
        const r = this._pick(child, npc, npcId);
        this._remember(npcId, r, child.id);
        return r;
      }
    }

    const scored = [];
    for (const intent of CHAT_CORPUS) {
      if (CHILD_ONLY.has(intent.id)) continue;
      let s = scoreIntent(padded, toks, intent);
      if (s > 0 && intent.action && intent._phrase) s += 10;   /* a clear money/action phrase wins ties */
      if (s > 0) scored.push({ intent, score: s });
    }
    scored.sort((a, b) => b.score - a.score);
    if (!scored.length || scored[0].score < 3) { this._remember(npcId, null, null); return fallback(npc); }

    /* weighted pick among near-best candidates only */
    const best = scored[0].score;
    const top = scored.slice(0, 3).filter((s) => s.score >= best * 0.6);
    let roll = Math.random() * top.reduce((a, s) => a + s.score, 0);
    let chosen = top[0].intent;
    if (!top[0].intent.action) for (const s of top) { roll -= s.score; if (roll <= 0) { chosen = s.intent; break; } }

    let r = null;
    /* intents with an action (money, memory...) get first go; null = fall back to normal replies */
    if (chosen.action) {
      try {
        r = chosen.action === "memory" ? this._memory(npc) : NpcMoney.handle(chosen.action, npc, text);
      } catch (e) { console.warn("[chat] action failed", e); r = null; }
    }
    if (!r) r = this._pick(chosen, npc, npcId);
    if (chosen.id === "yourname" && npc._life.name) {
      const nm = npc._life.name;
      r = [`I'm ${nm}.`, `My name na ${nm}.`, `${nm}. And you?`, `Everybody dey call me ${nm.split(" ")[0]}.`][Math.floor(Math.random() * 4)];
    }
    /* mood colours the reply; greetings remind you of unpaid debts; kind words can earn a tip */
    if (!chosen.action) {
      const mood = npc._life.mood;
      if (typeof mood === "number" && mood < 0.3 && Math.random() < 0.3) r = GRUMPY[Math.floor(Math.random() * GRUMPY.length)] + r;
      else if (typeof mood === "number" && mood > 0.8 && Math.random() < 0.25) r = MERRY[Math.floor(Math.random() * MERRY.length)] + r;
      if (/^greet/.test(chosen.id)) { try { r += NpcMoney.reminder(npc); } catch (e) {} }
      if (TIPPABLE.has(chosen.id)) { try { r += NpcMoney.spontaneous(npc); } catch (e) {} }
    }
    r = fillTokens(r, npc);
    this._remember(npcId, r, chosen.id);
    return r;
  },

  /* "do you remember me?" answered from the real relationship value */
  _memory(npc) {
    const L = npc && npc._life; const rel = L && L.rel && L.rel.player;
    const v = rel ? rel.v || 0 : 0, met = rel ? rel.met || 0 : 0;
    const first = (L && L.name ? L.name.split(" ")[0] : "friend");
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    if (v >= 60) return pick(["Of course I remember you! You be my person.", "How I no go know you? We dey close, o.", "Ah, na you! My very good friend."]);
    if (v >= 25) return pick(["Yes, I know you. We don talk before.", "I remember you, o. How you dey?", "Ehen, you be familiar face. We don meet."]);
    if (v <= -20) return pick(["I remember you. Make you no come and cause wahala again.", "Yes. And I never forget wetin happen."]);
    if (met > 0) return pick(["Hmm, your face dey familiar small.", "We don meet before, abi? Remind me.", "I think so. Refresh my memory."]);
    return pick(["No, I no think we don meet. I'm " + first + ".", "We never meet o. Nice to meet you.", "Hmm, no. But today we don meet."]);
  },

  _pick(intent, npc, npcId) {
    const role = npc && (npc.groupTag || npc.role);
    let pool = (intent.roleReps && (intent.roleReps[role] || intent.roleReps[npc && npc.role])) || intent.reps;
    if (!pool || !pool.length) pool = intent.reps || ["…"];
    const recent = REPLY_MEMORY.get(npcId) || [];
    const fresh = pool.filter((r) => !recent.includes(r));
    const src = fresh.length ? fresh : pool;
    return src[Math.floor(Math.random() * src.length)];
  },

  _remember(npcId, reply, topicId) {
    if (!npcId) return;
    if (reply) {
      const r = REPLY_MEMORY.get(npcId) || [];
      r.push(reply); if (r.length > 3) r.shift();
      REPLY_MEMORY.set(npcId, r);
    }
    if (topicId) {
      const t = TOPIC_MEMORY.get(npcId) || [];
      t.push(topicId); if (t.length > 3) t.shift();
      TOPIC_MEMORY.set(npcId, t);
    }
  },

  /* debug helper: top-N intent ids for a message (no side effects) */
  rank(text, n = 3) {
    const padded = " " + normalize(text) + " ", toks = tokens(text), out = [];
    for (const intent of CHAT_CORPUS) {
      if (CHILD_ONLY.has(intent.id)) continue;
      let sc = scoreIntent(padded, toks, intent);
      if (sc > 0 && intent.action && intent._phrase) sc += 10;
      if (sc > 0) out.push([intent.id, +sc.toFixed(1)]);
    }
    return out.sort((a, b) => b[1] - a[1]).slice(0, n);
  },

  force(npc, intentId) {
    const intent = BY_ID.get(intentId);
    return intent ? this._pick(intent, npc, npc && npc._life && npc._life.id) : null;
  },

  stats() {
    return {
      intents: CHAT_CORPUS.length,
      patterns: CHAT_CORPUS.reduce((a, i) => a + i.pats.length, 0),
      replies: CHAT_CORPUS.reduce((a, i) => a + i.reps.length + (i.roleReps ? Object.values(i.roleReps).flat().length : 0), 0),
    };
  },
};
