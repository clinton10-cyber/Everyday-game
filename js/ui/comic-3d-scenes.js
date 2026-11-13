/* Everyday Comics — every comic scene uses the actual Everyday-game world,
   the game's faceted character builder, real location builders and a moving
   3D cinema camera. Only one active comic scene is rendered at a time. */
import { playCinematic } from "../cinematics/story-player.js";

const live = new Map();
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function locationFor(title, text, page) {
  const t = String(text || "").toLowerCase();
  const all = `${title} ${text}`.toLowerCase();
  // Prefer the actual location described on this page over the comic's overall title.
  if (/hotel presidential|presidential suite|hotel lobby|hotel room|hotel reception|hotel entrance/.test(t)) return /outside|entrance|driveway|front gate|exterior/.test(t) ? "hotelExterior" : "hotel";
  if (/pleasure park|amusement park|ferris wheel|carousel|water park|theme park/.test(t)) return "park";
  if (/classroom|school hall|teacher|lesson|lecture room|exam hall/.test(t)) return "classroom";
  if (/uniport|university|campus|faculty|lecture theatre|library|hostel/.test(t)) return "university";
  if (/office|company|boardroom|business meeting|detective office|agency|workplace/.test(t)) return "office";
  if (/road|street|junction|keke|danfo|traffic|rain|driver|taxi|bus stop|petrol station|market|city centre/.test(t)) return "street";
  if (/pleasure park|amusement park|ferris wheel|carousel|water park|theme park/.test(all)) return "park";
  if (/hotel presidential|presidential suite|hotel lobby|hotel room|hotel reception|hotel/.test(all)) return "hotel";
  if (/uniport|university|campus|student|faculty|lecture hall|library|hostel/.test(all)) return "university";
  if (/classroom|school|teacher|lesson|lecture room|exam hall/.test(all)) return "classroom";
  if (/office|company|boardroom|business meeting|detective office|agency|workplace/.test(all)) return "office";
  return "street";
}

