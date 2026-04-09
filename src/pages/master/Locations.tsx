import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Edit, Trash2, MapPin, Building, Phone, Mail } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Location {
  id: string;
  code: string;
  name: string;
  type: "warehouse" | "koperasi";
  address: string;
  pic: string;
  phone: string;
  email: string;
  status: "active" | "inactive";
}

const mockLocations: Location[] = [
  {
    id: "1",
    code: "WH-001",
    name: "Gudang Utama Jakarta",
    type: "warehouse",
    address: "Jl. Gudang No. 123, Jakarta Pusat",
    pic: "Budi Santoso",
    phone: "08123456789",
    email: "warehouse@argopos.id",
    status: "active",
  },
  {
    id: "2",
    code: "KOP-001",
    name: "Koperasi Maju Jaya",
    type: "koperasi",
    address: "Jl. Koperasi No. 45, Jakarta Selatan",
    pic: "Hendra Wijaya",
    phone: "08198765432",
    email: "koperasi@majujaya.id",
    status: "active",
  },
  {
    id: "3",
    code: "WH-002",
    name: "Gudang Cabang Surabaya",
    type: "warehouse",
    address: "Jl. Surabaya No. 67, Surabaya",
    pic: "Rina Susanti",
    phone: "08134567890",
    email: "surabaya@argopos.id",
    status: "active",
  },
  {
    id: "4",
    code: "KOP-002",
    name: "Koperasi Sejahtera",
    type: "koperasi",
    address: "Jl. Sejahtera No. 89, Bandung",
    pic: "Agus Pratama",
    phone: "08223456789",
    email: "koperasi@sejahtera.id",
    status: "inactive",
  },
];

export default function MasterLocations() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "warehouse" | "koperasi">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filtered = mockLocations.filter((loc) => {
    const matchesSearch = loc.name.toLowerCase().includes(search.toLowerCase()) || 
                         loc.code.toLowerCase().includes(search.toLowerCase()) ||
                         loc.pic.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || loc.type === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <AppLayout title="Master Lokasi">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari lokasi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/70 backdrop-blur border-border/50"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(["all", "warehouse", "koperasi"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="btn-tap capitalize text-xs px-2.5 whitespace-nowrap"
            >
              {f === "warehouse" && <Building className="h-3 w-3 mr-1" />}
              {f === "koperasi" && <MapPin className="h-3 w-3 mr-1" />}
              {f}
            </Button>
          ))}
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="btn-tap w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" /> Tambah Lokasi
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card">
            <DialogHeader>
              <DialogTitle>Tambah Lokasi Baru</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Kode Lokasi" />
              <Input placeholder="Nama Lokasi" />
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Tipe Lokasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="koperasi">Koperasi</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Alamat Lengkap" />
              <Input placeholder="PIC" />
              <Input placeholder="No. Telepon" />
              <Input placeholder="Email" type="email" />
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

      {/* Locations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((location, i) => (
          <motion.div
            key={location.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                {location.type === "warehouse" ? (
                  <Building className="h-5 w-5 text-primary" />
                ) : (
                  <MapPin className="h-5 w-5 text-primary" />
                )}
              </div>
              <Badge variant={location.status === "active" ? "default" : "destructive"}>
                {location.status}
              </Badge>
            </div>
            
            <div className="space-y-2 mb-3">
              <div>
                <h3 className="font-medium text-sm">{location.name}</h3>
                <p className="text-xs text-muted-foreground">{location.code}</p>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-start gap-1">
                  <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{location.address}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {location.phone}
                </div>
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {location.email}
                </div>
                <div>PIC: {location.pic}</div>
              </div>
            </div>
            
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="flex-1">
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Lokasi tidak ditemukan</p>
        </div>
      )}
    </AppLayout>
  );
}
