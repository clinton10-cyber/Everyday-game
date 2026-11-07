/* _fpwalker.js -- first-person walker.
   v14: FOV/eye/speed retuned for phone. Look sensitivity halved.
   Axis flags at the top let you flip if a gesture reads wrong. */
import * as THREE from "three";

/* ── AXIS CONFIG ─────────────────────────────────────────
   If your joystick feels inverted, change one of these.
   Testing note: standard mobile expects
     joystick up   = walk forward
     joystick right = strafe right
     look drag right = camera turns right
     look drag down  = camera looks down                */
const JOY_FLIP_X = false;   // set true if strafing is inverted
const JOY_FLIP_Y = false;   // set true if walking is inverted
const LOOK_FLIP_X = false;  // set true if turning is inverted
const LOOK_FLIP_Y = false;  // set true if pitching is inverted
/* ──────────────────────────────────────────────────────── */

export function makeFPWalker(camera, dom, isWalkable, opts) {
  opts = opts || {};
  const EYE   = opts.eye   != null ? opts.eye   : 1.65;
  const JOY_R = 58;
  const SPEED = opts.speed != null ? opts.speed : 4.0;
  const RUN   = opts.run   != null ? opts.run   : 7.5;

  const player = {
    x:     opts.startX   != null ? opts.startX   : 0,
    y:     EYE,
    z:     opts.startZ   != null ? opts.startZ   : 0,
    yaw:   opts.startYaw != null ? opts.startYaw : 0,
    pitch: 0,
  };

  camera.rotation.order = "YXZ";

  const joy  = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  const look = { id: -1, x: 0, y: 0 };
  let onJoyMove = opts.onJoyMove || null;

  const onDown = (e) => {
    const isLeft = e.clientX < innerWidth * 0.5;
    if (isLeft && joy.id === -1) {
      joy.id = e.pointerId;
      joy.ox = e.clientX; joy.oy = e.clientY;
      joy.x = 0; joy.y = 0;
      try { dom.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    } else if (!isLeft && look.id === -1) {
      look.id = e.pointerId;
      look.x = e.clientX; look.y = e.clientY;
      try { dom.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    }
  };

  const onMove = (e) => {
    if (e.pointerId === joy.id) {
      let dx = e.clientX - joy.ox;
      let dy = e.clientY - joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > JOY_R) { dx = dx / d * JOY_R; dy = dy / d * JOY_R; }
      joy.x = dx / JOY_R;
      joy.y = dy / JOY_R;
      if (onJoyMove) onJoyMove(joy);
      e.preventDefault();
    } else if (e.pointerId === look.id) {
      const sxs = LOOK_FLIP_X ? -1 : 1;
      const sys = LOOK_FLIP_Y ? -1 : 1;
      player.yaw -= sxs * (e.clientX - look.x) * 0.0030;
      player.pitch = Math.max(-1.15, Math.min(1.15,
        player.pitch - sys * (e.clientY - look.y) * 0.0026));
      look.x = e.clientX; look.y = e.clientY;
      e.preventDefault();
    }
  };

  const onUp = (e) => {
    if (e.pointerId === joy.id) {
      joy.id = -1; joy.x = 0; joy.y = 0;
      if (onJoyMove) onJoyMove(joy);
      try { dom.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    if (e.pointerId === look.id) {
      look.id = -1;
      try { dom.releasePointerCapture(e.pointerId); } catch (_) {}
    }
  };

  dom.addEventListener("pointerdown", onDown);
  dom.addEventListener("pointermove", onMove, { passive: false });
  dom.addEventListener("pointerup", onUp);
  dom.addEventListener("pointercancel", onUp);
  dom.addEventListener("lostpointercapture", onUp);
  dom.addEventListener("contextmenu", (e) => e.preventDefault());

  const keys = Object.create(null);
  const kd = (e) => { keys[e.code] = 1; };
  const ku = (e) => { keys[e.code] = 0; };
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);

  const _euler = new THREE.Euler(0, 0, 0, "YXZ");

  return {
    player, keys, joy, look,
    get onJoyMove() { return onJoyMove; },
    set onJoyMove(fn) { onJoyMove = fn; },

    tick(dt, frozen) {
      if (!frozen) {
        let mx = JOY_FLIP_X ? -joy.x : joy.x;
        let mz = JOY_FLIP_Y ? -joy.y : joy.y;
        if (keys.KeyW || keys.ArrowUp)    mz -= 1;
        if (keys.KeyS || keys.ArrowDown)  mz += 1;
        if (keys.KeyA || keys.ArrowLeft)  mx -= 1;
        if (keys.KeyD || keys.ArrowRight) mx += 1;
        const mag = Math.hypot(mx, mz);
        if (mag > 1) { mx /= mag; mz /= mag; }
        const run = !!(keys.ShiftLeft || keys.ShiftRight);
        const sp = run ? RUN : SPEED;
        const fx = -Math.sin(player.yaw);
        const fz = -Math.cos(player.yaw);
        const rx =  Math.cos(player.yaw);
        const rz = -Math.sin(player.yaw);
        const dx = (fx * -mz + rx * mx) * sp * dt;
        const dz = (fz * -mz + rz * mx) * sp * dt;
        const nx = player.x + dx;
        const nz = player.z + dz;
        if (isWalkable(nx, player.z)) player.x = nx;
        if (isWalkable(player.x, nz)) player.z = nz;
      }

      camera.position.set(player.x, player.y, player.z);
      _euler.set(player.pitch, player.yaw, 0, "YXZ");
      camera.quaternion.setFromEuler(_euler);
    },

    dispose() {
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointercancel", onUp);
      dom.removeEventListener("lostpointercapture", onUp);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    },
  };
}

