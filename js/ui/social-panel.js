import { PhoneLife } from "../core/phone-life.js";
import { Engagement } from "../core/engagement.js";
const ROOT = "everyday-social";
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const POSTS = [
  ["Amaka N.", "Just got fresh jollof from Mile 1. Port Harcourt food no get rival!", "Mile 1"],
  ["Chidi Works", "New week, new goals. Anybody hiring around Rumuola?", "Rumuola"],
  ["Garden City Updates", "Traffic is building near the main junction. Drive carefully.", "Port Harcourt"],
  ["Tari P.", "Small business owners: consistency is the real secret. Keep pushing.", "Diobu"],
  ["Kelechi Vibes", "Who is going to the park this evening?", "City Park"]
];
export const SocialPanel = {
 ensure() {
  if (document.getElementById(ROOT)) return;
  const app = document.getElementById("app-social"); if (!app) return;
  const style = document.createElement("style"); style.id = ROOT+"-css"; style.textContent = `#${ROOT}{padding:10px 0 26px;color:#f4f7ff}#${ROOT} .hero{padding:15px;border-radius:16px;background:linear-gradient(135deg,#153b68,#562d78);margin:8px 0 12px}#${ROOT} h2{font-size:21px;margin:5px 0}#${ROOT} small{color:#aebbd2;font-size:10px}#${ROOT} .card{background:#172236;border:1px solid #33445f;border-radius:14px;padding:12px;margin:9px 0}#${ROOT} .who{font-size:12px;font-weight:900}#${ROOT} p{font-size:12px;line-height:1.5;color:#e0e8f5}#${ROOT} button{border:0;border-radius:9px;padding:10px 12px;background:#315b9b;color:white;font-weight:800;font-size:10px}#${ROOT} button:disabled{opacity:.4}#${ROOT} textarea{box-sizing:border-box;width:100%;min-height:76px;border:1px solid #405675;border-radius:10px;background:#0d1728;color:#fff;padding:10px;font:12px inherit}#${ROOT} .row{display:flex;justify-content:space-between;align-items:center;gap:8px}#${ROOT} .compose{background:#101c2e;border:1px solid #30445f;border-radius:14px;padding:12px}#${ROOT} .tag{font-size:9px;color:#9ed9ff}`; document.head.appendChild(style);
  app.innerHTML = `<button class="tbk" data-back>‹ Home</button><div id="${ROOT}"></div>`;
  app.querySelector("[data-back]").onclick = () => window.__ph3d_phone?.showApp("home");
 },
 render() {
  this.ensure(); const root=document.getElementById(ROOT); if(!root)return;
  const s=PhoneLife.snapshot(), posts=PhoneLife.state.posts||0, likes=PhoneLife.state.likes||0;
  const playerPosts = (PhoneLife.state.feed || []).map(p=>`<article class="card"><div class="row"><span class="who">You</span><span class="tag">Just now</span></div><p>${esc(p.text)}</p><small>Your update · ${new Date(p.time).toLocaleString()}</small></article>`).join("");
  root.innerHTML = `<div class="hero"><small>EVERYDAY SOCIAL · PORT HARCOURT</small><h2>Garden City Connect</h2><div class="row"><small>${s.dataMb} MB mobile data available</small><small>${posts} posts · ${likes} likes</small></div></div><div class="compose"><b style="font-size:12px">Share an update</b><textarea id="social-text" maxlength="180" placeholder="What's happening in Port Harcourt?"></textarea><div class="row"><small>Uses 5 MB data</small><button id="social-post">POST UPDATE</button></div></div><h3 style="font-size:12px;margin:16px 2px 8px">CITY FEED</h3>${playerPosts}${POSTS.map((p,i)=>`<article class="card"><div class="row"><span class="who">${esc(p[0])}</span><span class="tag">${esc(p[2])}</span></div><p>${esc(p[1])}</p><div class="row"><small>Everyday community</small><button data-like="${i}">♥ Like · 1 MB</button></div></article>`).join("")}<div class="card"><small>Your activity</small><p>You have shared ${posts} updates and given ${likes} likes.</p></div>`;
  root.querySelector("#social-post").onclick=()=>{const r=PhoneLife.socialPost(root.querySelector("#social-text").value);this.message(r);};
  root.querySelectorAll("[data-like]").forEach(b=>b.onclick=()=>{const r=PhoneLife.like();this.message(r);});
 },
 message(r){const msg=!r.ok?(r.reason==="data"?"Not enough data. Visit the Phone Shop to buy a bundle.":r.reason==="no_phone"?"Buy a phone first.":r.reason==="empty"?"Write something before posting.":"Action unavailable."):"Update saved to your social activity.";window.__ph3d_phone?._toast(msg);this.render();}
};
