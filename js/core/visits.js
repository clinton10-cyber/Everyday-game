import { Multiplayer } from "./multiplayer.js";

const STORE_KEY = "ph3d.visits.v1";
const REQUEST_TIMEOUT_MS = 30000;

export const QUICK_REASONS = [
  { id: "social",   label: "Just visiting",   icon: "\uD83D\uDC4B" },
  { id: "delivery", label: "Delivery",        icon: "\uD83D\uDCE6" },
  { id: "business", label: "Business",        icon: "\uD83D\uDCBC" },
  { id: "repair",   label: "Repair work",     icon: "\uD83D\uDD27" },
  { id: "police",   label: "Police business", icon: "\uD83D\uDE94" },
  { id: "party",    label: "Party",           icon: "\uD83C\uDF89" },
  { id: "trade",    label: "Trade / sell",    icon: "\uD83D\uDCB0" },
  { id: "other",    label: "Other",           icon: "\u270F\uFE0F" },
];

export const Visits = {
  outgoing: [],
  incoming: [],
  onIncoming: null,
  onResponse: null,

  load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        this.outgoing = d.outgoing || [];
      }
    } catch (e) {}
    return this;
  },
  save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ outgoing: this.outgoing.slice(-30) }));
    } catch (e) {}
  },

  request(playerId, playerName, reason, reasonLabel, placeId) {
    if (!Multiplayer.ready) return { ok: false, reason: "no_mp" };
    if (!playerId) return { ok: false, reason: "no_target" };
    const trimmed = (reason || "").trim().slice(0, 180);
    if (!trimmed) return { ok: false, reason: "no_reason" };

    const req = {
      id: "vr_" + Math.random().toString(36).slice(2, 8),
      toId: playerId,
      toName: playerName,
      reason: trimmed,
      reasonLabel: reasonLabel || "",
      at: Date.now(),
      status: "pending",
      place: placeId || "myhouse",
    };
    this.outgoing.push(req);
    this.save();

    Multiplayer.action("visit-request", {
      to: playerId,
      requestId: req.id,
      reason: trimmed,
      reasonLabel: req.reasonLabel,
      place: req.place,
      fromName: (Multiplayer.self && Multiplayer.self.name) || "Guest",
    });

    if (window.__ph3d_phone) window.__ph3d_phone._toast("\u2709\uFE0F Visit request sent");
    return { ok: true, req };
  },

  receive(m) {
    const req = {
      id: m.data.requestId,
      fromId: m.id,
      fromName: m.data.fromName || m.name || "Guest",
      reason: m.data.reason || "",
      reasonLabel: m.data.reasonLabel || "",
      place: m.data.place || "myhouse",
      at: Date.now(),
      timer: REQUEST_TIMEOUT_MS,
    };
    this.incoming.push(req);
    this.onIncoming && this.onIncoming(req);
    if (window.__ph3d_phone) {
      window.__ph3d_phone._toast("\uD83D\uDD14 " + req.fromName + " wants to visit");
    }
    setTimeout(() => this.expire(req.id), REQUEST_TIMEOUT_MS);
  },

  accept(requestId) {
    const req = this.incoming.find(r => r.id === requestId);
    if (!req) return false;
    Multiplayer.action("visit-response", {
      to: req.fromId,
      requestId,
      accepted: true,
      place: req.place,
      hostName: (Multiplayer.self && Multiplayer.self.name) || "Host",
    });
    this.incoming = this.incoming.filter(r => r.id !== requestId);
    if (window.__ph3d_phone) window.__ph3d_phone._toast("\u2705 Accepted " + req.fromName);
    return true;
  },

  deny(requestId) {
    const req = this.incoming.find(r => r.id === requestId);
    if (!req) return false;
    Multiplayer.action("visit-response", {
      to: req.fromId,
      requestId,
      accepted: false,
      reason: "host_denied",
    });
    this.incoming = this.incoming.filter(r => r.id !== requestId);
    if (window.__ph3d_phone) window.__ph3d_phone._toast("\u274C Denied " + req.fromName);
    return true;
  },

  expire(requestId) {
    const req = this.incoming.find(r => r.id === requestId);
    if (!req) return;
    this.incoming = this.incoming.filter(r => r.id !== requestId);
    Multiplayer.action("visit-response", {
      to: req.fromId,
      requestId,
      accepted: false,
      reason: "expired",
    });
  },

  response(m) {
    const req = this.outgoing.find(r => r.id === m.data.requestId);
    if (req) {
      req.status = m.data.accepted ? "accepted" : "denied";
      req.respondedAt = Date.now();
      if (m.data.reason) req.denyReason = m.data.reason;
      this.save();
    }
    this.onResponse && this.onResponse(m.data, req);
    if (window.__ph3d_phone) {
      if (m.data.accepted) window.__ph3d_phone._toast("\u2705 Visit accepted");
      else {
        const reason = m.data.reason === "expired" ? " (expired)" : "";
        window.__ph3d_phone._toast("\u274C Visit denied" + reason);
      }
    }
  },

  hasPendingTo(playerId) {
    return this.outgoing.some(r => r.toId === playerId && r.status === "pending");
  },
  pendingCount() { return this.outgoing.filter(r => r.status === "pending").length; },
  incomingCount() { return this.incoming.length; },
};

