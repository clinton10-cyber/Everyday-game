/* js/core/kidnap.js
   Single-player kidnap flow.

   The player grabs a downed NPC, shoves them into the nearest
   vehicle, and drives off. Nearby NPCs panic. Police are dispatched.
   A hostage panel with DEMAND / RELEASE / EXECUTE appears in the HUD.

   Public API:
     Kidnap.mount({ getWalker, getVehicle, getScene })
     Kidnap.nearestTarget(px, pz, range)      → npc | null
     Kidnap.grab(npc)                         → { ok, hostage }
     Kidnap.release()                         → drop on the road
     Kidnap.execute()                         → kill + crime
     Kidnap.demand(amount)                    → ransom comes later
     Kidnap.tick(dt)                          → called by router
     Kidnap.unmount()                         → clean up on scene exit
*/

import { NPCs } from "./npcs.js";
import { confirmDanger } from "../ui/settings.js";
import { Crime } from "./crime.js";
import { Economy } from "./economy.js";
import { Police } from "./police.js";
import { Blood } from "./blood.js";
import { Sfx } from "./sfx.js";

const HOLD_SECS       = 90;
const PANIC_RADIUS    = 20;
const DEFAULT_RANSOM  = 150000;
const MIN_RANSOM      = 50000;
const MAX_RANSOM      = 5000000;
const RANSOM_DELAY_MS = 6000;

const ROLE_RANSOM = {
  banker:   400000,
  doctor:   250000,
  trader:   150000,
  mechanic: 120000,
  walker:   100000,
};

let S = null;          // mounted state
let _hostage = null;   // { npc, name, timer, ransom, demanded, seatInfo }
let _delayTimer = 0;   // ms left until the family pays out
let _scene = null;

/* ── Grab helpers ─────────────────────────────────────────── */

function nearestDownedNPC(px, pz, range) {
  let best = null, bestD = range * range;
  for (const npc of NPCs.list) {
    if (npc.dead) continue;
    if (npc.state !== "downed") continue; // must be downed
    if (npc.role === "police") continue; // police can't be grabbed
    const dx = npc.ctl.pos.x - px;
    const dz = npc.ctl.pos.z - pz;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = npc; }
  }
  return best;
}

function panicEveryoneAround(x, z, radius, seconds) {
  for (const npc of NPCs.list) {
    if (npc.dead) continue;
    if (npc.role === "police") continue;
    const dx = npc.ctl.pos.x - x, dz = npc.ctl.pos.z - z;
    if (dx * dx + dz * dz < radius * radius) {
      npc.state = "flee";
      npc.stateT = seconds;
      npc.threatX = x;
      npc.threatZ = z;
    }
  }
}

/* Hide the NPC mesh and freeze their tick. Restore on release. */
function detachNPC(npc) {
  npc._kidnapped = true;
  npc._savedState = npc.state;
  npc._savedT = npc.stateT;
  npc.state = "kidnapped";
  npc.stateT = 9999;
  npc.moveSpeed = 0;
  if (npc.group) npc.group.visible = false;
  if (npc.ctl) {
    npc.ctl._intentSpeed = 0;
    npc.ctl.state = "standing";
  }
}

function reattachNPC(npc, x, z) {
  npc._kidnapped = false;
  npc.state = "flee";
  npc.stateT = 3;
  npc.hp = Math.max(1, npc.hp);   // release keeps them alive
  npc.ctl.pos.x = x;
  npc.ctl.pos.z = z;
  npc.ctl.pos.y = 0;
  if (npc.group) {
    npc.group.visible = true;
    npc.group.position.set(x, 0, z);
  }
}

/* ── HUD ──────────────────────────────────────────────────── */

let _hud = null, _hudName = null, _hudTime = null,
    _hudBar = null, _hudRansom = null,
    _btnDemand = null, _btnRelease = null, _btnExecute = null;

