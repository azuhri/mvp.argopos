import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import type { Location, LocationListResponse } from "@/lib/api";
import { createLocationStatusPayload, isLocationActive, locationService } from "@/lib/services/locationService";

export function LocationStatusToggle({ location }: { location: Location }) {
  const { canWrite, loading } = useAuth();
  const client = useQueryClient();
  const canEdit = !loading && canWrite("master_locations");
  const active = isLocationActive(location);
  const save = useMutation({
    mutationFn: (enabled: boolean) => {
      if (!canEdit) throw new Error("Izin Write pada Location Management diperlukan.");
      return locationService.updateLocation(location.id, createLocationStatusPayload(enabled ? "active" : "inactive"));
    },
    onSuccess: (updated) => {
      client.setQueriesData<LocationListResponse>({ queryKey: ["locations"] }, previous => previous && ({
        ...previous,
        locations: previous.locations.map(item => item.id === updated.id ? { ...item, ...updated } : item),
      }));
      void client.invalidateQueries({ queryKey: ["locations"] });
      void client.invalidateQueries({ queryKey: ["stores"] });
      void client.invalidateQueries({ queryKey: ["store", location.location_code] });
      toast.success(isLocationActive(updated) ? "Lokasi diaktifkan" : "Lokasi dinonaktifkan dan disembunyikan dari commerce");
    },
    onError: () => toast.error("Gagal menyimpan status lokasi. Coba lagi."),
  });
  return <div className="flex items-center gap-2 whitespace-nowrap"
    title={canEdit ? "Tampilkan lokasi di commerce" : "Memerlukan akses Write pada Location Management"}>
    <Switch aria-label={`Status lokasi ${location.location_name}`} checked={active}
      disabled={!canEdit || save.isPending} onCheckedChange={enabled => save.mutate(enabled)} />
    <span className="text-xs" aria-live="polite">{save.isPending ? "Menyimpan…" : active ? "Aktif" : "Nonaktif"}</span>
  </div>;
}
