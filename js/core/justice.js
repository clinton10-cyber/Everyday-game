import { Economy } from "./economy.js";
import { Prison } from "./prison.js";

const KEY = "ph3d.justice.v1";
const clone = value => JSON.parse(JSON.stringify(value));
const defaults = () => ({
  cases: [], activeCaseId: null, lawyerRetained: false, defenseLevel: 0,
  hearings: 0, convictions: 0, acquittals: 0, finesPaid: 0,
  prisonWorkCount: 0, lastPrisonWorkAt: 0, communityService: 0,
});
function load() {
  try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || "{}")); }
  catch (_) { return defaults(); }
}

export const Justice = {
  state: load(),
  charges: {
    openDrawer: { label: "Unlawful entry", severity: 1 }, forceDrawer: { label: "Breaking and entering", severity: 2 },
    takeItem: { label: "Theft", severity: 2 }, takeDeed: { label: "Property document theft", severity: 3 },
    attack: { label: "Assault / public disturbance", severity: 3 }, kill: { label: "Serious violent offence", severity: 5 },
    cookStolen: { label: "Handling stolen goods", severity: 1 }, hideBody: { label: "Concealment of evidence", severity: 5 },
    hack: { label: "Unauthorised system access", severity: 3 }, kidnap: { label: "Kidnapping", severity: 5 },
    escape: { label: "Obstruction / evasion", severity: 2 }, contract: { label: "Criminal contract activity", severity: 2 },
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (_) {} },
  _active() { return this.state.cases.find(c => c.id === this.state.activeCaseId && !["closed", "acquitted"].includes(c.status)) || null; },
  onCrime(entry) {
    if (!entry) return;
    const now = Date.now();
    let c = this._active();
    if (!c || now - c.updatedAt > 30 * 60 * 1000) {
      c = { id: "CASE-" + now.toString(36).toUpperCase(), status: "investigating", openedAt: now, updatedAt: now,
        charges: [], severity: 0, arrested: false, lawyer: false, defense: 0, fine: 0, outcome: "" };
      this.state.cases.unshift(c); this.state.activeCaseId = c.id;
    }
    const spec = this.charges[entry.kind] || { label: "Unspecified offence", severity: 1 };
    c.charges.push({ kind: entry.kind, label: spec.label, severity: spec.severity, at: entry.time || now, alert: entry.amount || 0 });
    c.severity = Math.min(10, c.severity + spec.severity);
    c.updatedAt = now;
    this.save();
  },
  onArrest(reason) {
    let c = this._active();
    if (!c) {
      c = { id: "CASE-" + Date.now().toString(36).toUpperCase(), status: "investigating", openedAt: Date.now(), updatedAt: Date.now(), charges: [], severity: 1, arrested: false, lawyer: false, defense: 0, fine: 0, outcome: "" };
      this.state.cases.unshift(c); this.state.activeCaseId = c.id;
    }
    c.arrested = true; c.arrestReason = reason || "Police arrest"; c.status = "awaiting_court"; c.updatedAt = Date.now();
    this.save();
    return clone(c);
  },
  retainLawyer() {
    const c = this._active();
    if (!c || !["investigating", "awaiting_court"].includes(c.status)) return { ok:false, reason:"no_case" };
    if (c.lawyer) return { ok:false, reason:"retained" };
    const fee = 125000;
    if (Economy.balance < fee) return { ok:false, reason:"funds" };
    Economy.withdraw(fee); c.lawyer = true; c.defense = Math.min(100, c.defense + 25); this.state.lawyerRetained = true; this.save();
    return { ok:true, fee };
  },
  prepareDefense() {
    const c = this._active();
    if (!c || !["investigating", "awaiting_court"].includes(c.status)) return { ok:false, reason:"no_case" };
    if (c.defense >= 60) return { ok:false, reason:"prepared" };
    const fee = 30000;
    if (Economy.balance < fee) return { ok:false, reason:"funds" };
    Economy.withdraw(fee); c.defense = Math.min(60, c.defense + 20); c.updatedAt = Date.now(); this.save();
    return { ok:true, defense:c.defense };
  },
  requestTrial() {
    const c = this._active();
    if (!c || c.status !== "awaiting_court") return { ok:false, reason:"no_trial" };
    const fee = 25000;
    if (Economy.balance < fee) return { ok:false, reason:"funds" };
    Economy.withdraw(fee);
    const rep = Math.max(0, Math.min(100, Number(window.__ph3d_profile?.reputation?.() ?? 50)));
    const score = Math.max(5, Math.min(95, 28 + c.defense + (c.lawyer ? 18 : 0) + Math.round(rep * .12) - c.severity * 5 + Math.floor(Math.random() * 21)));
    this.state.hearings++;
    c.updatedAt = Date.now(); c.trialScore = score;
    if (score >= 65) {
      c.status = "acquitted"; c.outcome = "Charges dismissed"; this.state.acquittals++;
      if (Prison.inJail) Prison.release();
      this.state.activeCaseId = null;
    } else if (score >= 45) {
      c.status = "closed"; c.outcome = "Conviction reduced; fine imposed";
      c.fine = Math.min(150000, 15000 + c.severity * 12000);
      this.state.convictions++;
      try { window.__ph3d_profile?.addCrime("Court conviction"); } catch (_) {}
    } else {
      c.status = "closed"; c.outcome = "Convicted"; c.fine = Math.min(300000, 30000 + c.severity * 22000);
      this.state.convictions++;
      try { window.__ph3d_profile?.addCrime("Court conviction"); } catch (_) {}
      if (!Prison.inJail) Prison.sentence("COURT CONVICTION");
    }
    this.save();
    return { ok:true, score, outcome:c.outcome, fine:c.fine, status:c.status };
  },
  payFine() {
    const c = this.state.cases.find(x => x.fine > 0 && x.finePaid !== true);
    if (!c) return { ok:false, reason:"no_fine" };
    if (Economy.balance < c.fine) return { ok:false, reason:"funds" };
    Economy.withdraw(c.fine); this.state.finesPaid += c.fine; c.finePaid = true; c.updatedAt = Date.now(); this.save();
    return { ok:true, amount:c.fine };
  },
  payBail() { const result = Prison.payBail(); if (result.ok) { const c = this._active(); if (c) { c.status = "awaiting_court"; c.updatedAt = Date.now(); } this.save(); } return result; },
  prisonWork() {
    if (!Prison.inJail) return { ok:false, reason:"not_jailed" };
    const now = Date.now();
    if (now - this.state.lastPrisonWorkAt < 30000) return { ok:false, reason:"cooldown" };
    this.state.lastPrisonWorkAt = now; this.state.prisonWorkCount++;
    const reward = 1200;
    Economy.receive("PRISON WORKSHOP", reward, "In-game prison workshop allowance");
    this.save(); return { ok:true, reward };
  },
  communityService() {
    if (Prison.inJail) return { ok:false, reason:"jailed" };
    const c = this.state.cases.find(x => x.fine > 0 && !x.finePaid && x.status === "closed");
    if (!c) return { ok:false, reason:"unavailable" };
    if (this.state.communityService >= 3) return { ok:false, reason:"complete" };
    this.state.communityService++;
    if (this.state.communityService >= 3) {
      c.finePaid = true;
      c.outcome += " · Community service completed";
      this.state.communityService = 0;
    }
    this.save(); return { ok:true, remaining:this.state.communityService === 0 ? 0 : 3-this.state.communityService };
  },
  snapshot() {
    const active = this._active();
    const unpaidFine = this.state.cases.find(c => c.fine > 0 && !c.finePaid);
    return { balance:Economy.balance, active:active ? clone(active) : null, cases:clone(this.state.cases.slice(0,10)),
      convictions:this.state.convictions, acquittals:this.state.acquittals, hearings:this.state.hearings,
      unpaidFine:unpaidFine ? { amount:unpaidFine.fine, outcome:unpaidFine.outcome } : null,
      jailed:!!Prison.inJail, jailTime:Math.max(0,Math.ceil(Prison.timeLeft||0)), bail:Prison.bailCost(),
      lawyerAvailable:!!active && !active.lawyer && ["investigating","awaiting_court"].includes(active.status),
      defenseAvailable:!!active && active.defense < 60 && ["investigating","awaiting_court"].includes(active.status),
      canTrial:!!active && active.status === "awaiting_court" };
  }
};
