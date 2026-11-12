/* phoneshop/rooms/showroom.js -- display tables, counter, cashier and the shop modal.
   buildShowroom(ctx) -> { dispose }. ctx = { THREE, scene, colliders, uses, HX, HZ }. */
import { PHONE_MODELS, PHONE_BY_ID } from "../../../data/phone-models.js";
import { CFG } from "../../../core/engagement-config.js";
import { Economy } from "../../../core/economy.js";
import { Engagement } from "../../../core/engagement.js";

const fmt = (n) => "\u20A6" + Math.floor(n).toLocaleString();
const toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} };
const ROOT = "ph3d-phoneshop", CSSID = "ph3d-phoneshop-css";

function css() {
  if (document.getElementById(CSSID)) return;
  const s = document.createElement("style"); s.id = CSSID;
  s.textContent = `
  #${ROOT}{position:fixed;inset:0;z-index:82;display:none;align-items:center;justify-content:center;background:rgba(3,6,12,.74);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
    font-family:"Archivo",system-ui,sans-serif;color:#eef3fb;touch-action:manipulation;user-select:none;-webkit-user-select:none}
  #${ROOT}.on{display:flex}
  #${ROOT} .sh{position:relative;width:min(640px,94vw);max-height:90vh;display:flex;flex-direction:column;background:linear-gradient(165deg,#101a2a,#0a111b);border:1px solid rgba(238,243,251,.28);border-radius:22px;box-shadow:0 22px 60px rgba(0,0,0,.7);overflow:hidden}
  #${ROOT} .hd{display:flex;align-items:center;gap:10px;padding:14px 16px 8px}
  #${ROOT} .hd b{font:800 15px/1 inherit;letter-spacing:.08em;flex:1}
  #${ROOT} .hd em{font:700 12px/1 inherit;color:#7fd6a4;font-style:normal;font-variant-numeric:tabular-nums}
  #${ROOT} .x{width:44px;height:44px;border-radius:50%;border:1px solid rgba(238,243,251,.3);background:#0a111b;color:#eef3fb;font:700 20px/1 inherit;cursor:pointer}
  #${ROOT} .tabs{display:flex;gap:6px;padding:0 16px 10px}
  #${ROOT} .tab{flex:1;min-height:42px;border-radius:12px;border:1px solid rgba(238,243,251,.2);background:transparent;color:#9fb0c8;font:800 11px/1 inherit;letter-spacing:.1em;cursor:pointer}
  #${ROOT} .tab.on{background:#2f9bff;color:#04121f;border-color:#2f9bff}
  #${ROOT} .bd{overflow:auto;padding:0 16px 14px;display:grid;gap:8px}
  #${ROOT} .row{display:grid;grid-template-columns:44px 1fr auto;gap:12px;align-items:center;padding:10px;border-radius:14px;border:1px solid rgba(238,243,251,.14);background:rgba(255,255,255,.04)}
  #${ROOT} .sw{width:44px;height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.2)}
  #${ROOT} .nm{font:800 14px/1.2 inherit} #${ROOT} .sp{font:600 11px/1.4 inherit;color:#9fb0c8}
  #${ROOT} .go{min-width:104px;min-height:44px;border-radius:12px;border:0;background:#ffc62b;color:#1b1400;font:800 12px/1 inherit;cursor:pointer}
  #${ROOT} .go.alt{background:#35d07f;color:#031a0d} #${ROOT} .go[disabled]{opacity:.4;cursor:not-allowed}
  #${ROOT} .ft{padding:0 16px 14px;min-height:18px;font:700 12px/1.3 inherit;color:#7fd6a4} #${ROOT} .ft.err{color:#ff7a5c}
  #${ROOT} .note{font:600 12px/1.4 inherit;color:#9fb0c8;padding:2px 2px 4px}`;
  document.head.appendChild(s);
}

