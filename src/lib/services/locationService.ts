import { apiClient, type Location, type CreateLocationRequest, type UpdateLocationRequest, type LocationListResponse, type ApiResponse } from '@/lib/api';

export type LocationStatus = 'active' | 'inactive';

const inactiveLocationStatuses = new Set(['inactive', 'disabled', 'off', 'false', '0']);

export function getLocationStatus(
  location: Pick<Location, 'status' | 'is_active'>,
): LocationStatus {
  const normalizedStatus = location.status?.toString().trim().toLowerCase();
  if (normalizedStatus && inactiveLocationStatuses.has(normalizedStatus)) {
    return 'inactive';
  }
  if (normalizedStatus === 'active') return 'active';
  return location.is_active === false ? 'inactive' : 'active';
}

export function isLocationActive(
  location: Pick<Location, 'status' | 'is_active'>,
): boolean {
  return getLocationStatus(location) === 'active';
}

export function createLocationStatusPayload(status: LocationStatus) {
  return {
    status,
    is_active: status === 'active',
  };
}

export class LocationService {
  // Create location
  async createLocation(location: CreateLocationRequest): Promise<Location> {
    const response = await apiClient.createLocation(location);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create location');
    }
    return response.data;
  }

  // Get location by ID
  async getLocation(id: string): Promise<Location> {
    const response = await apiClient.getLocation(id);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get location');
    }
    return response.data;
  }

  // Update location
  async updateLocation(id: string, location: UpdateLocationRequest): Promise<Location> {
    const response = await apiClient.updateLocation(id, location);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to update location');
    }
    return response.data;
  }

  // Delete location
  async deleteLocation(id: string): Promise<void> {
    const response = await apiClient.deleteLocation(id);
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete location');
    }
  }

  async getListStore(): Promise<Location[]> {
    const response = await apiClient.getListStore();
    if (response.data.length < 1) {
      throw new Error('Failed to get list store');
    }
    return response.data;
  }

  // Get locations with pagination and filtering
  async getLocations(
    page = 1,
    pageSize = 20,
    search = '',
    locationCode = '',
    type = ''
  ): Promise<LocationListResponse> {
    const response = await apiClient.getLocations(page, pageSize, search, locationCode, type);

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get locations');
    }

    // Handle nested response structure: {success: true, data: {locations: [...], meta: {...}}}
    const responseData = response.data as LocationListResponse | Location[];
    const locations = Array.isArray(responseData) ? responseData : responseData.locations;
    const meta = Array.isArray(responseData)
      ? { page, page_size: pageSize, total: responseData.length }
      : responseData.meta;

    return {
      locations: Array.isArray(locations) ? locations : [],
      meta,
    };
  }

  // Get all locations (without pagination)
  async getAllLocations(): Promise<Location[]> {
    // The backend accepts at most 100 records per page. Requesting a larger
    // page size silently falls back to 20, so walk every page explicitly.
    const pageSize = 100;
    const locations: Location[] = [];
    let page = 1;

    while (true) {
      const result = await this.getLocations(page, pageSize);
      locations.push(...result.locations);

      if (result.locations.length === 0 || locations.length >= result.meta.total) {
        break;
      }

      page += 1;
    }

    return locations;
  }
}

// Export singleton instance
export const locationService = new LocationService();
