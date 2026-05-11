import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardMobileNav } from "@/components/layout/DashboardMobileNav";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/mockData";
import { useState, useEffect } from "react";
import { Package, Search, Filter, ArrowUpDown } from "lucide-react";
import { motion } from "framer-motion";

interface ProductStock {
  id: string;
  master_product?: {
    product_name: string;
    base_price: number;
    image_url?: string;
  };
  stock: number;
  base_price: number;
  discount_price: number;
  tax_percentage: number;
}

export default function ProductPage() {
  const [products, setProducts] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("product_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    // TODO: Fetch from API
    // const data = await storeService.getProductStocks(locationId);
    setLoading(false);
  };

  const calculateFinalPrice = (stock: ProductStock) => {
    const price = stock.base_price - stock.discount_price;
    const tax = price * (stock.tax_percentage / 100);
    return price + tax;
  };

  const filteredProducts = products
    .filter(p => p.master_product?.product_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === "product_name") {
        comparison = (a.master_product?.product_name || "").localeCompare(b.master_product?.product_name || "");
      } else if (sortBy === "stock") {
        comparison = a.stock - b.stock;
      } else if (sortBy === "price") {
        comparison = calculateFinalPrice(a) - calculateFinalPrice(b);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  return (
    <AppLayout title="Products">
      {/* <DashboardMobileNav /> */}
      <div>
        {/* Filters */}
        <GlassCard className="mb-4">
          <div className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label>Sort By:</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product_name">Name</SelectItem>
                    <SelectItem value="stock">Stock</SelectItem>
                    <SelectItem value="price">Price</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Desktop/Tablet: Table View */}
        <GlassCard className="hidden md:block">
          <div className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Base Price</TableHead>
                  <TableHead>Discount Price</TableHead>
                  <TableHead>Tax %</TableHead>
                  <TableHead>Final Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        {product.master_product?.image_url ? (
                          <img
                            src={product.master_product.image_url}
                            alt={product.master_product.product_name}
                            className="w-12 h-12 object-cover rounded-md"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{product.master_product?.product_name || '-'}</TableCell>
                      <TableCell>{product.stock}</TableCell>
                      <TableCell>{formatCurrency(product.master_product?.base_price || 0)}</TableCell>
                      <TableCell>{product.discount_price ? formatCurrency(product.discount_price) : '-'}</TableCell>
                      <TableCell>{product.tax_percentage}%</TableCell>
                      <TableCell>{formatCurrency(calculateFinalPrice(product))}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No products found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </GlassCard>

        {/* Mobile: Card View */}
        <div className="md:hidden space-y-4">
          {loading ? (
            <div className="text-center text-muted-foreground py-8">Loading...</div>
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <GlassCard key={product.id}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4"
                >
                  <div className="flex items-start gap-3">
                    {product.master_product?.image_url ? (
                      <img
                        src={product.master_product.image_url}
                        alt={product.master_product.product_name}
                        className="w-16 h-16 object-cover rounded-md"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{product.master_product?.product_name || '-'}</h4>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Stock:</span>{" "}
                          <span className="font-medium">{product.stock}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Final Price:</span>{" "}
                          <span className="font-medium">{formatCurrency(calculateFinalPrice(product))}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Base Price:</span>{" "}
                          <span className="font-medium">{formatCurrency(product.master_product?.base_price || 0)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tax:</span>{" "}
                          <span className="font-medium">{product.tax_percentage}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </GlassCard>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-8">No products found</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
