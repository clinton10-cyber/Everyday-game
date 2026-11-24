/* how-to-play.js — "How to play" sheet with real keycap / button graphics.
   Tabs: Keyboard · Phone & joystick. Opens from Settings → Controls and the in-game Menu.
   Uses HUD.sheet's render() slot, so it looks and closes like every other menu. */
import { HUD } from "./hud.js";

const CSS = `
.htp-tabs{display:flex;gap:6px;margin:2px 0 12px}
.htp-tab{flex:1;padding:10px 8px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);
  color:#e8eef7;font:700 13px/1 var(--h-font,system-ui,sans-serif);cursor:pointer;touch-action:manipulation}
.htp-tab.on{background:#5ee0ff;color:#06202b;border-color:#5ee0ff}
.htp-pane{display:none}.htp-pane.on{display:block}
.htp-h{font:700 12px/1 var(--h-font,system-ui,sans-serif);color:var(--h-mist,#9fb0c6);margin:14px 2px 8px;letter-spacing:.04em;text-transform:uppercase}
.htp-row{display:flex;align-items:center;gap:10px;padding:7px 2px;border-bottom:1px solid rgba(255,255,255,.07)}
.htp-row:last-child{border-bottom:0}
.htp-keys{display:flex;flex-wrap:wrap;gap:5px;width:136px;flex:0 0 136px}
.htp-txt{flex:1;color:#e8eef7;font:500 13px/1.3 var(--h-font,system-ui,sans-serif)}
.htp-txt small{display:block;color:var(--h-mist,#9fb0c6);font-weight:400;font-size:11px;margin-top:2px}
.htp-key{min-width:30px;height:30px;padding:0 8px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;
  background:linear-gradient(#f4f7fb,#cfd8e4);color:#142033;font:800 13px/1 ui-monospace,Menlo,Consolas,monospace;
  box-shadow:0 3px 0 #7d8da3,0 4px 6px rgba(0,0,0,.35);border:1px solid #fff}
.htp-key.w{min-width:52px}
.htp-btn{height:32px;padding:0 13px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;
  background:rgba(8,16,28,.85);border:2px solid #5ee0ff;color:#d9f6ff;font:800 12px/1 var(--h-font,system-ui,sans-serif);letter-spacing:.03em}
.htp-btn.round{width:36px;height:36px;padding:0;border-radius:50%;font-size:16px}
.htp-joy{position:relative;width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.10);border:2px solid rgba(94,224,255,.45);flex:0 0 auto;margin:0 4px}
.htp-joy i{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(94,224,255,.6);border:2px solid #fff}
.htp-wasd{display:grid;grid-template-columns:repeat(3,30px);grid-template-rows:repeat(2,30px);gap:4px}
.htp-wasd .htp-key{min-width:30px;padding:0}
.htp-wasd .kw{grid-area:1/2}.htp-wasd .ka{grid-area:2/1}.htp-wasd .ks{grid-area:2/2}.htp-wasd .kd{grid-area:2/3}
.htp-note{margin:12px 2px 2px;padding:10px 12px;border-radius:12px;background:rgba(94,224,255,.10);border:1px solid rgba(94,224,255,.30);
  color:#d9f6ff;font:500 12px/1.4 var(--h-font,system-ui,sans-serif)}
`;

function injectCss() {
  if (document.getElementById("htp-css")) return;
  const s = document.createElement("style"); s.id = "htp-css"; s.textContent = CSS; document.head.appendChild(s);
}

const k = (t, wide) => `<span class="htp-key${wide ? " w" : ""}">${t}</span>`;
const row = (keysHtml, title, sub) =>
  `<div class="htp-row"><div class="htp-keys">${keysHtml}</div><div class="htp-txt">${title}${sub ? `<small>${sub}</small>` : ""}</div></div>`;

