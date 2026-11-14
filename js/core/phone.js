import { PhoneGames } from "./phone-games.js";
import { Economy } from "./economy.js";
import { FOOD_ITEMS } from "./restaurants.js";
import { Pocket, POCKET_ITEMS } from "./pocket.js";
import { MILE1_BY_ID } from "../data/mile1-stalls.js";
import { SELFIE_POSES, SELFIE_POSE_ORDER } from "./thirdperson.js";
import { Sfx } from "./sfx.js";
import { Engagement } from "./engagement.js";
import { PHONE_BY_ID, PHONE_MODELS } from "../data/phone-models.js";
import { PhoneLife } from "./phone-life.js";

const SHOP_FOODS = ["puffpuff","plantain","palmwine","coffee","pounded","beer",
                     "chapman","jollof","suya","cake"];

/* Fonts + Font Awesome are pulled in by css/phone.css (@import). */

export class Phone{
  constructor(){
    this.visible = false;
    this.app = null;
    this.shopTab = "guns";
    this._camMode = "scene";
    this._camPose = "neutral";
    this._mount();
    Economy.onChange(() => this._bal());
  }

  /* ── markup ──────────────────────────────────────────────── */
  _mount(){
    document.body.insertAdjacentHTML("beforeend", `
      <div class="tpill" id="tpill">
        <span class="tt"><i class="fa-solid fa-phone"></i></span>
        <span class="tamt" id="tpill-amt">₦0</span>
      </div>

      <div class="tscrim" id="tscrim"></div>

      <div class="tphone" id="tphone">
        <div class="tnotch"></div>

        <div class="tstat">
          <span id="tclock">--:--</span>
          <span class="tstat-icons">
            <i class="fa-solid fa-signal"></i>
            <i class="fa-solid fa-wifi"></i>
            <span id="t-data-text">DATA</span>
            <span id="t-battery-text">100%</span><i class="fa-solid fa-battery-full" id="t-battery-icon"></i>
          </span>
        </div>

        <div class="thdr">
          <div class="tbr">
            <div class="tlg"><i class="fa-solid fa-city"></i></div>
            <span>Everyday in PH</span>
          </div>
          <div class="tcl" id="tclose"><i class="fa-solid fa-xmark"></i></div>
        </div>

        <!-- ── HOME SCREEN ──────────────────────────────── -->
        <div class="tapp on" id="app-home">
          <div class="tgrid">
            <div class="tapp-ic" data-a="bank">
              <div class="tico"><i class="fa-solid fa-building-columns"></i></div>
              <div class="tnm">Bank</div>
            </div>
            <div class="tapp-ic" data-a="health">
              <div class="tico"><i class="fa-solid fa-heart-pulse"></i></div>
              <div class="tnm">Health</div>
            </div>
            <div class="tapp-ic" data-a="police">
              <div class="tico"><i class="fa-solid fa-shield-halved"></i></div>
              <div class="tnm">Police</div>
            </div>
            <div class="tapp-ic" data-a="justice">
              <div class="tico"><i class="fa-solid fa-scale-balanced"></i></div>
              <div class="tnm">Justice</div>
            </div>
            <div class="tapp-ic" data-a="mp">
              <div class="tico"><i class="fa-solid fa-users"></i></div>
              <div class="tnm">Players</div>
            </div>
            <div class="tapp-ic" data-a="inv">
              <div class="tico"><i class="fa-solid fa-suitcase"></i></div>
              <div class="tnm">Inventory</div>
            </div>
            <div class="tapp-ic" data-a="homeinfo">
              <div class="tico"><i class="fa-solid fa-house"></i></div>
              <div class="tnm">Home</div>
            </div>
            <div class="tapp-ic" data-a="shop">
              <div class="tico"><i class="fa-solid fa-cart-shopping"></i></div>
              <div class="tnm">Shop</div>
            </div>
            <div class="tapp-ic" data-a="camera">
              <div class="tico"><i class="fa-solid fa-camera"></i></div>
              <div class="tnm">Camera</div>
            </div>
            <div class="tapp-ic" data-a="gallery">
              <div class="tico"><i class="fa-solid fa-images"></i></div>
              <div class="tnm">Gallery</div>
            </div>
            <div class="tapp-ic" data-a="map">
              <div class="tico"><i class="fa-solid fa-map"></i></div>
              <div class="tnm">Map</div>
            </div>
            <div class="tapp-ic" data-a="weather">
              <div class="tico"><i class="fa-solid fa-cloud-sun"></i></div>
              <div class="tnm">Weather</div>
            </div>
            <div class="tapp-ic" data-a="music">
              <div class="tico"><i class="fa-solid fa-music"></i></div>
              <div class="tnm">Music</div>
            </div>
            <div class="tapp-ic" data-a="jobs">
              <div class="tico"><i class="fa-solid fa-briefcase"></i></div>
              <div class="tnm">Jobs</div>
            </div>
            <div class="tapp-ic" data-a="business">
              <div class="tico"><i class="fa-solid fa-store"></i></div>
              <div class="tnm">Business</div>
            </div>
            <div class="tapp-ic" data-a="property">
              <div class="tico"><i class="fa-solid fa-house-chimney"></i></div>
              <div class="tnm">Property</div>
            </div>
            <div class="tapp-ic" data-a="career">
              <div class="tico"><i class="fa-solid fa-briefcase"></i></div>
              <div class="tnm">Career</div>
            </div>
            <div class="tapp-ic" data-a="story">
              <div class="tico"><i class="fa-solid fa-book-open"></i></div>
              <div class="tnm">Story</div>
            </div>
            <div class="tapp-ic" data-a="comics">
              <div class="tico"><i class="fa-solid fa-book-open-reader"></i></div>
              <div class="tnm">Comics</div>
            </div>
            <div class="tapp-ic" data-a="education">
              <div class="tico"><i class="fa-solid fa-graduation-cap"></i></div>
              <div class="tnm">Education</div>
            </div>
            <div class="tapp-ic" data-a="social"><div class="tico"><i class="fa-solid fa-comments"></i></div><div class="tnm">Social</div></div>
            <div class="tapp-ic" data-a="settings"><div class="tico"><i class="fa-solid fa-gear"></i></div><div class="tnm">Settings</div></div>
            <div class="tapp-ic" data-a="hunt"><div class="tico"><i class="fa-solid fa-crosshairs"></i></div><div class="tnm">Hunt</div></div>
            <div class="tapp-ic" data-a="games"><div class="tico"><i class="fa-solid fa-gamepad"></i></div><div class="tnm">Games</div></div>
            <div class="tapp-ic" data-a="about">
              <div class="tico"><i class="fa-solid fa-circle-info"></i></div>
              <div class="tnm">About</div>
            </div>
          </div>
        </div>

        <!-- ── JOBS ─────────────────────────────────────── -->
        <div class="tapp" id="app-jobs">
          <button class="tbk" data-back><i class="fa-solid fa-chevron-left"></i> Home</button>
          <div class="jb-card" id="jobs-card">
            <div class="jb-k">Active job</div>
            <div class="jb-name jb-none" id="jobs-active">None</div>
            <div class="jb-to" id="jobs-to"></div>
            <div class="jb-stats" id="jobs-stats" style="display:none">
              <div><b id="jobs-dist">-</b><small>Distance</small></div>
              <div><b id="jobs-time">-</b><small>Time left</small></div>
              <div><b class="g" id="jobs-pay">-</b><small>Pay</small></div>
            </div>
          </div>
          <div class="tacts" style="grid-template-columns:1fr">
            <button id="job-delivery"><i class="fa-solid fa-box"></i> Start Delivery</button>
            <button id="job-taxi"><i class="fa-solid fa-taxi"></i> Start Taxi</button>
            <button id="job-mechanic"><i class="fa-solid fa-wrench"></i> Start Repair</button>
            <button id="job-cancel" style="display:none"><i class="fa-solid fa-xmark"></i> Cancel job</button>
          </div>
          <div id="jobs-note" style="font-size:11px;color:#9db0a6;text-align:center;margin-top:14px;line-height:1.5">Follow the yellow beam. Delivery works on foot or by car, Taxi needs a car, and Repair needs you to stay nearby for a few seconds. Pay and time limit grow with distance.</div>
        </div>

<div class="tapp" id="app-hunt">
  <button class="tbk" data-back><i class="fa-solid fa-chevron-left"></i> Home</button>
  <div class="hunt-hero"><div class="hunt-hero-title">The Hunt</div><div class="hunt-hero-sub">Survive the contract. Keep the prize.</div></div>
  <div class="hunt-active" id="hunt-active" style="display:none">
    <div class="hunt-active-label">ACTIVE CONTRACT</div>
    <div class="hunt-active-name" id="hunt-active-name">—</div>
    <div class="hunt-active-meta" id="hunt-active-meta">—</div>
    <button class="hunt-btn hunt-btn-cashout" id="hunt-cashout">CASH OUT NOW</button>
    <button class="hunt-btn hunt-btn-abandon" id="hunt-abandon">ABANDON (LOSE PRIZE)</button>
  </div>
  <div class="hunt-list" id="hunt-list"></div>
  <div class="hunt-lb-wrap"><div class="hunt-lb-title">TOP PAYOUTS</div><div class="hunt-lb" id="hunt-lb"></div></div>
  <div class="hunt-note">Restricted to melee weapons. Leaving the zone or dying forfeits the prize.</div>
</div>

        <!-- ── BUSINESS / STORY CAMPAIGN ───────────────── -->
        <div class="tapp" id="app-business"></div>
        <div class="tapp" id="app-property"></div>
        <div class="tapp" id="app-career"></div>
        <div class="tapp" id="app-story"></div>
        <div class="tapp" id="app-justice"></div>
        <div class="tapp" id="app-comics"></div>
        <div class="tapp" id="app-education"></div>
        <div class="tapp" id="app-social"></div>
        <div class="tapp" id="app-settings">
          <button class="tbk" data-back><i class="fa-solid fa-chevron-left"></i> Home</button>
          <div id="phone-settings-body"></div>
        </div>

        <!-- ── ABOUT ────────────────────────────────────── -->
        <div class="tapp" id="app-about">
          <button class="tbk" data-back><i class="fa-solid fa-chevron-left"></i> Home</button>
          <div style="padding:16px;line-height:1.65;font-size:13px;color:#eaf6ff">
            <h2 style="font-size:18px;margin:0 0 8px">Everyday in PH</h2>
            <p>A free open-world game set in Port Harcourt, Nigeria. Walk the streets, drive cars, take jobs, buy a home, and survive the Garden City.</p>

            <h3 style="font-size:14px;margin:18px 0 6px">How to play</h3>
            <p>Drag the <b>left half</b> of the screen to walk and the <b>right half</b> to look around. Tap the action button to interact with people, doors, cars, and items. Open this phone any time to check your balance, jobs, and map. In a car, tap the pedals to accelerate and brake; drag the screen to steer.</p>

            <h3 style="font-size:14px;margin:18px 0 6px">Tips</h3>
            <p>Start with simple jobs at the Job Center before attempting higher-risk contracts. Keep your pocket bag empty — you only have 8 slots and some pickups are worth reselling. Watch the alert meter at the top of the player card. Above 70%, police will start searching for you.</p>

            <h3 style="font-size:14px;margin:18px 0 6px">Frequently asked</h3>
            <p><b>Is it free?</b> Yes. Completely free in your browser. No signup required.</p>
            <p><b>Does it work on mobile?</b> Yes — built mobile-first for iOS and Android.</p>
            <p><b>How is progress saved?</b> Locally in your browser. Clearing data or switching devices resets your profile.</p>

            <p style="margin-top:24px;opacity:.5;font-size:11px">Everyday in PH · clintonbenjamin208@gmail.com</p>
          </div>
        </div>

        <!-- ── BANK ─────────────────────────────────────── -->
        <div class="tapp" id="app-bank">
          <button class="tbk" data-back><i class="fa-solid fa-chevron-left"></i> Home</button>
          <div class="tbal">
            <div class="tlbl">Balance</div>
            <div class="tamt" id="tbal-bank">₦0</div>
          </div>
          <div class="tacts">
            <button id="bs"><i class="fa-solid fa-paper-plane"></i> Send</button>
            <button id="bw"><i class="fa-solid fa-money-bill-wave"></i> Withdraw</button>
            <button id="bh"><i class="fa-solid fa-clock-rotate-left"></i> History</button>
          </div>
          <div id="bbody"></div>
          <div id="banking-panel"></div>
        </div>

        <!-- ── HEALTH ───────────────────────────────────── -->
        <div class="tapp" id="app-health">
          <button class="tbk" data-back><i class="fa-solid fa-chevron-left"></i> Home</button>
          <div class="tbal">
            <div class="tlbl">Health</div>
            <div class="tamt" id="thp-big">100</div>
          </div>
          <div class="tstat-panel">
            <div class="tstat-row">
              <span class="k">Health</span>
              <span class="v" id="thp">100 / 100</span>
            </div>
            <div class="tbar"><i id="thp-bar" style="width:100%"></i></div>
            <div class="tstat-row" style="margin-top:14px">
              <span class="k">Alert</span>
              <span class="v" id="tal">0 / 100</span>
            </div>
            <div class="tbar"><i id="tal-bar" style="width:0%"></i></div>
          </div>
          <div class="tacts" style="grid-template-columns:1fr">
            <button id="heal-btn"><i class="fa-solid fa-notes-medical"></i> Use Medkit</button>
            <button id="visit-hospital-btn"><i class="fa-solid fa-hospital"></i> Visit City Hospital</button>
          </div>
          <div class="tstat-panel" style="margin-top:10px">
            <div style="font-weight:900;font-size:12px;margin-bottom:5px">CITY HOSPITAL · 24/7</div>
            <div style="font-size:10px;line-height:1.5;opacity:.78">Visit the hospital in person for triage, a doctor's consultation and treatment. Hospital services use your in-game naira.</div>
          </div>
        </div>

        <!-- ── PLAYERS ──────────────────────────────────── -->
        <div class="tapp" id="app-mp">
          <button class="tbk" data-back><i class="fa-solid fa-chevron-left"></i> Home</button>
          <div id="mplist"></div>
        </div>

        <!-- ── INVENTORY ────────────────────────────────── -->
        <div class="tapp" id="app-inv">
          <button class="tbk" data-back><i class="fa-solid fa-chevron-left"></i> Home</button>
          <div id="invlist"></div>
        </div>

        <!-- ── SHOP ─────────────────────────────────────── -->
        <div class="tapp" id="app-shop">
          <button class="tbk" data-back><i class="fa-solid fa-chevron-left"></i> Home</button>
          <div class="tbal">
            <div class="tlbl">Shop</div>
            <div class="tamt" id="shop-bal">₦0</div>
          </div>
          <div class="tstat-panel" style="padding:8px;display:flex;gap:8px;background:transparent;margin-bottom:10px">
            <button data-shoptab="guns" class="shoptabbtn">Weapons</button>
            <button data-shoptab="food" class="shoptabbtn">Food</button>
            <button data-shoptab="limited" class="shoptabbtn">Limited Fits</button>
          </div>
          <div id="shop-list"></div>
        </div>

        <!-- ── CAMERA ───────────────────────────────────── -->
        <div class="tapp" id="app-camera">
          <button class="tbk" data-back><i class="fa-solid fa-chevron-left"></i> Home</button>
          <div class="cam-mode" id="cam-mode">
            <button data-mode="scene" class="on">Scene</button>
            <button data-mode="selfie">Selfie</button>
          </div>
          <div id="cam-view">
            <div class="cam-live" id="cam-live">Tap shutter to capture</div>
            <div id="cam-hint">Snapshot</div>
          </div>
          <div class="cam-poses-wrap" id="cam-poses-wrap">
            <div class="cam-poses-label">Pose</div>
            <div class="cam-poses" id="cam-poses"></div>
          </div>
          <div class="cam-bar">
            <button class="cam-shutter" id="cam-shutter" aria-label="Shutter"></button>
          </div>
        </div>

        <!-- ── GALLERY ──────────────────────────────────── -->
        <div class="tapp" id="app-gallery">
          <button class="tbk" data-back><i class="fa-solid fa-chevron-left"></i> Home</button>
          <div id="gal-grid"></div>
        </div>

        <!-- ── MAP ──────────────────────────────────────── -->
        <div class="tapp" id="app-map">
          <button class="tbk" data-back><i class="fa-solid fa-chevron-left"></i> Home</button>
          <div class="tbal">
            <div class="tlbl">Location</div>
            <div class="tamt" id="map-place" style="font-size:22px">City Map</div>
          </div>
          <div class="tacts" style="grid-template-columns:1fr">
            <button id="map-go"><i class="fa-solid fa-map-location-dot"></i> Open City Map</button>
          </div>
        </div>

        <!-- ── WEATHER ──────────────────────────────────── -->
        <div class="tapp" id="app-weather">
          <button class="tbk" data-back><i class="fa-solid fa-chevron-left"></i> Home</button>
          <div id="wx-body"></div>
        </div>

        <!-- ── GAMES ────────────────────────────────────── -->
        <div class="tapp" id="app-games">
          <button class="tbk" data-back><i class="fa-solid fa-chevron-left"></i> Home</button>
          <div id="gm-body"></div>
        </div>

        <!-- ── MUSIC ────────────────────────────────────── -->
        <div class="tapp" id="app-music">
          <button class="tbk" data-back><i class="fa-solid fa-chevron-left"></i> Home</button>
          <div class="music-art"><i class="fa-solid fa-wave-square"></i></div>
          <div class="music-title">Port Harcourt Soundscape</div>
          <div class="music-sub">EVERYDAY AUDIO · CITY AMBIENCE</div>
          <div class="music-note">The game currently plays location-aware city ambience and environmental sounds rather than licensed songs. Control the in-game sound mix here.</div>
          <div class="music-controls"><button id="music-mute"><i class="fa-solid fa-volume-xmark"></i> Mute / Unmute</button><button id="music-next"><i class="fa-solid fa-location-crosshairs"></i> Current scene</button></div>
          <label class="music-volume-label" for="music-volume">SOUND LEVEL</label><input id="music-volume" type="range" min="0" max="100" value="40" style="width:100%;accent-color:#f4b6d2">
          <div id="music-status" class="music-sub">Ambient sound follows your location.</div>
        </div>

        <!-- ── POLICE ───────────────────────────────────── -->
        <div class="tapp" id="app-police">
          <button class="tbk" data-back><i class="fa-solid fa-chevron-left"></i> Home</button>
          <div class="tbal">
            <div class="tlbl">Alert Level</div>
            <div class="tamt" id="police-alert">0 / 100</div>
          </div>
          <div class="tacts" style="grid-template-columns:1fr">
            <button id="pcall"><i class="fa-solid fa-phone-volume"></i> Call Police</button>
          </div>
          <div id="police-log"></div>
        </div>

        <!-- ── HOME INFO ────────────────────────────────── -->
        <div class="tapp" id="app-homeinfo">
          <button class="tbk" data-back><i class="fa-solid fa-chevron-left"></i> Home</button>
          <div class="tbal">
            <div class="tlbl">You are at</div>
            <div class="tamt" id="hplace" style="font-size:22px">City Map</div>
          </div>
          <div class="tacts" style="grid-template-columns:1fr">
            <button id="home-go"><i class="fa-solid fa-house"></i> Go Home</button>
          </div>
        </div>

        <div class="cam-flash" id="cam-flash"></div>

        <div id="gal-view">
          <img id="gal-view-img" src="" alt=""/>
          <div class="acts">
            <button class="close" id="gal-view-close">Close</button>
            <button id="gal-view-del">Delete</button>
          </div>
        </div>

        <div class="phone-lockscreen" id="phone-lockscreen" aria-label="Phone lock screen">
          <button class="lock-close" id="phone-lock-close" type="button" aria-label="Close phone">×</button>
          <div class="lock-wallpaper-glow"></div>
          <div class="lock-date" id="phone-lock-date">FRIDAY, NOVEMBER 13</div>
          <div class="lock-time" id="phone-lock-time">19:09</div>
          <div class="lock-notification">
            <div class="lock-notification-top"><b>EVERYDAY</b><span>NOW</span></div>
            <div class="lock-notification-title">Welcome back</div>
            <div class="lock-notification-text">Your day in Port Harcourt is waiting.</div>
          </div>
          <div class="lock-bottom"><span><i class="fa-solid fa-camera"></i></span><span class="lock-swipe" id="phone-unlock-hint">Swipe up to unlock <b>↑</b></span><span><i class="fa-solid fa-bolt"></i></span></div>
          <button class="lock-unlock-btn" id="phone-unlock-btn" type="button">UNLOCK PHONE</button>
        </div>
        <div class="thomebar"></div>
      </div>
    `);

    /* ── wiring ───────────────────────────────────────── */
    document.getElementById("tclose").onclick = () => this.hide();
    const unlockPhone = () => this.unlock();
    const lockClose = document.getElementById("phone-lock-close");
    if (lockClose) lockClose.onclick = () => this.hide();
    const unlockBtn = document.getElementById("phone-unlock-btn");
    if (unlockBtn) unlockBtn.onclick = unlockPhone;
    const lockScreen = document.getElementById("phone-lockscreen");
    if (lockScreen) {
      let touchStartY = null;
      lockScreen.addEventListener("pointerdown", ev => { touchStartY = ev.clientY; });
      lockScreen.addEventListener("pointerup", ev => {
        if (touchStartY !== null && touchStartY - ev.clientY > 35) unlockPhone();
        touchStartY = null;
      });
      lockScreen.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") unlockPhone(); });
    }
    document.getElementById("tscrim").onclick = () => this.hide();
    document.getElementById("tpill").onclick = () => this.toggle();

    document.querySelectorAll(".tapp-ic").forEach(el => {
      el.onclick = () => this.showApp(el.dataset.a);
    });

    document.querySelectorAll("[data-back]").forEach(el => {
      el.onclick = () => this.showApp("home");
    });

    const startJob = async (kind) => {
    try {
      const Pr = window.__ph3d_prison;
      if (Pr && Pr.inJail) { this._toast("Serve your sentence or pay bail."); return; }
    } catch (e) {}
      const { JobObjectives } = await import("./job-objectives.js");
      const r = kind === "delivery" ? JobObjectives.startDelivery()
              : kind === "taxi"     ? JobObjectives.startTaxi()
              :                       JobObjectives.startMechanic();
      if (!r.ok) {
        this._toast(r.reason === "invalid_destination" ? "No valid job address found, try again"
                  : "You're already on a job");
        this._renderJobs();
        return;
      }
      this.hide();
    };
    document.getElementById("job-delivery").onclick = () => startJob("delivery");
    document.getElementById("job-taxi").onclick     = () => startJob("taxi");
    document.getElementById("job-mechanic").onclick = () => startJob("mechanic");
    document.getElementById("job-cancel").onclick = async () => {
      const { JobObjectives } = await import("./job-objectives.js");
      JobObjectives.cancel();
      this._renderJobs();
    };

    document.getElementById("bs").onclick = () => this._formSend();
    document.getElementById("bw").onclick = () => this._formWd();
    document.getElementById("bh").onclick = () => this._history();

    document.getElementById("pcall").onclick = () => {
      if (window.__ph3d_police && !window.__ph3d_police.dispatched) {
        window.__ph3d_police.dispatch("Intruder");
        this._renderPolice();
      }
    };

    document.getElementById("visit-hospital-btn").onclick = () => {
      const r = window.__ph3d_router;
      if (r) { this.hide(); r.go("interior", { id: "hospital" }); }
      else this._toast("Hospital navigation is unavailable.");
    };

    document.getElementById("heal-btn").onclick = () => {
      const hp = window.__ph3d_combat;
      if (!hp) return;
      if (hp.hp >= hp.maxHp) { this._toast("Health is full"); return; }
      const inv = window.__ph3d_inv;
      const medkit = inv && inv.items && inv.items.find(i => i.id === "medkit");
      if (medkit) {
        inv.remove("medkit", 1);
        hp.heal(50);
        this._toast("Used medkit · +50 HP");
      } else if (window.__ph3d_economy && window.__ph3d_economy.balance >= 5000) {
        window.__ph3d_economy.withdraw(5000);
        hp.heal(50);
        this._toast("Healed · −₦5,000");
      } else {
        this._toast("No medkit · need ₦5,000");
      }
      this._stats();
    };

    const homeGo = document.getElementById("home-go");
    if (homeGo) homeGo.onclick = () => this._goHome();
    const mapGo = document.getElementById("map-go");
    if (mapGo) mapGo.onclick = () => this._goCityMap();

    document.getElementById("gal-view-close").onclick = () => {
      document.getElementById("gal-view").classList.remove("on");
    };
    document.getElementById("gal-view-del").onclick = () => {
      const id = document.getElementById("gal-view-img").dataset.id;
      import("./photos.js").then(({ Photos }) => {
        Photos.remove(id);
        document.getElementById("gal-view").classList.remove("on");
        this._renderGallery();
      });
    };

    this._tick();
    this._applyDeviceSkin();
    setInterval(() => this._tick(), 30000);
    this._renderMP();
    this._renderInv();
    this._bal();
  }

