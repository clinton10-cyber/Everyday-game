import { Limp } from "./characters/limp.js";
import { pickFall, poseFall, restY, playerFree } from "./core/death-pose.js";
import "./core/family.js";
import { Settings } from "./ui/settings.js";
Settings.applyAll();
window.__ph3d_settings = Settings;

import { Sfx } from "./core/sfx.js";
window.__ph3d_sfx = Sfx;

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { setEnv } from "./core/kit.js";

import { UI } from "./core/ui.js";
import { Router } from "./core/router.js";
import { Phone } from "./core/phone.js";
import { Multiplayer } from "./core/multiplayer.js";
import { Rides } from "./core/rides.js";
import { Crime } from "./core/crime.js";
import { Combat } from "./core/combat.js";
import { Inventory } from "./core/inventory.js";
import { Police } from "./core/police.js";
import { Quality } from "./core/quality.js";
import { DayNight } from "./core/daynight.js";
window.__ph3d_daynight = DayNight;   /* ambience engine reads the hour */
import { StreetLights } from "./core/street-lights.js";
window.__ph3d_streetLights = StreetLights;   /* DayNight.tick() drives it */
import { JobShifts } from "./core/job-shifts.js";
import { MansionPalette } from "./core/mansion-palette.js";
import { Auth } from "./core/auth.js";
import { Admin } from "./core/admin.js";
import { Identity } from "./core/identity.js";
import { Garage } from "./core/garage.js";
import { Profile } from "./core/profile.js";
import { Api } from "./core/api.js";
import { AuthUI } from "./ui/auth.js";
import { JobsPanel } from "./ui/jobs-panel.js";
import { HousesPanel } from "./ui/houses-panel.js";
import { Houses } from "./core/houses.js";
import { Pocket } from "./core/pocket.js";
import { Restaurants } from "./core/restaurants.js";
import { RestaurantUI } from "./core/restaurant-ui.js";
import { ATMs } from "./core/atms.js";
import { Gangs } from "./core/gangs.js";
import { Kidnap } from "./core/kidnap.js";
import { Prison } from "./core/prison.js";
import { Weapons } from "./core/weapons.js";
import { Economy } from "./core/economy.js";
import { Wardrobe } from "./core/wardrobe.js";
import { State } from "./core/state.js";
import { Surfaces } from "./core/surfaces.js";
import { Cats } from "./core/cats.js";
import { AudioSystem } from "./core/audio.js";
import { Hunt } from "./core/hunt.js";
import { HuntHUD } from "./ui/hunt-hud.js";
import { Engagement } from "./core/engagement.js";
import { RobberyUI } from "./ui/robbery-ui.js";
import "./core/scenes.js";

/* ── Core globals ── */
window.__ph3d_wardrobe       = Wardrobe;
window.__ph3d_state          = State;
window.__ph3d_combat         = Combat;
window.__ph3d_inv            = Inventory;
window.__ph3d_police         = Police;
window.__ph3d_weapons        = Weapons;
window.__ph3d_economy        = Economy;
window.__ph3d_auth           = Auth;
window.__ph3d_admin          = Admin;
window.__ph3d_identity       = Identity;
window.__ph3d_garage         = Garage;
window.__ph3d_profile        = Profile;
window.__ph3d_surfaces       = Surfaces;
window.__ph3d_rides          = Rides;
window.__ph3d_cats           = Cats;
window.__ph3d_crime          = Crime;
window.__ph3d_prison         = Prison;
window.__ph3d_pocket         = Pocket;
window.__ph3d_restaurants    = Restaurants;
window.__ph3d_restaurantui   = RestaurantUI;
window.__ph3d_atms           = ATMs;
window.__ph3d_gangs          = Gangs;
window.__ph3d_kidnap         = Kidnap;
window.__ph3d_mp             = Multiplayer;

