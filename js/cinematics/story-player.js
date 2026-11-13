/* Everyday Cinematics — plays 3D story films inside the game's own world.
   • Uses the real Port Harcourt world, interiors, faceted characters and vehicles.
   • Every location is built ONCE and shared by all acts that use it (a story that visits
     the hotel twice no longer builds two hotels), then shown/hidden per act.
   • Each location has a STAGE: where the cast stands and a 4-shot camera choreography
     (establishing crane → tracking dolly → close orbit → push-in), tuned per location.
   • Public API is unchanged for the Comics reader: playCinematic(canvas, config, carBuilder)
     → { play, pause, restart, skip, state, destroy } plus seek(), renderOnce(). */
import * as THREE from '../../vendor/three/three.module.min.js';
import { buildPHWorld } from '../world/phworld.js';
import { buildFaceted } from '../characters/faceted.js';

/* ------------------------------------------------------------------ stages */
/* anchor/yaw place the cast in the world; shots are in the stage's local frame.
   t:'lead' means "look at the lead character" (with a chest-height offset). */
export const STAGES = {
  street: {   // on the diagonal road south-west of the Central Mosque, looking north-east at its dome
    set: 'city', anchor: [-69, 0, 57], yaw: -0.68, sky: '#9dc4e8',
    shots: [
      { p: [-14, 24, 42], t: [0, 4, -14] },
      { p: [-10, 5.5, 20], t: 'lead' },
      { p: [6, 3.4, 13], t: 'lead' },
      { p: [2.6, 2.1, 8.2], t: 'lead' },
    ],
  },
  campus: {   // the UNIPORT quad: on the N-S path, main building ahead, cast walking toward camera
    set: 'city', anchor: [-230, 0, 8], yaw: 0, sky: '#9dc4e8',
    shots: [
      { p: [-6, 20, 44], t: [0, 5, -28] },
      { p: [0.5, 3.6, 24], t: 'lead' },
      { p: [3, 2.6, 15], t: 'lead' },
      { p: [1.4, 1.8, 8.5], t: 'lead' },
    ],
  },
  classroom: {   // aisle at the front of the room, camera from the back corner
    set: 'classroom', anchor: [0, 0, -1], yaw: 0, interior: true, castScale: 0.7,
    shots: [
      { p: [-5.8, 2.9, 6.2], t: [0, 1.3, 0] },
      { p: [-3, 1.9, 4.8], t: 'lead' },
      { p: [2.4, 1.8, 4], t: 'lead' },
      { p: [0.9, 1.7, 3.2], t: 'lead' },
    ],
  },
  hotel: {       // Hotel Presidential lobby: open floor beside the fountain, camera from the west side
    set: 'hotel', anchor: [9, 0, 15], yaw: -Math.PI / 2, interior: true, castScale: 0.6,
    shots: [
      { p: [-3, 4, 9], t: [0, 1.5, -3] },
      { p: [-2.2, 2.4, 6.5], t: 'lead' },
      { p: [1.5, 1.9, 5], t: 'lead' },
      { p: [0.4, 1.7, 3.4], t: 'lead' },
    ],
  },
  office: {      // Property Office: desk and sofa corner
    set: 'office', anchor: [0, 0, -0.5], yaw: 0, interior: true, castScale: 0.6,
    shots: [
      { p: [-4.2, 3.4, 5], t: [0, 1.2, 0] },
      { p: [-2.6, 2.2, 4], t: 'lead' },
      { p: [2.2, 1.9, 3.4], t: 'lead' },
      { p: [0.8, 1.7, 2.8], t: 'lead' },
    ],
  },
  parkGate: {   // just outside the Pleasure Park entrance arch, looking in toward the carousel
    set: 'park', anchor: [0, 0, 31], yaw: 0, sky: '#9bc8ed', castScale: 0.8,
    shots: [
      { p: [-9, 12, 26], t: [0, 3, -6] },
      { p: [-6, 3.4, 15], t: 'lead' },
      { p: [3, 2.4, 10], t: 'lead' },
      { p: [1.4, 1.8, 6], t: 'lead' },
    ],
  },
  parkWheel: {   // south of the Ferris wheel on the cross path, looking north at it
    set: 'park', anchor: [-22, 0, 4], yaw: 0, sky: '#9bc8ed', castScale: 0.8,
    shots: [
      { p: [-6, 8, 9], t: [2, 4, -12] },
      { p: [-3, 2.8, 7.5], t: 'lead' },
      { p: [2, 2.3, 6], t: 'lead' },
      { p: [0.8, 1.8, 4.2], t: 'lead' },
    ],
  },
  parkFood: {   // in front of the coloured food stalls
    set: 'park', anchor: [-12, 0, 24], yaw: 0, sky: '#9bc8ed', castScale: 0.8,
    shots: [
      { p: [-9, 12, 26], t: [0, 3, -6] },
      { p: [-6, 3.4, 15], t: 'lead' },
      { p: [3, 2.4, 10], t: 'lead' },
      { p: [1.4, 1.8, 6], t: 'lead' },
    ],
  },
  parkPromise: {   // by the fountain, golden hour
    set: 'park', anchor: [24, 0, -4], yaw: 0, sky: '#9bc8ed', castScale: 0.8,
    shots: [
      { p: [-9, 12, 26], t: [0, 3, -6] },
      { p: [-6, 3.4, 15], t: 'lead' },
      { p: [3, 2.4, 10], t: 'lead' },
      { p: [1.4, 1.8, 6], t: 'lead' },
    ],
  },
  hotelExterior: {   // Hotel Presidential front drive
    set: 'hotelExterior', anchor: [0, 0, 14], yaw: 0, sky: '#9bc8ed', castScale: 0.8,
    shots: [
      { p: [-16, 9, 34], t: [0, 6, -8] },
      { p: [-7, 3.4, 20], t: 'lead' },
      { p: [4, 2.6, 10], t: 'lead' },
      { p: [1.6, 1.9, 6], t: 'lead' },
    ],
  },
  streetB: {   // long east-west road north of the mosque
    set: 'city', anchor: [-40, 0, -32], yaw: 0, sky: '#9dc4e8',
    shots: [
      { p: [-14, 22, 36], t: [0, 3, -4] },
      { p: [-10, 5.5, 20], t: 'lead' },
      { p: [6, 3.4, 13], t: 'lead' },
      { p: [2.6, 2.1, 8.2], t: 'lead' },
    ],
  },
  streetC: {   // the junction west of the mosque
    set: 'city', anchor: [-94, 0, 7], yaw: 2.2, sky: '#9dc4e8',
    shots: [
      { p: [-14, 22, 36], t: [0, 3, -4] },
      { p: [-10, 5.5, 20], t: 'lead' },
      { p: [6, 3.4, 13], t: 'lead' },
      { p: [2.6, 2.1, 8.2], t: 'lead' },
    ],
  },
};
STAGES.park = STAGES.parkGate;
STAGES.university = STAGES.campus;

