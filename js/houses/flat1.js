/* flat1.js — 1-bedroom starter flat. Full pass: trims, windows,
   doors, kitchen, bedroom, bathroom, lighting, wall art. */
import {
  Builder, fBed, fChair, fCoffee, fDining, fDresser, fFridge, fKitchen,
  fLamp, fLampCeil, fNightstand, fPlant, fRug, fSink, fSofa, fStove,
  fTV, fToilet, fTub, fVanity, fWardrobe,
} from './_kit.js';
import {
  trimRoom, windowFrame, doorFrame, wallArt, curtains,
  ceilingLight, pendant, lightRooms,
} from './_enhancements.js';

export function buildFlat1() {
  const B = new Builder(0, 0);
  const S = B.S;
  const H = 8.0, WT = 0.20, IT = 0.12, WALL = 0xfff2e0;
  const TRIM = 0xf5f0e6;

  /* ── Floors ─────────────────────────────────────── */
  B.floor(0 * S, 0 * S, 5.2 * S, 7 * S, 0xf0b060);
  B.floor(5.2 * S, 2.8 * S, 9 * S, 7 * S, 0xd08aa8);
  B.floor(5.2 * S, 0 * S, 6.6 * S, 2.8 * S, 0x8ad0e0);
  B.floor(6.6 * S, 0 * S, 9 * S, 2.8 * S, 0xd08aa8);

  /* ── Ceiling ───────────────────────────────────── */
  B.ceil(-0.2 * S, -0.2 * S, 9.2 * S, 7.2 * S, H, 0xfffaf0);

  /* ── Outer walls ────────────────────────────────── */
  B.wallZ(0 * S, -0.1 * S, 9.1 * S, { t: WT, h: H, col: WALL });
  B.wallZ(7 * S, -0.1 * S, 9.1 * S, { t: WT, h: H, col: WALL });
  B.wallX(0 * S, -0.1 * S, 7.1 * S, { t: WT, h: H, col: WALL });
  B.wallX(9 * S, -0.1 * S, 7.1 * S, { t: WT, h: H, col: WALL });

  /* ── Interior partitions ────────────────────────── */
  B.wallX(5.2 * S, 0 * S, 7 * S, { t: IT, h: H, col: 0xffe8d0, doors: [[2.6 * S, 3.5 * S]] });
  B.wallX(6.6 * S, 0 * S, 2.8 * S, { t: IT, h: H, col: 0xffe8d0, doors: [[1 * S, 1.9 * S]] });
  B.wallZ(2.8 * S, 6.6 * S, 9 * S, { t: IT, h: H, col: 0xffe8d0 });

  /* ── Baseboards + crowns per room ──────────────── */
  trimRoom(B, 0, 0, 5.2, 7, H, TRIM);
  trimRoom(B, 5.2, 2.8, 9, 7, H, TRIM);
  trimRoom(B, 5.2, 0, 6.6, 2.8, H, TRIM);
  trimRoom(B, 6.6, 0, 9, 2.8, H, TRIM);

  /* ── Doors between rooms ───────────────────────── */
  doorFrame(B, 3.05 * S, 5.2 * S, Math.PI / 2, 1.0, 2.15, { frameColor: 0xb08050 });
  doorFrame(B, 6.6 * S, 1.45 * S, Math.PI / 2, 0.9, 2.10, { frameColor: 0xd8d0c0 });

  /* ── Windows ───────────────────────────────────── */
  windowFrame(B, 0.11 * S, 3.6, 5.3 * S, Math.PI / 2, 1.6, 1.3, { glassColor: 0xd4ecff });
  windowFrame(B, 4.55 * S, 3.6, 0.11, 0, 1.1, 1.2, { glassColor: 0xd4ecff });
  windowFrame(B, 7.6 * S, 4.5, 7.0 * S - 0.11, Math.PI, 1.4, 1.4, { glassColor: 0xd4ecff });
  windowFrame(B, 8.89 * S, 4.5, 5.4 * S, -Math.PI / 2, 1.0, 1.2, { glassColor: 0xd4ecff });
  windowFrame(B, 6.45 * S, 4.5, 0.11, 0, 0.8, 1.0, { glassColor: 0xd4ecff });

  /* ── Curtains over windows ──────────────────────── */
  curtains(B, 0.14 * S, 4.4, 5.3 * S, Math.PI / 2, 1.8, 1.9, 0xf0e0c8);
  curtains(B, 7.6 * S, 5.0, 6.85 * S, Math.PI, 1.6, 2.0, 0xe8d8b8);

  /* ── Kitchen ───────────────────────────────────── */
  fKitchen(B, 1.75 * S, 0.41, 0, 2.8, { cab: 0x5ac8a0 });
  fSink(B, 1.0 * S, 0.41, 0);
  fStove(B, 2.6 * S, 0.41, 0);
  fFridge(B, 3.8 * S, 0.45, 0);

  /* Upper cabinets + backsplash */
  B.box(2.7 * S, 0.7, 0.35, 0x5ac8a0, 1.75 * S, 6.1, 0.30);
  B.box(2.7 * S, 0.06, 0.40, 0x4a9c80, 1.75 * S, 6.48, 0.32);
  B.box(2.8 * S, 1.4, 0.02, 0xd8e4ec, 1.75 * S, 4.4, 0.13);

  /* ── Dining area ───────────────────────────────── */
  fDining(B, 1.7 * S, 2.75 * S, 0, 1.4, 0.85, 0xe06a3a);
  fChair(B, 1.3 * S, 1.95 * S, 0, 0xf0a040);
  fChair(B, 2.1 * S, 1.95 * S, 0, 0xf0a040);
  fChair(B, 1.3 * S, 3.55 * S, Math.PI, 0xf0a040);
  fChair(B, 2.1 * S, 3.55 * S, Math.PI, 0xf0a040);
  pendant(B, 1.7 * S, 2.75 * S, H, 1.1, 0xffe8c0);

  /* ── Living room ───────────────────────────────── */
  fRug(B, 2.75 * S, 5.3 * S, Math.PI / 2, 2.6, 1.9, 0xc0303a, 0xffd98a);
  fSofa(B, 0.62 * S, 5.3 * S, Math.PI / 2, 2.1, 0.9, 0x3a7ac0, 0x5a9ae0);
  fCoffee(B, 2.6 * S, 5.3 * S, Math.PI / 2, 1.05, 0.58);
  fTV(B, 4.94 * S, 5.3 * S, -Math.PI / 2, 1.7);

  /* ── Wall art in the living room ───────────────── */
  wallArt(B, 3.6 * S, 5.0, 0.11, 0, 1.2, 0.9, 0x4a8ae0);
  wallArt(B, 4.55 * S, 5.0, 3.5 * S, -Math.PI / 2, 0.8, 0.6, 0xe8a040);

  /* ── Plants ────────────────────────────────────── */
  fPlant(B, 4.7 * S, 1.05 * S);
  fPlant(B, 0.55 * S, 6.5 * S);

  /* ── Ceiling lights ────────────────────────────── */
  fLampCeil(B, 2.6 * S, 5.3 * S, H);
  fLampCeil(B, 1.75 * S, 1.6 * S, H);
  ceilingLight(B, 2.6 * S, 5.3 * S, H, 0xfff8e0, 0.5);
  ceilingLight(B, 1.4 * S, 3.0 * S, H, 0xfff8e0, 0.4);

  /* ── Bedroom ───────────────────────────────────── */
  fBed(B, 7.1 * S, 5.72 * S, Math.PI, { w: 1.6, l: 2.05, duvet: 0xd94f8a, frame: 0xa8703a });
  fNightstand(B, 5.95 * S, 6.6 * S, Math.PI);
  fNightstand(B, 8.15 * S, 6.6 * S, Math.PI);
  fLamp(B, 5.95 * S, 6.6 * S, Math.PI);
  fLamp(B, 8.15 * S, 6.6 * S, Math.PI);
  fWardrobe(B, 8.64 * S, 4.6 * S, -Math.PI / 2, 1.2, 0.6, 2.1, 0xd9a878);
  fDresser(B, 5.49 * S, 4.1 * S, Math.PI / 2, 1.1, 0.45, 0.8, 0xb87a5a);
  fRug(B, 7.1 * S, 4.6 * S, 0, 2.2, 1.4, 0x5a3a8a, 0xd8b0f8);

  wallArt(B, 7.1 * S, 5.2, 6.89 * S, Math.PI, 1.3, 0.9, 0x8a5a8a);
  wallArt(B, 5.31 * S, 4.8, 5.0 * S, Math.PI / 2, 0.8, 0.6, 0xe8a040);
  fLampCeil(B, 7.1 * S, 4.6 * S, H);
  ceilingLight(B, 7.1 * S, 4.6 * S, H, 0xffe8c8, 0.5);

  /* ── Bathroom ──────────────────────────────────── */
  fTub(B, 7.85 * S, 0.475, 0, 2, 0.75);
  fToilet(B, 8.6 * S, 1.9 * S, -Math.PI / 2);
  fVanity(B, 7.2 * S, 2.5 * S, Math.PI, 0.8);
  /* Towel rail */
  B.box(0.02, 0.02, 0.9, 0x8a8a92, 5.35 * S, 3.2, 1.4 * S, 0, false);
  /* Mirror glow */
  B.glowBox(0.9, 1.0, 0.02, 0xd8e8f0, 7.2 * S, 4.2, 2.42 * S);
  ceilingLight(B, 5.9 * S, 1.4 * S, H, 0xfff4e0, 0.35);

  /* ── Lighting rig ──────────────────────────────── */
  B._lights = lightRooms(B, [
    { x: 0, z: 0, w: 5.2, d: 7 },
    { x: 5.2, z: 2.8, w: 3.8, d: 4.2 },
    { x: 5.2, z: 0, w: 1.4, d: 2.8 },
  ], H);

  return B;
}
