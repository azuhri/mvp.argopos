import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { AnimatedCounter } from "@/components/shared/AnimatedCounter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { mockKoperasi as initialKoperasi, Koperasi, formatCurrency } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Building2, Phone, User, Pencil, Trash2, Eye, Search } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const emptyKoperasi: Omit<Koperasi, "id" | "total_transactions" | "total_revenue"> = {
  koperasi_code: "", name: "", pic_name: "", pic_contact: "", status: "active",
};

export default function KoperasiPage() {
  const [koperasiList, setKoperasiList] = useState<Koperasi[]>(initialKoperasi);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Koperasi | null>(null);
  const [formData, setFormData] = useState<Omit<Koperasi, "id" | "total_transactions" | "total_revenue">>(emptyKoperasi);
  const [isEditing, setIsEditing] = useState(false);

  const filtered = koperasiList.filter((k) =>
    k.name.toLowerCase().includes(search.toLowerCase()) || k.koperasi_code.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => { setIsEditing(false); setFormData(emptyKoperasi); setFormOpen(true); };
  const openEdit = (k: Koperasi) => {
    setIsEditing(true); setSelected(k);
    setFormData({ koperasi_code: k.koperasi_code, name: k.name, pic_name: k.pic_name, pic_contact: k.pic_contact, status: k.status });
    setFormOpen(true);
  };
  const openDetail = (k: Koperasi) => { setSelected(k); setDetailOpen(true); };
  const openDelete = (k: Koperasi) => { setSelected(k); setDeleteOpen(true); };

  const handleSave = () => {
    if (!formData.name || !formData.koperasi_code || !formData.pic_name || !formData.pic_contact) {
      toast.error("Semua field wajib diisi");
      return;
    }
    if (isEditing && selected) {
      setKoperasiList((prev) => prev.map((k) => k.id === selected.id ? { ...k, ...formData } : k));
      toast.success("Koperasi berhasil diperbarui");
    } else {
      const newK: Koperasi = { ...formData, id: String(Date.now()), total_transactions: 0, total_revenue: 0 };
      setKoperasiList((prev) => [...prev, newK]);
      toast.success("Koperasi berhasil ditambahkan");
    }
    setFormOpen(false);
  };

  const handleDelete = () => {
    if (selected) {
      setKoperasiList((prev) => prev.filter((k) => k.id !== selected.id));
      toast.success("Koperasi berhasil dihapus");
    }
    setDeleteOpen(false);
  };

  return (
    <AppLayout title="Koperasi">
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari koperasi..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card/70 backdrop-blur border-border/50" />
        </div>
        <Button size="sm" className="btn-tap shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Tambah Koperasi
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-4">{filtered.length} koperasi ditemukan</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <AnimatePresence>
          {filtered.map((k, i) => (
            <GlassCard key={k.id} hover delay={i * 0.08}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{k.name}</h3>
                    <p className="text-xs text-muted-foreground">{k.koperasi_code}</p>
                  </div>
                </div>
                <StatusBadge status={k.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Transaksi</p>
                  <p className="text-lg font-bold text-foreground">
                    <AnimatedCounter end={k.total_transactions} />
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  <p className="text-lg font-bold text-foreground">
                    <AnimatedCounter end={k.total_revenue / 1000000} suffix="M" decimals={1} prefix="Rp " />
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                <div className="flex items-center gap-1 min-w-0">
                  <User className="h-3 w-3 shrink-0" />
                  <span className="truncate">{k.pic_name}</span>
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  <Phone className="h-3 w-3 shrink-0" />
                  <span className="truncate">{k.pic_contact}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 pt-3 border-t border-border/30">
                <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={() => openDetail(k)}>
                  <Eye className="h-3 w-3 mr-1" /> Detail
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={() => openEdit(k)}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs flex-1 text-destructive hover:text-destructive" onClick={() => openDelete(k)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Hapus
                </Button>
              </div>
            </GlassCard>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Tidak ada koperasi ditemukan</p>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detail Koperasi</DialogTitle>
            <DialogDescription>Informasi lengkap koperasi</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-[110px_1fr] gap-2">
                <span className="text-muted-foreground">Kode</span>
                <span className="font-medium">{selected.koperasi_code}</span>
                <span className="text-muted-foreground">Nama</span>
                <span className="font-medium">{selected.name}</span>
                <span className="text-muted-foreground">PIC</span>
                <span>{selected.pic_name}</span>
                <span className="text-muted-foreground">Kontak PIC</span>
                <span>{selected.pic_contact}</span>
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={selected.status} />
                <span className="text-muted-foreground">Transaksi</span>
                <span className="font-medium">{selected.total_transactions}</span>
                <span className="text-muted-foreground">Revenue</span>
                <span className="font-medium">{formatCurrency(selected.total_revenue)}</span>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setDetailOpen(false); if (selected) openEdit(selected); }}>
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={() => { setDetailOpen(false); if (selected) openDelete(selected); }}>
              <Trash2 className="h-3 w-3 mr-1" /> Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Modal */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Koperasi" : "Tambah Koperasi"}</DialogTitle>
            <DialogDescription>{isEditing ? "Perbarui data koperasi" : "Isi data koperasi baru"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kode Koperasi *</Label>
                <Input value={formData.koperasi_code} onChange={(e) => setFormData({ ...formData, koperasi_code: e.target.value })} placeholder="KOP-XXX" />
              </div>
              <div className="space-y-1.5">
                <Label>Nama *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nama koperasi" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nama PIC *</Label>
                <Input value={formData.pic_name} onChange={(e) => setFormData({ ...formData, pic_name: e.target.value })} placeholder="Nama PIC" />
              </div>
              <div className="space-y-1.5">
                <Label>Kontak PIC *</Label>
                <Input value={formData.pic_contact} onChange={(e) => setFormData({ ...formData, pic_contact: e.target.value })} placeholder="08xxxxxxxxxx" />
              </div>
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
            <AlertDialogTitle>Hapus Koperasi?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{selected?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
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
