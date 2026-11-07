import * as THREE from "three";
import { Weapons, WEAPONS } from "../core/weapons.js";
import { Wave } from "../core/wave.js";
import { Combat } from "../core/combat.js";
import { Multiplayer } from "../core/multiplayer.js";
import { makeFPWalker } from "../places/_fpwalker.js";
import { Quality } from "../core/quality.js";

export async function shootingRangeScene(params, router) {
  console.log("[range] start");

  const three = new THREE.Scene();
  three.background = new THREE.Color(0x8fa8c0);
  three.fog = new THREE.Fog(0x8fa8c0, 60, 220);

  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 400);

  three.add(new THREE.AmbientLight(0xffffff, 0.6));
  three.add(new THREE.HemisphereLight(0xdceaff, 0x706858, 0.9));
  const sun = new THREE.DirectionalLight(0xfff0d2, 0.85);
  sun.position.set(30, 60, 30);
  sun.castShadow = Quality.current.shadows;
  three.add(sun);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(80, 40),
    new THREE.MeshLambertMaterial({ color: 0x8a7a58 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = Quality.current.shadows;
  three.add(floor);

  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const w = new THREE.Mesh(
      new THREE.BoxGeometry(5, 4, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x6a6052 }));
    w.position.set(Math.cos(a) * 78, 2, Math.sin(a) * 78);
    w.rotation.y = -a;
    w.castShadow = true;
    three.add(w);
  }

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.3;
    const r = 18 + (i % 3) * 4;
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(3, 1.4, 3),
      new THREE.MeshLambertMaterial({ color: 0x7a6a52 }));
    b.position.set(Math.cos(a) * r, 0.7, Math.sin(a) * r);
    b.rotation.y = a;
    b.castShadow = true;
    three.add(b);
  }

  /* Walker -- clamp to circle. Speed bumped from 4.0/7.5 to 5.5/10.0
     so the shooting range feels consistent with the faster baseline
     speed now used across all interiors. */
  const walker = makeFPWalker(camera, router.renderer.domElement, (x, z) => {
    return x * x + z * z < 72 * 72;
  }, { startX: 0, startZ: 0, startYaw: 0, eye: 1.65, speed: 5.5, run: 10.0 });

  const hud = document.createElement("div");
  hud.id = "ph3d-range-hud";
  hud.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:26;" +
    "font-family:Inter,system-ui,sans-serif;color:#fff";
  hud.innerHTML =
    '<div style="position:absolute;left:50%;top:50%;' +
    'width:22px;height:22px;transform:translate(-50%,-50%)">' +
    '<div style="position:absolute;left:50%;top:0;width:2px;height:8px;margin-left:-1px;background:#fff;box-shadow:0 0 4px #000"></div>' +
    '<div style="position:absolute;left:50%;bottom:0;width:2px;height:8px;margin-left:-1px;background:#fff;box-shadow:0 0 4px #000"></div>' +
    '<div style="position:absolute;top:50%;left:0;height:2px;width:8px;margin-top:-1px;background:#fff;box-shadow:0 0 4px #000"></div>' +
    '<div style="position:absolute;top:50%;right:0;height:2px;width:8px;margin-top:-1px;background:#fff;box-shadow:0 0 4px #000"></div>' +
    '</div>' +
    '<div id="ph3d-hp" style="position:absolute;left:14px;' +
    'top:calc(env(safe-area-inset-top) + 14px);padding:8px 14px;border-radius:14px;' +
    'background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.2);' +
    'font-size:12px;font-weight:800;letter-spacing:.5px">HP ' +
    '<span id="ph3d-hp-num">100</span></div>' +
    '<div id="ph3d-gun-hud" style="position:absolute;right:14px;' +
    'bottom:calc(env(safe-area-inset-bottom) + 130px);padding:10px 16px;' +
    'border-radius:14px;background:rgba(0,0,0,.55);' +
    'border:1px solid rgba(255,255,255,.2);text-align:right">' +
    '<div id="ph3d-gun-name" style="font-size:11px;letter-spacing:.18em;opacity:.75">PISTOL</div>' +
    '<div id="ph3d-gun-ammo" style="font-size:22px;font-weight:900">12 / 48</div>' +
    '</div>' +
    '<div id="ph3d-wave" style="position:absolute;left:50%;' +
    'top:calc(env(safe-area-inset-top) + 18px);transform:translateX(-50%);' +
    'padding:8px 18px;border-radius:999px;background:rgba(0,0,0,.6);' +
    'border:1px solid rgba(255,80,80,.55);font-size:11px;font-weight:800;' +
    'letter-spacing:.22em;color:#ff9999">WAVE 0</div>';
  document.body.appendChild(hud);

  const elHp   = hud.querySelector("#ph3d-hp-num");
  const elGun  = hud.querySelector("#ph3d-gun-name");
  const elAmmo = hud.querySelector("#ph3d-gun-ammo");
  const elWave = hud.querySelector("#ph3d-wave");

  const mk = (id, txt, css) => {
    const b = document.createElement("button");
    b.id = id; b.textContent = txt; b.style.cssText = css;
    document.body.appendChild(b); return b;
  };
  const fireBtn = mk("ph3d-fire", "FIRE",
    "position:fixed;right:16px;bottom:calc(env(safe-area-inset-bottom) + 22px);" +
    "z-index:27;width:92px;height:92px;border-radius:50%;" +
    "background:rgba(220,40,40,.9);border:2px solid #ff8080;color:#fff;" +
    "font:900 14px Inter,system-ui,sans-serif;touch-action:none;pointer-events:auto");
  const reloadBtn = mk("ph3d-reload", "RELOAD",
    "position:fixed;right:114px;bottom:calc(env(safe-area-inset-bottom) + 32px);" +
    "z-index:27;width:72px;height:72px;border-radius:50%;" +
    "background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.4);" +
    "color:#fff;font:800 10px Inter,system-ui,sans-serif;touch-action:none;pointer-events:auto");
  const exitBtn = mk("ph3d-range-exit", "\u25C0 EXIT",
    "position:fixed;right:14px;top:calc(env(safe-area-inset-top) + 116px);" +
    "z-index:27;padding:10px 16px;border-radius:22px;" +
    "background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.4);" +
    "color:#fff;font:800 11px Inter,system-ui,sans-serif;letter-spacing:.14em;" +
    "pointer-events:auto;cursor:pointer");

  const mflash = new THREE.PointLight(0xffddaa, 0, 6, 2);
  three.add(mflash);
  let firing = false, fireCd = 0;

  function doFire() {
    if (fireCd > 0) return;
    const w = WEAPONS[Weapons.current];
    fireCd = 60000 / w.rpm;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    Weapons.fire(camera.position.clone(), dir, three,
      Wave.bots.filter(b => b.alive).map(b => ({
        id: b.id, kind: "bot", x: b.x, y: 1.0, z: b.z,
      })));
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    mflash.position.copy(camera.position).addScaledVector(fwd, 1.5);
    mflash.intensity = 8;
    setTimeout(() => { mflash.intensity = 0; }, 50);
  }

  fireBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); firing = true; doFire(); }, { passive: false });
  fireBtn.addEventListener("pointerup",   (e) => { e.preventDefault(); firing = false; }, { passive: false });
  fireBtn.addEventListener("pointercancel", (e) => { firing = false; });
  reloadBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); Weapons.reload(); }, { passive: false });
  exitBtn.addEventListener("pointerdown",   (e) => { e.preventDefault(); router.go("city"); }, { passive: false });

  function updateGunHUD() {
    const w = WEAPONS[Weapons.current];
    elGun.textContent = w.name;
    const mag = Weapons.mags[Weapons.current] || 0;
    const res = Weapons.ammo[Weapons.current] || 0;
    elAmmo.innerHTML = mag + '<span style="font-size:14px;opacity:.55"> / ' + res + "</span>";
  }
  Weapons.onAmmoChange = updateGunHUD;
  updateGunHUD();

  Wave.start(three);
  Wave.onWave = (n) => { elWave.textContent = "WAVE " + n; };
  Wave.onBotShoot = (bot, dist) => {
    const acc = Math.max(0.05, 1 - dist / 22);
    if (Math.random() < acc) { Combat.damage(6, "bot"); Combat.flash && Combat.flash(0.35); }
  };
  window.__ph3d_wave = Wave;

  console.log("[range] ready");

  return {
    three, camera,
    controls: { update: () => {} },
    crumb: "SHOOTING RANGE",
    title: "WARFARE",
    subtitle: "WAVE " + Wave.wave,
    hint: "",
    dispose: () => {
      Wave.stop();
      walker.dispose();
      [hud, fireBtn, reloadBtn, exitBtn].forEach(el => { try { el.remove(); } catch (e) {} });
      delete window.__ph3d_wave;
      Weapons.onAmmoChange = null;
    },
    update: (dt) => {
      walker.tick(dt);
      sun.position.set(walker.player.x + 40, 60, walker.player.z + 40);

      elHp.textContent = Math.max(0, Math.round(Combat.hp));

      if (firing && WEAPONS[Weapons.current].auto) {
        fireCd -= dt * 1000;
        if (fireCd <= 0) doFire();
      } else {
        fireCd = Math.max(0, fireCd - dt * 1000);
      }

      Weapons.tick();
      Wave.tick(dt, walker.player.x, walker.player.z);

      if (Multiplayer.ready) {
        Multiplayer.updatePos(walker.player.x, walker.player.z, walker.player.yaw, "idle");
      }
    },
  };
}
