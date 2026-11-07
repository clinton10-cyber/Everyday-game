/* js/core/race.js — STREET RACE.
   Checkpoint race through the real city road network against 3 AI rivals.
   • 2 tracks (Downtown Sprint · Grand Circuit); first checkpoint = the junction nearest you
   • 3-2-1-GO countdown, false-start penalty, glowing checkpoint ring + beam
   • rivals follow the roads with light rubber-banding, so races stay close
   • prize money by finishing position (paid into the bank)
   Started from the phone → Games → Street Race.  Needs you in a car.        */
import * as THREE from "three";
import { Economy } from "./economy.js";

const J = {
  3: [-85, -25], 4: [5, -35], 5: [95, -5], 6: [175, 45], 7: [270, 75], 8: [320, 160],
  9: [215, 200], 10: [120, 165], 11: [45, 135], 12: [-35, 85], 13: [-95, 35],
  22: [45, -175], 23: [130, -195], 29: [250, -60],
};
export const TRACKS = {
  sprint:  { id: "sprint",  name: "Downtown Sprint", laps: 2, prize: 8000,  pts: [4, 5, 29, 23, 22].map(k => J[k]) },
  circuit: { id: "circuit", name: "Grand Circuit",   laps: 1, prize: 15000, pts: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(k => J[k]) },
};
const RIVALS = [
  { name: "Tunde",  color: 0xe53935, v: 38 }, { name: "Ngozi", color: 0x1e88e5, v: 41 }, { name: "Bayo", color: 0xfdd835, v: 44 },
];
const CP_R = 22;                     /* checkpoint capture radius (m) — roads bow, so be generous */

const $ = (h) => { const d = document.createElement("div"); d.innerHTML = h; return d.firstElementChild; };
const toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} };

function makeCar(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 4.3), new THREE.MeshLambertMaterial({ color }));
  body.position.y = 0.6; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 2.2), new THREE.MeshLambertMaterial({ color: 0x1b2430 }));
  cab.position.set(0, 1.1, -0.2); g.add(cab);
  const wm = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), wm);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.42, z); g.add(w);
  }
  return g;
}

