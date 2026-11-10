/* ============================================================
   VoiceUI - proximity voice pill + panel.
   Exported as a proper class so `new VoiceUI()` works.
   ============================================================ */
import { Voice } from "./voice.js";
import { Multiplayer } from "./multiplayer.js";

export class VoiceUI {
  constructor() {
    this._built = false;
    this._open = false;
    this._btn = null;
    this._sheet = null;
    this._scrim = null;
    this._interval = null;
    Voice.onChange = () => this.refresh();
  }

  _injectCSS() {
    if (document.getElementById("ph3d-voice-css")) return;
    const s = document.createElement("style");
    s.id = "ph3d-voice-css";
    s.textContent = `
      #vc-btn{position:fixed;left:14px;bottom:calc(env(safe-area-inset-bottom) + 130px);z-index:31;padding:11px 16px;border-radius:24px;background:rgba(8,16,28,.85);border:1px solid rgba(94,224,255,.45);color:#eaf6ff;font:800 11px Inter,system-ui,sans-serif;letter-spacing:.14em;cursor:pointer;backdrop-filter:blur(12px);display:flex;gap:8px;align-items:center;user-select:none;touch-action:none;transition:all .18s}
      #vc-btn:active{transform:scale(.94)}
      #vc-btn.enabled{background:rgba(125,255,155,.16);border-color:#7dff9b}
      #vc-btn.talking{background:linear-gradient(135deg,#ff5c5c,#ff8080);border-color:#ff8080;color:#fff;animation:vcPulse 1s ease-in-out infinite}
      #vc-btn.listening{background:linear-gradient(135deg,#a78bfa,#c4b5fd);border-color:#c4b5fd;color:#0b0620}
      @keyframes vcPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,92,92,.6)}50%{box-shadow:0 0 0 8px rgba(255,92,92,0)}}
      #vc-scrim{position:fixed;inset:0;z-index:62;background:rgba(3,6,12,.72);backdrop-filter:blur(8px);opacity:0;pointer-events:none;transition:opacity .3s}
      #vc-scrim.on{opacity:1;pointer-events:auto}
      #vc-sheet{position:fixed;left:50%;top:50%;z-index:63;transform:translate(-50%,-46%) scale(.94);width:min(94vw,460px);max-height:82vh;background:linear-gradient(165deg,#0d1420 0%,#080c12 100%);color:#eaf6ff;font-family:Inter,system-ui,sans-serif;border-radius:26px;overflow:hidden;border:1px solid rgba(167,139,250,.42);box-shadow:0 30px 90px rgba(0,0,0,.85);opacity:0;pointer-events:none;transition:all .35s;display:flex;flex-direction:column}
      #vc-sheet.on{opacity:1;pointer-events:auto;transform:translate(-50%,-50%) scale(1)}
      .vc-hdr{padding:18px 22px 12px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(167,139,250,.2)}
      .vc-hdr .t{font-size:13px;font-weight:900;letter-spacing:.18em;color:#c4b5fd}
      .vc-hdr .s{font-size:10px;color:rgba(234,246,255,.55);letter-spacing:.16em;margin-top:3px}
      .vc-x{width:32px;height:32px;border-radius:50%;background:rgba(167,139,250,.14);border:1px solid rgba(167,139,250,.4);color:#c4b5fd;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center}
      .vc-list{padding:10px 16px 16px;overflow-y:auto;flex:1}
      .vc-list::-webkit-scrollbar{width:0}
      .vc-row{display:flex;align-items:center;gap:12px;padding:14px 12px;border-radius:16px;margin-bottom:8px;background:rgba(255,255,255,.03);border:1px solid rgba(167,139,250,.14)}
      .vc-row.active{border-color:#7dff9b;background:rgba(125,255,155,.08)}
      .vc-row.listening{border-color:#c4b5fd;background:rgba(167,139,250,.12)}
      .vc-row .info{flex:1;min-width:0}
      .vc-row .nm{font-size:13px;font-weight:900}
      .vc-row .ds{font-size:11px;color:rgba(234,246,255,.55);margin-top:3px}
      .vc-row button{padding:7px 12px;border-radius:10px;font-family:inherit;font-size:10px;font-weight:900;letter-spacing:.12em;border:none;cursor:pointer}
      .vc-row .listen{background:linear-gradient(135deg,#a78bfa,#c4b5fd);color:#0b0620}
      .vc-row .unlisten{background:linear-gradient(135deg,#ff5c5c,#ff8080);color:#fff}
      .vc-empty{padding:40px 20px;text-align:center;color:rgba(234,246,255,.5);font-size:12px;line-height:1.7}
      .vc-stats{padding:10px 22px 14px;border-top:1px solid rgba(167,139,250,.2);font-size:11px;color:rgba(234,246,255,.6);display:flex;justify-content:space-between;letter-spacing:.06em}
      .vc-acts{padding:12px 20px 20px;display:flex;gap:10px;border-top:1px solid rgba(167,139,250,.2);background:rgba(0,0,0,.25)}
      .vc-acts button{flex:1;padding:15px;border-radius:16px;cursor:pointer;font-family:inherit;font-size:12px;font-weight:900;letter-spacing:.14em;border:1px solid rgba(167,139,250,.3);background:transparent;color:rgba(234,246,255,.75)}
      .vc-acts button.on{background:linear-gradient(135deg,#ff5c5c,#ff8080);color:#fff;border:none}
      .vc-acts button.ready{background:linear-gradient(135deg,#7dff9b,#4ade80);color:#031a0d;border:none}
    `;
    document.head.appendChild(s);
  }

