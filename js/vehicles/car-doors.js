/* car-doors.js — REAL built-in hinged doors for every car.

   How it works (no floating add-on panels):
   • The door is cut out of the car's OWN body meshes. Every mesh that touches the
     door box (paint, glass, trim, vertex-coloured merged bodies, …) is cloned into the
     door pivot and a shader discard keeps only the part inside the door box, so the
     door has the exact same surface, paint, curvature and window as the body.
   • The same box is cut OUT of the body while the door is open, so you really see an
     opening into the cabin (interior kit supplies seats/floor/door-card where a car has none).
   • Closed: nothing is cut, the clones are hidden, only shut-lines + handle are drawn.
   • The door hinges on its front edge and swings out; the pivot is a child of the car.

   Frame used by every spec below ("car frame"): +Z = forward, +X = car's LEFT (driver
   side), +Y up, origin = car origin AFTER drive.js applied its front correction. */
import * as THREE from "three";

const MAXH = 6; /* max doors per car */

/* ── per-model door layout (car frame) ──────────────────────────────────────
   z1 = hinge (front edge), z0 = rear edge, y0 sill, y1 top of window frame,
   belt = window bottom, seat = driver seat centre (left side, +X). */
const SPECS = {
  gwagon:     { doors: [{ z1: 0.93, z0: -0.59, y0: 0.62, y1: 1.93, belt: 1.17 }], seat: { x: 0.42, y: 1.02, z: 0.20 } },
  scrappy:    { doors: [{ z1: 0.55, z0: -0.55, y0: 0.40, y1: 1.45, belt: 0.95 }], seat: { x: 0.38, y: 0.72, z: 0.12 }, hide: ["doorPivot"] },
  taxi:       { doors: [{ z1: 0.95, z0: -0.10, y0: 0.55, y1: 1.85, belt: 1.15 }], seat: { x: 0.45, y: 0.95, z: 0.30 } },
  hilux:      { doors: [{ z1: 0.86, z0: -0.06, y0: 0.52, y1: 1.28, belt: 0.95 }], seat: { x: 0.42, y: 0.90, z: 0.32 } },
  cybertruck: { doors: [{ z1: 0.85, z0: -0.90, y0: 0.55, y1: 1.45, belt: 1.05 }], seat: { x: 0.42, y: 0.85, z: 0.15 } },
  rangerover: { native: true, doors: [{ z1: 0.885, z0: -0.715, y0: 0.74, y1: 1.7, belt: 1.4 }], seat: { x: 0.45, y: 1.18, z: 0.25 } },
  mercedes:   { doors: [{ z1: 0.93, z0: -0.14, y0: 0.30, y1: 1.26, belt: 0.93 }], seat: { x: 0.40, y: 0.50, z: 0.25 } },
  bmw:        { doors: [{ z1: 0.92, z0: -0.40, y0: 0.30, y1: 1.18, belt: 0.88 }], seat: { x: 0.38, y: 0.38, z: 0.10 } },
  chiron:     { doors: [{ z1: 0.80, z0: -0.50, y0: 0.26, y1: 1.10, belt: 0.74 }], seat: { x: 0.30, y: 0.30, z: 0.05 } },
};
const DEFAULT_SPEC = SPECS.mercedes;

/* ── shared shader patch: hole(s) in the body / keep-box on door clones ─────── */
const GLSL_UNI = `
varying vec3 vDoorWP;
uniform mat4 uHoleInv[${MAXH}];
uniform float uHoleOn[${MAXH}];
uniform mat4 uKeepInv;
uniform float uKeepOn;
`;
const GLSL_TEST = `
{
  vec4 dwp = vec4(vDoorWP, 1.0);
  if (uKeepOn > 0.5) {
    vec3 k = (uKeepInv * dwp).xyz;
    if (abs(k.x) > 1.0 || abs(k.y) > 1.0 || abs(k.z) > 1.0) discard;
  }
  for (int i = 0; i < ${MAXH}; i++) {
    if (uHoleOn[i] > 0.5) {
      vec3 q = (uHoleInv[i] * dwp).xyz;
      if (abs(q.x) < 1.0 && abs(q.y) < 1.0 && abs(q.z) < 1.0) discard;
    }
  }
}
`;

