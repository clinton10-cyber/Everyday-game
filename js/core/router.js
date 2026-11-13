import { SceneLife } from "./scene-life.js";
import * as THREE from "three";
import { disposeScene } from "./disposer.js";
import { Quality } from "./quality.js";
import { DayNight } from "./daynight.js";
import { tickWanted } from "../ui/wanted.js";
import { NightTools } from "./night-tools.js";

/* ═══════════════════════════════════════════════════════════════
   Router
   ───────────────────────────────────────────────────────────────
   • only one scene lives in memory at a time
   • the previous scene is FULLY disposed before the next loads
   • scene factories are async and can dynamic-import their deps
   • a persistent ⌂ CITY button is shown in every non-city scene
   ═══════════════════════════════════════════════════════════════ */
export class Router {
  constructor(renderer, ui){
    this.renderer = renderer;
    this.ui = ui;
    this.factories = {};
    this.stack = [];       // navigation history: [{name, params}, ...]
    this.current = null;   // current scene object
    this.locked = false;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.clock = new THREE.Clock();
    /* Frame pacing + dynamic resolution (see _loop / _adaptRes) */
    this._lastFrame = 0;
    this._dprNow = Math.min(window.devicePixelRatio || 1, Quality.current.pixelRatio);
    this._fpsAcc = 0; this._fpsN = 0; this._goodRun = 0; this._lastDprChange = 0;
    window.addEventListener("ph3d:settings-changed", (e) => {
      if (e && e.detail && (e.detail.key === "quality" || e.detail.key === "*")) this._resetRes();
    });
    this._bind();
    this._resize();
    this._bindBackHome();
    this._bindNightTorch();
    NightTools.init();
    this._loop();
  }

  register(name, fn){ this.factories[name] = fn; }

  /* Builds the always-on "back to city" pill. Idempotent — safe if
     called more than once. Hidden while the city scene is active. */
  _bindBackHome() {
    if (document.getElementById("ph3d-home-btn")) {
      this._homeBtn = document.getElementById("ph3d-home-btn");
      return;
    }
    const b = document.createElement("button");
    b.id = "ph3d-home-btn";
    b.textContent = "City";
    Object.assign(b.style, {
      position: "fixed",
      left: "14px",
      top: "calc(env(safe-area-inset-top) + 98px)",
      zIndex: "27",
      padding: "10px 16px",
      borderRadius: "22px",
      background: "rgba(8,16,28,.85)",
      border: "1px solid rgba(94,224,255,.45)",
      color: "#eaf6ff",
      font: "800 11px Inter,system-ui,sans-serif",
      letterSpacing: ".14em",
      cursor: "pointer",
      pointerEvents: "auto",
      touchAction: "manipulation",
      boxShadow: "0 6px 18px rgba(0,0,0,.5)",
      display: "none",
    });
    b.addEventListener("pointerdown", (e) => { e.stopPropagation(); });
    b.addEventListener("click", () => {
      if (this.locked) return;
      try {
        const Pr = window.__ph3d_prison;
        if (Pr && Pr.inJail) {
          try { window.__ph3d_phone && window.__ph3d_phone._toast("Serve your sentence or pay bail."); } catch (e) {}
          return;
        }
      } catch (e) {}
      this.go("city");
    });
    document.body.appendChild(b);
    this._homeBtn = b;
  }

  /* Compact on-foot flashlight control, designed for touch screens too. */
  _bindNightTorch() {
    let b = document.getElementById("ph3d-torch-btn");
    if (b) return;
    b = document.createElement("button");
    b.id = "ph3d-torch-btn";
    b.type = "button";
    b.textContent = "🔦 TORCH OFF";
    Object.assign(b.style, {
      position: "fixed", right: "14px", top: "calc(env(safe-area-inset-top) + 145px)",
      zIndex: "31", padding: "10px 13px", borderRadius: "22px",
      border: "1px solid rgba(255,255,255,.28)", background: "rgba(8,16,28,.88)",
      color: "#fff7df", font: "800 10px Inter,system-ui,sans-serif",
      letterSpacing: ".08em", boxShadow: "0 5px 16px rgba(0,0,0,.38)",
      cursor: "pointer", touchAction: "manipulation", display: "none"
    });
    b.addEventListener("pointerdown", e => e.stopPropagation());
    b.addEventListener("click", e => { e.stopPropagation(); NightTools.toggle(); });
    document.body.appendChild(b);
    this._torchBtn = b;
    window.addEventListener("keydown", e => {
      if (e.repeat || e.code !== "KeyT") return;
      const tag = (e.target && e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target?.isContentEditable) return;
      NightTools.toggle();
    });
  }

