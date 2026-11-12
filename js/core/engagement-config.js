/* js/core/engagement-config.js -- every tunable in one file. Re-balance here, not in code. */
export const CFG = {
  /* xp for level n = base * n^pow. Level 1 = 0 xp. */
  xp: { base: 100, pow: 1.4, max: 99 },
  skills: {
    fighting:    { per: 4, max: 100 },
    driving:     { per: 2, max: 100 },
    charisma:    { per: 3, max: 100 },
    photography: { per: 5, max: 100 },
    hustle:      { per: 6, max: 100 },
  },
  tiers: [0, 25, 50, 75, 100],

  /* Robbery targets. payout in naira, duration/escape in seconds, cooldownH in game-hours (real hours here). */
  robbery: {
    cashier: { payout: [1800, 6000], duration: 6, alarm: 0.45, comply: 0.70, fightBack: 0.10, escapeRadius: 12, cooldownH: 24, heat: 45 },
    atm:     { payout: [3000, 9000], duration: 8, alarm: 0.65, comply: 1.00, fightBack: 0.00, escapeRadius: 12, cooldownH: 24, heat: 60 },
    mug:     { payout: [300, 1500],  duration: 4, alarm: 0.30, comply: 0.80, fightBack: 0.15, escapeRadius: 8,  cooldownH: 2,  heat: 35 },
  },
  robberyEscapeSeconds: 20,
  robberyConfirmSeconds: 0.9,
  robberyCaughtToPrison: true,
  robberyCaughtFine: 0.25,          /* share of balance taken when caught */
  jujuHeatReduce: 0.15,             /* from the Mile 1 juju amulet */
  heatCap: 100,
  streak: { graceHours: 36, xpPerDay: 40, cap: 7 },

  /* Phones: trade-in pays this share of the price. */
  phones: { tradeInRatio: 0.45, airtimePacks: [[500, 500], [1000, 1000], [2000, 2000]], dataPacks: [[1000, 1024], [2500, 3072]] },

  /* Achievements: id -> { name, desc, test(counters, state) } evaluated on every track(). */
  achievements: [
    { id: "first_photo",  name: "Say cheese",     desc: "Take your first photo",       test: (c) => c.photosTaken >= 1 },
    { id: "shutterbug",   name: "Shutterbug",     desc: "Take 25 photos",              test: (c) => c.photosTaken >= 25 },
    { id: "first_job",    name: "Clocked in",     desc: "Finish a job",                test: (c) => c.jobsDone >= 1 },
    { id: "earner",       name: "Money moves",    desc: "Earn 100,000 naira",          test: (c) => c.moneyEarned >= 100000 },
    { id: "tourist",      name: "Around town",    desc: "Visit 20 scenes",             test: (c) => c.scenesVisited >= 20 },
    { id: "first_phone",  name: "Connected",      desc: "Buy a phone",                 test: (c, s) => s.phones.owned.length >= 1 },
    { id: "first_heist",  name: "Sticky fingers", desc: "Pull off a robbery",          test: (c) => c.robberies >= 1 },
    { id: "busted",       name: "Busted",         desc: "Get caught after a robbery",  test: (c) => c.robberiesCaught >= 1 },
    { id: "mile1_5",      name: "Mile 1 regular", desc: "Buy 5 unique Mile 1 items",   test: (c, s) => Object.keys(s.collections.mile1 || {}).length >= 5 },
    { id: "blessed",      name: "Blessed",        desc: "Present a kolanut",           test: (c, s) => !!s.flags.blessed },
  ],

  /* Goals. Daily/weekly pick N from the pool; life goals are permanent. target counts against counters[key] delta. */
  goalPool: {
    daily: [
      { id: "d_photos", text: "Take 2 photos",             key: "photosTaken",  target: 2,    xp: 30 },
      { id: "d_visit",  text: "Visit 3 places",            key: "scenesVisited", target: 3,   xp: 30 },
      { id: "d_earn",   text: "Earn 5,000 naira",          key: "moneyEarned",  target: 5000, xp: 40 },
      { id: "d_shop",   text: "Buy something at Mile 1",   key: "marketBuys",   target: 1,    xp: 25 },
    ],
    weekly: [
      { id: "w_jobs",   text: "Finish 3 jobs",             key: "jobsDone",     target: 3,     xp: 120 },
      { id: "w_earn",   text: "Earn 50,000 naira",         key: "moneyEarned",  target: 50000, xp: 150 },
      { id: "w_visit",  text: "Visit 15 places",           key: "scenesVisited", target: 15,   xp: 100 },
    ],
    life: [
      { id: "l_phone",  text: "Own a phone",               key: "phonesOwned",  target: 1,  xp: 150 },
      { id: "l_mile1",  text: "Collect 10 Mile 1 items",   key: "mile1Items",   target: 10, xp: 250 },
      { id: "l_photo",  text: "Take 100 photos",           key: "photosTaken",  target: 100, xp: 300 },
    ],
  },
  dailyCount: 3, weeklyCount: 2,
};
