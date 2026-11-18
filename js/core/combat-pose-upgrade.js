/* Everyday-game combat posture + shoulder-label enhancement.
 * Import this module once from js/main.js.
 * It replaces the old generic arm pose with weapon-class-specific poses.
 */
import { Weapons as GunSystem } from "./guns.js";

const DEG = Math.PI / 180;
const POSES = {
  pistol: {
    right: [-74, 8, -8], rightElbow: [-48, 0, 0],
    left: [-70, -28, 17], leftElbow: [-62, 0, 0],
    spine: [2, 0, 0], head: [2, -3, 0]
  },
  smg: {
    right: [-82, 5, -5], rightElbow: [-42, 0, 0],
    left: [-78, -18, 12], leftElbow: [-54, 0, 0],
    spine: [2, 0, 0], head: [1, -2, 0]
  },
  rifle: {
    right: [-78, 7, -10], rightElbow: [-45, 0, 0],
    left: [-76, -25, 16], leftElbow: [-66, 0, 0],
    spine: [2, 2, 0], head: [2, -4, 0]
  },
  shotgun: {
    right: [-70, 10, -13], rightElbow: [-42, 0, 0],
    left: [-72, -31, 20], leftElbow: [-70, 0, 0],
    spine: [5, 2, 0], head: [3, -4, 0]
  },
  lmg: {
    right: [-66, 13, -15], rightElbow: [-40, 0, 0],
    left: [-68, -36, 23], leftElbow: [-72, 0, 0],
    spine: [7, 3, 0], head: [3, -5, 0]
  },
  sniper: {
    right: [-58, 12, -18], rightElbow: [-78, 0, 0],
    left: [-75, -37, 23], leftElbow: [-56, 0, 0],
    spine: [1, 5, 0], head: [4, -7, 0]
  },
  bazooka: {
    right: [-55, 12, -18], rightElbow: [-38, 0, 0],
    left: [-58, -38, 22], leftElbow: [-48, 0, 0],
    spine: [8, 3, 0], head: [2, -3, 0]
  }
};

function setRotation(node, values, alpha) {
  if (!node || !node.rotation) return;
  const target = values.map(v => v * DEG);
  node.rotation.x += (target[0] - node.rotation.x) * alpha;
  node.rotation.y += (target[1] - node.rotation.y) * alpha;
  node.rotation.z += (target[2] - node.rotation.z) * alpha;
}

const originalApply = GunSystem.prototype.applyArmPose;
GunSystem.prototype.applyArmPose = function (R) {
  const c = this.controls || {};
  const weapon = this.current || "pistol";
  const p = POSES[weapon] || POSES.rifle;
  const alpha = Math.min(1, Math.max(0.12, (c._lastNow ? 0.22 : 0.22)));
  const aim = !!c.aiming;
  const k = aim ? 1 : 0.82;
  const right = p.right.map(v => v * k);
  const left = p.left.map(v => v * k);
  if (R.armR) {
    setRotation(R.armR.shoulder, right, alpha);
    setRotation(R.armR.elbow, p.rightElbow, alpha);
    setRotation(R.armR.wrist, [0, 0, 0], alpha);
  }
  if (R.armL) {
    setRotation(R.armL.shoulder, left, alpha);
    setRotation(R.armL.elbow, p.leftElbow, alpha);
    setRotation(R.armL.wrist, [0, 0, 0], alpha);
  }
  setRotation(R.spine, p.spine, alpha);
  setRotation(R.head, p.head, alpha);
  // Subtle aiming tuck: both arms rise slightly without changing the grip.
  if (aim) {
    if (R.armR?.shoulder) R.armR.shoulder.rotation.x -= 0.035;
    if (R.armL?.shoulder) R.armL.shoulder.rotation.x -= 0.035;
  }
};

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
