/* 3D product models for every Mile 1 Market item.
   All meshes are lightweight low-poly Three.js geometry and share one ground origin. */
import * as THREE from "three";

const COLORS = {
  leaf: 0x347d42, leaf2: 0x5a9c46, stem: 0x79512c, soil: 0x8b6848,
  yam: 0x9e7950, potato: 0xc58c50, red: 0xc94332, yellow: 0xe6b83d,
  green: 0x4b8f4d, brown: 0x805432, cream: 0xe7dec5, white: 0xf3ead5,
  cloth: 0x346ba5, dark: 0x292525, gold: 0xd7a83f, coral: 0xdf766c,
  fish: 0x8d9291, meat: 0x9f4338, glass: 0x8dbac3, amber: 0xb66b18,
};

const material = (color, options = {}) => new THREE.MeshLambertMaterial({ color, ...options });
const add = (group, geometry, color, x = 0, y = 0, z = 0, opts = {}) => {
  const mesh = new THREE.Mesh(geometry, material(color, opts));
  mesh.position.set(x, y, z);
  if (opts.rotation) mesh.rotation.set(...opts.rotation);
  group.add(mesh);
  return mesh;
};
const box = (g, w, h, d, c, x = 0, y = h / 2, z = 0, rz = 0) => {
  const m = add(g, new THREE.BoxGeometry(w, h, d), c, x, y, z);
  m.rotation.z = rz;
  return m;
};
const ball = (g, c, x, y, z, sx, sy = sx, sz = sx, ry = 0) => {
  const m = add(g, new THREE.SphereGeometry(1, 10, 7), c, x, y, z);
  m.scale.set(sx, sy, sz); m.rotation.y = ry;
  return m;
};
const cyl = (g, rTop, rBottom, h, c, x = 0, y = h / 2, z = 0, seg = 10, rz = 0) => {
  const m = add(g, new THREE.CylinderGeometry(rTop, rBottom, h, seg), c, x, y, z);
  m.rotation.z = rz; return m;
};
const torus = (g, r, tube, c, x = 0, y = 0.15, z = 0, rx = 0) => {
  const m = add(g, new THREE.TorusGeometry(r, tube, 6, 18), c, x, y, z);
  m.rotation.x = rx; return m;
};
function tube(g, points, radius, color) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return add(g, new THREE.TubeGeometry(curve, 12, radius, 5, false), color);
}
function leaf(g, x, y, z, color = COLORS.leaf, angle = 0) {
  const m = ball(g, color, x, y, z, 0.20, 0.035, 0.085, angle);
  m.rotation.z = angle;
  return m;
}
function bowl(g, color = 0x98724d, x = 0, z = 0, r = 0.24) {
  cyl(g, r * 0.84, r, 0.12, color, x, 0.08, z, 12);
  torus(g, r * 0.82, 0.018, 0x64472f, x, 0.145, z);
}
function tuber(g, x, z, color, scale = 1, lean = 0) {
  const m = ball(g, color, x, 0.15, z, 0.13 * scale, 0.12 * scale, 0.34 * scale, lean);
  m.rotation.z = lean;
  ball(g, 0xbda17c, x, 0.15, z + 0.30 * scale, 0.07 * scale, 0.07 * scale, 0.08 * scale);
}
function sack(g, fillColor = 0xcab995, grainColor = 0xe4d7ae) {
  cyl(g, 0.23, 0.31, 0.45, fillColor, 0, 0.23, 0, 10);
  torus(g, 0.205, 0.025, 0x8c7658, 0, 0.46, 0);
  for (let i = 0; i < 14; i++) {
    const a = i * Math.PI * 2 / 14;
    ball(g, grainColor, Math.cos(a) * 0.13, 0.49 + (i % 2) * 0.015, Math.sin(a) * 0.13, 0.035, 0.025, 0.035);
  }
}
function bottle(g, liquid = COLORS.amber, glass = COLORS.glass) {
  const gm = material(glass, { transparent: true, opacity: 0.58 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.43, 10), gm);
  body.position.y = 0.25; g.add(body);
  cyl(g, 0.07, 0.08, 0.10, glass, 0, 0.515, 0, 10);
  cyl(g, 0.075, 0.075, 0.045, 0x3e352b, 0, 0.59, 0, 10);
  cyl(g, 0.115, 0.13, 0.20, liquid, 0, 0.15, 0, 10);
  box(g, 0.13, 0.12, 0.008, 0xf2e8ce, 0, 0.31, 0.151);
}
function clothStack(g, main = 0x356fa5, accent = 0xe3b642) {
  for (let i = 0; i < 4; i++) {
    box(g, 0.62, 0.07, 0.42, i % 2 ? main : accent, 0, 0.045 + i * 0.075, 0, (i % 2 ? 0.02 : -0.015));
    box(g, 0.05, 0.075, 0.425, i % 2 ? accent : main, -0.24, 0.047 + i * 0.075, 0);
  }
}

