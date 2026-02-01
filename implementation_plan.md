# Implementation Plan - Daily Streak (Racha) System

Replacing the AdSense reward system with a 7-day Daily Streak system.

## Proposed Changes

### Database (Supabase)
- Add `last_claimed_at` (TIMESTAMP) and `current_streak` (INTEGER) to `profiles`.

### Backend (Server)
#### [MODIFY] [server.js](file:///d:/Desarrollos/moddio/rock-paper-scissors-game/server.js)
- Implement `claimDailyReward` socket event.
- Add logic to check time difference and calculate rewards (10 to 70 coins).
- Handle streak reset if more than 24h passed or after day 7.

### Frontend
#### [MODIFY] [useEconomyController.ts](file:///d:/Desarrollos/moddio/rock-paper-scissors-game/app/controllers/useEconomyController.ts)
- Add `currentStreak` and `lastClaimedAt` to state.
- Update `checkProfile` to fetch new fields.
- Implement `handleClaimDaily` action.

#### [MODIFY] [ShopModal.tsx](file:///d:/Desarrollos/moddio/rock-paper-scissors-game/app/components/Modals/ShopModal.tsx)
- Change "GRATIS (ADS)" to "RACHA".
- Disable button if already claimed today.
- Show current streak progress.

## Verification Plan
1. Claim reward: Check if coins increase and streak increments.
2. Refresh: Verify state persists.
3. Simulate skip: Verify streak resets (manual DB edit for testing).
