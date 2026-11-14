import * as THREE from "three";
/* Functional household interactions shared by house interiors. */
import { Pocket } from "./pocket.js";
import { Sanity } from "./sanity.js";

const toast = (message) => { try { window.__ph3d_phone?._toast(message); } catch (_) {} };
let panel = null;
const toggles = new Map();
const toggle = (key) => { const next = !toggles.get(key); toggles.set(key, next); return next; };
function closePanel() { if (panel) { panel.remove(); panel = null; } }
function showPanel(title, message, actions) {
  closePanel();
  const root = document.createElement("div"); panel = root;
  root.style.cssText = "position:fixed;z-index:100000;inset:0;display:grid;place-items:center;background:#050510bb;padding:18px;font:600 14px Arial;color:#fff;pointer-events:auto";
  const card = document.createElement("section");
  card.style.cssText = "width:min(360px,94vw);background:linear-gradient(145deg,#17172f,#29204a);border:1px solid #8b5cff;border-radius:18px;padding:20px;box-shadow:0 15px 50px #000a";
  const h = document.createElement("h2"); h.textContent = title; h.style.cssText = "margin:0 0 8px;font-size:20px";
  const p = document.createElement("p"); p.textContent = message; p.style.cssText = "color:#c9c5dc;line-height:1.5;margin:0 0 16px";
  card.append(h,p);
  for (const a of actions) {
    const b = document.createElement("button"); b.type = "button"; b.textContent = a.label;
    b.style.cssText = "display:block;width:100%;margin:8px 0;padding:12px;border:0;border-radius:10px;background:#743cff;color:white;font-weight:700";
    b.onclick = () => { closePanel(); a.run(); }; card.append(b);
  }
  const close = document.createElement("button"); close.type="button"; close.textContent="CLOSE";
  close.style.cssText="display:block;width:100%;padding:10px;border:1px solid #625a7c;border-radius:10px;background:transparent;color:#ddd";
  close.onclick=closePanel; card.append(close); root.append(card); document.body.append(root);
}
function addFood(id, label) {
  if (Pocket.add(id, 1)) toast(label + " added to Pocket Storage.");
  else toast("Pocket Storage is full. Make space first.");
}
function setEmote(ctrl, name, duration = 16) {
  if (!ctrl || !ctrl.rig || ctrl.state !== "standing") { toast("Stand beside the equipment to use it."); return false; }
  if (ctrl._emoteTimer > 0) { toast("Finish your current activity first."); return false; }
  ctrl._emoteName = name;
  ctrl._emoteTimer = duration;
  ctrl._emotePhase = 0;
  if (ctrl._ul) ctrl._ul();
  return true;
}
function makeDumbbell() {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0x444955, metalness: 0.65, roughness: 0.38 }));
  bar.rotation.z = Math.PI / 2; g.add(bar);
  for (const x of [-0.105, 0.105]) {
    const weight = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.065, 10), new THREE.MeshStandardMaterial({ color: 0x262a32, metalness: 0.45, roughness: 0.48 }));
    weight.rotation.z = Math.PI / 2; weight.position.x = x; g.add(weight);
  }
  g.position.set(0, -0.04, 0.06);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.workoutProp = true; } });
  return g;
}
function startWeightWorkout(ctrl) {
  if (!setEmote(ctrl, "lift_weights", 16)) return;
  const attached = [];
  for (const side of ["armL", "armR"]) {
    const arm = ctrl.rig && ctrl.rig[side];
    const grip = arm && (arm.grip || arm.wrist);
    if (!grip) continue;
    const dumbbell = makeDumbbell(); grip.add(dumbbell); attached.push(dumbbell);
  }
  ctrl._onEmoteEnd = () => attached.forEach(g => { if (g.parent) g.parent.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); });
  toast("You picked up both dumbbells and started lifting.");
}
function useEmote(ctrl, name, duration) {
  if (!ctrl || !ctrl.rig || ctrl.state !== "standing") { toast("Stand beside the object to use it."); return false; }
  if (ctrl._emoteTimer > 0) { toast("Finish your current activity first."); return false; }
  const durations = { wash_dishes:14, brush_teeth:9, play_piano:18, cook_food:14, chop_food:10, read_book:18, use_computer:18, swim_pool:14, shower_wash:12, clean_surface:10, yoga:8 };
  const seconds = duration || durations[name] || 8;
  ctrl._emoteName = name;
  ctrl._emoteTimer = seconds;
  ctrl._emotePhase = 0;
  ctrl._ul?.();
  return true;
}


