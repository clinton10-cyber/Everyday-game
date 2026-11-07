/* ============================================================
   House interior interactive data
   Property names used by every block below:
     .sits      .surfaces      .interacts
   ============================================================ */

/* --- Helper constructors --- */
function bed(x, z, yaw)   { return { x, z, yaw: yaw||0, kind: "bed",     eye: 0.72 }; }
function sofa(x, z, yaw)  { return { x, z, yaw: yaw||0, kind: "sofa",    eye: 1.15 }; }
function chair(x, z, yaw) { return { x, z, yaw: yaw||0, kind: "chair",   eye: 1.15 }; }
function chairP(x, z, yaw){ return { x, z, yaw: yaw||0, kind: "chair",   eye: 1.15 }; }
function toilet(x, z, yaw){ return { x, z, yaw: yaw||0, kind: "toilet",  eye: 1.15 }; }
function toiletP(x, z, yaw){return { x, z, yaw: yaw||0, kind: "toilet",  eye: 1.15 }; }
function bench(x, z, yaw) { return { x, z, yaw: yaw||0, kind: "bench",   eye: 1.15 }; }
function benchP(x, z, yaw){ return { x, z, yaw: yaw||0, kind: "bench",   eye: 1.15 }; }
function lounger(x, z, yaw){return { x, z, yaw: yaw||0, kind: "lounger", eye: 1.15 }; }
function loungerP(x, z, yaw){return{x, z, yaw: yaw||0, kind: "lounger", eye: 1.15 }; }
function surf(x, yTop, z, w, d) { return { x, yTop, z, w, d }; }
function inter(x, y, z, kind, label) { return { x, y, z, kind, label }; }
function int_(x, y, z, kind, label){ return inter(x, y, z, kind, label); }

/* Generate N seat positions along a sofa of given length */
function sofaSeats(cx, cz, ry, len) {
  const out = [];
  const n = Math.max(2, Math.round(len / 0.8));
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : (i / (n - 1)) - 0.5;
    const lx = t * (len - 0.36);
    out.push(sofa(cx + lx * Math.cos(ry), cz - lx * Math.sin(ry), ry));
  }
  return out;
}

