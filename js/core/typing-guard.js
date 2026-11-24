/* typing-guard.js — one answer to "is the player typing right now?"
   Game key handlers (WASD, E, F, Space, 1-9 …) call isTyping(e) and bail out, so typing in chat,
   the phone, a search box or any text field never walks, jumps or swaps weapons.
   Chat panels call setTyping(true/false); that also fires "ph3d-typing" so scenes can release any
   key that was still held when the chat opened (otherwise the player keeps walking). */

const TEXT_INPUT = /^(text|search|email|password|tel|url|number|)$/i;
let typing = false;

export function isTypingTarget(t) {
  if (!t || !t.tagName) return false;
  const tag = t.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") return TEXT_INPUT.test(t.type || "");   /* sliders / checkboxes / buttons don't count */
  if (t.isContentEditable) return true;
  return !!(t.closest && t.closest(".gk-field,[contenteditable='true'],[role='textbox']"));
}

export function isTyping(e) {
  return typing || (e && isTypingTarget(e.target)) || isTypingTarget(document.activeElement);
}

export function setTyping(on) {
  on = !!on;
  if (typing === on) return;
  typing = on;
  try { window.__ph3dTyping = on; } catch (_) {}
  if (on) { try { window.dispatchEvent(new Event("ph3d-typing")); } catch (_) {} }
}