  /* ── tick / clock ───────────────────────────────────── */
  _tick(){
    const e = document.getElementById("tclock");
    const d = new Date();
    const clock = String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
    if (e) e.textContent = clock;
    if (this.visible && this.locked) this._updateLockScreen();
    PhoneLife.tick(); this._renderBatteryStatus();
  }

  _renderBatteryStatus(){
    const snap = PhoneLife.snapshot(), pct = snap.battery;
    const text = document.getElementById("t-battery-text"), icon = document.getElementById("t-battery-icon");
    const dataText = document.getElementById("t-data-text");
    if (dataText) dataText.textContent = snap.dataMb >= 1024 ? (snap.dataMb/1024).toFixed(1)+"G" : snap.dataMb+"M";
    if (text) text.textContent = pct + "%";
    if (icon) { icon.className = "fa-solid " + (pct <= 15 ? "fa-battery-quarter" : pct <= 45 ? "fa-battery-half" : pct <= 75 ? "fa-battery-three-quarters" : "fa-battery-full"); icon.style.color = pct <= 15 ? "#ff5b65" : "#fff"; }
  }

  _applyDeviceSkin(){
    const shell = document.getElementById("tphone"); if (!shell) return;
    shell.classList.remove("skin-ios","skin-oneui","skin-hios","skin-xos","skin-pixel","skin-android");
    const id = Engagement.state.phones.active, model = PHONE_BY_ID[id];
    let skin = "skin-android";
    if (model?.brand === "Apple") skin = "skin-ios";
    else if (model?.brand === "Samsung") skin = "skin-oneui";
    else if (model?.brand === "Tecno" || model?.brand === "itel") skin = "skin-hios";
    else if (model?.brand === "Infinix") skin = "skin-xos";
    else if (model?.brand === "Google") skin = "skin-pixel";
    else if (model?.brand === "Xiaomi") skin = "skin-hyperos";
    shell.classList.add(skin);
    shell.dataset.phoneModel = id || "starter";
    const deviceThemes = {
      itel_a18:       ["#36c6a0", "#092b2a", "14px", "#102f31"],
      tecno_spark:    ["#21c7b1", "#073b3a", "18px", "#0b3034"],
      infinix_hot:    ["#ff9a45", "#44202f", "16px", "#2b1b30"],
      redmi_note:     ["#ff7043", "#3c201d", "22px", "#2a201e"],
      galaxy_a:       ["#78a8ff", "#142b50", "24px", "#172c4b"],
      pixel_8:        ["#a8c7fa", "#172944", "28px", "#1c2d47"],
      iphone_15:      ["#8eb5ff", "#1d1d2d", "26px", "#202131"],
      galaxy_s24:     ["#b7a5ff", "#242044", "28px", "#282442"],
      tecno_camon30:  ["#65e0c0", "#103d39", "20px", "#123b38"],
      infinix_note40: ["#f3a4ff", "#35203f", "18px", "#2b1d37"],
      iphone16:       ["#b9c8ff", "#202438", "30px", "#24283c"],
      galaxy_zflip:   ["#e6a6ff", "#382344", "30px", "#30203b"],
    };
    const theme = deviceThemes[id] || ["#67d9c0", "#102d32", "18px", "#142c34"];
    shell.style.setProperty("--device-accent", theme[0]);
    shell.style.setProperty("--device-glow", theme[1]);
    shell.style.setProperty("--device-radius", theme[2]);
    shell.style.setProperty("--device-panel", theme[3]);
    const brand = document.querySelector(".thdr .tbr span");
    const osName = {"skin-ios":"iOS","skin-oneui":"One UI","skin-hios":"HiOS","skin-xos":"XOS","skin-pixel":"Pixel UI","skin-hyperos":"HyperOS","skin-android":"Android"}[skin];
    if (brand) brand.textContent = model ? `${model.brand} ${model.name} · ${osName}` : "Everyday Phone · Android";
    this._renderBatteryStatus();
  }

