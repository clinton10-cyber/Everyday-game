/* Hotel Presidential guest services. Local single-player simulation. */
import { Economy } from "../../core/economy.js";
import { NPCs } from "../../core/npcs.js";
import { nearestU } from "../../core/npc-paths.js";

const BOOKINGS_KEY = "ph3d.hotel.bookings.v2";
const REQUESTS_KEY = "ph3d.hotel.guest-services.v1";
const VALET_KEY = "ph3d.hotel.valet.v1";
const ROOM_STATUS_KEY = "ph3d.hotel.room-status.v1";
const MONEY = n => Economy.format(n);

const CATALOG = {
  room: [
    { id:"jollof", name:"Jollof rice & grilled chicken", category:"Nigerian favourites", price:9500, duration:14000 },
    { id:"friedrice", name:"Fried rice & turkey", category:"Nigerian favourites", price:12500, duration:15000 },
    { id:"pepper", name:"Goat meat pepper soup", category:"Nigerian favourites", price:8500, duration:13000 },
    { id:"breakfast", name:"Presidential breakfast", category:"Breakfast", price:18000, duration:12000 },
    { id:"club", name:"Club sandwich & fries", category:"Light meals", price:6500, duration:10000 },
    { id:"juice", name:"Fresh juice selection", category:"Drinks", price:3500, duration:8000 },
    { id:"platter", name:"Presidential sharing platter", category:"Chef's special", price:35000, duration:18000 },
  ],
  housekeeping: [
    { id:"refresh", name:"Room refresh & tidy-up", price:1500, duration:12000 },
    { id:"linen", name:"Fresh bedsheets and towels", price:2500, duration:14000 },
    { id:"amenities", name:"Restock toiletries and water", price:1800, duration:9000 },
    { id:"deepclean", name:"Full housekeeping service", price:4500, duration:20000 },
  ],
  laundry: [
    { id:"laundry-small", name:"Laundry bag (up to 5 items)", price:4500, duration:18000 },
    { id:"laundry-large", name:"Laundry bag (up to 12 items)", price:8500, duration:24000 },
    { id:"press", name:"Express pressing (3 items)", price:3500, duration:12000 },
  ],
  concierge: [
    { id:"cityride", name:"Arrange a city ride", price:6500, duration:10000 },
    { id:"airport", name:"Airport transfer request", price:22000, duration:16000 },
    { id:"tour", name:"Port Harcourt city tour", price:28000, duration:18000 },
    { id:"dining", name:"Restaurant reservation assistance", price:3000, duration:8000 },
  ],
  luggage: [
    { id:"bags-in", name:"Bring luggage to my room", price:0, duration:9000 },
    { id:"bags-out", name:"Collect luggage for checkout", price:0, duration:9000 },
  ],
  valet: [
    { id:"valet-standard", name:"Standard valet parking", price:2000, duration:9000 },
    { id:"valet-vip", name:"VIP covered parking", price:5000, duration:11000 },
    { id:"valet-night", name:"Overnight secure parking", price:7500, duration:12000 },
  ],
};

function read(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key) || "null"); return v == null ? fallback : v; }
  catch (_) { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (_) { return false; }
}
function currentStay() {
  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,10);
  const bookings = read(BOOKINGS_KEY, []);
  return bookings.find(b => b.status === "checked-in" && b.checkIn <= today && b.checkOut > today) || null;
}
function notify(message) {
  try { window.__ph3d_phone?._toast(message); } catch (_) {}
  window.dispatchEvent(new CustomEvent("hotel:notification", { detail:{ message, at:Date.now() } }));
}

