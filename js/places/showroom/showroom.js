/* showroom.js -- Auto Hub. Bright showroom with six cars.
   v23: background and floor lightened, ambient + hemisphere +
   directional + 3 overhead spots added so nothing renders black. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { State } from "../../core/state.js";
import { buildVehicle } from "../../vehicles/models.js";

const CARS = [
  { id: "gwagon",     name: "G-WAGON",        tag: "AMG · 4.0L V8",     price: 48000000, pos: [-8, 0, -4], color: 0xd8c8a8 },
  { id: "mercedes",   name: "MERCEDES S-CLASS", tag: "S 580 · 4MATIC",  price: 62000000, pos: [ 0, 0, -4], color: 0xa8b0c0 },
  { id: "cybertruck", name: "CYBERTRUCK",     tag: "TRI-MOTOR AWD",     price: 55000000, pos: [ 8, 0, -4], color: 0xc8cdd2 },
  { id: "hilux",      name: "TOYOTA HILUX",   tag: "2.8 GD-6",          price: 32000000, pos: [-8, 0,  5], color: 0xc0392b },
  { id: "rangerover", name: "RANGE ROVER",    tag: "AUTOBIOGRAPHY",     price: 71000000, pos: [ 0, 0,  5], color: 0xf2f4f7 },
  { id: "bmw",        name: "BMW M4",         tag: "COMPETITION",       price: 58000000, pos: [ 8, 0,  5], color: 0x1f3a93 },
];

export async function showroomScene(params, router) {
  const three = new THREE.Scene();
  three.background = new THREE.Color(0xc8d4e0);
  three.fog = new THREE.Fog(0xc8d4e0, 60, 200);

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 500);
  camera.position.set(0, 16, 24);

  const controls = new OrbitControls(camera, router.renderer.domElement);
  controls.target.set(0, 1, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 10;
  controls.maxDistance = 60;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.4;

  /* ---- bright lighting ---- */
  three.add(new THREE.AmbientLight(0xffffff, 1.2));
  three.add(new THREE.HemisphereLight(0xffffff, 0x808890, 2.0));

  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(20, 40, 20);
  three.add(sun);

  const fill = new THREE.DirectionalLight(0xffffff, 1.2);
  fill.position.set(-20, 20, -20);
  three.add(fill);

  /* ---- floor ---- */
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(20, 20, 0.3, 48),
    new THREE.MeshLambertMaterial({ color: 0x9aa2ab })
  );
  floor.position.y = -0.15;
  three.add(floor);

  /* ---- overhead spots ---- */
  for (const x of [-8, 0, 8]) {
    const sp = new THREE.SpotLight(0xffffff, 3.0, 30, Math.PI / 4, 0.5, 1.0);
    sp.position.set(x, 14, 0);
    sp.target.position.set(x, 0, 0);
    three.add(sp);
    three.add(sp.target);
  }

  /* ---- cars ---- */
  for (const car of CARS) {
    const p = car.pos;

    /* pulsing base disc */
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.3, 0.18, 32),
      new THREE.MeshLambertMaterial({ color: 0xb0b8c0 })
    );
    base.position.set(p[0], 0.09, p[2]);
    three.add(base);

    let mesh;
    try {
      mesh = buildVehicle(car.id, car.color, "#c9ced6");
    } catch (e) {
      console.error("[showroom] cannot build", car.id, e);
      continue;
    }
    mesh.position.set(p[0], 0.18, p[2]);
    mesh.rotation.y = 0.35;
    three.add(mesh);

    mesh.userData.tap = function () {
      router.ui.showShop({
        id: car.id, name: car.name, tag: car.tag, price: car.price,
        onColor: function () {},
      }, function () {
        router.ui.showCard(car.name, "SELECTED");
        setTimeout(function () { router.ui.hideCard(); }, 1800);
      });
    };

    /* nameplate label */
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(8,16,28,.9)";
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = "#5ee0ff";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 508, 124);
    ctx.fillStyle = "#5ee0ff";
    ctx.font = "bold 40px Inter,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(car.name, 256, 50);
    ctx.fillStyle = "#ffcc5e";
    ctx.font = "bold 26px Inter,sans-serif";
    ctx.fillText("\u20A6" + car.price.toLocaleString(), 256, 96);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthTest: false, depthWrite: false,
    }));
    spr.renderOrder = 999;
    spr.scale.set(4.5, 1.1, 1);
    spr.position.set(p[0], 4.2, p[2]);
    three.add(spr);
  }

  return {
    three: three,
    camera: camera,
    controls: controls,
    crumb: "AUTO HUB",
    title: "CAR SHOWROOM",
    subtitle: "TAP A CAR TO CUSTOMIZE",
    hint: "TAP A CAR TO CUSTOMIZE",
    update: function () { controls.update(); },
  };
}

