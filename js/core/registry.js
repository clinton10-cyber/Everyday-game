export const PLACES = {
  "nightclub": {
    meta:     () => import("../places/nightclub/meta.js"),
    exterior: () => import("../places/nightclub/exterior.js"),
    interior: () => import("../places/nightclub/interior.js"),
  },
  /* ── newer places (converted from standalone prototypes) ── */
  "hospital": {
    meta:     () => import("../places/hospital/meta.js"),
    exterior: () => import("../places/hospital/exterior.js"),
    interior: () => import("../places/hospital/interior.js"),
  },
  "church": {
    meta:     () => import("../places/church/meta.js"),
    exterior: () => import("../places/church/exterior.js"),
    interior: () => import("../places/church/interior.js"),
  },
  "mosque": {
    meta:     () => import("../places/mosque/meta.js"),
    exterior: () => import("../places/mosque/exterior.js"),
    interior: () => import("../places/mosque/interior.js"),
  },
  "vatican": {
    meta:     () => import("../places/vatican/meta.js"),
    exterior: () => import("../places/vatican/exterior.js"),
    interior: () => import("../places/vatican/interior.js"),
  },
  "courthouse": {
    meta: () => Promise.resolve({ default: { id: "courthouse", name: "RIVERS STATE HIGH COURT", sub: "COURTROOM · JUSTICE DISTRICT", entrance: "main" } }),
    exterior: () => import("../places/courthouse/exterior.js"),
    interior: () => import("../places/courthouse/interior.js"),
  },
  "statehouse": {
    meta:     () => import("../places/statehouse/meta.js"),
    exterior: () => import("../places/statehouse/exterior.js"),
    interior: () => import("../places/statehouse/interior.js"),
  },
  "classroom": {
    meta:     () => import("../places/classroom/meta.js"),
    exterior: () => import("../places/classroom/exterior.js"),
    interior: () => import("../places/classroom/interior.js"),
  },
  "computerlab": {
    meta:     () => import("../places/computerlab/meta.js"),
    exterior: () => import("../places/computerlab/exterior.js"),
    interior: () => import("../places/computerlab/interior.js"),
  },
  "zoo": {
    meta:     () => import("../places/zoo/meta.js"),
    exterior: () => import("../places/zoo/exterior.js"),
    interior: () => import("../places/zoo/interior.js"),
  },
  "statejail": {
    meta:     () => import("../places/statejail/meta.js"),
    exterior: () => import("../places/statejail/exterior.js"),
    interior: () => import("../places/statejail/interior.js"),
  },
  "vastcity": {
    meta:     () => import("../places/vastcity/meta.js"),
    exterior: () => import("../places/vastcity/exterior.js"),
    interior: () => import("../places/vastcity/interior.js"),
  },
  "duplex": {
    meta:     () => import("../places/duplex/meta.js"),
    exterior: () => import("../places/duplex/exterior.js"),
    interior: () => import("../places/duplex/interior.js"),
  },
  "lagosflat": {
    meta:     () => import("../places/lagosflat/meta.js"),
    exterior: () => import("../places/lagosflat/exterior.js"),
    interior: () => import("../places/lagosflat/interior.js"),
  },
  "phoneshop": {
    meta:     () => import("../places/phoneshop/meta.js"),
    exterior: () => import("../places/phoneshop/exterior.js"),
    interior: () => import("../places/phoneshop/interior.js"),
  },
  "canteen": {
    meta:     () => import("../places/canteen/meta.js"),
    exterior: () => import("../places/canteen/exterior.js"),
    interior: () => import("../places/canteen/interior.js"),
  },
  "beach": {
    meta:     () => import("../places/beach/meta.js"),
    exterior: () => import("../places/beach/exterior.js"),
    interior: () => import("../places/beach/interior.js"),
  },
  "forest": {
    meta:     () => import("../places/forest/meta.js"),
    exterior: () => import("../places/forest/exterior.js"),
    interior: () => import("../places/forest/interior.js"),
  },
  "citypark": {
    meta:     () => import("../places/citypark/meta.js"),
    exterior: () => import("../places/citypark/exterior.js"),
    interior: () => import("../places/citypark/interior.js"),
  },
  "village": {
    meta:     () => import("../places/village/meta.js"),
    exterior: () => import("../places/village/exterior.js"),
    interior: () => import("../places/village/interior.js"),
  },

  "mansion": {
    meta:     () => import("../places/mansion/meta.js"),
    exterior: () => import("../places/mansion/exterior.js"),
    interior: () => import("../places/mansion/interior.js"),
  },
  "governor": {
    meta:     () => import("../places/governor/meta.js"),
    exterior: () => import("../places/governor/exterior.js"),
    interior: () => import("../scenes/governor.js"),
  },
  "prison": {
    meta:     () => import("../places/prison/meta.js"),
    exterior: () => import("../places/prison/exterior.js"),
    interior: () => import("../places/statejail/interior.js"),
  },
  "airplane": {
    meta:     () => import("../scenes/airplane.js"),
    interior: () => import("../scenes/airplane.js"),
  },
 "myhouse": {
  meta:     () => import("../places/myhouse/meta.js"),
  exterior: () => import("../places/myhouse/exterior.js"),
  interior: () => import("../places/myhouse/interior.js"),
},
"realestate": {
  meta:     () => Promise.resolve({ default: { id: "realestate", name: "REAL ESTATE", sub: "PROPERTY", entrance: "lobby" } }),
  exterior: () => import("../places/realestate/exterior.js"),
  interior: () => import("../places/realestate/interior.js"),
},
"jobcenter": {
  meta:     () => Promise.resolve({ default: { id: "jobcenter", name: "JOB CENTER", sub: "CAREERS", entrance: "lobby" } }),
  exterior: () => import("../places/jobcenter/exterior.js"),
  interior: () => import("../places/jobcenter/interior.js"),
},
  "govhouse": {
    meta:     () => import("../places/govhouse/meta.js"),
    exterior: () => import("../places/govhouse/exterior.js"),
    interior: () => import("../places/govhouse/interior.js"),
  },
  "hotel": {
    meta:     () => import("../places/hotel/meta.js"),
    exterior: () => import("../places/hotel/exterior.js"),
    interior: () => import("../places/hotel/interior.js"),
  },
  "boropark": {
    meta:     () => import("../places/boropark/meta.js"),
    exterior: () => import("../places/boropark/exterior.js"),
    interior: () => import("../places/boropark/interior.js"),
  },
  "market": {
    meta:     () => import("../places/market/meta.js"),
    exterior: () => import("../places/market/exterior.js"),
    interior: () => import("../places/market/interior.js"),
  },
  "airport": {
    meta:     () => import("../places/airport/meta.js"),
    exterior: () => import("../places/airport/exterior.js"),
    interior: () => import("../places/airport/interior.js"),
  },
  "showroom": {
    meta:          () => import("../places/showroom/meta.js"),
    exterior:      () => import("../places/showroom/exterior.js"),
    interior:      () => import("../places/showroom/interior.js"),
    showroomScene: () => import("../places/showroom/showroom.js"),
  },
  "pleasurepark": {
    meta:     () => import("../places/pleasurepark/meta.js"),
    exterior: () => import("../places/pleasurepark/exterior.js"),
    minimap:  () => import("../places/pleasurepark/minimap.js"),
    "ferris": {
      meta:     () => import("../places/pleasurepark/children/ferris/meta.js"),
      exterior: () => import("../places/pleasurepark/children/ferris/exterior.js"),
      interior: () => import("../places/pleasurepark/children/ferris/interior.js"),
    },
    "waterpark": {
      meta:     () => import("../places/pleasurepark/children/waterpark/meta.js"),
      exterior: () => import("../places/pleasurepark/children/waterpark/exterior.js"),
      interior: () => import("../places/pleasurepark/children/waterpark/interior.js"),
    },
    "zoo": {
      meta:     () => import("../places/pleasurepark/children/zoo/meta.js"),
      exterior: () => import("../places/pleasurepark/children/zoo/exterior.js"),
      interior: () => import("../places/pleasurepark/children/zoo/interior.js"),
    },
    "arcade": {
      meta:     () => import("../places/pleasurepark/children/arcade/meta.js"),
      exterior: () => import("../places/pleasurepark/children/arcade/exterior.js"),
      interior: () => import("../places/pleasurepark/children/arcade/interior.js"),
    },
    "foodcourt": {
      meta:     () => import("../places/pleasurepark/children/foodcourt/meta.js"),
      exterior: () => import("../places/pleasurepark/children/foodcourt/exterior.js"),
      interior: () => import("../places/pleasurepark/children/foodcourt/interior.js"),
    },
    "garden": {
      meta:     () => import("../places/pleasurepark/children/garden/meta.js"),
      exterior: () => import("../places/pleasurepark/children/garden/exterior.js"),
      interior: () => import("../places/pleasurepark/children/garden/interior.js"),
    },
    "amphitheatre": {
      meta:     () => import("../places/pleasurepark/children/amphitheatre/meta.js"),
      exterior: () => import("../places/pleasurepark/children/amphitheatre/exterior.js"),
      interior: () => import("../places/pleasurepark/children/amphitheatre/interior.js"),
    },
    "carousel": {
      meta:     () => import("../places/pleasurepark/children/carousel/meta.js"),
      exterior: () => import("../places/pleasurepark/children/carousel/exterior.js"),
      interior: () => import("../places/pleasurepark/children/carousel/interior.js"),
    },
  },
  "university": {
    meta:     () => import("../places/university/meta.js"),
    exterior: () => import("../places/university/exterior.js"),
    interior: () => import("../places/university/interior.js"),
  },
};