function patchMaterial(mat, uniforms, key) {
  mat.side = THREE.DoubleSide;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uHoleInv = uniforms.uHoleInv;
    shader.uniforms.uHoleOn = uniforms.uHoleOn;
    shader.uniforms.uKeepInv = uniforms.uKeepInv;
    shader.uniforms.uKeepOn = uniforms.uKeepOn;
    shader.vertexShader = "varying vec3 vDoorWP;\n" + shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\n vDoorWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = GLSL_UNI + shader.fragmentShader.replace(
      "#include <clipping_planes_fragment>",
      "#include <clipping_planes_fragment>\n" + GLSL_TEST);
  };
  mat.customProgramCacheKey = () => "cardoor-" + key;
  mat.needsUpdate = true;
  return mat;
}

function cloneMats(mesh, uniforms, key) {
  const src = mesh.material;
  if (Array.isArray(src)) return src.map(m => patchMaterial(m.clone(), uniforms, key));
  return patchMaterial(src.clone(), uniforms, key);
}

const _m4 = new THREE.Matrix4();
const _v3 = new THREE.Vector3();

function meshBoxInFrame(mesh, worldToF) {
  const g = mesh.geometry;
  if (!g) return null;
  if (!g.boundingBox) g.computeBoundingBox();
  const b = g.boundingBox.clone();
  _m4.multiplyMatrices(worldToF, mesh.matrixWorld);
  b.applyMatrix4(_m4);
  return b;
}

/**
 * Install doors on a car group (child of the car root). `opts.model` picks the spec,
 * `opts.spec` overrides it. Returns the door controller (also car.userData.carDoors).
 */