/* ------------------------------------------------------------------ helpers */
const SKIN = ['#8a5038', '#a96849', '#c88662', '#70412f', '#d39a77', '#995d45'];
const HAIR = ['#211b19', '#39271f', '#171719', '#4a3024', '#251b18'];
const PANTS = ['#25344b', '#353a42', '#4b4137', '#202b35', '#6b5945'];
const color = (v) => new THREE.Color(v);
const smooth = (t) => t * t * (3 - 2 * t);
const yieldFrame = () => new Promise((r) => setTimeout(r, 0));
const disposeObject = (root) => root?.traverse?.((o) => {
  if (o.geometry) o.geometry.dispose();
  if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
});

function stageFor(kind) { return STAGES[kind] || STAGES.street; }

function createGameCharacter(spec, index, actIndex) {
  const female = spec.gender === 'female' || (!spec.gender && index === 1);
  const character = buildFaceted({
    body: female ? 'female' : 'male',
    build: spec.build ?? ((index % 3) - 1) * 0.12,
    skin: spec.skin || SKIN[(index + actIndex) % SKIN.length],
    hair: spec.hair || (female ? (index % 2 ? 'braids' : 'long') : (index % 2 ? 'afro' : 'short')),
    hairColor: spec.hairColor || HAIR[(index + actIndex) % HAIR.length],
    top: spec.top || (female ? 'tshirt' : (index % 3 === 0 ? 'hoodie' : 'polo')),
    topColor: spec.shirt || ['#2764a5', '#e0a13d', '#9b3f56', '#287b65', '#7c5bb4'][(index + actIndex) % 5],
    bottom: spec.bottom || 'jeans',
    bottomColor: spec.bottomColor || PANTS[(index + actIndex) % PANTS.length],
    shoeStyle: 'sneaker',
    shoeColor: '#25272b',
  });
  const u = character.root.userData;
  u.cinematicCharacter = true;
  u.phase = index * 1.71 + actIndex * 0.63;
  u.walking = spec.walking !== false;
  u.rig = character.rig;
  return character;
}

