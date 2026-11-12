import { Economy } from './economy.js';

const KEY='ph3d_real_estate_v1';
const CATALOG=[
 {id:'room',name:'Single Room',kind:'Rental',area:'Diobu',price:1800000,rent:18000,desc:'A modest room in a busy neighbourhood.'},
 {id:'selfcon',name:'Self-Contained Apartment',kind:'Apartment',area:'Rumuola',price:6500000,rent:65000,desc:'A compact private apartment.'},
 {id:'two-bed',name:'Two-Bedroom Flat',kind:'Family home',area:'Elelenwo',price:18500000,rent:180000,desc:'A comfortable home for a growing family.'},
 {id:'duplex',name:'Detached Duplex',kind:'Luxury',area:'GRA Phase 2',price:68000000,rent:650000,desc:'A premium detached property.'},
 {id:'mansion',name:'Luxury Mansion',kind:'Mansion',area:'Peter Odili Road',price:185000000,rent:1750000,desc:'A landmark luxury residence.'}
];
const PLOTS=[
 {id:'town',name:'Town Plot',area:'Choba',price:3500000},
 {id:'suburb',name:'Residential Plot',area:'Rumukrushi',price:8500000},
 {id:'estate',name:'Estate Plot',area:'Peter Odili Road',price:22000000}
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function read(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x&&x.v===1)return x;}catch(_){}return {v:1,owned:[],plots:[],totalRent:0,lastTick:Date.now(),decor:{}};}
const state=read();
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(_){}}
function tick(){const now=Date.now(), elapsed=clamp(now-(state.lastTick||now),0,7*86400000);const cycles=Math.floor(elapsed/(30*60*1000));if(cycles>0){let rent=0;state.owned.forEach(p=>{if(p.tenant)rent+=p.rent*cycles;});state.pending=(state.pending||0)+rent;state.totalRent=(state.totalRent||0)+rent;state.lastTick+=cycles*30*60*1000;save();}}
export const RealEstate={
 catalog:CATALOG,plots:PLOTS,
 snapshot(){tick();return {balance:Economy.balance,owned:state.owned,plots:state.plots,pending:state.pending||0,totalRent:state.totalRent||0,catalog:CATALOG,plotCatalog:PLOTS};},
 buy(id){tick();const d=CATALOG.find(x=>x.id===id);if(!d)return {ok:false,reason:'missing'};if(state.owned.some(x=>x.id===id))return {ok:false,reason:'owned'};if(!Economy.withdraw(d.price))return {ok:false,reason:'funds'};state.owned.push({...d,tenant:true,condition:100,level:1});save();return {ok:true};},
 sell(id){const i=state.owned.findIndex(x=>x.id===id);if(i<0)return {ok:false};const p=state.owned[i];const value=Math.floor(p.price*(0.55+(p.condition||100)/500));state.owned.splice(i,1);Economy.receive('Property sale',value,p.name);save();return {ok:true,value};},
 toggleTenant(id){const p=state.owned.find(x=>x.id===id);if(!p)return {ok:false};p.tenant=!p.tenant;save();return {ok:true,tenant:p.tenant};},
 upgrade(id){const p=state.owned.find(x=>x.id===id);if(!p||p.level>=5)return {ok:false,reason:'limit'};const cost=Math.floor(p.price*(.06*p.level));if(!Economy.withdraw(cost))return {ok:false,reason:'funds'};p.level++;p.condition=100;p.rent=Math.floor(p.rent*1.18);save();return {ok:true,cost};},
 buyPlot(id){const d=PLOTS.find(x=>x.id===id);if(!d||state.plots.some(x=>x.id===id))return {ok:false,reason:'owned'};if(!Economy.withdraw(d.price))return {ok:false,reason:'funds'};state.plots.push({...d,stage:0});save();return {ok:true};},
 build(id){const p=state.plots.find(x=>x.id===id);if(!p||p.stage>=3)return {ok:false,reason:'limit'};const costs=[2500000,6500000,12000000],cost=costs[p.stage];if(!Economy.withdraw(cost))return {ok:false,reason:'funds'};p.stage++;save();return {ok:true,cost};},
 collect(){tick();const amount=Math.floor(state.pending||0);if(!amount)return {ok:false};state.pending=0;Economy.receive('Rental income',amount,'Collected property rent');save();return {ok:true,amount};},
 decorate(id,kind){const p=state.owned.find(x=>x.id===id);if(!p)return {ok:false};const choices={paint:180000,furniture:450000,security:650000,landscape:320000};const cost=choices[kind];if(!cost||!Economy.withdraw(cost))return {ok:false,reason:'funds'};state.decor[id]=state.decor[id]||[];if(!state.decor[id].includes(kind))state.decor[id].push(kind);p.condition=clamp((p.condition||100)+5,0,100);save();return {ok:true,cost};}
};