export function addCarDoors(car, opts = {}) {
  if (!car) return null;
  if (car.userData.carDoors) return car.userData.carDoors;
  const model = opts.model || "default";
  const spec = opts.spec || SPECS[model] || DEFAULT_SPEC;

  /* Range Rover already ships with four genuine hinged door groups (body is built with the
     door openings) — drive those instead of cutting the body. */
  if (spec.native && Array.isArray(car.userData.doors)) {
    const dd = { list: [], left: [], right: [], openAngle: opts.openAngle || 1.18, spec, model, native: true };
    for (const g of car.userData.doors) {
      const side = g.userData.sign > 0 ? 1 : -1;
      const front = !!g.userData.isFront;
      const d = { pivot: g, side, open: 0, target: 0, native: true, front,
        spec: front ? { z0: -0.715, z1: 0.885 } : { z0: -2.145, z1: -0.715 }, xo: 0.955 };
      dd.list.push(d); (side > 0 ? dd.left : dd.right).push(d);
    }
    car.userData.carDoors = dd;
    return dd;
  }

  car.updateMatrix();
  car.updateWorldMatrix(true, true);
  /* F = car's parent frame (car frame). carToF = car.matrix; we want F coords from car-local. */
  const carM = car.matrix.clone();
  const carInvM = carM.clone().invert();
  const parentWorld = car.parent ? car.parent.matrixWorld.clone() : new THREE.Matrix4();
  const toF = new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().copy(parentWorld).invert(), car.matrixWorld);

  for (const k of (spec.hide || [])) { if (car.userData[k]) car.userData[k].visible = false; }

  /* collect candidate meshes (static body parts, not wheels / our own stuff) */
  const wheelSet = new Set();
  for (const w of (car.userData.wheels || [])) {
    const o = w.pivot || w.mesh || w.group || w;
    if (o && o.traverse) o.traverse(n => wheelSet.add(n));
  }
  const bodyMeshes = [];
  car.traverse(n => {
    if (!n.isMesh || !n.geometry || n.isInstancedMesh || n.isSkinnedMesh) return;
    if (wheelSet.has(n)) return;
    if (n.userData && n.userData.noDoor) return;
    bodyMeshes.push(n);
  });

  const U_body = {
    uHoleInv: { value: Array.from({ length: MAXH }, () => new THREE.Matrix4()) },
    uHoleOn: { value: new Array(MAXH).fill(0) },
    uKeepInv: { value: new THREE.Matrix4() },
    uKeepOn: { value: 0 },
  };

  const doors = { list: [], left: [], right: [], openAngle: opts.openAngle || 1.18, spec, model, uniforms: U_body };
  const groupAll = new THREE.Group(); groupAll.name = "carDoors"; car.add(groupAll);

  const bodyOriginalMats = new Map();
  const touched = new Set();

  /* mirror spec for the right side (x flips) */
  const defs = [];
  for (const d of spec.doors) {
    defs.push({ ...d, side: +1 });   /* left (driver) */
    defs.push({ ...d, side: -1 });   /* right (passenger) */
  }

  /* surface sampling helper: ray toward the car from outside, returns hit x in F frame */
  const rc = new THREE.Raycaster();
  const rayMeshes = bodyMeshes;
  const frameToWorld = parentWorld;
  function surfaceX(side, y, z, fallback, glass) {
    const o = new THREE.Vector3(side * 6, y, z).applyMatrix4(frameToWorld);
    const dWorld = new THREE.Vector3(-side, 0, 0).transformDirection(frameToWorld);
    rc.set(o, dWorld);
    const hits = rc.intersectObjects(rayMeshes, false);
    for (const h of hits) {
      if (!glass && h.object.material && h.object.material.transparent) continue;
      return h.point.clone().applyMatrix4(new THREE.Matrix4().copy(frameToWorld).invert()).x;
    }
    return fallback;
  }

  /* highest point of the side greenhouse at this z (so the door top never sticks above the roofline) */
  const rcAll = new THREE.Raycaster();
  const allMeshes = bodyMeshes;
  function windowTop(side, z, from, to, xo) {
    let top = from;
    for (let y = from; y <= to + 1e-6; y += 0.02) {
      const o = new THREE.Vector3(side * 6, y, z).applyMatrix4(frameToWorld);
      rcAll.set(o, new THREE.Vector3(-side, 0, 0).transformDirection(frameToWorld));
      const hit = rcAll.intersectObjects(allMeshes, false)[0];
      if (!hit) break;
      const hx = Math.abs(hit.point.clone().applyMatrix4(new THREE.Matrix4().copy(frameToWorld).invert()).x);
      if (hx < xo - 0.32) break;
      top = y;
    }
    return top;
  }

  let hi = 0;
  for (const dd0 of defs) {
    const d = { ...dd0 };
    if (hi >= MAXH) break;
    const side = d.side;
    if (!spec.native) {
      const xo0 = Math.abs(surfaceX(side, d.belt - 0.12, (d.z0 + d.z1) / 2, 0.95));
      const t0 = windowTop(side, (d.z0 + d.z1) / 2, d.belt, d.y1, xo0);
      d.y1 = Math.max(d.belt + 0.18, Math.min(d.y1, t0 + 0.02));
    }
    const zc = (d.z0 + d.z1) / 2, yc = (d.y0 + d.y1) / 2;
    const xo = Math.abs(surfaceX(side, d.belt - 0.12, zc, 0.95));
    const dep = 0.16;                         /* skin depth captured in the door */
    const bx0 = xo - dep, bx1 = xo + 0.45;    /* x extent (absolute) */
    /* box in F: */
    const bMin = new THREE.Vector3(side > 0 ? bx0 : -bx1, d.y0, d.z0);
    const bMax = new THREE.Vector3(side > 0 ? bx1 : -bx0, d.y1, d.z1);
    const hinge = new THREE.Vector3(side * xo, 0, d.z1);

    /* pivot: car-local matrix, axes aligned with F, origin at hinge */
    const restF = new THREE.Matrix4().makeTranslation(hinge.x, hinge.y, hinge.z);
    const restLocal = new THREE.Matrix4().multiplyMatrices(carInvM, restF);
    const pivot = new THREE.Group();
    pivot.name = side > 0 ? "doorL" : "doorR";
    pivot.matrixAutoUpdate = false;
    pivot.matrix.copy(restLocal);
    groupAll.add(pivot);
    groupAll.matrixAutoUpdate = true;

    /* clip box → unit-cube transform pieces, in hinge-relative F coords */
    const centerRel = new THREE.Vector3().addVectors(bMin, bMax).multiplyScalar(0.5).sub(hinge);
    const half = new THREE.Vector3().subVectors(bMax, bMin).multiplyScalar(0.5);
    const boxLocal = new THREE.Matrix4().compose(centerRel, new THREE.Quaternion(), half); /* unit→pivot-local */

    const U_door = {
      uHoleInv: U_body.uHoleInv, uHoleOn: { value: new Array(MAXH).fill(0) },
      uKeepInv: { value: new THREE.Matrix4() }, uKeepOn: { value: 1 },
    };

    const clones = new THREE.Group(); clones.visible = false; pivot.add(clones);

    for (const m of bodyMeshes) {
      if (!m.visible) continue;
      const bb = meshBoxInFrame(m, new THREE.Matrix4().copy(parentWorld).invert());
      if (!bb) continue;
      const box = new THREE.Box3(bMin, bMax);
      if (!bb.intersectsBox(box)) continue;
      /* clone into the door */
      const c = new THREE.Mesh(m.geometry, cloneMats(m, U_door, "keep"));
      c.matrixAutoUpdate = false;
      /* m→car-local, then into pivot-local */
      const mLocal = new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().copy(car.matrixWorld).invert(), m.matrixWorld);
      c.matrix.multiplyMatrices(new THREE.Matrix4().copy(restLocal).invert(), mLocal);
      c.castShadow = false; c.receiveShadow = m.receiveShadow;
      c.renderOrder = m.renderOrder;
      clones.add(c);
      /* body gets the hole */
      if (!touched.has(m)) {
        bodyOriginalMats.set(m, m.material);
        m.material = cloneMats(m, U_body, "hole");
        touched.add(m);
      }
    }

    /* door frame furniture drawn on the pivot (always visible): shut-lines, handle, edge seals, door card */
    const trim = new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.9, metalness: 0 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd5dc, metalness: 0.95, roughness: 0.2 });
    const card = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.85, metalness: 0.05 });
    const furn = new THREE.Group(); pivot.add(furn);
    const sx = (v) => v; /* all furniture coords are pivot-relative F coords (x sign handled by `side`) */

    /* shut-line ribbon along the perimeter, laid on the actual surface */
    const pts = [];
    const N = 10;
    const per = [
      [d.z1, d.y0, d.z1, d.y1],   /* front edge (hinge side) */
      [d.z1, d.y1, d.z0, d.y1],   /* top */
      [d.z0, d.y1, d.z0, d.y0],   /* rear edge */
      [d.z0, d.y0, d.z1, d.y0],   /* bottom */
    ];
    const verts = [], idx = [];
    for (const [za, ya, zb, yb] of per) {
      for (let i = 0; i <= N; i++) {
        const t = i / N, z = za + (zb - za) * t, y = ya + (yb - ya) * t;
        const sxw = surfaceX(side, y, z, xo, true);
        const x = (Math.abs(sxw) + 0.006) * side;
        pts.push([x - hinge.x, y - hinge.y, z - hinge.z, za === zb ? 1 : 0]);
      }
    }
    /* build thin quads between consecutive points of each edge */
    let base = 0;
    for (let e = 0; e < 4; e++) {
      for (let i = 0; i < N; i++) {
        const a = pts[e * (N + 1) + i], b = pts[e * (N + 1) + i + 1];
        const vert = a[3] === 1; /* vertical edge → widen in z, horizontal → widen in y */
        const w = 0.011;
        const o1 = vert ? [0, 0, w] : [0, w, 0];
        verts.push(a[0], a[1] - o1[1], a[2] - o1[2], a[0], a[1] + o1[1], a[2] + o1[2],
                   b[0], b[1] - o1[1], b[2] - o1[2], b[0], b[1] + o1[1], b[2] + o1[2]);
        idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        base += 4;
      }
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    lineGeo.setIndex(idx);
    const lineMesh = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ color: 0x050607, side: THREE.DoubleSide }));
    furn.add(lineMesh);

    /* handle (on surface, near the rear edge, just under the belt) */
    const hz = d.z0 + (d.z1 - d.z0) * 0.18;
    const hy = d.belt - 0.09;
    const hx = (Math.abs(surfaceX(side, hy, hz, xo)) + 0.018) * side;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.18), chrome);
    handle.position.set(hx - hinge.x, hy - hinge.y, hz - hinge.z);
    furn.add(handle);

    /* closed-door shell: edge seals + inner door card (so the open door is solid, not hollow) */
    const inX = (side > 0 ? bx0 : -bx0) - hinge.x;          /* inner face x (pivot-relative) */
    const L = d.z1 - d.z0, Hh = d.y1 - d.y0, Hb = d.belt - d.y0;
    const cardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.03, Hb, L), card);
    cardMesh.position.set(inX + side * 0.0, d.y0 + Hb / 2 - hinge.y, (d.z0 + d.z1) / 2 - hinge.z);
    furn.add(cardMesh);
    const sealT = 0.022;
    const seal = (w, h, dd, px, py, pz) => { const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), trim); s.position.set(px, py, pz); furn.add(s); };
    const depX = Math.abs(inX - ((side > 0 ? bx1 : -bx1) - hinge.x)) * 0; /* unused */
    const midX = (side > 0 ? (bx0 + xo) : -(bx0 + xo)) / 2 - hinge.x;
    const yb = (d.y0 + d.belt) / 2 - hinge.y;
    seal(dep, Hb, sealT, midX, yb, d.z0 - hinge.z + sealT / 2);                    /* rear edge (below belt) */
    seal(dep, Hb, sealT, midX, yb, d.z1 - hinge.z - sealT / 2);                    /* front edge (below belt) */
    seal(dep, sealT, L, midX, d.y0 - hinge.y + sealT / 2, (d.z0 + d.z1) / 2 - hinge.z); /* bottom */

    const door = {
      pivot, clones, side, spec: d, box: { min: bMin, max: bMax }, hinge, xo,
      boxLocal, U_door, hole: hi,
      open: 0, target: 0, restLocal, lastOpen: -1,
    };
    doors.list.push(door);
    (side > 0 ? doors.left : doors.right).push(door);
    hi++;
  }

  car.userData.carDoors = doors;
  car.userData.doorBodyMats = bodyOriginalMats;
  /* seat kit */
  buildInteriorKit(car, spec, opts);
  syncDoors(car, true);
  return doors;
}

