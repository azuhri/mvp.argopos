import { CreditCard, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LoadingSpinner } from "@/components/shared/SkeletonLoader";
import { getDokuPaymentMethodLabel } from "@/lib/dokuPaymentMethods";
import { formatCurrency } from "@/lib/mockData";

interface DokuMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  methods: string[];
  selectedMethod: string | null;
  onSelectMethod: (method: string) => void;
  amount: number;
  busy: boolean;
  unavailable: boolean;
  error: string;
  onConfirm: () => void;
}

export function DokuMethodDialog({ open, onOpenChange, methods, selectedMethod, onSelectMethod, amount, busy, unavailable, error, onConfirm }: DokuMethodDialogProps) {
  return <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
    <DialogContent className="commerce-theme commerce-panel max-h-[90dvh] max-w-md overflow-y-auto rounded-lg">
      <DialogHeader>
        <DialogTitle className="text-[#071a4f]">Pilih metode pembayaran DOKU</DialogTitle>
        <DialogDescription>Pesanan dibuat setelah Anda mengonfirmasi pilihan pembayaran.</DialogDescription>
      </DialogHeader>
      <RadioGroup aria-label="Metode pembayaran DOKU" value={selectedMethod || ""} onValueChange={onSelectMethod} disabled={busy || unavailable}>
        <div className="max-h-[42dvh] space-y-2 overflow-y-auto pr-1">
          {methods.map((method) => <Label key={method} htmlFor={`doku-method-${method}`} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-md border p-3 ${selectedMethod === method ? "border-[#071a4f] bg-[#eef2fb]" : "border-slate-200 bg-white"} ${busy || unavailable ? "cursor-not-allowed opacity-60" : ""}`}>
            <RadioGroupItem value={method} id={`doku-method-${method}`} />
            {method === "QRIS" ? <QrCode className="h-5 w-5 shrink-0 text-[#071a4f]" /> : <CreditCard className="h-5 w-5 shrink-0 text-[#071a4f]" />}
            <span className="font-bold leading-snug text-[#071a4f]">{getDokuPaymentMethodLabel(method)}</span>
          </Label>)}
        </div>
      </RadioGroup>
      {methods.length === 0 && <p role="alert" className="text-sm text-amber-900">Belum ada metode DOKU yang tersedia. Hubungi outlet atau coba kembali beberapa saat lagi.</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 p-3 text-sm">
        <span className="text-slate-600">Total belanja</span><strong className="text-lg text-[#071a4f]">{formatCurrency(amount)}</strong>
      </div>
      <p className="text-xs leading-relaxed text-slate-500">Setelah konfirmasi, Anda akan diarahkan ke DOKU untuk menyelesaikan pembayaran dengan metode pilihan Anda.</p>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Kembali ke keranjang</Button>
        <Button type="button" className="commerce-orange-button min-h-11 font-extrabold" disabled={busy || unavailable || !selectedMethod || !methods.includes(selectedMethod)} onClick={onConfirm}>
          {busy ? <><LoadingSpinner size="sm" />Memproses...</> : "Konfirmasi dan bayar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
