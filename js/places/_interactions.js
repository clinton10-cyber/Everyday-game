/* _interactions.js -- label-driven interactable presets.
   Given a room label like "MASTER BEDROOM" or "READING HALL", returns
   a list of { type, label, offX, offZ, standOff } describing the
   interactive furniture to place in that room. The walk template
   then spawns invisible markers and manages the button + animations. */

const RULES = [
  { test: /BEDROOM|BED\b|CELL\b|ROOM [A-Z]?\d+|SUITE|LIE/i,
    items: [
      // offZ=-0.8: move toward the head of the bed (beds placed near room centre-back)
      { type: "lie",  label: "LIE DOWN", offX: 0, offZ: -0.8, stand: 1.2 },
    ]},
  { test: /LIVING|LOUNGE|WAITING|LOBBY|RECEPTION|COMMON/i,
    items: [
      { type: "sit",  label: "SIT",        offX:  0.0, offZ: 0.25, stand: 1.0 },
      { type: "watch", label: "WATCH TV",  offX: -1.4, offZ: 0.0,  stand: 1.4 },
    ]},
  { test: /LIBRARY|READING|STUDY|STUDY/i,
    items: [
      { type: "sit",   label: "SIT",     offX: 0, offZ: 0,   stand: 1.0 },
      { type: "read",  label: "READ",    offX: 0.9, offZ: 0, stand: 1.1 },
    ]},
  { test: /DINING|CAFE|RESTAURANT|FOOD COURT|SEATING|TERRACE|CANTEEN/i,
    items: [
      { type: "sit",  label: "SIT",   offX: 0, offZ: 0, stand: 1.0 },
      { type: "eat",  label: "ORDER", offX: 1.2, offZ: 0, stand: 1.2 },
    ]},
  { test: /KITCHEN|GRILL|BAR|SNACK|JUICE|CONTINENTAL/i,
    items: [
      { type: "cook", label: "COOK", offX: 0, offZ: -1.2, stand: 1.4 },
    ]},
  { test: /BATH|RESTROOM|TOILET|SHOWER|VANITY/i,
    items: [
      { type: "toilet", label: "USE TOILET", offX: -0.6, offZ: 0, stand: 1.0 },
      { type: "wash",   label: "WASH",       offX:  0.6, offZ: 0, stand: 1.0 },
    ]},
  { test: /GYM|WORKOUT|TREADMILL|FITNESS/i,
    items: [
      { type: "workout", label: "WORK OUT", offX: 0, offZ: 0, stand: 1.2 },
    ]},
  { test: /POOL|SPA|JACUZZI/i,
    items: [
      { type: "swim", label: "SWIM", offX: 0, offZ: 0, stand: 2.2 },
    ]},
  { test: /ARCADE|GAME|VR/i,
    items: [
      { type: "play", label: "PLAY", offX: 0, offZ: 0, stand: 1.2 },
    ]},
  { test: /STAGE|AUDIENCE|AMPHITHEATRE/i,
    items: [
      { type: "perform", label: "PERFORM", offX: 0, offZ: -2, stand: 3.0 },
    ]},
  { test: /PARK|GARDEN|PLAZA|MEMORIAL/i,
    items: [
      { type: "sit", label: "SIT", offX: 0, offZ: 0, stand: 1.0 },
    ]},
  { test: /OFFICE|CONTROL|PORTER|REGISTRY|BURSARY|SALES|STAFF|AIDE|VC\b|LIBRARIAN/i,
    items: [
      { type: "use", label: "USE DESK", offX: 0, offZ: -0.8, stand: 1.2 },
    ]},
];

export function presetsFor(label) {
  if (!label) return [];
  for (const r of RULES) if (r.test.test(label)) return r.items;
  return [];
}

