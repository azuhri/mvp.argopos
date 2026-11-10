import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "./Login";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  navigate: vi.fn(),
  user: null as null | { role: string },
  loading: false,
  refreshing: false,
  canRead: vi.fn((key: string) => key === "dashboard"),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ login: mocks.login, user: mocks.user, loading: mocks.loading, permissionsRefreshing: mocks.refreshing, canRead: mocks.canRead }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("Login", () => {
  beforeEach(() => {
    mocks.login.mockReset();
    mocks.navigate.mockReset();
    mocks.user = null; mocks.loading = false; mocks.refreshing = false;
    mocks.canRead.mockImplementation((key: string) => key === "dashboard");
  });

  it("shows accessible validation messages for an empty form", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));

    expect(screen.getByText("Email wajib diisi")).toBeInTheDocument();
    expect(screen.getByText("Password wajib diisi")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("submits credentials and routes admin users to the dashboard", async () => {
    mocks.login.mockImplementation(async () => {
      mocks.user = { role: "admin" };
      return { ok: true, data: { user: { role: { role_name: "admin" } } } };
    });

    render(
      <MemoryRouter initialEntries={["/auth/sign-in"]}>
        <Login />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "admin@celestia.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));

    await waitFor(() => {
      expect(mocks.login).toHaveBeenCalledWith("admin@celestia.test", "password123");
      expect(mocks.navigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  it("returns authenticated users to the protected route they requested", async () => {
    mocks.login.mockImplementation(async () => {
      mocks.user = { role: "admin" };
      return { ok: true, data: { user: { role: { role_name: "admin" } } } };
    });

    render(
      <MemoryRouter
        initialEntries={[{ pathname: "/auth/sign-in", state: { from: "/transactions" } }]}
      >
        <Login />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "admin@celestia.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));

    await waitFor(() => {
      expect(mocks.login).toHaveBeenCalledWith("admin@celestia.test", "x");
      expect(mocks.navigate).toHaveBeenCalledWith("/transactions", { replace: true });
    });
  });

  it("waits for canonical grants and routes a custom role to its first readable menu", () => {
    mocks.user = { role: "finance_readonly" };
    mocks.loading = true;
    mocks.canRead.mockImplementation((key: string) => key === "payments");
    const { rerender } = render(<MemoryRouter><Login /></MemoryRouter>);
    expect(mocks.navigate).not.toHaveBeenCalled();
    mocks.loading = false;
    rerender(<MemoryRouter><Login /></MemoryRouter>);
    expect(mocks.navigate).toHaveBeenCalledWith("/payments", { replace: true });
  });

  it("keeps an explicit deep link so the route guard can deny hidden access", () => {
    mocks.user = { role: "finance_readonly" };
    mocks.canRead.mockImplementation((key: string) => key === "payments");
    render(<MemoryRouter initialEntries={[{ pathname: "/auth/sign-in", state: { from: "/master/roles?mode=view" } }]}><Login /></MemoryRouter>);
    expect(mocks.navigate).toHaveBeenCalledWith("/master/roles?mode=view", { replace: true });
  });

  it("sends a role with no grants to access denied", () => {
    mocks.user = { role: "super_admin" };
    mocks.canRead.mockReturnValue(false);
    render(<MemoryRouter><Login /></MemoryRouter>);
    expect(mocks.navigate).toHaveBeenCalledWith("/access-denied", { replace: true });
  });

  it("provides a named password visibility control", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    const passwordInput = screen.getByLabelText("Password");
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Tampilkan password" }));

    expect(passwordInput).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Sembunyikan password" })).toBeInTheDocument();
  });
});
