import { PhoneLife } from "../core/phone-life.js";
import { Engagement } from "../core/engagement.js";
import { Photos, captureFrame, captureShot } from "../core/photos.js";

const ROOT = "everyday-social";
const KEY = "everyday-social-world.v2";
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const seedNames = ["Amaka Nwosu","Chidi Okafor","Tari Briggs","Kelechi Vibes","Mimi Douglas","Somto Eze","Garden City Updates","Port Harcourt Lens"];
const captions = [
  "Out for a walk around the Garden City. The streets are alive today.",
  "Little moments from my side of Port Harcourt. Where are you exploring?",
  "Taking the long route and enjoying the city view.",
  "Fresh air, busy streets and another beautiful day in PH.",
  "Spotted a lively corner of town while strolling. Stay safe out there.",
  "Evening walk complete. Drop your favourite hangout in the comments."
];
const read = () => { try { const v=JSON.parse(localStorage.getItem(KEY)||"{}"); return {posts:Array.isArray(v.posts)?v.posts:[],following:Array.isArray(v.following)?v.following:[],followers:Array.isArray(v.followers)?v.followers:[],liked:Array.isArray(v.liked)?v.liked:[],comments:v.comments&&typeof v.comments==="object"?v.comments:{},lastNpcPost:Number(v.lastNpcPost)||0}; } catch (_) { return {posts:[],following:[],followers:[],liked:[],comments:{},lastNpcPost:0}; } };
const state = read();
/* Remove legacy NPC posts that used stock portrait URLs. New NPC posts are
   captured directly from the current 3D character models. */
state.posts = state.posts.filter(p => p.kind !== "npc" || p.authorId === "official_gcc" || (String(p.avatar || "").startsWith("data:image/") && String(p.image || "").startsWith("data:image/")));
if (!state.posts.some(p => p.kind === "npc" && p.authorId !== "official_gcc")) state.lastNpcPost = 0;
const save = () => { try { localStorage.setItem(KEY,JSON.stringify(state)); } catch (_) {} };
const compactImage = url => new Promise(resolve => { if(!url)return resolve(""); try { const im=new Image(); im.onload=()=>{try{const c=document.createElement("canvas"),scale=Math.min(1,360/Math.max(im.width,im.height)),w=Math.max(1,Math.round(im.width*scale)),h=Math.max(1,Math.round(im.height*scale));c.width=w;c.height=h;const ctx=c.getContext("2d");ctx.drawImage(im,0,0,w,h);resolve(c.toDataURL("image/jpeg",.48));}catch(_){resolve("");}};im.onerror=()=>resolve("");im.src=url;}catch(_){resolve("");} });
const toast = m => { try { window.__ph3d_phone?._toast(m); } catch (_) {} };
const npcList = () => { try { return typeof window.__ph3d_npcsList === "function" ? window.__ph3d_npcsList() : []; } catch (_) { return []; } };
const npcSelfie = (n) => {
  try {
    const g = n && n.group;
    if (!g || !g.visible || !g.position) return "";
    const yaw = Number(g.rotation && g.rotation.y) || 0;
    const x = g.position.x, y = g.position.y || 0, z = g.position.z;
    const front = 1.65;
    const pos = { x: x + Math.sin(yaw) * front, y: y + 1.48, z: z + Math.cos(yaw) * front };
    const look = { x, y: y + 1.22, z };
    return captureShot(pos, look, 48) || "";
  } catch (_) { return ""; }
};
const squareAvatar = (url) => new Promise(resolve => {
  if (!url) return resolve("");
  try { const im = new Image(); im.onload = () => { try { const c=document.createElement("canvas"); c.width=c.height=96; const x=c.getContext("2d"); const side=Math.min(im.width,im.height); x.drawImage(im,(im.width-side)/2,(im.height-side)/2,side,side,0,0,96,96); resolve(c.toDataURL("image/jpeg",.46)); } catch (_) { resolve(""); } }; im.onerror=()=>resolve(""); im.src=url; } catch (_) { resolve(""); }
});
const npcName = (n,i) => n && n._life && n._life.name || seedNames[i % seedNames.length];
const verifiedNpc = (name,n) => /updates|news|police|doctor|mayor|radio/i.test(name) || !!(n && n.role === "police");

