import { Wardrobe, WARDROBE_TABS, COSTUME_INFO } from "./wardrobe.js";

const CSS = `
.wd-scrim{position:fixed;inset:0;z-index:55;background:rgba(3,6,12,.72);
  backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .3s}
.wd-scrim.on{opacity:1;pointer-events:auto}
.wd-sheet{position:fixed;left:0;right:0;bottom:0;z-index:56;
  max-width:520px;margin:0 auto;border-radius:26px 26px 0 0;
  background:#0c1018;color:#eaf6ff;
  font-family:Inter,system-ui,sans-serif;
  border:1px solid rgba(94,224,255,.28);border-bottom:0;
  box-shadow:0 -22px 60px rgba(0,0,0,.75);
  transform:translateY(105%);
  transition:transform .38s cubic-bezier(.2,.9,.3,1.05);
  padding-bottom:calc(env(safe-area-inset-bottom) + 12px)}
.wd-sheet.on{transform:translateY(0)}
.wd-hdr{padding:14px 20px 8px;display:flex;align-items:center;justify-content:space-between;
  border-bottom:1px solid rgba(94,224,255,.14)}
.wd-hdr h3{margin:0;font-size:13px;font-weight:900;letter-spacing:.16em;
  text-transform:uppercase;color:#5ee0ff}
.wd-close{width:34px;height:34px;border-radius:50%;
  background:rgba(94,224,255,.10);border:1px solid rgba(94,224,255,.3);
  color:#eaf6ff;font-weight:900;font-size:15px;cursor:pointer;
  display:flex;align-items:center;justify-content:center}
.wd-close:active{transform:scale(.94)}
.wd-tabs{display:flex;gap:6px;overflow-x:auto;padding:10px 16px;
  border-bottom:1px solid rgba(94,224,255,.10);scrollbar-width:none}
.wd-tabs::-webkit-scrollbar{display:none}
.wd-tab{flex:0 0 auto;padding:8px 14px;border-radius:999px;
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);
  color:rgba(234,246,255,.7);font-size:10px;font-weight:800;letter-spacing:.14em;
  text-transform:uppercase;cursor:pointer;transition:.16s}
.wd-tab.on{background:rgba(94,224,255,.20);border-color:#5ee0ff;color:#fff}
.wd-body{padding:14px 18px 18px;max-height:52vh;overflow-y:auto}
.wd-body::-webkit-scrollbar{width:0}
.wd-sec{margin-bottom:18px}
.wd-sec .lbl{font-size:10px;letter-spacing:.22em;text-transform:uppercase;
  color:rgba(234,246,255,.5);font-weight:800;margin-bottom:8px}
.wd-row{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
.wd-row::-webkit-scrollbar{display:none}
.wd-sw{flex:0 0 auto;width:36px;height:36px;border-radius:12px;cursor:pointer;
  border:2px solid rgba(255,255,255,.13);transition:.16s}
.wd-sw.on{border-color:#5ee0ff;box-shadow:0 0 0 3px rgba(94,224,255,.22)}
.wd-pill{flex:0 0 auto;padding:9px 14px;border-radius:999px;
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);
  color:rgba(234,246,255,.85);font-size:11px;font-weight:800;letter-spacing:.1em;
  cursor:pointer;transition:.16s;text-transform:uppercase}
.wd-pill.on{background:rgba(94,224,255,.20);border-color:#5ee0ff;color:#fff}
.wd-sw.auto{display:flex;align-items:center;justify-content:center;font-size:15px;background:rgba(255,255,255,.06)}
.wd-sw.custom{position:relative;overflow:hidden;background:conic-gradient(#f43f5e,#f59e0b,#84cc16,#06b6d4,#6366f1,#d946ef,#f43f5e)}
.wd-sw.custom input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;border:0;padding:0}
.wd-note{font-size:10px;color:#ffb36b;margin-top:6px}
.wd-foot{padding:12px 18px 4px;display:flex;gap:10px;
  border-top:1px solid rgba(94,224,255,.10)}
.wd-foot button{flex:1;padding:13px;border-radius:14px;cursor:pointer;
  border:1px solid rgba(255,255,255,.12);
  background:transparent;color:rgba(234,246,255,.75);
  font-family:inherit;font-size:11px;font-weight:800;letter-spacing:.16em}
.wd-foot button.acc{background:linear-gradient(135deg,#5ee0ff,#4ab6ff);
  color:#04121c;border:none}
.wd-foot button:active{transform:scale(.97)}
`;

