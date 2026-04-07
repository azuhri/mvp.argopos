import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { mockCustomers as initialCustomers, Customer } from "@/lib/mockData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Plus, Users as UsersIcon, Briefcase, Pencil, Trash2, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const emptyCustomer: Omit<Customer, "id" | "created_at"> = {
  name: "", email: "", phone: "", type: "external", status: "active",
};

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "internal" | "external">("all");

  // Modal states
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<Omit<Customer, "id" | "created_at">>(emptyCustomer);
  const [isEditing, setIsEditing] = useState(false);

  const filtered = customers.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || c.type === filter;
    return matchSearch && matchFilter;
  });

  const openCreate = () => {
    setIsEditing(false);
    setFormData(emptyCustomer);
    setFormOpen(true);
  };

  const openEdit = (c: Customer) => {
    setIsEditing(true);
    setSelectedCustomer(c);
    setFormData({ name: c.name, email: c.email, phone: c.phone, type: c.type, status: c.status, employee_id: c.employee_id, koperasi_id: c.koperasi_id });
    setFormOpen(true);
  };

  const openDetail = (c: Customer) => { setSelectedCustomer(c); setDetailOpen(true); };
  const openDelete = (c: Customer) => { setSelectedCustomer(c); setDeleteOpen(true); };

  const handleSave = () => {
    if (!formData.name || !formData.email || !formData.phone) {
      toast.error("Nama, email, dan telepon wajib diisi");
      return;
    }
    if (isEditing && selectedCustomer) {
      setCustomers((prev) => prev.map((c) => c.id === selectedCustomer.id ? { ...c, ...formData } : c));
      toast.success("Customer berhasil diperbarui");
    } else {
      const newCustomer: Customer = {
        ...formData,
        id: String(Date.now()),
        created_at: new Date().toISOString().split("T")[0],
      };
      setCustomers((prev) => [...prev, newCustomer]);
      toast.success("Customer berhasil ditambahkan");
    }
    setFormOpen(false);
  };

  const handleDelete = () => {
    if (selectedCustomer) {
      setCustomers((prev) => prev.filter((c) => c.id !== selectedCustomer.id));
      toast.success("Customer berhasil dihapus");
    }
    setDeleteOpen(false);
  };

  return (
    <AppLayout title="Customers">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/70 backdrop-blur border-border/50"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 flex-1 min-w-0">
            {(["all", "internal", "external"] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f)}
                className="btn-tap capitalize text-xs px-2.5"
              >
                {f === "internal" && <Briefcase className="h-3 w-3 mr-1" />}
                {f === "external" && <UsersIcon className="h-3 w-3 mr-1" />}
                {f}
              </Button>
            ))}
          </div>
          <Button size="sm" className="btn-tap shrink-0" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Tambah
          </Button>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block">
        <GlassCard className="overflow-x-auto p-0">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Nama</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden xl:table-cell">Email</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Telepon</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Tipe</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">Status</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((c, i) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-foreground">{c.name}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden xl:table-cell">{c.email}</td>
                    <td className="py-3 px-4 text-muted-foreground">{c.phone}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className={cn("text-xs", c.type === "internal" ? "border-primary/30 text-primary" : "border-border text-muted-foreground")}>
                        {c.type}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center"><StatusBadge status={c.status} /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDetail(c)}><Eye className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => openDelete(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </GlassCard>
      </div>

      {/* Mobile/Tablet Cards */}
      <div className="lg:hidden grid gap-3 sm:grid-cols-2">
        <AnimatePresence>
          {filtered.map((c, i) => (
            <GlassCard key={c.id} hover delay={i * 0.05} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0 flex-1 mr-2">
                  <p className="font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                  <p className="text-xs text-muted-foreground">{c.phone}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className={cn("text-xs", c.type === "internal" ? "border-primary/30 text-primary" : "border-border text-muted-foreground")}>
                  {c.type}
                </Badge>
                {c.employee_id && <span className="text-xs text-muted-foreground">{c.employee_id}</span>}
              </div>
              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/30">
                <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={() => openDetail(c)}>
                  <Eye className="h-3 w-3 mr-1" /> Detail
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={() => openEdit(c)}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs flex-1 text-destructive hover:text-destructive" onClick={() => openDelete(c)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Hapus
                </Button>
              </div>
            </GlassCard>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <UsersIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Tidak ada customer ditemukan</p>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detail Customer</DialogTitle>
            <DialogDescription>Informasi lengkap customer</DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-[100px_1fr] gap-2">
                <span className="text-muted-foreground">Nama</span>
                <span className="font-medium">{selectedCustomer.name}</span>
                <span className="text-muted-foreground">Email</span>
                <span>{selectedCustomer.email}</span>
                <span className="text-muted-foreground">Telepon</span>
                <span>{selectedCustomer.phone}</span>
                <span className="text-muted-foreground">Tipe</span>
                <Badge variant="outline" className={cn("text-xs w-fit", selectedCustomer.type === "internal" ? "border-primary/30 text-primary" : "")}>
                  {selectedCustomer.type}
                </Badge>
                {selectedCustomer.employee_id && (
                  <>
                    <span className="text-muted-foreground">Employee ID</span>
                    <span>{selectedCustomer.employee_id}</span>
                  </>
                )}
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={selectedCustomer.status} />
                <span className="text-muted-foreground">Dibuat</span>
                <span>{selectedCustomer.created_at}</span>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setDetailOpen(false); if (selectedCustomer) openEdit(selectedCustomer); }}>
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={() => { setDetailOpen(false); if (selectedCustomer) openDelete(selectedCustomer); }}>
              <Trash2 className="h-3 w-3 mr-1" /> Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Modal */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Customer" : "Tambah Customer"}</DialogTitle>
            <DialogDescription>{isEditing ? "Perbarui informasi customer" : "Isi data customer baru"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nama *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nama lengkap" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@contoh.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Telepon *</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="08xxxxxxxxxx" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipe</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as "internal" | "external", employee_id: v === "external" ? undefined : formData.employee_id })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="external">External</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as "active" | "inactive" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formData.type === "internal" && (
              <div className="space-y-1.5">
                <Label>Employee ID</Label>
                <Input value={formData.employee_id || ""} onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })} placeholder="EMP-XXX" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={handleSave}>{isEditing ? "Simpan" : "Tambah"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{selectedCustomer?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
