/* js/ui/onboarding.js
   First-login onboarding: welcome card + spotlight tour.

   Public API:
     Onboarding.startIfNeeded({user, router, teleportHome})
     Onboarding.startTour()          // force-run
     Onboarding.reset(userId)        // clear stored progress
*/

const KEY_PREFIX = "ph3d.onboarding.v1.";
const CURRENT_VERSION = 1;

const TOUR = [
  {
    selector: "#player-panel",
    title: "Your character",
    body:
      "Tap this card anytime to open the <b>Tailor</b> — change your hair, clothes, " +
      "skin tone, and name. Your level and money are shown below the name.",
    placement: "below",
    pad: 10,
  },
  {
    selector: "#hud-rail",
    title: "Your quick tools",
    body:
      "<b>Home</b> returns to the city. <b>Menu</b> opens the main sheet. " +
      "<b>Sound</b> toggles music. The wallet next to it shows how much cash you have.",
    placement: "below",
    pad: 8,
  },
  {
    selector: "#ph3d-pocket-btn",
    title: "Your bag",
    body:
      "Every small item you find or buy lands here. Only 8 slots — sell or use items before they fill up.",
    placement: "below",
    pad: 8,
  },
  {
    selector: "#hud-ctx",
    title: "What you can do now",
    body:
      "Buttons appear here only when you're close enough to use something. " +
      "Yellow means you can <b>do</b> it right now. Grey means step closer.",
    placement: "above",
    pad: 6,
  },
  {
    selector: "#hud-pad",
    title: "Your thumb pad",
    body:
      "<b>Jump</b> and <b>Run</b> live here — they never move. On foot, <b>Fight</b> " +
      "(or Stab/Fire) also appears here once you're carrying a weapon.",
    placement: "above",
    pad: 6,
  },
  {
    selector: "#hud-root",
    title: "Your hands",
    body:
      "Drag the <b>left half</b> of the screen to walk. Drag the <b>right half</b> to " +
      "look around. Tap the phone button (top-right) to open your phone.",
    placement: "center",
    pad: 0,
    spotlight: false,
  },
];

function nowKey(userId) {
  return KEY_PREFIX + (userId || "guest");
}

function loadState(userId) {
  try {
    const raw = localStorage.getItem(nowKey(userId));
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s.version !== CURRENT_VERSION) return null;
    return s;
  } catch (e) {
    return null;
  }
}

function saveState(userId, state) {
  try {
    localStorage.setItem(nowKey(userId), JSON.stringify(state));
  } catch (e) {}
}

function buildSpotlight(rect, pad) {
  const scrim = document.createElement("div");
  scrim.className = "ph3d-tour-scrim";
  scrim.style.position = "fixed";
  scrim.style.inset = "0";
  scrim.style.zIndex = "9996";
  scrim.style.pointerEvents = "auto";
  scrim.style.background = "transparent";

  if (!rect) {
    scrim.style.background = "rgba(0,0,0,0.72)";
    return scrim;
  }

  const x = Math.max(0, rect.left - pad);
  const y = Math.max(0, rect.top - pad);
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;

  scrim.style.background = "rgba(0,0,0,0.72)";
  scrim.style.clipPath =
    "polygon(" +
    "0 0, 0 100%, " +
    `${x}px 100%, ${x}px ${y}px, ` +
    `${x + w}px ${y}px, ${x + w}px ${y + h}px, ` +
    `${x}px ${y + h}px, ${x}px 100%, ` +
    "100% 100%, 100% 0)";
  scrim.style.webkitClipPath = scrim.style.clipPath;

  const ring = document.createElement("div");
  ring.style.position = "fixed";
  ring.style.left = x + "px";
  ring.style.top = y + "px";
  ring.style.width = w + "px";
  ring.style.height = h + "px";
  ring.style.borderRadius = "18px";
  ring.style.boxShadow = "0 0 0 2px #ffc62b, 0 0 0 6px rgba(255,198,43,0.25)";
  ring.style.zIndex = "9997";
  ring.style.pointerEvents = "none";
  ring.style.transition = "all .25s ease";
  scrim.appendChild(ring);

  return scrim;
}

