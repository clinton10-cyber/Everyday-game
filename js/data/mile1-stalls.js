/* js/data/mile1-stalls.js -- 65 unique items, one per Mile 1 Market stall slot, in slot order
   (row 0 to row 4, column 0 to column 12). Slot i always sells MILE1_STALLS[i].
   kind: "food" (heals) | "pocket" (goes to the bag, resellable at 60%) | "collectible" (recorded in the collection).
   icon is a two-letter tag, not an emoji. */
import { POCKET_ITEMS } from "../core/pocket.js";

const A = (id, label, icon, price, kind, heal, desc, extra) =>
  Object.assign({ id, label, icon, price, kind, heal: heal || 0, desc }, extra || {});

export const MILE1_STALLS = [
  A("yam_tuber", "YAM TUBERS", "YT", 1200, "food", 15, "Fresh tuber, good for pounded yam."),
  A("sweet_potato", "SWEET POTATOES", "SP", 800, "food", 12, "Sweet, starchy, roasted or boiled."),
  A("plantain_bunch", "PLANTAIN BUNCH", "PB", 1000, "food", 10, "Green bunch, ripens in a day or two."),
  A("cocoyam", "COCOYAM", "CO", 900, "food", 12, "For achicha and cocoyam porridge."),
  A("cassava_flour", "CASSAVA FLOUR", "CF", 1500, "food", 8, "Finely milled, ready for garri."),
  A("beans_white", "WHITE BEANS", "WB", 1800, "food", 14, "Brown-skinned beans, cleaned."),
  A("rice_local", "LOCAL RICE", "LR", 4500, "food", 20, "A bowl of home-grown rice."),
  A("garri", "GARRI", "GA", 1000, "food", 12, "Soak it or make eba."),
  A("palm_oil", "PALM OIL", "PO", 2200, "pocket", 0, "Red palm oil, fresh from the mill."),
  A("groundnut_oil", "GROUNDNUT OIL", "GO", 2500, "pocket", 0, "Clear oil, smells like roasted nuts."),
  A("pepper_mix", "PEPPER MIX", "PM", 600, "food", 8, "Blended pepper, onion and tomato."),
  A("tomatoes", "TOMATOES", "TO", 1400, "food", 6, "Basket of ripe red tomatoes."),
  A("onions", "ONIONS", "ON", 1100, "food", 6, "Large dry onions, keeps for weeks."),
  A("smoked_fish", "SMOKED FISH", "SF", 3200, "food", 18, "Dried over open smoke. Long shelf life."),
  A("dried_crayfish", "DRIED CRAYFISH", "DC", 2800, "pocket", 0, "Pounded crayfish for soup."),
  A("stockfish", "STOCKFISH", "ST", 4500, "pocket", 0, "Imported dried cod, for egusi."),
  A("catfish_live", "LIVE CATFISH", "LC", 3500, "food", 20, "Brought in from the creeks today."),
  A("snails_giant", "GIANT SNAILS", "GS", 2800, "pocket", 0, "African land snails, cleaned."),
  A("periwinkles", "PERIWINKLES", "PE", 1800, "pocket", 0, "Fresh creek periwinkles."),
  A("goat_meat", "GOAT MEAT", "GM", 5500, "food", 28, "Lean goat meat, cut to order."),
  A("chicken_live", "LIVE CHICKEN", "LC", 4500, "food", 22, "A healthy cockerel."),
  A("eggs_crate", "EGGS (CRATE)", "EC", 2200, "food", 12, "Thirty eggs, fresh this morning."),
  A("bitterleaf", "BITTERLEAF", "BI", 700, "food", 5, "For ofe onugbu and bitterleaf soup."),
  A("scentleaf", "SCENT LEAF", "SL", 500, "food", 4, "Aromatic, for pepper soup and moin-moin."),
  A("uziza_leaf", "UZIZA LEAVES", "UL", 800, "food", 5, "Peppery leaf, essential for oha soup."),
  A("okra_fresh", "FRESH OKRA", "FO", 900, "food", 6, "Tender okra, ready for draw soup."),
  A("ankara_fabric", "ANKARA FABRIC", "AF", 2500, "pocket", 0, "Two yards of bright wax print."),
  A("george_wrapper", "GEORGE WRAPPER", "GW", 8000, "collectible", 0, "Festive george cloth for owambe."),
  A("lace_material", "LACE MATERIAL", "LM", 6000, "pocket", 0, "Delicate lace by the yard."),
  A("aso_oke", "ASO OKE", "AO", 12000, "collectible", 0, "Handwoven Yoruba cloth. A keepsake."),
  A("coral_beads", "CORAL BEADS", "CB", 5000, "collectible", 0, "Traditional Benin coral beads."),
  A("wooden_comb", "WOODEN COMB", "WC", 800, "pocket", 0, "Carved wood, thumb-sized."),
  A("calabash_set", "CALABASH SET", "CS", 1500, "pocket", 0, "Two halves of a fresh calabash."),
  A("clay_pot", "CLAY POT", "CP", 2000, "pocket", 0, "For water or cooking."),
  A("broom_trad", "TRAD. BROOM", "TB", 900, "pocket", 0, "Gathered from palm ribs."),
  A("raffia_mat", "RAFFIA MAT", "RM", 2500, "pocket", 0, "Woven raffia, fits the parlour floor."),
  A("woven_basket", "WOVEN BASKET", "WB", 1800, "pocket", 0, "Sturdy cane basket."),
  A("wooden_spoons", "WOODEN SPOONS", "WS", 1200, "pocket", 0, "A pair, hand-carved."),
  A("carved_mask", "CARVED MASK", "CM", 4500, "collectible", 0, "Wall piece. Believed to guard the home."),
  A("charm_bracelet", "CHARM BRACELET", "CB", 2000, "pocket", 0, "Braided leather, small coin charm."),
  A("juju_amulet", "JUJU AMULET", "JA", 8000, "pocket", 0, "Protective amulet. Robbery heat -15% while you own it.", { heatReduce: 0.15 }),
  A("herbal_mixture", "HERBAL MIXTURE", "HM", 3500, "food", 8, "Bitters, for malaria and body pain."),
  A("bitter_kola", "BITTER KOLA", "BK", 1200, "food", 6, "Chew slowly, sip water after."),
  A("alligator_pepper", "ALLIGATOR PEPPER", "AP", 900, "pocket", 0, "Sharp and warm. For ceremonies."),
  A("native_chalk", "NATIVE CHALK (NZU)", "NC", 600, "pocket", 0, "Used to mark the ground."),
  A("kolanut", "KOLANUT", "KO", 1000, "food", 4, "Presented first at ceremonies.", { flag: "blessed" }),
  A("palm_kernel_oil", "PALM KERNEL OIL", "PK", 1500, "pocket", 0, "Dark, fragrant, for soap and soups."),
  A("shea_butter", "SHEA BUTTER", "SB", 2000, "pocket", 0, "Raw, unrefined, for skin."),
  A("black_soap", "BLACK SOAP", "BS", 1200, "pocket", 0, "Traditional osu, for washing."),
  A("camwood", "CAMWOOD POWDER", "CP", 1800, "pocket", 0, "Red powder for cosmetics."),
  A("sea_salt", "SEA SALT", "SS", 500, "food", 2, "Coarse sea salt, by the handful."),
  A("camphor_balls", "CAMPHOR BALLS", "CB", 400, "pocket", 0, "For wardrobes and prayer."),
  A("roasted_corn", "ROASTED CORN", "RC", 300, "food", 6, "Hot off the coal, with coconut."),
  A("boli_groundnut", "BOLI AND GROUNDNUT", "BG", 500, "food", 10, "PH special: roasted plantain and nuts."),
  A("coconut_fresh", "FRESH COCONUT", "FC", 600, "food", 8, "Drink the water, eat the meat."),
  A("sugarcane", "SUGARCANE", "SU", 400, "food", 5, "Chew for the juice."),
  A("agidi_leaf", "AGIDI (LEAF)", "AL", 500, "food", 8, "Cornmeal in a leaf, creamy."),
  A("akara_pap", "AKARA AND PAP", "AP", 700, "food", 12, "Fried bean cakes and warm pap."),
  A("moin_moin", "MOIN MOIN", "MM", 600, "food", 10, "Steamed bean pudding."),
  A("small_chops", "SMALL CHOPS", "SC", 1500, "food", 14, "Puff-puff, samosa, chin-chin mix."),
  A("tiger_nut_drink", "TIGER NUT DRINK", "TN", 800, "food", 8, "Sweet, milky, chilled."),
  A("zobo_drink", "ZOBO DRINK", "ZD", 700, "food", 9, "Hibiscus and ginger, cold."),
  A("palm_wine", "PALM WINE", "PW", 1500, "food", 12, "Fresh from the tapper."),
  A("burukutu", "BURUKUTU", "BU", 900, "food", 8, "Northern sorghum beer."),
  A("local_honey", "LOCAL HONEY", "LH", 2500, "food", 15, "Wild honey, still on the comb."),
];

/* Register in the pocket catalogue so Pocket.add(id) works. Food stacks. */
for (const it of MILE1_STALLS) {
  if (POCKET_ITEMS[it.id]) continue;
  POCKET_ITEMS[it.id] = {
    id: it.id, name: it.label, icon: it.icon,
    size: it.kind === "food" ? 0.2 : 0.3,
    value: Math.floor(it.price * 0.6),
    stackable: it.kind === "food",
    desc: it.desc, mile1: true,
  };
}

export const MILE1_BY_ID = Object.fromEntries(MILE1_STALLS.map((i) => [i.id, i]));
if (typeof window !== "undefined") window.__ph3d_mile1 = { stalls: MILE1_STALLS, byId: MILE1_BY_ID };
