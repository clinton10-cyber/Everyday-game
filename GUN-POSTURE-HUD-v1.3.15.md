# v1.3.15 — CoD-style gun posture, compact combat HUD, range UI
- js/core/gun-stances.js (generated): firing stances solved against the real rig + gun meshes, all 6 guns, ready/ADS, moving/standing, 7 aim pitches. Barrel error <= ~3deg across the full aim range.
- guns.js: samples stances by aim pitch; standing still = bladed hips + staggered knee-bent legs; moving/crouch/air = normal legs.
- Combat HUD (`body.gun-out`): life-sim chips hidden, slim 2x2 combat block, torch/talk moved off the chips.
- Range: HP + weapon slots bottom-centre (active weapon highlighted), skills beside thumb buttons, wave/kills top-centre, exit under wallet.
- SW v170.
