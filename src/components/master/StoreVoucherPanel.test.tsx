import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { voucherService } from "@/lib/services/voucherService";
import type { StoreVoucher, VoucherUsage } from "@/lib/voucherTypes";
import { StoreVoucherPanel } from "./StoreVoucherPanel";

const auth = vi.hoisted(() => ({ write: true, transactionWrite: true, read: true, role: "staff_internal", refresh: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "admin", role: auth.role }, loading: false, canRead: () => auth.read, canWrite: (menu: string) => menu === "transactions" ? auth.transactionWrite : auth.write, refreshPermissions: auth.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
const voucher: StoreVoucher = { id: "voucher-1", location_id: "store", code: "HEMAT20", discount_type: "FIXED", discount_value: 20000, expires_at: null, is_active: true, requires_settlement: true, created_by: "admin", creator_name: "Store Admin", created_at: "2026-01-01T00:00:00Z" };
const usage: VoucherUsage = { id: "tx-1", transaction_code: "TRX-1", status: "PAID", paid_at: "2026-01-01T00:00:00Z", base_amount: 50000, total_amount: 30000, created_at: "2026-01-01T00:00:00Z", voucher_code: "HEMAT20", discount_amount: 20000, voucher_settlement_required: true, voucher_settlement_status: "UNSETTLED" };
function mount(assigned = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><StoreVoucherPanel locationId="store" assignedUserIds={assigned ? ["admin"] : []} /></QueryClientProvider>);
}
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); });
  auth.write = auth.transactionWrite = auth.read = true; auth.role = "staff_internal";
  vi.spyOn(voucherService, "list").mockResolvedValue({ items: [voucher], total: 1 });
  vi.spyOn(voucherService, "usage").mockResolvedValue({ items: [usage], total: 1 });
  vi.spyOn(voucherService, "save").mockResolvedValue(voucher);
  vi.spyOn(voucherService, "settle").mockResolvedValue({ ...usage, voucher_settlement_status: "SETTLED" });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("store voucher management", () => {
  it("uppercases custom codes and submits nullable expiry and settlement configuration", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Tambah voucher" }));
    fireEvent.change(screen.getByLabelText("Kode voucher"), { target: { value: "hemat20" } });
    expect(screen.getByLabelText("Kode voucher")).toHaveValue("HEMAT20");
    expect(screen.getByLabelText("Kode voucher")).toHaveAttribute("maxlength", "20");
    fireEvent.click(screen.getByRole("switch", { name: "Settlement aktif" }));
    fireEvent.click(screen.getByRole("button", { name: "Simpan voucher" }));
    await waitFor(() => expect(voucherService.save).toHaveBeenCalledWith("store", { code: "HEMAT20", discount_type: "FIXED", discount_value: 20000, expires_at: null, is_active: true, requires_settlement: true }, undefined));
  });

  it("delegates random code generation to the API and supports percentage discount", async () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: "Tambah voucher" }));
    fireEvent.change(screen.getByLabelText("Pembuatan kode"), { target: { value: "random" } });
    expect(screen.getByLabelText("Kode voucher")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Jenis diskon"), { target: { value: "PERCENTAGE" } });
    fireEvent.change(screen.getByLabelText("Persentase diskon (%)"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan voucher" }));
    await waitFor(() => expect(voucherService.save).toHaveBeenCalledWith("store", expect.objectContaining({ code: "", discount_type: "PERCENTAGE", discount_value: 15 }), undefined));
  });

  it("requires confirmation and the transaction write grant to settle a paid usage", async () => {
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Tandai SETTLED" }));
    expect(voucherService.settle).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi SETTLED" }));
    await waitFor(() => expect(voucherService.settle).toHaveBeenCalledWith("store", "tx-1"));
  });

  it.each(["unpaid", "missing-transaction-grant", "missing-store-grant"])("does not offer settlement for %s", async (reason) => {
    if (reason === "unpaid") vi.mocked(voucherService.usage).mockResolvedValue({ items: [{ ...usage, paid_at: null, status: "WAITING_TO_PAYMENT" }], total: 1 });
    else if (reason === "missing-store-grant") auth.write = false;
    else auth.transactionWrite = false;
    mount(); await screen.findByText("TRX-1");
    expect(screen.queryByRole("button", { name: "Tandai SETTLED" })).not.toBeInTheDocument();
  });

  it("preserves read-only access and blocks unassigned staff", async () => {
    auth.write = false; mount(); await screen.findByText("Store Admin");
    expect(screen.queryByRole("button", { name: "Tambah voucher" })).not.toBeInTheDocument();
    cleanup(); vi.mocked(voucherService.list).mockClear(); mount(false);
    await waitFor(() => expect(screen.getByText(/penugasan ke toko ini/)).toBeVisible());
    expect(voucherService.list).not.toHaveBeenCalled();
  });

  it("pages voucher configuration without losing the selected usage filter", async () => {
    vi.mocked(voucherService.list).mockImplementation(async (_store, page) => ({ items: [{ ...voucher, id: page === 2 ? "voucher-21" : voucher.id, code: page === 2 ? "PAGE2" : voucher.code }], total: 21 }));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Lihat penggunaan" }));
    await waitFor(() => expect(voucherService.usage).toHaveBeenLastCalledWith("store", expect.objectContaining({ voucher_id: "voucher-1" })));
    fireEvent.click(screen.getByRole("button", { name: "Voucher berikutnya" }));
    await screen.findByRole("button", { name: "Edit voucher PAGE2" });
    expect(voucherService.list).toHaveBeenLastCalledWith("store", 2);
    expect(screen.getByText("Voucher HEMAT20")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tampilkan semua voucher" }));
    await waitFor(() => expect(voucherService.usage).toHaveBeenLastCalledWith("store", expect.objectContaining({ voucher_id: "" })));
  });
});
