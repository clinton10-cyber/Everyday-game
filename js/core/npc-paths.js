/* ════════════════════════════════════════════════════════════════
   npc-paths.js — named pedestrian / traffic routes with groups.

   Exports: NPC_PATHS, ROLE_PATHS, getSegs, pointAtU, nearestU
   ════════════════════════════════════════════════════════════════ */

export const NPC_PATHS = [
  { id: "market-circuit", closed: true, speed: 1.00, points: [
    [215, 100], [180, 55], [130, 30], [80, 10], [55, -25],
    [10, 0], [-40, 20], [-55, 25], [-40, 60], [-10, 80],
    [40, 95], [95, 105], [150, 110], [215, 100]
  ], groups: [
    { type: "couple",      count: 2, weight: 3 },
    { type: "yahoo_boys",  count: 3, weight: 2 },
    { type: "mamas",       count: 2, weight: 3 },
    { type: "suit_men",    count: 2, weight: 2 },
    { type: "school_kids", count: 3, weight: 2 },
    { type: "solo",        count: 1, weight: 4 },
  ]},

  { id: "business", closed: true, speed: 1.10, points: [
    [150, 220], [180, 200], [220, 185], [250, 165], [250, 120],
    [225, 80], [190, 40], [150, -30], [200, 10], [235, 40],
    [255, 90], [240, 150], [200, 190], [150, 220]
  ], groups: [
    { type: "suit_men",   count: 3, weight: 4 },
    { type: "yahoo_boys", count: 2, weight: 3 },
    { type: "couple",     count: 2, weight: 2 },
    { type: "solo",       count: 1, weight: 3 },
  ]},

  { id: "government", closed: true, speed: 0.90, points: [
    [-320, -20], [-290, -35], [-260, -55], [-250, -60],
    [-240, -110], [-235, -160], [-230, -215], [-180, -240],
    [-110, -260], [-80, -270], [-110, -220], [-160, -170],
    [-210, -120], [-260, -80], [-300, -50], [-320, -20]
  ], groups: [
    { type: "suit_men", count: 3, weight: 5 },
    { type: "solo",     count: 1, weight: 2 },
  ]},

  { id: "residential", closed: true, speed: 0.85, points: [
    [25, 175], [-20, 180], [-60, 185], [-95, 190], [-60, 230],
    [-20, 250], [0, 265], [-60, 270], [-120, 260], [-200, 245],
    [-260, 220], [-310, 210], [-350, 200], [-330, 240], [-260, 270],
    [-150, 285], [-60, 250], [-10, 210], [25, 175]
  ], groups: [
    { type: "couple",      count: 2, weight: 4 },
    { type: "school_kids", count: 2, weight: 3 },
    { type: "mamas",       count: 2, weight: 3 },
    { type: "solo",        count: 1, weight: 3 },
  ]},

  { id: "coastal", closed: true, speed: 0.95, points: [
    [-115, -155], [-80, -145], [-40, -125], [10, -110], [40, -85],
    [55, -60], [55, -25], [35, -5], [10, 10], [-25, 20],
    [-55, 25], [-80, 10], [-105, -20], [-125, -60], [-135, -105],
    [-115, -155]
  ], groups: [
    { type: "couple",     count: 2, weight: 4 },
    { type: "yahoo_boys", count: 2, weight: 2 },
    { type: "solo",       count: 1, weight: 4 },
  ]},

  { id: "airport", closed: true, speed: 1.20, points: [
    [400, 90], [385, 50], [360, 25], [340, 20], [290, 5],
    [250, 0], [200, -15], [150, -30], [180, 15], [215, 55],
    [215, 100], [265, 110], [315, 110], [360, 100], [400, 90]
  ], groups: [
    { type: "couple",   count: 2, weight: 4 },
    { type: "suit_men", count: 2, weight: 3 },
    { type: "solo",     count: 1, weight: 3 },
  ]},

  { id: "campus", closed: true, speed: 0.90, points: [
    [-230, -10], [-238, 40], [-245, 100], [-250, 160], [-250, 200],
    [-240, 220], [-215, 235], [-235, 255], [-280, 265], [-340, 265],
    [-350, 235], [-350, 200], [-310, 165], [-280, 110], [-265, 60],
    [-230, -10]
  ], groups: [
    { type: "school_kids", count: 3, weight: 4 },
    { type: "couple",      count: 2, weight: 3 },
    { type: "solo",        count: 1, weight: 2 },
  ]},

  { id: "crime", closed: true, speed: 1.00, points: [
    [160, -215], [110, -215], [60, -215], [80, -230], [150, -235],
    [200, -230], [250, -215], [290, -195], [330, -175],
    [380, -150], [355, -110], [310, -105], [260, -135],
    [215, -170], [180, -200], [160, -215]
  ], groups: [
    { type: "yahoo_boys", count: 3, weight: 4 },
    { type: "solo",       count: 1, weight: 3 },
  ]},

  { id: "west-suburb", closed: true, speed: 0.80, points: [
    [-370, -200], [-345, -145], [-330, -75], [-350, -180],
    [-360, -95], [-320, -10], [-310, 60], [-330, 130],
    [-340, 200], [-370, 200], [-370, 100], [-370, 0],
    [-370, -100], [-350, -180], [-370, -200]
  ], groups: [
    { type: "couple", count: 2, weight: 3 },
    { type: "solo",   count: 1, weight: 2 },
  ]},

  { id: "central-loop", closed: true, speed: 1.00, points: [
    [0, 0], [50, -20], [90, 0], [100, 60], [80, 100],
    [30, 110], [-30, 100], [-60, 60], [-50, 20], [0, 0]
  ], groups: [
    { type: "couple",      count: 2, weight: 3 },
    { type: "yahoo_boys",  count: 2, weight: 3 },
    { type: "suit_men",    count: 2, weight: 2 },
    { type: "school_kids", count: 2, weight: 3 },
    { type: "mamas",       count: 2, weight: 2 },
    { type: "solo",        count: 1, weight: 4 },
  ]},

  /* ── Downtown & business core ─────────────────────────── */
  { id: "downtown-north", closed: true, speed: 1.00, points: [
    [40, -60], [10, -80], [-25, -95], [-60, -90], [-95, -70],
    [-100, -40], [-80, -15], [-45, 0], [-10, -5], [25, -20],
    [40, -60]
  ], groups: [
    { type: "suit_men", count: 2, weight: 4 },
    { type: "yahoo_boys", count: 2, weight: 3 },
    { type: "couple", count: 2, weight: 3 },
    { type: "solo", count: 1, weight: 4 },
  ]},

  { id: "downtown-south", closed: true, speed: 1.00, points: [
    [-40, 40], [-10, 55], [30, 60], [70, 65], [100, 80],
    [115, 110], [90, 140], [50, 150], [15, 140], [-20, 120],
    [-45, 95], [-55, 70], [-40, 40]
  ], groups: [
    { type: "suit_men", count: 2, weight: 3 },
    { type: "mamas", count: 2, weight: 3 },
    { type: "school_kids", count: 2, weight: 3 },
    { type: "solo", count: 1, weight: 4 },
  ]},

  /* ── North residential belt (walk-scene spawn) ────────── */
  { id: "north-residential", closed: true, speed: 0.85, points: [
    [60, 220], [40, 240], [10, 250], [-20, 255], [-50, 260],
    [-80, 250], [-95, 230], [-80, 210], [-50, 205], [-20, 210],
    [10, 215], [40, 215], [60, 220]
  ], groups: [
    { type: "couple",      count: 2, weight: 3 },
    { type: "school_kids", count: 2, weight: 2 },
    { type: "mamas",       count: 2, weight: 3 },
    { type: "yahoo_boys",  count: 2, weight: 2 },
    { type: "solo",        count: 1, weight: 4 },
  ]},

  /* ── My House loop (walk start) ────────────────────────── */
  { id: "myhouse-loop", closed: true, speed: 0.90, points: [
    [40, 175], [25, 195], [0, 205], [-30, 200], [-45, 185],
    [-35, 165], [-10, 158], [15, 160], [35, 168], [40, 175]
  ], groups: [
    { type: "couple",      count: 2, weight: 4 },
    { type: "mamas",       count: 2, weight: 2 },
    { type: "solo",        count: 1, weight: 4 },
  ]},

  /* ── Eastern quarter near real-estate / jobcentre ─────── */
  { id: "east-quarter", closed: true, speed: 1.00, points: [
    [180, 120], [220, 140], [250, 165], [260, 200], [240, 230],
    [200, 240], [170, 220], [155, 190], [160, 155], [180, 120]
  ], groups: [
    { type: "suit_men", count: 2, weight: 4 },
    { type: "yahoo_boys", count: 2, weight: 3 },
    { type: "couple", count: 2, weight: 3 },
    { type: "solo", count: 1, weight: 3 },
  ]},

  /* ── Airport apron & terminal ─────────────────────────── */
  { id: "airport-loop2", closed: true, speed: 1.20, points: [
    [340, 60], [400, 80], [430, 100], [430, 140], [410, 170],
    [370, 180], [340, 160], [325, 120], [330, 90], [340, 60]
  ], groups: [
    { type: "suit_men", count: 2, weight: 3 },
    { type: "couple", count: 2, weight: 4 },
    { type: "solo", count: 1, weight: 3 },
  ]},

  /* ── South residential near duplex / lagos flat ───────── */
  { id: "south-residential", closed: true, speed: 0.85, points: [
    [-80, 200], [-60, 220], [-30, 240], [0, 260], [30, 270],
    [60, 265], [80, 240], [70, 210], [45, 195], [10, 190],
    [-30, 192], [-60, 190], [-80, 200]
  ], groups: [
    { type: "couple",      count: 2, weight: 4 },
    { type: "mamas",       count: 2, weight: 3 },
    { type: "school_kids", count: 2, weight: 3 },
    { type: "solo",        count: 1, weight: 4 },
  ]},

  /* ── Western belt around statehouse / govhouse ────────── */
  { id: "west-government", closed: true, speed: 1.05, points: [
    [-200, -50], [-230, -80], [-260, -110], [-290, -150], [-320, -170],
    [-350, -140], [-350, -80], [-330, -30], [-300, 0], [-265, -10],
    [-230, -25], [-200, -50]
  ], groups: [
    { type: "suit_men", count: 2, weight: 4 },
    { type: "yahoo_boys", count: 2, weight: 2 },
    { type: "solo", count: 1, weight: 3 },
  ]},

  /* ── Hotel strip ──────────────────────────────────────── */
  { id: "hotel-strip", closed: true, speed: 0.95, points: [
    [-100, -120], [-70, -140], [-30, -150], [10, -160], [30, -180],
    [10, -200], [-30, -205], [-70, -195], [-100, -175], [-115, -145],
    [-100, -120]
  ], groups: [
    { type: "couple", count: 2, weight: 4 },
    { type: "suit_men", count: 2, weight: 3 },
    { type: "solo", count: 1, weight: 4 },
  ]},

  /* ── University north (walk from campus) ─────────────── */
  { id: "campus-north", closed: true, speed: 0.90, points: [
    [-230, 40], [-250, 80], [-260, 120], [-250, 160], [-230, 190],
    [-200, 200], [-180, 170], [-180, 130], [-200, 90], [-215, 60],
    [-230, 40]
  ], groups: [
    { type: "school_kids", count: 2, weight: 3 },
    { type: "couple", count: 2, weight: 3 },
    { type: "solo", count: 1, weight: 4 },
  ]},

  /* ── Market belt (extended) ───────────────────────────── */
  { id: "market-north", closed: true, speed: 0.90, points: [
    [180, 140], [200, 160], [220, 175], [230, 200], [215, 220],
    [185, 220], [165, 200], [160, 170], [170, 145], [180, 140]
  ], groups: [
    { type: "mamas",       count: 2, weight: 4 },
    { type: "yahoo_boys",  count: 2, weight: 3 },
    { type: "couple",      count: 2, weight: 2 },
    { type: "solo",        count: 1, weight: 4 },
  ]},

  /* ── Prison area (workers / visitors) ─────────────────── */
  { id: "prison-walk", closed: true, speed: 0.95, points: [
    [130, -180], [160, -200], [185, -220], [200, -240], [185, -260],
    [155, -260], [130, -240], [120, -215], [125, -190], [130, -180]
  ], groups: [
    { type: "couple", count: 2, weight: 3 },
    { type: "suit_men", count: 2, weight: 2 },
    { type: "solo", count: 1, weight: 3 },
  ]},

  /* ── Governor's mansion belt ──────────────────────────── */
  { id: "governor-walk", closed: true, speed: 1.00, points: [
    [-200, -230], [-215, -260], [-215, -290], [-200, -310], [-170, -320],
    [-150, -300], [-150, -270], [-160, -240], [-185, -230], [-200, -230]
  ], groups: [
    { type: "suit_men", count: 2, weight: 4 },
    { type: "yahoo_boys", count: 2, weight: 2 },
    { type: "solo", count: 1, weight: 3 },
  ]},

  /* ── Pleasure park access ─────────────────────────────── */
  { id: "pleasure-access", closed: true, speed: 0.90, points: [
    [-10, 35], [10, 20], [30, 10], [50, 0], [70, -10],
    [80, 20], [60, 40], [35, 55], [10, 60], [-10, 55],
    [-10, 35]
  ], groups: [
    { type: "couple",      count: 2, weight: 4 },
    { type: "school_kids", count: 2, weight: 3 },
    { type: "mamas",       count: 2, weight: 2 },
    { type: "solo",        count: 1, weight: 4 },
  ]},
];

