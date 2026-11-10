/* js/ui/talk-chat.js — WhatsApp-style chat panel for NPC conversations.
   Replaces the relationship panel (npc-lives.js → openPanel) as the first thing
   you see when you talk to someone. Every NPC keeps a persistent chat history
   (last 40 messages, localStorage).

   Bubbles (white = NPC, green = you), timestamps, ✓✓ ticks, typing dots,
   per-message emoji reactions (long-press / right-click a bubble), emoji
   picker next to the input, and the relationship bar + mood under the header.
   Quick-reply chips run the existing Lives.act() actions; "⋯ More" opens the
   full relationship panel for everything else (dates, baby, carry, etc.). */

import { ChatBrain } from "../core/chat-brain.js";
import { NpcMoney } from "../core/npc-money.js";

const STORE_KEY = "ph3d.talkchat.v1";
const CSS_ID    = "ph3d-talkchat-css";
const MAX_HISTORY = 40;
const EMOJIS = ["👍","❤️","😂","😮","😢","🔥","👏","😍","🙏","💯"];

function injectCSS() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement("style");
  s.id = CSS_ID;
  s.textContent = `
    #tc-scrim{position:fixed;inset:0;z-index:9440;background:rgba(0,0,0,.55);opacity:0;pointer-events:none;transition:opacity .22s}
    #tc-scrim.on{opacity:1;pointer-events:auto}
    #tc-sheet{position:fixed;left:50%;bottom:0;transform:translate(-50%,105%);
      width:min(96vw,440px);height:min(88vh,720px);z-index:9441;background:#ECE5DD;
      color:#000;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
      border-radius:20px 20px 0 0;overflow:hidden;display:flex;flex-direction:column;
      box-shadow:0 -20px 60px rgba(0,0,0,.8);transition:transform .32s cubic-bezier(.2,.9,.3,1.05);pointer-events:none}
    #tc-sheet.on{transform:translate(-50%,0);pointer-events:auto}

    #tc-header{background:#075E54;color:#fff;padding:10px 12px;display:flex;align-items:center;gap:10px;flex-shrink:0}
    .tc-back,.tc-menu{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;color:#fff}
    .tc-back:active,.tc-menu:active{background:rgba(255,255,255,.12)}
    .tc-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#25D366,#128C7E);
      color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
    .tc-info{flex:1;min-width:0}
    .tc-name{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tc-status{font-size:11.5px;opacity:.8;margin-top:1px}

    #tc-rel{padding:6px 14px 8px;background:#128C7E;color:#fff;font-size:10.5px;letter-spacing:.06em;
      display:flex;align-items:center;gap:8px;flex-shrink:0}
    #tc-rel-lbl{font-weight:700}
    #tc-rel-bar{flex:1;height:4px;border-radius:2px;background:rgba(0,0,0,.25);overflow:hidden}
    #tc-rel-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#ff5252,#ffd740,#25D366);border-radius:2px;transition:width .25s}
    #tc-rel-num{font-variant-numeric:tabular-nums;font-weight:700}

    #tc-messages{flex:1;overflow-y:auto;padding:12px 10px 8px;
      background-image:linear-gradient(rgba(255,255,255,.4),rgba(255,255,255,.4)),
                        radial-gradient(circle at 20% 20%,#d8d0c4,#c8c0b4);
      scroll-behavior:smooth;display:flex;flex-direction:column;gap:6px}

    .tc-row{display:flex;padding:0 4px;gap:6px;flex-wrap:wrap}
    .tc-row.me{justify-content:flex-end}
    .tc-row.npc{justify-content:flex-start}
    .tc-bubble{position:relative;max-width:78%;padding:7px 12px 18px 10px;border-radius:10px;
      font-size:13.5px;line-height:1.35;word-wrap:break-word;box-shadow:0 1px 1px rgba(0,0,0,.13);
      user-select:none;-webkit-user-select:none}
    .tc-row.npc .tc-bubble{background:#FFFFFF;border-top-left-radius:3px}
    .tc-row.me  .tc-bubble{background:#DCF8C6;border-top-right-radius:3px}
    .tc-meta{position:absolute;bottom:3px;right:8px;font-size:10px;color:#999;display:flex;align-items:center;gap:3px}
    .tc-tick{color:#34B7F1;font-size:11px}
    .tc-reactions{display:flex;flex-wrap:wrap;gap:3px;width:100%}
    .tc-row.me .tc-reactions{justify-content:flex-end}
    .tc-reactions:empty{display:none}
    .tc-react{background:#fff;border:1px solid #ddd;border-radius:12px;padding:2px 7px;font-size:11px;
      display:inline-flex;align-items:center;gap:3px}
    .tc-react.on{background:#DCF8C6;border-color:#25D366}

    #tc-emoji-quick{position:fixed;display:none;background:#fff;border:1px solid #ddd;border-radius:24px;
      box-shadow:0 6px 20px rgba(0,0,0,.25);padding:6px 8px;z-index:9450;gap:4px}
    #tc-emoji-quick.on{display:flex}
    #tc-emoji-quick button{width:34px;height:34px;border-radius:50%;border:none;background:transparent;font-size:18px;cursor:pointer}
    #tc-emoji-quick button:active{background:#eee}

    #tc-quick{flex-shrink:0;padding:8px 10px;overflow-x:auto;overflow-y:hidden;display:flex;gap:6px;
      background:#ECE5DD;border-top:1px solid rgba(0,0,0,.08);scrollbar-width:none}
    #tc-quick::-webkit-scrollbar{display:none}
    #tc-quick button{flex-shrink:0;padding:8px 12px;border-radius:18px;border:1px solid #25D366;
      background:#fff;color:#075E54;font:700 11.5px 'Inter',sans-serif;letter-spacing:.02em;cursor:pointer;
      transition:background .12s,transform .1s}
    #tc-quick button:active{transform:scale(.94);background:#DCF8C6}
    #tc-quick button.more-btn{border-color:#128C7E;color:#128C7E}
    #tc-quick button.close-btn{border-color:#999;color:#666}

    #tc-input-bar{flex-shrink:0;display:flex;align-items:center;gap:8px;
      padding:8px 10px calc(env(safe-area-inset-bottom,0px) + 10px);background:#ECE5DD;
      border-top:1px solid rgba(0,0,0,.08)}
    #tc-input{flex:1;min-width:0;padding:10px 14px;border-radius:22px;border:none;background:#fff;
      font:14px 'Inter',sans-serif;outline:none;color:#000}
    .tc-icon-btn{width:40px;height:40px;flex-shrink:0;border-radius:50%;border:none;background:#fff;
      display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer}
    .tc-icon-btn:active{background:#ddd}
    #tc-send{background:#25D366;color:#fff;font-size:18px}
    #tc-send:active{background:#128C7E}

    #tc-emoji-picker{flex-shrink:0;padding:8px 10px;background:#ECE5DD;display:none;flex-wrap:wrap;gap:4px;
      border-top:1px solid rgba(0,0,0,.08)}
    #tc-emoji-picker.on{display:flex}
    #tc-emoji-picker button{width:38px;height:38px;border-radius:10px;border:none;background:transparent;font-size:22px;cursor:pointer}
    #tc-emoji-picker button:active{background:#fff}

    .tc-typing{display:flex;gap:4px;align-items:center;padding:8px 14px;background:#fff;border-radius:10px;
      align-self:flex-start;box-shadow:0 1px 1px rgba(0,0,0,.13);max-width:60px}
    .tc-typing span{width:6px;height:6px;border-radius:50%;background:#999;animation:tcDot 1.2s ease-in-out infinite}
    .tc-typing span:nth-child(2){animation-delay:.15s}
    .tc-typing span:nth-child(3){animation-delay:.3s}
    @keyframes tcDot{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-4px);opacity:1}}
  `;
  document.head.appendChild(s);
}

