/* ════════════════════════════════════════════════════════════════
   walk-actions.js — weapons + emotes for the open-world walker.

   Controls (on foot only):
     1 Fists · 2 Knife · 3 Pistol · 4 Sniper     select weapon
     R        holster                             F  attack
     Q        open the Actions menu (weapons, emotes, backflips)
   Touch:
     ACTIONS button (left)  → same menu
     FIRE / STAB / FIGHT button (right) — FIGHT opens the wrestling picker

   WalkActions.mount({ walker, weapons, getMode })
   WalkActions.tick(dt, horizSpeed)
   WalkActions.playEmote(name)
   WalkActions.unmount()
   ════════════════════════════════════════════════════════════════ */

import { HUD } from "../ui/hud.js";
import * as Animator from "../characters/animator.js";
import { NPCs } from "./npcs.js";
import { WrestlingModal } from "../ui/wrestling-modal.js";
import { Pursuit } from "./pursuit.js";

const BASIC_EMOTES = [
  ["wave", "Wave"], ["clap", "Clap"],
  ["flex", "Flex"], ["meditate", "Zen"],
  ["dance", "Dance"],
];

const WEAPONS = [
  ["fists", "Fists", "\uD83D\uDC4A"], ["knife", "Knife", "\uD83D\uDD2A"],
  ["pistol", "Pistol", "\uD83D\uDD2B"], ["sniper", "Sniper", "\uD83C\uDFAF"], ["bazooka", "Bazooka", "\uD83D\uDE80"],
];

let S = null;   // mounted state

function _btnCSS(extra) {
  return "position:fixed;z-index:30;font:900 11px Inter,system-ui,sans-serif;letter-spacing:.14em;" +
    "backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);cursor:pointer;pointer-events:auto;" +
    "touch-action:manipulation;display:none;box-shadow:0 10px 28px rgba(0,0,0,.5);" + extra;
}

function _isTyping(e) {
  const t = e.target;
  return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}

