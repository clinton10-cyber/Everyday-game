/* Everyday-game combat posture + shoulder-label enhancement.
 * Import this module once from js/main.js.
 * (Weapon poses moved into guns.js; this file keeps the SWAP SHOULDER label.)
 */

/* Arm poses now live in guns.js (STANCE table, solved against the real rig). This module only relabels the shoulder button. */

// Right shoulder remains the default. Keep the button explicit about its action.
if (typeof window !== "undefined") {
  const labelShoulder = () => {
    const c = window.__ph3d_player;
    const b = document.getElementById("ph3d-shoulder-btn");
    if (c && b) b.textContent = `SWAP SHOULDER · ${c.shoulderSide < 0 ? "LEFT" : "RIGHT"}`;
  };
  const bind = () => {
    const c = window.__ph3d_player;
    if (!c || c.__codShoulderLabelBound) return;
    c.__codShoulderLabelBound = true;
    const oldSwap = c.swapShoulder?.bind(c);
    if (oldSwap) {
      c.swapShoulder = () => { oldSwap(); labelShoulder(); };
    }
    labelShoulder();
  };
  document.addEventListener("DOMContentLoaded", bind);
  setTimeout(bind, 0);
  setTimeout(bind, 700);
}