/* ── Voice chat: off until the player turns "Voice chat" on in Settings.
   Then the mic is requested and one small push-to-talk button appears. ── */
{
  let _voiceUI = null;
  const applyVoice = async (on) => {
    try {
      const { Voice } = await import("./core/voice.js");
      if (on) {
        if (!Multiplayer.ready) Multiplayer.init((Auth.user && Auth.user.username) || "Player");
        const { VoiceUI } = await import("./core/voice-ui.js");
        if (!_voiceUI) _voiceUI = new VoiceUI();
        const r = await Voice.enable();
        if (!r.ok && window.__ph3d_phone)
          window.__ph3d_phone._toast(r.reason === "denied" ? "Mic blocked: allow microphone for this site" : "Mic not available on this device");
        _voiceUI && _voiceUI.refresh && _voiceUI.refresh();
      } else {
        Voice.disable();
        if (_voiceUI && _voiceUI._btn) _voiceUI._btn.style.display = "none";
      }
      if (on && _voiceUI && _voiceUI._btn) _voiceUI._btn.style.display = "flex";
    } catch (e) { console.warn("[voice]", e); }
  };
  window.addEventListener("ph3d:settings-changed", (e) => {
    if (e.detail && e.detail.key === "voiceEnabled") applyVoice(!!e.detail.value);
  });
  if (Settings.get("voiceEnabled")) setTimeout(() => applyVoice(true), 1500);
}
window.__ph3d_hunt           = Hunt;
/* life-sim: relationships, wedding, pregnancy, infant carry, 3D album, empty-home progression */
import("./core/lifesim.js").catch((e) => console.warn("[lifesim] failed to load:", e));

/* ── Player-action subsystem ───────────────────────────────────
   Loaded DEFENSIVELY so a broken file cannot prevent boot.
     player-actions → bend-to-pickup + use-with-animation
     world-objects-actions → wires pickup/use through PlayerActions
   ──────────────────────────────────────────────────────────── */
(async () => {
  const subs = [
    ["./core/player-actions.js",      "__ph3d_playerActions"],
    ["./core/world-objects-actions.js","__ph3d_worldObjectsActions"],
  ];
  for (const [path, key] of subs) {
    try {
      await import(path);
      console.log("%c[sub] loaded " + key,
        "background:#ffcc5e;color:#2a1400;font-weight:bold;padding:2px 6px;border-radius:4px");
    } catch (e) {
      console.warn("[sub] failed to load " + path + ":", e.message);
    }
  }
})();
/* ── Wire PlayerActions into WorldObjects once both load ─────── */
setTimeout(() => {
  try { window.__ph3d_worldObjectsActions?.init(); } catch (e) {}
}, 1500);

function safe(label, fn) {
  try { return fn(); }
  catch (e) { console.error("[boot] " + label + " failed, continuing:", e); return undefined; }
}

safe("Quality.detect", () => Quality.detect());
safe("Wardrobe.load", () => Wardrobe.load());
safe("MansionPalette.load", () => MansionPalette.load());
safe("Weapons.load", () => Weapons.load());
safe("Pocket.load", () => Pocket.load());
safe("Engagement.load", () => Engagement.load());
safe("RobberyUI.init", () => RobberyUI.init());
safe("Restaurants.load", () => Restaurants.load());
safe("Gangs.load", () => Gangs.load());
safe("Profile.init", () => Profile.init());

const __Q = Quality.current;

safe("showBadge", function showBadge(){
  const b = document.createElement("div");
  b.textContent = "QUALITY · " + Quality.tier.toUpperCase() + " · " + Quality.score;
  Object.assign(b.style, {
    position:"fixed", left:"50%", top:"calc(env(safe-area-inset-top) + 12px)",
    transform:"translateX(-50%)", zIndex:"9998",
    padding:"8px 16px", borderRadius:"20px",
    background:"rgba(8,16,28,.88)", border:"1px solid rgba(94,224,255,.5)",
    color:"#eaf6ff", font:"800 11px Inter,system-ui,sans-serif",
    letterSpacing:".14em", pointerEvents:"none", backdropFilter:"blur(10px)", transition:"opacity .6s",
    userSelect:"none", webkitUserSelect:"none"
  });
  document.body.appendChild(b);
  setTimeout(() => { b.style.opacity = "0"; }, 3800);
  setTimeout(() => b.remove(), 4500);
});

/* preserveDrawingBuffer is off: it forces an extra buffer copy every frame, which is costly on
   mobile GPUs. Photo capture re-renders right before reading the canvas instead (see photos.js). */
