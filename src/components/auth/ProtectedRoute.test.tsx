import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "./ProtectedRoute";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    canRead: vi.fn(() => false),
    canWrite: vi.fn(() => false),
  }),
}));

function SignInLocation() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  return <span>{from}</span>;
}

describe("ProtectedRoute", () => {
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
