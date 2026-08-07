import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "./Index";

const mocks = vi.hoisted(() => ({
  getDashboardAnalytics: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiClient: { getDashboardAnalytics: mocks.getDashboardAnalytics },
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children, title }: { children: ReactNode; title: string }) => (
    <div data-testid="app-layout" data-title={title}>{children}</div>
  ),
}));

vi.mock("recharts", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Element = () => null;

  return {
    ResponsiveContainer: Container,
    AreaChart: Container,
    PieChart: Container,
    Pie: Container,
    Area: Element,
    CartesianGrid: Element,
    Cell: Element,
    Tooltip: Element,
    XAxis: Element,
    YAxis: Element,
  };
});

const renderDashboard = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("Dashboard", () => {
  beforeEach(() => {
    mocks.getDashboardAnalytics.mockReset();
  });

  it("renders analytics and recent transactions returned by the API", async () => {
    mocks.getDashboardAnalytics.mockResolvedValue({
      success: true,
      data: {
        summary: {
          total_revenue: 12500000,
          total_transactions: 42,
          unique_customers: 31,
          internal_customers: 20,
          external_customers: 11,
          revenue_growth: 8.4,
          previous_revenue: 11000000,
          period_start: "2026-07-01T00:00:00Z",
          period_end: "2026-07-30T00:00:00Z",
        },
        revenue_trend: [{ label: "Jul", month: "2026-07", revenue: 12500000 }],
        category_distribution: [{ name: "Frozen food", value: 100, raw_value: 42 }],
        recent_transactions: [
          {
            id: "transaction-1",
            invoice_number: "INV-2026-001",
            customer_name: "Budi",
            store_name: "Celestia Bandung",
            total: 250000,
            status: "PAID",
            created_at: "2026-07-30T08:00:00Z",
          },
        ],
      },
    });

    renderDashboard();

    expect(await screen.findByText("INV-2026-001")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Frozen food")).toBeInTheDocument();
    expect(mocks.getDashboardAnalytics).toHaveBeenCalledWith({ range_days: 30 });
  });

  it("shows a recoverable error state when analytics cannot load", async () => {
    mocks.getDashboardAnalytics.mockResolvedValue({ success: false, message: "Analytics unavailable" });

    renderDashboard();

    expect(
      await screen.findByText("Data dashboard belum dapat dimuat", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeInTheDocument();
  });
});
