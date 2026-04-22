import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: {
    total: number;
    page: number;
    page_size: number;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    role_id: string;
    created_at: string;
    updated_at: string;
    role?: {
      id: string;
      role_name: string;
      created_at: string;
      updated_at: string;
    };
  };
}

export interface User {
  id: string;
  username: string;
  email: string;
  role_id: string;
  created_at: string;
  updated_at: string;
  role?: {
    id: string;
    role_name: string;
    created_at: string;
    updated_at: string;
  };
  assigned_stores?: Location[];
}

export interface Role {
  id: string;
  role_name: string;
  description?: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  access_roles?: AccessRole[];
}

export interface Menu {
  id: string;
  menu_name: string;
  url?: string;
  icon?: string;
}

export interface AccessRole {
  id: string;
  role_id: string;
  menu_id: string;
  access_type: 'hidden' | 'read' | 'write';
  created_at: string;
  updated_at: string;
  role?: Role;
  menu?: Menu;
}

export interface Location {
  id: string;
  location_code: string;
  location_name: string;
  longitude?: number;
  latitude?: number;
  type: 'warehouse' | 'store';
  created_by?: string;
  updated_by?: string;
  updated_at?: string;
  created_at: string;
  created_by_user?: {
    id: string;
    email: string;
    username: string;
  };
  updated_by_user?: {
    id: string;
    email: string;
    username: string;
  };
}

export interface StoreAssignedUser {
  id: string;
  username: string;
  email: string;
  no_wa: string;
}

export interface StorePaymentMethod {
  id: string;
  location_id: string;
  payment_type: string; // 'qris', 'transfer_rekening', 'cutoff_hutang'
  image_url: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  location_id: string;
  customer_id: string;
  status: string; // WAITING_TO_PAYMENT, PAID, PREPARING_PRODUCT, READY_TO_PICKUP, COMPLETED
  paid_at: string;
  total_amount: number;
  total_item: number;
  created_by: string;
  created_at: string;
  customer_name?: string;
}

export interface Store {
  location_id: string;
  location_name: string;
  location_code: string;
  total_revenue: number;
  total_transactions: number;
  total_stock: number;
  product_stores: Stock[];
  assigned_users: StoreAssignedUser[];
  payment_methods: StorePaymentMethod[];
  transactions?: Transaction[];
}

export interface Product {
  id: string;
  product_code: string;
  product_name: string;
  description: string;
  base_price: number;
  image_path: string;
  image_collection_url: string;
  image_url: string;
  image_collection: string[];
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  created_by_user?: {
    id: string;
    email: string;
    username: string;
    last_name?: string;
  };
  updated_by_user?: {
    id: string;
    email: string;
    username: string;
    last_name?: string;
  };
}

export interface CreateProductRequest {
  product_name: string;
  product_code: string;
  description: string;
  base_price: number;
  image_path?: string;
  image_collection_url?: string;
}

export interface UpdateProductRequest {
  product_name: string;
  product_code: string;
  description: string;
  base_price: number;
  image_path?: string;
  image_collection_url?: string;
}

