import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StorePaymentSettings } from "./StorePaymentSettings";

const mocks = vi.hoisted(() => ({
  get: vi.fn(), update: vi.fn(), canWrite: vi.fn(() => true),
  user: { id: "admin-one", role: "admin" } as { id: string; role: string } | null,
  authLoading: false,
  refreshPermissions: vi.fn().mockResolvedValue(undefined),
  permissionsRefreshing: false,
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: mocks.user, canWrite: mocks.canWrite, loading: mocks.authLoading, refreshPermissions: mocks.refreshPermissions, permissionsRefreshing: mocks.permissionsRefreshing }) }));
vi.mock("@/lib/services/storePaymentSettingsService", () => ({
  getStorePaymentSettings: mocks.get, updateStorePaymentSettings: mocks.update,
  storePaymentSettingsQueryKey: (id: string) => ["store-payment-settings", id],
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const base = { location_id: "store-one", payment_mode: "MANUAL", doku_available: true, doku_methods: ["VIRTUAL_ACCOUNT_BCA"] };
function renderSettings(assignedUserIds = ["admin-one"]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><StorePaymentSettings locationId="store-one" assignedUserIds={assignedUserIds}><button>Tambah QRIS existing</button></StorePaymentSettings></QueryClientProvider>);
}

describe("store payment settings", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.user = { id: "admin-one", role: "admin" }; mocks.authLoading = false; mocks.canWrite.mockReturnValue(true);
    mocks.permissionsRefreshing = false;
    mocks.get.mockResolvedValue({ ...base });
    mocks.update.mockImplementation(async (_id, mode) => {
      const saved = { ...base, payment_mode: mode };
      mocks.get.mockResolvedValue(saved);
      return saved;
    });
  });
  it("requires an explicit save and restores manual settings after switching back", async () => {
    renderSettings();
    expect(await screen.findByRole("radio", { name: /^Manual Payment/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Tambah QRIS existing" })).toBeEnabled();
    fireEvent.click(screen.getByRole("radio", { name: /^Payment gateway with DOKU/ }));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(screen.getByText("Aktif: Manual Payment")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tambah QRIS existing" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Simpan mode pembayaran" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("store-one", "DOKU"));
    expect(await screen.findByText("Aktif: DOKU")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /^Manual Payment/ }));
    expect(screen.getByRole("button", { name: "Tambah QRIS existing" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Batal" }));
    expect(screen.getByRole("radio", { name: /^Payment gateway with DOKU/ })).toBeChecked();
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });
  it("warns when DOKU is unavailable while allowing its mode to be configured", async () => {
    mocks.get.mockResolvedValue({ ...base, doku_available: false, doku_methods: [] });
    renderSettings();
    fireEvent.click(await screen.findByRole("radio", { name: /^Payment gateway with DOKU/ }));
    expect(screen.getByText("DOKU Checkout belum tersedia")).toBeInTheDocument();
    expect(screen.getByText(/pelanggan belum dapat membuat pesanan DOKU/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simpan mode pembayaran" })).toBeEnabled();
  });
  it.each(["permission", "assignment"])("prevents settings mutations without %s", async (boundary) => {
    if (boundary === "permission") mocks.canWrite.mockReturnValue(false);
    renderSettings(boundary === "assignment" ? [] : ["admin-one"]);
    expect(await screen.findByRole("radio", { name: /^Manual Payment/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /^Payment gateway with DOKU/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Simpan mode pembayaran" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tambah QRIS existing" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(boundary === "permission"
      ? "Akun Anda belum memiliki izin mengubah pengaturan toko. Hubungi administrator untuk meminta akses."
      : "Akun Anda belum ditugaskan ke toko ini. Hubungi administrator untuk meminta penugasan.");
    expect(screen.getByRole("group", { name: "Mode pembayaran toko" })).toHaveAccessibleDescription(/Akses hanya lihat/);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("explains that access is still being checked before reporting an account or permission problem", async () => {
    mocks.authLoading = true;
    mocks.user = null;
    mocks.canWrite.mockReturnValue(false);
    renderSettings();
    expect(await screen.findByRole("radio", { name: /^Manual Payment/ })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Sedang memeriksa akses akun Anda. Tunggu sebentar.");
    expect(screen.queryByText(/Anda belum masuk/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Simpan mode pembayaran" })).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("explains that a signed-out visitor needs to sign in", async () => {
    mocks.user = null;
    renderSettings();
    expect(await screen.findByRole("radio", { name: /^Manual Payment/ })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Anda belum masuk. Masuk dengan akun yang memiliki izin mengubah pengaturan toko.");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each(["staff_internal", "super_admin"])("allows %s with write permission and its required store access", async (role) => {
    mocks.user = { id: "admin-one", role };
    renderSettings(role === "super_admin" ? [] : ["admin-one"]);
    expect(await screen.findByRole("radio", { name: /^Manual Payment/ })).toBeEnabled();
    expect(screen.queryByText("Akses hanya lihat")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /^Payment gateway with DOKU/ }));
    fireEvent.click(screen.getByRole("button", { name: "Simpan mode pembayaran" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("store-one", "DOKU"));
  });
  it("still requires write permission for a super administrator", async () => {
    mocks.user = { id: "admin-one", role: "super_admin" };
    mocks.canWrite.mockReturnValue(false);
    renderSettings([]);
    expect(await screen.findByRole("radio", { name: /^Manual Payment/ })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Akun Anda belum memiliki izin mengubah pengaturan toko.");
    expect(screen.queryByText(/belum ditugaskan/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Simpan mode pembayaran" })).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("refreshes permissions on entry and lets a read-only user check again without writing settings", async () => {
    mocks.canWrite.mockReturnValue(false);
    renderSettings();
    fireEvent.click(await screen.findByRole("button", { name: "Periksa ulang akses" }));
    expect(mocks.refreshPermissions).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("radio", { name: /^Payment gateway with DOKU/ })).toBeDisabled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("keeps the saved mode unchanged when a write fails", async () => {
    mocks.update.mockRejectedValue(new Error("denied"));
    renderSettings();
    fireEvent.click(await screen.findByRole("radio", { name: /^Payment gateway with DOKU/ }));
    fireEvent.click(screen.getByRole("button", { name: "Simpan mode pembayaran" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("belum tersimpan");
    expect(screen.getByText("Aktif: Manual Payment")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simpan mode pembayaran" })).toBeEnabled();
  });
  it("does not silently assume Manual Payment when configuration cannot be loaded", async () => {
    mocks.get.mockRejectedValue(new Error("unavailable"));
    renderSettings();
    expect(await screen.findByRole("alert", {}, { timeout: 2500 })).toHaveTextContent("belum dapat dimuat");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tambah QRIS existing" })).not.toBeInTheDocument();
  });
});
