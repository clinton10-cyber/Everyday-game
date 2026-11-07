/* photos.js -- camera capture + persistent album.

   captureFrame()                     : current game-canvas screenshot
   captureSelfie(poseName)            : camera is mounted on a SELFIE STICK held in the player's
                                        right hand (~1.4m out); the chosen pose is applied on the
                                        free left arm. FRONT-CAMERA FRAMING: everyone standing near
                                        the player (spouse, kids, friends, wedding guests) is pulled
                                        into the shot and turned to face the lens.
   captureShot(pos, look, fov)        : free-camera photo (wedding photographer, date photos…)

   ALBUM — every photo is stored as a 3D-positioned image OBJECT, not a flat UI row:
     { id, url, caption, ts, tag, who[], where, obj3d:{ x,y,z, rx,ry,rz, s }, pinned }
   obj3d is the photo's place/rotation/scale in the 3D album room (core/photo3d.js), so a
   photo you rotate / move / zoom stays that way. The album is saved in IndexedDB (falls back
   to localStorage thumbnails, then memory) and restored on the next visit. */
import { SELFIE_POSES } from "./thirdperson.js";
import * as THREE from "three";
import { setSelfieStick } from "../characters/lowpoly.js";

const DB_NAME = "ph3d_album_v1", STORE = "photos", MAX_PHOTOS = 150;

/* default spot in the curved album wall for slot n (arc of 9 per row, rows stack upward) */
export function defaultObj3d(n) {
  const per = 9, row = Math.floor(n / per), col = n % per;
  const a = (col - (per - 1) / 2) * 0.36;                 /* radians around the room */
  const R = 5.2;
  return { x: Math.sin(a) * R, y: 1.55 + row * 1.35, z: -Math.cos(a) * R + 5.2, rx: 0, ry: -a, rz: 0, s: 1 };
}

let _db = null, _dbTried = false;
function openDB() {
  if (_db) return Promise.resolve(_db);
  if (_dbTried) return Promise.resolve(null);
  _dbTried = true;
  return new Promise((res) => {
    try {
      const rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = () => { try { rq.result.createObjectStore(STORE, { keyPath: "id" }); } catch (e) {} };
      rq.onsuccess = () => { _db = rq.result; res(_db); };
      rq.onerror = () => res(null);
      rq.onblocked = () => res(null);
    } catch (e) { res(null); }
  });
}
function dbAll() {
  return openDB().then((db) => !db ? null : new Promise((res) => {
    try { const rq = db.transaction(STORE, "readonly").objectStore(STORE).getAll(); rq.onsuccess = () => res(rq.result || []); rq.onerror = () => res(null); } catch (e) { res(null); }
  }));
}
function dbPut(rec) { return openDB().then((db) => { if (!db) return; try { db.transaction(STORE, "readwrite").objectStore(STORE).put(rec); } catch (e) {} }); }
function dbDel(id) { return openDB().then((db) => { if (!db) return; try { db.transaction(STORE, "readwrite").objectStore(STORE).delete(id); } catch (e) {} }); }
function dbClear() { return openDB().then((db) => { if (!db) return; try { db.transaction(STORE, "readwrite").objectStore(STORE).clear(); } catch (e) {} }); }

export const Photos = {
  list: [],
  _subs: new Set(),
  _loaded: false,
  _loading: null,

  /* restore the saved album (idempotent). */
  load() {
    if (this._loading) return this._loading;
    this._loading = dbAll().then((rows) => {
      if (rows && rows.length) {
        const have = new Set(this.list.map((p) => p.id));
        for (const r of rows) if (!have.has(r.id)) this.list.push(r);
        this.list.sort((a, b) => b.ts - a.ts);
        if (this.list.length > MAX_PHOTOS) this.list.length = MAX_PHOTOS;
      }
      this._loaded = true; this._emit();
      return this.list;
    });
    return this._loading;
  },

  /* meta: { tag:"wedding|date|selfie|photo|family", who:[names], where } — auto-filled from the life-sim when omitted */
  add(dataUrl, caption, meta) {
    let m = meta;
    if (!m) { try { const L = window.__ph3d_lifesim; m = L && L.photoMeta ? L.photoMeta() : null; } catch (e) {} }
    m = m || {};
    const p = {
      id: "p_" + Date.now() + "_" + Math.floor(Math.random() * 1e6),
      url: dataUrl,
      caption: caption || m.caption || "",
      ts: Date.now(),
      tag: m.tag || "photo",
      who: m.who || [],
      where: m.where || "",
      obj3d: null,
      pinned: false,
    };
    /* every new photo takes the next free slot in the 3D album wall */
    p.obj3d = defaultObj3d(this.list.length);
    this.list.unshift(p);
    if (this.list.length > MAX_PHOTOS) { const old = this.list.splice(MAX_PHOTOS); old.forEach((o) => dbDel(o.id)); }
    dbPut(p);
    this._emit();
    try { window.dispatchEvent(new CustomEvent("ph3d:photo", { detail: p })); } catch (e) {}
    return p;
  },
  get(id) { return this.list.find((p) => p.id === id) || null; },
  /* change a photo's 3D transform / caption / pin and persist it */
  update(id, patch) {
    const p = this.get(id); if (!p) return null;
    if (patch.obj3d) p.obj3d = Object.assign({}, p.obj3d || defaultObj3d(0), patch.obj3d);
    for (const k of ["caption", "pinned", "tag"]) if (patch[k] !== undefined) p[k] = patch[k];
    dbPut(p); this._emit();
    return p;
  },
  pinned() { return this.list.filter((p) => p.pinned); },
  remove(id) {
    this.list = this.list.filter((p) => p.id !== id);
    dbDel(id);
    this._emit();
  },
  clear() { this.list = []; dbClear(); this._emit(); },
  onChange(fn) { this._subs.add(fn); return () => this._subs.delete(fn); },
  _emit() { for (const fn of this._subs) { try { fn(this.list); } catch (e) {} } },
};
try { Photos.load(); } catch (e) {}
try { window.__ph3d_photos = Photos; } catch (e) {}

