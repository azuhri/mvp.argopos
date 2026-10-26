# DOKU QR handover

Current frontend behavior and local verification: **26 October 2026**. Earlier five-minute QR behavior is superseded by this contract. Payment-session expiry and unpaid-order expiry are separate and remain unchanged.

## Customer flow

After independent payment and ownership verification, `/:locationCode/commerce/payment-success/:transactionId` displays **QR penyerahan barang** for eligible DOKU orders. The QR binds the transaction ID to a server-issued timestamp and signature. It has no expiration, countdown, or automatic refresh timer. The customer can leave the page open overnight or save the QR for later collection.

**Unduh QR (PNG)** exports the exact displayed QR locally as a 1024 × 1024 PNG, with black modules, a white background, and a four-module white margin. The filename is sanitized. No external image service is used. Loading disables download; conversion failure preserves the QR and offers a retry. The application does not automatically persist the payload in localStorage, analytics, or URLs; an explicit customer download saves the image to their device.

The existing five-second transaction polling remains responsible for observing fulfillment. Once the canonical status is `COMPLETED`, the page removes the QR and stops fulfillment polling. Invoice access remains separate from QR generation and PNG download.

## Staff flow

Staff with `transactions:write` open `/transactions/pickup-scan` using **Scan QR** in the center of the bottom navigation on desktop, tablet, or mobile. Camera access requires a secure browser context and permission. **Unggah gambar QR** decodes an image locally when a camera is unavailable, including the customer’s downloaded PNG.

Decoded Celestia QR payloads are submitted immediately, with one confirmation in flight. Opening the scanner or starting its camera does not mutate an order. The server verifies the signature, staff permission, store assignment, and canonical paid state before returning `COMPLETED`. Camera tracks stop during confirmation, when hidden, and on unmount. A lost response can be retried safely through the idempotent server endpoint; the browser never invents completion.

On `/transactions`, both desktop tables and mobile cards retain **Items**, eligible **Mulai persiapan**, and the existing manual-payment actions. **Upload Bukti** and its dialog are removed from this route. The separate store-detail transaction tab retains its existing proof-upload action and transition checks. A valid staff scan can complete an eligible DOKU order from `PAID`, `PREPARING_PRODUCT`, or `READY_TO_PICKUP`.

## API and compatibility

Paths below are relative to the configured public API prefix.

| Operation | Authorization | Contract |
|---|---|---|
| GET `/payments/transactions/:id/pickup-qr` | Per-order ownership cookie | `transaction_id`, `qr_payload`, `issued_at`; private/no-store; new responses omit `expires_at`. |
| POST `/transactions/required/confirm-pickup-qr` | Staff JWT, Transactions Write, store assignment | JSON `{ "qr_payload": "..." }`; success returns `transaction_id`, `transaction_code`, `status: "COMPLETED"`, `already_completed`. |

New payloads use `celestia-pickup-v2.<base64url-json>.<signature>`. The scanner also accepts legacy `celestia-pickup-v1` payloads for server verification. The updated backend accepts otherwise valid legacy QR codes after their former deadline. The optional legacy `expires_at` transport field is ignored by the UI. A valid signature remains required; raw transaction IDs or client-generated timestamps cannot replace it.

Deploy this UI with the matching backend and migrations `000040` and `000041_allow_nonexpiring_pickup_qr`. Migration 41 makes audit `qr_expires_at` nullable; v2 audit entries have no expiry, while legacy timestamps remain historical metadata. The source change and local tests do not establish that a target environment has been migrated or deployed. Existing backend signing-key rotation invalidates images signed with the previous key; the customer must load a fresh QR in that case.

## Implementation map

| Concern | Source |
|---|---|
| Verified success and fulfillment polling | [PaymentSuccess](../src/pages/PaymentSuccess.tsx) |
| QR rendering, download, and retry states | [CustomerPickupQR](../src/components/commerce/CustomerPickupQR.tsx) |
| Local PNG encoding and safe filename | [pickupQrImage](../src/lib/pickupQrImage.ts) |
| Owned QR transport validation | [paymentService](../src/lib/services/paymentService.ts) |
| Camera/image decoding and staff submission | [PickupQrScanner](../src/pages/PickupQrScanner.tsx), [pickupQrService](../src/lib/services/pickupQrService.ts) |
| Persistent scanner entry | [BottomNav](../src/components/layout/BottomNav.tsx) |
| Dashboard transaction actions | [TransactionPage](../src/pages/dashboard/TransactionPage.tsx), [DokuFulfillmentActions](../src/components/shared/DokuFulfillmentActions.tsx) |

## Verification on 26 October 2026

- **257 unit/component tests across 32 files passed.** Node 25 required disabling experimental global web storage for the jsdom test environment.
- **13 scoped Chromium browser cases passed**, using mocked API responses: customer-to-staff handover at 390, 820, and 1440 px; actual downloaded PNG decoded by the staff scanner; a 24-hour clock advance without QR reissue; camera-stream decoding and cleanup; scanner authorization/permission states; dashboard upload removal and store-detail upload preservation.
- The PNG roundtrip verifies PNG bytes, 1024 × 1024 dimensions, a white corner, and exact payload equality through real browser decoding.
- Vite build and scoped lint for the QR implementation, services, helpers, and tests passed. `git diff --check` passed. These checks are separate from the older test counts in historical reports.

Commands run from this repository:

```sh
NODE_OPTIONS=--no-experimental-webstorage npm run test -- --run

VITE_APP_URL=http://127.0.0.1:4173 \
VITE_API_URL=http://127.0.0.1:4173/backend/celestia/api/v1 \
VITE_BE_ENDPOINT=http://127.0.0.1:4173 \
npx playwright test e2e/pickup-qr-handover.spec.ts e2e/pickup-qr-scanner.spec.ts e2e/doku-fulfillment.spec.ts --workers=2

npm run build
```

Playwright starts the local Vite server on port 4173. Browser APIs are mocked for these cases; they do not create live orders or send email. The browser run is scoped to the three named specs, not the entire E2E suite. Real device cameras, Safari, production proxy/cookies, live DOKU settlement, and email delivery require separate environment verification.

Full TypeScript checking still reports six existing errors in `exportUtils.ts`, `userService.ts`, `master/Locations.tsx`, and `Transactions.tsx`. Linting all of the older dashboard `TransactionPage.tsx` still reports three existing explicit-`any` errors and one hook-dependency warning; it is not included in the clean scoped-lint claim.
