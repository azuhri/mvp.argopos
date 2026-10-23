import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StockTransferRequest } from "@/lib/api";
import { StoreStockRequestPanel } from "./StoreStockRequestPanel";

const mocks = vi.hoisted(() => ({
  auth: {
    user: {
      id: "admin-id",
      username: "Admin Store",
      email: "admin@store.test",
      role: "admin",
      role_id: "role-admin",
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    },
    loading: false,
    canWrite: vi.fn(() => true),
  },
  getCurrentUser: vi.fn(),
  getStockTransferRequests: vi.fn(),
  getStocks: vi.fn(),
  createStockTransferRequest: vi.fn(),
  approveStockTransferSource: vi.fn(),
  rejectStockTransferRequest: vi.fn(),
  receiveStockTransferRequest: vi.fn(),
  getStockApprovalLetter: vi.fn(),
  getAllLocations: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@/lib/services/userService", () => ({
  userService: { getCurrentUser: mocks.getCurrentUser },
}));

vi.mock("@/lib/services/stockService", () => ({
  stockService: {
    getStockTransferRequests: mocks.getStockTransferRequests,
    getStocks: mocks.getStocks,
    createStockTransferRequest: mocks.createStockTransferRequest,
    approveStockTransferSource: mocks.approveStockTransferSource,
    rejectStockTransferRequest: mocks.rejectStockTransferRequest,
    receiveStockTransferRequest: mocks.receiveStockTransferRequest,
    getStockApprovalLetter: mocks.getStockApprovalLetter,
  },
}));

vi.mock("@/lib/services/locationService", () => ({
  locationService: { getAllLocations: mocks.getAllLocations },
  isLocationActive: (location: { status?: string; is_active?: boolean }) => (
    location.status !== "inactive" && location.is_active !== false
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => {
      const { initial: _initial, animate: _animate, transition: _transition, ...domProps } = props;
      return <div {...domProps}>{children}</div>;
    },
  },
}));

const currentLocation = {
  id: "store-current",
  location_code: "STR-01",
  location_name: "Store Current",
  type: "store" as const,
  created_at: "2026-09-01T00:00:00Z",
};

const otherLocation = {
  id: "store-source",
  location_code: "STR-02",
  location_name: "Store Source",
  type: "store" as const,
  created_at: "2026-09-01T00:00:00Z",
};

const makeRequest = (
  overrides: Partial<StockTransferRequest> = {},
): StockTransferRequest => ({
  id: "request-1",
  movement_type: "transfer",
  from_location_id: currentLocation.id,
  to_location_id: otherLocation.id,
  master_product_id: "product-1",
  quantity: 5,
  status: "requested",
  notes: "Replenishment",
  rejection_reason: "",
  created_at: "2026-09-07T08:00:00Z",
  updated_at: "2026-09-07T08:00:00Z",
  from_location: currentLocation,
  to_location: otherLocation,
  master_product: {
    id: "product-1",
    product_code: "PRD-01",
    product_name: "Produk Test",
    description: "",
    base_price: 10000,
    image_path: "",
    image_url: "",
    image_collection_url: "",
    image_collection: [],
    created_by: "admin-id",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  },
  ...overrides,
});