export const HotelGuestServices = {
  scene: null,
  ctl: null,
  root: null,
  elapsed: 0,
  init(scene, ctl) { this.scene = scene; this.ctl = ctl; this._resumeStaffRoutes(); },
  dispose() { if (this.root) this.root.remove(); this.root = null; this.scene = null; this.ctl = null; },
  open(tab="room") {
    const stay = currentStay();
    if (!stay) { notify("Please check in at reception before requesting guest services."); return; }
    if (!this.root) this._build();
    this.root.dataset.tab = tab;
    this.root.style.display = "flex";
    this.render();
  },
  _build() {
    const root = document.createElement("div");
    root.id = "ph3d-hotel-guest-services";
    root.style.cssText = "position:fixed;inset:0;z-index:140;display:none;align-items:center;justify-content:center;padding:12px;background:rgba(4,7,12,.86);backdrop-filter:blur(12px);font-family:system-ui;color:#f8f2e7";
    root.innerHTML = `<section style="width:min(820px,98vw);max-height:94vh;overflow:auto;border:1px solid #c7a66d;border-radius:22px;background:linear-gradient(145deg,#29231b,#101217);box-shadow:0 28px 100px #000;padding:18px">
      <header style="display:flex;gap:12px;align-items:center"><div style="flex:1"><small style="color:#d9bd82;letter-spacing:.2em">HOTEL PRESIDENTIAL · GUEST EXPERIENCE</small><h2 style="margin:5px 0;font-size:24px">How may we serve you?</h2><div data-stay style="color:#c8bda9;font-size:12px"></div></div><button data-close aria-label="Close" style="width:42px;height:42px;border-radius:50%;border:1px solid #8a744f;background:#211d18;color:#fff;font-size:22px">×</button></header>
      <nav data-tabs style="display:flex;gap:7px;overflow:auto;padding:15px 0 10px"></nav>
      <div data-content></div>
      <h3 style="font-size:15px;color:#e2c58b;margin:20px 0 8px">Your service requests</h3><div data-requests style="display:grid;gap:8px"></div>
      <p data-status role="status" style="min-height:18px;color:#e5c98d;font-size:12px"></p>
      <div style="display:flex;justify-content:space-between;border-top:1px solid #51432e;padding-top:12px;font-size:13px"><span>Everyday Pay balance</span><b data-balance style="color:#e8ca8b"></b></div>
    </section>`;
    document.body.appendChild(root); this.root = root;
    root.querySelector("[data-close]").onclick = () => root.style.display = "none";
    root.addEventListener("pointerdown", e => { if (e.target === root) root.style.display = "none"; });
  },
  render() {
    if (!this.root) return;
    const root = this.root, tab = root.dataset.tab || "room", stay = currentStay();
    root.querySelector("[data-stay]").textContent = stay ? `${stay.name || "Guest room"} · ${stay.checkIn} to ${stay.checkOut} · Booking ${stay.id}` : "No active checked-in reservation";
    root.querySelector("[data-balance]").textContent = MONEY(Economy.balance);
    const tabs = [["room","Room service"],["housekeeping","Housekeeping"],["laundry","Laundry"],["concierge","Concierge"],["luggage","Luggage"],["valet","Valet"]];
    const nav = root.querySelector("[data-tabs]"); nav.innerHTML = "";
    tabs.forEach(([key,label]) => { const b=document.createElement("button"); b.textContent=label; b.style.cssText=`white-space:nowrap;padding:10px 13px;border-radius:10px;border:1px solid ${tab===key?"#d2b16f":"#5e513d"};background:${tab===key?"#c8a56a":"#211f1b"};color:${tab===key?"#21180c":"#eee3d0"};font-weight:800`; b.onclick=()=>{root.dataset.tab=key;this.render();}; nav.appendChild(b); });
    const content = root.querySelector("[data-content]"); content.innerHTML = "";
    if (tab === "valet") {
      const valet = read(VALET_KEY, { status:"not-parked" });
      const panel=document.createElement("div"); panel.style.cssText="padding:13px;border:1px solid #806a45;border-radius:13px;background:rgba(201,167,107,.08);margin-bottom:12px";
      const status=document.createElement("div"); status.textContent=`Vehicle status: ${(valet.status||"not-parked").replaceAll("-"," ").toUpperCase()}${valet.vehicle?" · "+valet.vehicle:""}${valet.ticket?" · Ticket "+valet.ticket:""}`; status.style.cssText="font-size:12px;color:#e9d5ae;margin-bottom:10px";
      const vehicle=document.createElement("input"); vehicle.dataset.vehicle=""; vehicle.placeholder="Vehicle name / model (e.g. Lexus SUV)"; vehicle.value=valet.vehicle||"My vehicle"; vehicle.maxLength=40; vehicle.style.cssText="width:100%;box-sizing:border-box;padding:11px;border:1px solid #62533b;border-radius:9px;background:#171713;color:white;margin-bottom:9px";
      panel.append(status,vehicle);
      if (valet.status === "parked") {
        const retrieve=document.createElement("button"); retrieve.textContent="REQUEST VEHICLE RETRIEVAL"; retrieve.style.cssText="width:100%;padding:11px;border:0;border-radius:9px;background:#c9a76b;color:#21170a;font-weight:900";
        retrieve.onclick=()=>this.request("valet",{id:"valet-retrieve",name:"Vehicle retrieval",price:0,duration:9000}); panel.appendChild(retrieve);
      } else {
        const hint=document.createElement("small"); hint.textContent="Choose a parking package below. Your valet ticket will be saved here."; hint.style.color="#b9ad98"; panel.appendChild(hint);
      }
      content.appendChild(panel);
    }
    if (tab === "housekeeping") {
      const roomStatus=read(ROOM_STATUS_KEY,{status:"occupied"});
      const badge=document.createElement("div"); badge.textContent="Room status: "+String(roomStatus.status||"occupied").replaceAll("-"," ").toUpperCase(); badge.style.cssText="padding:10px 12px;margin-bottom:10px;border:1px solid #5a4a32;border-radius:10px;color:#e5c98d;font-size:12px"; content.appendChild(badge);
    }
    const list = CATALOG[tab] || CATALOG.room;
    list.forEach(item => {
      const card=document.createElement("article"); card.style.cssText="display:flex;align-items:center;gap:12px;justify-content:space-between;padding:12px;border:1px solid #5a4a32;border-radius:13px;background:rgba(255,255,255,.035);margin:7px 0";
      const info=document.createElement("div"); info.style.flex="1";
      const name=document.createElement("b"); name.textContent=item.name; name.style.display="block";
      const sub=document.createElement("small"); sub.textContent=(item.category?item.category+" · ":"")+ (item.price ? MONEY(item.price) : "Complimentary") + " · about " + Math.round(item.duration/1000) + " sec"; sub.style.color="#b9ad98";
      info.append(name,sub);
      const button=document.createElement("button"); button.textContent=item.price?"ORDER":"REQUEST"; button.style.cssText="border:0;border-radius:9px;padding:10px 13px;background:#c9a76b;color:#21170a;font-weight:900";
      button.onclick=()=>this.request(tab,item);
      card.append(info,button); content.appendChild(card);
    });
    this.renderRequests();
  },
  request(category, item) {
    const stay=currentStay();
    if (!stay) { this.root.querySelector("[data-status]").textContent="Your stay is not active. Check in at reception first."; return; }
    const requests=read(REQUESTS_KEY, []);
    if (category === "valet") {
      const valet=read(VALET_KEY,{status:"not-parked"});
      if (item.id === "valet-retrieve" && valet.status !== "parked") { this.root.querySelector("[data-status]").textContent="There is no vehicle currently parked with the valet."; return; }
      if (item.id !== "valet-retrieve" && valet.status === "parked") { this.root.querySelector("[data-status]").textContent="Retrieve your parked vehicle before requesting another parking ticket."; return; }
    }
    if (requests.filter(r=>r.status!=="completed"&&r.status!=="cancelled").length>=5) { this.root.querySelector("[data-status]").textContent="Please wait for an existing request to finish before adding more."; return; }
    const cost=Math.max(0,Math.floor(item.price||0));
    if (cost && !Economy.withdraw(cost)) { this.root.querySelector("[data-status]").textContent="Insufficient Everyday Pay balance."; return; }
    const valetVehicle=category === "valet" ? (this.root.querySelector("[data-vehicle]")?.value.trim() || read(VALET_KEY,{vehicle:"My vehicle"}).vehicle || "My vehicle") : null;
    const req={id:"HPS-"+Date.now().toString(36).toUpperCase(),category,itemId:item.id,title:item.name,cost,createdAt:Date.now(),duration:item.duration,status:"requested",bookingId:stay.id,room:stay.room||"suite101",vehicle:valetVehicle,assignedStaff:null,progress:0};
    requests.push(req); write(REQUESTS_KEY,requests.slice(-50));
    if (category === "housekeeping") write(ROOM_STATUS_KEY,{room:req.room,status:"housekeeping-requested",updatedAt:Date.now()});
    this._dispatchStaff(req);
    notify(`${item.name} request received${cost?" · "+MONEY(cost)+" paid":""}.`);
    this.root.querySelector("[data-status]").textContent="Request received. A hotel team member has been assigned.";
    this.render();
  },
  _dispatchStaff(req) {
    const roles = req.category === "room" ? ["chef","hotel_staff"] : req.category === "housekeeping" || req.category === "laundry" ? ["housekeeper","hotel_staff"] : req.category === "valet" ? ["hotel_staff"] : ["hotel_staff","housekeeper"];
    const npc = NPCs.list.find(n=>!n.dead && roles.includes(n.role) && !n._hotelBusy && n.ctl && n.group);
    if (!npc) return;
    npc._hotelBusy = req.id; req.assignedStaff = npc.id || npc.role;
    const start=[npc.ctl.pos.x,npc.ctl.pos.z];
    const target=this._destinationFor(req);
    const mid=[(start[0]+target[0])/2,(start[1]+target[1])/2];
    npc.path={id:"hotel-service-"+req.id,closed:false,speed:0.9,points:[start,mid,target]};
    npc.pathU=nearestU(npc.path,start[0],start[1]); npc.pathDir=1; npc.stationary=false; npc.state="walk"; npc.stateT=60; npc.moveSpeed=1.1; npc._hotelRequest=req.id;
    req._npcRef=npc;
  },
  _destinationFor(req) {
    if (req.category === "room" || req.category === "housekeeping" || req.category === "laundry" || req.category === "luggage") {
      const map={suite101:[5.5,22],suite102:[16.5,22],suite103:[27.5,22],classic:[5.5,22],executive:[16.5,22],deluxe:[27.5,22],presidential:[27.5,22],royal:[27.5,22]};
      return map[req.room] || [16.5,22];
    }
    if (req.category === "valet") return [20,8];
    return [39,5.5];
  },
  renderRequests() {
    if (!this.root) return;
    const box=this.root.querySelector("[data-requests]"); box.innerHTML="";
    const rows=read(REQUESTS_KEY,[]).slice().reverse().slice(0,8);
    if (!rows.length) { const p=document.createElement("p"); p.textContent="No requests yet."; p.style.color="#a99b86"; box.appendChild(p); return; }
    rows.forEach(r=>{
      const row=document.createElement("div"); row.style.cssText="display:flex;align-items:center;gap:8px;justify-content:space-between;padding:10px;border:1px solid #4e432f;border-radius:10px;background:#171713";
      const info=document.createElement("span"); info.textContent=`${r.title} · ${r.status.toUpperCase()} · ${r.cost?MONEY(r.cost):"Complimentary"}`; info.style.cssText="font-size:12px;flex:1";
      row.appendChild(info);
      if (r.status === "requested") { const cancel=document.createElement("button"); cancel.textContent="CANCEL"; cancel.style.cssText="border:1px solid #81584c;background:#301d19;color:#ffd9cc;padding:7px 9px;border-radius:8px"; cancel.onclick=()=>this.cancel(r.id); row.appendChild(cancel); }
      box.appendChild(row);
    });
  },
  cancel(id) {
    const rows=read(REQUESTS_KEY,[]), r=rows.find(x=>x.id===id && x.status==="requested");
    if (!r) return;
    r.status="cancelled"; r.completedAt=Date.now(); if(r.cost) Economy.receive("Hotel Presidential",r.cost,"Guest service cancellation refund");
    if (r.category === "housekeeping") write(ROOM_STATUS_KEY,{room:r.room,status:"occupied",updatedAt:Date.now()});
    write(REQUESTS_KEY,rows); notify("Request cancelled. Eligible refund returned to Everyday Pay."); this.render();
  },
  tick(dt) {
    this.elapsed += dt || 0;
    if (this.elapsed < 0.5) return; this.elapsed=0;
    const rows=read(REQUESTS_KEY,[]); let changed=false;
    rows.forEach(r=>{
      if (r.status === "completed" || r.status === "cancelled") return;
      const age=Date.now()-r.createdAt;
      if (age > Math.min(9000,Math.max(2500,r.duration*0.38)) && r.status === "requested") {
        r.status="in-progress"; changed=true;
        if (r.category === "housekeeping") write(ROOM_STATUS_KEY,{room:r.room,status:"cleaning",updatedAt:Date.now()});
      }
      if (age >= r.duration) {
        r.status="completed"; r.completedAt=Date.now(); changed=true;
        if (r.category === "housekeeping") write(ROOM_STATUS_KEY,{room:r.room,status:"occupied-clean",updatedAt:Date.now()});
        if (r.category === "valet" && r.itemId === "valet-retrieve") write(VALET_KEY,{status:"retrieved",vehicle:r.vehicle||"My vehicle",retrievedAt:Date.now(),ticket:null});
        else if (r.category === "valet") write(VALET_KEY,{status:"parked",vehicle:r.vehicle||"My vehicle",ticket:"VP-"+r.id.slice(-6),parkedAt:Date.now()});
        const npc=NPCs.list.find(n=>n._hotelRequest===r.id); if(npc){npc._hotelBusy=null;npc._hotelRequest=null;npc.stationary=true;npc.state="idle";npc.stateT=2;}
        notify(`${r.title} is complete. ${r.category==="room"?"Your order has arrived at your suite.":"Thank you for using Hotel Presidential."}`);
      }
    });
    if(changed){write(REQUESTS_KEY,rows);if(this.root&&this.root.style.display!=="none")this.renderRequests();}
  },
  _resumeStaffRoutes() {
    const rows=read(REQUESTS_KEY,[]).filter(r=>r.status==="requested"||r.status==="in-progress");
    rows.forEach(r=>{ if(Date.now()-r.createdAt >= r.duration){r.status="completed";r.completedAt=Date.now();} else this._dispatchStaff(r); });
    write(REQUESTS_KEY,read(REQUESTS_KEY,[]));
  },
};
