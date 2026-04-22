import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Edit, Trash2, Users, Mail, Shield, Calendar, ChevronLeft, ChevronRight, X, Save, Eye, EyeOff } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { LoadingSpinner, PageSkeleton } from "@/components/shared/SkeletonLoader";
import { userService, UserListResponse, CreateUserRequest, UpdateUserRequest, User, Role } from "@/lib/services/userService";
import { locationService } from "@/lib/services/locationService";
import { Location } from "@/lib/api";

interface UserFormData {
  username: string;
  email: string;
  password: string;
  role_id: string;
  assigned_stores: string[];
  showPassword: boolean;
}

interface UserFormErrors {
  username?: string;
  email?: string;
  password?: string;
  role_id?: string;
}

export default function UsersManagement() {
  const { user: currentUser } = useAuth();
  
  // Data state
  const [users, setUsers] = useState<UserListResponse | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [stores, setStores] = useState<Location[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // Responsive detection
  const [isDesktop, setIsDesktop] = useState(false);
  
  // Dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<UserFormData>({
    username: "",
    email: "",
    password: "",
    role_id: "",
    assigned_stores: [],
    showPassword: false,
  });
  const [formErrors, setFormErrors] = useState<UserFormErrors>({});

  // Load initial data
  useEffect(() => {
    loadUsers();
    loadRoles();
    loadStores();
  }, [currentPage, pageSize, search]);

  const loadStores = async () => {
    try {
      const response = await locationService.getLocations(1, 1000, '', '', 'store');
      setStores(response.locations || []);
    } catch (error) {
      toast.error("Failed to load stores");
      console.error(error);
    }
  };

  useEffect(() => {
    const checkDevice = () => {
      setIsDesktop(window.innerWidth >= 1024); // lg breakpoint
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const response = await userService.getUsers(currentPage, pageSize, search);
      setUsers(response);
    } catch (error) {
      toast.error("Failed to load users");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await userService.getRoles();
      setRoles(response);
    } catch (error) {
      toast.error("Failed to load roles");
      console.error(error);
    }
  };

  // Form validation
  const validateForm = (isEdit = false): boolean => {
    const errors: UserFormErrors = {};

    if (!formData.username.trim()) {
      errors.username = "Username is required";
    } else if (formData.username.length < 3) {
      errors.username = "Username must be at least 3 characters";
    }

    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Invalid email format";
    }

    if (!isEdit && !formData.password.trim()) {
      errors.password = "Password is required";
    } else if (!isEdit && formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    } else if (isEdit && formData.password.trim() && formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    if (!formData.role_id) {
      errors.role_id = "Role is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      username: "",
      email: "",
      password: "",
      role_id: "",
      assigned_stores: [],
      showPassword: false,
    });
    setFormErrors({});
  };

  // Handle create user
  const handleCreateUser = async () => {
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      const userData: CreateUserRequest = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role_id: formData.role_id,
        assigned_stores: formData.assigned_stores,
      };

      await userService.createUser(userData);
      toast.success("User created successfully");
      setIsCreateOpen(false);
      resetForm();
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to create user");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle update user
  const handleUpdateUser = async () => {
    if (!selectedUser || !validateForm(true)) return;

    try {
      setIsSubmitting(true);
      const userData: UpdateUserRequest = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        role_id: formData.role_id,
        assigned_stores: formData.assigned_stores,
      };

      // Include password only if it's provided (not empty)
      if (formData.password.trim()) {
        userData.password = formData.password.trim();
      }

      await userService.updateUser(selectedUser.id, userData);
      toast.success("User updated successfully");
      setIsEditOpen(false);
      setSelectedUser(null);
      resetForm();
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete user
  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      setIsSubmitting(true);
      await userService.deleteUser(selectedUser.id);
      toast.success("User deleted successfully");
      setIsDeleteOpen(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete user");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open edit dialog
  const openEditDialog = (user: User) => {
    setSelectedUser(user);

    // Use assigned_stores from user data
    const assignedStores = user.assigned_stores?.map(store => store.id) || [];

    setFormData({
      username: user.username,
      email: user.email,
      password: "",
      role_id: user.role_id,
      assigned_stores: assignedStores,
      showPassword: false,
    });
    setFormErrors({});
    setIsEditOpen(true);
  };

  // Open delete dialog
  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setIsDeleteOpen(true);
  };

  // Handle search
  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: string) => {
    setPageSize(Number(size));
    setCurrentPage(1);
  };

  // Get role name by ID or from user object
  const getRoleName = (roleId: string, userRole?: { role_name: string }) => {
    // If userRole is provided (from preloaded role data), use it
    if (userRole?.role_name) {
      return userRole.role_name;
    }
    // Fallback to roles array (for forms)
    const role = roles.find(r => r.id === roleId);
    return role?.role_name || "Unknown";
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading && !users) {
    return <PageSkeleton />;
  }

  return (
    <AppLayout title="User Management">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10" />
            <Input
              placeholder="Search users by username or email..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 bg-card/70 backdrop-blur border-border/50"
              autoComplete="off"
            />
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="btn-tap">
                <Plus size={16} className="mr-2" /> Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card max-w-md">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Username</label>
                  <Input
                    placeholder="Enter username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className={formErrors.username ? "border-red-500" : ""}
                  />
                  {formErrors.username && (
                    <p className="text-xs text-red-500 mt-1">{formErrors.username}</p>
                  )}
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Email</label>
                  <Input
                    type="email"
                    placeholder="Enter email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={formErrors.email ? "border-red-500" : ""}
                  />
                  {formErrors.email && (
                    <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>
                  )}
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Password</label>
                  <div className="relative">
                    <Input
                      type={formData.showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={formErrors.password ? "border-red-500 pr-10" : "pr-10"}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setFormData({ ...formData, showPassword: !formData.showPassword })}
                    >
                      {formData.showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </div>
                  {formErrors.password && (
                    <p className="text-xs text-red-500 mt-1">{formErrors.password}</p>
                  )}
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Role</label>
                  <Select value={formData.role_id} onValueChange={(value) => setFormData({ ...formData, role_id: value })}>
                    <SelectTrigger className={formErrors.role_id ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.role_name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.role_id && (
                    <p className="text-xs text-red-500 mt-1">{formErrors.role_id}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Assigned Stores</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                    {stores.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Loading stores...</p>
                    ) : (
                      <>
                        <label className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-1 rounded border-b pb-2 mb-2">
                          <input
                            type="checkbox"
                            checked={formData.assigned_stores.length === stores.length && stores.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, assigned_stores: stores.map(store => store.id) });
                              } else {
                                setFormData({ ...formData, assigned_stores: [] });
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm font-medium">All</span>
                        </label>
                        {stores.map((store) => (
                          <label key={store.id} className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={formData.assigned_stores.includes(store.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({ ...formData, assigned_stores: [...formData.assigned_stores, store.id] });
                                } else {
                                  setFormData({ ...formData, assigned_stores: formData.assigned_stores.filter(id => id !== store.id) });
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm">{store.location_name}</span>
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleCreateUser}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save size={16} className="mr-2" />
                        Create User
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreateOpen(false);
                      resetForm();
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Stats */}
        {users && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Total: {users.meta.total} users</span>
            <span>Page {users.meta.page} of {Math.ceil(users.meta.total / users.meta.page_size)}</span>
          </div>
        )}
      </div>

      {/* Responsive Users Display */}
      {isLoading ? (
        // Loading: Skeleton View
        isDesktop ? (
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: pageSize }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="h-4 bg-muted rounded w-24 animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded w-32 animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded w-20 animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded w-28 animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded w-28 animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded w-20 animate-pulse ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: pageSize }).map((_, i) => (
              <div key={i} className="glass-card p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted/50 rounded-full animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="w-24 h-4 bg-muted/50 rounded animate-pulse" />
                    <div className="w-32 h-3 bg-muted/50 rounded animate-pulse" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="w-full h-3 bg-muted/50 rounded animate-pulse" />
                  <div className="w-20 h-3 bg-muted/50 rounded animate-pulse" />
                </div>
                <div className="flex gap-2">
                  <div className="w-16 h-6 bg-muted/50 rounded animate-pulse" />
                  <div className="w-16 h-6 bg-muted/50 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )
      ) : isDesktop ? (
        // Desktop: DataTable View
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.data.length ? (
                  users.data.map((user, index) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{user.username}</div>
                            <div className="text-xs text-muted-foreground">ID: {user.id.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          <Shield className="h-3 w-3 mr-1" />
                          {getRoleName(user.role_id, user.role).replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {formatDate(user.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {formatDate(user.updated_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {currentUser?.role === 'super_admin' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => openDeleteDialog(user)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-12 w-12 text-muted-foreground" />
                        <p className="text-muted-foreground">No users found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      ) : (
        // Mobile/Tablet: Grid View
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users?.data.map((user, i) => (
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
                  <Badge variant="outline" className="capitalize">
                    <Shield className="h-3 w-3 mr-1" />
                    {getRoleName(user.role_id, user.role).replace('_', ' ')}
                  </Badge>
                </div>

                <div className="space-y-2 mb-3">
                  <h3 className="font-medium text-sm">{user.username}</h3>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {user.email}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(user.created_at)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => openEditDialog(user)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    {currentUser?.role === 'super_admin' && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-destructive"
                        onClick={() => openDeleteDialog(user)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Mobile Pagination */}
          {users && users.meta.total > 0 && (
            <div className="flex flex-col items-center gap-4 mt-6">
              <span className="text-sm text-muted-foreground">
                Showing {((users.meta.page - 1) * users.meta.page_size) + 1} to {Math.min(users.meta.page * users.meta.page_size, users.meta.total)} of {users.meta.total} users
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(users.meta.page - 1)}
                  disabled={users.meta.page === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, Math.ceil(users.meta.total / users.meta.page_size)) }, (_, i) => {
                    const totalPages = Math.ceil(users.meta.total / users.meta.page_size);
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (users.meta.page <= 3) {
                      pageNum = i + 1;
                    } else if (users.meta.page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = users.meta.page - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={users.meta.page === pageNum ? "default" : "outline"}
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
                  onClick={() => handlePageChange(users.meta.page + 1)}
                  disabled={users.meta.page === Math.ceil(users.meta.total / users.meta.page_size)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="20">20 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      )}

      {users && users.data.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No users found</p>
        </div>
      )}

      {/* Desktop Pagination */}
      {isDesktop && users && users.meta.total > 0 && (
        <GlassCard className="overflow-hidden">
          <div className="border-t border-border/50 p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Items per page:</span>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  Showing {((users.meta.page - 1) * users.meta.page_size) + 1} to {Math.min(users.meta.page * users.meta.page_size, users.meta.total)} of {users.meta.total} users
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(users.meta.page - 1)}
                  disabled={users.meta.page === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, Math.ceil(users.meta.total / users.meta.page_size)) }, (_, i) => {
                    const totalPages = Math.ceil(users.meta.total / users.meta.page_size);
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (users.meta.page <= 3) {
                      pageNum = i + 1;
                    } else if (users.meta.page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = users.meta.page - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={users.meta.page === pageNum ? "default" : "outline"}
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
                  onClick={() => handlePageChange(users.meta.page + 1)}
                  disabled={users.meta.page === Math.ceil(users.meta.total / users.meta.page_size)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="glass-card max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Username</label>
              <Input
                placeholder="Enter username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className={formErrors.username ? "border-red-500" : ""}
              />
              {formErrors.username && (
                <p className="text-xs text-red-500 mt-1">{formErrors.username}</p>
              )}
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Email</label>
              <Input
                type="email"
                placeholder="Enter email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={formErrors.email ? "border-red-500" : ""}
              />
              {formErrors.email && (
                <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>
              )}
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">New Password (optional)</label>
              <div className="relative">
                <Input
                  type={formData.showPassword ? "text" : "password"}
                  placeholder="Leave blank to keep current password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setFormData({ ...formData, showPassword: !formData.showPassword })}
                >
                  {formData.showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Role</label>
              <Select value={formData.role_id} onValueChange={(value) => setFormData({ ...formData, role_id: value })}>
                <SelectTrigger className={formErrors.role_id ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.role_name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.role_id && (
                <p className="text-xs text-red-500 mt-1">{formErrors.role_id}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Assigned Stores</label>
              <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                {stores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Loading stores...</p>
                ) : (
                  <>
                    <label className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-1 rounded border-b pb-2 mb-2">
                      <input
                        type="checkbox"
                        checked={formData.assigned_stores.length === stores.length && stores.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, assigned_stores: stores.map(store => store.id) });
                          } else {
                            setFormData({ ...formData, assigned_stores: [] });
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium">All</span>
                    </label>
                    {stores.map((store) => (
                      <label key={store.id} className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={formData.assigned_stores.includes(store.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, assigned_stores: [...formData.assigned_stores, store.id] });
                            } else {
                              setFormData({ ...formData, assigned_stores: formData.assigned_stores.filter(id => id !== store.id) });
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{store.location_name}</span>
                      </label>
                    ))}
                  </>
                )}
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleUpdateUser}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save size={16} className="mr-2" />
                    Update User
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false);
                  setSelectedUser(null);
                  resetForm();
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="glass-card max-w-md">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Are you sure?</h3>
              <p className="text-muted-foreground">
                This will permanently delete the user "{selectedUser?.username}". This action cannot be undone.
              </p>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button
                variant="destructive"
                onClick={handleDeleteUser}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} className="mr-2" />
                    Delete User
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteOpen(false);
                  setSelectedUser(null);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
