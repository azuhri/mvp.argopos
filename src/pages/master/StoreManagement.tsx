import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, TrendingUp, Package, DollarSign, ShoppingCart, Loader2, ChevronDown, ChevronRight, Store } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { storeService } from "@/lib/services/storeService";
import type { StoreMetrics, StoreStockList, Stock } from "@/lib/api";
import { toast } from "sonner";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

export default function StoreManagement() {
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");

  // Query for all stores metrics
  const { data: storesMetrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ['stores', 'metrics'],
    queryFn: () => storeService.getAllStoresMetrics(),
  });

  // Query for all stores stocks
  const { data: storesStocks, isLoading: stocksLoading, refetch: refetchStocks } = useQuery({
    queryKey: ['stores', 'stocks'],
    queryFn: () => storeService.getAllStoresStocks(),
  });

  // Query for selected store stocks
  const { data: selectedStoreStocks, isLoading: selectedStocksLoading } = useQuery({
    queryKey: ['stores', 'stocks', selectedStoreId],
    queryFn: () => storeService.getStoreStocks(selectedStoreId),
    enabled: !!selectedStoreId,
  });

  const toggleStore = (storeId: string) => {
    setExpandedStores(prev => {
      const newSet = new Set(prev);
      if (newSet.has(storeId)) {
        newSet.delete(storeId);
      } else {
        newSet.add(storeId);
      }
      return newSet;
    });
  };

  const handleStoreSelect = (storeId: string) => {
    setSelectedStoreId(storeId);
  };

  // Combine metrics and stocks data
  const storesData = storesMetrics?.map(metric => {
    const stockData = storesStocks?.find(stock => stock.location_id === metric.location_id);
    return {
      ...metric,
      product_stocks: stockData?.product_stocks || [],
      total_stock: stockData?.total_stock || 0,
    };
  }) || [];

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

  if (metricsLoading || stocksLoading) {
    return (
      <AppLayout title="Store Management">
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Store Management">
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Store Management</h1>
          <p className="text-muted-foreground">Monitor store performance and inventory</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          <GlassCard className="p-4 md:p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Total Stores</span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-foreground">{storesData.length}</p>
          </GlassCard>

          <GlassCard className="p-4 md:p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <span className="text-sm text-muted-foreground">Total Revenue</span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-foreground">
              {formatCurrency(storesData.reduce((sum, store) => sum + store.total_revenue, 0))}
            </p>
          </GlassCard>

          <GlassCard className="p-4 md:p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-blue-500" />
              </div>
              <span className="text-sm text-muted-foreground">Total Transactions</span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-foreground">
              {storesData.reduce((sum, store) => sum + store.total_transactions, 0)}
            </p>
          </GlassCard>

          <GlassCard className="p-4 md:p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Package className="h-5 w-5 text-purple-500" />
              </div>
              <span className="text-sm text-muted-foreground">Total Stock</span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-foreground">
              {storesData.reduce((sum, store) => sum + store.total_stock, 0)}
            </p>
          </GlassCard>
        </div>

        {/* Store List */}
        <GlassCard className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-lg md:text-xl font-semibold text-foreground">Store List</h2>
          </div>

          {storesData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No stores found
            </div>
          ) : (
            <div className="space-y-3">
              {storesData.map((store) => (
                <motion.div
                  key={store.location_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="border border-border/20 rounded-lg overflow-hidden hover:border-border/40 transition-colors">
                    {/* Store Header */}
                    <div className="p-3 md:p-4 bg-muted/30 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Store className="h-4 w-4 text-primary" />
                          <h3 className="font-semibold text-foreground text-sm md:text-base">
                            {store.location_name}
                          </h3>
                          <span className="text-xs text-muted-foreground">({store.location_code})</span>
                        </div>
                        <div className="flex flex-wrap gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            Revenue: {formatCurrency(store.total_revenue)}
                          </span>
                          <span className="flex items-center gap-1">
                            <ShoppingCart className="h-3 w-3" />
                            Transactions: {store.total_transactions}
                          </span>
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            Stock: {store.total_stock}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          toggleStore(store.location_id);
                          handleStoreSelect(store.location_id);
                        }}
                      >
                        {expandedStores.has(store.location_id) ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                      </Button>
                    </div>

                    {/* Store Details - Product Stocks */}
                    <AnimatePresence>
                      {expandedStores.has(store.location_id) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="p-3 md:p-4 border-t border-border/20">
                            {selectedStocksLoading ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-6 w-6 animate-spin" />
                              </div>
                            ) : store.product_stocks.length === 0 ? (
                              <div className="text-center py-4 text-muted-foreground text-sm">
                                No products in stock
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead>
                                    <tr className="border-b border-border/20">
                                      <th className="text-left py-2 px-2 md:px-3 text-xs md:text-sm font-medium text-foreground">
                                        Stock
                                      </th>
                                      <th className="text-left py-2 px-2 md:px-3 text-xs md:text-sm font-medium text-foreground">
                                        Product
                                      </th>
                                      <th className="text-left py-2 px-2 md:px-3 text-xs md:text-sm font-medium text-foreground">
                                        Base Price
                                      </th>
                                      <th className="text-left py-2 px-2 md:px-3 text-xs md:text-sm font-medium text-foreground">
                                        Discount Price
                                      </th>
                                      <th className="text-left py-2 px-2 md:px-3 text-xs md:text-sm font-medium text-foreground">
                                        Tax %
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {store.product_stocks.map((stock: Stock) => (
                                      <tr
                                        key={stock.id || `${stock.master_location?.id}-${stock.master_product?.id}`}
                                        className="border-b border-border/20 hover:bg-muted/20 transition-colors"
                                      >
                                        <td className="py-2 px-2 md:px-3">
                                          <span className="text-sm font-semibold text-foreground">
                                            {stock.stock}
                                          </span>
                                        </td>
                                        <td className="py-2 px-2 md:px-3">
                                          <div>
                                            <div className="font-medium text-foreground text-xs md:text-sm">
                                              {stock.master_product?.product_name || "Unknown"}
                                            </div>
                                            {stock.master_product?.product_code && (
                                              <div className="text-xs text-muted-foreground">
                                                {stock.master_product.product_code}
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                        <td className="py-2 px-2 md:px-3">
                                          <div className="text-sm text-foreground">
                                            {formatCurrency(stock.base_price)}
                                          </div>
                                        </td>
                                        <td className="py-2 px-2 md:px-3">
                                          <div className="text-sm text-muted-foreground">
                                            {stock.discount_price > 0 ? formatCurrency(stock.discount_price) : "-"}
                                          </div>
                                        </td>
                                        <td className="py-2 px-2 md:px-3">
                                          <div className="text-sm text-muted-foreground">
                                            {stock.tax_percentage}%
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </AppLayout>
  );
}
