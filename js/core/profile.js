import { Auth } from "./auth.js";
import { Economy } from "./economy.js";

export const Profile = {
  _bound: false,
  _syncing: false,

  init() {
    if (this._bound) return;
    this._bound = true;

    /* Auth → Economy: on login, adopt the saved balance. */
    Auth.onChange((u) => {
      if (!u) return;
      const bal = (typeof u.balance === "number") ? u.balance : 1500000;
      if (bal !== Economy.balance) {
        Economy.balance = bal;
        Economy._emit && Economy._emit();
      }
    });

    /* Economy → Auth: persist whenever money changes. */
    Economy.onChange(() => this._syncBalance());
  },

  async _syncBalance() {
    if (this._syncing) return;
    if (!Auth.user) return;
    if (Auth.user.balance === Economy.balance) return;

    this._syncing = true;
    try {
      await Auth.save({ balance: Economy.balance });
    } finally {
      this._syncing = false;
    }
    if (Auth.user && Auth.user.balance !== Economy.balance) {
      this._syncBalance();
    }
  },

  syncBalance() { return this._syncBalance(); },

  balance()    { return Auth.user ? Auth.user.balance || 0 : 0; },
  cars()       { return (Auth.user && Auth.user.cars) || []; },
  houses()     { return (Auth.user && Auth.user.houses) || []; },
  home()       { return (Auth.user && Auth.user.home) || "starter_flat"; },
  record()     { return (Auth.user && Auth.user.criminalRecord) || []; },
  reputation() { return (Auth.user && Auth.user.reputation) || 100; },
  job()        { return Auth.user && Auth.user.job; },

  hasCar(id)   { return this.cars().indexOf(id) >= 0; },
  hasHouse(id) { return this.houses().indexOf(id) >= 0; },
  isCriminal() { return this.record().length > 0; },

  async addCrime(kind) {
    if (!Auth.user) return;
    const rec = this.record().slice();
    rec.push({ kind, at: Date.now() });
    await Auth.save({ criminalRecord: rec });
  },

  async setJob(job) {
    if (!Auth.user) return;
    const hist = (Auth.user && Auth.user.jobHistory) || [];
    if (job) hist.push({ id: job.id, name: job.name, pay: job.pay, at: Date.now() });
    await Auth.save({ job: job || null, jobHistory: hist.slice(-30) });
  },

  async addCar(id) {
    if (!Auth.user) return;
    const cars = this.cars().slice();
    if (cars.indexOf(id) >= 0) return;
    cars.push(id);
    await Auth.save({ cars });
  },

  async addHouse(id) {
    if (!Auth.user) return;
    const houses = this.houses().slice();
    if (houses.indexOf(id) >= 0) return;
    houses.push(id);
    await Auth.save({ houses });
  },

  async setHome(id) {
    if (!Auth.user) return;
    if (!this.hasHouse(id)) return;
    await Auth.save({ home: id });
  },
};

