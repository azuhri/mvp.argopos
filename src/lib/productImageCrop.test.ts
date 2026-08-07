import { describe, expect, it } from "vitest";
import {
  calculateCropSourceRect,
  clampCropOffset,
  getCropOffsetBounds,
  getProductImageValidationError,
  PRODUCT_MAIN_IMAGE_MAX_BYTES,
} from "./productImageCrop";

describe("productImageCrop", () => {
  it("accepts supported source files within the configured limit", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "product.webp", {
      type: "image/webp",
    });

    expect(getProductImageValidationError(file, PRODUCT_MAIN_IMAGE_MAX_BYTES)).toBeNull();
  });

  it("rejects unsupported, empty, and oversized files", () => {
    expect(
      getProductImageValidationError(
        new File(["svg"], "product.svg", { type: "image/svg+xml" }),
        10,
      ),
    ).toMatch(/JPEG, PNG, atau WebP/);
    expect(
      getProductImageValidationError(
        new File([], "empty.png", { type: "image/png" }),
        10,
      ),
    ).toMatch(/kosong/);
    expect(
      getProductImageValidationError(
        new File([new Uint8Array(11)], "large.png", { type: "image/png" }),
        10,
      ),
    ).toMatch(/melebihi batas/);
  });

  it("calculates centered square crop geometry for a landscape image", () => {
    expect(getCropOffsetBounds({ width: 2000, height: 1000 }, 400, 1)).toEqual({
      x: 200,
      y: 0,
    });
    expect(
      calculateCropSourceRect(
        { width: 2000, height: 1000 },
        400,
        1,
        { x: 0, y: 0 },
      ),
    ).toEqual({ x: 500, y: 0, size: 1000 });
  });

  it("clamps panning so the crop never leaves the source image", () => {
    const dimensions = { width: 2000, height: 1000 };

    expect(clampCropOffset({ x: 900, y: 100 }, dimensions, 400, 1)).toEqual({
      x: 200,
      y: 0,
    });
    expect(
      calculateCropSourceRect(dimensions, 400, 1, { x: 900, y: 100 }),
    ).toEqual({ x: 0, y: 0, size: 1000 });
  });

  it("reduces source crop size when zoom increases", () => {
    expect(
      calculateCropSourceRect(
        { width: 1000, height: 1000 },
        400,
        2,
        { x: 0, y: 0 },
      ),
    ).toEqual({ x: 250, y: 250, size: 500 });
  });

  it("rejects invalid crop geometry", () => {
    expect(() => getCropOffsetBounds({ width: 0, height: 1000 }, 400, 1)).toThrow(
      "Crop geometry is invalid",
    );
  });
});