const renderPanel = (route = "/master/store/store-current?tab=stock-management") => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <StoreStockRequestPanel
          locationId={currentLocation.id}
          locationName={currentLocation.location_name}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("StoreStockRequestPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.user.role = "admin";
    mocks.auth.loading = false;
    mocks.auth.canWrite.mockReturnValue(true);
    mocks.getCurrentUser.mockResolvedValue({
      ...mocks.auth.user,
      role: { id: "role-admin", role_name: "admin", created_at: "", updated_at: "" },
      assigned_stores: [currentLocation],
    });
    mocks.getStockTransferRequests.mockResolvedValue({
      requests: [],
      meta: { page: 1, page_size: 10, total: 0, total_pages: 1 },
    });
    mocks.getAllLocations.mockResolvedValue([currentLocation, otherLocation]);
  });

  it("uses location_id so incoming and outgoing requests are loaded together", async () => {
    mocks.getStockTransferRequests.mockResolvedValue({
      requests: [
        makeRequest(),
        makeRequest({
          id: "request-incoming",
          from_location_id: otherLocation.id,
          to_location_id: currentLocation.id,
          status: "source_approved",
        }),
      ],
      meta: { page: 1, page_size: 10, total: 2, total_pages: 1 },
    });

    renderPanel();

    expect(await screen.findAllByText("Produk Test")).toHaveLength(4);
    expect(mocks.getStockTransferRequests).toHaveBeenCalledWith({
      page: 1,
      page_size: 10,
      location_id: currentLocation.id,
      movement_type: "all",
      status: "all",
      sort_order: "desc",
    });
    expect(screen.getAllByText("Keluar").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Masuk").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Setujui sumber" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Konfirmasi diterima" }).length).toBeGreaterThan(0);
  });

  it("never approves merely by opening a deep link and requires explicit confirmation", async () => {
    mocks.getStockTransferRequests.mockResolvedValue({
      requests: [makeRequest()],
      meta: { page: 1, page_size: 10, total: 1, total_pages: 1 },
    });
    mocks.approveStockTransferSource.mockResolvedValue(makeRequest({ status: "source_approved" }));

    renderPanel("/master/store/store-current?tab=stock-management&request_id=request-1");

    expect(await screen.findByText("Request dari tautan approval")).toBeInTheDocument();
    expect(mocks.getStockTransferRequests).toHaveBeenCalledWith(expect.objectContaining({
      location_id: currentLocation.id,
      request_id: "request-1",
    }));
    expect(mocks.approveStockTransferSource).not.toHaveBeenCalled();

    fireEvent.click((await screen.findAllByRole("button", { name: "Setujui sumber" }))[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Setujui request" }));

    await waitFor(() => {
      expect(mocks.approveStockTransferSource).toHaveBeenCalledWith("request-1");
    });
  });

  it("shows source-approved transfer documents and fetches the PDF as an authenticated blob", async () => {
    const sourceApproved = makeRequest({
      status: "source_approved",
      approval_letter_available: true,
      approval_letter_number: "STK/TRF-REQ/20260907/REQUEST1",
    });
    const pdf = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    mocks.getStockTransferRequests.mockResolvedValue({
      requests: [sourceApproved],
      meta: { page: 1, page_size: 10, total: 1, total_pages: 1 },
    });
    mocks.getStockApprovalLetter.mockResolvedValue(pdf);
    const createObjectURL = vi.fn(() => "blob:approval-letter");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const previewWindow = {
      opener: window,
      document: { title: "", body: { textContent: "" } },
      location: { replace: vi.fn() },
      close: vi.fn(),
    };
    const open = vi.spyOn(window, "open").mockReturnValue(previewWindow as unknown as Window);

    renderPanel();

    fireEvent.click((await screen.findAllByRole("button", { name: "Lihat PDF" }))[0]);

    await waitFor(() => {
      expect(mocks.getStockApprovalLetter).toHaveBeenCalledWith("request-1", false);
      expect(createObjectURL).toHaveBeenCalledWith(pdf);
      expect(open).toHaveBeenCalledWith("about:blank", "_blank");
      expect(previewWindow.location.replace).toHaveBeenCalledWith("blob:approval-letter");
    });
    expect(screen.getAllByRole("button", { name: "Unduh PDF" }).length).toBeGreaterThan(0);
  });

  it("keeps superadmin approval actions scoped to the current store direction", async () => {
    mocks.auth.user.role = "super_admin";
    mocks.getStockTransferRequests.mockResolvedValue({
      requests: [
        makeRequest({
          id: "incoming-requested",
          from_location_id: otherLocation.id,
          to_location_id: currentLocation.id,
          status: "requested",
        }),
        makeRequest({
          id: "outgoing-approved",
          from_location_id: currentLocation.id,
          to_location_id: otherLocation.id,
          status: "source_approved",
        }),
      ],
      meta: { page: 1, page_size: 10, total: 2, total_pages: 1 },
    });

    renderPanel();

    expect(await screen.findAllByText("Produk Test")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Setujui sumber" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Konfirmasi diterima" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tolak" })).not.toBeInTheDocument();
  });

  it("does not load requests for an unassigned store admin", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      ...mocks.auth.user,
      assigned_stores: [otherLocation],
    });
    renderPanel();

    expect(await screen.findByText("Store tidak ditugaskan kepada Anda")).toBeInTheDocument();
    expect(mocks.getStockTransferRequests).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Ajukan transfer" })).not.toBeInTheDocument();
  });

  it("allows an assigned non-admin to monitor requests and open stage-eligible letters only", async () => {
    mocks.auth.user.role = "staff_internal";
    mocks.getCurrentUser.mockResolvedValue({
      ...mocks.auth.user,
      assigned_stores: [currentLocation],
    });
    mocks.getStockTransferRequests.mockResolvedValue({
      requests: [
        makeRequest(),
        makeRequest({
          id: "source-approved-request",
          status: "source_approved",
          approval_letter_available: true,
          approval_letter_number: "SAL-STAFF-VIEW",
        }),
      ],
      meta: { page: 1, page_size: 10, total: 2, total_pages: 1 },
    });

    renderPanel();

    expect(await screen.findByText("Akses monitoring")).toBeInTheDocument();
    expect(mocks.getStockTransferRequests).toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: "Lihat PDF" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Ajukan transfer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Setujui sumber" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tolak" })).not.toBeInTheDocument();
  });
});
