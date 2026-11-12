/*
 * Career progression for Everyday in PH.
 * Careers are separate from the rotating gig-job board: players apply,
 * prepare a CV, train, interview, complete paid shifts and earn promotions.
 * All values are fictional in-game currency.
 */
import { Auth } from "./auth.js";
import { Economy } from "./economy.js";
import { Profile } from "./profile.js";

export const CAREER_CATALOG = [
  { id:"corporate", name:"Corporate Office", field:"Private sector", icon:"🏢", minRep:10, fee:2500, base:14500, recordOK:true, ranks:["Intern","Associate","Executive","Manager","Director"], desc:"Build experience in a Port Harcourt company." },
  { id:"teacher", name:"Teaching Service", field:"Education", icon:"📚", minRep:20, fee:3000, base:12000, recordOK:true, ranks:["Teaching Assistant","Class Teacher","Senior Teacher","Vice Principal","Principal"], desc:"Teach, mentor students and progress through school leadership." },
  { id:"civil", name:"Civil Service", field:"Government", icon:"🏛️", minRep:30, fee:4000, base:15500, recordOK:false, ranks:["Admin Assistant","Administrative Officer","Senior Officer","Director","Permanent Secretary"], desc:"Serve in public administration and government offices." },
  { id:"police", name:"Police Service", field:"Public safety", icon:"🚓", minRep:35, fee:4500, base:16500, recordOK:false, ranks:["Police Recruit","Constable","Sergeant","Inspector","Chief Inspector"], desc:"Protect residents and uphold the law." },
  { id:"military", name:"Military Service", field:"Defence", icon:"🪖", minRep:45, fee:5000, base:18000, recordOK:false, ranks:["Recruit","Corporal","Sergeant","Lieutenant","Captain"], desc:"Join a disciplined defence career." },
  { id:"banking", name:"Banking & Finance", field:"Financial services", icon:"🏦", minRep:45, fee:5000, base:18500, recordOK:false, ranks:["Teller","Banking Officer","Senior Officer","Branch Manager","Regional Manager"], desc:"Work with customers, accounts and financial services." },
  { id:"engineering", name:"Engineering", field:"Technology & infrastructure", icon:"⚙️", minRep:40, fee:5000, base:20500, recordOK:true, ranks:["Graduate Trainee","Junior Engineer","Engineer","Project Lead","Chief Engineer"], desc:"Help design, build and maintain infrastructure." },
  { id:"medical", name:"Healthcare Service", field:"Health", icon:"🩺", minRep:50, fee:6000, base:22000, recordOK:false, ranks:["Health Assistant","Clinical Officer","Senior Clinician","Unit Manager","Hospital Director"], desc:"Support patients and healthcare teams." },
];

