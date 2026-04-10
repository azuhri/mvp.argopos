import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Edit, Trash2, ShieldCheck, Shield, ShieldX } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { NAV_GROUPS_MENUS, type MenuKey } from "@/lib/navigation";

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Record<MenuKey, "hidden" | "read" | "write">;
  userCount: number;
}

const mockRoles: Role[] = [
  {
    id: "1",
    name: "Super Admin",
    description: "Akses penuh ke semua fitur",
    permissions: Object.fromEntries(
      NAV_GROUPS_MENUS.flatMap(group => group.listMenus).map(item => [item.key, "write" as const])
    ) as Record<MenuKey, "write">,
    userCount: 1,
  },
  {
    id: "2",
    name: "Staff Internal",
    description: "Akses operasional dan master data terbatas",
    permissions: {
      dashboard: "read",
      transactions: "write",
      products: "write",
      customers: "write",
      koperasi: "read",
      store: "read",
      cart: "write",
      master_users: "hidden",
      master_locations: "read",
      master_roles: "hidden",
      master_stock: "write",
    },
    userCount: 5,
  },
  {
    id: "3",
    name: "Sales External",
    description: "Akses storefront dan cart saja",
    permissions: {
      dashboard: "read",
      transactions: "read",
      products: "read",
      customers: "hidden",
      koperasi: "hidden",
      store: "write",
      cart: "write",
      master_users: "hidden",
      master_locations: "hidden",
      master_roles: "hidden",
      master_stock: "hidden",
    },
    userCount: 12,
  },
];

const permissionLabels = {
  hidden: "Hidden",
  read: "Read",
  write: "Write",
} as const;

const permissionColors = {
  hidden: "destructive",
  read: "secondary",
  write: "default",
} as const;

export default function MasterRoles() {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const filtered = mockRoles.filter((role) =>
    role.name.toLowerCase().includes(search.toLowerCase()) ||
    role.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setIsCreateOpen(true);
  };

  return (
    <AppLayout title="Role Management">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/70 backdrop-blur border-border/50"
          />
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) setEditingRole(null);
        }}>
          <DialogTrigger asChild>
            <Button className="btn-tap w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" /> Tambah Role
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRole ? "Edit Role" : "Tambah Role Baru"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input placeholder="Nama Role" defaultValue={editingRole?.name || ""} />
                <Input placeholder="Deskripsi" defaultValue={editingRole?.description || ""} />
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Permission per Menu</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {NAV_ITEMS.map((item) => {
                    const currentPermission = editingRole?.permissions[item.key] || "hidden";
                    return (
                      <div key={item.key} className="flex items-center justify-between p-2 rounded-lg border">
                        <div className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span className="text-sm">{item.label}</span>
                        </div>
                        <div className="flex gap-2">
                          {(["hidden", "read", "write"] as const).map((perm) => (
                            <Badge
                              key={perm}
                              variant={currentPermission === perm ? permissionColors[perm] : "outline"}
                              className="cursor-pointer"
                            >
                              {permissionLabels[perm]}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button className="flex-1">{editingRole ? "Update" : "Simpan"}</Button>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Batal
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((role, i) => (
          <motion.div
            key={role.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <Badge variant="outline">{role.userCount} users</Badge>
            </div>
            
            <div className="space-y-2 mb-3">
              <h3 className="font-medium text-sm">{role.name}</h3>
              <p className="text-xs text-muted-foreground">{role.description}</p>
            </div>
            
            <div className="space-y-1 mb-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Permissions:</p>
              <div className="flex flex-wrap gap-1">
                {NAV_ITEMS.filter(item => role.permissions[item.key] !== "hidden").map((item) => {
                  const perm = role.permissions[item.key];
                  return (
                    <Badge
                      key={item.key}
                      variant={perm === "write" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {item.icon && <item.icon className="h-2 w-2 mr-1" />}
                      {item.label}
                    </Badge>
                  );
                })}
              </div>
            </div>
            
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="flex-1" onClick={() => handleEditRole(role)}>
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
              {role.name !== "Super Admin" && (
                <Button size="sm" variant="ghost" className="text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Role tidak ditemukan</p>
        </div>
      )}
    </AppLayout>
  );
}
