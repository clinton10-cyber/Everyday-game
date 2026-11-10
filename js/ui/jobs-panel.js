const CSS_ID = "ph3d-jobs-css";

export const JobsPanel = {
  _built: false,

  _injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    const s = document.createElement("style");
    s.id = CSS_ID;
    s.textContent = `
      #ph3d-jobs{position:fixed;inset:0;z-index:70;display:none}
      #ph3d-jobs.on{display:block}
      .jb-scrim{position:absolute;inset:0;background:rgba(3,6,12,.72);backdrop-filter:blur(8px)}
      .jb-sheet{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        width:min(94vw,460px);max-height:88vh;
        background:linear-gradient(165deg,#0d1420,#080c12);color:#eaf6ff;
        font-family:Inter,system-ui,sans-serif;border-radius:26px;overflow:hidden;
        border:1px solid rgba(94,224,255,.35);box-shadow:0 30px 90px rgba(0,0,0,.85);
        display:flex;flex-direction:column}
      .jb-hdr{padding:18px 22px 12px;display:flex;justify-content:space-between;
        align-items:center;border-bottom:1px solid rgba(94,224,255,.14)}
      .jb-t{font-size:13px;font-weight:900;letter-spacing:.18em;color:#5ee0ff}
      .jb-x{width:32px;height:32px;border-radius:50%;background:rgba(94,224,255,.1);
        border:1px solid rgba(94,224,255,.3);color:#eaf6ff;font-weight:900;
        display:flex;align-items:center;justify-content:center;cursor:pointer}
      .jb-list{padding:14px 16px;overflow-y:auto;flex:1}
      .jb-row{display:flex;gap:12px;align-items:center;padding:14px 12px;
        border-radius:16px;background:rgba(255,255,255,.03);
        border:1px solid rgba(255,255,255,.08);margin-bottom:8px}
      .jb-icon{font-size:26px;width:38px;text-align:center}
      .jb-info{flex:1;min-width:0}
      .jb-name{font-size:13px;font-weight:900;letter-spacing:.02em}
      .jb-meta{font-size:10px;color:rgba(234,246,255,.55);margin-top:3px;letter-spacing:.08em}
      .jb-pay{font-size:13px;font-weight:900;color:#7dff9b}
      .jb-btn{padding:8px 14px;border-radius:12px;border:none;cursor:pointer;
        background:linear-gradient(135deg,#7dff9b,#4ade80);color:#031a0d;
        font-family:inherit;font-size:10px;font-weight:900;letter-spacing:.14em}
      .jb-btn:active{transform:scale(.96)}
      .jb-empty{padding:40px 20px;text-align:center;color:rgba(234,246,255,.5);font-size:12px}
      .jb-foot{padding:12px 22px 18px;border-top:1px solid rgba(94,224,255,.14);
        font-size:11px;color:rgba(234,246,255,.5);display:flex;justify-content:space-between}
      .jb-foot b{color:#5ee0ff}
    `;
    document.head.appendChild(s);
  },

  async show() {
    this._injectCSS();
    const { Jobs } = await import("../core/jobs.js");
    const { JobShifts } = await import("../core/job-shifts.js");
    const { Profile } = await import("../core/profile.js");
    Jobs.refresh();

    if (!this._built) {
      const wrap = document.createElement("div");
      wrap.id = "ph3d-jobs";
      wrap.innerHTML = `
        <div class="jb-scrim"></div>
        <div class="jb-sheet">
          <div class="jb-hdr">
            <div class="jb-t">JOB BOARD</div>
            <div class="jb-x" id="jb-x">X</div>
          </div>
          <div class="jb-list" id="jb-list"></div>
          <div class="jb-foot">
            <span>REP <b id="jb-rep">100</b></span>
            <span id="jb-rec">NO RECORD</span><span id="jb-shift"></span>
          </div>
        </div>
      `;
      document.body.appendChild(wrap);
      document.getElementById("jb-x").onclick = () => this.hide();
      wrap.querySelector(".jb-scrim").onclick = () => this.hide();
      this._built = true;
    }

    const render = () => {
      const list = document.getElementById("jb-list");
      const rep = Profile.reputation();
      const isCrim = Profile.isCriminal();
      document.getElementById("jb-rep").textContent = rep;
      document.getElementById("jb-rec").textContent = isCrim ? "HAS RECORD" : "NO RECORD";
      /* Show active shift */
      const shiftEl = document.getElementById("jb-shift");
      if (shiftEl) {
        if (JobShifts && JobShifts.active) {
          const left = JobShifts.remaining();
          shiftEl.textContent = " · WORKING " + left + "s";
          shiftEl.style.color = "#ffcc5e";
        } else {
          shiftEl.textContent = "";
        }
      }
      /* Disable job buttons while working */
      const working = JobShifts && JobShifts.active;
      list.querySelectorAll("button[data-id]").forEach(b => {
        if (working) {
          b.disabled = true;
          b.textContent = "BUSY";
          b.style.opacity = "0.4";
        }
      });
      const avail = Jobs.available;
      if (!avail.length) {
        list.innerHTML = '<div class="jb-empty">No jobs available right now.<br>Check back in a moment.</div>';
        return;
      }
      let h = "";
      avail.forEach(j => {
        h += '<div class="jb-row">'
          + '<div class="jb-icon">' + j.icon + '</div>'
          + '<div class="jb-info">'
          + '<div class="jb-name">' + j.name + '</div>'
          + '<div class="jb-meta">' + j.hours + 'h shift · min rep ' + j.minRep + '</div>'
          + '</div>'
          + '<div style="text-align:right">'
          + '<div class="jb-pay">' + j.pay.toLocaleString() + '</div>'
          + '<button class="jb-btn" data-id="' + j.id + '" style="margin-top:6px">TAKE</button>'
          + '</div></div>';
      });
      list.innerHTML = h;
      list.querySelectorAll("button[data-id]").forEach(b => {
        b.onclick = async () => {
          const res = await Jobs.take(b.dataset.id);
          if (res.ok) {
            if (window.__ph3d_phone) window.__ph3d_phone._toast("Work done: " + res.job.name);
            render();
          }
        };
      });
    };

    document.getElementById("ph3d-jobs").classList.add("on");
    render();
    if (this._interval) clearInterval(this._interval);
    this._interval = setInterval(() => { Jobs.tick(); render(); }, 1000);
  },

  hide() {
    const el = document.getElementById("ph3d-jobs");
    if (el) el.classList.remove("on");
    if (this._interval) { clearInterval(this._interval); this._interval = null; }
  },
};