export const SocialPanel = {
 _tab:"feed", _photoId:"", _npcTimer:0,
 ensure(){
  if(document.getElementById(ROOT)) return;
  const app=document.getElementById("app-social"); if(!app)return;
  const style=document.createElement("style"); style.id=ROOT+"-css";
  style.textContent=`#${ROOT}{padding:8px 0 30px;color:#f4f7ff;font-family:Inter,system-ui,sans-serif}#${ROOT} .hero{padding:16px;border-radius:17px;background:linear-gradient(130deg,#073c45,#183c78 55%,#612c83);margin:8px 0 12px;box-shadow:0 10px 28px #0005}#${ROOT} h2{font-size:21px;margin:5px 0}#${ROOT} small{color:#aebbd2;font-size:10px}#${ROOT} .row{display:flex;justify-content:space-between;align-items:center;gap:8px}#${ROOT} .tabs{display:flex;gap:6px;overflow:auto;padding:4px 0 9px}#${ROOT} button{border:1px solid #405675;border-radius:10px;padding:9px 11px;background:#203d66;color:white;font-weight:800;font-size:10px;white-space:nowrap}#${ROOT} button.on{background:#00a8a0;border-color:#53e7d8;color:#041a21}#${ROOT} button:disabled{opacity:.4}#${ROOT} .card{background:#172236;border:1px solid #33445f;border-radius:14px;padding:12px;margin:9px 0;overflow:hidden}#${ROOT} .who{font-size:12px;font-weight:900}#${ROOT} p{font-size:12px;line-height:1.5;color:#e0e8f5;white-space:pre-wrap}#${ROOT} .compose{background:#101c2e;border:1px solid #30445f;border-radius:14px;padding:12px}#${ROOT} textarea{box-sizing:border-box;width:100%;min-height:72px;border:1px solid #405675;border-radius:10px;background:#0d1728;color:#fff;padding:10px;font:12px Inter,system-ui,sans-serif;margin:8px 0}#${ROOT} .tag{font-size:9px;color:#9ed9ff}#${ROOT} .verified{color:#54d8ff;font-size:11px;margin-left:4px}#${ROOT} .postimg{display:block;width:100%;max-height:230px;object-fit:cover;border-radius:11px;margin:9px 0;background:#0b1423}#${ROOT} .actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}#${ROOT} .actions button{flex:1}#${ROOT} .comment{border-top:1px solid #34445b;margin-top:9px;padding-top:8px;font-size:11px;color:#d6e0ee}#${ROOT} .comment input{width:100%;box-sizing:border-box;margin-top:6px;padding:9px;border-radius:8px;background:#0d1728;border:1px solid #405675;color:white}#${ROOT} .profile{display:flex;align-items:center;gap:10px}#${ROOT} .avatar{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#00b7aa,#5d4bdb);font-weight:900}#${ROOT} .muted{color:#9eafc6;font-size:10px}`;
  style.textContent += `
  #${ROOT}{max-width:760px;margin:0 auto;padding:0 0 36px;color:#18202b;font-family:Inter,system-ui,sans-serif}
  #${ROOT} .hero{border-radius:0 0 22px 22px;margin:0 -16px 14px;padding:22px 18px 18px;background:linear-gradient(115deg,#102b42,#174e68 58%,#087f78);box-shadow:0 8px 24px #122d4324}
  #${ROOT} .hero small{color:#c3e4ec}#${ROOT} .hero h2{font-size:25px;letter-spacing:-.7px;margin:7px 0}
  #${ROOT} .hero .muted{color:#d4e9ee;font-size:11px}
  #${ROOT} .tabs{position:sticky;top:42px;z-index:4;background:#f6f8fb;padding:10px 0;border-bottom:1px solid #e7edf2}
  #${ROOT} button{border:1px solid #d9e2e9;background:#fff;color:#253443;border-radius:999px;padding:9px 14px;font-size:11px}
  #${ROOT} button.on{background:#153e55;border-color:#153e55;color:#fff}
  #${ROOT} .compose{background:#fff;border:1px solid #e4eaf0;border-radius:17px;padding:14px;box-shadow:0 3px 14px #1830470a}
  #${ROOT} textarea,#${ROOT} .comment input{background:#f5f7fa;color:#18202b;border:1px solid #dfe6ec;border-radius:12px}
  #${ROOT} .card{background:#fff;border:1px solid #e6ebef;border-radius:17px;padding:14px;margin:12px 0;color:#18202b;box-shadow:0 4px 16px #1830470b}
  #${ROOT} .who{color:#152536;font-size:12px}#${ROOT} p{color:#344352;font-size:13px}
  #${ROOT} .avatar{width:42px;height:42px;overflow:hidden;background:#dce8ef;color:#183c52}
  #${ROOT} .avatar img{width:100%;height:100%;object-fit:cover}
  #${ROOT} .postimg{max-height:340px;aspect-ratio:16/10;object-fit:cover;border-radius:13px}
  #${ROOT} .tag{color:#24728a;background:#e8f4f7;border-radius:20px;padding:5px 8px}
  #${ROOT} .verified{color:#1688c2;font-weight:900}
  #${ROOT} .actions button{flex:1;background:#f5f8fa;border-color:#e5ebef;color:#365064}
  #${ROOT} .comment{border-color:#edf0f3;color:#596a78}
  #${ROOT} .muted,#${ROOT} small{color:#748493}
  #${ROOT} .account-cover{height:92px;border-radius:13px;background-size:cover;background-position:center;margin-bottom:-24px}
  #${ROOT} .account-row{display:flex;align-items:end;gap:10px;padding:0 8px 8px}
  #${ROOT} .account-avatar{width:58px;height:58px;border-radius:50%;border:3px solid white;object-fit:cover;background:#dbe5eb}
  #${ROOT} .account-name{font-weight:900;color:#172b3c;font-size:13px}
  #${ROOT} .account-stats{display:flex;gap:16px;font-size:10px;color:#647789;margin:8px 0}
  #${ROOT} .account-stats b{color:#1c3447}
  `;
  document.head.appendChild(style);
  app.innerHTML=`<button class="tbk" data-back>‹ Home</button><div id="${ROOT}"></div>`;
  app.querySelector("[data-back]").onclick=()=>window.__ph3d_phone?.showApp("home");
 },
 async _ensureNpcPosts(){
  const now=Date.now(); if(now-state.lastNpcPost<90000)return;
  const list=npcList().filter(n=>n&&!n.dead&&n.state!=="flee"&&n.state!=="attack");
  if(!list.length)return;
  const movers=list.filter(n=>n.state==="walk"||n.state==="idle"||n.path);
  const pool=movers.length?movers:list; const count=Math.min(2, pool.length);
  for(let i=0;i<count;i++){
   const n=pool[Math.floor(Math.random()*pool.length)]; if(!n)continue;
   const name=npcName(n,Math.floor(Math.random()*seedNames.length));
   const id="npc_"+(n.id||Math.random().toString(36).slice(2,9));
   if(state.posts.some(p=>p.id===id && Date.now()-p.time<3600000))continue;
   const caption=captions[Math.floor(Math.random()*captions.length)];
   /* Render a genuine in-game portrait of this exact NPC from the live 3D scene.
      If the NPC cannot be photographed, skip the post rather than use a stock face. */
   const selfie = npcSelfie(n);
   if (!selfie) continue;
   const image = await compactImage(selfie);
   const avatar = await squareAvatar(selfie);
   state.posts.unshift({id,author:name,authorId:id,avatar,verified:verifiedNpc(name,n),kind:"npc",text:caption,time:now-i*1200,image,location:"Port Harcourt",likes:Math.floor(Math.random()*36)+2,comments:Math.random()<.5?[{author:"City Resident",text:"Nice view of the city."}]:[],followingOnly:false});
  }
  state.lastNpcPost=now; state.posts=state.posts.slice(0,80); save();
 },
 async render(){
  this.ensure(); const root=document.getElementById(ROOT); if(!root)return;
  try{await Photos.load();}catch(_){}
  await this._ensureNpcPosts();
  if(!this._npcTimer)this._npcTimer=setInterval(async()=>{if(window.__ph3d_phone?.app!=="social"||!window.__ph3d_phone?.visible)return;const before=state.posts.length;await this._ensureNpcPosts();if(state.posts.length!==before)this.render();},30000);
  if(!state.posts.some(p=>p.authorId==="official_gcc"))state.posts.push({id:"official_gcc_welcome",author:"Garden City Updates",authorId:"official_gcc",verified:true,kind:"npc",text:"Welcome to Garden City Connect — your neighbourhood feed for Port Harcourt news, city moments and community updates.",time:Date.now()-5000,image:"",avatar:"",location:"Port Harcourt",likes:18,comments:[]}});
  save();
  const s=PhoneLife.snapshot(); const posts=state.posts.slice().sort((a,b)=>b.time-a.time);
  const myPhotos=Photos.list||[];
  const selected=myPhotos.find(p=>p.id===this._photoId);
  const following=state.following.length; const followers=state.followers.length;
  root.innerHTML=`<div class="hero"><small>GARDEN CITY CONNECT · PORT HARCOURT</small><h2>Discover your city.</h2><div class="row"><small>${s.dataMb} MB data · ${following} following · ${followers} followers</small><small>${posts.length} updates</small></div><div class="muted" style="margin-top:7px">Real moments, local creators and conversations from around the Garden City.</div></div>
  <section class="card" style="padding:10px"><div class="account-cover" style="background:linear-gradient(120deg,#173c56,#287e78)"></div><div class="account-row">${myPhotos[0]?`<img class="account-avatar" src="${esc(myPhotos[0].url)}" alt="Your latest in-game photo">`:`<div class="account-avatar" style="display:grid;place-items:center;font-weight:900;color:#17445a">YOU</div>`}<div><div class="account-name">Your Everyday Account</div><small>@everyday_player · Player account</small></div></div><div class="account-stats"><span><b>${posts.filter(p=>p.authorId==="player").length}</b> posts</span><span><b>${following}</b> following</span><span><b>${followers.length}</b> followers</span></div></section>
  <div class="tabs"><button data-tab="feed" class="${this._tab==="feed"?"on":""}">For You</button><button data-tab="following" class="${this._tab==="following"?"on":""}">Following</button><button data-tab="people" class="${this._tab==="people"?"on":""}">People</button></div>
  <div class="compose"><b style="font-size:12px">Create a post</b><textarea id="sc-text" maxlength="240" placeholder="What's happening in Port Harcourt?"></textarea><div class="row"><select id="sc-photo" style="max-width:65%;background:#0d1728;color:#dceaff;border:1px solid #405675;border-radius:8px;padding:8px"><option value="">No photo attached</option>${myPhotos.map(p=>`<option value="${esc(p.id)}" ${p.id===this._photoId?"selected":""}>${esc(p.caption||"Gallery photo")}</option>`).join("")}</select><button id="sc-post">POST · 5 MB</button></div><small>Photos are selected from your in-game Gallery.</small></div>
  <div id="sc-feed">${this._tab==="people"?this._peopleMarkup():posts.filter(p=>this._tab!=="following"||state.following.includes(p.authorId)).map(p=>this._postMarkup(p)).join("")||'<div class="card muted">No posts here yet. Follow some city residents to build your feed.</div>'}</div>`;
  root.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{this._tab=b.dataset.tab;this.render();});
  root.querySelector("#sc-photo").onchange=e=>{this._photoId=e.target.value;};
  root.querySelector("#sc-post").onclick=()=>this._publish(root);
  root.querySelectorAll("[data-like]").forEach(b=>b.onclick=()=>this._like(b.dataset.like));
  root.querySelectorAll("[data-follow]").forEach(b=>b.onclick=()=>this._follow(b.dataset.follow));
  root.querySelectorAll("[data-comment]").forEach(b=>b.onclick=()=>this._comment(b.dataset.comment));
 },
 _postMarkup(p){
  const liked=state.liked.includes(p.id), comments=state.comments[p.id]||p.comments||[];
  const img=p.image?`<img class="postimg" src="${esc(p.image)}" alt="Shared city moment">`:"";
  return `<article class="card"><div class="row"><div class="profile"><div class="avatar">${p.avatar?`<img src="${esc(p.avatar)}" alt="">`:esc((p.author||"C").slice(0,1).toUpperCase())}</div><div><div class="who">${esc(p.author||"City Resident")}${p.verified?'<span class="verified" title="Verified account">● VERIFIED</span>':''}</div><small>${esc(p.location||"Port Harcourt")} · ${new Date(p.time||Date.now()).toLocaleString()}</small></div></div>${p.kind==="npc"?'<span class="tag">CITY MOMENT</span>':'<span class="tag">YOUR COMMUNITY</span>'}</div><p>${esc(p.text)}</p>${img}<div class="actions"><button data-like="${esc(p.id)}">${liked?"♥ Liked":"♡ Like"} · ${Number(p.likes)||0}</button><button data-follow="${esc(p.authorId)}">${state.following.includes(p.authorId)?"Following":"Follow"}</button><button data-comment="${esc(p.id)}">Comment · ${comments.length}</button></div><div class="comment">${comments.slice(-2).map(c=>`<div><b>${esc(c.author)}:</b> ${esc(c.text)}</div>`).join("")}<input data-comment-input="${esc(p.id)}" maxlength="120" placeholder="Write a comment…"></div></article>`;
 },
 _peopleMarkup(){
  const seen=new Map(); for(const p of state.posts){if(p.authorId&&!seen.has(p.authorId))seen.set(p.authorId,p);}
  return [...seen.values()].map(p=>`<article class="card"><div class="row"><div class="profile"><div class="avatar">${p.avatar?`<img src="${esc(p.avatar)}" alt="">`:esc((p.author||"C").slice(0,1))}</div><div><div class="who">${esc(p.author)}${p.verified?'<span class="verified">● VERIFIED</span>':''}</div><small>Garden City resident · ${p.kind==="npc"?"NPC creator":"Player"}</small></div></div><button data-follow="${esc(p.authorId)}">${state.following.includes(p.authorId)?"Following":"Follow"}</button></div></article>`).join("")||'<div class="card muted">City accounts will appear as residents share updates.</div>';
 },
 async _publish(root){
  const text=root.querySelector("#sc-text").value.trim(), photoId=root.querySelector("#sc-photo").value;
  if(!text&&!photoId){toast("Write something or attach a gallery photo.");return;}
  const data=PhoneLife.useData(5); if(!data.ok){toast(data.reason==="no_phone"?"Buy a phone first.":"Not enough mobile data.");return;}
  const photo=(Photos.list||[]).find(p=>p.id===photoId);
  const image=photo?await compactImage(photo.url):"";
  const p={id:"player_"+Date.now().toString(36),author:"You",authorId:"player",verified:false,kind:"player",text:text||"Sharing a moment from my Gallery.",time:Date.now(),image,location:"Port Harcourt",likes:0,comments:[]};
  state.posts.unshift(p); state.posts=state.posts.slice(0,80); PhoneLife.state.posts=(PhoneLife.state.posts||0)+1; this._photoId=""; save();
  /* Nearby residents discover fresh player posts and react over time. */
  setTimeout(()=>{if(Math.random()<.78){p.likes=(p.likes||0)+1;if(Math.random()<.3&&!state.followers.includes("npc_fan_"+p.id))state.followers.push("npc_fan_"+p.id);const names=["Amaka N.","Chidi Works","Mimi Douglas","Kelechi Vibes"];const who=names[Math.floor(Math.random()*names.length)];(state.comments[p.id]||(state.comments[p.id]=[])).push({author:who,text:["Nice one!","This looks good.","PH is beautiful.","I like this update."][Math.floor(Math.random()*4)]});save();if(window.__ph3d_phone?.app==="social")this.render();}},4500);
  save(); this.render(); toast("Your post is live on Garden City Connect.");
 },
 _like(id){
  if(state.liked.includes(id)){toast("You already liked this post.");return;}
  const r=PhoneLife.useData(1); if(!r.ok){toast("Not enough mobile data.");return;}
  const p=state.posts.find(x=>x.id===id);if(!p)return;state.liked.push(id);p.likes=(p.likes||0)+1;PhoneLife.state.likes=(PhoneLife.state.likes||0)+1;save();this.render();
 },
 _follow(id){if(!id||id==="player")return;const i=state.following.indexOf(id);if(i>=0)state.following.splice(i,1);else state.following.push(id);save();this.render();toast(i>=0?"Unfollowed account.":"You are now following this account.");},
 _comment(id){const input=document.querySelector(`[data-comment-input="${CSS.escape(id)}"]`);const text=input&&input.value.trim();if(!text){toast("Write a comment first.");return;}const r=PhoneLife.useData(1);if(!r.ok){toast("Not enough mobile data.");return;}const list=state.comments[id]||(state.comments[id]=[]);list.push({author:"You",text,time:Date.now()});save();this.render();toast("Comment posted.");}
};