export const ROLE_PATHS = {
  trader:   { closed: false, speed: 0.35, points: [[-1.4, 0], [1.4, 0]] },
  banker:   { closed: false, speed: 0.28, points: [[-0.8, 0], [0.8, 0]] },
  mechanic: { closed: false, speed: 0.32, points: [[-1.8, -0.6], [1.8, 0.6]] },
  priest:   { closed: false, speed: 0.25, points: [[-0.6, -0.6], [0.6, 0.6]] },
  doctor:   { closed: false, speed: 0.28, points: [[-1.2, 0], [1.2, 0]] },
  police:   { closed: false, speed: 0.45, points: [[-2.2, 0], [2.2, 0]] },
  taxi:     { closed: false, speed: 0.30, points: [[0, -1.6], [0, 1.6]] },
  walker:   { closed: true,  speed: 0.30, points: [[-0.5, 0], [0.5, 0]] },
  inmate:   { closed: true,  speed: 0.25, points: [[-1.2, -0.8], [1.2, -0.8], [1.2, 0.8], [-1.2, 0.8]] },
  warden:   { closed: false, speed: 0.55, points: [[-4.0, 0], [4.0, 0]] },
};

const _cache = new WeakMap();

export function getSegs(path) {
  let s = _cache.get(path);
  if (s) return s;
  const segs = [];
  const pts = path.points;
  const n = pts.length;
  const count = path.closed ? n : n - 1;
  let total = 0;
  for (let i = 0; i < count; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 0.0001;
    segs.push({ a, b, dx, dz, len, start: total });
    total += len;
  }
  s = { segs, total };
  _cache.set(path, s);
  return s;
}