  _build() {
    if (this._built) return;
    this._injectCSS();

    /* Pill button */
    const btn = document.createElement("button");
    btn.id = "vc-btn";
    btn.innerHTML = '\uD83C\uDF99 <span id="vc-lbl">MIC OFF</span>';
    btn.addEventListener("pointerdown", async (e) => {
      e.preventDefault();
      if (!Voice.enabled) {
        await Voice.enable();
        this.refresh();
        return;
      }
      if (Voice.talking) Voice.stopTalk();
      else Voice.startTalk();
      this.refresh();
    }, { passive: false });
    document.body.appendChild(btn);
    this._btn = btn;

    /* Scrim + sheet */
    const scrim = document.createElement("div");
    scrim.id = "vc-scrim";
    scrim.addEventListener("click", () => this.close());
    document.body.appendChild(scrim);
    this._scrim = scrim;

    const sheet = document.createElement("div");
    sheet.id = "vc-sheet";
    sheet.innerHTML = `
      <div class="vc-hdr">
        <div>
          <div class="t">NEARBY VOICE</div>
          <div class="s" id="vc-sub">enable mic first</div>
        </div>
        <div class="vc-x" id="vc-x">X</div>
      </div>
      <div class="vc-list" id="vc-list"></div>
      <div class="vc-stats" id="vc-stats"></div>
      <div class="vc-acts">
        <button id="vc-talk">HOLD TO TALK</button>
        <button id="vc-enable">ENABLE MIC</button>
      </div>
    `;
    document.body.appendChild(sheet);
    this._sheet = sheet;

    document.getElementById("vc-x").onclick = () => this.close();
    document.getElementById("vc-enable").onclick = async () => {
      if (!Voice.enabled) await Voice.enable();
      this.refresh();
    };
    const talkBtn = document.getElementById("vc-talk");
    talkBtn.addEventListener("pointerdown", async (e) => {
      e.preventDefault();
      if (!Voice.enabled) { await Voice.enable(); this.refresh(); }
      if (Voice.enabled) { await Voice.startTalk(); talkBtn.classList.add("on"); this.refresh(); }
    }, { passive: false });
    const talkUp = () => {
      if (Voice.talking) { Voice.stopTalk(); talkBtn.classList.remove("on"); this.refresh(); }
    };
    talkBtn.addEventListener("pointerup", talkUp);
    talkBtn.addEventListener("pointercancel", talkUp);
    talkBtn.addEventListener("pointerleave", talkUp);

    this._built = true;
    this._interval = setInterval(() => { if (this._open) this._renderList(); }, 500);
  }

