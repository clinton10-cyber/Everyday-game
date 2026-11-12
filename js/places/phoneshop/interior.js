/* phoneshop/interior.js -- walkable Phone Shop in third person. Room contents live in rooms/*.
   Registers the cashier as a robbery target (see core/robbery.js). */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import { Robbery } from "../../core/robbery.js";
import meta from "./meta.js";
import { ROOMS } from "./rooms/_index.js";

export async function buildInterior(router) {
  const HX = 8, HZ = 6.5, H = 3.6;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe6ee);
  scene.fog = new THREE.Fog(0xdfe6ee, 22, 52);
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 70);
  camera.rotation.order = "YXZ";

  scene.add(new THREE.HemisphereLight(0xffffff, 0xaab4c4, 1.1));
  const sun = new THREE.DirectionalLight(0xfff4e0, 0.5); sun.position.set(6, 12, 8); scene.add(sun);

  const mats = new Map();
  const mat = (c) => { let m = mats.get(c); if (!m) { m = new THREE.MeshLambertMaterial({ color: c }); mats.set(c, m); } return m; };
  const box = (w, h, d, x, y, z, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); scene.add(m); return m; };

  /* floor, ceiling, walls (south wall leaves a door gap) */
  box(HX * 2, 0.1, HZ * 2, 0, -0.05, 0, 0xc9ced6);
  box(HX * 2, 0.1, HZ * 2, 0, H, 0, 0xf3f5f8);
  box(HX * 2, H, 0.2, 0, H / 2, -HZ, 0xeef1f5);
  box(0.2, H, HZ * 2, -HX, H / 2, 0, 0xeef1f5);
  box(0.2, H, HZ * 2, HX, H / 2, 0, 0xeef1f5);
  box(HX - 1.7, H, 0.2, -(HX + 1.7) / 2, H / 2, HZ, 0xeef1f5);
  box(HX - 1.7, H, 0.2, (HX + 1.7) / 2, H / 2, HZ, 0xeef1f5);
  box(3.4, 0.6, 0.2, 0, H - 0.3, HZ, 0x2f9bff);
  box(HX * 2 - 1, 0.18, 0.06, 0, H - 0.4, -HZ + 0.15, 0x2f9bff);

  const colliders = [], uses = [];
  const W = 3;
  colliders.push({ minX: -HX - W, maxX: HX + W, minZ: -HZ - W, maxZ: -HZ, y0: 0, y1: 60, level: 0 });
  colliders.push({ minX: -HX - W, maxX: -HX, minZ: -HZ - W, maxZ: HZ + W, y0: 0, y1: 60, level: 0 });
  colliders.push({ minX: HX, maxX: HX + W, minZ: -HZ - W, maxZ: HZ + W, y0: 0, y1: 60, level: 0 });
  colliders.push({ minX: -HX - W, maxX: -1.7, minZ: HZ, maxZ: HZ + W, y0: 0, y1: 60, level: 0 });
  colliders.push({ minX: 1.7, maxX: HX + W, minZ: HZ, maxZ: HZ + W, y0: 0, y1: 60, level: 0 });

  const room = ROOMS.showroom({ THREE, scene, colliders, uses, HX, HZ });
  Robbery.registerTarget({ id: "phoneshop:cashier", kind: "cashier", scene: "phoneshop", x: 0, z: -1.9, r: 2.6, label: "ROB CASHIER" });

  const world = {
    colliders, seats: [], uses, stairs: [], platforms: [], levelHeight: () => 0,
    bounds: { minX: -HX + 0.3, maxX: HX - 0.3, minZ: -HZ + 0.3, maxZ: HZ - 0.3 },
  };
  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, world, {
    scene, x: 0, z: HZ - 1.4, yaw: Math.PI, level: 0,
    onUse: (use) => {
      if (use && use.kind === "phoneshop") room.open(use.tab);
      else if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE");
    },
  });

  return {
    three: scene, camera,
    controls: { update: () => {} },
    crumb: meta.name, title: "PHONE SHOP", subtitle: "",
    hint: "", isInterior: true, sceneId: "phoneshop",
    update: (dt) => { ctl.update(dt); },
    dispose: () => { Robbery.clearTargets("phoneshop"); room.dispose(); ctl.dispose(); },
  };
}
