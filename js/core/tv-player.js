/* ════════════════════════════════════════════════════════════════
   tv-player.js — in-game television.
   Every "WATCH TV" interaction opens this set. Each channel plays one of the
   standalone cinematic story pages from the project root (story-01 … story-05)
   inside the TV screen, plus CH 6 = the Story Guide (stories.html).

   API:  TV.open(channelIndex?)   TV.close()   TV.isOpen()
   ════════════════════════════════════════════════════════════════ */

export const TV_CHANNELS = [
  { ch: 1, name: "THE FIRST DAY",            tag: "DRAMA",    file: "story-01-the-first-day.html" },
  { ch: 2, name: "THE NIGHT DRIVE",          tag: "THRILLER", file: "story-02-the-night-drive.html" },
  { ch: 3, name: "A PLEASURE PARK PROMISE",  tag: "FRIENDS",  file: "story-03-a-pleasure-park-promise.html" },
  { ch: 4, name: "THE PRESIDENTIAL SUITE",   tag: "BUSINESS", file: "story-04-the-presidential-suite.html" },
  { ch: 5, name: "THE MISSING BRIEFCASE",    tag: "MYSTERY",  file: "story-05-the-missing-briefcase.html" },
  { ch: 6, name: "STORY GUIDE",              tag: "ALL SHOWS", file: "stories.html" },
];

const LS_KEY = "ph3d.tv.channel";
const CSS_ID = "ph3d-tv-css";
let root = null, frame = null, idx = 0, loadTimer = null;

const url = (file) => { try { return new URL(file, document.baseURI).href; } catch (_) { return file; } };

function injectCSS() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement("style"); s.id = CSS_ID;
  s.textContent = `
  #ph3d-tv{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;
    background:rgba(2,4,8,.88);backdrop-filter:blur(6px);font-family:Inter,system-ui,sans-serif;color:#eaf6ff}
  #ph3d-tv .tv-set{width:min(96vw,980px);max-height:96vh;display:flex;flex-direction:column;gap:8px;
    background:linear-gradient(160deg,#1b1f27,#0b0d12);border-radius:22px;padding:12px 12px 10px;
    border:1px solid rgba(255,255,255,.12);box-shadow:0 30px 90px #000}
  #ph3d-tv .tv-top{display:flex;align-items:center;gap:10px;padding:0 4px}
  #ph3d-tv .tv-ch{font-weight:900;font-size:13px;letter-spacing:.14em;color:#7dff9b}
  #ph3d-tv .tv-name{flex:1;min-width:0;font-weight:800;font-size:12px;letter-spacing:.1em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #ph3d-tv .tv-tag{font-size:9px;font-weight:800;letter-spacing:.14em;color:#5ee0ff;border:1px solid rgba(94,224,255,.4);padding:3px 7px;border-radius:99px}
  #ph3d-tv .tv-screen{position:relative;width:100%;aspect-ratio:16/9;max-height:72vh;background:#000;border-radius:12px;overflow:hidden;
    box-shadow:inset 0 0 0 2px #000,0 0 0 1px rgba(255,255,255,.08)}
  #ph3d-tv iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#000}
  #ph3d-tv .tv-static{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
    background:repeating-linear-gradient(0deg,#111 0 2px,#1d1d1d 2px 4px);font-weight:900;letter-spacing:.2em;font-size:12px;color:#9aa;
    animation:tvFlick .12s steps(2) infinite;pointer-events:none;transition:opacity .35s}
  #ph3d-tv .tv-static.off{opacity:0}
  @keyframes tvFlick{0%{filter:brightness(.8)}100%{filter:brightness(1.15)}}
  #ph3d-tv .tv-bar{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap}
  #ph3d-tv button{font:inherit;font-size:11px;font-weight:900;letter-spacing:.12em;color:#eaf6ff;cursor:pointer;
    padding:9px 14px;border-radius:12px;border:1px solid rgba(94,224,255,.3);background:rgba(94,224,255,.08)}
  #ph3d-tv button:active{transform:scale(.96)}
  #ph3d-tv button.off{border-color:rgba(255,91,101,.5);background:rgba(255,91,101,.12);color:#ffb3b8}
  #ph3d-tv .tv-list{display:flex;gap:6px;overflow-x:auto;padding:2px 2px 4px}
  #ph3d-tv .tv-list button{white-space:nowrap;padding:7px 10px;font-size:10px}
  #ph3d-tv .tv-list button.on{background:#7dff9b;color:#031a0d;border-color:transparent}
  `;
  document.head.appendChild(s);
}

