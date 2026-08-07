# Product Image Crop

**Status:** Implemented

**Date:** 2026-08-05

**Last verified:** 2026-08-06

## Goal

Keep product thumbnails and detail images visually consistent by requiring every newly selected Master Product image to pass through an internal crop flow before upload.

## Scope

- Routes: `/master/products` and `/master/products/create`.
- Actions: create product, edit product, replace main image, and add collection images.
- Actor: authenticated admin/super admin with write access to Master Product.
- Existing backend multipart fields remain `image_path` and `image_collection_url`.

## Image Contract

| Property | Contract |
| --- | --- |
| Source types | JPEG, PNG, WebP |
| Main source limit | 10 MB |
| Collection source limit | 5 MB per file, 20 MB per selected batch |
| Crop ratio | `1:1` |
| Output dimensions | `1200 x 1200` pixels |
| Output type | JPEG |
| Transparent source background | White |

## UX Flow

1. User selects one main image or a batch of collection images.
2. Invalid type/size is rejected before editing.
3. A modal presents a stable square frame. The image can be moved with pointer input and enlarged with the zoom slider/buttons.
4. **Terapkan crop** produces the normalized file and updates the form preview.
5. Collection images are processed one at a time with current/total progress.
6. **Batal** discards the active and remaining queue without modifying persisted product images.
7. Product save sends only confirmed normalized files.

## States And Accessibility

- Confirm is disabled while the image is decoding or canvas export is running.
- Processing and crop errors are announced and do not close the product form.
- Zoom has a labeled slider plus icon buttons; reset has an accessible name.
- The crop frame supports mouse, touch, and pen pointer input.
- Dialog content remains usable without horizontal overflow on mobile.

## Acceptance Criteria

- Newly uploaded main and collection files are JPEG `1200 x 1200`.
- No raw selected file reaches product create/update through the Master Product UI.
- Pan/zoom cannot expose an empty area inside the crop frame.
- Selecting the same file after cancel/completion opens crop again.
- Batch order is deterministic and progress is visible.
- Existing backend images remain untouched until explicitly replaced.
- File validation, crop geometry, build/typecheck, and desktop/mobile crop UX are tested.

## Known Boundary

This feature normalizes the browser Master Product workflow. The backend does not inspect pixel dimensions, so another API client can still upload a non-standard image. Server-side validation or transcoding is a separate hardening step if every integration must be enforced.

## Verification Evidence

- `src/lib/productImageCrop.test.ts`: 6 passing validation and geometry tests.
- `e2e/product-image-crop.spec.ts`: passing main/collection crop, exact JPEG `1200 x 1200` preview, multipart payload, and mobile layout scenario.
- Full frontend regression: 38 Vitest tests and 5 Playwright scenarios pass.
- Production build passes; Vite retains the existing large-chunk warning.
