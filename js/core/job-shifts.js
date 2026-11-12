/* ============================================================
   JobShifts - a job actually takes time. Pay arrives when done.
   ============================================================ */
import { Economy } from "./economy.js";

const KEY = "ph3d.shift.v1";
const persist = (a) => { try { if (a) localStorage.setItem(KEY, JSON.stringify(a)); else localStorage.removeItem(KEY); } catch (e) {} };

export const JobShifts = {
  active: null,     /* { jobId, name, pay, startedAt, endsAt, durationSec } */
  onTick: null,
  onComplete: null,

  start(job) {
    if (this.active) return { ok: false, reason: "already_working" };
    const now = Date.now();
    /* 15-60 seconds for a shift, scaled by hours */
    const durationSec = Math.max(15, (job.hours || 1) * 12);
    this.active = {
      jobId: job.id,
      name: job.name,
      pay: job.pay,
      startedAt: now,
      endsAt: now + durationSec * 1000,
      durationSec,
    };
    persist(this.active);
    if (window.__ph3d_phone) window.__ph3d_phone._toast("Shift started: " + job.name);
    return { ok: true };
  },

  tick() {
    if (!this.active) return;
    const now = Date.now();
    const remaining = Math.max(0, this.active.endsAt - now);
    this.onTick && this.onTick(this.active, remaining);
    if (remaining <= 0) this._finish();
  },

  _finish() {
    const a = this.active;
    this.active = null;
    persist(null);
    if (!a) return;
    try { Economy.receive("SHIFT", a.pay, a.name); } catch (e) {}
    try { window.__ph3d_engagement && window.__ph3d_engagement.track("job_done", { name: a.name }); window.__ph3d_engagement && window.__ph3d_engagement.track("money_earned", { amount: a.pay, source: "shift" }); } catch (e) {}
    if (window.__ph3d_phone) window.__ph3d_phone._toast("Shift done: +" + a.pay.toLocaleString());
    this.onComplete && this.onComplete(a);
  },

  cancel() {
    if (!this.active) return false;
    this.active = null; persist(null);
    if (window.__ph3d_phone) window.__ph3d_phone._toast("Shift cancelled");
    return true;
  },

  remaining() {
    if (!this.active) return 0;
    return Math.max(0, Math.ceil((this.active.endsAt - Date.now()) / 1000));
  },
};


/* The shift clock must run by itself — nothing else ever called tick(), so pay never arrived.
   It also survives a reload / closing the app: an unfinished shift is restored and paid when due. */
try {
  const j = localStorage.getItem(KEY);
  if (j) { const a = JSON.parse(j); if (a && a.endsAt && a.pay != null) JobShifts.active = a; }
} catch (e) {}
setInterval(() => { try { JobShifts.tick(); } catch (e) {} }, 1000);
