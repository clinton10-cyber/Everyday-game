import { PLACES } from "../core/registry.js";

/* Dispatcher — pulls the parent's own minimap builder file. */
export async function minimapScene({ id, parent }, router){
  /* v3: support both top-level and nested minimap routes */
  let thunk = PLACES[id] && PLACES[id].minimap;
  if (!thunk && parent && PLACES[parent] && PLACES[parent][id]) {
    thunk = PLACES[parent][id].minimap;
  }
  if (!thunk) throw new Error("No minimap for " + id);
  const mod = await thunk();
  return mod.minimapScene({ id, parent }, router);
}