  async go(name, params={}, push=true){
    /* Prison lock: while serving a sentence only prisonScene (or the
       __release__ sentinel) may be routed to. */
    try {
      const Pr = window.__ph3d_prison;
      if (Pr && Pr.inJail && Pr.canLeaveTo && !Pr.canLeaveTo(name)) {
        try { window.__ph3d_phone && window.__ph3d_phone._toast("Serve your sentence or pay bail."); } catch (e) {}
        return null;
      }
    } catch (e) {}
    /* Release sentinel: bounce out of prison back to the city. */
    if (name === "__release__") {
      name = "city";
      params = {};
      try { this.stack.length = 0; } catch (e) {}
    }
    if (this.locked) return;
    this.locked = true;

    await this.ui.fadeIn();

    // ── HARD UNLOAD of previous scene ──
    if (document.getElementById("ph3d-outside-btn")) {
      document.getElementById("ph3d-outside-btn").remove();
    }
    if (this.current){
      const c = this.current;
      this.current = null;
      try { c.dispose && c.dispose(); } catch (e) {}
      disposeScene(c.three, this.renderer, c.controls);
      // yield one tick so the fade paints before the next load
      await new Promise(r => setTimeout(r, 0));
    }

    // ── LAZY LOAD of the new scene ──
    const factory = this.factories[name];
    if (!factory){
      console.error("No factory for", name);
      this.locked = false;
      return;
    }

    const scene = await this._loadWithProgress(name, () => factory(params, this));
    if (!scene) {
      console.error("[route] \"" + name + "\" produced no scene — returning to city.");
      this.locked = false;
      try { window.__ph3d_show && window.__ph3d_show("[route] failed: " + name); } catch (e) {}
      /* The previous scene was already disposed, so never leave the user on a blank screen. */
      if (!this.current && name !== "city" && !this._recovering) {
        this._recovering = true;
        try { await this.go("city"); } catch (e) {}
        this._recovering = false;
      }
      return;
    }
    scene._routeName = name; scene._routeParams = params;
    this.current = scene;
    try {
      if (window.__ph3d_mp) window.__ph3d_mp.scene = name;
    } catch (e) {}
    try {
      if (window.__ph3d_mp) {
        if (name === 'walk') window.__ph3d_mp.setMode('walk', 'walk');
        else if (name === 'drive') window.__ph3d_mp.setMode('drive', 'drive');
        else window.__ph3d_mp.setMode('idle', name);
      }
    } catch (e) {}

    if (push) this.stack.push({ name, params });

    /* Show the HOME pill in every scene except the city itself. */
    if (this._homeBtn) {
      let jailed = false;
      try { jailed = !!(window.__ph3d_prison && window.__ph3d_prison.inJail); } catch (e) {}
      this._homeBtn.style.display = (name === "city" || jailed) ? "none" : "block";
    }

    /* Add "GO OUTSIDE" button for interiors */
    this._bindOutside(scene, params);

    this.ui.setHeader(
      scene.crumb    !== undefined ? scene.crumb    : "",
      scene.title    !== undefined ? scene.title    : "",
      scene.subtitle !== undefined ? scene.subtitle : ""
    );
    this.ui.showBack(this.stack.length > 1, () => this.back());
    this.ui.setHint(scene.hint || "", !!scene.hint);

    this.ui.fadeOut();
    await new Promise(r => setTimeout(r, 60));
    this.locked = false;
    return scene;
  }

