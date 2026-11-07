import * as THREE from "three";

const STORE_KEY = "ph3d.furn.v1";

/* Furniture editor for interior scenes.
   Usage:
     const editor = new FurnitureEditor(scene, camera, controls, dom);
     editor.enable();     // enters edit mode
     editor.disable();
     editor.save();
     editor.load();       // restores saved offsets
*/
export class FurnitureEditor {
  constructor(three, camera, controls, dom, opts) {
    this.three = three;
    this.camera = camera;
    this.controls = controls;
    this.dom = dom;
    this.opts = opts || {};
    this.enabled = false;
    this.selected = null;
    this._raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._dragging = false;
    this._lastPointer = null;
    this._offset = new THREE.Vector3();
    this._stored = {};
    this._pushed = false;

    try { this._stored = JSON.parse(localStorage.getItem(this._key()) || "{}"); }
    catch (e) { this._stored = {}; }
  }

  _key() { return STORE_KEY + "." + (this.opts.place || "myhouse"); }

  /* Collect all children of scene that are furniture (userData.editable). */
  _editableList() {
    const out = [];
    this.three.traverse(o => {
      if (o.userData && o.userData.editable) out.push(o);
    });
    return out;
  }

  /* Mark every direct child group of the scene as editable if it looks
     like furniture — furniture groups have at least one non-label child
     and are not walls. This is a heuristic so we don't have to touch
     every builder. Call from interior scene after furnishing. */
  static markEditable(root, skip) {
    const skipSet = skip || new Set();
    let n = 0;
    root.children.forEach(child => {
      if (skipSet.has(child)) return;
      if (!child.isGroup) return;
      if (child.userData.isLabel) return;
      if (child.userData.noEdit) return;
      // Require it to have at least one mesh
      let has = false;
      child.traverse(o => { if (o.isMesh) has = true; });
      if (!has) return;
      child.userData.editable = true;
      n++;
    });
    return n;
  }

  load() {
    const list = this._editableList();
    list.forEach(o => {
      const s = this._stored[o.name || o.uuid];
      if (s) {
        o.position.fromArray(s.pos);
        o.rotation.y = s.ry || o.rotation.y;
      }
    });
  }

  save() {
    const list = this._editableList();
    const out = {};
    list.forEach(o => {
      const k = o.name || o.uuid;
      out[k] = { pos: o.position.toArray(), ry: o.rotation.y };
    });
    this._stored = out;
    try { localStorage.setItem(this._key(), JSON.stringify(out)); } catch (e) {}
  }