export const HOUSE_INTERACT_DATA = {
  flat1: {
    spawn: { x: 1.20, z: 5.30, yaw: -Math.PI/2 },
    label: "1-BEDROOM FLAT",
    sits: [
      ...sofaSeats(0.62, 5.30, Math.PI/2, 2.10),
      bed(7.10, 5.72, Math.PI),
      chairP(1.30, 1.95, 0), chairP(2.10, 1.95, 0),
      chairP(1.30, 3.55, Math.PI), chairP(2.10, 3.55, Math.PI),
      toiletP(8.60, 1.90, Math.PI/2),
    ],
    surfaces: [
      surf(1.70, 0.79, 2.75, 1.40, 0.85),
      surf(2.60, 0.45, 5.30, 1.05, 0.58),
      surf(1.75, 0.88, 0.41, 2.80, 0.62),
    ],
    interacts: [
      int_(2.60, 0.95, 0.41, "cook",   "COOK"),
      int_(3.80, 1.00, 0.45, "fridge", "OPEN FRIDGE"),
      int_(1.00, 0.90, 0.41, "sink",   "USE SINK"),
    ],
  },

  flat2: {
    spawn: { x: 2.50, z: 6.60, yaw: 0 },
    label: "2-BEDROOM FLAT",
    sits: [
      ...sofaSeats(0.62, 6.00, Math.PI/2, 2.00),
      bed(9.25, 3.275, Math.PI),
      bed(10.50, 6.775, Math.PI),
      chairP(2.20, 1.60, 0), chairP(3.00, 1.60, 0),
      chairP(2.20, 3.20, Math.PI), chairP(3.00, 3.20, Math.PI),
      toiletP(6.95, 6.55, Math.PI/2),
    ],
    surfaces: [
      surf(2.60, 0.79, 2.40, 1.40, 0.85),
      surf(2.30, 0.45, 6.00, 1.00, 0.55),
      surf(5.75, 0.83, 6.60, 1.10, 0.38),
      surf(1.45, 0.88, 0.41, 2.20, 0.62),
    ],
    interacts: [
      int_(2.05, 0.95, 0.41, "cook",   "COOK"),
      int_(0.50, 1.00, 5.90, "fridge", "OPEN FRIDGE"),
      int_(0.85, 0.90, 0.41, "sink",   "USE SINK"),
    ],
  },

  flat10: {
    spawn: { x: 3.20, z: 5.60, yaw: 0 },
    label: "10-BEDROOM FLAT",
    sits: [
      ...sofaSeats(1.20, 5.60, Math.PI/2, 2.20),
      chairP(2.60, 3.75, Math.PI), chairP(3.80, 3.75, Math.PI),
      chairP(6.60, 3.60, -Math.PI/2), chairP(6.60, 4.40, -Math.PI/2),
      chairP(4.60, 3.60, Math.PI/2), chairP(4.60, 4.40, Math.PI/2),
      bed(13, 1.225, 0), bed(19, 1.225, 0), bed(25, 1.225, 0),
      bed(31, 1.225, 0), bed(37, 1.225, 0),
      bed(4, 14.775, Math.PI), bed(12, 14.775, Math.PI),
      bed(20, 14.775, Math.PI), bed(28, 14.775, Math.PI),
      bed(36, 14.775, Math.PI),
      toiletP(0.70, 7.55, Math.PI/2), toiletP(0.70, 8.45, Math.PI/2),
      toiletP(39.30, 7.55, -Math.PI/2), toiletP(39.30, 8.45, -Math.PI/2),
    ],
    surfaces: [
      surf(3.20, 0.94, 2.90, 2.80, 1.10),
      surf(5.60, 0.79, 4.00, 1.60, 0.90),
      surf(3.10, 0.45, 5.60, 1.10, 0.60),
      surf(2.60, 0.88, 0.44, 5.00, 0.62),
    ],
    interacts: [
      int_(3.40, 0.95, 0.44, "cook",   "COOK"),
      int_(5.60, 1.00, 0.48, "fridge", "OPEN FRIDGE"),
      int_(1.40, 0.90, 0.44, "sink",   "USE SINK"),
    ],
  },

  mansion: {
    spawn: { x: 81.0, z: 23.0, yaw: Math.PI },
    label: "MANSION",
    sits: [
      ...sofaSeats(64.0, 22.0, 0, 3.2),
      ...sofaSeats(64.0, 29.6, Math.PI, 3.2),
      ...sofaSeats(74.6, 26.0, -Math.PI/2, 3.0),
      chairP(69.2, 21.2, 0), chairP(69.2, 30.6, Math.PI),
      chairP(66.0, 36.6, 0), chairP(70.0, 36.6, 0),
      chairP(95.4, 35.6, 0), chairP(96.25, 35.6, 0), chairP(97.1, 35.6, 0),
      chairP(97.95, 35.6, 0), chairP(98.8, 35.6, 0), chairP(99.65, 35.6, 0),
      chairP(100.5, 35.6, 0),
      chairP(95.4, 38.4, Math.PI), chairP(96.25, 38.4, Math.PI), chairP(97.1, 38.4, Math.PI),
      chairP(97.95, 38.4, Math.PI), chairP(98.8, 38.4, Math.PI), chairP(99.65, 38.4, Math.PI),
      chairP(100.5, 38.4, Math.PI),
      chairP(94.2, 37.0, Math.PI/2), chairP(101.8, 37.0, -Math.PI/2),
      chairP(93.4, 46, 0), chairP(95.25, 46, 0), chairP(97.1, 46, 0),
      chairP(98.95, 46, 0), chairP(100.8, 46, 0), chairP(102.65, 46, 0),
      chairP(93.4, 48.2, 0), chairP(95.25, 48.2, 0), chairP(97.1, 48.2, 0),
      chairP(98.95, 48.2, 0), chairP(100.8, 48.2, 0), chairP(102.65, 48.2, 0),
      chairP(93.4, 50.4, 0), chairP(95.25, 50.4, 0), chairP(97.1, 50.4, 0),
      chairP(98.95, 50.4, 0), chairP(100.8, 50.4, 0), chairP(102.65, 50.4, 0),
      chairP(93.4, 52.6, 0), chairP(95.25, 52.6, 0), chairP(97.1, 52.6, 0),
      chairP(98.95, 52.6, 0), chairP(100.8, 52.6, 0), chairP(102.65, 52.6, 0),
      loungerP(79.9, 48.0, 0), loungerP(79.9, 51.0, 0), loungerP(79.9, 54.0, 0),
      benchP(72.0, 45.0, 0), benchP(72.0, 48.0, 0),
      benchP(66.0, 32.0, 0), benchP(72.0, 32.0, 0),
      chairP(69.0, 35.0, 0), chairP(69.0, 29.0, Math.PI),
      loungerP(94.0, 50.0, 0), loungerP(96.0, 50.0, 0),
      loungerP(98.0, 50.0, 0), loungerP(100.0, 50.0, 0),
    ],
    surfaces: [
      surf(66.0, 0.45, 26.0, 2.4, 1.3),
      surf(98.0, 0.79, 37.0, 7.0, 1.6),
      surf(74.0, 0.45, 50.5, 2.2, 1.2),
      surf(97.0, 0.94, 26.0, 5.0, 1.5),
      surf(96.0, 0.79, 29.5, 2.6, 1.1),
      surf(98.0, 0.91, 31.0, 4.0, 1.4),
      surf(69.0, 0.45, 32.0, 1.6, 0.9),
    ],
    interacts: [
      int_(95, 0.95, 20.44, "cook",   "COOK"),
      int_(97, 0.95, 20.44, "cook",   "COOK"),
      int_(103.6, 1.0, 20.48, "fridge", "OPEN FRIDGE"),
      int_(93, 0.90, 20.44, "sink",   "USE SINK"),
      int_(62.6, 0.35, 45.0, "gym",   "TREADMILL"),
      int_(64.4, 0.35, 45.0, "gym",   "TREADMILL"),
      int_(66.2, 0.35, 45.0, "gym",   "TREADMILL"),
      int_(63.0, 0.30, 52.0, "yoga",  "DO YOGA"),
      int_(75.0, 0.60, 45.0, "lift",  "LIFT WEIGHTS"),
    ],
  },
};

