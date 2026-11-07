import { Multiplayer } from "./multiplayer.js";
import { seatCount } from "../vehicles/models.js";
import { State } from "./state.js";

export const Rides = {
  /* My passengers: Set of player IDs currently in my car */
  passengers: new Set(),
  /* Am I riding with someone? { driverId, driverName, seatIndex } or null */
  riding: null,
  _onUpdate: null,

  seatMax(){
    const id = State.vehicle.model || "gwagon";
    return seatCount(id);
  },

  seatsAvailable(){
    return Math.max(0, this.seatMax() - 1 - this.passengers.size); // -1 for driver
  },

  /* Driver: invite a nearby pedestrian to ride */
  pickUp(playerId, playerName){
    if(this.passengers.size >= this.seatMax() - 1) return { ok:false, reason:"full" };
    Multiplayer.action("ride-invite", {
      to: playerId,
      fromName: (Multiplayer.self && Multiplayer.self.name) || "Driver",
      seats: this.seatMax(),
    });
    return { ok:true };
  },

  /* Passenger: accept a ride */
  accept(driverId, driverName){
    this.riding = { driverId, driverName, at: Date.now() };
    Multiplayer.action("ride-accept", { to: driverId });
    this._onUpdate && this._onUpdate();
    if(window.__ph3d_phone) window.__ph3d_phone._toast("🚗 Riding with " + driverName);
  },

  /* Passenger: exit the car */
  exit(){
    if(!this.riding) return;
    Multiplayer.action("ride-exit", { to: this.riding.driverId });
    this.riding = null;
    this._onUpdate && this._onUpdate();
  },

  /* Driver: remove a passenger */
  dropOff(playerId){
    if(!this.passengers.has(playerId)) return;
    this.passengers.delete(playerId);
    Multiplayer.action("ride-dropped", { to: playerId });
    this._onUpdate && this._onUpdate();
  },

  /* Message handlers */
  handleAction(m){
    if(!m || !m.kind) return;
    if(m.kind === "ride-invite"){
      if(this.riding) return;
      // show accept prompt
      const accept = window.confirm((m.data.fromName || "Someone") + " wants you to ride along?");
      if(accept) this.accept(m.id, m.data.fromName || "Driver");
    } else if(m.kind === "ride-accept"){
      this.passengers.add(m.id);
      this._onUpdate && this._onUpdate();
      if(window.__ph3d_phone) window.__ph3d_phone._toast("🚗 " + (m.name || "Friend") + " joined");
    } else if(m.kind === "ride-exit" || m.kind === "ride-dropped"){
      this.passengers.delete(m.id);
      this._onUpdate && this._onUpdate();
      if(window.__ph3d_phone) window.__ph3d_phone._toast("👋 " + (m.name || "Friend") + " left the car");
    }
  },
};

