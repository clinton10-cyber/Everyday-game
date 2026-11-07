/* Mansion floor plan — halved to realistic residential scale (34 × 28 m
   ground + 34 × 28 m roof).  Replaces the original 46 × 36 m over-scale
   version.  Uses the shared furniture.js Builder so seats/uses/colliders
   are generated automatically.
*/
import * as F from "../../core/furniture.js";

export const MANSION_OX = 0, MANSION_OZ = 0;
export const MANSION_ROOF_Y = 4.00;
/* Staircase corridor: x 15-19, z 4-14 (inside the great hall) */
export const STAIR_X0 = MANSION_OX + 15, STAIR_X1 = MANSION_OX + 19;
export const STAIR_Z0 = MANSION_OZ +  4, STAIR_Z1 = MANSION_OZ + 14;

const {fArmchair, fBench, fBigScreen, fBookshelf, fChair, fChandelier,
       fCinemaSeat, fCoffeeTable, fConsole, fDiningTable, fDumbbellRack,
       fFridge, fIsland, fKitchen, fLamp, fLampCeil, fLounger,
       fMansionEntranceDoor, fPainting, fPiano, fPlant, fPoleLamp, fRug,
       fSink, fSofa, fStove, fTV, fTreadmill, fWindow, fYogaMat} = F;