const Shop = {
  el: null, tab: "phones",
  open(tab) { this.build(); this.tab = tab || "phones"; this.msg(""); this.render(); this.el.classList.add("on"); },
  close() { if (this.el) this.el.classList.remove("on"); },
  build() {
    if (this.el && document.body.contains(this.el)) return;
    css();
    const el = document.createElement("div"); el.id = ROOT;
    el.innerHTML = `<div class="sh"><div class="hd"><b>PHONE SHOP</b><em data-bal></em><button class="x" aria-label="Close">&times;</button></div>
      <div class="tabs"><button class="tab" data-t="phones">PHONES</button><button class="tab" data-t="tradein">TRADE IN</button><button class="tab" data-t="airtime">AIRTIME</button></div>
      <div class="bd" data-bd></div><div class="ft" data-ft></div></div>`;
    document.body.appendChild(el); this.el = el;
    el.querySelector(".x").addEventListener("click", () => this.close());
    el.addEventListener("pointerdown", (e) => { if (e.target === el) this.close(); });
    el.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => { this.tab = b.dataset.t; this.msg(""); this.render(); }));
  },
  msg(t, err) { const f = this.el && this.el.querySelector("[data-ft]"); if (f) { f.textContent = t || ""; f.classList.toggle("err", !!err); } },
  row(color, name, spec, label, alt, disabled, fn) {
    const r = document.createElement("div"); r.className = "row";
    r.innerHTML = `<div class="sw" style="background:#${("000000" + (color || 0x334455).toString(16)).slice(-6)}"></div><div><div class="nm"></div><div class="sp"></div></div>`;
    r.querySelector(".nm").textContent = name; r.querySelector(".sp").textContent = spec;
    const b = document.createElement("button"); b.className = "go" + (alt ? " alt" : ""); b.textContent = label; b.disabled = !!disabled;
    b.addEventListener("click", fn); r.appendChild(b); return r;
  },
  render() {
    const E = Engagement.state, bd = this.el.querySelector("[data-bd]"); bd.innerHTML = "";
    this.el.querySelector("[data-bal]").textContent = fmt(Economy.balance);
    this.el.querySelectorAll(".tab").forEach((b) => b.classList.toggle("on", b.dataset.t === this.tab));
    if (this.tab === "phones") {
      for (const m of PHONE_MODELS) {
        const owned = Engagement.ownsPhone(m.id), sp = m.specs;
        const active = E.phones.active === m.id;
        bd.appendChild(this.row(m.color, m.brand + " " + m.name, `${sp.ram} · ${sp.storage} · ${sp.cam} · ${sp.battery}${active ? " · ACTIVE DEVICE" : ""}`,
          owned ? (active ? "ACTIVE" : "USE PHONE") : fmt(m.price), owned, !owned && Economy.balance < m.price, () => owned ? this.select(m) : this.buy(m)));
      }
    } else if (this.tab === "tradein") {
      const list = E.phones.owned;
      if (!list.length) { const n = document.createElement("div"); n.className = "note"; n.textContent = "You do not own a phone to trade in."; bd.appendChild(n); }
      for (const id of list) {
        const m = PHONE_BY_ID[id]; if (!m) continue;
        const v = Math.round(m.price * CFG.phones.tradeInRatio);
        bd.appendChild(this.row(m.color, m.brand + " " + m.name, "Trade-in value", fmt(v), true, false, () => this.trade(m, v)));
      }
    } else {
      const n = document.createElement("div"); n.className = "note";
      n.textContent = "Balance: " + fmt(E.phones.airtime) + " airtime, " + E.phones.dataMb + " MB data" + (E.phones.owned.length ? "" : ". Buy a phone first."); bd.appendChild(n);
      const has = E.phones.owned.length > 0;
      for (const [cost, val] of CFG.phones.airtimePacks) bd.appendChild(this.row(0x2d6a4f, fmt(val) + " airtime", "Top up", fmt(cost), true, !has || Economy.balance < cost, () => this.top("air", cost, val)));
      for (const [cost, mb] of CFG.phones.dataPacks) bd.appendChild(this.row(0x1d4e89, mb >= 1024 ? (mb / 1024) + " GB data" : mb + " MB data", "Data bundle", fmt(cost), true, !has || Economy.balance < cost, () => this.top("data", cost, mb)));
    }
  },
  select(m) {
    if (!Engagement.ownsPhone(m.id)) return;
    Engagement.state.phones.active = m.id; Engagement.save(); Engagement._emit();
    this.msg("Active device changed to " + m.brand + " " + m.name + "."); toast("Phone interface updated."); this.render();
  },
  buy(m) {
    if (Engagement.ownsPhone(m.id)) return this.select(m);
    if (!Economy.withdraw(m.price)) { this.msg("Not enough money.", true); return; }
    Engagement.addPhone(m.id); this.msg("Bought the " + m.brand + " " + m.name + "."); toast("Phone bought: " + m.name); this.render();
  },
  trade(m, v) {
    Engagement.removePhone(m.id); Economy.receive("PHONE SHOP", v, "trade-in"); this.msg("Traded in for " + fmt(v) + "."); this.render();
  },
  top(kind, cost, val) {
    if (!Economy.withdraw(cost)) { this.msg("Not enough money.", true); return; }
    if (kind === "air") Engagement.addAirtime(val); else Engagement.addData(val);
    this.msg("Topped up."); this.render();
  },
};

