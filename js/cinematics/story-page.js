/* Everyday Cinematic Stories — shared page controller.
   Each story-0N-*.html is a tiny shell that calls mountStory('<id>').
   Builds the UI, loads the 3D film with a progress bar, runs the controls,
   narration (speech synthesis, kept in sync with the scene timing) and end card. */
import { STORIES, storyById, storyAfter } from './stories-data.js';

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="4.5" width="4.2" height="15" rx="1.2"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M6 5h2.2v14H6zM19 5.8v12.4a.8.8 0 0 1-1.25.66L9.4 12.66a.8.8 0 0 1 0-1.32l8.35-6.2A.8.8 0 0 1 19 5.8z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M15.8 5H18v14h-2.2zM5 5.8v12.4a.8.8 0 0 0 1.25.66l8.35-6.2a.8.8 0 0 0 0-1.32l-8.35-6.2A.8.8 0 0 0 5 5.8z"/></svg>',
  replay: '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>',
  voiceOn: '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.6l4.9 4V5.5l-4.9 4H4zm12.2 2.5a4 4 0 0 0-2-3.45v6.9a4 4 0 0 0 2-3.45zM14.2 4.3v2.1a6.2 6.2 0 0 1 0 11.2v2.1a8.3 8.3 0 0 0 0-15.4z"/></svg>',
  voiceOff: '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.6l4.9 4V5.5l-4.9 4H4zm11.6.7 1.9 1.8-1.9 1.8 1.2 1.2 1.9-1.8 1.9 1.8 1.2-1.2-1.9-1.8 1.9-1.8-1.2-1.2-1.9 1.8-1.9-1.8z"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