export const WalkActions = {
  mount(opts) {
    if (S) this.unmount();
    S = { ...opts };

    /* ── buttons ── */
    const menu = document.createElement("button");
    menu.id = "ph3d-walk-actions";
    menu.type = "button";
    menu.textContent = "ACTIONS";
    /* HUD (SPEC + hud.css) handles colour, position and size */
    menu.style.cssText = "display:none;cursor:pointer;pointer-events:auto;touch-action:manipulation;";
    document.body.appendChild(menu);

    const atk = document.createElement("button");
    atk.id = "ph3d-walk-attack";
    atk.type = "button";
    /* HUD handles colour/position via SPEC (h-pad h-fight) */
    atk.style.cssText = "display:none;cursor:pointer;pointer-events:auto;touch-action:manipulation;";
    document.body.appendChild(atk);

    const swallow = (e) => { e.preventDefault(); e.stopPropagation(); };
    menu.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openMenu();
    });
    /* Armed: fire instantly on press. Unarmed: a plain TAP (on release)
       opens the wrestling picker, so the finger is already up and nothing
       in the picker needs a press-and-hold. */
    atk.addEventListener("pointerdown", (e) => {
      swallow(e);
      if (S.weapons && S.weapons.isArmed()) {
        this.attack();
        atk.style.transform = "scale(.92)";
        setTimeout(() => { atk.style.transform = ""; }, 120);
      }
    }, { passive: false });
    atk.addEventListener("click", (e) => {
      swallow(e);
      if (S.weapons && S.weapons.isArmed()) return;
      if (this._canAct()) WrestlingModal.toggle({ walker: S.walker, weapons: S.weapons, getMode: S.getMode });
    });

    /* ── keys ── */
    const onKey = (e) => {
      if (_isTyping(e) || e.repeat || !this._canAct()) return;
      const w = S.weapons;
      switch (e.code) {
        case "Digit1": w.select("fists");  break;
        case "Digit2": w.select("knife");  break;
        case "Digit3": w.select("pistol"); break;
        case "Digit4": w.select("sniper"); break;
        case "Digit5": w.select("bazooka"); break;
        case "KeyR":   w.holsterAll();     break;
        case "KeyF":
          if (w.isArmed()) this.attack();
          else WrestlingModal.toggle({ walker: S.walker, weapons: w, getMode: S.getMode });
          break;
        case "KeyQ":   this.openMenu();    break;
      }
    };
    window.addEventListener("keydown", onKey);

    S.menu = menu; S.atk = atk; S.onKey = onKey;
    return this;
  },

  _canAct() {
    return !!S && S.getMode() === "walk" && !S.walker.sitting && !S.walker.ragdoll;
  },

  /* Targets for weapons: every living NPC near the player */
  targets() {
    if (!S) return [];
    return NPCs.targets(S.walker.x, S.walker.z, 80).concat(Pursuit.targets(S.walker.x, S.walker.z, 80));
  },

  attack() {
    if (!this._canAct()) return false;
    const w = S.weapons;
    if (!w.isArmed()) return false;
    /* shooting cancels any emote */
    this.cancelEmote();
    return w.attack(this.targets());
  },

  /* for pursuit.js */
  info() { return S ? { walker: S.walker, mode: S.getMode() } : null; },

  /* the player reacts to being hit by a wrestling move (victim pose from the impact on) */
  react(move) {
    if (!S) return false;
    const wk = S.walker, nm = "vic_" + move, em = Animator.EMOTES[nm];
    if (!em || S.getMode() !== "walk" || wk.sitting || wk.ragdoll) return false;
    wk._emoteName = nm;
    wk._emotePhase = em.dur * 0.5;
    wk._emoteTimer = em.dur * 0.5;
    return true;
  },

  playEmote(name) {
    if (!this._canAct() || !Animator.EMOTES[name]) return false;
    const wk = S.walker;
    if (!wk.onGround) return false;
    wk._emoteName = name;
    wk._emoteTimer = Animator.EMOTES[name].dur;
    wk._emotePhase = 0;
    /* show-off moves draw a crowd that rings you and claps */
    if (Animator.FLIP_EMOTES && Animator.FLIP_EMOTES[name]) {
      try { NPCs.audience(wk.x, wk.z, 22, 6 + Animator.EMOTES[name].dur / 1.4); } catch (e) {}
    }
    return true;
  },

  cancelEmote() {
    if (!S) return;
    const wk = S.walker;
    if (wk._emoteTimer > 0) { wk._emoteTimer = 0; wk._emoteName = null; }
  },

  openMenu() {
    if (!this._canAct()) return;
    const self = this;
    const w = S.weapons;

    const weapon = ([id, label, glyph]) => ({
      glyph, label, active: w.current === id, keep: true,
      onClick: () => {
        if (w.current === id && id !== "fists") self.attack();
        else w.select(id);
      },
    });

    const emote = ([id, label]) => ({
      label, onClick: () => self.playEmote(id),
    });

    const flips = Object.keys(Animator.FLIP_EMOTES || {}).map((id) => {
      const raw = Animator.EMOTES[id].label;
      const nice = raw.charAt(0) + raw.slice(1).toLowerCase();
      return { label: nice, onClick: () => self.playEmote(id) };
    });

    HUD.sheet({
      title: "Actions",
      sub: "1–4 weapons · F attack · R holster · Q menu",
      sections: [
        { label: "Weapons", cols: 3, radio: true, items: WEAPONS.map(weapon) },
        { label: "Emotes", cols: 5, items: BASIC_EMOTES.map(emote) },
        { label: "Backflips", cols: 4, items: flips },
        { label: "Fight moves", cols: 4, items: Object.entries(Animator.WRESTLING_MOVES || {}).filter(([id, m]) => !m.hidden).map(([id, m]) => ({ label: m.label, onClick: () => self.playEmote(id) })) },
      ],
    });
  },

  tick(dt, horizSpeed) {
    if (!S) return;
    const walking = S.getMode() === "walk";
    const can = this._canAct();

    /* fight mode ends when you draw a weapon, get in a car or sit down */
    if (WrestlingModal.isOpen() && (!walking || S.weapons.isArmed() || S.walker.sitting)) WrestlingModal.close();

    /* Never keep a weapon drawn inside a car */
    if (!walking && S.weapons.isArmed()) { try { S.weapons.holsterAll(); } catch (e) {} }

    S.menu.style.display = walking ? "block" : "none";

    const armed = walking;
    S.atk.style.display = armed ? "block" : "none";
    if (armed) {
      const label = S.weapons.isArmed() ? (S.weapons.current === "knife" ? "STAB" : "FIRE") : (WrestlingModal.isOpen() ? "EXIT" : "FIGHT");
      if (S.atk.textContent !== label) S.atk.textContent = label;
    }

    /* Walking away ends a gesture; flips and dances in place are left alone */
    const wk = S.walker;
    if (wk._emoteTimer > 0) {
      const flip = (Animator.FLIP_EMOTES && Animator.FLIP_EMOTES[wk._emoteName]) || String(wk._emoteName || "").startsWith("vic_");
      if (!can || (!flip && horizSpeed > 0.6 && !wk._fightLock)) this.cancelEmote();
    }
  },

  unmount() {
    if (!S) return;
    window.removeEventListener("keydown", S.onKey);
    try { WrestlingModal.close(); } catch (e) {}
    try { S.menu.remove(); } catch (e) {}
    try { S.atk.remove(); } catch (e) {}
    try { HUD.closeSheet(); } catch (e) {}
    S = null;
  },
};

