/* Story campaign — 12 connected chapters. Each chapter ends by sending the player to the next
   person/place, so the story always flows straight into real gameplay (jobs, businesses, places).
   Events: job, businessBuy, businessCollect, businessUpgrade, visit:<sceneId>. */
import { Economy } from "./economy.js";
const KEY = "ph3d_story_campaign_v2", OLD_KEY = "ph3d_story_campaign_v1";
const CHAPTERS = [
  { id:"first-day", chapter:"CHAPTER 1", title:"A Fresh Start", contact:"Aunty Nneka", scene:"Mile 1 Market", cinematic:"story-01-the-first-day.html",
    brief:"You have just arrived in Port Harcourt with a little cash and big plans. Aunty Nneka took you in and wants to see if you can handle your first honest job.",
    dialogue:["Welcome to Port Harcourt, my child.","This city rewards people who show up and do the work.","Open your phone, tap Jobs and finish one job. Then come back for your next step."],
    objective:"Complete 1 delivery, taxi or repair job", event:"job", target:1, reward:12000, next:"Next: Aunty Nneka sends you to Emeka at the Job Centre." },
  { id:"meet-emeka", chapter:"CHAPTER 2", title:"The Dispatcher", contact:"Emeka the Dispatcher", scene:"Job Centre", where:"jobcenter",
    brief:"That first job got around fast. Aunty Nneka says Emeka runs the city's best work and wants to meet you in person.",
    dialogue:["Aunty Nneka told me about you.","Come to the Job Centre. I do not give good jobs to strangers, so let me see your face."],
    objective:"Visit the Job Centre", event:"visit:jobcenter", target:1, reward:8000, next:"Next: Emeka wants proof you can be consistent." },
  { id:"earn-your-name", chapter:"CHAPTER 3", title:"Earn Your Name", contact:"Emeka the Dispatcher", scene:"Port Harcourt streets",
    brief:"Emeka looked you up and down. One job can be luck. Now he wants to see steady work before he trusts you with bigger money.",
    dialogue:["One job can be luck. Three jobs means you are serious.","Keep your eyes open and bring every job to a proper finish."],
    objective:"Complete 3 more jobs", event:"job", target:3, reward:25000, next:"Next: with money in hand, Mama Chika has an offer." },
  { id:"mama-chika", chapter:"CHAPTER 4", title:"Mama Chika's Offer", contact:"Mama Chika", scene:"Mile 1 Market", where:"market", cinematic:"story-03-a-pleasure-park-promise.html",
    brief:"Word reached the market that you are reliable. Mama Chika, who has watched traders rise and fall for thirty years, asked for you by name.",
    dialogue:["I hear you have been working hard. Come to the market.","I have something to show you, and it is not a job."],
    objective:"Visit Mile 1 Market", event:"visit:market", target:1, reward:10000, next:"Next: Mama Chika wants you to own something." },
  { id:"big-plans", chapter:"CHAPTER 5", title:"A Business of Your Own", contact:"Mama Chika", scene:"Business app",
    brief:"Mama Chika says wages feed you today, but ownership feeds you for life. Open the Business app on your phone and buy a shop that suits you.",
    dialogue:["Salary is good, but ownership can change your future.","Start small, learn the market, and treat customers well."],
    objective:"Purchase your first business", event:"businessBuy", target:1, reward:50000, next:"Next: keep it running and see what it earns." },
  { id:"first-profit", chapter:"CHAPTER 6", title:"The First Profit", contact:"Mama Chika", scene:"Your Business",
    brief:"Your shop is open. Keep it stocked, let sales happen, then collect the profit it has earned.",
    dialogue:["Do not confuse sales with profit.","Watch your stock and expenses. Collect your first business earnings."],
    objective:"Collect business earnings once", event:"businessCollect", target:1, reward:35000, next:"Next: Mr. Briggs noticed your shop." },
  { id:"level-up", chapter:"CHAPTER 7", title:"Growing Pains", contact:"Mr. Briggs", scene:"Business District",
    brief:"Mr. Briggs, a big name in the business district, saw your first profit. He believes you can grow, but only if you reinvest.",
    dialogue:["Growth requires reinvestment.","Upgrade one of your businesses and plan for the next stage."],
    objective:"Upgrade a business once", event:"businessUpgrade", target:1, reward:60000, next:"Next: the city is starting to know your name." },
  { id:"city-respect", chapter:"CHAPTER 8", title:"Respect in the City", contact:"Aunty Nneka", scene:"Port Harcourt",
    brief:"Aunty Nneka is proud. Your shop is growing, but she reminds you that your name was built on jobs well done.",
    dialogue:["You came here with a dream. Now you have a foundation.","Do five more jobs and the whole city will know you can be trusted."],
    objective:"Complete 5 more jobs", event:"job", target:5, reward:100000, next:"Next: time to stop renting and find a real home." },
  { id:"home", chapter:"CHAPTER 9", title:"A Home of Your Own", contact:"Mr. Briggs", scene:"Real Estate Office", where:"realestate",
    brief:"Mr. Briggs knows an agent who handles the best properties in town. A man with a growing business should sleep in his own house.",
    dialogue:["A serious man needs a serious address.","Go to the Real Estate Office and see what your money can do."],
    objective:"Visit the Real Estate Office", event:"visit:realestate", target:1, reward:30000, next:"Next: celebrate at Hotel Presidential." },
  { id:"celebrate", chapter:"CHAPTER 10", title:"The Presidential Suite", contact:"Mama Chika", scene:"Hotel Presidential", where:"hotel", cinematic:"story-04-the-presidential-suite.html",
    brief:"Mama Chika invites you to Hotel Presidential to celebrate how far you have come. Important people will be there.",
    dialogue:["You have earned a night out. Dress well.","Meet me at Hotel Presidential. Someone there wants to meet you."],
    objective:"Visit Hotel Presidential", event:"visit:hotel", target:1, reward:40000, next:"Next: a promise waits at the Pleasure Park." },
  { id:"park-promise", chapter:"CHAPTER 11", title:"A Pleasure Park Promise", contact:"Aunty Nneka", scene:"Pleasure Park", where:"pleasurepark", cinematic:"story-03-a-pleasure-park-promise.html",
    brief:"At the hotel you made a promise to spend a day at the Pleasure Park with the people who helped you get here.",
    dialogue:["A promise is a debt, my child.","Go to the Pleasure Park. Enjoy the rides, you have earned it."],
    objective:"Visit the Pleasure Park", event:"visit:pleasurepark", target:1, reward:45000, next:"Next: a problem at the State House." },
  { id:"briefcase", chapter:"CHAPTER 12", title:"The Missing Briefcase", contact:"Mr. Briggs", scene:"State House", where:"statehouse", cinematic:"story-05-the-missing-briefcase.html",
    brief:"Mr. Briggs calls late. A briefcase with important business papers has gone missing, and the trail leads to the State House.",
    dialogue:["I need someone I can trust, and that is you.","Go to the State House and see what you can find out."],
    objective:"Visit the State House", event:"visit:statehouse", target:1, reward:150000, next:"Campaign complete. Your story is yours to write." }
];
function load(){
  try{ const v=localStorage.getItem(KEY); if(v) return JSON.parse(v)||{};
    /* migrate v1 progress into the new 12-chapter order */
    const o=JSON.parse(localStorage.getItem(OLD_KEY)||"null"); if(o&&Number.isFinite(o.index)){
      const map=[0,2,4,5,6,7,8]; return {index:map[Math.min(o.index,6)],progress:o.progress||0,claimed:{}}; }
  }catch(_){}
  return {};
}
const state=load();
if(!Number.isFinite(state.index)) state.index=0;
if(!Number.isFinite(state.progress)) state.progress=0;
if(!state.claimed || typeof state.claimed!=="object") state.claimed={};
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){console.warn("[campaign] save failed",e)}}
function active(){return state.index>=CHAPTERS.length?null:CHAPTERS[state.index]}
function toast(t){try{window.__ph3d_phone?._toast?.(t)}catch(_){}}
function add(event){const m=active(); if(!m||m.event!==event||state.progress>=m.target)return;
  state.progress=Math.min(m.target,state.progress+1);save();
  toast(state.progress>=m.target?`📖 ${m.chapter} done: open Story on your phone to collect ₦${m.reward.toLocaleString("en-NG")}`:`📖 ${m.objective}: ${state.progress}/${m.target}`);
  window.dispatchEvent(new CustomEvent("ph3d:campaign-progress"));}
