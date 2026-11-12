import { Profile } from "./profile.js";
import { Economy } from "./economy.js";
import { Auth } from "./auth.js";

/* The single canonical home place (see places/myhouse). */
export const HOME_PLACE_ID = "myhouse";

export const HOUSE_CATALOG = [
  { id:"starter_flat", name:"1-BEDROOM FLAT", price:0, beds:1, tier:"starter", style:"starter", styleName:"Compact City Flat", features:"Simple layout · low upkeep", desc:"A practical first home.", buildKey:"flat1" },
  { id:"studio_plus", name:"2-BEDROOM APARTMENT", price:4500000, beds:2, tier:"basic", style:"urban", styleName:"Modern Urban", features:"Open-plan lounge · balcony", desc:"A modern apartment for city living.", buildKey:"flat2" },
  { id:"townhouse", name:"TOWNHOUSE", price:18000000, beds:3, tier:"townhouse", style:"warm", styleName:"Contemporary Townhouse", features:"Private garden · family lounge", desc:"A multi-level family home with garden space.", buildKey:"flat2" },
  { id:"bungalow", name:"MODERN BUNGALOW", price:32000000, beds:4, tier:"bungalow", style:"earth", styleName:"Modern Bungalow", features:"Wide living room · courtyard", desc:"Single-level family home with a courtyard feel.", buildKey:"flat10" },
  { id:"duplex", name:"LUXURY DUPLEX", price:68000000, beds:5, tier:"duplex", style:"royal", styleName:"Royal Duplex", features:"Grand staircase · premium finish", desc:"A two-storey home with a formal entertaining space.", buildKey:"flat10" },
  { id:"villa", name:"COASTAL VILLA", price:125000000, beds:6, tier:"villa", style:"coastal", styleName:"Coastal Villa", features:"Poolside mood · sea-glass palette", desc:"A spacious retreat inspired by waterfront living.", buildKey:"flat10" },
  { id:"mansion", name:"GRAND MANSION", price:280000000, beds:8, tier:"estate", style:"estate", styleName:"Grand Estate", features:"Formal reception · executive finish", desc:"A landmark residence with a grand entertaining style.", buildKey:"mansion" },
];

export const Houses = {
  /* "mansion" (full 11-room house) for the admin and anyone who has bought
     a home; "starter" (compact 2-bed flat) for everyone else. Same building,
     same exterior, same entry points: only the number of rooms differs. */
  homeTier() {
    try {
      if (this.isAdminHome()) return "mansion";
      const h = Profile.home();
      return (h && h !== "starter_flat") ? "mansion" : "starter";
    } catch (e) { return "starter"; }
  },
  isAdminHome() {
    try {
      const u = Auth.user && Auth.user.username ? Auth.user.username.toLowerCase() : '';
      return u === 'clintont';
    } catch (e) { return false; }
  },

  catalog() { return HOUSE_CATALOG; },
  owned() { return Profile.houses(); },
  home() { return Profile.home(); },

  /* Map from a house id to the interior build key. Used by
     house-interior.js and travel scene. */
  buildKeyFor(id) {
    const h = HOUSE_CATALOG.find(x => x.id === id);
    return h ? h.buildKey : "flat1";
  },

  /* Single source of truth for "take me home": the player's profile home → build key.
     Used by first login, the phone Go Home button and the drive-scene blackout screen. */
  goHome(router /*, forceStarter (kept for old callers, ignored) */) {
    /* ONE house. Login, the phone's Go Home button, the drive-scene blackout
       screen, the map app and the world landmark all open the same interior
       (places/myhouse). Which tier you "own" no longer swaps the building. */
    return router.go("interior", { id: HOME_PLACE_ID });
  },

  priceOf(id) {
    const h = HOUSE_CATALOG.find(x => x.id === id);
    return h ? h.price : 0;
  },

  canAfford(id) {
    const p = this.priceOf(id);
    return Economy.balance >= p;
  },

  async buy(id) {
    const h = HOUSE_CATALOG.find(x => x.id === id);
    if (!h) return { ok:false, reason:"no_house" };
    if (Profile.hasHouse(id)) return { ok:false, reason:"already_owned" };
    if (h.price === 0) {
      await Profile.addHouse(id);
      return { ok:true, house:h };
    }
    if (!this.canAfford(id)) return { ok:false, reason:"no_money" };
    Economy.withdraw(h.price);
    await Profile.addHouse(id);
    if (Auth.user) {
      await Auth.save({ balance: Economy.balance, houses: Profile.houses() });
    }
    return { ok:true, house:h };
  },

  async setHome(id) {
    await Profile.setHome(id);
    if (Auth.user) {
      await Auth.save({ home: id });
    }
    return { ok:true };
  },
};

try { window.__ph3d_goHome = (r, f) => Houses.goHome(r || window.__ph3d_router, f); } catch (e) {}
