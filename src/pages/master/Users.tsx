import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Edit, Trash2, Users, UserCheck, UserX, Mail, Phone, Upload, FileSpreadsheet, Download, X, CheckCircle, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockCustomers } from "@/lib/mockData";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface UploadedUser {
  name: string;
  email: string;
  phone: string;
  type: "internal" | "external";
  employee_id?: string;
  status: "active" | "inactive";
  errors?: string[];
}

export default function MasterUsers() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "internal" | "external">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedUsers, setUploadedUsers] = useState<UploadedUser[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "confirm">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<keyof typeof mockCustomers[0]>("name");
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

  const filtered = mockCustomers.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search);
    const matchesFilter = filter === "all" || c.type === filter;
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

  const handleSort = (field: keyof typeof mockCustomers[0]) => {
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a CSV or Excel file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size should be less than 10MB");
      return;
    }

    setUploadedFile(file);
    processFile(file);
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    
    try {
      // For demo purposes, we'll simulate CSV parsing
      // In a real app, you'd use libraries like papaparse for CSV or xlsx for Excel
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate parsed data
      const mockParsedUsers: UploadedUser[] = [
        {
          name: "John Doe",
          email: "john@example.com",
          phone: "08123456789",
          type: "internal",
          employee_id: "EMP001",
          status: "active"
        },
        {
          name: "Jane Smith",
          email: "jane@example.com",
          phone: "08123456790",
          type: "external",
          status: "active"
        },
        {
          name: "Bob Johnson",
          email: "invalid-email", // This will have an error
          phone: "08123456791",
          type: "internal",
          employee_id: "EMP002",
          status: "active",
          errors: ["Invalid email format"]
        }
      ];
      
      setUploadedUsers(mockParsedUsers);
      setImportStep("preview");
      toast.success("File processed successfully!");
    } catch (error) {
      toast.error("Failed to process file. Please check the format.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    setIsProcessing(true);
    
    try {
      // Simulate API call to import users
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const validUsers = uploadedUsers.filter(user => !user.errors || user.errors.length === 0);
      toast.success(`Successfully imported ${validUsers.length} users!`);
      
      // Reset upload state
      setUploadedFile(null);
      setUploadedUsers([]);
      setImportStep("upload");
      setIsUploadOpen(false);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      toast.error("Failed to import users. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    // Create CSV template
    const headers = ["name", "email", "phone", "type", "employee_id", "status"];
    const sampleData = [
      ["John Doe", "john@example.com", "08123456789", "internal", "EMP001", "active"],
      ["Jane Smith", "jane@example.com", "08123456790", "external", "", "active"]
    ];
    
    const csvContent = [headers, ...sampleData]
      .map(row => row.map(field => `"${field}"`).join(","))
      .join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "user_import_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success("Template downloaded!");
  };

  return (
    <AppLayout title="Master User">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative w-full">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10" />
            <Input
              placeholder="Cari user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card/70 backdrop-blur border-border/50"
            />
          </div>
          <div className="flex gap-2">
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="btn-tap">
                  <Upload size={16} className="mr-1" /> Import CSV/Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Import Users from CSV/Excel</DialogTitle>
                </DialogHeader>
                
                {importStep === "upload" && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <FileSpreadsheet className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Upload User Data</h3>
                      <p className="text-muted-foreground mb-6">
                        Import multiple users at once by uploading a CSV or Excel file
                      </p>
                    </div>

                    <div className="border-2 border-dashed border-border/50 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                      <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground mb-4">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        CSV, XLS, XLSX up to 10MB
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xls,.xlsx"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessing}
                        className="btn-tap"
                      >
                        {isProcessing ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Choose File
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button variant="outline" onClick={downloadTemplate} className="btn-tap">
                        <Download className="h-4 w-4 mr-2" />
                        Download Template
                      </Button>
                      <Button variant="outline" onClick={() => setIsUploadOpen(false)} className="btn-tap">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {importStep === "preview" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">Preview Imported Data</h3>
                        <p className="text-muted-foreground">
                          Review the data before importing
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">
                          {uploadedUsers.length} users found
                        </Badge>
                        <Badge variant="default">
                          {uploadedUsers.filter(u => !u.errors?.length).length} valid
                        </Badge>
                        {uploadedUsers.filter(u => u.errors?.length).length > 0 && (
                          <Badge variant="destructive">
                            {uploadedUsers.filter(u => u.errors?.length).length} errors
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Employee ID</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Validation</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {uploadedUsers.map((user, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{user.name}</TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell>{user.phone}</TableCell>
                              <TableCell>
                                <Badge variant={user.type === "internal" ? "default" : "secondary"}>
                                  {user.type}
                                </Badge>
                              </TableCell>
                              <TableCell>{user.employee_id || "-"}</TableCell>
                              <TableCell>
                                <Badge variant={user.status === "active" ? "default" : "destructive"}>
                                  {user.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {user.errors && user.errors.length > 0 ? (
                                  <div className="flex items-center gap-1 text-destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <span className="text-xs">{user.errors.join(", ")}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-green-600">
                                    <CheckCircle className="h-4 w-4" />
                                    <span className="text-xs">Valid</span>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={handleImport}
                        disabled={isProcessing || uploadedUsers.every(u => u.errors?.length)}
                        className="btn-tap"
                      >
                        {isProcessing ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Import {uploadedUsers.filter(u => !u.errors?.length).length} Users
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setImportStep("upload");
                          setUploadedFile(null);
                          setUploadedUsers([]);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        className="btn-tap"
                      >
                        Upload Different File
                      </Button>
                      <Button variant="outline" onClick={() => setIsUploadOpen(false)} className="btn-tap">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="btn-tap w-full sm:w-auto">
                  <Plus size={16} className="mr-1" /> Tambah User
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
      </div>

      {/* Responsive Users Display */}
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
                    onClick={() => handleSort("type")}
                  >
                    <div className="flex items-center gap-1">
                      Type
                      {sortField === "type" && (
                        sortDirection === "asc" ? <ChevronLeft className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 rotate-180" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Employee ID</TableHead>
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
                {paginatedData.map((user, index) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {user.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {user.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.type === "internal" ? "default" : "secondary"}>
                        {user.type === "internal" && <UserCheck className="h-3 w-3 mr-1" />}
                        {user.type === "external" && <UserX className="h-3 w-3 mr-1" />}
                        {user.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.employee_id || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={user.status === "active" ? "default" : "destructive"}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost">
                          <Edit className="h-3 w-3" />
                        </Button>
                        {currentUser?.role === "super_admin" && (
                          <Button size="sm" variant="ghost" className="text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
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
                  Showing {startIndex + 1} to {Math.min(endIndex, sortedData.length)} of {sortedData.length} users
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
            {paginatedData.map((user, i) => (
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

          {/* Mobile Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col items-center gap-4 mt-6">
              <span className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, sortedData.length)} of {sortedData.length} users
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
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">User tidak ditemukan</p>
        </div>
      )}
    </AppLayout>
  );
}