  reset() {
    try { localStorage.removeItem(this._key()); } catch (e) {}
    this._stored = {};
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    // Ghost overlay to indicate edit mode
    const b = document.createElement("div");
    b.id = "ph3d-furn-badge";
    b.textContent = "EDIT MODE · tap furniture";
    Object.assign(b.style, {
      position: "fixed", left: "50%",
      top: "calc(env(safe-area-inset-top) + 14px)",
      transform: "translateX(-50%)", zIndex: "30",
      padding: "8px 16px", borderRadius: "999px",
      background: "rgba(255,180,60,.9)",
      color: "#201000", font: "900 11px Inter,system-ui,sans-serif",
      letterSpacing: ".14em", pointerEvents: "none",
    });
    document.body.appendChild(b);
    this._badge = b;

    // Selected outline (a thin wireframe box)
    const sel = new THREE.BoxHelper(new THREE.Object3D(), 0xffcc5e);
    sel.visible = false;
    sel.userData.noEdit = true;
    this.three.add(sel);
    this._outline = sel;

    // Buttons
    const bar = document.createElement("div");
    bar.id = "ph3d-furn-bar";
    bar.style.cssText = `
      position:fixed;left:14px;right:14px;
      bottom:calc(env(safe-area-inset-bottom) + 88px);
      z-index:30;display:flex;gap:8px;justify-content:center;
      flex-wrap:wrap;pointer-events:auto;
    `;
    const mkBtn = (label, bg) => {
      const el = document.createElement("button");
      el.textContent = label;
      Object.assign(el.style, {
        padding: "11px 16px", borderRadius: "999px",
        background: bg || "rgba(255,255,255,.14)",
        border: "1px solid rgba(255,255,255,.3)",
        color: "#fff", font: "800 11px Inter,system-ui,sans-serif",
        letterSpacing: ".12em", cursor: "pointer",
        touchAction: "none",
      });
      return el;
    };
    this._btnRotL  = mkBtn("⟲ 15°");
    this._btnRotR  = mkBtn("⟳ 15°");
    this._btnDel   = mkBtn("DELETE", "rgba(220,40,40,.7)");
    this._btnUndel = mkBtn("UNDO ALL", "rgba(255,180,60,.85)");
    this._btnDone  = mkBtn("DONE", "linear-gradient(135deg,#5ee0ff,#4ab6ff)");
    this._btnDone.style.color = "#04121c";
    bar.append(this._btnRotL, this._btnRotR, this._btnDel, this._btnUndel, this._btnDone);
    document.body.appendChild(bar);
    this._bar = bar;

    this._btnRotL.onclick  = () => this._rotate(-Math.PI / 12);
    this._btnRotR.onclick  = () => this._rotate( Math.PI / 12);
    this._btnDel.onclick   = () => this._delete();
    this._btnUndel.onclick = () => {
      this.reset();
      if (this.opts.onReset) this.opts.onReset();
      this.selected = null;
      this._outline.visible = false;
    };
    this._btnDone.onclick  = () => {
      this.save();
      if (this.opts.onExit) this.opts.onExit();
    };

    // Pointer handlers for drag + select
    this._pd = e => {
      if (e.target !== this.dom) return;
      const hit = this._pick(e.clientX, e.clientY);
      if (hit) {
        this.selected = hit;
        this._dragging = true;
        this._lastPointer = { x: e.clientX, y: e.clientY };
        // compute drag offset so object doesn't jump
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const hit3 = new THREE.Vector3();
        this._raycaster.ray.intersectPlane(plane, hit3);
        if (hit3) this._offset.copy(this.selected.position).sub(hit3);
        this._updateOutline();
      } else {
        this.selected = null;
        this._dragging = false;
        this._outline.visible = false;
      }
    };
    this._pm = e => {
      if (!this._dragging || !this.selected) return;
      const rect = this.dom.getBoundingClientRect();
      this._ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this._ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._ndc, this.camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hit3 = new THREE.Vector3();
      if (this._raycaster.ray.intersectPlane(plane, hit3)) {
        hit3.add(this._offset);
        this.selected.position.x = hit3.x;
        this.selected.position.z = hit3.z;
        this._updateOutline();
      }
    };
    this._pu = e => { this._dragging = false; };

    this.dom.addEventListener("pointerdown", this._pd);
    this.dom.addEventListener("pointermove", this._pm);
    this.dom.addEventListener("pointerup", this._pu);
    this.dom.addEventListener("pointercancel", this._pu);
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this._badge && this._badge.remove();
    this._bar && this._bar.remove();
    if (this._outline) {
      this.three.remove(this._outline);
      this._outline.geometry && this._outline.geometry.dispose();
      this._outline.material && this._outline.material.dispose();
    }
    this.dom.removeEventListener("pointerdown", this._pd);
    this.dom.removeEventListener("pointermove", this._pm);
    this.dom.removeEventListener("pointerup", this._pu);
    this.dom.removeEventListener("pointercancel", this._pu);
  }

  _pick(cx, cy) {
    const rect = this.dom.getBoundingClientRect();
    this._ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
    this._ndc.y = -((cy - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._ndc, this.camera);
    const list = this._editableList();
    const hits = this._raycaster.intersectObjects(list, true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.editable) o = o.parent;
    return o;
  }

  _rotate(d) {
    if (!this.selected) return;
    this.selected.rotation.y += d;
    this._updateOutline();
  }
  _delete() {
    if (!this.selected) return;
    this.selected.visible = false;
    this.selected.userData.editable = false;
    this._outline.visible = false;
    this.selected = null;
  }
  _updateOutline() {
    if (!this.selected) return;
    this._outline.setFromObject(this.selected);
    this._outline.visible = true;
  }
}

