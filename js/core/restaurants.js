import { Economy } from "./economy.js";
import { Pocket, POCKET_ITEMS } from "./pocket.js";
import { Combat } from "./combat.js";
import { Profile } from "./profile.js";

/* Food definitions — every item heals HP when eaten. */
export const FOOD_ITEMS = {
  jollof:    { id:"jollof",    name:"JOLLOF RICE",     icon:"🍚", price:1200,  heal:20, desc:"Smoky party jollof with grilled chicken." },
  egusi:     { id:"egusi",     name:"EGUSI SOUP",      icon:"🍲", price:1800,  heal:30, desc:"Rich egusi with pounded yam." },
  pepper:    { id:"pepper",    name:"PEPPER SOUP",     icon:"🥣", price:2500,  heal:35, desc:"Goat meat pepper soup, hot and clear." },
  suya:      { id:"suya",      name:"SUYA PLATTER",    icon:"🍢", price:2200,  heal:25, desc:"Spicy grilled skewers with onions." },
  pounded:   { id:"pounded",   name:"POUNDED YAM",     icon:"🥔", price:900,   heal:15, desc:"Fresh pounded yam, smooth and warm." },
  plantain:  { id:"plantain",  name:"FRIED PLANTAIN",  icon:"🍌", price:600,   heal:12, desc:"Sweet golden plantain slices." },
  puffpuff:  { id:"puffpuff",  name:"PUFF PUFF",       icon:"🍩", price:400,   heal:10, desc:"Golden fried dough balls, still hot." },
  chapman:   { id:"chapman",   name:"CHAPMAN",         icon:"🍹", price:800,   heal:12, desc:"The classic Lagos cocktail." },
  beer:      { id:"beer",      name:"STAR LAGER",      icon:"🍺", price:1000,  heal:8,  desc:"Ice-cold bottle of Star." },
  palmwine:  { id:"palmwine",  name:"PALM WINE",       icon:"🥂", price:700,   heal:10, desc:"Fresh from the tapper." },
  steak:     { id:"steak",     name:"STEAK DINNER",    icon:"🥩", price:5500,  heal:50, desc:"Ribeye, medium rare, with sides." },
  lobster:   { id:"lobster",   name:"GRILLED LOBSTER", icon:"🦞", price:9000,  heal:60, desc:"Fresh lobster from the Bonny coast." },
  champagne: { id:"champagne", name:"CHAMPAGNE",       icon:"🍾", price:15000, heal:20, desc:"A bottle of premium champagne." },
  brunch:    { id:"brunch",    name:"BRUNCH SET",      icon:"🥐", price:3500,  heal:40, desc:"Continental brunch for two." },
  coffee:    { id:"coffee",    name:"ESPRESSO",        icon:"☕", price:500,   heal:5,  desc:"Single shot, strong and dark." },
  cake:      { id:"cake",      name:"CHOCOLATE CAKE",  icon:"🍰", price:1500,  heal:18, desc:"Rich, dark, moist chocolate cake." },
};

/* Three restaurants — different vibes, different menus. */
export const RESTAURANTS = {
  greenBowl: {
    id:"greenBowl",
    name:"THE GREEN BOWL",
    sub:"PLEASURE PARK",
    tagline:"Fresh Nigerian classics",
    vibe:"Casual · outdoor seating",
    requireRep: 0,
    menu: ["jollof","egusi","pepper","suya","pounded","plantain","puffpuff","chapman"],
  },
  deltaGrill: {
    id:"deltaGrill",
    name:"DELTA GRILL",
    sub:"OMAGWA ROAD",
    tagline:"Coastal grill & bar",
    vibe:"Family · night view",
    requireRep: 0,
    menu: ["suya","steak","lobster","beer","palmwine","plantain","coffee","cake"],
  },
  skyline: {
    id:"skyline",
    name:"SKYLINE ROOFTOP",
    sub:"HOTEL PRESIDENTIAL",
    tagline:"Fine dining, high above the city",
    vibe:"Dress code · expensive",
    requireRep: 25,
    menu: ["steak","lobster","champagne","brunch","coffee","cake","chapman"],
  },
};

const KEY = "ph3d.restaurants.v1";

export const Restaurants = {
  myOrders: [],

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.myOrders = JSON.parse(raw) || [];
    } catch (e) {}
    return this;
  },
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.myOrders.slice(-30))); } catch (e) {}
  },

  /* Order a food item. Pay from bank, drop the food in the pocket. */
  order(restaurantId, foodId) {
    const venue = RESTAURANTS[restaurantId];
    const food  = FOOD_ITEMS[foodId];
    if (!venue) return { ok:false, reason:"no_restaurant" };
    if (!food)  return { ok:false, reason:"no_food" };
    if (venue.menu.indexOf(foodId) < 0) return { ok:false, reason:"not_on_menu" };

    /* reputation gate */
    let rep = 100;
    try { rep = Profile.reputation(); } catch (e) {}
    if (venue.requireRep > 0 && rep < venue.requireRep) {
      return { ok:false, reason:"low_rep", need:venue.requireRep };
    }

    /* money gate */
    if (Economy.balance < food.price) {
      return { ok:false, reason:"no_money", price:food.price };
    }

    /* pocket space gate */
    if (Pocket.isFull()) {
      return { ok:false, reason:"pocket_full" };
    }

    Economy.withdraw(food.price);
    Pocket.add(food.id, 1);

    this.myOrders.push({ venue: restaurantId, food: foodId, at: Date.now() });
    this.save();

    return { ok:true, food, price:food.price };
  },

  /* Eat a food item straight from the pocket. */
  eat(index) {
    const slot = Pocket.slots[index];
    if (!slot) return { ok:false, reason:"empty" };
    const food = FOOD_ITEMS[slot.id];
    if (!food) return { ok:false, reason:"not_food" };
    Pocket.remove(index);
    try { window.__ph3d_sfx && window.__ph3d_sfx.play(/water|juice|drink|zobo|soda|cola|beer|tea|milk/i.test(slot.id) ? "drink" : "eat"); } catch (_) {}
    Combat.heal(food.heal);
    return { ok:true, food, healed:food.heal };
  },
};

