/* js/core/football.js — 3v3 STREET FOOTBALL on a real pitch in the open world.
   • A full pitch (lines, centre circle, boxes, goals with nets, side boards) sits west of the city
     at PITCH.x / PITCH.z — change those two numbers to move it.
   • The ball is real physics: gravity, bounce, rolling drag, boards, goal frames.  Run into it to
     dribble, press ⚽ SHOOT (or G) near it to strike it where you're facing.
   • Phone → Games → Football starts a 2-minute match: you + 1 AI teammate + keeper vs 2 AI strikers + keeper.
     AI chase, tackle, shoot, and the keepers dive.  Win = prize money.  You can also just kick about for fun. */
import * as THREE from "three";
import { Economy } from "./economy.js";

export const PITCH = { x: -520, z: 120, L: 64, W: 40, goalW: 7.4, goalH: 2.5 };
const MATCH_SECONDS = 120;
const G = -22, BALL_R = 0.26;

const toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} };
const mk = (h) => { const d = document.createElement("div"); d.innerHTML = h; return d.firstElementChild; };

function kitPlayer(shirt, shorts, skin) {
  const g = new THREE.Group();
  const M = (c) => new THREE.MeshLambertMaterial({ color: c });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.30), M(shirt)); torso.position.y = 1.25; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), M(skin)); head.position.y = 1.77; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.155, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(0x1a1410)); hair.position.y = 1.79; g.add(hair);
  const sh = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.22, 0.30), M(shorts)); sh.position.y = 0.88; g.add(sh);
  g.legs = [];
  for (const x of [-0.13, 0.13]) {
    const p = new THREE.Group(); p.position.set(x, 0.86, 0); g.add(p);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.8, 0.18), M(skin)); leg.position.y = -0.4; p.add(leg);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.1, 0.28), M(0x111111)); boot.position.set(0, -0.8, 0.04); p.add(boot);
    g.legs.push(p);
  }
  g.arms = [];
  for (const x of [-0.34, 0.34]) {
    const p = new THREE.Group(); p.position.set(x, 1.5, 0); g.add(p);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.55, 0.14), M(skin)); arm.position.y = -0.27; p.add(arm);
    g.arms.push(p);
  }
  return g;
}