export const Race = {
  active: null,

  start(trackId) {
    if (this.active) { toast("A race is already running"); return false; }
    const D = window.__ph3d_drive, three = window.__ph3d_three;
    if (!D || !three) { toast("Races run in the open city"); return false; }
    if (D.getMode() !== "drive") { toast("🚗 Get in your car to race"); return false; }
    const T = TRACKS[trackId] || TRACKS.sprint;
    const me = D.getPos();
    /* rotate the loop so the first checkpoint is the junction nearest the player */
    let bi = 0, bd = Infinity;
    T.pts.forEach((p, i) => { const d = Math.hypot(p[0] - me.x, p[1] - me.z); if (d < bd) { bd = d; bi = i; } });
    const loop = T.pts.slice(bi).concat(T.pts.slice(0, bi));
    const route = [];                                   /* closed polyline: start(player) → … → back to loop[0] */
    for (let l = 0; l < T.laps; l++) loop.forEach((p) => route.push(p));
    route.push(loop[0]);
    const start = [me.x, me.z];
    const poly = [start].concat(route);
    const seg = [], cum = [0];
    for (let i = 0; i < poly.length - 1; i++) {
      const L = Math.hypot(poly[i + 1][0] - poly[i][0], poly[i + 1][1] - poly[i][1]);
      seg.push(L); cum.push(cum[i] + L);
    }
    const R = this.active = {
      T, poly, seg, cum, total: cum[cum.length - 1], cpIdx: 0, cpTotal: route.length,
      t: 0, phase: "count", count: 3.99, falseStart: false, penalty: 0, quitT: 0, done: false,
      start, rivals: [], ring: null, beam: null, hud: null, finishedRivals: 0,
    };
    /* rivals line up beside the player's car */
    RIVALS.forEach((r, i) => {
      const mesh = makeCar(r.color); three.add(mesh);
      R.rivals.push({ ...r, mesh, s: 0, lane: (i - 1) * 4.2, fin: null, v0: r.v });
    });
    /* checkpoint visuals */
    R.ring = new THREE.Mesh(new THREE.TorusGeometry(7, 0.5, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffd54a, fog: false }));
    R.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 120, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    three.add(R.ring); three.add(R.beam);
    R.hud = $(`<div id="race-hud" style="position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:9000;pointer-events:none;text-align:center;font-family:system-ui,sans-serif;color:#fff;text-shadow:0 2px 6px #000">
        <div id="race-top" style="font-weight:800;font-size:15px;background:rgba(10,12,20,.72);border-radius:12px;padding:6px 14px;display:inline-block"></div>
        <div id="race-big" style="font-weight:900;font-size:72px;line-height:1;margin-top:8px"></div></div>`);
    document.body.appendChild(R.hud);
    R.quit = $(`<button style="position:fixed;top:64px;right:12px;z-index:9001;background:#c62828;color:#fff;border:0;border-radius:10px;padding:8px 12px;font-weight:700">✕ QUIT RACE</button>`);
    R.quit.onclick = () => this.stop(false);
    document.body.appendChild(R.quit);
    this._place(R);
    toast("🏁 " + T.name + " — get ready!");
    return true;
  },

  _at(R, s) {                                           /* point + heading along the polyline at distance s */
    s = Math.max(0, Math.min(R.total, s));
    let i = 0; while (i < R.seg.length - 1 && R.cum[i + 1] < s) i++;
    const a = R.poly[i], b = R.poly[i + 1], L = R.seg[i] || 1, u = (s - R.cum[i]) / L;
    return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, dx: (b[0] - a[0]) / L, dz: (b[1] - a[1]) / L };
  },

  _place(R) {
    const me = window.__ph3d_drive.getPos();
    R.rivals.forEach((r) => {
      const q = this._at(R, r.s);
      const nx = -q.dz, nz = q.dx;
      const lane = r.s < 6 ? r.lane : r.lane * 0.6;
      r.mesh.position.set(q.x + nx * lane + (r.s < 6 ? me.x - R.start[0] : 0), 0, q.z + nz * lane + (r.s < 6 ? me.z - R.start[1] : 0));
      r.mesh.rotation.y = Math.atan2(q.dx, q.dz);
    });
    const tgt = R.poly[Math.min(R.cpIdx + 1, R.poly.length - 1)];
    R.ring.position.set(tgt[0], 7.5, tgt[1]); R.beam.position.set(tgt[0], 60, tgt[1]);
    const prev = R.poly[R.cpIdx];
    R.ring.rotation.y = Math.atan2(tgt[0] - prev[0], tgt[1] - prev[1]);
  },

  _progress(R) {                                        /* player's distance along the route (m) */
    const me = window.__ph3d_drive.getPos(), i = R.cpIdx, a = R.poly[i], b = R.poly[i + 1] || a;
    const toNext = Math.hypot(b[0] - me.x, b[1] - me.z);
    return R.cum[i] + Math.max(0, Math.min(R.seg[i] || 0, (R.seg[i] || 0) - toNext));
  },

  tick(dt) {
    const R = this.active; if (!R || R.done) return;
    const D = window.__ph3d_drive; if (!D) return;
    const top = document.getElementById("race-top"), big = document.getElementById("race-big");
    const inCar = D.getMode() === "drive";
    if (!inCar) {                                       /* walked away from the car */
      R.quitT += dt; if (big) big.textContent = "";
      if (top) top.textContent = "🚗 Return to your car! " + Math.ceil(20 - R.quitT) + "s";
      if (R.quitT > 20) this.stop(false);
      return;
    }
    R.quitT = 0;
    const me = D.getPos();

    if (R.phase === "count") {
      R.count -= dt;
      const n = Math.ceil(R.count);
      if (big) big.textContent = n > 0 ? String(n) : "GO!";
      if (top) top.textContent = R.T.name.toUpperCase();
      /* false start: rolled > 8 m before GO */
      if (!R.falseStart && n > 0 && Math.hypot(me.x - R.start[0], me.z - R.start[1]) > 8) {
        R.falseStart = true; R.penalty = 3; toast("⚠️ FALSE START  +3s");
      }
      if (R.count <= 0) { R.phase = "race"; R.t = 0; setTimeout(() => { if (big) big.textContent = ""; }, 700); }
      this._place(R);
      return;
    }

    R.t += dt;
    /* rivals — rubber-band toward the player so the race stays close */
    const mine = this._progress(R);
    R.rivals.forEach((r) => {
      if (r.fin != null) { r.s = Math.min(R.total, r.s + 20 * dt); return; }
      const gap = mine - r.s;
      const rb = Math.max(-0.10, Math.min(0.20, gap / 400));
      r.s += r.v0 * (1 + rb) * dt;
      if (r.s >= R.total) { r.s = R.total; r.fin = R.t; R.finishedRivals++; }
    });
    this._place(R);

    /* checkpoints */
    const tgt = R.poly[R.cpIdx + 1];
    if (tgt && Math.hypot(tgt[0] - me.x, tgt[1] - me.z) < CP_R) {
      R.cpIdx++;
      try { window.__ph3d_sfx && window.__ph3d_sfx.play("ui_tap"); } catch (e) {}
      if (R.cpIdx >= R.cpTotal) { this._finish(R); return; }
      toast("✅ Checkpoint " + R.cpIdx + "/" + R.cpTotal);
    }

    /* live position */
    let ahead = 0; R.rivals.forEach((r) => { if (r.s > mine) ahead++; });
    const pos = ahead + 1;
    const dist = tgt ? Math.round(Math.hypot(tgt[0] - me.x, tgt[1] - me.z)) : 0;
    const tm = (R.t + R.penalty).toFixed(1);
    if (top) top.textContent = "P" + pos + "/4 · CP " + Math.min(R.cpIdx + 1, R.cpTotal) + "/" + R.cpTotal + " · " + dist + " m · ⏱ " + tm + "s";
  },

  _finish(R) {
    R.done = true;
    const place = R.finishedRivals + 1;
    const pay = [1, 0.5, 0.25, 0][place - 1] * R.T.prize;
    const total = (R.t + R.penalty).toFixed(1);
    if (pay > 0) { try { Economy.receive("Street Race", pay, R.T.name + " · P" + place); } catch (e) {} }
    const medal = ["🥇", "🥈", "🥉", "🏁"][place - 1];
    const big = document.getElementById("race-big"), top = document.getElementById("race-top");
    if (big) big.textContent = medal + " P" + place;
    if (top) top.textContent = "FINISH · " + total + "s" + (pay ? " · +₦" + pay.toLocaleString() : "");
    toast(medal + " Finished P" + place + (pay ? " — won ₦" + pay.toLocaleString() : ""));
    setTimeout(() => this.stop(true), 5200);
  },

  stop(finished) {
    const R = this.active; if (!R) return;
    this.active = null;
    try { const three = window.__ph3d_three; R.rivals.forEach(r => three && three.remove(r.mesh)); three && three.remove(R.ring); three && three.remove(R.beam); } catch (e) {}
    try { R.hud.remove(); R.quit.remove(); } catch (e) {}
    if (!finished) toast("Race cancelled");
  },
};
if (typeof window !== "undefined") window.__ph3d_race = Race;
