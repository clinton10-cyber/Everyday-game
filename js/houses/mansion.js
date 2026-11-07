import { Builder, fArmchair, fBench, fBigScreen, fBookshelf, fChair, fChandelier, fCinemaSeat, fCoffee, fConsole, fDining, fDumbbell, fFireplace, fFridge, fIsland, fKitchen, fLamp, fLampCeil, fLounger, fPainting, fPiano, fPlant, fRug, fSink, fSofa, fStove, fTV, fTreadmill, fWindow, fYoga } from './_kit.js';

export function buildMansion(){
  const B = new Builder(60, 20);
  const S = B.S;
  const H = 8.0;
  const WT = 0.3, IT = 0.16, WALL = 0xfff2dc;
  B.level = 0; B.yOff = 0;

  B.floor(0, 0, 18*S, 12*S, 0xf0a850);
  B.floor(0, 12*S, 18*S, 22*S, 0x7ab88a);
  B.floor(0, 22*S, 18*S, 36*S, 0x6aa8e0);
  B.floor(18*S, 0, 30*S, 26*S, 0xf8ecd4);
  B.floor(18*S, 26*S, 30*S, 36*S, 0x3ab8d8);
  B.floor(30*S, 0, 46*S, 12*S, 0xf0b878);
  B.floor(30*S, 12*S, 46*S, 22*S, 0xd888a0);
  B.floor(30*S, 22*S, 46*S, 36*S, 0x6a5aa8);
  B.ceil(-0.2*S, -0.2*S, 46.2*S, 36.2*S, H, 0xfffaf0);

  B.wallZ(0, -0.15*S, 46.15*S, {t:WT,h:H,col:WALL,doors:[[21*S,27*S]]});
  B.wallZ(36*S, -0.15*S, 46.15*S, {t:WT,h:H,col:WALL});
  B.wallX(0, -0.15*S, 36.15*S, {t:WT,h:H,col:WALL});
  B.wallX(46*S, -0.15*S, 36.15*S, {t:WT,h:H,col:WALL});
  B.wallX(18*S, 0, 36*S, {t:IT,h:H,col:0xffe4c8,doors:[[8*S,10*S],[16*S,18*S],[28*S,30*S]]});
  B.wallX(30*S, 0, 36*S, {t:IT,h:H,col:0xffe4c8,doors:[[8*S,10*S],[16*S,18*S],[28*S,30*S]]});
  B.wallZ(12*S, 0, 18*S, {t:IT,h:H,col:0xffe4c8,doors:[[7*S,9*S]]});
  B.wallZ(22*S, 0, 18*S, {t:IT,h:H,col:0xffe4c8,doors:[[7*S,9*S]]});
  B.wallZ(12*S, 30*S, 46*S, {t:IT,h:H,col:0xffe4c8,doors:[[37*S,39*S]]});
  B.wallZ(22*S, 30*S, 46*S, {t:IT,h:H,col:0xffe4c8,doors:[[37*S,39*S]]});
  B.wallZ(26*S, 18*S, 30*S, {t:IT,h:H,col:0xffe4c8,doors:[[22*S,26*S]]});

  fRug(B, 9*S, 6*S, 0, 12, 8, 0xc0303a, 0xffd98a);
  fSofa(B, 4*S, 2*S, 0, 3.2, 1.0, 0xd94f8a, 0xee7aa8);
  fSofa(B, 4*S, 9.6*S, Math.PI, 3.2, 1.0, 0xd94f8a, 0xee7aa8);
  fSofa(B, 14.6*S, 6*S, -Math.PI/2, 3.0, 1.0, 0x3a7ac0, 0x5a9ae0);
  fArmchair(B, 9.2*S, 1.2*S, 0, 0xf0a020, 0xffc860);
  fArmchair(B, 9.2*S, 10.6*S, Math.PI, 0xf0a020, 0xffc860);
  fCoffee(B, 6*S, 6*S, 0, 2.4, 1.3);
  fTV(B, 0.6*S, 6*S, Math.PI/2, 2.6);
  fPlant(B, 16.6*S, 1*S); fPlant(B, 16.6*S, 11*S); fPlant(B, 1*S, 11*S);
  fPiano(B, 16.2*S, 9*S, -Math.PI/2);
  fChandelier(B, 9*S, 6*S, H-0.2, 1.1);
  fWindow(B, 5*S, 0.15*S, 0, 2.6, 1.9, 1); fWindow(B, 12*S, 0.15*S, 0, 2.6, 1.9, 1);
  fPainting(B, 0.2*S, 6*S, Math.PI/2, 1.4, 1, 0x4a8ae0);
  fFireplace(B, 9*S, 0.4*S, 0);

  fBookshelf(B, 1.6*S, 12.42*S, 0, 2.6, 3.2, 0.45, 0xa0602a);
  fBookshelf(B, 4.4*S, 12.42*S, 0, 2.6, 3.2, 0.45, 0xa0602a);
  fBookshelf(B, 7.2*S, 12.42*S, 0, 2.6, 3.2, 0.45, 0xa0602a);
  fBookshelf(B, 10.0*S, 12.42*S, 0, 2.6, 3.2, 0.45, 0xa0602a);
  fBookshelf(B, 12.8*S, 12.42*S, 0, 2.6, 3.2, 0.45, 0xa0602a);
  fBookshelf(B, 0.42*S, 17*S, Math.PI/2, 3, 3.2, 0.45, 0xa0602a);
  fBookshelf(B, 15.58*S, 17*S, -Math.PI/2, 3, 3.2, 0.45, 0xa0602a);
  fRug(B, 8*S, 17*S, 0, 9, 4, 0x3a6a3a, 0xd8f0a0);
  fArmchair(B, 6*S, 16.6*S, 0, 0xf0c020, 0xffe070);
  fArmchair(B, 10*S, 16.6*S, 0, 0xf0c020, 0xffe070);
  fCoffee(B, 8*S, 17.6*S, 0, 1.4, 0.7);
  fLamp(B, 4.6*S, 20.4*S, 0); fLamp(B, 11.4*S, 20.4*S, 0);
  fLampCeil(B, 8*S, 17*S, H);
  fWindow(B, 0.15*S, 17*S, Math.PI/2, 2.4, 1.8, 1);

  fTreadmill(B, 2.6*S, 25*S, 0, 0xe04040);
  fTreadmill(B, 4.4*S, 25*S, 0, 0x40c060);
  fTreadmill(B, 6.2*S, 25*S, 0, 0x4080e0);
  fBench(B, 12*S, 25*S, 0, 0x3a3a48); fBench(B, 12*S, 28*S, 0, 0x3a3a48);
  fDumbbell(B, 15*S, 25*S, -Math.PI/2); fDumbbell(B, 15*S, 30*S, -Math.PI/2);
  fYoga(B, 3*S, 32*S, 0, 0x40d0c0); fYoga(B, 4.6*S, 32*S, 0, 0xf070a0);
  fYoga(B, 6.2*S, 32*S, 0, 0xf0c020); fYoga(B, 7.8*S, 32*S, 0, 0x70a0f0);
  fRug(B, 5*S, 29*S, 0, 9, 6, 0x2a5a8a, 0xa8e0f8);
  fLampCeil(B, 5*S, 26*S, H); fLampCeil(B, 12*S, 32*S, H);
  fPlant(B, 16.6*S, 34.6*S);

  fRug(B, 21*S, 12*S, 0, 4.6, 14, 0xc02030, 0xffd98a);
  fChandelier(B, 21*S, 6*S, H-0.2, 1.0); fChandelier(B, 21*S, 18*S, H-0.2, 1.0);
  fConsole(B, 18.3*S, 20*S, Math.PI/2, 1.4); fConsole(B, 29.7*S, 20*S, -Math.PI/2, 1.4);
  fPlant(B, 18.8*S, 1.2*S); fPlant(B, 29.2*S, 1.2*S);
  fPainting(B, 18.2*S, 4*S, Math.PI/2, 1, 0.8, 0x4a8ae0);
  fPainting(B, 29.8*S, 4*S, -Math.PI/2, 1, 0.8, 0xe08a4a);
  fWindow(B, 24*S, 0.16*S, 0, 2, 2, 1);

  const NS=13, sdz=(10/NS)*S, sdy=H/NS;
  for(let i=0;i<NS;i++){const zc=14*S-(i+0.5)*sdz;const hh=(i+1)*sdy;const col=(i%2)?0xf8e8c8:0xe0c898;B.box(4*S,hh,sdz,col,26*S,hh/2,zc,0,false);}
  for(let i=0;i<NS;i++){const zc=14*S-(i+0.5)*sdz;const hh=(i+1)*sdy;for(const xx of [24.09*S,27.91*S])B.box(0.1*S,0.9,sdz,0xd8a020,xx,hh+0.45,zc,0,false);}

  B.box(8.8*S,0.3,6.8*S,0xe8e0d0,24*S,0.03,31*S,0,false);
  B.glowBox(8*S,0.06,6*S,0x30c8e8,24*S,0.14,31*S);
  B.glowBox(7.2*S,0.02,5.2*S,0x80e8ff,24*S,0.19,31*S);
  B.box(0.5*S,0.34,7.6*S,0xfff4e0,19.6*S,0.17,31*S,0,false);
  B.box(0.5*S,0.34,7.6*S,0xfff4e0,28.4*S,0.17,31*S,0,false);
  fLounger(B, 19.9*S, 28*S, 0, 0xfff0d0); fLounger(B, 19.9*S, 31*S, 0, 0xffd0a0); fLounger(B, 19.9*S, 34*S, 0, 0xa0e0ff);
  fPlant(B, 29.2*S, 27*S); fPlant(B, 29.2*S, 35*S);

  fKitchen(B, 36*S, 0.44, 0, 9, {cab:0x60c8b0,top:0x2f3237});
  fSink(B, 33*S, 0.44, 0); fSink(B, 39*S, 0.44, 0);
  fStove(B, 35*S, 0.44, 0); fStove(B, 37*S, 0.44, 0);
  fFridge(B, 43.6*S, 0.48, 0, 0xe0a0c0); fFridge(B, 44.5*S, 0.48, 0, 0xe0a0c0);
  fKitchen(B, 45.4*S, 5*S, -Math.PI/2, 6, {cab:0x60c8b0});
  fIsland(B, 37*S, 6*S, 0, 5, 1.5, {cab:0x5ac8a0,top:0x2f3237});
  for(let i=0;i<4;i++)fChair(B, 35.4*S+i*1.1*S, 4.9*S, 0, 0xf0a040);
  fRug(B, 37*S, 9.5*S, 0, 6, 3.4, 0x2a8a6a, 0xa0f0d0);
  fDining(B, 36*S, 9.5*S, 0, 2.6, 1.1, 0xe06a3a);
  fChair(B, 34.9*S, 8.9*S, 0, 0xf0a040); fChair(B, 37.1*S, 8.9*S, 0, 0xf0a040);
  fChair(B, 34.9*S, 10.1*S, Math.PI, 0xf0a040); fChair(B, 37.1*S, 10.1*S, Math.PI, 0xf0a040);
  fWindow(B, 36*S, 0.16*S, 0, 3, 1.8, 1);
  fLampCeil(B, 36*S, 3*S, H); fLampCeil(B, 36*S, 9*S, H);
  fPlant(B, 45*S, 11*S);

  fChandelier(B, 38*S, 17*S, H-0.2, 1.0);
  fRug(B, 38*S, 17*S, 0, 12, 8, 0x8a2a5a, 0xffc8e0);
  fDining(B, 38*S, 17*S, 0, 7, 1.6, 0x6a2a5a);
  for(let i=0;i<7;i++){fChair(B, 35.4*S+i*0.85*S, 15.6*S, 0, 0xf0c020);fChair(B, 35.4*S+i*0.85*S, 18.4*S, Math.PI, 0xf0c020);}
  fChair(B, 34.2*S, 17*S, Math.PI/2, 0xf0c020); fChair(B, 41.8*S, 17*S, -Math.PI/2, 0xf0c020);
  fConsole(B, 30.4*S, 14*S, Math.PI/2, 1.6); fConsole(B, 30.4*S, 20*S, Math.PI/2, 1.6);
  fPainting(B, 38*S, 12.2*S, Math.PI, 2, 1.3, 0xe08a4a);
  fWindow(B, 34*S, 12.2*S, Math.PI, 2, 1.8, 1); fWindow(B, 42*S, 12.2*S, Math.PI, 2, 1.8, 1);
  fPlant(B, 45*S, 12.8*S); fPlant(B, 45*S, 21.2*S);

  fBigScreen(B, 38*S, 22.35*S, Math.PI, 8, 3.6);
  for(let r=0;r<4;r++){const zz=26*S+r*2.2*S;const yy=r*0.28;B.box(11*S,0.28,2.2*S,0x4a3a6a,38*S,yy+0.14,zz,0,false);for(let c=0;c<6;c++)fCinemaSeat(B, 33.4*S+c*1.85*S, zz, 0, (c%2)?0xc02030:0xd03040);}
  fRug(B, 38*S, 24.5*S, 0, 11, 2.6, 0x2a1a4a, 0x6a5aa8);
  fLampCeil(B, 34*S, 24.5*S, H); fLampCeil(B, 42*S, 24.5*S, H);

  B.level=1; B.yOff=H;
  B.floor(0,0,24*S,36*S,0xe0a878); B.floor(28*S,0,46*S,36*S,0xe0a878);
  B.floor(24*S,0,28*S,4*S,0xe0a878); B.floor(24*S,14*S,28*S,36*S,0xe0a878);
  B.wallZ(0,-0.15*S,46.15*S,{t:0.28,h:1.2,col:0xf8d8a8});
  B.wallZ(36*S,-0.15*S,46.15*S,{t:0.28,h:1.2,col:0xf8d8a8});
  B.wallX(0,-0.15*S,36.15*S,{t:0.28,h:1.2,col:0xf8d8a8});
  B.wallX(46*S,-0.15*S,36.15*S,{t:0.28,h:1.2,col:0xf8d8a8});
  fBigScreen(B, 14*S, 26.6*S, Math.PI, 5, 2.4);
  fSofa(B, 14*S, 30.5*S, Math.PI, 3.4, 1, 0x2a8ad0, 0x50b0f0);
  fSofa(B, 9.6*S, 30.5*S, Math.PI/2, 3, 1, 0x2a8ad0, 0x50b0f0);
  fSofa(B, 18.4*S, 30.5*S, -Math.PI/2, 3, 1, 0x2a8ad0, 0x50b0f0);
  fCoffee(B, 14*S, 30.5*S, 0, 2.2, 1.2);
  fRug(B, 14*S, 30*S, 0, 8, 5, 0xd04040, 0xffe090);
  fRug(B, 38*S, 9.5*S, 0, 7, 6, 0x8a5a2a, 0xffc880);
  fDining(B, 38*S, 11*S, 0, 4, 1.4, 0xe06a3a);
  for(let i=0;i<4;i++){fChair(B, 36.6*S+i*0.95*S, 9.9*S, 0, 0xf0a040);fChair(B, 36.6*S+i*0.95*S, 12.1*S, Math.PI, 0xf0a040);}
  fRug(B, 9*S, 12*S, 0, 11, 12, 0x4a8a3a, 0xc8f090);
  for(let i=0;i<6;i++){fPlant(B, 3.4*S+i*2.1*S, 5.2*S);fPlant(B, 3.4*S+i*2.1*S, 18.8*S);}
  fBench(B, 6*S, 12*S, 0, 0x8a5a2a); fBench(B, 12*S, 12*S, 0, 0x8a5a2a);
  fArmchair(B, 9*S, 15*S, 0, 0xf070a0, 0xffa0c8);
  fArmchair(B, 9*S, 9*S, Math.PI, 0xf070a0, 0xffa0c8);
  fCoffee(B, 9*S, 12*S, 0, 1.6, 0.9);
  fLounger(B, 34*S, 30*S, 0, 0xfff0d0); fLounger(B, 36*S, 30*S, 0, 0xffd0a0);
  fLounger(B, 38*S, 30*S, 0, 0xa0e0ff); fLounger(B, 40*S, 30*S, 0, 0xf0c0e0);
  fRug(B, 37*S, 30*S, 0, 9, 5, 0x30a0c0, 0xd0f0ff);

  return B;
}

