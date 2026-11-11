import { createJetpack } from "./jetpack.js";
import * as THREE from "three";
import { Wardrobe } from "./wardrobe.js";
import { WardrobeUI } from "./wardrobeui.js";
import {
  buildCharacter, attachPhone, applyPhonePose,
  HIP_HEIGHT, setGrip,
} from "../characters/lowpoly.js";
import * as Animator from "../characters/animator.js";
import { AnimationAutomation } from "./animation-automation.js";
import { Weapons } from "./guns.js";
import { NPCs } from "./npcs.js";
import { HUD } from "../ui/hud.js";
import { Sanity } from "./sanity.js";
import { InteriorPoses } from "./interior-poses.js";

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

function NPCs_has(o) { try { const L = window.__ph3d_npcsList; if (!L) return false; for (const n of L()) { if (n.group && n.group.getObjectById(o.id)) return true; } } catch (e) {} return false; }
const GRAVITY = 18, JUMP_V = 6;
const DRIVE_WALK = 3.2, DRIVE_RUN_MULT = 1.6, DRIVE_GRAVITY = 20, DRIVE_JUMP_V = 6.5;
const WALK = 4.6, RUN = 8.4, CROUCH_SP = 2.2;
const RADIUS = 0.32, STEP = 0.46;
const CAM_DIST = 3.6, CAM_MIN_DIST = 1.7;   /* never closer than this: no more seeing inside the head */
const PICK_RANGE = 2.4, LOOK_PITCH_MAX = 0.92;
const SEAT_ARRIVE_DIST = 0.55;
const SEAT_LERP_SPEED = 6.0;
const SEAT_SNAP_SPEED = 9.0;
const HEAD_CLEARANCE = 1.72;

const USE_BEND = {
  wash: 0.35, cook: 0.25, fridge: 0.20, mirror: 0.10,
  shower: 0.15, run: 0.10, lift: 0.20, read: 0.10, play: 0.20,
  control: 0.15, bell: 0.10, buy: 0.15, use: 0.20,
};

/* Durations and labels come straight from the animator's EMOTES
   registry, so adding a new emote (including every backflip) is a
   one-line change over in animator.js — nothing here needs touching. */
const EMOTE_DURATION = {};
const EMOTE_LABEL = {};
for (const k in Animator.EMOTES) {
  const v = Animator.EMOTES[k];
  EMOTE_DURATION[k] = v.dur;
  EMOTE_LABEL[k] = v.label;
}    

export const SELFIE_POSES = Animator.SELFIE_POSES;
export const SELFIE_POSE_ORDER = Animator.SELFIE_POSE_ORDER;

function rayAABB(ox,oy,oz,dx,dy,dz,minX,minY,minZ,maxX,maxY,maxZ,maxT){
  let tmin = 0, tmax = maxT;
  if (Math.abs(dx) < 1e-8) { if (ox < minX || ox > maxX) return -1; }
  else { const inv = 1/dx; let t1 = (minX-ox)*inv, t2 = (maxX-ox)*inv; if (t1>t2){const tmp=t1;t1=t2;t2=tmp;} if (t1>tmin) tmin=t1; if (t2<tmax) tmax=t2; if (tmin>tmax) return -1; }
  if (Math.abs(dy) < 1e-8) { if (oy < minY || oy > maxY) return -1; }
  else { const inv = 1/dy; let t1 = (minY-oy)*inv, t2 = (maxY-oy)*inv; if (t1>t2){const tmp=t1;t1=t2;t2=tmp;} if (t1>tmin) tmin=t1; if (t2<tmax) tmax=t2; if (tmin>tmax) return -1; }
  if (Math.abs(dz) < 1e-8) { if (oz < minZ || oz > maxZ) return -1; }
  else { const inv = 1/dz; let t1 = (minZ-oz)*inv, t2 = (maxZ-oz)*inv; if (t1>t2){const tmp=t1;t1=t2;t2=tmp;} if (t1>tmin) tmin=t1; if (t2<tmax) tmax=t2; if (tmin>tmax) return -1; }
  if (tmin <= 0.001) return -1;
  return tmin;
}

export class ThirdPersonControls {
  constructor(camera, dom, world, opt = {}) {
    this.camera = camera; this.dom = dom; this.world = world; this.opts = opt;
    window.__ph3d_walkCtrl = this;
    this.scene = opt.scene || null;
    this.camDist = opt.camDist != null ? opt.camDist : CAM_DIST;

    this.pos = new THREE.Vector3(opt.x || 0, 0, opt.z || 0);
    this.vel = new THREE.Vector3();
    this.level = opt.level || 0;
    this.floorY = 0;
    this.onGround = true;
    this.yaw = opt.yaw || 0;
    this.camYaw = (opt.yaw || 0) + Math.PI;
    this.camPitch = 0.28;
    this.aimPitch = 0;
    this.state = "standing";
    this.sitTarget = null; this.nearSit = null;
    this._seatArrived = false;

    this.liePose = 'back';
    this.lieRoll = 0;
    this.lieSlot = 0;
    this.lieBlend = 0;
    this.held = null; this.carryables = opt.carryables || [];
    this.interactables = opt.interactables || [];
    this.phase = 0;
    this._lyingCooldown = 0;
    this.phoneHold = false;
    this.moving = false; this.running = false;
    this.runHold = false;
    this.driveFeel = opt.driveFeel !== false;
    this._lastNow = 0;
    this._enterCarCb = opt.onEnterCar || null;
    this._nearCar = null;

    this._hipsY = HIP_HEIGHT;
    this._useTimer = 0;
    this._useBend = 0.30;
    this._emoteTimer = 0;
    this._emoteName = null;
    this._emotePhase = 0;
    this._selfiePreviewPose = null;
    this._selfieHold = false;
    this._camFollowEnabled = true;

    const cfg = (opt.look) || (Wardrobe && Wardrobe.config) || null;
    const built = buildCharacter(cfg);
    this.avatar = built.root;
    this.rig = built.rig;
    window.__ph3d_tp = this;
    try { attachPhone(this.rig); } catch (e) {}
    this.avatar.position.set(this.pos.x, 0, this.pos.z);
    if (this.scene) this.scene.add(this.avatar);

    this.weapons = new Weapons(this);
    this.jet = { on: false, thrust: false, fuel: 1, tilt: 0 };
    this._jetVis = createJetpack();
    try { this._jetVis.attach(this.avatar); } catch (e) {}
    this._rc = new THREE.Raycaster(); this._rcFrame = 0; this._jetCeilY = Infinity; this._jetFloorY = -Infinity;

    this._wardrobeUI = null;
    try {
      this._wardrobeUI = new WardrobeUI((cfg2, key) => {
        try {
          if (key && this.rig && this.rig.mats) { Wardrobe.updateMaterials(this.rig.mats, Wardrobe.effective(cfg2)); return; }
          /* Rebuild the character mesh from the new wardrobe config
             and swap it in immediately -- this is what makes clothing
             changes take effect instantly instead of only on close.
             (Previously referenced an undefined `built2` and threw,
             silently, on every swatch click, so nothing ever updated.) */
          const built2 = buildCharacter(cfg2);
          if (this.avatar && this.avatar.parent) this.avatar.parent.remove(this.avatar);
          this.avatar = built2.root;
          this.rig = built2.rig;
          /* Clear the animator's rig cache so it re-collects joints
             from the new rig on the next frame; otherwise it writes
             pose deltas onto the OLD rig's joints for one tick and
             the new rig snaps into place. */
          if (this._anim) this._anim.rig = null;
          try { attachPhone(this.rig); } catch (e) {}
          try { this._jetVis.attach(this.avatar); } catch (e) {}
          try { this.weapons.dispose(); this.weapons = new Weapons(this); } catch (e) {}
          this.avatar.position.set(this.pos.x, this.floorY, this.pos.z);
          this.avatar.rotation.y = this.yaw;
          if (this.scene) this.scene.add(this.avatar);
        } catch (e) {}
      });
    } catch (e) { this._wardrobeUI = null; }

    this.keys = Object.create(null);
    this.joy = { on: false, id: null, dx: 0, dy: 0, ox: 0, oy: 0 };
    this.look = { on: false, id: null, x: 0, y: 0 };
    this._bind();
    this._btn();
    this._lbl();
    this._joyRing();
    this._updateCamera(0, true);
  }

  _joyRing() {
    const old = document.getElementById("ph3d-joy-ring"); old && old.remove();
    const ring = document.createElement("div"); ring.id = "ph3d-joy-ring";
    Object.assign(ring.style, { position:"fixed", left:"0", bottom:"0", zIndex:"25", width:"120px", height:"120px", pointerEvents:"none", display:"none" });
    ring.innerHTML = `
      <div id="ph3d-joy-base" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,.10);border:2px solid rgba(94,224,255,.40);backdrop-filter:blur(4px);pointer-events:none;"></div>
      <div id="ph3d-joy-knob" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:42px;height:42px;border-radius:50%;background:rgba(94,224,255,.55);border:2px solid rgba(255,255,255,.7);pointer-events:none;transition:background .1s;"></div>`;
    document.body.appendChild(ring);
    this._joyRingEl = ring;
    this._joyKnob = ring.querySelector("#ph3d-joy-knob");
  }
  _updateJoyRing() {
    if (!this._joyRingEl) return;
    if (!this.joy.on) { this._joyRingEl.style.display = "none"; return; }
    const R = 46, kx = this.joy.dx * R, ky = this.joy.dy * R;
    this._joyRingEl.style.display = "block";
    this._joyRingEl.style.left = (this.joy.ox - 60) + "px";
    this._joyRingEl.style.top  = (this.joy.oy - 60) + "px";
    if (this._joyKnob) {
      this._joyKnob.style.left = (50 + (kx / 120) * 100) + "%";
      this._joyKnob.style.top  = (50 + (ky / 120) * 100) + "%";
    }
  }

