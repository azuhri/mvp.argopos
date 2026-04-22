import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Edit, Trash2, ShieldCheck, Shield, ShieldX, Copy, RotateCcw, Eye, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NAV_GROUPS_MENUS, type MenuKey } from "@/lib/navigation";
import { apiClient, type Role as ApiRole, type Menu, type AccessRole } from "@/lib/api";
import { accessRoleService } from "@/lib/services/accessRoleService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Record<MenuKey, "hidden" | "read" | "write">;
  userCount: number;
}

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

  // Debug state changes
  useEffect(() => {
    console.log('isCreateOpen changed:', isCreateOpen);
  }, [isCreateOpen]);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Record<MenuKey, "hidden" | "read" | "write">>(() => ({} as Record<MenuKey, "hidden" | "read" | "write">));
  const [copySourceRole, setCopySourceRole] = useState<string>("");
  const [copyTargetRole, setCopyTargetRole] = useState<string>("");
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Query for roles with access
  const { data: rolesData, isLoading, refetch, error } = useQuery({
    queryKey: ['roles-with-access'],
    queryFn: async () => {
      try {
        console.log('Fetching roles...');
        const roles = await accessRoleService.getAllRoles();
        console.log('Roles fetched:', roles);
        
        if (!roles || roles.length === 0) {
          console.log('No roles found');
          return [];
        }
        
        const rolesWithPermissions = await Promise.all(
          roles.map(async (role) => {
            try {
              console.log('Fetching permissions for role:', role.id);
              const permissions = await accessRoleService.getRolePermissions(role.id);
              console.log('Permissions for role:', role.id, permissions);
              
              return {
                id: role.id,
                name: role.role_name,
                description: `Role ${role.role_name}`,
                permissions,
                userCount: 0 // TODO: Implement user count query
              } as Role;
            } catch (permError) {
              console.error('Error fetching permissions for role:', role.id, permError);
              return {
                id: role.id,
                name: role.role_name,
                description: `Role ${role.role_name}`,
                permissions: {},
                userCount: 0
              } as Role;
            }
          })
        );
        
        console.log('Final roles data:', rolesWithPermissions);
        return rolesWithPermissions;
      } catch (error) {
        console.error('Error in roles query:', error);
        throw error;
      }
    }
  });

  // Query for menus
  const { data: menus } = useQuery({
    queryKey: ['menus'],
    queryFn: () => accessRoleService.getAllMenus()
  });

  const filtered = rolesData?.filter((role) =>
    role.name.toLowerCase().includes(search.toLowerCase()) ||
    role.description.toLowerCase().includes(search.toLowerCase())
  ) || [];

  // Add error logging
  if (error) {
    console.error('Roles query error:', error);
  }

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setNewRoleName(role.name);
    setNewRoleDescription(role.description);
    setSelectedPermissions(role.permissions);
    setIsCreateOpen(true);
  };

  const handleSaveRole = async () => {
    try {
      if (!newRoleName.trim()) {
        toast.error("Role name is required");
        return;
      }

      setIsCreating(true);

      if (editingRole) {
        // Update existing role permissions
        await accessRoleService.setRolePermissions(editingRole.id, selectedPermissions);
        toast.success("Role permissions updated successfully");
      } else {
        // Create new role using accessRoleService
        console.log('Creating new role:', { role_name: newRoleName, description: newRoleDescription });
        const newRole = await accessRoleService.createRole({
          role_name: newRoleName,
          description: newRoleDescription
        });
        
        console.log('New role created:', newRole);
        
        // Create access roles for the new role using bulk API
        const accessRolesData = Object.entries(selectedPermissions)
          .filter(([_, accessType]) => accessType !== 'hidden')
          .map(([menuKey, accessType]) => {
            // Find menu by menu_name (convert MenuKey back to menu_name format)
            const menu = menus?.find(m => 
              m.menu_name.toLowerCase().replace(/\s+/g, '_') === menuKey
            );
            
            if (!menu) {
              console.warn('Menu not found for key:', menuKey);
              return null;
            }
            
            return {
              role_id: newRole.id,
              menu_id: menu.id,
              access_type: accessType
            };
          })
          .filter(Boolean) as Partial<AccessRole>[];
        
        console.log('Creating access roles:', accessRolesData);
        
        if (accessRolesData.length > 0) {
          await accessRoleService.createBulkAccessRoles({
            access_roles: accessRolesData
          });
          console.log('Access roles created successfully');
        }
        
        toast.success("Role created successfully");
      }

      setIsCreateOpen(false);
      setEditingRole(null);
      setNewRoleName("");
      setNewRoleDescription("");
      setSelectedPermissions({} as Record<MenuKey, "hidden" | "read" | "write">);
      refetch();
    } catch (error) {
      console.error('Error saving role:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save role');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (roleName === "Super Admin") {
      toast.error("Cannot delete Super Admin role");
      return;
    }

    try {
      const confirmed = window.confirm(`Are you sure you want to delete role "${roleName}"? This will also delete all associated permissions.`);
      if (!confirmed) return;

      await apiClient.deleteRole(roleId);
      toast.success("Role deleted successfully");
      refetch();
    } catch (error) {
      console.error('Delete role error:', error);
      toast.error("Failed to delete role");
    }
  };

  const handleViewRoleDetails = async (roleId: string) => {
    try {
      const roleWithAccess = await accessRoleService.getRoleWithAccess(roleId);
      console.log('Role details:', roleWithAccess);
      // Could open a modal with detailed role information
    } catch (error) {
      console.error('Get role details error:', error);
      toast.error("Failed to load role details");
    }
  };

  const handleResetPermissions = async (roleId: string, roleName: string) => {
    try {
      const confirmed = window.confirm(`Are you sure you want to reset all permissions for role "${roleName}"? This will set all permissions to 'hidden'.`);
      if (!confirmed) return;

      // Reset all permissions to hidden
      const hiddenPermissions: Record<MenuKey, "hidden"> = {} as Record<MenuKey, "hidden">;
      const allMenuKeys = NAV_GROUPS_MENUS.flatMap(group => group.listMenus).map(item => item.key);
      allMenuKeys.forEach(key => {
        hiddenPermissions[key] = "hidden";
      });

      await accessRoleService.setRolePermissions(roleId, hiddenPermissions);
      toast.success("Permissions reset successfully");
      refetch();
    } catch (error) {
      console.error('Reset permissions error:', error);
      toast.error("Failed to reset permissions");
    }
  };

  const handleCopyPermissions = async (sourceRoleId: string, targetRoleId: string) => {
    try {
      const sourcePermissions = await accessRoleService.getRolePermissions(sourceRoleId);
      await accessRoleService.setRolePermissions(targetRoleId, sourcePermissions);
      toast.success("Permissions copied successfully");
      refetch();
    } catch (error) {
      console.error('Copy permissions error:', error);
      toast.error("Failed to copy permissions");
    }
  };

  const handlePermissionChange = (menuKey: MenuKey, permission: "hidden" | "read" | "write") => {
    setSelectedPermissions(prev => ({
      ...prev,
      [menuKey]: permission
    }));
  };

  const handleDialogClose = () => {
    console.log('Dialog close called');
    setIsCreateOpen(false);
    setEditingRole(null);
    setNewRoleName("");
    setNewRoleDescription("");
    setSelectedPermissions({} as Record<MenuKey, "hidden" | "read" | "write">);
  };

  const handleDialogOpen = () => {
    console.log('Dialog open called');
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
        <div className="flex gap-2">
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
    console.log('Dialog onOpenChange called with:', open);
    if (open) {
      handleDialogOpen();
    } else {
      handleDialogClose();
    }
  }}>
            <DialogTrigger asChild>
              <Button className="btn-tap">
                <Plus className="h-4 w-4 mr-1" /> Tambah Role
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRole ? "Edit Role" : "Tambah Role Baru"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    placeholder="Nama Role" 
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    disabled={!!editingRole} // Don't allow editing role name for existing roles
                  />
                  <Input 
                    placeholder="Deskripsi" 
                    value={newRoleDescription}
                    onChange={(e) => setNewRoleDescription(e.target.value)}
                  />
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Permission per Menu</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {NAV_GROUPS_MENUS.flatMap(group => group.listMenus).map((item) => {
                      const currentPermission = selectedPermissions[item.key] || "hidden";
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
                                onClick={() => handlePermissionChange(item.key, perm)}
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
                  <Button className="flex-1" onClick={handleSaveRole} disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {editingRole ? "Updating..." : "Creating..."}
                      </>
                    ) : (
                      <>
                        {editingRole ? "Update" : "Simpan"}
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleDialogClose} disabled={isCreating}>
                    Batal
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Copy className="h-4 w-4 mr-1" /> Copy Permissions
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card max-w-md">
              <DialogHeader>
                <DialogTitle>Copy Permissions</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">From Role:</label>
                  <Select value={copySourceRole} onValueChange={setCopySourceRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source role" />
                    </SelectTrigger>
                    <SelectContent>
                      {rolesData?.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">To Role:</label>
                  <Select value={copyTargetRole} onValueChange={setCopyTargetRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target role" />
                    </SelectTrigger>
                    <SelectContent>
                      {rolesData?.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button 
                    className="flex-1" 
                    onClick={() => {
                      if (copySourceRole && copyTargetRole) {
                        handleCopyPermissions(copySourceRole, copyTargetRole);
                        setShowCopyDialog(false);
                        setCopySourceRole("");
                        setCopyTargetRole("");
                      }
                    }}
                    disabled={!copySourceRole || !copyTargetRole}
                  >
                    Copy
                  </Button>
                  <Button variant="outline" onClick={() => setShowCopyDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Roles Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card p-4 space-y-3">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-muted/50 rounded-full animate-pulse" />
                <div className="w-16 h-6 bg-muted/50 rounded animate-pulse" />
              </div>
              <div className="space-y-2 mb-3">
                <div className="w-24 h-4 bg-muted/50 rounded animate-pulse" />
                <div className="w-32 h-3 bg-muted/50 rounded animate-pulse" />
              </div>
              <div className="space-y-1 mb-3">
                <div className="w-20 h-3 bg-muted/50 rounded animate-pulse" />
                <div className="flex gap-1">
                  <div className="w-16 h-6 bg-muted/50 rounded animate-pulse" />
                  <div className="w-16 h-6 bg-muted/50 rounded animate-pulse" />
                </div>
              </div>
              <div className="flex gap-1">
                <div className="w-16 h-8 bg-muted/50 rounded animate-pulse" />
                <div className="w-16 h-8 bg-muted/50 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="text-red-500 mb-4">
            <ShieldX className="h-12 w-12 mx-auto mb-4" />
            <h3 className="text-lg font-medium">Error Loading Roles</h3>
            <p className="text-sm text-muted-foreground mt-2">
              {error instanceof Error ? error.message : 'Failed to load roles data'}
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            Try Again
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium">No Roles Found</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {search ? 'No roles match your search criteria.' : 'No roles available. Create your first role to get started.'}
          </p>
          {!search && (
            <Button onClick={() => setIsCreateOpen(true)} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create First Role
            </Button>
          )}
        </div>
      ) : (
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
                {NAV_GROUPS_MENUS.flatMap(group => group.listMenus).filter(item => role.permissions[item.key] !== "hidden").map((item) => {
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
            
            <div className="flex gap-1 flex-wrap">
              <Button size="sm" variant="ghost" className="flex-1" onClick={() => handleEditRole(role)}>
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleViewRoleDetails(role.id)}>
                <Eye className="h-3 w-3 mr-1" />
                View
              </Button>
              {role.name !== "Super Admin" && (
                <>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => handleResetPermissions(role.id, role.name)}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="text-destructive"
                    onClick={() => handleDeleteRole(role.id, role.name)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
            </motion.div>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Role tidak ditemukan</p>
        </div>
      )}
    </AppLayout>
  );
}
