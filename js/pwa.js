/* pwa.js — register the service worker, wire the install prompt,
   surface "offline ready" / "update available" toasts. */

export const PWA = {
  registration: null,
  installPrompt: null,
  _listeners: new Set(),

  async register() {
    if (!("serviceWorker" in navigator)) return null;
    if (!window.isSecureContext) {
      console.warn("[pwa] service worker needs https or localhost");
      this._notify({ type: "insecure" });
      return null;
    }
    try {
      const hadController = !!navigator.serviceWorker.controller;
      const reg = await navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" });
      this.registration = reg;

      reg.addEventListener("updatefound", () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener("statechange", () => {
          if (next.state === "installed" && navigator.serviceWorker.controller) {
            this._notify({ type: "update-available", registration: reg });
          }
        });
      });
      // A previous visit may already have left a new worker waiting.
      if (reg.waiting && navigator.serviceWorker.controller) {
        this._notify({ type: "update-available", registration: reg });
      }
      // Check again whenever the player returns online or opens the game.
      const checkForUpdate = () => {
        if (navigator.onLine && this.registration) this.registration.update().catch(() => {});
      };
      window.addEventListener("online", checkForUpdate);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
      setInterval(checkForUpdate, 5 * 60 * 1000);

      /* First install: the worker takes control once → offline is ready */
      if (!hadController) {
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!this._updating) this._notify({ type: "offline-ready" });
        }, { once: true });
      }
      return reg;
    } catch (e) {
      console.warn("[pwa] service worker registration failed:", e);
      return null;
    }
  },

  activateUpdate() {
    const w = this.registration && this.registration.waiting;
    if (!w) return;
    this._updating = true;
    navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
    w.postMessage({ type: "SKIP_WAITING" });
  },

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); },
  _notify(ev) { for (const fn of this._listeners) { try { fn(ev); } catch (e) {} } },

  initInstallPrompt() {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.installPrompt = e;
      this._notify({ type: "install-available" });
    });
    window.addEventListener("appinstalled", () => {
      this.installPrompt = null;
      this._notify({ type: "installed" });
    });
  },

  async promptInstall() {
    if (!this.installPrompt) return false;
    this.installPrompt.prompt();
    const choice = await this.installPrompt.userChoice;
    this.installPrompt = null;
    this._notify({ type: "install-result", outcome: choice.outcome });
    return choice.outcome === "accepted";
  },
};

function _toast(text, actionLabel, actionFn) {
  const old = document.getElementById("ph3d-pwa-toast");
  if (old) old.remove();

  const el = document.createElement("div");
  el.id = "ph3d-pwa-toast";
  Object.assign(el.style, {
    position: "fixed", left: "50%",
    bottom: "calc(env(safe-area-inset-bottom, 0px) + 100px)",
    transform: "translateX(-50%)", zIndex: "9997",
    padding: "10px 16px", borderRadius: "14px",
    background: "rgba(10,16,13,.94)", border: "1px solid rgba(94,224,255,.45)",
    color: "#eaf6ff", font: "700 12px Inter, system-ui, sans-serif",
    letterSpacing: ".03em", boxShadow: "0 12px 30px rgba(0,0,0,.55)",
    display: "flex", gap: "12px", alignItems: "center",
    opacity: "0", transition: "opacity .25s", maxWidth: "88vw",
  });
  el.appendChild(document.createTextNode(text));

  if (actionLabel && actionFn) {
    const b = document.createElement("button");
    b.textContent = actionLabel;
    Object.assign(b.style, {
      padding: "6px 12px", borderRadius: "10px", border: "none",
      background: "#5ee0ff", color: "#04121c",
      font: "800 11px Inter, system-ui, sans-serif",
      letterSpacing: ".12em", cursor: "pointer",
    });
    b.addEventListener("click", () => { actionFn(); el.remove(); });
    el.appendChild(b);
  }

  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = "1"; });
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, actionLabel ? 9000 : 3500);
}

PWA.onChange((ev) => {
  if (ev.type === "offline-ready") _toast("Offline mode ready");
  else if (ev.type === "update-available") _showMandatoryUpdate();
  else if (ev.type === "install-available") _installPill();
  else if (ev.type === "installed") { const b = document.getElementById("ph3d-install-pill"); if (b) b.remove(); _toast("Installed ✓"); }
  else if (ev.type === "insecure") _toast("Install/offline needs https or localhost (not a LAN IP)");
});


/* Mandatory release gate: when a newer game build is installed and waiting,
   gameplay remains covered until the player applies it. The update is cached
   by the service worker first, so the button also works on a weak connection. */
