/* Contextual pedestrian / service NPC interaction HUD for ThirdPerson scenes. */
import { NPCs } from "./npcs.js";

let S = null;
let _wrap = null;
let _talk = null;
let _action = null;
let _current = null;
let _actionKey = "";

const ROLE_ACTIONS = {
  banker:   { label: "BANK",      app: "bank" },
  trader:   { label: "SHOP",      app: "shop" },
  doctor:   { label: "TREAT",     talk: true },
  mechanic: { label: "SERVICE",   talk: true },
  priest:   { label: "BLESSING",  talk: true },
  police:   { label: "REPORT",    talk: true },
  taxi:     { label: "RIDE INFO", talk: true },
  warden:   { label: "ASK WARDEN",talk: true },
};

function roleOf(npc) {
  const def = npc && npc.roleDef;
  return (def && def.action) || (npc && npc.role) || (npc && npc.groupTag) || "walker";
}
function roleLabel(npc) {
  return String((npc && npc.groupLabel) || (npc && npc.roleDef && npc.roleDef.label) || "Pedestrian").toUpperCase();
}
function actOn(npc, role) {
  const cfg = ROLE_ACTIONS[role];
  if (!cfg) return;
  if (cfg.app) {
    try { window.__ph3d_phone?.showApp(cfg.app); } catch (e) {}
    return;
  }
  if (cfg.talk) NPCs.talk(npc);
}

function build() {
  if (_wrap && document.body.contains(_wrap)) return;
  const styleId = "ph3d-npc-talk-css";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style"); style.id = styleId;
    style.textContent = `
      #ph3d-npc-actions{position:fixed;left:auto;right:calc(env(safe-area-inset-right,0px) + 14px);top:calc(env(safe-area-inset-top,0px) + 104px);bottom:auto;transform:none;z-index:34;
        display:none;align-items:center;gap:6px;max-width:min(44vw,320px);padding:5px;border-radius:14px;
        background:rgba(7,15,24,.88);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
        box-shadow:0 10px 28px rgba(0,0,0,.45);font-family:Inter,system-ui,sans-serif;pointer-events:auto;}
      #ph3d-npc-actions.on{display:flex}
      #ph3d-npc-actions button{height:38px;min-height:38px;max-width:160px;padding:0 12px;border-radius:11px;border:1px solid transparent;font:800 10px/1 Inter,system-ui,sans-serif;
        letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;box-sizing:border-box;}
      #ph3d-npc-talk{background:linear-gradient(135deg,#86efac,#4ade80);color:#052e16;}
      #ph3d-npc-action{background:linear-gradient(135deg,#ffd36a,#f59e0b);color:#241400;}
      #ph3d-npc-actions button:active{transform:scale(.96)}
      @media(max-width:600px){#ph3d-npc-actions{right:10px;top:calc(env(safe-area-inset-top,0px) + 94px);max-width:calc(100vw - 20px)}#ph3d-npc-actions button{height:34px;min-height:34px;padding:0 9px;font-size:9px}}
    `;
    document.head.appendChild(style);
  }
  _wrap = document.createElement("div");
  _wrap.id = "ph3d-npc-actions";
  _talk = document.createElement("button"); _talk.id = "ph3d-npc-talk"; _talk.type = "button";
  _action = document.createElement("button"); _action.id = "ph3d-npc-action"; _action.type = "button";
  _wrap.append(_talk, _action);
  document.body.appendChild(_wrap);
  _talk.addEventListener("pointerdown", (e) => {
    e.preventDefault(); e.stopPropagation();
    if (_current) NPCs.talk(_current);
  }, { passive: false });
  _action.addEventListener("pointerdown", (e) => {
    e.preventDefault(); e.stopPropagation();
    if (_current) actOn(_current, _actionKey);
  }, { passive: false });
}

export const NpcTalk = {
  mount(opts) { S = opts || {}; build(); },

  tick(_dt) {
    if (!S || !_wrap) return;
    const p = S.getPos && S.getPos();
    if (!p) { _current = null; _wrap.classList.remove("on"); return; }
    const npc = NPCs.nearest(p.x, p.z, 2.7);
    if (!npc) { _current = null; _wrap.classList.remove("on"); return; }
    _current = npc;
    const role = roleOf(npc);
    _talk.textContent = "TALK · " + roleLabel(npc);
    const cfg = ROLE_ACTIONS[role];
    _actionKey = role;
    if (cfg) {
      _action.textContent = cfg.label;
      _action.style.display = "";
    } else {
      _action.style.display = "none";
    }
    _wrap.classList.add("on");
  },

  isMounted() { return !!_wrap; },

  unmount() {
    if (_wrap && _wrap.parentNode) _wrap.parentNode.removeChild(_wrap);
    _wrap = _talk = _action = null;
    _current = null; _actionKey = ""; S = null;
  },
};
