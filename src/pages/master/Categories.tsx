import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Edit, Trash2, ArrowLeft, Save, X, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  description: string;
  productCount: number;
  createdAt: string;
  status: "active" | "inactive";
}

// Mock data for categories
const mockCategories: Category[] = [
  { id: "1", name: "Nugget", description: "Chicken nuggets and similar products", productCount: 12, createdAt: "2024-01-15", status: "active" },
  { id: "2", name: "Sausage", description: "Various sausage products", productCount: 8, createdAt: "2024-01-16", status: "active" },
  { id: "3", name: "Seafood", description: "Frozen seafood products", productCount: 5, createdAt: "2024-01-17", status: "active" },
  { id: "4", name: "Dim Sum", description: "Asian dim sum varieties", productCount: 15, createdAt: "2024-01-18", status: "active" },
  { id: "5", name: "Meatball", description: "Meatball products", productCount: 6, createdAt: "2024-01-19", status: "inactive" },
  { id: "6", name: "Snack", description: "Various snack items", productCount: 10, createdAt: "2024-01-20", status: "active" },
];

interface CategoryFormData {
  name: string;
  description: string;
  status: "active" | "inactive";
}

export default function Categories() {
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({
    name: "",
    description: "",
    status: "active",
  });

  const filtered = mockCategories.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      status: "active",
    });
    setIsCreating(false);
    setEditingId(null);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setFormData({
      name: "",
      description: "",
      status: "active",
    });
  };

  const handleEdit = (category: Category) => {
    setIsCreating(false);
    setEditingId(category.id);
    setFormData({
      name: category.name,
      description: category.description,
      status: category.status,
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (isCreating) {
        toast.success("Category created successfully!");
      } else {
        toast.success("Category updated successfully!");
      }

      resetForm();
    } catch (error) {
      toast.error("Failed to save category. Please try again.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success("Category deleted successfully!");
    } catch (error) {
      toast.error("Failed to delete category. Please try again.");
    }
  };

  const handleCancel = () => {
    resetForm();
  };

  return (
    <AppLayout title="Categories">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Link to="/master/products">
            <Button variant="ghost" size="sm" className="btn-tap">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Products
            </Button>
          </Link>
          
          <div className="relative flex-1">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10" />
            <Input
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card/70 backdrop-blur border-border/50"
            />
          </div>
          
          <Button onClick={handleCreate} className="btn-tap">
            <Plus className="h-4 w-4 mr-1" />
            Add Category
          </Button>
        </div>

        {/* Create/Edit Form */}
        {(isCreating || editingId) && (
          <GlassCard className="p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">
              {isCreating ? "Create New Category" : "Edit Category"}
            </h3>
            
            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category Name</label>
                <Input
                  placeholder="Enter category name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  placeholder="Enter category description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="status"
                      checked={formData.status === "active"}
                      onChange={() => setFormData(prev => ({ ...prev, status: "active" }))}
                      className="text-primary"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="status"
                      checked={formData.status === "inactive"}
                      onChange={() => setFormData(prev => ({ ...prev, status: "inactive" }))}
                      className="text-primary"
                    />
                    <span className="text-sm">Inactive</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} className="btn-tap">
                  <Save className="h-4 w-4 mr-2" />
                  {isCreating ? "Create" : "Update"}
                </Button>
                <Button variant="outline" onClick={handleCancel} className="btn-tap">
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Categories List */}
        <div className="grid gap-3">
          <AnimatePresence>
            {filtered.map((category, i) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: i * 0.05 }}
              >
                <GlassCard hover className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Package className="h-6 w-6 text-primary" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground">{category.name}</h3>
                          <Badge variant={category.status === "active" ? "default" : "secondary"} className="text-xs">
                            {category.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{category.description}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{category.productCount} products</span>
                          <span>Created {category.createdAt}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(category)}
                        className="btn-tap"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(category.id)}
                        className="btn-tap text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {search ? "No categories found matching your search" : "No categories found"}
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
