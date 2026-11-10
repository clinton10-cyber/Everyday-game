export const HUNT_TIERS = {
  street: { id:"street", name:"STREET HUNT", tag:"3 HOURS · LOW RISK", desc:"A street-level contract. Hunters carry blades only. Small but fast money.", hours:3, realSecondsPerHour:15, hunters:2, hunterTier:1, prizePerHour:[400000,600000,1200000], cashOutPenalty:0.10, entryFee:0, requireReputation:0 },
  professional: { id:"professional", name:"PROFESSIONAL HUNT", tag:"12 HOURS · MID RISK", desc:"Twelve hours. The hunters are armed and coordinated. Real money.", hours:12, realSecondsPerHour:10, hunters:4, hunterTier:2,
    prizePerHour:[500000,700000,950000,1250000,1600000,2000000,2450000,2950000,3500000,4100000,4750000,5500000], cashOutPenalty:0.15, entryFee:0, requireReputation:50 },
  master: { id:"master", name:"MASTER'S GAME", tag:"24 HOURS · FULL RISK", desc:"A full day inside the zone. Armed hunters, no mercy. The real prize.", hours:24, realSecondsPerHour:6, hunters:6, hunterTier:3,
    prizePerHour:[100000,150000,250000,400000,600000,850000,1150000,1500000,1900000,2350000,2850000,3400000,4000000,4650000,5350000,6100000,6900000,7750000,8650000,9600000,10600000,11650000,12750000,12750000],
    finalBonus:24500000, cashOutPenalty:0.20, entryFee:0, requireReputation:100 },
};
export const HUNT_TIER_ORDER = ["street","professional","master"];
