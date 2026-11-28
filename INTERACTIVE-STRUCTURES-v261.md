# Interactive structures (SW v261)

New module js/core/city-structures.js, hooked into drive.js (init, update, enforce, dispose). One contextual button (#ph3d-struct-btn, key U) does the action for whatever structure is near. Structures are placed on free ground automatically and have yellow distance labels so they can be found. Positions are logged in the console and in window.__ph3d_structures.

1. Pedestrian crossing: zebra stripes on a straight road plus two push-button signals. PRESS TO CROSS: 2 s wait, green man for 14 s + 4 s flashing, AI cars stop short of the stripes (NPC_Cars.holdZones).
2. Network mast: 48 m lattice mast with ladder. CLIMB MAST, platform at 30 m, BOOST SIGNAL (one time, pays N2,000), CLIMB DOWN.
3. Basket tower: 30 m steel tower with an iron cage basket on a cable. ENTER BASKET rides up, GET OUT onto the lookout deck, RIDE DOWN from the east edge.
4. Crane: tower crane (36 m mast, 34 m jib, cab, counterweights). RIDE CRANE on the load pallet: lift, swing about 110 degrees, lower. RIDE BACK from the far side; an empty pallet returns by itself after 12 s.
5. Cave: rock mound with a torch-lit tunnel and a crystal chamber (stalactites, bats, pool). Walls are solid. OPEN CHEST at the back pays N5,000 once.

Riders are locked to the moving part and clamped on the decks, so they cannot fall off. Leaving walk mode or ragdolling safely drops the player to the ground.