export interface ProductListResponse {
  products: Product[];
  meta: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface CreateLocationRequest {
  location_code: string;
  location_name: string;
  longitude?: number | null;
  latitude?: number | null;
  type: 'warehouse' | 'store';
  created_by?: string;
}

export interface UpdateLocationRequest {
  location_code?: string;
  location_name?: string;
  longitude?: number | null;
  latitude?: number | null;
  type?: 'warehouse' | 'store';
  updated_by?: string;
}

// Stock Management Interfaces
export interface Stock {
  id: string;
  master_location?: {
    id: string;
    location_code: string;
    location_name: string;
    longitude: number;
    latitude: number;
    type: string;
  };
  master_product?: {
    id: string;
    product_name: string;
    product_code: string;
    description: string;
    base_price: number;
    image_path: string;
    image_url: string;
  };
  base_price: number;
  discount_price: number;
  tax_percentage: number;
  stock: number;
  final_price: number;
  created_at: string;
  updated_at: string;
}

export interface LocationStockGroup {
  location_id: string;
  location_name: string;
  location_code: string;
  location_type: string;
  total_products: number;
  total_stock: number;
  total_value: number;
  low_stock_count: number;
  product_stocks: Stock[];
}

export interface StockListResponse {
  location_groups: LocationStockGroup[];
  meta: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface UpdateStockRequest {
  base_price: number;
  discount_price: number;
  tax_percentage: number;
  stock: number;
}

export interface CreateStockRequest {
  master_location_id: string;
  master_product_id: string;
  base_price: number;
  discount_price: number;
  tax_percentage: number;
  stock: number;
}

export interface DistributeStockRequest {
  from_location_id: string;
  to_location_id: string;
  product_id: string;
  quantity: number;
}

export interface TransferStockRequest {
  from_location_id: string;
  to_location_id: string;
  product_id: string;
  quantity: number;
}

export interface SyncProductsRequest {
  location_id: string;
}

export interface StoreMetrics {
  location_id: string;
  location_name: string;
  location_code: string;
  total_revenue: number;
  total_transactions: number;
  daily_revenue: number;
  daily_transactions: number;
  monthly_revenue: number;
  monthly_transactions: number;
  updated_at: string;
}

export interface StoreStockList {
  location_id: string;
  location_name: string;
  location_code: string;
  product_stocks: Stock[];
  total_stock: number;
}

export interface LocationListResponse {
  locations: Location[];
  meta: {
    page: number;
    page_size: number;
    total: number;
  };
}

export interface RoleAccessMenu {
  id: string;
  role_id: string;
  menu_id: string;
  access_type: 'hidden' | 'read' | 'write';
  role?: Role;
  menu?: Menu;
}

class ApiClient {
  private baseURL: string;
  private axiosInstance;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
    this.axiosInstance = axios.create({
      baseURL: `${this.baseURL}/api/v1`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for token and FormData handling
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('argopos.auth.token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Handle FormData - set correct Content-Type for multipart/form-data
        if (config.data instanceof FormData) {
          // Let browser set the boundary automatically
          config.headers['Content-Type'] = 'multipart/form-data';
          console.log('Request interceptor: Set Content-Type to multipart/form-data');
          console.log('FormData entries being sent:');
          for (let [key, value] of config.data.entries()) {
            console.log(`  ${key}:`, value instanceof File ? `File(${value.name}, ${value.size} bytes)` : value);
          }
        } else {
          // Ensure JSON Content-Type for non-FormData requests
          if (!config.headers['Content-Type']) {
            config.headers['Content-Type'] = 'application/json';
          }
        }

        console.log('Final request headers:', config.headers);
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // // Add response interceptor for error handling
    // this.axiosInstance.interceptors.response.use(
    //   (response) => {
    //     // Check if response already has the expected structure
    //     const responseData = response.data;

    //     // If response already has success/data structure, return as-is
    //     if (responseData && typeof responseData === 'object' && 'success' in responseData) {
    //       return responseData;
    //     }

    //     // Otherwise, wrap it in ApiResponse structure
    //     return {
    //       success: true,
    //       data: responseData,
    //       message: 'Success'
    //     };
    //   },
    //   (error) => {
    //     // Handle different error types
    //     if (error.response) {
    //       // Server responded with error status
    //       const message = error.response.data?.message || error.response.statusText || 'API request failed';
    //       throw new Error(message);
    //     } else if (error.request) {
    //       // Request was made but no response received
    //       throw new Error('Network error - no response received');
    //     } else {
    //       // Something happened in setting up the request
    //       throw new Error('Request setup error');
    //     }
    //   }
    // );
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const responseData = response.data;

        if (responseData && typeof responseData === 'object' && 'success' in responseData) {
          return responseData;
        }

        return {
          success: true,
          data: responseData,
          message: 'Success'
        };
      },
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('argopos.auth.token');
          localStorage.removeItem('argopos.auth.user');

          // Only redirect if not already on login page
          if (window.location.pathname !== '/auth/sign-in') {
            window.location.href = "/auth/sign-in";
          }
        }

        const message =
          error.response?.data?.message ||
          error.response?.statusText ||
          'API request failed';

        return Promise.reject(new Error(message));
      }
    );
  }

