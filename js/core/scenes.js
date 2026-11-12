/* js/core/scenes.js -- helpers over SCENE_PURPOSES + the router.
   Features jump scenes through Scenes.send so the prison lock in Router.go always applies. */
import { SCENE_PURPOSES } from "../data/scene-purposes.js";

/* ids registered directly on the router; everything else is a place id and goes through "interior" */
const DIRECT = new Set(["city", "drive", "walk", "travel", "minimap", "showroom", "pleasurepark", "range",
  "prisonScene", "airplane", "governorScene", "governorInterior", "zonewalk", "zonedrive"]);

const get = (id) => SCENE_PURPOSES[id] || Object.assign({ id }, SCENE_PURPOSES.__default);
const safe = (fn) => { try { return !!fn(); } catch (e) { return false; } };

export const Scenes = {
  purposeOf(id) { return get(id); },
  linksFrom(id) { return (get(id).links || []).filter((l) => !l.condition || safe(l.condition)); },
  servicesOf(id) { return get(id).services || []; },
  hasService(id, s) { return this.servicesOf(id).includes(s); },

  /* Returns a promise for the new scene, or null when the move is refused. */
  async send(fromId, toId, via) {
    const r = window.__ph3d_router;
    if (!r) return null;
    const link = this.linksFrom(fromId).find((l) => l.to === toId && (!via || l.via === via));
    if (!link) return null;
    const cost = link.cost || 0;
    const E = window.__ph3d_economy;
    if (cost > 0) {
      if (!E || E.balance < cost) { try { window.__ph3d_phone?._toast?.("Not enough money for the ride"); } catch (e) {} return null; }
    }
    const jailed = !!(window.__ph3d_prison && window.__ph3d_prison.inJail);
    if (jailed) return null;
    if (cost > 0) { try { E.withdraw(cost); } catch (e) {} }
    try {
      return await (DIRECT.has(toId) ? r.go(toId, {}) : r.go("interior", { id: toId }));
    } catch (e) { return null; }
  },
};
window.__ph3d_scenes = Scenes;
