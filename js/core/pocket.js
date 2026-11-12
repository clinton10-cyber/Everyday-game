import { Sfx } from "./sfx.js";
const KEY = "ph3d.pocket.v2";
export const POCKET_SIZE = 8;

export const POCKET_ITEMS = {
  cash:      { id:"cash",      name:"CASH",       icon:"\uD83D\uDCB5", size:0.2, value:500,   stackable:true,  desc:"Withdrawn from an ATM." },
  coin:      { id:"coin",      name:"COIN",       icon:"\uD83E\uDE99", size:0.1, value:50,    stackable:true,  desc:"Small change." },
  ring:      { id:"ring",      name:"GOLD RING",  icon:"\uD83D\uDC8D", size:0.1, value:24000, desc:"Shiny." },
  watch:     { id:"watch",     name:"WATCH",      icon:"\u231A", size:0.3, value:80000, desc:"Expensive-looking." },
  jewel:     { id:"jewel",     name:"JEWEL",      icon:"\uD83D\uDC8E", size:0.15,value:90000, desc:"Cut and polished." },
  phone:     { id:"phone",     name:"PHONE",      icon:"\uD83D\uDCF1", size:0.4, value:15000, desc:"Still has charge." },
  key_house: { id:"key_house", name:"HOUSE KEY",  icon:"\uD83D\uDD11", size:0.2, value:2000,  desc:"Opens your front door." },
  note:      { id:"note",      name:"NOTE",       icon:"\uD83D\uDCDD", size:0.05,value:0,     desc:"Just paper." },
  cigarette: { id:"cigarette", name:"CIGARETTE",  icon:"\uD83D\uDEAC", size:0.05,value:120,   stackable:true, desc:"Habit." },
  lighter:   { id:"lighter",   name:"LIGHTER",    icon:"\uD83D\uDD25", size:0.1, value:400,   desc:"Small flame." },
  bullet:    { id:"bullet",    name:"BULLET",     icon:"\u2022", size:0.05,value:60,    stackable:true, desc:"Ammunition." },
  pistol:    { id:"pistol",    name:"PISTOL",     icon:"\uD83D\uDD2B", size:0.9, value:45000, desc:"Concealed carry." },

  /* World pickups (from world-objects.js CATALOGUE) — these let
     items found around the city actually land in the bag. */
  food:       { id:"food",       name:"STREET FOOD",  icon:"\uD83C\uDF56", size:0.2, value:0,  stackable:true, desc:"Restores +20 health." },
  junkfood:   { id:"junkfood",   name:"JUNK FOOD",     icon:"\uD83C\uDF54", size:0.2, value:0,  stackable:true, desc:"Restores +10 health, -1 stamina." },
  water:      { id:"water",      name:"WATER BOTTLE",  icon:"\uD83D\uDCA7", size:0.15,value:0,  stackable:true, desc:"Restores +5 health." },
  money:      { id:"money",      name:"MONEY",         icon:"\uD83D\uDCB5", size:0.1, value:500,stackable:true, desc:"Found cash." },
  bag:        { id:"bag",        name:"SHOPPING BAG",  icon:"\uD83D\uDED2", size:0.3, value:0,  desc:"Carry more items." },
  bat:        { id:"bat",        name:"WOODEN BAT",    icon:"\uD83C\uDFCF", size:0.6, value:3000, desc:"Melee weapon — deals 40 damage." },
  bottle:     { id:"bottle",     name:"GLASS BOTTLE",  icon:"\uD83C\uDF7E", size:0.2, value:200, desc:"Throw to stun. Melee deals 20 dmg." },
  book:       { id:"book",       name:"TEXTBOOK",      icon:"\uD83D\uDCDA", size:0.3, value:1500, desc:"+5 XP (study)." },
  cigarettes: { id:"cigarettes", name:"CIGARETTES",    icon:"\uD83D\uDEAC", size:0.1, value:120, stackable:true, desc:"Reduces stress. -1 health long-term." },
  dumbbell:   { id:"dumbbell",   name:"DUMBBELL",      icon:"\uD83C\uDFCB", size:0.5, value:0,  desc:"+2 strength." },
  crate:      { id:"crate",      name:"WOODEN CRATE",  icon:"\uD83D\uDCE6", size:0.9, value:1000, desc:"Heavy lift obstacle or weapon." },
  spray_can:  { id:"spray_can",  name:"SPRAY PAINT",   icon:"\uD83C\uDFA8", size:0.15,value:300, stackable:true, desc:"Tag buildings. Increases heat." },
};

