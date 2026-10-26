import { config } from "@/lib/config";

export interface PaymentSession {
  payment_id: string;
  transaction_id: string;
  invoice_number: string;
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED";
  amount: number;
  checkout_url?: string;
  expires_at: string;
  verification_pending: boolean;
  creation_state?: string;
  review_required?: boolean;
  channel?: string;
  doku_payment_method?: string;
  created_at?: string;
}

export interface PaymentConfig { enabled: boolean; methods: string[] }
export interface PaymentFilters {
  page?: number;
  page_size?: number;
  invoice?: string;
  channel?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}
export interface SettlementRecord {
  external_id: string;
  invoice_number: string;
  gross_amount: number;
  fee_amount: number;
  net_amount: number;
  settled_at: string;
}
export interface ReconciliationRow {
  invoice_number: string;
  external_id?: string;
  payment_status?: string;
  reconciliation_status: string;
  gross_amount?: number | null;
  fee_amount?: number | null;
  net_amount?: number | null;
}
export interface PaymentRefreshResult { session: PaymentSession; checked: boolean }
export interface CustomerPickupQR {
  transaction_id: string;
  qr_payload: string;
  issued_at: string;
  /** Legacy v1 metadata; handover QR codes no longer expire. */
  expires_at?: string;
}
interface Envelope<T> { success: boolean; data: T; meta?: { total?: number; checked?: boolean }; message?: string }

export class PaymentRequestError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

function paymentUrl(path: string, filters?: PaymentFilters) {
  const query = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return `${config.apiUrl.replace(/\/+$/, "")}/payments${path}${query.size ? `?${query}` : ""}`;
}

async function request<T>(path: string, options: RequestInit = {}, filters?: PaymentFilters, admin = false): Promise<Envelope<T>> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (admin) {
    const token = localStorage.getItem("argopos.auth.token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(paymentUrl(path, filters), { ...options, headers, signal: controller.signal, credentials: options.credentials ?? "include", cache: "no-store" });
    const payload: Envelope<T> | null = await response.json().catch(() => null);
    if (!response.ok || payload?.success !== true) {
      const message = response.status === 401 || response.status === 403
        ? admin ? "Anda tidak memiliki akses ke laporan atau tindakan pembayaran ini." : "Akses pembayaran tidak tersedia. Buka transaksi melalui browser tempat pesanan dibuat atau hubungi admin outlet."
        : "Pembayaran belum dapat diproses. Periksa status lalu coba lagi.";
      throw new PaymentRequestError(message, response.status);
    }
    return payload;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (error instanceof PaymentRequestError) throw error;
    throw new PaymentRequestError("Koneksi pembayaran terputus. Periksa status sebelum mencoba kembali.", 0);
  } finally {
    options.signal?.removeEventListener("abort", cancel);
    window.clearTimeout(timeout);
  }
}

const attemptKeys = new Map<string, string>();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Retry metadata only. Ownership credentials remain in the HttpOnly cookie.
export function paymentAttemptKey(transactionId: string): string {
  const storageKey = `argopos.payment-attempt.${transactionId}`;
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing && UUID_PATTERN.test(existing)) return existing;
  } catch { /* Storage may be unavailable in private browser sessions. */ }
  let key = attemptKeys.get(transactionId);
  if (!key) {
    key = crypto.randomUUID();
    attemptKeys.set(transactionId, key);
  }
  try { sessionStorage.setItem(storageKey, key); } catch { /* Keep the in-memory retry key. */ }
  return key;
}

function retryAttemptKey(transactionId: string, failedPaymentId: string): string {
  // Bind one replacement key to the rejected attempt. Retrying a lost response
  // for that same attempt must reuse this key, including after a page reload.
  const key = paymentAttemptKey(`${transactionId}.retry.${failedPaymentId}`);
  attemptKeys.set(transactionId, key);
  try { sessionStorage.setItem(`argopos.payment-attempt.${transactionId}`, key); } catch { /* In-memory key remains. */ }
  return key;
}

export function validatedCheckoutUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !["sandbox.doku.com", "staging.doku.com", "jokul.doku.com"].includes(url.hostname)) {
    throw new Error("Tautan pembayaran tidak valid. Hubungi admin outlet.");
  }
  return url.href;
}

function invoiceFilename(disposition: string | null, transactionId: string): string {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition?.match(/filename="([^"]+)"/i)?.[1] || disposition?.match(/filename=([^;]+)/i)?.[1];
  let filename = plain?.trim() || `invoice-${transactionId}.pdf`;
  if (encoded) {
    try { filename = decodeURIComponent(encoded); } catch { /* Use the plain attachment filename. */ }
  }
  filename = Array.from(filename, (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 || character === "/" || character === "\\" ? "_" : character).join("");
  return filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
}