function buildHud() {
  if (_hud && document.body.contains(_hud)) return;
  _hud = document.createElement("div");
  _hud.id = "ph3d-kidnap-hud";
  Object.assign(_hud.style, {
    position: "fixed",
    left: "50%",
    top: "calc(env(safe-area-inset-top, 0px) + 100px)",
    transform: "translateX(-50%)",
    zIndex: "29",
    minWidth: "260px",
    maxWidth: "92vw",
    padding: "14px 18px 16px",
    borderRadius: "18px",
    background: "rgba(120, 12, 12, .94)",
    border: "1px solid rgba(255, 120, 120, .55)",
    color: "#fff5f5",
    font: "800 13px Inter, system-ui, sans-serif",
    letterSpacing: ".03em",
    textAlign: "center",
    boxShadow: "0 12px 30px rgba(0,0,0,.6), 0 0 0 2px rgba(255,60,60,.15)",
    opacity: "0",
    transition: "opacity .25s",
    pointerEvents: "auto",
  });
  _hud.innerHTML = `
    <div style="font-size:10px;letter-spacing:.28em;color:#ffb0b0;
                text-transform:uppercase;margin-bottom:6px">
      HOSTAGE ON BOARD
    </div>
    <div id="ph3d-kidnap-name" style="font-size:16px;font-weight:900;
                                       margin-bottom:8px">—</div>
    <div style="display:flex;justify-content:center;gap:12px;
                align-items:baseline;margin-bottom:8px">
      <span style="font-size:11px;opacity:.75">Hold:</span>
      <span id="ph3d-kidnap-t" style="font-size:22px;font-weight:900;
                                      font-variant-numeric:tabular-nums">90</span>
      <span style="font-size:11px;opacity:.75">s</span>
    </div>
    <div style="height:4px;margin-bottom:12px;border-radius:3px;
                background:rgba(255,255,255,.18);overflow:hidden">
      <div id="ph3d-kidnap-bar" style="height:100%;width:100%;
                                       background:#ff5c5c;transition:width .1s linear"></div>
    </div>
    <div style="font-size:10px;opacity:.8;letter-spacing:.18em;
                text-transform:uppercase;margin-bottom:6px">RANSOM</div>
    <div id="ph3d-kidnap-ransom" style="font-size:18px;font-weight:900;
                                        color:#ffcc5e;margin-bottom:14px">
      ₦150,000
    </div>
    <div style="display:flex;gap:8px">
      <button id="ph3d-kidnap-demand"
        style="flex:1;padding:11px;border-radius:12px;border:none;
               background:linear-gradient(135deg,#ffcc5e,#ff9d5c);
               color:#1a1000;font:900 11px Inter,system-ui,sans-serif;
               letter-spacing:.14em;cursor:pointer">DEMAND</button>
      <button id="ph3d-kidnap-release"
        style="flex:1;padding:11px;border-radius:12px;
               border:1px solid rgba(255,255,255,.25);background:transparent;
               color:#fff5f5;font:900 11px Inter,system-ui,sans-serif;
               letter-spacing:.14em;cursor:pointer">RELEASE</button>
      <button id="ph3d-kidnap-execute"
        style="flex:1;padding:11px;border-radius:12px;border:none;
               background:linear-gradient(135deg,#ff2a2a,#c70000);
               color:#fff;font:900 11px Inter,system-ui,sans-serif;
               letter-spacing:.14em;cursor:pointer">EXECUTE</button>
    </div>
  `;
  document.body.appendChild(_hud);

  _hudName    = _hud.querySelector("#ph3d-kidnap-name");
  _hudTime    = _hud.querySelector("#ph3d-kidnap-t");
  _hudBar     = _hud.querySelector("#ph3d-kidnap-bar");
  _hudRansom  = _hud.querySelector("#ph3d-kidnap-ransom");
  _btnDemand  = _hud.querySelector("#ph3d-kidnap-demand");
  _btnRelease = _hud.querySelector("#ph3d-kidnap-release");
  _btnExecute = _hud.querySelector("#ph3d-kidnap-execute");

  _btnDemand.addEventListener("click", e => {
    e.stopPropagation();
    Kidnap.demand(_hostage ? _hostage.ransom : DEFAULT_RANSOM);
  });
  _btnRelease.addEventListener("click", e => {
    e.stopPropagation();
    Kidnap.release();
  });
  _btnExecute.addEventListener("click", async e => {
    e.stopPropagation();
    const ok = await confirmDanger("Execute the hostage? Crime +100.");
    if (ok) Kidnap.execute();
  });

  _hud.style.opacity = "0";
  _hud.style.pointerEvents = "none";
}

