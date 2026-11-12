/* ═══════════════════════════════════════════════════════════════════════
   photo3d.js — the 3D album.

   Photos are not flat tiles: each one is a real 3D object (frame + picture +
   a printed back with caption / date / who was there) hanging on a curved
   gallery wall at the position stored in photo.obj3d.

     • drag the room      → look around the album
     • pinch / wheel      → zoom (room) or move closer / further (photo)
     • tap a photo        → fly to it; then DRAG to rotate it, PINCH to zoom
     • FLIP               → see the back of the print (caption, date, people)
     • double-tap         → reset the photo's rotation + zoom
     • PIN                → pin it to the frames on your home wall
     • tilt you leave a photo at is saved in photo.obj3d

   Own WebGL canvas on top of the game; everything is disposed on close.
   ═══════════════════════════════════════════════════════════════════════ */
import * as THREE from "three";
import { Photos, defaultObj3d } from "./photos.js";

const CENTER = new THREE.Vector3(0, 1.6, 5.2);           /* where you stand in the album room */
const MAX_TEX = 26;                                      /* textures alive at once (memory) */
const TAGS = { wedding: "💍 Wedding", date: "❤ Date", selfie: "🤳 Selfie", family: "👨‍👩‍👧 Family", photo: "📷 Photo" };

let ui = null;   /* the one open viewer */

function fmtDate(ts) {
  try { return new Date(ts).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; }
}

function backTexture(p) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 384;
  const g = c.getContext("2d");
  g.fillStyle = "#f4efe4"; g.fillRect(0, 0, 512, 384);
  g.strokeStyle = "#d6cdb8"; g.lineWidth = 6; g.strokeRect(14, 14, 484, 356);
  g.fillStyle = "#3a3226"; g.textAlign = "center";
  g.font = "700 26px Georgia, serif";
  g.fillText(TAGS[p.tag] || TAGS.photo, 256, 70);
  g.font = "italic 24px Georgia, serif";
  const cap = (p.caption || "").slice(0, 60);
  if (cap) g.fillText("“" + cap + "”", 256, 125, 460);
  g.font = "20px Georgia, serif"; g.fillStyle = "#6b5f4a";
  g.fillText(fmtDate(p.ts), 256, 190);
  if (p.where) g.fillText("📍 " + p.where, 256, 228, 460);
  if (p.who && p.who.length) {
    g.fillText("With", 256, 272);
    g.fillStyle = "#3a3226"; g.font = "700 21px Georgia, serif";
    g.fillText(p.who.slice(0, 5).join(", ").slice(0, 64), 256, 304, 460);
  }
  g.font = "13px Georgia, serif"; g.fillStyle = "#9a8f78"; g.fillText("EVERYDAY IN PH · ALBUM", 256, 352);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

class Viewer {
  constructor(focusId, opts) {
    this.opts = opts || {};
    this.objs = [];                 /* [{ p, group, picMat, tex, backTex, base:{ry,rx}, w,h }] */
    this.mode = "room";             /* room | focus */
    this.focus = null;              /* the focused entry */
    this.yaw = 0; this.pitch = 0; this.fov = 66;
    this.pointers = new Map();
    this.camPos = CENTER.clone(); this.camLook = new THREE.Vector3(0, 1.6, 0);
    this.focusDist = 2.3;
    this.raf = 0; this.dead = false; this.t0 = performance.now();
    this._build();
    const list = Photos.list;
    const idx = Math.max(0, list.findIndex((p) => p.id === focusId));
    if (list.length) this._focusIndex(idx, true);
  }