function buildCard(step, rect, idx, total) {
  const card = document.createElement("div");
  card.className = "ph3d-tour-card";
  card.style.position = "fixed";
  card.style.zIndex = "9998";
  card.style.width = "min(280px, 82vw)";
  card.style.padding = "16px 18px 14px";
  card.style.borderRadius = "20px";
  card.style.background = "rgba(10,16,13,.94)";
  card.style.border = "1px solid rgba(255,198,43,.45)";
  card.style.boxShadow = "0 18px 48px rgba(0,0,0,.7)";
  card.style.color = "#eaf6ff";
  card.style.font = "600 13px Inter, system-ui, sans-serif";
  card.style.lineHeight = "1.45";
  card.style.backdropFilter = "blur(14px)";
  card.style.webkitBackdropFilter = "blur(14px)";
  card.style.transition = "top .25s ease, left .25s ease, opacity .2s ease";

  card.innerHTML = `
    <div style="font-size:10px;letter-spacing:.28em;text-transform:uppercase;
                color:#ffc62b;font-weight:900;margin-bottom:8px">
      Step ${idx + 1} of ${total}
    </div>
    <div style="font-family:'Iowan Old Style','Hoefler Text',Georgia,serif;
                font-style:italic;font-weight:600;font-size:20px;
                line-height:1.1;color:#fff;margin-bottom:8px">
      ${step.title}
    </div>
    <div style="color:rgba(234,246,255,.82);font-weight:500;font-size:13px">
      ${step.body}
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button data-act="prev"
        style="flex:0 0 auto;padding:11px 16px;border-radius:12px;
               border:1px solid rgba(255,255,255,.18);background:transparent;
               color:rgba(234,246,255,.72);font:800 11px Inter,system-ui,sans-serif;
               letter-spacing:.14em;cursor:pointer">
        BACK
      </button>
      <button data-act="skip"
        style="flex:1;padding:11px 16px;border-radius:12px;
               border:1px solid rgba(255,255,255,.18);background:transparent;
               color:rgba(234,246,255,.55);font:800 11px Inter,system-ui,sans-serif;
               letter-spacing:.14em;cursor:pointer">
        SKIP
      </button>
      <button data-act="next"
        style="flex:1;padding:11px 16px;border-radius:12px;
               border:none;background:linear-gradient(135deg,#ffc62b,#ff9d5c);
               color:#1a1400;font:900 11px Inter,system-ui,sans-serif;
               letter-spacing:.14em;cursor:pointer">
        ${idx + 1 === total ? "DONE" : "NEXT"}
      </button>
    </div>
  `;

  const margin = 14;
  if (step.placement === "center" || !rect) {
    card.style.left = "50%";
    card.style.top = "50%";
    card.style.transform = "translate(-50%,-50%)";
  } else {
    const w = 280;
    const h = 200;
    let cx = rect.left + rect.width / 2 - w / 2;
    let cy;
    if (step.placement === "below") {
      cy = rect.top + rect.height + margin;
    } else if (step.placement === "above") {
      cy = rect.top - h - margin;
    } else {
      cy = rect.top + rect.height / 2 - h / 2;
    }
    cx = Math.max(8, Math.min(window.innerWidth - w - 8, cx));
    cy = Math.max(8, Math.min(window.innerHeight - h - 8, cy));
    card.style.left = cx + "px";
    card.style.top = cy + "px";
  }

  return card;
}

