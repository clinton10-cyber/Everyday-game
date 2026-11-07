/* ═══════════════════════════════════════════════════════════════
   GANGS — create a gang, invite members, share a treasury.
   Local only for now — multiplayer sync uses Multiplayer.action.
   ═══════════════════════════════════════════════════════════════ */
import { Economy } from "./economy.js";
import { Multiplayer } from "./multiplayer.js";

const KEY = "ph3d.gang.v1";

export const Gangs = {
  myGang: null,          // { id, name, tag, members[], treasury }
  invites: [],           // incoming invites

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.myGang = JSON.parse(raw);
    } catch (e) {}
    return this;
  },
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.myGang)); } catch (e) {}
  },

  create(name, tag) {
    if (this.myGang) return { ok:false, reason:"already_in_gang" };
    if (!name || name.length < 3) return { ok:false, reason:"bad_name" };
    this.myGang = {
      id: "g_" + Math.random().toString(36).slice(2, 8),
      name, tag: (tag || "").toUpperCase().slice(0, 4),
      members: [{ id: (window.__ph3d_mp && window.__ph3d_mp.self.id) || "me",
                  name: (window.__ph3d_mp && window.__ph3d_mp.self.name) || "You",
                  rank: "LEADER", joined: Date.now() }],
      treasury: 0,
      territory: [],
      created: Date.now(),
    };
    this.save();
    Multiplayer.action("gang-create", { name, tag });
    return { ok:true, gang:this.myGang };
  },

  leave() {
    if (!this.myGang) return false;
    Multiplayer.action("gang-leave", { id:this.myGang.id });
    this.myGang = null;
    this.save();
    return true;
  },

  deposit(amount) {
    amount = Math.floor(Number(amount));
    if (!this.myGang) return { ok:false, reason:"no_gang" };
    if (!amount || amount <= 0) return { ok:false, reason:"bad_amount" };
    if (amount > Economy.balance) return { ok:false, reason:"over_balance" };
    Economy.withdraw(amount);
    this.myGang.treasury += amount;
    this.save();
    return { ok:true, treasury:this.myGang.treasury };
  },

  withdraw(amount) {
    amount = Math.floor(Number(amount));
    if (!this.myGang) return { ok:false, reason:"no_gang" };
    if (!amount || amount <= 0) return { ok:false, reason:"bad_amount" };
    if (amount > this.myGang.treasury) return { ok:false, reason:"over_treasury" };
    this.myGang.treasury -= amount;
    Economy.receive("GANG", amount, "from gang treasury");
    this.save();
    return { ok:true, treasury:this.myGang.treasury };
  },

  invitePlayer(id, name) {
    if (!this.myGang) return false;
    Multiplayer.action("gang-invite", { to:id, gang:this.myGang.id, name:this.myGang.name });
    return true;
  },

  /* Called from Multiplayer.onAction for gang events. */
  handleAction(m) {
    if (!m || !m.kind) return;
    if (m.kind === "gang-invite") {
      this.invites.push({ id:m.data.gang, from:m.name, name:m.data.name, time:Date.now() });
    } else if (m.kind === "gang-join" && this.myGang && m.data.gang === this.myGang.id) {
      this.myGang.members.push({ id:m.id, name:m.name, rank:"MEMBER", joined:Date.now() });
      this.save();
    }
  },
};

