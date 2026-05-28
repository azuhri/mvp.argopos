export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  discount_price?: number;
  tax_percentage?: number;
  stock: number;
  unit: string;
  image_url?: string;
  stock?: number;
}