function buildInteriorKit(car, spec, opts) {
  if (opts.noInterior || car.userData.hasInterior) return;
  const g = new THREE.Group(); g.name = "doorInterior";
  const seatM = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.9 });
  const floorM = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 1 });
  const s = spec.seat;
  for (const side of [1, -1]) {
    const sx = side * Math.abs(s.x);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.5), seatM);
    base.position.set(sx, s.y - 0.06, s.z);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.58, 0.1), seatM);
    back.position.set(sx, s.y + 0.26, s.z - 0.26); back.rotation.x = -0.12;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.1), seatM);
    head.position.set(sx, s.y + 0.64, s.z - 0.29);
    g.add(base, back, head);
  }
  const floor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 1.4), floorM);
  floor.position.set(0, spec.doors[0].y0 + 0.02, s.z - 0.1);
  g.add(floor);
  car.add(g);
  car.userData.doorInterior = g;
}

/* ── runtime ─────────────────────────────────────────────────────────────── */

/** Set desired open amount for a side: "left" | "right" | "both". amount 0..1 */
export function setDoorTarget(car, side, amount) {
  const d = car && car.userData && car.userData.carDoors;
  if (!d) return;
  const a = Math.max(0, Math.min(1, amount));
  if (side === "left" || side === "both") for (const x of d.left) x.target = a;
  if (side === "right" || side === "both") for (const x of d.right) x.target = a;
}

