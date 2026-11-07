import meta from "./meta.js";
import { buildMinimap } from "../_minimapbuilder.js";

const CHILDREN = ["ferris","waterpark","zoo","arcade",
                  "foodcourt","garden","amphitheatre","carousel"];

export async function minimapScene(params, router) {
  const metas = await Promise.all(
    CHILDREN.map(id =>
      import("./children/" + id + "/meta.js").then(m => m.default))
  );
  return buildMinimap(router, meta, metas, async (child) => {
    const mode = await router.ui.askTravel(child.name);
    if (!mode) return;
    router.go("travel", {
      mode, target: child.id, name: child.name, parent: meta.id,
    });
  });
}

