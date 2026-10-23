import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCw, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/mockData";
import { paymentService, type PaymentFilters, type SettlementRecord } from "@/lib/services/paymentService";

const initialFilters = { invoice: "", channel: "", status: "", start_date: "", end_date: "" };

function parseSettlementImport(value: string): SettlementRecord[] {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error("Format JSON tidak valid."); }
  const records = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && "records" in parsed ? parsed.records : null;
  if (!Array.isArray(records) || records.length === 0 || records.length > 1000) throw new Error("Masukkan 1–1.000 baris settlement.");
  const ids = new Set<string>();
  return records.map((record: unknown, index) => {
    if (!record || typeof record !== "object") throw new Error(`Baris ${index + 1} tidak valid.`);
    const row = record as Record<string, unknown>;
    const { external_id, invoice_number, gross_amount, fee_amount, net_amount, settled_at } = row;
    if (typeof external_id !== "string" || !external_id.trim() || typeof invoice_number !== "string" || !invoice_number.trim() ||
        typeof settled_at !== "string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(settled_at) || !Number.isFinite(Date.parse(settled_at)) ||
        typeof gross_amount !== "number" || !Number.isSafeInteger(gross_amount) || gross_amount <= 0 ||
        typeof fee_amount !== "number" || !Number.isSafeInteger(fee_amount) || fee_amount < 0 ||
        typeof net_amount !== "number" || !Number.isSafeInteger(net_amount) || net_amount < 0 || gross_amount - fee_amount !== net_amount) {
      throw new Error(`Periksa referensi, timestamp dengan zona waktu, dan gross − fee = net pada baris ${index + 1}.`);
    }
    if (ids.has(external_id.trim())) throw new Error(`External ID duplikat pada baris ${index + 1}.`);
    ids.add(external_id.trim());
    return { external_id: external_id.trim(), invoice_number: invoice_number.trim(), gross_amount, fee_amount, net_amount, settled_at };
  });
}