export function pointAtU(path, u) {
  const { segs, total } = getSegs(path);
  let target = u * total;
  if (target < 0) target += total;
  if (target > total) target -= total;
  for (const seg of segs) {
    if (target <= seg.start + seg.len) {
      const local = (target - seg.start) / seg.len;
      return {
        x: seg.a[0] + seg.dx * local,
        z: seg.a[1] + seg.dz * local,
        tx: seg.dx / seg.len,
        tz: seg.dz / seg.len,
      };
    }
  }
  const last = segs[segs.length - 1];
  return {
    x: last.b[0], z: last.b[1],
    tx: last.dx / last.len, tz: last.dz / last.len,
  };
}

export function nearestU(path, x, z) {
  const { segs, total } = getSegs(path);
  let bestU = 0, bestD = Infinity;
  for (const seg of segs) {
    const relX = x - seg.a[0];
    const relZ = z - seg.a[1];
    let local = (relX * seg.dx + relZ * seg.dz) / (seg.len * seg.len);
    local = Math.max(0, Math.min(1, local));
    const px = seg.a[0] + seg.dx * local;
    const pz = seg.a[1] + seg.dz * local;
    const d = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (d < bestD) {
      bestD = d;
      bestU = (seg.start + local * seg.len) / total;
    }
  }
  return bestU;
}
