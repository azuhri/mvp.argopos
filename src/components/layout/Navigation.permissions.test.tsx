import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { DashboardMobileNav } from "./DashboardMobileNav";
import type { MenuKey } from "@/lib/auth";

const mocks = vi.hoisted(() => ({ canRead: vi.fn(), role: "staff_internal" }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { role: mocks.role, username: "staff" }, canRead: mocks.canRead, logout: vi.fn() }) }));
vi.mock("@/components/shared/ThemeToggle", () => ({ ThemeToggle: () => null }));

beforeEach(() => { mocks.role = "staff_internal"; mocks.canRead.mockReset(); });
afterEach(cleanup);

describe("configured navigation access", () => {
  it("filters the dashboard mobile shortcuts using the same canonical grants", () => {
    mocks.canRead.mockImplementation((menuKey: MenuKey) => menuKey === "master_products");
    render(<MemoryRouter><DashboardMobileNav /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Product" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Transaction" })).not.toBeInTheDocument();
  });
  it("shows granted master menus for custom and staff roles", () => {
    mocks.role = "finance_readonly";
    mocks.canRead.mockImplementation((menuKey: MenuKey) => menuKey === "master_roles" || menuKey === "customers");
    render(<MemoryRouter><AppSidebar collapsed={false} onToggle={() => undefined} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Role Management" })).toHaveAttribute("href", "/master/roles");
    expect(screen.getByRole("link", { name: "Customers" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "User Management" })).not.toBeInTheDocument();
  });

  it("does not infer DOKU report access from transaction access", () => {
    mocks.canRead.mockImplementation((menuKey: MenuKey) => menuKey === "transactions");
    render(<MemoryRouter><AppSidebar collapsed={false} onToggle={() => undefined} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Transactions" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pembayaran DOKU" })).not.toBeInTheDocument();
  });

  it("finds a readable master menu in global search for a non-super-admin", () => {
    mocks.canRead.mockImplementation((menuKey: MenuKey) => menuKey === "master_roles");
    render(<MemoryRouter><TopBar title="Role Management" /></MemoryRouter>);
    const search = screen.getByPlaceholderText("Cari menu...");
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "Role" } });
    expect(screen.getByRole("option", { name: /Role Management/ })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "User" } });
    expect(screen.queryByRole("option", { name: /User Management/ })).not.toBeInTheDocument();
  });
});
