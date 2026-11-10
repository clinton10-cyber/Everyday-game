/* ============================================================
   Garage - when a player buys a car they get a garage slot.
   Owned cars spawn in the driveway when they're at home.
   ============================================================ */
import { State } from "./state.js";
import { Auth } from "./auth.js";
import { buildVehicle } from "../vehicles/models.js";

export const Garage = {
  /* Give the player a car — also enables their garage */
  grantCar(carId) {
    if (!Auth.user) return false;
    const cars = (Auth.user && Auth.user.cars) || [];
    if (cars.indexOf(carId) < 0) {
      cars.push(carId);
      Auth.save({ cars });
    }
    return true;
  },

  owned() {
    return (Auth.user && Auth.user.cars) || [];
  },

  hasGarage() {
    return this.owned().length > 0;
  },

  /* Spawn every owned car in a parking grid.
     originX, originZ = front row anchor. */
  spawnCars(parent, originX, originZ, spacing, yaw) {
    const owned = this.owned();
    const spawned = [];
    for (let i = 0; i < owned.length; i++) {
      const carId = owned[i];
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = originX + col * (spacing || 3.5);
      const z = originZ + row * (spacing || 3.5);
      try {
        const car = buildVehicle(carId, "#47525e", "#a8adb3");
        car.position.set(x, 0, z);
        car.rotation.y = yaw || 0;
        parent.add(car);
        spawned.push({ car, carId });
      } catch (e) {
        console.warn("[garage] cannot spawn", carId, e);
      }
    }
    return spawned;
  },
};

