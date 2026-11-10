import { Hunt } from "../core/hunt.js";
import { confirmDanger } from "./settings.js";
let _root = null;
function _build(){
  if (_root) return _root;
  const r = document.createElement("div");
  r.id = "ph3d-hunt-hud";
  r.innerHTML = `
    <div class="hh-head"><span class="hh-dot"></span><span class="hh-tier" id="hh-tier">THE HUNT</span></div>
    <div class="hh-timer" id="hh-timer">00:00</div>
    <div class="hh-hour" id="hh-hour">HOUR 0 / 24</div>
    <div class="hh-real" id="hh-real" style="font-size:10px;opacity:.6">—</div>
    <div class="hh-prize-label">PRIZE POOL</div>
    <div class="hh-prize" id="hh-prize">₦0</div>
    <button class="hh-cashout" id="hh-cashout">CASH OUT</button>`;
  document.body.appendChild(r);
  _root = r;
  r.querySelector("#hh-cashout").addEventListener("click", async (e)=>{
    e.stopPropagation();
    if (!Hunt.active) return;
    const pen = Hunt.tier.cashOutPenalty;
    const payout = Math.floor(Hunt.prizePool*(1-pen));
    const ok = await confirmDanger(`Cash out now and lose ${Math.round(pen*100)}%? You will receive ₦${payout.toLocaleString()}.`);
    if (ok) Hunt.cashOut();
  });
  return r;
}
export const HuntHUD = {
  init(){
    _build();
    window.addEventListener("ph3d:hunt-start",(e)=>{
      const t = e.detail.tier;
      if (!_root) return;
      _root.querySelector("#hh-tier").textContent = t.name;
      _root.classList.add("on");
    });
    window.addEventListener("ph3d:hunt-tick",(e)=>this._paint(e.detail));
    /* hunt-end always fires after win/death/cashout, so one listener is enough */
    window.addEventListener("ph3d:hunt-end",()=>{ if(_root) _root.classList.remove("on"); });
  },
  _paint(d){
    if (!_root || !Hunt.active) return;
    const rem = Math.max(0, d.totalHours*d.hourLengthSec - d.seconds);
    _root.querySelector("#hh-timer").textContent = String(Math.floor(rem/60)).padStart(2,"0")+":"+String(rem%60).padStart(2,"0");
    _root.querySelector("#hh-hour").textContent = `HOUR ${d.currentHour} / ${d.totalHours}`;
    const realEl = _root.querySelector("#hh-real");
    if (realEl) realEl.textContent = `${rem}s real`;
    _root.querySelector("#hh-prize").textContent = `₦${d.prize.toLocaleString()}`;
  },
};