export class WardrobeUI {
  constructor(applyFn) {
    this._applyFn = applyFn;
    this._pending = null; this._raf = 0;
    this.tab = "body";
    this._injectCSS();
    this._build();
    Wardrobe.onChange(() => this._rerender());
  }

  _injectCSS() {
    if (document.getElementById("ph3d-wd-css")) return;
    const s = document.createElement("style");
    s.id = "ph3d-wd-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  _build() {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="wd-scrim" id="wd-scrim"></div>
      <div class="wd-sheet" id="wd-sheet">
        <div class="wd-hdr">
          <h3>YOUR LOOK</h3>
          <div class="wd-close" id="wd-close">✕</div>
        </div>
        <div class="wd-tabs" id="wd-tabs"></div>
        <div class="wd-body" id="wd-body"></div>
        <div class="wd-foot">
          <button id="wd-reset">RESET</button>
          <button id="wd-rand">RANDOM</button>
          <button class="acc" id="wd-done">DONE</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    this.scrimEl = document.getElementById("wd-scrim");
    this.sheetEl = document.getElementById("wd-sheet");
    this.tabsEl  = document.getElementById("wd-tabs");
    this.bodyEl  = document.getElementById("wd-body");

    this.scrimEl.onclick = () => this.close();
    document.getElementById("wd-close").onclick = () => this.close();
    document.getElementById("wd-done").onclick  = () => this.close();
    document.getElementById("wd-reset").onclick = () => Wardrobe.reset();
    document.getElementById("wd-rand").onclick  = () => Wardrobe.randomize();

    this._buildTabs();
    this._rerender();
  }

  _buildTabs() {
    this.tabsEl.innerHTML = "";
    for (const t of WARDROBE_TABS) {
      const b = document.createElement("div");
      b.className = "wd-tab" + (this.tab === t.id ? " on" : "");
      b.textContent = (t.id === "costume" ? "🎃 " : "") + t.label.toUpperCase();
      b.onclick = () => { this.tab = t.id; this._buildTabs(); this._rerender(); };
      this.tabsEl.appendChild(b);
    }
  }

