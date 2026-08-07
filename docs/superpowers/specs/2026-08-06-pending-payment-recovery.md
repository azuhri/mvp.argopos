# Pending Payment Recovery

**Status:** Implemented

**Date:** 2026-08-06

## Goal

Let a customer defer payment, close the storefront, and recover the original unexpired `WAITING_TO_PAYMENT` transaction from the same browser/profile without creating another checkout or stock reservation.

## Scope

- Catalog routes: `/commerce` and `/:locationCode/commerce`.
- Payment route: `/:locationCode/commerce/payment/:transactionId`.
- Checkout integration: `StoreCart.tsx` writes recovery metadata before navigation.
- Recovery UI: `PendingPaymentSection.tsx` is backed by `usePendingPayments.ts`.
- Persistence: `pendingPaymentStorage.ts` owns the versioned browser schema.
- Backend contract: transaction create/detail responses contain authoritative RFC3339 `expires_at`.

## Storage Contract

Key: `argopos.store.pending-payments.v1`

The version 1 envelope stores only `transaction_id`, `transaction_code`, `location_code`, `location_name`, `total_amount`, `status`, `created_at`, and `expires_at`. It excludes customer identity/contact data, credentials, payment details, and cart lines.

## Recovery Flow

1. Successful `WAITING_TO_PAYMENT` checkout is upserted by transaction ID before the cart is cleared and payment detail opens.
2. Payment detail reconciles canonical transaction data and idempotently repairs a missing active entry before the customer leaves the page.
3. The customer may choose **Bayar nanti** or close the page without deleting the entry.
4. On catalog load, every local candidate is reconciled through `GET /transactions/:id`.
5. A card is shown only after the backend confirms `WAITING_TO_PAYMENT` and `now < expires_at`.
6. **Lanjutkan pembayaran** opens the original payment route and does not call create transaction again.
7. Entries are removed after `PAID`, `REJECTED`, `COMPLETED`, `404`, or exact expiry.

## Resilience

- Malformed, unsupported-version, unavailable, or expired storage is handled without blocking the catalog.
- Temporary reconciliation failures hide unverified cards and expose a non-blocking retry state.
- Same-tab events, browser `storage` events, focus/visibility changes, a 30-second reconciliation interval, and the nearest-expiry timer keep the view current.
- Backend `expires_at` is the only business expiry authority used by the recovery card and payment detail.
- Payment detail derives remaining seconds from `expires_at - Date.now()` on every tick, uses ceiling at the sub-second boundary, and never initializes a newly loaded transaction as expired.
- Missing or invalid expiry metadata must not hide otherwise valid transaction detail. Payment detail may temporarily reuse a still-valid backend expiry already stored for the same transaction, but it never synthesizes a frontend TTL.
- If checkout cannot persist the create payload, it fetches the same transaction detail once before navigation; this fallback never issues a second transaction create request.
- Canonical detail repair covers an incomplete checkout response without creating another transaction or stock reservation.

## Verification Evidence

- Storage, reconciliation hook, and catalog section: 18 passing focused Vitest tests.
- Backend expiry response and configured/fallback timeout behavior: passing Go tests.
- `src/lib/paymentExpiry.test.ts`: covers exact wall-clock duration, sub-second boundary, invalid expiry, and elapsed expiry.
- `e2e/pending-payment-recovery.spec.ts`: covers checkout/detail responses without `expires_at`, same-transaction stored-expiry fallback, detail-based storage repair, accurate initial countdown, defer, close/reopen, resume-original, no-duplicate-create, terminal cleanup, responsive layout, and storage privacy.
- Full regression: 45 Vitest tests, 6 Playwright scenarios, frontend production build, and backend `go test ./...` pass.

## Known Boundaries

- Recovery is local to the same browser profile and device; clearing storage does not cancel the backend transaction.
- On a shared browser, minimal transaction metadata can be visible to the next user.
- `expires_at` is currently computed from `created_at` and the current backend timeout configuration. Persist it per transaction if later configuration changes must not affect existing transactions.
- Public recovery uses the transaction ID in the route. Consider an opaque signed recovery token before exposing more transaction detail.
