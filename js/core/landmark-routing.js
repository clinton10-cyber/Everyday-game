/* Shared landmark → route mapping.
   Both drive.js and city.js import from here so navigation is always
   consistent between the two scenes. */

export function routeForLandmark(lm, router) {
  const id = lm && lm.id;
  if (!id) return;

  if (id === "airplane")   return router.go("airplane");
  if (id === "showroom")   return router.go("showroom", { id });
  if (id === "prison")     return router.go("prisonScene");
  if (id === "governor")   return router.go("governorScene");

  if (id === "university" || id === "pleasurepark") {
    return router.go("minimap", { id });
  }

  /* myhouse uses the full third-person room build (places/myhouse/interior.js)
     rather than the generic houseInterior scene. */
  if (id === "myhouse") {
    return router.go("interior", { id: "myhouse" });
  }

  router.go("travel", { target: id, name: lm.name,
    kind: (lm.parent ? "child" : "place"), parent: lm.parent });
}

export function askAndRoute(lm, router) {
  router.ui.askTravel(lm.name).then((mode) => {
    if (!mode) return;
    routeForLandmark(lm, router);
  });
}

