import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Edit, Trash2, MapPin, Building, Phone, Mail, ChevronLeft, ChevronRight, Loader2, ExternalLink } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { locationService } from "@/lib/services/locationService";
import { type Location, type CreateLocationRequest, type UpdateLocationRequest } from "@/lib/api";
import MapPicker from '@/components/ui/MapPicker';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function MasterLocations() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "warehouse" | "store">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [deletingLocation, setDeletingLocation] = useState<Location | null>(null);
  const [newLocationCode, setNewLocationCode] = useState("");
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationType, setNewLocationType] = useState<"warehouse" | "store">("warehouse");
  const [newLongitude, setNewLongitude] = useState("");
  const [newLatitude, setNewLatitude] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Map state
  const [mapCenter, setMapCenter] = useState<[number, number]>([-6.2088, 106.8456]); // Default: Jakarta
  const [selectedPosition, setSelectedPosition] = useState<[number, number] | null>(null);

  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Responsive detection
  const [isDesktop, setIsDesktop] = useState(false);

  const queryClient = useQueryClient();

  // Debug state changes
  useEffect(() => {
    console.log('isCreateOpen changed:', isCreateOpen);
  }, [isCreateOpen]);

  useEffect(() => {
    const checkDevice = () => {
      setIsDesktop(window.innerWidth >= 1024); // lg breakpoint
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // Debounce search value
  const debouncedSearch = useDebounce(search, 500);

  // Query for locations with debounced search
  const { data: locationsData, isLoading, refetch } = useQuery({
    queryKey: ['locations', currentPage, itemsPerPage, debouncedSearch, filter],
    queryFn: () => locationService.getLocations(
      currentPage,
      itemsPerPage,
      debouncedSearch,
      '', // location_code filter - empty for now
      filter === "all" ? "" : filter
    ),
  });

  // Create location mutation
  const createMutation = useMutation({
    mutationFn: (location: CreateLocationRequest) => locationService.createLocation(location),
    onSuccess: () => {
      toast.success("Location created successfully");
      setIsCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create location");
    },
  });

  // Update location mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, location }: { id: string; location: UpdateLocationRequest }) => 
      locationService.updateLocation(id, location),
    onSuccess: () => {
      toast.success("Location updated successfully");
      setIsCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update location");
    },
  });

  // Delete location mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => locationService.deleteLocation(id),
    onSuccess: () => {
      toast.success("Location deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete location");
    },
  });

  const resetForm = () => {
    setEditingLocation(null);
    setNewLocationCode("");
    setNewLocationName("");
    setNewLocationType("warehouse");
    setNewLongitude("");
    setNewLatitude("");
    setSelectedPosition(null);
    setMapCenter([-6.2088, 106.8456]); // Reset to Jakarta
  };

  const handleEditLocation = (location: Location) => {
    setEditingLocation(location);
    setNewLocationCode(location.location_code);
    setNewLocationName(location.location_name);
    setNewLocationType(location.type);
    setNewLongitude(location.longitude?.toString() || "");
    setNewLatitude(location.latitude?.toString() || "");
    
    // Set map position if coordinates exist
    if (location.latitude && location.longitude) {
      setSelectedPosition([location.latitude, location.longitude]);
      setMapCenter([location.latitude, location.longitude]);
    } else {
      setSelectedPosition(null);
      setMapCenter([-6.2088, 106.8456]); // Default to Jakarta
    }
    
    setIsCreateOpen(true);
  };

  const handleSaveLocation = async () => {
    if (!newLocationCode.trim() || !newLocationName.trim()) {
      toast.error("Location code and name are required");
      return;
    }

    // Validate location type
    if (!newLocationType || (newLocationType !== "warehouse" && newLocationType !== "store")) {
      toast.error("Location type must be 'warehouse' or 'store'");
      return;
    }

    // Check if coordinates are selected (optional for now, but recommended)
    if (!selectedPosition) {
      console.log("No coordinates selected, proceeding without location data");
    }

    setIsCreating(true);

    try {
      // Parse coordinates properly - send null instead of undefined for backend
      const parsedLongitude = newLongitude ? parseFloat(newLongitude) : null;
      const parsedLatitude = newLatitude ? parseFloat(newLatitude) : null;

      // Validate coordinate values
      if (!isNaN(parsedLongitude!) && (parsedLongitude! < -180 || parsedLongitude! > 180)) {
        toast.error("Longitude must be between -180 and 180");
        return;
      }
      if (!isNaN(parsedLatitude!) && (parsedLatitude! < -90 || parsedLatitude! > 90)) {
        toast.error("Latitude must be between -90 and 90");
        return;
      }

      const locationData = {
        location_code: newLocationCode.trim(),
        location_name: newLocationName.trim(),
        type: newLocationType,
        longitude: parsedLongitude,
        latitude: parsedLatitude,
      };

      console.log('locationData', JSON.stringify(locationData, null, 2));
      

      console.log('Saving location with data:', locationData);

      if (editingLocation) {
        await updateMutation.mutateAsync({
          id: editingLocation.id,
          location: locationData,
        });
      } else {
        await createMutation.mutateAsync(locationData);
      }
    } catch (error: any) {
      console.error('Error saving location:', error);
      toast.error(error.message || 'Failed to save location');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (!deletingLocation) return;

    try {
      await deleteMutation.mutateAsync(deletingLocation.id);
      setIsDeleteOpen(false);
      setDeletingLocation(null);
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const openDeleteDialog = (location: Location) => {
    setDeletingLocation(location);
    setIsDeleteOpen(true);
  };

  const handleOpenInGoogleMaps = (location: Location) => {
    if (location.latitude && location.longitude) {
      const url = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
      window.open(url, '_blank');
    } else {
      toast.error('Location coordinates are not available');
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const handleDialogClose = () => {
    setIsCreateOpen(false);
    resetForm();
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
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
    console.log('Dialog onOpenChange called with:', open);
    if (open) {
      setIsCreateOpen(true);
    } else {
      handleDialogClose();
    }
  }}>
            <DialogTrigger asChild>
              <Button className="btn-tap w-full sm:w-auto" onClick={() => {
                console.log('Tambah Lokasi button clicked!');
              }}>
                <Plus className="h-4 w-4 mr-1" /> Tambah Lokasi
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card">
              <DialogHeader>
                <DialogTitle>{editingLocation ? "Edit Lokasi" : "Tambah Lokasi Baru"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input 
                  placeholder="Kode Lokasi" 
                  value={newLocationCode}
                  onChange={(e) => setNewLocationCode(e.target.value)}
                  disabled={!!editingLocation}
                />
                <Input 
                  placeholder="Nama Lokasi" 
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                />
                <Select value={newLocationType} onValueChange={(value: "warehouse" | "store") => setNewLocationType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Tipe Lokasi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                    <SelectItem value="store">Store</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Map Section */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Lokasi di Peta</label>
                  <MapPicker
                    initialPosition={mapCenter}
                    selectedPosition={selectedPosition || undefined}
                    height="256px"
                    onChange={(lat, lng) => {
                      setSelectedPosition([lat, lng]);
                      setNewLatitude(lat.toString());
                      setNewLongitude(lng.toString());
                      console.log('Map clicked at:', lat, lng);
                    }}
                    showControls={true}
                    className="rounded-lg"
                  />
                </div>
                
                {/* Hidden coordinate inputs for system use */}
                <Input 
                  placeholder="Longitude" 
                  type="hidden"
                  value={newLongitude}
                  readOnly
                />
                <Input 
                  placeholder="Latitude" 
                  type="hidden"
                  value={newLatitude}
                  readOnly
                />
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1" onClick={handleSaveLocation} disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {editingLocation ? "Updating..." : "Creating..."}
                      </>
                    ) : (
                      <>
                        {editingLocation ? "Update" : "Simpan"}
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
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(["all", "warehouse", "store"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="btn-tap capitalize text-xs px-2.5 whitespace-nowrap"
            >
              {f === "warehouse" && <Building className="h-3 w-3 mr-1" />}
              {f === "store" && <MapPin className="h-3 w-3 mr-1" />}
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
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Longitude</TableHead>
                  <TableHead>Latitude</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  // Loading skeleton
                  Array.from({ length: itemsPerPage }).map((_, index) => (
                    <tr key={index}>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                    </tr>
                  ))
                ) : !locationsData?.locations || locationsData.locations.length === 0 ? (
                  <tr>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center py-8">
                        <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground">Lokasi tidak ditemukan</p>
                        {debouncedSearch && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Tidak ada lokasi yang cocok dengan pencarian "{debouncedSearch}"
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </tr>
                ) : locationsData.locations.map((location, index) => (
                  <motion.tr
                    key={location.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <TableCell className="font-medium">{location.location_name}</TableCell>
                    <TableCell>{location.location_code}</TableCell>
                    <TableCell>
                      <Badge variant={location.type === "warehouse" ? "default" : "secondary"}>
                        {location.type === "warehouse" && <Building className="h-3 w-3 mr-1" />}
                        {location.type === "store" && <MapPin className="h-3 w-3 mr-1" />}
                        {location.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{location.longitude || "-"}</TableCell>
                    <TableCell>{location.latitude || "-"}</TableCell>
                    <TableCell>{new Date(location.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {location.latitude && location.longitude && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleOpenInGoogleMaps(location)}
                            title="Open in Google Maps"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleEditLocation(location)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => openDeleteDialog(location)}>
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
                  {locationsData?.locations ? `Showing ${locationsData.locations.length} locations` : 'Loading...'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || isLoading}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, Math.ceil((locationsData?.meta?.total || 0) / itemsPerPage)) }, (_, i) => {
                    const totalPages = Math.ceil((locationsData?.meta?.total || 0) / itemsPerPage);
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
                  disabled={currentPage >= Math.ceil((locationsData?.meta?.total || 0) / itemsPerPage) || isLoading}
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
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: itemsPerPage }).map((_, i) => (
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
              ))
            ) : !locationsData?.locations || locationsData.locations.length === 0 ? (
              <div className="text-center py-12 col-span-full">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Lokasi tidak ditemukan</p>
                {debouncedSearch && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Tidak ada lokasi yang cocok dengan pencarian "{debouncedSearch}"
                  </p>
                )}
              </div>
            ) : (
              locationsData.locations.map((location, i) => (
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
                    <Badge variant={location.type === "warehouse" ? "default" : "secondary"}>
                      {location.type}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div>
                      <h3 className="font-medium text-sm">{location.location_name}</h3>
                      <p className="text-xs text-muted-foreground">{location.location_code}</p>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {location.longitude && location.latitude 
                          ? `${location.longitude}, ${location.latitude}`
                          : "No coordinates"
                        }
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Created: {new Date(location.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="flex-1" onClick={() => handleEditLocation(location)}>
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteLocation(location)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Mobile Pagination */}
          {Math.ceil((locationsData?.meta?.total || 0) / itemsPerPage) > 1 && (
            <div className="flex flex-col items-center gap-4 mt-6">
              <span className="text-sm text-muted-foreground">
                {locationsData?.locations ? `Showing ${locationsData.locations.length} locations` : 'Loading...'}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || isLoading}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, Math.ceil((locationsData?.meta?.total || 0) / itemsPerPage)) }, (_, i) => {
                    const totalPages = Math.ceil((locationsData?.meta?.total || 0) / itemsPerPage);
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
                  disabled={currentPage >= Math.ceil((locationsData?.meta?.total || 0) / itemsPerPage) || isLoading}
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

    {/* Delete Confirmation Dialog */}
    <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
      <DialogContent className="glass-card max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Location</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-center">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-6 w-6 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Are you sure?</h3>
            <p className="text-muted-foreground">
              This will permanently delete the location "{deletingLocation?.location_name}". This action cannot be undone.
            </p>
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button
              variant="destructive"
              onClick={handleDeleteLocation}
              disabled={deleteMutation.isPending}
              className="flex-1"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={16} className="mr-2" />
                  Delete Location
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteOpen(false);
                setDeletingLocation(null);
              }}
              disabled={deleteMutation.isPending}
              className="flex-1"
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
