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

export const Combat = {
  hp: 100, maxHp: 100, stamina: 100, maxStamina: 100, downed: false,
  downedAt: 0, reviveWindow: 60000,
  weapons: { fists:10, knife:35, cleaver:40, pistol:60 },
  onDamage: null, onDowned: null, onRevive: null,

  damage(amount, by) {
    if (this.downed) return;
    this.hp = Math.max(0, this.hp - amount);
    /* Sound feedback */
    try {
      Sfx.play("punch_impact", { vol: Math.min(0.8, amount / 40) });
      if (Math.random() < 0.5) Sfx.play("hurt_grunt");
      if (this.hp > 0) Sfx.voice("player_hurt", { pitch: 0.8 });
    } catch (_) {}
    this.onDamage && this.onDamage(this.hp, by);
    if (this.hp <= 0) {
      this.downed = true;
      this.downedAt = performance.now();
      try { Sfx.play("death_rattle"); Sfx.voice("death"); } catch (_) {}
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

  update(dt) {
    if (this.downed && performance.now() - this.downedAt > this.reviveWindow) this.revive();
  },

  reset() { this.hp = this.maxHp; this.stamina = this.maxStamina; this.downed = false; },
};