function refreshHud() {
  if (!_hud) return;
  if (!_hostage) {
    _hud.style.opacity = "0";
    _hud.style.pointerEvents = "none";
    return;
  }
  _hud.style.opacity = "1";
  _hud.style.pointerEvents = "auto";
  _hudName.textContent = _hostage.name;
  _hudTime.textContent = String(Math.max(0, Math.ceil(_hostage.timer)));
  _hudBar.style.width = (_hostage.timer / HOLD_SECS) * 100 + "%";
  _hudRansom.textContent = "₦" + _hostage.ransom.toLocaleString();

  _btnDemand.style.opacity = _hostage.demanded ? "0.4" : "1";
  _btnDemand.textContent   = _hostage.demanded ? "SENT" : "DEMAND";
  _btnDemand.disabled      = !!_hostage.demanded;
}

function disposeHud() {
  if (_hud && _hud.parentNode) _hud.parentNode.removeChild(_hud);
  _hud = _hudName = _hudTime = _hudBar = _hudRansom = null;
  _btnDemand = _btnRelease = _btnExecute = null;
}

/* ── Toast helper ─────────────────────────────────────────── */
function toast(msg) {
  try { window.__ph3d_phone && window.__ph3d_phone._toast(msg); } catch (e) {}
}

/* ═══════════════════════════════════════════════════════════ */
export const Kidnap = {

  mount(opts) {
    S = { ...opts };
    _scene = opts.getScene && opts.getScene();
    buildHud();
  },

  unmount() {
    if (_hostage) this.release();
    disposeHud();
    S = null;
    _scene = null;
    _hostage = null;
    _delayTimer = 0;
  },

  isHolding() { return !!_hostage; },

  nearestTarget(px, pz, range) {
    return nearestDownedNPC(px, pz, range || 2.6);
  },

  /* ── Grab ──────────────────────────────────────────────── */
  grab(npc) {
    if (!S) return { ok: false, reason: "not_mounted" };
    if (_hostage) return { ok: false, reason: "already_holding" };
    if (!npc || npc.dead || npc.state !== "downed") return { ok: false, reason: "not_downed" };
    if (npc.role === "police") return { ok: false, reason: "police_cant" };

    const walker = S.getWalker && S.getWalker();
    if (!walker) return { ok: false, reason: "no_player" };

    const px = walker.x, pz = walker.z;
    const name = (npc.roleDef && npc.roleDef.label) ||
                 (npc.groupLabel) ||
                 "Passenger";
    const ransom = ROLE_RANSOM[npc.role] || DEFAULT_RANSOM;

    detachNPC(npc);
    panicEveryoneAround(px, pz, PANIC_RADIUS, 6);
    let _grabLine = "";
    try { _grabLine = Sfx.voiceText("hostage_grab"); } catch (_) {}

    _hostage = {
      npc,
      name,
      timer: HOLD_SECS,
      ransom,
      demanded: false,
      seatInfo: null,
    };

    /* Optional: place NPC mesh in passenger seat */
    try {
      const vehicle = S.getVehicle && S.getVehicle();
      if (vehicle && vehicle.root) {
        npc.group.visible = true;
        npc.group.position.set(0.6, 0.9, -0.4);
        vehicle.root.add(npc.group);
        _hostage.seatInfo = { parent: vehicle.root };
      }
    } catch (e) {}

    /* Teleport player into car */
    if (typeof S.onGrabIntoCar === "function") {
      try { S.onGrabIntoCar(); } catch (e) {}
    }

    Crime.addEvent("kidnap", 70, "You");
    try { Police.dispatch("you"); } catch (e) {}
    toast("🚨 Kidnapped " + name.toLowerCase() + (_grabLine ? " \u00b7 \u201C" + _grabLine + "\u201D" : ""));
    refreshHud();
    return { ok: true, hostage: _hostage };
  },

  /* ── Demand ransom ─────────────────────────────────────── */
  demand(amount) {
    if (!_hostage) return { ok: false, reason: "no_hostage" };
    amount = Math.floor(Number(amount) || _hostage.ransom);
    if (amount < MIN_RANSOM) amount = MIN_RANSOM;
    if (amount > MAX_RANSOM) amount = MAX_RANSOM;
    _hostage.ransom = amount;
    _hostage.demanded = true;
    _delayTimer = RANSOM_DELAY_MS;
    Crime.addEvent("kidnap", 15, "You");
    let _dl = "";
    try { _dl = Sfx.voiceText("hostage_demand"); } catch (_) {}
    toast("💬 You: \u201C" + (_dl || "Pay the ransom!") + "\u201D \u00b7 ₦" + amount.toLocaleString());
    refreshHud();
    return { ok: true, amount };
  },

  /* ── Release ───────────────────────────────────────────── */
  release() {
    if (!_hostage) return { ok: false, reason: "no_hostage" };
    const npc = _hostage.npc;

    /* Remove from car seat if attached */
    try {
      if (_hostage.seatInfo && npc.group && npc.group.parent === _hostage.seatInfo.parent) {
        _hostage.seatInfo.parent.remove(npc.group);
        if (_scene) _scene.add(npc.group);
      }
    } catch (e) {}

    const walker = S && S.getWalker && S.getWalker();
    const px = walker ? walker.x : 0;
    const pz = walker ? walker.z : 0;
    const yaw = walker ? (walker.yaw || 0) : 0;
    const ox = Math.sin(yaw + Math.PI / 2) * 1.5;
    const oz = Math.cos(yaw + Math.PI / 2) * 1.5;
    reattachNPC(npc, px + ox, pz + oz);
    _hostage = null;
    _delayTimer = 0;
    let _fl = "";
    try { _fl = Sfx.voiceText("hostage_free"); } catch (_) {}
    toast("👋 Released the hostage" + (_fl ? " \u00b7 \u201C" + _fl + "\u201D" : ""));
    refreshHud();
    return { ok: true };
  },

  /* ── Execute ───────────────────────────────────────────── */
  execute() {
    if (!_hostage) return { ok: false, reason: "no_hostage" };
    const npc = _hostage.npc;

    /* Remove from car seat if attached */
    try {
      if (_hostage.seatInfo && npc.group && npc.group.parent === _hostage.seatInfo.parent) {
        _hostage.seatInfo.parent.remove(npc.group);
        if (_scene) _scene.add(npc.group);
      }
    } catch (e) {}

    const walker = S && S.getWalker && S.getWalker();
    const px = walker ? walker.x : 0;
    const pz = walker ? walker.z : 0;

    try {
      Blood.spray(_scene, px, 1.0, pz, { count: 30, spread: 4 });
      Blood.splat(_scene, px, pz);
    } catch (e) {}

    try {
      if (typeof NPCs._kill === "function") NPCs._kill(npc);
      else npc.dead = true;
    } catch (e) { npc.dead = true; }

    if (npc.group) npc.group.visible = true;
    Crime.addEvent("kill", 100, "You");
    try { Police.dispatch("you"); } catch (e) {}
    _hostage = null;
    _delayTimer = 0;
    toast("💀 Hostage executed · crime +100");
    refreshHud();
    return { ok: true };
  },

  /* ── Tick ──────────────────────────────────────────────── */
  tick(dt) {
    if (!_hostage) return;
    _hostage.timer -= dt;

    /* Ransom payout delay */
    if (_delayTimer > 0) {
      _delayTimer -= dt * 1000;
      if (_delayTimer <= 0 && _hostage && _hostage.demanded) {
        const amount = _hostage.ransom;
        const name = _hostage.name;
        try { Economy.receive("RANSOM", amount, "from " + name.toLowerCase() + "'s family"); } catch (e) {}
        try { Sfx.play("ransom_paid"); } catch (_) {}
        toast("💰 Ransom paid · ₦" + amount.toLocaleString());
        /* Auto-release after payment */
        const npc = _hostage.npc;
        try {
          if (_hostage.seatInfo && npc.group && npc.group.parent === _hostage.seatInfo.parent) {
            _hostage.seatInfo.parent.remove(npc.group);
            if (_scene) _scene.add(npc.group);
          }
        } catch (e) {}
        const walker = S && S.getWalker && S.getWalker();
        const px = walker ? walker.x : 0;
        const pz = walker ? walker.z : 0;
        reattachNPC(npc, px + 1.5, pz);
        _hostage = null;
        _delayTimer = 0;
        refreshHud();
        return;
      }
    }

    /* Hold timer expires → auto-execute */
    if (_hostage && _hostage.timer <= 0) {
      this.execute();
      return;
    }

    refreshHud();
  },
};

