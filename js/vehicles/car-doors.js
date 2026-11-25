/* car-doors.js — hinged door meshes + open/close animation for every car.
   Call addCarDoors(carMesh, { size, bodyColor }) after the vehicle is built.
   Drive scene drives the open amount via updateDoors(car, dt). */
import * as THREE from "three";

const OPEN_ANGLE = 1.15; // ~66°

function pickBodyColor(car) {
  let col = new THREE.Color("#2a2e35");
  car.traverse(n => {
    if (!n.isMesh || !n.material) return;
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    if (m && m.color && m.metalness > 0.3 && m.roughness < 0.55) {
      col = m.color.clone();
    }
  });
  return col;
}

/**
 * Add left + right front door pivots to a car group.
 * Doors are thin painted panels with a glass strip so they read clearly when open.
 */
export function addCarDoors(car, opts = {}) {
  if (!car || car.userData.doors) return car.userData.doors;

  const size = opts.size || new THREE.Vector3(1.8, 1.5, 4.2);
  const halfW = Math.max(0.55, size.x * 0.48);
  const doorH = Math.max(0.55, size.y * 0.42);
  const doorL = Math.max(0.7, size.z * 0.28);
  const hingeY = Math.max(0.55, size.y * 0.38);
  /* hinge just behind the front wheel line */
  const hingeZ = -size.z * 0.12;

  const bodyCol = opts.bodyColor ? new THREE.Color(opts.bodyColor) : pickBodyColor(car);
  const paint = new THREE.MeshStandardMaterial({
    color: bodyCol, metalness: 0.65, roughness: 0.32, side: THREE.DoubleSide,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x1a2330, metalness: 0.9, roughness: 0.12,
    transparent: true, opacity: 0.45, side: THREE.DoubleSide,
  });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.95, roughness: 0.18 });

  function makeDoor(side) {
    /* side: -1 left, +1 right. Pivot at the front edge of the door. */
    const pivot = new THREE.Group();
    pivot.name = side < 0 ? "doorL" : "doorR";
    pivot.position.set(side * halfW, hingeY, hingeZ);

    const panel = new THREE.Group();
    /* door body extends backward from hinge (local +Z is rear in most of our cars?
       Looking at gwagon: wheels z=-1.45 front, z=1.45 rear — so +Z is rear.
       Door should extend toward rear = +Z from hinge. */
    const skin = new THREE.Mesh(new THREE.BoxGeometry(0.06, doorH, doorL), paint);
    skin.position.set(side * 0.03, 0, doorL * 0.5);
    skin.castShadow = true;
    panel.add(skin);

    const win = new THREE.Mesh(new THREE.BoxGeometry(0.04, doorH * 0.38, doorL * 0.7), glass);
    win.position.set(side * 0.04, doorH * 0.22, doorL * 0.48);
    panel.add(win);

    /* handle */
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.14), chrome);
    handle.position.set(side * 0.07, 0, doorL * 0.72);
    panel.add(handle);

    pivot.add(panel);
    pivot.userData.panel = panel;
    pivot.userData.side = side;
    pivot.userData.open = 0;       /* 0 closed … 1 fully open */
    pivot.userData.target = 0;
    car.add(pivot);
    return pivot;
  }

  const left = makeDoor(-1);
  const right = makeDoor(1);
  const doors = { left, right, openAngle: OPEN_ANGLE };
  car.userData.doors = doors;
  return doors;
}

/** Set desired open amount for a side: "left" | "right" | "both". amount 0..1 */
export function setDoorTarget(car, side, amount) {
  const d = car && car.userData && car.userData.doors;
  if (!d) return;
  const a = Math.max(0, Math.min(1, amount));
  if (side === "left" || side === "both") d.left.userData.target = a;
  if (side === "right" || side === "both") d.right.userData.target = a;
}

/** Animate doors toward their targets. Call every frame. */
export function updateDoors(car, dt) {
  const d = car && car.userData && car.userData.doors;
  if (!d) return;
  const speed = 3.2; /* open/close rate */
  for (const key of ["left", "right"]) {
    const pivot = d[key];
    const u = pivot.userData;
    if (Math.abs(u.open - u.target) < 0.001) {
      u.open = u.target;
    } else {
      u.open += Math.sign(u.target - u.open) * Math.min(Math.abs(u.target - u.open), speed * dt);
    }
    /* open outward: left door rotates +Y, right door rotates -Y */
    const ang = u.open * d.openAngle * (u.side < 0 ? 1 : -1);
    pivot.rotation.y = ang;
  }
}

/** World-space point just outside the driver (left) door for enter/exit. */
export function doorStandPoint(carRoot, carMesh, heading, carPos, carSize, side = "left") {
  const cH = Math.cos(heading), sH = Math.sin(heading);
  const lx = (side === "left" ? -1 : 1) * (carSize.x * 0.5 + 0.85);
  const lz = -carSize.z * 0.05;
  return {
    x: carPos.x + lx * cH + lz * sH,
    z: carPos.z - lx * sH + lz * cH,
  };
}