function keyboardPane() {
  const wk = (c) => `<span class="htp-key k${c.toLowerCase()}">${c}</span>`;
  const ak = (c, g) => `<span class="htp-key" style="grid-area:${g}">${c}</span>`;
  const arrows = `<div class="htp-wasd">${ak("↑", "1/2")}${ak("←", "2/1")}${ak("↓", "2/2")}${ak("→", "2/3")}</div>`;
  const wasd = `<div class="htp-wasd">${wk("W")}${wk("A")}${wk("S")}${wk("D")}</div>`;
  return `
  <div class="htp-h">Move &amp; look</div>
  ${row(arrows, "Walk", "Arrow keys")}
  ${row(wasd, "Orbit the camera", "A / D swing round you · W / S tilt up and down")}
  ${row(k("Shift", 1), "Run", "Hold while moving")}
  ${row(k("Space", 1), "Jump")}
  ${row(k("Mouse", 1), "Look around", "Move the mouse to turn the camera")}
  ${row(k("V") + k("B"), "Camera view", "V: first / third person · B: swap shoulder")}
  <div class="htp-h">Do things</div>
  ${row(k("E"), "Interact · talk · pick up · use", "Doors, people, items, vehicles")}
  ${row(k("Q"), "Drop / throw", "Whatever you are holding")}
  ${row(k("F"), "Fight · attack", "Fire or stab when armed, wrestle when not")}
  ${row(k("G"), "Lie down")}
  ${row(k("C"), "Crouch")}
  ${row(k("J"), "Jetpack", "If you have unlocked it")}
  <div class="htp-h">Weapons</div>
  ${row(k("1") + k("2") + k("3") + k("4") + k("5"), "Fists · knife · pistol · sniper · bazooka")}
  ${row(k("6") + k("7") + k("8") + k("9"), "Rifle · SMG · shotgun · LMG")}
  ${row(k("R"), "Put weapons away")}
  ${row(k("Right-click", 1), "Aim", "Hold with a gun out")}
  <div class="htp-h">Driving</div>
  ${row(k("W") + k("S"), "Gas / brake")}
  ${row(k("A") + k("D"), "Steer")}
  ${row(k("H"), "Horn")}
  ${row(k("E"), "Get out of the car")}
  <div class="htp-h">Menus &amp; chat</div>
  ${row(k("Esc"), "Close a menu or chat")}
  ${row(k("Enter", 1), "Send chat message")}
  <div class="htp-note">While a chat or text box is open, the game keys are switched off, so typing never moves your character.</div>`;
}

function phonePane() {
  const joy = `<div class="htp-joy"><i></i></div>`;
  return `
  <div class="htp-h">Move &amp; look</div>
  ${row(joy, "Joystick: walk", "Touch and drag on the left half of the screen. Push further to go faster.")}
  ${row(`<span class="htp-btn round">☝</span>`, "Look around", "Drag on the right half of the screen to turn the camera")}
  <div class="htp-h">Buttons</div>
  ${row(`<span class="htp-btn">JUMP</span>`, "Jump")}
  ${row(`<span class="htp-btn">RUN</span>`, "Run", "Tap to turn running on or off")}
  ${row(`<span class="htp-btn">FIGHT</span>`, "Fight", "Becomes FIRE or STAB when you have a weapon out")}
  ${row(`<span class="htp-btn">✋ ACT</span>`, "Interact · talk · enter · use", "Appears when something is close enough")}
  ${row(`<span class="htp-btn">USE</span><span class="htp-btn">DROP</span><span class="htp-btn">THROW</span>`, "Item buttons", "Show up while you are holding something")}
  ${row(`<span class="htp-btn round">⋯</span>`, "Menu", "Sit, wardrobe, emotes, weapons, crouch, camera")}
  <div class="htp-h">Chat &amp; phone</div>
  ${row(`<span class="htp-btn">Aa</span>`, "Typing", "Chat uses the built-in game keyboard, so the screen never jumps")}
  <div class="htp-note">Joystick on the wrong side, or buttons too small? Open Settings → Controls to swap the joystick side, or Edit controls to drag and resize every button.</div>`;
}

function open(tab) {
  injectCss();
  HUD.sheet({
    title: "How to play",
    sub: "Keyboard · joystick · phone",
    sections: [],
    render: (body) => {
      body.innerHTML = `
        <div class="htp-tabs">
          <button type="button" class="htp-tab" data-t="kb">⌨ Keyboard</button>
          <button type="button" class="htp-tab" data-t="ph">📱 Phone &amp; joystick</button>
        </div>
        <div class="htp-pane" data-p="kb">${keyboardPane()}</div>
        <div class="htp-pane" data-p="ph">${phonePane()}</div>`;
      const show = (t) => {
        body.querySelectorAll(".htp-tab").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
        body.querySelectorAll(".htp-pane").forEach((p) => p.classList.toggle("on", p.dataset.p === t));
      };
      body.querySelectorAll(".htp-tab").forEach((b) => b.addEventListener("click", (ev) => { ev.stopPropagation(); show(b.dataset.t); }));
      const touch = tab || ((navigator.maxTouchPoints > 0 && matchMedia("(pointer:coarse)").matches) ? "ph" : "kb");
      show(touch);
    },
  });
}

export const HowToPlay = { open };
try { window.__ph3d_howToPlay = HowToPlay; } catch (e) {}
