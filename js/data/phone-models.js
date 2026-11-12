/* js/data/phone-models.js -- phones sold at the Phone Shop. Prices in naira.
   tier: budget | mid | flagship. Specs are display-only. */
const P = (id, brand, name, price, tier, color, specs) => ({ id, brand, name, price, tier, color, specs });

export const PHONE_MODELS = [
  P("itel_a18",   "itel",     "A18",          38000,  "budget",   0x2b3a55, { ram: "2 GB",  storage: "32 GB",  cam: "5 MP",   battery: "3000 mAh" }),
  P("tecno_spark","Tecno",    "Spark Go",     72000,  "budget",   0x1f6f5c, { ram: "3 GB",  storage: "64 GB",  cam: "13 MP",  battery: "5000 mAh" }),
  P("infinix_hot","Infinix",  "Hot 40",      118000,  "mid",      0x8a3ffc, { ram: "4 GB",  storage: "128 GB", cam: "50 MP",  battery: "5000 mAh" }),
  P("redmi_note", "Xiaomi",   "Redmi Note 13",165000, "mid",      0x2d2d2d, { ram: "6 GB",  storage: "128 GB", cam: "108 MP", battery: "5000 mAh" }),
  P("galaxy_a",   "Samsung",  "Galaxy A35",  295000,  "mid",      0x4a7fd1, { ram: "8 GB",  storage: "256 GB", cam: "50 MP",  battery: "5000 mAh" }),
  P("pixel_8",    "Google",   "Pixel 8",     640000,  "flagship", 0xe8e4dc, { ram: "8 GB",  storage: "128 GB", cam: "50 MP",  battery: "4575 mAh" }),
  P("iphone_15",  "Apple",    "iPhone 15",   980000,  "flagship", 0x18181a, { ram: "6 GB",  storage: "128 GB", cam: "48 MP",  battery: "3349 mAh" }),
  P("galaxy_s24", "Samsung",  "Galaxy S24 Ultra", 1450000, "flagship", 0x6a6f78, { ram: "12 GB", storage: "512 GB", cam: "200 MP", battery: "5000 mAh" }),
];
export const PHONE_BY_ID = Object.fromEntries(PHONE_MODELS.map((p) => [p.id, p]));
