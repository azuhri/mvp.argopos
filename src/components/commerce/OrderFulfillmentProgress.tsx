import { Check, Clock3, Package, PackageCheck, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { status: "PAID", label: "Menunggu persiapan", icon: Clock3, description: "Pembayaran diterima. Menunggu staf toko memulai persiapan pesanan." },
  { status: "PREPARING_PRODUCT", label: "Sedang disiapkan", icon: Package, description: "Staf toko sedang menyiapkan pesanan. Tunjukkan QR penyerahan kepada admin toko saat menerima barang." },
  { status: "READY_TO_PICKUP", label: "Siap diambil", icon: ShoppingBag, description: "Pesanan Anda siap diambil. Tunjukkan QR penyerahan kepada admin toko saat menerima barang." },
  { status: "COMPLETED", label: "Pesanan diterima", icon: PackageCheck, description: "Penerimaan pesanan telah dikonfirmasi. Terima kasih telah berbelanja." },
];

export function OrderFulfillmentProgress({ status, refreshFailed = false }: { status: string; refreshFailed?: boolean }) {
  const currentIndex = steps.findIndex((step) => step.status === status);
  const current = steps[currentIndex];

  return (
    <section aria-labelledby="order-progress-title" className="commerce-panel p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="order-progress-title" className="font-extrabold text-[#071a4f]">Status pesanan</h2>
        <p role="status" className={cn("rounded-full px-3 py-1 text-xs font-bold", currentIndex >= 2 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-[#071a4f]")}>
          {current?.label ?? "Menunggu pembaruan status"}
        </p>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">
        {current?.description ?? "Pembayaran telah dikonfirmasi. Status penyiapan pesanan sedang diperbarui."}
      </p>

      <ol aria-label="Progres penyiapan pesanan" className="mt-6 grid gap-4 sm:grid-cols-4 sm:gap-0">
        {steps.map((step, index) => {
          const reached = currentIndex >= index;
          const done = currentIndex > index || status === "COMPLETED";
          const Icon = done ? Check : step.icon;
          return (
            <li key={step.status} aria-current={index === currentIndex ? "step" : undefined} className="relative flex items-center gap-3 sm:flex-col sm:items-start sm:gap-3">
              {index < steps.length - 1 && <span aria-hidden="true" className={cn("absolute left-4 top-8 h-7 w-px sm:left-8 sm:top-4 sm:h-px sm:w-[calc(100%-2rem)]", currentIndex > index ? "bg-emerald-300" : "bg-slate-200")} />}
              <span className={cn("relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border", done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : reached ? "border-[#071a4f] bg-[#071a4f] text-white" : "border-slate-200 bg-white text-slate-400")}>
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <span className={cn("text-sm font-bold sm:pr-3", reached ? "text-[#071a4f]" : "text-slate-500")}>{step.label}</span>
              <span className="sr-only">{done ? "Selesai" : index === currentIndex ? "Status saat ini" : "Belum tercapai"}</span>
            </li>
          );
        })}
      </ol>

      {refreshFailed ? <p role="alert" className="mt-5 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Status terbaru belum dapat dimuat. Progres terakhir tetap ditampilkan dan akan diperiksa kembali otomatis.</p> : status !== "COMPLETED" && <p className="mt-5 text-xs text-slate-500">Status diperbarui otomatis setiap 5 detik selama halaman aktif.</p>}
    </section>
  );
}
