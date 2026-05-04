import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { formatCurrency } from "@/lib/mockData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Package, AlertTriangle, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { stockService } from "@/lib/services/stockService";
import { Stock } from "@/lib/api";

export default function Products() {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  const { data: stocksData, isLoading, refetch } = useQuery({
    queryKey: ['stocks', currentPage, pageSize, search],
    queryFn: () => stockService.getStocks(currentPage, pageSize, search, '', 'all', 'stock', 'desc'),
  });

  const locationGroups = stocksData?.location_groups || [];
  const allStocks = locationGroups.flatMap(g => g.product_stocks);

  const filtered = allStocks.filter((stock) => {
    const productName = stock.master_product?.product_name?.toLowerCase() || '';
    return productName.includes(search.toLowerCase());
  });

  const isLowStock = (stock: number) => stock <= 10;

  const calculateFinalPrice = (stock: Stock) => {
    const basePrice = stock.base_price;
    const discountPrice = stock.discount_price || 0;
    const taxPercentage = stock.tax_percentage || 0;
    const priceAfterDiscount = basePrice - discountPrice;
    const taxAmount = (priceAfterDiscount * taxPercentage) / 100;
    return priceAfterDiscount + taxAmount;
  };

  return (
    <AppLayout title="Products">
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card/70 backdrop-blur border-border/50" />
        </div>
        <Button className="btn-tap">
          <Plus className="h-4 w-4 mr-1" /> Add Product
        </Button>
      </div>

      {/* Desktop/Tablet: Table View */}
      <div className="hidden md:block">
        <GlassCard className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Base Price</TableHead>
                <TableHead>Store Price</TableHead>
                <TableHead>Discount Price</TableHead>
                <TableHead>Tax %</TableHead>
                <TableHead>Final Price</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : filtered.length > 0 ? (
                filtered.map((stock) => (
                  <TableRow key={stock.id}>
                    <TableCell>
                      {stock.master_product?.image_url ? (
                        <img
                          src={stock.master_product.image_url}
                          alt={stock.master_product.product_name}
                          className="w-12 h-12 object-cover rounded-md"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{stock.master_product?.product_name || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {isLowStock(stock.stock) && <AlertTriangle className="h-4 w-4 text-warning" />}
                        <span className={cn(isLowStock(stock.stock) ? "text-warning font-medium" : "")}>
                          {stock.stock}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(stock.master_product?.base_price || 0)}</TableCell>
                    <TableCell>{formatCurrency(stock.base_price)}</TableCell>
                    <TableCell>{stock.discount_price ? formatCurrency(stock.discount_price) : '-'}</TableCell>
                    <TableCell>{stock.tax_percentage}%</TableCell>
                    <TableCell>{formatCurrency(calculateFinalPrice(stock))}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Tidak ada product stock
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </GlassCard>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden grid gap-3">
        {isLoading ? (
          <GlassCard className="p-4">
            <p className="text-center text-muted-foreground">Loading...</p>
          </GlassCard>
        ) : filtered.length > 0 ? (
          filtered.map((stock) => (
            <GlassCard key={stock.id} className="p-4">
              <div className="flex items-start gap-3">
                {stock.master_product?.image_url ? (
                  <img
                    src={stock.master_product.image_url}
                    alt={stock.master_product.product_name}
                    className="w-16 h-16 object-cover rounded-md"
                  />
                ) : (
                  <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-foreground">{stock.master_product?.product_name || '-'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {isLowStock(stock.stock) && <AlertTriangle className="h-3 w-3 text-warning" />}
                    <span className={cn("text-sm", isLowStock(stock.stock) ? "text-warning" : "text-muted-foreground")}>
                      Stock: {stock.stock}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border/30 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Base Price</p>
                  <p className="font-medium">{formatCurrency(stock.master_product?.base_price || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Final Price</p>
                  <p className="font-medium">{formatCurrency(calculateFinalPrice(stock))}</p>
                </div>
              </div>
            </GlassCard>
          ))
        ) : (
          <GlassCard className="p-4">
            <p className="text-center text-muted-foreground">Tidak ada product stock</p>
          </GlassCard>
        )}
      </div>
    </AppLayout>
  );
}
