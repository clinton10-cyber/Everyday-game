import * as THREE from "three";
import { Multiplayer } from "./multiplayer.js";
import { Voice } from "./voice.js";
import { Wardrobe } from "./wardrobe.js";
import {
  buildCharacter, attachPhone, applyPhonePose, groundLeg, groundArm, HIP_HEIGHT,
} from "../characters/lowpoly.js";
import { buildGWagon3D } from "../vehicles/gwagon3d.js";
import { buildCybertruck3D } from "../vehicles/cybertruck3d.js";
import { buildHoverboard } from "../vehicles/hoverboard.js";
import { buildNK250 } from "../vehicles/nk250.js";

const lerp = (a, b, t) => a + (b - a) * t;

const WORLD_SCENES = new Set(["walk", "drive"]);

export const RemoteAvatars = {
  parent: null,
  avatars: new Map(),   // id -> { group, kind, mesh, rig, lookKey, carKey, target, lastX, lastZ, speed, phase }

  attach(parent) {
    if (this.parent === parent) return;
    this.parent = parent;
    for (const a of this.avatars.values()) {
      if (a.group.parent) a.group.parent.remove(a.group);
      if (parent) parent.add(a.group);
    }
  },

  detach() {
    for (const a of this.avatars.values()) {
      if (a.group.parent) a.group.parent.remove(a.group);
    }
    this.parent = null;
  },

  clear() {
    for (const id of [...this.avatars.keys()]) this._remove(id);
  },

  tick(myScene, dt) {
    const isWorld = WORLD_SCENES.has(myScene);

    // Ensure every remote player has a slot
    for (const [id, p] of Multiplayer.players) {
      const remoteScene = p.scene || "city";
      const visible = isWorld && WORLD_SCENES.has(remoteScene);
      if (!visible) {
        if (this.avatars.has(id)) this._remove(id);
        continue;
      }
      this._ensure(id, p);
      this._applyTarget(id, p);
    }

    // Remove avatars for players who are gone
    for (const id of [...this.avatars.keys()]) {
      if (!Multiplayer.players.has(id)) this._remove(id);
    }

    // Animate + interpolate
    for (const [id, a] of this.avatars) {
      // position lerp toward target
      const k = Math.min(1, dt * 14);
      a.group.position.x += (a.target.x - a.group.position.x) * k;
      a.group.position.z += (a.target.z - a.group.position.z) * k;
      // shortest-path yaw
      let dy = a.target.yaw - a.group.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      a.group.rotation.y += dy * k;

      // Listening badge visibility
      if (a.badge) {
        const heard = Voice.isBeingListenedTo(id);
        a.badge.visible = heard;
      }

      // character animation
      if (a.kind === "character" && a.rig) {
        const s = a.speed || 0;
        if (s > 0.15) a.phase = (a.phase || 0) + dt * s * 3.2;
        const runAmt = Math.max(0, Math.min(1, (s - 2) / 2.6));
        const moveAmt = Math.max(0, Math.min(1, s / 1.8));
        const strideAmp = lerp(0.5, 0.92, runAmt) * moveAmt;
        const kneeAmp   = lerp(0.95, 1.55, runAmt) * moveAmt;
        const armAmp    = lerp(0.42, 0.85, runAmt) * moveAmt;
        const bobAmp    = lerp(0.02, 0.058, runAmt) * moveAmt;

        const R = a.rig;
        const g1 = groundLeg(a.phase, strideAmp, kneeAmp, moveAmt);
        const g2 = groundLeg(a.phase + Math.PI, strideAmp, kneeAmp, moveAmt);
        if (R.legL && R.legL.hip) {
          R.legL.hip.rotation.x = g1.thigh - 0.05;
          R.legL.knee.rotation.x = g1.knee + 0.10;
          if (R.legL.ankle) R.legL.ankle.rotation.x = g1.ankle - 0.02;
          R.legR.hip.rotation.x = g2.thigh - 0.05;
          R.legR.knee.rotation.x = g2.knee + 0.10;
          if (R.legR.ankle) R.legR.ankle.rotation.x = g2.ankle - 0.02;
        }
        const a1 = groundArm(a.phase, armAmp, runAmt, moveAmt);
        const a2 = groundArm(a.phase + Math.PI, armAmp, runAmt, moveAmt);
        if (R.armL && R.armL.shoulder) {
          R.armL.shoulder.rotation.x = a1.swing;
          R.armL.elbow.rotation.x    = a1.elbow - 0.28;
          R.armR.shoulder.rotation.x = a2.swing;
          R.armR.elbow.rotation.x    = a2.elbow - 0.28;
        }
        const bob = bobAmp * -Math.cos(2 * a.phase);
        R.hips.position.y = HIP_HEIGHT + bob;
        R.hips.rotation.y = Math.sin(a.phase) * 0.10 * moveAmt;
        try { applyPhonePose(R, !!p.phoneHold); } catch (e) {}
        // default phone off unless we've received a phone-hold action
      }
    }
  },

  _lookKey(look) {
    if (!look) return "";
    try { return JSON.stringify(look); } catch (e) { return ""; }
  },

  _carKey(car) {
    if (!car) return "";
    return (car.model || "gwagon") + "|" + (car.body || "") + "|" + (car.rim || "");
  },

  _ensure(id, p) {
    const kind = p.mode === "drive" ? "car" : "character";
    const lookKey = kind === "character" ? this._lookKey(p.look) : "";
    const carKey  = kind === "car"       ? this._carKey(p.car)   : "";

    let a = this.avatars.get(id);
    const needRebuild = !a
      || a.kind !== kind
      || (kind === "character" && a.lookKey !== lookKey)
      || (kind === "car" && a.carKey !== carKey);

    if (!needRebuild) return a;

    if (a) this._dispose(a);

    const group = new THREE.Group();
    let mesh = null, rig = null;

    if (kind === "character") {
      const c = buildCharacter(p.look || Wardrobe.config);
      mesh = c.root;
      rig = c.rig;
      try { attachPhone(rig); } catch (e) {}
    } else {
      const model = p.car?.model || "gwagon";
      mesh = model === "cybertruck"
        ? buildCybertruck3D(p.car?.body || "#c4c9d2", p.car?.rim || "#9aa0a8")
        : model === "nk250"
          ? buildNK250(p.car?.body || "#d51f2b", p.car?.rim || "#9aa2ad")
          : model === "hoverboard"
            ? buildHoverboard(p.car?.body || "#38e8ff", p.car?.rim || "#9aa2ad")
            : buildGWagon3D(p.car?.body || "#24282e", p.car?.rim || "#9aa3ad");
    }
    group.add(mesh);

    // Listening badge above head
    const badge = makeEarBadge();
    badge.position.y = 2.4;
    group.add(badge);

    a = {
      group, kind, mesh, rig,
      lookKey, carKey,
      target: { x: p.x || 0, z: p.z || 0, yaw: p.yaw || 0 },
      lastX: p.x || 0, lastZ: p.z || 0,
      speed: 0, phase: 0,
      badge,
    };
    this.avatars.set(id, a);
    if (this.parent) this.parent.add(group);

    // snap to first target
    group.position.set(a.target.x, 0, a.target.z);
    group.rotation.y = a.target.yaw;
    return a;
  },

  _applyTarget(id, p) {
    const a = this.avatars.get(id);
    if (!a) return;

    // Speed from position delta
    const now = performance.now();
    const dt = Math.max(0.016, (now - (a._lastT || now)) / 1000);
    const dx = (p.x || 0) - a.lastX;
    const dz = (p.z || 0) - a.lastZ;
    const sp = Math.hypot(dx, dz) / dt;
    a.speed = sp * 0.7 + (a.speed || 0) * 0.3;   // smooth
    a.lastX = p.x || 0;
    a.lastZ = p.z || 0;
    a._lastT = now;

    a.target.x = p.x || 0;
    a.target.z = p.z || 0;
    a.target.yaw = p.yaw || 0;
  },

  _remove(id) {
    const a = this.avatars.get(id);
    if (!a) return;
    this._dispose(a);
    this.avatars.delete(id);
  },

  _dispose(a) {
    if (a.group.parent) a.group.parent.remove(a.group);
    a.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const list = Array.isArray(o.material) ? o.material : [o.material];
        list.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
  },

  /* Return a list of {id, x, z, kind, radius, speed} for collisions. */
  collideList(myScene) {
    const out = [];
    for (const [id, a] of this.avatars) {
      const p = Multiplayer.players.get(id);
      if (!p) continue;
      const kind = a.kind;   // "character" | "car"
      const radius = kind === "car" ? 2.6 : 0.45;
      out.push({
        id, kind,
        x: a.group.position.x,
        z: a.group.position.z,
        radius,
        speed: a.speed || 0,
      });
    }
    return out;
  },
};
/* ── Listening badge (small floating ear icon) ────────── */
function makeEarBadge() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(167,139,250,.9)";
  g.beginPath();
  g.arc(32, 32, 26, 0, Math.PI * 2);
  g.fill();
  g.font = "bold 34px system-ui";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("👂", 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthTest: false, depthWrite: false,
  }));
  spr.scale.set(0.65, 0.65, 1);
  spr.renderOrder = 1000;
  spr.visible = false;
  return spr;
}

