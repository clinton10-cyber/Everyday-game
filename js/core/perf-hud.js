/* perf-hud.js - optional on-screen performance readout. Off by default.
   Turn on with  ?perf=1  in the URL (or localStorage ph3d_perf = "1"); turn off with ?perf=0.
   Shows fps, frame ms, draw calls, triangles, geometries, textures, shader programs and lights.
   When a frame takes > 100 ms it logs a SPIKE line saying what changed since the previous frame:
   "programs +12" or "lights 7>8" means a shader recompile, "geom/tex +N" means new GPU uploads.
   Everything is also readable from the console as window.__ph3d_perf. */
let _on = false;
try {
  const q = new URLSearchParams(location.search).get("perf");
  if (q === "1") localStorage.setItem("ph3d_perf", "1");
  if (q === "0") localStorage.removeItem("ph3d_perf");
  _on = localStorage.getItem("ph3d_perf") === "1";
} catch (e) {}

let _el = null, _acc = 0, _frames = 0, _max = 0, _last = null, _lastUi = 0;
const _spikes = [];
const stats = { fps: 0, avgMs: 0, maxMs: 0, calls: 0, tris: 0, geoms: 0, textures: 0, programs: 0, lights: 0, spikes: _spikes };

function countLights(scene) {
  let n = 0;
  scene.traverse((o) => { if (o.isLight && o.intensity !== undefined) n++; });
  return n;
}

export const PerfHud = {
  enabled: _on,
  frame(renderer, rawDt, scene) {
    if (!_on || !renderer) return;
    const ms = rawDt * 1000;
    _acc += ms; _frames++; if (ms > _max) _max = ms;
    const info = renderer.info;
    const cur = {
      programs: info.programs ? info.programs.length : 0,
      geoms: info.memory.geometries, textures: info.memory.textures,
      lights: 0,
    };
    const spike = ms > 100;
    if (spike && scene) cur.lights = countLights(scene);
    if (spike && _last) {
      const d = [];
      if (cur.programs !== _last.programs) d.push("programs " + (cur.programs - _last.programs >= 0 ? "+" : "") + (cur.programs - _last.programs));
      if (cur.lights && _last.lights && cur.lights !== _last.lights) d.push("lights " + _last.lights + ">" + cur.lights);
      if (cur.geoms !== _last.geoms) d.push("geom " + (cur.geoms - _last.geoms >= 0 ? "+" : "") + (cur.geoms - _last.geoms));
      if (cur.textures !== _last.textures) d.push("tex " + (cur.textures - _last.textures >= 0 ? "+" : "") + (cur.textures - _last.textures));
      _spikes.push(Math.round(ms) + "ms  " + (d.join(", ") || "no GPU resource change (JS/CPU work)"));
      if (_spikes.length > 6) _spikes.shift();
    }
    if (scene && (!_last || spike || _frames === 1)) { if (!cur.lights) cur.lights = countLights(scene); }
    else if (_last) cur.lights = _last.lights;
    _last = cur;

    const now = performance.now();
    if (now - _lastUi < 500) return;
    _lastUi = now;
    stats.fps = Math.round(_frames / (_acc / 1000)); stats.avgMs = +(_acc / _frames).toFixed(1); stats.maxMs = Math.round(_max);
    stats.calls = info.render.calls; stats.tris = info.render.triangles;
    stats.geoms = cur.geoms; stats.textures = cur.textures; stats.programs = cur.programs; stats.lights = cur.lights;
    _acc = 0; _frames = 0; _max = 0;
    window.__ph3d_perf = stats;
    if (!_el) {
      _el = document.createElement("pre");
      _el.style.cssText = "position:fixed;left:6px;top:6px;z-index:99999;margin:0;padding:6px 8px;border-radius:8px;" +
        "background:rgba(0,0,0,.62);color:#9dffb0;font:11px/1.35 monospace;pointer-events:none;white-space:pre;max-width:92vw";
      document.body.appendChild(_el);
    }
    _el.textContent =
      stats.fps + " fps  avg " + stats.avgMs + "ms  worst " + stats.maxMs + "ms\n" +
      "draws " + stats.calls + "  tris " + (stats.tris / 1000).toFixed(0) + "k\n" +
      "geom " + stats.geoms + "  tex " + stats.textures + "  progs " + stats.programs + "  lights " + stats.lights +
      (_spikes.length ? "\n-- spikes --\n" + _spikes.join("\n") : "");
  },
};
