/* scrappy3d.js -- "Scrappy Car" as a proper vehicle model.
   Exports buildScrappy3D(bodyColor, rimColor) matching the other
   vehicles so drive.js / travel.js / showroom.js can all use it.
   Geometry is the same as the standalone HTML reference, but the
   idle-vibration / door-rattle / smoke systems stay OUT of this file
   — the drive scene already handles animation. */
import * as THREE from "three";

const RND = (a, b) => a + Math.random() * (b - a);

function makeCanvasTexture(size, draw, rx = 1, ry = 1) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 1;
  return t;
}

function rustPaint(base, blobs) {
  return makeCanvasTexture(128, (g, s) => {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    const img = g.getImageData(0, 0, s, s), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 26;
      d[i]     = Math.max(0, Math.min(255, d[i]     + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < blobs; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = RND(2, 14);
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0,    `rgba(${RND(120,185)|0},${RND(55,95)|0},${RND(15,45)|0},${RND(0.35,0.8)})`);
      grd.addColorStop(0.55, `rgba(105,52,22,${RND(0.15,0.35)})`);
      grd.addColorStop(1,    "rgba(85,42,18,0)");
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    }
    g.lineWidth = 1;
    for (let i = 0; i < 30; i++) {
      g.strokeStyle = `rgba(215,215,205,${RND(0.04,0.16)})`;
      const x = Math.random() * s, y = Math.random() * s;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + RND(-26, 26), y + RND(-26, 26));
      g.stroke();
    }
  });
}

function taperTop(geo, sx, sz) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) {
      p.setX(i, p.getX(i) * sx);
      p.setZ(i, p.getZ(i) * sz);
    }
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/* Module-level texture cache. The reference baked these on every page
   load which is fine for a static viewer; here the drive scene builds
   a fresh scrappy every time the player reloads, so we cache once and
   share the GPU texture between body / door / hood / wheels. */
let _cache = null;
function getMats(bodyColor, rimColor) {
  if (_cache) return _cache;

  const texBody = rustPaint(bodyColor || "#4d6b74", 95); texBody.repeat.set(2.4, 1.4);
  const texDoor = rustPaint("#7d3a2e", 85);              texDoor.repeat.set(1.2, 1.2);
  const texHood = rustPaint("#6e6f68", 70);              texHood.repeat.set(1.5, 1);

  const texWheelFace = makeCanvasTexture(128, (g, s) => {
    const c = s / 2;
    g.fillStyle = "#1a1b1d"; g.fillRect(0, 0, s, s);
    const rimR = s * 0.31;
    const grd = g.createRadialGradient(c, c, 0, c, c, rimR);
    grd.addColorStop(0,    "#8b8f93");
    grd.addColorStop(0.65, "#6d7175");
    grd.addColorStop(1,    "#33363a");
    g.fillStyle = grd;
    g.beginPath(); g.arc(c, c, rimR, 0, 6.2832); g.fill();
    g.strokeStyle = "#121316"; g.lineWidth = s * 0.045; g.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5 - 0.4;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * rimR * 0.26, c + Math.sin(a) * rimR * 0.26);
      g.lineTo(c + Math.cos(a) * rimR * 0.96, c + Math.sin(a) * rimR * 0.96);
      g.stroke();
    }
    g.fillStyle = "#5a5e62"; g.beginPath(); g.arc(c, c, s * 0.075, 0, 6.2832); g.fill();
    g.fillStyle = "#7a4327"; g.beginPath(); g.arc(c, c, s * 0.045, 0, 6.2832); g.fill();
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.2832, r = RND(rimR * 0.4, rimR);
      g.fillStyle = `rgba(122,67,39,${RND(0.15, 0.5)})`;
      g.beginPath(); g.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, RND(1.5, 4.5), 0, 6.2832); g.fill();
    }
    g.strokeStyle = "#17181a"; g.lineWidth = s * 0.07;
    g.beginPath(); g.arc(c, c, s * 0.47, 0, 6.2832); g.stroke();
  });

  _cache = {
    M: {
      body:   new THREE.MeshPhongMaterial({ map: texBody, shininess: 22, specular: 0x2a2a2a }),
      door:   new THREE.MeshPhongMaterial({ map: texDoor, shininess: 22, specular: 0x2a2a2a }),
      hood:   new THREE.MeshPhongMaterial({ map: texHood, shininess: 16, specular: 0x222222 }),
      tyre:   new THREE.MeshLambertMaterial({ color: 0x1a1b1d }),
      dark:   new THREE.MeshLambertMaterial({ color: 0x23252a }),
      rust:   new THREE.MeshLambertMaterial({ color: 0x7a4327 }),
      chrome: new THREE.MeshPhongMaterial({ color: 0x8d9298, shininess: 90, specular: 0x666666 }),
      glass:  new THREE.MeshPhongMaterial({
                color: 0x14202a, shininess: 140, specular: 0xaaccdd,
                transparent: true, opacity: 0.78, depthWrite: false,
              }),
      head:   new THREE.MeshPhongMaterial({ color: 0xfff3c4, emissive: 0xffe08a, emissiveIntensity: 0.85, shininess: 110 }),
      tail:   new THREE.MeshPhongMaterial({ color: 0x6b0f0f, emissive: 0xff2200, emissiveIntensity: 0.6 }),
      wheelFace: new THREE.MeshPhongMaterial({ map: texWheelFace, shininess: 55 }),
    },
  };
  return _cache;
}

