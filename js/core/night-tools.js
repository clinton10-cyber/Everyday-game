/* NightTools: player-controlled flashlight for dark outdoor exploration.
   A single pooled spotlight + local fill light follows the on-foot avatar.
   It is deliberately separate from the world clock: the player may switch
   it on whenever visibility is poor. */
import * as THREE from "three";
import { setGrip } from "../characters/lowpoly.js";

/* Held torch model: handle along local +Y, lit head at the +Y end (same frame as the knife, so it points forward in the hand). */
function buildTorch3D() {
  const g = new THREE.Group();
  g.name = "__heldTorch";
  const body = new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.55, metalness: 0.6 });
  const band = new THREE.MeshStandardMaterial({ color: 0xd9a21b, roughness: 0.5, metalness: 0.4 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.17, 12), body);
  handle.position.y = 0.02; g.add(handle);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.012, 12), band);
  ring.position.y = 0.075; g.add(ring);
  const headMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.030, 0.07, 14), body);
  headMesh.position.y = 0.14; g.add(headMesh);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.042, 14), new THREE.MeshBasicMaterial({ color: 0xfff1c8 }));
  lens.rotation.x = -Math.PI / 2; lens.position.y = 0.176; lens.name = "__torchLens"; g.add(lens);
  const tip = new THREE.Object3D(); tip.name = "__torchTip"; tip.position.y = 0.19; g.add(tip);
  g.userData.tip = tip; g.userData.lens = lens;
  g.traverse((o) => { if (o.isMesh && o !== lens) o.castShadow = true; });
  return g;
}

export const NightTools = {
  enabled: false,
  _scene: null,
  _spot: null,
  _fill: null,
  _target: null,
  _lastPlayer: null,
  _held: null,
  _gripSet: false,

  toggle(force) {
    this.enabled = typeof force === "boolean" ? force : !this.enabled;
    try { localStorage.setItem("everyday_torch_on", this.enabled ? "1" : "0"); } catch (e) {}
    this._syncButton();
    return this.enabled;
  },

  init() {
    try { this.enabled = localStorage.getItem("everyday_torch_on") === "1"; } catch (e) {}
    this._syncButton();
  },

  _syncButton() {
    const b = document.getElementById("ph3d-torch-btn");
    if (!b) return;
    b.textContent = this.enabled ? "🔦 TORCH ON" : "🔦 TORCH OFF";
    b.setAttribute("aria-pressed", this.enabled ? "true" : "false");
    b.style.borderColor = this.enabled ? "rgba(255,220,120,.9)" : "rgba(255,255,255,.28)";
    b.style.background = this.enabled ? "rgba(105,75,18,.94)" : "rgba(8,16,28,.88)";
  },

  _make(scene) {
    this._disposeLights();
    this._scene = scene;
    const spot = new THREE.SpotLight(0xffe7bd, 95, 34, Math.PI / 7, 0.62, 1.25);
    spot.name = "__playerFlashlight";
    spot.castShadow = false;
    spot.position.set(0, 1.5, 0);
    spot.visible = false;
    const target = new THREE.Object3D();
    target.name = "__playerFlashlightTarget";
    target.position.set(0, 1.15, 8);
    spot.target = target;
    const fill = new THREE.PointLight(0xffdca6, 2.2, 5.5, 2);
    fill.name = "__playerFlashlightFill";
    fill.visible = false;
    scene.add(spot, target, fill);
    this._spot = spot; this._target = target; this._fill = fill;
  },

  _disposeLights() {
    if (this._scene) {
      try { if (this._spot) this._scene.remove(this._spot); } catch (e) {}
      try { if (this._target) this._scene.remove(this._target); } catch (e) {}
      try { if (this._fill) this._scene.remove(this._fill); } catch (e) {}
    }
    this._scene = this._spot = this._target = this._fill = null;
  },

  /* Put the torch model in the player's right hand while it is on; returns its tip (world) or null if no rig/hand. */
  _syncHeld(p, on) {
    const rig = p && p.rig, grip = rig && rig.armR && rig.armR.grip;
    if (!grip) { if (this._held && this._held.parent) this._held.parent.remove(this._held); return null; }
    if (!this._held) this._held = buildTorch3D();
    const m = this._held;
    if (m.parent !== grip) { if (m.parent) m.parent.remove(m); m.rotation.set(Math.PI / 2, 0, 0); m.position.set(0, 0, 0); grip.add(m); }
    /* another right-hand item (knife / gun) drawn? then the torch stays pocketed */
    let busy = false;
    for (const c of grip.children) { if (c !== m && c.visible) { busy = true; break; } }
    const show = on && !busy;
    m.visible = show;
    if (show && !this._gripSet) { try { setGrip(rig, -1, 0.9); } catch (e) {} this._gripSet = true; }
    else if (!show && this._gripSet) { if (!busy) { try { setGrip(rig, -1, 0); } catch (e) {} } this._gripSet = false; }
    return show ? m : null;
  },

  tick(current) {
    const p = window.__ph3d_player;
    const scene = current && current.three;
    const valid = !!(p && scene && p.scene === scene && p.pos && Number.isFinite(p.yaw));
    if (!valid) {
      if (this._scene) this._disposeLights();
      if (this._held && this._held.parent) { this._held.parent.remove(this._held); this._gripSet = false; }
      return;
    }
    if (this._scene !== scene || !this._spot) this._make(scene);
    const on = !!this.enabled;
    const held = this._syncHeld(p, on);
    this._spot.visible = this._fill.visible = on;
    if (!on) return;
    const x = p.pos.x, z = p.pos.z;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    const pitch = Number(p.aimPitch) || 0;
    let sx = x + fx * 0.12, sy = (Number(p.floorY) || 0) + 1.48, sz = z + fz * 0.12;
    if (held) {
      /* light comes from the torch head in the hand (falls back to chest height if there is no hand) */
      const tip = held.userData.tip;
      try { held.updateWorldMatrix(true, true); tip.getWorldPosition(this._tmp || (this._tmp = new THREE.Vector3())); sx = this._tmp.x; sy = this._tmp.y; sz = this._tmp.z; } catch (e) {}
    }
    this._spot.position.set(sx, sy, sz);
    this._target.position.set(x + fx * 15, sy - Math.sin(pitch) * 10 - 0.25, z + fz * 15);
    this._fill.position.set(sx + fx * 0.2, sy - 0.05, sz + fz * 0.2);
  },

  dispose() { this._disposeLights(); if (this._held && this._held.parent) this._held.parent.remove(this._held); this._gripSet = false; },
};

if (typeof window !== "undefined") window.__ph3d_nightTools = NightTools;
