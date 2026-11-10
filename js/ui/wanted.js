let el = null;
function build() {
  el = document.createElement("div");
  el.id = "ph3d-wanted";
  el.style.cssText =
    "position:fixed;right:12px;top:calc(env(safe-area-inset-top,0px)+64px);" +
    "z-index:27;font-size:22px;letter-spacing:2px;pointer-events:none;" +
    "text-shadow:0 0 8px rgba(255,60,60,.85);display:none";
  document.body.appendChild(el);
  if (!document.getElementById("ph3d-wanted-style")) {
    const style = document.createElement("style");
    style.id = "ph3d-wanted-style";
    style.textContent = "@keyframes wantedPulse{0%,100%{opacity:1}50%{opacity:.35}}";
    document.head.appendChild(style);
  }
}
export function tickWanted() {
  if (!el) build();
  const Cr = window.__ph3d_crime;
  const alert = (Cr && Cr.alert) || 0;
  const stars = alert < 20 ? 0 : alert < 40 ? 1 : alert < 60 ? 2 : alert < 80 ? 3 : alert < 95 ? 4 : 5;
  if (stars === 0) { el.style.display = "none"; return; }
  el.style.display = "block";
  const filled = "★".repeat(stars), empty = "☆".repeat(5 - stars);
  el.innerHTML =
    `<span style="color:#ff4040">${filled}</span>` +
    `<span style="color:rgba(255,64,64,.35)">${empty}</span>`;
  if (stars >= 4) el.style.animation = "wantedPulse .8s ease-in-out infinite";
  else el.style.animation = "";
}