  _renderPhoneSettings(){
    const root = document.getElementById("phone-settings-body"); if (!root) return;
    const snap = PhoneLife.snapshot(), active = Engagement.state.phones.active, current = PHONE_BY_ID[active];
    const data = snap.dataMb >= 1024 ? (snap.dataMb/1024).toFixed(2)+" GB" : snap.dataMb+" MB";
    root.innerHTML = `<div class="tbal"><div class="tlbl">DEVICE</div><div class="tamt" style="font-size:21px">${current ? current.brand+" "+current.name : "No phone selected"}</div><div class="tlbl" style="margin-top:7px">${current ? current.specs.storage+" storage · "+current.specs.battery+" battery" : "Visit the Phone Shop to buy a device."}</div></div>
      <div class="tstat-panel"><div class="tstat-row"><span class="k">Battery charge</span><span class="v">${snap.battery}%</span></div><div class="tbar"><i style="width:${snap.battery}%;background:${snap.battery<=15?'#ff5b65':'#30d158'}"></i></div><div class="tstat-row" style="margin-top:12px"><span class="k">Mobile data</span><span class="v">${data}</span></div><div class="tstat-row"><span class="k">Airtime</span><span class="v">₦${snap.airtime.toLocaleString()}</span></div></div>
      <h3 style="font-size:12px;margin:18px 0 8px">CHARGE YOUR PHONE</h3><div class="tacts"><button data-charge="small">+25% · ₦300</button><button data-charge="full">FULL CHARGE · ₦900</button></div><p style="font-size:10px;color:#9fb0c6;line-height:1.5">Battery drains gradually as real time passes. Charging is simulated in-game.</p><h3 style="font-size:12px;margin:18px 0 8px">MY DEVICES</h3><div id="owned-phone-list"></div>`;
    root.querySelectorAll("[data-charge]").forEach(b=>b.onclick=()=>{const r=PhoneLife.charge(b.dataset.charge);const msg={funds:"Not enough money to charge.",no_phone:"Buy a phone first.",full:"Battery is already full."};this._toast(r.ok?`Phone charged to ${r.battery}%.`:msg[r.reason]||"Unable to charge.");this._renderPhoneSettings();this._renderBatteryStatus();});
    const list=root.querySelector("#owned-phone-list");
    if (!Engagement.state.phones.owned.length) list.innerHTML='<div class="tempty">No phones owned yet. Visit the Phone Shop.</div>';
    else list.innerHTML=Engagement.state.phones.owned.map(id=>{const m=PHONE_BY_ID[id];return m?`<div class="ttx"><div><div class="who">${m.brand} ${m.name}</div><div class="when">${m.specs.ram} · ${m.specs.storage}</div></div><button class="buy" data-select-phone="${id}">${id===active?"ACTIVE":"USE PHONE"}</button></div>`:"";}).join("");
    list.querySelectorAll("[data-select-phone]").forEach(b=>b.onclick=()=>{PhoneLife.selectPhone(b.dataset.selectPhone);this._applyDeviceSkin();this._renderPhoneSettings();this._toast("Phone interface changed.");});
  }

