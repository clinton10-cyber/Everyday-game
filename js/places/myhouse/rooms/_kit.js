/* Shared furniture kit for My House rooms.

   Coordinates: every x/z passed to B/C/S/G is LOCAL to the room centre
   (dx, dz) unless a parent group is supplied, in which case they are
   local to that group. Furniture "front" faces local +z, so:
     against NORTH wall (z min)  -> ry = 0
     against SOUTH wall (z max)  -> ry = PI
     against WEST wall  (x min)  -> ry = PI/2
     against EAST wall  (x max)  -> ry = -PI/2

   (The old per-room helpers ignored the parent group argument, which
   made every group-built piece of furniture render in a pile near the
   world origin. This kit parents correctly.) */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { M, EM } from "../../../core/kit.js";

const PI = Math.PI;

export function kit(g, cx, cz) {
  const put = (m, p, x, y, z) => {
    if (p && p.isObject3D) { m.position.set(x, y, z); p.add(m); }
    else { m.position.set(cx + x, y, cz + z); g.add(m); }
    m.castShadow = m.receiveShadow = true; return m;
  };
  const B = (w, h, d, mat, x, y, z, p) =>
    put(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), p, x, y, z);
  const C = (rt, rb, h, mat, x, y, z, a, b) => {
    let s = 12, p = null;
    [a, b].forEach(v => { if (typeof v === "number") s = v; else if (v && v.isObject3D) p = v; });
    return put(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat), p, x, y, z);
  };
  const S = (r, mat, x, y, z, p) =>
    put(new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat), p, x, y, z);
  const G = (x, z, ry = 0) => {
    const gr = new THREE.Group(); gr.position.set(cx + x, 0, cz + z); gr.rotation.y = ry; g.add(gr); return gr;
  };

  const rug = (w, d, x, z, col) => { const m = B(w, .02, d, M(col, 1), x, .011, z); m.castShadow = false; return m; };

  const bed = (x, z, ry, o = {}) => {
    const w = o.w || 1.9, len = o.len || 2.1, fr = o.frame || 0x3b2415, bl = o.blanket || 0x5c3a5c;
    const gp = G(x, z, ry);
    B(w, .35, len, M(fr, 1), 0, .18, 0, gp);
    B(w - .04, .3, len - .04, M(0xfcfbf8, 1), 0, .5, 0, gp);
    B(w, 1.0, .12, M(fr, 1), 0, .68, -len / 2 + .04, gp);
    const pw = (w - .3) / (w > 1.4 ? 2 : 1);
    if (w > 1.4) { [-1, 1].forEach(s => B(pw - .1, .16, .5, M(0xf7f6f3, 1), s * pw / 2, .73, -len / 2 + .5, gp)); }
    else B(w - .2, .16, .45, M(0xf7f6f3, 1), 0, .73, -len / 2 + .5, gp);
    B(w - .06, .12, len * .55, M(bl, 1), 0, .68, len * .17, gp);
    return gp;
  };
  const nightstand = (x, z, ry, col = 0x5c3a22) => {
    const gp = G(x, z, ry);
    B(.5, .5, .42, M(col, 1), 0, .25, 0, gp);
    B(.44, .02, .36, M(0x3b2415, 1), 0, .51, 0, gp);
    C(.02, .02, .3, M(0x2a1f16, 1), 0, .66, 0, 6, gp);
    C(.12, .16, .22, M(0xfff2d6, .9), 0, .92, 0, 10, gp);
    return gp;
  };
  const wardrobe = (x, z, ry, w = 1.9, h = 2.3, d = .65, col = 0x5c3a22) => {
    const gp = G(x, z, ry);
    B(w, h, d, M(col, 1), 0, h / 2, 0, gp);
    B(.015, h * .9, .02, M(0x2a1f16, 1), 0, h / 2, d / 2 + .005, gp);
    [-1, 1].forEach(s => B(.03, .35, .03, M(0xc9ced6, .2, .9), s * .12, 1.2, d / 2 + .03, gp));
    return gp;
  };
  const table = (x, z, ry, w, d, h = .75, col = 0xa9773f) => {
    const gp = G(x, z, ry);
    B(w, .07, d, M(col, 1), 0, h, 0, gp);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(s =>
      B(.08, h, .08, M(0x8a5a2f, 1), s[0] * (w / 2 - .12), h / 2, s[1] * (d / 2 - .12), gp));
    return gp;
  };
  const desk = (x, z, ry, w = 1.4, col = 0x3b2415) => table(x, z, ry, w, .6, .75, col);
  const chair = (x, z, ry, col = 0x8a5a2f) => {
    const gp = G(x, z, ry);
    B(.44, .06, .44, M(col, 1), 0, .46, 0, gp);
    B(.44, .5, .06, M(col, 1), 0, .74, -.19, gp);
    [[-.17, -.17], [.17, -.17], [-.17, .17], [.17, .17]].forEach(q => B(.05, .46, .05, M(0x6b4a2f, 1), q[0], .23, q[1], gp));
    return gp;
  };
  const sofa = (x, z, ry, len = 3.6, col = 0x5b6f80) => {
    const gp = G(x, z, ry);
    B(len, .45, 1, M(col, 1), 0, .23, 0, gp);
    B(len, .7, .22, M(col, 1), 0, .6, -.4, gp);
    [-1, 1].forEach(s => B(.22, .55, 1, M(col, 1), s * (len / 2 - .11), .5, 0, gp));
    const n = Math.max(2, Math.round((len - .5) / 1.15)), cw = (len - .6) / n;
    for (let i = 0; i < n; i++) {
      const px = -((n - 1) * cw) / 2 + i * cw;
      B(cw - .06, .16, .75, M(0xd9cfc0, 1), px, .53, .05, gp);
      B(cw - .06, .42, .15, M(0xd9cfc0, 1), px, .8, -.28, gp);
    }
    return gp;
  };
  const armchair = (x, z, ry, col = 0x7d848b) => {
    const gp = G(x, z, ry);
    B(.95, .45, .9, M(col, 1), 0, .23, 0, gp);
    B(.95, .75, .22, M(col, 1), 0, .6, -.35, gp);
    [-1, 1].forEach(s => B(.22, .5, .9, M(col, 1), s * .37, .48, 0, gp));
    B(.6, .15, .6, M(0xd9cfc0, 1), 0, .5, .05, gp);
    return gp;
  };
  const plant = (x, z) => {
    const gp = G(x, z, 0);
    C(.24, .19, .4, M(0xb5623f, 1), 0, .2, 0, 10, gp);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2;
      const lf = new THREE.Mesh(new THREE.SphereGeometry(.2, 6, 5), M(0x3f7a44, 1));
      lf.scale.set(.5, 1.6, .35); lf.position.set(Math.cos(a) * .22, .68, Math.sin(a) * .22);
      lf.rotation.z = Math.cos(a) * .5; gp.add(lf);
    }
    return gp;
  };
  const floorLamp = (x, z) => {
    const gp = G(x, z, 0);
    C(.15, .2, .04, M(0xc6cbd0, .3, .6), 0, .02, 0, 12, gp);
    C(.025, .025, 1.5, M(0xc6cbd0, .3, .6), 0, .77, 0, 8, gp);
    C(.18, .24, .28, M(0xfff2d6, .9), 0, 1.62, 0, 12, gp);
    return gp;
  };
  /* wall-mounted flat things: (x, y, z) local to room; ry as for furniture */
  const wallArt = (x, y, z, ry, w, h, col) => {
    const gp = G(x, z, ry); B(w + .1, h + .1, .03, M(0x2a1f16, 1), 0, y, 0, gp);
    B(w, h, .04, M(col, 1), 0, y, .01, gp); return gp;
  };
  const mirror = (x, y, z, ry, w, h) => {
    const gp = G(x, z, ry); B(w + .08, h + .08, .03, M(0x5c3a22, 1), 0, y, 0, gp);
    B(w, h, .04, M(0x1a2a3a, .15, 1), 0, y, .01, gp); return gp;
  };
  /* Bookshelf = ONE merged, vertex-coloured mesh (frame + boards + books).
     (The first version built every book as its own mesh -- ~1000 meshes in the
     library, each one a collider and a per-frame camera-fade test, which is what
     made interiors feel slow.) */
  const bookshelf = (x, z, ry, w = 2.4, h = 2.6) => {
    const gp = G(x, z, ry);
    const geos = [], col = new THREE.Color();
    const add = (bw, bh, bd, bx, by, bz, hex) => {
      const g = new THREE.BoxGeometry(bw, bh, bd); g.translate(bx, by, bz);
      const n = g.attributes.position.count, c = new Float32Array(n * 3);
      col.setHex(hex); for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
      g.setAttribute("color", new THREE.BufferAttribute(c, 3)); geos.push(g);
    };
    add(w, h, .04, 0, h / 2, -.18, 0x4a2f1a);          // back panel
    add(.04, h, .4, -w / 2 + .02, h / 2, 0, 0x5c3a22);  // sides
    add(.04, h, .4, w / 2 - .02, h / 2, 0, 0x5c3a22);
    add(w, .05, .42, 0, h - .02, 0, 0x5c3a22);          // top
    const rows = Math.floor(h / .5);
    for (let i = 0; i <= rows; i++) add(w - .06, .05, .4, 0, .08 + i * .5, 0, 0x8a6a3a);
    const pal = [0x8c3b3b, 0x2f5d6b, 0x6b5b2f, 0x3d4f6b, 0x7a4a6b, 0x2f6b2f, 0x8a4a2a];
    for (let row = 0; row < rows; row++) {
      let bx = -w / 2 + .1, k = 0;
      while (bx < w / 2 - .15) {
        const bw = .05 + ((k * 37 + row * 11) % 5) * .012, bh = .3 + ((k * 13 + row * 7) % 4) * .04;
        add(bw, bh, .26, bx + bw / 2, .105 + row * .5 + bh / 2, .0, pal[(k + row * 3) % pal.length]);
        bx += bw + .008; k++;
      }
    }
    const merged = mergeGeometries(geos, false);
    geos.forEach(g => g.dispose());
    const m = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.castShadow = m.receiveShadow = true; gp.add(m);
    return gp;
  };
  /* bathroom fixtures */
  const toilet = (x, z, ry) => {
    const gp = G(x, z, ry);
    B(.4, .4, .5, M(0xfcfbf8, 1), 0, .2, .05, gp);
    B(.44, .08, .48, M(0xfcfbf8, 1), 0, .44, .05, gp);
    B(.4, .62, .2, M(0xfcfbf8, 1), 0, .62, -.24, gp);
    return gp;
  };
  const vanity = (x, z, ry) => {
    const gp = G(x, z, ry);
    B(.95, .8, .55, M(0x5c3a22, 1), 0, .4, 0, gp);
    B(.99, .06, .58, M(0xfcfbf8, 1), 0, .83, 0, gp);
    C(.22, .18, .14, M(0xfcfbf8, 1), 0, .92, 0, 12, gp);
    C(.02, .02, .28, M(0xc6cbd0, .2, .95), 0, 1.05, -.2, 8, gp);
    return gp;
  };
  const tub = (x, z, ry) => {
    const gp = G(x, z, ry);
    B(1.8, .55, .8, M(0xfcfbf8, 1), 0, .28, 0, gp);
    B(1.64, .4, .64, M(0xdff0fa, 1), 0, .42, 0, gp);
    C(.02, .02, .3, M(0xc6cbd0, .2, .95), -.75, .7, -.3, 8, gp);
    return gp;
  };
  const shower = (x, z, ry) => {
    const gp = G(x, z, ry);
    B(1.1, .06, 1.1, M(0xb9bcc0, 1), 0, .03, 0, gp);
    const glass = new THREE.MeshStandardMaterial({ color: 0xcfeaff, transparent: true, opacity: .2, side: THREE.DoubleSide });
    B(.03, 2.1, 1.1, glass, .55, 1.05, 0, gp);
    B(1.1, 2.1, .03, glass, 0, 1.05, .55, gp);
    C(.02, .02, .4, M(0xc6cbd0, .2, .95), -.4, 2.0, -.45, 8, gp);
    C(.11, .11, .03, M(0xc6cbd0, .2, .95), -.4, 1.82, -.45, 10, gp);
    return gp;
  };
  const towelRack = (x, z, ry) => {
    const gp = G(x, z, ry);
    C(.025, .025, 1.0, M(0xc6cbd0, .2, .95), 0, 1.4, .06, 8, gp).rotation.z = PI / 2;
    B(.8, .5, .03, M(0x8a4a4a, 1), 0, 1.15, .07, gp);
    return gp;
  };

  return { B, C, S, G, rug, bed, nightstand, wardrobe, table, desk, chair, sofa, armchair,
    plant, floorLamp, wallArt, mirror, bookshelf, toilet, vanity, tub, shower, towelRack };
}

/* shared bathroom layout (5 x 5.5 room). mirror=true flips left/right. */
export function buildBath(g, cx, cz, mirror) {
  const k = kit(g, cx, cz), s = mirror ? -1 : 1, r = a => mirror ? -a : a;
  k.rug(2.2, 1.2, 0, .6, 0x4a6a7a);
  k.tub(s * 1.45, -2.25, 0);
  k.shower(s * -1.85, -2.05, 0);
  k.toilet(s * -2.0, 1.85, r(PI / 2));
  k.vanity(s * 2.1, 1.75, r(-PI / 2));
  k.mirror(s * 2.37, 1.7, 1.75, r(-PI / 2), .85, .95);
  k.towelRack(-.1, -2.6, 0);
}