export function buildMansion(B) {
  const H  = MANSION_ROOF_Y;
  const WT = 0.30, IT = 0.16;
  const WALL = 0xfff2dc;

  B.level = 0; B.yOff = 0;

  /* ── Ground-floor room grid (34 × 28) ─────────────────────────── */
  B.floor( 0,  0, 12,  9, 0xf0a850);  // parlour     12 × 9
  B.floor( 0,  9, 12, 18, 0x7ab88a);  // library     12 × 9
  B.floor( 0, 18, 12, 28, 0x6aa8e0);  // gym         12 × 10
  B.floor(12,  0, 22, 21, 0xf8ecd4);  // great hall  10 × 21
  B.floor(12, 21, 22, 28, 0x3ab8d8);  // gallery     10 × 7
  B.floor(22,  0, 34,  9, 0xf0b878);  // kitchen     12 × 9
  B.floor(22,  9, 34, 16, 0xd888a0);  // dining      12 × 7
  B.floor(22, 16, 34, 28, 0x6a5aa8);  // cinema      12 × 12

  /* ── Outer shell ─────────────────────────────────────────────── */
  B.wallZ( 0.0, -0.15, 34.15, { t:WT, h:H, col:WALL, doors:[[15,19]] });
  B.wallZ(28.0, -0.15, 34.15, { t:WT, h:H, col:WALL });
  B.wallX( 0.0, -0.15, 28.15, { t:WT, h:H, col:WALL });
  B.wallX(34.0, -0.15, 28.15, { t:WT, h:H, col:WALL });

  /* ── Interior partitions ─────────────────────────────────────── */
  B.wallX(12.0, 0.0, 28.0, { t:IT, h:H, col:0xffe4c8, doors:[[4,6],[13,15],[23,25]] });
  B.wallX(22.0, 0.0, 28.0, { t:IT, h:H, col:0xffe4c8, doors:[[4,6],[12,14],[23,25]] });
  B.wallZ( 9.0,  0.0, 12.0, { t:IT, h:H, col:0xffe4c8, doors:[[5,7]] });
  B.wallZ(18.0,  0.0, 12.0, { t:IT, h:H, col:0xffe4c8, doors:[[5,7]] });
  B.wallZ(21.0, 12.0, 22.0, { t:IT, h:H, col:0xffe4c8, doors:[[16,18]] });
  B.wallZ( 9.0, 22.0, 34.0, { t:IT, h:H, col:0xffe4c8, doors:[[27,29]] });
  B.wallZ(16.0, 22.0, 34.0, { t:IT, h:H, col:0xffe4c8, doors:[[27,29]] });

  /* ── Staircase corridor walls (inside great hall) ─────────────── */
  B.wallX(15.0,  4.0, 14.0, { t:0.16, h:H, col:0xf0d8b0 });
  B.wallX(19.0,  4.0, 14.0, { t:0.16, h:H, col:0xf0d8b0 });

  /* ── Entrance double door ──────────────────────────────────────── */
  fMansionEntranceDoor(B, 17.0, 0.0, 4.0, 2.15);

  /* ══ PARLOUR (x 0-12, z 0-9, center 6, 4.5) ════════════════════ */
  fRug(B, 6.0, 4.5, 0, 8.0, 6.0, 0xc0303a, 0xffd98a);
  fTV(B, 0.60, 4.5, Math.PI/2, 2.2);
  /* Sofa on east wall, facing west toward the TV */
  fSofa(B, 10.5, 4.5, -Math.PI/2, 3.0, 0.9, 0xd94f8a, 0xee7aa8);
  fArmchair(B, 4.5, 1.5, 0,        0xf0a020, 0xffc860);
  fArmchair(B, 4.5, 7.5, Math.PI,  0xf0a020, 0xffc860);
  fCoffeeTable(B, 6.0, 4.5, 0, 2.0, 1.2);
  fPlant(B, 1.0, 8.0);
  fPlant(B, 11.0, 1.0);
  fChandelier(B, 6.0, 4.5, H-0.2, 0.9);
  fWindow(B, 3.5, 0.15, 0, 1.8, 1.9, 1.0);
  fWindow(B, 8.5, 0.15, 0, 1.8, 1.9, 1.0);
  fPainting(B, 0.20, 4.5, Math.PI/2, 1.2, 0.9, 0x4a8ae0);
  fPiano(B, 10.8, 7.5, -Math.PI/2);

  /* ══ LIBRARY (x 0-12, z 9-18, center 6, 13.5) ══════════════════ */
  fBookshelf(B,  2.0, 17.58, 0, 2.4, 3.2, 0.45, 0xa0602a);
  fBookshelf(B,  5.0, 17.58, 0, 2.4, 3.2, 0.45, 0xa0602a);
  fBookshelf(B,  8.0, 17.58, 0, 2.4, 3.2, 0.45, 0xa0602a);
  fBookshelf(B, 11.0, 17.58, 0, 2.4, 3.2, 0.45, 0xa0602a);
  fBookshelf(B, 0.42, 13.5, Math.PI/2, 2.6, 3.2, 0.45, 0xa0602a);
  fRug(B, 6.0, 14.5, 0, 7.0, 4.0, 0x3a6a3a, 0xd8f0a0);
  fArmchair(B, 4.0, 14.5, 0,       0xf0c020, 0xffe070);
  fArmchair(B, 8.0, 14.5, 0,       0xf0c020, 0xffe070);
  fCoffeeTable(B, 6.0, 15.5, 0, 1.4, 0.7);
  fLamp(B, 3.0, 15.5, 0);
  fLamp(B, 9.0, 15.5, 0);
  fLampCeil(B, 6.0, 13.5, H);
  fWindow(B, 0.15, 13.5, Math.PI/2, 2.0, 1.8, 1.0);

  /* ══ GYM (x 0-12, z 18-28, center 6, 23) ════════════════════════ */
  fTreadmill(B, 2.5, 21.0, 0, 0xe04040);
  fTreadmill(B, 5.5, 21.0, 0, 0x40c060);
  fTreadmill(B, 8.5, 21.0, 0, 0x4080e0);
  fBench(B, 10.5, 23.0, 0, 0x3a3a48);
  fBench(B, 10.5, 25.0, 0, 0x3a3a48);
  fDumbbellRack(B, 4.0, 26.0, 0);
  fYogaMat(B, 3.0, 25.0, 0, 0x40d0c0);
  fYogaMat(B, 4.5, 25.0, 0, 0xf070a0);
  fYogaMat(B, 6.0, 25.0, 0, 0xf0c020);
  fYogaMat(B, 7.5, 25.0, 0, 0x70a0f0);
  fWindow(B, 0.15, 23.0, Math.PI/2, 2.0, 1.8, 1.0);
  fLampCeil(B, 3.0, 21.0, H);
  fLampCeil(B, 9.0, 25.0, H);
  fPlant(B, 11.0, 27.0);

  /* ══ GREAT HALL (x 12-22, z 0-21) + staircase (x 15-19, z 4-14) */
  fRug(B, 17.0, 17.5, 0, 4.0, 5.5, 0xc02030, 0xffd98a);
  fChandelier(B, 17.0, 17.5, H-0.2, 0.9);
  fConsole(B, 12.30, 16.0,  Math.PI/2, 1.2);
  fConsole(B, 21.70, 16.0, -Math.PI/2, 1.2);
  fPlant(B, 13.0, 19.5);
  fPlant(B, 21.0, 19.5);
  fPainting(B, 12.20, 18.0,  Math.PI/2, 1.0, 0.8, 0x4a8ae0);
  fPainting(B, 21.80, 18.0, -Math.PI/2, 1.0, 0.8, 0xe08a4a);
  fWindow(B, 17.0, 0.16, 0, 1.6, 2.0, 1.0);

  /* Staircase treads (visual only — colliders come from mansionStairs) */
  const NS = 13;
  const sdz = 10 / NS, sdy = H / NS;
  for (let i = 0; i < NS; i++) {
    const zc = STAIR_Z0 + (i + 0.5) * sdz;
    const hh = (i + 1) * sdy;
    const col = (i % 2) ? 0xf8e8c8 : 0xe0c898;
    B.box(4.0, hh, sdz, col, 17, hh / 2, zc, 0, false);
  }
  for (let i = 0; i < NS; i++) {
    const zc = STAIR_Z0 + (i + 0.5) * sdz;
    const hh = (i + 1) * sdy;
    for (const xx of [15.05, 18.95]) {
      B.box(0.10, 0.90, sdz, 0xd8a020, xx, hh + 0.45, zc, 0, false);
    }
  }
  /* Newel posts */
  B.box(0.22, 1.40, 0.22, 0xffd54a, 15.05, 0.70,  4.05, 0, false);
  B.box(0.22, 1.40, 0.22, 0xffd54a, 18.95, 0.70,  4.05, 0, false);
  B.box(0.22, 1.60, 0.22, 0xffd54a, 15.05, H + 0.80, 14.0, 0, false);
  B.box(0.22, 1.60, 0.22, 0xffd54a, 18.95, H + 0.80, 14.0, 0, false);

  /* ══ GALLERY (x 12-22, z 21-28, center 17, 24.5) ════════════════ */
  fRug(B, 17.0, 24.5, 0, 6.0, 4.0, 0x8a2a5a, 0xffc8e0);
  fDiningTable(B, 17.0, 24.5, 0, 4.0, 1.4, 0x6a2a5a);
  for (let i = 0; i < 4; i++) {
    fChair(B, 15.2 + i * 1.2, 23.4, 0,        0xf0c020);
    fChair(B, 15.2 + i * 1.2, 25.6, Math.PI,  0xf0c020);
  }
  fPainting(B, 17.0, 21.20, Math.PI, 1.6, 1.0, 0xe08a4a);
  fWindow(B, 14.0, 27.85, Math.PI, 1.6, 1.8, 1.0);
  fWindow(B, 20.0, 27.85, Math.PI, 1.6, 1.8, 1.0);
  fPlant(B, 13.0, 27.0);
  fPlant(B, 21.0, 27.0);

  /* ══ KITCHEN (x 22-34, z 0-9, center 28, 4.5) ═══════════════════ */
  fKitchen(B, 28.0, 0.44, 0, 8.0, { cab:0x60c8b0, top:0x2f3237 });
  fSink(B,  25.0, 0.44, 0);
  fStove(B, 27.0, 0.44, 0);
  fFridge(B, 32.5, 0.48, 0, 0xe0a0c0);
  fIsland(B, 28.0, 4.5, 0, 3.5, 1.2, { cab:0x5ac8a0, top:0x2f3237 });
  for (let i = 0; i < 3; i++) fChair(B, 26.5 + i * 1.4, 3.5, 0, 0xf0a040);
  fWindow(B, 28.0, 0.16, 0, 2.4, 1.8, 1.0);
  fLampCeil(B, 28.0, 4.5, H);
  fPlant(B, 33.0, 8.0);

  /* ══ DINING (x 22-34, z 9-16, center 28, 12.5) ══════════════════ */
  fChandelier(B, 28.0, 12.5, H-0.2, 1.0);
  fRug(B, 28.0, 12.5, 0, 8.0, 5.0, 0x8a2a5a, 0xffc8e0);
  fDiningTable(B, 28.0, 12.5, 0, 5.0, 1.4, 0x6a2a5a);
  for (let i = 0; i < 5; i++) {
    fChair(B, 25.6 + i * 1.1, 11.4, 0,        0xf0c020);
    fChair(B, 25.6 + i * 1.1, 13.6, Math.PI,  0xf0c020);
  }
  fChair(B, 24.2, 12.5,  Math.PI/2, 0xf0c020);
  fChair(B, 31.8, 12.5, -Math.PI/2, 0xf0c020);
  fPainting(B, 28.0, 9.20, Math.PI, 1.6, 1.0, 0xe08a4a);
  fWindow(B, 26.0, 9.20, Math.PI, 1.4, 1.8, 1.0);
  fWindow(B, 30.0, 9.20, Math.PI, 1.4, 1.8, 1.0);

  /* ══ CINEMA (x 22-34, z 16-28, center 28, 22) ═══════════════════ */
  fBigScreen(B, 28.0, 16.35, Math.PI, 5.0, 2.0);
  for (let r = 0; r < 3; r++) {
    const zz = 20.0 + r * 2.0;
    const yy = r * 0.25;
    B.box(9.0, 0.25, 1.8, 0x4a3a6a, 28.0, yy + 0.125, zz, 0, false);
    for (let c = 0; c < 4; c++) {
      fCinemaSeat(B, 24.5 + c * 2.4, zz, 0, (c % 2) ? 0xc02030 : 0xd03040, yy + 0.25);
    }
  }
  fRug(B, 28.0, 19.0, 0, 8.0, 2.0, 0x2a1a4a, 0x6a5aa8);
  fPlant(B, 23.0, 18.0);
  fPlant(B, 33.0, 18.0);
  fLampCeil(B, 25.0, 19.0, H);
  fLampCeil(B, 31.0, 19.0, H);

  /* ══ ROOF TERRACE (34 × 28, level 1) ════════════════════════════ */
  B.level = 1; B.yOff = MANSION_ROOF_Y;

  /* Main terrace floor (stairwell cutout at x 15-19, z 4-14) */
  B.floor( 0,  0, 15, 28, 0xe0a878);
  B.floor(19,  0, 34, 28, 0xe0a878);
  B.floor(15,  0, 19,  4, 0xe0a878);
  B.floor(15, 14, 19, 28, 0xe0a878);

  /* Perimeter parapet */
  B.wallZ( 0.0, -0.15, 34.15, { t:0.28, h:1.20, col:0xf8d8a8 });
  B.wallZ(28.0, -0.15, 34.15, { t:0.28, h:1.20, col:0xf8d8a8 });
  B.wallX( 0.0, -0.15, 28.15, { t:0.28, h:1.20, col:0xf8d8a8 });
  B.wallX(34.0, -0.15, 28.15, { t:0.28, h:1.20, col:0xf8d8a8 });
  /* Stairwell guard rails */
  B.wallX(15.0,  4.0, 14.0, { t:0.14, h:1.10, col:0xf8d8a8 });
  B.wallX(19.0,  4.0, 14.0, { t:0.14, h:1.10, col:0xf8d8a8 });
  /* (no rail across z=14: that is where the stairs exit onto the roof) */

  /* Coloured zone floors */
  B.floor( 2, 20, 14, 27, 0x4ac8a0);  // terrace lounge (teal)
  B.floor(20, 10, 32, 20, 0xf0c060);  // terrace dining (yellow)
  B.floor( 2,  2, 12, 10, 0xc060a0);  // garden zone (pink)

  /* Terrace lounge cluster (x 2-14, z 20-27) */
  fBigScreen(B,  8.0, 20.6, Math.PI, 4.0, 2.0);
  fSofa(B,  8.0, 24.0, Math.PI,      2.6, 0.9, 0x2a8ad0, 0x50b0f0);
  fSofa(B,  4.5, 24.0,  Math.PI/2,   2.4, 0.9, 0x2a8ad0, 0x50b0f0);
  fSofa(B, 11.5, 24.0, -Math.PI/2,   2.4, 0.9, 0x2a8ad0, 0x50b0f0);
  fCoffeeTable(B, 8.0, 24.0, 0, 2.0, 1.0);
  fRug(B, 8.0, 23.5, 0, 6.0, 3.5, 0xd04040, 0xffe090);
  fLounger(B,  4.0, 26.0, 0, 0xfff0d0);
  fLounger(B, 12.0, 26.0, 0, 0xfff0d0);

  /* Terrace dining cluster (x 20-32, z 10-20) */
  fDiningTable(B, 26.0, 14.0, 0, 3.5, 1.2, 0xe06a3a);
  for (let i = 0; i < 4; i++) {
    fChair(B, 24.8 + i * 0.9, 13.0, 0,        0xf0a040);
    fChair(B, 24.8 + i * 0.9, 15.0, Math.PI,  0xf0a040);
  }
  fRug(B, 26.0, 14.0, 0, 5.0, 4.0, 0x8a5a2a, 0xffc880);
  fConsole(B, 20.30, 15.0, Math.PI/2, 1.0);

  /* Pool corner (x 22-34, z 22-28) */
  B.floor(22, 22, 34, 28, 0x4ac8a0);
  B.glowBox(8.0, 0.06, 4.0, 0x30c8e8, 28, 0.14 + MANSION_ROOF_Y, 25);
  fLounger(B, 23.5, 25.0, 0, 0xfff0d0);
  fLounger(B, 25.0, 25.0, 0, 0xffd0a0);
  fLounger(B, 26.5, 25.0, 0, 0xa0e0ff);
  fRug(B, 25.0, 25.0, 0, 5.0, 3.5, 0x30a0c0, 0xd0f0ff);

  /* Garden zone (x 2-12, z 2-10) */
  fRug(B, 7.0, 6.0, 0, 7.0, 5.0, 0x4a8a3a, 0xc8f090);
  for (let i = 0; i < 5; i++) { fPlant(B, 2.8 + i * 1.8, 2.5); fPlant(B, 2.8 + i * 1.8, 9.5); }
  fArmchair(B, 6.0, 6.0, -Math.PI/2, 0xf070a0, 0xffa0c8);
  fArmchair(B, 8.0, 6.0,  Math.PI/2, 0xf070a0, 0xffa0c8);
  fCoffeeTable(B, 7.0, 6.0, 0, 1.4, 0.9);
  fBench(B, 5.0, 9.0, 0, 0x8a5a2a);
  fBench(B, 9.0, 9.0, 0, 0x8a5a2a);

  /* Pole lamps */
  for (const p of [[6,12],[12,12],[8,22],[26,22],[30,22],[7,6],[26,10],[28,24]])
    fPoleLamp(B, p[0], p[1]);

  return B;
}

export function mansionStairs() {
  return [{
    minX: STAIR_X0, maxX: STAIR_X1, minZ: STAIR_Z0, maxZ: STAIR_Z1,
    axis: "z", y0: 0, y1: MANSION_ROOF_Y, level: 0, toLevel: 1,
  }];
}
export function mansionLevelHeight(level) { return level * MANSION_ROOF_Y; }
export const MANSION_SPAWN = { x: 17.0, z: 3.0, yaw: Math.PI, level: 0 };