function castFor(title, text, page) {
  const seed = Math.abs([...`${title}:${page}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7));
  const shirts = ["#2764a5", "#e0a13d", "#9b3f56", "#287b65", "#7c5bb4", "#d0d5df"];
  const skins = ["#8a5038", "#a96849", "#c88662", "#70412f", "#d39a77", "#995d45"];
  const hair = ["#211b19", "#39271f", "#171719", "#4a3024", "#251b18"];
  const pick = (arr, n) => arr[(seed + n * 3) % arr.length];
  const leadFemale = /amara|woman|girl|sister|mother|daughter|she |her /i.test(text) || page % 2 === 0;
  const lead = {
    gender: leadFemale ? "female" : "male", skin: pick(skins, 0), hair: leadFemale ? "braids" : "short",
    hairColor: pick(hair, 1), top: leadFemale ? "tshirt" : "polo", shirt: pick(shirts, 0),
    bottom: "jeans", bottomColor: "#26374a", position: [-1.55, 0, 0.35], walking: true
  };
  const companion = {
    gender: leadFemale ? "male" : "female", skin: pick(skins, 2), hair: leadFemale ? "short" : "braids",
    hairColor: pick(hair, 3), top: "hoodie", shirt: pick(shirts, 2),
    bottom: "jeans", bottomColor: "#353b43", position: [1.35, 0, -0.35], walking: /walk|run|leave|arrive|journey|chase|search/i.test(text)
  };
  const people = [lead, companion];
  if (/crowd|friends|students|people|family|team|passengers|visitors|workers/i.test(text)) {
    people.push({gender:"male",skin:pick(skins,4),hair:"afro",hairColor:pick(hair,4),top:"polo",shirt:pick(shirts,4),bottom:"jeans",position:[3.1,0,-1.6],walking:true});
  }
  return people;
}

function configFor(canvas) {
  const title = canvas.dataset.title || "Everyday Story";
  const text = canvas.dataset.sceneText || "A moment in Port Harcourt.";
  const page = Number(canvas.dataset.page) || 0;
  const kind = locationFor(title, text, page);
  const vehicleNeeded = /car|drive|ride|vehicle|taxi|keke|bus|van|traffic|road trip|briefcase/i.test(`${title} ${text}`);
  const act = {
    kind,
    duration: 7.2,
    cast: castFor(title, text, page),
    car: vehicleNeeded ? {color: page % 2 ? "#172d48" : "#6e2630", position:[4.5,0,2.6], rotation:-Math.PI/2, scale:1.05} : null
  };
  return { title, text, page, act };
}

async function startScene(canvas, key) {
  const record = { cancelled:false, player:null, promise:null };
  live.set(key, record);
  record.promise = (async () => {
    try {
      const { title, text, page, act } = configFor(canvas);
      const vehicle = act.car ? (await import("../vehicles/rangerover_compound.js")).buildRangeRover3D : null;
      if (record.cancelled || !canvas.isConnected) return;
      let cinematic;
      cinematic = await playCinematic(canvas, {
        acts:[act],
        onEnd:() => { if (!record.cancelled && cinematic) cinematic.restart(); }
      }, vehicle);
      if (record.cancelled || !canvas.isConnected) { cinematic.destroy(); return; }
      record.player = cinematic;
      cinematic.play();
      canvas.setAttribute("aria-label", `Animated 3D comic scene ${page + 1}: ${title}. Actual game world and characters.`);
    } catch (err) {
      console.error("[Everyday Comics 3D world]", err);
      if (canvas.isConnected) {
        canvas.dataset.sceneError = "true";
        const ctx = canvas.getContext("2d");
        if (ctx) { canvas.width=960; canvas.height=540; ctx.fillStyle="#142235";ctx.fillRect(0,0,960,540);ctx.fillStyle="#fff";ctx.font="bold 25px sans-serif";ctx.fillText("3D scene could not load",36,260);ctx.font="16px sans-serif";ctx.fillText("Check the game's bundled world and Three.js files.",36,294); }
      }
    }
  })();
  return record.promise;
}

export function disposeComicScenes(root = document) {
  if (!root) return;
  root.querySelectorAll("canvas[data-comic-scene]").forEach(canvas => {
    const key = canvas.dataset.comicScene;
    const record = live.get(key);
    if (!record) return;
    record.cancelled = true;
    try { record.player?.destroy(); } catch (e) { console.warn("[comic scene dispose]", e); }
    live.delete(key);
  });
}

export function mountComicScenes(root = document) {
  if (!root) return;
  root.querySelectorAll("canvas[data-comic-scene]").forEach(canvas => {
    const key = canvas.dataset.comicScene;
    if (!key || live.has(key)) return;
    startScene(canvas, key);
  });
}

export async function captureComicScene(root, key, title, page) {
  const canvas = root?.querySelector(`canvas[data-comic-scene="${key}"]`);
  if (!canvas) return false;
  try {
    const url = canvas.toDataURL("image/jpeg", .9);
    const { Photos } = await import("../core/photos.js");
    Photos.add(url, `${title} — Scene ${page + 1}`, {tag:"comic", who:[], where:"Everyday Comics"});
    window.__ph3d_phone?._toast("Actual 3D game-world scene saved to Gallery");
    return true;
  } catch (err) {
    console.warn("[comic capture]", err);
    window.__ph3d_phone?._toast("Could not save comic scene");
    return false;
  }
}

export function openComicSceneViewer(comic, page) {
  const key = `comic-view-${comic.id}-${page}-${Date.now()}`;
  const description = comic.pages?.[page] || comic.desc || "A moment in the Everyday-game world.";
  const overlay = document.createElement("div");
  overlay.className = "comic-scene-viewer";
  overlay.innerHTML = `<div class="csv-head"><div><small>EVERYDAY COMICS · REAL GAME-WORLD 3D</small><b>${esc(comic.title)}</b><span>SCENE ${page+1} · MOVING CINEMATIC CAMERA</span></div><button data-close>✕ CLOSE</button></div><div class="csv-stage"><canvas data-comic-scene="${key}" data-title="${esc(comic.title)}" data-scene-text="${esc(description)}" data-page="${page}" data-genre="${esc(comic.genre)}"></canvas></div><div class="csv-controls"><button data-toggle>Ⅱ PAUSE CAMERA</button><button data-capture>▣ CAPTURE TO GALLERY</button></div><p>Rendered with the actual Port Harcourt world, game-built locations, detailed faceted characters and a moving 3D camera.</p>`;
  const style = document.createElement("style");
  style.textContent = `.comic-scene-viewer{position:fixed;inset:0;z-index:100010;background:#070b14;color:#fff;display:flex;flex-direction:column;justify-content:center;padding:12px;box-sizing:border-box;font-family:inherit}.comic-scene-viewer .csv-head{display:flex;justify-content:space-between;align-items:center;gap:12px;width:min(100%,1100px);margin:0 auto 10px}.comic-scene-viewer small,.comic-scene-viewer span{display:block;color:#c5cbe0;font-size:10px;letter-spacing:.12em}.comic-scene-viewer b{display:block;font-size:18px;margin:4px 0}.comic-scene-viewer button{border:0;border-radius:10px;padding:12px 14px;background:#28364b;color:white;font-weight:900}.comic-scene-viewer .csv-stage{width:min(100%,1100px);margin:0 auto;border:1px solid #53627b;border-radius:14px;overflow:hidden;background:#111}.comic-scene-viewer canvas{display:block;width:100%;height:auto;aspect-ratio:16/9}.comic-scene-viewer .csv-controls{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:12px auto 4px}.comic-scene-viewer [data-capture]{background:#f0bd69;color:#20180d}.comic-scene-viewer p{text-align:center;color:#b7c1d3;font-size:11px;line-height:1.5;margin:8px auto;max-width:760px}`;
  overlay.appendChild(style);
  document.body.appendChild(overlay);
  mountComicScenes(overlay);
  overlay.querySelector("[data-close]").onclick = () => { disposeComicScenes(overlay); overlay.remove(); };
  overlay.querySelector("[data-toggle]").onclick = () => {
    const rec = live.get(key);
    if (!rec?.player) return;
    if (rec.player.state.playing) { rec.player.pause(); overlay.querySelector("[data-toggle]").textContent = "▶ RESUME CAMERA"; }
    else { rec.player.play(); overlay.querySelector("[data-toggle]").textContent = "Ⅱ PAUSE CAMERA"; }
  };
  overlay.querySelector("[data-capture]").onclick = () => captureComicScene(overlay, key, comic.title, page);
}
