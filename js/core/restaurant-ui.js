import { RESTAURANTS, FOOD_ITEMS, Restaurants } from "./restaurants.js";
import { Economy } from "./economy.js";
import { Pocket } from "./pocket.js";

const CSS_ID = "ph3d-rest-css";

export const RestaurantUI = {
  _built: false,
  _venue: null,
  _sel: null,

  _injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    const s = document.createElement("style");
    s.id = CSS_ID;
    s.textContent = `
      .rs-scrim{position:fixed;inset:0;z-index:64;background:rgba(3,6,12,.72);
        backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
        opacity:0;pointer-events:none;transition:opacity .3s}
      .rs-scrim.on{opacity:1;pointer-events:auto}
      .rs-sheet{position:fixed;left:50%;top:50%;z-index:65;
        transform:translate(-50%,-46%) scale(.94);
        width:min(94vw,520px);max-height:90vh;
        background:linear-gradient(165deg,#1a1210 0%,#0d0906 100%);
        color:#fff8ec;font-family:Inter,system-ui,sans-serif;
        border-radius:28px;overflow:hidden;
        border:1px solid rgba(255,180,90,.32);
        box-shadow:0 30px 90px rgba(0,0,0,.85);
        opacity:0;pointer-events:none;
        transition:all .35s cubic-bezier(.2,.9,.3,1.1);
        display:flex;flex-direction:column}
      .rs-sheet.on{opacity:1;pointer-events:auto;transform:translate(-50%,-50%) scale(1)}
      .rs-hdr{padding:20px 24px 14px;border-bottom:1px solid rgba(255,180,90,.2);
        position:relative;
        background:linear-gradient(180deg,rgba(255,140,60,.14),transparent)}
      .rs-hdr .nm{font-size:18px;font-weight:900;letter-spacing:.06em;color:#ffb15c}
      .rs-hdr .sb{font-size:10px;letter-spacing:.24em;color:rgba(255,248,236,.55);
        margin-top:4px;font-weight:700;text-transform:uppercase}
      .rs-hdr .tg{font-size:12px;color:rgba(255,248,236,.75);
        margin-top:8px;font-style:italic}
      .rs-hdr .vb{font-size:10px;color:rgba(255,180,90,.65);
        margin-top:4px;letter-spacing:.14em;font-weight:700;text-transform:uppercase}
      .rs-close{position:absolute;top:16px;right:18px;
        width:34px;height:34px;border-radius:50%;
        background:rgba(255,180,90,.12);border:1px solid rgba(255,180,90,.32);
        color:#ffb15c;font-weight:900;font-size:15px;cursor:pointer;
        display:flex;align-items:center;justify-content:center}
      .rs-close:active{transform:scale(.94)}
      .rs-bal{padding:12px 24px 6px;display:flex;justify-content:space-between;
        align-items:baseline;font-size:12px}
      .rs-bal .k{color:rgba(255,248,236,.55);letter-spacing:.18em;font-weight:800;
        text-transform:uppercase;font-size:10px}
      .rs-bal .v{font-weight:900;color:#7dff9b;font-size:16px}
      .rs-list{padding:10px 16px 16px;overflow-y:auto;flex:1}
      .rs-list::-webkit-scrollbar{width:0}
      .rs-item{display:flex;align-items:center;gap:14px;padding:14px 12px;
        border-radius:16px;margin-bottom:8px;
        background:rgba(255,248,236,.03);
        border:1px solid rgba(255,180,90,.14);
        cursor:pointer;transition:all .16s}
      .rs-item:active{transform:scale(.98)}
      .rs-item.on{border-color:#ffb15c;background:rgba(255,140,60,.12);
        box-shadow:0 0 0 3px rgba(255,180,90,.15)}
      .rs-item .ic{font-size:32px;line-height:1;flex-shrink:0;width:44px;text-align:center}
      .rs-item .tx{flex:1;min-width:0}
      .rs-item .nm{font-size:14px;font-weight:900;letter-spacing:.02em}
      .rs-item .ds{font-size:11px;color:rgba(255,248,236,.6);margin-top:3px;
        line-height:1.5;overflow:hidden;text-overflow:ellipsis;
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
      .rs-item .pr{font-size:13px;font-weight:900;color:#ffb15c;flex-shrink:0}
      .rs-item .hl{font-size:10px;color:#7dff9b;font-weight:800;margin-top:2px}
      .rs-acts{padding:10px 20px 22px;display:flex;gap:10px;
        border-top:1px solid rgba(255,180,90,.2);
        background:rgba(0,0,0,.25)}
      .rs-acts button{flex:1;padding:15px;border-radius:16px;cursor:pointer;
        font-family:inherit;font-size:12px;font-weight:900;letter-spacing:.14em;
        border:1px solid rgba(255,180,90,.3);
        background:transparent;color:rgba(255,248,236,.75);
        transition:all .15s}
      .rs-acts button:active{transform:scale(.96)}
      .rs-acts button.order{background:linear-gradient(135deg,#ffb15c,#ff8c3c);
        color:#2a1400;border:none}
      .rs-acts button:disabled{opacity:.35;cursor:not-allowed}
      .rs-note{padding:0 24px 14px;font-size:11px;text-align:center;
        color:rgba(255,248,236,.55);line-height:1.5}
      .rs-note .warn{color:#ff8080;font-weight:800}
      .rs-note .ok{color:#7dff9b;font-weight:800}
    `;
    document.head.appendChild(s);
  },

  _build() {
    if (this._built) return;
    this._injectCSS();
    const scrim = document.createElement("div");
    scrim.className = "rs-scrim"; scrim.id = "rs-scrim";
    scrim.addEventListener("click", () => this.close());
    document.body.appendChild(scrim);

    const sheet = document.createElement("div");
    sheet.className = "rs-sheet"; sheet.id = "rs-sheet";
    sheet.innerHTML = `
      <div class="rs-hdr">
        <div class="nm" id="rs-nm">RESTAURANT</div>
        <div class="sb" id="rs-sb">LOCATION</div>
        <div class="tg" id="rs-tg">tagline</div>
        <div class="vb" id="rs-vb">vibe</div>
        <div class="rs-close" id="rs-x">✕</div>
      </div>
      <div class="rs-bal">
        <span class="k">YOUR BALANCE</span>
        <span class="v" id="rs-bal">₦0</span>
      </div>
      <div class="rs-list" id="rs-list"></div>
      <div class="rs-note" id="rs-note">Tap a dish to select it.</div>
      <div class="rs-acts">
        <button class="order" id="rs-order" disabled>ORDER</button>
        <button id="rs-close-btn">CLOSE</button>
      </div>
    `;
    document.body.appendChild(sheet);
    this._sheet = sheet;
    document.getElementById("rs-x").onclick = () => this.close();
    document.getElementById("rs-close-btn").onclick = () => this.close();
    document.getElementById("rs-order").onclick = () => this._doOrder();
    this._built = true;
  },

  open(venueId) {
    this._build();
    this._venue = RESTAURANTS[venueId];
    this._sel = null;
    if (!this._venue) return;
    this._render();
    this._sheet.classList.add("on");
    document.getElementById("rs-scrim").classList.add("on");
  },
  close() {
    if (!this._sheet) return;
    this._sheet.classList.remove("on");
    document.getElementById("rs-scrim").classList.remove("on");
    this._sel = null;
  },

  _render() {
    const v = this._venue;
    if (!v) return;
    document.getElementById("rs-nm").textContent = v.name;
    document.getElementById("rs-sb").textContent = v.sub;
    document.getElementById("rs-tg").textContent = v.tagline;
    document.getElementById("rs-vb").textContent = v.vibe;
    document.getElementById("rs-bal").textContent = "₦" + Economy.balance.toLocaleString();

    const list = document.getElementById("rs-list");
    list.innerHTML = "";
    v.menu.forEach(foodId => {
      const food = FOOD_ITEMS[foodId];
      if (!food) return;
      const row = document.createElement("div");
      row.className = "rs-item" + (this._sel === foodId ? " on" : "");
      row.innerHTML = `
        <div class="ic">${food.icon}</div>
        <div class="tx">
          <div class="nm">${food.name}</div>
          <div class="ds">${food.desc}</div>
          <div class="hl">+${food.heal} HP</div>
        </div>
        <div class="pr">₦${food.price.toLocaleString()}</div>
      `;
      row.onclick = () => {
        this._sel = foodId;
        this._render();
      };
      list.appendChild(row);
    });

    const orderBtn = document.getElementById("rs-order");
    if (this._sel) {
      const food = FOOD_ITEMS[this._sel];
      orderBtn.disabled = false;
      orderBtn.textContent = "ORDER · ₦" + food.price.toLocaleString();
    } else {
      orderBtn.disabled = true;
      orderBtn.textContent = "ORDER";
    }

    document.getElementById("rs-note").textContent = "Tap a dish to select it.";
  },

  _doOrder() {
    const note = document.getElementById("rs-note");
    if (!this._sel || !this._venue) return;
    const res = Restaurants.order(this._venue.id, this._sel);
    if (!res.ok) {
      const msg = {
        no_restaurant: "Restaurant closed.",
        no_food: "Item not available.",
        not_on_menu: "Not on this menu.",
        low_rep: '<span class="warn">Not enough reputation for this venue.</span>',
        no_money: '<span class="warn">Not enough money.</span>',
        pocket_full: '<span class="warn">Pocket is full. Eat or drop something first.</span>',
      }[res.reason] || "Could not order.";
      note.innerHTML = msg;
      return;
    }
    note.innerHTML = '<span class="ok">Ordered ' + res.food.name + '.</span> ' +
      res.food.icon + ' is now in your pocket.';
    document.getElementById("rs-bal").textContent = "₦" + Economy.balance.toLocaleString();
    if (window.__ph3d_phone) window.__ph3d_phone._toast("🍽 " + res.food.name + " ordered");
    this._sel = null;
    this._render();
  },
};

