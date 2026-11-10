import { State, BODY_COLORS, RIM_COLORS } from "./state.js";
const $ = id => document.getElementById(id);

export class UI {
  constructor(){
    this.crumb=$("crumb"); this.title=$("title"); this.subtitle=$("subtitle");
    this.backBtn=$("backBtn"); this.hint=$("hint"); this.card=$("card");
    this.fade=$("fade"); this.modal=$("modal"); this.mSub=$("mSub");
    this.carName=$("carName"); this.travel=$("travel"); this.tMode=$("travelMode");
    this.tDest=$("travelDest"); this.tBar=$("travelBar"); this.shop=$("shop");
    this.shName=$("shName"); this.shTag=$("shTag"); this.shPrice=$("shPrice");
    this.swBody=$("swBody"); this.swRim=$("swRim"); this.buyBtn=$("buyBtn");
    this._res = null;
    if (this.modal) {
      this.modal.querySelectorAll(".opt").forEach(el=>{
        el.addEventListener("click", ()=>{
          this.modal.classList.remove("show");
          if (this._res){ this._res(el.dataset.mode); this._res = null; }
        });
      });
    }
    const cancel = $("mCancel");
    if (cancel) cancel.addEventListener("click", ()=>{
      if (this.modal) this.modal.classList.remove("show");
      if (this._res){ this._res(null); this._res = null; }
    });
  }

  setHeader(c,t,s){
    if (this.crumb && c !== undefined) this.crumb.textContent = c;
    if (this.title && t !== undefined) this.title.textContent = t;
    if (this.subtitle && s !== undefined) this.subtitle.textContent = s;
  }

  showBack(on, fn){
    if (!this.backBtn) return;
    this.backBtn.classList.toggle("show", on);
    if (fn) this.backBtn.onclick = fn;
  }

  /* #hint was removed from the HUD (was a "TAP A LANDMARK TO ENTER"
     instruction watermark). Kept as a safe no-op so scenes that still
     pass a hint string don't crash. */
  setHint(t, on=true){
    if (!this.hint) return;
    if (t) this.hint.textContent = t;
    this.hint.classList.toggle("hide", !on);
  }

  showCard(t, s){
    if (!this.card) return;
    this.card.querySelector("b").textContent = t;
    this.card.querySelector("span").textContent = s || "";
    this.card.classList.add("show");
  }
  hideCard(){ if (this.card) this.card.classList.remove("show"); }

  fadeIn(){ this.fade.style.opacity = "1"; return new Promise(r=>setTimeout(r,160)); }
  fadeOut(){ this.fade.style.opacity = "0"; }

  askTravel(dest) {
    const HUD = window.__ph3d_hud;
    if (!HUD || !HUD.sheet) return Promise.resolve(null);

    return new Promise((resolve) => {
      let done = false;
      const finish = (val) => { if (done) return; done = true; resolve(val); };
      const carName = ((State.vehicle && State.vehicle.model) || "gwagon").toUpperCase();

      HUD.sheet({
        title: "How do you want to travel?",
        sub: "To " + dest,
        sections: [{
          cols: 2,
          items: [
            { icon: "car",  label: "Car",  sub: carName,
              keep: true, onClick: () => { finish("car");  HUD.closeSheet(); } },
            { icon: "walk", label: "Bike", sub: "SUPERSPORT",
              keep: true, onClick: () => { finish("bike"); HUD.closeSheet(); } },
          ],
        }],
        onClose: () => { if (!done) finish(null); },
      });
    });
  }

  travelStart(mode, dest){
    if (!this.travel) return;
    this.tMode.textContent = mode === "bike" ? "RIDING" : "DRIVING";
    this.tDest.textContent = dest;
    this.tBar.style.width = "0%";
    this.travel.classList.add("show");
  }
  travelProgress(p){ if (this.tBar) this.tBar.style.width = (p*100).toFixed(1) + "%"; }
  travelEnd(){ if (this.travel) this.travel.classList.remove("show"); }

  showShop(car, onSelect){
    this.shName.textContent = car.name;
    this.shTag.textContent = car.tag;
    this.shPrice.textContent = "₦" + car.price.toLocaleString();
    const target = { body: State.vehicle.body, rim: State.vehicle.rim };
    const build = (el, colors, key)=>{
      el.innerHTML = "";
      colors.forEach(c=>{
        const d = document.createElement("div");
        d.className = "sw" + (target[key] === c ? " on" : "");
        d.style.background = c;
        d.addEventListener("click", ()=>{
          target[key] = c;
          el.querySelectorAll(".sw").forEach(s=>s.classList.remove("on"));
          d.classList.add("on");
          car.onColor && car.onColor(target);
        });
        el.appendChild(d);
      });
    };
    build(this.swBody, BODY_COLORS, "body");
    build(this.swRim, RIM_COLORS, "rim");
    this.buyBtn.onclick = ()=>{
      State.vehicle.body = target.body;
      State.vehicle.rim = target.rim;
      State.vehicle.model = car.id;
      try { if (window.__ph3d_garage) window.__ph3d_garage.grantCar(car.id); } catch (e) {}
      if (!State.owned.includes(car.id)) State.owned.push(car.id);
      this.hideShop();
      onSelect && onSelect();
    };
    this.shop.classList.add("show");
  }
  hideShop(){ if (this.shop) this.shop.classList.remove("show"); }
  loaderDone(){}
}