  open() {
    this._build();
    this._open = true;
    this._sheet.classList.add("on");
    this._scrim.classList.add("on");
    this.refresh();
  }

  close() {
    if (!this._sheet) return;
    this._open = false;
    this._sheet.classList.remove("on");
    this._scrim.classList.remove("on");
  }

  toggle() {
    if (this._open) this.close();
    else this.open();
  }

  refresh() {
    if (!this._btn) return;
    const lbl = document.getElementById("vc-lbl");
    if (!lbl) return;
    this._btn.classList.toggle("enabled", Voice.enabled);
    this._btn.classList.toggle("talking", Voice.talking);
    this._btn.classList.toggle("listening", Voice.listeningTo.size > 0);
    if (!Voice.enabled) lbl.textContent = "MIC OFF";
    else if (Voice.talking) lbl.textContent = "LIVE";
    else if (Voice.listeningTo.size > 0) lbl.textContent = "LISTENING (" + Voice.listeningTo.size + ")";
    else lbl.textContent = "TAP TO TALK";

    if (this._open) this._renderList();
  }

  _renderList() {
    const list = document.getElementById("vc-list");
    const stats = document.getElementById("vc-stats");
    const sub = document.getElementById("vc-sub");
    if (!list) return;

    const peers = [];
    Multiplayer.players.forEach((p, id) => {
      peers.push({
        id,
        name: p.name,
        active: Voice.isActive(id),
        listening: Voice.isListening(id),
        heardBy: Voice.isBeingListenedTo(id),
        dist: Voice._distanceTo(id),
        label: Voice.distanceLabel(id),
      });
    });
    peers.sort((a, b) => (a.dist ?? 999) - (b.dist ?? 999));

    if (sub) {
      sub.textContent = Voice.enabled
        ? (Voice.listeningTo.size > 0
            ? "listening to " + Voice.listeningTo.size + " player(s)"
            : "tap LISTEN on a nearby player")
        : "enable mic first";
    }

    if (!peers.length) {
      list.innerHTML = '<div class="vc-empty">No other players nearby.<br/>Open another tab to test.</div>';
    } else {
      let h = "";
      peers.forEach(p => {
        const cls = "vc-row" + (p.active ? " active" : "") + (p.listening ? " listening" : "");
        h += '<div class="' + cls + '">';
        h += '<div class="info"><div class="nm">' + p.name + (p.heardBy ? ' \uD83D\uDC42' : '') + '</div>';
        h += '<div class="ds">' + p.label + (p.active ? ' \u00B7 talking' : '') + (p.listening ? ' \u00B7 listening' : '') + '</div></div>';
        h += '<button class="' + (p.listening ? 'unlisten' : 'listen') + '" data-listen="' + p.id + '">';
        h += (p.listening ? 'STOP' : 'LISTEN') + '</button>';
        h += '</div>';
      });
      list.innerHTML = h;
      list.querySelectorAll("button[data-listen]").forEach(b => {
        b.onclick = () => {
          Voice.toggleListen(b.dataset.listen);
          this.refresh();
        };
      });
    }

    if (stats) {
      stats.innerHTML =
        'MIC ' + (Voice.enabled ? 'ON' : 'OFF') +
        ' \u00B7 NEARBY ' + peers.filter(p => p.dist != null && p.dist <= 20).length +
        ' \u00B7 LISTENING ' + Voice.listeningTo.size +
        ' \u00B7 LISTENERS ' + Voice.listeners.size;
    }
  }

  dispose() {
    if (this._interval) clearInterval(this._interval);
    if (this._btn && this._btn.parentNode) this._btn.parentNode.removeChild(this._btn);
    if (this._sheet && this._sheet.parentNode) this._sheet.parentNode.removeChild(this._sheet);
    if (this._scrim && this._scrim.parentNode) this._scrim.parentNode.removeChild(this._scrim);
    this._built = false;
  }
}

