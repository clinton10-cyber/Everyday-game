/* speed-fx.js — "speed blur" for fast travel anywhere in the world (cars, bikes, hoverboard, wing flight).
   Radial speed streaks + a soft dark edge + a field-of-view kick. All scale smoothly with `amt` (0..1)
   and cost nothing at amt 0. Pure visuals; owns no game state.
   NOTE: this used to add a masked CSS `backdrop-filter: blur()` over the whole screen. A backdrop filter on top
   of a WebGL canvas forces the browser to re-blur the full frame every frame, which is what made flying
   (wing flight blurs constantly) lag so badly. The streaks + dark edge carry the speed feel without it. */

export function createSpeedFx(camera, baseFov) {
  const fov0 = baseFov || (camera && camera.fov) || 62;
  const root = document.createElement("div");
  root.id = "ph3d-speed-fx";
  root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:4;display:none;overflow:hidden;";
  const cv = document.createElement("canvas");
  cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";
  root.appendChild(cv);
  document.body.appendChild(root);

  const ctx = cv.getContext("2d");
  const SCALE = 0.5;                       /* half-res canvas: plenty for streaks, cheap on phones */
  let W = 0, H = 0;
  const resize = () => { W = cv.width = Math.max(2, Math.round(innerWidth * SCALE)); H = cv.height = Math.max(2, Math.round(innerHeight * SCALE)); };
  resize(); window.addEventListener("resize", resize);

  const N = 56, streaks = [];
  const spawn = (s, fresh) => {
    s.a = Math.random() * Math.PI * 2;
    s.r = fresh ? 0.30 + Math.random() * 0.7 : 0.28 + Math.random() * 0.12;   /* start radius (fraction of half-diagonal) */
    s.len = 0.12 + Math.random() * 0.30;
    s.sp = 0.9 + Math.random() * 1.4;
    s.w = 0.6 + Math.random() * 1.4;
    s.al = 0.25 + Math.random() * 0.5;
  };
  for (let i = 0; i < N; i++) { const s = {}; spawn(s, true); streaks.push(s); }

  let amt = 0, shown = false, lastFov = fov0, skip = false;

  function draw(a, dt) {
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, R = Math.hypot(cx, cy);
    ctx.lineCap = "round";
    const active = Math.floor(N * Math.min(1, 0.25 + a));
    for (let i = 0; i < active; i++) {
      const s = streaks[i];
      s.r += s.sp * (0.35 + a * 1.6) * dt;
      if (s.r > 1.05) spawn(s, false);
      const r0 = s.r, r1 = s.r + s.len * (0.4 + a);
      const cs = Math.cos(s.a), sn = Math.sin(s.a);
      ctx.strokeStyle = "rgba(255,255,255," + (s.al * a * Math.min(1, r0 * 1.4)).toFixed(3) + ")";
      ctx.lineWidth = s.w;
      ctx.beginPath();
      ctx.moveTo(cx + cs * r0 * R, cy + sn * r0 * R * 0.92);
      ctx.lineTo(cx + cs * r1 * R, cy + sn * r1 * R * 0.92);
      ctx.stroke();
    }
    /* soft dark edge so the blur reads as speed, not a smudge */
    const g = ctx.createRadialGradient(cx, cy, R * 0.45, cx, cy, R);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0," + (0.30 * a).toFixed(3) + ")");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  return {
    /* dt seconds; target 0..1 (0 = standing, 1 = top speed) */
    update(dt, target) {
      dt = Math.min(dt || 0.016, 0.1);
      const k = Math.min(1, dt * (target > amt ? 3.5 : 2.5));
      amt += (Math.max(0, Math.min(1, target || 0)) - amt) * k;
      if (amt < 0.015) {
        if (shown) { shown = false; root.style.display = "none"; }
        if (camera && Math.abs(camera.fov - fov0) > 0.02) { camera.fov = fov0; camera.updateProjectionMatrix(); lastFov = fov0; }
        return;
      }
      if (!shown) { shown = true; root.style.display = "block"; }
      skip = !skip;                      /* streaks redraw every other frame: half the 2D canvas work, still smooth */
      if (!skip) draw(amt, dt * 2);
      if (camera) {
        const f = fov0 + 16 * Math.pow(amt, 1.2);
        if (Math.abs(f - lastFov) > 0.05) { lastFov = f; camera.fov = f; camera.updateProjectionMatrix(); }
      }
    },
    dispose() {
      window.removeEventListener("resize", resize);
      try { root.remove(); } catch (e) {}
      if (camera && camera.fov !== fov0) { camera.fov = fov0; try { camera.updateProjectionMatrix(); } catch (e) {} }
    },
  };
}
