# v1.3.21 - crosshair always clear of the player, gun always points at it
- Crosshair stays at the exact screen centre; the camera looks straight down the aim ray.
- js/core/thirdperson.js: the aim ray now always passes at least 0.52 m (aiming) / 0.62 m (hip) to the side of the body axis. Walls can shorten the pull-back distance but never the sideways offset. If a wall blocks the chosen shoulder the camera uses the other shoulder.
- The gun converges on the point under the crosshair (from the gun hand), so the barrel points at the crosshair even at close range. Visual yaw/pitch only; movement heading is unchanged.
- js/core/guns.js: arm/stance pose samples the converged pitch.
- SW cache v232.
