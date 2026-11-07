/* js/ui/wrestling-modal.js — FIGHT MODE skill panel (REWRITE)
   Tapping FIGHT (or F) enters fight mode: the context buttons are swapped
   for six lettered skills down the LEFT edge —  G P K E T S.
   Each button shows the move it will run next (it changes as you chain, and
   when you are in a clinch). Tap two or three at once for chord combos.
   Tap FIGHT again (or ✕) to leave.  Desktop keys: U J K L I O.        */
import { FightSkills, SKILLS, SKILL_ORDER } from "../core/fight-skills.js";
import { WrestlingCombat } from "../core/wrestling-combat.js";

const CSS_ID = "ph3d-fight-css", ROOT_ID = "ph3d-fight-panel";
let _open = false, _walker = null, _off = [], _keyH = null, _toastT = 0;
let _side = "left";
try { _side = localStorage.getItem("ph3d_fight_side") || "left"; } catch (e) {}

function css() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement("style");
  s.id = CSS_ID;
  s.textContent = `
  body.ph3d-fight #hud-ctx, body.ph3d-fight #hud-item, body.ph3d-fight #hud-bl,
  body.ph3d-fight #ph3d-walk-actions{display:none!important}
  #${ROOT_ID}{position:fixed;z-index:31;bottom:calc(env(safe-area-inset-bottom,0px) + 200px);width:156px;display:none;
    font-family:"Archivo",system-ui,-apple-system,"Segoe UI",sans-serif;color:#f3f1e8;user-select:none;-webkit-user-select:none;touch-action:none;pointer-events:none}
  #${ROOT_ID}.on{display:block}
  #${ROOT_ID}.left{left:calc(env(safe-area-inset-left,0px) + 10px)}
  #${ROOT_ID}.right{right:calc(env(safe-area-inset-right,0px) + 10px);bottom:calc(env(safe-area-inset-bottom,0px) + 250px)}
  .fk-head{display:flex;align-items:center;justify-content:space-between;margin:0 2px 6px;pointer-events:none}
  .fk-title{font:900 10px/1 "Archivo",sans-serif;letter-spacing:.2em;color:#ff5a3c;text-shadow:0 1px 4px #000}
  .fk-mini{display:flex;gap:6px;pointer-events:auto}
  .fk-mini b{width:26px;height:26px;border-radius:9px;display:flex;align-items:center;justify-content:center;font:900 12px/1 sans-serif;
    background:rgba(12,18,14,.8);border:1px solid rgba(255,90,60,.45);color:#ff5a3c;cursor:pointer}
  .fk-combo{height:34px;margin:0 2px 6px;display:flex;flex-direction:column;justify-content:center;pointer-events:none;
    font:900 11px/1.1 "Archivo",sans-serif;letter-spacing:.12em;text-shadow:0 2px 6px #000}
  .fk-combo .n{font-size:20px;color:#ffcc2b}.fk-combo .w{color:#f3f1e8;font-size:9px}
  .fk-combo.pop .n{animation:fkPop .28s ease-out}
  @keyframes fkPop{0%{transform:scale(1.5)}100%{transform:scale(1)}}
  .fk-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;pointer-events:auto}
  .fk-btn{position:relative;height:62px;border-radius:16px;background:rgba(12,18,14,.82);border:1.5px solid rgba(243,241,232,.2);
    -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#f3f1e8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
    cursor:pointer;touch-action:none;-webkit-tap-highlight-color:transparent;box-shadow:0 6px 18px rgba(0,0,0,.45);transition:transform .08s,background .12s,border-color .12s}
  .fk-btn .l{font:900 24px/1 "Archivo",sans-serif;color:#ffcc2b}
  .fk-btn .m{font:800 7.5px/1 "Archivo",sans-serif;letter-spacing:.08em;color:#c9d6cf;max-width:64px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .fk-btn .k{position:absolute;top:4px;right:6px;font:800 7px/1 "Archivo",sans-serif;color:#7d8f86}
  .fk-btn.down{transform:scale(.92);background:#ff5a3c;border-color:#ff5a3c}
  .fk-btn.down .l,.fk-btn.down .m{color:#2a1006}
  .fk-btn.cl{border-color:#ff5a3c;background:rgba(60,18,10,.88)}
  .fk-btn.cl .l{color:#ff8a6c}
  #${ROOT_ID}.clinch .fk-title:after{content:" · CLINCH";color:#ffcc2b}
  `;
  document.head.appendChild(s);
}

