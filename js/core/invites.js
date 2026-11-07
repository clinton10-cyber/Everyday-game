/**
 * Invites - house invitations between players.
 *
 * Public API:
 *   Invites.invite(playerId, playerName, placeId)  - send
 *   Invites.accept(inviteId)                       - accept
 *   Invites.decline(inviteId)                      - decline
 */

import { Multiplayer } from "./multiplayer.js";

const KEY = "ph3d.invites.v1";

export const Invites = {
  sent: [], received: [],
  _onReceive: null, _onAccept: null,

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const d = JSON.parse(raw); this.sent = d.sent || []; }
    } catch (e) {}
    return this;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify({ sent: this.sent.slice(-30) })); } catch (e) {} },

  invite(playerId, playerName, placeId) {
    if (!Multiplayer.ready) return { ok:false, reason:"no_mp" };
    const inv = { id:"i_" + Math.random().toString(36).slice(2,8),
      toId:playerId, toName:playerName, place:placeId || "myhouse", at:Date.now() };
    this.sent.push(inv);
    this.save();
    Multiplayer.action("invite", {
      to: playerId, inviteId: inv.id, place: inv.place,
      fromName: (Multiplayer.self && Multiplayer.self.name) || "Player",
    });
    return { ok:true, invite:inv };
  },

  receive(m) {
    const inv = {
      id: m.data.inviteId,
      fromId: m.id,
      fromName: m.data.fromName || m.name || "Player",
      place: m.data.place || "myhouse",
      time: Date.now(),
    };
    this.received.push(inv);
    this._onReceive && this._onReceive(inv);
    if (window.__ph3d_phone) window.__ph3d_phone._toast("\uD83C\uDFE0 " + inv.fromName + " invited you");
  },

  accept(inviteId) {
    const inv = this.received.find(x => x.id === inviteId);
    if (!inv) return false;
    Multiplayer.action("invite-accept", { to: inv.fromId, inviteId, place: inv.place });
    this.received = this.received.filter(x => x.id !== inviteId);
    this._onAccept && this._onAccept(inv);
    return true;
  },

  decline(inviteId) {
    const inv = this.received.find(x => x.id === inviteId);
    if (!inv) return false;
    Multiplayer.action("invite-decline", { to: inv.fromId, inviteId });
    this.received = this.received.filter(x => x.id !== inviteId);
    return true;
  },

  onReceive(fn) { this._onReceive = fn; },
  onAccept(fn) { this._onAccept = fn; },
};

