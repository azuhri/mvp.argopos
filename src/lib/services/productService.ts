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
  async updateProduct(id: string, product: UpdateProductRequest, imageFile?: File, imageCollectionFiles?: File[], imagesToDelete?: string[]): Promise<Product> {
    const response = await apiClient.updateProduct(id, product, imageFile, imageCollectionFiles, imagesToDelete);
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
    // Use VITE_BE_ENDPOINT for image URLs (production server), fallback to VITE_API_URL
    const imageEndpoint = import.meta.env.VITE_BE_ENDPOINT || import.meta.env.VITE_API_URL;
    let products = responseData?.products || responseData || [];

    console.log('=== PRODUCT IMAGE URL DEBUG ===');
    console.log('VITE_BE_ENDPOINT (from env):', import.meta.env.VITE_BE_ENDPOINT);
    console.log('VITE_API_URL (from env):', import.meta.env.VITE_API_URL);
    console.log('imageEndpoint being used:', imageEndpoint);
    console.log('Products count:', products.length);

    // Debug first product's image data
    if (products.length > 0) {
      console.log('First product raw image_path:', products[0].image_path);
      console.log('First product raw image_url:', products[0].image_url);
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

      // Helper function to build full image URL
      // Check if URL is already complete (http/https) or just a path
      const buildImageUrl = (path: string | undefined | null): string => {
        if (!path) return '';
        // If already a complete URL, use it directly
        if (path.startsWith('http://') || path.startsWith('https://')) {
          return path;
        }
        // Otherwise, prepend the image endpoint
        return `${imageEndpoint}/${path}`;
      };

      return {
        ...product,
        product_description: product.description || product.product_description || '',
        // Build image URL - check if image_url is already complete or needs endpoint
        image_url: buildImageUrl(product.image_path || product.image_url),
        image_collection: imageCollection.map((path: string) => buildImageUrl(path)),
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

  async getProductStore(locationCode: string): Promise<Product[]> {
    const response = await apiClient.getProductsByLocation(locationCode);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get product store');
    }
    
    // Handle nested response structure
    const responseData = response.data as any;
    const products = responseData?.products || responseData || [];
    
    return Array.isArray(products) ? products : [];
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
