/* ════════════════════════════════════════════════════════════════
   objective-hud.js — live objective card + event action button.

   • Objective card (top-centre): job name, destination, a direction
     arrow relative to where you're facing, distance, countdown, and
     a repair bar for mechanic jobs.
   • Event button (bottom-centre): appears when a world event is in
     reach so touch players can handle it (keyboard players press E).

   ObjectiveHUD.mount() / .tick(px, pz) / .unmount()
   ════════════════════════════════════════════════════════════════ */

import { JobObjectives } from "../core/job-objectives.js";
import { WorldEvents } from "../core/world-events.js";

const CSS_ID = "ph3d-obj-css";

function injectCSS() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement("style");
  s.id = CSS_ID;
  s.textContent = `
    #ph3d-obj-card {
      position: fixed; left: 50%;
      top: var(--ph3d-obj-top, calc(env(safe-area-inset-top, 0px) + 66px));
      transform: translateX(-50%);
      z-index: 27; display: none;
      min-width: 240px; padding: 10px 14px; border-radius: 16px;
      background: var(--h-glass, rgba(10,16,13,.80));
      border: 1px solid var(--h-line-hi, rgba(243,241,232,.30));
      color: var(--h-paper, #f3f1e8);
      font-family: var(--h-font, "Archivo", system-ui, sans-serif);
      -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
      box-shadow: 0 10px 30px rgba(0,0,0,.45);
      white-space: nowrap; pointer-events: none;
    }
    #ph3d-obj-card.on { display: block; }
    #ph3d-obj-card .o-row { display: flex; align-items: center; gap: 12px; }
    #ph3d-obj-card .o-ico {
      width: 34px; height: 34px; border-radius: 50%; flex: none;
      background: var(--h-danfo, #ffc62b); color: var(--h-danfo-ink, #1b1400);
      display: flex; align-items: center; justify-content: center;
    }
    #ph3d-obj-arrow { display: block; width: 18px; height: 18px; transition: transform .12s linear; }
    #ph3d-obj-card .o-body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    #ph3d-obj-card .o-name { color: var(--h-mist, #9db0a6); font-weight: 700; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; }
    #ph3d-obj-card .o-target { color: var(--h-paper, #f3f1e8); font-weight: 700; font-size: 13px; overflow: hidden; text-overflow: ellipsis; }
    #ph3d-obj-card .o-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    #ph3d-obj-card .o-timer { color: var(--h-danfo, #ffc62b); font-variant-numeric: tabular-nums; font-weight: 800; font-size: 15px; }
    #ph3d-obj-card .o-dist { color: var(--h-mist, #9db0a6); font-variant-numeric: tabular-nums; font-weight: 700; font-size: 11px; }
    #ph3d-obj-card .o-bar { display: none; height: 4px; margin-top: 8px; border-radius: 3px; background: var(--h-line, rgba(243,241,232,.14)); overflow: hidden; }
    #ph3d-obj-card .o-bar.on { display: block; }
    #ph3d-obj-card .o-bar i { display: block; height: 100%; width: 0; background: var(--h-garden, #35d07f); }

    #ph3d-ev-btn {
      position: fixed; left: 50%; transform: translateX(-50%);
      bottom: calc(env(safe-area-inset-bottom, 0px) + 150px);
      z-index: 28; display: none;
      padding: 12px 22px; border-radius: 16px;
      background: rgba(255,204,43,.96); color: #1a1405;
      border: 0; font: 900 14px Inter, system-ui, sans-serif;
      box-shadow: 0 8px 24px rgba(0,0,0,.45);
      touch-action: manipulation;
    }
    #ph3d-ev-btn.on { display: block; }
  `;
  document.head.appendChild(s);
}

let _card = null, _btn = null;
let _els = null;
let _btnEvent = null;
let _last = {};

function _playerPose() {
  try {
    const d = window.__ph3d_drive;
    return d && d.getPos ? d.getPos() : null;
  } catch (e) { return null; }
}

function _set(el, key, val, prop) {
  if (_last[key] === val) return;
  _last[key] = val;
  if (prop === "style") el.style.transform = val;
  else el.textContent = val;
}

