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
  let out = String(s || "").toLowerCase()
    .replace(/[^\w\s'\u2600-\u27BF\u{1F000}-\u{1FFFF}\u2764\uFE0F₦]/gu, " ")
    .replace(/\s+/g, " ").trim();
  /* Common chat shorthand, Nigerian English and predictable mobile typos. */
  const aliases = {
    "u":"you","ur":"your","r":"are","hw":"how","wht":"what","wat":"what",
    "wer":"where","whr":"where","cn":"can","gt":"get","hv":"have","pls":"please","plz":"please",
    "dis":"this","dat":"that","dem":"them","dey":"they","d":"the",
    "b":"be","nd":"and","bt":"but","coz":"because","cuz":"because",
    "gud":"good","gd":"good","m":"am","im":"i am","ive":"i have",
    "wanna":"want to","wan":"want","gonna":"going to","gon":"going",
    "fud":"food","fudds":"food","expensiv":"expensive","cheep":"cheap",
    "resturant":"restaurant","restraunt":"restaurant","univers ty":"university"
  };
  return out.split(" ").map(t => aliases[t] || t).join(" ").replace(/\s+/g," ").trim();
}
const tokens = (s) => normalize(s).split(" ").filter(Boolean);

/* Small, conservative spell correction. Only correct longer words when one
   clear corpus word is a close match; names, numbers and short slang stay intact. */
const WORD_BANK = (() => {
  const set = new Set(("where what when which who why how much many expensive cheap food restaurant shop market "
    +"university school hospital police doctor mechanic money friend family house home work job salary price "
    +"taxi ride car bus airport flight ticket road direction location place near far today tomorrow yesterday "
    +"hungry thirsty tired angry happy sad beautiful handsome sorry please thank welcome relationship girlfriend "
    +"boyfriend married dating children child brother sister mother father university church mosque bank "
    +"football match Arsenal Chelsea Liverpool weather rain hot cold phone battery data internet message "
    +"buy sell borrow lend give take help need want looking find tell explain remember know understand "
    +"Port Harcourt Rumuola Mile Eleme Chika Daniel Amara Kelechi").toLowerCase().split(/\s+/));
  for (const intent of CHAT_CORPUS) for (const phrase of intent.pats || [])
    for (const word of normalize(phrase).split(" ")) if (word.length > 3) set.add(word);
  return [...set];
})();
function correctTypos(input) {
  const raw = normalize(input).split(" ");
  return raw.map(word => {
    if (word.length < 5 || /^\d+$/.test(word) || WORD_BANK.includes(word)) return word;
    let best = null, bestD = 3, tied = false;
    for (const candidate of WORD_BANK) {
      if (Math.abs(candidate.length - word.length) > 1) continue;
      const d = lev(word, candidate);
      if (d < bestD) { best = candidate; bestD = d; tied = false; }
      else if (d === bestD) tied = true;
      if (bestD === 1 && tied) break;
    }
    return best && bestD <= 1 && !tied ? best : word;
  }).join(" ");
}

const CONTEXT_KEY = "ph3d.chatbrain.context.v2";
const CHAT_CONTEXT = new Map();
let contextLoaded = false;
function loadChatContext() {
  if (contextLoaded) return;
  contextLoaded = true;
  try {
    const saved = JSON.parse(localStorage.getItem(CONTEXT_KEY) || "{}");
    for (const [id, value] of Object.entries(saved)) CHAT_CONTEXT.set(id, value);
  } catch (e) {}
}
function saveChatContext() {
  try {
    const entries = [...CHAT_CONTEXT.entries()].slice(-100);
    localStorage.setItem(CONTEXT_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch (e) {}
}
function topicFor(intent, text) {
  const id = String(intent && intent.id || "").toLowerCase();
  const s = normalize(text);
  const has = (...words) => words.some(w => s.includes(w));
  if (has("food","hungry","restaurant","meal","eat","drink","bread","rice","pepper","tomato") || /food|eat|restaurant|meal|drink|hungry|cook|market_food/.test(id)) return "food";
  if (has("price","money","naira","cash","broke","loan","borrow","salary","expensive","cheap") || /money|broke|loan|borrow|salary|price|naira|cash/.test(id)) return "money";
  if (has("job","work","salary","employ","career","boss") || /job|work|career|employ/.test(id)) return "work";
  if (has("taxi","ride","bus","car","airport","flight","road","direction","travel") || /taxi|ride|travel|airport|flight|road|distance|direction/.test(id)) return "travel";
  if (has("where","place","location","house","home","shop","market","university","school","hospital","church","bank") || /place|location|house|home|shop|market|university|school|hospital|church|bank/.test(id)) return "place";
  if (has("friend","love","date","marry","relationship","girlfriend","boyfriend","family") || /friend|love|date|marry|relationship|family|flirt/.test(id)) return "relationship";
  if (has("football","match","goal","arsenal","chelsea") || /football|match|sport/.test(id)) return "sports";
  if (has("weather","rain","sun","hot","cold") || /weather|rain|hot|cold/.test(id)) return "weather";
  return id || "general";
}
function topicLabel(topic) {
  return ({food:"food and places to eat",money:"money and prices",work:"work and jobs",travel:"travel and transport",
    place:"places around town",relationship:"relationships",sports:"football",weather:"the weather"})[topic] || "that";
}
function contextualFollowup(text, ctx, npc) {
  if (!ctx || !ctx.topic) return null;
  const s = normalize(text);
  const short = s.split(" ").length <= 9;
  if (!short) return null;
  const name = npc && npc._life && npc._life.name ? npc._life.name.split(" ")[0] : "my friend";
  if (/^(is it expensive|is that expensive|how much|how much is it|what is the price|whats the price|price|cost|how costly)/.test(s)) {
    if (ctx.topic === "food") return "Depends on what you order, my friend. Some meals are affordable, while others cost more. Which food are you considering?";
    if (ctx.topic === "travel") return "The fare depends on where you're going and the time of day. What's your destination?";
    if (ctx.topic === "work") return "Are you asking about the salary or the cost of getting the job?";
    return "Which exact item or service do you mean? I don't want to give you the wrong price.";
  }
  if (/^(where is it|where is that|where can i find it|how do i get there|is it nearby|is that nearby)/.test(s)) {
    return "You mean the place we were discussing about " + topicLabel(ctx.topic) + "? Tell me its name or the area, and I can help narrow it down.";
  }
  if (/^(what about (the )?(one|place|shop|restaurant) (near|by)|what about the one near)/.test(s)) {
    return "Are you comparing another place near the university or a different area? Give me the name so I don't mix them up.";
  }
  if (/^(tell me more|more about it|explain more|go on|continue|and then|why|how come|really|are you sure)/.test(s)) {
    if (ctx.topic === "food") return "There are usually a few options, depending on your budget and what you feel like eating. Are you looking for something cheap, local or a proper restaurant?";
    if (ctx.topic === "money") return "Money matter get many sides. Are you asking about earning, saving, borrowing or prices?";
    if (ctx.topic === "travel") return "The route and transport option matter. Tell me where you're starting from and where you're heading.";
    return "I fit explain am better. Which part of " + topicLabel(ctx.topic) + " you want make we discuss?";
  }
  if (/^(what do you mean|which one|who do you mean|who is he|who is she|who is that)/.test(s) && ctx.lastEntity) {
    return "I was referring to " + ctx.lastEntity + ".";
  }
  if (/^(okay|ok|alright|yes|yeah|true|exactly|i see|oh)/.test(s)) {
    return null; // normal corpus response; preserve conversational acknowledgements
  }
  return null;
}
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
    loadChatContext();
    const norm = correctTypos(text), toks = norm.split(" ").filter(Boolean);
    if (!toks.length) return fallback(npc);
    const padded = " " + norm + " ";
    const ctx = CHAT_CONTEXT.get(npcId) || {};
    const follow = contextualFollowup(norm, ctx, npc);
    if (follow) {
      ctx.lastPlayerText = String(text || "").slice(0, 180);
      ctx.turn = (ctx.turn || 0) + 1;
      CHAT_CONTEXT.set(npcId, ctx); saveChatContext();
      return fillTokens(follow, npc);
    }
    const scored = [];
    for (const intent of CHAT_CORPUS) {
      if (CHILD_ONLY.has(intent.id)) continue;
      let score = scoreIntent(padded, toks, intent);
      if (score > 0 && intent.action && intent._phrase) score += 10;
      if (score > 0 && ctx.topic && topicFor(intent, norm) === ctx.topic && toks.length <= 5) score += 2.5;
      if (/\b(food|eat|hungry|restaurant|meal|buka|rice|bread)\b/.test(norm) && /food|restaurant|buka|eat|meal/i.test(intent.id)) score += 8;
      if (/\b(job|work|employ|salary)\b/.test(norm) && /job|work|career|employ|salary/i.test(intent.id)) score += 6;
      if (score > 0) scored.push({ intent, score });
    }
    scored.sort((a, b) => b.score - a.score);
    if (!scored.length || scored[0].score < 3) {
      ctx.lastPlayerText = String(text || "").slice(0, 180);
      CHAT_CONTEXT.set(npcId, ctx); saveChatContext();
      this._remember(npcId, null, null);
      return fallback(npc);
    }
    const best = scored[0].score;
    const top = scored.slice(0, 3).filter(item => item.score >= best * 0.6);
    let roll = Math.random() * top.reduce((sum, item) => sum + item.score, 0);
    let chosen = top[0].intent;
    if (!top[0].intent.action) for (const item of top) {
      roll -= item.score;
      if (roll <= 0) { chosen = item.intent; break; }
    }
    let reply = null;
    if (chosen.action) {
      try { reply = chosen.action === "memory" ? this._memory(npc) : NpcMoney.handle(chosen.action, npc, text); }
      catch (e) { console.warn("[chat] action failed", e); reply = null; }
    }
    if (!reply) reply = this._pick(chosen, npc, npcId);
    if (chosen.id === "yourname" && npc._life.name) {
      const nm = npc._life.name;
      reply = [`I'm ${nm}.`, `My name na ${nm}.`, `${nm}. And you?`, `Everybody dey call me ${nm.split(" ")[0]}.`][Math.floor(Math.random() * 4)];
    }
    if (!chosen.action) {
      const mood = npc._life.mood;
      if (typeof mood === "number" && mood < 0.3 && Math.random() < 0.3) reply = GRUMPY[Math.floor(Math.random() * GRUMPY.length)] + reply;
      else if (typeof mood === "number" && mood > 0.8 && Math.random() < 0.25) reply = MERRY[Math.floor(Math.random() * MERRY.length)] + reply;
      if (/^greet/.test(chosen.id)) { try { reply += NpcMoney.reminder(npc); } catch (e) {} }
      if (TIPPABLE.has(chosen.id)) { try { reply += NpcMoney.spontaneous(npc); } catch (e) {} }
    }
    reply = fillTokens(reply, npc);
    ctx.topic = topicFor(chosen, norm);
    ctx.lastIntent = chosen.id;
    ctx.lastPlayerText = String(text || "").slice(0, 180);
    ctx.lastNpcReply = String(reply || "").slice(0, 220);
    ctx.turn = (ctx.turn || 0) + 1;
    const entity = String(text || "").match(/\b(?:at|near|to|about|called|named)\s+([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,2})/i);
    if (entity) ctx.lastEntity = entity[1].trim();
    CHAT_CONTEXT.set(npcId, ctx);
    if (CHAT_CONTEXT.size > 100) CHAT_CONTEXT.delete(CHAT_CONTEXT.keys().next().value);
    saveChatContext();
    this._remember(npcId, reply, chosen.id);
    return reply;
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
    const fixed = correctTypos(text), padded = " " + fixed + " ", toks = fixed.split(" ").filter(Boolean), out = [];
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

  understand(text) { return { normalized: correctTypos(text), intents: this.rank(text, 5) }; },

  stats() {
    return {
      intents: CHAT_CORPUS.length,
      patterns: CHAT_CORPUS.reduce((a, i) => a + i.pats.length, 0),
      replies: CHAT_CORPUS.reduce((a, i) => a + i.reps.length + (i.roleReps ? Object.values(i.roleReps).flat().length : 0), 0),
    };
  },
};