function modelForId(id, label = "") {
  const g = new THREE.Group();
  // Roots and tubers
  if (["yam_tuber", "sweet_potato", "cocoyam"].includes(id)) {
    const c = id === "yam_tuber" ? COLORS.yam : id === "sweet_potato" ? COLORS.potato : 0x9a8260;
    for (let i = 0; i < 3; i++) tuber(g, (i - 1) * 0.17, (i % 2) * 0.10 - 0.05, c, 1 + (i % 2) * 0.12, (i - 1) * 0.18);
  } else if (id === "plantain_bunch") {
    cyl(g, 0.055, 0.07, 0.20, COLORS.stem, 0, 0.62, 0);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const x = Math.cos(a) * 0.12, z = Math.sin(a) * 0.12;
      tube(g, [[0,0.58,0],[x*0.7,0.42,z*0.7],[x,0.20,z],[x*0.75,0.08,z*1.15]], 0.055, i % 2 ? 0x7b9639 : 0x9caf42);
    }
  } else if (["cassava_flour", "beans_white", "rice_local", "garri", "dried_crayfish", "periwinkles", "alligator_pepper", "sea_salt", "camwood", "camphor_balls"].includes(id)) {
    sack(g, id === "camwood" ? 0x9d5140 : id === "dried_crayfish" ? 0x9a7554 : 0xcab995,
      id === "beans_white" ? 0xe7d7bd : id === "rice_local" ? 0xf4ead0 : id === "camwood" ? 0x9c3c2c : 0xd7c19b);
  } else if (["palm_oil", "groundnut_oil", "palm_kernel_oil", "herbal_mixture", "tiger_nut_drink", "zobo_drink", "palm_wine", "burukutu", "local_honey"].includes(id)) {
    bottle(g, id === "palm_oil" ? 0xb53618 : id === "groundnut_oil" ? 0xd9b653 : id === "zobo_drink" ? 0x8c234c : id === "palm_wine" ? 0xe0bd79 : id === "local_honey" ? 0xc98618 : 0x765338);
    if (id === "local_honey") tube(g, [[0.22,0.66,0],[0.34,0.55,0],[0.35,0.35,0]], 0.025, 0xa36a2a);
  } else if (["pepper_mix", "tomatoes", "onions", "okra_fresh", "bitter_kola", "kolanut"].includes(id)) {
    bowl(g, id === "pepper_mix" ? 0x65452c : 0x99734a);
    const count = id === "okra_fresh" ? 5 : id === "pepper_mix" ? 9 : 6;
    for (let i = 0; i < count; i++) {
      const a = i * Math.PI * 2 / count, x = Math.cos(a) * 0.15, z = Math.sin(a) * 0.15;
      const c = id === "tomatoes" ? 0xc93229 : id === "onions" ? 0xc69b66 : id === "okra_fresh" ? 0x4a8746 : id === "bitter_kola" ? 0x68442c : id === "kolanut" ? 0x8c492c : [0xc83729,0x477d38,0xe0a83a][i % 3];
      ball(g, c, x, 0.22 + (i % 3) * 0.035, z, id === "okra_fresh" ? 0.06 : 0.09, id === "okra_fresh" ? 0.16 : 0.075, 0.075, a);
      if (id === "tomatoes" || id === "onions") cyl(g, 0.012, 0.018, 0.04, COLORS.leaf, x, 0.31, z, 5);
    }
  } else if (["bitterleaf", "scentleaf", "uziza_leaf"].includes(id)) {
    for (let i = 0; i < 9; i++) leaf(g, (i % 3 - 1) * 0.12, 0.12 + (i % 3) * 0.035, (Math.floor(i / 3) - 1) * 0.10, i % 2 ? COLORS.leaf : COLORS.leaf2, (i - 4) * 0.18);
    cyl(g, 0.018, 0.025, 0.40, 0x80603a, 0, 0.20, 0, 6, -0.8);
  } else if (["smoked_fish", "stockfish", "catfish_live"].includes(id)) {
    const c = id === "smoked_fish" ? 0x704d35 : id === "stockfish" ? 0xb49c78 : 0x758f8e;
    ball(g, c, 0, 0.18, 0, 0.16, 0.12, 0.40, 0.1);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.23, 4), material(c));
    tail.position.set(0, 0.18, -0.48); tail.rotation.x = Math.PI / 2; g.add(tail);
    ball(g, 0x171b1c, 0.11, 0.21, 0.28, 0.018, 0.018, 0.018);
    if (id === "catfish_live") for (let i = 0; i < 3; i++) tube(g, [[-0.05,0.22,0.28],[0,0.28,0.42 + i*0.03],[0.06,0.20,0.48+i*0.03]], 0.008, 0x343a38);
  } else if (["snails_giant", "goat_meat"].includes(id)) {
    if (id === "snails_giant") {
      for (let i = 0; i < 3; i++) { ball(g, 0x78674c, (i - 1) * 0.14, 0.12, 0, 0.13, 0.09, 0.10); torus(g, 0.07, 0.035, 0x9c8b64, (i - 1) * 0.14, 0.18, -0.01, Math.PI / 2); }
    } else {
      for (let i = 0; i < 4; i++) ball(g, 0x9c4439, (i % 2 - 0.5) * 0.19, 0.13, (Math.floor(i / 2) - 0.5) * 0.20, 0.14, 0.10, 0.15, i * 0.3);
    }
  } else if (id === "chicken_live") {
    ball(g, 0xc4a16a, 0, 0.23, 0, 0.27, 0.23, 0.36);
    ball(g, 0xc4a16a, 0, 0.47, 0.23, 0.12, 0.14, 0.12);
    ball(g, 0xc83a2b, 0, 0.60, 0.22, 0.035, 0.055, 0.04);
    cyl(g, 0.02, 0.025, 0.12, 0xd58b3f, -0.08, 0.06, 0, 5);
    cyl(g, 0.02, 0.025, 0.12, 0xd58b3f, 0.08, 0.06, 0, 5);
    ball(g, 0xf0e8d7, 0.04, 0.49, 0.32, 0.018, 0.018, 0.018);
  } else if (id === "eggs_crate") {
    box(g, 0.66, 0.13, 0.48, 0x8c7560, 0, 0.07, 0);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) ball(g, 0xe9e0c9, (c - 2) * 0.12, 0.19, (r - 1) * 0.13, 0.047, 0.075, 0.047);
  } else if (["ankara_fabric", "george_wrapper", "lace_material", "aso_oke"].includes(id)) {
    clothStack(g, id === "ankara_fabric" ? 0x246ca4 : id === "george_wrapper" ? 0x8a324c : id === "aso_oke" ? 0x6a543c : 0xe1d8d2,
      id === "lace_material" ? 0xe9e2d8 : 0xe5b83d);
    if (id === "lace_material") for (let i = 0; i < 4; i++) torus(g, 0.10 + i * 0.035, 0.008, 0xffffff, 0, 0.42, 0.02 + i * 0.01);
  } else if (["coral_beads", "charm_bracelet", "juju_amulet"].includes(id)) {
    torus(g, id === "coral_beads" ? 0.28 : 0.18, 0.035, id === "juju_amulet" ? 0x8b4a32 : 0x6b3228, 0, 0.14, 0, Math.PI / 2);
    for (let i = 0; i < (id === "coral_beads" ? 22 : 10); i++) {
      const a = i * Math.PI * 2 / (id === "coral_beads" ? 22 : 10);
      ball(g, id === "coral_beads" ? COLORS.coral : id === "juju_amulet" ? 0xb38a4c : 0xa86d42,
        Math.cos(a) * (id === "coral_beads" ? 0.29 : 0.19), 0.14, Math.sin(a) * (id === "coral_beads" ? 0.29 : 0.19), 0.035, 0.035, 0.035);
    }
    if (id === "juju_amulet") ball(g, 0x4f2e20, 0, 0.16, 0, 0.10, 0.08, 0.08);
  } else if (id === "wooden_comb") {
    box(g, 0.48, 0.08, 0.12, 0x895a32, 0, 0.10, 0);
    for (let i = 0; i < 11; i++) box(g, 0.022, 0.16, 0.025, 0x895a32, -0.21 + i * 0.042, 0.18, 0.07);
  } else if (["calabash_set", "clay_pot"].includes(id)) {
    ball(g, id === "clay_pot" ? 0x9d6441 : 0xa47c42, 0, 0.22, 0, 0.27, 0.23, 0.27);
    cyl(g, 0.13, 0.17, 0.11, id === "clay_pot" ? 0x845032 : 0x886331, 0, 0.43, 0, 12);
    torus(g, 0.14, 0.02, 0x63452d, 0, 0.49, 0);
    if (id === "calabash_set") { ball(g, 0xb18b4e, 0.27, 0.12, 0, 0.20, 0.13, 0.20); }
  } else if (["broom_trad", "sugarcane"].includes(id)) {
    if (id === "broom_trad") {
      cyl(g, 0.018, 0.02, 0.76, 0x9d7544, 0, 0.40, 0, 6, -0.10);
      cyl(g, 0.10, 0.14, 0.30, 0xb58a4e, 0, 0.15, 0, 7, -0.10);
      for (let i = -3; i <= 3; i++) cyl(g, 0.009, 0.012, 0.30, 0xc6a56c, i * 0.025, 0.14, 0.02, 5, i * 0.03);
    } else {
      for (let i = 0; i < 3; i++) { cyl(g, 0.035, 0.055, 0.78, 0x789448, (i - 1) * 0.12, 0.40, 0, 7, (i - 1) * 0.12); for (let j = 0; j < 3; j++) torus(g, 0.045, 0.007, 0x9caa69, (i - 1) * 0.12, 0.22 + j * 0.20, 0, Math.PI / 2); }
    }
  } else if (id === "raffia_mat") {
    box(g, 0.78, 0.07, 0.52, 0x99764c, 0, 0.05, 0);
    for (let i = 0; i < 7; i++) box(g, 0.018, 0.012, 0.52, i % 2 ? 0x6c8b48 : 0xc19a5d, -0.34 + i * 0.11, 0.09, 0);
  } else if (id === "woven_basket") {
    cyl(g, 0.24, 0.34, 0.38, 0x9b7445, 0, 0.21, 0, 12);
    torus(g, 0.24, 0.025, 0x68492c, 0, 0.42, 0);
    torus(g, 0.34, 0.025, 0x68492c, 0, 0.36, 0);
    for (let i = 0; i < 10; i++) { const a = i * Math.PI * 2 / 10; cyl(g, 0.008, 0.008, 0.35, 0xc69c5b, Math.cos(a) * 0.26, 0.20, Math.sin(a) * 0.26, 4); }
  } else if (id === "wooden_spoons") {
    for (let i = 0; i < 2; i++) {
      cyl(g, 0.025, 0.018, 0.58, 0x91633d, (i - 0.5) * 0.17, 0.30, 0, 7, -0.35);
      ball(g, 0x91633d, (i - 0.5) * 0.17 - 0.09, 0.57, 0, 0.09, 0.035, 0.07);
    }
  } else if (id === "carved_mask") {
    box(g, 0.42, 0.64, 0.12, 0x8b4d2e, 0, 0.38, 0);
    ball(g, 0x9e5b35, 0, 0.46, 0.08, 0.16, 0.22, 0.045);
    for (const x of [-0.105, 0.105]) ball(g, 0x171513, x, 0.48, 0.12, 0.04, 0.025, 0.012);
    box(g, 0.12, 0.025, 0.018, 0x241b17, 0, 0.30, 0.12);
    for (let i = 0; i < 4; i++) box(g, 0.035, 0.55, 0.015, 0xd0a34a, -0.16 + i * 0.105, 0.38, 0.075);
  } else if (["native_chalk", "black_soap", "shea_butter"].includes(id)) {
    if (id === "native_chalk") { for (let i = 0; i < 3; i++) cyl(g, 0.045, 0.055, 0.32, 0xe0d7c6, (i - 1) * 0.11, 0.17, 0, 7, (i - 1) * 0.13); }
    else if (id === "black_soap") { box(g, 0.42, 0.20, 0.30, 0x30251e, 0, 0.11, 0); ball(g, 0x413128, 0.12, 0.22, 0.02, 0.11, 0.05, 0.10); }
    else { ball(g, 0xc4a95c, 0, 0.15, 0, 0.28, 0.15, 0.23); }
  } else if (id === "roasted_corn") {
    cyl(g, 0.10, 0.12, 0.68, 0xd9a03c, 0, 0.14, 0, 10, Math.PI / 2);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) ball(g, 0xe9c24d, -0.22 + i * 0.11, 0.14 + (j - 1) * 0.06, 0.10, 0.025, 0.028, 0.025);
  } else if (id === "boli_groundnut") {
    for (let i = 0; i < 3; i++) ball(g, 0xd58b3a, (i - 1) * 0.18, 0.15, 0, 0.13, 0.055, 0.23, 0.18);
    for (let i = 0; i < 7; i++) ball(g, 0x9e6a35, (i % 3 - 1) * 0.12, 0.09, 0.25 + Math.floor(i / 3) * 0.07, 0.045, 0.035, 0.07);
  } else if (id === "coconut_fresh") {
    ball(g, 0x6a492d, 0, 0.20, 0, 0.25, 0.23, 0.24);
    ball(g, 0x8d6c44, 0.10, 0.30, 0.03, 0.05, 0.06, 0.05);
    ball(g, 0xeee1c2, 0.18, 0.10, 0.05, 0.08, 0.07, 0.08);
  } else if (id === "agidi_leaf") {
    box(g, 0.42, 0.20, 0.34, 0x4f873e, 0, 0.15, 0, 0.12);
    ball(g, 0xe8e0c2, 0, 0.22, 0, 0.17, 0.10, 0.14);
    for (let i = 0; i < 3; i++) box(g, 0.025, 0.24, 0.34, 0x2d6c34, -0.12 + i * 0.12, 0.15, 0);
  } else if (id === "akara_pap") {
    bowl(g, 0x805e3b, -0.16, 0, 0.20); bowl(g, 0x9f7951, 0.20, 0, 0.16);
    for (let i = 0; i < 4; i++) ball(g, 0xb87532, -0.16 + (i % 2) * 0.12, 0.19, (Math.floor(i / 2) - 0.5) * 0.12, 0.075, 0.07, 0.075);
    cyl(g, 0.13, 0.14, 0.16, 0xe5d2a6, 0.20, 0.15, 0, 10);
  } else if (id === "moin_moin") {
    for (let i = 0; i < 2; i++) { ball(g, 0x567b3a, (i - 0.5) * 0.22, 0.18, 0, 0.16, 0.14, 0.13); box(g, 0.018, 0.22, 0.26, 0x9aba56, (i - 0.5) * 0.22, 0.17, 0); }
  } else if (id === "small_chops") {
    bowl(g, 0xa27b4d, 0, 0, 0.32);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ball(g, i % 2 ? 0x9d5d2a : 0xc48b48, Math.cos(a) * 0.19, 0.22 + (i % 3) * 0.02, Math.sin(a) * 0.19, 0.07, 0.06, 0.07); }
  } else if (["sugarcane"].includes(id)) {
    for (let i = 0; i < 3; i++) { cyl(g, 0.045, 0.05, 0.78, 0xa1b66a, (i - 1) * 0.14, 0.39, 0, 7, (i - 1) * 0.08); for (let j = 0; j < 4; j++) torus(g, 0.048, 0.006, 0xe0d39a, (i - 1) * 0.14, 0.10 + j * 0.19, 0, Math.PI / 2); }
  } else if (["tiger_nut_drink", "zobo_drink", "palm_wine", "burukutu"].includes(id)) {
    bottle(g, id === "zobo_drink" ? 0x81264e : id === "tiger_nut_drink" ? 0xc5a67a : id === "palm_wine" ? 0xdfc48e : 0x76503a);
  } else if (id === "cash" || id === "money") {
    for (let i = 0; i < 5; i++) {
      box(g, 0.27, 0.012, 0.14, i % 2 ? 0x438b55 : 0x2f7546, 0, 0.012 + i * 0.014, 0, (i - 2) * 0.025);
      box(g, 0.045, 0.014, 0.075, 0xd8c27a, 0, 0.014 + i * 0.014, 0);
    }
  } else if (id === "coin") {
    for (let i = 0; i < 3; i++) cyl(g, 0.10, 0.10, 0.025, i % 2 ? 0xc4a449 : 0xe0bd58, (i - 1) * 0.10, 0.025 + i * 0.025, 0, 16);
  } else if (id === "ring" || id === "charm_bracelet") {
    torus(g, id === "ring" ? 0.105 : 0.18, id === "ring" ? 0.025 : 0.025, COLORS.gold, 0, 0.10, 0, Math.PI / 2);
    if (id === "ring") ball(g, 0x8cc8df, 0, 0.13, 0.105, 0.04, 0.04, 0.04);
  } else if (id === "watch") {
    box(g, 0.11, 0.035, 0.26, 0x252b30, 0, 0.08, 0);
    box(g, 0.18, 0.045, 0.18, COLORS.gold, 0, 0.10, 0);
    box(g, 0.13, 0.014, 0.13, 0x638b9a, 0, 0.13, 0);
    cyl(g, 0.018, 0.018, 0.055, COLORS.gold, 0.105, 0.10, 0, 8, Math.PI / 2);
  } else if (id === "jewel") {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), material(0x64c9ed, { metalness: 0.25, roughness: 0.2 }));
    gem.position.y = 0.18; g.add(gem);
    cyl(g, 0.10, 0.13, 0.055, COLORS.gold, 0, 0.055, 0, 10);
  } else if (id === "key_house") {
    torus(g, 0.085, 0.018, COLORS.gold, -0.16, 0.12, 0, Math.PI / 2);
    box(g, 0.30, 0.025, 0.025, COLORS.gold, 0.04, 0.12, 0);
    box(g, 0.035, 0.08, 0.025, COLORS.gold, 0.15, 0.09, 0);
    box(g, 0.035, 0.06, 0.025, COLORS.gold, 0.23, 0.08, 0);
  } else if (id === "note") {
    box(g, 0.28, 0.012, 0.36, 0xe8e1ce, 0, 0.012, 0, -0.08);
    for (let i = 0; i < 4; i++) box(g, 0.19, 0.003, 0.006, 0x8296a3, 0, 0.021, -0.10 + i * 0.065);
  } else if (id === "cigarette" || id === "cigarettes") {
    for (let i = 0; i < (id === "cigarettes" ? 4 : 1); i++) {
      cyl(g, 0.025, 0.025, 0.30, 0xe9e0cc, (i % 2) * 0.055 - 0.025, 0.04 + Math.floor(i / 2) * 0.04, 0, 7, Math.PI / 2);
      cyl(g, 0.026, 0.026, 0.055, 0xb9784e, (i % 2) * 0.055 - 0.025, 0.04 + Math.floor(i / 2) * 0.04, 0.125, 7, Math.PI / 2);
    }
  } else if (id === "lighter") {
    box(g, 0.15, 0.24, 0.08, 0xd5a83f, 0, 0.12, 0);
    box(g, 0.12, 0.025, 0.085, 0x8b8e8d, 0, 0.255, 0);
    cyl(g, 0.018, 0.018, 0.055, 0x6b7073, 0.07, 0.27, 0, 8, Math.PI / 2);
  } else if (id === "bullet") {
    cyl(g, 0.045, 0.045, 0.16, 0xb58a43, 0, 0.08, 0, 8);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.09, 8), material(0xb9b9a6));
    tip.position.y = 0.205; g.add(tip);
  } else if (id === "pistol") {
    box(g, 0.30, 0.07, 0.085, 0x34383b, 0, 0.19, 0);
    box(g, 0.13, 0.20, 0.075, 0x25292c, -0.055, 0.07, 0.015, -0.12);
    box(g, 0.16, 0.035, 0.045, 0x555b60, 0.08, 0.24, 0);
  } else {
    // Generic but still tangible 3D market article for future catalogue additions.
    box(g, 0.38, 0.30, 0.28, 0xb18a58, 0, 0.15, 0);
    box(g, 0.28, 0.05, 0.20, 0xe0c67c, 0, 0.33, 0);
  }

  g.name = "market-item-" + id;
  g.userData.marketItemId = id;
  g.userData.marketItemLabel = label;
  return g;
}

export function createMarketItemMesh(item) {
  const id = item && item.id ? String(item.id) : "market-goods";
  const label = item && (item.label || item.name) ? String(item.label || item.name) : id;
  return modelForId(id, label);
}
