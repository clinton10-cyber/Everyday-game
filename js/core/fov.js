/* js/core/fov.js — Call-of-Duty-style field of view, one setting for the whole game.
   • The Settings → "Field of view" slider is a HORIZONTAL FOV in degrees (CoD convention, 60–120, default 90).
   • three.js needs a vertical FOV, so it is derived from the screen's aspect ratio. That keeps the picture the
     same width of world on every phone and removes the stretched, fish-eye look of the old fixed 95° vertical.
   • Applied to every walking / first-person / interior camera (any PerspectiveCamera whose own fov is ≥ 70).
     Driving, city-overview, previews and cinematics keep their own narrower lenses, and a camera can opt out
     with camera.userData.noFovOverride = true.
   Implemented once on PerspectiveCamera.updateProjectionMatrix, so no scene needs touching. */
import * as THREE from "three";

const DEG = Math.PI / 180;
const MIN_H = 60, MAX_H = 120, DEFAULT_H = 90;
const MIN_V = 36, MAX_V = 92;             /* sane vertical limits (portrait phones, ultra-wide screens) */
const MIN_BASE = 70;                       /* only cameras authored at ≥70° vertical are treated as "view" cameras */

let hFov = DEFAULT_H;
const seen = new WeakSet();
const refs = [];                           /* WeakRefs: finished scenes' cameras can still be garbage-collected */

export function horizontalToVertical(h, aspect) {
  const a = Math.max(aspect || 1.78, 1.25);   /* portrait uses a landscape-equivalent so the view isn't stretched tall */
  const v = 2 * Math.atan(Math.tan(h * DEG / 2) / a) / DEG;
  return Math.min(MAX_V, Math.max(MIN_V, v));
}

const proto = THREE.PerspectiveCamera.prototype;
if (!proto.__ph3dFov) {
  const orig = proto.updateProjectionMatrix;
  proto.updateProjectionMatrix = function () {
    if (this.fov >= MIN_BASE && !(this.userData && this.userData.noFovOverride)) {
      if (!seen.has(this)) { seen.add(this); refs.push(new WeakRef(this)); }
      const keep = this.fov;
      this.fov = horizontalToVertical(hFov, this.aspect);
      orig.call(this);
      this.fov = keep;                          /* scenes keep seeing their own value */
      return;
    }
    orig.call(this);
  };
  proto.__ph3dFov = true;
}

export const Fov = {
  min: MIN_H, max: MAX_H, def: DEFAULT_H,
  get() { return hFov; },
  set(h) {
    h = +h; if (!isFinite(h)) h = DEFAULT_H;
    hFov = Math.min(MAX_H, Math.max(MIN_H, h));
    for (let i = refs.length - 1; i >= 0; i--) {
      const c = refs[i].deref();
      if (!c) { refs.splice(i, 1); continue; }
      try { c.updateProjectionMatrix(); } catch (e) {}
    }
  },
};

window.__ph3d_fov = Fov;
try {
  const raw = JSON.parse(localStorage.getItem("ph3d.settings.v1") || "{}");
  if (raw && raw.fov != null) Fov.set(raw.fov);
} catch (e) {}
window.addEventListener("ph3d:settings-changed", (e) => {
  const d = e.detail || {};
  if (d.key === "fov") Fov.set(d.value);
  else if (d.key === "*" && d.all) Fov.set(d.all.fov);
});