export const Pocket = {
  slots: new Array(POCKET_SIZE).fill(null),
  _subs: new Set(),

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        for (let i = 0; i < POCKET_SIZE; i++) this.slots[i] = arr[i] || null;
      }
    } catch (e) {}
    return this;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.slots)); } catch (e) {} },

  count() { return this.slots.filter(Boolean).length; },
  isFull() { return this.count() >= POCKET_SIZE; },

  add(itemId, qty = 1) {
    const spec = POCKET_ITEMS[itemId];
    if (!spec) return false;
    if (spec.stackable) {
      const i = this.slots.findIndex(s => s && s.id === itemId);
      if (i >= 0) {
        this.slots[i].qty = (this.slots[i].qty || 1) + qty;
        this.save(); this._emit();
        try { Sfx.play(itemId === "cash" || itemId === "coin" ? "pickup_coin" : "pickup_item"); } catch (_) {}
        return true;
      }
    }
    if (this.isFull()) {
      try { Sfx.play("inventory_full"); } catch (_) {}
      return false;
    }
    const i = this.slots.indexOf(null);
    if (i < 0) {
      try { Sfx.play("inventory_full"); } catch (_) {}
      return false;
    }
    this.slots[i] = { id: itemId, qty, added: Date.now() };
    this.save(); this._emit();
    try { Sfx.play(itemId === "cash" || itemId === "coin" ? "pickup_coin" : "pickup_item"); } catch (_) {}
    return true;
  },

  addCash(amount) {
    amount = Math.floor(Number(amount) || 0);
    if (amount <= 0) return 0;
    const unit = POCKET_ITEMS.cash.value;
    const qty = Math.max(1, Math.round(amount / unit));
    let placed = 0;
    for (let k = 0; k < qty; k++) { if (this.add("cash", 1)) placed++; else break; }
    return placed * unit;
  },

  totalValue() {
    let t = 0;
    for (const s of this.slots) {
      if (!s) continue;
      const spec = POCKET_ITEMS[s.id];
      if (spec && spec.value) t += spec.value * (s.qty || 1);
    }
    return t;
  },

  remove(index, qty = 1) {
    if (index < 0 || index >= POCKET_SIZE) return null;
    const it = this.slots[index];
    if (!it) return null;
    if (it.qty && it.qty > qty) { it.qty -= qty; this.save(); this._emit(); return { id: it.id, qty }; }
    this.slots[index] = null;
    this.save(); this._emit();
    return it;
  },

  sellSlot(index) {
    const it = this.slots[index];
    if (!it) return 0;
    const spec = POCKET_ITEMS[it.id];
    if (!spec || !spec.value) return 0;
    const gain = spec.value * (it.qty || 1);
    this.slots[index] = null;
    this.save(); this._emit();
    return gain;
  },

  clear() { this.slots.fill(null); this.save(); this._emit(); },
  onChange(fn) { this._subs.add(fn); return () => this._subs.delete(fn); },
  _emit() { for (const fn of this._subs) { try { fn(this); } catch (e) {} } },
};

