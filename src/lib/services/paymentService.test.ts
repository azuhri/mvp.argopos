import { afterEach, describe, expect, it, vi } from "vitest";
import { paymentAttemptKey, paymentService, validatedCheckoutUrl } from "./paymentService";

afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

describe("gateway transport", () => {
  it("reads public feature configuration without cross-origin cookies while payment status includes ownership cookies", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { enabled: false, methods: [] } }) });
    vi.stubGlobal("fetch", fetchMock);
    await paymentService.getConfig();
    await paymentService.getStatus("order-one");
    expect(fetchMock.mock.calls[0][1].credentials).toBe("same-origin");
    expect(fetchMock.mock.calls[1][1].credentials).toBe("include");
  });

  it("reuses a UUID per transaction and sends only the order ID and credentialed request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { status: "PENDING" } }) });
    vi.stubGlobal("fetch", fetchMock);
    await paymentService.createCheckout("order-one");
    await paymentService.createCheckout("order-one");
    const first = fetchMock.mock.calls[0][1];
    const second = fetchMock.mock.calls[1][1];
    expect(first.credentials).toBe("include");
    expect(JSON.parse(first.body)).toEqual({ transaction_id: "order-one" });
    expect(first.headers.get("Idempotency-Key")).toBe(second.headers.get("Idempotency-Key"));
    expect(paymentAttemptKey("order-two")).not.toBe(first.headers.get("Idempotency-Key"));
    expect(sessionStorage.getItem("argopos.payment-attempt.order-one")).toBe(first.headers.get("Idempotency-Key"));
  });

  it("does not expose provider response contents when ownership fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ success: false, message: "internal provider response" }) }));
    await expect(paymentService.getStatus("other-order")).rejects.toThrow("browser tempat pesanan dibuat");
  });

  it("explicitly refreshes only the selected transaction with its cookie and no caller-supplied payment state", async () => {
    const session = { transaction_id: "order-one", status: "PENDING", verification_pending: false };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: session, meta: { checked: true } }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await paymentService.refreshStatus("order-one")).toEqual({ session, checked: true });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/payments\/transactions\/order-one\/refresh$/);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", credentials: "include", cache: "no-store", body: "{}" });
    expect(fetchMock.mock.calls[0][1].headers.get("Content-Type")).toBe("application/json");
    expect(fetchMock.mock.calls[0][1].headers.has("Idempotency-Key")).toBe(false);
  });

  it("keeps a deferred provider check distinct from payment confirmation", async () => {
    const session = { transaction_id: "order-one", status: "PENDING", verification_pending: true };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: session, meta: { checked: false } }) }));
    expect(await paymentService.refreshStatus("order-one")).toEqual({ session, checked: false });
  });

  it("rejects refresh ownership errors without exposing raw provider details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ success: false, message: "private provider detail" }) }));
    await expect(paymentService.refreshStatus("other-order")).rejects.toThrow("browser tempat pesanan dibuat");
  });

  it("aborts the real transport when the polling query is unmounted", async () => {
    let transportSignal!: AbortSignal;
    vi.stubGlobal("fetch", vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      transportSignal = options.signal!;
      transportSignal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));
    const controller = new AbortController();
    const request = paymentService.refreshStatus("order-one", controller.signal);
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(transportSignal.aborted).toBe(true);
  });

  it("downloads owned PDF bytes with the attachment filename and without a bearer token", async () => {
    const blob = new Blob(["%PDF-1.4 test invoice"], { type: "application/pdf" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="Invoice-CEL-ONE.pdf"' }), blob: async () => blob });
    vi.stubGlobal("fetch", fetchMock);
    expect(await paymentService.downloadInvoice("order-one")).toEqual({ blob, filename: "Invoice-CEL-ONE.pdf" });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/payments\/transactions\/order-one\/invoice$/);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "include", cache: "no-store", redirect: "error" });
    expect(fetchMock.mock.calls[0][1].headers).toBeUndefined();
  });

  it.each([401, 409, 503])("handles invoice HTTP %s as a bounded error without downloading the response", async (status) => {
    const blob = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status, blob }));
    await expect(paymentService.downloadInvoice("order-one")).rejects.toMatchObject({ status });
    expect(blob).not.toHaveBeenCalled();
  });

  it("rejects a successful non-PDF response instead of saving it as an invoice", async () => {
    const blob = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ "Content-Type": "text/html" }), blob }));
    await expect(paymentService.downloadInvoice("order-one")).rejects.toThrow("format PDF");
    expect(blob).not.toHaveBeenCalled();
  });

  it("reuses the replacement key for repeated retries of one definitively rejected attempt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { status: "PENDING" } }) });
    vi.stubGlobal("fetch", fetchMock);
    const originalKey = paymentAttemptKey("order-retry");
    await paymentService.createCheckout("order-retry", "failed-one");
    await paymentService.createCheckout("order-retry", "failed-one");
    const replacementKey = fetchMock.mock.calls[0][1].headers.get("Idempotency-Key");
    expect(replacementKey).not.toBe(originalKey);
    expect(fetchMock.mock.calls[1][1].headers.get("Idempotency-Key")).toBe(replacementKey);
    expect(paymentAttemptKey("order-retry")).toBe(replacementKey);
  });

  it.each([
    "http://sandbox.doku.com/checkout", "https://sandbox.doku.com.evil.test/checkout",
    "https://evil.test@jokul.doku.com/checkout", "javascript:alert(1)",
    "https://checkout.doku.com/checkout", "https://jokul.doku.com:444/checkout",
  ])("rejects an unsafe or unverified checkout URL %s", (url) => {
    expect(() => validatedCheckoutUrl(url)).toThrow();
  });

  it.each(["https://sandbox.doku.com/checkout/a", "https://staging.doku.com/checkout-link-v2/test-only", "https://jokul.doku.com/checkout/a"])("accepts the verified checkout host %s", (url) => {
    expect(validatedCheckoutUrl(url)).toBe(url);
  });
});
