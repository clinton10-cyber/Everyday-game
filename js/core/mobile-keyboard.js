/* Floating in-game keyboard for phone typing (touch devices only).
 * Import once from js/main.js. A compact keyboard with SQUARE keys floats over the game: drag it by its title
 * bar, resize it with the A- / A+ buttons, switch letters / numbers+symbols, shift for capitals.
 * It opens when you tap a text box, closes on Done or when you tap elsewhere, and stays inside the screen.
 * The phone's own keyboard is suppressed (inputmode=none + readonly while focused); this keyboard types instead.
 * Position and size are remembered. */
const STYLE_ID = "ph3d-floating-keyboard-style", ROOT_ID = "ph3d-floating-keyboard", KEY = "ph3d_kb_v2";
const isTouch = () => ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
const SIZES = [250, 300, 350, 400];                   /* panel width in px; keys stay square */
const LETTERS = ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm"];
const SYMBOLS = ["1234567890", "@#$%&*-+()", "!?\"':;/_=", ".,~^|\\<>"];

function css() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style"); s.id = STYLE_ID;
  s.textContent = `
  #${ROOT_ID}{position:fixed;z-index:1000000;display:none;box-sizing:border-box;padding:6px;border:1px solid #ffffff2e;border-radius:14px;
    background:rgba(13,15,29,.94);box-shadow:0 10px 34px #000a;backdrop-filter:blur(12px);color:#fff;font:600 12px system-ui,sans-serif;
    touch-action:manipulation;user-select:none;-webkit-user-select:none}
  #${ROOT_ID}.show{display:block}
  #${ROOT_ID} .kb-head{display:flex;align-items:center;gap:4px;margin-bottom:5px;cursor:grab;touch-action:none}
  #${ROOT_ID} .kb-head span{flex:1;font-size:10px;letter-spacing:.12em;opacity:.65;padding-left:4px}
  #${ROOT_ID} .kb-head button{flex:none;width:30px;height:24px;font-size:11px;background:#34364d}
  #${ROOT_ID} .kb-head button.done{width:auto;padding:0 10px;background:#2f7d4f}
  #${ROOT_ID} .kb-grid{display:grid;grid-template-columns:repeat(10,1fr);gap:3px}
  #${ROOT_ID} button{border:0;border-radius:7px;background:#292c43;color:#fff;font:600 14px system-ui,sans-serif;padding:0;touch-action:manipulation}
  #${ROOT_ID} .kb-grid button{aspect-ratio:1/1;min-width:0}
  #${ROOT_ID} button:active{background:#6554d9}
  #${ROOT_ID} button.fn{background:#3f4261;font-size:12px}
  #${ROOT_ID} button.on{background:#6554d9}
  #${ROOT_ID} .kb-grid .w2{grid-column:span 2;aspect-ratio:auto}
  #${ROOT_ID} .kb-grid .w4{grid-column:span 4;aspect-ratio:auto}
  #${ROOT_ID} .kb-grid .w6{grid-column:span 6;aspect-ratio:auto}
  #${ROOT_ID} .kb-grid .w3{grid-column:span 3;aspect-ratio:auto}
  `;
  document.head.appendChild(s);
}

