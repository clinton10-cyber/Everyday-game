/* ════════════════════════════════════════════════════════════════
   prison.js — the cell block a player is sent to when arrested.
   ────────────────────────────────────────────────────────────────
   Builds the real State Jail interior (places/statejail) through the
   generic interior scene, which also spawns the inmates and wardens
   listed under INTERIOR_NPCS.statejail, then adds a sentence HUD
   (countdown + bail button).

   Leaving is blocked in core/router.js while Prison.inJail is true.
   The sentence ends by timer or bail; Prison.release() then routes
   out through the "__release__" sentinel.
   ════════════════════════════════════════════════════════════════ */

import { interiorScene } from "./interior.js";
import { confirmDanger } from "../ui/settings.js";
import { Sfx } from "../core/sfx.js";

const toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} };

function buildHud() {
  const hud = document.createElement("div");
  hud.id = "ph3d-prison-hud";
  Object.assign(hud.style, {
    position: "fixed",
    top: "calc(env(safe-area-inset-top, 0px) + 66px)",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "28",
    padding: "12px 18px",
    borderRadius: "16px",
    background: "rgba(120,10,10,.92)",
    border: "1px solid rgba(255,90,90,.55)",
    color: "#fff5f5",
    font: "800 12px Inter, system-ui, sans-serif",
    letterSpacing: ".05em",
    textAlign: "center",
    boxShadow: "0 12px 30px rgba(0,0,0,.55)",
    pointerEvents: "auto",
    touchAction: "manipulation",
  });
  hud.innerHTML =
    '<div style="font-size:10px;letter-spacing:.28em;color:#ffb0b0;text-transform:uppercase;margin-bottom:6px">SERVING SENTENCE</div>' +
    '<div id="ph3d-prison-time" style="font-size:20px;font-weight:900;font-variant-numeric:tabular-nums">-- s</div>' +
    '<button id="ph3d-prison-bail" style="margin-top:10px;padding:9px 16px;border-radius:12px;border:none;' +
    'background:#ffcc5e;color:#1a1400;font:800 11px Inter,system-ui,sans-serif;letter-spacing:.14em;cursor:pointer"></button>';
  hud.addEventListener("pointerdown", (e) => e.stopPropagation());
  document.body.appendChild(hud);
  return hud;
}

export async function prisonScene(params, router) {
  const scene = await interiorScene({ id: "statejail" }, router);
  if (!scene) return scene;

  try { Sfx.play("jail_door_slam"); Sfx.loop("ambient_indoor"); } catch (_) {}

  const Pr = window.__ph3d_prison;
  const hud = buildHud();
  const timeEl = hud.querySelector("#ph3d-prison-time");
  const bailEl = hud.querySelector("#ph3d-prison-bail");

  const cost = Pr && Pr.bailCost ? Pr.bailCost() : 0;
  bailEl.textContent = cost > 0 ? "PAY BAIL \u00b7 \u20a6" + cost.toLocaleString("en-NG") : "PAY BAIL";

  bailEl.addEventListener("click", async () => {
    try {
      const P = window.__ph3d_prison;
      if (!P || !P.inJail) return;
      const ok = await confirmDanger("Pay bail · ₦" + (P.bailCost ? P.bailCost().toLocaleString() : "500,000") + "?");
      if (!ok) return;
      const res = P.payBail();
      if (!res || !res.ok) toast("Not enough money for bail");
      /* On success Prison.release() routes the player back to the city. */
    } catch (e) { console.warn("[prison] bail failed:", e); }
  });

  /* Visitors (not serving) don't need the sentence HUD. */
  const sync = () => {
    const P = window.__ph3d_prison;
    const jailed = !!(P && P.inJail);
    hud.style.display = jailed ? "block" : "none";
    if (jailed) timeEl.textContent = Math.max(0, Math.ceil(P.timeLeft)) + " s";
  };
  sync();

  const baseUpdate = scene.update || (() => {});
  scene.update = function (dt, t) {
    baseUpdate.call(this, dt, t);
    try { sync(); } catch (e) {}
  };

  const baseDispose = scene.dispose || (() => {});
  scene.dispose = function () {
    try { baseDispose.call(this); } catch (e) {}
    try { hud.remove(); } catch (e) {}
  };

  /* Keep the sceneId the router and Prison.release() look for. */
  scene.sceneId = "statejail";
  return scene;
}

