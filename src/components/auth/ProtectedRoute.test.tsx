import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "./ProtectedRoute";

const mocks = vi.hoisted(() => ({ signedIn: false, canRead: vi.fn(), canWrite: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: mocks.signedIn ? { role: "super_admin" } : null,
    loading: false,
    canRead: mocks.canRead,
    canWrite: mocks.canWrite,
  }),
}));

beforeEach(() => { mocks.signedIn = false; mocks.canRead.mockReturnValue(false); mocks.canWrite.mockReturnValue(false); });
afterEach(cleanup);

function SignInLocation() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  return <span>{from}</span>;
}

describe("ProtectedRoute", () => {
  it("denies direct navigation to a hidden menu regardless of role name", () => {
    mocks.signedIn = true;
    render(<MemoryRouter><ProtectedRoute menuKey="master_roles"><span>Protected content</span></ProtectedRoute></MemoryRouter>);
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("You don't have permission to access this page.");
  });

  it("allows read pages while denying a direct write route", () => {
    mocks.signedIn = true;
    mocks.canRead.mockReturnValue(true);
    const { rerender } = render(<MemoryRouter><ProtectedRoute menuKey="master_roles"><span>Protected content</span></ProtectedRoute></MemoryRouter>);
    expect(screen.getByText("Protected content")).toBeInTheDocument();
    rerender(<MemoryRouter><ProtectedRoute menuKey="master_roles" requireWrite><span>Protected content</span></ProtectedRoute></MemoryRouter>);
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("You don't have permission to modify this page.");
  });

  it("allows a shared detail through either owning menu without granting write access", () => {
    mocks.signedIn = true;
    mocks.canRead.mockImplementation(key => key === "master_stores");
    const { rerender } = render(<MemoryRouter><ProtectedRoute menuKey={["koperasi", "master_stores"]}><span>Store detail</span></ProtectedRoute></MemoryRouter>);
    expect(screen.getByText("Store detail")).toBeInTheDocument();
    rerender(<MemoryRouter><ProtectedRoute menuKey={["koperasi", "master_stores"]} requireWrite><span>Store detail</span></ProtectedRoute></MemoryRouter>);
    expect(screen.queryByText("Store detail")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
  it("preserves the complete email deep link when redirecting to sign in", async () => {
    render(
      <MemoryRouter
        initialEntries={["/master/store/store-id?tab=stock-management#incoming"]}
      >
        <Routes>
          <Route
            path="/master/store/:id"
            element={(
              <ProtectedRoute>
                <span>Protected content</span>
              </ProtectedRoute>
            )}
          />
          <Route path="/auth/sign-in" element={<SignInLocation />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("/master/store/store-id?tab=stock-management#incoming"),
    ).toBeInTheDocument();
  });
});
