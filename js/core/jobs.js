/* ============================================================
   Jobs - work availability board.
   - Jobs appear on a rotation timer
   - Some jobs are blocked by criminal record
   - Pay rate scales with reputation
   ============================================================ */
import { Profile } from "./profile.js";
import { Economy } from "./economy.js";
import { JobShifts } from "./job-shifts.js";

export const JOB_POOL = [
  { id:"delivery",   name:"DELIVERY RIDER",   pay:4500,  hours:2, minRep:0,   criminal:false, icon:"\uD83D\uDCE6" },
  { id:"cook",       name:"LINE COOK",        pay:3800,  hours:3, minRep:0,   criminal:false, icon:"\uD83D\uDC68\u200D\uD83C\uDF73" },
  { id:"cleaner",    name:"OFFICE CLEANER",   pay:2200,  hours:2, minRep:0,   criminal:false, icon:"\uD83E\uDDF9" },
  { id:"driver",     name:"TAXI DRIVER",      pay:5600,  hours:4, minRep:0,   criminal:false, icon:"\uD83D\uDE95" },
  { id:"guard",      name:"SECURITY GUARD",   pay:4200,  hours:3, minRep:30,  criminal:false, icon:"\uD83D\uDC6E" },
  { id:"mechanic",   name:"MECHANIC",         pay:6800,  hours:4, minRep:40,  criminal:false, icon:"\uD83D\uDD27" },
  { id:"trader",     name:"MARKET TRADER",    pay:7200,  hours:5, minRep:50,  criminal:false, icon:"\uD83D\uDED2" },
  { id:"cashier",    name:"BANK CASHIER",     pay:8200,  hours:4, minRep:70,  criminal:true,  icon:"\uD83C\uDFE6" },
  { id:"guardwork",  name:"ARMORED CAR CREW", pay:9800,  hours:5, minRep:85,  criminal:true,  icon:"\uD83D\uDE9B" },
  { id:"courier",    name:"PRIVATE COURIER",  pay:12000, hours:4, minRep:100, criminal:true,  icon:"\uD83D\uDCB0" },
];

const ROTATE_MS = 45000;

export const Jobs = {
  available: [],
  _lastRotate: 0,
  _onChange: null,

  refresh() {
    const rep = Profile.reputation();
    const hasRecord = Profile.isCriminal();
    const pool = JOB_POOL.filter(j => {
      if (j.minRep > rep) return false;
      if (j.criminal && hasRecord) return false;
      return true;
    });
    /* shuffle and take 4-5 */
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    const n = Math.min(shuffled.length, 4 + Math.floor(Math.random() * 2));
    this.available = shuffled.slice(0, n).map(j => ({
      ...j,
      postedAt: Date.now(),
      expiresAt: Date.now() + ROTATE_MS,
    }));
    this._onChange && this._onChange();
  },

  tick() {
    const now = Date.now();
    /* drop expired */
    this.available = this.available.filter(j => j.expiresAt > now);
    /* rotate if empty or stale */
    if (now - this._lastRotate > ROTATE_MS || this.available.length === 0) {
      this._lastRotate = now;
      this.refresh();
    }
  },

  async take(jobId) {
    const job = this.available.find(j => j.id === jobId);
    if (!job) return { ok:false, reason:"gone" };

    /* Can't take a new job while working */
    if (JobShifts.active) return { ok:false, reason:"already_working" };

    /* remove from board */
    this.available = this.available.filter(j => j.id !== jobId);

    /* start the shift timer */
    const res = JobShifts.start(job);
    if (!res.ok) return res;

    /* record on profile */
    await Profile.setJob(job);

    this._onChange && this._onChange();
    return { ok:true, job };
  },

  onChange(fn) { this._onChange = fn; },
};

