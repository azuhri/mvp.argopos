import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Edit, Trash2, MapPin, Building, Phone, Mail, ChevronLeft, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<keyof typeof mockLocations[0]>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Responsive detection
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      setIsDesktop(window.innerWidth >= 1024); // lg breakpoint
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  const filtered = mockLocations.filter((loc) => {
    const matchesSearch = loc.name.toLowerCase().includes(search.toLowerCase()) ||
      loc.code.toLowerCase().includes(search.toLowerCase()) ||
      loc.pic.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || loc.type === filter;
    return matchesSearch && matchesFilter;
  });

  // Sorting function
  const sortedData = [...filtered].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (aValue === undefined || bValue === undefined) return 0;

    let comparison = 0;
    if (aValue < bValue) comparison = -1;
    if (aValue > bValue) comparison = 1;

    return sortDirection === "asc" ? comparison : -comparison;
  });

  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, endIndex);

  const handleSort = (field: keyof typeof mockLocations[0]) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  return (
    <AppLayout title="Master Lokasi">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex sm:flex-row flex-col gap-2">
          <div className="relative w-full">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10" />
            <Input
              placeholder="Cari lokasi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card/70 backdrop-blur border-border/50"
            />
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
      </div>

      {/* Responsive Locations Display */}
      {isDesktop ? (
        // Desktop: DataTable View
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      {sortField === "name" && (
                        sortDirection === "asc" ? <ChevronLeft className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 rotate-180" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("code")}
                  >
                    <div className="flex items-center gap-1">
                      Code
                      {sortField === "code" && (
                        sortDirection === "asc" ? <ChevronLeft className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 rotate-180" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("type")}
                  >
                    <div className="flex items-center gap-1">
                      Type
                      {sortField === "type" && (
                        sortDirection === "asc" ? <ChevronLeft className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 rotate-180" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>PIC</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("phone")}
                  >
                    <div className="flex items-center gap-1">
                      Phone
                      {sortField === "phone" && (
                        sortDirection === "asc" ? <ChevronLeft className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 rotate-180" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("email")}
                  >
                    <div className="flex items-center gap-1">
                      Email
                      {sortField === "email" && (
                        sortDirection === "asc" ? <ChevronLeft className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 rotate-180" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {sortField === "status" && (
                        sortDirection === "asc" ? <ChevronLeft className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 rotate-180" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((location, index) => (
                  <motion.tr
                    key={location.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <TableCell className="font-medium">{location.name}</TableCell>
                    <TableCell>{location.code}</TableCell>
                    <TableCell>
                      <Badge variant={location.type === "warehouse" ? "default" : "secondary"}>
                        {location.type === "warehouse" && <Building className="h-3 w-3 mr-1" />}
                        {location.type === "koperasi" && <MapPin className="h-3 w-3 mr-1" />}
                        {location.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-1 max-w-xs">
                        <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{location.address}</span>
                      </div>
                    </TableCell>
                    <TableCell>{location.pic}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {location.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {location.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={location.status === "active" ? "default" : "destructive"}>
                        {location.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="border-t border-border/50 p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Items per page:</span>
                <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, sortedData.length)} of {sortedData.length} locations
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="h-8 w-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>
      ) : (
        // Mobile/Tablet: Grid View
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedData.map((location, i) => (
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

          {/* Mobile Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col items-center gap-4 mt-6">
              <span className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, sortedData.length)} of {sortedData.length} locations
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="h-8 w-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 per page</SelectItem>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="25">25 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Lokasi tidak ditemukan</p>
        </div>
      )}
    </AppLayout>
  );
}