export const ObjectiveHUD = {
  mount() {
    if (_card) return _card;
    injectCSS();

    _card = document.createElement("div");
    _card.id = "ph3d-obj-card";
    _card.innerHTML = `
      <div class="o-row">
        <div class="o-ico"><svg id="ph3d-obj-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V5M5 11l7-7 7 7"/></svg></div>
        <div class="o-body">
          <div class="o-name" id="ph3d-obj-name">Delivery</div>
          <div class="o-target" id="ph3d-obj-target"></div>
        </div>
        <div class="o-right">
          <div class="o-timer" id="ph3d-obj-timer">0:00</div>
          <div class="o-dist" id="ph3d-obj-dist"></div>
        </div>
      </div>
      <div class="o-bar" id="ph3d-obj-bar"><i id="ph3d-obj-barfill"></i></div>
    `;
    document.body.appendChild(_card);

    _btn = document.createElement("button");
    _btn.id = "ph3d-ev-btn";
    _btn.type = "button";
    _btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (_btnEvent) WorldEvents.interact(_btnEvent);
      _btnEvent = null;
      _btn.classList.remove("on");
    });
    document.body.appendChild(_btn);

    _els = {
      arrow: _card.querySelector("#ph3d-obj-arrow"),
      name:  _card.querySelector("#ph3d-obj-name"),
      target:_card.querySelector("#ph3d-obj-target"),
      timer: _card.querySelector("#ph3d-obj-timer"),
      dist:  _card.querySelector("#ph3d-obj-dist"),
      bar:   _card.querySelector("#ph3d-obj-bar"),
      fill:  _card.querySelector("#ph3d-obj-barfill"),
    };
    _last = {};
    return _card;
  },

  tick(px, pz) {
    if (!_card) return;
    const pose = _playerPose();
    if (pose) { px = pose.x; pz = pose.z; }

    /* ── event button ── */
    const ev = WorldEvents.nearestInteractable(px, pz);
    _btnEvent = ev;
    if (ev) {
      _btn.textContent = ev.prompt;
      _btn.classList.add("on");
    } else {
      _btn.classList.remove("on");
    }

    /* ── objective card ── */
    const job = JobObjectives.active();
    const t = JobObjectives.target();
    const guide = JobObjectives.guidanceTarget(px, pz) || t;
    if (!job || !t) { _card.classList.remove("on"); return; }
    _card.classList.add("on");

    const dx = guide.x - px, dz = guide.z - pz;
    const dist = Math.hypot(dx, dz);

    /* Facing convention in this game: forward = (sin yaw, cos yaw).
       Looking down +z puts +x on the LEFT, so screen rotation is the
       negative of the bearing relative to your heading. */
    const yaw = pose ? pose.yaw : 0;
    const rel = Math.atan2(dx, dz) - yaw;
    const deg = Math.round(-rel * 180 / Math.PI / 5) * 5;

    const verb = job.stage === "repair" ? "Repair at " : job.stage === "dropoff" ? "Drop-off: " : "Pick-up: ";
    _set(_els.name, "name", job.name + " job");
    _set(_els.target, "target", verb + t.name);
    _set(_els.arrow, "arrow", "rotate(" + deg + "deg)", "style");
    _set(_els.dist, "dist", dist >= 1000 ? (dist / 1000).toFixed(1) + " km" : Math.round(dist) + " m");

    const secs = Math.max(0, job.timer);
    const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
    _set(_els.timer, "timer", m + ":" + String(s).padStart(2, "0"));

    const showBar = job.stage === "repair" && job.hold > 0;
    _els.bar.classList.toggle("on", showBar);
    if (showBar) _els.fill.style.width = Math.min(100, (job.hold / 4) * 100) + "%";
  },

  unmount() {
    if (_card && _card.parentNode) _card.parentNode.removeChild(_card);
    if (_btn && _btn.parentNode) _btn.parentNode.removeChild(_btn);
    _card = _btn = _els = _btnEvent = null;
    _last = {};
  },
};