  /* Instant apply: colour / pattern picks only touch materials (no rebuild);
     anything structural is rebuilt once per frame, however fast you tap. */
  apply(cfg, key) {
    const FAST = /^(skinTone|hairColor|shoeColor|eyeColor|lipColor|topColor|topAccent|topPattern|bottomColor|bottomAccent|bottomPattern|hat\.color|glasses\.color)$/;
    if (key && FAST.test(key)) { try { this._applyFn(cfg, key); } catch (e) {} return; }
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = 0; try { this._applyFn(Wardrobe.config, null); } catch (e) {} });
  }

  _set(path, v) { Wardrobe.set(path, v); this.apply(Wardrobe.config, path); }

  _swatchRow(colors, cur, onPick, auto, size = 36) {
    const row = document.createElement("div");
    row.className = "wd-row";
    const mk = (cls, bg) => { const d = document.createElement("div"); d.className = "wd-sw " + cls; d.style.width = d.style.height = size + "px"; if (bg) d.style.background = bg; row.appendChild(d); return d; };
    if (auto) { const d = mk("auto" + (cur == null ? " on" : "")); d.textContent = "↺"; d.title = auto; d.onclick = () => onPick(null); }
    colors.forEach((c, i) => { const d = mk(cur === i ? "on" : "", c); d.onclick = () => onPick(i); });
    const isC = typeof cur === "string";
    const cu = mk("custom" + (isC ? " on" : ""), isC ? cur : null);
    const inp = document.createElement("input"); inp.type = "color";
    inp.value = isC ? cur : (colors[typeof cur === "number" ? cur : 0] || "#888888");
    inp.onchange = () => onPick(inp.value);
    cu.appendChild(inp);
    return row;
  }

  _pillRow(options, current, onPick, icons) {
    const row = document.createElement("div");
    row.className = "wd-row";
    options.forEach(opt => {
      const b = document.createElement("div");
      b.className = "wd-pill" + (opt === current ? " on" : "");
      b.textContent = (icons && icons[opt] ? icons[opt] + " " : "") + opt;
      b.onclick = () => onPick(opt);
      row.appendChild(b);
    });
    return row;
  }

  _section(label) {
    const d = document.createElement("div");
    d.className = "wd-sec";
    if (label) {
      const l = document.createElement("div");
      l.className = "lbl";
      l.textContent = label;
      d.appendChild(l);
    }
    return d;
  }

  _rerender() {
    const cfg = Wardrobe.config;
    const body = this.bodyEl;
    const _sc = body.scrollTop;
    body.innerHTML = "";
    const tab = WARDROBE_TABS.find(t => t.id === this.tab) || WARDROBE_TABS[0];
    const get = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), cfg);
    for (const gr of tab.groups) {
      if (gr.when && !gr.when(cfg)) continue;
      const s = this._section(gr.label.toUpperCase());
      if (gr.kind === "pills") {
        s.appendChild(this._pillRow(gr.options, cfg[gr.key], (o) => this._set(gr.key, o)));
        const n = gr.note && gr.note(cfg);
        if (n) { const d = document.createElement("div"); d.className = "wd-note"; d.textContent = n; s.appendChild(d); }
      } else if (gr.kind === "color") {
        s.appendChild(this._swatchRow(gr.palette, get(gr.key), (v) => this._set(gr.key, v), gr.auto));
      } else if (gr.kind === "slider") {
        const inp = document.createElement("input");
        inp.type = "range"; inp.min = gr.min; inp.max = gr.max; inp.step = gr.step; inp.value = +get(gr.key) || 0;
        inp.style.width = "100%";
        inp.oninput = () => { Wardrobe.set(gr.key, parseFloat(inp.value)); this.apply(Wardrobe.config, null); };
        s.appendChild(inp);
      } else {
        const isCos = gr.kind === "costume";
        const cur = get(gr.key);
        const curStyle = isCos ? (cur || "none") : (cur && cur.style) || "none";
        const icons = isCos ? Object.fromEntries(Object.entries(COSTUME_INFO).map(([k, v]) => [k, v.icon])) : null;
        s.appendChild(this._pillRow(["none", ...gr.options], curStyle, (o) => {
          if (isCos) Wardrobe.set("costume", o === "none" ? null : o); else Wardrobe.setItem(gr.key, o);
          this.apply(Wardrobe.config);
        }, icons));
        if (!isCos && cur && gr.colors) for (const cc of gr.colors) {
          const l = document.createElement("div"); l.className = "lbl"; l.style.marginTop = "8px"; l.textContent = cc.label.toUpperCase();
          s.appendChild(l);
          s.appendChild(this._swatchRow(cc.palette, cur[cc.sub], (v) => this._set(gr.key + "." + cc.sub, v), cc.auto));
        }
      }
      body.appendChild(s);
    }
    body.scrollTop = _sc;
  }

  open()  { this.sheetEl.classList.add("on"); this.scrimEl.classList.add("on"); }
  close() { this.sheetEl.classList.remove("on"); this.scrimEl.classList.remove("on"); }
  toggle(){ this.sheetEl.classList.contains("on") ? this.close() : this.open(); }
}

