import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { mockProducts } from "@/lib/mockData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, Save, X, Image as ImageIcon, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProductImageCropDialog } from "@/components/master/ProductImageCropDialog";
import {
  getProductImageValidationError,
  PRODUCT_COLLECTION_BATCH_MAX_BYTES,
  PRODUCT_COLLECTION_IMAGE_MAX_BYTES,
  PRODUCT_MAIN_IMAGE_MAX_BYTES,
  readFileAsDataUrl,
} from "@/lib/productImageCrop";

type ProductCropTarget = "main" | "collection";

interface ProductCropRequest {
  file: File;
  target: ProductCropTarget;
  current: number;
  total: number;
}

interface ProductFormData {
  category: string;
  name: string;
  description: string;
  basePrice: string;
  catalogImage: File | null;
  catalogPreview: string;
  carouselImages: File[];
  carouselPreviews: string[];
}

interface FormErrors {
  category?: string;
  name?: string;
  description?: string;
  basePrice?: string;
  catalogImage?: string;
  carouselImages?: string;
}

export default function CreateProduct() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get unique categories from existing products
  const categories = Array.from(new Set(mockProducts.map(p => p.category)));

  const [formData, setFormData] = useState<ProductFormData>({
    category: "",
    name: "",
    description: "",
    basePrice: "",
    catalogImage: null,
    catalogPreview: "",
    carouselImages: [],
    carouselPreviews: [],
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cropQueue, setCropQueue] = useState<ProductCropRequest[]>([]);

  const handleInputChange = (field: keyof ProductFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const handleCatalogImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const validationError = getProductImageValidationError(
      file,
      PRODUCT_MAIN_IMAGE_MAX_BYTES,
    );
    if (validationError) {
      setErrors(prev => ({ ...prev, catalogImage: validationError }));
      return;
    }

    setCropQueue([{ file, target: "main", current: 1, total: 1 }]);
  };

  const removeCatalogImage = () => {
    setFormData(prev => ({
      ...prev,
      catalogImage: null,
      catalogPreview: "",
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCarouselImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    // Validate max 5 images
    if (formData.carouselImages.length + files.length > 5) {
      setErrors(prev => ({ ...prev, carouselImages: "Maximum 5 carousel images allowed" }));
      return;
    }

    const validFiles: File[] = [];

    for (const file of files) {
      const validationError = getProductImageValidationError(
        file,
        PRODUCT_COLLECTION_IMAGE_MAX_BYTES,
      );
      if (validationError) {
        setErrors(prev => ({ ...prev, carouselImages: validationError }));
        return;
      }

      validFiles.push(file);
    }

    const totalSize = validFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > PRODUCT_COLLECTION_BATCH_MAX_BYTES) {
      setErrors(prev => ({
        ...prev,
        carouselImages: "Total ukuran gambar dalam satu batch maksimal 20 MB",
      }));
      return;
    }

    setCropQueue(
      validFiles.map((file, index) => ({
        file,
        target: "collection",
        current: index + 1,
        total: validFiles.length,
      })),
    );
  };

  const handleCropConfirm = async (croppedFile: File) => {
    const activeCrop = cropQueue[0];
    if (!activeCrop) return;

    const preview = await readFileAsDataUrl(croppedFile);
    if (activeCrop.target === "main") {
      setFormData(prev => ({
        ...prev,
        catalogImage: croppedFile,
        catalogPreview: preview,
      }));
      setErrors(prev => ({ ...prev, catalogImage: "" }));
    } else {
      setFormData(prev => ({
        ...prev,
        carouselImages: [...prev.carouselImages, croppedFile],
        carouselPreviews: [...prev.carouselPreviews, preview],
      }));
      setErrors(prev => ({ ...prev, carouselImages: "" }));
    }

    setCropQueue(currentQueue => currentQueue.slice(1));
  };

  const removeCarouselImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      carouselImages: prev.carouselImages.filter((_, i) => i !== index),
      carouselPreviews: prev.carouselPreviews.filter((_, i) => i !== index),
    }));
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};

    if (!formData.category.trim()) newErrors.category = "Category is required";
    if (!formData.name.trim()) newErrors.name = "Product name is required";
    if (!formData.description.trim()) newErrors.description = "Description is required";
    if (!formData.basePrice.trim()) {
      newErrors.basePrice = "Base price is required";
    } else if (isNaN(Number(formData.basePrice)) || Number(formData.basePrice) <= 0) {
      newErrors.basePrice = "Please enter a valid price";
    }
    if (!formData.catalogImage) newErrors.catalogImage = "Catalog image is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Here you would normally send the data to your API
      console.log("Product data:", {
        category: formData.category,
        name: formData.name,
        description: formData.description,
        basePrice: Number(formData.basePrice),
        image: formData.catalogImage,
      });

      toast.success("Product created successfully!");
      navigate("/master/products");
    } catch (error) {
      toast.error("Failed to create product. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout title="Create Product">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/master/products">
            <Button variant="ghost" size="sm" className="btn-tap">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Product Management
            </Button>
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <GlassCard className="p-6">
            <div className="grid gap-6">
              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-medium">
                  Category <span className="text-destructive">*</span>
                </Label>
                <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                  <SelectTrigger className={cn(errors.category && "border-destructive")}>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-xs text-destructive mt-1">{errors.category}</p>
                )}
              </div>

              {/* Product Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Product Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Enter product name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className={cn(errors.name && "border-destructive")}
                />
                {errors.name && (
                  <p className="text-xs text-destructive mt-1">{errors.name}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Enter product description"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  className={cn(errors.description && "border-destructive")}
                />
                {errors.description && (
                  <p className="text-xs text-destructive mt-1">{errors.description}</p>
                )}
              </div>

              {/* Base Price */}
              <div className="space-y-2">
                <Label htmlFor="basePrice" className="text-sm font-medium">
                  Base Price (IDR) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="basePrice"
                  type="number"
                  placeholder="0"
                  value={formData.basePrice}
                  onChange={(e) => handleInputChange("basePrice", e.target.value)}
                  className={cn(errors.basePrice && "border-destructive")}
                />
                {errors.basePrice && (
                  <p className="text-xs text-destructive mt-1">{errors.basePrice}</p>
                )}
              </div>

              {/* Catalog Image Upload */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Catalog Image <span className="text-destructive">*</span>
                </Label>
                
                {formData.catalogPreview ? (
                  <div className="relative">
                    <div className="relative w-full h-48 rounded-lg overflow-hidden bg-muted/20 border border-border/50">
                      <img
                        src={formData.catalogPreview}
                        alt="Catalog preview"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={removeCatalogImage}
                        className="absolute top-2 right-2 h-8 w-8 p-0 btn-tap"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border/50 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                    <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      JPEG, PNG, atau WebP · crop 1:1
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleCatalogImageChange}
                      className="hidden"
                      id="catalog-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-tap"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choose Catalog Image
                    </Button>
                  </div>
                )}
                {errors.catalogImage && (
                  <p className="text-xs text-destructive mt-1">{errors.catalogImage}</p>
                )}
              </div>

              {/* Carousel Images Upload */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Display Carousel Images <span className="text-muted-foreground">(Optional, max 5)</span>
                </Label>
                
                {formData.carouselPreviews.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {formData.carouselPreviews.map((preview, index) => (
                      <div key={index} className="relative">
                        <div className="relative w-full h-32 rounded-lg overflow-hidden bg-muted/20 border border-border/50">
                          <img
                            src={preview}
                            alt={`Carousel ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeCarouselImage(index)}
                            className="absolute top-1 right-1 h-6 w-6 p-0 btn-tap"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 text-center">
                          Image {index + 1}
                        </p>
                      </div>
                    ))}
                    
                    {formData.carouselPreviews.length < 5 && (
                      <div className="border-2 border-dashed border-border/50 rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={handleCarouselImagesChange}
                          className="hidden"
                          id={`carousel-upload-${formData.carouselPreviews.length}`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const input = document.getElementById(`carousel-upload-${formData.carouselPreviews.length}`) as HTMLInputElement;
                            input?.click();
                          }}
                          className="btn-tap w-full h-32 flex flex-col items-center justify-center"
                        >
                          <Plus className="h-4 w-4 mb-1" />
                          <span className="text-xs">Add More</span>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                
                {formData.carouselPreviews.length === 0 && (
                  <div className="border-2 border-dashed border-border/50 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                    <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Click to upload carousel images
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Maks. 5 MB/file · crop 1:1 · maksimal 5 gambar
                    </p>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handleCarouselImagesChange}
                      className="hidden"
                      id="carousel-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const input = document.getElementById('carousel-upload') as HTMLInputElement;
                        input?.click();
                      }}
                      className="btn-tap"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choose Carousel Images
                    </Button>
                  </div>
                )}
                {errors.carouselImages && (
                  <p className="text-xs text-destructive mt-1">{errors.carouselImages}</p>
                )}
              </div>
            </div>
          </GlassCard>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Link to="/master/products">
              <Button type="button" variant="outline" className="btn-tap">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="btn-tap"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Product
                </>
              )}
            </Button>
          </div>
        </form>

        <ProductImageCropDialog
          file={cropQueue[0]?.file ?? null}
          open={cropQueue.length > 0}
          current={cropQueue[0]?.current}
          total={cropQueue[0]?.total}
          onCancel={() => setCropQueue([])}
          onConfirm={handleCropConfirm}
        />
      </div>
    </AppLayout>
  );
}
