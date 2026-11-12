/**
 * Combat - HP, damage, downed state.
 *
 * Public API:
 *   Combat.damage(amount, by)  - hurt the player
 *   Combat.heal(amount)        - restore HP
 *   Combat.revive()            - self-revive after downed
 *   Combat.flash(intensity)    - red screen flash
 */

import { Sfx } from "./sfx.js";

/* The shared HUD creates this control in combat-capable scenes. Hold to guard;
   release to lower the guard. Pointer and touch are handled by Pointer Events. */
if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", (e) => {
    if (e.target && e.target.closest && e.target.closest("#ph3d-blk")) {
      e.preventDefault();
      Combat.setGuard(true);
    }
  }, { passive: false });
  const releaseGuard = () => Combat.setGuard(false);
  document.addEventListener("pointerup", releaseGuard);
  document.addEventListener("pointercancel", () => Combat.setGuard(false));
}

export const Combat = {
  hp: 100, maxHp: 100, stamina: 100, maxStamina: 100, downed: false,
  downedAt: 0, reviveWindow: 60000,
  guarding: false, guardUntil: 0, dodgeUntil: 0, guardCostPerHit: 12, dodgeCost: 22,
  weapons: { fists:10, knife:35, cleaver:40, pistol:60 },
  onDamage: null, onDowned: null, onRevive: null,

  damage(amount, by) {
    if (this.downed) return;
    /* Defensive window: a well-timed guard reduces melee damage; dodge avoids
       a hit completely. Both consume stamina and recover naturally. */
    const now = performance.now();
    if (now < this.dodgeUntil && this.stamina >= 0) {
      this.dodgeUntil = 0;
      this.onEvade && this.onEvade(by);
      try { Sfx.play("whoosh", { vol: 0.35 }); } catch (_) {}
      return;
    }
    if (this.guarding && now < this.guardUntil && this.stamina >= this.guardCostPerHit) {
      this.stamina = Math.max(0, this.stamina - this.guardCostPerHit);
      amount = Math.max(1, Math.round(amount * 0.32));
      this.onGuard && this.onGuard(amount, by, this.stamina);
    } else if (this.guarding) {
      this.guarding = false;
    }
    this.hp = Math.max(0, this.hp - amount);
    /* Sound feedback */
    try {
      Sfx.play("punch_impact", { vol: Math.min(0.8, amount / 40) });
      if (this.hp > 0) Sfx.pain(amount >= 30 ? "heavy" : amount >= 12 ? "medium" : "light", { vol: 0.7 });
      else Sfx.pain("death", { vol: 0.95 });
      if (this.hp > 0 && this.hp < 25 && Math.random() < 0.3) setTimeout(() => { try { Sfx.pain("choke", { vol: 0.5 }); } catch (_) {} }, 700);
    } catch (_) {}
    this.onDamage && this.onDamage(this.hp, by);
    if (this.hp <= 0) {
      this.downed = true;
      this.downedAt = performance.now();
      try { Sfx.play("body_fall"); } catch (_) {}
      /* Start the fall animation on the player's avatar */
      try {
        const tp = window.__ph3d_tp;
        if (tp && tp.rig && tp.avatar) {
          window.__ph3d_playerDeath = { tp, phase: 0, dir: Math.random() < 0.5 ? -1 : 1, last: 0 };
        }
      } catch (e) {}
      this.onDowned && this.onDowned(by);
      /* let the fall play before the hospital fade */
      setTimeout(() => window.dispatchEvent(new CustomEvent("ph3d:player-dead")), 1100);
    }
  },

  flash(amount) {
    const fl = document.getElementById("ph3d-dmg-flash");
    if (!fl) return;
    fl.style.opacity = String(Math.min(1, amount));
    setTimeout(() => { fl.style.opacity = "0"; }, 200);
    try {
      const haptics = window.__ph3d_settings && window.__ph3d_settings.get("haptics");
      if (haptics) navigator.vibrate && navigator.vibrate(Math.round(30 + amount * 60));
    } catch (e) {}
  },

  setGuard(active) {
    if (this.downed) return false;
    this.guarding = !!active && this.stamina > 0;
    this.guardUntil = this.guarding ? performance.now() + 1800 : 0;
    return this.guarding;
  },

  dodge() {
    if (this.downed || this.stamina < this.dodgeCost) return false;
    this.stamina = Math.max(0, this.stamina - this.dodgeCost);
    this.guarding = false;
    this.guardUntil = 0;
    this.dodgeUntil = performance.now() + 420;
    this.onDodge && this.onDodge(this.stamina);
    return true;
  },

  update(dt) {
    const delta = Math.max(0, Math.min(0.1, Number(dt) || 0));
    if (this.downed && performance.now() - this.downedAt > this.reviveWindow) this.revive();
    if (!this.guarding && performance.now() >= this.dodgeUntil) {
      this.stamina = Math.min(this.maxStamina, this.stamina + 18 * delta);
    }
    if (this.guarding && performance.now() >= this.guardUntil) this.guarding = false;
  },

  heal(amount) {
    if (this.downed) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.onDamage && this.onDamage(this.hp, "heal");
  },

  revive() {
    this.downed = false;
    this.hp = this.maxHp * 0.5;
    this.onRevive && this.onRevive();
  },

  reset() { this.hp = this.maxHp; this.stamina = this.maxStamina; this.downed = false; this.guarding = false; this.guardUntil = 0; this.dodgeUntil = 0; },
};

