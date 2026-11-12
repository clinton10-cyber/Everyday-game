/* js/ui/robbery-ui.js -- hold-to-confirm robbery button + progress bar.
   Self-contained (own CSS, own timer); if hud.js changes nothing here breaks. No emoji. */
import { Robbery } from "../core/robbery.js";
import { CFG } from "../core/engagement-config.js";

const ID = "ph3d-rob";
let el, fill, label, holdT = 0, holding = false, target = null, timer = 0;

function css() {
  if (document.getElementById(ID + "-css")) return;
  const s = document.createElement("style"); s.id = ID + "-css";
  s.textContent = `
  #${ID}{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom) + 116px);z-index:41;display:none;
    min-width:210px;max-width:80vw;height:52px;border-radius:26px;overflow:hidden;background:rgba(18,8,8,.92);border:1px solid rgba(255,90,60,.7);
    color:#ffe9e3;font:800 12px/52px "Archivo",system-ui,sans-serif;letter-spacing:.12em;text-align:center;touch-action:none;user-select:none;-webkit-user-select:none;cursor:pointer}
  #${ID}.on{display:block}
  #${ID} i{position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(255,90,60,.55)}
  #${ID} span{position:relative;padding:0 18px;white-space:nowrap}
  #${ID}.run{border-color:rgba(255,198,43,.8);cursor:default}
  #${ID}.run i{background:rgba(255,198,43,.45)}
  #${ID}.esc{border-color:rgba(124,200,255,.9)}
  #${ID}.esc i{background:rgba(124,200,255,.4)}`;
  document.head.appendChild(s);
}
function build() {
  if (el) return;
  css();
  el = document.createElement("div"); el.id = ID;
  el.innerHTML = "<i></i><span></span>";
  fill = el.querySelector("i"); label = el.querySelector("span");
  document.body.appendChild(el);
  const down = (e) => { e.preventDefault(); e.stopPropagation(); if (!target || Robbery.active) return; holding = true; holdT = 0; };
  const up = () => { holding = false; holdT = 0; if (!Robbery.active) fill.style.width = "0"; };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up); el.addEventListener("pointerleave", up);
}

const nm = { cashier: "ROB CASHIER", atm: "ROB ATM", mug: "MUG" };

function frame(dt) {
  const a = Robbery.active;
  if (a) {
    el.classList.add("on", a.phase === "escape" ? "esc" : "run"); el.classList.remove(a.phase === "escape" ? "run" : "esc");
    fill.style.width = (100 * (1 - Math.max(0, a.left) / a.total)) + "%";
    label.textContent = (a.phase === "escape" ? "ESCAPE  " : "ROBBING  ") + Math.max(0, Math.ceil(a.left)) + "s";
    return;
  }
  el.classList.remove("run", "esc");
  target = Robbery.nearest();
  if (!target || !Robbery.canStart(target)) {
    const cd = target ? Robbery.cooldownLeftMs(target) : 0;
    if (target && cd > 0) { el.classList.add("on"); label.textContent = "NOTHING LEFT TO TAKE"; fill.style.width = "0"; }
    else el.classList.remove("on");
    holding = false; return;
  }
  el.classList.add("on");
  if (holding) {
    holdT += dt;
    fill.style.width = Math.min(100, 100 * holdT / CFG.robberyConfirmSeconds) + "%";
    label.textContent = "HOLD...";
    if (holdT >= CFG.robberyConfirmSeconds) { holding = false; holdT = 0; Robbery.start(target); }
  } else { fill.style.width = "0"; label.textContent = (target.label || nm[target.kind] || "ROB") + "  (HOLD)"; }
}

export const RobberyUI = {
  init() {
    if (timer) return;
    build();
    let last = performance.now();
    timer = setInterval(() => {
      const now = performance.now(), dt = Math.min(0.25, (now - last) / 1000); last = now;
      try { Robbery.tick(dt); frame(dt); } catch (e) {}
    }, 100);
  },
};
window.__ph3d_robberyUI = RobberyUI;
