import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Edit, Trash2, Package, AlertTriangle, Filter, Settings, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPicker } from '@/components/ui/MapPicker';
import { AmountInput, FormattedAmount } from '@/components/ui/AmountInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { productService } from "@/lib/services/productService";
import { type Product, type CreateProductRequest, type UpdateProductRequest } from "@/lib/api";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

// Helper function for currency formatting
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

export default function Products() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "product_code">("all");
  const [sortBy, setSortBy] = useState<"product_name" | "base_price">("product_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Debounce search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500); // 500ms debounce delay

    return () => clearTimeout(timer);
  }, [search]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [newProductName, setNewProductName] = useState("");
  const [newProductCode, setNewProductCode] = useState("");
  const [newProductDescription, setNewProductDescription] = useState("");
  const [newBasePrice, setNewBasePrice] = useState<number>(0);
  const [newImagePath, setNewImagePath] = useState("");
  const [newImageCollectionUrl, setNewImageCollectionUrl] = useState("");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImageCollectionFiles, setNewImageCollectionFiles] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageCollectionPreviews, setImageCollectionPreviews] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

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

  const queryClient = useQueryClient();

  // Query for products
  const { data: productsData, isLoading, refetch } = useQuery({
    queryKey: ['products', currentPage, itemsPerPage, debouncedSearch, filter, sortBy, sortOrder],
    queryFn: () => productService.getProducts(
      currentPage,
      itemsPerPage,
      debouncedSearch,
      filter === "product_code" ? debouncedSearch : "",
      sortBy,
      sortOrder
    ),
  });

  // File handling functions
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error('Image file size must be less than 10MB');
        e.target.value = ''; // Clear the input
        return;
      }

      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast.error('Please upload a valid image file (JPEG, PNG, or WebP)');
        e.target.value = ''; // Clear the input
        return;
      }

      setNewImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
      setNewImagePath(file.name);
    }
  };

  const handleImageCollectionFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      const isValidType = allowedTypes.includes(file.type);
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB per file

      if (!isValidType) {
        toast.error(`File ${file.name} is not a valid image type`);
      }
      if (!isValidSize) {
        toast.error(`File ${file.name} is too large (max 5MB per file)`);
      }

      return isValidType && isValidSize;
    });

    // Check total size of all files (max 20MB total)
    const totalSize = validFiles.reduce((sum, file) => sum + file.size, 0);
    const maxTotalSize = 20 * 1024 * 1024; // 20MB total

    if (totalSize > maxTotalSize) {
      toast.error('Total size of all images must be less than 20MB');
      e.target.value = ''; // Clear the input
      return;
    }

    setNewImageCollectionFiles(validFiles);
    setNewImageCollectionUrl(validFiles.map(f => f.name).join(', '));

    // Create previews
    const previews: string[] = [];
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        previews.push(e.target?.result as string);
        if (previews.length === validFiles.length) {
          setImageCollectionPreviews(previews);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImageFile = () => {
    setNewImageFile(null);
    setNewImagePath("");
    setImagePreview(null);
  };

  const removeImageCollectionFile = (index: number) => {
    const newFiles = newImageCollectionFiles.filter((_, i) => i !== index);
    const newPreviews = imageCollectionPreviews.filter((_, i) => i !== index);

    setNewImageCollectionFiles(newFiles);
    setImageCollectionPreviews(newPreviews);
    setNewImageCollectionUrl(newFiles.map(f => f.name).join(', '));
  };

  // Create product mutation
  const createMutation = useMutation({
    mutationFn: (product: CreateProductRequest) =>
      productService.createProduct(product, newImageFile || undefined, newImageCollectionFiles),
    onSuccess: () => {
      toast.success("Product created successfully");
      setIsCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create product");
    },
  });

  // Update product mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, product }: { id: string; product: UpdateProductRequest }) =>
      productService.updateProduct(id, product, newImageFile || undefined, newImageCollectionFiles),
    onSuccess: () => {
      toast.success("Product updated successfully");
      setIsCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update product");
    },
  });

  // Delete product mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => productService.deleteProduct(id),
    onSuccess: () => {
      toast.success("Product deleted successfully");
      // Invalidate all products queries with proper key structure
      queryClient.invalidateQueries({ queryKey: ['products'] });
      // Also refetch current data for immediate update
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete product");
    },
  });

  const resetForm = () => {
    setEditingProduct(null);
    setNewProductName("");
    setNewProductCode("");
    setNewProductDescription("");
    setNewBasePrice(0);
    setNewImagePath("");
    setNewImageCollectionUrl("");
    setNewImageFile(null);
    setNewImageCollectionFiles([]);
    setImagePreview(null);
    setImageCollectionPreviews([]);
    setSearch("");
    setDebouncedSearch("");
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setNewProductName(product.product_name);
    setNewProductCode(product.product_code);
    setNewProductDescription(product.description);
    setNewBasePrice(product.base_price);
    setNewImagePath(product.image_path);
    setNewImageCollectionUrl(product.image_collection_url);
    setNewImageFile(null);
    setNewImageCollectionFiles([]);
    setImagePreview(null);
    setImageCollectionPreviews([]);
    setIsCreateOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!newProductName.trim()) {
      toast.error("Product name is required");
      return;
    }

    const basePrice = newBasePrice;
    if (isNaN(basePrice) || basePrice < 0) {
      toast.error("Valid base price is required");
      return;
    }

    setIsCreating(true);

    try {
      const productData = {
        product_code: newProductCode.trim(),
        description: newProductDescription.trim(),
        product_name: newProductName.trim(),
        base_price: basePrice,
      };
      
      console.log('Product data:', productData);
      console.log('Image file:', newImageFile);
      console.log('Image collection files:', newImageCollectionFiles);

      if (editingProduct) {
        await updateMutation.mutateAsync({
          id: editingProduct.id,
          product: productData,
        });
      } else {
        await createMutation.mutateAsync(productData);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;

    try {
      await deleteMutation.mutateAsync(deletingProduct.id);
      setIsDeleteOpen(false);
      setDeletingProduct(null);
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const openDeleteDialog = (product: Product) => {
    setDeletingProduct(product);
    setIsDeleteOpen(true);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const handleDialogClose = () => {
    setIsCreateOpen(false);
    resetForm();
  };

  const products = productsData?.products || [];
  const meta = productsData?.meta || { page: 1, page_size: 10, total: 0, total_pages: 0 };

  return (
    <AppLayout title="Products">
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10" />
          <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card/70 backdrop-blur border-border/50" />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Select value={filter} onValueChange={(value: "all" | "product_code") => setFilter(value)}>
            <SelectTrigger className="w-48 bg-card/70 backdrop-blur border-border/50">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Fields</SelectItem>
              <SelectItem value="product_code">Product Code</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value: "product_name" | "base_price") => setSortBy(value)}>
            <SelectTrigger className="w-48 bg-card/70 backdrop-blur border-border/50">
              <Settings className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="product_name">Product Name</SelectItem>
              <SelectItem value="base_price">Base Price</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortOrder} onValueChange={(value: "asc" | "desc") => setSortOrder(value)}>
            <SelectTrigger className="w-32 bg-card/70 backdrop-blur border-border/50">
              <SelectValue placeholder="Order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">A-Z</SelectItem>
              <SelectItem value="desc">Z-A</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            if (open) {
              setIsCreateOpen(true);
            } else {
              handleDialogClose();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="btn-tap">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card">
              <DialogHeader>
                <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Product Code</label>
                  <Input
                    placeholder="Product Code"
                    value={newProductCode}
                    onChange={(e) => setNewProductCode(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Product Name</label>
                  <Input
                    placeholder="Product Name"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Product Description</label>
                  <Input
                    placeholder="Product Description"
                    value={newProductDescription}
                    onChange={(e) => setNewProductDescription(e.target.value)}
                  />
                </div>
                <AmountInput
                  label="Base Price"
                  value={newBasePrice}
                  onChange={setNewBasePrice}
                  placeholder="Masukkan harga dasar"
                  required
                  min={0}
                />
                {/* Single Image Upload */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Product Image</label>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={handleImageFileChange}
                        className="hidden"
                        id="image_path"
                      />
                      <label
                        htmlFor="image_path"
                        className="flex items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors bg-muted/20"
                      >
                        {imagePreview ? (
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="h-full w-full object-cover rounded-lg"
                          />
                        ) : (
                          <div className="text-center p-4">
                            <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Click to upload image</p>
                            <p className="text-xs text-muted-foreground">PNG, JPG, JPEG (max 5MB)</p>
                          </div>
                        )}
                      </label>
                    </div>
                    {imagePreview && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={removeImageFile}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>

                {/* Multiple Image Collection Upload */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Image Collection</label>
                  <div className="space-y-4">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      multiple
                      onChange={handleImageCollectionFilesChange}
                      className="hidden"
                      id="image_collection_url"
                    />
                    <label
                      htmlFor="image_collection_url"
                      className="flex items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors bg-muted/20"
                    >
                      <div className="text-center p-4">
                        <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Click to upload multiple images</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, JPEG (max 5MB each)</p>
                      </div>
                    </label>

                    {/* Image Collection Previews */}
                    {imageCollectionPreviews.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {imageCollectionPreviews.map((preview, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={preview}
                              alt={`Collection ${index + 1}`}
                              className="w-full h-20 object-cover rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => removeImageCollectionFile(index)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={handleSaveProduct} disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {editingProduct ? "Updating..." : "Creating..."}
                      </>
                    ) : (
                      <>
                        {editingProduct ? "Update" : "Create Product"}
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleDialogClose} disabled={isCreating}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <GlassCard>
        {/* Mobile/Tablet: Card View */}
        {isMobile || isTablet ? (
          <div className="p-4">
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: itemsPerPage }).map((_, i) => (
                  <div key={i} className="bg-muted/20 rounded-lg p-4 space-y-3 animate-pulse">
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 bg-muted rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <div className="h-5 bg-muted rounded w-3/4" />
                        <div className="h-4 bg-muted rounded w-1/2" />
                        <div className="h-4 bg-muted rounded w-1/3" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <div className="h-8 w-16 bg-muted rounded" />
                      <div className="h-8 w-16 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No products found</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {products.map((product) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border/50 rounded-lg p-4 hover:shadow-md transition-all"
                  >
                    <div className="flex gap-4">
                      {/* Product Image */}
                      <div className="flex-shrink-0">
                        <div className="w-24 h-24 bg-primary/10 rounded-lg flex items-center justify-center overflow-hidden">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.product_name}
                              className="w-full h-full object-cover rounded-lg"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="space-y-2">
                          <h3 className="font-semibold text-lg text-foreground truncate">
                            {product.product_name}
                          </h3>

                          {product.product_code && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Code:</span>
                              <Badge size="sm" variant="default">
                                {product.product_code}
                              </Badge>
                            </div>
                          )}

                          {product.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {product.description}
                            </p>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-primary">
                              <FormattedAmount value={product.base_price} />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditProduct(product)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openDeleteDialog(product)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Desktop: Table View */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left py-3 px-4 font-medium text-foreground">Product</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Description</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Price</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted-foreground">
                      No products found
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <motion.tr
                      key={product.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-24 w-24 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.product_name}
                                className="h-24 w-24 rounded-lg object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                          </div>
                          <div>
                            <div className="font-semibold text-lg text-foreground">{product.product_name}</div>
                            {product.product_code && (
                              <div className="flex gap-1 items-center">
                                <span className="text-muted-foreground text-sm">Code:</span>
                                <div className="text-[0.8rem]">
                                  <Badge size="sm" variant="default">
                                    {product.product_code}
                                  </Badge>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-muted-foreground max-w-xs truncate">
                          {product.description || "-"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-foreground">
                          <FormattedAmount value={product.base_price} />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDeleteDialog(product)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 border-t border-border/30">
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
              {productsData?.products ? `Showing ${productsData.products.length} products` : 'Loading...'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {meta.total_pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= meta.total_pages}
            >
              Next
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="glass-card max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Are you sure?</h3>
              <p className="text-muted-foreground">
                This will permanently delete the product "{deletingProduct?.product_name}". This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="destructive"
                onClick={handleDeleteProduct}
                disabled={deleteMutation.isPending}
                className="flex-1"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} className="mr-2" />
                    Delete Product
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteOpen(false);
                  setDeletingProduct(null);
                }}
                disabled={deleteMutation.isPending}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
