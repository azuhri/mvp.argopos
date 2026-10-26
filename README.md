# Celestia frontend

React, TypeScript, and Vite application for the customer storefront and store administration.

Install dependencies with `npm ci`, configure the frontend environment for the intended backend, then run `npm run dev`. `VITE_APP_URL` is the frontend origin, `VITE_API_URL` is the browser-visible API base URL, and `VITE_BE_ENDPOINT` is the asset base URL. These are public build values; payment and storage secrets belong in the backend. Build with `npm run build`.

The current DOKU handover flow uses a customer QR without expiration, a downloadable PNG, and an authorized staff scanner. The `/transactions` page no longer offers **Upload Bukti**; the store-detail upload flow remains available. See [QR handover](docs/qr-handover.md) for the contract, implementation map, and verification results from 26 October 2026.

Run unit/component tests with `npm test` and browser tests with `npx playwright test`. Browser fixtures must point at the local test server; the scoped handover command is documented in the guide. [COMMERCE_DASHBOARD_CHANGES.md](COMMERCE_DASHBOARD_CHANGES.md) and dated documents under `docs/superpowers` describe earlier work and are not the current QR contract.