function mount() {
  if (!isTouch() || document.getElementById(ROOT_ID)) return;
  css();
  let st = { size: 1, x: null, y: null, moved: false };
  try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };

  const root = document.createElement("section");
  root.id = ROOT_ID; root.setAttribute("aria-label", "In-game keyboard");
  root.innerHTML = `<div class="kb-head"><span>KEYBOARD</span><button type="button" class="fn" data-a="smaller">A-</button><button type="button" class="fn" data-a="bigger">A+</button><button type="button" class="done" data-a="done">Done</button></div><div class="kb-grid"></div>`;
  document.body.appendChild(root);
  const grid = root.querySelector(".kb-grid");
  let target = null, shift = false, symbols = false, restore = null;

  const applySize = () => { root.style.width = Math.min(SIZES[st.size], window.innerWidth - 12) + "px"; };
  const clamp = () => {
    const w = root.offsetWidth, h = root.offsetHeight;
    st.x = Math.max(4, Math.min(window.innerWidth - w - 4, st.x)); st.y = Math.max(4, Math.min(window.innerHeight - h - 4, st.y));
    root.style.left = st.x + "px"; root.style.top = st.y + "px"; root.style.right = root.style.bottom = "auto";
  };
  const place = () => {
    applySize();
    if (st.x == null || st.y == null) { st.x = (window.innerWidth - root.offsetWidth) / 2; st.y = window.innerHeight - root.offsetHeight - 14; }
    clamp();
    /* if the keyboard covers the box being typed in, hop to the other half of the screen (until you drag it yourself) */
    if (!st.moved && target) {
      const t = target.getBoundingClientRect(), r = root.getBoundingClientRect();
      if (t.bottom > r.top && t.top < r.bottom) { st.y = t.top > window.innerHeight / 2 ? 8 : window.innerHeight - r.height - 14; clamp(); }
    }
  };

  const fire = (type, init) => { if (target) target.dispatchEvent(new (init && init.key ? KeyboardEvent : InputEvent)(type, Object.assign({ bubbles: true, cancelable: true }, init || {}))); };
  const changed = (data, inputType) => { fire("input", { data, inputType: inputType || "insertText" }); target && target.dispatchEvent(new Event("change", { bubbles: true })); };
  const type = (ch) => {
    if (!target) return;
    const s = target.selectionStart ?? target.value.length, e = target.selectionEnd ?? target.value.length;
    const t = shift ? ch.toUpperCase() : ch;
    if (target.maxLength > 0 && target.value.length - (e - s) + t.length > target.maxLength) return;
    target.value = target.value.slice(0, s) + t + target.value.slice(e);
    try { target.setSelectionRange(s + t.length, s + t.length); } catch (_) {}
    changed(t);
    if (shift && !caps) { shift = false; draw(); }
  };
  const back = () => {
    if (!target) return;
    let s = target.selectionStart ?? target.value.length; const e = target.selectionEnd ?? s;
    if (s === e) { if (s === 0) return; s -= 1; }
    target.value = target.value.slice(0, s) + target.value.slice(e);
    try { target.setSelectionRange(s, s); } catch (_) {}
    changed(null, "deleteContentBackward");
  };
  const enter = () => {
    if (!target) return;
    if (target.tagName === "TEXTAREA") { type("\n"); return; }
    const k = { key: "Enter", code: "Enter", keyCode: 13, which: 13 };
    fire("keydown", k); fire("keypress", k); fire("keyup", k);       /* game chat boxes send on Enter */
    const f = target.form; if (f && f.requestSubmit) { try { f.requestSubmit(); } catch (_) {} }
  };
  let caps = false, lastShiftTap = 0;

  const key = (label, act, cls) => { const b = document.createElement("button"); b.type = "button"; b.textContent = label; if (cls) b.className = cls; b.dataset.k = act; grid.appendChild(b); return b; };
  function draw() {
    grid.innerHTML = "";
    const rows = symbols ? SYMBOLS : LETTERS;
    rows.forEach((line, i) => {
      if (i === 3) { const sh = key(caps ? "\u21ea" : "\u21e7", "shift", "fn w2" + (shift ? " on" : "")); if (symbols) { sh.textContent = ""; sh.style.visibility = "hidden"; } }
      [...line].forEach((ch) => key(shift && !symbols && /[a-z]/.test(ch) ? ch.toUpperCase() : ch, "c:" + ch));
      if (i === 3) key("\u232b", "back", "fn w2");
    });
    key(symbols ? "ABC" : "123", "sym", "fn w2" + (symbols ? " on" : ""));
    key(",", "c:,", ""); key("space", "c: ", "w4"); key(".", "c:.", ""); key("\u21b5", "enter", "fn w2");
  }
  grid.addEventListener("pointerdown", (e) => {
    const b = e.target.closest("button"); if (!b) return; e.preventDefault(); e.stopPropagation();
    const k = b.dataset.k;
    if (k.startsWith("c:")) type(k.slice(2));
    else if (k === "back") back();
    else if (k === "enter") enter();
    else if (k === "sym") { symbols = !symbols; draw(); }
    else if (k === "shift") {
      const now = Date.now();
      if (caps) { caps = false; shift = false; }
      else if (shift && now - lastShiftTap < 400) caps = true;       /* double tap = caps lock */
      else shift = !shift;
      lastShiftTap = now; draw();
    }
  }, { passive: false });
  root.querySelector(".kb-head").addEventListener("pointerdown", (e) => {
    const b = e.target.closest("button");
    if (b) {
      e.preventDefault(); e.stopPropagation();
      const a = b.dataset.a;
      if (a === "done") { hide(); }
      else { st.size = Math.max(0, Math.min(SIZES.length - 1, st.size + (a === "bigger" ? 1 : -1))); save(); place(); }
      return;
    }
    /* drag by the title bar */
    const r = root.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top, h = e.currentTarget;
    h.setPointerCapture(e.pointerId); e.preventDefault();
    const mv = (ev) => { st.x = ev.clientX - ox; st.y = ev.clientY - oy; st.moved = true; clamp(); };
    const up = () => { h.removeEventListener("pointermove", mv); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up); save(); };
    h.addEventListener("pointermove", mv); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
  });

  function show(el) {
    if (restore && restore.el !== el) unlock();
    target = el; restore = restore && restore.el === el ? restore : { el, ro: el.readOnly, im: el.getAttribute("inputmode") };
    el.setAttribute("inputmode", "none"); el.readOnly = true;       /* no system keyboard */
    root.classList.add("show"); draw(); place();
  }
  function unlock() { if (!restore) return; const { el, ro, im } = restore; el.readOnly = ro; if (im == null) el.removeAttribute("inputmode"); else el.setAttribute("inputmode", im); restore = null; }
  function hide() { root.classList.remove("show"); unlock(); if (target) { try { target.blur(); } catch (_) {} } target = null; shift = caps = false; }

  const typable = (el) => (el instanceof HTMLInputElement && !["button", "submit", "checkbox", "radio", "range", "color", "file", "reset", "image", "hidden"].includes(el.type)) || el instanceof HTMLTextAreaElement;
  document.addEventListener("focusin", (e) => { const el = e.target; if (typable(el) && !el.disabled && !(el.readOnly && !(restore && restore.el === el))) show(el); }, true);
  document.addEventListener("pointerdown", (e) => {
    if (!root.classList.contains("show") || root.contains(e.target)) return;
    if (target && (e.target === target || target.contains(e.target))) return;
    if (typable(e.target)) return;                                   /* tapping another box: focusin takes over */
    hide();
  }, true);
  window.addEventListener("resize", () => { if (root.classList.contains("show")) place(); });
  window.addEventListener("orientationchange", () => setTimeout(() => { if (root.classList.contains("show")) place(); }, 250));
  window.__ph3d_keyboard = { show: (el) => typable(el) && show(el), hide };
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
else mount();
