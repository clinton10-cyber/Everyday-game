# Car wrecks: no more hanging in the air, fly and land anywhere (SW v260)

* Cause of cars hanging: the headlight beam cones (7 m long, invisible by day) were counted in the wreck's collision box, so a car resting on its side or roof floated. `CrashFX.measureBody` now ignores beams, sprites, particles and lights.
* On coming to rest, the wreck is snapped so its lowest real vertex touches the ground (`CrashFX.lowestBodyY`).
* Wrecks (NPC cars and your car) are thrown higher and further, fly over buildings they clear and land on any ground or on a rooftop, not only on roads. They only bounce off a wall they are still lower than.