  _compact(n){
    n = Math.floor(Number(n) || 0);
    if (n >= 1e9) return "₦" + (Math.floor(n/1e7)/100) + "B";
    if (n >= 1e7) return "₦" + (Math.floor(n/1e4)/100) + "M";
    return "₦" + n.toLocaleString();
  }

  /* ── balance ────────────────────────────────────────── */
  _bal(){
    const full = Economy.format(Economy.balance);
    const pill = document.getElementById("tpill-amt");
    if (pill) pill.textContent = this._compact(Economy.balance);
    const bank = document.getElementById("tbal-bank");
    if (bank) bank.textContent = full;
    const shop = document.getElementById("shop-bal");
    if (shop) shop.textContent = full;
    this._stats();
  }

  /* ── stats (HP + alert) ─────────────────────────────── */
  _stats(){
    const hp = window.__ph3d_combat;
    if (hp) {
      const h  = document.getElementById("thp");
      const hb = document.getElementById("thp-bar");
      const hbig = document.getElementById("thp-big");
      if (h) h.textContent = Math.max(0, Math.round(hp.hp)) + " / " + hp.maxHp;
      if (hb) hb.style.width = Math.max(0, hp.hp / hp.maxHp * 100) + "%";
      if (hbig) hbig.textContent = Math.max(0, Math.round(hp.hp));
    }
    const cr = window.__ph3d_crime;
    if (cr) {
      const a  = document.getElementById("tal");
      const ab = document.getElementById("tal-bar");
      if (a) a.textContent = Math.round(cr.alert) + " / 100";
      if (ab) ab.style.width = Math.min(100, cr.alert) + "%";
    }
  }

  /* ── open / close ───────────────────────────────────── */
  toggle(){ this.visible ? this.hide() : this.show(); }

  show(){
    this.visible = true;
    this.locked = true;
    this._updateLockScreen();
    document.getElementById("phone-lockscreen")?.classList.remove("unlocked");
    window.__ph3d_phoneOpen = true;
    if (window.__ph3d_walkCtrl) window.__ph3d_walkCtrl.setPhoneHold(true);
    try { Sfx.play("phone_open"); } catch (_) {}
    document.getElementById("tphone").classList.add("on");
    document.getElementById("tscrim").classList.add("on");
    this.showApp("home");
    this._bal();
  }

  unlock(){
    if (!this.visible || !this.locked) return;
    this.locked = false;
    const lock = document.getElementById("phone-lockscreen");
    if (lock) lock.classList.add("unlocked");
    try { Sfx.play("phone_open"); } catch (_) {}
  }

  _updateLockScreen(){
    const now = new Date();
    const time = document.getElementById("phone-lock-time");
    const date = document.getElementById("phone-lock-date");
    if (time) time.textContent = String(now.getHours()).padStart(2,"0") + ":" + String(now.getMinutes()).padStart(2,"0");
    if (date) date.textContent = now.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"}).toUpperCase();
  }

  hide(){
    this.visible = false;
    this.locked = true;
    window.__ph3d_phoneOpen = false;
    if (window.__ph3d_walkCtrl) window.__ph3d_walkCtrl.setPhoneHold(false);
    this._clearSelfieState();
    try { Sfx.play("phone_close"); } catch (_) {}
    document.getElementById("tphone").classList.remove("on");
    document.getElementById("tscrim").classList.remove("on");
  }

  _clearSelfieState(){
    if (window.__ph3d_tp) {
      window.__ph3d_tp._selfiePreviewPose = null;
      window.__ph3d_tp._selfieHold = false;
      window.__ph3d_tp._ul && window.__ph3d_tp._ul();
    }
  }

  /* ── app router ─────────────────────────────────────── */
  showApp(n){
    if (n !== "camera") this._clearSelfieState();
    if (n !== "games") { try { PhoneGames.stop(); } catch (e) {} }
    document.querySelectorAll(".tapp").forEach(a => a.classList.remove("on"));
    const map = {
      home: "app-home", bank: "app-bank", health: "app-health",
      mp: "app-mp", inv: "app-inv", homeinfo: "app-homeinfo",
      police: "app-police", justice: "app-justice", shop: "app-shop", camera: "app-camera",
      gallery: "app-gallery", map: "app-map", weather: "app-weather",
      music: "app-music", jobs: "app-jobs", business: "app-business", property: "app-property", career: "app-career", story: "app-story", hunt: "app-hunt",
      about: "app-about", games: "app-games", comics: "app-comics", education: "app-education", social: "app-social", settings: "app-settings",
    };
    const id = map[n];
    const el = id && document.getElementById(id);
    if (el) el.classList.add("on");
    const shell = document.getElementById("tphone");
    if (shell) {
      shell.classList.toggle("app-immersive", n !== "home");
      shell.querySelectorAll(".tapp").forEach(a => a.classList.remove("phone-theme-active"));
      if (el) { el.classList.add("phone-theme-active"); el.dataset.phoneTheme = n; }
      shell.dataset.activeApp = n;
    }
    this.app = n;

    if (n === "bank") { this._bmini(); import("../ui/banking-panel.js").then(m => m.BankingPanel.render()).catch(e => console.warn("[banking panel]",e)); }
    if (n === "health")  this._stats();
    if (n === "mp")      this._renderMP();
    if (n === "inv")     this._renderInv();
    if (n === "police")  this._renderPolice();
    if (n === "justice") { import("../ui/justice-panel.js").then(m => m.JusticePanel.render()).catch(e => console.warn("[justice panel]",e)); }
    if (n === "shop")    this._renderShop();
    if (n === "camera")  this._renderCamera();
    if (n === "gallery") this._renderGallery();
    if (n === "map")     this._renderMap();
    if (n === "homeinfo")this._renderHomeinfo();
    if (n === "weather") this._renderWeather();
    if (n === "games")   { try { PhoneGames.hub(); } catch (e) { console.warn(e); } }
    if (n === "music")   this._renderMusic();
    if (n === "jobs")    this._renderJobs();
    if (n === "business") { import("../ui/business-panel.js").then(m => m.BusinessPanel.render()).catch(e => console.warn("[business panel]",e)); }
    if (n === "property") { import("../ui/property-panel.js").then(m => m.PropertyPanel.render()).catch(e => console.warn("[property panel]",e)); }
    if (n === "career") { import("../ui/career-panel.js").then(m => m.CareerPanel.render()).catch(e => console.warn("[career panel]",e)); }
    if (n === "story") { import("../ui/story-panel.js").then(m => m.StoryPanel.render()).catch(e => console.warn("[story panel]",e)); }
    if (n === "comics") { import("../ui/comics-panel.js").then(m => m.ComicsPanel.render()).catch(e => console.warn("[comics panel]",e)); }
    if (n === "education") { import("../ui/education-panel.js").then(m => m.EducationPanel.render()).catch(e => console.warn("[education panel]",e)); }
    if (n === "social") { import("../ui/social-panel.js").then(m => m.SocialPanel.render()).catch(e => console.warn("[social panel]",e)); }
    if (n === "settings") this._renderPhoneSettings();
    this._applyDeviceSkin();
    if (n === "hunt")    this._renderHunt();
    this._stats();
  }