function buildWelcome({ onStart, onLater }) {
  const scrim = document.createElement("div");
  scrim.style.position = "fixed";
  scrim.style.inset = "0";
  scrim.style.zIndex = "9995";
  scrim.style.background = "radial-gradient(circle at 50% 40%, #1a2b40, #05080f)";
  scrim.style.display = "flex";
  scrim.style.alignItems = "center";
  scrim.style.justifyContent = "center";
  scrim.style.font = "Inter, system-ui, sans-serif";
  scrim.style.color = "#eaf6ff";
  scrim.style.padding = "20px";

  const card = document.createElement("div");
  card.style.width = "min(94vw, 400px)";
  card.style.background = "linear-gradient(165deg,#0d1420,#080c12)";
  card.style.border = "1px solid rgba(94,224,255,.35)";
  card.style.borderRadius = "26px";
  const _ls = window.matchMedia && window.matchMedia("(orientation: landscape)").matches;   /* short screen: compact card */
  card.style.padding = _ls ? "12px 20px 12px" : "26px 24px 22px";
  card.style.maxHeight = "calc(100vh - 16px)";
  card.style.overflowY = "auto";
  card.style.boxShadow = "0 30px 90px rgba(0,0,0,.85)";
  card.style.textAlign = "center";

  card.innerHTML = `
    <img src="assets/logo.svg" width="${_ls ? 48 : 120}" height="${_ls ? 48 : 120}" alt="Everyday in PH"
         style="display:inline-block;margin-bottom:${_ls ? 2 : 10}px"/>
    <div style="font-size:24px;font-weight:900;letter-spacing:-.3px;
                background:linear-gradient(90deg,#7dd3fc,#a78bfa,#f0abfc);
                -webkit-background-clip:text;background-clip:text;color:transparent">
      Welcome to Port Harcourt
    </div>
    <div style="font-size:10px;letter-spacing:.28em;text-transform:uppercase;
                color:rgba(234,246,255,.5);font-weight:800;margin-top:6px">
      The Garden City
    </div>

    <div style="text-align:left;margin:${_ls ? 10 : 22}px 0 0;
                display:flex;flex-direction:column;gap:${_ls ? 7 : 12}px">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div style="flex:0 0 26px;height:26px;border-radius:50%;
                    background:linear-gradient(135deg,#ffc62b,#ff9d5c);
                    color:#1a1400;font-weight:900;display:flex;
                    align-items:center;justify-content:center;font-size:12px">1</div>
        <div style="font-weight:500;color:rgba(234,246,255,.82);font-size:13px;
                    line-height:1.45">
          You wake up in your own home. Walk out the front door to reach the city.
        </div>
      </div>
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div style="flex:0 0 26px;height:26px;border-radius:50%;
                    background:linear-gradient(135deg,#ffc62b,#ff9d5c);
                    color:#1a1400;font-weight:900;display:flex;
                    align-items:center;justify-content:center;font-size:12px">2</div>
        <div style="font-weight:500;color:rgba(234,246,255,.82);font-size:13px;
                    line-height:1.45">
          Drag <b>left</b> to walk, drag <b>right</b> to look. The buttons on
          the right are your jump and run.
        </div>
      </div>
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div style="flex:0 0 26px;height:26px;border-radius:50%;
                    background:linear-gradient(135deg,#ffc62b,#ff9d5c);
                    color:#1a1400;font-weight:900;display:flex;
                    align-items:center;justify-content:center;font-size:12px">3</div>
        <div style="font-weight:500;color:rgba(234,246,255,.82);font-size:13px;
                    line-height:1.45">
          Tap the <b>player card</b> to change how you look.
          Tap the <b>phone</b> icon for everything else.
        </div>
      </div>
    </div>

    <div style="display:flex;gap:10px;margin-top:${_ls ? 12 : 24}px">
      <button id="ph3d-tour-later"
        style="flex:1;padding:14px;border-radius:14px;
               border:1px solid rgba(255,255,255,.16);background:transparent;
               color:rgba(234,246,255,.6);
               font:800 11px Inter,system-ui,sans-serif;letter-spacing:.14em;
               cursor:pointer">
        LATER
      </button>
      <button id="ph3d-tour-start"
        style="flex:1.4;padding:14px;border-radius:14px;border:none;
               background:linear-gradient(135deg,#5ee0ff,#4ab6ff);
               color:#04121c;font:900 11px Inter,system-ui,sans-serif;
               letter-spacing:.14em;cursor:pointer">
        SHOW ME AROUND
      </button>
    </div>
  `;

  scrim.appendChild(card);
  scrim.querySelector("#ph3d-tour-start").onclick = () => { scrim.remove(); onStart(); };
  scrim.querySelector("#ph3d-tour-later").onclick = () => { scrim.remove(); onLater(); };
  return scrim;
}

