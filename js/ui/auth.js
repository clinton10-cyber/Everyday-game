/* js/ui/auth.js
   The whole "welcome screen". One field, one button, no tabs. */

const CSS_ID = "ph3d-auth-css";

export const AuthUI = {
  _built: false,

  _injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    const s = document.createElement("style");
    s.id = CSS_ID;
    s.textContent = `
      /* Login — same design language as the in-game HUD (css/hud.css):
         ink-green glass, paper text, taxi-yellow = the one "do this now" colour. */
      #ph3d-auth {
        --a-ink: var(--h-ink, #0b110e);
        --a-glass: var(--h-glass, rgba(10,16,13,.80));
        --a-line: var(--h-line, rgba(243,241,232,.14));
        --a-line-hi: var(--h-line-hi, rgba(243,241,232,.30));
        --a-paper: var(--h-paper, #f3f1e8);
        --a-mist: var(--h-mist, #9db0a6);
        --a-danfo: var(--h-danfo, #ffc62b);
        --a-danfo-ink: var(--h-danfo-ink, #1b1400);
        --a-garden: var(--h-garden, #35d07f);
        --a-flare: var(--h-flare, #ff5a3c);
        --a-font: var(--h-font, "Archivo", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);

        position: fixed; inset: 0; z-index: 200;
        display: flex; align-items: center; justify-content: center;
        padding: calc(env(safe-area-inset-top, 0px) + 20px) 18px calc(env(safe-area-inset-bottom, 0px) + 20px);
        font-family: var(--a-font); color: var(--a-paper);
        -webkit-font-smoothing: antialiased;
        background:
          radial-gradient(120% 60% at 50% 0%, rgba(53,208,127,.14) 0%, transparent 60%),
          radial-gradient(90% 50% at 50% 105%, rgba(255,198,43,.12) 0%, transparent 62%),
          linear-gradient(180deg, #0e1713 0%, #0b110e 55%, #080c0a 100%);
        overflow: auto;
      }
      #ph3d-auth::before {              /* faint street-grid, like a map */
        content: ""; position: fixed; inset: 0; pointer-events: none; opacity: .5;
        background-image:
          linear-gradient(var(--a-line) 1px, transparent 1px),
          linear-gradient(90deg, var(--a-line) 1px, transparent 1px);
        background-size: 44px 44px;
        -webkit-mask-image: radial-gradient(70% 55% at 50% 45%, #000 0%, transparent 100%);
                mask-image: radial-gradient(70% 55% at 50% 45%, #000 0%, transparent 100%);
      }
      #ph3d-auth.hide { display: none; }
      .au-l, .au-r { display: contents; }

      .au-card {
        position: relative; width: min(92vw, 380px);
        background: var(--a-glass);
        border: 1px solid var(--a-line);
        border-radius: 22px;
        padding: 22px 20px 18px;
        box-shadow: 0 18px 60px rgba(0,0,0,.6), 0 6px 22px rgba(0,0,0,.38);
        -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
        text-align: center;
        animation: auIn .45s var(--h-ease, cubic-bezier(.2,.8,.2,1)) both;
      }
      @keyframes auIn { from { opacity: 0; transform: translateY(14px) scale(.98); } to { opacity: 1; transform: none; } }
      @media (prefers-reduced-motion: reduce) { .au-card { animation: none; } }

      .au-logo { width: 96px; height: 96px; margin: 0 auto 2px; display: block;
        filter: drop-shadow(0 6px 14px rgba(0,0,0,.45)); }

      .au-title { font: 800 24px/1.1 var(--a-font); letter-spacing: -.01em; color: var(--a-paper); margin-top: 4px; }
      .au-sub {
        display: inline-flex; align-items: center; gap: 7px; margin-top: 10px;
        padding: 4px 10px; border-radius: 8px;
        background: var(--a-danfo); color: var(--a-danfo-ink);
        font: 800 10px/1 var(--a-font); letter-spacing: .14em; text-transform: uppercase;
      }

      .au-lbl {
        display: block; text-align: left;
        font: 700 11px/1 var(--a-font); letter-spacing: .08em; text-transform: uppercase;
        color: var(--a-mist); margin: 22px 2px 8px;
      }

      .au-input {
        width: 100%; box-sizing: border-box; height: 52px; padding: 0 16px;
        border-radius: 14px; border: 1px solid var(--a-line);
        background: rgba(243,241,232,.06); color: var(--a-paper);
        font: 700 17px/1 var(--a-font); letter-spacing: 0; text-align: center;
        outline: none; transition: border-color .16s, background .16s, box-shadow .16s;
      }
      .au-input:focus { border-color: var(--a-danfo); background: rgba(243,241,232,.09);
        box-shadow: 0 0 0 3px rgba(255,198,43,.18); }
      .au-input::placeholder { color: rgba(243,241,232,.32); font-weight: 600; }

      .au-btn {
        width: 100%; margin-top: 14px; height: 52px;
        border-radius: 16px; border: none; cursor: pointer; touch-action: manipulation;
        background: var(--a-danfo); color: var(--a-danfo-ink);
        font: 800 15px/1 var(--a-font); letter-spacing: .04em;
        box-shadow: 0 8px 24px rgba(255,198,43,.34), 0 2px 6px rgba(0,0,0,.4);
        animation: auRing 1.8s ease-out infinite;
        transition: transform .12s var(--h-ease, cubic-bezier(.2,.8,.2,1)), opacity .2s;
      }
      @keyframes auRing {
        0%   { box-shadow: 0 0 0 0 rgba(255,198,43,.5), 0 8px 24px rgba(255,198,43,.3); }
        70%,100% { box-shadow: 0 0 0 12px rgba(255,198,43,0), 0 8px 24px rgba(255,198,43,.3); }
      }
      @media (prefers-reduced-motion: reduce) { .au-btn { animation: none; } }
      .au-btn:active { transform: scale(.96); }
      .au-btn:disabled { opacity: .45; cursor: not-allowed; animation: none; }

      .au-err { min-height: 16px; margin-top: 10px; font: 700 12px/1.3 var(--a-font); color: var(--a-flare); }

      .au-chips { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .au-chip {
        display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 12px 0 6px;
        border-radius: 12px; background: rgba(10,16,13,.6); border: 1px solid var(--a-line);
        font: 700 13px/1 var(--a-font); color: var(--a-paper); font-variant-numeric: tabular-nums;
      }
      .au-chip i {                       /* yellow tile, like the wallet chip's icon */
        width: 22px; height: 22px; border-radius: 7px; background: var(--a-danfo); color: var(--a-danfo-ink);
        display: inline-flex; align-items: center; justify-content: center; font: 900 12px/1 var(--a-font); font-style: normal;
      }
      .au-chip b { font-weight: 800; color: var(--a-garden); }

      .au-credit {
        margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--a-line);
        font: 600 11px/1.5 var(--a-font); color: var(--a-mist);
      }
      .au-credit a { color: var(--a-paper); text-decoration: none; border-bottom: 1px solid var(--a-line-hi); }
    `;
    document.head.appendChild(s);
  },

  show() {
    this._injectCSS();

    if (this._built) {
      document.getElementById("ph3d-auth").classList.remove("hide");
      return;
    }

    const wrap = document.createElement("div");
    wrap.id = "ph3d-auth";
    wrap.innerHTML = `
      <div class="au-card">
        <div class="au-l">
        <img class="au-logo" src="assets/logo.svg" alt="Everyday in PH"/>
        <div class="au-title">Everyday in PH</div>
        <div class="au-sub">The Garden City</div>
        </div>
        <div class="au-r">
        <label class="au-lbl" for="au-name">What should we call you?</label>
        <input id="au-name" class="au-input" type="text"
               maxlength="16" autocomplete="off" spellcheck="false"
               placeholder="your name"/>

        <button id="au-play" class="au-btn">PLAY</button>
        <div class="au-err" id="au-err"></div>

        <div class="au-chips">
          <span class="au-chip"><i>&#8358;</i><b>1,500,000</b></span>
          <span class="au-chip"><i>&#8962;</i>1-bed flat</span>
        </div>

        <div class="au-credit">
          everyday in PH<br/>
          <a href="mailto:clintonbenjamin208@gmail.com">clintonbenjamin208@gmail.com</a>
        </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    this._built = true;

    const input = document.getElementById("au-name");
    const btn = document.getElementById("au-play");
    const err = document.getElementById("au-err");

    /* Prefill the last used name so a returning player can just tap Play. */
    try {
      const last = localStorage.getItem("ph3d.player.name");
      if (last) input.value = last;
    } catch (e) {}

    const play = async () => {
      const name = input.value.trim();
      err.textContent = "";
      if (name.length < 2) { err.textContent = "Enter a name (2+ letters)"; return; }

      btn.disabled = true;
      try {
        const { Auth } = await import("../core/auth.js");
        await Auth.enter(name);
        this.hide();
        window.dispatchEvent(new CustomEvent("ph3d:auth-ok"));
      } catch (e) {
        err.textContent = e.message || "Something went wrong";
      } finally {
        btn.disabled = false;
      }
    };

    btn.onclick = play;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); play(); }
    });

    /* Auto-focus after the sheet paints */
    setTimeout(() => { try { input.focus(); } catch (e) {} }, 120);
  },

  hide() {
    const el = document.getElementById("ph3d-auth");
    if (el) el.classList.add("hide");
  },
};

