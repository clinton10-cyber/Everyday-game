/* First-person walkable interior (v5). The plumbing lives in
   js/places/_walktemplate.js so this file only declares the
   options for this specific building. */
import meta from "./meta.js";
import { ROOMS } from "./rooms/_index.js";
import { buildWalkInterior } from "../_walktemplate.js";

export async function buildInterior(router) {
  const ent = ROOMS.find(r => r.id === meta.entrance) || ROOMS[0];
  return buildWalkInterior(router, ROOMS, {
    crumb:    meta.name,
    title:    ent.label,
    subtitle: meta.sub || "",
    firstRoomId: meta.entrance,
  });
}