function holdGame(on) {
  try { window.__ph3d_walkCtrl && window.__ph3d_walkCtrl.setPhoneHold(on); } catch (_) {}
  window.__ph3d_tvOpen = !!on;
}

function tidyFrame() {
  /* the stories are same-origin: hide links that would load the whole game inside the TV */
  try {
    const d = frame.contentDocument; if (!d) return;
    d.querySelectorAll('a[href$="index.html"],a[href="./"],a[href="/"]').forEach(a => { a.style.display = "none"; });
    /* stories.html lists the shows: keep clicks inside the TV and sync the channel */
    d.querySelectorAll("a[href]").forEach(a => {
      const f = (a.getAttribute("href") || "").split("?")[0];
      const i = TV_CHANNELS.findIndex(c => c.file === f);
      if (i >= 0) a.addEventListener("click", (e) => { e.preventDefault(); tune(i); });
    });
  } catch (_) {}
}

function tune(i) {
  idx = (i + TV_CHANNELS.length) % TV_CHANNELS.length;
  try { localStorage.setItem(LS_KEY, String(idx)); } catch (_) {}
  const c = TV_CHANNELS[idx];
  root.querySelector(".tv-ch").textContent = "CH " + c.ch;
  root.querySelector(".tv-name").textContent = c.name;
  root.querySelector(".tv-tag").textContent = c.tag;
  root.querySelectorAll(".tv-list button").forEach((b, n) => b.classList.toggle("on", n === idx));
  const st = root.querySelector(".tv-static"); st.classList.remove("off");
  st.firstChild.textContent = "TUNING · CH " + c.ch;
  frame.onload = () => { clearTimeout(loadTimer); st.classList.add("off"); tidyFrame(); };
  frame.src = "about:blank";
  clearTimeout(loadTimer);
  loadTimer = setTimeout(() => { frame.src = url(c.file); }, 260);   /* a short "static" before the picture */
}

export const TV = {
  isOpen() { return !!root; },

  open(startIndex) {
    if (root) return;
    injectCSS();
    let saved = 0; try { saved = parseInt(localStorage.getItem(LS_KEY) || "0", 10) || 0; } catch (_) {}
    root = document.createElement("div"); root.id = "ph3d-tv";
    root.innerHTML = `
      <div class="tv-set">
        <div class="tv-top"><span class="tv-ch"></span><span class="tv-name"></span><span class="tv-tag"></span></div>
        <div class="tv-screen">
          <iframe title="Television" allow="autoplay; fullscreen" referrerpolicy="same-origin"></iframe>
          <div class="tv-static"><span></span><span style="font-size:9px;opacity:.7">EVERYDAY TV</span></div>
        </div>
        <div class="tv-list">${TV_CHANNELS.map((c, n) => `<button data-n="${n}">${c.ch} · ${c.name}</button>`).join("")}</div>
        <div class="tv-bar">
          <button data-a="prev">▼ CH</button>
          <button data-a="next">CH ▲</button>
          <button data-a="full">FULLSCREEN</button>
          <button data-a="off" class="off">⏻ TURN OFF</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    frame = root.querySelector("iframe");
    root.querySelectorAll(".tv-list button").forEach(b => b.onclick = () => tune(+b.dataset.n));
    root.querySelector('[data-a="prev"]').onclick = () => tune(idx - 1);
    root.querySelector('[data-a="next"]').onclick = () => tune(idx + 1);
    root.querySelector('[data-a="off"]').onclick = () => TV.close();
    root.querySelector('[data-a="full"]').onclick = () => {
      const el = root.querySelector(".tv-screen");
      try { (document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen && el.requestFullscreen()); } catch (_) {}
    };
    this._key = (e) => { if (e.code === "Escape") { e.preventDefault(); TV.close(); } };
    window.addEventListener("keydown", this._key, true);
    holdGame(true);
    tune(Number.isFinite(startIndex) ? startIndex : saved);
  },

  close() {
    if (!root) return;
    clearTimeout(loadTimer);
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (_) {}
    try { frame.src = "about:blank"; } catch (_) {}           /* stops the story's 3D scene and audio */
    window.removeEventListener("keydown", this._key, true);
    root.remove(); root = frame = null;
    holdGame(false);
  },
};

window.__ph3d_tv = TV;