  /* Shows the loader overlay, logs elapsed load time to the console
     every 2s while the scene factory is still resolving (dynamic
     import + scene build), then hides the loader once it settles. */
  async _loadWithProgress(name, run){
    const el = document.getElementById("scene-loader");
    const lbl = document.getElementById("sl-label");
    const fill = document.getElementById("sl-fill");
    const pctEl = document.getElementById("sl-pct");
    if (lbl) lbl.textContent = "LOADING " + name.toUpperCase() + "…";

    /* Progress is an estimate (scene builds report no real progress): it eases
       toward 92% while the scene loads, then snaps to 100% when it is ready. */
    let p = 0, raf = 0, shown = false;
    const draw = () => {
      if (fill) fill.style.width = p + "%";
      if (pctEl) pctEl.textContent = Math.min(100, Math.floor(p)) + "%";
    };
    const step = () => { p += (92 - p) * 0.06; draw(); raf = requestAnimationFrame(step); };
    /* Only show the loader if the load is actually slow (avoids a flash on fast loads). */
    const showT = setTimeout(() => {
      shown = true; p = 0; draw();
      if (el) el.classList.add("show");
      raf = requestAnimationFrame(step);
    }, 300);

    const t0 = performance.now();
    const tick = setInterval(() => {
      const s = ((performance.now() - t0) / 1000).toFixed(1);
      console.log("[scene] loading \"" + name + "\"… " + s + "s");
    }, 2000);

    try {
      return await run();
    } finally {
      clearInterval(tick);
      clearTimeout(showT);
      cancelAnimationFrame(raf);
      if (shown) {
        p = 100; draw();
        await new Promise(r => setTimeout(r, 140));   // let the player see 100%
      }
      if (el) el.classList.remove("show");
    }
  }

  async back(){
    if (this.locked || this.stack.length < 2) return;
    const prev = this.stack[this.stack.length - 2];
    this.stack.pop(); this.stack.pop();
    await this.go(prev.name, prev.params, true);
  }

  _bind(){
    const el = this.renderer.domElement;
    let dx=0, dy=0, t0=0;
    el.addEventListener("pointerdown", e => { dx=e.clientX; dy=e.clientY; t0=performance.now(); });
    el.addEventListener("pointerup", e => {
      const d = Math.hypot(e.clientX - dx, e.clientY - dy);
      if (d > 12) return;
      if (performance.now() - t0 > 700) return;
      this._pick(e.clientX, e.clientY);
    });
  }