function build() {
  css();
  let root = document.getElementById(ROOT_ID);
  if (root) return root;
  root = document.createElement("div");
  root.id = ROOT_ID;
  root.innerHTML = `
    <div class="fk-head"><div class="fk-title">FIGHT SKILLS</div>
      <div class="fk-mini"><b id="fk-flip">⇄</b><b id="fk-x">✕</b></div></div>
    <div class="fk-combo" id="fk-combo"></div>
    <div class="fk-grid" id="fk-grid"></div>`;
  document.body.appendChild(root);
  const grid = root.querySelector("#fk-grid");
  for (const L of SKILL_ORDER) {
    const b = document.createElement("div");
    b.className = "fk-btn"; b.dataset.l = L;
    const keyName = SKILLS[L].key.replace("Key", "");
    b.innerHTML = `<span class="k">${keyName}</span><span class="l">${L}</span><span class="m"></span>`;
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); b.classList.add("down"); try { b.setPointerCapture(e.pointerId); } catch (x) {} FightSkills.press(L); refresh(); });
    const up = () => b.classList.remove("down");
    b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up);
    grid.appendChild(b);
  }
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  root.querySelector("#fk-x").addEventListener("pointerdown", (e) => { stop(e); WrestlingModal.close(); });
  root.querySelector("#fk-flip").addEventListener("pointerdown", (e) => {
    stop(e); _side = _side === "left" ? "right" : "left";
    try { localStorage.setItem("ph3d_fight_side", _side); } catch (x) {}
    place();
  });
  return root;
}
function place() { const r = document.getElementById(ROOT_ID); if (r) r.className = (_open ? "on " : "") + _side + (WrestlingCombat.clinched() ? " clinch" : ""); }

/* sub-labels show the move each button will run next */
function refresh() {
  const root = document.getElementById(ROOT_ID); if (!root) return;
  place();
  const cl = WrestlingCombat.clinched();
  root.querySelectorAll(".fk-btn").forEach((b) => {
    const p = FightSkills.preview(b.dataset.l);
    b.querySelector(".m").textContent = p.label;
    b.classList.toggle("cl", cl);
  });
}

function showCombo(name, n, mul) {
  const el = document.getElementById("fk-combo"); if (!el) return;
  el.innerHTML = (n > 1 ? `<span class="n">${n} HIT${n > 1 ? "S" : ""}${mul > 1.01 ? " ×" + mul.toFixed(2) : ""}</span>` : "") + (name ? `<span class="w">${name}</span>` : "");
  el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
  clearTimeout(_toastT); _toastT = setTimeout(() => { el.innerHTML = ""; }, 1800);
}

function onKey(e) {
  if (!_open || e.repeat) return;
  const t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  for (const L of SKILL_ORDER) if (SKILLS[L].key === e.code) { e.preventDefault(); FightSkills.press(L); refresh(); return; }
}

export const WrestlingModal = {
  open(opts) {
    if (_open) return;
    _walker = opts.walker;
    build();
    _open = true;
    document.body.classList.add("ph3d-fight");
    _walker._guard = true;
    FightSkills.mount(_walker);
    _off = [
      WrestlingCombat.on((ev) => {
        if (ev.type === "hit") showCombo("", ev.combo, ev.mul);
        if (ev.type === "move" || ev.type === "clinch") refresh();
      }),
      FightSkills.on((ev) => { if (ev.type === "combo") showCombo(ev.name, WrestlingCombat.comboCount(), WrestlingCombat.comboMul()); refresh(); }),
    ];
    _keyH = onKey; window.addEventListener("keydown", _keyH);
    refresh();
    const fight = document.getElementById("ph3d-walk-attack"); if (fight) fight.classList.add("is-live");
  },
  close() {
    if (!_open) return;
    _open = false;
    document.body.classList.remove("ph3d-fight");
    if (_walker) _walker._guard = false;
    FightSkills.unmount();
    _off.forEach((f) => f()); _off = [];
    if (_keyH) window.removeEventListener("keydown", _keyH); _keyH = null;
    place();
    const fight = document.getElementById("ph3d-walk-attack"); if (fight) fight.classList.remove("is-live");
  },
  toggle(opts) { _open ? this.close() : this.open(opts); },
  isOpen() { return _open; },
  activeMove() { return WrestlingCombat.isBusy() ? "busy" : null; },
};
