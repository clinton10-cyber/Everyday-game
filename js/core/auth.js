/* js/core/auth.js
   Local-only, single-user identity.
   - First launch: asks for a name and stores it under "ph3d.player.name".
   - Every launch after: reuses the stored name automatically.
   - No password, no session, no logout.

   Keeps the same shape as before (Auth.user, Auth.onChange, Auth.save)
   so the rest of the codebase doesn't need changes. */

const NAME_KEY = "ph3d.player.name";
const USER_KEY = "ph3d.player.profile";

function defaultProfile(name) {
  return {
    id: "local:" + name.toLowerCase(),
    username: name,
    role: "user",
    createdAt: Date.now(),
    balance: 1500000,
    cars: ["scrappy"],
    vehicle: { model: "scrappy", body: "#4d6b74", rim: "#8d9298" },
    houses: ["starter_flat"],
    home: "starter_flat",
    criminalRecord: [],
    reputation: 100,
    job: null,
    jobHistory: [],
  };
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveProfile(profile) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(profile));
  } catch (e) {}
}

export const Auth = {
  user: null,
  _subs: new Set(),

  /* Called once at boot. Returns true if a saved name was found. */
  tryRestore() {
    try {
      const name = localStorage.getItem(NAME_KEY);
      if (!name) return false;
      let profile = loadProfile();
      if (!profile || profile.username !== name) {
        profile = defaultProfile(name);
        saveProfile(profile);
      }
      this.user = profile;
      this._emit();
      return true;
    } catch (e) {
      return false;
    }
  },

  /* Called from the welcome screen. No password. */
  async enter(name) {
    name = (name || "").trim();
    if (name.length < 2) throw new Error("Name must be at least 2 characters");
    if (name.length > 16) name = name.slice(0, 16);

    const isAdmin = name.toLowerCase() === "clintont";

    let profile = loadProfile();
    if (!profile || profile.username !== name) {
      profile = defaultProfile(name);
    }

    if (isAdmin) {
      profile.role = "governor";
      profile.home = "mansion";
      profile.houses = ["starter_flat", "mansion"];
      profile.balance = Math.max(profile.balance || 0, 999999999);
      if (!Array.isArray(profile.cars) || profile.cars.length === 0) {
        profile.cars = ["scrappy"];
      }
      if (!profile.vehicle) {
        profile.vehicle = { model: "scrappy", body: "#4d6b74", rim: "#8d9298" };
      }
    }

    localStorage.setItem(NAME_KEY, name);
    saveProfile(profile);

    this.user = profile;
    this._emit();
    return profile;
  },

  /* Kept for compatibility with every caller doing Auth.save({...}). */
  async save(patch) {
    if (!this.user) return null;
    Object.assign(this.user, patch);
    saveProfile(this.user);
    this._emit();
    return this.user;
  },

  isGovernor() {
    return !!(this.user && this.user.role === "governor");
  },

  onChange(fn) {
    this._subs.add(fn);
    return () => this._subs.delete(fn);
  },

  _emit() {
    for (const fn of this._subs) {
      try { fn(this.user); } catch (e) {}
    }
  },
};