export class PocketUI {
  constructor() {
    this._injectCSS();
    this._build();
    Pocket.onChange(() => this._render());
    this._render();
  }
  _injectCSS() {
    if (document.getElementById("ph3d-pocket-css")) return;
    const s = document.createElement("style");
    s.id = "ph3d-pocket-css";
    s.textContent = ".pk-pill{position:fixed;right:14px;top:calc(env(safe-area-inset-top) + 14px);z-index:40;padding:9px 14px;border-radius:999px;background:rgba(8,16,28,.85);border:1px solid rgba(94,224,255,.45);color:#eaf6ff;font-family:Inter,system-ui,sans-serif;font-size:12px;font-weight:800;letter-spacing:.08em;display:flex;align-items:center;gap:7px;cursor:pointer;backdrop-filter:blur(12px);box-shadow:0 8px 24px rgba(0,0,0,.5)}.pk-scrim{position:fixed;inset:0;z-index:60;background:rgba(3,6,12,.72);backdrop-filter:blur(8px);opacity:0;pointer-events:none;transition:opacity .3s}.pk-scrim.on{opacity:1;pointer-events:auto}.pk-sheet{position:fixed;left:50%;top:50%;z-index:61;transform:translate(-50%,-46%) scale(.94);width:min(94vw,520px);max-height:88vh;background:linear-gradient(165deg,#0d1420 0%,#0a0f18 100%);color:#eaf6ff;font-family:Inter,system-ui,sans-serif;border-radius:28px;overflow:hidden;border:1px solid rgba(94,224,255,.28);box-shadow:0 30px 90px rgba(0,0,0,.85);opacity:0;pointer-events:none;transition:all .35s cubic-bezier(.2,.9,.3,1.1);display:flex;flex-direction:column}.pk-sheet.on{opacity:1;pointer-events:auto;transform:translate(-50%,-50%) scale(1)}.pk-hdr{padding:18px 22px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(94,224,255,.14)}.pk-hdr .ttl{font-size:15px;font-weight:900;letter-spacing:.14em;color:#5ee0ff}.pk-close{width:34px;height:34px;border-radius:50%;background:rgba(94,224,255,.10);border:1px solid rgba(94,224,255,.28);color:#eaf6ff;font-weight:900;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center}.pk-bal{padding:14px 22px 6px;display:flex;justify-content:space-between;align-items:baseline}.pk-bal .lbl{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:rgba(234,246,255,.55);font-weight:800}.pk-bal .amt{font-size:26px;font-weight:900;color:#7dff9b}.pk-grid{padding:14px 18px 18px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;overflow-y:auto}.pk-grid::-webkit-scrollbar{width:0}.pk-cell{aspect-ratio:1;border-radius:18px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09);display:flex;align-items:center;justify-content:center;flex-direction:column;cursor:pointer;position:relative;transition:all .16s;padding:6px}.pk-cell.on{border-color:#5ee0ff;background:rgba(94,224,255,.10)}.pk-cell.empty{border-style:dashed;opacity:.35;cursor:default;background:transparent}.pk-cell .ic{font-size:28px;line-height:1}.pk-cell .nm{font-size:8px;letter-spacing:.1em;font-weight:800;margin-top:5px;text-transform:uppercase;opacity:.7;text-align:center}.pk-cell .qty{position:absolute;top:5px;right:6px;background:rgba(94,224,255,.85);color:#04121c;font-size:9px;font-weight:900;padding:2px 6px;border-radius:8px}.pk-detail{padding:14px 20px 6px;border-top:1px solid rgba(94,224,255,.14);background:rgba(0,0,0,.20)}.pk-detail .row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;font-size:12px}.pk-detail .row .k{color:rgba(234,246,255,.55);letter-spacing:.12em;font-weight:800;text-transform:uppercase;font-size:10px}.pk-detail .row .v{font-weight:900}.pk-acts{padding:10px 20px 20px;display:flex;gap:10px;border-top:1px solid rgba(94,224,255,.14)}.pk-acts button{flex:1;padding:14px;border-radius:16px;cursor:pointer;font-family:inherit;font-size:11px;font-weight:900;letter-spacing:.14em;border:1px solid rgba(255,255,255,.12);background:transparent;color:rgba(234,246,255,.75)}.pk-acts button.sell{background:linear-gradient(135deg,#7dff9b,#4ade80);color:#031a0d;border:none}.pk-acts button.drop{background:rgba(255,92,92,.18);border-color:rgba(255,92,92,.4);color:#ff8080}.pk-empty-callout{padding:40px 20px 30px;text-align:center;color:rgba(234,246,255,.5);font-size:12px;line-height:1.7}";
    document.head.appendChild(s);
  }
  _build() {
    const pill = document.createElement("button");
    pill.className = "pk-pill";
    pill.innerHTML = '\uD83C\uDF92 <span id="pk-pill-cnt">0/8</span>';
    pill.addEventListener("click", () => this.open());
    document.body.appendChild(pill);
    const scrim = document.createElement("div");
    scrim.className = "pk-scrim"; scrim.id = "pk-scrim";
    scrim.addEventListener("click", () => this.close());
    document.body.appendChild(scrim);
    const sheet = document.createElement("div");
    sheet.className = "pk-sheet"; sheet.id = "pk-sheet";
    sheet.innerHTML = '<div class="pk-hdr"><div><span class="ttl">POCKET</span></div><div class="pk-close" id="pk-close">X</div></div><div class="pk-bal"><div class="lbl">TOTAL VALUE</div><div class="amt" id="pk-total">0</div></div><div class="pk-grid" id="pk-grid"></div><div id="pk-bottom"></div>';
    document.body.appendChild(sheet);
    this._sheet = sheet;
    document.getElementById("pk-close").onclick = () => this.close();
  }
  open()  { this._sheet.classList.add("on"); document.getElementById("pk-scrim").classList.add("on"); this._render(); }
  close() { this._sheet.classList.remove("on"); document.getElementById("pk-scrim").classList.remove("on"); this.selected = null; }
  _render() {
    const c = document.getElementById("pk-pill-cnt");
    if (c) c.textContent = Pocket.count() + "/8";
    const t = document.getElementById("pk-total");
    if (t) t.textContent = "\u20A6" + Pocket.totalValue().toLocaleString();
    const grid = document.getElementById("pk-grid");
    if (!grid) return;
    grid.innerHTML = "";
    for (let i = 0; i < POCKET_SIZE; i++) {
      const cell = document.createElement("div");
      const slot = Pocket.slots[i];
      if (!slot) { cell.className = "pk-cell empty"; cell.innerHTML = '<div class="ic" style="opacity:.3">.</div>'; }
      else {
        const spec = POCKET_ITEMS[slot.id];
        if (!spec) continue;
        cell.className = "pk-cell" + (this.selected === i ? " on" : "");
        cell.innerHTML = '<div class="ic">' + spec.icon + '</div><div class="nm">' + spec.name + '</div>' + (slot.qty > 1 ? '<div class="qty">x' + slot.qty + '</div>' : "");
        cell.onclick = () => { this.selected = (this.selected === i) ? null : i; this._render(); };
      }
      grid.appendChild(cell);
    }
    const bottom = document.getElementById("pk-bottom");
    if (!bottom) return;
    const slot = this.selected != null ? Pocket.slots[this.selected] : null;
    if (!slot) { bottom.innerHTML = '<div class="pk-empty-callout">' + (Pocket.count() === 0 ? "Pocket is empty." : "Tap an item above.") + '</div>'; return; }
    const spec = POCKET_ITEMS[slot.id];
    const qty = slot.qty || 1;
    bottom.innerHTML = '<div class="pk-detail"><div class="row"><span class="k">ITEM</span><span class="v">' + spec.icon + ' ' + spec.name + '</span></div><div class="row"><span class="k">QTY</span><span class="v">x' + qty + '</span></div><div class="row"><span class="k">VALUE</span><span class="v" style="color:#7dff9b">' + "\u20A6" + (spec.value * qty).toLocaleString() + '</span></div></div><div class="pk-acts"><button class="sell" id="pk-sell">' + (spec.id === "cash" ? "DEPOSIT" : "SELL") + '</button><button class="drop" id="pk-drop">DROP</button></div>';
    const idx = this.selected;
    const sb = document.getElementById("pk-sell");
    if (sb) sb.onclick = () => {
      const it = Pocket.slots[idx]; if (!it) return;
      const spec2 = POCKET_ITEMS[it.id];
      const gain = Pocket.sellSlot(idx);
      if (gain > 0 && window.__ph3d_economy) window.__ph3d_economy.receive("POCKET", gain, spec2.name);
      if (window.__ph3d_phone) window.__ph3d_phone._toast((spec2.id === "cash" ? "Deposited " : "Sold ") + "\u20A6" + gain.toLocaleString());
      this.selected = null; this._render();
    };
    const db = document.getElementById("pk-drop");
    if (db) db.onclick = () => {
      const current = Pocket.slots[idx];
      const world = window.__ph3d_world_objects;
      const visual = current && world && typeof world.dropPocketItem === "function"
        ? world.dropPocketItem({ ...spec, id: current.id }, window.__ph3d_player)
        : null;
      if (!visual) {
        try { window.__ph3d_phone?._toast("Cannot drop an item in this scene."); } catch (e) {}
        return;
      }
      Pocket.remove(idx, 1);
      this.selected = null;
      this._render();
      try { window.__ph3d_phone?._toast("Dropped " + spec.name.toLowerCase() + " on the ground."); } catch (e) {}
    };
  }
}

