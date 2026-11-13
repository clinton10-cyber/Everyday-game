# Hotel Presidential — Guest Services Upgrade

## Included
- Room tablet in suites.
- Room service menu with Nigerian meals, breakfast, light meals and drinks.
- Housekeeping requests: room refresh, linen/towel replacement, amenities restock and deep clean.
- Laundry and express pressing.
- Concierge requests for city rides, airport transfers, city tours and restaurant assistance.
- Luggage assistance for arrival and checkout.
- Valet parking service tiers.
- Reservation check-in/check-out workflow.
- Guest-services access requires an active checked-in reservation.
- Everyday Pay charges, insufficient-funds handling, cancellation refunds for requests not yet started, local request history and guest notifications.
- Hotel NPC update loop and service-staff route assignments.

## How to use
1. At reception, use **CHECK IN** to book a room.
2. Select a reservation with today's check-in date and press **CHECK IN**.
3. Walk to a room's tablet and interact with **ROOM TABLET**.
4. Select a service and request it. The wallet is charged immediately when the request is accepted.
5. Track the request under **Your service requests**. A completion notification appears when the service timer finishes.
6. Use **CHECK OUT** from the reservation panel when leaving.

Other entry points:
- **ASK CONCIERGE** opens concierge services.
- **LUGGAGE ASSISTANCE** opens porter requests.
- **VALET PARKING** opens parking requests.

## Data storage
- Reservations: `ph3d.hotel.bookings.v2`
- Guest-service requests: `ph3d.hotel.guest-services.v1`

## Important
This feature is an in-game offline simulation. It does not book real Hotel Presidential rooms, call real transport providers, or process real money. Local storage is device/browser-specific and is not suitable as a secure multiplayer payment ledger.

Valet parking now stores a vehicle label, parking ticket, parked/retrieved state and a retrieval request. It is a saved service workflow; the vehicle entity itself is not yet driven into/out of a rendered parking bay.