function grabCanvas(router) {
  const canvas = router.renderer.domElement;
  const MAX = 720;
  const scale = Math.min(1, MAX / canvas.width);
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  try {
    ctx.drawImage(canvas, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.72);
  } catch (e) { return null; }
}

export function captureFrame() {
  const router = window.__ph3d_router;
  if (!router || !router.renderer) return null;
  return grabCanvas(router);
}

/* Free-camera photo from an arbitrary viewpoint (wedding photographer, date photos). */
export function captureShot(pos, look, fov) {
  const router = window.__ph3d_router;
  if (!router || !router.renderer || !router.current) return null;
  const scene = router.current.three, camera = router.current.camera;
  if (!scene || !camera) return null;
  const sp = camera.position.clone(), sq = camera.quaternion.clone(), sf = camera.fov;
  camera.position.set(pos.x, pos.y, pos.z);
  camera.lookAt(look.x, look.y, look.z);
  camera.fov = fov || 55; camera.updateProjectionMatrix();
  router.renderer.render(scene, camera);
  const url = grabCanvas(router);
  camera.position.copy(sp); camera.quaternion.copy(sq); camera.fov = sf; camera.updateProjectionMatrix();
  router.renderer.render(scene, camera);
  return url;
}

function snapRig(rig) {
  if (!rig) return null;
  const snap = { joints: [] };
  const add = (j) => { if (j && j.rotation) snap.joints.push({ j, r: j.rotation.clone() }); };
  add(rig.hips); add(rig.spine); add(rig.neck); add(rig.head);
  if (rig.legL) { add(rig.legL.hip); add(rig.legL.knee); add(rig.legL.ankle); }
  if (rig.legR) { add(rig.legR.hip); add(rig.legR.knee); add(rig.legR.ankle); }
  if (rig.armL) { add(rig.armL.shoulder); add(rig.armL.elbow); add(rig.armL.wrist); }
  if (rig.armR) { add(rig.armR.shoulder); add(rig.armR.elbow); add(rig.armR.wrist); }
  if (rig.hips) snap.hipsY = rig.hips.position.y;
  return snap;
}
function restoreRig(rig, snap) {
  if (!rig || !snap) return;
  for (const { j, r } of snap.joints) j.rotation.copy(r);
  if (rig.hips && snap.hipsY != null) rig.hips.position.y = snap.hipsY;
}

function findSelfieSubject() {
  const tp = window.__ph3d_tp;
  if (tp && tp.pos && tp.avatar) return tp;

  const drive = window.__ph3d_drive;
  if (drive && drive.getWalkState) {
    const ws = drive.getWalkState();
    if (ws && ws.character && ws.walker) {
      return {
        pos: { x: ws.walker.x, z: ws.walker.z },
        floorY: ws.walker.y || 0,
        yaw: ws.walker.yaw || 0,
        avatar: ws.character,
        rig: ws.charRig,
      };
    }
  }
  return null;
}

/* people close to the player who should be in the selfie */
function nearbyGroup(px, pz, radius) {
  try {
    const L = window.__ph3d_lifesim;
    if (L && L.nearbyActors) return (L.nearbyActors(px, pz, radius) || []).filter((a) => a && a.group && a.group.visible !== false);
  } catch (e) {}
  return [];
}