export default function Payments() {
  const { user, canRead, canWrite } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState<PaymentFilters>({ page: 1, page_size: 20 });
  const [importText, setImportText] = useState("");
  const [preview, setPreview] = useState<SettlementRecord[] | null>(null);
  const [importError, setImportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [reconciliationPage, setReconciliationPage] = useState(1);
  const readable = canRead("transactions");
  const writable = canWrite("transactions");
  const canImport = user?.role === "super_admin" && writable;
  const report = useQuery({ queryKey: ["payments-admin", filters], queryFn: () => paymentService.list(filters), enabled: readable });
  const reconciliation = useQuery({ queryKey: ["payments-reconciliation", filters, reconciliationPage], queryFn: () => paymentService.reconciliation({ ...filters, page: reconciliationPage }), enabled: readable });
  const refreshReports = () => {
    void queryClient.invalidateQueries({ queryKey: ["payments-admin"] });
    void queryClient.invalidateQueries({ queryKey: ["payments-reconciliation"] });
  };
  const reconcile = useMutation({
    mutationFn: paymentService.reconcile,
    onSuccess: () => { refreshReports(); toast.success("Status pembayaran telah diperiksa."); },
    onError: () => toast.error("Status belum dapat diperiksa. Coba kembali beberapa saat lagi."),
  });
  const importMutation = useMutation({
    mutationFn: paymentService.importSettlements,
    onSuccess: () => { refreshReports(); setPreview(null); setImportText(""); toast.success("Settlement berhasil diimpor."); },
    onError: () => setImportError("Settlement belum dapat diimpor. Periksa format dan duplikasi referensi laporan."),
  });
  const exportReport = async () => {
    setExporting(true);
    try {
      const blob = await paymentService.exportReconciliation(filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = "rekonsiliasi-doku.csv";
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { toast.error("Laporan belum dapat diunduh."); } finally { setExporting(false); }
  };
  const page = filters.page || 1;
  const total = report.data?.meta?.total || 0;
  const reconciliationTotal = reconciliation.data?.meta?.total || 0;

  return <AppLayout title="Pembayaran DOKU"><div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Pembayaran DOKU</h1><p className="mt-1 text-sm text-muted-foreground">Status pembayaran dan pencocokan settlement.</p></div><Button variant="outline" disabled={exporting || !readable} onClick={() => void exportReport()}><Download className="mr-2 h-4 w-4" />{exporting ? "Mengunduh..." : "Ekspor rekonsiliasi CSV"}</Button></div>
    <form className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 xl:grid-cols-6" onSubmit={(event) => { event.preventDefault(); setFilters({ ...draft, page: 1, page_size: 20 }); setReconciliationPage(1); }}>
      <div><Label htmlFor="payment-invoice">Invoice</Label><Input id="payment-invoice" value={draft.invoice} onChange={(e) => setDraft({ ...draft, invoice: e.target.value })} placeholder="Referensi pembayaran" /></div>
      <div><Label htmlFor="payment-channel">Channel</Label><Input id="payment-channel" value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value })} placeholder="QRIS_DOKU / VA" /></div>
      <div><Label htmlFor="payment-status">Status</Label><select id="payment-status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}><option value="">Semua status</option>{["PENDING", "PAID", "FAILED", "EXPIRED"].map((status) => <option key={status}>{status}</option>)}</select></div>
      <div><Label htmlFor="payment-from">Dari tanggal</Label><Input id="payment-from" type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} /></div>
      <div><Label htmlFor="payment-to">Sampai tanggal</Label><Input id="payment-to" type="date" min={draft.start_date} value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} /></div>
      <Button type="submit" className="self-end"><Search className="mr-2 h-4 w-4" />Terapkan</Button>
    </form>
    <section className="overflow-hidden rounded-lg border bg-card" aria-label="Daftar pembayaran">
      {report.isPending ? <p className="p-6" role="status">Memuat pembayaran...</p> : report.error ? <div className="space-y-3 p-6"><p role="alert">Laporan pembayaran belum dapat dimuat.</p><Button variant="outline" onClick={() => void report.refetch()}>Coba lagi</Button></div> : <Table className="min-w-[720px]"><TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Nominal</TableHead><TableHead>Channel</TableHead><TableHead>Status</TableHead><TableHead>Dibuat</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader><TableBody>
        {(report.data?.data || []).map((row) => <TableRow key={row.payment_id}><TableCell className="max-w-64 break-all font-mono text-xs">{row.invoice_number}</TableCell><TableCell className="whitespace-nowrap">{formatCurrency(row.amount)}</TableCell><TableCell>{row.channel || "Belum dipilih"}</TableCell><TableCell><Badge variant="secondary">{row.status}</Badge>{row.review_required && <p className="mt-1 text-xs text-amber-700">Perlu ditinjau</p>}</TableCell><TableCell className="whitespace-nowrap text-xs">{row.created_at ? new Date(row.created_at).toLocaleString("id-ID") : "—"}</TableCell><TableCell>{writable && row.status !== "PAID" ? <Button size="sm" variant="outline" disabled={reconcile.isPending} onClick={() => reconcile.mutate(row.payment_id)}><RefreshCw className="mr-2 h-4 w-4" />Periksa</Button> : "—"}</TableCell></TableRow>)}
        {!report.data?.data?.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Belum ada pembayaran untuk filter ini.</TableCell></TableRow>}
      </TableBody></Table>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm"><span>{total} pembayaran · Halaman {page}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page === 1 || report.isFetching} onClick={() => setFilters({ ...filters, page: page - 1 })}>Sebelumnya</Button><Button size="sm" variant="outline" disabled={page * 20 >= total || report.isFetching} onClick={() => setFilters({ ...filters, page: page + 1 })}>Berikutnya</Button></div></div>
    </section>
    <section className="space-y-3 rounded-lg border bg-card p-4"><h2 className="text-lg font-semibold">Rekonsiliasi settlement</h2><p className="text-sm text-muted-foreground">Settlement dicocokkan dengan pembayaran yang sudah diverifikasi. Filter di atas berlaku untuk pembayaran, rekonsiliasi, dan ekspor CSV.</p>
      {reconciliation.isPending ? <p role="status">Memuat rekonsiliasi...</p> : reconciliation.error ? <div><p role="alert" className="text-sm">Rekonsiliasi belum dapat dimuat.</p><Button variant="outline" size="sm" onClick={() => void reconciliation.refetch()}>Coba lagi</Button></div> : <Table className="min-w-[720px]"><TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Status pencocokan</TableHead><TableHead>Gross</TableHead><TableHead>Fee</TableHead><TableHead>Net</TableHead></TableRow></TableHeader><TableBody>{(reconciliation.data?.data || []).map((row, i) => <TableRow key={`${row.invoice_number}-${i}`}><TableCell className="max-w-64 break-all font-mono text-xs">{row.invoice_number}{row.external_id && <p className="mt-1 text-muted-foreground">{row.external_id}</p>}</TableCell><TableCell><Badge variant="outline">{row.reconciliation_status}</Badge></TableCell><TableCell>{row.gross_amount == null ? "—" : formatCurrency(row.gross_amount)}</TableCell><TableCell>{row.fee_amount == null ? "—" : formatCurrency(row.fee_amount)}</TableCell><TableCell>{row.net_amount == null ? "—" : formatCurrency(row.net_amount)}</TableCell></TableRow>)}{!reconciliation.data?.data?.length && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Belum ada data rekonsiliasi.</TableCell></TableRow>}</TableBody></Table>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm"><span>{reconciliationTotal} hasil · Halaman {reconciliationPage}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={reconciliationPage === 1 || reconciliation.isFetching} onClick={() => setReconciliationPage(reconciliationPage - 1)}>Hasil sebelumnya</Button><Button size="sm" variant="outline" disabled={reconciliationPage * 20 >= reconciliationTotal || reconciliation.isFetching} onClick={() => setReconciliationPage(reconciliationPage + 1)}>Hasil berikutnya</Button></div></div>
    </section>
    {canImport && <section className="space-y-3 rounded-lg border bg-card p-4"><h2 className="text-lg font-semibold">Impor settlement</h2><Label htmlFor="settlement-json">Data laporan yang telah dinormalisasi (JSON)</Label><p className="text-sm text-muted-foreground">Gunakan external_id, invoice_number, gross_amount, fee_amount, net_amount, dan settled_at dengan zona waktu. Nilai rupiah berupa bilangan bulat.</p><Textarea id="settlement-json" rows={6} className="font-mono text-xs" placeholder={'{"records":[...]}'} value={importText} onChange={(e) => { setImportText(e.target.value); setPreview(null); setImportError(""); }} disabled={importMutation.isPending} />
      {importError && <p role="alert" className="text-sm text-destructive">{importError}</p>}
      {preview ? <div className="space-y-3 rounded-md border bg-muted/30 p-4"><p className="text-sm">{preview.length} baris siap diimpor · Gross {formatCurrency(preview.reduce((sum, row) => sum + row.gross_amount, 0))}. Pastikan data sesuai laporan Finance sebelum mengonfirmasi.</p><Button disabled={importMutation.isPending} onClick={() => importMutation.mutate(preview)}><Upload className="mr-2 h-4 w-4" />{importMutation.isPending ? "Mengimpor..." : "Konfirmasi impor settlement"}</Button></div> : <Button variant="outline" disabled={!importText.trim()} onClick={() => { try { setPreview(parseSettlementImport(importText)); setImportError(""); } catch (error) { setImportError((error as Error).message); } }}>Periksa data impor</Button>}
    </section>}
  </div></AppLayout>;
}
