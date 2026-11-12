/* js/core/phone-games.js — the phone's GAMES app + the live WEATHER screen.
   Hub:  🏃 Subway Run    — 3D endless runner with your own character
           🎯 Tactical Range — 3rd-person squad combat arena (opens the range scene)
   Mini-game prizes are small and capped so they can't break the economy. */
import { Economy } from "./economy.js";
import { Weather } from "./weather.js";
import * as THREE from "three";
import { buildCharacter } from "../characters/lowpoly.js";
import * as Animator from "../characters/animator.js";
import { Wardrobe } from "./wardrobe.js";
import { Sfx } from "./sfx.js";

const $ = (id) => document.getElementById(id);
const toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} };
const best = (k, v) => { try { const o = +localStorage.getItem("ph3d_best_" + k) || 0; if (v != null && v > o) { localStorage.setItem("ph3d_best_" + k, String(v)); return v; } return o; } catch (e) { return 0; } };
const pay = (n, note) => { n = Math.max(0, Math.floor(n)); if (n > 0) { try { Economy.receive("Phone Games", n, note); } catch (e) {} } return n; };

export const PhoneGames = {
  _raf: 0, _cleanup: null,

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    if (this._cleanup) { try { this._cleanup(); } catch (e) {} this._cleanup = null; }
  },

  /* ───────────────────────── HUB ───────────────────────── */
  hub() {
    this.stop();
    const el = $("gm-body"); if (!el) return;
    el.innerHTML = `
      <div class="gm-sec">GAMES</div>
      <div class="gm-card" data-g="subway"><div class="gm-ic">RUN</div><div><b>Subway Run</b><small>3D endless runner · your character · best ${best("subway")}</small></div></div>
      <div class="gm-card" data-g="range"><div class="gm-ic">OPS</div><div><b>Tactical Range</b><small>3rd-person squad combat · waves · take cover</small></div></div>`;
    el.querySelectorAll(".gm-card").forEach((c) => c.onclick = () => this.launch(c.dataset.g));
  },

  launch(g) {
    const P = window.__ph3d_phone;
    if (g === "range") {                                   /* full 3D scene: close the phone and go */
      const R = window.__ph3d_router;
      if (!R || !R.go) { toast("Range unavailable"); return; }
      if (P) P.hide();
      R.go("range");
      return;
    }
    if (g === "subway") return this.subway();
  },

  _shell(title, extra) {
    this.stop();
    const el = $("gm-body");
    el.innerHTML = `<div class="gm-bar"><button id="gm-back">‹ Games</button><b>${title}</b><span id="gm-info"></span></div>${extra || ""}`;
    $("gm-back").onclick = () => this.hub();
    return el;
  },

  /* ───────────────────────── 4. SUBWAY RUN ─────────────────────────
     3D endless runner with YOUR character (wardrobe + animator). 3 lanes, jump / slide / dodge,
     coins, knee-slide with dust + camera dip. Cleans up its own WebGL context. */
  subway() {
    try { Sfx.play("ui_open"); } catch (e) {}
    const el = this._shell("Subway Run", `
      <section id="gm-runner-root" class="gm-runner-root">
        <div class="gm-runner-top"><div><small>ENDLESS RUN</small><b>SUBWAY RUSH</b></div><div class="gm-runner-actions"><button id="gm-pause" aria-label="Pause game">Ⅱ</button><button id="gm-fullscreen" aria-label="Toggle fullscreen">⛶</button></div></div>
        <div class="gm-runner-stage" id="gm-runner-stage">
          <canvas id="gm-cv" class="gm-cv"></canvas>
          <div class="gm-runner-hud"><div class="gm-stat"><small>DISTANCE</small><b id="gm-distance">0 m</b></div><div class="gm-stat gm-stat-score"><small>SCORE</small><b id="gm-score">0</b></div><div class="gm-stat gm-stat-coins"><small>COINS</small><b id="gm-coins">0</b></div><div class="gm-speed"><span id="gm-speed">1x</span><small>SPEED</small></div></div>
          <div id="gm-over" class="gm-over"><div class="gm-over-card"><small>RUN FINISHED</small><h2>GAME OVER</h2><div id="gm-final"></div><button id="gm-retry">RUN AGAIN</button><p>Tap the screen or press Enter to retry</p></div></div>
          <div id="gm-paused" class="gm-paused"><div><b>PAUSED</b><button id="gm-resume">RESUME</button></div></div>
          <div class="gm-runner-controls"><button data-action="left">←</button><div><button data-action="jump">↑</button><button data-action="slide">↓</button></div><button data-action="right">→</button></div>
        </div>
        <div class="gm-runner-foot"><span>SWIPE TO MOVE</span><span>JUMP · SLIDE · DODGE</span></div>
      </section>`);
    const canvas = $("gm-cv"), scoreEl = $("gm-score"), coinEl = $("gm-coins"), overEl = $("gm-over"), finalEl = $("gm-final");
    const runnerRoot = $("gm-runner-root"), stage = $("gm-runner-stage");

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const SKIES = [0x141a24, 0x1a1424, 0x121a28, 0x1a1a1a];
    const three = new THREE.Scene();
    three.background = new THREE.Color(SKIES[0]);
    three.fog = new THREE.Fog(SKIES[0], 25, 78);
    const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 200);
    const CAM_Y = 4.2;
    camera.position.set(0, CAM_Y, 7.5); camera.lookAt(0, 1.2, -6);
    three.add(new THREE.HemisphereLight(0xffffff, 0x30303f, 1.7));
    const sun = new THREE.DirectionalLight(0xfff0e0, 1.05); sun.position.set(4, 12, 8); three.add(sun);

    /* character from the live wardrobe */
    let character = null;
    const ctl = {
      rig: null, pos: { x: 0, y: 0, z: 0 }, yaw: 0, state: "standing", onGround: true, level: 0, vel: { y: 0 },
      _intentSpeed: 0, _ul: () => {}, _emoteTimer: 0, _emoteName: null, _emotePhase: 0,
      _useTimer: 0, _useBend: 0.30, weapons: null, held: null, phoneHold: false, sitTarget: null,
    };
    try {
      const built = buildCharacter(Wardrobe.config);
      character = built.root; ctl.rig = built.rig;
      character.rotation.y = Math.PI;            /* run away from the camera */
      three.add(character);
    } catch (e) { console.warn("[subway] character failed:", e); }

    const shGeo = new THREE.CircleGeometry(0.5, 16); shGeo.rotateX(-Math.PI / 2);
    const shMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
    const blob = new THREE.Mesh(shGeo, shMat); blob.position.y = 0.01; three.add(blob);

    /* scrolling track */
    const tcv = document.createElement("canvas"); tcv.width = 256; tcv.height = 512;
    const tg = tcv.getContext("2d");
    tg.fillStyle = "#202030"; tg.fillRect(0, 0, 256, 512);
    tg.fillStyle = "#141420"; tg.fillRect(0, 0, 30, 512); tg.fillRect(226, 0, 30, 512);
    tg.fillStyle = "#e8e8f0"; tg.fillRect(30, 0, 3, 512); tg.fillRect(223, 0, 3, 512);
    tg.fillStyle = "#a0a0a8"; for (let y = 0; y < 512; y += 80) { tg.fillRect(98, y, 6, 40); tg.fillRect(152, y, 6, 40); }
    const gtex = new THREE.CanvasTexture(tcv); gtex.wrapS = gtex.wrapT = THREE.RepeatWrapping; gtex.repeat.set(1, 4); gtex.colorSpace = THREE.SRGBColorSpace;
    const ggeo = new THREE.PlaneGeometry(7, 200); ggeo.rotateX(-Math.PI / 2);
    const gmat = new THREE.MeshLambertMaterial({ map: gtex });
    const ground = new THREE.Mesh(ggeo, gmat); ground.position.z = -80; three.add(ground);
    const wGeo = new THREE.BoxGeometry(0.3, 8, 200), wMat = new THREE.MeshLambertMaterial({ color: 0x252535 });
    const wallL = new THREE.Mesh(wGeo, wMat); wallL.position.set(-3.7, 4, -80); three.add(wallL);
    const wallR = new THREE.Mesh(wGeo, wMat); wallR.position.set(3.7, 4, -80); three.add(wallR);

    const LANES = [-2, 0, 2];
    const hurdleGeo = new THREE.BoxGeometry(1.5, 0.55, 0.4), hurdleMat = new THREE.MeshStandardMaterial({ color: 0xe65b32, roughness: .72 });
    const wallGeo = new THREE.BoxGeometry(1.9, 2.6, 0.6), wallMat = new THREE.MeshStandardMaterial({ color: 0x8a2a3a, roughness: .8 });
    const barGeo = new THREE.BoxGeometry(1.9, 0.4, 0.5), barMat = new THREE.MeshStandardMaterial({ color: 0xffa52e, metalness: .18 });
    const coinGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.06, 16), coinMat = new THREE.MeshStandardMaterial({ color: 0xffd54a, roughness: 0.25, metalness: 0.72, emissive: 0x805000, emissiveIntensity: .22 });
    const trainMat = new THREE.MeshStandardMaterial({ color: 0x176b88, metalness: .35, roughness: .42 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x9de8ff, metalness: .25, roughness: .18, emissive: 0x16445c });
    const hazardMat = new THREE.MeshStandardMaterial({ color: 0xffb52e, roughness: .65 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x9a6034, roughness: .9 });
    const obstacleMaterials = [trainMat, glassMat, hazardMat, crateMat];

    const S = {
      lane: 1, speed: 8, t: 0, distance: 0, score: 0, coins: 0,
      jumpY: 0, jumpV: 0, jumping: false, crouching: false, crouchT: 0,
      over: false, paused: false, overAt: 0, msg: "", spawnCd: 1.0, coinCd: 0.4, graceT: 1.5, objects: [], _lastHud: 0,
    };

    /* ══ DRAMATIC SLIDE: knee-slide pose, dust, camera dip ══ */
    const SLIDE_DUR = 0.85;
    const slide = { t: 0, shake: 0, dustCd: 0 };
    const dustGeo = new THREE.SphereGeometry(0.16, 8, 6);
    const dust = [];
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(dustGeo, new THREE.MeshBasicMaterial({ color: 0xcfc6b8, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false; three.add(m); dust.push({ m, life: 0, vx: 0, vy: 0 });
    }
    function puff() {
      const d = dust.find((x) => x.life <= 0); if (!d || !character) return;
      d.life = 0.5 + Math.random() * 0.3;
      d.m.position.set(character.position.x + (Math.random() - 0.5) * 0.5, 0.1, 0.1 + Math.random() * 0.4);
      d.vx = (Math.random() - 0.5) * 1.6; d.vy = 0.8 + Math.random() * 0.9;
      d.m.scale.setScalar(0.6 + Math.random() * 0.5); d.m.visible = true;
    }
    /* runs last inside Animator.animate (ctl._overlay), so it wins over the run cycle */
    function slideOverlay(R) {
      if (!R || slide.t <= 0) return;
      const t = 1 - slide.t / SLIDE_DUR;                         /* 0 → 1 */
      const k = Math.min(Math.min(1, t * 20), Math.min(1, (1 - t) * 5));
      if (k <= 0.001) return;
      R.hips.position.y = 0.935 - 0.39 * k;                       /* hips sink */
      R.hips.rotation.x = -0.15 * k; R.hips.rotation.z = 0.10 * k;
      if (R.spine) R.spine.rotation.x = 0.10 * k;
      if (R.head) { R.head.rotation.x = -0.05 * k; R.head.rotation.y = 0.12 * k; }
      const L = R.legL, Rg = R.legR;
      if (L) {                                                    /* slide leg: out in front, foot flat */
        L.hip.rotation.x = -1.15 * k; L.hip.rotation.z = 0.10 * k; L.knee.rotation.x = 0.10 * k;
        const a = L.ankle || L.ank; if (a) a.rotation.x = 1.05 * k;
      }
      if (Rg) {                                                   /* anchor leg: tucked, knee near the ground */
        Rg.hip.rotation.x = 0.10 * k; Rg.hip.rotation.z = -0.15 * k; Rg.knee.rotation.x = 1.90 * k;
        const a = Rg.ankle || Rg.ank; if (a) a.rotation.x = -0.30 * k;
      }
      if (R.armL) {                                               /* left arm thrown out for balance */
        R.armL.shoulder.rotation.x = -0.35 * k; R.armL.shoulder.rotation.z = 1.20 * k; R.armL.elbow.rotation.x = -0.40 * k;
        if (R.armL.wrist) R.armL.wrist.rotation.set(0, 0, 0);
      }
      if (R.armR) {                                               /* right arm trails behind */
        R.armR.shoulder.rotation.x = 0.90 * k; R.armR.shoulder.rotation.z = -0.25 * k; R.armR.elbow.rotation.x = -0.30 * k;
        if (R.armR.wrist) R.armR.wrist.rotation.set(0, 0, 0);
      }
    }
    ctl._overlay = slideOverlay;

    function spawnObstacle() {
      const lane = Math.floor(Math.random() * 3), roll = Math.random();
      let mesh, type;
      if (roll < .24) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.82, 2.25, 5.6), trainMat); body.position.y = 1.13; g.add(body);
        for (const x of [-.48, .48]) { const win = new THREE.Mesh(new THREE.BoxGeometry(.58, .62, .04), glassMat); win.position.set(x, 1.72, 2.83); g.add(win); }
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.84, .12, 5.62), hazardMat); stripe.position.y = .72; g.add(stripe);
        for (const x of [-.55, .55]) { const lamp = new THREE.Mesh(new THREE.BoxGeometry(.2, .16, .05), new THREE.MeshBasicMaterial({ color: 0xfff1b0 })); lamp.position.set(x, .25, 2.84); g.add(lamp); }
        mesh = g; mesh.position.set(LANES[lane], 0, -60); type = "dodge";
      } else if (roll < .44) {
        mesh = new THREE.Group();
        const crate = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.05, .9), crateMat); crate.position.y = .53; mesh.add(crate);
        const cross1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, .09, .94), hazardMat); cross1.position.y = .53; mesh.add(cross1);
        mesh.position.set(LANES[lane], 0, -60); type = "jump";
      } else if (roll < .64) {
        mesh = new THREE.Group();
        const a = new THREE.Mesh(new THREE.BoxGeometry(.14, 1.9, .16), hazardMat); a.position.set(-.78, .95, 0); mesh.add(a);
        const b = a.clone(); b.position.x = .78; mesh.add(b);
        const beam = new THREE.Mesh(new THREE.BoxGeometry(1.7, .24, .28), barMat); beam.position.y = 1.65; mesh.add(beam);
        mesh.position.set(LANES[lane], 0, -60); type = "duck";
      } else if (roll < .82) {
        mesh = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(1.55, .34, .62), hazardMat); base.position.y = .18; mesh.add(base);
        for (let i = -2; i <= 2; i++) { const cone = new THREE.Mesh(new THREE.ConeGeometry(.16, .48, 6), new THREE.MeshStandardMaterial({ color: 0xff6a2d })); cone.position.set(i * .27, .55, 0); mesh.add(cone); }
        mesh.position.set(LANES[lane], 0, -60); type = "jump";
      } else {
        mesh = new THREE.Mesh(wallGeo, wallMat); mesh.position.set(LANES[lane], 1.30, -60); type = "dodge";
      }
      three.add(mesh); S.objects.push({ mesh, type, lane, z: -60, phase: Math.random() * Math.PI * 2 });
    }
    function spawnCoin() {
      const lane = Math.floor(Math.random() * 3), mesh = new THREE.Mesh(coinGeo, coinMat);
      mesh.position.set(LANES[lane], 0.9, -60); mesh.rotation.x = Math.PI / 2;
      three.add(mesh); S.objects.push({ mesh, type: "coin", lane, z: -60 });
    }

    function doLane(d) { if (S.over) return; S.lane = Math.max(0, Math.min(2, S.lane + d)); }
    function doJump() { if (S.over || S.jumping || S.crouching) return; S.jumping = true; S.jumpV = 7.5; }
    function doSlide() {
      if (S.over || S.jumping || S.crouching) return;
      S.crouching = true; S.crouchT = SLIDE_DUR; slide.t = SLIDE_DUR; slide.shake = 0.25; slide.dustCd = 0;
      try { Sfx.play("throw_whoosh", { vol: 0.6 }); } catch (e) {}
    }
    function restart() {
      Object.assign(S, { lane: 1, speed: 8, t: 0, distance: 0, score: 0, coins: 0, jumpY: 0, jumpV: 0, jumping: false, crouching: false, crouchT: 0, over: false, paused: false, msg: "", spawnCd: 1.0, coinCd: 0.4, graceT: 1.5 });
      for (const o of S.objects) three.remove(o.mesh);
      S.objects.length = 0; slide.t = 0;
      for (const d of dust) { d.life = 0; d.m.visible = false; }
      const c = SKIES[Math.floor(Math.random() * SKIES.length)];
      three.background.setHex(c); three.fog.color.setHex(c);
      if (character) character.position.set(0, 0, 0);
      ctl.pos.z = 0; overEl.style.display = "none"; $("gm-paused").classList.remove("show"); $("gm-pause").textContent = "Ⅱ";
    }

    const resizeRunner = () => {
      const w = Math.max(280, stage.clientWidth || 360), h = Math.max(360, stage.clientHeight || 560);
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resizeRunner) : null;
    if (resizeObserver) resizeObserver.observe(stage);
    window.addEventListener("resize", resizeRunner);
    requestAnimationFrame(resizeRunner);
    const toggleFullscreen = async () => {
      try {
        if (document.fullscreenElement === runnerRoot) await document.exitFullscreen();
        else if (runnerRoot.requestFullscreen) await runnerRoot.requestFullscreen();
        else runnerRoot.classList.toggle("gm-is-fullscreen");
      } catch (e) { runnerRoot.classList.toggle("gm-is-fullscreen"); }
      requestAnimationFrame(resizeRunner);
    };
    $("gm-fullscreen").onclick = toggleFullscreen;
    document.addEventListener("fullscreenchange", resizeRunner);
    const togglePause = () => {
      if (S.over) return;
      S.paused = !S.paused;
      $("gm-paused").classList.toggle("show", S.paused);
      $("gm-pause").textContent = S.paused ? "▶" : "Ⅱ";
    };
    $("gm-pause").onclick = togglePause;
    $("gm-resume").onclick = togglePause;
    $("gm-retry").onclick = restart;
    stage.querySelectorAll("[data-action]").forEach((b) => b.addEventListener("pointerdown", (e) => {
      e.preventDefault(); const a = b.dataset.action;
      if (a === "left") doLane(-1); else if (a === "right") doLane(1); else if (a === "jump") doJump(); else doSlide();
    }));

    let touchStart = null;
    const onDown = (e) => { e.preventDefault(); touchStart = { x: e.clientX, y: e.clientY }; };
    const onUp = (e) => {
      e.preventDefault();
      if (S.over) { if (performance.now() - S.overAt > 500) restart(); return; }
      if (!touchStart) return;
      const dx = e.clientX - touchStart.x, dy = e.clientY - touchStart.y, adx = Math.abs(dx), ady = Math.abs(dy);
      if (adx < 25 && ady < 25) doJump();
      else if (adx > ady) doLane(dx > 0 ? 1 : -1);
      else if (dy > 0) doSlide(); else doJump();
      touchStart = null;
    };
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointerup", onUp);
    const key = (e) => {
      if (e.code === "Escape" || e.code === "KeyP") { e.preventDefault(); togglePause(); return; }
      if (S.paused) { if (e.code === "Space" || e.code === "Enter") togglePause(); return; }
      if (S.over) { if ((e.code === "Space" || e.code === "Enter") && performance.now() - S.overAt > 500) restart(); return; }
      if (e.code === "ArrowLeft" || e.code === "KeyA") doLane(-1);
      else if (e.code === "ArrowRight" || e.code === "KeyD") doLane(1);
      else if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "Space") { e.preventDefault(); doJump(); }
      else if (e.code === "ArrowDown" || e.code === "KeyS") { e.preventDefault(); doSlide(); }
    };
    document.addEventListener("keydown", key);

    this._cleanup = () => {
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", resizeRunner); document.removeEventListener("fullscreenchange", resizeRunner);
      if (resizeObserver) resizeObserver.disconnect();
      if (document.fullscreenElement === runnerRoot && document.exitFullscreen) document.exitFullscreen().catch(() => {});
      runnerRoot.classList.remove("gm-is-fullscreen");
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointerup", onUp);
      for (const o of S.objects) three.remove(o.mesh);
      S.objects.length = 0;
      if (character) {
        three.remove(character);
        character.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m && m.dispose && m.dispose());
        });
      }
      dust.forEach((d) => d.m.material.dispose());
      [hurdleGeo, hurdleMat, wallGeo, wallMat, barGeo, barMat, coinGeo, coinMat, ...obstacleMaterials, shGeo, shMat, ggeo, gmat, gtex, wGeo, wMat, dustGeo].forEach((x) => x && x.dispose && x.dispose());
      try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) {}
    };

    let last = performance.now();
    const loop = () => {
      if (!document.body.contains(canvas)) return;
      this._raf = requestAnimationFrame(loop);
      const now = performance.now();
      let dt = Math.min(0.06, (now - last) / 1000); last = now;
      const phone = $("tphone");
      if (!phone || !phone.classList.contains("on")) return;

      S.t += dt;
      if (!S.over && !S.paused) {
        S.graceT -= dt;
        if (S.t > 1) S.speed = 8 + Math.min(18, (S.t - 1) * 0.5);
        S.distance += S.speed * dt;
        gtex.offset.y = (gtex.offset.y + (S.speed * dt) / 50) % 1;
        ctl.pos.z += S.speed * dt; ctl._intentSpeed = S.speed; ctl._emoteTimer = 0; ctl._emoteName = null;

        if (character) character.position.x += (LANES[S.lane] - character.position.x) * Math.min(1, dt * 14);

        if (S.jumping) {
          S.jumpV -= 20 * dt; S.jumpY += S.jumpV * dt;
          if (S.jumpY <= 0) { S.jumpY = 0; ctl._lastVy = S.jumpV; S.jumpV = 0; S.jumping = false; ctl.onGround = true; ctl.vel.y = 0; }
          else { ctl.onGround = false; ctl.vel.y = S.jumpV; }
        } else { ctl.onGround = true; ctl.vel.y = 0; }

        if (S.crouching) { S.crouchT -= dt; if (S.crouchT <= 0) S.crouching = false; }
        if (slide.t > 0) {
          slide.t -= dt;
          slide.dustCd -= dt;
          if (slide.dustCd <= 0 && slide.t > 0.1) { slide.dustCd = 0.06; puff(); }
        }
        ctl.state = "standing";                                   /* the slide pose is the overlay */
        if (character) character.position.y = S.jumpY;

        blob.position.x = character ? character.position.x : 0;
        blob.scale.setScalar(Math.max(0.4, 1 - S.jumpY * 0.3));
        shMat.opacity = Math.max(0.1, 0.35 - S.jumpY * 0.15);

        if (S.graceT <= 0) { S.spawnCd -= dt; if (S.spawnCd <= 0) { spawnObstacle(); S.spawnCd = 0.9 + Math.random() * 0.7; } }
        S.coinCd -= dt; if (S.coinCd <= 0) { spawnCoin(); S.coinCd = 1.0 + Math.random() * 0.8; }

        for (const o of S.objects) { o.z += S.speed * dt; o.mesh.position.z = o.z; if (o.type === "coin") o.mesh.rotation.y += dt * 4; }
        for (let i = S.objects.length - 1; i >= 0; i--) {
          const o = S.objects[i];
          if (o.z > 3) { three.remove(o.mesh); S.objects.splice(i, 1); continue; }
          if (Math.abs(o.z) < 0.9 && o.lane === S.lane) {
            if (o.type === "coin") { S.coins++; try { Sfx.play("pickup_coin", { vol: 0.3 }); } catch (e) {} three.remove(o.mesh); S.objects.splice(i, 1); }
            else if (o.type === "jump") { if (S.jumpY < 0.6) S.over = true; }
            else if (o.type === "duck") { if (!S.crouching) S.over = true; }
            else S.over = true;
          }
        }
        S.score = Math.floor(S.distance * 2) + S.coins * 10;

        if (ctl.rig) { try { Animator.animate(ctl, dt); } catch (e) {} }

        /* camera: follows lanes, dips + shakes during the slide */
        const dip = slide.t > 0 ? Math.sin(Math.min(1, (1 - slide.t / SLIDE_DUR) * 1.2) * Math.PI) : 0;
        slide.shake = Math.max(0, slide.shake - dt);
        const sh = slide.shake > 0 ? (Math.random() - 0.5) * 0.18 * (slide.shake / 0.25) : 0;
        if (character) {
          camera.position.x += (character.position.x * 0.3 - camera.position.x) * Math.min(1, dt * 5);
          camera.position.y = CAM_Y - 0.6 * dip + sh;
          camera.lookAt(character.position.x * 0.4, 1.2 + S.jumpY * 0.5 - 0.3 * dip, -6);
        }

        if (S.over) {
          S.overAt = performance.now();
          try { Sfx.play("body_fall", { vol: 0.8 }); } catch (e) {}
          const isBest = S.score > best("subway");
          best("subway", S.score);
          const p = pay(Math.min(2000, Math.floor(S.score / 12)), "Subway Run");
          S.msg = (isBest ? "NEW BEST · " : "BEST " + best("subway") + " · ") + (p ? "+₦" + p : "");
          overEl.style.display = "flex";
          finalEl.innerHTML = "<strong>" + S.score.toLocaleString() + "</strong><span>" + Math.floor(S.distance) + " metres · " + S.coins + " coins</span><small>" + S.msg + "</small>";
        }
      }
      /* dust puffs drift up and back toward the camera, fading */
      for (const d of dust) {
        if (d.life <= 0) continue;
        d.life -= dt; d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += S.speed * 0.5 * dt;
        d.m.material.opacity = Math.max(0, d.life * 0.9);
        if (d.life <= 0) d.m.visible = false;
      }
      if (S.t - S._lastHud > 0.1) { S._lastHud = S.t; scoreEl.textContent = S.score.toLocaleString(); coinEl.textContent = S.coins.toLocaleString(); $("gm-distance").textContent = Math.floor(S.distance) + " m"; $("gm-speed").textContent = (S.speed / 8).toFixed(1) + "x"; }
      renderer.render(three, camera);
    };
    this._raf = requestAnimationFrame(loop);
  },

  /* ───────────────────────── WEATHER SCREEN ───────────────────────── */
  weather() {
    const el = $("wx-body"); if (!el) return;
    const I = Weather.info(), S = I.season, seasons = Weather.SEASONS;
    const days = ["Today", "Tomorrow", "Wed", "Thu", "Fri"];
    const fc = days.map((d, i) => {
      const hi = I.season.temp[1] - (i % 3 === 1 ? 1 : 0), lo = I.season.temp[0];
      const e = S.id === "rainy" ? (i % 2 ? "Storm" : "Rain") : S.id === "harmattan" ? (i % 2 ? "Haze" : "Dry") : (i % 2 ? "Sun" : "Hot");
      return `<div class="wx-d"><span>${d}</span><i>${e}</i><b>${hi}° / ${lo}°</b></div>`;
    }).join("");
    el.innerHTML = `
      <div class="wx-hero wx-${S.id}">
        <div class="wx-city">Port Harcourt</div>
        <div class="wx-ic">${S.icon}</div>
        <div class="wx-t">${I.temp}°</div>
        <div class="wx-c">${S.label} · ${S.cond}</div>
        <div class="wx-b">${S.blurb}</div>
      </div>
      <div class="wx-stats"><div><b>${I.humidity}%</b><small>Humidity</small></div><div><b>${I.wind} km/h</b><small>Wind</small></div><div><b>${S.walkMul < 1 ? "Slippery" : "Normal"}</b><small>Ground</small></div></div>
      <div class="wx-fc">${fc}</div>
      <div class="gm-sec">SEASON</div>
      <div class="wx-pick">
        <button data-m="auto" class="${I.mode === "auto" ? "on" : ""}">Auto<br><small>${seasons[I.auto].label}</small></button>
        ${Weather.ORDER.map(k => `<button data-m="${k}" class="${I.mode === k ? "on" : ""}">${seasons[k].icon} ${seasons[k].label}</button>`).join("")}
      </div>
      <div class="gm-hint">Auto follows the real calendar: Harmattan Nov–Feb · Summer Mar–Apr · Rainy May–Oct</div>`;
    el.querySelectorAll(".wx-pick button").forEach((b) => b.onclick = () => { Weather.setMode(b.dataset.m); this.weather(); });
  },
};
if (typeof window !== "undefined") window.__ph3d_games = PhoneGames;
