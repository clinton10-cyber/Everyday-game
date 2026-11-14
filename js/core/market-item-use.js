/* Market item use: every Mile 1 purchase gets a real 3D hand prop and a
   category-specific action. Uses existing Pocket, PlayerActions and market meshes. */
import * as THREE from "three";
import { Pocket, POCKET_ITEMS } from "./pocket.js";
import { createMarketItemMesh } from "./market-item-models.js";
import { MILE1_BY_ID } from "../data/mile1-stalls.js";

const FOOD_HEAL = Object.freeze({});
const COLORS = { food: 0xffbd55, drink: 0x62d7ff, textile: 0xd98bff, adornment: 0xffd45d, household: 0x8be0a8, ritual: 0xb99aff, ingredient: 0x9fd17d, other: 0x9bc8ff };
const safeToast = (msg) => { try { window.__ph3d_phone?._toast(msg); } catch (_) {} };
function disposeObject(root) {
  if (!root) return;
  if (root.parent) root.parent.remove(root);
  root.traverse?.((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m?.dispose?.());
  });
}

function categoryFor(id, spec, market) {
  if (market?.kind === "food") return /drink|wine|zobo|palm_wine|burukutu|honey/i.test(id) ? "drink" : "food";
  if (/fabric|wrapper|lace|aso_oke|ankara/i.test(id)) return "textile";
  if (/beads|bracelet|amulet|comb|jewel|ring|watch/i.test(id)) return "adornment";
  if (/chalk|camwood|camphor|kolanut|pepper|salt/i.test(id)) return "ritual";
  if (/pot|basket|broom|mat|spoon|calabash|mask/i.test(id)) return "household";
  if (/oil|flour|beans|rice|crayfish|stockfish|periwinkle/i.test(id)) return "ingredient";
  return spec?.mile1 ? "household" : "other";
}

function addSignatureEffect(mesh, id, category) {
  const color = COLORS[category] || COLORS.other;
  const hash = Array.from(id).reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  const tint = new THREE.Color(color).offsetHSL(((hash % 19) - 9) / 180, 0, ((hash % 7) - 3) / 100);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(category === "textile" ? 0.27 : 0.19, 0.012, 5, 20),
    new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.82 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.04;
  mesh.add(ring);
  for (let i = 0; i < 3; i++) {
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), new THREE.MeshBasicMaterial({ color: tint }));
    const a = (i / 3) * Math.PI * 2 + (hash % 100) / 100;
    bead.position.set(Math.cos(a) * 0.22, 0.18 + (i % 2) * 0.07, Math.sin(a) * 0.22);
    mesh.add(bead);
  }
  mesh.userData.marketSignature = category;
}

function playerAndActions() {
  const player = window.__ph3d_player || window.__ph3d_walkCtrl || window.__ph3d_tp;
  const actions = window.__ph3d_playerActions;
  return player?.rig && actions ? { player, actions } : null;
}

export async function useMarketPocketItem(slotIndex) {
  const slot = Pocket.slots[slotIndex];
  if (!slot) return { ok: false, message: "Select an item first." };
  const id = slot.id;
  const spec = POCKET_ITEMS[id] || {};
  const market = MILE1_BY_ID[id];
  if (!market) return { ok: false, message: "This item does not have a market-use action yet." };

  const context = playerAndActions();
  if (!context) return { ok: false, message: "Your character is still loading. Try again in a moment." };

  const category = categoryFor(id, spec, market);
  const mesh = new THREE.Group();
  const model = createMarketItemMesh({ id, label: market.label });
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const extent = Math.max(size.x, size.y, size.z, 0.01);
  const targetSize = category === "textile" ? 0.52 : category === "household" ? 0.42 : category === "adornment" ? 0.25 : 0.34;
  model.scale.setScalar(Math.min(1, targetSize / extent));
  mesh.add(model);
  mesh.userData = mesh.userData || {};
  mesh.userData.itemType = id;
  mesh.userData.marketItemId = id;
  const heldRecord = { type: id, label: market.label, icon: market.icon, mesh };
  mesh.userData._item = heldRecord;
  addSignatureEffect(model, id, category);

  const { player, actions } = context;
  if (actions.isBusy?.()) return { ok: false, message: "Finish your current action first." };

  if (category === "food" || category === "drink") {
    // Eating and drinking are consumable actions, not permanent equipment.
    const previous = actions._held?.mesh;
    if (previous && previous.userData?.marketItemId) { actions.releaseHand(player); disposeObject(previous); }
    actions.hold(player, mesh);
    const heal = Math.max(1, Number(market.heal) || 5);
    try { (window.__ph3d_player_combat || window.__ph3d_combat)?.heal(heal); } catch (_) {}
    try { window.__ph3d_sfx?.play(category === "drink" ? "drink" : "eat"); } catch (_) {}
    Pocket.remove(slotIndex, 1);
    safeToast(`${category === "drink" ? "Drank" : "Ate"} ${market.label.toLowerCase()} · +${heal} health`);
    setTimeout(() => {
      if (actions.heldItem?.()?.mesh === mesh || actions._held?.mesh === mesh) actions.releaseHand(player);
      disposeObject(mesh);
    }, 1350);
    return { ok: true, consumed: true, message: `${market.label} used.` };
  }

  const previous = actions._held?.mesh;
  if (previous && previous.userData?.marketItemId) { actions.releaseHand(player); disposeObject(previous); }
  actions.hold(player, mesh);
  const messages = {
    textile: `Showing ${market.label.toLowerCase()} — fabric held visibly in your hand.`,
    adornment: `Displaying ${market.label.toLowerCase()} — its signature detail is active.`,
    ritual: `Using ${market.label.toLowerCase()} — a distinctive visual effect is active.`,
    household: `Holding ${market.label.toLowerCase()} — ready to use in the world.`,
    ingredient: `Inspecting ${market.label.toLowerCase()} — ready for food preparation.`,
    other: `Equipped ${market.label.toLowerCase()}.`,
  };
  safeToast(messages[category] || messages.other);
  return { ok: true, equipped: true, message: messages[category] || messages.other };
}

export function unequipMarketPocketItem() {
  const context = playerAndActions();
  if (!context) return false;
  const held = context.actions.heldItem?.();
  if (!held?.mesh?.userData?.marketItemId) return false;
  const mesh = held.mesh;
  context.actions.releaseHand(context.player);
  disposeObject(mesh);
  safeToast("Market item put away.");
  return true;
}
