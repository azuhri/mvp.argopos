import { apiClient } from '@/lib/api';
import { type Product, type CreateProductRequest, type UpdateProductRequest, type ProductListResponse } from '@/lib/api';

export class ProductService {
  // Create product
  async createProduct(product: CreateProductRequest, imageFile?: File, imageCollectionFiles?: File[]): Promise<Product> {
    const response = await apiClient.createProduct(product, imageFile, imageCollectionFiles);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create product');
    }
    return response.data;
  }

  // Get product by ID
  async getProduct(id: string): Promise<Product> {
    const response = await apiClient.getProduct(id);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get product');
    }
    return response.data;
  }

  // Get product by code
  async getProductByCode(productCode: string): Promise<Product> {
    const response = await apiClient.getProductByCode(productCode);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get product by code');
    }
    return response.data;
  }

  // Update product
  async updateProduct(id: string, product: UpdateProductRequest, imageFile?: File, imageCollectionFiles?: File[]): Promise<Product> {
    const response = await apiClient.updateProduct(id, product, imageFile, imageCollectionFiles);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to update product');
    }
    return response.data;
  }

  // Delete product
  async deleteProduct(id: string): Promise<void> {
    const response = await apiClient.deleteProduct(id);
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete product');
    }
  }

  // Get products with pagination and filtering
  async getProducts(
    page = 1,
    pageSize = 20,
    search = '',
    productCode = '',
    sortBy = 'product_name',
    sortOrder = 'asc'
  ): Promise<ProductListResponse> {
    const response = await apiClient.getProducts(page, pageSize, search, productCode, sortBy, sortOrder);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get products');
    }
    
    const responseData = response.data as any;
    const endpointAPI = import.meta.env.VITE_API_URL;
    let products = responseData?.products || responseData || [];
    
    console.log('=== PRODUCT DATA DEBUG ===');
    console.log('Raw responseData:', responseData);
    console.log('Raw products array:', products);
    console.log('Products length:', products.length);
    
    if (products.length > 0) {
      console.log('First product structure:', products[0]);
      console.log('First product keys:', Object.keys(products[0]));
    }
    
    products = products.map((product: any) => {
      // Parse image_collection_url if it's a string
      let imageCollection: string[] = [];
      if (product.image_collection_url) {
        try {
          if (typeof product.image_collection_url === 'string') {
            imageCollection = JSON.parse(product.image_collection_url);
          } else if (Array.isArray(product.image_collection_url)) {
            imageCollection = product.image_collection_url;
          }
        } catch (error) {
          console.error('Error parsing image_collection_url:', error);
          imageCollection = [];
        }
      }
      
      return {
        ...product,
        product_description: product.description || product.product_description || '', // Fix field mapping
        image_url: product.image_path ? `${endpointAPI}/${product.image_path}` : '',
        image_collection: imageCollection.map((path: string) => `${endpointAPI}${path}`),
      };
    });
    
    console.log('Mapped products:', products);
    console.log('Mapped first product:', products[0]);
    
    const meta = responseData?.meta || { page, page_size: pageSize, total: products.length };
    console.log('Meta:', meta);
    
    console.log('Extracted products in service:', products);
    console.log('Extracted meta in service:', meta);
    
    return {
      products: Array.isArray(products) ? products : [],
      meta: meta
    };
  }

  // Get all products (without pagination)
  async getAllProducts(): Promise<Product[]> {
    const response = await apiClient.getProducts(1, 1000); // Get all with large page size
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get all products');
    }
    
    // Handle nested response structure
    const responseData = response.data as any;
    const products = responseData?.products || responseData || [];
    
    return Array.isArray(products) ? products : [];
  }
}

// Export singleton instance
export const productService = new ProductService();
