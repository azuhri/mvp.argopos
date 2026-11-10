import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Customers from "./Customers";

const mocks = vi.hoisted(() => ({ getStoreCustomers: vi.fn() }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { role: "customer_reader" } }) }));
vi.mock("@/components/layout/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/lib/services/userService", () => ({ userService: { getCurrentUser: async () => ({ assigned_stores: [{ id: "my-store" }] }) } }));
vi.mock("@/lib/services/storeService", () => ({ storeService: { getStoreCustomers: mocks.getStoreCustomers } }));
afterEach(cleanup);

describe("customer read access", () => {
  it("reads only the assigned-store customer projection without transaction permission", async () => {
    mocks.getStoreCustomers.mockResolvedValue([{ id: "customer-one", name: "Customer One", email: "customer@example.test", type: "internal", status: "active", no_wa: "081234567890" }]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><Customers /></QueryClientProvider>);
    await waitFor(() => expect(screen.getAllByText("Customer One").length).toBeGreaterThan(0));
    expect(mocks.getStoreCustomers).toHaveBeenCalledWith("my-store");
    client.clear();
  });
});
