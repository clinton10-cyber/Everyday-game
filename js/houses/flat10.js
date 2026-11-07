/* flat10.js — 10-bedroom luxury flat. Long marble corridor, five
   south bedrooms + five north bedrooms, two bathrooms, big kitchen,
   living, dining. Trims, windows, doors, lighting throughout. */
import {
  Builder, fBed, fChair, fCoffee, fConsole, fDining, fDoorFrame,
  fFridge, fIsland, fKitchen, fLamp, fLampCeil, fNightstand, fPlant,
  fRug, fShower, fSink, fSofa, fStove, fTV, fToilet, fVanity, fWardrobe,
} from './_kit.js';
import {
  trimRoom, windowFrame, doorFrame, wallArt, curtains,
  ceilingLight, pendant, lightRooms,
} from './_enhancements.js';

export function buildFlat10() {
  const B = new Builder(0, 45);
  const S = B.S;
  const H = 8.0, WT = 0.22, IT = 0.13, WALL = 0xfff4e6;
  const TRIM = 0xf5f0e6;

  /* ── Floors ─────────────────────────────────────── */
  B.floor(0, 0, 10 * S, 7 * S, 0xf0b060);
  for (let i = 0; i < 5; i++) {
    B.floor((10 + i * 6) * S, 0, (16 + i * 6) * S, 7 * S, 0xd08aa8);
  }
  for (let i = 0; i < 5; i++) {
    B.floor(i * 8 * S, 9 * S, (i * 8 + 8) * S, 16 * S, 0x9ad0a0);
  }
  B.floor(4 * S, 7 * S, 36 * S, 9 * S, 0xc8a878);
  B.floor(0, 7 * S, 4 * S, 9 * S, 0x8ad0e0);
  B.floor(36 * S, 7 * S, 40 * S, 9 * S, 0x8ad0e0);

  /* ── Ceiling ───────────────────────────────────── */
  B.ceil(-0.2 * S, -0.2 * S, 40.2 * S, 16.2 * S, H, 0xfffaf0);

  /* ── Outer walls ────────────────────────────────── */
  B.wallZ(0, -0.1 * S, 40.1 * S, { t: WT, h: H, col: WALL });
  B.wallZ(16 * S, -0.1 * S, 40.1 * S, { t: WT, h: H, col: WALL });
  B.wallX(0, -0.1 * S, 16.1 * S, { t: WT, h: H, col: WALL });
  B.wallX(40 * S, -0.1 * S, 16.1 * S, { t: WT, h: H, col: WALL });

  /* ── Corridor walls ─────────────────────────────── */
  const d7 = [[6.5 * S, 7.5 * S]];
  for (let i = 0; i < 4; i++) d7.push([(10 + i * 6 + 2.5) * S, (10 + i * 6 + 3.5) * S]);
  d7.push([34.5 * S, 35.5 * S]);
  B.wallZ(7 * S, 0, 40 * S, { t: IT, h: H, col: 0xffe8d0, doors: d7 });

  const d9 = [
    [4.5 * S, 5.5 * S], [11.5 * S, 12.5 * S], [19.5 * S, 20.5 * S],
    [27.5 * S, 28.5 * S], [34.5 * S, 35.5 * S],
  ];
  B.wallZ(9 * S, 0, 40 * S, { t: IT, h: H, col: 0xffe8d0, doors: d9 });

  B.wallX(4 * S, 7 * S, 9 * S, { t: IT, h: H, col: 0xffe8d0, doors: [[7.6 * S, 8.4 * S]] });
  B.wallX(36 * S, 7 * S, 9 * S, { t: IT, h: H, col: 0xffe8d0, doors: [[7.6 * S, 8.4 * S]] });

  /* South bedroom partitions */
  [10, 16, 22, 28, 34].forEach(x => B.wallX(x * S, 0, 7 * S, { t: IT, h: H, col: 0xffe8d0 }));
  /* North bedroom partitions */
  [8, 16, 24, 32].forEach(x => B.wallX(x * S, 9 * S, 16 * S, { t: IT, h: H, col: 0xffe8d0 }));

  /* ── Trims per room ─────────────────────────────── */
  trimRoom(B, 0, 0, 10, 7, H, TRIM);
  for (let i = 0; i < 5; i++) {
    trimRoom(B, (10 + i * 6), 0, (16 + i * 6), 7, H, TRIM);
  }
  for (let i = 0; i < 5; i++) {
    trimRoom(B, i * 8, 9, i * 8 + 8, 16, H, TRIM);
  }
  trimRoom(B, 4, 7, 36, 9, H, TRIM);
  trimRoom(B, 0, 7, 4, 9, H, TRIM);
  trimRoom(B, 36, 7, 40, 9, H, TRIM);

  /* ── Doors ──────────────────────────────────────── */
  fDoorFrame(B, 7 * S, 7 * S, 0, 1, 2.15, 0xe0a020, 0xfff0b0);

  const southC = [0xff4040, 0xff8a20, 0xf0c020, 0x40c060, 0x4080e0];
  const southP = [0xffb0b0, 0xffd0a0, 0xfff0a0, 0xb0f0c0, 0xb0d0ff];
  const sX = [13, 19, 25, 31, 35];
  for (let i = 0; i < 5; i++) {
    fDoorFrame(B, sX[i] * S, 7 * S, 0, 1, 2.15, southC[i], southP[i]);
  }

  const northC = [0x8a3ae0, 0xe040a0, 0x20c0c0, 0x30a0f0, 0xe04080];
  const northP = [0xd8b0ff, 0xffb0e0, 0xa0f0f0, 0xa0d8ff, 0xffb0d0];
  const nX = [5, 12, 20, 28, 35];
  for (let i = 0; i < 5; i++) {
    fDoorFrame(B, nX[i] * S, 9 * S, 0, 1, 2.15, northC[i], northP[i]);
  }

  /* ── Windows ───────────────────────────────────── */
  windowFrame(B, 3.0 * S, 4.4, 0.11, 0, 1.4, 1.4, { glassColor: 0xd4ecff });
  windowFrame(B, 6.0 * S, 4.4, 0.11, 0, 1.4, 1.4, { glassColor: 0xd4ecff });
  for (let i = 0; i < 5; i++) {
    windowFrame(B, (13 + i * 6) * S, 4.4, 0.11, 0, 1.4, 1.4, { glassColor: 0xd4ecff });
  }
  for (let i = 0; i < 5; i++) {
    windowFrame(B, (4 + i * 8) * S, 4.4, 15.89 * S, Math.PI, 1.4, 1.4, { glassColor: 0xd4ecff });
  }
  for (let i = 0; i < 3; i++) {
    windowFrame(B, 0.11 * S, 4.6, (7.5 + i * 0.5) * S, Math.PI / 2, 0.9, 1.0, { glassColor: 0xd4ecff });
    windowFrame(B, 39.89 * S, 4.6, (7.5 + i * 0.5) * S, -Math.PI / 2, 0.9, 1.0, { glassColor: 0xd4ecff });
  }

  /* ── Curtains on bedroom windows ───────────────── */
  for (let i = 0; i < 5; i++) {
    curtains(B, (13 + i * 6) * S, 4.6, 0.14 * S, 0, 1.8, 1.9, 0xf0e0c8);
  }
  for (let i = 0; i < 5; i++) {
    curtains(B, (4 + i * 8) * S, 4.6, 15.86 * S, Math.PI, 1.8, 1.9, 0xe8d8b8);
  }

  /* ── Kitchen (full remodel) ─────────────────────── */
  fKitchen(B, 2.6 * S, 0.44, 0, 5, { cab: 0x60c8b0 });
  fSink(B, 1.4 * S, 0.44, 0);
  fStove(B, 3.4 * S, 0.44, 0);
  fFridge(B, 5.6 * S, 0.48, 0, 0xe0a0c0);
  fFridge(B, 6.45 * S, 0.48, 0, 0xe0a0c0);
  fIsland(B, 3.2 * S, 2.9 * S, 0, 2.8, 1.1, { cab: 0x60c8b0 });
  fChair(B, 2.6 * S, 3.75 * S, Math.PI, 0xf0a040);
  fChair(B, 3.8 * S, 3.75 * S, Math.PI, 0xf0a040);
  B.box(5.0 * S, 0.7, 0.35, 0x60c8b0, 2.6 * S, 6.1, 0.30);
  B.box(5.0 * S, 0.06, 0.40, 0x4aa890, 2.6 * S, 6.48, 0.32);
  B.box(5.2 * S, 1.4, 0.02, 0xd8e4ec, 2.6 * S, 4.4, 0.13);
  pendant(B, 3.2 * S, 2.9 * S, H, 1.3, 0xffe8c0);
  ceilingLight(B, 3.2 * S, 2.9 * S, H, 0xfff8e0, 0.6);

  /* Living area */
  fSofa(B, 1.2 * S, 5.6 * S, Math.PI / 2, 2.2, 0.92, 0xd94f8a, 0xee7aa8);
  fCoffee(B, 3.1 * S, 5.6 * S, Math.PI / 2, 1.1, 0.6);
  fTV(B, 8.9 * S, 5.6 * S, -Math.PI / 2, 1.7);
  fRug(B, 4.9 * S, 5.6 * S, Math.PI / 2, 2.8, 2.0, 0x3a7ac0, 0xffd98a);
  wallArt(B, 4.9 * S, 5.3, 6.89 * S, Math.PI, 1.4, 0.9, 0x4a8ae0);
  fPlant(B, 9.3 * S, 0.7 * S);
  fPlant(B, 0.55 * S, 6.4 * S);
  fLampCeil(B, 3.2 * S, 5.6 * S, H);
  ceilingLight(B, 4.9 * S, 5.6 * S, H, 0xfff8e0, 0.5);

  /* Dining area */
  fDining(B, 5.6 * S, 4.0 * S, Math.PI / 2, 1.6, 0.9, 0xe06a3a);
  fChair(B, 6.6 * S, 3.6 * S, -Math.PI / 2, 0xf0a040);
  fChair(B, 6.6 * S, 4.4 * S, -Math.PI / 2, 0xf0a040);
  fChair(B, 4.6 * S, 3.6 * S, Math.PI / 2, 0xf0a040);
  fChair(B, 4.6 * S, 4.4 * S, Math.PI / 2, 0xf0a040);
  ceilingLight(B, 5.6 * S, 4.0 * S, H, 0xfff8e0, 0.5);

  /* ── South bedrooms ─────────────────────────────── */
  const southDuvets = [0x3d8ea8, 0xd94f8a, 0x6ac04a, 0xf09030, 0x8a5ad0];
  const southRugs   = [0x7a4a5a, 0x3a6a8a, 0x5a7a3a, 0x8a5a2a, 0x6a3a8a];
  for (let i = 0; i < 5; i++) {
    const cx = (13 + i * 6) * S;
    const x0 = (10 + i * 6) * S;
    fBed(B, cx, 1.225 * S, 0, { w: 1.6, l: 2.05, duvet: southDuvets[i] });
    fNightstand(B, cx - 1.2 * S, 0.4 * S, 0);
    fNightstand(B, cx + 1.2 * S, 0.4 * S, 0);
    fWardrobe(B, x0 + 0.42 * S, 3.5 * S, Math.PI / 2, 1.4, 0.6, 2.1);
    fRug(B, cx, 3.5 * S, 0, 2.4, 1.5, southRugs[i]);
    wallArt(B, cx, 5.0, 6.89 * S, Math.PI, 1.2, 0.8, 0x8a5a8a);
    ceilingLight(B, cx, 3.5 * S, H, 0xffe8c8, 0.4);
  }

  /* ── North bedrooms ─────────────────────────────── */
  const northDuvets = [0x3d8ea8, 0xd94f8a, 0x6ac04a, 0xf09030, 0x8a5ad0];
  const northRugs   = [0x7a4a5a, 0x3a6a8a, 0x5a7a3a, 0x8a5a2a, 0x6a3a8a];
  for (let i = 0; i < 5; i++) {
    const cx = (4 + i * 8) * S;
    const x0 = i * 8 * S;
    fBed(B, cx, 14.775 * S, Math.PI, { w: 1.6, l: 2.05, duvet: northDuvets[i] });
    fNightstand(B, cx - 1.2 * S, 15.6 * S, Math.PI);
    fNightstand(B, cx + 1.2 * S, 15.6 * S, Math.PI);
    fWardrobe(B, x0 + 0.42 * S, 12.5 * S, Math.PI / 2, 1.4, 0.6, 2.1);
    fRug(B, cx, 12.5 * S, 0, 2.4, 1.5, northRugs[i]);
    wallArt(B, cx, 5.0, 9.11 * S, 0, 1.2, 0.8, 0x3a6a8a);
    ceilingLight(B, cx, 12.5 * S, H, 0xffe8c8, 0.4);
  }

  /* ── West bathroom ─────────────────────────────── */
  fToilet(B, 0.7 * S, 7.55 * S, Math.PI / 2);
  fToilet(B, 0.7 * S, 8.45 * S, Math.PI / 2);
  fVanity(B, 2 * S, 7.2 * S, 0, 0.85);
  fShower(B, 3.3 * S, 7.6 * S, 0, 0.95, 0.95);
  B.glowBox(0.8, 0.9, 0.02, 0xd8e8f0, 2 * S, 4.4, 7.42 * S);
  ceilingLight(B, 2 * S, 8 * S, H, 0xfff4e0, 0.4);

  /* ── East bathroom ─────────────────────────────── */
  fToilet(B, 39.3 * S, 7.55 * S, -Math.PI / 2);
  fToilet(B, 39.3 * S, 8.45 * S, -Math.PI / 2);
  fVanity(B, 38 * S, 8.8 * S, Math.PI, 0.85);
  fShower(B, 36.7 * S, 7.6 * S, 0, 0.95, 0.95);
  B.glowBox(0.8, 0.9, 0.02, 0xd8e8f0, 38 * S, 4.4, 8.61 * S);
  ceilingLight(B, 38 * S, 8 * S, H, 0xfff4e0, 0.4);

  /* ── Corridor lights ───────────────────────────── */
  for (let i = 0; i < 7; i++) {
    ceilingLight(B, (5 + i * 5) * S, 8 * S, H, 0xfff8e0, 0.45);
  }

  /* ── Lighting rig ──────────────────────────────── */
  B._lights = lightRooms(B, [
    { x: 0, z: 0, w: 10, d: 7 },
    ...Array.from({ length: 5 }, (_, i) => ({ x: (10 + i * 6), z: 0, w: 6, d: 7 })),
    ...Array.from({ length: 5 }, (_, i) => ({ x: i * 8, z: 9, w: 8, d: 7 })),
    { x: 4, z: 7, w: 32, d: 2 },
    { x: 0, z: 7, w: 4, d: 2 },
    { x: 36, z: 7, w: 4, d: 2 },
  ], H);

  return B;
}