  /* ── BANK ───────────────────────────────────────────── */
  _formSend(){
    const b = document.getElementById("bbody");
    b.innerHTML = `
      <div class="tform">
        <label>Recipient</label>
        <input id="f1" placeholder="username"/>
        <label>Amount (₦)</label>
        <input id="f2" type="number" inputmode="numeric" placeholder="0"/>
        <label>Note</label>
        <input id="f3" placeholder="optional"/>
        <button class="go" id="fgo">Send Money</button>
      </div>`;
    document.getElementById("fgo").onclick = () => {
      const to = document.getElementById("f1").value.trim();
      const amt = Number(document.getElementById("f2").value);
      const note = document.getElementById("f3").value.trim();
      if (!to) { this._toast("Enter recipient"); return; }
      if (!amt || amt <= 0) { this._toast("Enter amount"); return; }
      const tx = Economy.send(to, amt, note);
      if (!tx) { this._toast("Not enough money"); return; }
      this._receipt(tx);
      this._formSend();
    };
  }

  _formWd(){
    const b = document.getElementById("bbody");
    b.innerHTML = `
      <div class="tform">
        <label>Amount (₦)</label>
        <input id="f1" type="number" inputmode="numeric" placeholder="0"/>
        <button class="go" id="fgo">Withdraw</button>
      </div>`;
    document.getElementById("fgo").onclick = () => {
      const amt = Number(document.getElementById("f1").value);
      if (!amt || amt <= 0) { this._toast("Enter amount"); return; }
      const tx = Economy.withdraw(amt);
      if (!tx) { this._toast("Not enough money"); return; }
      this._receipt(tx);
      this._bmini();
    };
  }

  _history(){
    const b = document.getElementById("bbody");
    if (!Economy.transactions.length) {
      b.innerHTML = '<div class="tempty">No transactions yet</div>';
      return;
    }
    let h = "";
    for (const tx of Economy.transactions) {
      const r = this._lbl(tx);
      h += `<div class="ttx">
        <div><div class="who">${r.l}</div>
        <div class="when">${new Date(tx.time).toLocaleString()}</div></div>
        <div class="r ${r.c}">${r.a}</div>
      </div>`;
    }
    b.innerHTML = h;
  }

  _lbl(tx){
    if (tx.type === "send")     return { l: "To " + tx.to, c: "neg", a: "−" + Economy.format(tx.amount) };
    if (tx.type === "receive")  return { l: "From " + tx.from, c: "pos", a: "+" + Economy.format(tx.amount) };
    if (tx.type === "withdraw") return { l: "Cash withdrawal", c: "neg", a: "−" + Economy.format(tx.amount) };
    if (tx.type === "robbed")   return { l: "Robbed by " + tx.by, c: "neg", a: "−" + Economy.format(tx.amount) };
    return { l: tx.type, c: "", a: Economy.format(tx.amount || 0) };
  }

  _bmini(){
    const el = document.getElementById("bbody");
    if (!el) return;
    if (!Economy.transactions.length) {
      el.innerHTML = '<div class="tempty">No transactions yet</div>';
      return;
    }
    let h = "";
    for (const tx of Economy.transactions.slice(0, 5)) {
      const r = this._lbl(tx);
      h += `<div class="ttx">
        <div><div class="who">${r.l}</div>
        <div class="when">${new Date(tx.time).toLocaleTimeString()}</div></div>
        <div class="r ${r.c}">${r.a}</div>
      </div>`;
    }
    el.innerHTML = h;
  }

