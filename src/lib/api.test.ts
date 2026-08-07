import { describe, expect, it } from "vitest";
import { normalizeApiResponse } from "./api";

describe("normalizeApiResponse", () => {
  it("keeps responses that already follow ApiResponse format", () => {
    const response = {
      success: false,
      message: "failed",
    };

    expect(normalizeApiResponse(response)).toBe(response);
  });

  it("unwraps backend responses with message and data", () => {
    const stores = [
      {
        id: "store-1",
        location_code: "jakarta",
        location_name: "Jakarta",
      },
    ];

    expect(normalizeApiResponse<typeof stores>({
      message: "Get list location",
      data: stores,
    })).toEqual({
      success: true,
      message: "Get list location",
      data: stores,
    });
  });

  it("wraps raw responses as successful ApiResponse data", () => {
    expect(normalizeApiResponse("ok")).toEqual({
      success: true,
      message: "Success",
      data: "ok",
    });
  });
});
