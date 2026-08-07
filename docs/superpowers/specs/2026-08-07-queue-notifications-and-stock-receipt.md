# Queue Notifications and Stock Receipt Approval

**Status:** Implemented

**Date:** 2026-08-07

## Goal

Deliver actionable email notifications for payment approval, payment confirmation, and warehouse stock receipt without sending SMTP mail inside HTTP request handlers. Store admins can complete each approval from a protected application screen.

## Event Contract

| Event | Trigger | Recipient | Deep Link |
| --- | --- | --- | --- |
| `payment_approval_requested` | Checkout becomes `WAITING_TO_PAYMENT`. | Assigned store admins with email. | `/transactions/:transactionId/approve-payment` |
| `payment_confirmation` | Assigned admin confirms payment. | Transaction customer email. | `/:locationCode/commerce/payment/:transactionId` |
| `stock_receipt_approval_requested` | Warehouse source approves a distribution. | Assigned destination-store admins with email. | `/master/store/:locationId?tab=stock-management` |

All events are published as persistent messages to the configured RabbitMQ notification queue. The separate email worker consumes that same queue, renders escaped HTML with an optional CTA, sends through SMTP, and acknowledges only successful deliveries.

## Payment Approval

- Opening an email link only loads the transaction summary; it never mutates payment state.
- The admin must be authenticated, have `transactions:write`, and either be `super_admin` or be assigned to the transaction store.
- **Konfirmasi pembayaran** issues the existing protected POST exactly once from the UI.
- A successful first transition to `PAID` queues the customer confirmation email. An already-paid transaction is shown as complete without another action.
- Sign-in redirects preserve pathname, query, and hash so email deep links survive authentication.

## Stock Management Tab

- `/master/store/:locationId?tab=stock-management` opens the destination receipt view directly.
- Data is loaded server-side with `movement_type=distribution`, `to_location_id=:locationId`, descending date order, and pagination.
- Product, source warehouse, quantity, status, request time, empty/loading states, and responsive table/card views are provided.
- **Konfirmasi diterima** appears only for `source_approved`, requires explicit confirmation, and reloads both request and store stock state after success.
- Backend receive authorization verifies the destination-store assignment for non-super-admin users and writes stock plus IN/OUT mutations transactionally.

## Configuration

- `APP_FRONTEND_URL` is the canonical SPA base for email links and must include `/celestia` in deployments using that basename.
- `RABBITMQ_QUEUE_NOTIFICATION` must match between API producer and email worker.
- SMTP/RabbitMQ credentials have no source-code defaults and are not printed in startup logs.

## Verification Evidence

- Backend: `go test ./...` passed.
- Backend concurrency-sensitive packages: `go test -race ./internal/platform/rabbitmq ./internal/domain/notification/service ./internal/domain/transaction/...` passed.
- Frontend: 51 Vitest tests across 16 files passed.
- Frontend production build passed; Vite reports only the existing large-chunk advisory.
- Playwright: all 8 scenarios passed, including destination filter, receipt confirmation, deep-link tab selection, and desktop/mobile overflow assertions.
- Focused ESLint for notification, approval, storage, service, and E2E files passed with zero findings.

## Operational Boundaries

- Queue publish happens after the business database commit. A transactional outbox is still required for guaranteed recovery from a process failure between commit and publish.
- Failed SMTP handling is requeued. Production should add a bounded retry policy, dead-letter queue, queue-depth alerts, and reconciliation monitoring.
- Automated tests validate publish payloads and HTML rendering; a live RabbitMQ-to-SMTP smoke test requires environment credentials and infrastructure.
