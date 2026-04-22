import { apiClient, type Location, type CreateLocationRequest, type UpdateLocationRequest, type LocationListResponse, type ApiResponse } from '@/lib/api';

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

  // Get locations with pagination and filtering
  async getLocations(
    page = 1,
    pageSize = 20,
    search = '',
    locationCode = '',
    type = ''
  ): Promise<LocationListResponse> {
    const response = await apiClient.getLocations(page, pageSize, search, locationCode, type);
    console.log('API response in getLocations:', response);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get locations');
    }
    
    // Handle nested response structure: {success: true, data: {locations: [...], meta: {...}}}
    const responseData = response.data as any;
    const locations = responseData?.locations || responseData || [];
    const meta = responseData?.meta || { page, page_size: pageSize, total: locations.length };
    
    console.log('Extracted locations in service:', locations);
    console.log('Extracted meta in service:', meta);
    
    return {
      locations: Array.isArray(locations) ? locations : [],
      meta: meta
    };
  }

  // Get all locations (without pagination)
  async getAllLocations(): Promise<Location[]> {
    const response = await apiClient.getLocations(1, 1000); // Get all with large page size
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get all locations');
    }
    
    // Handle nested response structure
    const responseData = response.data as any;
    const locations = responseData?.locations || responseData || [];
    
    return Array.isArray(locations) ? locations : [];
  }
}

// Export singleton instance
export const locationService = new LocationService();
