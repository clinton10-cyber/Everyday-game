/* js/ui/game-keyboard.js — custom on-screen keyboard for typing inside the game.

   Why: a normal <input> pops up the phone's system keyboard, which resizes the page,
   shoves the HUD around and can kick the game out of landscape. This keyboard is just a
   fixed panel drawn by the game, so nothing else on screen moves.

   Usage:
     const kb = GameKeyboard.attach(fieldEl, {
       maxLength: 200,
       onSubmit: () => {...},          // Enter / send key
       onEscape: () => {...},          // Esc on a hardware keyboard
       onResize: (heightPx) => {...},  // keyboard height (0 when hidden) so the UI can sit above it
     });
     kb.open();  kb.close();  kb.activate();  kb.deactivate();

   fieldEl is any empty <div>. It gets a `.value` property, so existing code that reads or
   writes input.value keeps working. Typing always edits the end of the text.
   A hardware keyboard works too while the field is active, and is kept away from the game
   (WASD / Space / E) so typing never walks, jumps or interacts. */

const CSS_ID = "ph3d-gamekb-css";

const ROWS = {
  abc: [
    "q w e r t y u i o p",
    "_ a s d f g h j k l _",
    "SHIFT z x c v b n m BACK",
    "SYM , SPACE . SEND",
  ],
  sym: [
    "1 2 3 4 5 6 7 8 9 0",
    "- / : ; ( ) ₦ & @ \"",
    "SYM2 . , ? ! ' BACK",
    "ABC , SPACE . SEND",
  ],
  sym2: [
    "[ ] { } # % ^ * + =",
    "_ \\ | ~ < > $ € £ _",
    "SYM . , ? ! ' BACK",
    "ABC , SPACE . SEND",
  ],
};

const HAS_TOUCH = (typeof window !== "undefined") &&
  (("ontouchstart" in window) || (navigator.maxTouchPoints > 0));

function injectCSS() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement("style");
  s.id = CSS_ID;
  s.textContent = `
    #gk{position:fixed;left:50%;bottom:0;transform:translate(-50%,104%);
      width:min(100vw,760px);box-sizing:border-box;z-index:9460;
      padding:6px 4px calc(env(safe-area-inset-bottom,0px) + 6px);
      background:#0b141a;border-radius:14px 14px 0 0;box-shadow:0 -6px 24px rgba(0,0,0,.55);
      transition:transform .18s ease-out;pointer-events:none;
      touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;
      -webkit-tap-highlight-color:transparent;--gk-h:44px;font-family:'Inter',-apple-system,sans-serif}
    #gk.on{transform:translate(-50%,0);pointer-events:auto}
    #gk .gk-row{display:flex;gap:4px;margin-bottom:5px}
    #gk .gk-row:last-child{margin-bottom:0}
    #gk .gk-key{flex:1 1 0;min-width:0;height:var(--gk-h);border-radius:7px;background:#2a3942;color:#e9edef;
      font-weight:600;font-size:18px;display:flex;align-items:center;justify-content:center;
      cursor:pointer;box-shadow:0 1px 0 rgba(0,0,0,.45)}
    #gk .gk-key.fn{background:#1b262c;flex:1.5}
    #gk .gk-key.space{flex:5;font-size:13px;font-weight:500;color:#8696a0}
    #gk .gk-key.send{background:#25D366;color:#fff;flex:1.7;font-size:20px}
    #gk .gk-key.lock{background:#e9edef;color:#0b141a}
    #gk .gk-key.once{background:#53656f}
    #gk .gk-key.down{background:#4c6270}
    #gk .gk-key.send.down{background:#128C7E}
    #gk .gk-sp{flex:.5}
    #gk .gk-pop{position:absolute;z-index:2;pointer-events:none;min-width:46px;height:50px;padding:0 10px;
      border-radius:10px;background:#e9edef;color:#0b141a;font:700 26px 'Inter',sans-serif;
      display:none;align-items:center;justify-content:center;transform:translateX(-50%);
      box-shadow:0 4px 14px rgba(0,0,0,.5)}
    #gk .gk-hide{position:absolute;right:8px;top:-22px;width:44px;height:22px;border-radius:10px 10px 0 0;
      background:#0b141a;color:#8696a0;display:flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer}
    @media (max-height:520px){
      #gk{--gk-h:34px;padding-top:4px}
      #gk .gk-key{font-size:15px;border-radius:6px}
      #gk .gk-key.space{font-size:11px}
      #gk .gk-row{margin-bottom:4px}
      #gk .gk-pop{height:42px;font-size:22px}
    }
    .gk-field{white-space:nowrap;overflow:hidden;cursor:text;user-select:none;-webkit-user-select:none;
      -webkit-tap-highlight-color:transparent;outline:none}
    .gk-field:empty::before,.gk-field.gk-empty::before{content:attr(data-placeholder);color:#8a8a8a}
    .gk-field .gk-caret{display:inline-block;width:2px;height:1.15em;margin-left:1px;vertical-align:text-bottom;
      background:#128C7E;visibility:hidden}
    .gk-field.gk-on .gk-caret{visibility:visible;animation:gk-blink 1s steps(1) infinite}
    @keyframes gk-blink{50%{opacity:0}}
  `;
  document.head.appendChild(s);
}

