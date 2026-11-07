import { ATMs } from "./atms.js";
import { Economy } from "./economy.js";
import { Pocket } from "./pocket.js";
import { confirmDanger } from "../ui/settings.js";

const CSS_ID = "ph3d-atm-css";

export const ATMPanel = {
  _built: false,

  _injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    const s = document.createElement("style");
    s.id = CSS_ID;
    s.textContent = `
      .atm-scrim{position:fixed;inset:0;z-index:62;background:rgba(3,6,12,.72);
        backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .3s}
      .atm-scrim.on{opacity:1;pointer-events:auto}
      .atm-sheet{position:fixed;left:50%;top:50%;z-index:63;
        transform:translate(-50%,-46%) scale(.94);
        width:min(92vw,420px);
        background:linear-gradient(165deg,#0e1a24 0%,#0a1018 100%);
        color:#eaf6ff;font-family:Inter,system-ui,sans-serif;
        border-radius:26px;overflow:hidden;
        border:1px solid rgba(94,224,255,.3);
        box-shadow:0 30px 90px rgba(0,0,0,.85);
        opacity:0;pointer-events:none;
        transition:all .32s cubic-bezier(.2,.9,.3,1.1)}
      .atm-sheet.on{opacity:1;pointer-events:auto;transform:translate(-50%,-50%) scale(1)}
      .atm-hdr{padding:18px 22px 12px;display:flex;justify-content:space-between;align-items:center;
        border-bottom:1px solid rgba(94,224,255,.14)}
      .atm-hdr .t{font-size:13px;font-weight:900;letter-spacing:.18em;color:#5ee0ff}
      .atm-hdr .x{width:32px;height:32px;border-radius:50%;
        background:rgba(94,224,255,.10);border:1px solid rgba(94,224,255,.28);
        color:#eaf6ff;font-weight:900;cursor:pointer;
        display:flex;align-items:center;justify-content:center}
      .atm-body{padding:18px 22px}
      .atm-bal{display:flex;justify-content:space-between;padding:10px 0;
        border-bottom:1px solid rgba(94,224,255,.1)}
      .atm-bal .k{font-size:10px;letter-spacing:.2em;text-transform:uppercase;
        color:rgba(234,246,255,.55);font-weight:800}
      .atm-bal .v{font-weight:900}
      .atm-input{margin-top:16px}
      .atm-input label{display:block;font-size:10px;letter-spacing:.2em;
        color:rgba(234,246,255,.55);font-weight:800;margin-bottom:6px}
      .atm-input input{width:100%;padding:14px 16px;border-radius:14px;
        border:1px solid rgba(94,224,255,.28);background:rgba(255,255,255,.04);
        color:#eaf6ff;font-family:inherit;font-size:18px;font-weight:900;
        outline:none;-webkit-appearance:none;letter-spacing:.04em}
      .atm-input input:focus{border-color:#5ee0ff}
      .atm-quick{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
      .atm-quick button{flex:1;min-width:60px;padding:8px 4px;border-radius:10px;
        background:rgba(94,224,255,.12);border:1px solid rgba(94,224,255,.28);
        color:#eaf6ff;font-family:inherit;font-size:10px;font-weight:800;
        letter-spacing:.1em;cursor:pointer}
      .atm-acts{margin-top:18px;display:flex;flex-direction:column;gap:8px}
      .atm-acts button{padding:15px;border-radius:16px;border:none;cursor:pointer;
        font-family:inherit;font-size:12px;font-weight:900;letter-spacing:.14em}
      .atm-acts button.withdraw{background:linear-gradient(135deg,#5ee0ff,#4ab6ff);color:#04121c}
      .atm-acts button.hack{background:linear-gradient(135deg,#ff7b5c,#ff5c5c);color:#fff}
      .atm-acts button.close{background:transparent;border:1px solid rgba(255,255,255,.14);color:rgba(234,246,255,.7)}
      .atm-note{margin-top:12px;font-size:11px;color:rgba(234,246,255,.55);text-align:center;line-height:1.5}
      .atm-note .warn{color:#ff8080;font-weight:800}
      .atm-note .ok{color:#7dff9b;font-weight:800}
    `;
    document.head.appendChild(s);
  },

  _build() {
    if (this._built) return;
    this._injectCSS();
    const scrim = document.createElement("div");
    scrim.className = "atm-scrim"; scrim.id = "atm-scrim";
    scrim.addEventListener("click", () => this.close());
    document.body.appendChild(scrim);

    const sheet = document.createElement("div");
    sheet.className = "atm-sheet"; sheet.id = "atm-sheet";
    sheet.innerHTML = `
      <div class="atm-hdr">
        <div class="t">TESLA ATM</div>
        <div class="x" id="atm-x">x</div>
      </div>
      <div class="atm-body">
        <div class="atm-bal"><span class="k">BANK</span><span class="v" id="atm-bank">0</span></div>
        <div class="atm-bal"><span class="k">ATM CASH</span><span class="v" id="atm-left">0</span></div>
        <div class="atm-bal"><span class="k">POCKET FREE</span><span class="v" id="atm-free">8</span></div>
        <div class="atm-input">
          <label>AMOUNT</label>
          <input id="atm-amt" type="number" inputmode="numeric" placeholder="0"/>
          <div class="atm-quick">
            <button data-amt="5000">5k</button>
            <button data-amt="20000">20k</button>
            <button data-amt="50000">50k</button>
            <button data-amt="100000">100k</button>
          </div>
        </div>
        <div class="atm-acts">
          <button class="withdraw" id="atm-withdraw">WITHDRAW CASH</button>
          <button class="hack" id="atm-hack">HACK ATM</button>
          <button class="close" id="atm-close">CANCEL</button>
        </div>
        <div class="atm-note" id="atm-note">Cash goes into your pocket.</div>
      </div>
    `;
    document.body.appendChild(sheet);
    this._sheet = sheet;
    document.getElementById("atm-x").onclick = () => this.close();
    document.getElementById("atm-close").onclick = () => this.close();
    document.querySelectorAll(".atm-quick button").forEach(b => {
      b.onclick = () => { document.getElementById("atm-amt").value = b.dataset.amt; };
    });
    document.getElementById("atm-withdraw").onclick = () => this._doWithdraw();
    document.getElementById("atm-hack").onclick = () => this._doHack();
    this._built = true;
  },

  open(atm) {
    this._build();
    this._atm = atm;
    this._render();
    this._sheet.classList.add("on");
    document.getElementById("atm-scrim").classList.add("on");
  },
  close() {
    if (!this._sheet) return;
    this._sheet.classList.remove("on");
    document.getElementById("atm-scrim").classList.remove("on");
    this._atm = null;
  },

  _render() {
    const a = this._atm; if (!a) return;
    document.getElementById("atm-bank").textContent = "\u20A6" + Economy.balance.toLocaleString();
    document.getElementById("atm-left").textContent = "\u20A6" + a.balance.toLocaleString();
    document.getElementById("atm-free").textContent = (8 - Pocket.count());
    const hb = document.getElementById("atm-hack");
    if (a.hackable && !a.hacked) hb.style.display = "";
    else if (a.hacked) { hb.disabled = true; hb.textContent = "ALREADY HACKED"; }
    else hb.style.display = "none";
  },

  _doWithdraw() {
    const amt = Number(document.getElementById("atm-amt").value);
    const note = document.getElementById("atm-note");
    if (!amt || amt <= 0) { note.textContent = "Enter an amount."; return; }
    const res = ATMs.withdraw(this._atm.id, amt);
    if (!res.ok) {
      note.innerHTML = {
        no_atm: "ATM not available.",
        bad_amount: "Enter a valid amount.",
        over_balance: "You can only withdraw what's in your bank.",
        atm_empty: "This ATM is empty.",
        pocket_full: '<span class="warn">Pocket is full.</span>',
      }[res.reason] || "Failed.";
      return;
    }
    note.innerHTML = '<span class="ok">Withdrew ' + "\u20A6" + res.amount.toLocaleString() + '</span>' +
      (res.shortBy > 0 ? '<br/><span class="warn">' + "\u20A6" + res.shortBy.toLocaleString() + ' did not fit</span>' : "");
    this._render();
    if (window.__ph3d_phone) window.__ph3d_phone._toast("Withdrew " + "\u20A6" + res.amount.toLocaleString());
  },

  async _doHack() {
    const ok = await confirmDanger("Hack this ATM? Police will be alerted.");
    if (!ok) return;
    const note = document.getElementById("atm-note");
    const res = ATMs.hack(this._atm.id, Math.random());
    if (!res.ok) {
      note.innerHTML = {
        no_atm: "ATM not available.",
        not_hackable: "This ATM can't be hacked.",
        already_hacked: "Already hacked once.",
        failed: '<span class="warn">HACK FAILED</span>',
      }[res.reason] || "Failed.";
    } else {
      note.innerHTML = '<span class="ok">HACK OK</span> \u00B7 ' + "\u20A6" + res.amount.toLocaleString();
      if (window.__ph3d_phone) window.__ph3d_phone._toast("Hacked " + "\u20A6" + res.amount.toLocaleString());
    }
    this._render();
  },
};

