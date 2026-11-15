/* tools/perf-probe.js -- paste into the browser console while the game is running (any scene).
   1) Repeat-entry leak test: hotel interior x6, then the walk scene x3. renderer.info.memory.geometries must stay flat.
   2) Draw-call reading in the walk scene: renderer.info.render.calls (median of 30 frames).
   Usage: await __perfProbe()   -> prints a table and returns the rows. */
window.__perfProbe = async function () {
  const r = window.__ph3d_router, sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const info = () => r.renderer.info;
  const calls = async () => { const a = []; for (let i = 0; i < 30; i++) { await new Promise(requestAnimationFrame); a.push(info().render.calls); } a.sort((x, y) => x - y); return a[a.length >> 1]; };
  const rows = [];
  const snap = async (label) => { await sleep(1500); rows.push({ visit: label, geometries: info().memory.geometries, textures: info().memory.textures, drawCalls: await calls() }); };
  for (let i = 1; i <= 6; i++) { await r.go("interior", { id: "hotel" }); await snap("hotel #" + i); }
  for (let i = 1; i <= 3; i++) { await r.go("walk"); await snap("walk #" + i); }
  console.table(rows);
  const g = rows.map((x) => x.geometries), flat = Math.max(...g.slice(0, 6)) - Math.min(...g.slice(0, 6)) <= 5 && Math.max(...g.slice(6)) - Math.min(...g.slice(6)) <= 5;
  console.log(flat ? "OK: geometry count is flat across repeat entries" : "LEAK: geometry count drifts between entries");
  return rows;
};
console.log("perf probe ready: run  await __perfProbe()");
