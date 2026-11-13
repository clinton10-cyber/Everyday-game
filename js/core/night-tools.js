/* NightTools: player-controlled flashlight for dark outdoor exploration.
   A single pooled spotlight + local fill light follows the on-foot avatar.
   It is deliberately separate from the world clock: the player may switch
   it on whenever visibility is poor. */
import * as THREE from "three";

export const NightTools = {
  enabled: false,
  _scene: null,
  _spot: null,
  _fill: null,
  _target: null,
  _lastPlayer: null,

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

  tick(current) {
    const p = window.__ph3d_player;
    const scene = current && current.three;
    const valid = !!(p && scene && p.scene === scene && p.pos && Number.isFinite(p.yaw));
    if (!valid) {
      if (this._scene) this._disposeLights();
      return;
    }
    if (this._scene !== scene || !this._spot) this._make(scene);
    const on = !!this.enabled;
    this._spot.visible = this._fill.visible = on;
    if (!on) return;
    const x = p.pos.x, z = p.pos.z;
    const y = (Number(p.floorY) || 0) + 1.48;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    const pitch = Number(p.aimPitch) || 0;
    this._spot.position.set(x + fx * 0.12, y, z + fz * 0.12);
    this._target.position.set(x + fx * 15, y - Math.sin(pitch) * 10 - 0.25, z + fz * 15);
    this._fill.position.set(x + fx * 0.35, y - 0.1, z + fz * 0.35);
  },

  dispose() { this._disposeLights(); },
};

if (typeof window !== "undefined") window.__ph3d_nightTools = NightTools;