const lives = () => import("../core/npc-lives.js");

export const TalkChat = {
  _built: false,
  _current: null,
  _history: {},
  _scrim: null, _sheet: null, _msgs: null, _quick: null,
  _input: null, _picker: null,
  _relBar: null, _relNum: null, _relLbl: null,
  _typingEl: null, _emojiQuickEl: null, _dismiss: null,

  _load() {
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) this._history = JSON.parse(raw) || {}; }
    catch (e) { this._history = {}; }
  },
  _save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(this._history)); } catch (e) {} },

  _build() {
    if (this._built) return;
    injectCSS();
    this._load();
    const root = document.createElement("div");
    root.id = "tc-root";
    root.innerHTML = `
      <div id="tc-scrim"></div>
      <div id="tc-sheet">
        <div id="tc-header">
          <div class="tc-back" id="tc-back">←</div>
          <div class="tc-avatar" id="tc-av">🧑</div>
          <div class="tc-info">
            <div class="tc-name" id="tc-name">—</div>
            <div class="tc-status" id="tc-stat">online</div>
          </div>
          <div class="tc-menu" id="tc-menu">⋮</div>
        </div>
        <div id="tc-rel"><span id="tc-rel-lbl">STRANGER</span><div id="tc-rel-bar"><i></i></div><span id="tc-rel-num">0</span></div>
        <div id="tc-messages"></div>
        <div id="tc-quick"></div>
        <div id="tc-emoji-picker"></div>
        <div id="tc-input-bar">
          <div class="tc-icon-btn" id="tc-emoji-btn">😊</div>
          <input id="tc-input" placeholder="Message" autocomplete="off"/>
          <button class="tc-icon-btn" id="tc-send">➤</button>
        </div>
      </div>
      <div id="tc-emoji-quick"></div>`;
    document.body.appendChild(root);

    this._scrim = root.querySelector("#tc-scrim");
    this._sheet = root.querySelector("#tc-sheet");
    this._msgs  = root.querySelector("#tc-messages");
    this._quick = root.querySelector("#tc-quick");
    this._input = root.querySelector("#tc-input");
    this._picker = root.querySelector("#tc-emoji-picker");
    this._relBar = root.querySelector("#tc-rel-bar i");
    this._relNum = root.querySelector("#tc-rel-num");
    this._relLbl = root.querySelector("#tc-rel-lbl");
    this._emojiQuickEl = root.querySelector("#tc-emoji-quick");

    root.querySelector("#tc-back").onclick = () => this.close();
    this._scrim.onclick = () => this.close();
    root.querySelector("#tc-menu").onclick = () => {
      this.close();
      lives().then(m => m.Lives && m.Lives.openApp && m.Lives.openApp()).catch(() => {});
    };
    root.querySelector("#tc-emoji-btn").onclick = () => this._picker.classList.toggle("on");
    root.querySelector("#tc-send").onclick = () => this._send();

    /* The game listens for WASD / Space / E on window. Keep typing in the chat box
       from also walking, jumping or interacting. */
    this._input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") { e.preventDefault(); this._send(); }
      else if (e.key === "Escape") this.close();
    });
    this._input.addEventListener("keyup", (e) => e.stopPropagation());
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && this._current) this.close(); });

    EMOJIS.forEach((em) => {
      const b = document.createElement("button"); b.textContent = em;
      b.onclick = () => {
        const input = this._input;
        const start = input.selectionStart != null ? input.selectionStart : input.value.length;
        input.value = input.value.slice(0, start) + em + input.value.slice(start);
        input.focus();
      };
      this._picker.appendChild(b);
    });

    this._built = true;
  },

  /* ── open the chat for an NPC ── */
  open(npc) {
    if (!npc || !npc._life) return;
    this._build();
    this._current = npc;
    const p = npc._life;

    const av = p.g === "feminine" ? (p.age < 12 ? "👧🏾" : "👩🏾") : (p.age < 12 ? "👦🏾" : "👨🏾");
    this._sheet.querySelector("#tc-av").textContent = av;
    this._sheet.querySelector("#tc-name").textContent = String(p.name || "").split(" ")[0];
    this._updateStatus();
    this._updateRel();

    if (!this._history[p.id]) this._history[p.id] = [];
    this._render();
    this._buildQuickActions(npc);
    this._scrim.classList.add("on");
    this._sheet.classList.add("on");
  },

  close() {
    if (!this._built) return;
    this._scrim.classList.remove("on");
    this._sheet.classList.remove("on");
    this._picker.classList.remove("on");
    this._emojiQuickEl.classList.remove("on");
    this._showTyping(false);
    try { this._input.blur(); } catch (e) {}
    this._current = null;
    this._save();
  },

  /* relationship bar (also called by npc-lives after each action) */
  _updateRel() {
    if (!this._built || !this._current || !this._current._life) return;
    const p = this._current._life;
    lives().then(m => {
      if (!this._current || this._current._life !== p) return;
      const r = m.Lives.rel(p);
      const label = String(m.Lives.relationLabel(p) || "STRANGER").toUpperCase();
      const v = r ? r.v : 0;
      this._relLbl.textContent = label;
      this._relBar.style.width = ((v + 100) / 2) + "%";
      this._relNum.textContent = Math.round(v);
      this._updateStatus();
    }).catch(() => {});
  },

  /* ── NPC sends a message (typing dots, then bubble; optional speech) ── */
  receive(npc, text, opts) {
    opts = opts || {};
    if (!npc || !npc._life || !text) return;
    if (this._current !== npc) this.open(npc);
    const key = npc._life.id;
    this._showTyping(true);
    const delay = 450 + Math.min(1400, text.length * 35);
    setTimeout(() => {
      this._showTyping(false);
      /* store it even if the sheet was closed meanwhile, so history stays complete */
      this._push(key, { who: "npc", text, ts: Date.now(), reactions: {} });
      if (this._current === npc) this._render();
      if (opts.silent) return;
      try {
        import("../core/sfx.js").then(m => m.Sfx.say(text, {
          file: opts.file, who: npc.id, role: npc.role,
          gender: npc._cfg && npc._cfg.gender,
        })).catch(() => {});
      } catch (e) {}
    }, delay);
  },

  pushPlayer(text) {
    if (!this._current || !text) return;
    this._push(this._current._life.id, { who: "me", text, ts: Date.now(), reactions: {} });
    this._render();
  },

  _send() {
    const text = (this._input.value || "").trim();
    if (!text || !this._current) return;
    this._input.value = "";
    this.pushPlayer(text);
    this._autoReply(text);
  },

  _autoReply(text) {
    const npc = this._current; if (!npc) return;
    this.receive(npc, ChatBrain.reply(npc, text));
  },

  /* ── quick-reply chips: the existing relationship actions ── */
  _buildQuickActions(npc) {
    if (!this._quick) return;
    this._quick.innerHTML = "";
    const add = (id, label) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.onclick = () => {
        lives().then(m => m.Lives && m.Lives.act && m.Lives.act(id, npc)).catch(e => console.warn(e));
      };
      this._quick.appendChild(b);
    };
    add("chat", "💬 Chat");
    add("compliment", "😊 Compliment");
    add("joke", "😂 Joke");
    add("gift", "🎁 Gift");
    add("hang", "🚶 Hang out");
    add("flirt", "😉 Flirt");
    add("ask", "❤ Ask out");
    add("selfie", "📸 Selfie");
    /* money chips: say it in chat, the NPC answers through ChatBrain / NpcMoney */
    const say = (label, text) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.onclick = () => { this.pushPlayer(text); this._autoReply(text); };
      this._quick.appendChild(b);
    };
    say("💸 Ask for cash", "abeg help me with small money");
    say("🤝 Borrow", "can you lend me money");
    say("🛠 Need work", "i need work");
    try { if (NpcMoney.hasDebt(npc)) say("💵 Repay", "take your money"); } catch (e) {}
    const more = document.createElement("button");
    more.textContent = "⋯ More";
    more.classList.add("more-btn");
    more.onclick = () => {
      this.close();
      lives().then(m => m.Lives && m.Lives.openPanel && m.Lives.openPanel(npc)).catch(() => {});
    };
    this._quick.appendChild(more);
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕ Close";
    closeBtn.classList.add("close-btn");
    closeBtn.onclick = () => this.close();
    this._quick.appendChild(closeBtn);
  },

  /* ── render all bubbles ── */
  _render() {
    if (!this._msgs || !this._current) return;
    const list = this._history[this._current._life.id] || [];
    this._msgs.innerHTML = "";
    list.forEach((m, idx) => {
      const row = document.createElement("div");
      row.className = "tc-row " + (m.who === "me" ? "me" : "npc");
      const b = document.createElement("div"); b.className = "tc-bubble"; b.textContent = m.text;
      const meta = document.createElement("div"); meta.className = "tc-meta";
      meta.textContent = new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (m.who === "me") {
        const t = document.createElement("span"); t.className = "tc-tick"; t.textContent = "✓✓";
        meta.appendChild(document.createTextNode(" ")); meta.appendChild(t);
      }
      b.appendChild(meta);
      row.appendChild(b);
      if (m.reactions && Object.keys(m.reactions).length) {
        const rrow = document.createElement("div"); rrow.className = "tc-reactions";
        for (const [em, count] of Object.entries(m.reactions)) {
          const chip = document.createElement("div"); chip.className = "tc-react on";
          chip.textContent = em + (count > 1 ? " " + count : "");
          rrow.appendChild(chip);
        }
        row.appendChild(rrow);
      }
      /* long-press / right-click a bubble to react */
      b.addEventListener("contextmenu", (e) => { e.preventDefault(); this._reactionsFor(idx, b); });
      b.addEventListener("pointerdown", (e) => { b._pt = performance.now(); b._px = e.clientX; b._py = e.clientY; });
      b.addEventListener("pointerup", (e) => {
        const dt = performance.now() - (b._pt || 0);
        if (dt < 480) return;
        if (Math.abs(e.clientX - b._px) < 12 && Math.abs(e.clientY - b._py) < 12) this._reactionsFor(idx, b);
      });
      this._msgs.appendChild(row);
    });
    this._typingEl = null;
    if (this._typing) this._showTyping(true);   /* re-add dots if still "typing" */
    this._msgs.scrollTop = this._msgs.scrollHeight;
  },

  _reactionsFor(idx, bubbleEl) {
    const bar = this._emojiQuickEl;
    bar.innerHTML = "";
    for (const em of EMOJIS.slice(0, 6)) {
      const b = document.createElement("button"); b.textContent = em;
      b.onclick = () => { this._react(idx, em); bar.classList.remove("on"); };
      bar.appendChild(b);
    }
    const r = bubbleEl.getBoundingClientRect();
    bar.style.left = Math.max(10, Math.min(r.left, innerWidth - 260)) + "px";
    bar.style.top  = Math.max(10, r.top - 50) + "px";
    bar.classList.add("on");
    if (this._dismiss) document.removeEventListener("pointerdown", this._dismiss);
    setTimeout(() => {
      this._dismiss = (ev) => {
        if (!bar.contains(ev.target)) { bar.classList.remove("on"); document.removeEventListener("pointerdown", this._dismiss); this._dismiss = null; }
      };
      document.addEventListener("pointerdown", this._dismiss);
    }, 100);
  },

  _react(idx, emoji) {
    const key = this._current && this._current._life.id; if (!key) return;
    const msg = (this._history[key] || [])[idx]; if (!msg) return;
    msg.reactions = msg.reactions || {};
    msg.reactions[emoji] = (msg.reactions[emoji] || 0) + 1;
    this._save(); this._render();
  },

  _push(key, msg) {
    if (!this._built) { this._build(); }
    if (!this._history[key]) this._history[key] = [];
    this._history[key].push(msg);
    if (this._history[key].length > MAX_HISTORY) this._history[key].shift();
    this._save();
  },

  _showTyping(show) {
    this._typing = !!show;
    if (!this._msgs) return;
    const stat = this._sheet && this._sheet.querySelector("#tc-stat");
    if (show) {
      if (this._typingEl) return;
      const d = document.createElement("div");
      d.className = "tc-typing";
      d.innerHTML = "<span></span><span></span><span></span>";
      this._msgs.appendChild(d);
      this._typingEl = d;
      this._msgs.scrollTop = this._msgs.scrollHeight;
      if (stat) stat.textContent = "typing…";
    } else {
      if (this._typingEl && this._typingEl.parentNode) this._typingEl.parentNode.removeChild(this._typingEl);
      this._typingEl = null;
      this._updateStatus();
    }
  },

  _updateStatus() {
    if (!this._current || !this._current._life || !this._sheet) return;
    const p = this._current._life;
    const mood = p.mood > 0.7 ? "😄 happy" : p.mood < 0.4 ? "😕 low" : "🙂 okay";
    const stat = this._sheet.querySelector("#tc-stat");
    if (stat && !this._typing) stat.textContent = "online · " + mood;
  },
};
if (typeof window !== "undefined") window.__ph3d_talkchat = TalkChat;
