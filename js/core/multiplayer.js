/* ═══════════════════════════════════════════════════════════════
   Multiplayer — local-first via BroadcastChannel.
   Protocol:
     join    { id, name, look, car, mode, scene }
     here    { id, name, look, car, mode, scene }
     leave   { id }
     state   { id, x, z, yaw, mode, scene }   12 Hz
     avatar  { id, look, car }                on change
     chat    { id, name, text }
     action  { id, name, kind, data }         gameplay events
   ═══════════════════════════════════════════════════════════════ */
export const Multiplayer = {
  self: null,
  players: new Map(),
  channel: null,
  ready: false,
  mode: "idle",       // "walk" | "drive" | "idle"
  scene: "city",
  look: null,
  car: null,
  _pt: 0,
  _last: { x: 0, z: 0, yaw: 0 },

  onJoin: null,
  onLeave: null,
  onChat: null,
  onMove: null,
  onAction: null,
  onVoice: null,
  onVoiceAction: null,
  onAvatar: null,

  init(name) {
    if (this.ready) return;
    this.self = { id: "p_" + Math.random().toString(36).slice(2, 8), name: name || "Player" };
    // Seed look/car from globals set by main.js
    try { this.look = (window.__ph3d_wardrobe && window.__ph3d_wardrobe.config) || null; } catch (e) {}
    try {
      const v = window.__ph3d_state && window.__ph3d_state.vehicle;
      if (v) this.car = { model: v.model, body: v.body, rim: v.rim };
    } catch (e) {}

    try {
      this.channel = new BroadcastChannel("ph3d-mp");
      this.channel.addEventListener("message", e => this._on(e.data));
      this._sendJoin();
      window.addEventListener("beforeunload", () => this._send({ t: "leave", id: this.self.id }));
      this.ready = true;
      console.log("%c[mp]","background:#5ee0ff;color:#04121c;font-weight:bold;padding:2px 6px;border-radius:4px","joined as " + this.self.name);
    } catch (e) { console.warn("[mp]", e); }
  },

  _send(m) { if (!this.channel) return; try { this.channel.postMessage(m); } catch (e) {} },

  _sendJoin() {
    this._send({
      t: "join",
      id: this.self.id,
      name: this.self.name,
      look: this.look,
      car: this.car,
      mode: this.mode,
      scene: this.scene,
    });
  },

  _on(m) {
    if (!m || !this.self || m.id === this.self.id) return;

    if (m.t === "join" || m.t === "here") {
      if (!this.players.has(m.id)) {
        const p = {
          id: m.id,
          name: m.name,
          x: 0, z: 0, yaw: 0,
          mode: m.mode || "idle",
          scene: m.scene || "city",
          look: m.look || null,
          car: m.car || null,
          lastUpdate: performance.now(),
        };
        this.players.set(m.id, p);
        this.onJoin && this.onJoin(p);
      } else {
        // update metadata
        const p = this.players.get(m.id);
        if (m.look) p.look = m.look;
        if (m.car)  p.car = m.car;
        if (m.mode) p.mode = m.mode;
        if (m.scene) p.scene = m.scene;
      }
      if (m.t === "join") {
        // reply with our current metadata
        this._send({
          t: "here",
          id: this.self.id,
          name: this.self.name,
          look: this.look,
          car: this.car,
          mode: this.mode,
          scene: this.scene,
        });
      }
    } else if (m.t === "leave") {
      const p = this.players.get(m.id);
      this.players.delete(m.id);
      p && this.onLeave && this.onLeave(p);
    } else if (m.t === "state") {
      const p = this.players.get(m.id);
      if (p) {
        p.x = m.x; p.z = m.z; p.yaw = m.yaw;
        p.mode = m.mode || p.mode;
        p.scene = m.scene || p.scene;
        p.lastUpdate = performance.now();
        this.onMove && this.onMove(p);
      }
    } else if (m.t === "avatar") {
      const p = this.players.get(m.id);
      if (p) {
        p.look = m.look || p.look;
        p.car  = m.car  || p.car;
        this.onAvatar && this.onAvatar(p);
      }
    } else if (m.t === "chat") {
      this.onChat && this.onChat({ from: m.name, text: m.text, time: Date.now() });
    } else if (m.t === "voice") {
      this.onVoice && this.onVoice(m);
    } else if (m.t === "action") {
      this.onVoiceAction && this.onVoiceAction(m);
      this.onAction && this.onAction(m);
    }
  },

  /* ── outgoing ── */
  updatePos(x, z, yaw, mode) {
    if (!this.ready) return;
    const now = performance.now();
    if (now - this._pt < 80) return;
    this._pt = now;
    this._last.x = x; this._last.z = z; this._last.yaw = yaw;
    if (mode) this.mode = mode;
    this._send({
      t: "state",
      id: this.self.id,
      x, z, yaw,
      mode: this.mode,
      scene: this.scene,
    });
  },

  setMode(mode, scene) {
    this.mode = mode || this.mode;
    if (scene) this.scene = scene;
    this._send({
      t: "state",
      id: this.self.id,
      x: this._last.x, z: this._last.z, yaw: this._last.yaw,
      mode: this.mode,
      scene: this.scene,
    });
  },

  broadcastLook(look) {
    this.look = look;
    this._send({ t: "avatar", id: this.self.id, look });
  },

  broadcastCar(car) {
    this.car = car;
    this._send({ t: "avatar", id: this.self.id, car });
  },

  chat(text) {
    if (!this.ready || !text) return;
    this._send({ t: "chat", id: this.self.id, name: this.self.name, text });
    this.onChat && this.onChat({ from: this.self.name, text, time: Date.now() });
  },

  action(kind, data) {
    if (!this.ready) return;
    this._send({ t: "action", id: this.self.id, name: this.self.name, kind, data: data || {} });
  },
};

