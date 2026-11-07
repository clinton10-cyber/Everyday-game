/* ============================================================
   Admin - identity + "around" state.
   Admin is clintont. Only admin owns the mansion.
   "Around" means the admin's client currently has the mansion
   scene loaded - used by guards to decide whether visitors
   can enter.
   ============================================================ */
import { Multiplayer } from "./multiplayer.js";

const ADMIN_NAME = "clintont";

export const Admin = {
  USERNAME: ADMIN_NAME,

  isMe(auth) {
    if (!auth || !auth.user) return false;
    const u = auth.user.username || "";
    return u.toLowerCase() === ADMIN_NAME;
  },

  isAdminUser(user) {
    if (!user) return false;
    const u = user.username || "";
    return u.toLowerCase() === ADMIN_NAME || user.role === "governor";
  },

  /* Any client can call this - but only the admin's client
     should broadcast true. Visitors read it to gate entry. */
  around: false,
  _awayTimer: null,

  setAround(value) {
    if (this.around === value) return;
    this.around = value;
    Multiplayer.action("admin-around", { around: value });
    if (window.__ph3d_phone) {
      window.__ph3d_phone._toast(value ? "\uD83C\uDFE1 Admin is home" : "\uD83C\uDFE1 Admin has left");
    }
  },

  /* When admin enters the mansion scene */
  onAdminEnterMansion() {
    if (Admin.isMe(window.__ph3d_auth)) {
      this.setAround(true);
      /* schedule auto-away in 90s of inactivity - resets on move */
      this._resetAwayTimer();
    }
  },

  /* Called from admin's update loop when they move */
  pingActivity() {
    if (!Admin.isMe(window.__ph3d_auth)) return;
    this._resetAwayTimer();
  },

  _resetAwayTimer() {
    if (this._awayTimer) clearTimeout(this._awayTimer);
    this._awayTimer = setTimeout(() => {
      this.setAround(false);
    }, 90000);
  },

  /* Called by visitors when entering the gate zone */
  canEnter() {
    return this.around;
  },

  /* Receive remote broadcast */
  receive(m) {
    if (!m || !m.data) return;
    if (m.kind === "admin-around") {
      this.around = !!m.data.around;
      if (window.__ph3d_phone) {
        window.__ph3d_phone._toast(this.around ? "\uD83C\uDFE1 Admin is home" : "\uD83C\uDFE1 Admin has left");
      }
    }
  },
};