  /* ── CITY PEOPLE DIRECTORY (NPCs, not online players) ── */
  _renderMP(){
    const el = document.getElementById("mplist");
    if (!el) return;
    import("./npcs.js").then(({ NPCs }) => {
      const people = (NPCs.list || []).filter(n => n && !n.dead);
      const roles = { police:"Police", doctor:"Medical", trader:"Trader", mechanic:"Mechanic", banker:"Banking", priest:"Clergy", taxi:"Driver" };
      const counts = people.reduce((a,n)=>{ const r=roles[n.role]||"Resident"; a[r]=(a[r]||0)+1; return a; },{});
      const chips = Object.entries(counts).map(([k,v])=>`<span class="people-chip">${k} <b>${v}</b></span>`).join("");
      const rows = people.slice(0,60).map((n,i)=>{
        const role=roles[n.role]||"City resident";
        const name=String(n.name||n.label||`${role} ${i+1}`).replace(/[<>&"']/g,'');
        const initials=name.split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase();
        return `<article class="people-row"><div class="people-avatar">${initials||"PH"}</div><div class="people-copy"><b>${name}</b><small>${role} · ${n.groupTag?"With a group":"Around the city"}</small></div><span class="people-presence">IN CITY</span></article>`;
      }).join("");
      el.innerHTML=`<header class="people-head"><div class="people-eyebrow">GARDEN CITY DIRECTORY</div><h2>People around you</h2><p>Meet the residents and characters living in Port Harcourt.</p><div class="people-total"><strong>${people.length}</strong><span>active city characters</span></div></header><div class="people-filters">${chips||'<span class="people-chip">City residents</span>'}</div><div class="people-list-title">CITY DIRECTORY <span>${Math.min(people.length,60)} shown</span></div>${rows||'<div class="tempty">The streets are quiet right now. Explore the city to meet people.</div>'}<div class="people-footnote">These are computer-controlled NPCs, not connected human players. Online multiplayer is a separate feature.</div>`;
    }).catch(()=>{el.innerHTML='<div class="tempty">City directory is loading. Try again shortly.</div>';});
  }

  /* ── SHOP ───────────────────────────────────────────── */
  _renderShop(){
    const el = document.getElementById("shop-list");
    const bal = document.getElementById("shop-bal");
    if (!el) return;
    const Eco = window.__ph3d_economy || Economy;
    if (bal) bal.textContent = Eco.format(Eco.balance);

    document.querySelectorAll(".shoptabbtn").forEach(b => {
      const on = b.dataset.shoptab === this.shopTab;
      b.classList.toggle("on", on);
      b.onclick = () => { this.shopTab = b.dataset.shoptab; this._renderShop(); };
    });

    if (this.shopTab === "food") return this._renderShopFood(el, Eco);
    if (this.shopTab === "limited") return this._renderLimitedFits(el, Eco);
    this._renderShopGuns(el);
  }

  _renderShopFood(el, Eco){
    let h = `<div style="font-size:10px;letter-spacing:.22em;color:rgba(244,244,244,.55);font-weight:800;margin:8px 0 10px">Food · ${SHOP_FOODS.length} items</div>`;
    SHOP_FOODS.forEach(id => {
      const f = FOOD_ITEMS[id];
      if (!f) return;
      h += `<div class="ttx">
        <div><div class="who">${f.name}</div>
          <div class="when">+${f.heal} HP · ${f.desc}</div></div>
        <button data-food="${f.id}" class="buy">₦${f.price.toLocaleString()}</button>
      </div>`;
    });
    el.innerHTML = h;
    el.querySelectorAll("button[data-food]").forEach(b => {
      b.onclick = () => {
        const id = b.dataset.food;
        const f = FOOD_ITEMS[id];
        if (Eco.balance < f.price) { this._toast("Not enough money"); return; }
        if (Pocket.isFull())       { this._toast("Pocket is full"); return; }
        Eco.withdraw(f.price);
        Pocket.add(f.id, 1);
        this._toast("Bought " + f.name);
        this._renderShop();
      };
    });
  }

  _renderLimitedFits(el, Eco){
    const drops = [
      {id:"royal_agbada",name:"Royal Agbada Set",desc:"A premium ceremonial look with a clean royal finish.",costume:"king",price:28000,stock:120,tag:"LIMITED DROP"},
      {id:"neon_runner",name:"Neon Runner Outfit",desc:"Streetwear colours inspired by the Garden City at night.",costume:"superhero",price:22000,stock:180,tag:"CITY EDITION"},
      {id:"shadow_ninja",name:"Shadow Ninja Suit",desc:"A stealth-inspired limited outfit.",costume:"ninja",price:35000,stock:75,tag:"RARE"},
      {id:"orbit_explorer",name:"Orbit Explorer Suit",desc:"A futuristic exploration suit.",costume:"astronaut",price:42000,stock:45,tag:"ULTRA RARE"},
      {id:"angelic_dress",name:"Angelic Limited Dress",desc:"A graceful formal dress with a premium finish.",costume:"angel",price:26000,stock:90,tag:"LIMITED DRESS"}
    ];
    const KEY="ph3d.limited-fits.owned";let owned=[];try{owned=JSON.parse(localStorage.getItem(KEY)||"[]");}catch(_){}
    let h='<div style="font-size:10px;letter-spacing:.18em;color:rgba(244,244,244,.6);font-weight:800;margin:8px 0 10px">LIMITED FASHION COLLECTION · EXCLUSIVE OUTFITS</div>';
    h+=drops.map(d=>`<div class="ttx"><div><div class="who">${d.name} <span style="font-size:9px;color:#72dfff">${d.tag}</span></div><div class="when">${d.desc}<br>Limited collection · ${d.stock} release units</div></div><button data-fit="${d.id}" class="${owned.includes(d.id)?"ghost":"buy"}">${owned.includes(d.id)?"OWNED":"₦"+d.price.toLocaleString()}</button></div>`).join("");
    el.innerHTML=h;
    el.querySelectorAll("[data-fit]").forEach(b=>b.onclick=async()=>{
      const d=drops.find(x=>x.id===b.dataset.fit);if(!d)return;
      if(owned.includes(d.id)){const {Wardrobe}=await import("./wardrobe.js");Wardrobe.set("costume",d.costume);this._toast("Equipped "+d.name);return;}
      if(Eco.balance<d.price){this._toast("Not enough money");return;}
      if(!Eco.withdraw(d.price)){this._toast("Payment failed");return;}
      owned.push(d.id);try{localStorage.setItem(KEY,JSON.stringify(owned));}catch(_){}
      const {Wardrobe}=await import("./wardrobe.js");Wardrobe.set("costume",d.costume);
      this._toast("Purchased and equipped "+d.name);this._renderShop();
    });
  }

  _renderShopGuns(el){
    const W = window.__ph3d_weapons;
    if (!W) { el.innerHTML = '<div class="tempty">Weapons loading…</div>'; return; }
    const WEAPONS = window.__ph3d_weapons.WEAPONS || {};
    let h = '<div style="font-size:10px;letter-spacing:.22em;color:rgba(244,244,244,.55);font-weight:800;margin:8px 0 10px">Weapons</div>';
    Object.values(WEAPONS).forEach(w => {
      const owned = W.owned.includes(w.id);
      h += `<div class="ttx">
        <div><div class="who">${w.name}</div>
          <div class="when">DMG ${w.damage} · ${w.magSize} rnds</div></div>
        <button data-gun="${w.id}" class="${owned ? "ghost" : "buy"}">
          ${owned ? "Owned" : "₦" + w.price.toLocaleString()}
        </button>
      </div>`;
    });
    el.innerHTML = h;
    el.querySelectorAll("button[data-gun]").forEach(b => {
      b.onclick = () => {
        const id = b.dataset.gun;
        const W2 = window.__ph3d_weapons;
        if (W2.owned.includes(id)) {
          W2.select(id);
          this._toast("Equipped " + id);
        } else if (W2.buy(id)) {
          this._toast("Bought " + id);
          this._renderShop();
        } else {
          this._toast("Not enough money");
        }
      };
    });
  }

  /* ── POLICE ─────────────────────────────────────────── */
  _renderPolice(){
    const al = document.getElementById("police-alert");
    const lg = document.getElementById("police-log");
    const crime = window.__ph3d_crime;
    const pol = window.__ph3d_police;
    if (al && crime) al.textContent = Math.round(crime.alert) + " / 100";
    if (!lg) return;

    if (pol && pol.dispatched) {
      const remain = Math.max(0, pol.arrivalTime - pol.timer).toFixed(1);
      lg.innerHTML = `<div class="tstat-panel">
        <div class="tstat-row"><span class="k">Status</span><span class="v" style="color:#ffcc5e">Dispatched</span></div>
        <div class="tstat-row"><span class="k">ETA</span><span class="v">${remain}s</span></div>
        <div class="tstat-row"><span class="k">Target</span><span class="v">${pol.target || "—"}</span></div>
      </div>`;
      return;
    }
    if (!crime || !crime.log.length) {
      lg.innerHTML = '<div class="tempty">No crime on record</div>';
      return;
    }
    let h = '<div style="font-size:10px;letter-spacing:.22em;color:rgba(244,244,244,.55);font-weight:800;margin:8px 0 10px">Crime Log</div>';
    for (const e of crime.log.slice(0, 8)) {
      h += `<div class="ttx">
        <div><div class="who">${e.kind}</div>
        <div class="when">${new Date(e.time).toLocaleTimeString()}</div></div>
        <div class="r neg">+${e.amount}</div>
      </div>`;
    }
    lg.innerHTML = h;
  }

  /* ── CAMERA ─────────────────────────────────────────── */
  _renderCamera(){
    const btn = document.getElementById("cam-shutter");
    const flash = document.getElementById("cam-flash");
    const hint = document.getElementById("cam-hint");
    const poseRow = document.getElementById("cam-poses");
    if (!btn) return;

    const modeBtns = document.querySelectorAll("#cam-mode button");
    modeBtns.forEach(b => {
      b.classList.toggle("on", b.dataset.mode === this._camMode);
      b.onclick = () => {
        this._camMode = b.dataset.mode;
        modeBtns.forEach(x => x.classList.toggle("on", x === b));
        this._syncCameraPreview();
      };
    });

    if (poseRow) {
      poseRow.innerHTML = "";
      SELFIE_POSE_ORDER.forEach(key => {
        const p = SELFIE_POSES[key];
        if (!p) return;
        const b = document.createElement("button");
        b.className = "cam-pose" + (this._camPose === key ? " on" : "");
        b.dataset.pose = key;
        b.textContent = p.short;
        b.onclick = () => {
          this._camPose = key;
          poseRow.querySelectorAll(".cam-pose").forEach(x => x.classList.toggle("on", x === b));
          this._syncCameraPreview();
        };
        poseRow.appendChild(b);
      });
    }

    this._syncCameraPreview();

    btn.onclick = async () => {
      const { Photos, captureFrame, captureSelfie } = await import("./photos.js");
      let url = null;
      if (this._camMode === "selfie") {
        url = captureSelfie(this._camPose);
        if (!url) { this._toast("Selfie needs a walkable scene"); return; }
      } else {
        url = captureFrame();
        if (!url) { this._toast("Nothing to capture"); return; }
      }
      try { window.__ph3d_camMode = this._camMode; } catch (e) {}
      const shot = Photos.add(url);
      try { if (localStorage.getItem("ph3d_autosave_photos") === "1") Photos.saveToDevice(shot.id); } catch (e) {}
      if (flash) {
        flash.classList.add("on");
        setTimeout(() => flash.classList.remove("on"), 150);
      }
      if (hint) hint.textContent = "Saved";
      setTimeout(() => this._syncCameraPreview(), 900);
      this._toast(this._camMode === "selfie" ? "Selfie saved" : "Photo saved");
    };
  }

  _syncCameraPreview(){
    const view  = document.getElementById("cam-view");
    const live  = document.getElementById("cam-live");
    const hint  = document.getElementById("cam-hint");
    const wrap  = document.getElementById("cam-poses-wrap");
    const phone = document.getElementById("tphone");
    if (!view || !phone) return;

    /* reset phone wallpaper */
    phone.style.setProperty("--wallpaper", "");
    phone.classList.remove("has-wallpaper");
    view.style.backgroundImage = "";

    if (this._camMode === "scene") {
      if (wrap) wrap.classList.remove("on");
      if (hint) hint.textContent = "Snapshot";
      if (live) { live.style.display = "flex"; live.textContent = "Tap shutter to capture"; }
      this._clearSelfieState();
      return;
    }

    /* selfie mode */
    if (wrap) wrap.classList.add("on");
    if (hint) hint.textContent = "Pose for a selfie";
    if (live) live.textContent = "Tap a pose, then shutter";

    if (window.__ph3d_tp) {
      window.__ph3d_tp._selfiePreviewPose = this._camPose;
      window.__ph3d_tp._selfieHold = true;
      window.__ph3d_tp._ul && window.__ph3d_tp._ul();
    }

    import("./photos.js").then(({ captureSelfie, captureFrame }) => {
      const url = captureSelfie(this._camPose) || captureFrame();
      if (!url) return;

      view.style.backgroundImage = `url(${url})`;
      view.style.backgroundSize  = "cover";
      view.style.backgroundPosition = "center";
      if (live) live.style.display = "none";

      phone.style.setProperty("--wallpaper", `url(${url})`);
      phone.classList.add("has-wallpaper");
    }).catch(() => {});
  }

  /* ── GALLERY ────────────────────────────────────────── */
  _renderGallery(){
    const grid = document.getElementById("gal-grid");
    if (!grid) return;
    import("./photos.js").then(({ Photos }) => {
      const render = () => {
        if (!Photos.list.length) {
          grid.innerHTML = '<div class="gal-empty">No photos yet.<br/>Open Camera and tap shutter.</div>';
          return;
        }
        let h = `<button id="gal-open-3d" style="grid-column:1/-1;margin:2px 0 6px;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fff;font:800 12px Inter,system-ui,sans-serif;letter-spacing:.08em">OPEN 3D ALBUM</button>`;
        const auto = (() => { try { return localStorage.getItem("ph3d_autosave_photos") === "1"; } catch (e) { return false; } })();
        h += `<button id="gal-autosave">⬇ Auto-save new photos to device: ${auto ? "ON" : "OFF"}</button>`;
        for (const p of Photos.list) {
          h += `<div class="gal-item" data-id="${p.id}">
            <img src="${p.url}" alt=""/>
            <button class="del" data-del="${p.id}"><i class="fa-solid fa-xmark"></i></button>
            <button class="sv" data-sv="${p.id}" title="Save to device"><i class="fa-solid fa-download"></i></button>
          </div>`;
        }
        grid.innerHTML = h;
        const as = grid.querySelector("#gal-autosave");
        if (as) as.onclick = () => { try { localStorage.setItem("ph3d_autosave_photos", localStorage.getItem("ph3d_autosave_photos") === "1" ? "0" : "1"); } catch (e) {} render(); };
        const b3 = grid.querySelector("#gal-open-3d");
        if (b3) b3.onclick = () => this._openGalleryView(Photos.list[0] && Photos.list[0].id);
        grid.querySelectorAll(".gal-item").forEach(el => {
          el.querySelector("img").onclick = () => this._openGalleryView(el.dataset.id);
        });
        grid.querySelectorAll(".sv").forEach(b => {
          b.onclick = (ev) => { ev.stopPropagation(); Photos.saveToDevice(b.dataset.sv); };
        });
        grid.querySelectorAll(".del").forEach(b => {
          b.onclick = (ev) => {
            ev.stopPropagation();
            Photos.remove(b.dataset.del);
            render();
          };
        });
      };
      render();
      try { Photos.load().then(() => render()); } catch (e) {}
    });
  }

  _openGalleryView(id){
    import("./photos.js").then(({ Photos }) => {
      const p = Photos.list.find(x => x.id === id);
      if (!p) return;
      /* photos are 3D objects: open the 3D album focused on this one (zoom + rotate) */
      import("./photo3d.js").then(({ PhotoViewer3D }) => {
        this.hide();
        PhotoViewer3D.open(id, { onClose: () => { try { this._renderGallery(); } catch (e) {} } });
      }).catch((err) => {
        console.warn("[gallery] 3D viewer failed, using flat view", err);
        const view = document.getElementById("gal-view");
        const img = document.getElementById("gal-view-img");
        img.src = p.url; img.dataset.id = id; view.classList.add("on");
      });
    });
  }

  /* ── MAP ────────────────────────────────────────────── */
  _renderMap(){
    import("./map-app.js").then(m => {
      if (m && m.MapApp) { this.hide(); m.MapApp.open(); }
    }).catch(e => console.warn("[map] open failed", e));
  }

  _goCityMap(){
    try {
      const Pr = window.__ph3d_prison;
      if (Pr && Pr.inJail) { this._toast("Serve your sentence or pay bail."); return; }
    } catch (e) {}
    this.hide();
    import("./map-app.js").then(m => {
      if (m && m.MapApp) m.MapApp.open();
    }).catch(e => console.warn("[map] open failed", e));
  }

  /* ── HOME INFO ──────────────────────────────────────── */
  _renderHomeinfo(){
    const p = window.__ph3d_router && window.__ph3d_router.current;
    const name = (p && p.crumb) ? p.crumb : "City Map";
    const el = document.getElementById("hplace");
    if (el) el.textContent = name;
  }

  _goHome(){
    try {
      const Pr = window.__ph3d_prison;
      if (Pr && Pr.inJail) { this._toast("Serve your sentence or pay bail."); return; }
    } catch (e) {}
    const r = window.__ph3d_router;
    if (!r || !r.go) { this._toast("Can't reach home right now"); return; }
    this.hide();
    try {
      r.go("interior", { id: "myhouse" });
    } catch (e) {
      r.go("interior", { id: "myhouse" });
    }
  }

  /* ── WEATHER / MUSIC ────────────────────────────────── */
  _renderWeather(){ try { PhoneGames.weather(); } catch (e) { console.warn(e); } }
  _renderMusic(){
    import("./audio.js").then(({ AudioSystem }) => {
      const mute=document.getElementById("music-mute"), vol=document.getElementById("music-volume"), status=document.getElementById("music-status");
      if(!mute||!vol)return;
      mute.innerHTML=AudioSystem.muted?'<i class="fa-solid fa-volume-high"></i> Unmute sound':'<i class="fa-solid fa-volume-xmark"></i> Mute sound';
      vol.value=Math.round((AudioSystem._userVol==null?.4:AudioSystem._userVol)*100);
      if(status)status.textContent=AudioSystem.muted?"Sound is muted.":`Soundscape: ${AudioSystem.mood||"city ambience"}.`;
      mute.onclick=()=>{const muted=AudioSystem.toggleMute();mute.innerHTML=muted?'<i class="fa-solid fa-volume-high"></i> Unmute sound':'<i class="fa-solid fa-volume-xmark"></i> Mute sound';if(status)status.textContent=muted?"Sound is muted.":`Soundscape: ${AudioSystem.mood||"city ambience"}.`;};
      vol.oninput=()=>AudioSystem.setMusicVolume(Number(vol.value)/100);
      const scene=document.getElementById("music-next");if(scene)scene.onclick=()=>{if(status)status.textContent=`Current soundscape: ${AudioSystem.mood||"city ambience"}. It changes automatically as you move.`;};
    }).catch(()=>{});
  }

  /* ── INVENTORY ──────────────────────────────────────── */
  _renderInv(){
    const el = document.getElementById("invlist");
    if (!el) return;
    const slots = Pocket.slots.map((slot, slotIndex) => slot ? ({ ...slot, slotIndex }) : null).filter(Boolean);
    if (!slots.length) {
      el.innerHTML = '<header class="inventory-head"><span>POCKET STORAGE</span><h2>Your carry bag</h2><p>Market purchases and city pickups appear here.</p></header><div class="inventory-empty"><i class="fa-solid fa-box-open"></i><b>Nothing in your bag</b><span>Buy goods at Mile 1 Market or collect items around the city.</span></div>';
      return;
    }
    const total = slots.reduce((a,it)=>a+(Number(it.qty)||1),0);
    const esc = (v) => String(v == null ? "" : v).replace(/[<>&"']/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;", "'":"&#39;"}[c]));
    el.innerHTML = `<header class="inventory-head"><span>POCKET STORAGE</span><h2>Your carry bag</h2><p>${total} item units · ${slots.length} item types</p><div class="inventory-capacity"><i style="width:${Math.min(100,slots.length/8*100)}%"></i></div><small>${slots.length} / 8 slots used</small></header><div class="inventory-grid">${slots.map((it)=>{const label=MILE1_BY_ID[it.id]?.label || POCKET_ITEMS[it.id]?.name || it.id;return `<button class="inventory-item" data-pocket-index="${it.slotIndex}"><span class="inventory-item-icon"><i class="fa-solid fa-cube"></i></span><b>${esc(label)}</b><small>${esc(it.id.replace(/_/g," "))}</small><em>×${it.qty||1}</em></button>`;}).join("")}</div><div class="inventory-detail" id="inventory-detail">Select an item to use, equip, sell or drop it.</div>`;
    el.querySelectorAll("[data-pocket-index]").forEach(b=>b.onclick=()=>{
      const index = Number(b.dataset.pocketIndex), slot = Pocket.slots[index];
      if (!slot) return;
      const detail = el.querySelector("#inventory-detail");
      const displayName = MILE1_BY_ID[slot.id]?.label || POCKET_ITEMS[slot.id]?.name || slot.id.replace(/_/g," ").toUpperCase();
      const name = esc(displayName);
      const held = window.__ph3d_playerActions?.heldItem?.();
      const isHeld = held?.type === slot.id && held?.mesh?.userData?.marketItemId === slot.id;
      detail.innerHTML = `<b>${name}</b><span>${esc(slot.id.replace(/_/g," "))}</span><small>Quantity: ${slot.qty||1}</small><div class="inventory-item-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button type="button" data-pocket-use style="padding:11px 14px;border:0;border-radius:10px;background:#36d889;color:#07150e;font-weight:900">${isHeld?"PUT AWAY":"USE / EQUIP"}</button><button type="button" data-pocket-drop style="padding:11px 14px;border:1px solid #ff7777;border-radius:10px;background:#351b22;color:#ffaaaa;font-weight:900">DROP</button><button type="button" data-pocket-sell style="padding:11px 14px;border:1px solid #ffffff33;border-radius:10px;background:#172536;color:#fff;font-weight:900">SELL</button></div>`;
      el.querySelectorAll(".inventory-item").forEach(x=>x.classList.toggle("selected",x===b));
      detail.querySelector("[data-pocket-use]").onclick = async () => {
        if (isHeld) {
          const { unequipMarketPocketItem } = await import("./market-item-use.js");
          unequipMarketPocketItem();
        } else {
          const { useMarketPocketItem } = await import("./market-item-use.js");
          const result = await useMarketPocketItem(index);
          if (!result.ok) this._toast(result.message || "Unable to use this item.");
        }
        this._renderInv();
      };
      detail.querySelector("[data-pocket-drop]").onclick = async () => {
        const { POCKET_ITEMS } = await import("./pocket.js");
        const spec = POCKET_ITEMS[slot.id] || { id:slot.id, name:displayName, desc:"Market item" };
        const world = window.__ph3d_world_objects;
        const visual = world?.dropPocketItem?.({ ...spec, id:slot.id, name:spec.name || slot.name }, window.__ph3d_player);
        if (!visual) { this._toast("Cannot drop an item in this scene."); return; }
        Pocket.remove(index, 1); this._toast("Dropped " + (spec.name || slot.id) + "."); this._renderInv();
      };
      detail.querySelector("[data-pocket-sell]").onclick = () => {
        const spec = Pocket.slots[index] && Pocket.sellSlot(index);
        if (spec > 0) { Economy.receive("POCKET", spec, displayName); this._toast("Sold for ₦" + spec.toLocaleString()); }
        else this._toast("This item cannot be sold.");
        this._renderInv();
      };
    });
  }

  /* ── receipt ────────────────────────────────────────── */
  _receipt(tx){
    const isS = tx.type === "send";
    const isW = tx.type === "withdraw";
    const title = isS ? "Sent" : isW ? "Withdrawn" : "Received";
    const sign = isS || isW ? "−" : "+";
    const to = isS ? "To " + tx.to : isW ? "Cash on hand" : "From " + tx.from;

    const r = document.createElement("div");
    r.className = "trec";
    r.innerHTML = `
      <div class="rl"><div class="lg"><i class="fa-solid fa-building-columns"></i></div> Bank</div>
      <div class="amt">${sign}${Economy.format(tx.amount)}</div>
      <div class="to">${to}</div>
      <div class="row"><span class="k">Ref</span><span class="v">${tx.id}</span></div>
      <div class="row"><span class="k">Time</span><span class="v">${new Date(tx.time).toLocaleString()}</span></div>
      <div class="row"><span class="k">Status</span><span class="v" style="color:#7dff9b">${title}</span></div>
      <button class="ok">Done</button>`;
    document.body.appendChild(r);
    requestAnimationFrame(() => r.classList.add("on"));
    const done = () => { r.classList.remove("on"); setTimeout(() => r.remove(), 400); };
    r.querySelector(".ok").onclick = done;
    setTimeout(done, 4500);
  }

  /* ── JOBS ───────────────────────────────────────────── */
  async _renderJobs(){
    const { JobObjectives } = await import("./job-objectives.js");
    const j = JobObjectives.active();
    const t = JobObjectives.target();
    const act = document.getElementById("jobs-active");
    if (act) {
      act.textContent = j ? j.name : "None";
      act.classList.toggle("jb-none", !j);
    }
    const to = document.getElementById("jobs-to");
    const stats = document.getElementById("jobs-stats");
    if (to) to.textContent = j && t ? (j.stage === "repair" ? "Repair at " : j.stage === "dropoff" ? "Drop-off: " : "Pick-up: ") + t.name : "Pick a job below";
    if (stats) stats.style.display = j ? "" : "none";
    if (j && t) {
      let d = 0;
      try { const p = window.__ph3d_drive && window.__ph3d_drive.getPos(); if (p) d = Math.hypot(t.x - p.x, t.z - p.z); } catch (e) {}
      const sec = Math.max(0, Math.ceil(j.timer));
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set("jobs-dist", d >= 1000 ? (d / 1000).toFixed(1) + " km" : Math.round(d) + " m");
      set("jobs-time", Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"));
      set("jobs-pay", "\u20A6" + j.reward.toLocaleString());
    }
    for (const id of ["job-delivery", "job-taxi", "job-mechanic"]) {
      const b = document.getElementById(id);
      if (b) b.style.display = j ? "none" : "";
    }
    const c = document.getElementById("job-cancel");
    if (c) c.style.display = j ? "" : "none";
    /* keep live while the Jobs screen is open */
    clearTimeout(this._jobsTimer);
    const app = document.getElementById("app-jobs");
    if (app && app.classList.contains("on")) this._jobsTimer = setTimeout(() => this._renderJobs(), 500);
  }

  async _renderHunt(){
    const { Hunt } = await import("../core/hunt.js");
    const { HUNT_TIERS, HUNT_TIER_ORDER } = await import("../core/hunt-contracts.js");
    const { confirmHunt } = await import("../ui/hunt-confirm.js");
    const { Rep } = await import("../core/rep.js");
    const activeEl = document.getElementById("hunt-active");
    const listEl = document.getElementById("hunt-list");
    if (!activeEl || !listEl) return;
    const icon = document.querySelector('.tapp-ic[data-a="hunt"]');
    if (icon) icon.classList.toggle("is-active", !!Hunt.active);
    if (Hunt.active) {
      const s = Hunt.getState();
      activeEl.style.display = "block";
      document.getElementById("hunt-active-name").textContent = s.tier.name;
      const tt = s.tier.reversed ? ` · ${s.targetsKilled}/${s.targetsRequired}` : "";
      document.getElementById("hunt-active-meta").textContent = `Hour ${s.hour} / ${s.totalHours} · ₦${s.prize.toLocaleString()} accumulated${tt}`;
      document.getElementById("hunt-cashout").style.display = s.tier.reversed ? "none" : "";
      document.getElementById("hunt-cashout").onclick = async () => {
        const { confirmDanger } = await import("../ui/settings.js");
        const pen = s.tier.cashOutPenalty, payout = Math.floor(s.prize * (1 - pen));
        if (await confirmDanger(`Cash out now and lose ${Math.round(pen*100)}%? You will receive ₦${payout.toLocaleString()}.`)) { Hunt.cashOut(); this._renderHunt(); }
      };
      document.getElementById("hunt-abandon").onclick = async () => {
        const { confirmDanger } = await import("../ui/settings.js");
        if (await confirmDanger("Abandon the contract? You lose the entire prize pool.")) { Hunt._end("abandon"); this._renderHunt(); }
      };
      listEl.style.display = "none";
      this._renderHuntLB();
      return;
    }
    activeEl.style.display = "none";
    listEl.style.display = "block";
    const rep = Rep.get();
    let html = "";
    for (const id of HUNT_TIER_ORDER) {
      const t = HUNT_TIERS[id];
      const locked = rep < t.requireReputation;
      const total = t.finalBonus || t.prizePerHour.reduce((a, b) => a + b, 0);
      html += `<div class="hunt-card ${locked ? "locked" : ""}">
        <div class="hunt-card-name">${t.name}</div><div class="hunt-card-tag">${t.tag}</div>
        <div class="hunt-card-desc">${t.desc}</div><div class="hunt-card-prize">₦${total.toLocaleString()}</div>
        ${locked ? `<div class="hunt-card-lock">Needs ${t.requireReputation} rep</div>` : `<button class="hunt-btn hunt-btn-accept" data-tier="${id}">ACCEPT CONTRACT</button>`}
      </div>`;
    }
    listEl.innerHTML = html;
    listEl.querySelectorAll("button[data-tier]").forEach((b) => {
      b.onclick = async () => {
        if (!(await confirmHunt(b.dataset.tier))) return;
        const res = Hunt.start(b.dataset.tier);
        if (!res.ok) {
          this._toast(res.reason === "not_in_world" ? "Start the hunt from the street" : res.reason === "low_rep" ? `Need ${res.need} reputation` : "Cannot start");
          return;
        }
        this.hide(); this._renderHunt();
      };
    });
    this._renderHuntLB();
    this._renderHuntAchievements();
  }

  async _renderHuntLB(){
    const el = document.getElementById("hunt-lb"); if (!el) return;
    try {
      const { HuntLeaderboard } = await import("../core/hunt-leaderboard.js");
      const top = HuntLeaderboard.top(5);
      if (!top.length) { el.innerHTML = '<div class="hunt-lb-empty">No hunts completed yet.</div>'; return; }
      el.innerHTML = top.map((e, i) => `<div class="hunt-lb-row"><span class="hunt-lb-rank">#${i+1}</span><span class="hunt-lb-name">${String(e.name).replace(/[<>&]/g,"")}</span><span class="hunt-lb-prize">₦${e.payout.toLocaleString()}</span></div>`).join("");
    } catch (e) { el.innerHTML = ""; }
  }

  async _renderHuntAchievements(){
    let el = document.getElementById("hunt-achievements");
    if (!el) {
      const wrap = document.querySelector(".hunt-lb-wrap"); if (!wrap) return;
      el = document.createElement("div"); el.id = "hunt-achievements"; el.className = "hunt-lb-wrap";
      wrap.parentNode.insertBefore(el, wrap.nextSibling);
    }
    try {
      const { HuntAchievements } = await import("../core/hunt-achievements.js");
      const un = new Set(HuntAchievements.unlocked());
      el.innerHTML = '<div class="hunt-lb-title">ACHIEVEMENTS</div>' + HuntAchievements.all().map((d) => {
        const on = un.has(d.id);
        return `<div class="hunt-lb-row ${on ? "ach-on" : "ach-off"}"><span class="hunt-lb-rank">${on ? "✓" : "·"}</span><span class="hunt-lb-name"><b>${d.label}</b><br><span style="font-size:10px;opacity:.7">${d.desc}</span></span></div>`;
      }).join("");
    } catch (e) { el.innerHTML = ""; }
  }

  /* ── toast ──────────────────────────────────────────── */
  notify(title, body){
    this._toast(title);
    if (body) console.log("[PHONE]", title, body);
  }

  _toast(text){
    const o = document.getElementById("ttoast");
    if (o) o.remove();
    const t = document.createElement("div");
    t.id = "ttoast";
    t.className = "ttoast";
    t.textContent = text;
    document.body.appendChild(t);
    try { Sfx.play("notification_ping"); } catch (_) {}
    setTimeout(() => { t.style.opacity = "0"; }, 2200);
    setTimeout(() => t.remove(), 2600);
  }
}
