import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Edit, Trash2, Package, TrendingUp, TrendingDown, AlertTriangle, Warehouse } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockProducts } from "@/lib/mockData";

interface StockItem {
  id: string;
  productId: string;
  locationId: string;
  locationName: string;
  currentStock: number;
  minStock: number;
  lastUpdated: string;
  movements: Array<{
    id: string;
    type: "in" | "out";
    quantity: number;
    reason: string;
    date: string;
    user: string;
  }>;
}

const mockStocks: StockItem[] = [
  {
    id: "1",
    productId: "1",
    locationId: "WH-001",
    locationName: "Gudang Utama Jakarta",
    currentStock: 120,
    minStock: 20,
    lastUpdated: "2024-04-08",
    movements: [
      { id: "1", type: "in", quantity: 50, reason: "Purchase", date: "2024-04-08", user: "Admin" },
      { id: "2", type: "out", quantity: 10, reason: "Sale", date: "2024-04-07", user: "Staff" },
    ],
  },
  {
    id: "2",
    productId: "2",
    locationId: "WH-001",
    locationName: "Gudang Utama Jakarta",
    currentStock: 85,
    minStock: 30,
    lastUpdated: "2024-04-08",
    movements: [],
  },
  {
    id: "3",
    productId: "3",
    locationId: "WH-001",
    locationName: "Gudang Utama Jakarta",
    currentStock: 8,
    minStock: 15,
    lastUpdated: "2024-04-07",
    movements: [
      { id: "3", type: "out", quantity: 2, reason: "Sale", date: "2024-04-07", user: "Staff" },
    ],
  },
  {
    id: "4",
    productId: "1",
    locationId: "KOP-001",
    locationName: "Koperasi Maju Jaya",
    currentStock: 45,
    minStock: 10,
    lastUpdated: "2024-04-08",
    movements: [],
  },
];

export default function MasterStocks() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "normal" | "high">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);

  const filtered = mockStocks.filter((stock) => {
    const product = mockProducts.find(p => p.id === stock.productId);
    const matchesSearch = product?.name.toLowerCase().includes(search.toLowerCase()) ||
                         stock.locationName.toLowerCase().includes(search.toLowerCase());
    
    let matchesFilter = true;
    if (filter === "low") matchesFilter = stock.currentStock <= stock.minStock;
    else if (filter === "normal") matchesFilter = stock.currentStock > stock.minStock && stock.currentStock <= stock.minStock * 2;
    else if (filter === "high") matchesFilter = stock.currentStock > stock.minStock * 2;
    
    return matchesSearch && matchesFilter;
  });

  const getStockStatus = (stock: StockItem) => {
    if (stock.currentStock <= stock.minStock) return { status: "low", color: "destructive", icon: AlertTriangle };
    if (stock.currentStock <= stock.minStock * 2) return { status: "normal", color: "secondary", icon: Package };
    return { status: "high", color: "default", icon: TrendingUp };
  };

  return (
    <AppLayout title="Stock Management">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari produk atau lokasi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/70 backdrop-blur border-border/50"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(["all", "low", "normal", "high"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="btn-tap capitalize text-xs px-2.5 whitespace-nowrap"
            >
              {f === "low" && <AlertTriangle className="h-3 w-3 mr-1" />}
              {f === "normal" && <Package className="h-3 w-3 mr-1" />}
              {f === "high" && <TrendingUp className="h-3 w-3 mr-1" />}
              {f}
            </Button>
          ))}
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="btn-tap w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" /> Pergerakan Stok
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card">
            <DialogHeader>
              <DialogTitle>Pergerakan Stok</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Produk" />
                </SelectTrigger>
                <SelectContent>
                  {mockProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Lokasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WH-001">Gudang Utama Jakarta</SelectItem>
                  <SelectItem value="KOP-001">Koperasi Maju Jaya</SelectItem>
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Tipe Pergerakan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Masuk</SelectItem>
                  <SelectItem value="out">Keluar</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Jumlah" type="number" />
              <Input placeholder="Alasan" />
              <div className="flex gap-2 pt-2">
                <Button className="flex-1">Simpan</Button>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Batal
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stock Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((stock, i) => {
          const product = mockProducts.find(p => p.id === stock.productId);
          const stockStatus = getStockStatus(stock);
          const StatusIcon = stockStatus.icon;
          
          return (
            <motion.div
              key={stock.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-4 cursor-pointer"
              onClick={() => setSelectedStock(stock)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <Badge variant={stockStatus.color as any}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {stockStatus.status}
                </Badge>
              </div>
              
              <div className="space-y-2 mb-3">
                <div>
                  <h3 className="font-medium text-sm">{product?.name}</h3>
                  <p className="text-xs text-muted-foreground">{stock.locationName}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">{stock.currentStock}</p>
                    <p className="text-xs text-muted-foreground">Min: {stock.minStock}</p>
                  </div>
                  {stock.currentStock <= stock.minStock && (
                    <div className="text-right">
                      <TrendingDown className="h-4 w-4 text-destructive" />
                      <p className="text-xs text-destructive">Low Stock</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Update: {stock.lastUpdated}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost">
                    <Edit className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Warehouse className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Stok tidak ditemukan</p>
        </div>
      )}

      {/* Stock Detail Modal */}
      {selectedStock && (
        <Dialog open={!!selectedStock} onOpenChange={() => setSelectedStock(null)}>
          <DialogContent className="glass-card max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detail Stok</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Produk</p>
                  <p className="font-medium">{mockProducts.find(p => p.id === selectedStock.productId)?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lokasi</p>
                  <p className="font-medium">{selectedStock.locationName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Stok Saat Ini</p>
                  <p className="font-semibold text-lg">{selectedStock.currentStock}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Stok Minimum</p>
                  <p className="font-medium">{selectedStock.minStock}</p>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Riwayat Pergerakan</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedStock.movements.map((movement) => (
                    <div key={movement.id} className="flex items-center justify-between p-2 rounded-lg border">
                      <div className="flex items-center gap-2">
                        {movement.type === "in" ? (
                          <TrendingUp className="h-4 w-4 text-success" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-destructive" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{movement.reason}</p>
                          <p className="text-xs text-muted-foreground">{movement.user} - {movement.date}</p>
                        </div>
                      </div>
                      <Badge variant={movement.type === "in" ? "default" : "destructive"}>
                        {movement.type === "in" ? "+" : "-"}{movement.quantity}
                      </Badge>
                    </div>
                  ))}
                  {selectedStock.movements.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">Belum ada pergerakan stok</p>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AppLayout>
  );
}
