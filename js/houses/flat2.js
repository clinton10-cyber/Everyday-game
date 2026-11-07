/* flat2.js — 2-bedroom apartment. Trims, windows, doors, curtains,
   full kitchen, two bedrooms, study nook, and a lighting rig. */
import {
  Builder, fBed, fChair, fCoffee, fConsole, fDining, fFridge, fKitchen,
  fLamp, fLampCeil, fNightstand, fPainting, fPlant, fRug, fShower, fSink,
  fSofa, fStove, fTV, fToilet, fVanity, fWardrobe, fDesk,
} from './_kit.js';
import {
  trimRoom, windowFrame, doorFrame, wallArt, curtains,
  ceilingLight, pendant, lightRooms,
} from './_enhancements.js';

export function buildFlat2() {
  const B = new Builder(0, 20);
  const S = B.S;
  const H = 8.0, WT = 0.20, IT = 0.12, WALL = 0xfff4e6;
  const TRIM = 0xf5f0e6;

  /* ── Floors ─────────────────────────────────────── */
  B.floor(0, 0, 5 * S, 8 * S, 0xf0b060);
  B.floor(5 * S, 0, 6.5 * S, 8 * S, 0xd0a878);
  B.floor(6.5 * S, 0, 12 * S, 4.5 * S, 0xd08aa8);
  B.floor(6.5 * S, 4.5 * S, 9 * S, 6 * S, 0xd0a878);
  B.floor(9 * S, 4.5 * S, 12 * S, 8 * S, 0x9ad0a0);
  B.floor(6.5 * S, 6 * S, 9 * S, 8 * S, 0x8ad0e0);

  /* ── Ceiling ───────────────────────────────────── */
  B.ceil(-0.2 * S, -0.2 * S, 12.2 * S, 8.2 * S, H, 0xfffaf0);

  /* ── Outer walls ────────────────────────────────── */
  B.wallZ(0, -0.1 * S, 12.1 * S, { t: WT, h: H, col: WALL });
  B.wallZ(8 * S, -0.1 * S, 12.1 * S, { t: WT, h: H, col: WALL });
  B.wallX(0, -0.1 * S, 8.1 * S, { t: WT, h: H, col: WALL });
  B.wallX(12 * S, -0.1 * S, 8.1 * S, { t: WT, h: H, col: WALL });

  /* ── Partitions ─────────────────────────────────── */
  B.wallX(5 * S, 0, 8 * S, { t: IT, h: H, col: 0xffe8d0, doors: [[3.4 * S, 4.3 * S]] });
  B.wallX(6.5 * S, 0, 4.5 * S, { t: IT, h: H, col: 0xffe8d0, doors: [[1.5 * S, 2.4 * S]] });
  B.wallZ(4.5 * S, 6.5 * S, 12 * S, { t: IT, h: H, col: 0xffe8d0 });
  B.wallX(9 * S, 4.5 * S, 8 * S, { t: IT, h: H, col: 0xffe8d0, doors: [[5 * S, 5.9 * S]] });
  B.wallZ(6 * S, 6.5 * S, 9 * S, { t: IT, h: H, col: 0xffe8d0, doors: [[7.2 * S, 8.1 * S]] });

  /* ── Room trims ─────────────────────────────────── */
  trimRoom(B, 0, 0, 5, 8, H, TRIM);
  trimRoom(B, 5, 0, 6.5, 8, H, TRIM);
  trimRoom(B, 6.5, 0, 12, 4.5, H, TRIM);
  trimRoom(B, 6.5, 4.5, 9, 6, H, TRIM);
  trimRoom(B, 9, 4.5, 12, 8, H, TRIM);
  trimRoom(B, 6.5, 6, 9, 8, H, TRIM);

  /* ── Doors ──────────────────────────────────────── */
  doorFrame(B, 3.85 * S, 5 * S, Math.PI / 2, 0.9, 2.10, { frameColor: 0xb08050 });
  doorFrame(B, 6.5 * S, 1.95 * S, Math.PI / 2, 0.9, 2.10, { frameColor: 0xd8d0c0 });
  doorFrame(B, 9 * S, 5.45 * S, Math.PI / 2, 0.9, 2.10, { frameColor: 0xd8d0c0 });
  doorFrame(B, 7.65 * S, 6 * S, 0, 0.9, 2.10, { frameColor: 0xd8d0c0 });

  /* ── Windows ───────────────────────────────────── */
  windowFrame(B, 0.11 * S, 3.6, 6.0 * S, Math.PI / 2, 1.6, 1.4, { glassColor: 0xd4ecff });
  windowFrame(B, 3.6 * S, 4.0, 0.11, 0, 1.2, 1.2, { glassColor: 0xd4ecff });
  windowFrame(B, 11.89 * S, 4.0, 3.0 * S, -Math.PI / 2, 1.4, 1.4, { glassColor: 0xd4ecff });
  windowFrame(B, 8.0 * S, 4.4, 7.89 * S, Math.PI, 1.2, 1.2, { glassColor: 0xd4ecff });
  windowFrame(B, 11.89 * S, 4.4, 6.5 * S, -Math.PI / 2, 1.0, 1.2, { glassColor: 0xd4ecff });
  windowFrame(B, 10.5 * S, 4.4, 0.11, 0, 1.1, 1.2, { glassColor: 0xd4ecff });

  /* ── Curtains ──────────────────────────────────── */
  curtains(B, 0.14 * S, 4.4, 6.0 * S, Math.PI / 2, 1.8, 2.1, 0xf0e0c8);
  curtains(B, 11.86 * S, 4.8, 3.0 * S, -Math.PI / 2, 1.6, 2.2, 0xe0d0c8);

  /* ── Kitchen ────────────────────────────────────── */
  fKitchen(B, 1.45 * S, 0.41, 0, 2.2, { cab: 0x60c8b0 });
  fSink(B, 0.85 * S, 0.41, 0);
  fStove(B, 2.05 * S, 0.41, 0);
  fFridge(B, 0.5 * S, 5.9 * S, Math.PI / 2, 0xe0a0c0);

  /* Upper cabinets + backsplash */
  B.box(2.2 * S, 0.7, 0.35, 0x60c8b0, 1.45 * S, 6.1, 0.30);
  B.box(2.2 * S, 0.06, 0.40, 0x4aa890, 1.45 * S, 6.48, 0.32);
  B.box(2.3 * S, 1.4, 0.02, 0xd8e4ec, 1.45 * S, 4.4, 0.13);

  /* Dining nook */
  fDining(B, 2.6 * S, 2.4 * S, 0, 1.4, 0.85, 0xe06a3a);
  fChair(B, 2.2 * S, 1.6 * S, 0, 0xf0a040);
  fChair(B, 3.0 * S, 1.6 * S, 0, 0xf0a040);
  fChair(B, 2.2 * S, 3.2 * S, Math.PI, 0xf0a040);
  fChair(B, 3.0 * S, 3.2 * S, Math.PI, 0xf0a040);
  pendant(B, 2.6 * S, 2.4 * S, H, 1.1, 0xffe8c0);

  /* ── Living area ────────────────────────────────── */
  fRug(B, 2.4 * S, 6.0 * S, Math.PI / 2, 2.4, 1.8, 0x3a7ac0, 0xa8e0f8);
  fSofa(B, 0.62 * S, 6.0 * S, Math.PI / 2, 2.0, 0.9, 0xd94f8a, 0xee7aa8);
  fCoffee(B, 2.3 * S, 6.0 * S, Math.PI / 2, 1.0, 0.55);
  fTV(B, 4.74 * S, 6.0 * S, -Math.PI / 2, 1.6);

  wallArt(B, 3.5 * S, 5.0, 0.11, 0, 1.1, 0.8, 0x8a3a3a);
  wallArt(B, 4.74 * S, 5.2, 3.5 * S, -Math.PI / 2, 0.7, 0.9, 0x3a6a8a);

  fPlant(B, 4.55 * S, 0.8 * S);
  fLampCeil(B, 2.4 * S, 6.0 * S, H);
  fLampCeil(B, 1.45 * S, 1.5 * S, H);
  ceilingLight(B, 2.4 * S, 6.0 * S, H, 0xfff8e0, 0.5);

  /* ── Master bedroom ─────────────────────────────── */
  fBed(B, 9.25 * S, 3.275 * S, Math.PI, { w: 1.6, l: 2.05, duvet: 0x3d8ea8 });
  fNightstand(B, 8.0 * S, 2.0 * S, Math.PI);
  fNightstand(B, 10.5 * S, 2.0 * S, Math.PI);
  fWardrobe(B, 7.0 * S, 3.3 * S, Math.PI / 2, 1.4, 0.6, 2.1);
  fRug(B, 9.25 * S, 1.8 * S, 0, 2.4, 1.5, 0x7a4a5a, 0xffd98a);

  wallArt(B, 9.25 * S, 5.0, 0.11, 0, 1.4, 0.9, 0x3a6a8a);
  wallArt(B, 11.89 * S, 5.0, 2.5 * S, -Math.PI / 2, 0.8, 1.0, 0xe8a040);
  ceilingLight(B, 9.25 * S, 2.2 * S, H, 0xffe8c8, 0.55);
  fLampCeil(B, 9.25 * S, 2.2 * S, H);

  /* ── Second bedroom ─────────────────────────────── */
  fBed(B, 10.5 * S, 6.775 * S, Math.PI, { w: 1.15, l: 2.05, duvet: 0xf09030 });
  fNightstand(B, 9.5 * S, 5.6 * S, Math.PI);
  fWardrobe(B, 11.5 * S, 5.7 * S, -Math.PI / 2, 1.2, 0.6, 2.1);
  fRug(B, 10.5 * S, 5.8 * S, 0, 2.2, 1.4, 0x8a5a2a, 0xffc880);

  wallArt(B, 10.5 * S, 5.0, 7.89 * S, Math.PI, 1.0, 0.7, 0xe8a040);
  ceilingLight(B, 10.5 * S, 6.2 * S, H, 0xffe8c8, 0.5);

  /* ── Study nook ─────────────────────────────────── */
  fDesk(B, 7.75 * S, 5.35 * S, Math.PI, 1.4);
  fChair(B, 7.75 * S, 4.9 * S, 0, 0x2a2a2e);
  /* Laptop */
  B.box(0.4, 0.02, 0.3, 0x1a1a1e, 7.75 * S, 3.55, 5.35 * S);
  B.glowBox(0.4, 0.24, 0.02, 0x4a6a8a, 7.75 * S, 3.72, 5.15 * S);
  /* Bookshelf */
  B.box(0.4, 2.4, 1.6, 0x4a2f1a, 6.61 * S, 1.2, 5.4 * S);
  for (let i = 0; i < 4; i++) {
    B.box(0.36, 0.04, 1.55, 0x6a4a2a, 6.62 * S, 0.35 + i * 0.6, 5.4 * S);
    const bookCols = [0x8c3b3b, 0x2f5d6b, 0x6b5b2f, 0x3d4f6b, 0x7a4a6b];
    for (let j = 0; j < 5; j++) {
      B.box(0.28, 0.42, 0.24, bookCols[j],
        6.63 * S, 0.6 + i * 0.6, 4.75 + j * 0.28);
    }
  }
  ceilingLight(B, 7.75 * S, 5.3 * S, H, 0xffe8c8, 0.4);

  /* ── Bathroom ───────────────────────────────────── */
  fToilet(B, 6.95 * S, 6.55 * S, Math.PI / 2);
  fVanity(B, 7.8 * S, 7.45 * S, Math.PI, 0.85);
  fShower(B, 8.45 * S, 7.45 * S, Math.PI, 0.95, 0.95);
  B.glowBox(0.7, 0.9, 0.02, 0xd8e8f0, 7.8 * S, 4.4, 7.42 * S);
  ceilingLight(B, 7.75 * S, 7.0 * S, H, 0xfff4e0, 0.4);

  /* ── Console in the hallway ─────────────────────── */
  fConsole(B, 5.75 * S, 6.6 * S, Math.PI, 1.1);
  fPainting(B, 5.06 * S, 5.5 * S, Math.PI / 2, 0.8, 0.6, 0x4a8ae0);

  /* ── Lighting rig ──────────────────────────────── */
  B._lights = lightRooms(B, [
    { x: 0, z: 0, w: 5, d: 8 },
    { x: 5, z: 0, w: 1.5, d: 8 },
    { x: 6.5, z: 0, w: 5.5, d: 4.5 },
    { x: 9, z: 4.5, w: 3, d: 3.5 },
    { x: 6.5, z: 6, w: 2.5, d: 2 },
  ], H);

  return B;
}
