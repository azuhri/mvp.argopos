import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api";
import KoperasiDetailPage from "./KoperasiDetailPage";

const auth = vi.hoisted(() => ({ write: true }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "admin", role: "super_admin" }, canWrite: () => auth.write }) }));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/shared/AnimatedCounter", () => ({
  AnimatedCounter: ({ end }: { end: number }) => <span>{end}</span>,
}));
vi.mock("@/components/master/StoreStockRequestPanel", () => ({
  StoreStockRequestPanel: () => null,
}));
vi.mock("@/components/master/StockCatalogStatus", () => ({
  StockCatalogAccessInfo: () => null,
  StockCatalogStatus: () => null,
}));
vi.mock("@/components/master/StorePaymentSettings", () => ({
  StorePaymentSettings: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const store = {
  location_id: "store-empty",
  location_name: "Toko Test",
  location_code: "TEST",
  total_revenue: 0,
  total_transactions: 0,
  total_stock: 0,
};

function renderPage(tab = "summary") {
  render(
    <MemoryRouter initialEntries={[`/master/store/store-empty?tab=${tab}`]}>
      <Routes>
        <Route path="/master/store/:locationId" element={<KoperasiDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  auth.write = true;
  vi.spyOn(apiClient, "getDashboardAnalytics").mockResolvedValue({ success: true });
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("store detail empty collections", () => {
  it("keeps manual payment mutation controls disabled for a read-only role", async () => {
    auth.write = false;
    vi.spyOn(apiClient, "getStoreDetail").mockResolvedValue({ success: true, data: { ...store, product_stores: [], assigned_users: [], payment_methods: [] } });
    renderPage("payment");
    await screen.findByText("Metode Pembayaran Manual");
    for (const name of ["Tambah QRIS", "Tambah Transfer", "Tambah Cutoff"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it.each([null, undefined])("renders summary and user/payment tabs when API collections are %s", async (collection) => {
    vi.spyOn(apiClient, "getStoreDetail").mockResolvedValue({
      success: true,
      data: {
        ...store,
        product_stores: collection,
        assigned_users: collection,
        payment_methods: collection,
      },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText("Summary Metrics")).toBeVisible());
    expect(screen.getAllByText("Tidak ada product stock").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "User Assigned" }));
    await waitFor(() => expect(screen.getByText("User Assigned (0)")).toBeVisible());
    expect(screen.getByText("Tidak ada user assigned")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Payment Method" }));
    await waitFor(() => expect(screen.getByText("Metode Pembayaran Manual")).toBeVisible());
  });

  it("keeps assigned users visible on a direct users-tab link", async () => {
    vi.spyOn(apiClient, "getStoreDetail").mockResolvedValue({
      success: true,
      data: {
        ...store,
        product_stores: [],
        payment_methods: [],
        assigned_users: [{ id: "user-1", username: "Staff Test", email: "staff@example.test", no_wa: "" }],
      },
    });

    renderPage("users");

    await waitFor(() => expect(screen.getByText("User Assigned (1)")).toBeVisible());
    expect(screen.getByRole("cell", { name: "Staff Test" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "staff@example.test" })).toBeVisible();
    expect(screen.queryByText("Tidak ada user assigned")).not.toBeInTheDocument();
  });
});