export async function mountStory(id) {
  const story = storyById(id);
  const root = document.getElementById('app');
  if (!story || !root) { document.body.textContent = 'Story not found.'; return; }
  const next = storyAfter(id);
  const acts = story.acts;
  const total = acts.reduce((n, a) => n + a.duration, 0);
  document.title = `Everyday Stories · ${story.title}`;
  document.documentElement.style.setProperty('--accent', story.accent);

  root.innerHTML = `
  <main class="film" id="film">
    <canvas id="filmCanvas" aria-label="3D animated story scene"></canvas>
    <div class="shade"></div>
    <div class="topbar" id="topbar">
      <a class="back" href="stories.html" aria-label="All stories">${ICON.back}STORIES</a>
      <div class="chapter" id="chapter">${esc(story.tagline)}</div>
      <div class="sceneNo" id="sceneNo">SCENE 1 / ${acts.length}</div>
    </div>
    <div class="subs" id="subs"><div class="box"><h1 id="sceneHeading"></h1><p id="caption"></p></div></div>
    <div class="controls" id="controls"><div class="inner">
      <div class="segs" id="segs">${acts.map((a, i) => `<button class="seg" data-i="${i}" aria-label="Scene ${i + 1}: ${esc(a.heading)}"><i><b></b></i></button>`).join('')}</div>
      <div class="row">
        <button class="ib" id="restart" aria-label="Restart story">${ICON.replay}</button>
        <button class="ib" id="prev" aria-label="Previous scene">${ICON.prev}</button>
        <button class="ib primary" id="play" aria-label="Play">${ICON.play}</button>
        <button class="ib" id="skip" aria-label="Next scene">${ICON.next}</button>
        <button class="ib" id="voice" aria-label="Narration voice on or off">${ICON.voiceOn}</button>
      </div>
    </div></div>
    <div class="time" id="time">00:00 / ${mmss(total)}</div>

    <section class="card" id="intro"><div class="in">
      <div class="num">EVERYDAY ORIGINAL · EPISODE ${String(story.number).padStart(2, '0')}</div>
      <h2>${esc(story.title)}</h2>
      <div class="tag">${esc(story.tagline)}</div>
      <p>${esc(story.synopsis)}</p>
      <div class="chips"><span class="chip">${acts.length} SCENES</span><span class="chip">≈ ${Math.round(total / 10) * 10} SEC</span><span class="chip">${esc(story.mood.toUpperCase())}</span><span class="chip">${esc(story.where.toUpperCase())}</span></div>
      <div class="loadbar" id="loadbar"><b id="loadfill"></b></div>
      <div class="loadtxt" id="loadtxt">Loading the Port Harcourt world…</div>
      <div class="btns"><button class="btn" id="start" disabled>${ICON.play} PLAY STORY</button></div>
      <div class="hint">Real-time 3D in your game world · Voice narration is optional · Landscape gives the widest view</div>
    </div></section>

    <section class="card hide" id="end"><div class="in">
      <div class="num">THE END</div>
      <h2 style="font-size:clamp(28px,8vw,48px)">${esc(story.title)}</h2>
      <p>Thanks for watching. Replay it, or continue with the next story.</p>
      <div class="btns"><button class="btn" id="replay">${ICON.replay} REPLAY</button>${next && next.id !== id ? `<a class="btn ghost" href="${next.file}">NEXT: ${esc(next.title)}</a>` : ''}<a class="btn ghost" href="stories.html">ALL STORIES</a></div>
    </div></section>

    <section class="card hide err" id="error"><div class="in">
      <div class="num">SOMETHING WENT WRONG</div>
      <h2>Story could not start</h2>
      <p id="errmsg">The 3D scene failed to load.</p>
      <div class="btns"><button class="btn" id="retry">TRY AGAIN</button><a class="btn ghost" href="stories.html">ALL STORIES</a></div>
    </div></section>
  </main>`;

  const $ = (i) => document.getElementById(i);
  const film$ = $('film');
  let film = null, voiceOn = true, speaking = false, idleTimer = 0, currentNarration = '', loaded = false;

  /* ---------------- narration ---------------- */
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  let voiceChoice = null;
  const pickVoice = () => {
    if (!synth) return;
    const vs = synth.getVoices();
    voiceChoice = vs.find((v) => /^en[-_]NG/i.test(v.lang)) || vs.find((v) => /^en[-_]GB/i.test(v.lang)) || vs.find((v) => /^en[-_]/i.test(v.lang)) || null;
  };
  if (synth) { pickVoice(); synth.addEventListener?.('voiceschanged', pickVoice); }
  function stopSpeech() { speaking = false; try { synth?.cancel(); } catch (e) { /* unsupported */ } }
  function speak(text) {
    currentNarration = text || '';
    stopSpeech();
    if (!voiceOn || !synth || !text) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.96; u.pitch = 1; u.volume = 1;
      if (voiceChoice) u.voice = voiceChoice;
      u.onstart = () => { speaking = true; };
      u.onend = u.onerror = () => { speaking = false; };
      speaking = true; // assume speaking until the engine says otherwise (cleared by onend/onerror or the safety timer)
      synth.speak(u);
      clearTimeout(speak.safety);
      speak.safety = setTimeout(() => { speaking = false; }, Math.min(30000, 2500 + text.length * 80));
    } catch (e) { speaking = false; }
  }

  /* ---------------- UI wiring ---------------- */
  const iconBtn = (id, svg) => { $(id).innerHTML = svg; };
  const setPlayIcon = (playing) => { iconBtn('play', playing ? ICON.pause : ICON.play); $('play').setAttribute('aria-label', playing ? 'Pause' : 'Play'); };
  function setVoiceUi() { iconBtn('voice', voiceOn ? ICON.voiceOn : ICON.voiceOff); $('voice').classList.toggle('off', !voiceOn); }
  setVoiceUi();

  function wake() {
    film$.classList.remove('idle');
    clearTimeout(idleTimer);
    if (film?.state.playing) idleTimer = setTimeout(() => film$.classList.add('idle'), 3400);
  }
  ['pointerdown', 'pointermove', 'keydown'].forEach((ev) => window.addEventListener(ev, wake, { passive: true }));

  function showAct(a, i) {
    const subs = $('subs');
    subs.classList.add('swap');
    setTimeout(() => {
      $('sceneHeading').textContent = a.heading;
      $('caption').textContent = a.caption;
      subs.classList.remove('swap');
    }, i === 0 && !loaded ? 0 : 280);
    $('chapter').textContent = a.heading.toUpperCase();
    $('sceneNo').textContent = `SCENE ${i + 1} / ${acts.length}`;
    document.querySelectorAll('.seg').forEach((s, j) => {
      s.classList.toggle('done', j < i);
      s.firstElementChild.firstElementChild.style.width = j < i ? '100%' : '0';
    });
    if (film?.state.playing) speak(a.narration);
  }

  function tick(state) {
    const doneBefore = acts.slice(0, state.act).reduce((n, a) => n + a.duration, 0);
    const elapsed = doneBefore + Math.min(state.elapsed, acts[state.act].duration);
    const seg = document.querySelectorAll('.seg')[state.act];
    if (seg) seg.firstElementChild.firstElementChild.style.width = `${Math.min(100, (state.elapsed / acts[state.act].duration) * 100)}%`;
    $('time').textContent = `${mmss(elapsed)} / ${mmss(total)}`;
  }

  function onEnd() {
    stopSpeech(); setPlayIcon(false);
    document.querySelectorAll('.seg').forEach((s) => { s.classList.add('done'); s.firstElementChild.firstElementChild.style.width = '100%'; });
    film$.classList.remove('idle');
    $('end').classList.remove('hide');
  }

  function showError(err) {
    console.error('[story]', err);
    $('errmsg').textContent = (err && err.message) ? `${err.message}` : 'The 3D scene failed to load.';
    $('intro').classList.add('hide'); $('error').classList.remove('hide');
  }
  window.addEventListener('unhandledrejection', (e) => { if (!loaded) showError(e.reason); });

  function begin() {
    $('intro').classList.add('hide'); $('end').classList.add('hide');
    film.restart();
    setPlayIcon(true); wake();
  }
  function toggle() {
    if (!film) return;
    if (film.state.done) { begin(); return; }
    if (film.state.playing) { film.pause(); stopSpeech(); setPlayIcon(false); film$.classList.remove('idle'); }
    else { film.play(); setPlayIcon(true); speak(currentNarration || acts[film.state.act].narration); wake(); }
  }
  const goto = (i) => { if (!film) return; $('end').classList.add('hide'); const was = film.state.playing; film.seek(i); if (!was) { film.play(); setPlayIcon(true); } wake(); };

  $('start').onclick = begin;
  $('replay').onclick = begin;
  $('play').onclick = toggle;
  $('restart').onclick = begin;
  $('skip').onclick = () => { if (!film) return; if (film.state.act < acts.length - 1) goto(film.state.act + 1); else { film.skip(); } };
  $('prev').onclick = () => { if (!film) return; goto(film.state.elapsed > 3 ? film.state.act : Math.max(0, film.state.act - 1)); };
  $('voice').onclick = () => { voiceOn = !voiceOn; setVoiceUi(); if (!voiceOn) stopSpeech(); else if (film?.state.playing) speak(acts[film.state.act].narration); };
  document.querySelectorAll('.seg').forEach((s) => { s.onclick = () => goto(Number(s.dataset.i)); });
  $('filmCanvas').addEventListener('click', () => {
    const cardsHidden = ['intro', 'end', 'error'].every((c) => $(c).classList.contains('hide'));
    if (!loaded || !cardsHidden) return;
    if (film$.classList.contains('idle')) wake(); else toggle();
  });
  window.addEventListener('keydown', (e) => {
    if (!loaded || !$('intro').classList.contains('hide')) return;
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    else if (e.code === 'ArrowRight') goto(Math.min(acts.length - 1, film.state.act + 1));
    else if (e.code === 'ArrowLeft') goto(Math.max(0, film.state.act - 1));
    else if (e.key === 'm' || e.key === 'M') $('voice').click();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && film?.state.playing) toggle(); });
  window.addEventListener('pagehide', () => { stopSpeech(); film?.destroy(); });
  $('retry').onclick = () => location.reload();

  /* ---------------- load the 3D film ---------------- */
  try {
    const [{ playCinematic }, vehicle] = await Promise.all([
      import('./story-player.js'),
      story.car ? import('../vehicles/rangerover_compound.js') : Promise.resolve(null),
    ]);
    const carBuilder = vehicle ? (c, r) => vehicle.buildRangeRover3D(c, r) : null;
    film = await playCinematic($('filmCanvas'), {
      acts,
      onProgress: (p, label) => { $('loadfill').style.width = `${Math.max(6, Math.round(p * 100))}%`; $('loadtxt').textContent = label.toUpperCase(); },
      onAct: (a, i) => showAct(a, i),
      onTick: tick,
      holdAct: () => speaking && voiceOn,
      onEnd,
      onError: showError,
    }, carBuilder);
    loaded = true;
    if (/[?&]debug\b/.test(location.search)) window.__film = film; // QA hook: scrub(actIndex, 0..1)
    $('loadbar').style.display = 'none';
    $('loadtxt').textContent = '';
    $('start').disabled = false;
    $('start').focus?.({ preventScroll: true });
    if (/[?&]autoplay\b/.test(location.search) || location.hash === '#play') begin();
  } catch (err) { showError(err); }
}

export { STORIES };
