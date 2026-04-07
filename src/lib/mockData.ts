// Mock data for the application

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: "internal" | "external";
  employee_id?: string;
  koperasi_id?: string;
  status: "active" | "inactive";
  created_at: string;
}

export interface Koperasi {
  id: string;
  koperasi_code: string;
  name: string;
  pic_name: string;
  pic_contact: string;
  status: "active" | "inactive";
  total_transactions: number;
  total_revenue: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  image?: string;
}

export interface Transaction {
  id: string;
  invoice_number: string;
  customer_name: string;
  koperasi_name: string;
  items: { product_id: string; name: string; qty: number; price: number }[];
  total: number;
  payment_method: "cash" | "transfer" | "hutang";
  status: "pending" | "approved" | "paid" | "hutang";
  created_at: string;
}

export const mockCustomers: Customer[] = [
  { id: "1", name: "Ahmad Fauzi", email: "ahmad@koperasi.id", phone: "08123456789", type: "internal", employee_id: "EMP-001", koperasi_id: "1", status: "active", created_at: "2024-01-15" },
  { id: "2", name: "Siti Nurhaliza", email: "siti@mail.com", phone: "08198765432", type: "external", status: "active", created_at: "2024-02-20" },
  { id: "3", name: "Budi Santoso", email: "budi@koperasi.id", phone: "08134567890", type: "internal", employee_id: "EMP-002", koperasi_id: "2", status: "active", created_at: "2024-03-10" },
  { id: "4", name: "Dewi Lestari", email: "dewi@mail.com", phone: "08145678901", type: "external", status: "inactive", created_at: "2024-01-25" },
  { id: "5", name: "Rizki Ramadhan", email: "rizki@koperasi.id", phone: "08156789012", type: "internal", employee_id: "EMP-003", koperasi_id: "1", status: "active", created_at: "2024-04-05" },
  { id: "6", name: "Putri Handayani", email: "putri@mail.com", phone: "08167890123", type: "external", status: "active", created_at: "2024-05-12" },
];

export const mockKoperasi: Koperasi[] = [
  { id: "1", koperasi_code: "KOP-001", name: "Koperasi Maju Jaya", pic_name: "Hendra Wijaya", pic_contact: "08111222333", status: "active", total_transactions: 156, total_revenue: 45600000 },
  { id: "2", koperasi_code: "KOP-002", name: "Koperasi Sejahtera", pic_name: "Rina Susanti", pic_contact: "08222333444", status: "active", total_transactions: 89, total_revenue: 28900000 },
  { id: "3", koperasi_code: "KOP-003", name: "Koperasi Berkah", pic_name: "Agus Pratama", pic_contact: "08333444555", status: "active", total_transactions: 234, total_revenue: 67800000 },
  { id: "4", koperasi_code: "KOP-004", name: "Koperasi Mandiri", pic_name: "Lina Marlina", pic_contact: "08444555666", status: "inactive", total_transactions: 12, total_revenue: 3400000 },
];

export const mockProducts: Product[] = [
  { id: "1", name: "Frozen Chicken Nuggets", category: "Nugget", price: 45000, stock: 120, unit: "pack" },
  { id: "2", name: "Frozen Sausage Premium", category: "Sausage", price: 38000, stock: 85, unit: "pack" },
  { id: "3", name: "Frozen Fish Fillet", category: "Seafood", price: 65000, stock: 8, unit: "pack" },
  { id: "4", name: "Frozen Dim Sum Assorted", category: "Dim Sum", price: 52000, stock: 200, unit: "box" },
  { id: "5", name: "Frozen French Fries", category: "Potato", price: 28000, stock: 150, unit: "pack" },
  { id: "6", name: "Frozen Meatball Premium", category: "Meatball", price: 42000, stock: 3, unit: "pack" },
  { id: "7", name: "Frozen Spring Roll", category: "Snack", price: 35000, stock: 95, unit: "pack" },
  { id: "8", name: "Frozen Shrimp Tempura", category: "Seafood", price: 78000, stock: 45, unit: "box" },
];

export const mockTransactions: Transaction[] = [
  { id: "1", invoice_number: "INV-2024-001", customer_name: "Ahmad Fauzi", koperasi_name: "Koperasi Maju Jaya", items: [{ product_id: "1", name: "Frozen Chicken Nuggets", qty: 5, price: 45000 }, { product_id: "2", name: "Frozen Sausage Premium", qty: 3, price: 38000 }], total: 339000, payment_method: "cash", status: "paid", created_at: "2024-04-01" },
  { id: "2", invoice_number: "INV-2024-002", customer_name: "Budi Santoso", koperasi_name: "Koperasi Sejahtera", items: [{ product_id: "4", name: "Frozen Dim Sum Assorted", qty: 10, price: 52000 }], total: 520000, payment_method: "hutang", status: "hutang", created_at: "2024-04-02" },
  { id: "3", invoice_number: "INV-2024-003", customer_name: "Siti Nurhaliza", koperasi_name: "Koperasi Berkah", items: [{ product_id: "5", name: "Frozen French Fries", qty: 8, price: 28000 }], total: 224000, payment_method: "transfer", status: "approved", created_at: "2024-04-03" },
  { id: "4", invoice_number: "INV-2024-004", customer_name: "Rizki Ramadhan", koperasi_name: "Koperasi Maju Jaya", items: [{ product_id: "1", name: "Frozen Chicken Nuggets", qty: 3, price: 45000 }, { product_id: "8", name: "Frozen Shrimp Tempura", qty: 2, price: 78000 }], total: 291000, payment_method: "cash", status: "pending", created_at: "2024-04-04" },
  { id: "5", invoice_number: "INV-2024-005", customer_name: "Putri Handayani", koperasi_name: "Koperasi Sejahtera", items: [{ product_id: "6", name: "Frozen Meatball Premium", qty: 6, price: 42000 }], total: 252000, payment_method: "transfer", status: "paid", created_at: "2024-04-05" },
];

export const revenueData = [
  { month: "Jan", revenue: 12500000 },
  { month: "Feb", revenue: 18200000 },
  { month: "Mar", revenue: 15800000 },
  { month: "Apr", revenue: 22400000 },
  { month: "May", revenue: 19600000 },
  { month: "Jun", revenue: 28100000 },
];

export const categoryData = [
  { name: "Nugget", value: 35 },
  { name: "Sausage", value: 25 },
  { name: "Seafood", value: 20 },
  { name: "Dim Sum", value: 12 },
  { name: "Snack", value: 8 },
];

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(value);
};
