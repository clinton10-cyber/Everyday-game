/* ═══════════════════════════════════════════════════════════════
   ATMs — 8 machines scattered around the city.
   Each holds up to ₦1,000,000.
   Player may only withdraw up to their bank balance.
   ~40% are hackable — hacking yields cash but raises crime alert.
   ═══════════════════════════════════════════════════════════════ */
import { Economy } from "./economy.js";
import { Crime } from "./crime.js";
import { Quality } from "./quality.js";

const MAX_CASH = 1000000;

export const ATMs = {
  list: [],
  _subs: new Set(),

  /* Called by the drive scene (or city scene) with world coords. */
  register(worldAtms) {
    this.list = worldAtms.map((a, i) => ({
      id: "atm_" + i,
      x: a.x, z: a.z, place: a.place || "city",
      balance: MAX_CASH,
      hackable: a.hackable !== false ? Math.random() < 0.4 : false,
      hacked: false,
    }));
    console.log("%c[atms]","background:#5ee0ff;color:#04121c;font-weight:bold;padding:2px 6px;border-radius:4px",
      this.list.length + " ATMs · " + this.list.filter(a => a.hackable).length + " hackable");
  },

  /* All ATMs within radius of (x,z). */
  near(x, z, radius = 8) {
    const r2 = radius * radius;
    const out = [];
    for (const a of this.list) {
      const dx = a.x - x, dz = a.z - z;
      if (dx*dx + dz*dz < r2) out.push(a);
    }
    return out;
  },

  /* Withdraw: only up to your bank balance (Economy.balance). */
  withdraw(atmId, amount) {
    const a = this.list.find(x => x.id === atmId);
    if (!a) return { ok:false, reason:"no_atm" };
    amount = Math.floor(Number(amount));
    if (!amount || amount <= 0) return { ok:false, reason:"bad_amount" };
    if (amount > Economy.balance) return { ok:false, reason:"over_balance" };
    if (amount > a.balance) return { ok:false, reason:"atm_empty" };
    Economy.withdraw(amount);   // subtract from bank + record
    a.balance -= amount;
    this._emit();
    return { ok:true, amount, atmLeft:a.balance };
  },

  /* Attempt a hack. Returns { ok, amount, alarm }
     - success chance falls if you've been hacking a lot recently.
     - every attempt increases crime alert, success or fail. */
  hack(atmId, difficulty = 0) {
    const a = this.list.find(x => x.id === atmId);
    if (!a) return { ok:false, reason:"no_atm" };
    if (!a.hackable) return { ok:false, reason:"not_hackable" };
    if (a.hacked) return { ok:false, reason:"already_hacked" };

    const isLowDevice = Quality.isLow;
    const chance = Math.max(0.08, 0.62 - difficulty * 0.6);
    const success = isLowDevice ? true : (Math.random() < chance);
    Crime.addEvent("hack", success ? 45 : 25, "You");

    if (!success) {
      // Alarm triggers police dispatch sometimes
      if (Math.random() < 0.35 && window.__ph3d_police) {
        window.__ph3d_police.dispatch("you");
      }
      this._emit();
      return { ok:false, reason:"failed" };
    }

    const baseTake = isLowDevice ? 800000 + Math.floor(Math.random() * 1200000) : 80000 + Math.floor(Math.random() * 120000);
    const take = Math.min(a.balance, baseTake);
    a.balance -= take;
    a.hacked = true;
    Economy.receive("ATM-HACK", take, "hacked atm");
    if (window.__ph3d_police && Math.random() < 0.5) {
      window.__ph3d_police.dispatch("you");
    }
    this._emit();
    return { ok:true, amount:take, atmLeft:a.balance };
  },

  onChange(fn) { this._subs.add(fn); return () => this._subs.delete(fn); },
  _emit() { for (const fn of this._subs) { try { fn(this); } catch (e) {} } },
};

export const ATM_MAX = MAX_CASH;

