import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BottomNav } from "./BottomNav";

const mocks = vi.hoisted(() => ({ canWrite: vi.fn(), canRead: vi.fn() }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ canWrite: mocks.canWrite, canRead: mocks.canRead, user: { role: "staff_internal" } }) }));
vi.mock("@/lib/services/userService", () => ({ userService: { getCurrentUser: async () => ({ assigned_stores: [] }) } }));

function setup(path = "/transactions") {
  return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[path]}><BottomNav /></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => { mocks.canWrite.mockReturnValue(true); mocks.canRead.mockReturnValue(true); });
afterEach(cleanup);

describe("mandatory staff pickup navigation", () => {
  it("adds the scanner without removing existing permitted mobile destinations", () => {
    setup();
    expect(screen.getByRole("link", { name: "Scan QR penyerahan" })).toHaveAttribute("href", "/transactions/pickup-scan");
    for (const name of ["Dashboard", "Transactions", "Customers", "Koperasi"]) expect(screen.getByRole("link", { name })).toBeInTheDocument();
    expect(screen.getByRole("navigation")).not.toHaveClass("md:hidden");
  });
  it("marks only the scanner as current on the scan route", () => {
    setup("/transactions/pickup-scan");
    expect(screen.getByRole("link", { name: "Scan QR penyerahan" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Transactions" })).not.toHaveAttribute("aria-current");
  });
  it("keeps the scanner unavailable for read-only roles", () => {
    mocks.canWrite.mockReturnValue(false);
    setup();
    expect(screen.queryByRole("link", { name: "Scan QR penyerahan" })).not.toBeInTheDocument();
  });
});
