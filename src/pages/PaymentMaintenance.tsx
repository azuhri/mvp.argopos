import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayoutCommerce } from "@/components/layout/AppLayoutCommerce";
import { DokuPaymentPanel } from "@/components/commerce/DokuPaymentPanel";
import { PaymentMaintenanceView } from "@/components/commerce/PaymentMaintenanceView";
import { config } from "@/lib/config";

export default function PaymentMaintenance() {
  const { locationCode = "", transactionId } = useParams();
  const navigate = useNavigate();
  const catalogHref = `/${locationCode}/commerce`;
  const handleVerifiedPaid = useCallback(() => {
    navigate(`/${locationCode}/commerce/payment-success/${transactionId}`, { replace: true });
  }, [locationCode, transactionId, navigate]);

  return (
    <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode}>
      <div className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center py-6">
        {transactionId
          ? <DokuPaymentPanel key={transactionId} transactionId={transactionId} presentation="maintenance" catalogHref={catalogHref} returnMode={false} onVerifiedPaid={handleVerifiedPaid} />
          : <PaymentMaintenanceView catalogHref={catalogHref} />}
      </div>
    </AppLayoutCommerce>
  );
}