export const Football = {
  group: null, ball: null, state: null, hud: null, shootBtn: null, _keyHandler: null, _cd: 0,

  /* build the pitch once per drive-scene mount */
  mount(three) {
    this.unmount();
    const P = PITCH, g = this.group = new THREE.Group();
    g.position.set(P.x, 0, P.z); three.add(g);
    const m = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
    const add = (geo, mat, x, y, z, rx) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); if (rx) o.rotation.x = rx; g.add(o); return o; };
    add(new THREE.BoxGeometry(P.W + 14, 0.1, P.L + 14), m(0x2d5a2a), 0, 0.03, 0);                 /* surround */
    for (let i = 0; i < 8; i++)                                                                      /* mown stripes */
      add(new THREE.BoxGeometry(P.W, 0.06, P.L / 8), m(i % 2 ? 0x3f9a3c : 0x37873a), 0, 0.1, -P.L / 2 + (i + 0.5) * P.L / 8);
    const line = (w, d, x, z) => add(new THREE.BoxGeometry(w, 0.03, d), m(0xffffff), x, 0.14, z);
    line(P.W, 0.18, 0, P.L / 2); line(P.W, 0.18, 0, -P.L / 2); line(0.18, P.L, P.W / 2, 0); line(0.18, P.L, -P.W / 2, 0); line(P.W, 0.18, 0, 0);
    const circ = add(new THREE.RingGeometry(4.4, 4.6, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), 0, 0.15, 0, -Math.PI / 2);
    for (const s of [-1, 1]) {                                                                       /* boxes + goals */
      const z = s * P.L / 2;
      line(16, 0.18, 0, z - s * 9); line(0.18, 9, -8, z - s * 4.5); line(0.18, 9, 8, z - s * 4.5);
      line(7.4, 0.18, 0, z - s * 3); line(0.18, 3, -3.7, z - s * 1.5); line(0.18, 3, 3.7, z - s * 1.5);
      const post = m(0xffffff), net = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, wireframe: true });
      add(new THREE.BoxGeometry(0.14, P.goalH, 0.14), post, -P.goalW / 2, P.goalH / 2, z);
      add(new THREE.BoxGeometry(0.14, P.goalH, 0.14), post, P.goalW / 2, P.goalH / 2, z);
      add(new THREE.BoxGeometry(P.goalW, 0.14, 0.14), post, 0, P.goalH, z);
      add(new THREE.BoxGeometry(P.goalW, P.goalH, 2.2), net, 0, P.goalH / 2, z + s * 1.1);
    }
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.4, 1.1, P.L + 2), m(0x1d3b6e), sx * (P.W / 2 + 1.3), 0.55, 0);    /* side boards */
    for (const sz of [-1, 1]) {                                                                      /* end boards beside goals */
      const side = (P.W - P.goalW) / 2 - 0.3;
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(side, 1.1, 0.4), m(0x1d3b6e), sx * (P.goalW / 2 + side / 2 + 0.3), 0.55, sz * (P.L / 2 + 1.3));
    }
    const sign = document.createElement("canvas"); sign.width = 512; sign.height = 128;
    const c2 = sign.getContext("2d"); c2.fillStyle = "#0e2a54"; c2.fillRect(0, 0, 512, 128);
    c2.fillStyle = "#ffd54a"; c2.font = "bold 64px sans-serif"; c2.textAlign = "center"; c2.fillText("⚽ EKO PITCH", 256, 88);
    const st = new THREE.CanvasTexture(sign); st.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: st })); board.position.set(0, 4, -P.L / 2 - 4); board.rotation.y = 0; g.add(board);
    cylinderMast(g, -P.W / 2 - 3, -P.L / 2 - 3); cylinderMast(g, P.W / 2 + 3, -P.L / 2 - 3);

    /* ball */
    const geo = new THREE.IcosahedronGeometry(BALL_R, 1);
    const col = new Float32Array(geo.attributes.position.count * 3);
    for (let f = 0; f < col.length / 9; f++) { const c = f % 3 === 0 ? 0.1 : 0.97; for (let k = 0; k < 9; k++) col[f * 9 + k] = c; }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const ball = this.ball = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    ball.userData = { vx: 0, vy: 0, vz: 0, grounded: true };
    three.add(ball);
    this._reset();
    this._three = three;
    this._bindKey();
  },

  unmount() {
    this.stop(true);
    try { if (this.group && this.group.parent) this.group.parent.remove(this.group); } catch (e) {}
    try { if (this.ball && this.ball.parent) this.ball.parent.remove(this.ball); } catch (e) {}
    try { document.removeEventListener("keydown", this._keyHandler); } catch (e) {}
    this.group = this.ball = null;
  },

  _bindKey() {
    this._keyHandler = (e) => { if (e.code === "KeyG") this.shoot(); };
    document.addEventListener("keydown", this._keyHandler);
  },

  _reset() {
    const b = this.ball; if (!b) return;
    b.position.set(PITCH.x, BALL_R, PITCH.z);
    Object.assign(b.userData, { vx: 0, vy: 0, vz: 0, grounded: true });
  },

  _walker() { const D = window.__ph3d_drive; const w = D && D.getWalkState && D.getWalkState(); return w ? w.walker : null; },

  /* ── match ───────────────────────────────────────────────── */
  start() {
    if (!this.group) { toast("Football runs in the open city"); return false; }
    if (this.state) { toast("Match already running"); return false; }
    const D = window.__ph3d_drive;
    if (D && D.getMode && D.getMode() !== "walk") { toast("🚶 Step out of your car first"); return false; }
    const w = this._walker(); if (!w) { toast("Football runs in the open city"); return false; }
    const P = PITCH;
    const mkAgent = (team, role, shirt, shorts, skin, x, z) => {
      const mesh = kitPlayer(shirt, shorts, skin); mesh.position.set(P.x + x, 0, P.z + z); this._three.add(mesh);
      return { team, role, mesh, x: P.x + x, z: P.z + z, hx: P.x + x, hz: P.z + z, vx: 0, vz: 0, cd: 0, speed: role === "keeper" ? 5.4 : (team === 0 ? 5.2 : 4.5) };
    };
    const S = this.state = {
      t: MATCH_SECONDS, you: 0, cpu: 0, over: false, pause: 0,
      agents: [
        mkAgent(0, "keeper", 0x2e7d32, 0xffffff, 0xc68642, 0, -P.L / 2 + 2),      /* your keeper */
        mkAgent(0, "striker", 0x2e7d32, 0xffffff, 0x8d5524, 5, -6),               /* your teammate */
        mkAgent(1, "keeper", 0xf9a825, 0x222222, 0xe0ac69, 0, P.L / 2 - 2),       /* their keeper */
        mkAgent(1, "striker", 0xc62828, 0x222222, 0xc68642, -6, 8),
        mkAgent(1, "striker", 0xc62828, 0x222222, 0x8d5524, 7, 12),
      ],
    };
    /* teleport you to the pitch and kick off */
    w.x = P.x; w.z = P.z - 5; w.y = 0; w.yaw = 0;
    this._reset();
    this._buildHud();
    toast("⚽ Kick-off! Attack the far goal · SHOOT (G)");
    return true;
  },

  _buildHud() {
    this.hud = mk(`<div style="position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:9000;pointer-events:none;font-family:system-ui,sans-serif;text-align:center;color:#fff;text-shadow:0 2px 6px #000">
      <div id="fb-score" style="font-weight:900;font-size:22px;background:rgba(10,12,20,.78);border-radius:14px;padding:6px 18px;display:inline-block"></div>
      <div id="fb-msg" style="font-weight:900;font-size:56px;line-height:1.1;margin-top:6px"></div></div>`);
    document.body.appendChild(this.hud);
    this.shootBtn = mk(`<button style="position:fixed;right:18px;bottom:200px;z-index:9001;width:84px;height:84px;border-radius:50%;border:3px solid #fff;background:#1b8f3a;color:#fff;font-weight:900;font-size:13px;box-shadow:0 4px 14px #0008;touch-action:none">⚽<br>SHOOT</button>`);
    this.shootBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); this.shoot(); }, { passive: false });
    document.body.appendChild(this.shootBtn);
    this.quitBtn = mk(`<button style="position:fixed;top:64px;right:12px;z-index:9001;background:#c62828;color:#fff;border:0;border-radius:10px;padding:8px 12px;font-weight:700">✕ END MATCH</button>`);
    this.quitBtn.onclick = () => this.stop(false);
    document.body.appendChild(this.quitBtn);
  },

  stop(silent) {
    const S = this.state; if (!S) return;
    this.state = null;
    try { S.agents.forEach(a => a.mesh.parent && a.mesh.parent.remove(a.mesh)); } catch (e) {}
    try { this.hud && this.hud.remove(); this.shootBtn && this.shootBtn.remove(); this.quitBtn && this.quitBtn.remove(); } catch (e) {}
    this.hud = this.shootBtn = this.quitBtn = null;
    if (!silent) toast("Match ended");
  },

  /* player strikes the ball in the direction they face (aim-assist toward goal) */
  shoot() {
    const w = this._walker(), b = this.ball; if (!w || !b) return;
    const dx = b.position.x - w.x, dz = b.position.z - w.z, d = Math.hypot(dx, dz);
    if (d > 2.4 || b.position.y > 1.6) return;
    let ax = Math.sin(w.yaw), az = Math.cos(w.yaw);
    const P = PITCH, goalZ = P.z + P.L / 2;
    /* gentle assist: if roughly facing the far goal, bend the shot toward the corner away from the keeper */
    const gx = P.x + (this.state ? (this._keeperX() > P.x ? -2.6 : 2.6) : 0), gz = goalZ;
    const tx = gx - b.position.x, tz = gz - b.position.z, tl = Math.hypot(tx, tz) || 1;
    if (this.state && (ax * tx + az * tz) / tl > 0.82) { ax = ax * 0.4 + (tx / tl) * 0.6; az = az * 0.4 + (tz / tl) * 0.6; const l = Math.hypot(ax, az); ax /= l; az /= l; }
    const u = b.userData;
    u.vx = ax * 25; u.vz = az * 25; u.vy = 4.6; u.grounded = false;
    this._cd = 0.25; this._lastTouch = 0;
    try { window.__ph3d_sfx && window.__ph3d_sfx.play("punch_impact", { vol: 0.5 }); } catch (e) {}
  },

  _keeperX() { const k = this.state && this.state.agents.find(a => a.team === 1 && a.role === "keeper"); return k ? k.x : PITCH.x; },

  _kick(u, dirX, dirZ, speed, lift) { u.vx = dirX * speed; u.vz = dirZ * speed; u.vy = lift; u.grounded = false; },

  tick(dt) {
    const b = this.ball; if (!b) return;
    dt = Math.min(dt, 0.05);
    this._cd = Math.max(0, this._cd - dt);
    const w = this._walker(), P = PITCH, u = b.userData, S = this.state;

    /* ── ball physics ── */
    u.vy += G * dt;
    b.position.x += u.vx * dt; b.position.y += u.vy * dt; b.position.z += u.vz * dt;
    if (b.position.y <= BALL_R) {
      b.position.y = BALL_R;
      if (u.vy < -2.2) { u.vy = -u.vy * 0.55; } else { u.vy = 0; u.grounded = true; }
      u.vx *= 0.985; u.vz *= 0.985;
    }
    const drag = u.grounded ? Math.exp(-0.75 * dt) : Math.exp(-0.12 * dt);
    u.vx *= drag; u.vz *= drag;
    const lx = b.position.x - P.x, lz = b.position.z - P.z;
    const halfW = P.W / 2 + 1.0, halfL = P.L / 2;
    /* side boards */
    if (lx > halfW) { b.position.x = P.x + halfW; u.vx = -Math.abs(u.vx) * 0.7; }
    if (lx < -halfW) { b.position.x = P.x - halfW; u.vx = Math.abs(u.vx) * 0.7; }
    /* goal line: goal if between posts and under the bar, otherwise bounce off end boards */
    const inGoalMouth = Math.abs(lx) < P.goalW / 2 - 0.1 && b.position.y < P.goalH;
    for (const s of [-1, 1]) {
      if (s * lz > halfL) {
        if (inGoalMouth) {
          if (s * lz > halfL + 2.0) { b.position.z = P.z + s * (halfL + 2.0); u.vz = 0; u.vx *= 0.3; }   /* back of the net */
          if (S && !S.over && S.pause <= 0) this._goal(s > 0 ? "you" : "cpu");
        } else if (s * lz > halfL + 1.0) { b.position.z = P.z + s * (halfL + 1.0); u.vz = -s * Math.abs(u.vz) * 0.65; }
        else if (!inGoalMouth && Math.abs(lx) < P.goalW / 2 + 0.2 && b.position.y < P.goalH + 0.2 && Math.abs(Math.abs(lx) - P.goalW / 2) < 0.22) { u.vz *= -0.5; }  /* post */
      }
    }
    b.rotation.x += u.vz * dt * 2.2; b.rotation.z -= u.vx * dt * 2.2;

    /* ── you dribble the ball ── */
    if (w && this._cd <= 0) {
      const dx = b.position.x - w.x, dz = b.position.z - w.z, d = Math.hypot(dx, dz);
      if (d < 0.95 && b.position.y < 1.0) {
        const sp = Math.max(w._intentSpeed || 0, 2.2), nx = dx / (d || 1), nz = dz / (d || 1);
        this._kick(u, nx, nz, sp * 1.18 + 2.2, 0.8); this._cd = 0.16;
      }
    }

    if (!S) return;
    if (S.pause > 0) { S.pause -= dt; if (S.pause <= 0) { this._kickoff(); } }
    if (!S.over) {
      if (S.pause <= 0) S.t -= dt;
      if (S.t <= 0) return this._end();
      this._agents(dt, w);
    }
    const el = document.getElementById("fb-score");
    if (el) { const t = Math.max(0, Math.ceil(S.t)); el.textContent = "YOU " + S.you + " – " + S.cpu + " CPU   ⏱ " + Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); }
  },

  _goal(who) {
    const S = this.state; if (!S) return;
    if (who === "you") S.you++; else S.cpu++;
    S.pause = 2.6;
    const m = document.getElementById("fb-msg"); if (m) m.textContent = who === "you" ? "GOAL! ⚽" : "THEY SCORE";
    try { window.__ph3d_sfx && window.__ph3d_sfx.play(who === "you" ? "crowd_cheer" : "ui_error", { vol: 0.7 }); } catch (e) {}
    setTimeout(() => { const mm = document.getElementById("fb-msg"); if (mm) mm.textContent = ""; }, 2300);
  },

  _kickoff() {
    const S = this.state, P = PITCH, w = this._walker(); if (!S) return;
    this._reset();
    S.agents.forEach(a => { a.x = a.hx; a.z = a.hz; a.vx = a.vz = 0; });
    if (w) { w.x = P.x; w.z = P.z - 5; w.yaw = 0; }
  },

  _agents(dt, w) {
    const S = this.state, P = PITCH, b = this.ball, u = b.userData, t = performance.now() / 1000;
    for (const a of S.agents) {
      a.cd = Math.max(0, a.cd - dt);
      const goalDir = a.team === 0 ? 1 : -1;                  /* +z = north (the goal YOU attack) */
      let tx, tz, sp = a.speed;
      if (a.role === "keeper") {
        const homeZ = P.z + (a.team === 0 ? -1 : 1) * (P.L / 2 - 1.8);
        const threat = Math.sign(b.position.z - P.z) === (a.team === 0 ? -1 : 1) && Math.abs(b.position.z - homeZ) < 16;
        tx = Math.max(P.x - 3.2, Math.min(P.x + 3.2, b.position.x));
        tz = threat && Math.abs(b.position.z - homeZ) < 7 ? homeZ + (a.team === 0 ? 1 : -1) * Math.min(3, 7 - Math.abs(b.position.z - homeZ)) : homeZ;
        sp = a.speed * (threat ? 1.25 : 0.8);
      } else {
        /* chase the ball unless a teammate is clearly closer */
        const mates = S.agents.filter(o => o.team === a.team && o.role === "striker");
        let nearest = a, nd = Infinity;
        for (const o of mates) { const d = Math.hypot(o.x - b.position.x, o.z - b.position.z); if (d < nd) { nd = d; nearest = o; } }
        const meD = a.team === 0 && w ? Math.hypot(w.x - b.position.x, w.z - b.position.z) : Infinity;
        if (nearest === a && !(a.team === 0 && meD < nd * 0.8)) { tx = b.position.x + u.vx * 0.25; tz = b.position.z + u.vz * 0.25; }
        else { tx = P.x + (a === mates[0] ? -8 : 8); tz = b.position.z - goalDir * 7; }       /* hold shape */
      }
      const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
      if (d > 0.25) { a.vx = dx / d * Math.min(sp, d * 6); a.vz = dz / d * Math.min(sp, d * 6); } else { a.vx = a.vz = 0; }
      a.x += a.vx * dt; a.z += a.vz * dt;
      /* stay on the pitch + don't stack on each other */
      a.x = Math.max(P.x - P.W / 2, Math.min(P.x + P.W / 2, a.x)); a.z = Math.max(P.z - P.L / 2, Math.min(P.z + P.L / 2, a.z));
      for (const o of S.agents) if (o !== a) { const ox = a.x - o.x, oz = a.z - o.z, od = Math.hypot(ox, oz); if (od < 1.0 && od > 0.001) { a.x += ox / od * (1.0 - od) * 0.5; a.z += oz / od * (1.0 - od) * 0.5; } }

      /* touching the ball */
      const bd = Math.hypot(b.position.x - a.x, b.position.z - a.z);
      if (a.role === "keeper") {
        if (bd < 1.5 && b.position.y < 2.6 && a.cd <= 0 && Math.abs(u.vz) > 3) {                  /* SAVE: parry/punt back out */
          const away = a.team === 0 ? 1 : -1;
          this._kick(u, (Math.random() - 0.5) * 0.7, away, 13 + Math.random() * 5, 5); a.cd = 0.7;
        }
      } else if (bd < 0.9 && b.position.y < 1.0 && a.cd <= 0 && S.pause <= 0) {
        /* AI: take a touch, then strike toward the opposite goal with a little inaccuracy */
        const gz = P.z + goalDir * P.L / 2, gx = P.x + (Math.random() - 0.5) * 4.6;
        const kx = gx - a.x, kz = gz - a.z, kl = Math.hypot(kx, kz) || 1;
        const near = kl < 20;
        this._kick(u, kx / kl + (Math.random() - 0.5) * 0.12, kz / kl, near ? 20 + Math.random() * 4 : 11 + Math.random() * 3, near ? 3.2 : 0.8);
        a.cd = a.team === 1 ? 0.7 : 0.45;                                                        /* opponents react slower */
      }
      /* visuals */
      const m = a.mesh, spd = Math.hypot(a.vx, a.vz);
      m.position.set(a.x, 0, a.z);
      if (spd > 0.2) m.rotation.y = Math.atan2(a.vx, a.vz); else m.rotation.y = Math.atan2(b.position.x - a.x, b.position.z - a.z);
      const sw = Math.sin(t * 11 + a.hx) * Math.min(1, spd / 4) * 0.9;
      m.legs[0].rotation.x = sw; m.legs[1].rotation.x = -sw;
      m.arms[0].rotation.x = -sw * 0.8; m.arms[1].rotation.x = sw * 0.8;
    }
  },

  _end() {
    const S = this.state; if (!S || S.over) return;
    S.over = true;
    const res = S.you > S.cpu ? "WIN" : (S.you === S.cpu ? "DRAW" : "LOSS");
    const pay = res === "WIN" ? 6000 + 1000 * (S.you - S.cpu) : res === "DRAW" ? 2000 : 500;
    try { Economy.receive("Eko Pitch", pay, "Football " + S.you + "–" + S.cpu); } catch (e) {}
    const m = document.getElementById("fb-msg"); if (m) m.textContent = (res === "WIN" ? "🏆 " : "") + "FULL TIME  " + S.you + "–" + S.cpu;
    toast((res === "WIN" ? "🏆 You win!" : res === "DRAW" ? "🤝 Draw" : "Better luck next time") + " · +₦" + pay.toLocaleString());
    setTimeout(() => this.stop(true), 4500);
  },

  /* where the pitch is — used by the Games app so it can show a distance */
  centre() { return { x: PITCH.x, z: PITCH.z }; },
};

function cylinderMast(g, x, z) {
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 14, 6), new THREE.MeshLambertMaterial({ color: 0x888e96 }));
  mast.position.set(x, 7, z); g.add(mast);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 0.5), new THREE.MeshBasicMaterial({ color: 0xfff3c4 }));
  lamp.position.set(x, 14.2, z); g.add(lamp);
}
if (typeof window !== "undefined") window.__ph3d_football = Football;
