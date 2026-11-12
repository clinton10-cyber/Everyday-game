/**
 * Crime - the alert meter.
 *
 * Public API:
 *   Crime.addEvent(kind, amount, by)  - raises the meter
 *   Crime.decay(dt)                   - lowers over time
 *   Crime.reset()                     - clears everything
 */

export const Crime = {
  alert: 0,
  log: [],
  _decayTimer: 0,
  onAlertChange: null,
  reasons: {
    openDrawer:15, forceDrawer:25, takeItem:30, takeDeed:45,
    attack:50, kill:100, cookStolen:10, hideBody:60,
    hack:45, kidnap:70, escape:20,
  },
  addEvent(kind, amount, by) {
    amount = amount || this.reasons[kind] || 10;
    const entry = { kind, amount: Math.round(amount), by: by || "You", time: Date.now() };
    this.log.unshift(entry);
    if (this.log.length > 50) this.log.length = 50;
    try { window.__ph3d_justice && window.__ph3d_justice.onCrime(entry); } catch (e) {}
    this.alert = Math.min(100, this.alert + amount);
    this.onAlertChange && this.onAlertChange(this.alert, entry);
    if (this.alert >= 100 && window.__ph3d_police) window.__ph3d_police.dispatch(by || "You");
  },
  decay(dt) {
    if (this.alert <= 0) return;

    /* Exponential decay: ~12–17% per second depending on alert level.
       - From 100 → ~60 in 3 s, ~10 in 15 s, 0 in ~25 s.
       - From 45  → ~27 in 3 s, ~5 in 15 s, 0 in ~22 s.
       The -0.5*dt term drains the last 1–2% that pure exponential
       never reaches (avoids the meter looking "stuck"). */
    const before = this.alert;
    const rate = 0.12 + 0.05 * (this.alert / 100);   // 12–17% per s
    this.alert = Math.max(0, this.alert * (1 - rate * dt) - 0.5 * dt);

    if (before !== this.alert) {
      this.onAlertChange && this.onAlertChange(this.alert, null);
    }

    if (before > 0 && this.alert === 0) {
      try { window.__ph3d_phone && window.__ph3d_phone._toast("✅ Alert cleared"); } catch (e) {}
      try { window.__ph3d_police && window.__ph3d_police.cancel(); } catch (e) {}
    }
  },
  reset() { this.alert = 0; this.log = []; this.onAlertChange && this.onAlertChange(0, null); },
};

