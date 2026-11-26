/* js/data/mile1-stalls.js -- 65 unique items, one per Central Market stall slot, in slot order
   (row 0 to row 4, column 0 to column 12). Slot i always sells MILE1_STALLS[i].
   kind: "food" (heals) | "pocket" (goes to the bag, resellable at 60%) | "collectible" (recorded in the collection).
   icon is a two-letter tag, not an emoji. */
import { POCKET_ITEMS } from "../core/pocket.js";

const A = (id, label, icon, price, kind, heal, desc, extra) =>
  Object.assign({ id, label, icon, price, kind, heal: heal || 0, desc }, extra || {});

export const MILE1_STALLS = [
  A("yam_tuber", "ROOT TUBERS", "RT", 1200, "food", 15, "Fresh starchy tuber, good for mashing."),
  A("sweet_potato", "SWEET POTATOES", "SP", 800, "food", 12, "Sweet, starchy, roasted or boiled."),
  A("plantain_bunch", "GREEN BANANAS", "GB", 1000, "food", 10, "Green bunch, ripens in a day or two."),
  A("cocoyam", "TARO ROOT", "TR", 900, "food", 12, "For stews and creamy porridge."),
  A("cassava_flour", "ROOT FLOUR", "RF", 1500, "food", 8, "Finely milled, ready for porridge."),
  A("beans_white", "WHITE BEANS", "WB", 1800, "food", 14, "Brown-skinned beans, cleaned."),
  A("rice_local", "LOCAL RICE", "LR", 4500, "food", 20, "A bowl of home-grown rice."),
  A("garri", "GRAIN MEAL", "GM", 1000, "food", 12, "Soak it or cook into a soft dough."),
  A("palm_oil", "RED COOKING OIL", "RO", 2200, "pocket", 0, "Rich red oil, fresh from the mill."),
  A("groundnut_oil", "PEANUT OIL", "PN", 2500, "pocket", 0, "Clear oil, smells like roasted nuts."),
  A("pepper_mix", "PEPPER MIX", "PM", 600, "food", 8, "Blended pepper, onion and tomato."),
  A("tomatoes", "TOMATOES", "TO", 1400, "food", 6, "Basket of ripe red tomatoes."),
  A("onions", "ONIONS", "ON", 1100, "food", 6, "Large dry onions, keeps for weeks."),
  A("smoked_fish", "SMOKED FISH", "SF", 3200, "food", 18, "Dried over open smoke. Long shelf life."),
  A("dried_crayfish", "DRIED SHRIMP", "DS", 2800, "pocket", 0, "Ground dried shrimp for soup."),
  A("stockfish", "DRIED COD", "DC", 4500, "pocket", 0, "Imported dried cod, for hearty stews."),
  A("catfish_live", "LIVE CATFISH", "LC", 3500, "food", 20, "Brought in from the river today."),
  A("snails_giant", "LARGE SNAILS", "LS", 2800, "pocket", 0, "Big land snails, cleaned."),
  A("periwinkles", "SEA SNAILS", "SN", 1800, "pocket", 0, "Fresh small sea snails."),
  A("goat_meat", "GOAT MEAT", "GM", 5500, "food", 28, "Lean goat meat, cut to order."),
  A("chicken_live", "LIVE CHICKEN", "LC", 4500, "food", 22, "A healthy cockerel."),
  A("eggs_crate", "EGGS (CRATE)", "EC", 2200, "food", 12, "Thirty eggs, fresh this morning."),
  A("bitterleaf", "BITTER GREENS", "BG", 700, "food", 5, "For hearty leafy soups."),
  A("scentleaf", "BASIL LEAVES", "BL", 500, "food", 4, "Aromatic, for soups and stews."),
  A("uziza_leaf", "PEPPER LEAVES", "PL", 800, "food", 5, "Peppery leaf, adds heat to soups."),
  A("okra_fresh", "FRESH OKRA", "FO", 900, "food", 6, "Tender okra, ready for soup."),
  A("ankara_fabric", "PRINTED FABRIC", "PF", 2500, "pocket", 0, "Two yards of bright wax print."),
  A("george_wrapper", "FESTIVE WRAP", "FW", 8000, "collectible", 0, "Festive cloth for celebrations."),
  A("lace_material", "LACE MATERIAL", "LM", 6000, "pocket", 0, "Delicate lace by the yard."),
  A("aso_oke", "HANDWOVEN CLOTH", "HC", 12000, "collectible", 0, "Handwoven strip cloth. A keepsake."),
  A("coral_beads", "CORAL BEADS", "CB", 5000, "collectible", 0, "Traditional coral beads."),
  A("wooden_comb", "WOODEN COMB", "WC", 800, "pocket", 0, "Carved wood, thumb-sized."),
  A("calabash_set", "GOURD SET", "GS", 1500, "pocket", 0, "Two halves of a dried gourd."),
  A("clay_pot", "CLAY POT", "CP", 2000, "pocket", 0, "For water or cooking."),
  A("broom_trad", "REED BROOM", "RB", 900, "pocket", 0, "Bundled from dried reeds."),
  A("raffia_mat", "WOVEN MAT", "WM", 2500, "pocket", 0, "Woven fibre, fits the parlour floor."),
  A("woven_basket", "WOVEN BASKET", "WB", 1800, "pocket", 0, "Sturdy cane basket."),
  A("wooden_spoons", "WOODEN SPOONS", "WS", 1200, "pocket", 0, "A pair, hand-carved."),
  A("carved_mask", "CARVED MASK", "CM", 4500, "collectible", 0, "Wall piece. Believed to guard the home."),
  A("charm_bracelet", "CHARM BRACELET", "CB", 2000, "pocket", 0, "Braided leather, small coin charm."),
  A("juju_amulet", "LUCKY AMULET", "LA", 8000, "pocket", 0, "Protective amulet. Robbery heat -15% while you own it.", { heatReduce: 0.15 }),
  A("herbal_mixture", "HERBAL TONIC", "HT", 3500, "food", 8, "Bitters, for aches and tiredness."),
  A("bitter_kola", "BITTER NUT", "BN", 1200, "food", 6, "Chew slowly, sip water after."),
  A("alligator_pepper", "WARM SPICE SEEDS", "SS", 900, "pocket", 0, "Sharp and warm. For ceremonies."),
  A("native_chalk", "WHITE CHALK", "WC", 600, "pocket", 0, "Used to mark the ground."),
  A("kolanut", "GUEST NUT", "GN", 1000, "food", 4, "Presented first at ceremonies.", { flag: "blessed" }),
  A("palm_kernel_oil", "KERNEL OIL", "KO", 1500, "pocket", 0, "Dark, fragrant, for soap and soups."),
  A("shea_butter", "SHEA BUTTER", "SB", 2000, "pocket", 0, "Raw, unrefined, for skin."),
  A("black_soap", "DARK SOAP", "DK", 1200, "pocket", 0, "Traditional soap, for washing."),
  A("camwood", "RED CLAY POWDER", "RC", 1800, "pocket", 0, "Red powder for cosmetics."),
  A("sea_salt", "SEA SALT", "SS", 500, "food", 2, "Coarse sea salt, by the handful."),
  A("camphor_balls", "CAMPHOR BALLS", "CB", 400, "pocket", 0, "For wardrobes and prayer."),
  A("roasted_corn", "ROASTED CORN", "RC", 300, "food", 6, "Hot off the coal, with coconut."),
  A("boli_groundnut", "ROAST BANANA & NUTS", "RN", 500, "food", 10, "Roadside special: roasted banana and nuts."),
  A("coconut_fresh", "FRESH COCONUT", "FC", 600, "food", 8, "Drink the water, eat the meat."),
  A("sugarcane", "SUGARCANE", "SU", 400, "food", 5, "Chew for the juice."),
  A("agidi_leaf", "CORN PUDDING WRAP", "CW", 500, "food", 8, "Cornmeal in a leaf, creamy."),
  A("akara_pap", "BEAN FRITTERS & PORRIDGE", "BF", 700, "food", 12, "Fried bean cakes and warm porridge."),
  A("moin_moin", "STEAMED BEAN PUDDING", "BP", 600, "food", 10, "Steamed bean pudding."),
  A("small_chops", "SMALL BITES", "SB", 1500, "food", 14, "Puff pastry, samosa, snack mix."),
  A("tiger_nut_drink", "TIGER NUT DRINK", "TN", 800, "food", 8, "Sweet, milky, chilled."),
  A("zobo_drink", "HIBISCUS DRINK", "HD", 700, "food", 9, "Hibiscus and ginger, cold."),
  A("palm_wine", "PALM SAP WINE", "PS", 1500, "food", 12, "Fresh from the tapper."),
  A("burukutu", "SORGHUM BEER", "SO", 900, "food", 8, "Dark sorghum beer."),
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
