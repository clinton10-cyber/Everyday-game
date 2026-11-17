# Wing-flight forward lean

- Wing-powered flight now gives the avatar a forward-leaning airborne/gliding posture.
- The lean eases in smoothly and increases with horizontal air speed.
- Slow/hovering flight keeps a gentle lean; faster flight leans further forward.
- Jetpack flight keeps its existing steeper flight posture.

Changed source: `js/core/thirdperson.js`

Validation: `node --check js/core/thirdperson.js` passed. Visual gameplay testing is still required.
