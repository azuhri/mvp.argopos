import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("axios", () => ({ default: { create: () => ({
  interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  request: mocks.request,
}) } }));

import { apiClient } from "./api";

describe("transaction cookie compatibility", () => {
  it("confirms staff pickup with the signed QR on the protected endpoint", async () => {
    await apiClient.confirmPickupQr("celestia-pickup-v1.fixture.signature");
    expect(mocks.request.mock.calls[0][0]).toMatchObject({
      url: "/transactions/required/confirm-pickup-qr", method: "POST",
      data: { qr_payload: "celestia-pickup-v1.fixture.signature" },
    });
    expect(mocks.request.mock.calls[0][0].withCredentials).toBeUndefined();
  });
  beforeEach(() => { mocks.request.mockReset(); mocks.request.mockResolvedValue({ success: true }); });

  it("keeps public transaction detail compatible with legacy wildcard CORS", async () => {
    await apiClient.getTransaction("manual-one");
    expect(mocks.request.mock.calls[0][0].withCredentials).toBeUndefined();
  });

  it.each(["JSON", "FormData"])("only includes upload ownership cookies for a DOKU transaction (%s)", async (encoding) => {
    const file = encoding === "FormData" ? new File(["fixture"], "proof.png", { type: "image/png" }) : undefined;
    await apiClient.uploadPickupProof("manual-one", file, "proof");
    await apiClient.uploadPickupProof("gateway-one", file, "proof", "DOKU");
    expect(mocks.request.mock.calls[0][0].withCredentials).toBe(false);
    expect(mocks.request.mock.calls[1][0].withCredentials).toBe(true);
  });

  it("sends staff proof to the protected endpoint without requiring the customer's cookie", async () => {
    const file = new File(["fixture"], "proof.png", { type: "image/png" });
    await apiClient.uploadStaffPickupProof("gateway-one", file);
    const request = mocks.request.mock.calls[0][0];
    expect(request.url).toBe("/transactions/required/gateway-one/upload-pickup-proof");
    expect(request.method).toBe("POST");
    expect(request.withCredentials).toBeUndefined();
    expect(request.data.get("file")).toBe(file);
  });
});
