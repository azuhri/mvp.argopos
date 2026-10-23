import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStorePaymentSettings, updateStorePaymentSettings } from "./storePaymentSettingsService";
const mocks = vi.hoisted(() => ({ getStorePaymentSettings: vi.fn(), updateStorePaymentSettings: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: mocks }));
const settings = { location_id: "store-one", payment_mode: "DOKU", doku_available: true, doku_methods: ["QRIS"] };
describe("store payment settings service", () => {
  beforeEach(() => vi.clearAllMocks());
  it("returns the authoritative store mode and saves only the selected mode", async () => {
    mocks.getStorePaymentSettings.mockResolvedValue({ success: true, data: settings });
    mocks.updateStorePaymentSettings.mockResolvedValue({ success: true, data: settings });
    expect(await getStorePaymentSettings("store-one")).toEqual(settings);
    expect(await updateStorePaymentSettings("store-one", "DOKU")).toEqual(settings);
    expect(mocks.updateStorePaymentSettings).toHaveBeenCalledWith("store-one", "DOKU");
  });
  it.each([undefined, { ...settings, location_id: "another-store" }, { ...settings, payment_mode: "INVALID" }, { ...settings, doku_available: undefined }])("fails closed for an incomplete or mismatched response %#", async (data) => {
    mocks.getStorePaymentSettings.mockResolvedValue({ success: true, data });
    await expect(getStorePaymentSettings("store-one")).rejects.toThrow("belum dapat dimuat");
  });
});