  _btn() {
    const old = document.getElementById("ph3d-act-btn"); old && old.remove();
    const b = document.createElement("div"); b.id = "ph3d-act-btn";
    Object.assign(b.style, {
      position: "fixed", right: "18px", bottom: "calc(env(safe-area-inset-bottom) + 32px)",
      zIndex: "30", padding: "14px 26px", borderRadius: "999px", background: "rgba(8,16,28,.85)",
      border: "1px solid rgba(94,224,255,.5)", color: "#eaf6ff", fontSize: "12px", fontWeight: "800",
      letterSpacing: ".14em", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
      cursor: "pointer", userSelect: "none", WebkitUserSelect: "none", opacity: "0",
      transform: "translateY(10px)", transition: "opacity .25s, transform .25s",
      pointerEvents: "none", fontFamily: "inherit", boxShadow: "0 10px 28px rgba(0,0,0,.5)",
    });
    document.body.appendChild(b); this._b = b;
    const stop = e => { e.stopPropagation(); e.cancelable && e.preventDefault(); };
    b.addEventListener("pointerdown", e => { stop(e); window.__ph3d_lastHudTouch = performance.now(); this.triggerAction(); });
    ["pointerup", "pointermove", "click"].forEach(k => b.addEventListener(k, stop));

    /* ── USE / DROP for the item in hand ── */
    const mkItemBtn = (id, label, fn) => {
      const old = document.getElementById(id); old && old.remove();
      const bt = document.createElement("button"); bt.id = id; bt.textContent = label;
      bt.style.cssText = "display:none;cursor:pointer;pointer-events:auto;touch-action:manipulation;";
      document.body.appendChild(bt);
      bt.addEventListener("pointerdown", e => {
        e.preventDefault(); e.stopPropagation();
        bt._tapAt = performance.now(); window.__ph3d_lastHudTouch = bt._tapAt;
        try { fn(); } catch (err) { console.warn(err); }
      }, { passive: false });
      ["pointerup", "pointermove", "click", "touchend"].forEach(k => bt.addEventListener(k, e => {
        if (performance.now() - (bt._tapAt || 0) < 400) { e.preventDefault(); e.stopPropagation(); }
      }, { capture: true }));
      return bt;
    };
    this._useItemBtn = mkItemBtn("ph3d-use-item", "USE", () => {
      const PA = window.__ph3d_playerActions; const it = PA && PA.heldItem && PA.heldItem();
      if (it) PA.use(this, it);
    });
    this._dropItemBtn = mkItemBtn("ph3d-drop-item", "DROP", () => {
      const PA = window.__ph3d_playerActions; if (PA) PA.drop(this);
    });

    const oldMenu = document.getElementById("ph3d-menu-btn"); oldMenu && oldMenu.remove();
    const menuBtn = document.createElement("button"); menuBtn.id = "ph3d-menu-btn";
    Object.assign(menuBtn.style, {
      position: "fixed", left: "14px", top: "calc(env(safe-area-inset-top) + 144px)",
      zIndex: "30", width: "44px", height: "44px", borderRadius: "50%",
      background: "rgba(8,16,28,.85)", border: "1px solid rgba(94,224,255,.5)",
      color: "#eaf6ff", fontSize: "20px", fontWeight: "900", cursor: "pointer",
      pointerEvents: "auto", fontFamily: "inherit", boxShadow: "0 8px 24px rgba(0,0,0,.5)",
      backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
      touchAction: "manipulation", display: "flex", alignItems: "center", justifyContent: "center",
    });
    menuBtn.textContent = "\u22EF";
    document.body.appendChild(menuBtn);
    this._menuBtn = menuBtn;
    menuBtn.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); this._openQuickMenu(); }, { passive: false });
    ["pointerup", "pointermove", "click"].forEach(k => menuBtn.addEventListener(k, stop));

    this._buildQuickMenu();

    const oldJump = document.getElementById("ph3d-jump-btn"); oldJump && oldJump.remove();
    const jumpBtn = document.createElement("button"); jumpBtn.id = "ph3d-jump-btn";
    /* HUD handles all colour/position */
    jumpBtn.style.cssText = "cursor:pointer;pointer-events:auto;touch-action:manipulation;user-select:none;-webkit-user-select:none;";
    const oldRun = document.getElementById("ph3d-run-btn"); oldRun && oldRun.remove();
    const runBtn2 = document.createElement("button"); runBtn2.id = "ph3d-run-btn"; runBtn2.textContent = "RUN";
    /* HUD handles all colour/position */
    runBtn2.style.cssText = "cursor:pointer;pointer-events:auto;touch-action:manipulation;user-select:none;-webkit-user-select:none;";
    document.body.appendChild(runBtn2); this._runBtn = runBtn2;
    runBtn2.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); this.runHold = !this.runHold; runBtn2.classList.toggle("is-on", this.runHold); this._syncQuickMenuRun(); }, { passive: false });
    ["pointerup", "pointermove", "click"].forEach(k => runBtn2.addEventListener(k, stop));
    jumpBtn.textContent = "JUMP";
    document.body.appendChild(jumpBtn);
    this._jumpBtn = jumpBtn;
    jumpBtn.addEventListener("pointerdown", e => {
      e.preventDefault(); e.stopPropagation();
      if (this.jet.on) { this.jet.thrust = true; jumpBtn.classList.add("h-flash"); return; }
      this.jump();
      jumpBtn.classList.add("h-flash");
      setTimeout(() => jumpBtn.classList.remove("h-flash"), 200);
    }, { passive: false });
    ["pointerup", "pointermove", "click"].forEach(k => jumpBtn.addEventListener(k, stop));
    ["pointerup", "pointercancel", "pointerleave"].forEach(k => jumpBtn.addEventListener(k, () => { this.jet.thrust = false; if (this.jet.on) jumpBtn.classList.remove("h-flash"); }));

    /* ── JETPACK toggle (hold JUMP / Space to thrust) ── */
    const oldFly = document.getElementById("ph3d-walk-fly"); oldFly && oldFly.remove();
    const flyBtn = document.createElement("button"); flyBtn.id = "ph3d-walk-fly"; flyBtn.textContent = "JETPACK";
    flyBtn.style.cssText = "cursor:pointer;pointer-events:auto;touch-action:manipulation;user-select:none;-webkit-user-select:none;";
    document.body.appendChild(flyBtn); this._flyBtn = flyBtn;
    flyBtn.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); this.toggleJet(); }, { passive: false });
    ["pointerup", "pointermove", "click"].forEach(k => flyBtn.addEventListener(k, stop));

    /* ── CROUCH touch button ─────────────────────────────── */
    const oldCrouch = document.getElementById("ph3d-crouch-btn"); oldCrouch && oldCrouch.remove();
    const crouchBtn = document.createElement("button"); crouchBtn.id = "ph3d-crouch-btn"; crouchBtn.textContent = "CROUCH";
    /* HUD handles all colour + position via hud.js SPEC + hud.css overrides. */
    crouchBtn.style.cssText = "cursor:pointer;touch-action:manipulation;pointer-events:auto;user-select:none;-webkit-user-select:none;";
    document.body.appendChild(crouchBtn); this._crouchBtn = crouchBtn;
    crouchBtn.addEventListener("pointerdown", e => {
      e.preventDefault(); e.stopPropagation();
      this.crouch();
      const on = this.state === "crouching";
      crouchBtn.classList.toggle("is-on", on);
    }, { passive: false });
    ["pointerup", "pointermove", "click"].forEach(k => crouchBtn.addEventListener(k, stop));

    /* ── LIE DOWN touch button ───────────────────────────── */
    const oldLie = document.getElementById("ph3d-lie-btn"); oldLie && oldLie.remove();
    const lieBtn = document.createElement("button"); lieBtn.id = "ph3d-lie-btn"; lieBtn.textContent = "LIE";
    /* HUD handles all colour + position via hud.js SPEC + hud.css overrides. */
    lieBtn.style.cssText = "cursor:pointer;touch-action:manipulation;pointer-events:auto;user-select:none;-webkit-user-select:none;";
    document.body.appendChild(lieBtn); this._lieBtn = lieBtn;
    lieBtn.addEventListener("pointerdown", e => {
      e.preventDefault(); e.stopPropagation();
      if (this.state === "lying") {
        this.stand();
        lieBtn.classList.remove("is-on");
      } else {
        this._lie();
        lieBtn.classList.add("is-on");
      }
    }, { passive: false });
    ["pointerup", "pointermove", "click"].forEach(k => lieBtn.addEventListener(k, stop));
  }

  /* The quick menu now uses the shared HUD sheet (same one the city uses). */
  _buildQuickMenu() { this._qmWrap = null; }
  _highlightWeapons() {}
  _syncQuickMenuRun() {
    if (this._runBtn) this._runBtn.classList.toggle("is-on", !!this.runHold);
  }
  _closeQuickMenu() { try { HUD.closeSheet(); } catch (e) {} }
  _openQuickMenu() {
    const self = this;
    this._syncQuickMenuRun();
    const cur = (this.weapons && this.weapons.current) || "fists";

    const weapon = (id, label) => ({
      label, active: cur === id, keep: true,
      onClick: () => {
        if (self.weapons.current === id && id !== "fists") self.weapons.attack(self._getWeaponTargets());
        else self.weapons.select(id);
        self._ul();
      },
    });

    const emote = (id, label) => ({
      label, onClick: () => self.playEmote(id),
    });

    HUD.sheet({
      title: "Menu",
      sections: [
        { cols: 2, items: [
          { icon: "sit", label: "Sit down", sub: "Right here", onClick: () => self._sitHere() },
          { icon: "shirt", label: "Wardrobe", sub: "Change your look", tone: "danfo",
            onClick: () => {
              if (self._wardrobeUI && self._wardrobeUI.open) self._wardrobeUI.open();
              else import("./thirdperson.js").then(m => m.openWardrobeFor(self));
            } },
          { icon: "run", label: "Run", sub: this.runHold ? "On" : "Off", active: !!this.runHold, keep: true,
            onClick: (ev, tile) => {
              self.runHold = !self.runHold;
              self._syncQuickMenuRun();
              tile.classList.toggle("is-on", !!self.runHold);
              const sub = tile.querySelector(".h-tile-s");
              if (sub) sub.textContent = self.runHold ? "On" : "Off";
            } },
          { icon: "arrow-bar-down", label: "Crouch", sub: this.state === "crouching" ? "On" : "Off", active: this.state === "crouching", keep: true,
            onClick: (ev, tile) => {
              self.crouch();
              const on = self.state === "crouching";
              tile.classList.toggle("is-on", on);
              const sub = tile.querySelector(".h-tile-s");
              if (sub) sub.textContent = on ? "On" : "Off";
              if (self._crouchBtn) {
                self._crouchBtn.classList.toggle("is-on", on);
              }
            } },
          { icon: "layout-rows", label: "Lie down", sub: this.state === "lying" ? "On" : "Off", active: this.state === "lying", keep: true,
            onClick: (ev, tile) => {
              if (self.state === "lying") {
                self.stand();
                tile.classList.remove("is-on");
                const sub = tile.querySelector(".h-tile-s"); if (sub) sub.textContent = "Off";
                if (self._lieBtn) { self._lieBtn.classList.remove("is-on"); }
              } else {
                self._lie();
                tile.classList.add("is-on");
                const sub = tile.querySelector(".h-tile-s"); if (sub) sub.textContent = "On";
                if (self._lieBtn) { self._lieBtn.classList.add("is-on"); }
              }
            } },
        ] },
        { label: "Weapons", cols: 3, radio: true, items: [
          weapon("fists", "Fists"), weapon("knife", "Knife"),
          weapon("pistol", "Pistol"), weapon("sniper", "Sniper"), weapon("bazooka", "Bazooka"),
          { label: "Holster", keep: true, onClick: () => { self.weapons.holsterAll(); self._ul(); } },
        ] },
        { label: "Emotes", cols: 5, items: [
          emote("wave", "Wave"), emote("clap", "Clap"), emote("flex", "Flex"),
          emote("meditate", "Zen"), emote("dance", "Dance"),
        ] },
        { label: "Everyday life", cols: 5, items: [
          emote("pray", "Pray"), emote("eat", "Eat"),
          { label: "Hug", onClick: () => self._pairAction("hug") },
          { label: "Shake hands", onClick: () => self._pairAction("handshake") },
          { label: "Lean on table", onClick: () => self._leanTable() },
        ] },
        ...(((window.__ph3d_family && window.__ph3d_family.menuItems()) || []).length
          ? [{ label: "Family", cols: 4, items: window.__ph3d_family.menuItems() }] : []),
        { label: "Fight moves", cols: 4, items: Object.entries(Animator.WRESTLING_MOVES || {}).filter(([id, m]) => !m.hidden).map(([id, m]) => emote(id, m.label)) },
        { label: "Back flips", cols: 4, items: [
          emote("backflip", "Backflip"),
          emote("doubleBackflip", "Double"),
          emote("tripleBackflip", "Triple"),
          emote("layoutFlip", "Layout"),
          emote("pikeFlip", "Pike"),
          emote("gainer", "Gainer"),
          emote("arabian", "Arabian"),
          emote("halfTwist", "Half Twist"),
          emote("fullTwist", "Full Twist"),
          emote("corkscrew", "Corkscrew"),
          emote("doubleFullTwist", "Double Full"),
          emote("backFullDouble", "Back Full"),
          emote("splitLegFlip", "Split-Leg"),
          emote("xOut", "X-Out"),
          emote("straddle", "Straddle"),
          emote("kickTheMoon", "Kick Moon"),
          emote("oneArmFlip", "One-Arm"),
          emote("crouchEntry", "Crouch Entry"),
          emote("sprintDouble", "Sprint Double"),
          emote("tripleCompact", "Compact"),
        ] },
      ],
    });
  }

  _lbl() {
    const old = document.getElementById("ph3d-state"); old && old.remove();
    const e = document.createElement("div"); e.id = "ph3d-state";
    Object.assign(e.style, {
      position: "fixed", left: "18px", bottom: "calc(env(safe-area-inset-bottom) + 32px)",
      zIndex: "30", padding: "9px 16px", borderRadius: "999px", background: "rgba(8,16,28,.7)",
      border: "1px solid rgba(94,224,255,.25)", color: "#eaf6ff", fontSize: "10px", fontWeight: "800",
      letterSpacing: ".18em", textTransform: "uppercase", backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)", pointerEvents: "none", fontFamily: "inherit",
    });
    e.textContent = "STANDING"; document.body.appendChild(e); this._s = e;
  }
  _ul() {
    if (!this._s) return;
    let s = "STANDING";
    if (this._emoteTimer > 0 && this._emoteName) s = EMOTE_LABEL[this._emoteName] || "EMOTING";
    else if (this.state === "crouching") s = "CROUCHING";
    else if (this.state === "sitting") s = "SITTING";
    else if (this.state === "kneel") s = "PRAYING";
    else if (this.state === "lying") s = "LYING DOWN";
    else if (this.state === "bathing") s = "IN BATHTUB";
    else if (this.state === "seated") s = "ON TOILET";
    if (this._selfiePreviewPose && this._selfiePreviewPose !== "neutral") {
      const p = SELFIE_POSES[this._selfiePreviewPose];
      if (p) s = "\uD83E\uDD33 " + p.short;
    }
    if (this.held) s += " · CARRYING";
    const w = this.weapons && this.weapons.current;
    if (w === "knife")  s += " · \uD83D\uDD2A KNIFE";
    if (w === "pistol") s += " · \uD83D\uDD2B PISTOL";
    if (w === "sniper") s += " · \uD83C\uDFAF SNIPER";
    if (w === "bazooka") s += " · \uD83D\uDE80 BAZOOKA";
    this._s.textContent = s;
  }

  _bind() {
    const el = this.dom;
    this._kd = e => {
      this.keys[e.code] = true;
      if (e.code === "KeyE") this.triggerAction();
      if (e.code === "KeyQ" && this.held) this.dropHeld(true);
      if (e.code === "KeyF") {
        if (this.weapons.isArmed()) this.weapons.attack(this._getWeaponTargets());
        else this._lie();
      }
      if (e.code === "KeyG") this._lie();
      if (e.code === "KeyJ" && !e.repeat) this.toggleJet();
      if (e.code === "KeyR") this.weapons.holsterAll();
      if (e.code === "KeyC") this.crouch();
      if (e.code === "Digit1") { this.weapons.select("fists");  this._ul(); }
      if (e.code === "Digit2") { this.weapons.select("knife");  this._ul(); }
      if (e.code === "Digit3") { this.weapons.select("pistol"); this._ul(); }
      if (e.code === "Digit4") { this.weapons.select("sniper"); this._ul(); }
      if (e.code === "Digit5") { this.weapons.select("bazooka"); this._ul(); }
      if (e.code === "Space") { e.preventDefault(); this.jump(); }
    };
    this._ku = e => { this.keys[e.code] = false; };
    window.addEventListener("keydown", this._kd);
    window.addEventListener("keyup", this._ku);

    this._pd = e => {
      const isL = e.clientX < el.clientWidth * 0.5;
      if (isL && !this.joy.on) Object.assign(this.joy, { on:true, id:e.pointerId, ox:e.clientX, oy:e.clientY, dx:0, dy:0 });
      else if (!isL && !this.look.on) Object.assign(this.look, { on:true, id:e.pointerId, x:e.clientX, y:e.clientY });
    };
    this._pm = e => {
      if (this.joy.on && e.pointerId === this.joy.id) {
        const dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
        const m = Math.min(70, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
        this.joy.dx = Math.cos(a) * m / 70; this.joy.dy = Math.sin(a) * m / 70;
      }
      if (this.look.on && e.pointerId === this.look.id) {
        const _ls = window.__ph3d_lookSens || 1;
        const dx = (e.clientX - this.look.x) * _ls, dy = (e.clientY - this.look.y) * _ls;

        const gunOut = this.weapons &&
          (this.weapons.current === "pistol" || this.weapons.current === "sniper" || this.weapons.current === "bazooka");

        if (gunOut) {
          /* horizontal → rotate the character; camera mirrors it */
          this.yaw -= dx * 0.0045;
          this.camYaw = this.yaw + Math.PI;
          /* vertical → tilt aim */
          this.aimPitch = Math.max(-1.05, Math.min(1.05, this.aimPitch - dy * 0.004));
        } else {
          this.camYaw -= dx * 0.0045;
          this.camPitch = Math.max(0.05, Math.min(LOOK_PITCH_MAX, this.camPitch - dy * 0.0035));
        }
        this.look.x = e.clientX; this.look.y = e.clientY;
      }
    };
    this._pu = e => {
      if (e.pointerId === this.joy.id) { this.joy.on = false; this.joy.id = null; this.joy.dx = this.joy.dy = 0; }
      if (e.pointerId === this.look.id) { this.look.on = false; this.look.id = null; }
    };
    el.addEventListener("pointerdown", this._pd);
    el.addEventListener("pointermove", this._pm);
    ["pointerup", "pointercancel", "pointerleave"].forEach(k => el.addEventListener(k, this._pu));
    this._nz = e => e.cancelable && e.preventDefault();
    el.addEventListener("wheel", this._nz, { passive: false });
    el.addEventListener("gesturestart", this._nz, { passive: false });
    el.addEventListener("gesturechange", this._nz, { passive: false });
  }

  setPhoneHold(v) { this.phoneHold = !!v; this._ul(); }
  registerCarryables(list) {
    this.carryables = list;
    for (const c of list) {
      if (!c.mesh.userData.phys) c.mesh.userData.phys = { vel: new THREE.Vector3(), radius: c.radius, halfH: c.halfH, active: false };
    }
  }
  registerInteractable(item) { this.interactables.push(item); }

  _getWeaponTargets() {
    if (this.opts.getTargets) { try { return this.opts.getTargets(); } catch (e) { return []; } }
    return [];
  }

  getAim() {
    if (!this._aimOrigin || !this._aimDir) return null;
    return { origin: this._aimOrigin.clone(), dir: this._aimDir.clone() };
  }

  /* Open-world abilities everywhere: weapons menu, attack/fight button, emotes, hooks that
     scare NPCs. The generic interior scene wires these itself (sets _parity); every other
     scene that builds its own controls gets them from here the first time it updates. */
  _autoParity() {
    this._parity = true;
    if (this.opts && this.opts.getTargets) return;      // scene brings its own weapon setup
    this.opts = this.opts || {};
    const self = this;
    this.opts.getTargets = () => { try { return NPCs.targets(self.pos.x, self.pos.z, 80); } catch (e) { return []; } };
    if (!this.opts.onGunFire) this.opts.onGunFire = () => {
      try { NPCs.scare(self.pos.x, self.pos.z, 15); } catch (e) {}
      try { const S = window.__ph3d_social; if (S && S.onCrime) S.onCrime(self.pos.x, self.pos.z, "gun"); } catch (e) {}
    };
    if (!this.opts.onKnifeStab) this.opts.onKnifeStab = () => {
      try { NPCs.scare(self.pos.x, self.pos.z, 10); } catch (e) {}
      try { const S = window.__ph3d_social; if (S && S.onCrime) S.onCrime(self.pos.x, self.pos.z, "knife"); } catch (e) {}
    };
    const shim = {
      get x() { return self.pos.x; }, get z() { return self.pos.z; }, get y() { return self.floorY; },
      get yaw() { return self.yaw; }, set yaw(v) { self.yaw = v; },
      get sitting() { return self.state !== "standing" && self.state !== "crouching"; },
      get ragdoll() { return false; },
      get onGround() { return self.onGround !== false; },
      get _emoteName() { return self._emoteName; }, set _emoteName(v) { self._emoteName = v; },
      get _emoteTimer() { return self._emoteTimer; }, set _emoteTimer(v) { self._emoteTimer = v; },
      get _emotePhase() { return self._emotePhase; }, set _emotePhase(v) { self._emotePhase = v; },
      _ul: () => { try { self._ul && self._ul(); } catch (e) {} },
    };
    import("./walk-actions.js").then(({ WalkActions }) => {
      if (self._disposed || window.__ph3d_walkCtrl !== self) return;
      if (document.getElementById("ph3d-walk-actions")) return;   // something else already mounted it
      WalkActions.mount({ walker: shim, weapons: self.weapons, getMode: () => "walk" });
      self._WA = WalkActions;
    }).catch(() => {});
  }
  playEmote(name) {
    if (!EMOTE_DURATION[name]) return;
    if (this.state !== "standing") return;
    if (this._emoteTimer > 0 && this._emoteName === name) return;
    this._emoteName = name;
    this._emoteTimer = EMOTE_DURATION[name];
    this._emotePhase = 0;
    this._useTimer = 0;
    /* show-off moves draw a crowd that rings you and claps (same as the open world) */
    if (Animator.FLIP_EMOTES && Animator.FLIP_EMOTES[name]) {
      try { NPCs.audience(this.pos.x, this.pos.z, 22, 6 + EMOTE_DURATION[name] / 1.4); } catch (e) {}
    }
    this._ul();
  }
  /* hug / handshake: the nearest NPC walks over, then both of you play the pose */
  _pairAction(name) {
    if (this.state !== "standing") return;
    const self = this;
    import("./npcs.js").then(({ NPCs }) => {
      const ok = InteriorPoses.withPlayer({
        pos: () => ({ x: self.pos.x, z: self.pos.z }),
        act: (n, nx, nz) => {
          self.yaw = Math.atan2(nx - self.pos.x, nz - self.pos.z);
          self.playEmote(n);
        },
      }, name, NPCs);
      if (!ok) { try { window.__ph3d_phone && window.__ph3d_phone._toast("Nobody close enough"); } catch (e) {} }
    }).catch(() => {});
  }
  /* step up to the nearest table and lean on it */
  _leanTable() {
    if (this.state !== "standing") return;
    const t = InteriorPoses.findTable(this.world.colliders, this.pos.x, this.pos.z, this.floorY, this.level);
    if (!t) { try { window.__ph3d_phone && window.__ph3d_phone._toast("Stand next to a table first"); } catch (e) {} return; }
    const nx = t.dx / t.len, nz = t.dz / t.len;
    this.pos.x = t.tx + nx * 0.50;
    this.pos.z = t.tz + nz * 0.50;
    this.yaw = Math.atan2(-nx, -nz);
    this.vel.set(0, 0, 0);
    this.playEmote("lean_table");
  }
  cancelEmote() {
    if (this._emoteTimer <= 0) return;
    this._emoteTimer = 0;
    this._emoteName = null;
    this._ul();
  }

  sit(seat, slot) {
    this.state = seat.type === "lie" ? "lying" : seat.type === "bath" ? "bathing" : seat.type === "toilet" ? "seated" : seat.type === "kneel" ? "kneel" : "sitting";
    this.sitTarget = seat;
    this._seatArrived = false;
    this.lieSlot = (typeof slot === "number") ? slot : 0;
    if (this.state === "lying") this.lieBlend = 0;
    this.vel.set(0, 0, 0);
    this.joy.dx = 0; this.joy.dy = 0; this.joy.on = false;
    for (const k of Object.keys(this.keys)) this.keys[k] = false;
    this._lyingCooldown = 0.65;
    this._useTimer = 0;
    this._emoteTimer = 0;
    this._emoteName = null;
    this._ul();
  }
  /* sit on flat ground anywhere */
  _sitHere() {
    if (this.state !== "standing" && this.state !== "crouching") return;
    const dx = Math.sin(this.yaw), dz = Math.cos(this.yaw);
    this.sit({ type: "sit", label: "GROUND", x: this.pos.x, z: this.pos.z, dx, dz, yaw: this.yaw,
      h: (this.floorY || 0) + 0.045, level: this.level, taken: false });
  }
  stand() { this.state = "standing"; this.sitTarget = null; this._seatArrived = false; this._ul(); }
  crouch() {
    if (this.state !== "standing" && this.state !== "crouching") return;
    this.state = this.state === "crouching" ? "standing" : "crouching";
    this.cancelEmote();
    this._ul();
  }
  toggleJet() {
    if (this.state !== "standing" && this.state !== "crouching") return;
    this.jet.on = !this.jet.on; this.jet.thrust = false;
    if (this._flyBtn) { this._flyBtn.classList.toggle("is-on", this.jet.on); this._flyBtn.textContent = this.jet.on ? "JETPACK ON" : "JETPACK"; }
    try { window.__ph3d_phone && window.__ph3d_phone._toast(this.jet.on ? "Jetpack on. Hold JUMP to fly" : "Jetpack off"); } catch (e) {}
  }
  /* Raycast the scene's solid meshes (walls, ceilings, roofs). Used only while the jetpack is on. */
  _meshRay(ox, oy, oz, dx, dy, dz, far) {
    if (!this.scene) return null;
    const rc = this._rc; rc.camera = this.camera; rc.set(new THREE.Vector3(ox, oy, oz), new THREE.Vector3(dx, dy, dz)); rc.near = 0; rc.far = far;
    let hits; try { hits = rc.intersectObject(this.scene, true); } catch (e) { return null; }
    for (const h of hits) {
      const o = h.object;
      if (!o.isMesh || !o.visible) continue;
      let skip = false;
      for (let p = o; p; p = p.parent) { if (p === this.avatar || p.userData && p.userData.isNpc) { skip = true; break; } if (p.visible === false) { skip = true; break; } }
      if (skip) continue;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m && (m.side === THREE.BackSide || (m.transparent && m.opacity < 0.4))) continue;
      if (o.geometry && o.geometry.boundingSphere && o.geometry.boundingSphere.radius > 600) continue;
      if (NPCs_has(o)) continue;
      return h;
    }
    return null;
  }
  jump() {
    if (this.jet.on) return;
    if (this.onGround && this.state === "standing") {
      this.vel.y = this.driveFeel ? DRIVE_JUMP_V : JUMP_V;
      this.onGround = false;
      this.cancelEmote();
    }
  }
  pickUp(m) { this.held = m; m.userData.phys.active = false; this._ul(); }
  dropHeld(throwIt = false) {
    if (!this.held) return;
    const dir = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const p = this.held.userData.phys; 
    p.active = true;
    try { const sx = this.pos ? this.pos.x : undefined, sz = this.pos ? this.pos.z : undefined; window.__ph3d_sfx && window.__ph3d_sfx.dropSound(this.held.userData._item || { type: this.held.name }, sx, sz, throwIt); } catch (_) {}
    if (throwIt) { 
      p.vel.copy(dir).multiplyScalar(12); 
      p.vel.y += 5.5; 
      p.vel.x += (Math.random() - 0.5) * 2; 
    } else { 
      p.vel.copy(dir).multiplyScalar(2.0); 
      p.vel.y += 1.5; 
    }
    this.held = null; 
    this._ul();
  }

  triggerAction() {
    if (this.state !== "standing" && this.state !== "crouching") { this.stand(); return; }
    if (this._nearCar && this._enterCarCb) { this._enterCarCb(this._nearCar); return; }
    if (this.held) { this.dropHeld(false); return; }
    const inter = this._nearestInteractable();
    if (inter && inter.onInteract) { inter.onInteract(this); return; }
    const use = this._nearestUse();
    if (use && this.opts.onUse) {
      const kind = use.kind || "";
      this._useTimer = kind === "cook" ? 2.0 : 1.2;
      this._useBend = USE_BEND[kind] != null ? USE_BEND[kind] : 0.30;
      this._emoteTimer = 0;
      this._emoteName = null;
      this.opts.onUse(use, this);
      return;
    }
    if (this.nearSit) { this.sit(this.nearSit); return; }
    const c = this._nearestCarryable();
    if (c) { this.pickUp(c); return; }
    if (this.weapons && this.weapons.isArmed()) {
      this.weapons.attack(this._getWeaponTargets());
    }
  }
  _lie() {
    if (this.state === "lying") { this.stand(); return; }
    let best = null, bd = 2.4 * 2.4;
    for (const s of (this.world.seats || [])) {
      if (s.type !== "lie" || s.level !== this.level) continue;
      const dx = s.x - this.pos.x, dz = s.z - this.pos.z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = s; }
    }
    if (best) this.sit(best);
  }

  _nearestInteractable() {
    let b = null, bd = PICK_RANGE * PICK_RANGE;
    for (const it of this.interactables) {
      if (!it.mesh || !it.mesh.position) continue;
      const dx = it.mesh.position.x - this.pos.x, dz = it.mesh.position.z - this.pos.z;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; b = it; }
    }
    return b;
  }
  _nearestCarryable() {
    let b = null, bd = PICK_RANGE * PICK_RANGE;
    for (const c of this.carryables) {
      if (c.mesh === this.held) continue;
      if (c.mesh.userData.phys && c.mesh.userData.phys.active) continue;
      const dx = c.mesh.position.x - this.pos.x, dz = c.mesh.position.z - this.pos.z;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; b = c.mesh; }
    }
    return b;
  }
  _nearestUse() {
    let b = null, bd = Infinity;
    for (const u of (this.world.uses || [])) {
      if (u.level !== this.level) continue;
      const dx = u.x - this.pos.x, dz = u.z - this.pos.z, d = dx * dx + dz * dz;
      const r = u.r || 1.5;
      if (d < r * r && d < bd) { bd = d; b = u; }
    }
    return b;
  }
  _nearestSeat() {
    if (this.state !== "standing" && this.state !== "crouching") return this.sitTarget;
    let b = null, bd = 1.6 * 1.6;
    for (const s of (this.world.seats || [])) {
      if (s.level !== this.level || s.taken) continue;
      const dx = s.x - this.pos.x, dz = s.z - this.pos.z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; b = s; }
    }
    return b;
  }
  _nearestCar() {
    const cars = this.opts.cars;
    if (!cars) return null;
    let b = null, bd = 2.6 * 2.6;
    for (const c of cars) {
      if (c.level !== undefined && c.level !== this.level) continue;
      const dx = c.x - this.pos.x, dz = c.z - this.pos.z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; b = c; }
    }
    return b;
  }

  _ub() {
    const PA = window.__ph3d_playerActions;
    const hasItem = !!(PA && PA._held && PA._held.mesh);
    if (this._useItemBtn) this._useItemBtn.style.display = hasItem ? "block" : "none";
    if (this._dropItemBtn) this._dropItemBtn.style.display = hasItem ? "block" : "none";
    const b = this._b; if (!b) return;
    /* HUD CSS reads data-state; no inline colours here */
    let t = "", ds = "default";
    if (this.state !== "standing" && this.state !== "crouching") { t = "STAND"; ds = "active"; }
    else if (this._nearCar) { t = "ENTER CAR"; ds = "interact"; }
    else if (this.held) { t = "DROP"; ds = "warn"; }
    else {
      const inter = this._nearestInteractable();
      const use = this._nearestUse();
      if (inter) { t = inter.label || "USE"; ds = "interact"; }
      else if (use) { t = use.label || "USE"; ds = "interact"; }
      else if (this.nearSit) { t = this.nearSit.label || "SIT"; }
      else if (this._nearestCarryable()) { t = "TAKE"; ds = "take"; }
      else if (this.weapons && this.weapons.current === "knife")  { t = "STAB"; ds = "warn"; }
      else if (this.weapons && this.weapons.current === "pistol") { t = "FIRE"; ds = "interact"; }
      else if (this.weapons && this.weapons.current === "sniper") { t = "FIRE"; ds = "interact"; }
      else if (this.weapons && this.weapons.current === "bazooka") { t = "LAUNCH"; ds = "warn"; }
    }
    if (t) { b.textContent = t; b.style.opacity = "1"; b.style.transform = "translateY(0)"; b.style.pointerEvents = "auto"; b.dataset.state = ds; }
    else { b.style.opacity = "0"; b.style.transform = "translateY(10px)"; b.style.pointerEvents = "none"; }
  }

  /* Jetpack limits: stay below ceilings/roofs, and land on roofs/floors that are meshes only. */
  _jetLimits(gi, dt) {
    const lh = this.world.levelHeight ? this.world.levelHeight(this.level) : 0;
    this._jetBase = lh;
    let ceil = Infinity;
    if (this.world.ceilingHeight) ceil = lh + this.world.ceilingHeight - 0.05;
    else ceil = lh + 80;
    if (this.jet.on && !this.onGround && ((this._rcFrame = (this._rcFrame + 1) % 3) === 0)) {
      const h = this._meshRay(this.pos.x, this.floorY + 1.7, this.pos.z, 0, 1, 0, 90);
      this._jetCeilY = h ? h.point.y : Infinity;
      if (!this.world.ceilingHeight) {
        const d = this._meshRay(this.pos.x, this.floorY + 0.6, this.pos.z, 0, -1, 0, 4);
        this._jetFloorY = d && d.point.y > gi.y + 0.05 ? d.point.y : -Infinity;
      }
    }
    if (!this.jet.on) { this._jetCeilY = Infinity; this._jetFloorY = -Infinity; }
    ceil = Math.min(ceil, this._jetCeilY - 0.1);
    const maxFloor = ceil - 1.95;
    if (this.floorY > maxFloor) { this.floorY = maxFloor; if (this.vel.y > 0) this.vel.y = 0; }
    if (this._jetFloorY > gi.y && this.vel.y <= 0 && this.floorY <= this._jetFloorY) {
      gi.y = this._jetFloorY;
    }
  }

  _resolve(px, pz, level) {
    const r = RADIUS;
    const headY = this.floorY + HEAD_CLEARANCE;
    for (let it = 0; it < 2; it++) {
      for (const b of this.world.colliders) {
        if (b.level !== level) continue;

        if (this.sitTarget && this.state !== "standing" && this.state !== "crouching") {
          const stx = this.sitTarget.x, stz = this.sitTarget.z;
          if (px > b.minX - 1.4 &&
              px < b.maxX + 1.4 &&
              pz > b.minZ - 1.4 &&
              pz < b.maxZ + 1.4 &&
              Math.abs(stx - (b.minX + b.maxX) / 2) < 1.6 &&
              Math.abs(stz - (b.minZ + b.maxZ) / 2) < 1.6) {
            continue;
          }
        }

        if (px < b.minX - r || px > b.maxX + r || pz < b.minZ - r || pz > b.maxZ + r) continue;

        if (b.y1 !== undefined && this.floorY >= b.y1 - 0.05) continue;

        if (b.y0 !== undefined && this.floorY >= b.y1 - 0.02) continue;
        if (b.y0 !== undefined && b.y0 > headY) continue;
        const cx = px < b.minX ? b.minX : (px > b.maxX ? b.maxX : px);
        const cz = pz < b.minZ ? b.minZ : (pz > b.maxZ ? b.maxZ : pz);
        const dx = px - cx, dz = pz - cz, d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (b.mesh) {
            b.mesh.position.x += dx * 0.05;
            b.mesh.position.z += dz * 0.05;
            b.mesh.userData.offsetX = (b.mesh.userData.offsetX || 0) + dx * 0.05;
            b.mesh.userData.offsetZ = (b.mesh.userData.offsetZ || 0) + dz * 0.05;
          }
          if (d2 > 1e-7) { const d = Math.sqrt(d2), k = (r - d) / d; px += dx * k * 0.2; pz += dz * k * 0.2; }
          else {
            const dl = px - b.minX, dr = b.maxX - px, db = pz - b.minZ, dt = b.maxZ - pz;
            const m = Math.min(dl, dr, db, dt);
            if (m === dl) px = b.minX - r; else if (m === dr) px = b.maxX + r;
            else if (m === db) pz = b.minZ - r; else pz = b.maxZ + r;
          }
        }
      }
    }
    const bnd = this.world.bounds;
    if (bnd) {
      if (px < bnd.minX + r) px = bnd.minX + r;
      if (px > bnd.maxX - r) px = bnd.maxX - r;
      if (pz < bnd.minZ + r) pz = bnd.minZ + r;
      if (pz > bnd.maxZ - r) pz = bnd.maxZ - r;
    }
    return [px, pz];
  }

  _groundInfo(x, z, level, currentY) {
    for (const st of (this.world.stairs || [])) {
      if (x < st.minX || x > st.maxX || z < st.minZ || z > st.maxZ) continue;
      const axis = st.axis === "x" ? x : z;
      const lo = st.axis === "x" ? st.minX : st.minZ, hi = st.axis === "x" ? st.maxX : st.maxZ;
      const t = Math.max(0, Math.min(1, (axis - lo) / Math.max(0.001, hi - lo)));
      const y = lerp(st.y0, st.y1, t);
      return { y, level: y > (st.y0 + st.y1) / 2 ? (st.toLevel ?? st.level + 1) : st.level, onStairs: true };
    }

    let h = (this.world.levelHeight ? this.world.levelHeight(level) : 0);
    if (this.world.groundAt) h = this.world.groundAt(x, z);

    for (const p of (this.world.platforms || [])) {
      if (p.level !== level) continue;
      if (x < p.minX - RADIUS || x > p.maxX + RADIUS || z < p.minZ - RADIUS || z > p.maxZ + RADIUS) continue;
      if (p.h > h) h = p.h + (this.world.levelHeight ? this.world.levelHeight(level) : 0);
    }

    const feetY = currentY !== undefined ? currentY : this.floorY;
    for (const b of this.world.colliders) {
      if (b.level !== level || b.y0 === undefined || b.y1 === undefined) continue;
      if (b.y1 - b.y0 > 1.8) continue;
      if (x < b.minX - RADIUS || x > b.maxX + RADIUS || z < b.minZ - RADIUS || z > b.maxZ + RADIUS) continue;

      const top = b.y1;
      const _stepCap = this.world.solidFurniture ? 0.26 : STEP;
      if (top > h && top <= feetY + _stepCap + 0.1) {
        h = top;
      }
    }

    return { y: h, level, onStairs: false };
  }

  update(dt) {
  try { window.__ph3d_sfx && window.__ph3d_sfx.sleepTick(Math.min(dt, 0.1), this.state === "lying"); } catch (_) {}
  const _now = performance.now();
  const _real = this._lastNow ? (_now - this._lastNow) / 1000 : dt;
  this._lastNow = _now;
  dt = Math.min(Math.max(this.driveFeel ? _real : dt, 0), this.driveFeel ? 0.25 : 0.08);
  if (!this._parity) this._autoParity();
  if (this._WA) { try { this._WA.tick(dt, this.moving ? 4.6 : 0); } catch (e) {} }

  /* Keep a clamped copy for the animator so a dropped frame
     (dt can still reach 0.25 in driveFeel mode, or 0.08 in the
     regular path) never pops the gait phase. Movement still
     uses the full dt; only the animation clock is clamped. */
  const animDt = Math.min(dt, 0.033);
    let f = 0, s = 0;
    if (this.keys.KeyW || this.keys.ArrowUp) f += 1;
    if (this.keys.KeyS || this.keys.ArrowDown) f -= 1;
    if (this.keys.KeyA || this.keys.ArrowLeft) s -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) s += 1;
    f += -this.joy.dy; s += this.joy.dx;
    let L = Math.hypot(f, s);
    if (L > 1) { f /= L; s /= L; }
    /* high sanity: the character can stop following the controller */
    let _rogueRun = false;
    try {
      const _rg = Sanity.rogue(dt, this, f, s);
      if (_rg) { f = _rg.f; s = _rg.s; _rogueRun = _rg.run; L = Math.hypot(f, s); }
    } catch (e) {}
    /* Debounce the moving flag with a short decay so that the
   transition from "walking" to "idle" doesn't fire all at
   once — camera follow, emote cancel, and use-cancel all key
   off this. A single-frame flip makes the whole upper body
   pop because the animator is still interpolating speed down
   from ~4 to 0. */
