# Market Item Visual Use Upgrade

All 65 Mile 1 Market catalogue products can now be used from Phone > Pocket Storage.

- Food and drinks: create the product's 3D model in the player's hand, play the matching eat/drink sound, restore the product's listed health amount, then consume one unit.
- Non-consumables: equip the actual 3D product model in the player's hand. Bulky fabrics/household goods use a larger carry presentation; small goods use a one-hand presentation.
- Every item receives a subtle signature visual accent with a deterministic item-specific tint, while retaining its own product model.
- The Pocket Storage item detail includes USE / EQUIP, PUT AWAY, DROP and SELL actions.
- Purchases are stored in the existing Pocket system. If storage unexpectedly fails after payment, the market refunds the purchase.

Implementation:
- `js/core/market-item-use.js`
- `js/core/phone.js`
- `js/ui/market-shop.js`
- `precache.json`
- `sw.js` cache version v130

The feature uses the existing Three.js product models, Pocket storage, PlayerActions hand attachment and Economy. It does not require an online AI service.