function _showMandatoryUpdate() {
  let gate = document.getElementById("ph3d-update-gate");
  if (gate) return;
  gate = document.createElement("section");
  gate.id = "ph3d-update-gate";
  gate.setAttribute("role", "dialog");
  gate.setAttribute("aria-modal", "true");
  gate.setAttribute("aria-labelledby", "ph3d-update-title");
  Object.assign(gate.style, {
    position: "fixed", inset: "0", zIndex: "2147483647", display: "grid",
    placeItems: "center", padding: "24px", boxSizing: "border-box",
    background: "radial-gradient(circle at 50% 20%,#233c59 0%,#0a111d 55%,#05080e 100%)",
    color: "#f4f8ff", fontFamily: "Inter,system-ui,sans-serif", textAlign: "center"
  });
  const card = document.createElement("div");
  Object.assign(card.style, { maxWidth: "420px", width: "100%", padding: "30px 22px",
    borderRadius: "26px", background: "#101b2beF", border: "1px solid #74baff55",
    boxShadow: "0 24px 80px #0009" });
  const badge = document.createElement("div");
  badge.textContent = "EVERYDAY GAME UPDATE";
  Object.assign(badge.style, { color: "#77d8ff", fontSize: "10px", fontWeight: "900", letterSpacing: ".2em", marginBottom: "14px" });
  const title = document.createElement("h1");
  title.id = "ph3d-update-title"; title.textContent = "Update required";
  Object.assign(title.style, { fontSize: "27px", margin: "0 0 10px", lineHeight: "1.1" });
  const message = document.createElement("p");
  message.textContent = "A new version of Everyday-game is ready. Update the game before continuing. Your saved game data will remain on this device.";
  Object.assign(message.style, { color: "#b8c8da", fontSize: "14px", lineHeight: "1.65", margin: "0 0 22px" });
  const button = document.createElement("button");
  button.type = "button"; button.textContent = "UPDATE NOW";
  Object.assign(button.style, { width: "100%", minHeight: "54px", border: "0", borderRadius: "15px",
    background: "linear-gradient(100deg,#42d7ce,#6aaeff)", color: "#071522",
    fontSize: "14px", fontWeight: "950", letterSpacing: ".12em", cursor: "pointer" });
  const status = document.createElement("div");
  status.textContent = "Gameplay is paused until the update is installed.";
  Object.assign(status.style, { color: "#8297ad", fontSize: "11px", marginTop: "14px" });
  button.addEventListener("click", () => {
    button.disabled = true; button.textContent = "INSTALLING UPDATE…";
    status.textContent = "Applying the update. Please wait…";
    if (PWA.registration && PWA.registration.waiting) {
      PWA.activateUpdate();
    } else if (PWA.registration) {
      PWA.registration.update().then(() => {
        if (PWA.registration.waiting) PWA.activateUpdate();
        else { button.disabled = false; button.textContent = "RETRY UPDATE"; status.textContent = "The update is not ready yet. Check your connection and retry."; }
      }).catch(() => { button.disabled = false; button.textContent = "RETRY UPDATE"; status.textContent = "Could not reach the update server. Check your connection and retry."; });
    } else {
      button.disabled = false; button.textContent = "RELOAD GAME";
      button.onclick = () => location.reload();
    }
  });
  card.append(badge, title, message, button, status);
  gate.appendChild(card); document.body.appendChild(gate);
}

PWA.register();
PWA.initInstallPrompt();


/* visible INSTALL button (before this the install event fired but nothing ever showed it) */
function _installPill() {
  if (document.getElementById("ph3d-install-pill") || _standalone()) return;
  const b = document.createElement("button");
  b.id = "ph3d-install-pill";
  b.textContent = "📲 Install app";
  Object.assign(b.style, {
    position: "fixed", right: "12px", top: "calc(env(safe-area-inset-top, 0px) + 12px)", zIndex: "9996",
    padding: "9px 14px", borderRadius: "999px", border: "1px solid rgba(94,224,255,.6)",
    background: "rgba(10,16,13,.92)", color: "#eaf6ff", font: "800 12px Inter, system-ui, sans-serif",
    letterSpacing: ".05em", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,.5)",
  });
  b.addEventListener("click", async () => { const ok = await PWA.promptInstall(); if (ok) b.remove(); });
  document.body.appendChild(b);
}
function _standalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
/* iOS Safari has no install event: show the manual hint once */
(function iosHint() {
  const ua = navigator.userAgent || "";
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!ios || _standalone()) return;
  try { if (localStorage.getItem("ph3d_ios_hint")) return; localStorage.setItem("ph3d_ios_hint", "1"); } catch (e) {}
  setTimeout(() => _toast("To install: tap Share, then Add to Home Screen"), 2500);
})();
/* if the install event already fired before this module ran, it was missed — nothing to do; if it fires later we catch it */
window.__ph3d_pwa = PWA;
/* APK only: look for a newer GitHub Release and prompt the player to update */
import("./app-update.js").catch((e) => console.warn("[app-update]", e));
