import { apiClient, User, Role } from '@/lib/api';

// Re-export types for use in components
export type { User, Role };

export interface UserListResponse {
  data: User[];
  meta: {
    page: number;
    page_size: number;
    total: number;
  };
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role_id: string;
  assigned_stores?: string[];
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  password?: string;
  role_id?: string;
  assigned_stores?: string[];
}

class UserService {
  // Get current logged-in user
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.getMe();
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get current user');
    }
    return response.data;
  }

  // Get users list with pagination and search
  async getUsers(page = 1, pageSize = 20, search = ''): Promise<UserListResponse> {
    const response = await apiClient.getUsers(page, pageSize, search);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get users list');
    }
    return response.data;
  }

  // Get user by ID
  async getUserById(id: string): Promise<User> {
    const response = await apiClient.getUser(id);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get user');
    }
    return response.data;
  }

  // Create new user
  async createUser(userData: CreateUserRequest): Promise<User> {
    const response = await apiClient.createUser(userData);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create user');
    }
    return response.data;
  }

  // Update user
  async updateUser(id: string, userData: UpdateUserRequest): Promise<User> {
    const response = await apiClient.updateUser(id, userData);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to update user');
    }
    return response.data;
  }

  // Delete user
  async deleteUser(id: string): Promise<void> {
    const response = await apiClient.deleteUser(id);
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete user');
    }
  }

  // Get available roles
  async getRoles(): Promise<Role[]> {
    const response = await apiClient.getRoles();
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get roles');
    }
    return response.data.data;
  }
}

export const userService = new UserService();
