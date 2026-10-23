import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient, type Location } from "@/lib/api";
import {
  createLocationStatusPayload,
  getLocationStatus,
  isLocationActive,
  LocationService,
} from "./locationService";

afterEach(() => {
  vi.restoreAllMocks();
});

function makeLocation(index: number): Location {
  return {
    id: `location-${index}`,
    location_code: `LOC-${index}`,
    location_name: `Location ${index}`,
    type: "store",
    created_at: "2026-09-07T00:00:00Z",
  };
}

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

describe("LocationService.getAllLocations", () => {
  it("loads every backend page when more than 100 locations exist", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => makeLocation(index));
    const secondPage = Array.from({ length: 25 }, (_, index) => makeLocation(index + 100));
    const getLocations = vi.spyOn(apiClient, "getLocations")
      .mockResolvedValueOnce({
        success: true,
        data: {
          locations: firstPage,
          meta: { page: 1, page_size: 100, total: 125 },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          locations: secondPage,
          meta: { page: 2, page_size: 100, total: 125 },
        },
      });

    const locations = await new LocationService().getAllLocations();

    expect(getLocations).toHaveBeenNthCalledWith(1, 1, 100, "", "", "");
    expect(getLocations).toHaveBeenNthCalledWith(2, 2, 100, "", "", "");
    expect(locations).toHaveLength(125);
    expect(locations.at(-1)?.id).toBe("location-124");
  });
});
