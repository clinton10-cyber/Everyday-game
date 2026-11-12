/* js/ui/market-shop.js -- the Mile 1 buy modal. Touch-first, landscape-friendly, no emoji.
   MarketShop.open(item) from a stall's USE prompt. Close with X, CLOSE, tapping outside, or Escape. */
import { Economy } from "../core/economy.js";
import { Pocket, POCKET_ITEMS } from "../core/pocket.js";
import { Combat } from "../core/combat.js";
import { Engagement } from "../core/engagement.js";

const CSS_ID = "ph3d-market-shop-css", ROOT_ID = "ph3d-market-shop";
const fmt = (n) => "\u20A6" + Math.floor(n).toLocaleString();

function injectCSS() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement("style"); s.id = CSS_ID;
  s.textContent = `
  #${ROOT_ID}{--paper:#0b110e;--paper2:#121c16;--ink:#f3f1e8;--mist:#9db0a6;--line:rgba(243,241,232,.16);--line-hi:rgba(243,241,232,.32);
    --gold:#ffc62b;--gold-ink:#1b1400;--green:#35d07f;--red:#ff5a3c;
    position:fixed;inset:0;z-index:82;display:none;align-items:center;justify-content:center;
    background:rgba(3,6,10,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
    font-family:"Archivo",system-ui,-apple-system,sans-serif;color:var(--ink);touch-action:manipulation;user-select:none;-webkit-user-select:none}
  #${ROOT_ID}.on{display:flex}
  #${ROOT_ID} .sheet{position:relative;width:min(560px,92vw);max-height:88vh;overflow:auto;background:linear-gradient(165deg,var(--paper2),var(--paper));
    border:1px solid var(--line-hi);border-radius:22px;padding:18px;display:grid;grid-template-columns:84px 1fr;gap:12px 16px;box-shadow:0 22px 60px rgba(0,0,0,.7);
    transform:translateY(8px);opacity:0;transition:transform .22s cubic-bezier(.2,.8,.2,1),opacity .22s}
  #${ROOT_ID}.on .sheet{transform:none;opacity:1}
  #${ROOT_ID} .x{position:absolute;top:10px;right:10px;width:44px;height:44px;border-radius:50%;border:1px solid var(--line-hi);background:var(--paper);color:var(--ink);font:700 20px/1 inherit;cursor:pointer}
  #${ROOT_ID} .icon{width:84px;height:84px;border-radius:20px;display:grid;place-items:center;font:800 30px/1 inherit;letter-spacing:.04em;color:var(--gold);background:rgba(255,255,255,.06);border:1px solid var(--line)}
  #${ROOT_ID} .col{display:flex;flex-direction:column;gap:4px;min-width:0;padding-right:44px}
  #${ROOT_ID} .kind{font:800 9px/1 inherit;letter-spacing:.24em;text-transform:uppercase;color:var(--mist)}
  #${ROOT_ID} .name{font:800 20px/1.1 inherit}
  #${ROOT_ID} .desc{font:600 12px/1.4 inherit;color:var(--mist)}
  #${ROOT_ID} .price{font:800 22px/1 inherit;color:var(--green);font-variant-numeric:tabular-nums;margin-top:8px}
  #${ROOT_ID} .price small{font:700 11px/1 inherit;color:var(--mist);margin-left:8px;letter-spacing:.06em}
  #${ROOT_ID} .acts{display:flex;gap:8px;flex-wrap:wrap;grid-column:1/-1;margin-top:4px}
  #${ROOT_ID} .btn{flex:1 1 auto;min-width:110px;min-height:48px;padding:0 18px;border-radius:14px;font:800 13px/1 inherit;cursor:pointer;border:1px solid transparent}
  #${ROOT_ID} .btn.buy{background:var(--gold);color:var(--gold-ink)}
  #${ROOT_ID} .btn.eat{background:var(--green);color:#031a0d}
  #${ROOT_ID} .btn.close{background:transparent;color:var(--mist);border-color:var(--line);flex:0 0 auto}
  #${ROOT_ID} .btn:active{transform:scale(.97)}
  #${ROOT_ID} .btn[disabled]{opacity:.4;cursor:not-allowed}
  #${ROOT_ID} .bag{grid-column:1/-1;font:700 11px/1.4 inherit;color:var(--mist);display:flex;gap:12px;justify-content:space-between;padding-top:10px;border-top:1px solid var(--line)}
  #${ROOT_ID} .bag b{color:var(--ink);font-weight:800;font-variant-numeric:tabular-nums}
  #${ROOT_ID} .toast{grid-column:1/-1;min-height:16px;font:700 12px/1.3 inherit;color:var(--green)}
  #${ROOT_ID} .toast.err{color:var(--red)}`;
  document.head.appendChild(s);
}

