import { describe, expect, it } from "vitest";
import { createLocationStatusPayload, getLocationStatus, isLocationActive } from "./locationService";

describe("location status helpers", () => {
  it("normalizes inactive status variants", () => {
    expect(getLocationStatus({ status: "inactive" })).toBe("inactive");
    expect(getLocationStatus({ status: "disabled" })).toBe("inactive");
  });

  it("falls back to is_active when status is missing", () => {
    expect(getLocationStatus({ is_active: false })).toBe("inactive");
    expect(isLocationActive({ is_active: true })).toBe(true);
  });

  it("creates backend-compatible status payload", () => {
    expect(createLocationStatusPayload("inactive")).toEqual({
      status: "inactive",
      is_active: false,
    });
  });
});
