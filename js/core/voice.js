/* ═══════════════════════════════════════════════════════════════
   VOICE — proximity-based push-to-talk.

   Volume comes from distance:
     < 2 m   → 100%   (right next to you)
     2–6 m   → 100→70% (conversation range)
     6–12 m  → 70→35%  (nearby)
     12–20 m → 35→10%  (distant, murky)
     > 20 m  → 0%      (out of range)

   Listen mode:
     • tap LISTEN on any nearby player in the panel
     • you hear them at full gain (regardless of distance)
     • they see a small ear icon above their head + a toast
     • tap again to stop
   ═══════════════════════════════════════════════════════════════ */
import { Multiplayer } from "./multiplayer.js";

const CHUNK_MS = 220;
const RANGE_FULL = 2;      // metres at 100% gain
const RANGE_NEAR = 6;      // start of falloff
const RANGE_MID  = 12;     // still audible, quiet
const RANGE_FAR  = 20;     // out of range
const LISTEN_TIMEOUT_MS = 12000; // auto-stop listen after 12s of silence

export const Voice = {
  enabled: false,
  talking: false,
  muted: false,
  _stream: null,
  _recorder: null,
  _interval: 0,
  _gain: null,
  _active: new Set(),
  _lastBySender: new Map(),
  _lastReceive: 0,

  /* Who I'm listening to: Set of remote player ids */
  listeningTo: new Set(),

  /* Who is listening to me: Set of remote player ids */
  listeners: new Set(),

  /* Called whenever the state changes, for the UI to refresh */
  onChange: null,

  async enable() {
    if (this.enabled) return { ok:true };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { ok:false, reason:"no_media" };
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:true },
        video: false,
      });
      this._stream = stream;
      this.enabled = true;

      /* Broadcast "voice-on" so others know we can talk */
      try {
        Multiplayer.action("voice-state", { on: true });
      } catch (e) {}

      console.log("%c[voice]","background:#7dff9b;color:#031a0d;font-weight:bold;padding:2px 6px;border-radius:4px","mic enabled");
      this._fireChange();
      return { ok:true };
    } catch (e) {
      return { ok:false, reason:"denied", err:String(e) };
    }
  },

  disable() {
    if (!this.enabled) return;
    this.stopTalk();
    this.listeningTo.clear();
    this.listeners.clear();
    try { Multiplayer.action("voice-state", { on:false }); } catch (e) {}
    if (this._stream) {
      for (const t of this._stream.getTracks()) t.stop();
      this._stream = null;
    }
    this.enabled = false;
    this._fireChange();
    if (window.__ph3d_phone) window.__ph3d_phone._toast("🎙 Mic off");
  },

  /* ── Push-to-talk ────────────────────────────────────── */
  async startTalk() {
    if (!this.enabled || this.talking) return false;
    try {
      const rec = new MediaRecorder(this._stream, { mimeType: this._pickMime() });
      this._recorder = rec;
      rec.ondataavailable = (ev) => {
        if (!ev.data || !ev.data.size) return;
        ev.data.arrayBuffer().then(buf => this._sendChunk(buf)).catch(()=>{});
      };
      rec.start(CHUNK_MS);
      this._interval = setInterval(() => {
        if (rec.state === "recording") { try { rec.requestData(); } catch (e) {} }
      }, CHUNK_MS);
      this.talking = true;

      /* Broadcast my position at the moment I start talking —
         the receivers use it to compute their own gain curve. */
      try { Multiplayer.action("voice-start", { at: Date.now() }); } catch (e) {}

      console.log("%c[voice]","background:#ff5c5c;color:#fff;font-weight:bold;padding:2px 6px;border-radius:4px","TALKING");
      this._fireChange();
      return true;
    } catch (e) { return false; }
  },

  stopTalk() {
    if (!this.talking) return;
    clearInterval(this._interval);
    if (this._recorder) { try { this._recorder.stop(); } catch (e) {} this._recorder = null; }
    this.talking = false;
    try { Multiplayer.action("voice-stop", { at: Date.now() }); } catch (e) {}
    this._fireChange();
  },

  _pickMime() {
    const c = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    for (const m of c) {
      try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {}
    }
    return "";
  },

  _sendChunk(buffer) {
    if (!Multiplayer.ready) return;
    try {
      const arr = new Uint8Array(buffer);
      /* Chunk into ~8 KB pieces so BroadcastChannel stays snappy */
      const CHUNK = 8000;
      for (let i = 0; i < arr.length; i += CHUNK) {
        const slice = arr.subarray(i, i + CHUNK);
        Multiplayer._send({
          t: "voice",
          id: Multiplayer.self.id,
          name: Multiplayer.self.name,
          chunk: Array.from(slice),
        });
      }
    } catch (e) {}
  },

  /* ── Receive ─────────────────────────────────────────── */
  receive(m) {
    if (!this.enabled) return;
    if (!m.chunk || !m.chunk.length) return;

    this._lastReceive = performance.now();
    this._active.add(m.id);
    this._lastBySender.set(m.id, performance.now());
    this.onChange && this.onChange();

    /* Compute gain from distance to sender + listen state */
    const gain = this._gainFor(m.id);

    /* Auto-drop listen if the peer went silent for too long */
    if (this.listeningTo.has(m.id)) {
      clearTimeout(this._listenTimers && this._listenTimers.get(m.id));
      if (!this._listenTimers) this._listenTimers = new Map();
      this._listenTimers.set(m.id, setTimeout(() => {
        if (performance.now() - (this._lastBySender.get(m.id) || 0) > LISTEN_TIMEOUT_MS) {
          this.stopListen(m.id);
        }
      }, LISTEN_TIMEOUT_MS + 100));
    }

    /* Play with gain */
    try {
      const bytes = new Uint8Array(m.chunk);
      const blob = new Blob([bytes], { type: this._pickMime() || "audio/webm" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = Math.max(0, Math.min(1, gain));
      if (gain > 0.01) {
        audio.play().catch(()=>{});
      }
      audio.onended = () => URL.revokeObjectURL(url);
    } catch (e) {}
  },

  /* ── Gain curve ──────────────────────────────────────── */
  _gainFor(peerId) {
    /* If we're listening to this peer, always full gain */
    if (this.listeningTo.has(peerId)) return 1.0;

    /* Otherwise, falloff by distance */
    const dist = this._distanceTo(peerId);
    if (dist == null) return 1.0;   // unknown position → assume close
    if (dist <= RANGE_FULL) return 1.00;
    if (dist <= RANGE_NEAR) {
      const t = (dist - RANGE_FULL) / (RANGE_NEAR - RANGE_FULL);
      return 1.00 - t * 0.30;       // 100% → 70%
    }
    if (dist <= RANGE_MID) {
      const t = (dist - RANGE_NEAR) / (RANGE_MID - RANGE_NEAR);
      return 0.70 - t * 0.35;       // 70% → 35%
    }
    if (dist <= RANGE_FAR) {
      const t = (dist - RANGE_MID) / (RANGE_FAR - RANGE_MID);
      return 0.35 - t * 0.25;       // 35% → 10%
    }
    return 0.0;
  },

  _distanceTo(peerId) {
    const p = Multiplayer.players.get(peerId);
    const me = Multiplayer.self && Multiplayer._last;
    if (!p || !me) return null;
    const dx = p.x - me.x;
    const dz = p.z - me.z;
    return Math.sqrt(dx*dx + dz*dz);
  },

  /* ── Listen mode ─────────────────────────────────────── */
  startListen(peerId) {
    if (!peerId) return false;
    this.listeningTo.add(peerId);
    try { Multiplayer.action("voice-listen", { to: peerId, on: true }); } catch (e) {}
    this._fireChange();
    return true;
  },

  stopListen(peerId) {
    if (!this.listeningTo.has(peerId)) return false;
    this.listeningTo.delete(peerId);
    try { Multiplayer.action("voice-listen", { to: peerId, on: false }); } catch (e) {}
    this._fireChange();
    return true;
  },

  toggleListen(peerId) {
    if (this.listeningTo.has(peerId)) this.stopListen(peerId);
    else this.startListen(peerId);
  },

  /* Called when a remote peer tells us THEY are listening to us. */
  receiveListenState(m) {
    if (!m || !m.data) return;
    const who = m.id;
    if (m.data.on) {
      this.listeners.add(who);
    } else {
      this.listeners.delete(who);
    }
    this._fireChange();
    if (window.__ph3d_phone) {
      const name = m.name || "Someone";
      if (m.data.on) window.__ph3d_phone._toast("👂 " + name + " is listening");
      else window.__ph3d_phone._toast("👂 " + name + " stopped listening");
    }
  },

  /* Called when a peer's voice-state changes (on/off) */
  receiveVoiceState(m) {
    if (!m || !m.data) return;
    if (m.data.on === false) {
      this._active.delete(m.id);
      this.onChange && this.onChange();
    }
  },

  isActive(id) { return this._active.has(id); },
  isListening(id) { return this.listeningTo.has(id); },
  isBeingListenedTo(id) { return this.listeners.has(id); },
  anyListener() { return this.listeners.size > 0; },

  /* Approximate distance label for UI */
  distanceLabel(peerId) {
    const d = this._distanceTo(peerId);
    if (d == null) return "?";
    if (d < 2) return "next to you";
    if (d < 6) return "close";
    if (d < 12) return "nearby";
    if (d < 20) return "distant";
    return "out of range";
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this._stream) {
      for (const t of this._stream.getAudioTracks()) t.enabled = !this.muted;
    }
    return this.muted;
  },

  _fireChange() {
    try { this.onChange && this.onChange(); } catch (e) {}
  },
};


/* Route incoming voice traffic from the multiplayer channel. */
Multiplayer.onVoice = (m) => Voice.receive(m);
Multiplayer.onVoiceAction = (m) => {
  if (m.kind === "voice-state") Voice.receiveVoiceState(m);
  else if (m.kind === "voice-listen" && m.data && Multiplayer.self && m.data.to === Multiplayer.self.id) Voice.receiveListenState(m);
};
