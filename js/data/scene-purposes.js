/* js/data/scene-purposes.js -- one entry per scene id.
   purpose: home|work|shopping|health|education|worship|nightlife|travel|government|crime|leisure|range
   links:   where you can go next. via: door | taxi | walk | task
            cost: naira (taxi only). condition: () => bool (optional).
   Every `to` below is an id that exists in the router or in core/registry.js. */
const L = (to, reason, via, cost, condition) => Object.assign({ to, reason, via: via || "walk" }, cost ? { cost } : {}, condition ? { condition } : {});
const back = L("pleasurepark", "Back to the park", "walk");

export const SCENE_PURPOSES = {
  __default: { name: "-", purpose: "leisure", services: [], links: [] },

  /* open world */
  city:         { name: "Port Harcourt", purpose: "travel", services: ["travel", "shops", "jobs", "homes"], links: [] },
  drive:        { name: "Drive", purpose: "travel", services: ["travel"], links: [] },
  walk:         { name: "Walk", purpose: "travel", services: ["travel"], links: [] },
  travel:       { name: "En route", purpose: "travel", services: [], links: [] },
  interior:     { name: "Interior", purpose: "leisure", services: [], links: [] },
  exterior:     { name: "Outside", purpose: "leisure", services: [], links: [] },
  minimap:      { name: "Area Map", purpose: "travel", services: ["travel"], links: [] },
  showroom:     { name: "Auto Hub", purpose: "shopping", services: ["cars"], links: [] },
  pleasurepark: { name: "Pleasure Park", purpose: "leisure", services: ["rides"], links: [] },
  zonewalk:     { name: "Zone", purpose: "leisure", services: [], links: [] },
  zonedrive:    { name: "Zone", purpose: "leisure", services: [], links: [] },
  governorScene:    { name: "Governor's Mansion", purpose: "government", services: ["audience"], links: [] },
  governorInterior: { name: "Governor's Mansion", purpose: "government", services: ["audience"], links: [] },
  range:        { name: "Shooting Range", purpose: "range", services: ["training"], links: [] },
  prisonScene:  { name: "State Prison", purpose: "crime", services: ["visitation", "bail"], links: [
    L("city", "Bail granted, walk out", "door", 0, () => !(window.__ph3d_prison && window.__ph3d_prison.inJail)) ] },
  airplane:     { name: "Landed Aircraft", purpose: "travel", services: ["flights", "checkin"], links: [
    L("city", "Call a taxi to the city", "taxi", 4500) ] },

  /* interiors */
  nightclub:  { name: "Club Eclipse", purpose: "nightlife", services: ["drinks", "dance", "VIP"], links: [
    L("city", "Call a taxi home", "taxi", 2500), L("myhouse", "Walk home", "walk") ] },
  hospital:   { name: "City Hospital", purpose: "health", services: ["treatment", "checkup", "pharmacy"], links: [
    L("church", "Chaplain's blessing"), L("myhouse", "Rest at home", "taxi", 1800), L("city", "Back to the street", "door") ] },
  church:     { name: "Church", purpose: "worship", services: ["service", "wedding", "blessing"], links: [
    L("myhouse", "Take the family home"), L("city", "Back to the street", "door") ] },
  mosque:     { name: "Central Mosque", purpose: "worship", services: ["prayer", "lecture"], links: [ L("myhouse", "Head home") ] },
  vatican:    { name: "Vatican City", purpose: "worship", services: ["mass", "pilgrimage"], links: [ L("church", "Back to the parish", "taxi", 9000) ] },
  statehouse: { name: "State House", purpose: "government", services: ["audience", "permits"], links: [ L("govhouse", "Secretariat across the way") ] },
  classroom:  { name: "Primary School", purpose: "education", services: ["class", "exam"], links: [
    L("computerlab", "Practise at the lab"), L("university", "Campus nearby") ] },
  computerlab:{ name: "Computer Lab", purpose: "education", services: ["training", "internet"], links: [ L("classroom", "Back to class") ] },
  zoo:        { name: "City Zoo", purpose: "leisure", services: ["tours"], links: [ L("pleasurepark", "Pleasure park next door"), L("city", "Back to the city", "door") ] },
  statejail:  { name: "State Jail", purpose: "crime", services: ["visitation"], links: [ L("city", "Walk out", "door") ] },
  vastcity:   { name: "Vast City", purpose: "travel", services: ["travel"], links: [] },
  duplex:     { name: "Modern Duplex", purpose: "home", services: ["rest"], links: [] },
  lagosflat:  { name: "Lagos Life Apartment", purpose: "home", services: ["rest"], links: [] },
  canteen:    { name: "Canteen", purpose: "shopping", services: ["food"], links: [ L("market", "Mile 1 Market nearby") ] },
  beach:      { name: "Beach", purpose: "leisure", services: ["walk", "photos"], links: [ L("city", "Back to the city", "taxi", 2000) ] },
  forest:     { name: "Forest Trail", purpose: "leisure", services: ["walk", "campfire"], links: [ L("beach", "Beach nearby") ] },
  citypark:   { name: "City Park", purpose: "leisure", services: ["walk", "fountain"], links: [ L("boropark", "Isaac Boro Park across the road") ] },
  village:    { name: "Village", purpose: "leisure", services: ["market"], links: [] },
  mansion:    { name: "The Mansion", purpose: "home", services: ["rest", "pool"], links: [ L("city", "Head to the city", "door"), L("myhouse", "Your flat next door") ] },
  governor:   { name: "Governor's Mansion", purpose: "government", services: ["audience"], links: [] },
  prison:     { name: "State Prison", purpose: "crime", services: ["visitation"], links: [] },
  myhouse:    { name: "My House", purpose: "home", services: ["rest", "family", "album"], links: [
    L("city", "Step outside", "door"), L("jobcenter", "Find work"), L("phoneshop", "Buy a phone"), L("market", "Go shopping", "taxi", 800) ] },
  realestate: { name: "Real Estate Office", purpose: "shopping", services: ["property"], links: [ L("myhouse", "View your home") ] },
  jobcenter:  { name: "Job Center", purpose: "work", services: ["jobs", "training"], links: [
    L("phoneshop", "Get a phone first"), L("realestate", "Buy property") ] },
  govhouse:   { name: "Government House", purpose: "government", services: ["audience"], links: [ L("statehouse", "State House") ] },
  hotel:      { name: "Hotel Presidential", purpose: "nightlife", services: ["rooms", "dining", "bar", "spa"], links: [
    L("nightclub", "Club Eclipse is nearby"), L("city", "Call a taxi", "taxi", 1500) ] },
  boropark:   { name: "Isaac Boro Park", purpose: "leisure", services: ["walk", "monument"], links: [ L("citypark", "City Park across the road") ] },
  market:     { name: "Mile 1 Market", purpose: "shopping", services: ["food", "goods", "unique-stalls"], links: [
    L("phoneshop", "Phone Shop around the corner"), L("canteen", "Get a hot meal"), L("jobcenter", "Find work nearby") ] },
  airport:    { name: "Omagwa Airport", purpose: "travel", services: ["flights", "checkin"], links: [ L("city", "Call a taxi", "taxi", 4500) ] },
  university: { name: "University of Port Harcourt", purpose: "education", services: ["lectures", "library"], links: [
    L("computerlab", "Practise coding"), L("classroom", "Sit in on a class") ] },

  /* pleasure park children */
  ferris:       { name: "Ferris Wheel", purpose: "leisure", services: ["ride"], links: [back] },
  waterpark:    { name: "Water Park", purpose: "leisure", services: ["pool"], links: [back] },
  arcade:       { name: "Arcade", purpose: "leisure", services: ["games"], links: [back] },
  foodcourt:    { name: "Food Court", purpose: "shopping", services: ["food"], links: [back] },
  garden:       { name: "Botanical Garden", purpose: "leisure", services: ["walk"], links: [back] },
  amphitheatre: { name: "Amphitheatre", purpose: "leisure", services: ["shows"], links: [back] },
  carousel:     { name: "Carousel", purpose: "leisure", services: ["ride"], links: [back] },

  /* Phone Shop */
  phoneshop: { name: "Phone Shop", purpose: "shopping", services: ["phones", "accessories", "airtime", "tradein"], npcRoles: ["trader", "trader", "walker"],
    tasks: ["buy_phone", "trade_in_phone"], links: [
      L("market", "Buy a case at the market"), L("jobcenter", "Get a job to afford an upgrade"),
      L("myhouse", "Back home", "taxi", 800), L("city", "Step outside", "door") ] },
};
