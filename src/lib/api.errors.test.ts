import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ responseUse: vi.fn(), requestUse: vi.fn() }));
vi.mock("axios", () => ({ default: { create: () => ({
  interceptors: { request: { use: mocks.requestUse }, response: { use: mocks.responseUse } },
  request: vi.fn(),
}) } }));

// Exercise the callbacks registered by the real ApiClient constructor.
import "./api";
const rejectResponse = mocks.responseUse.mock.calls[0][1] as (error: unknown) => Promise<never>;
const acceptResponse = mocks.responseUse.mock.calls[0][0] as (response: { data: unknown }) => unknown;

beforeEach(() => {
  const stored = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
    clear: () => stored.clear(),
  });
  localStorage.setItem("argopos.auth.token", "existing-staff-token");
  localStorage.setItem("argopos.auth.user", "existing-staff-user");
  window.history.replaceState({}, "", "/transactions/pickup-scan");
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("API response error interceptor", () => {
  it.each([
    [400, "QR penyerahan tidak valid."],
    [403, "Anda tidak memiliki akses ke toko ini."],
    [409, "Pesanan belum siap diambil."],
    [410, "QR kedaluwarsa. Perbarui QR pelanggan."],
  ])("preserves nested backend message and HTTP %s without clearing staff authentication", async (status, message) => {
    const failure = rejectResponse({ response: { status, statusText: "Generic status", data: { success: false, error: { message }, message: "Legacy fallback" } } });
    await expect(failure).rejects.toBeInstanceOf(Error);
    await expect(failure).rejects.toMatchObject({ message, status });
    expect(localStorage.getItem("argopos.auth.token")).toBe("existing-staff-token");
    expect(localStorage.getItem("argopos.auth.user")).toBe("existing-staff-user");
    expect(window.location.pathname).toBe("/transactions/pickup-scan");
  });

  it("keeps legacy top-level backend messages and status", async () => {
    await expect(rejectResponse({ response: { status: 422, statusText: "Unprocessable Entity", data: { message: "Field belum lengkap." } } })).rejects.toMatchObject({ message: "Field belum lengkap.", status: 422 });
  });

  it("uses the HTTP fallback when no backend error message is present", async () => {
    await expect(rejectResponse({ response: { status: 502, statusText: "Bad Gateway", data: "invalid upstream response" } })).rejects.toMatchObject({ message: "Bad Gateway", status: 502 });
  });

  it("keeps a bounded error when the network supplies no HTTP response", async () => {
    await expect(rejectResponse({ message: "Network Error" })).rejects.toMatchObject({ message: "API request failed", status: undefined });
    expect(localStorage.getItem("argopos.auth.token")).toBe("existing-staff-token");
  });

  it("retains 401 logout and redirects the protected staff page", async () => {
    const location = { pathname: "/transactions/pickup-scan", href: "http://localhost:3000/transactions/pickup-scan" } as Location;
    vi.spyOn(window, "location", "get").mockReturnValue(location);
    await expect(rejectResponse({ response: { status: 401, data: { error: { message: "Sesi berakhir." } } } })).rejects.toMatchObject({ message: "Sesi berakhir.", status: 401 });
    expect(localStorage.getItem("argopos.auth.token")).toBeNull();
    expect(localStorage.getItem("argopos.auth.user")).toBeNull();
    expect(location.href).toBe("/auth/sign-in");
  });

  it.each(["/FBND/commerce/payment/order-1", "/auth/sign-in"])("retains the 401 redirect exemption for %s", async (pathname) => {
    const location = { pathname, href: `http://localhost:3000${pathname}` } as Location;
    vi.spyOn(window, "location", "get").mockReturnValue(location);
    await expect(rejectResponse({ response: { status: 401, data: { error: { message: "Unauthorized" } } } })).rejects.toMatchObject({ status: 401 });
    expect(location.href).toBe(`http://localhost:3000${pathname}`);
    expect(localStorage.getItem("argopos.auth.token")).toBeNull();
  });

  it("does not change successful response normalization", () => {
    const payload = { success: true, data: { status: "COMPLETED" } };
    expect(acceptResponse({ data: payload })).toBe(payload);
  });
});
