/* Hooks WorldObjects into PlayerActions so pickups and uses play
   the bend + gesture animations instead of teleporting items. */

import { PlayerActions } from "./player-actions.js";

export const WorldObjectsActions = {
  init() {
    const W = window.__ph3d_world_objects;
    if (!W) { setTimeout(() => this.init(), 500); return; }

    /* Wrap the two entry points */
    const origPickup = W.pickup.bind(W);
    const origUse    = W.use.bind(W);

    W.pickup = function (item, holder) {
      if (!item || item.taken) return false;
      if (holder && holder === window.__ph3d_player) {
        /* If the animation is already playing, this is the onDone re-entry:
           execute the real pickup instead of restarting the animation.
           Without this guard, the loop is: anim ends → onDone → W.pickup →
           !isBusy() → new anim → onDone → W.pickup → … forever. */
        if (PlayerActions.isBusy()) return origPickup(item, holder);
        return PlayerActions.pickup(holder, item);
      }
      return origPickup(item, holder);
    };

    W.use = function (item, holder) {
      if (!item) return;
      if (holder && holder === window.__ph3d_player) {
        const t = item.type;
        if (["food","junkfood","water","phone","book","bat","bottle","cigarettes","dumbbell","spray_can"].indexOf(t) >= 0) {
          /* Same re-entry guard for use animations. */
          if (PlayerActions.isBusy()) return origUse(item, holder);
          return PlayerActions.use(holder, item);
        }
      }
      return origUse(item, holder);
    };

    console.log("[world-objects] pickup + use animated");
  },
};
window.__ph3d_worldObjectsActions = WorldObjectsActions;

