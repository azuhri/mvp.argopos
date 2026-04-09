import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Edit, Trash2, Users, UserCheck, UserX, Mail, Phone } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockCustomers } from "@/lib/mockData";
import { useAuth } from "@/lib/auth";

export default function MasterUsers() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "internal" | "external">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filtered = mockCustomers.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
                         c.email.toLowerCase().includes(search.toLowerCase()) ||
                         c.phone.includes(search);
    const matchesFilter = filter === "all" || c.type === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <AppLayout title="Master User">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/70 backdrop-blur border-border/50"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(["all", "internal", "external"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="btn-tap capitalize text-xs px-2.5 whitespace-nowrap"
            >
              {f === "internal" && <UserCheck className="h-3 w-3 mr-1" />}
              {f === "external" && <UserX className="h-3 w-3 mr-1" />}
              {f}
            </Button>
          ))}
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="btn-tap w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" /> Tambah User
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card">
            <DialogHeader>
              <DialogTitle>Tambah User Baru</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Nama Lengkap" />
              <Input placeholder="Email" type="email" />
              <Input placeholder="No. Telepon" />
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Tipe User" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                </SelectContent>
              </Select>
              {filter === "internal" && <Input placeholder="Employee ID" />}
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

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((user, i) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <Badge variant={user.type === "internal" ? "default" : "secondary"}>
                {user.type}
              </Badge>
            </div>
            
            <div className="space-y-2 mb-3">
              <h3 className="font-medium text-sm">{user.name}</h3>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {user.email}
                </div>
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {user.phone}
                </div>
                {user.employee_id && (
                  <div>Employee ID: {user.employee_id}</div>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <Badge variant={user.status === "active" ? "default" : "destructive"}>
                {user.status}
              </Badge>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost">
                  <Edit className="h-3 w-3" />
                </Button>
                {currentUser?.role === "super_admin" && (
                  <Button size="sm" variant="ghost" className="text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">User tidak ditemukan</p>
        </div>
      )}
    </AppLayout>
  );
}
