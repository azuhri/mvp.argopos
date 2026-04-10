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

  const handleInputChange = (field: keyof ProductFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const handleCatalogImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, catalogImage: "Please select an image file" }));
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, catalogImage: "Image size should be less than 5MB" }));
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          catalogImage: file,
          catalogPreview: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
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
    if (files.length === 0) return;

    // Validate max 5 images
    if (formData.carouselImages.length + files.length > 5) {
      setErrors(prev => ({ ...prev, carouselImages: "Maximum 5 carousel images allowed" }));
      return;
    }

    // Validate each file
    const validFiles: File[] = [];
    const previews: string[] = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, carouselImages: "All files must be images" }));
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, carouselImages: "Image size should be less than 5MB" }));
        return;
      }

      validFiles.push(file);
    }

    // Read files for previews
    Promise.all(
      validFiles.map(file => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      })
    ).then(newPreviews => {
      setFormData(prev => ({
        ...prev,
        carouselImages: [...prev.carouselImages, ...validFiles],
        carouselPreviews: [...prev.carouselPreviews, ...newPreviews],
      }));
      setErrors(prev => ({ ...prev, carouselImages: "" }));
    });
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
        image: formData.image,
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
                      PNG, JPG, GIF up to 5MB
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
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
                          accept="image/*"
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
                      PNG, JPG, GIF up to 5MB each, max 5 images
                    </p>
                    <input
                      type="file"
                      accept="image/*"
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
      </div>
    </AppLayout>
  );
}
