import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Package, Edit, Trash2, Filter, Settings, Loader2, ArrowUpDown, ChevronDown, ChevronRight, Building2, AlertCircle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { stockService } from "@/lib/services/stockService";
import type { Stock, LocationStockGroup } from "@/lib/api";
import { toast } from "sonner";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

export default function StockManagement() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locationId, setLocationId] = useState("");
  const [sortBy, setSortBy] = useState<"stock" | "base_price" | "discount_price" | "final_price">("stock");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  
  // Expand/collapse state for location groups
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Responsive detection
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Debounce search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500); // 500ms debounce delay

    return () => clearTimeout(timer);
  }, [search]);

  const queryClient = useQueryClient();

  // Query for stocks grouped by location
  const { data: stocksData, isLoading, refetch } = useQuery({
    queryKey: ['stocks', currentPage, itemsPerPage, debouncedSearch, locationId, sortBy, sortOrder],
    queryFn: () => stockService.getStocks(
      currentPage,
      itemsPerPage,
      debouncedSearch,
      locationId,
      sortBy,
      sortOrder
    ),
  });

  const locationGroups = stocksData?.location_groups || [];
  const meta = stocksData?.meta || { page: 1, page_size: 10, total: 0, total_pages: 0 };

  // Toggle location expand/collapse
  const toggleLocation = (locationId: string) => {
    setExpandedLocations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(locationId)) {
        newSet.delete(locationId);
      } else {
        newSet.add(locationId);
      }
      return newSet;
    });
  };

  // Update stock mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, stock }: { id: string; stock: any }) => stockService.updateStock(id, stock),
    onSuccess: () => {
      toast.success("Stock updated successfully");
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update stock");
    },
  });

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  const handleSortChange = (field: "stock" | "base_price" | "discount_price" | "final_price") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  const handleStockUpdate = (stock: Stock, newStock: number) => {
    updateMutation.mutate({
      id: stock.id,
      stock: {
        base_price: stock.base_price,
        discount_price: stock.discount_price,
        tax_percentage: stock.tax_percentage,
        stock: newStock,
      },
    });
  };

  return (
    <AppLayout title="Stock Management">
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10" />
          <Input 
            placeholder="Search stocks..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-9 bg-card/70 backdrop-blur border-border/50" 
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Select value={sortBy} onValueChange={(value: any) => handleSortChange(value)}>
            <SelectTrigger className="w-40 bg-card/70 backdrop-blur border-border/50">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stock">Stock</SelectItem>
              <SelectItem value="base_price">Base Price</SelectItem>
              <SelectItem value="discount_price">Discount</SelectItem>
              <SelectItem value="final_price">Final Price</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="bg-card/70 backdrop-blur border-border/50"
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <GlassCard>
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : locationGroups.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No stocks found</p>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {locationGroups.map((group) => (
              <motion.div
                key={group.location_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-border/50 rounded-lg overflow-hidden"
              >
                {/* Location Header */}
                <div
                  className="bg-card/50 p-4 cursor-pointer hover:bg-card/80 transition-colors flex items-center justify-between"
                  onClick={() => toggleLocation(group.location_id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{group.location_name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {group.location_code}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {group.location_type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>{group.total_products} products</span>
                        <span>Total Stock: {group.total_stock}</span>
                        <span>Total Value: {formatCurrency(group.total_value)}</span>
                        {group.low_stock_count > 0 && (
                          <span className="text-destructive flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            {group.low_stock_count} low stock
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    {expandedLocations.has(group.location_id) ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                  </Button>
                </div>

                {/* Product Stocks (Expandable) */}
                <AnimatePresence>
                  {expandedLocations.has(group.location_id) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-border/30"
                    >
                      <div className="p-4">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-border/30">
                                <th 
                                  className="text-left py-2 px-3 font-medium text-foreground cursor-pointer hover:bg-muted/20 text-sm"
                                  onClick={() => handleSortChange("stock")}
                                >
                                  <div className="flex items-center gap-1">
                                    Stock
                                    {sortBy === "stock" && <ArrowUpDown className="h-3 w-3" />}
                                  </div>
                                </th>
                                <th className="text-left py-2 px-3 font-medium text-foreground text-sm">Product</th>
                                <th 
                                  className="text-left py-2 px-3 font-medium text-foreground cursor-pointer hover:bg-muted/20 text-sm"
                                  onClick={() => handleSortChange("base_price")}
                                >
                                  <div className="flex items-center gap-1">
                                    Base Price
                                    {sortBy === "base_price" && <ArrowUpDown className="h-3 w-3" />}
                                  </div>
                                </th>
                                <th 
                                  className="text-left py-2 px-3 font-medium text-foreground cursor-pointer hover:bg-muted/20 text-sm"
                                  onClick={() => handleSortChange("discount_price")}
                                >
                                  <div className="flex items-center gap-1">
                                    Discount
                                    {sortBy === "discount_price" && <ArrowUpDown className="h-3 w-3" />}
                                  </div>
                                </th>
                                <th 
                                  className="text-left py-2 px-3 font-medium text-foreground cursor-pointer hover:bg-muted/20 text-sm"
                                  onClick={() => handleSortChange("final_price")}
                                >
                                  <div className="flex items-center gap-1">
                                    Final Price
                                    {sortBy === "final_price" && <ArrowUpDown className="h-3 w-3" />}
                                  </div>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.product_stocks.map((stock) => (
                                <tr
                                  key={stock.id}
                                  className="border-b border-border/20 hover:bg-muted/20 transition-colors"
                                >
                                  <td className="py-2 px-3">
                                    <Badge variant={stock.stock > 10 ? "default" : stock.stock > 0 ? "secondary" : "destructive"} className="text-xs">
                                      {stock.stock}
                                    </Badge>
                                  </td>
                                  <td className="py-2 px-3">
                                    <div>
                                      <div className="font-medium text-foreground text-sm">{stock.master_product?.product_name || "Unknown"}</div>
                                      {stock.master_product?.product_code && (
                                        <div className="text-xs text-muted-foreground">{stock.master_product.product_code}</div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="text-sm text-foreground">
                                      {formatCurrency(stock.base_price)}
                                    </div>
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="text-sm text-muted-foreground">
                                      {stock.discount_price > 0 ? formatCurrency(stock.discount_price) : "-"}
                                    </div>
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="font-semibold text-primary text-sm">
                                      {formatCurrency(stock.final_price)}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border/30">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Items per page:</span>
            <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              Showing {locationGroups.length} locations
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-foreground">
              Page {meta.page} of {meta.total_pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(meta.total_pages, prev + 1))}
              disabled={currentPage >= meta.total_pages}
            >
              Next
            </Button>
          </div>
        </div>
      </GlassCard>
    </AppLayout>
  );
}