/* ── shared keyboard panel (one for the whole game) ───────────────── */
let kbEl = null, popEl = null, keysEl = null;
let layer = "abc";
let shift = 0;                 // 0 off · 1 next letter · 2 caps lock
let lastShiftTap = 0;
let target = null;             // the field controller that currently owns the keyboard
let repeatT = null, repeatI = null;
let ro = null;

function needCap(v) { return v.length === 0 || /[.!?]\s+$/.test(v) || /\n$/.test(v); }

function build() {
  if (kbEl) return;
  injectCSS();
  kbEl = document.createElement("div");
  kbEl.id = "gk";
  kbEl.innerHTML = `<div class="gk-hide" data-k="HIDE">⌄</div><div class="gk-pop"></div><div class="gk-keys"></div>`;
  document.body.appendChild(kbEl);
  popEl = kbEl.querySelector(".gk-pop");
  keysEl = kbEl.querySelector(".gk-keys");

  kbEl.addEventListener("pointerdown", onDown);
  const up = () => { stopRepeat(); hidePop(); kbEl.querySelectorAll(".down").forEach(k => k.classList.remove("down")); };
  kbEl.addEventListener("pointerup", up);
  kbEl.addEventListener("pointercancel", up);
  kbEl.addEventListener("pointerleave", up);
  kbEl.addEventListener("contextmenu", (e) => e.preventDefault());

  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => { if (target && kbEl.classList.contains("on")) target.opts.onResize && target.opts.onResize(kbHeight()); });
    ro.observe(kbEl);
  }
  window.addEventListener("resize", () => { if (target && kbEl.classList.contains("on")) target.opts.onResize && target.opts.onResize(kbHeight()); });
  renderKeys();
}

function kbHeight() { return kbEl ? Math.round(kbEl.getBoundingClientRect().height) : 0; }

function renderKeys() {
  const rows = ROWS[layer];
  let html = "";
  for (const row of rows) {
    html += `<div class="gk-row">`;
    for (const tok of row.split(" ")) {
      if (tok === "_") { html += `<div class="gk-sp"></div>`; continue; }
      let label = tok, cls = "gk-key", flex = "";
      switch (tok) {
        case "SHIFT": label = shift === 2 ? "⇪" : "⇧"; cls += " fn" + (shift === 2 ? " lock" : shift === 1 ? " once" : ""); break;
        case "BACK":  label = "⌫"; cls += " fn"; break;
        case "SYM":   label = "123"; cls += " fn"; break;
        case "SYM2":  label = "#+="; cls += " fn"; break;
        case "ABC":   label = "ABC"; cls += " fn"; break;
        case "SPACE": label = "space"; cls += " space"; break;
        case "SEND":  label = "➤"; cls += " send"; break;
        default:
          if (layer === "abc" && /^[a-z]$/.test(tok) && shift) label = tok.toUpperCase();
      }
      html += `<div class="${cls}" data-k="${tok.replace(/"/g, "&quot;")}"${flex}>${label}</div>`;
    }
    html += `</div>`;
  }
  keysEl.innerHTML = html;
}

function setShift(n) { if (shift !== n) { shift = n; if (layer === "abc") renderKeys(); } }

function autoShift() {
  if (!target || shift === 2) return;
  setShift(needCap(target.value) ? 1 : 0);
}

function buzz() { try { navigator.vibrate && navigator.vibrate(6); } catch (e) {} }

function showPop(keyEl, text) {
  if (!popEl) return;
  const kr = keyEl.getBoundingClientRect(), br = kbEl.getBoundingClientRect();
  popEl.textContent = text;
  popEl.style.display = "flex";
  popEl.style.left = (kr.left - br.left + kr.width / 2) + "px";
  popEl.style.top = (kr.top - br.top - popEl.offsetHeight - 4) + "px";
}
function hidePop() { if (popEl) popEl.style.display = "none"; }

function stopRepeat() { clearTimeout(repeatT); clearInterval(repeatI); repeatT = repeatI = null; }

