import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Payments from "./Payments";

const mocks = vi.hoisted(() => ({
  role: "admin", write: false,
  list: vi.fn(), reconciliation: vi.fn(), reconcile: vi.fn(), importSettlements: vi.fn(), exportReconciliation: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { role: mocks.role }, canRead: () => true, canWrite: () => mocks.write }) }));
vi.mock("@/lib/services/paymentService", () => ({ paymentService: mocks }));
vi.mock("@/components/layout/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
const settlement = { external_id: "statement-1", invoice_number: "CEL-ONE", gross_amount: 50000, fee_amount: 500, net_amount: 49500, settled_at: "2026-10-22T10:00:00+07:00" };
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><Payments /></QueryClientProvider>);
}

describe("payment finance report", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.role = "admin"; mocks.write = false;
    mocks.list.mockResolvedValue({ success: true, data: [{ payment_id: "attempt-one", invoice_number: "CEL-ONE", status: "PENDING", amount: 50000 }], meta: { total: 1 } });
    mocks.reconciliation.mockResolvedValue({ success: true, data: [] });
    mocks.importSettlements.mockResolvedValue({ success: true });
  });
  it("keeps read-only users from reconcile and import controls and applies filters server-side", async () => {
    renderPage();
    expect(await screen.findByText("CEL-ONE")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Periksa" })).not.toBeInTheDocument();
    expect(screen.queryByText("Impor settlement")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Invoice"), { target: { value: "CEL-TWO" } });
    fireEvent.click(screen.getByRole("button", { name: "Terapkan" }));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ invoice: "CEL-TWO", page: 1 })));
  });
  it("validates the settlement amounts and requires a preview confirmation before importing", async () => {
    mocks.role = "super_admin"; mocks.write = true; renderPage();
    const input = screen.getByLabelText("Data laporan yang telah dinormalisasi (JSON)");
    fireEvent.change(input, { target: { value: JSON.stringify({ records: [{ ...settlement, net_amount: 50000 }] }) } });
    fireEvent.click(screen.getByRole("button", { name: "Periksa data impor" }));
    expect(screen.getByRole("alert")).toHaveTextContent("gross − fee = net");
    expect(mocks.importSettlements).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: JSON.stringify({ records: [settlement] }) } });
    fireEvent.click(screen.getByRole("button", { name: "Periksa data impor" }));
    expect(mocks.importSettlements).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi impor settlement" }));
    await waitFor(() => expect(mocks.importSettlements).toHaveBeenCalledWith([settlement], expect.anything()));
  });
  it("rejects duplicate settlement identifiers within one import", async () => {
    mocks.role = "super_admin"; mocks.write = true; renderPage();
    fireEvent.change(screen.getByLabelText("Data laporan yang telah dinormalisasi (JSON)"), { target: { value: JSON.stringify([settlement, settlement]) } });
    fireEvent.click(screen.getByRole("button", { name: "Periksa data impor" }));
    expect(screen.getByRole("alert")).toHaveTextContent("External ID duplikat");
    expect(mocks.importSettlements).not.toHaveBeenCalled();
  });
});
