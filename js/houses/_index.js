/* Lazy-loaded house builders: each house file downloads only when entered. */
export const HOUSE_BUILDERS = {
  flat1:   () => import('./flat1.js').then(m => m.buildFlat1),
  flat2:   () => import('./flat2.js').then(m => m.buildFlat2),
  flat10:  () => import('./flat10.js').then(m => m.buildFlat10),
  mansion: () => import('./mansion.js').then(m => m.buildMansion),
};

export async function buildHouse(key) {
  const factory = HOUSE_BUILDERS[key];
  if (!factory) throw new Error('No house builder: ' + key);
  const build = await factory();
  return build();
}

