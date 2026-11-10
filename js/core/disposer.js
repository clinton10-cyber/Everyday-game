/* ═══════════════════════════════════════════════════════════════
   disposeScene — hard release of every GPU resource in a scene.
   Called by the router BEFORE loading the next scene, so at any
   moment only ONE scene lives in memory.
   ═══════════════════════════════════════════════════════════════ */
export function disposeScene(scene, renderer, controls) {
  if (!scene) return;

  const geos = new Set();
  const mats = new Set();
  const texs = new Set();

  scene.traverse(o => {
    if (o.geometry) geos.add(o.geometry);

    const matList = [];
    if (o.material) {
      if (Array.isArray(o.material)) matList.push(...o.material);
      else matList.push(o.material);
    }
    matList.forEach(m => {
      if (!m) return;
      mats.add(m);
      for (const k in m) {
        const v = m[k];
        if (!v) continue;
        if (v.isTexture) texs.add(v);
        if (v.isRenderTarget) { try { v.dispose(); } catch (e) {} }
      }
    });

    if (o.isSprite && o.material && o.material.map) texs.add(o.material.map);
  });

  texs.forEach(t => { try { t.dispose(); } catch (e) {} });
  geos.forEach(g => { try { g.dispose(); } catch (e) {} });
  mats.forEach(m => { try { m.dispose(); } catch (e) {} });

  // Detach every child so GC can collect
  while (scene.children.length) {
    const c = scene.children[0];
    scene.remove(c);
    c.parent = null;
  }

  // Controls dispose (releases pointer listeners)
  if (controls && controls.dispose) {
    try { controls.dispose(); } catch (e) {}
  }

  // Reset renderer internal caches so programs aren't kept alive
  if (renderer) {
    try {
      renderer.info.reset();
      renderer.renderLists.dispose();
    } catch (e) {}
  }
}