const SHIFT_MS = 60 * 1000;
const PROMOTION_SHIFTS = [3, 7, 12, 20];
const DEFAULT_STATE = () => ({
  cvLevel: 0,
  trainingLevel: 0,
  application: null,
  active: null,
  lastInterview: null,
  careerHistory: [],
  totalPensionPaid: 0,
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function getTrack(id) { return CAREER_CATALOG.find(c => c.id === id) || null; }

export const Career = {
  shiftDuration: SHIFT_MS,

  _state() {
    if (!Auth.user) return DEFAULT_STATE();
    const current = Auth.user.careerProfile;
    if (!current || typeof current !== "object") {
      Auth.user.careerProfile = DEFAULT_STATE();
    }
    const s = Auth.user.careerProfile;
    if (!Array.isArray(s.careerHistory)) s.careerHistory = [];
    if (!Number.isFinite(s.cvLevel)) s.cvLevel = 0;
    if (!Number.isFinite(s.trainingLevel)) s.trainingLevel = 0;
    if (!Number.isFinite(s.totalPensionPaid)) s.totalPensionPaid = 0;
    return s;
  },

  async _save(state) {
    if (!Auth.user) return false;
    await Auth.save({ careerProfile: clone(state) });
    return true;
  },

  snapshot() {
    const s = clone(this._state());
    const track = s.active ? getTrack(s.active.trackId) : null;
    const appTrack = s.application ? getTrack(s.application.trackId) : null;
    return {
      ...s,
      balance: Economy.balance,
      reputation: Profile.reputation(),
      hasRecord: Profile.isCriminal(),
      catalog: CAREER_CATALOG,
      activeTrack: track,
      applicationTrack: appTrack,
      shiftRemaining: s.active && s.active.shiftStartedAt
        ? Math.max(0, SHIFT_MS - (Date.now() - s.active.shiftStartedAt)) : null,
      canRetire: !!(s.active && s.active.shifts >= 30 && !s.active.shiftStartedAt),
    };
  },

  async prepareCV() {
    const s = clone(this._state());
    if (s.cvLevel >= 3) return { ok:false, reason:"max_cv" };
    const cost = [2500, 6000, 12000][s.cvLevel];
    if (!Economy.withdraw(cost)) return { ok:false, reason:"funds", cost };
    s.cvLevel++;
    await this._save(s);
    return { ok:true, level:s.cvLevel, cost };
  },

  async train() {
    const s = clone(this._state());
    if (s.trainingLevel >= 3) return { ok:false, reason:"max_training" };
    const cost = [12000, 22000, 35000][s.trainingLevel];
    if (!Economy.withdraw(cost)) return { ok:false, reason:"funds", cost };
    s.trainingLevel++;
    await this._save(s);
    return { ok:true, level:s.trainingLevel, cost };
  },

  async apply(trackId) {
    const track = getTrack(trackId);
    if (!track) return { ok:false, reason:"invalid" };
    const s = clone(this._state());
    if (s.active) return { ok:false, reason:"employed" };
    if (s.application) return { ok:false, reason:"pending" };
    if (Profile.reputation() < track.minRep) return { ok:false, reason:"reputation", required:track.minRep };
    if (!track.recordOK && Profile.isCriminal()) return { ok:false, reason:"record" };
    if (!Economy.withdraw(track.fee)) return { ok:false, reason:"funds", cost:track.fee };
    s.application = { trackId, appliedAt:Date.now(), fee:track.fee };
    s.lastInterview = null;
    await this._save(s);
    return { ok:true, track };
  },

  async interview() {
    const s = clone(this._state());
    if (!s.application) return { ok:false, reason:"no_application" };
    const track = getTrack(s.application.trackId);
    if (!track) { s.application = null; await this._save(s); return { ok:false, reason:"invalid" }; }
    const score = Math.min(100, Math.round(20 + Profile.reputation() * 0.25 + s.cvLevel * 9 + s.trainingLevel * 10 + Math.random() * 18 - (Profile.isCriminal() ? 12 : 0)));
    const accepted = score >= 52;
    s.lastInterview = { trackId:track.id, score, accepted, at:Date.now() };
    s.application = null;
    if (accepted) {
      s.active = {
        trackId:track.id,
        rankIndex:0,
        shifts:0,
        xp:0,
        salary:track.base,
        startedAt:Date.now(),
        shiftStartedAt:null,
        lifetimeEarned:0,
        pension:0,
        promotions:0,
      };
    }
    await this._save(s);
    return { ok:true, accepted, score, track };
  },

  async startShift() {
    const s = clone(this._state());
    if (!s.active) return { ok:false, reason:"not_employed" };
    if (s.active.shiftStartedAt) return { ok:false, reason:"already_working" };
    s.active.shiftStartedAt = Date.now();
    await this._save(s);
    return { ok:true, duration:SHIFT_MS };
  },

  async finishShift() {
    const s = clone(this._state());
    if (!s.active || !s.active.shiftStartedAt) return { ok:false, reason:"no_shift" };
    const elapsed = Date.now() - s.active.shiftStartedAt;
    if (elapsed < SHIFT_MS) return { ok:false, reason:"not_finished", remaining:SHIFT_MS-elapsed };
    const track = getTrack(s.active.trackId);
    const pay = Math.round(s.active.salary);
    s.active.shiftStartedAt = null;
    s.active.shifts++;
    s.active.xp += 25;
    s.active.lifetimeEarned += pay;
    s.active.pension += Math.round(pay * 0.05);
    let promoted = false;
    const nextThreshold = PROMOTION_SHIFTS[s.active.rankIndex];
    if (nextThreshold && s.active.shifts >= nextThreshold && s.active.rankIndex < track.ranks.length - 1) {
      s.active.rankIndex++;
      s.active.promotions++;
      s.active.salary = Math.round(s.active.salary * 1.15);
      promoted = true;
    }
    await this._save(s);
    Economy.receive(track.name + " payroll", pay, track.ranks[s.active.rankIndex] + " shift salary");
    return { ok:true, pay, promoted, rank:track.ranks[s.active.rankIndex], pension:s.active.pension, shifts:s.active.shifts };
  },

  async retire() {
    const s = clone(this._state());
    if (!s.active) return { ok:false, reason:"not_employed" };
    if (s.active.shifts < 30) return { ok:false, reason:"not_eligible", required:30-s.active.shifts };
    if (s.active.shiftStartedAt) return { ok:false, reason:"working" };
    const track = getTrack(s.active.trackId);
    const payout = Math.max(0, Math.floor(s.active.pension));
    s.careerHistory.unshift({
      trackId:s.active.trackId,
      title:track ? track.name : s.active.trackId,
      finalRank:track ? track.ranks[s.active.rankIndex] : "Retired",
      shifts:s.active.shifts,
      lifetimeEarned:s.active.lifetimeEarned,
      pensionPaid:payout,
      retiredAt:Date.now(),
    });
    s.totalPensionPaid += payout;
    s.active = null;
    await this._save(s);
    if (payout) Economy.receive("Career pension", payout, "Retirement pension");
    return { ok:true, payout };
  },
};