export function isDoorOpen(car, side = "left") {
  const d = car && car.userData && car.userData.carDoors;
  if (!d) return false;
  return (side === "right" ? d.right : d.left).some(x => x.open > 0.02);
}

const _P = new THREE.Matrix4(), _R = new THREE.Matrix4(), _W = new THREE.Matrix4();

function syncDoors(car, force) {
  const D = car.userData.carDoors; if (!D) return;
  car.updateWorldMatrix(true, false);
  for (const d of D.list) {
    const ang = d.open * D.openAngle * (d.side > 0 ? -1 : 1); /* left door swings out (+X): rotate −Y */
    if (d.native) { d.pivot.rotation.y = ang * (d.front ? 1 : 0.85); continue; }
    if (!force && d.open === d.lastOpen && !d.moving) { /* car may have moved: keep world-space cut aligned */ }
    _R.makeRotationY(ang);
    d.pivot.matrix.multiplyMatrices(d.restLocal, _R);
    const isOpen = d.open > 0.002;
    d.clones.visible = isOpen;
    D.uniforms.uHoleOn.value[d.hole] = isOpen ? 1 : 0;
    if (isOpen) {
      /* world matrices */
      _W.multiplyMatrices(car.matrixWorld, d.restLocal);                    /* rest pivot world */
      _P.multiplyMatrices(_W, d.boxLocal);                                   /* unit cube → world (closed pose) */
      D.uniforms.uHoleInv.value[d.hole].copy(_P).invert();
      _W.multiplyMatrices(car.matrixWorld, d.pivot.matrix);                  /* current pivot world */
      _P.multiplyMatrices(_W, d.boxLocal);
      d.U_door.uKeepInv.value.copy(_P).invert();
    }
    d.lastOpen = d.open;
  }
}

