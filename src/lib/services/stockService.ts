import { apiClient } from '@/lib/api';
import type {
  Stock,
  StockListResponse,
  UpdateStockRequest,
  CreateStockRequest,
  DistributeStockRequest,
  TransferStockRequest,
  CreateStockTransferRequest,
  StockMutationFilters,
  StockMutationListResponse,
  StockTransferRequest,
  StockTransferRequestFilters,
  StockTransferRequestListResponse,
} from '@/lib/api';

export class StockService {
  async getStocks(
    page = 1,
    pageSize = 20,
    search = '',
    locationId = '',
    locationType = 'all',
    sortBy = 'stock',
    sortOrder = 'desc'
  ): Promise<StockListResponse> {
    const response = await apiClient.getStocks(page, pageSize, search, locationId, locationType, sortBy, sortOrder);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get stocks');
    }
    
    return response.data;
  }

  async getStock(id: string): Promise<Stock> {
    const response = await apiClient.getStock(id);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get stock');
    }
    
    return response.data;
  }

  async getStockMutations(filters: StockMutationFilters = {}): Promise<StockMutationListResponse> {
    const response = await apiClient.getStockMutations(filters);

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get stock mutations');
    }

    return response.data;
  }

  async getStockTransferRequests(filters: StockTransferRequestFilters = {}): Promise<StockTransferRequestListResponse> {
    const response = await apiClient.getStockTransferRequests(filters);

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get stock transfer requests');
    }

    return response.data;
  }

  async createStockTransferRequest(request: CreateStockTransferRequest): Promise<StockTransferRequest> {
    const response = await apiClient.createStockTransferRequest(request);

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create stock transfer request');
    }

    return response.data;
  }

  async approveStockTransferSource(id: string): Promise<StockTransferRequest> {
    const response = await apiClient.approveStockTransferSource(id);

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to approve stock transfer request');
    }

    return response.data;
  }

  async rejectStockTransferRequest(id: string, reason: string): Promise<StockTransferRequest> {
    const response = await apiClient.rejectStockTransferRequest(id, reason);

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to reject stock transfer request');
    }

    return response.data;
  }

  async receiveStockTransferRequest(id: string): Promise<StockTransferRequest> {
    const response = await apiClient.receiveStockTransferRequest(id);

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to receive stock transfer request');
    }

    return response.data;
  }

  async createStock(stock: CreateStockRequest): Promise<Stock> {
    const response = await apiClient.createStock(stock);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create stock');
    }
    
    return response.data;
  }

  async updateStock(id: string, stock: UpdateStockRequest): Promise<Stock> {
    const response = await apiClient.updateStock(id, stock);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to update stock');
    }
    
    return response.data;
  }

  async distributeStock(request: DistributeStockRequest): Promise<void> {
    console.log("distributeStock called with:", request);
    const response = await apiClient.distributeStock(request);
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to distribute stock');
    }
  }

  async transferStock(request: TransferStockRequest): Promise<void> {
    const response = await apiClient.transferStock(request);

    if (!response.success) {
      throw new Error(response.message || 'Failed to transfer stock');
    }
  }

  async syncProducts(locationId: string): Promise<void> {
    const response = await apiClient.syncProducts(locationId);

    if (!response.success) {
      throw new Error(response.message || 'Failed to sync products');
    }
  }
}

export const stockService = new StockService();