this._movingTimer = this._movingTimer || 0;
if (L > 0.05) this._movingTimer = 0.12;
else if (this._movingTimer > 0) this._movingTimer = Math.max(0, this._movingTimer - dt);
this.moving = this._movingTimer > 0;
    try { AnimationAutomation.tickPlayer(dt, this); } catch (e) {}
    const _joyMag = Math.hypot(this.joy.dx, this.joy.dy);
    const _autoRun = window.__ph3d_settings && window.__ph3d_settings.get("autoRun");
    this.running = this.runHold || !!(this.keys.ShiftLeft || this.keys.ShiftRight) || (_autoRun && _joyMag > 0.92);
    if (_rogueRun) this.running = true;

    if (this.moving) {
      if (this._emoteTimer > 0 && !this._fightLock) { this._emoteTimer = 0; this._emoteName = null; this._ul(); }
      if (this._useTimer > 0) this._useTimer = 0;
    }

    const seated = this.state !== "standing" && this.state !== "crouching";

    if (seated) {
      if (this._lyingCooldown > 0) this._lyingCooldown -= dt;
      if (L > 0.5 && this.state === "sitting" && (this._lyingCooldown || 0) <= 0) this.stand();
      else if (this.sitTarget) {
        const tx = this.sitTarget.x, tz = this.sitTarget.z;
        const dxs = tx - this.pos.x, dzs = tz - this.pos.z;
        const distSq = dxs * dxs + dzs * dzs;
        if (distSq > SEAT_ARRIVE_DIST * SEAT_ARRIVE_DIST) {
          const dist = Math.sqrt(distSq);
          const step = Math.min(dist, SEAT_LERP_SPEED * dt);
          this.pos.x += (dxs / dist) * step;
          this.pos.z += (dzs / dist) * step;
        } else { this.pos.x = tx; this.pos.z = tz; this._seatArrived = true; }
        let targetYaw = this.sitTarget.yaw || 0;
        if (this.state === "lying") {
          const st = this.sitTarget;
          const hx = st.headX !== undefined ? st.headX : st.dx;
          const hz = st.headZ !== undefined ? st.headZ : st.dz;
          if (hx !== undefined && hz !== undefined && (hx || hz)) targetYaw = Math.atan2(-hx, -hz);
        }
        this.yaw = targetYaw;
        if (this._seatArrived) {
          const sh = this.sitTarget.h;
          const tgtFloor = this.state === "lying" ? (sh - 0.022)
                         : this.state === "bathing" ? (sh - 0.58)
                         : (sh - HIP_HEIGHT + 0.10);

          this.floorY += (tgtFloor - this.floorY) * Math.min(1, dt * SEAT_SNAP_SPEED);
          this.vel.set(0, 0, 0);
          this.onGround = true;
        }
      }
    } else {
      const speedMult = (this.opts.speedMult || 1) * (window.__ph3d_moveSpeed || 1) * (this.rig && this.rig._carryPose ? 0.86 : 1);   /* carrying an infant: a bit slower */
      const baseWalk = this.driveFeel ? DRIVE_WALK : WALK;
      const baseRun = this.driveFeel ? DRIVE_WALK * DRIVE_RUN_MULT : RUN;
      let speed = baseWalk * speedMult;
      if (this.state === "crouching") speed = CROUCH_SP;
      else if (this.running) speed = baseRun * speedMult;
      if (this.jet && this.jet.on && !this.onGround) speed *= 2.8;   /* jetpack flight is much faster than walking */
      const gunOut = this.weapons &&
        (this.weapons.current === "pistol" || this.weapons.current === "sniper" || this.weapons.current === "bazooka");
      const camF = gunOut ? (this.yaw + Math.PI) : this.camYaw;
      const sin = Math.sin(camF), cos = Math.cos(camF);
      const mx = s * cos - f * sin, mz = -s * sin - f * cos;
      try { window.__ph3d_sfx && window.__ph3d_sfx.stepTick(dt, this.moving && !this.ragdoll, this.running); } catch (_) {}
      if (this.moving) {
        if (!gunOut) this.yaw = Math.atan2(mx, mz);
        if (!this.look.on && this._camFollowEnabled && !gunOut) {
          let dy = (this.yaw + Math.PI) - this.camYaw;
          dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          const rate = this.running ? 2.0 : 0.9;
          this.camYaw += dy * Math.min(1, dt * rate);
        }
      }
      const dx = mx * speed * dt, dz = mz * speed * dt;
      const _n = Math.min(10, Math.max(1, Math.ceil(dt / 0.04), Math.ceil(Math.hypot(dx, dz) / 0.18)));   /* small steps at jet speed: no tunnelling through walls */
      for (let _i = 0; _i < _n; _i++) {
        const [nx, nz] = this._resolve(this.pos.x + dx / _n, this.pos.z + dz / _n, this.level);
        this.pos.x = nx; this.pos.z = nz;
      }
      const gi = this._groundInfo(this.pos.x, this.pos.z, this.level, this.floorY);
      this.level = gi.level;
      const _jt = this.jet;
      const _want = _jt.on && (_jt.thrust || this.keys.Space) && _jt.fuel > 0;
      if (_jt.on && (_want || !this.onGround)) {
        if (_want) {
          if (this.onGround) { this.onGround = false; this.floorY += 0.05; this.vel.y = Math.max(this.vel.y, 2); }
          this.vel.y = Math.min(12, this.vel.y + 46 * dt);
          _jt.fuel = Math.max(0, _jt.fuel - dt * 0.2);
        } else {
          this.vel.y = Math.max(-7, this.vel.y - 14 * dt);
          _jt.fuel = Math.min(1, _jt.fuel + dt * 0.04);
        }
        if (this._flyBtn) this._flyBtn.textContent = "JETPACK " + Math.round(_jt.fuel * 100) + "%";
      } else {
        this.vel.y -= (this.driveFeel ? DRIVE_GRAVITY : GRAVITY) * dt;
        if (_jt.on) _jt.fuel = Math.min(1, _jt.fuel + dt * 0.5);
      }
      this.floorY += this.vel.y * dt;
      if (_jt.on || !this.onGround) this._jetLimits(gi, dt);
     const stepOk = gi.onStairs || Math.abs(gi.y - this.floorY) <= STEP || this.vel.y <= 0;
/* Preserve the pre-zeroed vy so the animator can compute
   landing impact (a.land in animator.js reads ctl.vel.y).
   Without this, gravity zeroes vel.y on the same frame the
   animator reads it, and there's never a landing squash —
   just an instant pop from air pose back to walking. */
const vyBeforeSnap = this.vel.y;
if (this.floorY <= gi.y || (gi.onStairs && this.vel.y <= 0)) { this.floorY = gi.y; this.vel.y = 0; this.onGround = true; }
else this.onGround = false;
/* Feed the landing impact to the animator via _lastVy; the
   animator computes a.land = clamp(-lastVy / 9, 0, 1). */
this._lastVy = vyBeforeSnap;
      if (!stepOk) this.floorY = Math.max(this.floorY, gi.y);
    }

    if (this.held) {
      const fdir = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const handPos = new THREE.Vector3(this.pos.x, this.floorY + 1.05, this.pos.z).addScaledVector(fdir, 0.55);
      this.held.position.lerp(handPos, Math.min(1, 20 * dt));
      this.held.rotation.y += dt * 0.6;
    }
    for (const c of this.carryables) {
      const o = c.mesh, ph = o.userData.phys;
      if (!ph || !ph.active || o === this.held) continue;
      ph.vel.y -= GRAVITY * dt;
      o.position.addScaledVector(ph.vel, dt);
      const floorHere = this._groundInfo(o.position.x, o.position.z, this.level, o.position.y).y;
      if (o.position.y < floorHere + ph.halfH) {
        o.position.y = floorHere + ph.halfH;
        if (ph.vel.y < 0) { 
          ph.vel.y *= -0.45; 
          if (Math.abs(ph.vel.y) < 0.3) ph.vel.y = 0; 
        }
        ph.vel.x *= 0.75; 
        ph.vel.z *= 0.75;
      }
      const [cx, cz] = this._resolve(o.position.x, o.position.z, this.level);
      o.position.x = cx; o.position.z = cz;
      const dp = Math.pow(0.12, dt);
      ph.vel.x *= dp; ph.vel.z *= dp;
      if (Math.abs(ph.vel.x) < 0.05 && Math.abs(ph.vel.z) < 0.05 && Math.abs(ph.vel.y) < 0.05) { ph.vel.set(0, 0, 0); ph.active = false; }
    }

    this.weapons.update(dt, this._getWeaponTargets());

    if (this.world && this.world.colliders) {
      for (const b of this.world.colliders) {
        if (b.mesh && b.mesh.userData.offsetX !== undefined) {
          if (Math.abs(b.mesh.userData.offsetX) > 0.01 || Math.abs(b.mesh.userData.offsetZ) > 0.01) {
            b.mesh.userData.offsetX *= 0.95;
            b.mesh.userData.offsetZ *= 0.95;
            b.mesh.position.x -= b.mesh.userData.offsetX * dt * 2;
            b.mesh.position.z -= b.mesh.userData.offsetZ * dt * 2;
          } else {
            b.mesh.userData.offsetX = 0;
            b.mesh.userData.offsetZ = 0;
          }
        }
      }
    }

    this._animate(animDt);
    this._jetVis.update(dt, this.jet.on, this.jet.on && (this.jet.thrust || this.keys.Space) && this.jet.fuel > 0);
    {
      const flying = this.jet.on && !this.onGround;
      const hs = Math.hypot(this.vel.x || 0, this.vel.z || 0);
      const want = flying ? Math.min(1.3, 0.22 + (this.moving ? 0.6 : 0)) : 0;
      this.jet.tilt += (want - this.jet.tilt) * Math.min(1, dt * 6);
      if (this.jet.tilt < 0.002 && !flying) this.jet.tilt = 0;
      this._tiltNow = this.jet.tilt;
    }
    let avX = this.pos.x, avZ = this.pos.z;
    this._visualOffsetX = 0;
    this._visualOffsetZ = 0;

    if (this.state === "lying" && this.sitTarget && this.sitTarget.type === "lie") {
      const wide = (this.sitTarget.w === undefined) || this.sitTarget.w >= 1.4;
      const off = !wide ? 0 : (this.lieSlot === 1) ? 0.40 : -0.40;
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
      this._visualOffsetX = off * cy;
      this._visualOffsetZ = -off * sy;
      avX += this._visualOffsetX;
      avZ += this._visualOffsetZ;
    }
    if (this.state === "sitting" || this.state === "seated") {
      avX += Math.sin(this.yaw) * 0.04; avZ += Math.cos(this.yaw) * 0.04;
    }
    {
      const tl = this._tiltNow || 0;
      this.avatar.rotation.order = "YXZ";
      this.avatar.rotation.x = tl;
      const HP = 1.0, c = Math.cos(tl), sn = Math.sin(tl);
      this.avatar.position.set(avX - Math.sin(this.yaw) * HP * sn, this.floorY + HP * (1 - c), avZ - Math.cos(this.yaw) * HP * sn);
    }
    this.avatar.rotation.y = this.yaw;

    this._nearCar = (this.state === "standing") ? this._nearestCar() : null;
    this.nearSit = this._nearestSeat();
    this._ul();
    this._ub();
    this._updateJoyRing();
    this._updateCamera(dt, false);
  }

  _animate(dt) {
    // Hand over full body control to animator.js
    Animator.animate(this, dt);
  }

  /* FIX #18 #19 #20 #21 — hard ceiling clamp + push camera out of solid geometry */
