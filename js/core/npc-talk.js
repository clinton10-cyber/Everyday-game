/* js/core/npc-talk.js
   Mounts the TALK button and the per-frame proximity scan onto any
   ThirdPersonControls-based interior scene.

   Usage:
     NpcTalk.mount({ getPos, getYaw });
     NpcTalk.tick(dt);          // call from scene.update
     NpcTalk.unmount();         // call from scene.dispose
*/

import { NPCs } from "./npcs.js";

let S       = null;   // { getPos, getYaw }
let _btn    = null;   // HTMLButtonElement
let _current = null;  // nearest NPC within range

function buildButton() {
  if (_btn && document.body.contains(_btn)) return _btn;
  _btn = document.createElement("button");
  _btn.id = "ph3d-interior-talk";
  _btn.textContent = "TALK";
  _btn.style.cssText =
  "position:fixed;left:50%;transform:translateX(-50%);" +
  "bottom:calc(env(safe-area-inset-bottom) + 92px);" +
  "z-index:31;padding:10px 20px;border-radius:999px;" +
  "background:linear-gradient(135deg,#86efac,#4ade80);" +
  "border:none;color:#052e16;" +
  "font:900 11px Inter,system-ui,sans-serif;letter-spacing:.14em;" +
  "cursor:pointer;pointer-events:auto;touch-action:manipulation;" +
  "display:none;box-shadow:0 8px 22px rgba(0,0,0,.5)";
  _btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (_current) NPCs.talk(_current);
  }, { passive: false });
  document.body.appendChild(_btn);
  return _btn;
}

export const NpcTalk = {

  /* Call once after the scene and NPCs are set up.
     opts.getPos() must return { x, z } in world space. */
  mount(opts) {
    S = opts || {};
    buildButton();
  },

  /* Call every frame from scene.update(dt). */
  tick(_dt) {
    if (!S || !_btn) return;
    const p = S.getPos && S.getPos();
    if (!p) { _btn.style.display = "none"; return; }

    const npc = NPCs.nearest(p.x, p.z, 2.5);
    if (npc) {
      _current = npc;
      const label = (
        npc.groupLabel ||
        (npc.roleDef && npc.roleDef.label) ||
        "Pedestrian"
      ).toUpperCase();
      _btn.textContent = "TALK · " + label;
      _btn.style.display = "block";
    } else {
      _current = null;
      _btn.style.display = "none";
    }
  },

  /* Call from scene.dispose() to remove the button and clean up state. */
  unmount() {
    if (_btn && _btn.parentNode) _btn.parentNode.removeChild(_btn);
    _btn = null;
    _current = null;
    S = null;
  },
};