  private async request<T>(
    endpoint: string,
    options: any = {}
  ): Promise<ApiResponse<T>> {
    const { method = 'GET', data, params } = options;

    console.log('Request config:', { method, endpoint, dataType: data?.constructor?.name, isFormData: data instanceof FormData });

    const config: any = {
      method,
      url: endpoint,
      ...(data && { data }),
      ...(params && { params }),
    };

    // Let axios interceptor handle all header management
    return this.axiosInstance.request(config);
  }

  // Auth endpoints
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    return this.request<LoginResponse>('/users/login', {
      method: 'POST',
      data: credentials,
    });
  }

  async getMe(): Promise<ApiResponse<User>> {
    return this.request<User>('/users/');
  }

  // User endpoints
  async getUsers(page = 1, pageSize = 20, search = ''): Promise<ApiResponse<{ data: User[] } & { meta: any }>> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
      ...(search && { search }),
    });
    return this.request(`/users/list?${params}`);
  }

  async getUser(id: string): Promise<ApiResponse<User>> {
    return this.request<User>(`/users/${id}`);
  }

  async createUser(user: Partial<User>): Promise<ApiResponse<User>> {
    return this.request<User>('/users/', {
      method: 'POST',
      data: user,
    });
  }

  async updateUser(id: string, user: Partial<User>): Promise<ApiResponse<User>> {
    return this.request<User>(`/users/${id}`, {
      method: 'PUT',
      data: user,
    });
  }

  async deleteUser(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Role endpoints
  async getRoles(page = 1, pageSize = 20, search = ''): Promise<ApiResponse<{ data: Role[] } & { meta: any }>> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
      ...(search && { search }),
    });
    return this.request(`/roles/list?${params}`);
  }

  async getRole(id: string): Promise<ApiResponse<Role>> {
    return this.request<Role>(`/roles/${id}`);
  }

  async createRole(role: Partial<Role>): Promise<ApiResponse<Role>> {
    return this.request<Role>('/roles/', {
      method: 'POST',
      data: role,
    });
  }

  async updateRole(id: string, role: Partial<Role>): Promise<ApiResponse<Role>> {
    return this.request<Role>(`/roles/${id}`, {
      method: 'PUT',
      data: role,
    });
  }

  async deleteRole(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/roles/${id}`, {
      method: 'DELETE',
    });
  }

  // Access Role endpoints
  async getAccessRoles(page = 1, pageSize = 20, search = '', roleId?: string, menuId?: string, accessType?: string): Promise<ApiResponse<{ data: AccessRole[] } & { meta: any }>> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
      ...(search && { search }),
      ...(roleId && { role_id: roleId }),
      ...(menuId && { menu_id: menuId }),
      ...(accessType && { access_type: accessType }),
    });
    return this.request(`/access-roles/list?${params}`);
  }

  async getAccessRole(id: string): Promise<ApiResponse<AccessRole>> {
    return this.request<AccessRole>(`/access-roles/${id}`);
  }

  async createAccessRole(accessRole: Partial<AccessRole>): Promise<ApiResponse<AccessRole>> {
    return this.request<AccessRole>('/access-roles/', {
      method: 'POST',
      data: accessRole,
    });
  }

  async createBulkAccessRoles(accessRoles: { access_roles: Partial<AccessRole>[] }): Promise<ApiResponse<AccessRole[]>> {
    return this.request<AccessRole[]>('/access-roles/bulk', {
      method: 'POST',
      data: accessRoles,
    });
  }

  async updateAccessRole(id: string, accessRole: Partial<AccessRole>): Promise<ApiResponse<AccessRole>> {
    return this.request<AccessRole>(`/access-roles/${id}`, {
      method: 'PUT',
      data: accessRole,
    });
  }

  async deleteAccessRole(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/access-roles/${id}`, {
      method: 'DELETE',
    });
  }

  async getAccessRolesByRole(roleId: string): Promise<ApiResponse<AccessRole[]>> {
    return this.request<AccessRole[]>(`/access-roles/role/${roleId}`);
  }

  async getAccessRolesByMenu(menuId: string): Promise<ApiResponse<AccessRole[]>> {
    return this.request<AccessRole[]>(`/access-roles/menu/${menuId}`);
  }

  async updateRoleAccess(roleId: string, menuAccesses: { menu_id: string; access_type: string }[]): Promise<ApiResponse<void>> {
    return this.request<void>(`/access-roles/role/${roleId}`, {
      method: 'PUT',
      data: { menu_accesses: menuAccesses },
    });
  }

  async getRoleWithAccess(roleId: string): Promise<ApiResponse<Role>> {
    return this.request<Role>(`/access-roles/role/${roleId}/with-access`);
  }

  async getMenuWithAccess(menuId: string): Promise<ApiResponse<Menu>> {
    return this.request<Menu>(`/access-roles/menu/${menuId}/with-access`);
  }

  
  async getAllRoles(): Promise<ApiResponse<Role[]>> {
    return this.request<Role[]>('/roles/list');
  }

  async getAllMenus(): Promise<ApiResponse<Menu[]>> {
    return this.request<Menu[]>('/menus/list');
  }

  async checkAccess(roleId: string, menuId: string): Promise<ApiResponse<{ exists: boolean; access_type?: string }>> {
    const params = new URLSearchParams({
      role_id: roleId,
      menu_id: menuId,
    });
    return this.request(`/access-roles/check?${params}`);
  }

  // Product endpoints
  async createProduct(product: CreateProductRequest, imageFile?: File, imageCollectionFiles?: File[]): Promise<ApiResponse<Product>> {
    console.log('=== CREATE PRODUCT DEBUG ===');
    console.log('createProduct called with:', { product, imageFile, imageCollectionFiles });
    
    const formData = new FormData();
    
    // Add form fields
    formData.append('product_name', product.product_name);
    formData.append('product_code', product.product_code);
    formData.append('product_description', product.description);
    formData.append('base_price', product.base_price.toString());
    
    if (imageFile) {
      formData.append('image_path', imageFile);
      console.log('Added image_path file:', imageFile.name, imageFile.size, 'bytes');
    }
    
    if (imageCollectionFiles && imageCollectionFiles.length > 0) {
      imageCollectionFiles.forEach((file, index) => {
        formData.append(`image_collection_url`, file);
        console.log(`Added image_collection_url file ${index}:`, file.name, file.size, 'bytes');
      });
    }

    // Debug FormData contents
    console.log('FormData entries before sending:');
    for (let [key, value] of formData.entries()) {
      console.log(`  ${key}:`, value instanceof File ? `File(${value.name}, ${value.size} bytes)` : value);
    }
    
    // Log FormData type and size
    console.log('FormData type:', formData.constructor.name);
    console.log('FormData is FormData instance:', formData instanceof FormData);

    try {
      const response = await this.request<Product>('/products', {
        method: 'POST',
        data: formData,
      });
      console.log('createProduct response:', response);
      return response;
    } catch (error) {
      console.error('createProduct error:', error);
      throw error;
    }
  }

  async getProduct(id: string): Promise<ApiResponse<Product>> {
    return this.request<Product>(`/products/${id}`);
  }

  async getProductByCode(productCode: string): Promise<ApiResponse<Product>> {
    return this.request<Product>(`/products/code/${productCode}`);
  }

  async updateProduct(id: string, product: UpdateProductRequest, imageFile?: File, imageCollectionFiles?: File[]): Promise<ApiResponse<Product>> {
    const formData = new FormData();
    
    // Add form fields
    formData.append('product_name', product.product_name);
    formData.append('product_code', product.product_code);
    formData.append('product_description', product.description);
    formData.append('base_price', product.base_price.toString());
    
    if (imageFile) {
      formData.append('image_path', imageFile);
    }
    
    if (imageCollectionFiles && imageCollectionFiles.length > 0) {
      imageCollectionFiles.forEach((file, index) => {
        formData.append(`image_collection_url`, file);
      });
    }

    return this.request<Product>(`/products/${id}`, {
      method: 'PUT',
      data: formData,
    });
  }

  async deleteProduct(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/products/${id}`, {
      method: 'DELETE',
    });
  }

  async getProducts(page = 1, pageSize = 20, search = '', productCode = '', sortBy = 'product_name', sortOrder = 'asc'): Promise<ApiResponse<ProductListResponse>> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });

    if (search) params.append('search', search);
    if (productCode) params.append('product_code', productCode);
    if (sortBy) params.append('sort_by', sortBy);
    if (sortOrder) params.append('sort_order', sortOrder);

    return this.request<ProductListResponse>(`/products/list?${params}`);
  }

  // Location endpoints
  async createLocation(location: CreateLocationRequest): Promise<ApiResponse<Location>> {
    return this.request<Location>('/locations', {
      method: 'POST',
      data: location,
    });
  }

  async getLocation(id: string): Promise<ApiResponse<Location>> {
    return this.request<Location>(`/locations/${id}`);
  }

  async updateLocation(id: string, location: UpdateLocationRequest): Promise<ApiResponse<Location>> {
    return this.request<Location>(`/locations/${id}`, {
      method: 'PUT',
      data: location,
    });
  }

  async deleteLocation(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/locations/${id}`, {
      method: 'DELETE',
    });
  }

  async getLocations(page = 1, pageSize = 20, search = '', locationCode = '', type = ''): Promise<ApiResponse<LocationListResponse>> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });

    if (search) params.append('search', search);
    if (locationCode) params.append('location_code', locationCode);
    if (type) params.append('type', type);

    return this.request<LocationListResponse>(`/locations/list?${params}`);
  }

  // Stock Management endpoints
  async getStocks(page = 1, pageSize = 20, search = '', locationId = '', locationType = 'all', sortBy = 'stock', sortOrder = 'desc'): Promise<ApiResponse<StockListResponse>> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
      sort_by: sortBy,
      sort_order: sortOrder,
    });

    if (search) params.append('query', search);
    if (locationId) params.append('location_id', locationId);
    if (locationType) params.append('location_type', locationType);

    return this.request<StockListResponse>(`/stocks?${params}`);
  }

  async getStock(id: string): Promise<ApiResponse<Stock>> {
    return this.request<Stock>(`/stocks/${id}`);
  }

  async createStock(stock: CreateStockRequest): Promise<ApiResponse<Stock>> {
    return this.request<Stock>(`/stocks`, {
      method: 'POST',
      data: stock,
    });
  }

  async updateStock(id: string, stock: UpdateStockRequest): Promise<ApiResponse<Stock>> {
    return this.request<Stock>(`/stocks/${id}`, {
      method: 'PUT',
      data: stock,
    });
  }

  async distributeStock(request: DistributeStockRequest): Promise<ApiResponse<void>> {
    console.log("API distributeStock called with:", request);
    return this.request<void>(`/stocks/distribute`, {
      method: 'POST',
      data: request,
    });
  }

  async transferStock(request: TransferStockRequest): Promise<ApiResponse<void>> {
    return this.request<void>(`/stocks/transfer`, {
      method: 'POST',
      data: request,
    });
  }

  async syncProducts(locationId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/stocks/sync/${locationId}`, {
      method: 'POST',
    });
  }

  // Store management endpoints
  async getStoreMetrics(locationId: string): Promise<ApiResponse<StoreMetrics>> {
    return this.request<StoreMetrics>(`/stores/metrics/${locationId}`);
  }

  async getAllStoresMetrics(): Promise<ApiResponse<StoreMetrics[]>> {
    return this.request<StoreMetrics[]>(`/stores/metrics`);
  }

  async getStoreStocks(locationId: string): Promise<ApiResponse<StoreStockList>> {
    return this.request<StoreStockList>(`/stores/stocks/${locationId}`);
  }

  async getAllStoresStocks(): Promise<ApiResponse<StoreStockList[]>> {
    return this.request<StoreStockList[]>(`/stores/stocks`);
  }

  async getStoreDetail(locationId: string): Promise<ApiResponse<Store>> {
    return this.request<Store>(`/stores/${locationId}`);
  }

  async getStoreAssignedUsers(locationId: string): Promise<ApiResponse<StoreAssignedUser[]>> {
    return this.request<StoreAssignedUser[]>(`/stores/${locationId}/users`);
  }

  async getStoreTransactions(
    locationId: string,
    params?: {
      status?: string;
      user_id?: string;
      start_date?: string;
      end_date?: string;
      payment_method?: string;
      sort_by?: string;
      sort_order?: string;
      page?: number;
      page_size?: number;
    }
  ): Promise<ApiResponse<Transaction[]>> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.user_id) queryParams.append('user_id', params.user_id);
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    if (params?.payment_method) queryParams.append('payment_method', params.payment_method);
    if (params?.sort_by) queryParams.append('sort_by', params.sort_by);
    if (params?.sort_order) queryParams.append('sort_order', params.sort_order);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.page_size) queryParams.append('page_size', params.page_size.toString());

    const queryString = queryParams.toString();
    const url = queryString ? `/stores/${locationId}/transactions?${queryString}` : `/stores/${locationId}/transactions`;
    return this.request<Transaction[]>(url);
  }

  async getStorePaymentMethods(locationId: string): Promise<ApiResponse<StorePaymentMethod[]>> {
    return this.request<StorePaymentMethod[]>(`/stores/${locationId}/payment-methods`);
  }

  async upsertPaymentMethod(paymentMethod: any): Promise<ApiResponse<any>> {
    return this.request('/stores/payment-methods', {
      method: 'POST',
      data: paymentMethod,
    });
  }

  async deletePaymentMethod(id: string): Promise<ApiResponse<any>> {
    return this.request(`/stores/payment-methods/${id}`, {
      method: 'DELETE',
    });
  }

  // Menu endpoints
  async getMenus(page = 1, pageSize = 20, search = ''): Promise<ApiResponse<{ menus: Menu[] } & { meta: any }>> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
      ...(search && { search }),
    });
    return this.request(`/menus/list?${params}`);
  }

  async getMenu(id: string): Promise<ApiResponse<Menu>> {
    return this.request<Menu>(`/menus/${id}`);
  }

  async createMenu(menu: Partial<Menu>): Promise<ApiResponse<Menu>> {
    return this.request<Menu>('/menus/', {
      method: 'POST',
      data: menu,
    });
  }

  async updateMenu(id: string, menu: Partial<Menu>): Promise<ApiResponse<Menu>> {
    return this.request<Menu>(`/menus/${id}`, {
      method: 'PUT',
      data: menu,
    });
  }

  async deleteMenu(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/menus/${id}`, {
      method: 'DELETE',
    });
  }

  // Role Access endpoints
  async getAccessByRole(roleId: string): Promise<ApiResponse<RoleAccessMenu[]>> {
    return this.request<RoleAccessMenu[]>(`/access/role/${roleId}`);
  }

  async createAccess(access: Partial<RoleAccessMenu>): Promise<ApiResponse<RoleAccessMenu>> {
    return this.request<RoleAccessMenu>('/access/', {
      method: 'POST',
      data: access,
    });
  }

  async updateAccess(roleId: string, menuId: string, access: Partial<RoleAccessMenu>): Promise<ApiResponse<RoleAccessMenu>> {
    return this.request<RoleAccessMenu>(`/access/role/${roleId}/menu/${menuId}`, {
      method: 'PUT',
      data: access,
    });
  }

  async deleteAccess(roleId: string, menuId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/access/role/${roleId}/menu/${menuId}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();