let _current = null;
let _stepIdx = 0;
let _userId = null;

function cleanup() {
  if (!_current) return;
  _current.scrim && _current.scrim.remove();
  _current.card && _current.card.remove();
  _current = null;
}

function stepTo(idx) {
  if (!_current) return;
  const { steps } = _current;
  if (idx < 0) idx = 0;
  if (idx >= steps.length) {
    finish(true);
    return;
  }
  _stepIdx = idx;

  _current.scrim && _current.scrim.remove();
  _current.card && _current.card.remove();

  const step = steps[idx];
  let rect = null;
  if (step.selector && step.spotlight !== false) {
    const el = document.querySelector(step.selector);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 4 && r.height > 4) rect = r;
    }
  }

  const scrim = buildSpotlight(rect, step.pad || 6);
  const card = buildCard(step, rect, idx, steps.length);

  card.querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      const act = b.dataset.act;
      if (act === "next") stepTo(idx + 1);
      else if (act === "prev") stepTo(idx - 1);
      else if (act === "skip") finish(false);
    };
  });

  document.body.appendChild(scrim);
  document.body.appendChild(card);
  _current.scrim = scrim;
  _current.card = card;

  if (rect) {
    const pulse = document.createElement("div");
    pulse.style.position = "fixed";
    pulse.style.left = (rect.left - (step.pad || 6)) + "px";
    pulse.style.top = (rect.top - (step.pad || 6)) + "px";
    pulse.style.width = (rect.width + (step.pad || 6) * 2) + "px";
    pulse.style.height = (rect.height + (step.pad || 6) * 2) + "px";
    pulse.style.borderRadius = "20px";
    pulse.style.zIndex = "9997";
    pulse.style.pointerEvents = "none";
    pulse.style.boxShadow = "0 0 0 0 rgba(255,198,43,.7)";
    pulse.style.animation = "ph3d-pulse 1.6s ease-out infinite";
    scrim.appendChild(pulse);
  }

  const onResize = () => {
    if (!_current) return;
    window.removeEventListener("resize", onResize);
    stepTo(idx);
  };
  window.addEventListener("resize", onResize, { once: true });
}

function finish(completed) {
  cleanup();
  if (_userId) {
    saveState(_userId, {
      version: CURRENT_VERSION,
      welcome: true,
      tour: completed ? "complete" : "skipped",
      at: Date.now(),
    });
  }
}

function installKeyframes() {
  if (document.getElementById("ph3d-tour-kf")) return;
  const s = document.createElement("style");
  s.id = "ph3d-tour-kf";
  s.textContent = `
    @keyframes ph3d-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(255,198,43,.75); }
      70%  { box-shadow: 0 0 0 18px rgba(255,198,43,0); }
      100% { box-shadow: 0 0 0 0 rgba(255,198,43,0); }
    }
  `;
  document.head.appendChild(s);
}

/* ── public API ─────────────────────────────────────── */
export const Onboarding = {
  startIfNeeded({ user, router, teleportHome }) {
    if (!user) return;
    _userId = user.id || user.username || "guest";
    const st = loadState(_userId);
    if (st && (st.tour === "complete" || st.tour === "skipped")) {
      return;
    }

    installKeyframes();

    setTimeout(() => {
      const welcome = buildWelcome({
        onStart: () => {
          try { if (teleportHome) teleportHome(); } catch (e) {}
          setTimeout(() => {
            _current = { scrim: null, card: null, steps: TOUR };
            stepTo(0);
          }, 900);
        },
        onLater: () => {
          saveState(_userId, {
            version: CURRENT_VERSION,
            welcome: true,
            tour: "skipped",
            at: Date.now(),
          });
        },
      });
      document.body.appendChild(welcome);
    }, 400);
  },

  startTour() {
    installKeyframes();
    _current = { scrim: null, card: null, steps: TOUR };
    stepTo(0);
  },

  reset(userId) {
    try { localStorage.removeItem(nowKey(userId || _userId || "guest")); } catch (e) {}
  },
};