_updateCamera(dt, snap) {
  const flyCam = this.jet.on && !this.onGround;
  const baseY = flyCam ? (this._jetBase || 0) : (this.floorY || 0);
  const TALL = flyCam ? 1e3 : 3;
  const gunOut = this.weapons &&
    (this.weapons.current === "pistol" || this.weapons.current === "sniper" || this.weapons.current === "bazooka");

  if (gunOut && this.state === "standing") {
    const aimDir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.aimPitch),
      Math.sin(this.aimPitch),
      Math.cos(this.yaw) * Math.cos(this.aimPitch)
    ).normalize();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const eye = new THREE.Vector3(this.pos.x, this.floorY + 1.55, this.pos.z);

    let camPos = eye.clone()
      .addScaledVector(aimDir, -1.75)
      .addScaledVector(right, 0.38)
      .add(new THREE.Vector3(0, 0.10, 0));

    if (this.world.colliders) {
      const backDir = new THREE.Vector3().subVectors(camPos, eye);
      const backLen = backDir.length();
      if (backLen > 0.01) {
        backDir.divideScalar(backLen);
        let nearest = backLen;
        for (const c of this.world.colliders) {
          if (c.level !== this.level) continue;
          const t = rayAABB(
            eye.x, eye.y, eye.z, backDir.x, backDir.y, backDir.z,
            c.minX, c.y0 != null ? c.y0 : 0, c.minZ,
            c.maxX, c.y1 != null ? c.y1 : TALL, c.maxZ,
            nearest
          );
          if (t > 0 && t < nearest) nearest = t;
        }
        if (flyCam) { const mh = this._meshRay(eye.x, eye.y, eye.z, backDir.x, backDir.y, backDir.z, backLen); if (mh && mh.point.y > baseY + 1.2 && mh.distance < nearest) nearest = mh.distance; }
        if (nearest < backLen) camPos.copy(eye).addScaledVector(backDir, Math.max(0.35, nearest - 0.15));
      }
    }

    if (this.world.groundAt) { const gy = this.world.groundAt(camPos.x, camPos.z) + 0.3; if (camPos.y < gy) camPos.y = gy; }
    this.camera.position.copy(camPos);
    this.camera.lookAt(eye.clone().addScaledVector(aimDir, 15));

    this._aimOrigin = eye;
    this._aimDir = aimDir;
    return;
  }
  this._aimOrigin = null;
  this._aimDir = null;

  const seated = this.state !== "standing" && this.state !== "crouching";
  const zen = this._emoteTimer > 0 && this._emoteName === "meditate";
  const headY = this.floorY + (
    this.state === "lying" ? 0.50:
    seated ? 1.1 :
    zen ? 1.0 :
    this.state === "crouching" ? 1.15 : 1.62
  );
  const targetPos = new THREE.Vector3(
    this.pos.x + (this._visualOffsetX || 0),
    headY,
    this.pos.z + (this._visualOffsetZ || 0)
  );
  let yaw = this.camYaw, pitch = this.camPitch, desiredDist = this.camDist;
  if (seated && this.sitTarget) {
    if (!this._seatedCamLocked) {
      this._seatedCamLocked = true;
      this.camYaw = this.sitTarget.yaw || 0;
      this.camPitch = Math.min(Math.max(this.camPitch, 0.32), 0.55);
      this._forceCamSnap = true;
    }
    yaw = this.camYaw;
    pitch = this.camPitch;
    desiredDist = this.state === "lying" ? this.camDist * 0.82 : this.camDist * 0.92;
  } else {
    this._seatedCamLocked = false;
  }
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  let allowedDist = desiredDist;
  if (this.world.colliders && this.world.colliders.length) {
    const ox = targetPos.x, oy = targetPos.y, oz = targetPos.z;
    const dx = dir.x, dy = dir.y, dz = dir.z;
    let nearest = desiredDist + 0.3;
    for (let i = 0; i < this.world.colliders.length; i++) {
      const c = this.world.colliders[i];
      if (c.level !== this.level) continue;
      const y0 = c.y0 != null ? c.y0 : 0;
      const y1 = c.y1 != null ? c.y1 : TALL;
      if (!flyCam && y1 - this.floorY < 1.9) continue;
      const t = rayAABB(ox, oy, oz, dx, dy, dz, c.minX, y0, c.minZ, c.maxX, y1, c.maxZ, nearest);
      if (t > 0 && t < nearest) nearest = t;
    }
    if (flyCam) { const mh = this._meshRay(ox, oy, oz, dx, dy, dz, desiredDist + 0.3); if (mh && mh.point.y > baseY + 1.2 && mh.distance < nearest) nearest = mh.distance; }
    if (nearest <= desiredDist + 0.25) allowedDist = Math.max(CAM_MIN_DIST, nearest - 0.18);
  }
  const camPos = targetPos.clone().addScaledVector(dir, allowedDist);
  if (!seated) camPos.y += 0.15;
  /* A wall is squeezing the camera in: lift it up and over the shoulder instead of
     sliding it into the character's head. */
  if (!seated && allowedDist < desiredDist * 0.8) {
    const squeeze = clamp01((desiredDist * 0.8 - allowedDist) / Math.max(0.1, desiredDist * 0.8 - CAM_MIN_DIST));
    camPos.y += squeeze * 0.9;
  }

  /* #18 #20 — hard ceiling clamp (fixes mansion upstairs AND low interior walls) */
  if (this.world && this.world.ceilingHeight) {
    const floorTop = baseY;
    const absoluteCeiling = floorTop + this.world.ceilingHeight - 0.28;
    if (camPos.y > absoluteCeiling) camPos.y = absoluteCeiling;
  }

  /* #21 — final sanity check: never let the camera sit inside any collider */
  if (this.world.colliders) {
    for (let i = 0; i < this.world.colliders.length; i++) {
      const c = this.world.colliders[i];
      if (c.level !== this.level) continue;
      const y0 = c.y0 != null ? c.y0 : 0;
      const y1 = c.y1 != null ? c.y1 : TALL;
      if (camPos.x > c.minX - 0.22 && camPos.x < c.maxX + 0.22 &&
          camPos.z > c.minZ - 0.22 && camPos.z < c.maxZ + 0.22 &&
          camPos.y > y0 - 0.22 && camPos.y < y1 + 0.22) {
        /* Push out via shortest axis */
        const dl = camPos.x - (c.minX - 0.22);
        const dr = (c.maxX + 0.22) - camPos.x;
        const df = camPos.z - (c.minZ - 0.22);
        const db = (c.maxZ + 0.22) - camPos.z;
        const du = camPos.y - (y0 - 0.22);
        const dd = (y1 + 0.22) - camPos.y;
        const m = Math.min(dl, dr, df, db, du, dd);
        if (m === dl) camPos.x = c.minX - 0.22;
        else if (m === dr) camPos.x = c.maxX + 0.22;
        else if (m === df) camPos.z = c.minZ - 0.22;
        else if (m === db) camPos.z = c.maxZ + 0.22;
        else if (m === du) camPos.y = y0 - 0.22;
        else camPos.y = y1 + 0.22;
      }
    }
  }

  /* flying: never let the camera poke above a roof/ceiling directly over it */
  if (flyCam && !this.world.ceilingHeight && this._jetCeilY < Infinity && camPos.y > this._jetCeilY - 0.3) camPos.y = Math.max(targetPos.y, this._jetCeilY - 0.3);
  if (flyCam) { const dv = camPos.clone().sub(targetPos), L = dv.length(); if (L > 0.05) { dv.divideScalar(L); const mh = this._meshRay(targetPos.x, targetPos.y, targetPos.z, dv.x, dv.y, dv.z, L + 0.2); if (mh && mh.point.y > baseY + 1.2 && mh.distance < L + 0.2) camPos.copy(targetPos).addScaledVector(dv, Math.max(0.5, mh.distance - 0.25)); } }
  /* never let the camera dip under terrain (beach dunes) */
  if (this.world.groundAt) { const gy = this.world.groundAt(camPos.x, camPos.z) + 0.3; if (camPos.y < gy) camPos.y = gy; }

  /* last guard: camera must stay clear of the head. If the push-outs above left it
     too close, put it straight above the character and hide the body if still near. */
  {
    const hd = camPos.distanceTo(targetPos);
    if (!seated && hd < 1.2) {
      camPos.set(targetPos.x - dir.x * 0.6, targetPos.y + 1.7, targetPos.z - dir.z * 0.6);
      if (this.world && this.world.ceilingHeight) {
        const cap = baseY + this.world.ceilingHeight - 0.2;
        if (camPos.y > cap) camPos.y = cap;
      }
    }
  }
  const currentDist = this.camera.position.distanceTo(targetPos);
  const pullingIn = allowedDist < currentDist;
  const lerpRate = pullingIn ? 14 : 6;

  if (snap || this._forceCamSnap) {
    this.camera.position.copy(camPos);
    this._forceCamSnap = false;
  } else {
    this.camera.position.lerp(camPos, Math.min(1, dt * lerpRate));
  }
  this.camera.lookAt(targetPos.x, targetPos.y + 0.25, targetPos.z);
  /* body fades out only if the camera still ends up inside it (rare) */
  if (this.avatar) {
    const close = this.camera.position.distanceTo(targetPos) < 0.75;
    if (close && this.avatar.visible) { this.avatar.visible = false; this._hidByCam = true; }
    else if (!close && this._hidByCam) { this.avatar.visible = true; this._hidByCam = false; }
  }
}

  dispose() {
    this._disposed = true;
    if (this._WA) { try { this._WA.unmount(); } catch (e) {} this._WA = null; }
    if (window.__ph3d_walkCtrl === this) window.__ph3d_walkCtrl = null;
    window.removeEventListener("keydown", this._kd);
    window.removeEventListener("keyup", this._ku);
    const el = this.dom;
    el.removeEventListener("pointerdown", this._pd);
    el.removeEventListener("pointermove", this._pm);
    ["pointerup", "pointercancel", "pointerleave"].forEach(k => el.removeEventListener(k, this._pu));
    el.removeEventListener("wheel", this._nz);
    el.removeEventListener("gesturestart", this._nz);
    el.removeEventListener("gesturechange", this._nz);
    this._b && this._b.parentNode && this._b.parentNode.removeChild(this._b);
    this._jumpBtn && this._jumpBtn.parentNode && this._jumpBtn.parentNode.removeChild(this._jumpBtn);
    this._runBtn && this._runBtn.parentNode && this._runBtn.parentNode.removeChild(this._runBtn);
    this._menuBtn && this._menuBtn.parentNode && this._menuBtn.parentNode.removeChild(this._menuBtn);
    this._crouchBtn && this._crouchBtn.parentNode && this._crouchBtn.parentNode.removeChild(this._crouchBtn);
    this._lieBtn && this._lieBtn.parentNode && this._lieBtn.parentNode.removeChild(this._lieBtn);
    this._qmWrap && this._qmWrap.parentNode && this._qmWrap.parentNode.removeChild(this._qmWrap);
    this._joyRingEl && this._joyRingEl.parentNode && this._joyRingEl.parentNode.removeChild(this._joyRingEl);
    this._s && this._s.parentNode && this._s.parentNode.removeChild(this._s);
    if (this.avatar && this.avatar.parent) this.avatar.parent.remove(this.avatar);
    try { this.weapons && this.weapons.dispose(); } catch (e) {}
    if (window.__ph3d_tp === this) window.__ph3d_tp = null;
  }
}

export function openWardrobeFor(controls) {
  if (!controls) return;
  if (controls._wardrobeUI && controls._wardrobeUI.open) { try { controls._wardrobeUI.open(); return; } catch (e) {} }
  try {
    const ui = new WardrobeUI((c2, key) => {
      try {
        if (key && controls.rig && controls.rig.mats) { Wardrobe.updateMaterials(controls.rig.mats, Wardrobe.effective(c2)); return; }
        const cfg = Wardrobe.config;
        const built = buildCharacter(cfg);
        if (controls.avatar && controls.avatar.parent) controls.avatar.parent.remove(controls.avatar);
        controls.avatar = built.root;
        controls.rig = built.rig;
        if (controls._anim) controls._anim.rig = null;
        try { attachPhone(controls.rig); } catch (e) {}
        try { controls._jetVis && controls._jetVis.attach(controls.avatar); } catch (e) {}
        controls.avatar.position.set(controls.pos.x, controls.floorY, controls.pos.z);
        controls.avatar.rotation.y = controls.yaw;
        if (controls.scene) controls.scene.add(controls.avatar);
      } catch (e) {}
    });
    controls._wardrobeUI = ui;
    ui.open();
  } catch (e) { console.warn("[wardrobe]", e); }
}