export function buildScrappy3D(bodyColor, rimColor) {
  const { M } = getMats(bodyColor, rimColor);
  const car = new THREE.Group();

  function addBox(parent, w, h, d, x, y, z, mat, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  }

  /* Main shell */
  addBox(car, 1.78, 0.52, 3.86, 0, 0.70, 0, M.body);
  const hood = addBox(car, 1.66, 0.10, 1.20, 0, 1.00, 1.32, M.hood);
  hood.rotation.x = -0.035;
  addBox(car, 1.68, 0.10, 0.90, 0, 0.99, -1.55, M.body);

  /* Greenhouse */
  const cabinGeo = taperTop(new THREE.BoxGeometry(1.62, 0.66, 2.05), 0.86, 0.82);
  const cabin = new THREE.Mesh(cabinGeo, M.glass);
  cabin.position.set(0, 1.30, -0.18);
  car.add(cabin);

  /* Roof */
  addBox(car, 1.40, 0.10, 1.62, 0, 1.62, -0.20, M.body);

  /* Pillars */
  for (const sx of [-1, 1]) {
    const a = addBox(car, 0.07, 0.74, 0.09, sx * 0.66, 1.30, 0.78, M.body);
    a.rotation.x = 0.22;
    addBox(car, 0.09, 0.70, 0.13, sx * 0.66, 1.28, -1.12, M.body);
    addBox(car, 0.06, 0.68, 0.07, sx * 0.70, 1.28, -0.10, M.body);
  }

  /* Door seams + handles */
  for (const sx of [-1, 1]) {
    for (const z of [0.55, -0.35, -1.22]) {
      addBox(car, 0.022, 0.50, 0.022, sx * 0.894, 0.70, z, M.dark);
    }
    addBox(car, 0.035, 0.05, 0.18, sx * 0.905, 0.855, -0.02, M.chrome);
    addBox(car, 0.035, 0.05, 0.18, sx * 0.905, 0.855, -0.88, M.chrome);
  }

  /* Rattled replacement door (right front) */
  const doorPivot = new THREE.Group();
  doorPivot.position.set(0.895, 0.72, 0.55);
  car.add(doorPivot);
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.52, 0.90), M.door);
  doorPanel.position.set(0, 0, -0.45);
  doorPivot.add(doorPanel);
  const doorHandle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.17), M.chrome);
  doorHandle.position.set(0.035, 0.14, -0.72);
  doorPivot.add(doorHandle);
  const doorMirrorStalk = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.04, 0.04), M.dark);
  doorMirrorStalk.position.set(0.06, 0.34, -0.14);
  doorPivot.add(doorMirrorStalk);
  const doorMirror = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.15), M.chrome);
  doorMirror.position.set(0.13, 0.36, -0.16);
  doorPivot.add(doorMirror);
  car.userData.doorPivot = doorPivot;

  /* Front end */
  addBox(car, 1.10, 0.26, 0.06, 0, 0.74, 1.95, M.dark);
  for (let i = 0; i < 3; i++)
    addBox(car, 1.00, 0.025, 0.05, 0, 0.66 + i * 0.08, 1.97, M.chrome);
  addBox(car, 0.34, 0.20, 0.08, -0.60, 0.87, 1.95, M.head);
  addBox(car, 0.34, 0.20, 0.08,  0.60, 0.87, 1.95, M.head);
  const bumperF = addBox(car, 1.88, 0.22, 0.22, 0, 0.50, 1.96, M.chrome);
  bumperF.rotation.z = 0.035;
  addBox(car, 1.86, 0.22, 0.20, 0, 0.50, -1.96, M.chrome, -0.045, 0, 0);

  /* Rear end */
  addBox(car, 0.30, 0.18, 0.07, -0.62, 0.88, -1.95, M.tail);
  addBox(car, 0.30, 0.18, 0.07,  0.62, 0.88, -1.95, M.tail);

  /* Exhaust */
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.30, 8), M.rust);
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(0.62, 0.30, -1.98);
  car.add(exhaust);

  /* Antenna */
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, 0.70, 4), M.dark);
  antenna.position.set(-0.58, 1.95, 0.30);
  antenna.rotation.x = -0.32;
  car.add(antenna);

  /* ---- Wheels (drive.js compatible: pivot/spin/steer) ---- */
  function makeWheelMesh() {
    const geo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14, 1);
    const m = new THREE.Mesh(geo, [M.tyre, M.wheelFace, M.wheelFace]);
    m.rotation.z = Math.PI / 2;
    return m;
  }
  const wheels = [];
  function addWheel(x, z, shaky) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.36, z);
    const spin = new THREE.Group();
    spin.rotation.x = Math.random() * 6.2832;
    spin.add(makeWheelMesh());
    pivot.add(spin);
    car.add(pivot);

    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(0.43, 0.045, 4, 12, Math.PI),
      M.rust
    );
    arch.rotation.y = Math.PI / 2;
    arch.position.set(x + Math.sign(x) * 0.005, 0.36, z);
    car.add(arch);

    wheels.push({
      pivot, spin, steer: z > 0,
      shaky,
      /* drive.js expects spinZ for Z-axis axles. Our wheels are already
         rotated so the cylinder axle lies along X — spinZ stays false. */
      spinZ: false,
    });
  }
  addWheel(-0.79,  1.25, true);
  addWheel( 0.79,  1.25, false);
  addWheel(-0.79, -1.25, false);
  addWheel( 0.79, -1.25, false);
  car.userData.wheels = wheels;

  return car;
}
