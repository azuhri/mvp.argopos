import { useEffect, useId, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, CreditCard, ExternalLink, Loader2, Save, Wallet } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getDokuPaymentMethodLabel } from "@/lib/dokuPaymentMethods";
import {
  getStorePaymentSettings, storePaymentSettingsQueryKey, updateStorePaymentSettings,
  type StorePaymentMode,
} from "@/lib/services/storePaymentSettingsService";

interface Props {
  locationId: string;
  assignedUserIds: string[];
  children: ReactNode;
}

const modes = [
  { value: "MANUAL", label: "Manual Payment", description: "QRIS, transfer bank, dan cutoff dengan konfirmasi admin seperti saat ini.", icon: Wallet },
  { value: "DOKU", label: "Payment gateway with DOKU", description: "Pelanggan membayar di halaman DOKU Checkout. Status pembayaran diperbarui otomatis.", icon: CreditCard },
] as const;

export function StorePaymentSettings({ locationId, assignedUserIds, children }: Props) {
  const { user, canWrite, loading: authLoading, refreshPermissions, permissionsRefreshing } = useAuth();
  const accessDescriptionId = useId();
  const client = useQueryClient();
  const [draftMode, setDraftMode] = useState<StorePaymentMode>();
  useEffect(() => {
    void refreshPermissions();
  }, [refreshPermissions]);
  const canEdit = !authLoading && canWrite("master_stores") && Boolean(user && (
    user.role === "super_admin" || assignedUserIds.includes(user.id)
  ));
  const readOnlyReason = authLoading
    ? "Sedang memeriksa akses akun Anda. Tunggu sebentar."
    : !user
      ? "Anda belum masuk. Masuk dengan akun yang memiliki izin mengubah pengaturan toko."
      : !canWrite("master_stores")
        ? "Akun Anda belum memiliki izin mengubah pengaturan toko. Hubungi administrator untuk meminta akses."
        : "Akun Anda belum ditugaskan ke toko ini. Hubungi administrator untuk meminta penugasan.";
  const settings = useQuery({
    queryKey: storePaymentSettingsQueryKey(locationId),
    queryFn: () => getStorePaymentSettings(locationId),
    staleTime: 0,
    retry: 1,
  });
  const save = useMutation({
    mutationFn: (mode: StorePaymentMode) => updateStorePaymentSettings(locationId, mode),
    onSuccess: (data) => {
      client.setQueryData(storePaymentSettingsQueryKey(locationId), data);
      void client.invalidateQueries({ queryKey: storePaymentSettingsQueryKey(locationId) });
      setDraftMode(undefined);
      toast.success("Mode pembayaran toko berhasil disimpan");
    },
  });

  if (settings.isPending) return <GlassCard><p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Memuat pengaturan pembayaran…</p></GlassCard>;
  if (!settings.data || settings.isError) return (
    <GlassCard>
      <p role="alert" className="mb-3 text-sm">Pengaturan pembayaran toko belum dapat dimuat.</p>
      <Button variant="outline" onClick={() => void settings.refetch()} disabled={settings.isFetching}>Coba lagi</Button>
    </GlassCard>
  );

  const selectedMode = draftMode ?? settings.data.payment_mode;
  const changed = selectedMode !== settings.data.payment_mode;
  const selectMode = (mode: StorePaymentMode) => { setDraftMode(mode); save.reset(); };

  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Pengaturan Pembayaran</h3>
              <p className="mt-1 text-sm text-muted-foreground">Pilih cara pembayaran untuk pesanan baru di toko ini.</p>
            </div>
            <Badge variant="secondary" className="w-fit shrink-0">Aktif: {settings.data.payment_mode === "DOKU" ? "DOKU" : "Manual Payment"}</Badge>
          </div>
          {!canEdit && <div id={accessDescriptionId} role="status" className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{authLoading ? "Memeriksa akses akun" : "Akses hanya lihat"}</p>
            <p className="mt-1 leading-relaxed">{readOnlyReason}</p>
            {user && !authLoading && <Button variant="outline" size="sm" className="mt-3" disabled={permissionsRefreshing} onClick={() => void refreshPermissions()}>
              {permissionsRefreshing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {permissionsRefreshing ? "Memeriksa akses…" : "Periksa ulang akses"}
            </Button>}
          </div>}
          <fieldset disabled={!canEdit || save.isPending} aria-describedby={!canEdit ? accessDescriptionId : undefined} className="grid min-w-0 gap-3 md:grid-cols-2">
            <legend className="sr-only">Mode pembayaran toko</legend>
            {modes.map(({ value, label, description, icon: Icon }) => (
              <label key={value} className={cn("relative flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2", selectedMode === value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40", !canEdit && "cursor-default")}>
                <input type="radio" name={`payment-mode-${locationId}`} value={value} checked={selectedMode === value} onChange={() => selectMode(value)} className="mt-1 h-4 w-4 shrink-0 accent-primary" />
                <div className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium"><Icon className="h-4 w-4 shrink-0" />{label}</span>
                  <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">{description}</span>
                </div>
              </label>
            ))}
          </fieldset>
          {selectedMode === "DOKU" && (
            <div className={cn("flex items-start gap-3 rounded-lg border p-4 text-sm", settings.data.doku_available ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950")}>
              {settings.data.doku_available ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <div>
                <p className="font-medium">{settings.data.doku_available ? "DOKU Checkout siap digunakan" : "DOKU Checkout belum tersedia"}</p>
                <p className="mt-1 leading-relaxed">{settings.data.doku_available ? "Pelanggan memilih metode pembayaran terlebih dahulu. Pesanan dibuat setelah pelanggan mengonfirmasi, lalu pembayaran dilanjutkan di DOKU Checkout." : "Mode dapat disimpan, tetapi pelanggan belum dapat membuat pesanan DOKU hingga layanan diaktifkan oleh administrator. Gunakan Manual Payment untuk tetap menerima pesanan."}</p>
                {settings.data.doku_methods.length > 0 && <div className="mt-3">
                  <p className="font-medium">Pilihan metode untuk pelanggan</p>
                  <ul className="mt-2 flex flex-wrap gap-2" aria-label="Metode pembayaran DOKU tersedia">
                    {settings.data.doku_methods.map((method) => <li key={method}><Badge variant="outline">{getDokuPaymentMethodLabel(method)}</Badge></li>)}
                  </ul>
                </div>}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-muted-foreground">Pesanan yang sudah dibuat tetap memakai metode awalnya. Pengaturan manual tetap tersimpan.</p>
            {canEdit ? (
              <div className="flex shrink-0 gap-2">
                {changed && <Button variant="outline" disabled={save.isPending} onClick={() => { setDraftMode(undefined); save.reset(); }}>Batal</Button>}
                <Button disabled={!changed || save.isPending || settings.isFetching} onClick={() => { if (canEdit && changed && !save.isPending) save.mutate(selectedMode); }}>
                  {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {save.isPending ? "Menyimpan…" : "Simpan mode pembayaran"}
                </Button>
              </div>
            ) : null}
          </div>
          {changed && <p className="text-sm text-muted-foreground" role="status">Perubahan mode belum disimpan.</p>}
          {save.isError && <p role="alert" className="text-sm text-destructive">Mode pembayaran belum tersimpan. Periksa akses dan koneksi Anda lalu coba lagi.</p>}
        </div>
      </GlassCard>
      {selectedMode === "MANUAL" ? <fieldset disabled={!canEdit} className="min-w-0">{children}</fieldset> : (
        <GlassCard>
          <h4 className="flex items-center gap-2 font-semibold"><ExternalLink className="h-4 w-4" />Pembayaran melalui DOKU Checkout</h4>
          <ol className="mt-4 grid gap-4 text-sm md:grid-cols-3">
            {["Pelanggan memilih metode lalu mengonfirmasi pesanan.", "Pelanggan membayar melalui halaman DOKU Checkout.", "Status pesanan diperbarui setelah pembayaran terverifikasi."].map((step, index) => <li key={step} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span><span className="leading-relaxed text-muted-foreground">{step}</span></li>)}
          </ol>
        </GlassCard>
      )}
    </div>
  );
}
