import { useEffect, useState } from "react";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { stockService } from "@/lib/services/stockService";
import { toast } from "sonner";

interface Props {
  stockId: string;
  productName: string;
  status: boolean;
  locationCode: string;
  assignedUserIds: string[];
  onSaved: (status: boolean) => void;
}

export function StockCatalogAccessInfo({ assignedUserIds, onRefresh }: {
  assignedUserIds: string[];
  onRefresh: () => Promise<void>;
}) {
  const { user, canWrite, loading, refreshPermissions, permissionsRefreshing } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { void refreshPermissions(); }, [refreshPermissions]);
  const reason = loading
    ? "Sedang memeriksa akses akun…"
    : !canWrite("master_stores")
      ? "Status produk hanya dapat diubah dengan akses Write pada Store Management."
      : user && (user.role === "super_admin" || assignedUserIds.includes(user.id))
        ? null
        : "Akun Anda belum ditugaskan ke toko ini. Penugasan toko diperlukan untuk mengubah status produk.";
  if (!reason) return null;
  const refresh = async () => {
    setRefreshing(true);
    try { await refreshPermissions(); await onRefresh(); }
    finally { setRefreshing(false); }
  };
  return <div role="status" className="mb-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
    <p>{reason}</p>
    {!loading && <Button variant="outline" size="sm" className="mt-2"
      disabled={refreshing || permissionsRefreshing} onClick={() => void refresh()}>
      {refreshing || permissionsRefreshing ? "Memeriksa akses…" : "Periksa ulang akses"}
    </Button>}
  </div>;
}

export function StockCatalogStatus({ stockId, productName, status, locationCode, assignedUserIds, onSaved }: Props) {
  const { user, canWrite, loading } = useAuth();
  const client = useQueryClient();
  const mutationKey = ["stock-catalog-status", stockId];
  const saving = useIsMutating({ mutationKey }) > 0;
  const canEdit = !loading && canWrite("master_stores") && Boolean(user && (
    user.role === "super_admin" || assignedUserIds.includes(user.id)
  ));
  const save = useMutation({
    mutationKey,
    mutationFn: (next: boolean) => {
      if (!canEdit) throw new Error("Izin Write pada Store Management dan penugasan toko diperlukan.");
      return stockService.setStockStatus(stockId, next);
    },
    onSuccess: (data) => {
      onSaved(data.status);
      void client.invalidateQueries({ queryKey: ["store", locationCode] });
      toast.success(data.status ? "Produk ditampilkan di commerce" : "Produk disembunyikan dari commerce");
    },
    onError: () => toast.error("Gagal menyimpan status produk. Coba lagi."),
  });

  return (
    <div className="flex items-center gap-2" title={canEdit ? "Tampilkan produk di commerce" : "Memerlukan izin Store Management Write dan penugasan toko"}>
      <Switch
        aria-label={`Status katalog ${productName}`}
        checked={status}
        disabled={!canEdit || saving}
        onCheckedChange={(next) => save.mutate(next)}
      />
      <span className="text-xs whitespace-nowrap" aria-live="polite">{saving ? "Menyimpan…" : status ? "Aktif" : "Nonaktif"}</span>
    </div>
  );
}
