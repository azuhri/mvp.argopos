import { useCallback, useEffect, useRef, useState } from "react";
import { config } from "@/lib/config";
import {
  PENDING_PAYMENT_CHANGE_EVENT,
  PENDING_PAYMENT_STORAGE_KEY,
  type PendingPaymentReference,
  readPendingPayments,
  writePendingPayments,
} from "@/lib/pendingPaymentStorage";

const WAITING_TO_PAYMENT = "WAITING_TO_PAYMENT";
const RECONCILE_INTERVAL_MS = 30_000;

export interface PendingPaymentTransaction {
  id: string;
  transaction_code?: string;
  location_code?: string;
  location_name?: string;
  total_amount: number;
  status: string;
  created_at: string;
  expires_at: string;
}

export class PendingPaymentRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "PendingPaymentRequestError";
  }
}

interface ReconcilePendingPaymentsResult {
  verified: PendingPaymentReference[];
  retained: PendingPaymentReference[];
  failedCount: number;
}

type TransactionFetcher = (
  transactionId: string,
) => Promise<PendingPaymentTransaction>;

export async function fetchPendingPaymentTransaction(
  transactionId: string,
): Promise<PendingPaymentTransaction> {
  const response = await fetch(`${config.apiUrl}/transactions/${transactionId}`);
  if (!response.ok) {
    throw new PendingPaymentRequestError(
      response.status === 404
        ? "Transaksi tidak ditemukan"
        : "Status pembayaran belum dapat diperbarui",
      response.status,
    );
  }

  const payload: unknown = await response.json();
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("success" in payload) ||
    payload.success !== true ||
    !("data" in payload) ||
    typeof payload.data !== "object" ||
    payload.data === null
  ) {
    throw new PendingPaymentRequestError(
      "Respons transaksi tidak valid",
      502,
    );
  }

  return payload.data as PendingPaymentTransaction;
}

export async function reconcilePendingPayments(
  references: PendingPaymentReference[],
  fetchTransaction: TransactionFetcher = fetchPendingPaymentTransaction,
  now = Date.now(),
): Promise<ReconcilePendingPaymentsResult> {
  const results = await Promise.all(
    references.map(async (reference) => {
      try {
        const transaction = await fetchTransaction(reference.transaction_id);
        const expiresAt = Date.parse(transaction.expires_at);

        if (
          transaction.status !== WAITING_TO_PAYMENT ||
          !Number.isFinite(expiresAt) ||
          expiresAt <= now
        ) {
          return { kind: "remove" as const };
        }

        const verifiedReference: PendingPaymentReference = {
          transaction_id: transaction.id || reference.transaction_id,
          transaction_code:
            transaction.transaction_code || reference.transaction_code,
          location_code: transaction.location_code || reference.location_code,
          location_name: transaction.location_name || reference.location_name,
          total_amount: Number.isFinite(transaction.total_amount)
            ? transaction.total_amount
            : reference.total_amount,
          status: transaction.status,
          created_at: transaction.created_at || reference.created_at,
          expires_at: transaction.expires_at,
        };

        return { kind: "verified" as const, reference: verifiedReference };
      } catch (error) {
        if (
          error instanceof PendingPaymentRequestError &&
          error.status === 404
        ) {
          return { kind: "remove" as const };
        }

        return { kind: "failed" as const, reference };
      }
    }),
  );

  const verified: PendingPaymentReference[] = [];
  const retained: PendingPaymentReference[] = [];
  let failedCount = 0;

  for (const result of results) {
    if (result.kind === "verified") {
      verified.push(result.reference);
      retained.push(result.reference);
    } else if (result.kind === "failed") {
      failedCount += 1;
      retained.push(result.reference);
    }
  }

  const sortByExpiry = (
    left: PendingPaymentReference,
    right: PendingPaymentReference,
  ) => Date.parse(left.expires_at) - Date.parse(right.expires_at);

  return {
    verified: verified.sort(sortByExpiry),
    retained: retained.sort(sortByExpiry),
    failedCount,
  };
}

export function usePendingPayments(locationCode?: string) {
  const [payments, setPayments] = useState<PendingPaymentReference[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasReconcileError, setHasReconcileError] = useState(false);
  const requestId = useRef(0);

  const reconcile = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    const references = readPendingPayments();

    if (references.length === 0) {
      setPayments([]);
      setHasReconcileError(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const result = await reconcilePendingPayments(references);
    if (currentRequestId !== requestId.current) return;

    writePendingPayments(result.retained);
    setPayments(
      result.verified.filter(
        (reference) =>
          !locationCode || reference.location_code === locationCode,
      ),
    );
    setHasReconcileError(result.failedCount > 0);
    setIsLoading(false);
  }, [locationCode]);

  useEffect(() => {
    void reconcile();

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== PENDING_PAYMENT_STORAGE_KEY) return;
      void reconcile();
    };
    const handleLocalChange = () => void reconcile();
    const handleFocus = () => void reconcile();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void reconcile();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(PENDING_PAYMENT_CHANGE_EVENT, handleLocalChange);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = window.setInterval(
      () => void reconcile(),
      RECONCILE_INTERVAL_MS,
    );

    return () => {
      requestId.current += 1;
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(PENDING_PAYMENT_CHANGE_EVENT, handleLocalChange);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, [reconcile]);

  useEffect(() => {
    if (payments.length === 0) return;
    const nearestExpiry = Math.min(
      ...payments.map((payment) => Date.parse(payment.expires_at)),
    );
    const delay = Math.max(nearestExpiry - Date.now() + 50, 0);
    const timeout = window.setTimeout(
      () => void reconcile(),
      Math.min(delay, 2_147_483_647),
    );
    return () => window.clearTimeout(timeout);
  }, [payments, reconcile]);

  return {
    payments,
    isLoading,
    hasReconcileError,
    retry: reconcile,
  };
}
