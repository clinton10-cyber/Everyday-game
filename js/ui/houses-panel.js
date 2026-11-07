const CSS_ID = "ph3d-houses-css";

export const HousesPanel = {
  _built: false,

  _injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    const s = document.createElement("style");
    s.id = CSS_ID;
    s.textContent = `
      #ph3d-houses{position:fixed;inset:0;z-index:70;display:none}
      #ph3d-houses.on{display:block}
      .hs-scrim{position:absolute;inset:0;background:rgba(3,6,12,.72);backdrop-filter:blur(8px)}
      .hs-sheet{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        width:min(94vw,480px);max-height:88vh;
        background:linear-gradient(165deg,#0d1420,#080c12);color:#eaf6ff;
        font-family:Inter,system-ui,sans-serif;border-radius:26px;overflow:hidden;
        border:1px solid rgba(94,224,255,.35);box-shadow:0 30px 90px rgba(0,0,0,.85);
        display:flex;flex-direction:column}
      .hs-hdr{padding:18px 22px 12px;display:flex;justify-content:space-between;
        align-items:center;border-bottom:1px solid rgba(94,224,255,.14)}
      .hs-t{font-size:13px;font-weight:900;letter-spacing:.18em;color:#5ee0ff}
      .hs-x{width:32px;height:32px;border-radius:50%;background:rgba(94,224,255,.1);
        border:1px solid rgba(94,224,255,.3);color:#eaf6ff;font-weight:900;
        display:flex;align-items:center;justify-content:center;cursor:pointer}
      .hs-list{padding:14px 16px;overflow-y:auto;flex:1}
      .hs-row{padding:14px 16px;border-radius:16px;background:rgba(255,255,255,.03);
        border:1px solid rgba(255,255,255,.08);margin-bottom:8px}
      .hs-row.owned{border-color:rgba(125,255,155,.4);background:rgba(125,255,155,.06)}
      .hs-row.home{border-color:#5ee0ff;background:rgba(94,224,255,.1)}
      .hs-name{font-size:14px;font-weight:900}
      .hs-desc{font-size:11px;color:rgba(234,246,255,.55);margin-top:3px}
      .hs-price{font-size:15px;font-weight:900;color:#ffcc5e;margin-top:6px}
      .hs-acts{margin-top:10px;display:flex;gap:8px}
      .hs-btn{padding:9px 14px;border-radius:12px;border:none;cursor:pointer;
        font-family:inherit;font-size:10px;font-weight:900;letter-spacing:.14em}
      .hs-buy{background:linear-gradient(135deg,#7dff9b,#4ade80);color:#031a0d}
      .hs-home{background:linear-gradient(135deg,#5ee0ff,#4ab6ff);color:#04121c}
      .hs-tag{padding:5px 10px;border-radius:8px;font-size:9px;font-weight:900;
        letter-spacing:.14em;background:rgba(255,255,255,.1);color:rgba(234,246,255,.8)}
      .hs-foot{padding:12px 22px 18px;border-top:1px solid rgba(94,224,255,.14);
        font-size:12px;color:rgba(234,246,255,.7);display:flex;justify-content:space-between}
      .hs-foot b{color:#7dff9b;font-size:15px}
    `;
    document.head.appendChild(s);
  },

  async show() {
    this._injectCSS();
    const { Houses } = await import("../core/houses.js");
    const { Economy } = await import("../core/economy.js");

    if (!this._built) {
      const wrap = document.createElement("div");
      wrap.id = "ph3d-houses";
      wrap.innerHTML = `
        <div class="hs-scrim"></div>
        <div class="hs-sheet">
          <div class="hs-hdr">
            <div class="hs-t">PROPERTY</div>
            <div class="hs-x" id="hs-x">X</div>
          </div>
          <div class="hs-list" id="hs-list"></div>
          <div class="hs-foot">
            <span>BALANCE <b id="hs-bal">0</b></span>
            <span id="hs-count">0 OWNED</span>
          </div>
        </div>
      `;
      document.body.appendChild(wrap);
      document.getElementById("hs-x").onclick = () => this.hide();
      wrap.querySelector(".hs-scrim").onclick = () => this.hide();
      this._built = true;
    }

    const render = () => {
      const list = document.getElementById("hs-list");
      document.getElementById("hs-bal").textContent = Economy.balance.toLocaleString();
      const owned = Houses.owned();
      const home = Houses.home();
      document.getElementById("hs-count").textContent = owned.length + " OWNED";
      let h = "";
      Houses.catalog().forEach(c => {
        const isOwned = owned.indexOf(c.id) >= 0;
        const isHome = home === c.id;
        const cls = "hs-row" + (isOwned ? " owned" : "") + (isHome ? " home" : "");
        h += '<div class="' + cls + '">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start">'
          + '<div style="flex:1"><div class="hs-name">' + c.name + '</div>'
          + '<div class="hs-desc">' + c.desc + ' · ' + c.beds + ' bed</div></div>'
          + (isHome ? '<span class="hs-tag">HOME</span>' : (isOwned ? '<span class="hs-tag">OWNED</span>' : ''))
          + '</div>'
          + '<div class="hs-price">' + (c.price === 0 ? "FREE (STARTER)" : c.price.toLocaleString()) + '</div>'
          + '<div class="hs-acts">';
        if (!isOwned) {
          h += '<button class="hs-btn hs-buy" data-buy="' + c.id + '">BUY</button>';
        } else if (!isHome) {
          h += '<button class="hs-btn hs-home" data-home="' + c.id + '">SET AS HOME</button>';
        }
        h += '</div></div>';
      });
      list.innerHTML = h;
      list.querySelectorAll("button[data-buy]").forEach(b => {
        b.onclick = async () => {
          const res = await Houses.buy(b.dataset.buy);
          if (!res.ok) {
            if (window.__ph3d_phone) {
              window.__ph3d_phone._toast(res.reason === "no_money" ? "Not enough money" : "Cannot buy");
            }
            return;
          }
          if (window.__ph3d_phone) window.__ph3d_phone._toast("Bought " + res.house.name);
          render();
        };
      });
      list.querySelectorAll("button[data-home]").forEach(b => {
        b.onclick = async () => {
          await Houses.setHome(b.dataset.home);
          render();
          if (window.__ph3d_phone) window.__ph3d_phone._toast("Home updated");
        };
      });
    };

    document.getElementById("ph3d-houses").classList.add("on");
    render();
  },

  hide() {
    const el = document.getElementById("ph3d-houses");
    if (el) el.classList.remove("on");
  },
};