const renderer = new THREE.WebGLRenderer({ antialias: __Q.antialias, powerPreference: "high-performance", preserveDrawingBuffer: false, stencil: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, __Q.pixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = __Q.shadows;
renderer.shadowMap.type = __Q.shadowType === "PCFSoft" ? THREE.PCFSoftShadowMap : __Q.shadowType === "PCF" ? THREE.PCFShadowMap : THREE.BasicShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById("app").appendChild(renderer.domElement);

if (__Q.envMap) {
  safe("environment map", () => {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    setEnv(envTex);
  });
}

const ui = new UI();
const router = new Router(renderer, ui);
window.__ph3d_router = router;

router.register("city",       (params, r) => import("./scenes/city.js").then(m => m.cityScene(params, r)).catch(e => console.error("[route] scene failed:", e)));
router.register("travel",     (params, r) => import("./scenes/travel.js").then(m => m.travelScene(params, r)).catch(e => console.error("[route] scene failed:", e)));
router.register("interior",   (params, r) => import("./scenes/interior.js").then(m => m.interiorScene(params, r)).catch(e => console.error("[route] scene failed:", e)));
router.register("exterior",   (params, r) => import("./places/exterior.js").then(m => m.buildExterior(r, params)).catch(e => console.error("[route] scene failed:", e)));
router.register("minimap",    (params, r) => import("./scenes/minimap.js").then(m => m.minimapScene(params, r)).catch(e => console.error("[route] scene failed:", e)));
router.register("showroom",   (params, r) => import("./scenes/showroom.js").then(m => m.showroomScene(params, r)).catch(e => console.error("[route] scene failed:", e)));
router.register("drive",      (params, r) => import("./scenes/drive.js").then(m => m.driveScene(params, r)).catch(e => console.error("[route] scene failed:", e)));

router.register("walk", (params, r) => import("./scenes/drive.js")
  .then(m => m.driveScene(Object.assign({}, params, { startMode: "walk" }), r))
  .catch(e => console.error("[route] scene failed:", e)));

router.register("pleasurepark", (params, r) => import("./places/pleasurepark/world.js").then(m => m.buildPleasurePark(r)).catch(e => {
  console.error("[route] pleasurepark failed:", e);
  try { window.__ph3d_show && window.__ph3d_show("[pleasurepark] " + (e && (e.stack || e.message) || e)); } catch (x) {}
  return null;
}));

router.register("zonewalk",  (params, r) => import("./scenes/zonewalk.js").then(m => m.zonewalkScene(params, r)).catch(e => console.error("[route] scene failed:", e)));
router.register("zonedrive", (params, r) => import("./scenes/zonewalk.js").then(m => m.zonewalkScene(params, r)).catch(e => console.error("[route] scene failed:", e)));
router.register("governorScene", (params, r) => import("./scenes/governor.js").then(m => m.governorScene(params, r)).catch(e => console.error("[route] scene failed:", e)));
router.register("governorInterior", (params, r) => import("./scenes/governor-interior.js").then(m => m.governorInteriorScene(params, r)).catch(e => {
  console.error("[route] governorInterior failed:", e);
  try { window.__ph3d_show && window.__ph3d_show("[governorInterior] " + (e && (e.stack || e.message) || e)); } catch (x) {}
  return null;
}));
router.register("range", (params, r) => import("./scenes/shootingrange.js").then(m => m.shootingRangeScene(params, r)).catch(e => console.error("[route] scene failed:", e)));
router.register("prisonScene", (params, r) => import("./scenes/prison.js").then(m => m.prisonScene(params, r)).catch(e => console.error("[route] scene failed:", e)));
router.register("airplane", (params, r) => import("./scenes/airplane.js").then(m => m.airplaneScene(params, r)).catch(e => console.error("[route] scene failed:", e)));

function hideDriveUI() {
  try {
    const d = document.getElementById("drive-ui");
    if (d) d.style.display = "none";
    const w = document.getElementById("walk-ui");
    if (w) w.style.display = "none";
  } catch (e) {}
}
["city", "travel", "interior", "minimap", "showroom",
 "governorScene", "governorInterior", "range", "prisonScene",
 "zonewalk", "zonedrive", "airplane"
].forEach(function(name) {
  const prev = router.factories[name];
  if (!prev) return;
  router.factories[name] = function(params, r) {
    hideDriveUI();
    return prev(params, r);
  };
});

/* ── Music follows the scene ──────────────────────────────────
   The city, drive, and walk scenes keep music playing.
   Every interior pauses the music. Scene objects can opt back in
   by setting `allowMusic: true` on the returned object. */
const __origGo = router.go.bind(router);
router.go = async function (name, params, push) {
  /* Hunt: leaving the open world forfeits the contract */
  try {
    if (Hunt.active && name !== "drive" && name !== "walk") {
      Hunt._end("left_scene");
      window.__ph3d_phone?._toast("❌ You left the arena. Prize forfeited.");
    }
  } catch (e) {}
  const scene = await __origGo(name, params, push);
  if (scene) { try { Engagement.track("scene_visited", { name }); } catch (e) {} }
  try {
    if (window.__ph3d_audio) {
      window.__ph3d_audio.setScene(name, scene);
    }
  } catch (e) {}
  return scene;
};

safe("boot → first scene", () => {
  const enterGame = () => {
    if (Auth.user && Auth.user.vehicle) {
      State.vehicle.model = Auth.user.vehicle.model || State.vehicle.model;
      State.vehicle.body  = Auth.user.vehicle.body  || State.vehicle.body;
      State.vehicle.rim   = Auth.user.vehicle.rim   || State.vehicle.rim;
    }

    const hasOnboarded = (() => {
      try {
        const uid = (Auth.user && Auth.user.id) || "guest";
        const raw = localStorage.getItem("ph3d.onboarding.v1." + uid);
        if (!raw) return false;
        const s = JSON.parse(raw);
        return s && (s.tour === "complete" || s.tour === "skipped");
      } catch (e) { return false; }
    })();

    const teleportHome = (forceStarter) => {
      /* First-login onboarding always starts at the starter flat. */
      Houses.goHome(router, !!forceStarter);
    };

    if (hasOnboarded) {
      router.go("city");
    } else {
      try {
        if (Auth.user && !Houses.isAdminHome()) {
          Auth.user.home = "starter_flat";
          if (!Array.isArray(Auth.user.houses) || Auth.user.houses.indexOf("starter_flat") < 0) {
            Auth.user.houses = ["starter_flat"];
          }
          const p = Auth.save({ home: "starter_flat", houses: Auth.user.houses });
          if (p && p.catch) p.catch(() => {});
        }
      } catch (e) {}
      teleportHome(true);
      import("./ui/onboarding.js").then((m) => {
        m.Onboarding.startIfNeeded({
          user: Auth.user,
          router,
          teleportHome,
        });
      }).catch(() => {});
    }
  };

  window.addEventListener("ph3d:auth-ok", enterGame, { once: true });

  if (Auth.tryRestore()) {
    enterGame();
  } else {
    AuthUI.show();
  }
});

const phone = safe("new Phone()", () => new Phone());
window.__ph3d_phone = phone;

safe("drive-ui wiring", function(){
  const ui = document.getElementById("drive-ui");
  if (!ui) return;
  const setI = (k, v) => {
    const d = window.__ph3d_drive;
    if (d && d.setInput) d.setInput(k, v);
  };
  const bindHold = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    const on  = e => { e.cancelable && e.preventDefault(); el.classList.add("on"); setI(key, 1); };
    const off = e => { e.cancelable && e.preventDefault(); el.classList.remove("on"); setI(key, 0); };
    el.addEventListener("pointerdown", on, { passive:false });
    el.addEventListener("pointerup", off, { passive:false });
    el.addEventListener("pointercancel", off, { passive:false });
    el.addEventListener("pointerleave", off, { passive:false });
    el.addEventListener("contextmenu", e => e.cancelable && e.preventDefault());
  };
  bindHold("dr-gas",    "throttle");
  bindHold("dr-brake",  "brake");
  bindHold("dr-left",   "steerL");
  bindHold("dr-right",  "steerR");

  const en = document.getElementById("drive-enter");
  en && en.addEventListener("pointerdown", e => {
    e.preventDefault();
    const d = window.__ph3d_drive;
    d && d.enter && d.enter();
  }, { passive:false });

  const ex = document.getElementById("drive-exit");
  ex && ex.addEventListener("pointerdown", e => {
    e.preventDefault();
    const r = window.__ph3d_router;
    r && r.go && r.go("city");
  }, { passive:false });
});

// ── INITIALIZE AUDIO ──
AudioSystem.init();
window.__ph3d_audio = AudioSystem;

// ── HUNT ──
/* hunt timer now lives inside the phone Hunt app */
window.addEventListener("ph3d:player-dead", () => {
  try { if (Hunt.active) Hunt.onPlayerDeath(); } catch (e) {}
});
setTimeout(() => {
  try {
    if (Hunt.active) return;
    const res = Hunt.tryResume();
    if (res.ok && !(window.__ph3d_drive && window.__ph3d_drive.getMode)) {
      window.__ph3d_router?.go("walk");
    }
  } catch (e) {}
}, 1500);

/* Browsers require a user gesture before any audio can play.
   The first tap on the title screen starts the music. Once started,
   the router's scene hook decides whether it keeps playing. */
window.addEventListener("pointerdown", () => {
  AudioSystem.startAmbient();
  AudioSystem.setScene(
    (window.__ph3d_router && window.__ph3d_router.current && window.__ph3d_router.current.sceneId) || "city",
    window.__ph3d_router && window.__ph3d_router.current
  );
}, { once: true });


/* ── Player death fall animation (started by Combat.damage) ── */
(function playerDeathLoop() {
  const d = window.__ph3d_playerDeath;
  if (d && d.tp && d.tp.avatar && d.tp.rig) {
    const now = performance.now();
    const dt = Math.min(0.05, d.last ? (now - d.last) / 1000 : 0.016);
    d.last = now; d.phase += dt;
    const p = Math.min(1, d.phase / 0.8);
    const e = 1 - Math.pow(1 - p, 3);
    const av = d.tp.avatar, rig = d.tp.rig;
    const ef = Math.min(1, p / 0.8) ** 2;                     /* gravity: accelerating fall */
    const bounce = p > 0.8 ? Math.sin((p - 0.8) / 0.2 * Math.PI) * 0.06 : 0;
    if (!d.fall) {                                              /* once: pick open space + remember floor height */
      d.fall = pickFall(d.tp.pos.x, d.tp.pos.z, d.tp.yaw || 0, playerFree(d.tp));
      d.yaw = d.tp.yaw || 0; d.floorY = d.tp.floorY || 0;
      d.tp.pos.x = d.fall.x; d.tp.pos.z = d.fall.z;
      av.position.x = d.fall.x; av.position.z = d.fall.z;
    }
    poseFall(av, d.fall, d.yaw, ef, d.dir * 0.3);
    av.position.y = restY(d.floorY, ef) + 0.10 * Math.sin(Math.PI * Math.min(1, p * 1.2)) * (1 - ef) + bounce;
    Limp.step(rig, av, dt);                                    /* joints are dead weight, not posed */
  }
  requestAnimationFrame(playerDeathLoop);
})();

// ── HOSPITAL RESPAWN ──
window.addEventListener("ph3d:player-dead", async () => {
  if (window.__ph3d_is_dying) return;
  window.__ph3d_is_dying = true;

  try {
    const ui = router.ui;
    await ui.fadeIn();
    await new Promise(r => setTimeout(r, 600));

    if (typeof Combat !== 'undefined' && Combat.reset) {
      Combat.reset();
      Combat.hp = Combat.maxHp * 0.5;
    }

    try { const d = window.__ph3d_playerDeath; if (d && d.tp && d.tp.avatar) { d.tp.avatar.rotation.x = 0; d.tp.avatar.rotation.z = 0; } } catch (e) {}
    try { const d = window.__ph3d_playerDeath; if (d && d.tp && d.tp.rig) Limp.release(d.tp.rig); } catch (e) {}
    window.__ph3d_playerDeath = null;
    router.go("interior", { id: "hospital" });

    setTimeout(() => {
      ui.fadeOut();
      window.__ph3d_is_dying = false;
      if (window.__ph3d_phone) window.__ph3d_phone._toast("🏥 You wake up in the hospital...");
    }, 1200);

  } catch (e) {
    window.__ph3d_is_dying = false;
    router.ui.fadeOut();
  }
});


/* ── Warm up scene modules in the background ──────────────────
   Offline there is no network cost, but each scene's JS still has to be
   parsed and evaluated the first time it is visited. Doing that while the
   player is busy in the city makes later scene changes much quicker. */
(function warmScenes(){
  const mods = [
    "./scenes/interior.js", "./scenes/drive.js", "./scenes/travel.js",
    "./scenes/minimap.js", "./scenes/showroom.js", "./scenes/zonewalk.js",
    "./scenes/governor.js", "./scenes/governor-interior.js",
    "./scenes/shootingrange.js", "./scenes/prison.js", "./scenes/airplane.js",
    "./places/exterior.js", "./places/pleasurepark/world.js"
  ];
  let i = 0;
  function next(){
    if (i >= mods.length) return;
    if (router.locked) { setTimeout(next, 1500); return; }   // never compete with a scene load
    const m = mods[i++];
    import(m).catch(function(){}).then(function(){ setTimeout(idle, 600); });
  }
  function idle(){
    if (window.requestIdleCallback) requestIdleCallback(next, { timeout: 3000 });
    else setTimeout(next, 300);
  }
  function start(){ setTimeout(idle, 4000); }
  if (document.readyState === "complete") start(); else window.addEventListener("load", start);
})();

/* Browser / installed-PWA only: go fullscreen on the first tap so the address bar and
   notification area get out of the way. (The Android app does this natively.) */
try {
  const isApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (!isApp) {
    const goFS = () => {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    };
    window.addEventListener("pointerup", goFS, { once: true, passive: true });
  }
} catch (e) {}
