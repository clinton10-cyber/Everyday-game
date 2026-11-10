/* js/core/api.js
   Local-only profile storage helper.
   No HTTP, no sessions, no tokens. */

const USER_KEY = "ph3d.player.profile";

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

export const Api = {
  /* Kept for callers that still do `Api.mode === "remote"`. */
  mode: "local",

  async me() {
    return loadProfile();
  },

  async saveProfile(patch) {
    const profile = loadProfile();
    if (!profile) return null;
    Object.assign(profile, patch);
    saveProfile(profile);
    return profile;
  },

  logout() {
    /* Intentionally a no-op — there is no session to end. */
  },

  currentSession() {
    return null;
  },
};

