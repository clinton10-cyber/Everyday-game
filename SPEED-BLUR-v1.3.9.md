# Speed blur (v1.3.9)
`js/core/speed-fx.js` adds a speed effect anywhere in the world:
- Edge motion blur (masked backdrop blur, up to 9px at the screen edges), radial speed streaks, a soft dark edge and a field-of-view widening (62 -> 78).
- Cars / bikes / hoverboard: starts at ~30% of top speed and builds smoothly to full at top speed; fades out when you slow down.
- Wing flight: strong effect; jetpack flight: light effect. Walking and standing: zero cost (overlay is hidden).
- Hooked into the open-world scene (`js/scenes/drive.js`) and the third-person controller (`js/core/thirdperson.js`).
