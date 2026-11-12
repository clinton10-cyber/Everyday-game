/* Phase 5 — Story campaign. Progress is event-driven and stored separately. */
import { Economy } from "./economy.js";
const KEY = "ph3d_story_campaign_v1";
const CHAPTERS = [
  { id:"first-day", chapter:"CHAPTER 1", title:"A Fresh Start", contact:"Aunty Nneka", scene:"Mile 1 Market", brief:"You have arrived in Port Harcourt with a little cash and big plans. Aunty Nneka knows the city and wants to see if you can handle your first honest job.", dialogue:["Welcome to Port Harcourt, my child.","This city rewards people who show up and do the work.","Complete one delivery, then come and see me."], objective:"Complete 1 delivery, taxi or repair job", event:"job", target:1, reward:12000 },
  { id:"earn-your-name", chapter:"CHAPTER 2", title:"Earn Your Name", contact:"Emeka the Dispatcher", scene:"City Job Centre", brief:"Word is spreading that you are reliable. Emeka has more work, but he wants proof that you can finish jobs consistently.", dialogue:["One job can be luck. Three jobs means you are serious.","Keep your eyes open and bring every job to a proper finish."], objective:"Complete 3 more jobs", event:"job", target:3, reward:25000 },
  { id:"big-plans", chapter:"CHAPTER 3", title:"A Business of Your Own", contact:"Mama Chika", scene:"Neighbourhood Market", brief:"Mama Chika is ready to help you take your first step into business. Choose a shop that suits your ambition and buy it through the Business app.", dialogue:["Salary is good, but ownership can change your future.","Start small, learn the market, and treat customers well."], objective:"Purchase your first business", event:"businessBuy", target:1, reward:50000 },
  { id:"first-profit", chapter:"CHAPTER 4", title:"The First Profit", contact:"Mama Chika", scene:"Your Business", brief:"A shop is only the beginning. Keep it stocked, allow sales to happen, then collect the profit your business has earned.", dialogue:["Do not confuse sales with profit.","Watch your stock and expenses. Collect your first business earnings."], objective:"Collect business earnings once", event:"businessCollect", target:1, reward:35000 },
  { id:"level-up", chapter:"CHAPTER 5", title:"Growing Pains", contact:"Mr. Briggs", scene:"Business District", brief:"Your business has potential. Invest in an upgrade to improve its capacity and build a stronger operation.", dialogue:["Growth requires reinvestment.","Upgrade one of your businesses and plan for the next stage."], objective:"Upgrade a business once", event:"businessUpgrade", target:1, reward:60000 },
  { id:"city-respect", chapter:"CHAPTER 6", title:"Respect in the City", contact:"Aunty Nneka", scene:"Port Harcourt", brief:"You have made a start. Complete five more jobs and show the city that your progress is built on consistency.", dialogue:["You came here with a dream. Now you have a foundation.","Keep building. Port Harcourt is full of opportunities."], objective:"Complete 5 more jobs", event:"job", target:5, reward:100000 }
];
function load(){try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch(_){return {}}}
const state=load();
if(!Number.isFinite(state.index)) state.index=0;
if(!Number.isFinite(state.progress)) state.progress=0;
if(!state.claimed || typeof state.claimed!=="object") state.claimed={};
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){console.warn("[campaign] save failed",e)}}
function active(){return CHAPTERS[Math.min(state.index,CHAPTERS.length-1)]||null}
function add(event){const m=active(); if(!m||m.event!==event||state.progress>=m.target)return;state.progress=Math.min(m.target,state.progress+1);save();window.dispatchEvent(new CustomEvent("ph3d:campaign-progress"));}
window.addEventListener("ph3d:job-complete",()=>add("job"));
window.addEventListener("ph3d:business-buy",()=>add("businessBuy"));
window.addEventListener("ph3d:business-collect",()=>add("businessCollect"));
window.addEventListener("ph3d:business-upgrade",()=>add("businessUpgrade"));
export const StoryCampaign={
  chapters:CHAPTERS,
  snapshot(){const m=active();return {index:state.index,progress:state.progress,chapter:m?JSON.parse(JSON.stringify(m)):null,complete:!!m&&state.progress>=m.target,finished:state.index>=CHAPTERS.length,claimed:{...state.claimed}}},
  claim(){const m=active();if(!m||state.progress<m.target||state.claimed[m.id])return {ok:false};state.claimed[m.id]=true;Economy.receive("Story reward",m.reward,m.title);state.index++;state.progress=0;save();window.dispatchEvent(new CustomEvent("ph3d:campaign-progress"));return {ok:true,reward:m.reward,finished:state.index>=CHAPTERS.length};},
  reset(){state.index=0;state.progress=0;state.claimed={};save();window.dispatchEvent(new CustomEvent("ph3d:campaign-progress"));}
};
