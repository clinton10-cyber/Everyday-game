/* Rooms index for My House.
   Merges the layout metadata from _meta.js with the builder
   functions from the individual room files. Previously the layout
   was in _meta.js but interior.js read x/z/w/d from this file --
   which returned undefined, causing NaN geometry and a crash. */
import { ROOM_LAYOUT } from "./_meta.js";
import corridor from "./corridor.js";
import living from "./living.js";
import kitchen from "./kitchen.js";
import library from "./library.js";
import bedroomA from "./bedroomA.js";
import bathA from "./bathA.js";
import bedroomB from "./bedroomB.js";
import bedroomC from "./bedroomC.js";
import bathC from "./bathC.js";
import bedroomD from "./bedroomD.js";
import bedroomE from "./bedroomE.js";

const BUILDERS = {
  corridor: corridor,
  living: living,
  kitchen: kitchen,
  library: library,
  bedroomA: bedroomA,
  bathA: bathA,
  bedroomB: bedroomB,
  bedroomC: bedroomC,
  bathC: bathC,
  bedroomD: bedroomD,
  bedroomE: bedroomE,
};

export const ROOMS = ROOM_LAYOUT.map(function (meta) {
  const b = BUILDERS[meta.id];
  const buildFn = (b && typeof b.build === "function")
    ? b.build
    : function () {};
  return Object.assign({}, meta, { build: buildFn });
});