  _pick(cx, cy){
    if (!this.current || this.locked) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((cy - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.current.camera);
    const hits = this.raycaster.intersectObjects(this.current.three.children, true);
    for (const h of hits){
      let o = h.object;
      while (o){
        if (o.userData && o.userData.tap){ o.userData.tap(h); return; }
        o = o.parent;
      }
    }
  }

  _resize(){
    window.addEventListener("resize", () => {
      const w = innerWidth, h = innerHeight;
      this.renderer.setPixelRatio(this._dprNow);
      this.renderer.setSize(w, h);
      if (this.current){
        this.current.camera.aspect = w / h;
        this.current.camera.updateProjectionMatrix();
      }
    });
  }

  _bindOutside(scene, params) {
    let btn = document.getElementById("ph3d-outside-btn");
    if (btn) btn.remove();

    if (!scene || !scene.isInterior) return;
    try {
      const Pr = window.__ph3d_prison;
      if (Pr && Pr.inJail) return;
    } catch (e) {}

    btn = document.createElement("button");
    btn.id = "ph3d-outside-btn";
    btn.textContent = "GO OUTSIDE";
    /* HUD (hud.js SPEC + hud.css) handles all colour/position styling.
       We only set the touch/cursor basics that [data-hud] doesn't cover. */
    btn.style.cursor = "pointer";
    btn.style.touchAction = "manipulation";
    btn.style.pointerEvents = "auto";
    btn.addEventListener("pointerdown", e => e.stopPropagation());
    btn.addEventListener("click", (e) => {
      const nowT = performance.now();
      if ((btn._lastFired && nowT - btn._lastFired < 400) ||
          (window.__ph3d_lastHudTouch && nowT - window.__ph3d_lastHudTouch < 400)) { e.preventDefault(); e.stopPropagation(); return; }
      btn._lastFired = nowT;
      /* FIX #22 — house interiors must use their real exterior, not the starter flat */
      let id;
      if (typeof scene.getExteriorSceneId === "function") {
        id = scene.getExteriorSceneId();
      } else {
        id = scene.sceneId || params.id || "myhouse";
      }
      /* Normalise house keys to a place-exterior id */
      const houseMap = {
        flat1: "myhouse", flat2: "myhouse", flat10: "myhouse",
        mansion: "mansion",
      };
      if (houseMap[id]) id = houseMap[id];
      this.go("exterior", { id: id, parent: params.parent });
    });
    document.body.appendChild(btn);
    this._outsideBtn = btn;
  }

  /* Snap back to the active tier's starting resolution (quality changed). */
  _resetRes(){
    this._dprNow = Math.min(window.devicePixelRatio || 1, Quality.current.pixelRatio);
    this.renderer.setPixelRatio(this._dprNow);
    this._fpsAcc = 0; this._fpsN = 0; this._goodRun = 0;
  }

  /* Dynamic resolution: drop the render scale when frames run long, creep back
     up when there is headroom. Never goes below the tier's minPixelRatio. */
  _adaptRes(rawDt, cap){
    if (this.locked || rawDt > 0.25) { this._fpsAcc = 0; this._fpsN = 0; return; }   // scene load / tab switch spike
    this._fpsAcc += rawDt; this._fpsN++;
    if (this._fpsN < 30) return;
    const avg = this._fpsAcc / this._fpsN;
    this._fpsAcc = 0; this._fpsN = 0;
    const now = performance.now();
    if (now - this._lastDprChange < 1200) return;
    const Qc = Quality.current;
    const maxR = Math.min(window.devicePixelRatio || 1, Qc.pixelRatio);
    const minR = Math.min(maxR, Qc.minPixelRatio || 0.6);
    const target = 1 / cap;
    let r = this._dprNow;
    if (avg > target * 1.25 && r > minR) { r = Math.max(minR, r - (avg > target * 1.6 ? 0.15 : 0.08)); this._goodRun = 0; }
    else if (avg < target * 1.08) { if (++this._goodRun >= 8 && r < maxR) { r = Math.min(maxR, r + 0.05); this._goodRun = 0; } }
    else this._goodRun = 0;
    if (Math.abs(r - this._dprNow) > 0.001) {
      this._dprNow = r;
      this._lastDprChange = now;
      this.renderer.setPixelRatio(r);
    }
  }

  _loop(ts){
    requestAnimationFrame((t) => this._loop(t));

    /* Frame cap from the quality tier (30 on low/potato, 60 otherwise; also holds 120 Hz screens to 60).
       Skipped frames keep their time in the clock so game speed stays correct. */
    const cap = (Quality.current && Quality.current.frameCap) || 60;
    const nowMs = (typeof ts === "number") ? ts : performance.now();
    if (this._lastFrame && nowMs - this._lastFrame < (1000 / cap) - 3) return;
    this._lastFrame = nowMs;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.08);
    this._adaptRes(rawDt, cap);
    const t = this.clock.elapsedTime;

    /* Advance the 24h clock every frame. Without this the hour stays
       frozen at its initial value (8am) forever. */
    DayNight.tick(dt);
    try { window.__ph3d_prison && window.__ph3d_prison.tick(dt); } catch (e) {}
    try { window.__ph3d_crime && window.__ph3d_crime.decay(dt); } catch (e) {}
    try { tickWanted(); } catch (e) {}
    try { window.__ph3d_kidnap && window.__ph3d_kidnap.tick(dt); } catch (e) {}
    try { const C = window.__ph3d_combat; if (C && C.update) C.update(dt); } catch (e) {}
    window.__ph3d_daynight = DayNight;
    if (this._outsideBtn && this.current && this.current.crumb === "EXTERIOR") {
      /* FIX #23 — the button label matches what it actually does */
      this._outsideBtn.textContent = "ENTER BUILDING";
      this._outsideBtn.onclick = () => {
        const p = this.current;
        const id = (p && (p.sceneId || (p.params && p.params.id))) || "myhouse";
        this.go("interior", { id, parent: p && p.params ? p.params.parent : undefined });
      };
    } else if (this._outsideBtn && this.current) {
      this._outsideBtn.textContent = "GO OUTSIDE";
      /* Restore original handler (the one set in _bindOutside) */
      if (!this._outsideBtn._originalHandler) {
        this._outsideBtn._originalHandler = true;
      }
    }

    if (this.current){
      try {
        this.current.controls && this.current.controls.update();
        NightTools.tick(this.current);
        if (this._torchBtn) this._torchBtn.style.display = (window.__ph3d_player && window.__ph3d_player.scene === this.current.three) ? "block" : "none";
        this.current.update && this.current.update(dt, t);
        SceneLife.tick(this.current, dt, t);

        this.renderer.render(this.current.three, this.current.camera);
      } catch(e){ console.warn(e); }
    }
  }
}