/** Animate doors toward their targets. Call every frame. */
export function updateDoors(car, dt) {
  const D = car && car.userData && car.userData.carDoors;
  if (!D) return;
  const speed = 2.6;
  for (const d of D.list) {
    if (Math.abs(d.open - d.target) < 0.001) d.open = d.target;
    else d.open += Math.sign(d.target - d.open) * Math.min(Math.abs(d.target - d.open), speed * dt);
  }
  syncDoors(car, false);
}

/** Points in the CAR FRAME (+Z fwd, +X left) for getting in / out of a side's front door. */
export function doorPoints(car, side = "left") {
  const D = car && car.userData && car.userData.carDoors;
  const sgn = side === "right" ? -1 : 1;
  const d = D && (sgn > 0 ? D.left[0] : D.right[0]);
  const spec = D ? D.spec : DEFAULT_SPEC;
  const s = spec.seat;
  const dz = d ? (d.spec.z0 + d.spec.z1) / 2 : 0;
  const xo = d ? d.xo : 1.0;
  return {
    stand: { x: sgn * (xo + 0.62), z: dz - 0.08 },          /* where the player stands beside the door */
    door:  { x: sgn * (xo + 0.18), z: dz },                  /* in the doorway */
    seat:  { x: sgn * Math.abs(s.x), y: s.y, z: s.z },
  };
}

/** (legacy name kept) world-space stand point beside a door. */
export function doorStandPoint(carRoot, carMesh, heading, carPos, carSize, side = "left") {
  const p = doorPoints(carMesh, side).stand;
  const cH = Math.cos(heading), sH = Math.sin(heading);
  return { x: carPos.x + p.x * cH + p.z * sH, z: carPos.z - p.x * sH + p.z * cH };
}

export function doorSpecFor(model) { return SPECS[model] || DEFAULT_SPEC; }