export function handleFurnitureUse(use, ctrl) {
  if (!use) return false;
  const kind = String(use.kind || "").toLowerCase();
  switch (kind) {
    case "fridge":
      showPanel("REFRIGERATOR", "Choose something from the fridge. Food is added to your pocket inventory.", [
        { label: "TAKE A MEAL", run: () => addFood("food", "Meal") },
        { label: "TAKE WATER", run: () => addFood("water", "Water bottle") },
      ]); return true;
    case "cook":
      showPanel("KITCHEN", "Prepare a quick meal using the cooker. The meal becomes a usable inventory item.", [
        { label: "COOK A MEAL", run: () => { if (!useEmote(ctrl,"cook_food",14)) return; if (Pocket.add("food",1)) toast("You cooked a meal and packed it. Open Pocket Storage to eat it."); else toast("Pocket Storage is full; finish cooking but make space before storing the meal."); } },
        { label: "CHOP INGREDIENTS", run: () => { if (useEmote(ctrl,"chop_food",10)) toast("You are chopping ingredients on the counter."); } },
        { label: "MAKE A DRINK", run: () => { if (useEmote(ctrl,"cook_food",7)) addFood("water", "Fresh drink"); } },
      ]); return true;
    case "sink": case "wash":
      if (useEmote(ctrl,"wash_dishes",14)) { Sanity.add(-4); toast("You are washing the dishes at the sink."); } return true;
    case "shower": case "bath":
      if (useEmote(ctrl,"shower_wash",12)) { Sanity.add(-8); toast("You stepped into the shower and began washing."); } return true;
    case "watch":
      showPanel("TELEVISION", "Choose a channel. Your selection starts a small home activity.", [
        { label: "NEWS", run: () => toast("Watching the evening news.") },
        { label: "MOVIE", run: () => toast("Movie night started.") },
        { label: "MUSIC CHANNEL", run: () => toast("Music channel playing.") },
      ]); return true;
    case "work":
      showPanel("WORK DESK", "Settle in and choose what to do at your desk.", [
        { label: "STUDY FOR 30 MINUTES", run: () => { if (useEmote(ctrl,"read_book",18)) { Sanity.add(-2); toast("You are studying at the desk."); } } },
        { label: "HANDLE PAPERWORK", run: () => { if (useEmote(ctrl,"clean_surface",10)) toast("You are sorting and arranging paperwork."); } },
        { label: "USE COMPUTER", run: () => { if (useEmote(ctrl,"use_computer",18)) toast("You are typing at the computer."); } },
      ]); return true;
    case "lift":
      startWeightWorkout(ctrl); return true;
    case "yoga":
      useEmote(ctrl,"yoga"); Sanity.add(-5); toast("You completed a short yoga session."); return true;
    case "play":
      if (useEmote(ctrl,"play_piano",18)) toast("You are playing the piano. Your hands move across the keys."); return true;
    case "read":
      if (useEmote(ctrl,"read_book",18)) toast("You opened the book and started reading."); return true;
    case "wardrobe":
      if (ctrl?._wardrobeUI?.open) ctrl._wardrobeUI.open();
      else toast("Wardrobe is unavailable right now.");
      return true;
    case "gym":
      if (setEmote(ctrl, "treadmill_run", 16)) toast("You stepped onto the treadmill and started running."); return true;
    case "mirror":
      showPanel("MIRROR", "Take a moment to check your appearance.", [
        { label: "CHECK OUTFIT", run: () => toast("You checked your outfit in the mirror.") },
        { label: "BRUSH TEETH", run: () => { if (useEmote(ctrl,"brush_teeth",9)) toast("You are brushing your teeth."); } },
        { label: "FIX HAIR", run: () => { if (useEmote(ctrl,"clean_surface",5)) toast("You are fixing your hair in the mirror."); } },
        { label: "PRACTISE A POSE", run: () => { if (useEmote(ctrl,"flex",3.2)) toast("You practised a confident pose."); } },
      ]); return true;
    case "nightstand":
      showPanel("BEDSIDE DRAWER", "You open the bedside drawer and check its contents.", [
        { label: "TAKE A WATER BOTTLE", run: () => addFood("water", "Water bottle") },
        { label: "TAKE A QUICK SNACK", run: () => addFood("food", "Snack") },
        { label: "CLOSE DRAWER", run: () => toast("You close the bedside drawer.") },
      ]); return true;
    case "lamp": case "chandelier": case "pole_lamp": {
      const on = toggle(kind);
      toast((use.label || "Light") + (on ? " switched ON." : " switched OFF."));
      return true;
    }
    case "coffee_table":
      showPanel("COFFEE TABLE", "Use the table for a small living-room activity.", [
        { label: "PUT DOWN A DRINK", run: () => toast("You placed your drink on the coffee table.") },
        { label: "READ MAGAZINE", run: () => { if (useEmote(ctrl,"read_book",12)) { Sanity.add(-1); toast("You are reading a magazine."); } } },
        { label: "CLEAR TABLE", run: () => { if (useEmote(ctrl,"clean_surface",8)) toast("You are clearing the coffee table."); } },
      ]); return true;
    case "island":
      showPanel("KITCHEN ISLAND", "Prepare ingredients before cooking.", [
        { label: "CHOP VEGETABLES", run: () => { if (useEmote(ctrl,"chop_food",10)) toast("You are chopping vegetables on the kitchen island."); } },
        { label: "MAKE SANDWICH", run: () => { if (useEmote(ctrl,"cook_food",10)) addFood("food", "Fresh sandwich"); } },
        { label: "POUR WATER", run: () => addFood("water", "Glass of water") },
      ]); return true;
    case "dining_table":
      showPanel("DINING TABLE", "Prepare the dining area for a meal.", [
        { label: "SET THE TABLE", run: () => { if (useEmote(ctrl,"clean_surface",8)) toast("You are setting the table with plates and cutlery."); } },
        { label: "SERVE A MEAL", run: () => addFood("food", "Served meal") },
        { label: "CLEAR THE TABLE", run: () => { if (useEmote(ctrl,"wash_dishes",8)) toast("You are clearing and collecting the dishes."); } },
      ]); return true;
    case "dresser":
      showPanel("DRESSER", "Open the drawers to organise your belongings.", [
        { label: "OPEN CLOTHING DRAWER", run: () => { if (ctrl?._wardrobeUI?.open) ctrl._wardrobeUI.open(); else toast("You checked the clothing drawer."); } },
        { label: "FOLD CLOTHES", run: () => { if (useEmote(ctrl,"clean_surface",8)) toast("You are folding and organising clothes."); } },
      ]); return true;
    case "rug":
      toast("You straightened the rug and tidied the room."); return true;
    case "plant":
      showPanel("HOUSE PLANT", "Take care of the indoor plant.", [
        { label: "WATER PLANT", run: () => { if (useEmote(ctrl,"clean_surface",6)) toast("You are watering the plant."); } },
        { label: "CHECK SOIL", run: () => toast("The soil looks healthy.") },
      ]); return true;
    case "window":
      toast(toggle("window") ? "You opened the window. Fresh air enters the room." : "You closed the window."); return true;
    case "fireplace":
      toast(toggle("fireplace") ? "You lit the fireplace. The room feels warmer." : "You extinguished the fireplace."); return true;
    case "painting":
      toast("You stopped to inspect the painting and its details."); return true;
    case "big_screen":
      showPanel("BIG SCREEN", "Choose entertainment for the room.", [
        { label: "WATCH A FILM", run: () => toast("The big-screen film is now playing.") },
        { label: "WATCH SPORTS", run: () => toast("Live sports are playing on the big screen.") },
        { label: "PLAY MUSIC VIDEO", run: () => toast("A music video is now playing.") },
      ]); return true;
    case "pool":
      if (!ctrl || !ctrl.rig || ctrl.state !== "standing") { toast("Stand beside the pool before entering."); return true; }
      if (ctrl._emoteTimer > 0) { toast("Finish your current activity first."); return true; }
      /* Register the actual water footprint. Do not teleport the player to the
         pool centre: they enter from the interaction edge and can swim within
         the basin. Leaving the footprint automatically ends the swim state. */
      const poolW = Number.isFinite(use.poolW) ? Math.max(1, use.poolW) : 4;
      const poolD = Number.isFinite(use.poolD) ? Math.max(1, use.poolD) : 3;
      ctrl._swimArea = {
        x: Number.isFinite(use.x) ? use.x : ctrl.pos.x,
        z: Number.isFinite(use.z) ? use.z : ctrl.pos.z,
        halfW: Math.max(0.55, poolW * 0.5 - 0.22),
        halfD: Math.max(0.55, poolD * 0.5 - 0.22),
        waterY: Number.isFinite(use.waterY) ? use.waterY : (ctrl.floorY || 0),
        level: Number.isFinite(use.level) ? use.level : ctrl.level,
      };
      /* If the player activated the pool from its rim, step them just inside
         the nearest edge rather than teleporting them to the basin centre. */
      ctrl.pos.x = Math.max(ctrl._swimArea.x - ctrl._swimArea.halfW, Math.min(ctrl._swimArea.x + ctrl._swimArea.halfW, ctrl.pos.x));
      ctrl.pos.z = Math.max(ctrl._swimArea.z - ctrl._swimArea.halfD, Math.min(ctrl._swimArea.z + ctrl._swimArea.halfD, ctrl.pos.z));
      ctrl.yaw = Math.atan2(ctrl._swimArea.x - ctrl.pos.x, ctrl._swimArea.z - ctrl.pos.z);
      ctrl.vel?.set?.(0, 0, 0);
      ctrl.running = false;
      ctrl._swimming = true;
      ctrl._swimTransition = "enter";
      ctrl._swimTransitionUntil = performance.now() + 850;
      ctrl._emoteName = "swim_entry";
      ctrl._emoteTimer = 1.05;
      ctrl._emotePhase = 0;
      ctrl._ul?.();
      Sanity.add(-6);
      toast("You entered the pool. Swim inside the water and move to the edge to get out.");
      return true;
    case "show_plinth":
      toast("You inspected the display item from every side."); return true;
    case "stage":
      showPanel("STAGE", "Take the stage and choose an activity.", [
        { label: "GIVE A SPEECH", run: () => toast("You delivered a short speech to the audience.") },
        { label: "PERFORM A DANCE", run: () => { if (useEmote(ctrl,"dance",6)) toast("You performed for the crowd."); } },
        { label: "PRACTISE SINGING", run: () => { if (useEmote(ctrl,"hum",8)) toast("You practised singing on stage."); } },
      ]); return true;
    case "slide":
      toast("You climbed up and enjoyed the playground slide."); return true;
    case "console":
      showPanel("GAME CONSOLE", "Choose a game mode.", [
        { label: "QUICK MATCH", run: () => { Sanity.add(-2); toast("You played a quick game and relaxed."); } },
        { label: "CAREER MODE", run: () => toast("You started a career-mode session.") },
        { label: "TURN OFF CONSOLE", run: () => toast("You switched off the console.") },
      ]); return true;
    default:
      toast(use.label || "You interacted with the furniture."); return true;
  }
}
