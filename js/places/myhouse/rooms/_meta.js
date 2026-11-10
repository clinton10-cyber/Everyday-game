/* My House layout -- ENLARGED.
   Footprint is now 36 x 30 m (was 27 x 24). Bedrooms 2/4 are 5 x 7.5
   (were 3.5 x 7), the bedrooms/living/library are 12-13 m wide, and the
   hall is 4 m wide. All rooms keep the same adjacency / door topology.
   win: which outer walls get a window (N/S/W/E).                       */
export const ROOM_LAYOUT=[
  {id:"bedroomA",label:"MASTER BEDROOM",x:-18, z:-15,w:12, d:13, floor:0x6a4a62,type:"bedroom",win:"NW"},
  {id:"bathA",   label:"MASTER BATH",   x:-6,  z:-15,w:5,  d:5.5,floor:0x3e5a68,type:"bath",   win:"N"},
  {id:"bedroomB",label:"BEDROOM 2",     x:-6,  z:-9.5,w:5, d:7.5,floor:0x6a4a62,type:"bedroom",win:""},
  {id:"bedroomC",label:"BEDROOM 3",     x:-1,  z:-15,w:8,  d:13, floor:0x6a4a62,type:"bedroom",win:"N"},
  {id:"bathC",   label:"GUEST BATH",    x:7,   z:-15,w:5,  d:5.5,floor:0x3e5a68,type:"bath",   win:"N"},
  {id:"bedroomD",label:"BEDROOM 4",     x:7,   z:-9.5,w:5, d:7.5,floor:0x6a4a62,type:"bedroom",win:""},
  {id:"bedroomE",label:"BEDROOM 5",     x:12,  z:-15,w:6,  d:13, floor:0x6a4a62,type:"bedroom",win:"N"},
  {id:"corridor",label:"ENTRY HALL",    x:-18, z:-2, w:36, d:4,  floor:0x8a6248,type:"corridor",win:""},
  {id:"living",  label:"LIVING ROOM",   x:-18, z:2,  w:13, d:13, floor:0x6a5440,type:"living", win:"SW"},
  {id:"kitchen", label:"KITCHEN",       x:-5,  z:2,  w:10, d:13, floor:0x55534e,type:"kitchen",win:"S"},
  {id:"library", label:"LIBRARY",       x:5,   z:2,  w:13, d:13, floor:0x5a4533,type:"library",win:"S"},
];

/* Interaction anchors, relative to the room centre, so sit / lie / toilet
   / wash / cook prompts land on the real furniture. fx,fz = facing. */
export const ANCHORS={
  bedroomA:{lie:{offX:0,   offZ:-5.1,fx:0,fz:-1}},
  bedroomB:{lie:{offX:-1.5,offZ:-2.7,fx:0,fz:-1}},
  bedroomC:{lie:{offX:0,   offZ:-5.25,fx:0,fz:-1}},
  bedroomD:{lie:{offX:1.55,offZ:-2.7,fx:0,fz:-1}},
  bedroomE:{lie:{offX:0,   offZ:-5.3,fx:0,fz:-1}},
  living:  {sit:{offX:-2.05,offZ:0,fx:-1,fz:0}, watch:{offX:-3.3,offZ:0}},
  kitchen: {cook:{offX:-1.55,offZ:-4.8}},
  library: {sit:{offX:4.4,offZ:3.9,fx:-1,fz:0}, read:{offX:.5,offZ:-.15}},
  bathA:   {toilet:{offX:-1.85,offZ:1.85,fx:1,fz:0},  wash:{offX:1.4,offZ:1.75}},
  bathC:   {toilet:{offX:1.85, offZ:1.85,fx:-1,fz:0}, wash:{offX:-1.4,offZ:1.75}},
};