export function buildShowroom(ctx) {
  const { THREE, scene, colliders, uses, HX, HZ } = ctx;
  const mats = new Map();
  const mat = (c) => { let m = mats.get(c); if (!m) { m = new THREE.MeshLambertMaterial({ color: c }); mats.set(c, m); } return m; };
  const box = (w, h, d, x, y, z, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); scene.add(m); return m; };
  const col = (minX, maxX, minZ, maxZ) => colliders.push({ minX, maxX, minZ, maxZ, y0: 0, y1: 60, level: 0 });

  /* counter along the back wall */
  box(6.4, 1.05, 1.1, 0, 0.53, -3.2, 0x2a3a52); box(6.6, 0.1, 1.3, 0, 1.08, -3.2, 0xd9dee6);
  col(-3.3, 3.3, -3.85, -2.55);
  /* cashier */
  box(0.55, 0.9, 0.35, 0, 1.0, -4.0, 0x2f9bff);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), mat(0xc68a5c)); head.position.set(0, 1.7, -4.0); scene.add(head);
  /* back shelf of boxed phones */
  box(10, 2.2, 0.35, 0, 1.1, -HZ + 0.3, 0x1a2536);
  PHONE_MODELS.forEach((m, i) => box(0.42, 0.7, 0.08, -4.2 + i * 1.2, 1.6, -HZ + 0.52, m.color));

  /* display tables: two phones per table, so 8 models over 4 tables */
  const T = [[-5.2, -0.8], [5.2, -0.8], [-5.2, 2.6], [5.2, 2.6]];
  T.forEach(([x, z], ti) => {
    box(2.6, 0.9, 1.0, x, 0.45, z, 0x24324a); box(2.7, 0.06, 1.1, x, 0.93, z, 0xe9edf3);
    for (let k = 0; k < 2; k++) {
      const m = PHONE_MODELS[ti * 2 + k]; if (!m) continue;
      box(0.42, 0.04, 0.8, x - 0.55 + k * 1.1, 0.98, z, 0x555c66);
      const ph = box(0.34, 0.03, 0.66, x - 0.55 + k * 1.1, 1.02, z, m.color); ph.rotation.x = -0.25;
    }
    col(x - 1.4, x + 1.4, z - 0.6, z + 0.6);
    uses.push({ kind: "phoneshop", label: "BROWSE PHONES", tab: "phones", x, z: z + (z < 0 ? 1.4 : -1.4), y: 0, level: 0, r: 2.4 });
  });
  uses.push({ kind: "phoneshop", label: "SPEAK TO CASHIER", tab: "phones", x: 0, z: -1.9, y: 0, level: 0, r: 2.4 });
  uses.push({ kind: "phoneshop", label: "TRADE IN / AIRTIME", tab: "tradein", x: -3.2, z: -1.9, y: 0, level: 0, r: 1.8 });

  return { open: (tab) => Shop.open(tab), dispose() { Shop.close(); } };
}
