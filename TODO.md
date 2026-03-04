# TODO Roadmap

## Goal
Expand CarbonLens from MRV documentation into a lightweight marketplace workflow for small producers: inventory -> pricing -> discovery -> transaction -> registry sync.

## Priority 1: Credit Inventory & Listing Management
- Outcome: Producers can convert a validated report output into a sellable credit lot and publish/unpublish listings.
- Scope:
  - Add `CreditLot` and `Listing` types in `src/types/`.
  - Add pure listing logic in `src/lib/marketplace/listings.ts`.
  - Add UI screens/components for inventory and listing status in `src/components/`.
  - Extend `useAppState` to track lots/listings.
- Done when: A user can create a listing from `adjustedMt`, set available volume, and see status (`draft`, `active`, `closed`).

## Priority 2: Transparent Pricing Dashboard
- Outcome: Producers get clear recommended listing prices and payout estimates.
- Scope:
  - Add pricing utilities in `src/lib/marketplace/pricing.ts`.
  - Show price ranges, fee impact, and net proceeds in a dashboard view.
  - Include assumptions and timestamped pricing inputs.
- Done when: The app displays gross/net outcomes across price scenarios and supports configurable platform fee.

## Priority 3: Buyer Discovery & Lead Matching
- Outcome: Sellers can discover and track potential buyers for listed credits.
- Scope:
  - Add `BuyerProfile` and `BuyerLead` types.
  - Build buyer search/filter UI (volume, price band, geography, methodology).
  - Add matching/scoring utility in `src/lib/marketplace/matching.ts`.
- Done when: A seller can view ranked buyer leads for a selected listing with match rationale.

## Priority 4: Simplified Transaction Flow
- Outcome: Users can move from listing to a structured transaction record.
- Scope:
  - Add `Offer`, `Transaction`, and `SettlementStatus` models.
  - Implement offer acceptance flow, reservation of volume, and status tracking.
  - Add transaction audit events and exportable transaction summary.
- Done when: A listing can progress through `offer_received -> accepted -> settled/cancelled` with immutable event history.

## Priority 5: Registry/Marketplace Integration Layer
- Outcome: CarbonLens can sync listing and transaction data with external systems.
- Scope:
  - Add `src/services/` integration interfaces and adapters.
  - Build outbound payload mappers from internal models.
  - Add retry/error handling and sync status indicators.
- Done when: Listings/transactions can be queued and synced through a provider adapter with visible sync state.

## Cross-Cutting Implementation Notes
- Keep business rules pure in `src/lib/marketplace/`; UI should orchestrate only.
- Preserve deterministic auditability: every listing/offer/transaction action should append an audit event.
- Add tests for new pure utilities once a test runner is introduced.
- Maintain backward compatibility with the existing 5-step MRV workflow.