export function captureSelfie(poseName) {
  const router = window.__ph3d_router;
  if (!router || !router.renderer || !router.current) return null;
  const scene = router.current.three;
  const camera = router.current.camera;
  if (!scene || !camera) return null;

  const subject = findSelfieSubject();
  if (!subject || !subject.avatar || !subject.rig) return null;

  const px = subject.pos.x;
  const py = subject.floorY || 0;
  const pz = subject.pos.z;
  const pyaw = subject.yaw || 0;
  const avatar = subject.avatar;
  const rig = subject.rig;

  /* Save camera + avatar visibility + rig pose. */
  const savedCamPos = camera.position.clone();
  const savedCamQuat = camera.quaternion.clone();
  const savedFov = camera.fov;
  const savedVisible = avatar.visible;
  const rigSnap = snapRig(rig);
  avatar.visible = true;

  /* Apply the chosen pose on the free (left) arm — right arm holds phone. */
  if (poseName && SELFIE_POSES[poseName]) {
    try { SELFIE_POSES[poseName].apply(rig); } catch (e) {}
  }

  /* Right arm pushes a SELFIE STICK out in front; the camera is the phone
     clamped on its far end, so the shot is taken from arm + pole length away
     (about 1.4 m) — the classic wide selfie-stick framing. */
  const stickWasOn = rig.armR && rig.armR._stickMesh ? rig.armR._stickMesh.visible : false;
  const phoneWasOn = rig.armR && rig.armR._phoneMesh ? rig.armR._phoneMesh.visible : false;
  const carryWas = rig._carryPose;
  if (rig.armR) {
    rig.armR.shoulder.rotation.set(-1.42, 0.10, -0.20);
    rig.armR.elbow.rotation.set(-0.28, 0, 0);
    if (rig.armR.wrist) rig.armR.wrist.rotation.set(0, 0, 0);
    if (rig.armR._phoneMesh) rig.armR._phoneMesh.visible = false;
    try { setSelfieStick(rig, true); } catch (e) {}
  }

  /* Mount the camera on the stick's tip (world position after posing). */
  avatar.updateMatrixWorld(true);
  const eye = new THREE.Vector3(px, py + 1.52, pz);
  if (rig.head) rig.head.getWorldPosition(eye);
  const cam = new THREE.Vector3();
  const tip = rig.armR && rig.armR._stickTip;
  if (tip) tip.getWorldPosition(cam);
  else cam.set(px + Math.sin(pyaw) * 1.3, py + 1.7, pz + Math.cos(pyaw) * 1.3);

  /* ── group selfie: pull nearby people into frame and turn them to the lens ── */
  const group = nearbyGroup(px, pz, 3.4);
  const restore = [];
  const who = [];
  let fov = 62;
  let aim = new THREE.Vector3(eye.x, eye.y - 0.12, eye.z);
  if (group.length) {
    const pts = [eye.clone()];
    for (const a of group.slice(0, 7)) {
      const g = a.group;
      const hp = new THREE.Vector3(g.position.x, (g.position.y || 0) + 1.45 * (a.scale || 1), g.position.z);
      pts.push(hp);
      if (a.name) who.push(a.name);
    }
    const c = new THREE.Vector3();
    pts.forEach((v) => c.add(v)); c.multiplyScalar(1 / pts.length);
    let rad = 0.5; pts.forEach((v) => { rad = Math.max(rad, v.distanceTo(c)); });
    /* camera stays on the stick's side of the group, pulled back so everyone fits */
    const dir = new THREE.Vector3(cam.x - c.x, 0, cam.z - c.z);
    if (dir.lengthSq() < 0.01) dir.set(Math.sin(pyaw), 0, Math.cos(pyaw));
    dir.normalize();
    const back = Math.max(1.4, rad * 2.1 + 1.0);
    cam.set(c.x + dir.x * back, Math.max(c.y + 0.12, py + 1.45), c.z + dir.z * back);
    aim = new THREE.Vector3(c.x, c.y - 0.1, c.z);
    fov = Math.min(80, 62 + rad * 6);
    for (const a of group.slice(0, 7)) {                  /* everyone faces the lens */
      const g = a.group; restore.push([g, g.rotation.y]);
      g.rotation.y = Math.atan2(cam.x - g.position.x, cam.z - g.position.z);
    }
    restore.push([avatar, avatar.rotation.y]);
    avatar.rotation.y = Math.atan2(cam.x - avatar.position.x, cam.z - avatar.position.z);
  }

  camera.position.copy(cam);
  camera.lookAt(aim.x, aim.y, aim.z);                    /* frame head + shoulders, face centred */
  camera.fov = fov;
  camera.updateProjectionMatrix();

  router.renderer.render(scene, camera);
  const url = grabCanvas(router);

  /* Restore. */
  camera.position.copy(savedCamPos);
  camera.quaternion.copy(savedCamQuat);
  camera.fov = savedFov;
  camera.updateProjectionMatrix();
  avatar.visible = savedVisible;
  restore.forEach(([o, y]) => { o.rotation.y = y; });
  restoreRig(rig, rigSnap);
  rig._carryPose = carryWas;
  if (rig.armR) {
    try { setSelfieStick(rig, stickWasOn); } catch (e) {}
    if (rig.armR._phoneMesh) rig.armR._phoneMesh.visible = phoneWasOn;
  }
  try { window.__ph3d_lastSelfieWho = who; } catch (e) {}

  /* Re-render the normal view so the next visible frame is correct. */
  router.renderer.render(scene, camera);

  return url;
}