  /* ── DOM + GL ─────────────────────────────────────── */
  _build() {
    const root = this.root = document.createElement("div");
    root.id = "ph3d-album";
    root.style.cssText = "position:fixed;inset:0;z-index:9900;background:#080a0f;touch-action:none;user-select:none;-webkit-user-select:none;font-family:Inter,system-ui,sans-serif;color:#fff";
    root.innerHTML = `
      <canvas style="position:absolute;inset:0;width:100%;height:100%;display:block"></canvas>
      <div id="pa-top" style="position:absolute;left:0;right:0;top:0;padding:calc(env(safe-area-inset-top,0px) + 10px) 14px 8px;display:flex;align-items:center;gap:10px;background:linear-gradient(#000a,#0000)">
        <b style="flex:1;font-size:15px;letter-spacing:.14em">🖼 3D ALBUM <span id="pa-count" style="opacity:.6;font-weight:600;letter-spacing:0"></span></b>
        <button id="pa-close" style="background:#fff2;border:1px solid #fff3;color:#fff;border-radius:12px;padding:8px 14px;font:800 12px Inter,system-ui,sans-serif">CLOSE</button>
      </div>
      <div id="pa-info" style="position:absolute;left:14px;right:14px;bottom:calc(env(safe-area-inset-bottom,0px) + 74px);text-align:center;font-size:12px;opacity:.9;text-shadow:0 1px 4px #000;pointer-events:none"></div>
      <div id="pa-bar" style="position:absolute;left:0;right:0;bottom:0;padding:10px 10px calc(env(safe-area-inset-bottom,0px) + 12px);display:flex;gap:6px;justify-content:center;background:linear-gradient(#0000,#000b)"></div>
      <div id="pa-hint" style="position:absolute;left:0;right:0;top:56px;text-align:center;font-size:11px;opacity:.65;pointer-events:none"></div>`;
    document.body.appendChild(root);
    this.canvas = root.querySelector("canvas");
    this.$ = (s) => root.querySelector(s);
    this.$("#pa-close").onclick = () => this.close();

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0c12);
    this.scene.fog = new THREE.Fog(0x0a0c12, 9, 22);
    this.camera = new THREE.PerspectiveCamera(this.fov, 1, 0.05, 60);
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x1a1e2a, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(2, 6, 9); this.scene.add(key);
    this.spot = new THREE.SpotLight(0xfff0d8, 0, 9, 0.7, 0.5); this.scene.add(this.spot, this.spot.target);
    /* floor + round wall so the room reads as a space */
    const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshStandardMaterial({ color: 0x1b1f2b, roughness: 0.55, metalness: 0.2 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(CENTER.x, 0, CENTER.z); this.scene.add(floor);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.6, 7, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x232838, roughness: 0.9, side: THREE.BackSide }));
    wall.position.set(CENTER.x, 3.5, CENTER.z); this.scene.add(wall);

    this._buildObjects();
    this._events();
    this._resize();
    this._loop();
    this._bar();
    this.$("#pa-hint").textContent = "Drag to look around · tap a photo to open it";
  }

  _buildObjects() {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xf1ece0, roughness: 0.6 });
    const frameGeo = new THREE.BoxGeometry(1, 1, 0.07);
    this.frameGeo = frameGeo; this.frameMat = frameMat;
    this.objs = Photos.list.map((p, i) => {
      if (!p.obj3d) p.obj3d = defaultObj3d(Photos.list.length - 1 - i);
      const o = p.obj3d;
      const group = new THREE.Group();
      group.position.set(o.x, o.y, o.z);
      group.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0, "YXZ");
      const w = 1.6, h = 1.2;
      const frame = new THREE.Mesh(frameGeo, frameMat); frame.scale.set(w + 0.14, h + 0.14, 1); group.add(frame);
      const picMat = new THREE.MeshBasicMaterial({ color: 0x3a3f4d });
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), picMat); pic.position.z = 0.037; group.add(pic);
      const backMat = new THREE.MeshBasicMaterial({ color: 0xf4efe4 });
      const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), backMat); back.position.z = -0.037; back.rotation.y = Math.PI; group.add(back);
      group.userData.idx = i;
      this.scene.add(group);
      return { p, group, pic, picMat, back, backMat, tex: null, backTex: null, w, h, baseRy: o.ry || 0, baseRx: o.rx || 0, loading: false };
    });
    this.$("#pa-count").textContent = "· " + this.objs.length;
  }

  /* lazy texture streaming so 100+ photos don't blow phone RAM */
  _ensureTextures(center) {
    const want = new Set();
    const order = this.objs.map((_, i) => i).sort((a, b) => Math.abs(a - center) - Math.abs(b - center)).slice(0, MAX_TEX);
    order.forEach((i) => want.add(i));
    this.objs.forEach((e, i) => {
      if (want.has(i)) {
        if (!e.tex && !e.loading) {
          e.loading = true;
          new THREE.TextureLoader().load(e.p.url, (t) => {
            if (this.dead) { t.dispose(); return; }
            t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2;
            e.tex = t; e.picMat.map = t; e.picMat.color.set(0xffffff); e.picMat.needsUpdate = true;
            const img = t.image, ar = img && img.width ? img.width / img.height : 4 / 3;
            const H = 1.2, Wd = Math.min(2.1, Math.max(0.9, H * ar));
            e.w = Wd; e.pic.scale.set(Wd / 1.6, 1, 1); e.back.scale.set(Wd / 1.6, 1, 1);
            e.group.children[0].scale.set(Wd + 0.14, H + 0.14, 1);
            e.loading = false;
          }, undefined, () => { e.loading = false; });
          e.backTex = backTexture(e.p); e.backMat.map = e.backTex; e.backMat.color.set(0xffffff); e.backMat.needsUpdate = true;
        }
      } else if (e.tex) {
        e.tex.dispose(); e.tex = null; e.picMat.map = null; e.picMat.color.set(0x3a3f4d); e.picMat.needsUpdate = true;
        if (e.backTex) { e.backTex.dispose(); e.backTex = null; e.backMat.map = null; e.backMat.needsUpdate = true; }
      }
    });
  }

  /* ── interaction ───────────────────────────────────── */
  _events() {
    const cv = this.canvas;
    const down = (e) => {
      cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
      this._pinch0 = null;
    };
    const move = (e) => {
      const pt = this.pointers.get(e.pointerId); if (!pt) return;
      const dx = e.clientX - pt.x, dy = e.clientY - pt.y;
      pt.x = e.clientX; pt.y = e.clientY;
      if (this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this._pinch0 == null) { this._pinch0 = d; this._pinchBase = this.mode === "focus" ? this.focusDist : this.fov; }
        const k = this._pinch0 / Math.max(10, d);
        if (this.mode === "focus") this.focusDist = Math.min(4.2, Math.max(0.8, this._pinchBase * k));
        else this.fov = Math.min(95, Math.max(30, this._pinchBase * k));
        return;
      }
      if (this.mode === "focus" && this.focus) {
        const g = this.focus.group;
        g.rotation.y += dx * 0.011; g.rotation.x = Math.max(-0.9, Math.min(0.9, g.rotation.x + dy * 0.009));
      } else {
        this.yaw -= dx * 0.0052 * (this.fov / 66);
        this.pitch = Math.max(-0.45, Math.min(0.55, this.pitch - dy * 0.004));
      }
    };
    const up = (e) => {
      const pt = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      this._pinch0 = null;
      if (!pt) return;
      const moved = Math.hypot(e.clientX - pt.x0, e.clientY - pt.y0), dt = performance.now() - pt.t0;
      if (moved < 9 && dt < 380 && this.pointers.size === 0) this._tap(e.clientX, e.clientY);
    };
    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (this.mode === "focus") this.focusDist = Math.min(4.2, Math.max(0.8, this.focusDist + e.deltaY * 0.002));
      else this.fov = Math.min(95, Math.max(30, this.fov + e.deltaY * 0.04));
    }, { passive: false });
    this._onResize = () => this._resize();
    window.addEventListener("resize", this._onResize);
    this._onKey = (e) => {
      if (e.key === "Escape") this.close();
      else if (e.key === "ArrowRight") this._step(1);
      else if (e.key === "ArrowLeft") this._step(-1);
    };
    window.addEventListener("keydown", this._onKey);
  }

  _tap(cx, cy) {
    const now = performance.now();
    const dbl = this._lastTap && now - this._lastTap.t < 320 && Math.hypot(cx - this._lastTap.x, cy - this._lastTap.y) < 30;
    this._lastTap = { t: now, x: cx, y: cy };
    if (this.mode === "focus" && dbl) { this._resetFocus(); return; }
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -(((cy - r.top) / r.height) * 2 - 1));
    const rc = new THREE.Raycaster(); rc.setFromCamera(v, this.camera);
    const hits = rc.intersectObjects(this.objs.map((o) => o.group), true);
    if (hits.length) {
      let o = hits[0].object; while (o && o.userData.idx === undefined) o = o.parent;
      if (o && o.userData.idx !== undefined && (this.mode === "room" || this.objs[o.userData.idx] !== this.focus)) this._focusIndex(o.userData.idx);
    } else if (this.mode === "focus") this._leaveFocus();
  }

  /* ── focus handling ────────────────────────────────── */
  _focusIndex(i, instant) {
    if (!this.objs.length) return;
    i = (i + this.objs.length) % this.objs.length;
    if (this.focus && this.focus !== this.objs[i]) this._saveTilt(this.focus);
    this.focus = this.objs[i]; this.focusIdx = i; this.mode = "focus";
    this.focusDist = 2.3;
    this._ensureTextures(i);
    this._bar(); this._info();
    this.$("#pa-hint").textContent = "Drag to rotate · pinch to zoom · double-tap to reset";
    if (instant) this._snapCam = true;
  }
  _step(d) { if (this.mode === "focus") this._focusIndex(this.focusIdx + d); }
  _leaveFocus() {
    if (this.focus) this._saveTilt(this.focus);
    this.mode = "room"; this.focus = null; this._bar(); this._info();
    this.$("#pa-hint").textContent = "Drag to look around · tap a photo to open it";
    this.spot.intensity = 0;
  }
  _resetFocus() {
    const f = this.focus; if (!f) return;
    f.group.rotation.set(f.baseRx, f.baseRy, 0, "YXZ"); f.flip = false; this.focusDist = 2.3;
  }
  _flip() {
    const f = this.focus; if (!f) return;
    f.flip = !f.flip; f.flipTarget = f.flip ? Math.PI : 0;
  }
  /* the tilt you leave a photo at is part of its stored 3D transform */
  _saveTilt(f) {
    if (!f) return;
    const g = f.group;
    let dy = g.rotation.y - f.baseRy;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const flat = Math.abs(dy) > 0.9;                       /* flipped / spun right round → hang it straight */
    const ry = flat ? f.baseRy : f.baseRy + Math.max(-0.35, Math.min(0.35, dy));
    const rx = flat ? 0 : Math.max(-0.3, Math.min(0.3, g.rotation.x));
    g.rotation.set(rx, ry, 0, "YXZ"); f.flip = false; f.flipTarget = 0;
    Photos.update(f.p.id, { obj3d: { rx, ry, rz: 0 } });
  }

  _bar() {
    const bar = this.$("#pa-bar");
    const b = (id, label) => `<button id="${id}" style="background:#fff2;border:1px solid #fff3;color:#fff;border-radius:13px;padding:11px 12px;font:800 12px Inter,system-ui,sans-serif;min-width:48px">${label}</button>`;
    if (!this.objs.length) { bar.innerHTML = ""; return; }
    if (this.mode === "focus") {
      const pinned = this.focus && this.focus.p.pinned;
      bar.innerHTML = b("pa-prev", "‹") + b("pa-flip", "⟳ FLIP") + b("pa-reset", "RESET") + b("pa-pin", pinned ? "📌 PINNED" : "📌 PIN") + b("pa-save", "⬇ SAVE") + b("pa-del", "🗑") + b("pa-room", "▦ ROOM") + b("pa-next", "›");
      this.$("#pa-prev").onclick = () => this._step(-1);
      this.$("#pa-next").onclick = () => this._step(1);
      this.$("#pa-flip").onclick = () => this._flip();
      this.$("#pa-reset").onclick = () => this._resetFocus();
      this.$("#pa-room").onclick = () => this._leaveFocus();
      this.$("#pa-pin").onclick = () => {
        const f = this.focus; if (!f) return;
        f.p.pinned = !f.p.pinned; Photos.update(f.p.id, { pinned: f.p.pinned }); this._bar(); this._info();
        try { const L = window.__ph3d_lifesim; L && L.toast && L.toast(f.p.pinned ? "📌 Pinned — it will hang in your home" : "Unpinned"); } catch (e) {}
      };
      this.$("#pa-save").onclick = () => { const f = this.focus; if (f) Photos.saveToDevice(f.p.id); };
      this.$("#pa-del").onclick = () => this._delete();
    } else {
      bar.innerHTML = b("pa-first", "◀ NEWEST") + b("pa-open", "OPEN LATEST");
      this.$("#pa-first").onclick = () => { this.yaw = 0; this.pitch = 0; this.fov = 66; };
      this.$("#pa-open").onclick = () => this._focusIndex(0);
    }
  }
  _info() {
    const el = this.$("#pa-info"); const f = this.focus;
    if (!f || this.mode !== "focus") { el.textContent = ""; return; }
    const p = f.p, bits = [TAGS[p.tag] || TAGS.photo, fmtDate(p.ts)];
    if (p.who && p.who.length) bits.push("with " + p.who.slice(0, 3).join(", "));
    el.textContent = bits.join(" · ");
  }
  _delete() {
    const f = this.focus; if (!f) return;
    if (!confirm("Delete this photo?")) return;
    const i = this.focusIdx;
    Photos.remove(f.p.id);
    this._rebuild(Math.min(i, Photos.list.length - 1));
  }
  _rebuild(focusIdx) {
    this.objs.forEach((e) => { this.scene.remove(e.group); if (e.tex) e.tex.dispose(); if (e.backTex) e.backTex.dispose(); e.pic.geometry.dispose(); e.back.geometry.dispose(); e.picMat.dispose(); e.backMat.dispose(); });
    this.focus = null;
    this._buildObjects();
    if (this.objs.length && focusIdx >= 0) this._focusIndex(focusIdx, true);
    else { this.mode = "room"; this._bar(); this._info(); }
  }

  /* ── frame loop ───────────────────────────────────── */
  _resize() {
    const w = this.root.clientWidth || window.innerWidth, h = this.root.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  _loop() {
    if (this.dead) return;
    this.raf = requestAnimationFrame(() => this._loop());
    const dt = Math.min(0.05, (performance.now() - (this._last || performance.now())) / 1000); this._last = performance.now();
    const cam = this.camera;
    let tp, tl;
    if (this.mode === "focus" && this.focus) {
      const f = this.focus, g = f.group;
      /* flip animation */
      if (f.flipTarget !== undefined) {
        const base = f.baseRy + f.flipTarget;
        let d = base - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) > 0.01) g.rotation.y += d * Math.min(1, dt * 7);
      }
      /* the photo keeps its place on the wall; the camera comes to it */
      const n = new THREE.Vector3(CENTER.x - f.p.obj3d.x, 0, CENTER.z - f.p.obj3d.z).normalize();
      tp = new THREE.Vector3(f.p.obj3d.x, f.p.obj3d.y, f.p.obj3d.z).addScaledVector(n, this.focusDist * (f.w > 1.6 ? 1.1 : 1));
      tl = new THREE.Vector3(f.p.obj3d.x, f.p.obj3d.y, f.p.obj3d.z);
      this.spot.position.copy(tp).add(new THREE.Vector3(0, 1.2, 0)); this.spot.target.position.copy(tl);
      this.spot.intensity = Math.min(2.2, this.spot.intensity + dt * 4);
      this._ensureTexturesThrottle(this.focusIdx);
    } else {
      tp = CENTER.clone();
      const cp = Math.cos(this.pitch);
      tl = new THREE.Vector3(CENTER.x + Math.sin(this.yaw) * cp * 5, CENTER.y + Math.sin(this.pitch) * 5, CENTER.z - Math.cos(this.yaw) * cp * 5);
      /* keep nearby photos loaded while looking around */
      const a = this.yaw, per = 9; let col = Math.round(-a / 0.36 + (per - 1) / 2); col = Math.max(0, Math.min(per - 1, col));
      this._ensureTexturesThrottle(col);
    }
    const k = this._snapCam ? 1 : Math.min(1, dt * 5.5);
    this._snapCam = false;
    this.camPos.lerp(tp, k); this.camLook.lerp(tl, k);
    cam.position.copy(this.camPos); cam.lookAt(this.camLook);
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov += (this.fov - cam.fov) * Math.min(1, dt * 8); cam.updateProjectionMatrix(); }
    this.renderer.render(this.scene, cam);
  }
  _ensureTexturesThrottle(c) {
    const now = performance.now();
    if (now - (this._texT || 0) < 400 && this._texC === c) return;
    this._texT = now; this._texC = c; this._ensureTextures(c);
  }

  close() {
    if (this.dead) return;
    try { if (this.focus) this._saveTilt(this.focus); } catch (e) {}
    this.dead = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("keydown", this._onKey);
    this.objs.forEach((e) => { if (e.tex) e.tex.dispose(); if (e.backTex) e.backTex.dispose(); e.pic.geometry.dispose(); e.back.geometry.dispose(); e.picMat.dispose(); e.backMat.dispose(); });
    try { this.frameGeo.dispose(); this.frameMat.dispose(); } catch (e) {}
    try { this.renderer.dispose(); this.renderer.forceContextLoss && this.renderer.forceContextLoss(); } catch (e) {}
    this.root.remove();
    ui = null;
    try { this.opts.onClose && this.opts.onClose(); } catch (e) {}
  }
}

export const PhotoViewer3D = {
  get isOpen() { return !!ui; },
  async open(focusId, opts) {
    if (ui) ui.close();
    try { await Photos.load(); } catch (e) {}
    ui = new Viewer(focusId, opts);
    return ui;
  },
  close() { if (ui) ui.close(); },
};
try { window.__ph3d_album3d = PhotoViewer3D; } catch (e) {}
