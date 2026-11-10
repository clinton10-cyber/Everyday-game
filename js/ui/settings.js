/* js/ui/settings.js
   Instant-apply settings sheet.
   Settings.set(key, value) → writes localStorage + applies live + fires event.
   SettingsUI.open()        → opens the HUD sheet.
   confirmDanger(msg)       → returns Promise<bool> — HUD-styled confirm modal. */

const KEY = "ph3d.settings.v1";

const DEFAULTS = {
  musicVolume:          0.3,
  sfxVolume:            0.4,
  voiceEnabled:         false,
  npcVoice:             true,
  quality:              "auto",
  shadows:              true,
  reduceMotion:         false,
  bigText:              false,
  highContrast:         false,
  joystickSide:         "left",
  autoRun:              false,
  haptics:              true,
  showFps:              false,
  hideOnScreenHints:    false,
  theme:                "dark",
  hudOpacity:           0.85,
  hudScale:             1.0,
  confirmDangerActions: true,
  moveSpeed:            1.0,
  lookSens:             1.0,
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) { return { ...DEFAULTS }; }
}

function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
}

export const Settings = {
  data: load(),

  get(key)       { return this.data[key]; },

  set(key, value) {
    this.data[key] = value;
    save(this.data);
    this.apply(key, value);
    try {
      window.dispatchEvent(new CustomEvent("ph3d:settings-changed", {
        detail: { key, value, all: { ...this.data } },
      }));
    } catch (e) {}
  },

  apply(key, value) {
    try {
      switch (key) {
        case "musicVolume":
          if (window.__ph3d_audio && window.__ph3d_audio.setMusicVolume)
            window.__ph3d_audio.setMusicVolume(value);
          break;
        case "sfxVolume":
          window.__ph3d_sfxVolume = value;
          break;
        case "moveSpeed":
          window.__ph3d_moveSpeed = Math.max(0.4, Math.min(2.5, +value || 1));
          break;
        case "lookSens":
          window.__ph3d_lookSens = Math.max(0.3, Math.min(3, +value || 1));
          break;
        case "quality":
          this._applyQuality(value);
          break;
        case "shadows":
          if (window.__ph3d_router && window.__ph3d_router.renderer)
            window.__ph3d_router.renderer.shadowMap.enabled = !!value;
          break;
        case "reduceMotion":
          document.documentElement.classList.toggle("ph3d-reduce-motion", !!value);
          break;
        case "bigText":
          document.documentElement.classList.toggle("ph3d-big-text", !!value);
          break;
        case "highContrast":
          document.documentElement.classList.toggle("ph3d-high-contrast", !!value);
          break;
        case "joystickSide":
          document.documentElement.classList.toggle("ph3d-joy-right", value === "right");
          break;
        case "theme":
          this._applyTheme(value);
          break;
        case "hudOpacity":
          document.documentElement.style.setProperty("--ph3d-hud-opacity", String(value));
          break;
        case "hudScale":
          document.documentElement.style.setProperty("--ph3d-hud-scale", String(value));
          break;
        case "showFps":
          this._applyFps(value);
          break;
        case "hideOnScreenHints":
          document.documentElement.classList.toggle("ph3d-hide-hints", !!value);
          break;
        default: break;
      }
    } catch (e) {}
  },

  applyAll() {
    for (const k of Object.keys(this.data)) this.apply(k, this.data[k]);
  },

  reset() {
    this.data = { ...DEFAULTS };
    save(this.data);
    this.applyAll();
    try {
      window.dispatchEvent(new CustomEvent("ph3d:settings-changed", {
        detail: { key: "*", value: null, all: { ...this.data } },
      }));
    } catch (e) {}
  },

  _applyQuality(q) {
    const Q = window.__ph3d_quality;
    if (!Q) return;
    if (q === "auto") { Q.detect && Q.detect(); }
    else if (Q.tier !== q) {
      Q.tier = q;
      if (Q.TIERS && Q.TIERS[q]) Q.current = Object.assign({}, Q.TIERS[q]);
    }
    if (window.__ph3d_router && window.__ph3d_router.renderer) {
      const r = window.__ph3d_router.renderer;
      try {
        r.setPixelRatio(Math.min(window.devicePixelRatio, (Q.current && Q.current.pixelRatio) || 1));
        r.shadowMap.enabled = !!(Q.current && Q.current.shadows) && Settings.get("shadows");
      } catch (e) {}
    }
  },

  _applyTheme(t) {
    const r = document.documentElement;
    r.classList.remove("ph3d-theme-dark", "ph3d-theme-sunset", "ph3d-theme-forest");
    r.classList.add("ph3d-theme-" + t);
  },

  _applyFps(on) {
    let el = document.getElementById("ph3d-fps");
    if (!on) { if (el) el.remove(); return; }
    if (el) return;
    el = document.createElement("div");
    el.id = "ph3d-fps";
    Object.assign(el.style, {
      position: "fixed", left: "50%",
      top: "calc(env(safe-area-inset-top, 0px) + 4px)",
      transform: "translateX(-50%)", zIndex: "9996",
      padding: "4px 10px", borderRadius: "8px",
      background: "rgba(0,0,0,.6)", color: "#7dff9b",
      font: "700 11px ui-monospace, Menlo, monospace",
      letterSpacing: ".04em", pointerEvents: "none",
    });
    document.body.appendChild(el);
    let frames = 0, last = performance.now();
    const tick = () => {
      if (!document.getElementById("ph3d-fps")) return;
      frames++;
      const now = performance.now();
      if (now - last >= 500) {
        el.textContent = Math.round(frames * 1000 / (now - last)) + " fps";
        frames = 0; last = now;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },
};

/* ── Confirm-danger modal ──────────────────────────────────── */
export function confirmDanger(message) {
  if (!Settings.get("confirmDangerActions")) return Promise.resolve(true);
  return new Promise((resolve) => {
    const scrim = document.createElement("div");
    scrim.style.cssText =
      "position:fixed;inset:0;z-index:9990;display:flex;align-items:center;" +
      "justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(4px)";
    scrim.innerHTML = `
      <div style="background:rgba(30,10,10,.97);border:1px solid rgba(255,80,80,.4);
                  border-radius:22px;padding:28px 24px;max-width:320px;width:92%;
                  font-family:var(--h-font,Inter,system-ui,sans-serif);color:#fff5f5;text-align:center;
                  box-shadow:0 20px 50px rgba(0,0,0,.7)">
        <div style="font-size:10px;letter-spacing:.28em;color:#ffb0b0;
                    text-transform:uppercase;margin-bottom:10px">Are you sure?</div>
        <div style="font-size:14px;font-weight:700;margin-bottom:20px;line-height:1.4">${message}</div>
        <div style="display:flex;gap:10px">
          <button id="ph3d-cd-no"
            style="flex:1;padding:14px;border-radius:14px;
                   border:1px solid rgba(255,255,255,.2);background:transparent;
                   color:#fff5f5;font:900 11px var(--h-font,Inter,system-ui,sans-serif);
                   letter-spacing:.14em;cursor:pointer">CANCEL</button>
          <button id="ph3d-cd-yes"
            style="flex:1;padding:14px;border-radius:14px;border:none;
                   background:linear-gradient(135deg,#ff4444,#c70000);color:#fff;
                   font:900 11px var(--h-font,Inter,system-ui,sans-serif);
                   letter-spacing:.14em;cursor:pointer">CONFIRM</button>
        </div>
      </div>`;
    document.body.appendChild(scrim);
    const done = (yes) => { scrim.remove(); resolve(yes); };
    scrim.querySelector("#ph3d-cd-no").onclick  = () => done(false);
    scrim.querySelector("#ph3d-cd-yes").onclick = () => done(true);
    scrim.addEventListener("pointerdown", (e) => { if (e.target === scrim) done(false); });
  });
}

/* ── Settings sheet UI ────────────────────────────────────── */
try { Settings.apply("moveSpeed", Settings.get("moveSpeed")); Settings.apply("lookSens", Settings.get("lookSens")); } catch (e) {}

export const SettingsUI = {
  open() {
    const HUD = window.__ph3d_hud;
    if (!HUD || !HUD.sheet) { console.warn("[settings] HUD not ready"); return; }
    const S = Settings;

    HUD.sheet({
      title: "Settings",
      sub: "Everything here applies instantly",
      sections: [
        {
          label: "Audio",
          cols: 1,
          items: [
            this._sliderItem({ key: "musicVolume",  label: "Music volume",  icon: "sound", min: 0, max: 1,    step: 0.05 }),
            this._sliderItem({ key: "sfxVolume",    label: "Sound effects", icon: "aim",   min: 0, max: 1,    step: 0.05 }),
            this._toggle("npcVoice", "NPC & player voices", "talk"),
            this._toggle("voiceEnabled", "Voice chat (mic)",  "talk"),
          ],
        },
        {
          label: "Visual",
          cols: 2,
          items: [
            {
              icon: "aim", label: "Quality",
              sub: this._qualityLabel(S.get("quality")), keep: true,
              onClick: (ev, tile) => this._cycleQuality(tile),
            },
            this._toggle("shadows",      "Shadows",       "sun"),
            this._toggle("reduceMotion", "Reduce motion", "run"),
            this._toggle("bigText",      "Big text",      "menu"),
            this._toggle("highContrast", "High contrast", "heart"),
            {
              icon: "leaf", label: "Theme",
              sub: this._themeLabel(S.get("theme")), keep: true,
              onClick: (ev, tile) => this._cycleTheme(tile),
            },
          ],
        },
        {
          label: "Controls",
          cols: 2,
          items: [
            {
              icon: "walk", label: "Joystick",
              sub: S.get("joystickSide") === "left" ? "Left" : "Right", keep: true,
              onClick: (ev, tile) => {
                const next = S.get("joystickSide") === "left" ? "right" : "left";
                S.set("joystickSide", next);
                tile.querySelector(".h-tile-s").textContent = next === "left" ? "Left" : "Right";
              },
            },
            this._toggle("autoRun",              "Auto-run",       "run"),
            this._toggle("haptics",              "Haptics",        "phone"),
            this._toggle("confirmDangerActions", "Confirm danger", "lock"),
          ],
        },
        {
          label: "Movement & camera",
          cols: 1,
          items: [
            this._sliderItem({ key: "moveSpeed", label: "Walk / run speed",   icon: "run",  min: 0.5, max: 2.0, step: 0.05 }),
            this._sliderItem({ key: "lookSens",  label: "Look sensitivity",   icon: "aim",  min: 0.4, max: 2.5, step: 0.05 }),
          ],
        },
        {
          label: "Interface",
          cols: 1,
          items: [
            this._sliderItem({ key: "hudOpacity", label: "HUD opacity", icon: "menu", min: 0.4,  max: 1,    step: 0.05 }),
            this._sliderItem({ key: "hudScale",   label: "HUD size",    icon: "aim",  min: 0.85, max: 1.15, step: 0.05 }),
            this._toggle("showFps",           "Show FPS",   "phone"),
            this._toggle("hideOnScreenHints", "Hide hints", "talk"),
          ],
        },
        {
          label: "Restore",
          cols: 1,
          items: [
            {
              icon: "reload", label: "Reset all settings", sub: "Back to defaults",
              tone: "flare",
              onClick: () => { Settings.reset(); setTimeout(() => this.open(), 260); },
            },
          ],
        },
      ],
    });

    setTimeout(() => this._wireSliders(), 30);
  },

  /* ── Helpers ──────────────────────────────────────────── */
  _toggle(key, label, icon) {
    const S = Settings;
    return {
      icon, label,
      sub: S.get(key) ? "On" : "Off",
      active: !!S.get(key),
      keep: true,
      onClick: (ev, tile) => {
        const next = !S.get(key);
        S.set(key, next);
        tile.classList.toggle("is-on", next);
        tile.querySelector(".h-tile-s").textContent = next ? "On" : "Off";
        /* Haptics: buzz on enable */
        if (key === "haptics" && next) {
          try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
        }
        /* Hide hints: also flip the class immediately */
        if (key === "hideOnScreenHints")
          document.documentElement.classList.toggle("ph3d-hide-hints", next);
      },
    };
  },

  _sliderItem({ key, label, icon, min, max, step }) {
    return {
      icon, label,
      sub: (key === "moveSpeed" || key === "lookSens") ? (+Settings.get(key)).toFixed(2).replace(/0$/, "") + "x" : this._fmtPct(Settings.get(key)),
      keep: true,
      isSlider: true, sliderKey: key,
      sliderMin: min, sliderMax: max, sliderStep: step,
      onClick: () => {},
    };
  },

  _wireSliders() {
    const S = Settings;
    const MAP = {
      "Music volume":  { key: "musicVolume",  min: 0,    max: 1,    step: 0.05 },
      "Sound effects": { key: "sfxVolume",    min: 0,    max: 1,    step: 0.05 },
      "HUD opacity":   { key: "hudOpacity",   min: 0.4,  max: 1,    step: 0.05 },
      "HUD size":      { key: "hudScale",     min: 0.85, max: 1.15, step: 0.05 },
      "Walk / run speed": { key: "moveSpeed", min: 0.5, max: 2.0, step: 0.05, mult: true },
      "Look sensitivity": { key: "lookSens",  min: 0.4, max: 2.5, step: 0.05, mult: true },
    };
    document.querySelectorAll(".h-tile").forEach((tile) => {
      const lbl = tile.querySelector(".h-tile-l");
      if (!lbl) return;
      const def = MAP[lbl.textContent.trim()];
      if (!def) return;

      const wrap = document.createElement("div");
      wrap.style.cssText =
        "width:100%;display:flex;align-items:center;gap:8px;margin-top:6px";
      const input = document.createElement("input");
      input.type = "range";
      input.min = def.min; input.max = def.max; input.step = def.step;
      input.value = S.get(def.key);
      Object.assign(input.style, {
        flex: "1", accentColor: "#ffc62b",
        background: "transparent", height: "20px",
      });
      const num = document.createElement("span");
      const fmt = (v) => def.mult ? (+v).toFixed(2).replace(/0$/, "") + "x" : this._fmtPct(v);
      num.textContent = fmt(S.get(def.key));
      Object.assign(num.style, {
        font: "800 11px var(--h-font,Inter,system-ui,sans-serif)",
        color: "var(--h-danfo,#ffc62b)", minWidth: "36px", textAlign: "right",
      });
      input.addEventListener("input", () => {
        const v = parseFloat(input.value);
        S.set(def.key, v);
        num.textContent = fmt(v);
        const sub = tile.querySelector(".h-tile-s");
        if (sub) sub.textContent = fmt(v);
      });
      wrap.appendChild(input); wrap.appendChild(num);
      tile.appendChild(wrap);
      tile.style.cursor = "default";
      tile.addEventListener("click", (e) => e.stopPropagation(), true);
    });
  },

  _fmtPct(v)         { return Math.round(v * 100) + "%"; },
  _qualityLabel(q)   { return q === "auto" ? "Auto" : q === "high" ? "High" : q === "medium" ? "Med" : "Low"; },
  _themeLabel(t)     { return t === "sunset" ? "Sunset" : t === "forest" ? "Forest" : "Dark"; },

  _cycleQuality(tile) {
    const order = ["auto", "low", "medium", "high"];
    const next  = order[(order.indexOf(Settings.get("quality")) + 1) % order.length];
    Settings.set("quality", next);
    tile.querySelector(".h-tile-s").textContent = this._qualityLabel(next);
  },

  _cycleTheme(tile) {
    const order = ["dark", "sunset", "forest"];
    const next  = order[(order.indexOf(Settings.get("theme")) + 1) % order.length];
    Settings.set("theme", next);
    tile.querySelector(".h-tile-s").textContent = this._themeLabel(next);
  },
};

