import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Ticket, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { voucherService } from "@/lib/services/voucherService";
import type { StoreVoucher, StoreVoucherInput, VoucherUsage } from "@/lib/voucherTypes";
import { formatCurrency } from "@/lib/mockData";
import { GlassCard } from "@/components/shared/GlassCard";
import { VoucherTransactionBadge } from "@/components/shared/VoucherTransactionBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const blank: StoreVoucherInput = { code: "", discount_type: "FIXED", discount_value: 20000, expires_at: null, is_active: true, requires_settlement: false };
const paidStatuses = ["PAID", "PREPARING_PRODUCT", "READY_TO_PICKUP", "COMPLETED"];
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const errorText = (error: unknown) => error instanceof Error ? error.message : "Permintaan belum berhasil. Coba lagi.";
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleString("id-ID") : "Tanpa batas waktu";
function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function StoreVoucherPanel({ locationId, assignedUserIds }: { locationId: string; assignedUserIds: string[] }) {
  const { user, canWrite, canRead, loading, refreshPermissions } = useAuth();
  const client = useQueryClient();
  const assigned = Boolean(user && (user.role === "super_admin" || assignedUserIds.includes(user.id)));
  const canView = !loading && assigned && canRead("master_stores");
  const canEdit = canView && canWrite("master_stores");
  const canSettle = canEdit && canWrite("transactions");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StoreVoucher>();
  const [form, setForm] = useState<StoreVoucherInput>(blank);
  const [randomCode, setRandomCode] = useState(false);
  const [expiry, setExpiry] = useState("");
  const [formError, setFormError] = useState("");
  const [voucherFilter, setVoucherFilter] = useState("");
  const [voucherFilterLabel, setVoucherFilterLabel] = useState("");
  const [voucherPage, setVoucherPage] = useState(1);
  const [settlementFilter, setSettlementFilter] = useState("");
  const [page, setPage] = useState(1);
  const [settlementTarget, setSettlementTarget] = useState<VoucherUsage>();
  useEffect(() => { void refreshPermissions(); }, [refreshPermissions]);
  const vouchers = useQuery({ queryKey: ["store-vouchers", locationId, voucherPage], queryFn: () => voucherService.list(locationId, voucherPage), enabled: canView });
  const usage = useQuery({ queryKey: ["voucher-usage", locationId, voucherFilter, settlementFilter, page], queryFn: () => voucherService.usage(locationId, { voucher_id: voucherFilter, settlement_status: settlementFilter, page, page_size: 10 }), enabled: canView });
  const save = useMutation({
    mutationFn: (input: StoreVoucherInput) => voucherService.save(locationId, input, editing?.id),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ["store-vouchers", locationId] }); setDialogOpen(false); toast.success("Voucher berhasil disimpan"); },
    onError: (error) => setFormError(errorText(error)),
  });
  const settle = useMutation({
    mutationFn: (item: VoucherUsage) => voucherService.settle(locationId, item.transaction_id ?? item.id ?? ""),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ["voucher-usage", locationId] }); void client.invalidateQueries({ queryKey: ["transactions"] }); setSettlementTarget(undefined); toast.success("Transaksi voucher ditandai SETTLED"); },
  });
  const openForm = (voucher?: StoreVoucher) => {
    setEditing(voucher); setForm(voucher ? { code: voucher.code, discount_type: voucher.discount_type, discount_value: voucher.discount_value, expires_at: voucher.expires_at, is_active: voucher.is_active, requires_settlement: voucher.requires_settlement } : { ...blank });
    setRandomCode(false); setExpiry(toLocalInput(voucher?.expires_at ?? null)); setFormError(""); setDialogOpen(true);
  };
  const submit = () => {
    if (!canEdit || save.isPending) return;
    const code = randomCode ? "" : form.code.trim().toUpperCase();
    if (!randomCode && !/^[A-Z0-9_-]{1,20}$/.test(code)) { setFormError("Kode wajib diisi, maksimal 20 karakter: huruf, angka, - atau _."); return; }
    if (!Number.isSafeInteger(form.discount_value) || form.discount_value < 1 || (form.discount_type === "PERCENTAGE" && form.discount_value > 100)) { setFormError("Isi nominal positif atau persentase bulat 1–100."); return; }
    const expiresAt = expiry ? new Date(expiry) : null;
    if (expiresAt && !Number.isFinite(expiresAt.getTime())) { setFormError("Tanggal kedaluwarsa tidak valid."); return; }
    setFormError(""); save.mutate({ ...form, code, expires_at: expiresAt?.toISOString() ?? null });
  };
  if (loading) return <GlassCard><p role="status">Memeriksa akses voucher…</p></GlassCard>;
  if (!canView) return <GlassCard><h3 className="font-semibold">Voucher Code</h3><p className="mt-2 text-sm text-muted-foreground">Akses voucher memerlukan izin Store Management dan penugasan ke toko ini.</p><Button variant="outline" className="mt-3" onClick={() => void refreshPermissions()}>Periksa ulang akses</Button></GlassCard>;
  return <div className="space-y-5">
    <GlassCard>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 text-lg font-semibold"><Ticket className="h-5 w-5" />Voucher Code</h3><p className="mt-1 text-sm text-muted-foreground">Kelola potongan harga dan pantau penggunaan voucher toko.</p></div>{canEdit && <Button onClick={() => openForm()}><Plus className="mr-2 h-4 w-4" />Tambah voucher</Button>}</div>
      {!canEdit && <p className="mb-4 text-sm text-muted-foreground">Akses hanya lihat</p>}
      {vouchers.isPending ? <p role="status">Memuat voucher…</p> : vouchers.isError ? <div role="alert"><p>{errorText(vouchers.error)}</p><Button variant="outline" onClick={() => void vouchers.refetch()}>Coba lagi</Button></div> : !vouchers.data?.items.length ? <p className="py-8 text-center text-muted-foreground">Belum ada voucher untuk toko ini.</p> : <div className="grid gap-3 lg:grid-cols-2">
        {vouchers.data.items.map((voucher) => <article key={voucher.id} className="min-w-0 rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3"><code className="break-all text-base font-bold">{voucher.code}</code><Badge variant={voucher.is_active ? "secondary" : "outline"}>{!voucher.is_active ? "Nonaktif" : voucher.expires_at && Date.parse(voucher.expires_at) <= Date.now() ? "Kedaluwarsa" : "Aktif"}</Badge></div>
          <p className="mt-3 text-lg font-semibold">{voucher.discount_type === "FIXED" ? formatCurrency(voucher.discount_value) : `${voucher.discount_value}%`}</p>
          <dl className="mt-3 space-y-2 text-sm"><div><dt className="text-muted-foreground">Berlaku sampai</dt><dd>{dateLabel(voucher.expires_at)}</dd></div><div><dt className="text-muted-foreground">Dibuat oleh</dt><dd className="break-all">{voucher.creator_name || voucher.created_by}</dd></div><div><dt className="text-muted-foreground">Settlement</dt><dd>{voucher.requires_settlement ? "Aktif — penggunaan perlu settlement" : "Nonaktif"}</dd></div></dl>
          <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { setVoucherFilter(voucher.id); setVoucherFilterLabel(voucher.code); setPage(1); }}>Lihat penggunaan</Button>{canEdit && <Button size="sm" variant="outline" aria-label={`Edit voucher ${voucher.code}`} onClick={() => openForm(voucher)}><Pencil className="mr-2 h-3 w-3" />Edit</Button>}</div>
        </article>)}
      </div>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span>{vouchers.data?.total ?? 0} voucher • Halaman {voucherPage}</span><div className="flex gap-2"><Button size="sm" variant="outline" aria-label="Voucher sebelumnya" disabled={voucherPage <= 1 || vouchers.isFetching} onClick={() => setVoucherPage(voucherPage - 1)}>Sebelumnya</Button><Button size="sm" variant="outline" aria-label="Voucher berikutnya" disabled={voucherPage * 20 >= (vouchers.data?.total ?? 0) || vouchers.isFetching} onClick={() => setVoucherPage(voucherPage + 1)}>Berikutnya</Button></div></div>
    </GlassCard>
    <GlassCard>
      <h3 className="text-lg font-semibold">Penggunaan voucher</h3><p className="mt-1 text-sm text-muted-foreground">Status settlement terpisah dari pembayaran dan penyerahan barang.</p>
      <div className="my-4 grid items-end gap-3 sm:grid-cols-2"><div><p className="text-sm font-medium">{voucherFilter ? `Voucher ${voucherFilterLabel}` : "Semua voucher"}</p>{voucherFilter ? <Button size="sm" variant="outline" className="mt-2" onClick={() => { setVoucherFilter(""); setVoucherFilterLabel(""); setPage(1); }}>Tampilkan semua voucher</Button> : <p className="mt-1 text-xs text-muted-foreground">Pilih “Lihat penggunaan” pada voucher untuk memfilter transaksi.</p>}</div><div><Label htmlFor="settlement-filter">Status settlement</Label><select id="settlement-filter" className={selectClass} value={settlementFilter} onChange={(e) => { setSettlementFilter(e.target.value); setPage(1); }}><option value="">Semua status</option><option value="UNSETTLED">UNSETTLED</option><option value="SETTLED">SETTLED</option></select></div></div>
      {usage.isPending ? <p role="status">Memuat penggunaan…</p> : usage.isError ? <div role="alert"><p>{errorText(usage.error)}</p><Button variant="outline" onClick={() => void usage.refetch()}>Coba lagi</Button></div> : !usage.data?.items.length ? <p className="py-6 text-center text-muted-foreground">Belum ada transaksi penggunaan voucher.</p> : <div className="space-y-3">{usage.data.items.map((item) => <article key={item.transaction_id ?? item.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-all font-mono text-sm font-semibold">{item.transaction_code}</p><p className="text-sm text-muted-foreground">{item.customer_name || "Customer"}</p><VoucherTransactionBadge transaction={item} /></div><div className="text-sm"><Badge variant="outline">{item.status}</Badge><p className="mt-2 font-semibold">Total {formatCurrency(item.total_amount)}</p></div></div>{item.voucher_settled_at && <p className="mt-3 break-all text-xs text-muted-foreground">Diselesaikan {dateLabel(item.voucher_settled_at)} oleh {item.settled_by_name || item.voucher_settled_by || "admin"}</p>}{item.voucher_settlement_required && item.voucher_settlement_status === "UNSETTLED" && <div className="mt-3">{canSettle && Boolean(item.paid_at) && paidStatuses.includes(item.status) ? <Button size="sm" onClick={() => { settle.reset(); setSettlementTarget(item); }}>Tandai SETTLED</Button> : <p className="text-xs text-muted-foreground">{!item.paid_at || !paidStatuses.includes(item.status) ? "Settlement tersedia setelah pembayaran diterima." : "Memerlukan izin Store Management Write dan Transactions Write untuk settlement."}</p>}</div>}</article>)}</div>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span>{usage.data?.total ?? 0} transaksi • Halaman {page}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1 || usage.isFetching} onClick={() => setPage(page - 1)}>Sebelumnya</Button><Button size="sm" variant="outline" disabled={page * 10 >= (usage.data?.total ?? 0) || usage.isFetching} onClick={() => setPage(page + 1)}>Berikutnya</Button></div></div>
    </GlassCard>
    <Dialog open={dialogOpen} onOpenChange={(open) => { if (!save.isPending) setDialogOpen(open); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Edit voucher" : "Tambah voucher"}</DialogTitle><DialogDescription>Diskon berlaku untuk transaksi baru di toko ini. Riwayat transaksi tetap memakai ketentuan saat checkout.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submit(); }}><fieldset disabled={save.isPending} className="space-y-4">
        {!editing && <div><Label htmlFor="voucher-code-mode">Pembuatan kode</Label><select id="voucher-code-mode" className={selectClass} value={randomCode ? "random" : "custom"} onChange={(e) => setRandomCode(e.target.value === "random")}><option value="custom">Kode custom</option><option value="random">Generate random</option></select></div>}
        <div><Label htmlFor="voucher-code">Kode voucher</Label><Input id="voucher-code" value={form.code} maxLength={20} disabled={randomCode} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder={randomCode ? "Dibuat otomatis saat disimpan" : "Contoh: HEMAT20"} autoCapitalize="characters" /><p className="mt-1 text-xs text-muted-foreground">Maksimal 20 karakter, huruf kapital, angka, - atau _.</p></div>
        <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="voucher-discount-type">Jenis diskon</Label><select id="voucher-discount-type" className={selectClass} value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as StoreVoucherInput["discount_type"], discount_value: e.target.value === "PERCENTAGE" ? 10 : 20000 })}><option value="FIXED">Potongan tetap (Rp)</option><option value="PERCENTAGE">Persentase (%)</option></select></div><div><Label htmlFor="voucher-value">{form.discount_type === "FIXED" ? "Nominal diskon (Rp)" : "Persentase diskon (%)"}</Label><Input id="voucher-value" type="number" min={1} max={form.discount_type === "PERCENTAGE" ? 100 : undefined} step={1} value={form.discount_value || ""} onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })} /></div></div>
        <div><Label htmlFor="voucher-expiry">Kedaluwarsa (waktu lokal)</Label><Input id="voucher-expiry" type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} /><p className="mt-1 text-xs text-muted-foreground">Kosongkan untuk berlaku tanpa batas waktu.</p></div>
        <div className="flex items-center justify-between gap-3"><Label htmlFor="voucher-active">Voucher aktif</Label><Switch id="voucher-active" checked={form.is_active} onCheckedChange={(value) => setForm({ ...form, is_active: value })} /></div>
        <div className="flex items-center justify-between gap-3"><div><Label htmlFor="voucher-settlement">Settlement aktif</Label><p className="text-xs text-muted-foreground">Transaksi ditandai UNSETTLED sampai dikonfirmasi.</p></div><Switch id="voucher-settlement" checked={form.requires_settlement} onCheckedChange={(value) => setForm({ ...form, requires_settlement: value })} /></div>
      </fieldset>{formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}<DialogFooter><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setDialogOpen(false)}>Batal</Button><Button type="submit" disabled={!canEdit || save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan voucher</Button></DialogFooter></form>
    </DialogContent></Dialog>
    <Dialog open={Boolean(settlementTarget)} onOpenChange={(open) => { if (!open && !settle.isPending) setSettlementTarget(undefined); }}><DialogContent><DialogHeader><DialogTitle>Konfirmasi settlement voucher</DialogTitle><DialogDescription>Pastikan penyelesaian potongan voucher untuk transaksi {settlementTarget?.transaction_code} sudah dilakukan. Status pembayaran dan penyerahan barang tetap berlaku.</DialogDescription></DialogHeader><p className="font-semibold">Potongan {formatCurrency(settlementTarget?.discount_amount ?? 0)}</p>{settle.isError && <p role="alert" className="text-sm text-destructive">{errorText(settle.error)}</p>}<DialogFooter><Button variant="outline" disabled={settle.isPending} onClick={() => setSettlementTarget(undefined)}>Batal</Button><Button disabled={!canSettle || settle.isPending} onClick={() => { if (settlementTarget && !settle.isPending) settle.mutate(settlementTarget); }}>Konfirmasi SETTLED</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
