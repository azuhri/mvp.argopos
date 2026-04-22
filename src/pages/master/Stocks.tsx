import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Package, Edit, Trash2, Filter, Settings, Loader2, ArrowUpDown, ChevronDown, ChevronRight, Building2, AlertCircle, Plus, ArrowRightLeft } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { stockService } from "@/lib/services/stockService";
import { productService } from "@/lib/services/productService";
import type { Stock, LocationStockGroup } from "@/lib/api";
import { toast } from "sonner";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

export default function MasterStocks() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locationId, setLocationId] = useState("");
  const [locationType, setLocationType] = useState<"all" | "warehouse" | "store">("all");
  const [sortBy, setSortBy] = useState<"stock" | "base_price" | "discount_price" | "final_price">("stock");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Expand/collapse state for location groups
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());

  // Dialog states
  const [isCreateStockOpen, setIsCreateStockOpen] = useState(false);
  const [isDistributeStockOpen, setIsDistributeStockOpen] = useState(false);
  const [isTransferStockOpen, setIsTransferStockOpen] = useState(false);

  // Form states
  const [createStockForm, setCreateStockForm] = useState({
    master_location_id: "",
    master_product_id: "",
    base_price: 0,
    discount_price: 0,
    tax_percentage: 0,
    stock: 0,
  });

  const [distributeStockForm, setDistributeStockForm] = useState({
    from_location_id: "",
    to_location_id: "",
    product_id: "",
    quantity: 0,
  });

  const [transferStockForm, setTransferStockForm] = useState({
    from_location_id: "",
    to_location_id: "",
    product_id: "",
    quantity: 0,
  });

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

  // Query for all master products to get total count
  const { data: productsData } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => productService.getAllProducts(),
  });

  const totalMasterProducts = productsData?.length || 0;

  // Query for stocks grouped by location
  const { data: stocksData, isLoading, refetch } = useQuery({
    queryKey: ['stocks', currentPage, itemsPerPage, debouncedSearch, locationId, locationType, sortBy, sortOrder],
    queryFn: () => stockService.getStocks(
      currentPage,
      itemsPerPage,
      debouncedSearch,
      locationId,
      locationType,
      sortBy,
      sortOrder
    ),
  });

  const locationGroups = stocksData?.location_groups || [];
  const meta = stocksData?.meta || { page: 1, page_size: 10, total: 0, total_pages: 0 };

  // Calculate total_pages correctly based on actual data
  const calculatedTotalPages = meta.total > 0 ? Math.ceil(meta.total / meta.page_size) : 1;
  const totalPages = meta.total_pages > 0 ? Math.min(calculatedTotalPages, meta.total_pages) : calculatedTotalPages;

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

  // Create stock mutation
  const createMutation = useMutation({
    mutationFn: (stock: any) => stockService.createStock(stock),
    onSuccess: () => {
      toast.success("Stock created successfully");
      setIsCreateStockOpen(false);
      setCreateStockForm({
        master_location_id: "",
        master_product_id: "",
        base_price: 0,
        discount_price: 0,
        tax_percentage: 0,
        stock: 0,
      });
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create stock");
    },
  });

  // Distribute stock mutation
  const distributeMutation = useMutation({
    mutationFn: (request: any) => stockService.distributeStock(request),
    onSuccess: () => {
      toast.success("Stock distributed successfully");
      setIsDistributeStockOpen(false);
      setDistributeStockForm({
        from_location_id: "",
        to_location_id: "",
        product_id: "",
        quantity: 0,
      });
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to distribute stock");
    },
  });

  // Transfer stock mutation
  const transferMutation = useMutation({
    mutationFn: (request: any) => stockService.transferStock(request),
    onSuccess: () => {
      toast.success("Stock transferred successfully");
      setIsTransferStockOpen(false);
      setTransferStockForm({
        from_location_id: "",
        to_location_id: "",
        product_id: "",
        quantity: 0,
      });
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to transfer stock");
    },
  });

  // Sync products mutation
  const syncMutation = useMutation({
    mutationFn: (locationId: string) => stockService.syncProducts(locationId),
    onSuccess: () => {
      toast.success("Products synced successfully");
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to sync products");
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
      <div className="w-full max-w-full overflow-x-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-6">
          {/* Search bar - full width */}
          <div className="md:col-span-12 relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10" />
            <Input
              placeholder="Search stocks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card/70 backdrop-blur border-border/50"
            />
          </div>

          {/* Filters and sorting - organized in grid */}
          <div className="md:col-span-6 grid grid-cols-2 gap-2">
            <Select value={locationType} onValueChange={(value: any) => setLocationType(value)}>
              <SelectTrigger className="bg-card/70 backdrop-blur border-border/50">
                <SelectValue placeholder="Location Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="warehouse">Warehouse</SelectItem>
                <SelectItem value="store">Store</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value: any) => handleSortChange(value)}>
              <SelectTrigger className="bg-card/70 backdrop-blur border-border/50">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stock">Stock</SelectItem>
                <SelectItem value="base_price">Base Price</SelectItem>
                <SelectItem value="discount_price">Discount</SelectItem>
                <SelectItem value="final_price">Final Price</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort order toggle */}
          <div className="md:col-span-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="bg-card/70 backdrop-blur border-border/50 w-full"
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>

          {/* Action buttons */}
          <div className="md:col-span-5 grid grid-cols-3 gap-2">
            <Dialog open={isCreateStockOpen} onOpenChange={setIsCreateStockOpen}>
              <DialogTrigger asChild>
                <Button className="btn-tap bg-primary">
                  <Plus className="h-4 w-4 mr-2" /> Create
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card">
                <DialogHeader>
                  <DialogTitle>Create Stock</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Location</Label>
                    <Select value={createStockForm.master_location_id} onValueChange={(value) => setCreateStockForm({ ...createStockForm, master_location_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {locationGroups.map((group) => (
                          <SelectItem key={group.location_id} value={group.location_id}>
                            {group.location_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Product</Label>
                    <Select value={createStockForm.master_product_id} onValueChange={(value) => setCreateStockForm({ ...createStockForm, master_product_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(new Set(locationGroups.flatMap(g => g.product_stocks.map(s => s.master_product?.id))))
                          .filter(id => id)
                          .map(productId => {
                            const product = locationGroups.flatMap(g => g.product_stocks).find(s => s.master_product?.id === productId);
                            return product ? (
                              <SelectItem key={productId} value={productId}>
                                {product.master_product?.product_name}
                              </SelectItem>
                            ) : null;
                          })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Base Price</Label>
                    <Input
                      type="number"
                      value={createStockForm.base_price}
                      onChange={(e) => setCreateStockForm({ ...createStockForm, base_price: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Discount Price</Label>
                    <Input
                      type="number"
                      value={createStockForm.discount_price}
                      onChange={(e) => setCreateStockForm({ ...createStockForm, discount_price: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Tax Percentage</Label>
                    <Input
                      type="number"
                      value={createStockForm.tax_percentage}
                      onChange={(e) => setCreateStockForm({ ...createStockForm, tax_percentage: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Stock</Label>
                    <Input
                      type="number"
                      value={createStockForm.stock}
                      onChange={(e) => setCreateStockForm({ ...createStockForm, stock: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => createMutation.mutate(createStockForm)}
                      disabled={createMutation.isPending || !createStockForm.master_location_id || !createStockForm.master_product_id}
                    >
                      {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                    </Button>
                    <Button variant="outline" onClick={() => setIsCreateStockOpen(false)}>Cancel</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isDistributeStockOpen} onOpenChange={setIsDistributeStockOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-card/70 backdrop-blur border-border/50">
                  <ArrowRightLeft className="h-4 w-4 mr-2" /> Distribute
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card">
                <DialogHeader>
                  <DialogTitle>Distribute Stock (Warehouse to Store)</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>From Warehouse</Label>
                    <Select value={distributeStockForm.from_location_id} onValueChange={(value) => setDistributeStockForm({ ...distributeStockForm, from_location_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        {locationGroups.filter(g => g.location_type === 'warehouse').map((group) => (
                          <SelectItem key={group.location_id} value={group.location_id}>
                            {group.location_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>To Store</Label>
                    <Select value={distributeStockForm.to_location_id} onValueChange={(value) => setDistributeStockForm({ ...distributeStockForm, to_location_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select store" />
                      </SelectTrigger>
                      <SelectContent>
                        {locationGroups.filter(g => g.location_type === 'store').map((group) => (
                          <SelectItem key={group.location_id} value={group.location_id}>
                            {group.location_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Product</Label>
                    <Select value={distributeStockForm.product_id} onValueChange={(value) => setDistributeStockForm({ ...distributeStockForm, product_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(new Set(locationGroups.flatMap(g => g.product_stocks.map(s => s.master_product?.id))))
                          .filter(id => id)
                          .map(productId => {
                            const product = locationGroups.flatMap(g => g.product_stocks).find(s => s.master_product?.id === productId);
                            return product ? (
                              <SelectItem key={productId} value={productId}>
                                {product.master_product?.product_name}
                              </SelectItem>
                            ) : null;
                          })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      value={distributeStockForm.quantity}
                      onChange={(e) => setDistributeStockForm({ ...distributeStockForm, quantity: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => {
                        console.log("Distribute Stock Form:", distributeStockForm);
                        if (!distributeStockForm.from_location_id || !distributeStockForm.to_location_id || !distributeStockForm.product_id || distributeStockForm.quantity <= 0) {
                          toast.error("Please fill in all required fields");
                          return;
                        }
                        distributeMutation.mutate(distributeStockForm);
                      }}
                      disabled={distributeMutation.isPending}
                    >
                      {distributeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Distribute"}
                    </Button>
                    <Button variant="outline" onClick={() => setIsDistributeStockOpen(false)}>Cancel</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isTransferStockOpen} onOpenChange={setIsTransferStockOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-card/70 backdrop-blur border-border/50">
                  <ArrowRightLeft className="h-4 w-4 mr-2" /> Transfer
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card">
                <DialogHeader>
                  <DialogTitle>Transfer Stock (Store to Store)</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>From Store</Label>
                    <Select value={transferStockForm.from_location_id} onValueChange={(value) => setTransferStockForm({ ...transferStockForm, from_location_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select store" />
                      </SelectTrigger>
                      <SelectContent>
                        {locationGroups.filter(g => g.location_type === 'store').map((group) => (
                          <SelectItem key={group.location_id} value={group.location_id}>
                            {group.location_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>To Store</Label>
                    <Select value={transferStockForm.to_location_id} onValueChange={(value) => setTransferStockForm({ ...transferStockForm, to_location_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select store" />
                      </SelectTrigger>
                      <SelectContent>
                        {locationGroups.filter(g => g.location_type === 'store').map((group) => (
                          <SelectItem key={group.location_id} value={group.location_id}>
                            {group.location_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Product</Label>
                    <Select value={transferStockForm.product_id} onValueChange={(value) => setTransferStockForm({ ...transferStockForm, product_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(new Set(locationGroups.flatMap(g => g.product_stocks.map(s => s.master_product?.id))))
                          .filter(id => id)
                          .map(productId => {
                            const product = locationGroups.flatMap(g => g.product_stocks).find(s => s.master_product?.id === productId);
                            return product ? (
                              <SelectItem key={productId} value={productId}>
                                {product.master_product?.product_name}
                              </SelectItem>
                            ) : null;
                          })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      value={transferStockForm.quantity}
                      onChange={(e) => setTransferStockForm({ ...transferStockForm, quantity: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => {
                        if (!transferStockForm.from_location_id || !transferStockForm.to_location_id || !transferStockForm.product_id || transferStockForm.quantity <= 0) {
                          toast.error("Please fill in all required fields");
                          return;
                        }
                        transferMutation.mutate(transferStockForm);
                      }}
                      disabled={transferMutation.isPending}
                    >
                      {transferMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Transfer"}
                    </Button>
                    <Button variant="outline" onClick={() => setIsTransferStockOpen(false)}>Cancel</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
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
          <div className="space-y-4">
            {locationGroups.map((group) => (
              <motion.div
                key={group.location_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-border/50 rounded-lg overflow-hidden"
              >
                {/* Location Header */}
                <div
                  className="bg-card/50 p-2 sm:p-4 cursor-pointer hover:bg-card/80 transition-colors"
                  onClick={() => toggleLocation(group.location_id)}
                >
                  <div className="flex items-start gap-2 sm:gap-4">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 sm:gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-foreground text-xs sm:text-sm truncate">{group.location_name}</h3>
                        <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0">
                          {group.location_code}
                        </Badge>
                        <Badge variant={group.location_type !== 'store' ? 'default' : 'secondary'} className="text-[10px] sm:text-xs px-1.5 py-0">
                          {group.location_type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
                        <span>{group.total_products} prod</span>
                        <span>Stock: {group.total_stock}</span>
                        <span>Val: {formatCurrency(group.total_value)}</span>
                        {group.low_stock_count > 0 && (
                          <span className="text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {group.low_stock_count} low
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {group.total_products < totalMasterProducts && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            syncMutation.mutate(group.location_id);
                          }}
                          disabled={syncMutation.isPending}
                          className="text-[10px] sm:text-xs px-2 py-1 h-6 sm:h-8"
                        >
                          {syncMutation.isPending ? <Loader2 className="h-3 w-3 sm:h-4 w-4 animate-spin" /> : "Sync"}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="p-1 h-6 w-6 sm:h-10 sm:w-10">
                        {expandedLocations.has(group.location_id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
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
                      <div className="p-2 sm:p-4">
                        {/* Card View with responsive grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                          {group.product_stocks.map((stock) => (
                            <div
                              key={stock.id || `${stock.master_location?.id}-${stock.master_product?.id}`}
                              className="bg-muted/30 rounded-lg p-2 sm:p-3 border border-border/30 hover:bg-muted/50 transition-colors"
                            >
                              <div className="mb-2">
                                <div className="font-medium text-foreground text-xs sm:text-sm truncate">{stock.master_product?.product_name || "Unknown"}</div>
                                {stock.master_product?.product_code && (
                                  <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{stock.master_product.product_code}</div>
                                )}
                              </div>
                              <div className="flex items-center justify-between gap-2 text-[10px] sm:text-xs">
                                <div className="text-muted-foreground">Base: {formatCurrency(stock.base_price)}</div>
                                <Badge variant={stock.stock > 10 ? "default" : stock.stock > 0 ? "secondary" : "destructive"} className="text-[10px] sm:text-xs">
                                  {stock.stock}
                                </Badge>
                              </div>
                            </div>
                          ))}
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 border-t border-border/30">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start w-full sm:w-auto">
            <span className="text-xs sm:text-sm text-muted-foreground">Per page:</span>
            <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
              <SelectTrigger className="w-16 sm:w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {locationGroups.length} locs
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="text-xs sm:text-sm px-2 sm:px-3"
            >
              Prev
            </Button>
            <span className="text-xs sm:text-sm text-foreground">
              {meta.page}/{totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
              className="text-xs sm:text-sm px-2 sm:px-3"
            >
              Next
            </Button>
          </div>
        </div>
      </GlassCard>
    </AppLayout>
  );
}