window.addEventListener("ph3d:job-complete",()=>add("job"));
window.addEventListener("ph3d:business-buy",()=>add("businessBuy"));
window.addEventListener("ph3d:business-collect",()=>add("businessCollect"));
window.addEventListener("ph3d:business-upgrade",()=>add("businessUpgrade"));
window.addEventListener("ph3d:scene-enter",e=>{const d=e.detail||{};add("visit:"+d.id); if(d.name!==d.id) add("visit:"+d.name);});

/* ── small always-on HUD chip so the story is visible while you play ── */
function chip(){
  if(!document.body) return;
  let el=document.getElementById("ph3d-story-chip");
  if(!el){
    const st=document.createElement("style");
    st.textContent="#ph3d-story-chip{position:fixed;left:8px;top:calc(env(safe-area-inset-top,0px) + 8px);z-index:26;max-width:min(46vw,260px);padding:6px 10px;border-radius:12px;background:rgba(10,16,13,.78);color:#f3f1e8;border:1px solid rgba(231,186,255,.4);font:700 11px/1.3 Archivo,system-ui,sans-serif;display:none;cursor:pointer;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}#ph3d-story-chip.on{display:block}#ph3d-story-chip small{display:block;color:#e6baff;font-size:9px;letter-spacing:.14em}#ph3d-story-chip.done{border-color:#35d07f}";
    document.head.appendChild(st);
    el=document.createElement("div");el.id="ph3d-story-chip";
    el.onclick=()=>{try{const ph=window.__ph3d_phone;if(ph&&!ph.visible)ph.show();ph?.showApp("story")}catch(_){}};
    document.body.appendChild(el);
  }
  const m=active();
  if(!m){el.classList.remove("on");return;}
  const done=state.progress>=m.target;
  el.classList.toggle("done",done);
  el.innerHTML=`<small>${m.chapter} · ${m.title.toUpperCase()}</small>${done?"Done! Tap to collect reward":`${m.objective} (${state.progress}/${m.target})`}`;
  el.classList.add("on");
}
window.addEventListener("ph3d:campaign-progress",chip);
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",chip); else setTimeout(chip,0);

export const StoryCampaign={
  chapters:CHAPTERS,
  snapshot(){const m=active();return {index:state.index,progress:state.progress,chapter:m?JSON.parse(JSON.stringify(m)):null,complete:!!m&&state.progress>=m.target,finished:state.index>=CHAPTERS.length,claimed:{...state.claimed},total:CHAPTERS.length}},
  claim(){const m=active();if(!m||state.progress<m.target||state.claimed[m.id])return {ok:false};state.claimed[m.id]=true;Economy.receive("Story reward",m.reward,m.title);state.index++;state.progress=0;save();window.dispatchEvent(new CustomEvent("ph3d:campaign-progress"));return {ok:true,reward:m.reward,next:m.next,cinematic:m.cinematic||null,finished:state.index>=CHAPTERS.length};},
  reset(){state.index=0;state.progress=0;state.claimed={};save();window.dispatchEvent(new CustomEvent("ph3d:campaign-progress"));}
};
