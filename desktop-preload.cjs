/* Runs before the game boots (sandboxed preload). Its only job: on the FIRST launch of a given build,
   start the game on the quality tier that suits this PC (decided in electron-main.cjs). After that the
   player's own choice in Settings is never touched. */
const { ipcRenderer } = require('electron');
(function () {
  try {
    const info = ipcRenderer.sendSync('ph3d:profile');
    if (!info || !info.quality || info.quality === 'auto') return;
    const KEY = 'ph3d.settings.v1';                 /* same key js/core/quality.js reads */
    const MARK = 'ph3d.desktop.profile.applied';    /* so we only ever apply it once per install */
    if (localStorage.getItem(MARK)) return;
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (!s.quality || s.quality === 'auto') { s.quality = info.quality; localStorage.setItem(KEY, JSON.stringify(s)); }
    localStorage.setItem(MARK, info.grade + ':' + info.quality);
  } catch (e) { /* never block the game from starting */ }
})();