/* ------------------------------------------------------------------ sets */
function buildCityWorld() {
  const data = buildPHWorld();
  const group = new THREE.Group();
  const base = new THREE.Mesh(data.baseGeometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
  const detail = new THREE.Mesh(data.detailGeometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
  group.add(base, detail);
  group.userData.worldData = data;
  return { group, background: null, fog: null, interior: false };
}

async function buildInteriorSet(kind) {
  const router = { renderer: { domElement: document.createElement('canvas') }, cinematic: true };
  const mod = await import(`../places/${kind === 'office' ? 'realestate' : kind}/interior.js`);
  const built = await mod.buildInterior(router);
  const group = new THREE.Group();
  const src = built.three;
  while (src.children.length) group.add(src.children[0]);
  return { group, built, background: src.background, fog: src.fog, interior: true };
}

async function buildExteriorSet(folder) {
  const mod = await import(`../places/${folder}/exterior.js`);
  const group = mod.buildExterior();
  return { group, background: null, fog: null, interior: false };
}

export async function buildSet(setKey) {
  if (setKey === 'city') return buildCityWorld();
  if (setKey === 'park') return buildExteriorSet('pleasurepark');
  if (setKey === 'hotelExterior') return buildExteriorSet('hotel');
  return buildInteriorSet(setKey);
}

/* ------------------------------------------------------------------ player */
export async function playCinematic(canvas, config, carBuilder) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, config.maxPixelRatio ?? 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false; // keeps full-city rendering stable on phones
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); config.onError?.(new Error('The graphics context was lost. Reload the page.')); });

  const scene = new THREE.Scene();
  scene.background = color('#9dc4e8');
  scene.fog = new THREE.Fog('#9dc4e8', 220, 1100);
  const camera = new THREE.PerspectiveCamera(43, 16 / 9, 0.1, 1800);
  const rig = new THREE.Group(); // outdoor lighting — hidden inside interiors, which carry their own lights
  rig.add(new THREE.HemisphereLight('#eaf5ff', '#4a493c', 1.65));
  const sun = new THREE.DirectionalLight('#fff0d1', 2.35); sun.position.set(-180, 260, 160); rig.add(sun);
  const fill = new THREE.DirectionalLight('#80c9ff', 0.75); fill.position.set(150, 80, -180); rig.add(fill);
  scene.add(rig);
  const hemi = rig.children[0];
  const TOD = {   // [sky, fog, hemi intensity, sun colour, sun intensity, fill intensity]
    day:   ['#9dc4e8', null, 1.65, '#fff0d1', 2.35, 0.75],
    dusk:  ['#f0a874', '#f0b88c', 1.15, '#ffb066', 1.9, 0.5],
    night: ['#0b1427', '#0b1427', 0.55, '#7f9bd6', 0.55, 0.35],
  };

  /* ---- build every distinct location once, reporting progress ---- */
  const setKeys = [];
  config.acts.forEach((a) => { const k = stageFor(a.kind || 'street').set; if (!setKeys.includes(k)) setKeys.push(k); });
  const sets = new Map();
  const total = setKeys.length + 1;
  const LABEL = { city: 'Port Harcourt streets', classroom: 'Classroom', hotel: 'Hotel Presidential', office: 'Property office', park: 'Pleasure Park', hotelExterior: 'Hotel entrance' };
  const setOf = (k) => stageFor(k).set;
  let done = 0;
  for (const key of setKeys) {
    config.onProgress?.(done / total, `Building ${LABEL[key] || key}…`);
    await yieldFrame();
    const rec = await buildSet(key);
    rec.group.visible = false;
    scene.add(rec.group);
    sets.set(key, rec);
    done++;
  }
  config.onProgress?.(done / total, 'Casting characters…');
  await yieldFrame();

  /* ---- per-act cast (characters + vehicle), placed in the stage frame ---- */
  const acts = [];
  for (let i = 0; i < config.acts.length; i++) {
    const act = config.acts[i];
    const kind = act.kind || 'street';
    const stage = stageFor(kind);
    const anchor = new THREE.Vector3(stage.anchor[0], stage.anchor[1], stage.anchor[2]);
    const yaw = stage.yaw || 0;
    const toWorld = (v) => new THREE.Vector3(v[0], v[1] || 0, v[2]).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(anchor);
    const cast = new THREE.Group(); cast.visible = false; scene.add(cast);
    const people = [];
    (act.cast || []).forEach((spec, j) => {
      const c = createGameCharacter(spec, j, i);
      const sc = stage.castScale || 1, sp = spec.position || [0, 0, 0];
      c.root.position.copy(toWorld([sp[0] * sc, sp[1], sp[2] * sc]));
      c.root.rotation.y = (spec.rotation ?? (j % 2 ? Math.PI : 0)) + yaw;
      c.root.userData.home = c.root.position.clone();
      cast.add(c.root); people.push(c);
    });
    let car = null;
    if (carBuilder && act.car && !stage.interior) {
      car = carBuilder(act.car.color || '#183b67', '#c9ced6');
      car.position.copy(toWorld(act.car.position || [4, 0, 4]));
      car.rotation.y = (act.car.rotation ?? Math.PI / 2) + yaw;
      car.scale.setScalar(act.car.scale || 1);
      car.userData.cinematicVehicle = true;
      // The car model's nose points along its local +Z, so it drives that way (never in reverse).
      const speed = act.car.speed ?? (kind.startsWith('street') || kind === 'campus' ? 2 : 0.6);
      car.userData.drive = new THREE.Vector3(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y)).multiplyScalar(speed);
      cast.add(car);
    }
    const lead = people[0] || null;
    const shots = stage.shots.map((s) => ({ p: toWorld(s.p), t: s.t === 'lead' ? 'lead' : toWorld(s.t) }));
    acts.push({ act, kind, stage, setKey: stage.set, cast, people, car, lead, shots, carStart: car ? car.position.clone() : null });
  }

  const state = { playing: false, act: 0, elapsed: 0, raf: 0, last: null, done: false, holding: false };
  const duration = (a) => a.duration || 9;
  const leadFocus = new THREE.Vector3();
  const focusOf = (rec, s) => {
    if (s.t !== 'lead') return s.t;
    if (!rec.lead) return rec.shots[0].t.isVector3 ? rec.shots[0].t : leadFocus.set(0, 2, 0);
    return leadFocus.copy(rec.lead.root.position).add(new THREE.Vector3(0, 1.15, 0));
  };

  let lastW = 0, lastH = 0, resizeRaf = 0;
  function resize() {
    const w = canvas.clientWidth || 960, h = canvas.clientHeight || 540;
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Portrait phones get a wider vertical FOV so the horizontal view isn't pinched.
    camera.fov = camera.aspect >= 1.2 ? 43 : THREE.MathUtils.lerp(70, 43, THREE.MathUtils.clamp((camera.aspect - 0.45) / 0.75, 0, 1));
    camera.updateProjectionMatrix();
    renderOnce();
  }

  function activate(i) {
    state.act = i; state.elapsed = 0; state.holding = false;
    const cur = acts[i];
    acts.forEach((a, j) => { a.cast.visible = j === i; });
    sets.forEach((rec, key) => { rec.group.visible = key === cur.setKey; });
    const set = sets.get(cur.setKey);
    rig.visible = !set.interior;
    const tod = TOD[cur.act.tod] || TOD.day;
    hemi.intensity = tod[2]; sun.color.set(tod[3]); sun.intensity = tod[4]; fill.intensity = tod[5];
    scene.background = set.background || color(cur.act.tod && cur.act.tod !== 'day' ? tod[0] : (cur.stage.sky || tod[0]));
    scene.fog = set.fog || new THREE.Fog(scene.background, set.interior ? 60 : (cur.setKey === 'city' ? 220 : 150), set.interior ? 200 : (cur.setKey === 'city' ? 1100 : 520));
    moveCamera(cur);
    config.onAct?.(cur.act, i);
    renderOnce();
  }

  function updatePeople(rec, dt, now) {
    rec.people.forEach((c) => {
      const root = c.root, r = root.userData.rig, u = root.userData, t = now * 0.001 + u.phase;
      if (u.walking) {
        // Walk forward, turn back when the leash to the starting spot gets long.
        const away = root.position.distanceTo(u.home);
        if (away > 3.2 && !u.turning) { u.turning = true; u.turnTo = root.rotation.y + Math.PI; }
        if (u.turning) {
          root.rotation.y += Math.min(Math.abs(u.turnTo - root.rotation.y), dt * 1.6) * Math.sign(u.turnTo - root.rotation.y);
          if (Math.abs(u.turnTo - root.rotation.y) < 0.03) u.turning = false;
        }
        root.position.x += Math.sin(root.rotation.y) * dt * 0.85;
        root.position.z += Math.cos(root.rotation.y) * dt * 0.85;
        const swing = Math.sin(t * 5.2) * 0.45;
        // Limbs are {shoulder, elbow, ...} / {hip, knee, ...} joint sets in the faceted rig.
        if (r.armL?.shoulder) r.armL.shoulder.rotation.x = swing;
        if (r.armR?.shoulder) r.armR.shoulder.rotation.x = -swing;
        if (r.legL?.hip) r.legL.hip.rotation.x = -swing * 0.9;
        if (r.legR?.hip) r.legR.hip.rotation.x = swing * 0.9;
      } else if (r?.head?.rotation) {
        r.head.rotation.y = Math.sin(t * 0.6) * 0.18;
        r.head.rotation.x = Math.sin(t * 0.43) * 0.04;
      }
    });
  }

  function moveCamera(rec) {
    const p = Math.min(1, state.elapsed / duration(rec.act));
    const scaled = p * 3, index = Math.max(0, Math.min(2, Math.floor(scaled))), local = smooth(Math.min(1, scaled - index));
    const from = rec.shots[index], to = rec.shots[index + 1];
    camera.position.lerpVectors(from.p, to.p, local);
    const target = focusOf(rec, from).clone().lerp(focusOf(rec, to), local);
    camera.position.x += Math.sin(state.elapsed * 0.48) * (0.14 + (1 - p) * 0.18);
    camera.position.y += Math.sin(state.elapsed * 0.31) * 0.06;
    camera.lookAt(target);
  }

  function renderOnce() { if (acts[state.act]) renderer.render(scene, camera); }

  function tick(now) {
    if (!state.playing) return;
    const dt = state.last == null ? 0 : Math.min(0.05, Math.max(0, (now - state.last) / 1000));
    state.last = now; state.elapsed += dt;
    const rec = acts[state.act];
    updatePeople(rec, dt, now);
    moveCamera(rec);
    if (rec.car) rec.car.position.addScaledVector(rec.car.userData.drive, dt);
    renderer.render(scene, camera);
    config.onTick?.(state);
    if (state.elapsed >= duration(rec.act)) {
      // Let the narration finish (up to a cap) before cutting to the next scene.
      const cap = duration(rec.act) + (rec.act.maxHold ?? 10);
      state.holding = !!config.holdAct?.(state.act) && state.elapsed < cap;
      if (!state.holding) {
        if (state.act < acts.length - 1) activate(state.act + 1);
        else { state.playing = false; state.done = true; config.onEnd?.(); return; }
      }
    }
    state.raf = requestAnimationFrame(tick);
  }

  function play() { if (state.done) { restart(); return; } if (state.playing) return; state.playing = true; state.last = null; state.raf = requestAnimationFrame(tick); }
  function pause() { state.playing = false; cancelAnimationFrame(state.raf); }
  function restart() {
    pause(); state.done = false;
    acts.forEach((a) => { a.people.forEach((c) => c.root.position.copy(c.root.userData.home)); if (a.car) a.car.position.copy(a.carStart); });
    activate(0); play();
  }
  function seek(i) { const wasPlaying = state.playing; pause(); state.done = false; activate(Math.max(0, Math.min(acts.length - 1, i))); if (wasPlaying) play(); }
  /* Jump to an exact moment of an act without playing (used by QA captures and thumbnails). */
  function scrub(i, p) {
    pause(); state.done = false;
    if (state.act !== i || state.elapsed === 0) activate(i);
    state.elapsed = Math.max(0, Math.min(1, p)) * duration(acts[i].act);
    moveCamera(acts[i]); renderOnce();
  }
  function skip() { if (state.act < acts.length - 1) seek(state.act + 1); else { pause(); state.done = true; config.onEnd?.(); } }

  // Defer to the next frame so the observer callback never changes layout in the same pass.
  const observer = new ResizeObserver(() => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => { resizeRaf = 0; resize(); });
  });
  observer.observe(canvas);
  activate(0);
  resize();
  config.onProgress?.(1, 'Ready');

  return {
    play, pause, restart, skip, seek, scrub, renderOnce,
    get state() { return state; },
    get acts() { return acts; },
    get sets() { return sets; },
    camera, scene, renderer,
    destroy() {
      pause(); observer.disconnect(); cancelAnimationFrame(resizeRaf);
      sets.forEach((rec) => { try { rec.built?.dispose?.(); } catch (e) { /* interior already disposed */ } });
      disposeObject(scene);
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch (e) { /* ignore */ }
    },
  };
}