export const paymentService = {
  async getPickupQr(transactionId: string, signal?: AbortSignal): Promise<CustomerPickupQR> {
    try {
      const { data } = await request<CustomerPickupQR>(`/transactions/${encodeURIComponent(transactionId)}/pickup-qr`, { signal });
      if (data?.transaction_id !== transactionId || typeof data.qr_payload !== "string" ||
          !/^celestia-pickup-v[12]\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(data.qr_payload) || data.qr_payload.length > 1024 ||
          !Number.isFinite(Date.parse(data.issued_at))) {
        throw new PaymentRequestError("QR penyerahan belum tersedia. Coba muat ulang QR.", 0);
      }
      return data;
    } catch (error) {
      if (error instanceof PaymentRequestError && error.status === 409) {
        throw new PaymentRequestError("QR belum tersedia untuk status pesanan ini. Periksa status pesanan atau hubungi admin toko.", 409);
      }
      throw error;
    }
  },
  async getConfig(): Promise<PaymentConfig> { return (await request<PaymentConfig>("/config", { credentials: "same-origin" })).data; },
  async getStatus(transactionId: string, signal?: AbortSignal): Promise<PaymentSession> {
    return (await request<PaymentSession>(`/transactions/${encodeURIComponent(transactionId)}`, { signal })).data;
  },
  async refreshStatus(transactionId: string, signal?: AbortSignal): Promise<PaymentRefreshResult> {
    const result = await request<PaymentSession>(`/transactions/${encodeURIComponent(transactionId)}/refresh`, {
      method: "POST", body: JSON.stringify({}), signal,
    });
    return { session: result.data, checked: result.meta?.checked === true };
  },
  async downloadInvoice(transactionId: string): Promise<{ blob: Blob; filename: string }> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(paymentUrl(`/transactions/${encodeURIComponent(transactionId)}/invoice`), {
        credentials: "include", cache: "no-store", redirect: "error", signal: controller.signal,
      });
      if (!response.ok) {
        const message = [401, 403].includes(response.status)
          ? "Akses invoice tidak tersedia. Gunakan browser tempat pesanan dibuat atau hubungi outlet."
          : response.status === 409
            ? "Invoice tersedia setelah pembayaran dikonfirmasi dan pemeriksaan selesai."
            : "Invoice belum dapat diunduh. Coba kembali sebentar lagi.";
        throw new PaymentRequestError(message, response.status);
      }
      if (response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/pdf") {
        throw new PaymentRequestError("Invoice belum tersedia dalam format PDF. Coba kembali sebentar lagi.", 0);
      }
      return { blob: await response.blob(), filename: invoiceFilename(response.headers.get("Content-Disposition"), transactionId) };
    } catch (error) {
      if (error instanceof PaymentRequestError) throw error;
      throw new PaymentRequestError("Koneksi unduhan terputus. Coba unduh invoice kembali.", 0);
    } finally { window.clearTimeout(timeout); }
  },
  async createCheckout(transactionId: string, rejectedPaymentId?: string): Promise<PaymentSession> {
    return (await request<PaymentSession>("/checkout", {
      method: "POST", headers: { "Idempotency-Key": rejectedPaymentId ? retryAttemptKey(transactionId, rejectedPaymentId) : paymentAttemptKey(transactionId) },
      body: JSON.stringify({ transaction_id: transactionId }),
    })).data;
  },
  list(filters: PaymentFilters) { return request<PaymentSession[]>("/admin", {}, filters, true); },
  reconcile(paymentId: string) { return request<PaymentSession>(`/admin/${encodeURIComponent(paymentId)}/reconcile`, { method: "POST" }, undefined, true); },
  reconciliation(filters: PaymentFilters = {}) { return request<ReconciliationRow[]>("/admin/reconciliation", {}, filters, true); },
  importSettlements(records: SettlementRecord[]) {
    return request<unknown>("/admin/settlements", { method: "POST", body: JSON.stringify({ records }) }, undefined, true);
  },
  async exportReconciliation(filters: PaymentFilters = {}): Promise<Blob> {
    const token = localStorage.getItem("argopos.auth.token");
    const url = new URL(paymentUrl("/admin/reconciliation", filters), window.location.origin);
    url.searchParams.set("format", "csv");
    const response = await fetch(url.toString(), {
      credentials: "include", cache: "no-store", headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error("Laporan rekonsiliasi belum dapat diunduh.");
    return response.blob();
  },
};
