import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { mockProducts, formatCurrency } from "@/lib/mockData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Package, AlertTriangle, Filter, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export default function Products() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Get unique categories
  const categories = ["all", ...Array.from(new Set(mockProducts.map(p => p.category)))];

  const filtered = mockProducts.filter(
    (p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                          p.category.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    }
  );

  const isLowStock = (stock: number) => stock <= 10;

  return (
    <AppLayout title="Products">
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10" />
          <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card/70 backdrop-blur border-border/50" />
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48 bg-card/70 backdrop-blur border-border/50">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category === "all" ? "All Categories" : category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Link to="/master/categories">
            <Button variant="outline" className="btn-tap">
              <Settings className="h-4 w-4 mr-1" /> Categories
            </Button>
          </Link>
          
          <Link to="/master/products/create">
            <Button className="btn-tap">
              <Plus className="h-4 w-4 mr-1" /> Add Product
            </Button>
          </Link>
          
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <GlassCard className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Product</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Category</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">Price</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">Stock</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <img src={p.image_url} alt={p.name} className="w-full" />
                        </div>
                        <span className="font-medium text-foreground">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-xs">{p.category}</Badge>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-foreground">{formatCurrency(p.price)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isLowStock(p.stock) && (
                          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                            <AlertTriangle className="h-4 w-4 text-warning" />
                          </motion.div>
                        )}
                        <span className={cn("font-medium", isLowStock(p.stock) ? "text-warning" : "text-foreground")}>
                          {p.stock} {p.unit}
                        </span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </GlassCard>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden grid gap-3">
        {filtered.map((p, i) => (
          <GlassCard key={p.id} hover delay={i * 0.05} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <img src={p.image_url} alt={p.name} className="w-full" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{p.name}</p>
                  <Badge variant="outline" className="text-xs mt-1">{p.category}</Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
              <span className="font-semibold text-foreground">{formatCurrency(p.price)}</span>
              <div className="flex items-center gap-1">
                {isLowStock(p.stock) && <AlertTriangle className="h-3 w-3 text-warning" />}
                <span className={cn("text-sm", isLowStock(p.stock) ? "text-warning font-medium" : "text-muted-foreground")}>
                  {p.stock} {p.unit}
                </span>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </AppLayout>
  );
}
