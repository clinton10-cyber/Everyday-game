/* js/core/phone-games.js — the phone's GAMES app + the live WEATHER screen.
   Hub:  🏁 Street Race (open-world) · ⚽ Football match (open-world) ·
         3 mini games that play right inside the phone:
           🚗 Traffic Dash  — endless lane dodger  (tap left/right, or ← →)
           🃏 Food Match    — memory card pairs
           🥅 Penalty Kick  — 5-kick shoot-out vs a diving keeper
   Mini-game prizes are small and capped so they can't break the economy. */
import { Economy } from "./economy.js";
import { Weather } from "./weather.js";
import { Race, TRACKS } from "./race.js";
import { Football, PITCH } from "./football.js";

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
    const D = window.__ph3d_drive, inWorld = !!D;
    const dist = (() => { try { const p = D && D.getPos(); return p ? Math.round(Math.hypot(p.x - PITCH.x, p.z - PITCH.z)) : null; } catch (e) { return null; } })();
    el.innerHTML = `
      <div class="gm-sec">OPEN WORLD</div>
      <div class="gm-card" data-g="race-sprint"><div class="gm-ic">RACE</div><div><b>Street Race · Downtown Sprint</b><small>2 laps vs 3 rivals · prize ₦${TRACKS.sprint.prize.toLocaleString()}</small></div></div>
      <div class="gm-card" data-g="race-circuit"><div class="gm-ic">LOOP</div><div><b>Street Race · Grand Circuit</b><small>Big city loop · prize ₦${TRACKS.circuit.prize.toLocaleString()}</small></div></div>
      <div class="gm-card" data-g="football"><div class="gm-ic">FB</div><div><b>Football · 3v3 Match</b><small>2-minute match on Eko Pitch${dist != null ? " · " + dist + " m away" : ""}</small></div></div>
      <div class="gm-sec">PLAY ON PHONE</div>
      <div class="gm-card" data-g="dash"><div class="gm-ic">DASH</div><div><b>Traffic Dash</b><small>Dodge traffic · best ${best("dash")}</small></div></div>
      <div class="gm-card" data-g="match"><div class="gm-ic">MATCH</div><div><b>Food Match</b><small>Find all the pairs · best ${best("match") ? best("match") + " moves" : "—"}</small></div></div>
      <div class="gm-card" data-g="pens"><div class="gm-ic">PEN</div><div><b>Penalty Kick</b><small>5 kicks vs the keeper · best ${best("pens")}/5</small></div></div>`;
    el.querySelectorAll(".gm-card").forEach((c) => c.onclick = () => this.launch(c.dataset.g));
  },

  launch(g) {
    const P = window.__ph3d_phone;
    if (g === "race-sprint" || g === "race-circuit") {
      if (!window.__ph3d_drive) { toast("Races run in the open city"); return; }
      if (Race.start(g === "race-sprint" ? "sprint" : "circuit") && P) P.hide();
      return;
    }
    if (g === "football") {
      if (!window.__ph3d_drive) { toast("Football runs in the open city"); return; }
      if (Football.start() && P) P.hide();
      return;
    }
    if (g === "dash") return this.dash();
    if (g === "match") return this.match();
    if (g === "pens") return this.pens();
  },

  _shell(title, extra) {
    this.stop();
    const el = $("gm-body");
    el.innerHTML = `<div class="gm-bar"><button id="gm-back">‹ Games</button><b>${title}</b><span id="gm-info"></span></div>${extra || ""}`;
    $("gm-back").onclick = () => this.hub();
    return el;
  },

  /* ───────────────────────── 1. TRAFFIC DASH ───────────────────────── */
  dash() {
    const el = this._shell("Traffic Dash", `<canvas id="gm-cv" width="300" height="440" class="gm-cv"></canvas><div class="gm-hint">Tap left / right side to change lane</div>`);
    const cv = $("gm-cv"), c = cv.getContext("2d"), info = $("gm-info");
    const LANES = [60, 150, 240], S = { lane: 1, x: 150, over: false, score: 0, coins: 0, speed: 190, t: 0, obs: [], spawn: 0, y: 0, started: false };
    const go = (d) => { if (S.over) return restart(); if (!S.started) S.started = true; S.lane = Math.max(0, Math.min(2, S.lane + d)); };
    const restart = () => { Object.assign(S, { lane: 1, x: 150, over: false, score: 0, coins: 0, speed: 190, t: 0, obs: [], spawn: 0, y: 0, started: true }); };
    const tap = (e) => { const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width; go(x < 0.5 ? -1 : 1); e.preventDefault(); };
    const key = (e) => { if (e.code === "ArrowLeft" || e.code === "KeyA") go(-1); if (e.code === "ArrowRight" || e.code === "KeyD") go(1); };
    cv.addEventListener("pointerdown", tap); document.addEventListener("keydown", key);
    this._cleanup = () => document.removeEventListener("keydown", key);
    const KINDS = [["#ffc62b", 34, 52], ["#7cc8ff", 36, 66], ["#ff5a3c", 26, 40], ["#222", 30, 30]];
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (S.started && !S.over) {
        S.t += dt; S.speed = 190 + S.t * 7; S.y += S.speed * dt; S.score = Math.floor(S.y / 8) + S.coins * 10;
        S.x += (LANES[S.lane] - S.x) * Math.min(1, dt * 14);
        S.spawn -= dt;
        if (S.spawn <= 0) {
          S.spawn = Math.max(0.38, 0.95 - S.t * 0.012);
          const l = Math.floor(Math.random() * 3);
          if (Math.random() < 0.28) S.obs.push({ l, y: -40, coin: true, e: "#ffc62b", w: 22, h: 22 });
          else { const k = KINDS[Math.floor(Math.random() * KINDS.length)]; S.obs.push({ l, y: -60, e: k[0], w: k[1], h: k[2] }); }
        }
        for (const o of S.obs) o.y += S.speed * dt * (o.coin ? 1 : 0.92);
        const py = 372;
        for (const o of S.obs) {
          if (o.dead) continue;
          if (Math.abs(LANES[o.l] - S.x) < (o.w + 34) / 2 - 4 && Math.abs(o.y - py) < (o.h + 52) / 2 - 6) {
            if (o.coin) { o.dead = true; S.coins++; } else { S.over = true; }
          }
        }
        S.obs = S.obs.filter((o) => !o.dead && o.y < 500);
        if (S.over) {
          const isBest = S.score > best("dash"); best("dash", S.score);
          const p = pay(Math.min(500, S.score / 12), "Traffic Dash");
          S.msg = (isBest ? "NEW BEST! " : "") + (p ? "+₦" + p : "");
        }
      }
      /* draw */
      c.fillStyle = "#2c2f36"; c.fillRect(0, 0, 300, 440);
      c.fillStyle = "#3a3e47"; c.fillRect(15, 0, 270, 440);
      c.strokeStyle = "#e9e3b0"; c.lineWidth = 3; c.setLineDash([28, 24]); c.lineDashOffset = -(S.y % 52);
      for (const x of [105, 195]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 440); c.stroke(); }
      c.setLineDash([]);
      c.font = "34px serif"; c.textAlign = "center"; c.textBaseline = "middle";
      for (const o of S.obs) { c.fillStyle = o.e; c.beginPath(); if (o.coin) c.arc(LANES[o.l], o.y, 10, 0, 7); else c.roundRect(LANES[o.l] - o.w / 2, o.y - o.h / 2, o.w, o.h, 6); c.fill(); }
      c.save(); c.translate(S.x, 372); c.rotate((LANES[S.lane] - S.x) * 0.004); c.fillStyle = "#35d07f"; c.beginPath(); c.roundRect(-17, -26, 34, 52, 7); c.fill(); c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(-12, -14, 24, 12); c.restore();
      c.fillStyle = "#fff"; c.font = "bold 15px system-ui"; c.textAlign = "left"; c.fillText("SCORE " + S.score + "   COINS " + S.coins, 22, 20);
      if (!S.started) { c.textAlign = "center"; c.font = "bold 20px system-ui"; c.fillText("TAP TO START", 150, 200); }
      if (S.over) { c.fillStyle = "rgba(0,0,0,.6)"; c.fillRect(30, 150, 240, 130); c.fillStyle = "#fff"; c.textAlign = "center"; c.font = "bold 24px system-ui"; c.fillText("CRASH!", 150, 185); c.font = "16px system-ui"; c.fillText("Score " + S.score + "  ·  Best " + best("dash"), 150, 215); c.fillText(S.msg || "", 150, 238); c.fillText("tap to retry", 150, 262); }
      if (info) info.textContent = "";
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  },

  /* ───────────────────────── 2. FOOD MATCH ───────────────────────── */
  match() {
    const el = this._shell("Food Match", `<div id="gm-grid" class="gm-grid"></div><div class="gm-hint" id="gm-mhint">Flip two cards to find a pair</div>`);
    const face = ["Rice", "Chkn", "Mngo", "Plnt", "Coco", "Pepr", "Pine", "Melo"];
    const deck = face.concat(face).map((f, i) => ({ f, id: i, up: false, done: false }));
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    let first = null, lock = false, moves = 0, found = 0;
    const grid = $("gm-grid"), info = $("gm-info");
    const draw = () => {
      grid.innerHTML = deck.map((c, i) => `<div class="gm-tile${c.up || c.done ? " up" : ""}${c.done ? " ok" : ""}" data-i="${i}">${c.up || c.done ? c.f : "?"}</div>`).join("");
      grid.querySelectorAll(".gm-tile").forEach((t) => t.onclick = () => flip(+t.dataset.i));
      info.textContent = moves + " moves";
    };
    const flip = (i) => {
      const c = deck[i]; if (lock || c.up || c.done) return;
      c.up = true;
      if (first == null) { first = i; draw(); return; }
      moves++;
      const a = deck[first];
      if (a.f === c.f) {
        a.done = c.done = true; a.up = c.up = false; found++; first = null; draw();
        if (found === 8) {
          const isBest = !best("match") || moves < best("match");
          if (isBest) { try { localStorage.setItem("ph3d_best_match", String(moves)); } catch (e) {} }
          const p = pay(Math.max(100, 600 - moves * 25), "Food Match");
          $("gm-mhint").textContent = "Cleared in " + moves + " moves" + (p ? " · +₦" + p : "") + (isBest ? " · NEW BEST" : "");
        }
      } else {
        lock = true; draw();
        setTimeout(() => { a.up = c.up = false; first = null; lock = false; draw(); }, 650);
      }
    };
    draw();
  },

  /* ───────────────────────── 3. PENALTY KICK ───────────────────────── */
  pens() {
    const el = this._shell("Penalty Kick", `<canvas id="gm-cv" width="300" height="440" class="gm-cv"></canvas><div class="gm-hint">Tap a spot in the goal to shoot</div>`);
    const cv = $("gm-cv"), c = cv.getContext("2d"), info = $("gm-info");
    const G = { x: 40, y: 80, w: 220, h: 120 };
    const S = { round: 0, goals: 0, phase: "aim", t: 0, tx: 0, ty: 0, kx: 150, dive: 150, kd: 0, msg: "", over: false, hist: [] };
    const reset = () => Object.assign(S, { round: 0, goals: 0, phase: "aim", t: 0, kx: 150, dive: 150, kd: 0, msg: "", over: false, hist: [] });
    cv.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (S.over) { reset(); return; }
      if (S.phase !== "aim") return;
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * 300, y = (e.clientY - r.top) / r.height * 440;
      S.tx = Math.max(G.x + 8, Math.min(G.x + G.w - 8, x)); S.ty = Math.max(G.y + 10, Math.min(G.y + G.h - 8, y));
      /* the keeper guesses: 45% he reads your side, plus he's quick toward the middle */
      const side = S.tx < 150 ? -1 : 1;
      S.dive = Math.random() < 0.45 ? S.tx + (Math.random() - 0.5) * 40 : 150 + (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 80);
      S.dive = Math.max(G.x + 20, Math.min(G.x + G.w - 20, S.dive));
      S.phase = "shot"; S.t = 0;
    });
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (S.phase === "shot") {
        S.t += dt; S.kx += (S.dive - S.kx) * Math.min(1, dt * 7);
        if (S.t > 0.62) {
          const saved = Math.abs(S.kx - S.tx) < 30 && S.ty > G.y + 8;
          const out = false;
          if (saved) S.msg = "SAVED!"; else { S.goals++; S.msg = "GOAL!"; }
          S.hist.push(!saved); S.round++; S.phase = "result"; S.t = 0;
        }
      } else if (S.phase === "result") {
        S.t += dt; S.kx += (150 - S.kx) * Math.min(1, dt * 4);
        if (S.t > 1.2) {
          if (S.round >= 5) {
            S.over = true; S.phase = "end";
            const isBest = S.goals > best("pens"); best("pens", S.goals);
            S.final = pay(S.goals * 120, "Penalty Kick") ; S.isBest = isBest;
          } else { S.phase = "aim"; S.msg = ""; }
        }
      }
      c.fillStyle = "#2e7d32"; c.fillRect(0, 0, 300, 440);
      c.fillStyle = "#378a3b"; for (let i = 0; i < 6; i++) if (i % 2) c.fillRect(0, i * 73, 300, 73);
      c.fillStyle = "rgba(255,255,255,.22)"; for (let x = G.x; x <= G.x + G.w; x += 14) c.fillRect(x, G.y, 1, G.h); for (let y = G.y; y <= G.y + G.h; y += 14) c.fillRect(G.x, y, G.w, 1);
      c.strokeStyle = "#fff"; c.lineWidth = 6; c.strokeRect(G.x, G.y, G.w, G.h);
      c.fillStyle = "#fff"; c.fillRect(0, 205, 300, 2); c.beginPath(); c.arc(150, 330, 3, 0, 7); c.fill();
      c.font = "46px serif"; c.textAlign = "center"; c.textBaseline = "middle";
      const kyOff = S.phase === "shot" || S.phase === "result" ? Math.min(1, S.t * 4) * 8 : 0;
      c.fillStyle = "#ffc62b"; c.fillRect(S.kx - 22, G.y + G.h - 56 + kyOff, 44, 36);
      /* ball */
      let bx = 150, by = 400, bs = 30;
      if (S.phase === "shot" || S.phase === "result") {
        const k = Math.min(1, (S.phase === "shot" ? S.t : 0.62) / 0.5), e = 1 - (1 - k) * (1 - k);
        bx = 150 + (S.tx - 150) * e; by = 400 + (S.ty - 400) * e; bs = 30 - 14 * e;
      }
      c.fillStyle = "#fff"; c.beginPath(); c.arc(bx, by, bs / 2, 0, 7); c.fill();
      c.fillStyle = "#fff"; c.font = "bold 15px system-ui"; c.textAlign = "left";
      c.fillText("KICK " + Math.min(S.round + (S.phase === "aim" || S.phase === "shot" ? 1 : 0), 5) + "/5   GOALS " + S.goals, 14, 22);
      c.textAlign = "right"; c.fillText(S.hist.map(h => h ? "O" : "X").join(" "), 288, 22);
      if (S.msg) { c.textAlign = "center"; c.font = "bold 28px system-ui"; c.lineWidth = 4; c.strokeStyle = "#000"; c.strokeText(S.msg, 150, 260); c.fillStyle = "#ffd54a"; c.fillText(S.msg, 150, 260); }
      if (S.over) { c.fillStyle = "rgba(0,0,0,.65)"; c.fillRect(30, 150, 240, 140); c.fillStyle = "#fff"; c.textAlign = "center"; c.font = "bold 24px system-ui"; c.fillText(S.goals + " / 5 scored", 150, 185); c.font = "16px system-ui"; c.fillText((S.isBest ? "NEW BEST! " : "Best " + best("pens") + "/5 ") + (S.final ? "· +₦" + S.final : ""), 150, 215); c.fillText("tap to play again", 150, 255); }
      if (info) info.textContent = "";
      this._raf = requestAnimationFrame(loop);
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