const stacked = (id) => { try { return (POCKET_ITEMS[id] || {}).stackable && Pocket.slots.some((s) => s && s.id === id); } catch (e) { return false; } };
const canAdd = (id) => !Pocket.isFull() || stacked(id);

export const MarketShop = {
  _root: null, _item: null,

  _build() {
    if (this._root && document.body.contains(this._root)) return;
    injectCSS();
    const root = document.createElement("div"); root.id = ROOT_ID;
    root.innerHTML = `<div class="sheet">
      <button class="x" aria-label="Close">&times;</button>
      <div class="icon" data-icon></div>
      <div class="col"><div class="kind" data-kind></div><div class="name" data-name></div><div class="desc" data-desc></div><div class="price" data-price></div></div>
      <div class="acts"><button class="btn buy" data-buy>BUY</button><button class="btn eat" data-eat style="display:none">BUY AND EAT</button><button class="btn close" data-close>CLOSE</button></div>
      <div class="bag"><span>Bag <b data-bag></b></span><span>Money <b data-money></b></span></div>
      <div class="toast" data-toast></div></div>`;
    document.body.appendChild(root); this._root = root;
    root.querySelector(".x").addEventListener("click", () => this.close());
    root.querySelector("[data-close]").addEventListener("click", () => this.close());
    root.querySelector("[data-buy]").addEventListener("click", () => this._buy(false));
    root.querySelector("[data-eat]").addEventListener("click", () => this._buy(true));
    root.addEventListener("pointerdown", (e) => { if (e.target === root) this.close(); });
    if (!this._key) { this._key = (e) => { if (e.key === "Escape") this.close(); }; window.addEventListener("keydown", this._key); }
  },

  open(item) {
    if (!item) return;
    this._build(); this._item = item;
    const r = this._root, q = (s) => r.querySelector(s);
    q("[data-icon]").textContent = item.icon || "";
    q("[data-kind]").textContent = item.kind + " \u00B7 Mile 1 only";
    q("[data-name]").textContent = item.label; q("[data-desc]").textContent = item.desc;
    q("[data-price]").innerHTML = fmt(item.price) + (item.heal ? "<small>+" + item.heal + " HP</small>" : "");
    q("[data-eat]").style.display = item.kind === "food" ? "" : "none";
    this._toast(""); this._refresh(); r.classList.add("on");
  },

  close() { if (this._root) this._root.classList.remove("on"); this._item = null; },

  _refresh() {
    const r = this._root, it = this._item; if (!r || !it) return;
    r.querySelector("[data-bag]").textContent = Pocket.count() + "/8";
    r.querySelector("[data-money]").textContent = fmt(Economy.balance);
    const poor = Economy.balance < it.price;
    r.querySelector("[data-buy]").disabled = poor || !canAdd(it.id);
    r.querySelector("[data-eat]").disabled = poor;
  },

  _buy(eat) {
    const it = this._item; if (!it) return;
    if (Economy.balance < it.price) return this._toast("Not enough money.", true);
    if (!eat && !canAdd(it.id)) return this._toast("Bag is full.", true);
    if (!Economy.withdraw(it.price)) return this._toast("Payment failed.", true);

    if (eat && it.kind === "food") {
      try { Combat.heal(it.heal || 5); } catch (e) {}
      this._toast("You eat the " + it.label.toLowerCase() + ". +" + (it.heal || 5) + " HP.");
    } else {
      Pocket.add(it.id, 1);
      this._toast("Bought " + it.label.toLowerCase() + ".");
    }
    try {
      Engagement.collect("mile1", it.id);   /* every unique item counts toward the Mile 1 collection */
      if (it.heatReduce) Engagement.setFlag("jujuProtection", true);
      if (it.flag) Engagement.setFlag(it.flag, true);
      Engagement.track("market_purchase", { id: it.id, price: it.price, kind: it.kind });
    } catch (e) {}
    this._refresh();
  },

  _toast(msg, err) {
    const el = this._root && this._root.querySelector("[data-toast]"); if (!el) return;
    el.textContent = msg || ""; el.classList.toggle("err", !!err);
  },
};
window.__ph3d_marketShop = MarketShop;
