import type { ReactNode } from "react";
import { ArrowLeft, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DOKU_MAINTENANCE_MESSAGE } from "@/lib/services/paymentService";

interface PaymentMaintenanceViewProps {
  catalogHref?: string;
  title?: string;
  message?: string;
  children?: ReactNode;
}

export function PaymentMaintenanceView({ catalogHref, title = "Pembayaran sedang maintenance", message = DOKU_MAINTENANCE_MESSAGE, children }: PaymentMaintenanceViewProps) {
  return (
    <section className="commerce-panel w-full space-y-6 p-6 text-center sm:p-10" aria-label="Informasi layanan pembayaran">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <Wrench className="h-9 w-9" aria-hidden="true" />
      </div>
      <div className="space-y-3">
        <h1 className="text-2xl font-extrabold leading-tight text-[#071a4f] sm:text-3xl">{title}</h1>
        <p role="alert" className="text-base leading-relaxed text-slate-600">{message}</p>
      </div>
      <div className="space-y-3">
        {children}
        {catalogHref && <Button asChild variant="outline" className="min-h-11 w-full"><Link to={catalogHref}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Kembali ke katalog</Link></Button>}
      </div>
    </section>
  );
}
