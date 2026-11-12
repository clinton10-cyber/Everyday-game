import { Career } from "../core/career.js";
const ROOT = "ph3d-career-panel";
const money = n => "₦" + Math.floor(n || 0).toLocaleString("en-NG");
const esc = s => String(s || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

export const CareerPanel = {
  _timer:null,
  ensure() {
    if (document.getElementById(ROOT)) return;
    const style = document.createElement("style");
    style.id = ROOT + "-css";
    style.textContent = `
      #${ROOT}{height:100%;overflow:auto;box-sizing:border-box;padding:10px 12px 30px;color:#edf4ff;font-family:inherit}
      #${ROOT} .hero{padding:15px;border-radius:16px;background:linear-gradient(135deg,#122b3b,#25305a);border:1px solid #456b88;margin:8px 0 13px}
      #${ROOT} .hero b{font-size:14px;letter-spacing:.12em;color:#8de8ff}#${ROOT} p,#${ROOT} .meta{font-size:10px;color:#aebbd2;line-height:1.55}
      #${ROOT} .stats{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}#${ROOT} .stat{background:#101a2a;border-radius:9px;padding:8px}#${ROOT} .stat b{display:block;color:#8be8ce;font-size:13px}#${ROOT} .stat small{font-size:8px;color:#9aa9c2}
      #${ROOT} .section{font-size:10px;letter-spacing:.15em;color:#8de8ff;font-weight:900;margin:17px 2px 8px}#${ROOT} .card{padding:12px;margin:8px 0;border-radius:14px;background:#121c2c;border:1px solid #2d3b55}
      #${ROOT} .title{font-weight:900;font-size:12px}#${ROOT} .actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:9px}#${ROOT} button{border:0;border-radius:9px;padding:10px 6px;background:#293d57;color:#f0f7ff;font-size:9px;font-weight:900;letter-spacing:.04em}#${ROOT} button.primary{background:#8de8ff;color:#071725}#${ROOT} button:disabled{opacity:.35}#${ROOT} .tag{display:inline-block;padding:4px 7px;border-radius:20px;background:#1e3b4c;color:#9beaff;font-size:8px;font-weight:900;margin:5px 4px 0 0}#${ROOT} .empty{padding:14px;text-align:center;border:1px dashed #43506c;border-radius:12px;color:#aebbd2;font-size:10px}
    `;
    document.head.appendChild(style);
    const app = document.getElementById("app-career");
    if (!app) return;
    app.innerHTML = `<button class="tbk" data-back><i class="fa-solid fa-chevron-left"></i> Home</button><div id="${ROOT}"></div>`;
    app.querySelector("[data-back]").onclick = () => window.__ph3d_phone?.showApp("home");
  },
  render() {
    this.ensure();
    const root = document.getElementById(ROOT);
    if (!root) return;
    const s = Career.snapshot();
    let html = `<div class="hero"><b>CAREER & PROFESSIONAL LIFE</b><p>Build a CV, train, apply for a profession, pass an interview and earn promotions. Career shifts take 60 seconds of real time. All payments are fictional in-game money.</p><div class="stats"><div class="stat"><b>${money(s.balance)}</b><small>AVAILABLE BALANCE</small></div><div class="stat"><b>${s.reputation}/100</b><small>REPUTATION</small></div><div class="stat"><b>${s.cvLevel}/3</b><small>CV QUALITY</small></div><div class="stat"><b>${s.trainingLevel}/3</b><small>TRAINING LEVEL</small></div></div></div>`;
    html += `<div class="section">CAREER PREPARATION</div><div class="card"><div class="title">Your professional profile</div><div class="meta">A stronger CV and practical training improve your interview score. Training and CV upgrades are optional but recommended.</div><div class="actions"><button data-act="cv" ${s.cvLevel>=3?'disabled':''}>IMPROVE CV · ${money([2500,6000,12000][s.cvLevel]||0)}</button><button data-act="train" ${s.trainingLevel>=3?'disabled':''}>PROFESSIONAL TRAINING · ${money([12000,22000,35000][s.trainingLevel]||0)}</button></div></div>`;
    if (s.applicationTrack) {
      html += `<div class="section">INTERVIEW INVITATION</div><div class="card"><div class="title">${esc(s.applicationTrack.name)}</div><div class="meta">Your application has been submitted. Attend the interview to receive your result.</div><button class="primary" data-act="interview">ATTEND INTERVIEW</button></div>`;
    }
    if (s.activeTrack && s.active) {
      const rank = s.activeTrack.ranks[s.active.rankIndex] || s.activeTrack.ranks[0];
      const working = !!s.active.shiftStartedAt;
      const remaining = Math.ceil((s.shiftRemaining || 0)/1000);
      html += `<div class="section">CURRENT EMPLOYMENT</div><div class="card"><div class="title">${esc(s.activeTrack.name)} <span style="float:right;color:#9ce8cf">${esc(rank)}</span></div><div class="meta">${esc(s.activeTrack.field)} · ${s.active.shifts} completed shifts · ${s.active.promotions} promotions<br>Salary per shift: ${money(s.active.salary)} · Pension saved: ${money(s.active.pension)}<br>Lifetime earnings: ${money(s.active.lifetimeEarned)}</div><div class="actions">${working?`<button class="primary" data-act="finish">${remaining>0?'SHIFT IN PROGRESS · '+remaining+'s':'COLLECT SHIFT SALARY'}</button>`:`<button class="primary" data-act="start">CLOCK IN · 60 SECOND SHIFT</button>`}<button data-act="retire" ${s.canRetire?'':'disabled'}>RETIRE & CLAIM PENSION</button></div><div class="meta">Promotion milestones: 3, 7, 12 and 20 completed shifts. Retirement eligibility begins after 30 shifts.</div></div>`;
    } else if (!s.applicationTrack) {
      html += `<div class="section">AVAILABLE CAREER PATHS</div>`;
      s.catalog.forEach(t => {
        const repOK = s.reputation >= t.minRep;
        const recordOK = t.recordOK || !s.hasRecord;
        const disabled = !repOK || !recordOK || s.active || s.application;
        html += `<div class="card"><div class="title">${t.icon} ${esc(t.name)} <span style="float:right;color:#8de8ff">${money(t.base)}/shift</span></div><div class="meta">${esc(t.field)} · Minimum reputation ${t.minRep}<br>${esc(t.desc)}<br>Starting rank: ${esc(t.ranks[0])} · Application fee ${money(t.fee)}</div>${!repOK?'<span class="tag">MORE REPUTATION NEEDED</span>':''}${!recordOK?'<span class="tag">CLEAN RECORD REQUIRED</span>':''}<button class="primary" data-act="apply" data-id="${t.id}" ${disabled?'disabled':''}>APPLY FOR CAREER</button></div>`;
      });
    }
    if (s.lastInterview) {
      html += `<div class="section">LAST INTERVIEW</div><div class="card"><div class="title">${s.lastInterview.accepted?'APPLICATION SUCCESSFUL':'APPLICATION NOT SUCCESSFUL'}</div><div class="meta">Interview score: ${s.lastInterview.score}/100. ${s.lastInterview.accepted?'You have been hired. Start your first shift above.':'Improve your CV or training and apply again.'}</div></div>`;
    }
    html += `<div class="section">CAREER & RETIREMENT RECORD</div>`;
    if (!s.careerHistory.length) html += `<div class="empty">No completed careers yet. Your retirement and career history will appear here.</div>`;
    s.careerHistory.slice(0,8).forEach(h => { html += `<div class="card"><div class="title">${esc(h.title)} · ${esc(h.finalRank)}</div><div class="meta">${h.shifts} shifts · Lifetime earnings ${money(h.lifetimeEarned)} · Pension paid ${money(h.pensionPaid)}</div></div>`; });
    root.innerHTML = html;
    root.querySelectorAll("[data-act]").forEach(b => b.onclick = () => this.action(b));
    if (this._timer) clearInterval(this._timer);
    if (s.active && s.active.shiftStartedAt) this._timer = setInterval(() => {
      if (window.__ph3d_phone && window.__ph3d_phone.app !== "career") {
        clearInterval(this._timer); this._timer = null; return;
      }
      this.render();
    }, 1000);
  },
  async action(button) {
    const act = button.dataset.act;
    let result;
    if (act === "cv") result = await Career.prepareCV();
    if (act === "train") result = await Career.train();
    if (act === "apply") result = await Career.apply(button.dataset.id);
    if (act === "interview") result = await Career.interview();
    if (act === "start") result = await Career.startShift();
    if (act === "finish") result = await Career.finishShift();
    if (act === "retire") result = await Career.retire();
    const messages = {
      funds:"Not enough in-game money.", max_cv:"Your CV is already at maximum level.", max_training:"Training is already at maximum level.",
      employed:"You already have an active career.", pending:"Attend your pending interview first.", reputation:"Your reputation is too low for this career.",
      record:"This profession requires a clean criminal record.", no_application:"No pending application.", not_employed:"You do not have an active career.",
      already_working:"You are already on shift.", no_shift:"You have no active shift.", not_finished:"Your shift is still in progress.",
      not_eligible:"Complete 30 shifts before retirement.", working:"Finish your current shift before retiring.", invalid:"Career unavailable."
    };
    let message = "Career profile updated.";
    if (result?.ok) {
      if (act === "interview") message = result.accepted ? `Congratulations! Hired by ${result.track.name}. Interview score: ${result.score}/100.` : `Interview score: ${result.score}/100. Improve your CV or training and try again.`;
      else if (act === "finish") message = `Shift completed. ${money(result.pay)} salary credited.${result.promoted?' Promotion: '+result.rank+'!':''}`;
      else if (act === "retire") message = `Retirement completed. Pension paid: ${money(result.payout)}.`;
      else if (act === "apply") message = `Application submitted for ${result.track.name}.`;
      else if (act === "start") message = "Shift started. Complete 60 seconds to earn your salary.";
    } else message = messages[result?.reason] || "Action unavailable.";
    window.__ph3d_phone?._toast(message);
    this.render();
  }
};