function onDown(e) {
  const keyEl = e.target.closest && e.target.closest("[data-k]");
  if (!keyEl || !target) return;
  e.preventDefault();               // keep focus / selection out of it
  const k = keyEl.getAttribute("data-k");
  keyEl.classList.add("down");
  buzz();

  switch (k) {
    case "HIDE": target.close(); return;
    case "BACK":
      target._backspace();
      stopRepeat();
      repeatT = setTimeout(() => { repeatI = setInterval(() => target && target._backspace(), 55); }, 380);
      return;
    case "SHIFT": {
      const now = performance.now();
      if (shift === 2) setShift(0);
      else if (shift === 1 && now - lastShiftTap < 350) setShift(2);
      else setShift(shift ? 0 : 1);
      lastShiftTap = now;
      return;
    }
    case "SYM":  layer = "sym";  renderKeys(); return;
    case "SYM2": layer = "sym2"; renderKeys(); return;
    case "ABC":  layer = "abc";  renderKeys(); return;
    case "SPACE": target._insert(" "); return;
    case "SEND":  target._submit(); return;
    default: {
      let ch = k;
      if (layer === "abc" && shift) ch = k.toUpperCase();
      if (/^[\p{L}\p{N}]$/u.test(ch)) showPop(keyEl, ch);
      target._insert(ch);
    }
  }
}

/* ── field controller ─────────────────────────────────────────────── */
function attach(el, opts) {
  opts = opts || {};
  injectCSS();
  const max = opts.maxLength || 200;
  let val = "";
  el.classList.add("gk-field");
  el.setAttribute("tabindex", "0");
  el.setAttribute("role", "textbox");
  el.innerHTML = `<span class="gk-text"></span><i class="gk-caret"></i>`;
  const textEl = el.querySelector(".gk-text");

  const ctl = {
    el, opts,
    get value() { return val; },
    set value(v) { val = String(v == null ? "" : v).slice(0, max); draw(); if (target === ctl) autoShift(); },
    _insert(ch) {
      if (val.length + ch.length > max) return;
      val += ch; draw();
      if (shift === 1) setShift(0);
      autoShift();
    },
    _backspace() {
      if (!val) return;
      val = Array.from(val).slice(0, -1).join(""); draw(); autoShift();
    },
    _submit() { opts.onSubmit && opts.onSubmit(val); },

    /* soft keyboard */
    open() {
      if (!HAS_TOUCH && !opts.forceSoft) { ctl.activate(); return; }
      build();
      target = ctl;
      ctl.activate();
      layer = "abc"; shift = 0; autoShift(); renderKeys();
      kbEl.classList.add("on");
      el.classList.add("gk-on");
      requestAnimationFrame(() => opts.onResize && opts.onResize(kbHeight()));
    },
    close() {
      if (kbEl && target === ctl) {
        stopRepeat(); hidePop();
        kbEl.classList.remove("on");
        target = null;
        opts.onResize && opts.onResize(0);
      }
      if (!opts.stickyHardware) { window.removeEventListener("keydown", onKey, true); window.removeEventListener("keyup", onKeyUp, true); el.classList.remove("gk-on"); }
    },
    get isOpen() { return !!(kbEl && target === ctl && kbEl.classList.contains("on")); },

    /* hardware keyboard + caret blink */
    activate() { window.addEventListener("keydown", onKey, true); window.addEventListener("keyup", onKeyUp, true); el.classList.add("gk-on"); },
    deactivate() {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKeyUp, true);
      el.classList.remove("gk-on");
      ctl.close();
    },
    focus() { ctl.open(); },
    blur() { ctl.close(); },
  };

  /* Existing code treats the field like an <input>: el.value / el.focus() / el.blur(). */
  Object.defineProperty(el, "value", { get: () => ctl.value, set: (v) => { ctl.value = v; }, configurable: true });
  el.focus = () => ctl.open();
  el.blur = () => ctl.deactivate();

  function draw() {
    textEl.textContent = val;
    el.classList.toggle("gk-empty", !val);
    el.scrollLeft = el.scrollWidth;
  }
  function onKey(e) {
    /* Take every key while the field is active so the game never sees them. */
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); ctl._submit(); }
    else if (e.key === "Escape") { e.preventDefault(); opts.onEscape && opts.onEscape(); }
    else if (e.key === "Backspace") { e.preventDefault(); ctl._backspace(); }
    else if (e.key && e.key.length === 1) { e.preventDefault(); ctl._insert(e.key); }
  }
  function onKeyUp(e) { e.stopPropagation(); }

  const tap = (e) => { e.preventDefault(); ctl.open(); };
  el.addEventListener("pointerdown", tap);
  draw();
  return ctl;
}

export const GameKeyboard = { attach };
try { window.__ph3d_gamekb = GameKeyboard; } catch (e) {}
